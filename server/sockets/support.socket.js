/**
 * socket/support.socket.js
 * Socket.IO real-time handler for Support Ticket system.
 * Redis adapter must be applied at server level before calling this.
 *
 * Usage in app.js / server.js:
 *   import { initSupportSocket } from './socket/support.socket.js';
 *   initSupportSocket(io);
 */

import redisClient from '../config/redis.js'; // adjust path

// ─── Redis Key Helpers ────────────────────────────────────────────────────────

const ONLINE_KEY   = (userId)  => `support:online:${userId}`;
const SOCKET_KEY   = (userId)  => `support:socket:${userId}`;
const ROOM_KEY     = (ticketId)=> `support:room:${ticketId}`;
const TYPING_KEY   = (ticketId, userId) => `support:typing:${ticketId}:${userId}`;

const ONLINE_TTL   = 60 * 5;   // 5 min
const TYPING_TTL   = 5;         // 5 sec

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initSupportSocket(io) {
  // Namespace: /support
  const ns = io.of('/support');

  ns.on('connection', async (socket) => {
    const user = socket.handshake.auth?.user;
    if (!user?._id) {
      socket.emit('error', { message: 'Unauthenticated' });
      socket.disconnect(true);
      return;
    }

    const userId = user._id.toString();

    // ── Mark online ────────────────────────────────────────────────────────
    await redisClient.setEx(ONLINE_KEY(userId), ONLINE_TTL, '1').catch(() => {});
    await redisClient.setEx(SOCKET_KEY(userId), ONLINE_TTL, socket.id).catch(() => {});

    // Auto-join personal room for notifications
    socket.join(`user:${userId}`);

    // Join admin room if admin role
    const ADMIN_ROLES = ['admin', 'superadmin', 'finance'];
    if (ADMIN_ROLES.includes(user.role)) {
      socket.join('admin_room');
    }

    console.log(`[SupportSocket] Connected: ${user.name} (${user.role}) — socket ${socket.id}`);

    // ── JOIN TICKET ROOM ───────────────────────────────────────────────────

    socket.on('ticket:join', async ({ ticketId }) => {
      if (!ticketId) return;
      const room = `ticket:${ticketId}`;
      socket.join(room);

      // Track active users in room via Redis
      await redisClient.sAdd(ROOM_KEY(ticketId), userId).catch(() => {});

      const members = await redisClient.sMembers(ROOM_KEY(ticketId)).catch(() => []);
      ns.to(room).emit('ticket:activeUsers', { ticketId, userIds: members });

      socket.emit('ticket:joined', { ticketId });
    });

    // ── LEAVE TICKET ROOM ──────────────────────────────────────────────────

    socket.on('ticket:leave', async ({ ticketId }) => {
      if (!ticketId) return;
      const room = `ticket:${ticketId}`;
      socket.leave(room);
      await redisClient.sRem(ROOM_KEY(ticketId), userId).catch(() => {});

      const members = await redisClient.sMembers(ROOM_KEY(ticketId)).catch(() => []);
      ns.to(room).emit('ticket:activeUsers', { ticketId, userIds: members });
    });

    // ── TYPING ─────────────────────────────────────────────────────────────

    socket.on('typing:start', async ({ ticketId }) => {
      if (!ticketId) return;
      await redisClient.setEx(TYPING_KEY(ticketId, userId), TYPING_TTL, '1').catch(() => {});
      socket.to(`ticket:${ticketId}`).emit('typing:start', { userId, userName: user.name, ticketId });
    });

    socket.on('typing:stop', async ({ ticketId }) => {
      if (!ticketId) return;
      await redisClient.del(TYPING_KEY(ticketId, userId)).catch(() => {});
      socket.to(`ticket:${ticketId}`).emit('typing:stop', { userId, ticketId });
    });

    // ── MESSAGE DELIVERED ──────────────────────────────────────────────────

    socket.on('message:delivered', ({ ticketId, messageId }) => {
      if (!ticketId || !messageId) return;
      socket.to(`ticket:${ticketId}`).emit('message:delivered', { messageId, deliveredTo: userId });
    });

    // ── MESSAGE READ ───────────────────────────────────────────────────────

    socket.on('message:read', ({ ticketId, messageId }) => {
      if (!ticketId || !messageId) return;
      socket.to(`ticket:${ticketId}`).emit('message:read', { messageId, readBy: userId });
    });

    // ── HEARTBEAT (keep-alive) ─────────────────────────────────────────────

    socket.on('ping', () => {
      redisClient.setEx(ONLINE_KEY(userId), ONLINE_TTL, '1').catch(() => {});
      socket.emit('pong');
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      await redisClient.del(ONLINE_KEY(userId)).catch(() => {});
      await redisClient.del(SOCKET_KEY(userId)).catch(() => {});
      console.log(`[SupportSocket] Disconnected: ${user.name} — socket ${socket.id}`);
    });
  });

  console.log('[SupportSocket] /support namespace initialized');
  return ns;
}

// ─── Utility: push notification via socket to user ───────────────────────────

export async function pushSocketNotification(io, userId, event, payload) {
  try {
    io.of('/support').to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    console.error('[pushSocketNotification]', err.message);
  }
}

// ─── Utility: check if user is online ────────────────────────────────────────

export async function isUserOnline(userId) {
  try {
    const v = await redisClient.get(ONLINE_KEY(userId));
    return v === '1';
  } catch {
    return false;
  }
}