// sockets/consultationSocket.js — PRODUCTION GRADE
// Added in this revision:
//   - consultation:mute / consultation:unmute   (doctor mutes/unmutes a participant)
//   - consultation:kick                         (doctor kicks a participant)
//   - consultation:timer:update                 (periodic broadcast of remaining time)
//   - Duplicate-chat fix preserved from v2

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
  muteParticipant,
  unmuteParticipant,
  kickParticipant,
  getConsultationTimer,
} from '../services/consultationService.js';
import {
  resolveLeaveTransition,
  assertJoinable,
  assertNotTerminal,
  assertRoleCanTransition,
  STATUS_META,
} from '../services/consultationStatus.js';

// ── Room helpers ──────────────────────────────────────────────────────────────

const consultationRoom = (id)  => `consultation:${id}`;
const doctorRoom       = (uid) => `doctor:${uid}`;
const patientRoom      = (uid) => `patient:${uid}`;
const adminRoom        = ()    => 'admin:consultations';
const waitingRoom      = (id)  => `waiting:${id}`;

// ── JWT auth ──────────────────────────────────────────────────────────────────

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_MISSING'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('name role avatar isBlocked');
    if (!user)          return next(new Error('USER_NOT_FOUND'));
    if (user.isBlocked) return next(new Error('ACCOUNT_BLOCKED'));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'));
  }
};

// ── Response helpers ──────────────────────────────────────────────────────────

const emit_error = (socket, event, message, code = 'ERROR') =>
  socket.emit(`${event}:error`, { success: false, message, code });

const emit_ok = (socket, event, data = {}) =>
  socket.emit(`${event}:ok`, { success: true, ...data });

// ── Register namespace ────────────────────────────────────────────────────────

export const registerConsultationSocket = (io) => {
  const ns = io.of('/consultation');
  ns.use(authenticateSocket);

  ns.on('connection', (socket) => {
    const { user } = socket;
    console.log(`[Socket] connected: ${user.name} (${user.role}) — ${socket.id}`);

    // ── 1. JOIN ───────────────────────────────────────────────────────────
    socket.on('consultation:join', async ({ consultationId, deviceInfo = {} }) => {
      try {
        if (!consultationId) throw new Error('consultationId required');

        const consultation = await Consultation.findById(consultationId)
          .select('patient doctorUser doctor status consultationType agora isActive timerState')
          .lean({ virtuals: true });

        if (!consultation) throw new Error('Consultation not found');

        const userId   = user._id.toString();
        const isDoctor = consultation.doctorUser?.toString() === userId;
        const isPatient= consultation.patient.toString()     === userId;
        const isAdmin  = ['admin', 'superadmin'].includes(user.role);

        if (!isDoctor && !isPatient && !isAdmin) {
          return emit_error(socket, 'consultation:join', 'Forbidden', 'FORBIDDEN');
        }

        assertJoinable(consultation.status);

        const participantRole = isDoctor ? 'doctor' : isPatient ? 'patient' : 'observer';

        socket.join(consultationRoom(consultationId));
        if (isDoctor)  socket.join(doctorRoom(userId));
        if (isPatient) socket.join(patientRoom(userId));
        if (isAdmin)   socket.join(adminRoom());
        socket.join(waitingRoom(consultationId));

        socket.consultationId  = consultationId;
        socket.participantRole = participantRole;
        socket.isDoctor        = isDoctor;
        socket.isPatient       = isPatient;

        const { consultation: updated, tokens } = await participantJoin(
          consultationId, userId, participantRole, deviceInfo,
        );

        // Compute timer snapshot for rejoining client
        const maxTimeSec  = parseInt(process.env.CONSULTATION_MAX_TIME_MIN || '30', 10) * 60;
        const timerState  = updated.timerState;
        const hardDeadline= timerState?.hardDeadlineAt;
        const remainingSec= hardDeadline
          ? Math.max(0, Math.floor((new Date(hardDeadline) - Date.now()) / 1000))
          : maxTimeSec;

        emit_ok(socket, 'consultation:join', {
          consultation: {
            _id:             updated._id,
            status:          updated.status,
            consultationType:updated.consultationType,
            agora: {
              channelName:    updated.agora?.channelName,
              rtmChannelName: updated.agora?.rtmChannelName,
              appId:          updated.agora?.appId,
            },
          },
          tokens,
          participantRole,
          statusMeta: STATUS_META[updated.status],
          // Timer info for rejoining mid-session
          timer: {
            maxTimeSec,
            remainingSec,
            hardDeadlineAt: hardDeadline,
            autoEnded:      timerState?.autoEnded ?? false,
          },
        });

        ns.to(consultationRoom(consultationId)).emit('consultation:status', {
          status:     updated.status,
          statusMeta: STATUS_META[updated.status],
          changedBy:  { userId, role: participantRole, name: user.name },
          updatedAt:  new Date(),
        });

        ns.to(adminRoom()).emit('consultation:participant-joined', {
          consultationId, userId, role: participantRole, status: updated.status,
        });

      } catch (err) {
        console.error('[Socket] join error:', err.message);
        emit_error(socket, 'consultation:join', err.message);
      }
    });

    // ── 2. LEAVE ──────────────────────────────────────────────────────────
    socket.on('consultation:leave', async ({ consultationId, metrics = {} }) => {
      try {
        const userId = user._id.toString();
        const role   = socket.participantRole || 'patient';

        const updated    = await participantLeave(consultationId, userId, role, metrics);
        const nextStatus = resolveLeaveTransition(updated.status, role);
        let finalStatus  = updated;
        if (nextStatus) {
          finalStatus = await transitionStatus(consultationId, nextStatus, {
            actor: userId, reason: `${role} left the session`,
          });
        }

        socket.leave(consultationRoom(consultationId));

        ns.to(consultationRoom(consultationId)).emit('consultation:participant-left', {
          userId, role,
          status:     finalStatus.status,
          statusMeta: STATUS_META[finalStatus.status],
          leftAt:     new Date(),
        });

        emit_ok(socket, 'consultation:leave', { status: finalStatus.status });
      } catch (err) {
        console.error('[Socket] leave error:', err.message);
        emit_error(socket, 'consultation:leave', err.message);
      }
    });

    // ── 3. STATUS TRANSITIONS ─────────────────────────────────────────────
    const handleStatusTransition = (targetStatus) => async ({ consultationId, reason } = {}) => {
      try {
        assertRoleCanTransition(targetStatus, user.role);

        const c = await Consultation.findById(consultationId).select('status patient doctorUser');
        if (!c) return emit_error(socket, `consultation:${targetStatus}`, 'Not found');

        assertNotTerminal(c.status);

        const updated = await transitionStatus(consultationId, targetStatus, {
          actor:  user._id.toString(),
          reason: reason || null,
          metadata: { cancelledBy: user.role === 'customer' ? 'patient' : user.role },
        });

        ns.to(consultationRoom(consultationId)).emit('consultation:status', {
          status:     updated.status,
          statusMeta: STATUS_META[updated.status],
          changedBy:  { userId: user._id, role: user.role, name: user.name },
          reason,
          updatedAt:  new Date(),
        });

        emit_ok(socket, `consultation:${targetStatus}`, { status: updated.status });
      } catch (err) {
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

    // ── 4. WAITING ROOM ───────────────────────────────────────────────────
    socket.on('consultation:waiting-enter', async ({ consultationId }) => {
      try {
        const c = await Consultation.findById(consultationId).select('doctorUser status');
        if (!c) return emit_error(socket, 'consultation:waiting-enter', 'Not found');

        const updated = await transitionStatus(consultationId, 'waiting', {
          actor: user._id.toString(), metadata: { estimatedWaitMin: 5 },
        });

        socket.join(waitingRoom(consultationId));

        ns.to(doctorRoom(c.doctorUser.toString())).emit('consultation:patient-waiting', {
          consultationId, patientId: user._id, patientName: user.name,
          enteredAt: new Date(), status: updated.status,
        });

        ns.to(consultationRoom(consultationId)).emit('consultation:status', {
          status: updated.status, statusMeta: STATUS_META[updated.status], updatedAt: new Date(),
        });

        emit_ok(socket, 'consultation:waiting-enter', {
          estimatedWaitMin: updated.waitingRoom?.estimatedWaitMin ?? 5,
        });
      } catch (err) {
        emit_error(socket, 'consultation:waiting-enter', err.message);
      }
    });

    socket.on('consultation:waiting-leave', async ({ consultationId }) => {
      socket.leave(waitingRoom(consultationId));
      ns.to(consultationRoom(consultationId)).emit('consultation:patient-left-waiting', {
        patientId: user._id, leftAt: new Date(),
      });
      emit_ok(socket, 'consultation:waiting-leave', {});
    });

    // ── 5. CHAT — persist + broadcast ONCE ───────────────────────────────
    socket.on('consultation:chat:send', async (payload) => {
      try {
        const { consultationId, content, messageType, attachmentUrl, attachmentName } = payload;
        if (!content && !attachmentUrl) return;

        const role = socket.participantRole || 'patient';
        const msg  = await sendChatMessage(
          consultationId,
          user._id.toString(),
          role,
          { content, messageType: messageType || 'text', attachmentUrl, attachmentName },
        );

        ns.to(consultationRoom(consultationId)).emit('consultation:chat:message', {
          _id:           msg._id,
          senderUserId:  user._id,
          senderName:    user.name,
          senderAvatar:  user.avatar,
          senderRole:    role,
          content:       msg.content,
          messageType:   msg.messageType,
          attachmentUrl: msg.attachmentUrl,
          attachmentName:msg.attachmentName,
          sentAt:        msg.sentAt,
        });
      } catch (err) {
        emit_error(socket, 'consultation:chat:send', err.message);
      }
    });

    socket.on('consultation:chat:typing', ({ consultationId, isTyping }) => {
      socket.to(consultationRoom(consultationId)).emit('consultation:chat:typing', {
        userId: user._id, name: user.name, role: socket.participantRole, isTyping,
      });
    });

    // ── 6. VITALS ─────────────────────────────────────────────────────────
    socket.on('consultation:vitals', async ({ consultationId, vitals }) => {
      try {
        const saved = await saveVitals(consultationId, vitals, user._id.toString());
        ns.to(consultationRoom(consultationId)).emit('consultation:vitals:update', {
          vitals: saved, updatedBy: { userId: user._id, name: user.name }, updatedAt: new Date(),
        });
        emit_ok(socket, 'consultation:vitals', { vitals: saved });
      } catch (err) {
        emit_error(socket, 'consultation:vitals', err.message);
      }
    });

    // ── 7. QoS ────────────────────────────────────────────────────────────
    socket.on('consultation:qos', async ({ consultationId, quality, stats = {} }) => {
      try {
        await updateParticipantNetworkQuality(consultationId, user._id.toString(), quality);
        socket.to(consultationRoom(consultationId)).emit('consultation:qos:update', {
          userId: user._id, role: socket.participantRole, quality, stats, at: new Date(),
        });
      } catch (err) {
        console.warn('[Socket] QoS update failed:', err.message);
      }
    });

    // ── 8. TOKEN REFRESH ──────────────────────────────────────────────────
    socket.on('consultation:token:refresh', async ({ consultationId }) => {
      try {
        const { expiresAt, tokenRefreshCount } = await forceRefreshTokens(
          consultationId, user._id.toString(),
        );
        const tokens = await getTokensForParticipant(
          consultationId, user._id.toString(), user.role,
        );
        emit_ok(socket, 'consultation:token:refresh', { tokens, expiresAt, tokenRefreshCount });
      } catch (err) {
        emit_error(socket, 'consultation:token:refresh', err.message);
      }
    });

    // ── 9. PRESCRIPTION PREVIEW ───────────────────────────────────────────
    socket.on('consultation:prescription:preview', ({ consultationId, preview }) => {
      if (!socket.isDoctor) return;
      socket.to(consultationRoom(consultationId)).emit('consultation:prescription:preview', {
        preview, doctorId: user._id, at: new Date(),
      });
    });

    socket.on('consultation:prescription:issued', ({ consultationId, rxNumber }) => {
      ns.to(consultationRoom(consultationId)).emit('consultation:prescription:ready', {
        rxNumber, message: 'Your prescription is ready', at: new Date(),
      });
    });

    // ── 10. ADMIN BROADCAST ───────────────────────────────────────────────
    socket.on('consultation:admin:broadcast', async ({ consultationId, message, type }) => {
      if (!['admin', 'superadmin'].includes(user.role)) {
        return emit_error(socket, 'consultation:admin:broadcast', 'Forbidden', 'FORBIDDEN');
      }
      ns.to(consultationRoom(consultationId)).emit('consultation:admin:message', {
        message, type: type || 'info', from: user.name, at: new Date(),
      });
    });

    // ── 11. PING ──────────────────────────────────────────────────────────
    socket.on('consultation:ping', ({ consultationId }) => {
      socket.emit('consultation:pong', { consultationId, serverTime: new Date().toISOString() });
    });

    // ── 12. MUTE PARTICIPANT (doctor only) ────────────────────────────────
    /**
     * Client emits: consultation:mute
     * Payload: { consultationId, targetUserId }
     *
     * Server:
     *  - Validates caller is the doctor of this consultation
     *  - Persists isMutedByDoctor = true on participantEvent
     *  - Broadcasts "consultation:muted" to the room so the target client
     *    calls localAudioTrack.setEnabled(false) in the Agora SDK
     */
    socket.on('consultation:mute', async ({ consultationId, targetUserId }) => {
      try {
        if (!socket.isDoctor) {
          return emit_error(socket, 'consultation:mute', 'Only the doctor can mute participants', 'FORBIDDEN');
        }
        if (!targetUserId) return emit_error(socket, 'consultation:mute', 'targetUserId required');

        const result = await muteParticipant(
          consultationId,
          targetUserId,
          user._id.toString(),
        );

        // Broadcast to everyone — the target client checks if the event is for them
        ns.to(consultationRoom(consultationId)).emit('consultation:muted', {
          targetUserId:  result.mutedUserId,
          mutedBy:       { userId: user._id, name: user.name, role: 'doctor' },
          isMuted:       true,
          at:            new Date(),
        });

        emit_ok(socket, 'consultation:mute', result);
      } catch (err) {
        emit_error(socket, 'consultation:mute', err.message);
      }
    });

    // ── 13. UNMUTE PARTICIPANT (doctor only) ──────────────────────────────
    /**
     * Client emits: consultation:unmute
     * Payload: { consultationId, targetUserId }
     */
    socket.on('consultation:unmute', async ({ consultationId, targetUserId }) => {
      try {
        if (!socket.isDoctor) {
          return emit_error(socket, 'consultation:unmute', 'Only the doctor can unmute participants', 'FORBIDDEN');
        }
        if (!targetUserId) return emit_error(socket, 'consultation:unmute', 'targetUserId required');

        const result = await unmuteParticipant(
          consultationId,
          targetUserId,
          user._id.toString(),
        );

        ns.to(consultationRoom(consultationId)).emit('consultation:muted', {
          targetUserId: result.mutedUserId,
          mutedBy:      { userId: user._id, name: user.name, role: 'doctor' },
          isMuted:      false,
          at:           new Date(),
        });

        emit_ok(socket, 'consultation:unmute', result);
      } catch (err) {
        emit_error(socket, 'consultation:unmute', err.message);
      }
    });

    // ── 14. KICK PARTICIPANT (doctor only) ────────────────────────────────
    /**
     * Client emits: consultation:kick
     * Payload: { consultationId, targetUserId, reason? }
     *
     * Server:
     *  - Marks participant as kicked in DB
     *  - Emits "consultation:kicked" to room; target client should
     *    leave the Agora channel + socket room on receipt
     */
    socket.on('consultation:kick', async ({ consultationId, targetUserId, reason }) => {
      try {
        if (!socket.isDoctor) {
          return emit_error(socket, 'consultation:kick', 'Only the doctor can kick participants', 'FORBIDDEN');
        }
        if (!targetUserId) return emit_error(socket, 'consultation:kick', 'targetUserId required');

        const result = await kickParticipant(
          consultationId,
          targetUserId,
          user._id.toString(),
          reason || '',
        );

        // Targeted event so kicked user knows they were removed
        ns.to(consultationRoom(consultationId)).emit('consultation:kicked', {
          targetUserId: result.kickedUserId,
          kickedBy:     { userId: user._id, name: user.name, role: 'doctor' },
          reason:       result.reason,
          at:           new Date(),
        });

        // Also notify admin room
        ns.to(adminRoom()).emit('consultation:participant-kicked', {
          consultationId,
          kickedUserId: result.kickedUserId,
          kickedBy:     user._id,
          reason:       result.reason,
        });

        emit_ok(socket, 'consultation:kick', result);
      } catch (err) {
        emit_error(socket, 'consultation:kick', err.message);
      }
    });

    // ── 15. TIMER POLL (client requests current timer snapshot) ───────────
    /**
     * Client emits: consultation:timer:get
     * Payload: { consultationId }
     *
     * Server responds with consultation:timer:snapshot directly to caller.
     * Clients should call this on rejoin to sync the timer UI.
     */
    socket.on('consultation:timer:get', async ({ consultationId }) => {
      try {
        const timer = await getConsultationTimer(consultationId);
        socket.emit('consultation:timer:snapshot', timer);
      } catch (err) {
        emit_error(socket, 'consultation:timer:get', err.message);
      }
    });

    // ── 16. DISCONNECT ────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] disconnected: ${user.name} — ${reason}`);

      if (socket.consultationId && socket.participantRole) {
        try {
          ns.to(consultationRoom(socket.consultationId)).emit('consultation:participant-disconnected', {
            userId: user._id, role: socket.participantRole, reason, at: new Date(),
          });

          const c = await Consultation.findById(socket.consultationId).select('status');
          if (c?.status === 'in_progress') {
            await transitionStatus(socket.consultationId, 'paused', {
              actor: user._id.toString(),
              reason: `${socket.participantRole} disconnected: ${reason}`,
            });
            ns.to(consultationRoom(socket.consultationId)).emit('consultation:status', {
              status: 'paused', statusMeta: STATUS_META['paused'],
              reason: 'Participant disconnected', updatedAt: new Date(),
            });
          }
        } catch (err) {
          console.error('[Socket] disconnect handler error:', err.message);
        }
      }
    });

    socket.on('error', (err) => {
      console.error('[Socket] error:', err.message);
    });
  });

  console.log('[Socket] /consultation namespace registered');
  return ns;
};

// ── Export helpers ────────────────────────────────────────────────────────────

let _ns = null;
export const setConsultationNamespace = (ns) => { _ns = ns; };

export const emitToConsultation = (consultationId, event, data) => {
  _ns?.to(consultationRoom(consultationId)).emit(event, data);
};
export const emitToDoctor = (doctorUserId, event, data) => {
  _ns?.to(doctorRoom(doctorUserId)).emit(event, data);
};
export const emitToPatient = (patientUserId, event, data) => {
  _ns?.to(patientRoom(patientUserId)).emit(event, data);
};

/**
 * emitTimerUpdate
 * Called by the runAutoEnd / runTimerReminder cron jobs (via a thin wrapper
 * imported in the cron scheduler) to push the remaining-time update into the
 * room in real-time without waiting for the next client poll.
 *
 * @param {string} consultationId
 * @param {{ remainingSec: number, hardDeadlineAt: Date, autoEnded: boolean }} timerData
 */
export const emitTimerUpdate = (consultationId, timerData) => {
  _ns?.to(consultationRoom(consultationId)).emit('consultation:timer:update', {
    ...timerData,
    at: new Date(),
  });
};