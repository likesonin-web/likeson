import { Conversation, MessageStatus } from '../models/chat.js';
import * as conversationService from '../services/chat/conversationService.js';
import * as messageService from '../services/chat/messageService.js';
import * as callService from '../services/chat/callService.js';
import { conversationRoom, userRoom } from '../realtime/socketRegistry.js';

/**
 * Registers all chat/call event handlers on an already-authenticated
 * Socket.IO server. Call this once from sockets/index.js after io.use(authMiddleware).
 *
 * Every socket carries socket.user (full Mongo user doc, set by the auth
 * middleware in sockets/index.js) — same shape as req.user in the REST layer.
 */
export const registerChatHandlers = (io) => {
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // ── Join personal room + every conversation room this user belongs to ──
    socket.join(userRoom(userId));

    const myConversations = await Conversation.find({
      participants: { $elemMatch: { user: userId, isDeleted: false } },
    }).select('_id');
    myConversations.forEach((c) => socket.join(conversationRoom(c._id)));

    await markPresence(userId, true);
    broadcastPresence(io, myConversations.map((c) => c._id), userId, true);

    // ── Explicit room join/leave (e.g. opening/closing a chat screen) ──────
    // Re-validates membership server-side — never trust the client's claim
    // that it belongs to a conversation.
    socket.on('conversation:join', async ({ conversationId }, ack) => {
      try {
        await conversationService.assertParticipant(conversationId, userId);
        socket.join(conversationRoom(conversationId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(conversationRoom(conversationId));
    });

    // ── Typing indicator — ephemeral, no DB write ───────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(conversationRoom(conversationId)).emit('typing:start', { conversationId, userId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(conversationRoom(conversationId)).emit('typing:stop', { conversationId, userId });
    });

    // ── Delivery / read receipts (client acks) ──────────────────────────────
    // The service functions themselves emit the resulting broadcast, so
    // these handlers are thin.
    socket.on('message:delivered', async ({ conversationId, messageIds }, ack) => {
      try {
        const result = await messageService.markDelivered(userId, conversationId, messageIds);
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('message:read', async ({ conversationId, upToMessageId }, ack) => {
      try {
        const result = await messageService.markRead(userId, conversationId, upToMessageId);
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // ── Call signaling convenience wrappers ─────────────────────────────────
    // REST endpoints (routes/calls.routes.js) do the same thing; these exist
    // purely to shave a round trip off latency-sensitive ringing/accept flows.
    socket.on('call:accept', async ({ callId }, ack) => {
      try {
        const result = await callService.acceptCall(userId, callId);
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('call:decline', async ({ callId }, ack) => {
      try {
        const call = await callService.declineCall(userId, callId);
        ack?.({ ok: true, call });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('call:leave', async ({ callId }, ack) => {
      try {
        const call = await callService.leaveCall(userId, callId);
        ack?.({ ok: true, call });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // ── Disconnect → presence ───────────────────────────────────────────────
    socket.on('disconnect', async () => {
      // Small grace window: if the same user has another active tab/device
      // connected, don't flip them offline.
      setTimeout(async () => {
        const stillConnected = await isUserStillConnected(io, userId);
        if (stillConnected) return;
        await markPresence(userId, false);
        broadcastPresence(io, myConversations.map((c) => c._id), userId, false);
      }, 3000);
    });
  });
};

// ── Presence helpers ─────────────────────────────────────────────────────────

const isUserStillConnected = async (io, userId) => {
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
};

const markPresence = async (userId, isOnline) => {
  const { default: User } = await import('../models/User.js');
  await User.updateOne({ _id: userId }, { $set: { isOnline, lastseen: new Date() } });
};

const broadcastPresence = (io, conversationIds, userId, isOnline) => {
  conversationIds.forEach((id) => {
    io.to(conversationRoom(id)).emit('presence:update', { userId, isOnline, lastseen: new Date() });
  });
};