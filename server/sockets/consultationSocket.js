// sockets/consultationSocket.js
// Socket.IO namespace: /consultation
// Handles: join/leave, status sync, chat, vitals push, QoS, token refresh.
// Auth: JWT verified on handshake (same protect middleware pattern).

import jwt from 'jsonwebtoken';
import Consultation from '../models/Consultation.js';
import User         from '../models/User.js';
import {
  participantJoin,
  participantLeave,
  sendChatMessage,
  transitionStatus,
  updateParticipantNetworkQuality,
  saveVitals,
  forceRefreshTokens,
  getTokensForParticipant,
} from '../services/consultationService.js';
import {
  resolveJoinTransition,
  resolveLeaveTransition,
  assertJoinable,
  assertNotTerminal,
  assertRoleCanTransition,
  SOCKET_EVENT_STATUS_MAP,
  STATUS_META,
} from '../services/consultationStatus.js';

// ── Room naming helpers ───────────────────────────────────────────────────────

const consultationRoom = (id)    => `consultation:${id}`;
const doctorRoom       = (uid)   => `doctor:${uid}`;
const patientRoom      = (uid)   => `patient:${uid}`;
const adminRoom        = ()      => 'admin:consultations';
const waitingRoom      = (id)    => `waiting:${id}`;

// ── JWT handshake auth ────────────────────────────────────────────────────────

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_MISSING'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('name role avatar isBlocked');
    if (!user)         return next(new Error('USER_NOT_FOUND'));
    if (user.isBlocked) return next(new Error('ACCOUNT_BLOCKED'));

    socket.user = user;
    next();
  } catch (err) {
    const code =
      err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    next(new Error(code));
  }
};

// ── Error response helper ─────────────────────────────────────────────────────

const emit_error = (socket, event, message, code = 'ERROR') => {
  socket.emit(`${event}:error`, { success: false, message, code });
};

const emit_ok = (socket, event, data = {}) => {
  socket.emit(`${event}:ok`, { success: true, ...data });
};

// ── Main setup ────────────────────────────────────────────────────────────────

/**
 * registerConsultationSocket
 *
 * @param {import('socket.io').Server} io
 */
export const registerConsultationSocket = (io) => {

  const ns = io.of('/consultation');

  // ── Auth middleware ──────────────────────────────────────────────────────────
  ns.use(authenticateSocket);

  ns.on('connection', (socket) => {
    const { user } = socket;
    console.log(`[Socket] connected: ${user.name} (${user.role}) — ${socket.id}`);

    // ── 1. JOIN CONSULTATION ROOM ─────────────────────────────────────────────
    /**
     * Client emits: consultation:join
     * Payload: { consultationId, deviceInfo? }
     *
     * Server:
     *  - Validates user is doctor or patient of this consultation
     *  - Joins socket rooms
     *  - Logs participant event to DB
     *  - Resolves status transition
     *  - Emits agora tokens back to caller
     *  - Broadcasts status update to room
     */
    socket.on('consultation:join', async ({ consultationId, deviceInfo = {} }) => {
      try {
        if (!consultationId) throw new Error('consultationId required');

        const consultation = await Consultation.findById(consultationId)
          .select('patient doctorUser doctor status consultationType agora booking isActive')
          .lean({ virtuals: true });

        if (!consultation) throw new Error('Consultation not found');

        // Determine role
        const userId   = user._id.toString();
        const isDoctor = consultation.doctorUser?.toString() === userId;
        const isPatient= consultation.patient.toString()     === userId;
        const isAdmin  = ['admin', 'superadmin'].includes(user.role);

        if (!isDoctor && !isPatient && !isAdmin) {
          return emit_error(socket, 'consultation:join', 'Forbidden — not a participant', 'FORBIDDEN');
        }

        // Joinable check
        assertJoinable(consultation.status);

        const participantRole = isDoctor ? 'doctor' : isPatient ? 'patient' : 'observer';

        // Join rooms
        socket.join(consultationRoom(consultationId));
        if (isDoctor)  socket.join(doctorRoom(userId));
        if (isPatient) socket.join(patientRoom(userId));
        if (isAdmin)   socket.join(adminRoom());

        // Waiting room room (for queue updates)
        socket.join(waitingRoom(consultationId));

        // Store context on socket for later events
        socket.consultationId    = consultationId;
        socket.participantRole   = participantRole;
        socket.isDoctor          = isDoctor;
        socket.isPatient         = isPatient;

        // DB update + status transition
        const { consultation: updated, tokens } = await participantJoin(
          consultationId,
          userId,
          participantRole,
          deviceInfo,
        );

        // Emit tokens back to caller only
        emit_ok(socket, 'consultation:join', {
          consultation: {
            _id:    updated._id,
            status: updated.status,
            consultationType: updated.consultationType,
            agora: {
              channelName:    updated.agora?.channelName,
              rtmChannelName: updated.agora?.rtmChannelName,
              appId:          updated.agora?.appId,
            },
          },
          tokens,  // rtcToken, rtmToken, uid, expiresAt (null for chat/in_person)
          participantRole,
          statusMeta: STATUS_META[updated.status],
        });

        // Broadcast status change to everyone in room
        ns.to(consultationRoom(consultationId)).emit('consultation:status', {
          status:     updated.status,
          statusMeta: STATUS_META[updated.status],
          changedBy:  { userId, role: participantRole, name: user.name },
          updatedAt:  new Date(),
        });

        // Let admin room know
        ns.to(adminRoom()).emit('consultation:participant-joined', {
          consultationId,
          userId,
          role: participantRole,
          status: updated.status,
        });

      } catch (err) {
        console.error('[Socket] consultation:join error:', err.message);
        emit_error(socket, 'consultation:join', err.message);
      }
    });

    // ── 2. LEAVE CONSULTATION ─────────────────────────────────────────────────
    /**
     * Client emits: consultation:leave
     * Payload: { consultationId, metrics? }
     */
    socket.on('consultation:leave', async ({ consultationId, metrics = {} }) => {
      try {
        const userId = user._id.toString();
        const role   = socket.participantRole || 'patient';

        const updated = await participantLeave(consultationId, userId, role, metrics);

        // Resolve potential status transition
        const nextStatus = resolveLeaveTransition(updated.status, role);
        let finalStatus = updated;
        if (nextStatus) {
          finalStatus = await transitionStatus(consultationId, nextStatus, {
            actor: userId,
            reason: `${role} left the session`,
          });
        }

        socket.leave(consultationRoom(consultationId));

        ns.to(consultationRoom(consultationId)).emit('consultation:participant-left', {
          userId,
          role,
          status:     finalStatus.status,
          statusMeta: STATUS_META[finalStatus.status],
          leftAt:     new Date(),
        });

        emit_ok(socket, 'consultation:leave', { status: finalStatus.status });

      } catch (err) {
        console.error('[Socket] consultation:leave error:', err.message);
        emit_error(socket, 'consultation:leave', err.message);
      }
    });

    // ── 3. START / END / PAUSE / RESUME / CANCEL ──────────────────────────────
    // Generic status transition handler
    const handleStatusTransition = (targetStatus) => async ({ consultationId, reason } = {}) => {
      try {
        assertRoleCanTransition(targetStatus, user.role);

        const c = await Consultation.findById(consultationId).select('status patient doctorUser');
        if (!c) return emit_error(socket, `consultation:${targetStatus}`, 'Not found');

        assertNotTerminal(c.status);

        const updated = await transitionStatus(consultationId, targetStatus, {
          actor:  user._id.toString(),
          reason: reason || null,
          metadata: {
            cancelledBy: user.role === 'customer' ? 'patient' : user.role,
          },
        });

        ns.to(consultationRoom(consultationId)).emit('consultation:status', {
          status:     updated.status,
          statusMeta: STATUS_META[updated.status],
          changedBy:  { userId: user._id, role: user.role, name: user.name },
          reason,
          updatedAt: new Date(),
        });

        ns.to(adminRoom()).emit('consultation:status-change', {
          consultationId,
          fromStatus: c.status,
          toStatus:   updated.status,
          changedBy:  user._id,
        });

        emit_ok(socket, `consultation:${targetStatus}`, { status: updated.status });
      } catch (err) {
        console.error(`[Socket] consultation:${targetStatus} error:`, err.message);
        emit_error(socket, `consultation:${targetStatus}`, err.message);
      }
    };

    socket.on('consultation:start',          handleStatusTransition('in_progress'));
    socket.on('consultation:end',            handleStatusTransition('completed'));
    socket.on('consultation:pause',          handleStatusTransition('paused'));
    socket.on('consultation:resume',         handleStatusTransition('in_progress'));
    socket.on('consultation:cancel',         handleStatusTransition('cancelled'));
    socket.on('consultation:no-show',        handleStatusTransition('missed'));
    socket.on('consultation:technical-fail', handleStatusTransition('technical_failure'));

    // ── 4. WAITING ROOM ───────────────────────────────────────────────────────
    socket.on('consultation:waiting-enter', async ({ consultationId }) => {
      try {
        const c = await Consultation.findById(consultationId).select('doctorUser status waitingRoom');
        if (!c) return emit_error(socket, 'consultation:waiting-enter', 'Not found');

        const updated = await transitionStatus(consultationId, 'waiting', {
          actor:  user._id.toString(),
          metadata: { estimatedWaitMin: 5 },
        });

        socket.join(waitingRoom(consultationId));

        // Notify doctor in their personal room
        ns.to(doctorRoom(c.doctorUser.toString())).emit('consultation:patient-waiting', {
          consultationId,
          patientId:   user._id,
          patientName: user.name,
          enteredAt:   new Date(),
          status:      updated.status,
        });

        ns.to(consultationRoom(consultationId)).emit('consultation:status', {
          status:     updated.status,
          statusMeta: STATUS_META[updated.status],
          updatedAt:  new Date(),
        });

        emit_ok(socket, 'consultation:waiting-enter', {
          estimatedWaitMin: updated.waitingRoom?.estimatedWaitMin ?? 5,
        });
      } catch (err) {
        emit_error(socket, 'consultation:waiting-enter', err.message);
      }
    });

    socket.on('consultation:waiting-leave', async ({ consultationId }) => {
      try {
        socket.leave(waitingRoom(consultationId));
        ns.to(consultationRoom(consultationId)).emit('consultation:patient-left-waiting', {
          patientId: user._id,
          leftAt:    new Date(),
        });
        emit_ok(socket, 'consultation:waiting-leave', {});
      } catch (err) {
        emit_error(socket, 'consultation:waiting-leave', err.message);
      }
    });

    // ── 5. IN-SESSION CHAT (RTM mirror) ──────────────────────────────────────
    /**
     * Client emits: consultation:chat:send
     * Payload: { consultationId, content, messageType?, attachmentUrl?, attachmentName? }
     */
    socket.on('consultation:chat:send', async (payload) => {
      try {
        const { consultationId, content, messageType, attachmentUrl, attachmentName } = payload;

        const role = socket.participantRole || 'patient';
        const msg  = await sendChatMessage(
          consultationId,
          user._id.toString(),
          role,
          { content, messageType, attachmentUrl, attachmentName },
        );

        // Broadcast to everyone in room (including sender for confirmation)
        ns.to(consultationRoom(consultationId)).emit('consultation:chat:message', {
          _id:           msg._id,
          senderUserId:  user._id,
          senderName:    user.name,
          senderAvatar:  user.avatar,
          senderRole:    role,
          content:       msg.content,
          messageType:   msg.messageType,
          attachmentUrl: msg.attachmentUrl,
          sentAt:        msg.sentAt,
        });
      } catch (err) {
        emit_error(socket, 'consultation:chat:send', err.message);
      }
    });

    // Typing indicator (no DB write)
    socket.on('consultation:chat:typing', ({ consultationId, isTyping }) => {
      socket.to(consultationRoom(consultationId)).emit('consultation:chat:typing', {
        userId:   user._id,
        name:     user.name,
        role:     socket.participantRole,
        isTyping,
      });
    });

    // ── 6. VITALS (real-time push from care assistant / patient device) ────────
    socket.on('consultation:vitals', async ({ consultationId, vitals }) => {
      try {
        const saved = await saveVitals(consultationId, vitals, user._id.toString());

        // Broadcast to room so doctor sees live vitals
        ns.to(consultationRoom(consultationId)).emit('consultation:vitals:update', {
          vitals:      saved,
          updatedBy:   { userId: user._id, name: user.name },
          updatedAt:   new Date(),
        });

        emit_ok(socket, 'consultation:vitals', { vitals: saved });
      } catch (err) {
        emit_error(socket, 'consultation:vitals', err.message);
      }
    });

    // ── 7. AGORA QoS (network quality from SDK callback) ─────────────────────
    socket.on('consultation:qos', async ({ consultationId, quality, stats = {} }) => {
      try {
        await updateParticipantNetworkQuality(consultationId, user._id.toString(), quality);

        // Broadcast QoS to other participants (doctor monitors patient network)
        socket.to(consultationRoom(consultationId)).emit('consultation:qos:update', {
          userId:  user._id,
          role:    socket.participantRole,
          quality,
          stats,   // { packetLoss, frameRate, bitrate, ... }
          at:      new Date(),
        });
      } catch (err) {
        // Non-fatal — QoS is best-effort
        console.warn('[Socket] QoS update failed:', err.message);
      }
    });

    // ── 8. TOKEN REFRESH REQUEST ──────────────────────────────────────────────
    socket.on('consultation:token:refresh', async ({ consultationId }) => {
      try {
        const { expiresAt, tokenRefreshCount } = await forceRefreshTokens(
          consultationId,
          user._id.toString(),
        );

        // Get fresh tokens for THIS user only
        const tokens = await getTokensForParticipant(
          consultationId,
          user._id.toString(),
          user.role,
        );

        emit_ok(socket, 'consultation:token:refresh', {
          tokens,
          expiresAt,
          tokenRefreshCount,
        });
      } catch (err) {
        emit_error(socket, 'consultation:token:refresh', err.message);
      }
    });

    // ── 9. PRESCRIPTION PREVIEW (doctor sends preview before finalising) ──────
    socket.on('consultation:prescription:preview', ({ consultationId, preview }) => {
      if (!socket.isDoctor) return;
      socket.to(consultationRoom(consultationId)).emit('consultation:prescription:preview', {
        preview,  // { medicines[], diagnosis, advice }
        doctorId: user._id,
        at:       new Date(),
      });
    });

    // ── 10. DOCTOR: NOTIFY PATIENT PRESCRIPTION ISSUED ────────────────────────
    socket.on('consultation:prescription:issued', ({ consultationId, rxNumber }) => {
      ns.to(consultationRoom(consultationId)).emit('consultation:prescription:ready', {
        rxNumber,
        message: 'Your prescription is ready',
        at:      new Date(),
      });
    });

    // ── 11. ADMIN OVERRIDE BROADCAST ─────────────────────────────────────────
    socket.on('consultation:admin:broadcast', async ({ consultationId, message, type }) => {
      if (!['admin', 'superadmin'].includes(user.role)) {
        return emit_error(socket, 'consultation:admin:broadcast', 'Forbidden', 'FORBIDDEN');
      }
      ns.to(consultationRoom(consultationId)).emit('consultation:admin:message', {
        message,
        type:  type || 'info',
        from:  user.name,
        at:    new Date(),
      });
    });

    // ── 12. PING / HEARTBEAT ──────────────────────────────────────────────────
    socket.on('consultation:ping', ({ consultationId }) => {
      socket.emit('consultation:pong', {
        consultationId,
        serverTime: new Date().toISOString(),
      });
    });

    // ── 13. DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] disconnected: ${user.name} — reason: ${reason}`);

      if (socket.consultationId && socket.participantRole) {
        try {
          // Notify room participant dropped
          ns.to(consultationRoom(socket.consultationId)).emit('consultation:participant-disconnected', {
            userId:  user._id,
            role:    socket.participantRole,
            reason,
            at:      new Date(),
          });

          // If abrupt disconnect during in_progress → paused
          const c = await Consultation.findById(socket.consultationId).select('status');
          if (c?.status === 'in_progress') {
            await transitionStatus(socket.consultationId, 'paused', {
              actor:  user._id.toString(),
              reason: `${socket.participantRole} disconnected: ${reason}`,
            });

            ns.to(consultationRoom(socket.consultationId)).emit('consultation:status', {
              status:     'paused',
              statusMeta: STATUS_META['paused'],
              reason:     'Participant disconnected',
              updatedAt:  new Date(),
            });
          }
        } catch (err) {
          console.error('[Socket] disconnect handler error:', err.message);
        }
      }
    });

    // ── 14. ERROR handler ─────────────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error('[Socket] error:', err.message);
    });
  });

  console.log('[Socket] /consultation namespace registered');
  return ns;
};

// ── Export helper: emit to a consultation room from outside socket ─────────────
// Used by REST controllers to push events (e.g. new prescription issued via API)

let _ns = null;

export const setConsultationNamespace = (ns) => { _ns = ns; };

export const emitToConsultation = (consultationId, event, data) => {
  if (!_ns) return;
  _ns.to(consultationRoom(consultationId)).emit(event, data);
};

export const emitToDoctor = (doctorUserId, event, data) => {
  if (!_ns) return;
  _ns.to(doctorRoom(doctorUserId)).emit(event, data);
};

export const emitToPatient = (patientUserId, event, data) => {
  if (!_ns) return;
  _ns.to(patientRoom(patientUserId)).emit(event, data);
};