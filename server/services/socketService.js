/**
 * socket.js — Complete Fixed Version with Real WebRTC Signaling
 *
 * Key fixes vs original:
 *  1.  Full WebRTC offer → answer → ICE relay (caller ↔ callee)
 *  2.  call:offer event added — server relays SDP offer to callee
 *  3.  call:ringing event — callee notifies caller it received the call
 *  4.  Offline call queue — pending calls stored in memory, delivered on reconnect
 *  5.  mediaConstraints relayed so callee knows video vs audio-only
 *  6.  _io properly assigned so getSocket() works in REST routes
 *  7.  call:media_toggle — relay mute/camera-off events to peer
 *  8.  Sticker message support (type === 'sticker' with sticker payload)
 *  9.  All null/undefined guards kept and strengthened
 */

import { Server }   from 'socket.io';
import jwt          from 'jsonwebtoken';
import mongoose     from 'mongoose';

import User         from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message      from '../models/Message.js';

// ── In-memory presence map  { userId → Set<socketId> } ───────────────────────
const onlineUsers = new Map();

// ── Pending call queue for offline users { targetUserId → [callPayload] } ─────
// When a user is offline and someone calls them, we store the call here.
// On reconnect we deliver it so they can see a missed call or answer if still active.
const pendingCalls = new Map();

// ── Active calls map { conversationId → { callerId, calleeIds, startedAt, messageId } }
const activeCalls = new Map();

// ── Export reference ──────────────────────────────────────────────────────────
let _io = null;

export function getSocket() {
  return _io;
}

// ── Presence helpers ──────────────────────────────────────────────────────────

function trackOnline(userId, socketId) {
  if (!userId) return;
  const key = userId.toString();
  if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
  onlineUsers.get(key).add(socketId);
}

function trackOffline(userId, socketId) {
  if (!userId) return;
  const key = userId.toString();
  const sockets = onlineUsers.get(key);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(key);
}

function isOnline(userId) {
  if (!userId) return false;
  const key = userId.toString();
  return onlineUsers.has(key) && onlineUsers.get(key).size > 0;
}

/**
 * Emit to ALL sockets belonging to a user.
 * Guards against null/undefined userId.
 */
function emitToUser(io, userId, event, payload) {
  if (!userId) return;
  const key = userId.toString();
  const sockets = onlineUsers.get(key);
  if (!sockets) return;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
}

function emitError(socket, event, message, details = {}) {
  socket.emit('error:event', { event, message, ...details });
}

// ── @mention extraction ───────────────────────────────────────────────────────

async function extractMentions(content, conversationId) {
  if (!content) return [];
  const handles = content.match(/@(\w+)/g);
  if (!handles) return [];

  const conv = await Conversation.findById(conversationId).select('participants');
  if (!conv) return [];

  const participantIds = conv.participants
    .filter(p => p.isActive)
    .map(p => p.user.toString());

  const users = await User.find({
    _id:  { $in: participantIds },
    name: { $in: handles.map(h => h.slice(1)) },
  }).select('_id');

  return users.map(u => u._id);
}

// ── JWT auth middleware ───────────────────────────────────────────────────────

async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_MISSING_TOKEN'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(new Error('AUTH_INVALID_TOKEN'));
    }

    const user = await User.findById(decoded.id).select(
      'name email role avatar isBlocked blockReason unblockAt isOnline lastseen'
    );

    if (!user)                   return next(new Error('AUTH_USER_NOT_FOUND'));
    if (user.isCurrentlyBlocked) return next(new Error('AUTH_USER_BLOCKED'));

    socket.user = user;
    next();
  } catch (err) {
    console.error('[Socket Auth]', err.message);
    next(new Error('AUTH_ERROR'));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN INIT
// ═════════════════════════════════════════════════════════════════════════════

// socketService.js — change initSocket signature to accept options
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
      ].filter(Boolean),
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
      credentials: true,
    },
    pingTimeout:  60_000,
    pingInterval: 25_000,
  });

  _io = io;
   

  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const user   = socket.user;
    const userId = user._id.toString();

    // ── Presence ──────────────────────────────────────────────────────────────
    trackOnline(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastActiveAt: new Date() });

    // Auto-join all active conversation rooms
    try {
      const conversations = await Conversation.find({
        'participants.user':     user._id,
        'participants.isActive': true,
        'participants.leftAt':   null,
        isDeleted:               false,
      }).select('_id');

      for (const c of conversations) {
        socket.join(c._id.toString());
      }
    } catch (err) {
      console.error('[Socket Join Rooms]', err.message);
    }

    // Personal room for direct targeting (call:incoming, notifications)
    socket.join(userId);

    socket.broadcast.emit('user:online', {
      userId,
      name:   user.name,
      avatar: user.avatar,
      role:   user.role,
    });

    // ── Deliver pending calls for this user ───────────────────────────────────
    // If someone called while this user was offline, notify them now.
    const pending = pendingCalls.get(userId);
    if (pending && pending.length > 0) {
      for (const callPayload of pending) {
        // Check if the call is still active (caller hasn't hung up)
        const callStillActive = activeCalls.has(callPayload.conversationId);
        if (callStillActive) {
          socket.emit('call:incoming', { ...callPayload, delayed: true });
        } else {
          // Mark as missed
          socket.emit('call:missed_while_offline', callPayload);
        }
      }
      pendingCalls.delete(userId);
    }

    console.info(`[Socket] +connect  ${user.name} (${user.role}) — ${socket.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // ① CONVERSATION EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('conversation:create', async (data, ack) => {
      try {
        const {
          type           = 'direct',
          name,
          description,
          participantIds = [],
          departmentRole,
        } = data;

        if (!Array.isArray(participantIds) || participantIds.length === 0)
          return ack?.({ success: false, message: 'participantIds required' });

        const allIds = [...new Set([userId, ...participantIds])];
        const users  = await User.find({ _id: { $in: allIds } }).select('_id name role');

        if (users.length !== allIds.length)
          return ack?.({ success: false, message: 'One or more users not found' });

        if (type === 'direct') {
          if (allIds.length !== 2)
            return ack?.({ success: false, message: 'Direct chat requires exactly 1 other participant' });

          const existing = await Conversation.findOne({
            type:                'direct',
            'participants.user': { $all: allIds },
            isDeleted:           false,
          });
          if (existing)
            return ack?.({ success: false, message: 'Conversation already exists', conversation: existing });
        }

        const participants = allIds.map((id, idx) => ({
          user:             id,
          conversationRole: idx === 0 ? 'owner' : 'member',
          joinedAt:         new Date(),
          addedBy:          user._id,
          isActive:         true,
        }));

        const conversation = await Conversation.create({
          type,
          name:           name?.trim()        || null,
          description:    description?.trim() || null,
          departmentRole: departmentRole      || null,
          participants,
          createdBy:      user._id,
        });

        for (const pid of allIds) {
          const sockets = onlineUsers.get(pid.toString());
          if (!sockets) continue;
          for (const sid of sockets) {
            io.sockets.sockets.get(sid)?.join(conversation._id.toString());
          }
        }

        const sysMsg = await Message.create({
          conversation: conversation._id,
          sender:       user._id,
          type:         'system',
          content:      `${user.name} created the conversation`,
          systemEvent:  { event: 'group_created', meta: { name: conversation.name } },
        });

        io.to(conversation._id.toString()).emit('conversation:created', {
          conversation,
          systemMessage: sysMsg,
        });

        ack?.({ success: true, conversation });
      } catch (err) {
        console.error('[conversation:create]', err);
        emitError(socket, 'conversation:create', err.message);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('conversation:join', async ({ conversationId }, ack) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.isDeleted)
          return ack?.({ success: false, message: 'Conversation not found' });

        const existing = conv.participants.find(p => p.user.toString() === userId);

        if (existing && existing.isActive) {
          socket.join(conversationId);
          return ack?.({ success: true, message: 'Already a member' });
        }

        if (existing) {
          existing.isActive = true;
          existing.leftAt   = null;
        } else {
          conv.participants.push({
            user:             user._id,
            conversationRole: 'member',
            joinedAt:         new Date(),
            addedBy:          user._id,
            isActive:         true,
          });
        }
        conv.updatedBy = user._id;
        await conv.save();

        socket.join(conversationId);

        const sysMsg = await Message.create({
          conversation: conversationId,
          sender:       user._id,
          type:         'system',
          content:      `${user.name} joined the conversation`,
          systemEvent:  { event: 'member_added', affectedUser: user._id },
        });

        io.to(conversationId).emit('conversation:member_joined', {
          conversationId,
          user:          { _id: user._id, name: user.name, avatar: user.avatar, role: user.role },
          systemMessage: sysMsg,
        });

        ack?.({ success: true });
      } catch (err) {
        console.error('[conversation:join]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('conversation:leave', async ({ conversationId }, ack) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv) return ack?.({ success: false, message: 'Conversation not found' });

        const participant = conv.participants.find(p => p.user.toString() === userId);
        if (!participant || !participant.isActive)
          return ack?.({ success: false, message: 'Not a member of this conversation' });

        participant.isActive = false;
        participant.leftAt   = new Date();
        conv.updatedBy       = user._id;
        await conv.save();

        const sysMsg = await Message.create({
          conversation: conversationId,
          sender:       user._id,
          type:         'system',
          content:      `${user.name} left the conversation`,
          systemEvent:  { event: 'member_left', affectedUser: user._id },
        });

        io.to(conversationId).emit('conversation:member_left', {
          conversationId,
          userId,
          systemMessage: sysMsg,
        });

        socket.leave(conversationId);
        ack?.({ success: true });
      } catch (err) {
        console.error('[conversation:leave]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('conversation:add_members', async ({ conversationId, userIds = [] }, ack) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.isDeleted)
          return ack?.({ success: false, message: 'Conversation not found' });

        const requester = conv.participants.find(p => p.user.toString() === userId && p.isActive);
        if (!requester || !['owner', 'admin'].includes(requester.conversationRole))
          return ack?.({ success: false, message: 'Only admins can add members' });

        const newUsers = await User.find({ _id: { $in: userIds } }).select('_id name avatar role');
        const added    = [];

        for (const u of newUsers) {
          const already = conv.participants.find(p => p.user.toString() === u._id.toString());
          if (already) {
            if (!already.isActive) {
              already.isActive = true;
              already.leftAt   = null;
              added.push(u);
            }
          } else {
            conv.participants.push({
              user:             u._id,
              conversationRole: 'member',
              joinedAt:         new Date(),
              addedBy:          user._id,
              isActive:         true,
            });
            added.push(u);
          }
        }

        conv.updatedBy = user._id;
        await conv.save();

        for (const u of added) {
          const uid = u._id?.toString();
          if (uid) {
            const sockets = onlineUsers.get(uid);
            if (sockets) {
              for (const sid of sockets) {
                io.sockets.sockets.get(sid)?.join(conversationId);
              }
            }
          }

          const sysMsg = await Message.create({
            conversation: conversationId,
            sender:       user._id,
            type:         'system',
            content:      `${user.name} added ${u.name}`,
            systemEvent:  { event: 'member_added', affectedUser: u._id },
          });

          io.to(conversationId).emit('conversation:member_added', {
            conversationId,
            addedUser:     { _id: u._id, name: u.name, avatar: u.avatar, role: u.role },
            addedBy:       { _id: user._id, name: user.name },
            systemMessage: sysMsg,
          });
        }

        ack?.({ success: true, added: added.map(u => u._id) });
      } catch (err) {
        console.error('[conversation:add_members]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('conversation:remove_member', async ({ conversationId, targetUserId }, ack) => {
      try {
        if (!targetUserId)
          return ack?.({ success: false, message: 'targetUserId is required' });

        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.isDeleted)
          return ack?.({ success: false, message: 'Conversation not found' });

        const requester = conv.participants.find(p => p.user.toString() === userId && p.isActive);
        if (!requester || !['owner', 'admin'].includes(requester.conversationRole))
          return ack?.({ success: false, message: 'Only admins can remove members' });

        const target = conv.participants.find(
          p => p.user.toString() === targetUserId.toString() && p.isActive
        );
        if (!target)
          return ack?.({ success: false, message: 'Target user not found in conversation' });

        target.isActive = false;
        target.leftAt   = new Date();
        conv.updatedBy  = user._id;
        await conv.save();

        const targetUser = await User.findById(targetUserId).select('name');

        const sysMsg = await Message.create({
          conversation: conversationId,
          sender:       user._id,
          type:         'system',
          content:      `${user.name} removed ${targetUser?.name || 'a member'}`,
          systemEvent:  { event: 'member_removed', affectedUser: targetUserId },
        });

        io.to(conversationId).emit('conversation:member_removed', {
          conversationId,
          targetUserId,
          removedBy:     userId,
          systemMessage: sysMsg,
        });

        const sockets = onlineUsers.get(targetUserId.toString());
        if (sockets) {
          for (const sid of sockets) {
            const s = io.sockets.sockets.get(sid);
            s?.leave(conversationId);
            s?.emit('conversation:you_were_removed', { conversationId });
          }
        }

        ack?.({ success: true });
      } catch (err) {
        console.error('[conversation:remove_member]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('conversation:update', async ({ conversationId, ...updates }, ack) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.isDeleted)
          return ack?.({ success: false, message: 'Conversation not found' });

        const requester = conv.participants.find(p => p.user.toString() === userId && p.isActive);
        if (!requester || !['owner', 'admin'].includes(requester.conversationRole))
          return ack?.({ success: false, message: 'Only admins can update the conversation' });

        const allowed = ['name', 'description', 'avatar', 'isReadOnly', 'isPinned'];
        for (const key of allowed) {
          if (updates[key] !== undefined) conv[key] = updates[key];
        }
        conv.updatedBy = user._id;
        await conv.save();

        io.to(conversationId).emit('conversation:updated', {
          conversationId,
          updates,
          updatedBy: userId,
        });

        ack?.({ success: true, conversation: conv });
      } catch (err) {
        console.error('[conversation:update]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('conversation:mute', async ({ conversationId, mutedUntil }, ack) => {
      try {
        const conv = await Conversation.findOne({
          _id:                 conversationId,
          'participants.user': user._id,
        });
        if (!conv) return ack?.({ success: false, message: 'Conversation not found' });

        const participant      = conv.participants.find(p => p.user.toString() === userId);
        participant.isMuted    = !!mutedUntil;
        participant.mutedUntil = mutedUntil ? new Date(mutedUntil) : null;
        await conv.save();

        socket.emit('conversation:mute_updated', {
          conversationId,
          isMuted:    participant.isMuted,
          mutedUntil: participant.mutedUntil,
        });

        ack?.({ success: true });
      } catch (err) {
        console.error('[conversation:mute]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ② MESSAGE EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('message:send', async (data, ack) => {
      try {
        const {
          conversationId,
          type        = 'text',
          content     = '',
          attachments = [],
          location,
          contact,
          replyTo,
          scheduledAt,
          // Sticker payload (only when type === 'sticker')
          sticker,
        } = data;

        if (!conversationId)
          return ack?.({ success: false, message: 'conversationId required' });

        // Validate sticker payload
        if (type === 'sticker') {
          if (!sticker?.giphyId || !sticker?.giphyUrl)
            return ack?.({ success: false, message: 'sticker.giphyId and sticker.giphyUrl are required for sticker type' });
        }

        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.isDeleted)
          return ack?.({ success: false, message: 'Conversation not found' });

        const participant = conv.participants.find(
          p => p.user.toString() === userId && p.isActive
        );
        if (!participant)
          return ack?.({ success: false, message: 'You are not in this conversation' });

        if (conv.type === 'broadcast' && !['owner', 'admin'].includes(participant.conversationRole))
          return ack?.({ success: false, message: 'Only admins can send in broadcast channels' });

        if (conv.isReadOnly && !['owner', 'admin'].includes(participant.conversationRole))
          return ack?.({ success: false, message: 'This conversation is read-only' });

        const receipts = conv.participants
          .filter(p => p.isActive && p.user.toString() !== userId)
          .map(p => ({ user: p.user, deliveredAt: null, readAt: null }));

        const mentions    = await extractMentions(content, conversationId);
        const isScheduled = !!scheduledAt && new Date(scheduledAt) > new Date();

        const messageData = {
          conversation: conversationId,
          sender:       user._id,
          type,
          content:      content.trim(),
          attachments,
          location:     location || undefined,
          contact:      contact  || undefined,
          replyTo:      replyTo  || null,
          receipts,
          mentions,
          isScheduled,
          scheduledAt:  isScheduled ? new Date(scheduledAt) : null,
        };

        // Attach sticker payload only when type === 'sticker'
        if (type === 'sticker' && sticker) {
          messageData.sticker = {
            giphyId:    sticker.giphyId,
            giphyUrl:   sticker.giphyUrl,
            previewUrl: sticker.previewUrl || null,
            title:      sticker.title      || null,
            width:      sticker.width      || null,
            height:     sticker.height     || null,
            rating:     sticker.rating     || null,
          };
        }

        const message = await Message.create(messageData);

        await message.populate([
          { path: 'sender',        select: 'name avatar role' },
          { path: 'replyTo',       select: 'content type sender' },
          { path: 'mentions',      select: 'name avatar' },
          { path: 'receipts.user', select: 'name avatar' },
        ]);

        if (isScheduled) {
          socket.emit('message:scheduled', { message });
          return ack?.({ success: true, scheduled: true, message });
        }

        io.to(conversationId).emit('message:new', { message });

        // Notify online participants
        for (const p of conv.participants.filter(
          p => p.isActive && p.user.toString() !== userId
        )) {
          const pUserId = p.user?.toString();
          if (!pUserId) continue;
          if (!isOnline(pUserId)) continue;

          emitToUser(io, pUserId, 'notification:message', {
            conversationId,
            messageId: message._id,
            sender:    { _id: user._id, name: user.name, avatar: user.avatar },
            preview:   type === 'sticker' ? '🎭 Sticker' : content.slice(0, 80),
            type,
          });
        }

        // Notify @mentioned users
        for (const mentionId of mentions) {
          if (!mentionId || mentionId.toString() === userId) continue;
          emitToUser(io, mentionId, 'notification:mention', {
            conversationId,
            messageId:   message._id,
            mentionedBy: { _id: user._id, name: user.name },
          });
        }

        ack?.({ success: true, message });
      } catch (err) {
        console.error('[message:send]', err);
        emitError(socket, 'message:send', err.message);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:delivered', async ({ messageId }, ack) => {
      try {
        const message = await Message.findOneAndUpdate(
          {
            _id:                    messageId,
            'receipts.user':        user._id,
            'receipts.deliveredAt': null,
          },
          { $set: { 'receipts.$.deliveredAt': new Date() } },
          { new: true }
        ).select('sender conversation receipts');

        if (!message) return ack?.({ success: false });

        if (message.sender) {
          emitToUser(io, message.sender, 'message:delivery_receipt', {
            messageId,
            userId,
            deliveredAt: new Date(),
          });
        }

        ack?.({ success: true });
      } catch (err) {
        console.error('[message:delivered]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:read', async ({ conversationId, messageId }, ack) => {
      try {
        const pivot = await Message.findById(messageId).select('createdAt');

        const result = await Message.updateMany(
          {
            conversation:          conversationId,
            'receipts.user':       user._id,
            'receipts.readAt':     null,
            createdAt: { $lte: pivot?.createdAt || new Date() },
          },
          { $set: { 'receipts.$.readAt': new Date() } }
        );

        await Conversation.findOneAndUpdate(
          { _id: conversationId, 'participants.user': user._id },
          { $set: { 'participants.$.lastReadMessage': messageId } }
        );

        io.to(conversationId).emit('message:read_receipt', {
          conversationId,
          messageId,
          readBy: userId,
          readAt: new Date(),
        });

        ack?.({ success: true, updated: result.modifiedCount });
      } catch (err) {
        console.error('[message:read]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:edit', async ({ messageId, content }, ack) => {
      try {
        if (!content?.trim())
          return ack?.({ success: false, message: 'Content required' });

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted)
          return ack?.({ success: false, message: 'Message not found' });

        if (message.sender.toString() !== userId)
          return ack?.({ success: false, message: "Cannot edit others' messages" });

        message.editHistory.push({ content: message.content, editedAt: new Date() });
        message.content  = content.trim();
        message.isEdited = true;
        await message.save();

        io.to(message.conversation.toString()).emit('message:edited', {
          messageId,
          content:     message.content,
          editedAt:    new Date(),
          editHistory: message.editHistory,
        });

        ack?.({ success: true, message });
      } catch (err) {
        console.error('[message:edit]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:delete', async ({ messageId, scope = 'deleted_for_everyone' }, ack) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.isDeleted)
          return ack?.({ success: false, message: 'Message not found' });

        const conv = await Conversation.findById(message.conversation).select('participants');
        const requesterInConv = conv?.participants.find(p => p.user.toString() === userId);

        const isAdmin  = ['owner', 'admin'].includes(requesterInConv?.conversationRole);
        const isSender = message.sender.toString() === userId;

        if (!isSender && !isAdmin)
          return ack?.({ success: false, message: 'Not authorised to delete this message' });

        message.isDeleted   = true;
        message.deletedAt   = new Date();
        message.deletedBy   = user._id;
        message.deleteScope = scope;
        if (scope === 'deleted_for_everyone') message.content = '';
        await message.save();

        if (scope === 'deleted_for_everyone') {
          io.to(message.conversation.toString()).emit('message:deleted', {
            messageId,
            scope,
            deletedBy: userId,
            deletedAt: message.deletedAt,
          });
        } else {
          emitToUser(io, userId, 'message:deleted', { messageId, scope });
        }

        ack?.({ success: true });
      } catch (err) {
        console.error('[message:delete]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:react', async ({ messageId, emoji }, ack) => {
      try {
        if (!emoji)
          return ack?.({ success: false, message: 'emoji required' });

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted)
          return ack?.({ success: false, message: 'Message not found' });

        const existingIdx = message.reactions.findIndex(
          r => r.user.toString() === userId && r.emoji === emoji
        );

        let action;
        if (existingIdx >= 0) {
          message.reactions.splice(existingIdx, 1);
          action = 'removed';
        } else {
          message.reactions.push({ user: user._id, emoji, reactedAt: new Date() });
          action = 'added';
        }
        await message.save();

        io.to(message.conversation.toString()).emit('message:reaction', {
          messageId,
          userId,
          emoji,
          action,
          reactions: message.reactions,
        });

        ack?.({ success: true, action });
      } catch (err) {
        console.error('[message:react]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:pin', async ({ messageId, pin = true }, ack) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.isDeleted)
          return ack?.({ success: false, message: 'Message not found' });

        const conv      = await Conversation.findById(message.conversation).select('participants');
        const requester = conv?.participants.find(p => p.user.toString() === userId);

        if (!requester || !['owner', 'admin'].includes(requester.conversationRole))
          return ack?.({ success: false, message: 'Only admins can pin messages' });

        message.isPinned = pin;
        message.pinnedAt = pin ? new Date() : null;
        message.pinnedBy = pin ? user._id   : null;
        await message.save();

        io.to(message.conversation.toString()).emit('message:pin_updated', {
          messageId,
          isPinned: message.isPinned,
          pinnedAt: message.pinnedAt,
          pinnedBy: userId,
        });

        ack?.({ success: true });
      } catch (err) {
        console.error('[message:pin]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    socket.on('message:forward', async ({ messageId, targetConversationIds = [] }, ack) => {
      try {
        const original = await Message.findById(messageId);
        if (!original || original.isDeleted)
          return ack?.({ success: false, message: 'Message not found' });

        const forwarded = [];

        for (const targetId of targetConversationIds) {
          const conv = await Conversation.findById(targetId);
          if (!conv || conv.isDeleted) continue;

          const participant = conv.participants.find(
            p => p.user.toString() === userId && p.isActive
          );
          if (!participant) continue;

          const receipts = conv.participants
            .filter(p => p.isActive && p.user.toString() !== userId)
            .map(p => ({ user: p.user }));

          const msgData = {
            conversation: targetId,
            sender:       user._id,
            type:         original.type,
            content:      original.content,
            attachments:  original.attachments,
            location:     original.location,
            forwardedFrom: {
              messageId:      original._id,
              conversationId: original.conversation,
              senderId:       original.sender,
            },
            receipts,
          };

          // Forward sticker data if applicable
          if (original.type === 'sticker' && original.sticker) {
            msgData.sticker = original.sticker;
          }

          const msg = await Message.create(msgData);
          await msg.populate('sender', 'name avatar role');
          io.to(targetId).emit('message:new', { message: msg });
          forwarded.push({ targetId, messageId: msg._id });
        }

        ack?.({ success: true, forwarded });
      } catch (err) {
        console.error('[message:forward]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ③ TYPING INDICATORS
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('typing:start', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId,
        name:     user.name,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing:update', {
        conversationId,
        userId,
        name:     user.name,
        isTyping: false,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ④ CALL SIGNALLING — Full WebRTC SDP + ICE relay
    //
    // FLOW:
    //   Caller                          Server                       Callee
    //   ──────                          ──────                       ──────
    //   call:initiate ──────────────────► store active call
    //                                    emit call:incoming ─────────► callee
    //   (callee online)
    //   call:ringing ◄──────────────────── emit call:ringing ◄──────── callee
    //   getUserMedia()                                                 getUserMedia()
    //   createOffer()
    //   call:offer ─────────────────────► relay call:offer ──────────► callee
    //                                                                  createAnswer()
    //   call:answer ◄───────────────────── relay call:answer ◄──────── callee
    //   setRemoteDescription()
    //   call:ice ───────────────────────► relay call:ice ─────────────► callee
    //   call:ice ◄───────────────────────── relay call:ice ◄──────────── callee
    //   (streams flow)
    //   call:end ───────────────────────► relay call:ended ───────────► callee
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * call:initiate — caller starts a call
     * Payload: { conversationId, callType, targetUserIds[], mediaConstraints? }
     * mediaConstraints example: { video: true, audio: true }
     */
    socket.on('call:initiate', async ({ conversationId, callType = 'audio', targetUserIds = [], mediaConstraints }, ack) => {
      try {
        if (!conversationId)
          return ack?.({ success: false, message: 'conversationId required' });

        // Resolve all target IDs from conversation if not provided
        let resolvedTargets = (targetUserIds || []).filter(Boolean);

        if (resolvedTargets.length === 0) {
          const conv = await Conversation.findById(conversationId).select('participants');
          if (conv) {
            resolvedTargets = conv.participants
              .filter(p => p.isActive && p.user.toString() !== userId)
              .map(p => p.user.toString());
          }
        }

        const defaultConstraints = {
          audio: true,
          video: callType === 'video',
        };
        const constraints = mediaConstraints || defaultConstraints;

        // Create call system message
        const sysMsg = await Message.create({
          conversation: conversationId,
          sender:       user._id,
          type:         'call',
          content:      `${user.name} started a ${callType} call`,
          call:         { status: null, callType },
          systemEvent:  { event: 'call_started' },
        });

        // Populate for response
        await sysMsg.populate('sender', 'name avatar role');

        // Register active call
        activeCalls.set(conversationId, {
          callerId:    userId,
          calleeIds:   resolvedTargets,
          startedAt:   new Date(),
          messageId:   sysMsg._id.toString(),
          callType,
          constraints,
        });

        const callPayload = {
          conversationId,
          callType,
          caller: {
            _id:    user._id,
            name:   user.name,
            avatar: user.avatar,
            role:   user.role,
          },
          messageId:        sysMsg._id,
          mediaConstraints: constraints,
        };

        // Emit to each target
        let onlineCount = 0;
        for (const tid of resolvedTargets) {
          if (isOnline(tid)) {
            emitToUser(io, tid, 'call:incoming', callPayload);
            onlineCount++;
          } else {
            // Queue for offline delivery
            if (!pendingCalls.has(tid)) pendingCalls.set(tid, []);
            pendingCalls.get(tid).push(callPayload);
          }
        }

        ack?.({
          success:     true,
          messageId:   sysMsg._id,
          onlineCount,
          offlineCount: resolvedTargets.length - onlineCount,
        });
      } catch (err) {
        console.error('[call:initiate]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    /**
     * call:ringing — callee notifies caller that their device is ringing
     * Payload: { conversationId, targetUserId (caller) }
     */
    socket.on('call:ringing', ({ conversationId, targetUserId }) => {
      if (!targetUserId) {
        console.warn('[call:ringing] missing targetUserId');
        return;
      }
      emitToUser(io, targetUserId, 'call:ringing', {
        conversationId,
        from: userId,
        user: { _id: user._id, name: user.name, avatar: user.avatar },
      });
    });

    /**
     * call:offer — caller sends SDP offer to callee
     * Payload: { conversationId, targetUserId, sdp (RTCSessionDescriptionInit), mediaConstraints? }
     *
     * The callee calls getUserMedia() then createAnswer() after receiving this.
     */
    socket.on('call:offer', ({ conversationId, targetUserId, sdp, mediaConstraints }) => {
      if (!targetUserId) {
        console.warn('[call:offer] missing targetUserId — skipping relay');
        return;
      }
      if (!sdp) {
        console.warn('[call:offer] missing sdp — skipping relay');
        return;
      }
      emitToUser(io, targetUserId, 'call:offer', {
        conversationId,
        sdp,
        from:             userId,
        mediaConstraints: mediaConstraints || { audio: true, video: true },
        caller: {
          _id:    user._id,
          name:   user.name,
          avatar: user.avatar,
        },
      });
    });

    /**
     * call:answer — callee sends SDP answer back to caller
     * Payload: { conversationId, targetUserId (caller), sdp (RTCSessionDescriptionInit) }
     */
    socket.on('call:answer', ({ conversationId, targetUserId, sdp }) => {
      if (!targetUserId) {
        console.warn('[call:answer] missing targetUserId — skipping relay');
        return;
      }
      if (!sdp) {
        console.warn('[call:answer] missing sdp — skipping relay');
        return;
      }
      emitToUser(io, targetUserId, 'call:answered', {
        conversationId,
        sdp,
        from: userId,
        callee: {
          _id:    user._id,
          name:   user.name,
          avatar: user.avatar,
        },
      });
    });

    /**
     * call:ice — relay ICE candidate to peer
     * Payload: { conversationId, targetUserId, candidate (RTCIceCandidateInit) }
     *
     * Both caller and callee use this same event.
     * 'targetUserId' tells the server which peer to relay to.
     */
    socket.on('call:ice', ({ conversationId, targetUserId, candidate }) => {
      if (!targetUserId) {
        console.warn('[call:ice] missing targetUserId — skipping relay');
        return;
      }
      if (!candidate) {
        console.warn('[call:ice] missing candidate — skipping relay');
        return;
      }
      emitToUser(io, targetUserId, 'call:ice', {
        conversationId,
        candidate,
        from: userId,
      });
    });

    /**
     * call:media_toggle — relay mute/camera toggle to all peers in the call
     * Payload: { conversationId, kind ('audio'|'video'), enabled (boolean) }
     */
    socket.on('call:media_toggle', ({ conversationId, kind, enabled }) => {
      if (!conversationId) return;
      // Broadcast to everyone else in the conversation room
      socket.to(conversationId).emit('call:media_toggle', {
        conversationId,
        from:    userId,
        kind,
        enabled,
        user: { _id: user._id, name: user.name },
      });
    });

    /**
     * call:end — caller or callee ends the call
     * Payload: { conversationId, messageId, duration (seconds) }
     */
    socket.on('call:end', async ({ conversationId, messageId, duration = 0 }) => {
      // Remove from active calls
      activeCalls.delete(conversationId);

      // Remove any pending (unanswered) call notifications for this conversation
      for (const [uid, calls] of pendingCalls.entries()) {
        const filtered = calls.filter(c => c.conversationId !== conversationId);
        if (filtered.length === 0) pendingCalls.delete(uid);
        else pendingCalls.set(uid, filtered);
      }

      if (messageId) {
        await Message.findByIdAndUpdate(messageId, {
          $set: { 'call.status': 'answered', 'call.duration': duration },
        }).catch(err => console.error('[call:end update]', err.message));
      }

      socket.to(conversationId).emit('call:ended', {
        conversationId,
        endedBy: userId,
        duration,
        endedByUser: { _id: user._id, name: user.name, avatar: user.avatar },
      });
    });

    /**
     * call:decline — callee rejects the call
     * Payload: { conversationId, messageId }
     */
    socket.on('call:decline', async ({ conversationId, messageId }) => {
      // Remove pending call entry for this user
      if (pendingCalls.has(userId)) {
        const filtered = pendingCalls.get(userId).filter(
          c => c.conversationId !== conversationId
        );
        if (filtered.length === 0) pendingCalls.delete(userId);
        else pendingCalls.set(userId, filtered);
      }

      if (messageId) {
        await Message.findByIdAndUpdate(messageId, {
          $set: { 'call.status': 'declined' },
        }).catch(err => console.error('[call:decline update]', err.message));
      }

      // Notify the caller that callee declined
      const activeCall = activeCalls.get(conversationId);
      if (activeCall?.callerId) {
        emitToUser(io, activeCall.callerId, 'call:declined', {
          conversationId,
          declinedBy: userId,
          declinedByUser: { _id: user._id, name: user.name, avatar: user.avatar },
        });
      } else {
        socket.to(conversationId).emit('call:declined', {
          conversationId,
          declinedBy: userId,
        });
      }
    });

    /**
     * call:missed — mark call as missed
     * Payload: { conversationId, messageId }
     */
    socket.on('call:missed', async ({ conversationId, messageId }) => {
      activeCalls.delete(conversationId);

      if (messageId) {
        await Message.findByIdAndUpdate(messageId, {
          $set: { 'call.status': 'missed' },
        }).catch(err => console.error('[call:missed update]', err.message));
      }
      socket.to(conversationId).emit('call:missed', { conversationId, userId });
    });

    /**
     * call:recording_upload — client sends a base64 recording blob
     * for server-side storage (voice notes / call recordings).
     * Payload: { conversationId, messageId, blob (base64), mimeType, duration }
     */
    socket.on('call:recording_upload', async ({ conversationId, blob, mimeType = 'audio/webm', duration = 0, caption = '' }, ack) => {
      try {
        if (!blob || !conversationId)
          return ack?.({ success: false, message: 'blob and conversationId required' });

        const conv = await Conversation.findById(conversationId);
        if (!conv || conv.isDeleted)
          return ack?.({ success: false, message: 'Conversation not found' });

        const participant = conv.participants.find(
          p => p.user.toString() === userId && p.isActive
        );
        if (!participant)
          return ack?.({ success: false, message: 'Not a member' });

        // Lazy-load ImageKit to avoid circular imports
        const ImageKit = (await import('imagekit')).default;
        const imagekit = new ImageKit({
          publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
          privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
          urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
        });

        const fileName  = `recording_${Date.now()}_${userId}.webm`;
        const ikResult  = await imagekit.upload({
          file:              blob,             // already base64
          fileName,
          folder:            '/Likeson/chat/recordings',
          useUniqueFileName: true,
        });

        const receipts = conv.participants
          .filter(p => p.isActive && p.user.toString() !== userId)
          .map(p => ({ user: p.user, deliveredAt: null, readAt: null }));

        const message = await Message.create({
          conversation: conversationId,
          sender:       user._id,
          type:         'audio',
          content:      caption,
          attachments: [{
            url:          ikResult.url,
            originalName: fileName,
            mimeType,
            size:         0,
            duration,
          }],
          receipts,
        });

        await message.populate('sender', 'name avatar role');
        io.to(conversationId).emit('message:new', { message });

        ack?.({ success: true, message });
      } catch (err) {
        console.error('[call:recording_upload]', err);
        ack?.({ success: false, message: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ⑤ PRESENCE
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('presence:get', ({ userIds = [] }, ack) => {
      const result = {};
      for (const id of (userIds || []).filter(Boolean)) {
        result[id] = isOnline(id);
      }
      ack?.(result);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ⑥ DISCONNECT
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('disconnect', async (reason) => {
      trackOffline(userId, socket.id);
      console.info(`[Socket] -disconnect ${user.name} — ${socket.id} (${reason})`);

      if (!isOnline(userId)) {
        const now = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastseen: now })
          .catch(err => console.error('[disconnect update]', err.message));
        socket.broadcast.emit('user:offline', { userId, lastseen: now });

        // If user was in an active call and disconnects, notify peers
        for (const [convId, call] of activeCalls.entries()) {
          const wasInCall =
            call.callerId === userId || call.calleeIds.includes(userId);

          if (wasInCall) {
            socket.to(convId).emit('call:peer_disconnected', {
              conversationId: convId,
              userId,
              userName: user.name,
            });
          }
        }
      }
    });
  });

  // ── Scheduled message delivery job (runs every minute) ───────────────────
  setInterval(async () => {
    try {
      const due = await Message.find({
        isScheduled: true,
        isDeleted:   false,
        scheduledAt: { $lte: new Date() },
        deliveredAt: null,
      }).populate('sender', 'name avatar role');

      for (const msg of due) {
        msg.isScheduled = false;
        msg.deliveredAt = new Date();
        await msg.save();

        io.to(msg.conversation.toString()).emit('message:new', { message: msg });
        console.info(`[Scheduler] Delivered scheduled message ${msg._id}`);
      }
    } catch (err) {
      console.error('[Scheduler]', err.message);
    }
  }, 60_000);

  // ── Auto-expire stale active calls (no one answered in 60s) ──────────────
  setInterval(() => {
    const now = Date.now();
    for (const [convId, call] of activeCalls.entries()) {
      if (now - call.startedAt.getTime() > 90_000) {
        // Mark as missed in DB
        Message.findByIdAndUpdate(call.messageId, {
          $set: { 'call.status': 'missed' },
        }).catch(() => {});

        // Notify conversation room
        io.to(convId).emit('call:missed', { conversationId: convId, userId: call.callerId });
        activeCalls.delete(convId);

        // Clear pending queue
        for (const uid of call.calleeIds) {
          if (pendingCalls.has(uid)) {
            const filtered = pendingCalls.get(uid).filter(c => c.conversationId !== convId);
            if (filtered.length === 0) pendingCalls.delete(uid);
            else pendingCalls.set(uid, filtered);
          }
        }
      }
    }
  }, 30_000);

  console.info('[Socket.IO] Initialized ✓');
  return io;
}