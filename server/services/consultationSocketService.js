/**
 * consultationSocketService.js
 *
 * ENTERPRISE TELEMEDICINE SOCKET SERVICE
 * Standalone /consultation namespace — fully isolated from ride/booking sockets.
 *
 * Architecture:
 *   - Dedicated Socket.IO namespace: /consultation
 *   - Rooms keyed by consultationId, not bookingId
 *   - Redis-adapter-ready (stateless participant tracking via Consultation model)
 *   - JWT auth per connection
 *   - Role-based event authorization
 *   - Heartbeat + auto-disconnect
 *   - Reconnect recovery
 *   - Full event logging → Consultation.eventLogs
 */

import { Server }  from 'socket.io';
import jwt         from 'jsonwebtoken';
import mongoose    from 'mongoose';

import Consultation  from '../models/Consultation.js';
import User          from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

/** @type {ConsultationSocketService|null} */
let _instance = null;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS  = 30_000;
const HEARTBEAT_TIMEOUT_MS   = 90_000;   // 3 missed = disconnect
const NETWORK_THROTTLE_MS    = 5_000;
const MAX_CHAT_LENGTH        = 5_000;
const MAX_RECONNECT_WAIT_MS  = 10_000;

// Roles allowed to join consultation namespace
const ALLOWED_ROLES = [
  'doctor', 'customer', 'care_assistant',
  'nurse', 'admin', 'superadmin',
];

// Roles with host permissions
const HOST_ROLES = ['doctor', 'admin', 'superadmin'];

// ─────────────────────────────────────────────────────────────────────────────
// ROOM NAME HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const rooms = {
  consultation:   (id)    => `consultation:${id}`,
  waiting:        (id)    => `consultation:waiting:${id}`,
  participants:   (id)    => `consultation:participants:${id}`,
  doctor:         (uid)   => `consultation:doctor:${uid}`,
  patient:        (uid)   => `consultation:patient:${uid}`,
  admins:         ()      => `consultation:admins`,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const verifyToken = (token) => {
  try   { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
};

/**
 * assertConsultationAccess
 * Returns { consultation, participantRole } or throws.
 */
const assertConsultationAccess = async (consultationId, user) => {
  if (!isValidId(consultationId)) throw new Error('Invalid consultationId');

  const consultation = await Consultation.findOne({ consultationId })
    .select('patient doctor hospital status participants waitingRoomEnabled consultationId bookingId')
    .lean();

  if (!consultation) throw new Error('Consultation not found');

  const { _id: userId, role } = user;

  if (['admin', 'superadmin'].includes(role)) {
    return { consultation, participantRole: 'admin' };
  }

  // Patient check
  if (consultation.patient?.toString() === userId) {
    return { consultation, participantRole: 'patient' };
  }

  // Doctor check (via DoctorProfile._id stored in consultation.doctor)
  if (role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: userId }).select('_id').lean();
    if (dp && consultation.doctor?.toString() === dp._id.toString()) {
      return { consultation, participantRole: 'doctor' };
    }
  }

  // Care assistant — linked participant
  if (role === 'care_assistant') {
    const inParticipants = consultation.participants?.some(
      (p) => p.userId?.toString() === userId && p.role === 'care_assistant'
    );
    if (inParticipants) return { consultation, participantRole: 'care_assistant' };
  }

  throw new Error('Not authorized for this consultation');
};

/**
 * logConsultationEvent — persists event to Consultation.eventLogs.
 * Fire-and-forget; never throws.
 */
const logConsultationEvent = (consultationId, eventType, actorId, actorType, payload = {}, source = 'server') => {
  Consultation.findOneAndUpdate(
    { consultationId },
    {
      $push: {
        eventLogs: {
          eventType,
          actorType,
          actorId: actorId || undefined,
          source,
          timestamp: new Date(),
          payload,
          severity: 'info',
        },
      },
    }
  ).catch((e) => console.error('[ConsultationSocket] eventLog write failed:', e.message));
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ConsultationSocketService {
  /**
   * @param {import('socket.io').Namespace} nsp  — /consultation namespace
   */
  constructor(nsp) {
    this.nsp = nsp;

    /**
     * connectedClients
     * Map<socketId, {
     *   userId:           string,
     *   role:             string,
     *   name:             string,
     *   consultationId:   string|null,
     *   participantRole:  string|null,
     *   joinedRooms:      Set<string>,
     *   connectedAt:      Date,
     *   lastHeartbeat:    Date,
     * }>
     */
    this.connectedClients = new Map();

    /** Network report throttle: Map<socketId, lastTimestamp> */
    this.networkThrottle = new Map();

    /** Heartbeat checker */
    this._heartbeatTimer = setInterval(() => this._checkHeartbeats(), HEARTBEAT_INTERVAL_MS);
  }

  // ── Public emit helpers ────────────────────────────────────────────────────

  emitToConsultation(consultationId, event, payload) {
    this.nsp
      .to(rooms.consultation(consultationId))
      .emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToWaiting(consultationId, event, payload) {
    this.nsp
      .to(rooms.waiting(consultationId))
      .emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToAdmins(event, payload) {
    this.nsp
      .to(rooms.admins())
      .emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToUser(userId, event, payload) {
    // Emit to both doctor and patient personal rooms
    this.nsp.to(rooms.doctor(userId)).emit(event, { ...payload, _serverTime: new Date().toISOString() });
    this.nsp.to(rooms.patient(userId)).emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToSocket(socketId, event, payload) {
    this.nsp.to(socketId).emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  /**
   * Server-side force-join — call from HTTP routes after consultation state changes.
   */
  forceJoinRoom(userId, room) {
    for (const [sid, meta] of this.connectedClients) {
      if (meta.userId === String(userId)) {
        this.nsp.in(sid).socketsJoin(room);
        meta.joinedRooms.add(room);
      }
    }
  }

  // ── Internal heartbeat checker ─────────────────────────────────────────────

  _checkHeartbeats() {
    const now = Date.now();
    for (const [sid, meta] of this.connectedClients) {
      const last = meta.lastHeartbeat?.getTime() ?? meta.connectedAt.getTime();
      if (now - last > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[ConsultationSocket] Heartbeat timeout: ${sid} (${meta.name})`);
        const socket = this.nsp.sockets.get(sid);
        if (socket) {
          socket.emit('consultation:auto_disconnect', {
            reason: 'heartbeat_timeout',
            _serverTime: new Date().toISOString(),
          });
          socket.disconnect(true);
        }
      }
    }
  }

  destroy() {
    clearInterval(this._heartbeatTimer);
  }

  // ── Socket setup ───────────────────────────────────────────────────────────

  setupSocket(socket, user) {
    const { _id: userId, role, name } = user;

    this.connectedClients.set(socket.id, {
      userId,
      role,
      name,
      consultationId:  null,
      participantRole: null,
      joinedRooms:     new Set(),
      connectedAt:     new Date(),
      lastHeartbeat:   new Date(),
    });

    // Auto-join admin room
    if (['admin', 'superadmin'].includes(role)) {
      socket.join(rooms.admins());
      this.connectedClients.get(socket.id)?.joinedRooms.add(rooms.admins());
    }

    // Auto-join personal rooms
    if (role === 'doctor') {
      socket.join(rooms.doctor(userId));
      this.connectedClients.get(socket.id)?.joinedRooms.add(rooms.doctor(userId));
    }
    if (role === 'customer') {
      socket.join(rooms.patient(userId));
      this.connectedClients.get(socket.id)?.joinedRooms.add(rooms.patient(userId));
    }

    console.log(`[ConsultationSocket] Connected: ${name} (${role}) sid=${socket.id}`);

    // ── PATIENT EVENTS ────────────────────────────────────────────────────────

    // consultation:join
    socket.on('consultation:join', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) { socket.emit('error', { message: 'consultationId required' }); return; }

        const { consultation, participantRole } = await assertConsultationAccess(consultationId, user).catch(e => { throw e; });

        // Status check
        if (['cancelled', 'failed', 'expired', 'completed'].includes(consultation.status)) {
          socket.emit('error', { message: `Consultation is ${consultation.status}` });
          return;
        }

        const meta = this.connectedClients.get(socket.id);
        if (meta) {
          meta.consultationId  = consultationId;
          meta.participantRole = participantRole;
        }

        // Doctor joins main + participant rooms
        // Patient: if waiting room enabled → waiting room first
        const isHost    = HOST_ROLES.includes(role);
        const mainRoom  = rooms.consultation(consultationId);
        const partRoom  = rooms.participants(consultationId);
        const waitRoom  = rooms.waiting(consultationId);

        if (isHost || !consultation.waitingRoomEnabled || participantRole === 'admin') {
          socket.join(mainRoom);
          socket.join(partRoom);
          meta?.joinedRooms.add(mainRoom);
          meta?.joinedRooms.add(partRoom);

          // Update participant state
          await Consultation.findOneAndUpdate(
            { consultationId, 'participants.userId': { $ne: new mongoose.Types.ObjectId(userId) } },
            {
              $push: {
                participants: {
                  participantId:     socket.id,
                  userId,
                  role:              participantRole,
                  displayName:       name,
                  joinedAt:          new Date(),
                  connectionStatus:  'connected',
                  waitingRoomStatus: 'admitted',
                },
              },
            }
          ).catch(() => {});

          // Update existing participant if rejoining
          await Consultation.findOneAndUpdate(
            { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
            {
              $set: {
                'participants.$.connectionStatus':  'connected',
                'participants.$.joinedAt':          new Date(),
                'participants.$.participantId':     socket.id,
                'participants.$.lastActiveAt':      new Date(),
              },
            }
          ).catch(() => {});

          // Patch doctor/patient join timestamps on main doc
          if (participantRole === 'doctor') {
            await Consultation.findOneAndUpdate(
              { consultationId },
              { $set: { doctorJoinedAt: new Date() } }
            ).catch(() => {});
          }
          if (participantRole === 'patient') {
            await Consultation.findOneAndUpdate(
              { consultationId },
              { $set: { patientJoinedAt: new Date() } }
            ).catch(() => {});
          }

          // Broadcast join
          this.nsp.to(mainRoom).emit('consultation:participant_joined', {
            consultationId,
            userId,
            participantRole,
            displayName: name,
            timestamp:   new Date().toISOString(),
          });

          socket.emit('consultation:joined', {
            consultationId,
            participantRole,
            rooms: [mainRoom, partRoom],
            _serverTime: new Date().toISOString(),
          });

          // Doctor join event
          if (participantRole === 'doctor') {
            this.emitToConsultation(consultationId, 'consultation:doctor_joined', {
              consultationId, userId, name,
            });
          }
          if (participantRole === 'patient') {
            this.emitToConsultation(consultationId, 'consultation:patient_joined', {
              consultationId, userId, name,
            });
          }

          logConsultationEvent(consultationId, 'join', userId, participantRole, { socketId: socket.id });

        } else {
          // Patient → waiting room
          socket.join(waitRoom);
          meta?.joinedRooms.add(waitRoom);

          await Consultation.findOneAndUpdate(
            { consultationId },
            {
              $push: {
                waitingRoomQueue: {
                  userId,
                  role:              'patient',
                  displayName:       name,
                  enteredAt:         new Date(),
                  waitingRoomStatus: 'waiting',
                },
              },
            }
          ).catch(() => {});

          socket.emit('consultation:waiting_room_entered', {
            consultationId,
            message: 'You are in the waiting room. Doctor will admit you shortly.',
            _serverTime: new Date().toISOString(),
          });

          // Notify doctor
          this.nsp.to(rooms.doctor(String(consultation.doctor))).emit('consultation:waiting_room_updated', {
            consultationId,
            patientUserId: userId,
            patientName:   name,
            action:        'patient_entered',
            timestamp:     new Date().toISOString(),
          });

          // Also notify main room (doctor already in it)
          this.nsp.to(mainRoom).emit('consultation:waiting_room_updated', {
            consultationId,
            patientUserId: userId,
            patientName:   name,
            action:        'patient_entered',
          });

          logConsultationEvent(consultationId, 'waiting_room_enter', userId, 'patient', { name });
        }
      } catch (err) {
        console.error('[consultation:join]', err.message);
        socket.emit('error', { message: err.message || 'Join failed' });
      }
    });

    // consultation:leave
    socket.on('consultation:leave', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;
        this._handleLeave(socket, userId, role, name, consultationId, 'voluntary');
      } catch (err) {
        console.error('[consultation:leave]', err.message);
      }
    });

    // consultation:waiting_room_enter (explicit re-enter)
    socket.on('consultation:waiting_room_enter', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;
        const waitRoom = rooms.waiting(consultationId);
        socket.join(waitRoom);
        this.connectedClients.get(socket.id)?.joinedRooms.add(waitRoom);
      } catch (err) {
        console.error('[consultation:waiting_room_enter]', err.message);
      }
    });

    // consultation:chat_send
    socket.on('consultation:chat_send', async ({ consultationId, message, messageType = 'text', attachments = [] } = {}) => {
      try {
        if (!consultationId || !message?.trim()) return;
        if (!isValidId(consultationId) && !consultationId.startsWith('CS-')) return;
        if (message.length > MAX_CHAT_LENGTH) {
          socket.emit('error', { message: 'Message too long' }); return;
        }

        const meta = this.connectedClients.get(socket.id);
        if (!meta?.consultationId) return;

        const newMsg = {
          sender:      new mongoose.Types.ObjectId(userId),
          senderRole:  meta.participantRole || role,
          messageType,
          message:     message.trim(),
          attachments,
          deliveredAt: new Date(),
        };

        const updated = await Consultation.findOneAndUpdate(
          { consultationId },
          {
            $push: { chatMessages: newMsg },
            $inc:  { totalMessages: 1 },
          },
          { new: true, select: 'chatMessages' }
        );

        const saved = updated?.chatMessages?.slice(-1)[0];

        this.emitToConsultation(consultationId, 'consultation:chat_message', {
          consultationId,
          messageId:   saved?._id,
          senderId:    userId,
          senderName:  name,
          senderRole:  meta.participantRole || role,
          messageType,
          message:     message.trim(),
          attachments,
          timestamp:   new Date().toISOString(),
        });

        logConsultationEvent(consultationId, 'chat_message_sent', userId, meta.participantRole || role, { messageType });
      } catch (err) {
        console.error('[consultation:chat_send]', err.message);
      }
    });

    // consultation:toggle_mic
    socket.on('consultation:toggle_mic', async ({ consultationId, enabled } = {}) => {
      try {
        if (!consultationId || typeof enabled !== 'boolean') return;

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          { $set: { 'participants.$.microphoneEnabled': enabled } }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:participant_mic_changed', {
          consultationId, userId, enabled, changedBy: userId,
        });
      } catch (err) {
        console.error('[consultation:toggle_mic]', err.message);
      }
    });

    // consultation:toggle_camera
    socket.on('consultation:toggle_camera', async ({ consultationId, enabled } = {}) => {
      try {
        if (!consultationId || typeof enabled !== 'boolean') return;

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          { $set: { 'participants.$.cameraEnabled': enabled } }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:participant_camera_changed', {
          consultationId, userId, enabled, changedBy: userId,
        });
      } catch (err) {
        console.error('[consultation:toggle_camera]', err.message);
      }
    });

    // consultation:raise_hand
    socket.on('consultation:raise_hand', async ({ consultationId, raised } = {}) => {
      try {
        if (!consultationId || typeof raised !== 'boolean') return;

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          { $set: { 'participants.$.handRaised': raised } }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:hand_raised', {
          consultationId, userId, name, raised,
        });
      } catch (err) {
        console.error('[consultation:raise_hand]', err.message);
      }
    });

    // consultation:network_update
    socket.on('consultation:network_update', async ({ consultationId, quality, bandwidth, latency, jitter, packetLoss } = {}) => {
      try {
        if (!consultationId || !quality) return;

        const now  = Date.now();
        const last = this.networkThrottle.get(socket.id) ?? 0;
        if (now - last < NETWORK_THROTTLE_MS) return;
        this.networkThrottle.set(socket.id, now);

        const meta = this.connectedClients.get(socket.id);

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          { $set: { 'participants.$.networkQuality': quality } }
        ).catch(() => {});

        await Consultation.findOneAndUpdate(
          { consultationId },
          {
            $push: {
              networkAnalytics: {
                participantId: new mongoose.Types.ObjectId(userId),
                role:          meta?.participantRole || role,
                bandwidth:     bandwidth ?? 0,
                latency:       latency   ?? 0,
                jitter:        jitter    ?? 0,
                packetLoss:    packetLoss ?? 0,
                timestamp:     new Date(),
              },
            },
          }
        ).catch(() => {});

        const payload = { consultationId, userId, role: meta?.participantRole || role, quality, latency };

        this.emitToConsultation(consultationId, 'consultation:call_quality_updated', payload);

        if (['poor', 'disconnected'].includes(quality)) {
          this.emitToAdmins('consultation:network_issue', { ...payload, _alert: true });
          logConsultationEvent(consultationId, 'network_issue', userId, meta?.participantRole || role, { quality });
        }
      } catch (err) {
        console.error('[consultation:network_update]', err.message);
      }
    });

    // consultation:reaction
    socket.on('consultation:reaction', ({ consultationId, emoji } = {}) => {
      if (!consultationId || !emoji) return;
      this.emitToConsultation(consultationId, 'consultation:reaction', {
        consultationId, userId, name, emoji,
      });
    });

    // consultation:end_request (patient requests end)
    socket.on('consultation:end_request', async ({ consultationId, reason } = {}) => {
      try {
        if (!consultationId) return;
        this.emitToConsultation(consultationId, 'consultation:end_requested', {
          consultationId, requestedBy: userId, name, role, reason,
        });
      } catch (err) {
        console.error('[consultation:end_request]', err.message);
      }
    });

    // ── DOCTOR / HOST EVENTS ──────────────────────────────────────────────────

    // consultation:start (doctor marks consultation active)
    socket.on('consultation:start', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;
        if (!HOST_ROLES.includes(role)) {
          socket.emit('error', { message: 'Host only' }); return;
        }

        const updated = await Consultation.findOneAndUpdate(
          { consultationId, status: { $in: ['created', 'scheduled', 'waiting'] } },
          {
            $set: {
              status:           'active',
              actualStartTime:  new Date(),
              consultationStage:'in_progress',
              roomStarted:      true,
            },
          },
          { new: true }
        );

        if (!updated) {
          socket.emit('error', { message: 'Cannot start — invalid status' }); return;
        }

        this.emitToConsultation(consultationId, 'consultation:consultation_started', {
          consultationId,
          startedBy:   userId,
          startedAt:   new Date().toISOString(),
          roomId:      updated.roomId,
          meetingId:   updated.meetingId,
        });

        this.emitToAdmins('consultation:consultation_started', { consultationId, doctorId: userId });
        logConsultationEvent(consultationId, 'consultation_start', userId, 'doctor');
      } catch (err) {
        console.error('[consultation:start]', err.message);
        socket.emit('error', { message: 'Start failed' });
      }
    });

    // consultation:admit_patient
    socket.on('consultation:admit_patient', async ({ consultationId, patientUserId } = {}) => {
      try {
        if (!consultationId || !patientUserId) return;
        if (!HOST_ROLES.includes(role)) { socket.emit('error', { message: 'Host only' }); return; }

        const mainRoom = rooms.consultation(consultationId);
        const waitRoom = rooms.waiting(consultationId);

        // Move patient socket(s) from waiting → main room
        for (const [sid, meta] of this.connectedClients) {
          if (meta.userId === patientUserId && meta.consultationId === consultationId) {
            this.nsp.in(sid).socketsLeave(waitRoom);
            this.nsp.in(sid).socketsJoin(mainRoom);
            this.nsp.in(sid).socketsJoin(rooms.participants(consultationId));
            meta.joinedRooms.delete(waitRoom);
            meta.joinedRooms.add(mainRoom);
          }
        }

        // Update waiting room queue + participant record
        await Consultation.findOneAndUpdate(
          { consultationId, 'waitingRoomQueue.userId': new mongoose.Types.ObjectId(patientUserId) },
          {
            $set: {
              'waitingRoomQueue.$.waitingRoomStatus': 'admitted',
              'waitingRoomQueue.$.approvedAt':        new Date(),
              'waitingRoomQueue.$.approvedBy':        new mongoose.Types.ObjectId(userId),
            },
          }
        ).catch(() => {});

        // Notify patient
        this.nsp.to(rooms.patient(patientUserId)).emit('consultation:waiting_room_approved', {
          consultationId,
          admittedBy: userId,
          message:    'You have been admitted to the consultation.',
          _serverTime: new Date().toISOString(),
        });

        // Notify main room
        this.emitToConsultation(consultationId, 'consultation:patient_joined', {
          consultationId, patientUserId,
        });

        logConsultationEvent(consultationId, 'waiting_room_approved', userId, 'doctor', { patientUserId });
      } catch (err) {
        console.error('[consultation:admit_patient]', err.message);
      }
    });

    // consultation:reject_patient
    socket.on('consultation:reject_patient', async ({ consultationId, patientUserId, reason } = {}) => {
      try {
        if (!consultationId || !patientUserId) return;
        if (!HOST_ROLES.includes(role)) return;

        await Consultation.findOneAndUpdate(
          { consultationId, 'waitingRoomQueue.userId': new mongoose.Types.ObjectId(patientUserId) },
          {
            $set: {
              'waitingRoomQueue.$.waitingRoomStatus': 'rejected',
              'waitingRoomQueue.$.rejectedAt':        new Date(),
              'waitingRoomQueue.$.rejectionReason':   reason || '',
            },
          }
        ).catch(() => {});

        this.nsp.to(rooms.patient(patientUserId)).emit('consultation:waiting_room_rejected', {
          consultationId, reason, _serverTime: new Date().toISOString(),
        });

        logConsultationEvent(consultationId, 'waiting_room_rejected', userId, 'doctor', { patientUserId, reason });
      } catch (err) {
        console.error('[consultation:reject_patient]', err.message);
      }
    });

    // consultation:mute_participant
    socket.on('consultation:mute_participant', async ({ consultationId, targetUserId } = {}) => {
      try {
        if (!consultationId || !targetUserId) return;
        if (!HOST_ROLES.includes(role)) { socket.emit('error', { message: 'Host only' }); return; }

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(targetUserId) },
          { $set: { 'participants.$.isMutedByHost': true, 'participants.$.microphoneEnabled': false } }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:participant_muted', {
          consultationId, targetUserId, mutedBy: userId,
        });

        logConsultationEvent(consultationId, 'mute', userId, 'doctor', { targetUserId });
      } catch (err) {
        console.error('[consultation:mute_participant]', err.message);
      }
    });

    // consultation:remove_participant
    socket.on('consultation:remove_participant', async ({ consultationId, targetUserId, reason } = {}) => {
      try {
        if (!consultationId || !targetUserId) return;
        if (!HOST_ROLES.includes(role)) { socket.emit('error', { message: 'Host only' }); return; }

        // Disconnect their socket(s)
        for (const [sid, meta] of this.connectedClients) {
          if (meta.userId === targetUserId && meta.consultationId === consultationId) {
            this.nsp.in(sid).socketsLeave(rooms.consultation(consultationId));
            this.nsp.in(sid).socketsLeave(rooms.participants(consultationId));
            this.nsp.to(sid).emit('consultation:removed', {
              consultationId, reason, _serverTime: new Date().toISOString(),
            });
          }
        }

        this.emitToConsultation(consultationId, 'consultation:participant_removed', {
          consultationId, targetUserId, removedBy: userId, reason,
        });

        logConsultationEvent(consultationId, 'participant_kicked', userId, 'doctor', { targetUserId, reason });
      } catch (err) {
        console.error('[consultation:remove_participant]', err.message);
      }
    });

    // consultation:start_recording
    socket.on('consultation:start_recording', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;
        if (!HOST_ROLES.includes(role)) { socket.emit('error', { message: 'Host only' }); return; }

        await Consultation.findOneAndUpdate(
          { consultationId },
          {
            $set: {
              'recording.recordingStarted':   true,
              'recording.recordingStatus':    'recording',
              'recording.recordingStartedAt': new Date(),
            },
          }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:recording_started', {
          consultationId, startedBy: userId, startedAt: new Date().toISOString(),
        });

        logConsultationEvent(consultationId, 'recording_start', userId, 'doctor');
      } catch (err) {
        console.error('[consultation:start_recording]', err.message);
      }
    });

    // consultation:stop_recording
    socket.on('consultation:stop_recording', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;
        if (!HOST_ROLES.includes(role)) return;

        await Consultation.findOneAndUpdate(
          { consultationId },
          {
            $set: {
              'recording.recordingStatus':  'processing',
              'recording.recordingEndedAt': new Date(),
            },
          }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:recording_stopped', {
          consultationId, stoppedBy: userId,
        });

        logConsultationEvent(consultationId, 'recording_stop', userId, 'doctor');
      } catch (err) {
        console.error('[consultation:stop_recording]', err.message);
      }
    });

    // consultation:screen_share_start
    socket.on('consultation:screen_share_start', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          { $set: { 'participants.$.screenSharing': true } }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:screen_share_started', {
          consultationId, userId, name,
        });

        logConsultationEvent(consultationId, 'screen_share_start', userId, role);
      } catch (err) {
        console.error('[consultation:screen_share_start]', err.message);
      }
    });

    // consultation:screen_share_stop
    socket.on('consultation:screen_share_stop', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          { $set: { 'participants.$.screenSharing': false } }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:screen_share_stopped', {
          consultationId, userId, name,
        });

        logConsultationEvent(consultationId, 'screen_share_stop', userId, role);
      } catch (err) {
        console.error('[consultation:screen_share_stop]', err.message);
      }
    });

    // consultation:end_consultation (doctor ends)
    socket.on('consultation:end_consultation', async ({ consultationId, reason, summary } = {}) => {
      try {
        if (!consultationId) return;
        if (!HOST_ROLES.includes(role)) { socket.emit('error', { message: 'Host only' }); return; }

        const now = new Date();

        const updated = await Consultation.findOneAndUpdate(
          { consultationId, status: { $in: ['active', 'paused', 'waiting'] } },
          {
            $set: {
              status:               'completed',
              actualEndTime:        now,
              consultationStage:    'post_consultation',
              completionStatus:     'in_progress',
              endedBy:              'doctor',
              endedByUserId:        new mongoose.Types.ObjectId(userId),
              endedReason:          reason || '',
              diagnosisSummary:     summary || '',
              doctorLeftAt:         now,
              roomEnded:            true,
            },
          },
          { new: true }
        );

        if (!updated) {
          socket.emit('error', { message: 'Cannot end — invalid status' }); return;
        }

        this.emitToConsultation(consultationId, 'consultation:consultation_ended', {
          consultationId,
          endedBy:    userId,
          endedAt:    now.toISOString(),
          reason,
          durationMinutes: updated.actualDurationMinutes,
        });

        this.emitToAdmins('consultation:consultation_ended', { consultationId, doctorId: userId });

        logConsultationEvent(consultationId, 'consultation_end', userId, 'doctor', { reason, durationMinutes: updated.actualDurationMinutes });

        // Give clients time to see the end event, then cleanup room
        setTimeout(() => {
          this.nsp.in(rooms.consultation(consultationId)).socketsLeave(rooms.consultation(consultationId));
        }, 5_000);
      } catch (err) {
        console.error('[consultation:end_consultation]', err.message);
        socket.emit('error', { message: 'End failed' });
      }
    });

    // ── SYSTEM / UTILITY EVENTS ───────────────────────────────────────────────

    // consultation:reconnecting
    socket.on('consultation:reconnecting', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;
        const meta = this.connectedClients.get(socket.id);

        await Consultation.findOneAndUpdate(
          { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
          {
            $set: { 'participants.$.connectionStatus': 'reconnecting' },
            $inc: { 'participants.$.reconnectCount': 1, 'networkStats.totalReconnects': 1 },
            $push: {
              reconnectLogs: {
                participantId: new mongoose.Types.ObjectId(userId),
                role:          meta?.participantRole || role,
                attemptAt:     new Date(),
              },
            },
          }
        ).catch(() => {});

        this.emitToConsultation(consultationId, 'consultation:reconnecting', {
          consultationId, userId, name,
        });

        logConsultationEvent(consultationId, 'reconnect', userId, meta?.participantRole || role);
      } catch (err) {
        console.error('[consultation:reconnecting]', err.message);
      }
    });

    // consultation:token_refresh_request
    socket.on('consultation:token_refresh_request', ({ consultationId } = {}) => {
      // Signal the client to call the HTTP token refresh endpoint.
      // Actual token generation happens in the REST layer.
      socket.emit('consultation:token_expiring', {
        consultationId,
        message: 'Request new token via POST /consultations/:id/join',
        _serverTime: new Date().toISOString(),
      });
    });

    // consultation:request_state (reconnect snapshot)
    socket.on('consultation:request_state', async ({ consultationId } = {}) => {
      try {
        if (!consultationId) return;

        const consultation = await Consultation.findOne({ consultationId })
          .select('status consultationStage participants waitingRoomQueue roomId meetingId recording.recordingStatus actualStartTime chatMessages')
          .lean();

        if (!consultation) { socket.emit('error', { message: 'Consultation not found' }); return; }

        socket.emit('consultation:state_snapshot', {
          consultationId,
          status:             consultation.status,
          consultationStage:  consultation.consultationStage,
          roomId:             consultation.roomId,
          meetingId:          consultation.meetingId,
          recordingStatus:    consultation.recording?.recordingStatus,
          participants:       consultation.participants?.map(p => ({
            userId:           p.userId,
            role:             p.role,
            displayName:      p.displayName,
            connectionStatus: p.connectionStatus,
            cameraEnabled:    p.cameraEnabled,
            microphoneEnabled:p.microphoneEnabled,
            screenSharing:    p.screenSharing,
            networkQuality:   p.networkQuality,
          })),
          waitingCount:       consultation.waitingRoomQueue?.filter(w => w.waitingRoomStatus === 'waiting').length ?? 0,
          actualStartTime:    consultation.actualStartTime,
          messageCount:       consultation.chatMessages?.length ?? 0,
          _serverTime:        new Date().toISOString(),
        });
      } catch (err) {
        console.error('[consultation:request_state]', err.message);
      }
    });

    // ping_health (heartbeat)
    socket.on('ping_health', () => {
      const meta = this.connectedClients.get(socket.id);
      if (meta) meta.lastHeartbeat = new Date();
      socket.emit('pong_health', {
        serverTime:     new Date().toISOString(),
        connectedSince: meta?.connectedAt,
        consultationId: meta?.consultationId,
      });
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      const meta = this.connectedClients.get(socket.id);

      if (meta?.consultationId) {
        this._handleLeave(socket, userId, role, name, meta.consultationId, `disconnect:${reason}`);
      }

      this.networkThrottle.delete(socket.id);
      this.connectedClients.delete(socket.id);

      console.log(`[ConsultationSocket] Disconnected: ${meta?.name || socket.id} reason=${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[ConsultationSocket error] ${socket.id}:`, err?.message ?? err);
    });
  }

  // ── Leave helper ───────────────────────────────────────────────────────────

  async _handleLeave(socket, userId, role, name, consultationId, reason = 'voluntary') {
    const mainRoom = rooms.consultation(consultationId);
    const waitRoom = rooms.waiting(consultationId);
    const partRoom = rooms.participants(consultationId);

    socket.leave(mainRoom);
    socket.leave(waitRoom);
    socket.leave(partRoom);

    const meta = this.connectedClients.get(socket.id);
    if (meta) {
      meta.joinedRooms.delete(mainRoom);
      meta.joinedRooms.delete(waitRoom);
      meta.joinedRooms.delete(partRoom);
    }

    const now = new Date();

    await Consultation.findOneAndUpdate(
      { consultationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          'participants.$.connectionStatus': 'disconnected',
          'participants.$.leftAt':           now,
        },
      }
    ).catch(() => {});

    if (role === 'doctor') {
      await Consultation.findOneAndUpdate(
        { consultationId },
        { $set: { doctorLeftAt: now } }
      ).catch(() => {});
    }
    if (role === 'customer') {
      await Consultation.findOneAndUpdate(
        { consultationId },
        { $set: { patientLeftAt: now } }
      ).catch(() => {});
    }

    this.nsp.to(mainRoom).emit('consultation:participant_left', {
      consultationId,
      userId,
      participantRole: meta?.participantRole || role,
      displayName:     name,
      reason,
      timestamp:       now.toISOString(),
    });

    logConsultationEvent(consultationId, 'leave', userId, meta?.participantRole || role, { reason });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats() {
    const byRole = {};
    const consultations = new Set();
    for (const [, meta] of this.connectedClients) {
      byRole[meta.role] = (byRole[meta.role] || 0) + 1;
      if (meta.consultationId) consultations.add(meta.consultationId);
    }
    return {
      totalConnected:        this.connectedClients.size,
      byRole,
      activeConsultations:   consultations.size,
      consultationIds:       [...consultations],
    };
  }

  isUserOnline(userId) {
    for (const [, meta] of this.connectedClients) {
      if (meta.userId === String(userId)) return true;
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAMESPACE AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

const buildAuthMiddleware = () => async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_MISSING'));

    const decoded = verifyToken(token);
    const userId  = decoded?.id || decoded?._id;
    if (!userId)  return next(new Error('AUTH_INVALID'));

    const user = await User.findById(userId).select('name role isBlocked').lean();
    if (!user)          return next(new Error('AUTH_USER_NOT_FOUND'));
    if (user.isBlocked) return next(new Error('AUTH_BLOCKED'));
    if (!ALLOWED_ROLES.includes(user.role)) return next(new Error('AUTH_ROLE_NOT_ALLOWED'));

    socket.user = {
      _id:  userId.toString(),
      role: user.role,
      name: user.name,
    };

    next();
  } catch (err) {
    console.error('[ConsultationSocket Auth]', err.message);
    next(new Error(`AUTH_ERROR: ${err.message}`));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

export const initConsultationSocket = (io) => {
  if (_instance) {
    console.warn('[ConsultationSocket] Already initialized — skipping');
    return _instance;
  }

  // Dedicated /consultation namespace — fully isolated
  const nsp = io.of('/consultation');

  nsp.use(buildAuthMiddleware());

  const service = new ConsultationSocketService(nsp);
  _instance     = service;

  nsp.on('connection', (socket) => {
    service.setupSocket(socket, socket.user);
  });

  nsp.on('error', (err) => {
    console.error('[ConsultationSocket namespace error]', err.message);
  });

  console.log('[ConsultationSocket] Initialized on /consultation namespace ✅');
  return service;
};

export const getConsultationSocketService = () => _instance;

export default { initConsultationSocket, getConsultationSocketService, rooms };