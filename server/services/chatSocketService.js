 

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Conversation, Message, Call } from '../models/chat.js';
import chatService from './chatService.js';
import agoraService from './chat/agoraService.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

const emitError = (socket, event, message) => socket.emit(`${event}:error`, { message });

// ─── Socket auth middleware ───────────────────────────────────────────────────

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_REQUIRED'));

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

// ─── Room helpers ─────────────────────────────────────────────────────────────

const convoRoom = (conversationId) => `convo:${conversationId}`;
const userRoom  = (userId)         => `user:${userId}`;
const callRoom  = (callId)         => `call:${callId}`;

/**
 * Broadcast presence only to rooms the user actually shares with others,
 * instead of every connected socket on the namespace.
 */
const broadcastPresenceToContacts = async (chatNs, userId, payload) => {
  const convos = await Conversation.find({ 'participants.user': userId })
    .select('_id')
    .lean();
  for (const c of convos) {
    chatNs.to(convoRoom(c._id.toString())).emit('user:online', payload);
  }
};

// ─── Main attach ─────────────────────────────────────────────────────────────

export const attachChatSocket = (io) => {
  const chatNs = io.of('/chat');
  chatNs.use(authenticateSocket);

  chatNs.on('connection', async (socket) => {
    const userId   = socket.user._id.toString();
    const userRole = socket.user.role;

    socket.join(userRoom(userId));

    await chatService.setUserOnline(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastActiveAt: new Date() });

    // FIX: scoped to shared conversations only, not namespace-wide broadcast
    broadcastPresenceToContacts(chatNs, userId, { userId, isOnline: true }).catch((err) =>
      console.error('[Socket] presence broadcast error:', err.message),
    );

    console.log(`[Socket] ${socket.user.name} (${userRole}) connected — ${socket.id}`);

    // ══════════════════════════════════════════════════════════════════════
    // CONVERSATION EVENTS
    // ══════════════════════════════════════════════════════════════════════

    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        const convo = await Conversation.findById(conversationId).select('participants');
        if (!convo) return emitError(socket, 'join_conversation', 'Conversation not found');

        const isMember = convo.participants.some(
          (p) => (p.user._id || p.user).toString() === userId && !p.isDeleted,
        );
        if (!isMember) return emitError(socket, 'join_conversation', 'Not a member');

        socket.join(convoRoom(conversationId));
        socket.emit('join_conversation:ok', { conversationId });
      } catch (err) {
        emitError(socket, 'join_conversation', err.message);
      }
    });

    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(convoRoom(conversationId));
      socket.emit('leave_conversation:ok', { conversationId });
    });

    // ══════════════════════════════════════════════════════════════════════
    // MESSAGE EVENTS
    // ══════════════════════════════════════════════════════════════════════

    socket.on('send_message', async (data, ack) => {
      try {
        const { conversationId, type = 'text', text, replyTo, location, cardPayload } = data;
        if (!conversationId) throw new Error('conversationId required');

        const msg = await chatService.sendMessage({
          conversationId,
          senderId: userId,
          type, text, location, cardPayload, replyTo,
        });

        chatNs.to(convoRoom(conversationId)).emit('new_message', msg);

        if (ack) ack({ success: true, message: msg });
      } catch (err) {
        emitError(socket, 'send_message', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('mark_read', async ({ conversationId }) => {
      try {
        await chatService.markMessagesRead(conversationId, userId);
        chatNs.to(convoRoom(conversationId)).emit('messages_read', {
          conversationId, readBy: userId, readAt: new Date(),
        });
      } catch (err) {
        emitError(socket, 'mark_read', err.message);
      }
    });

    socket.on('mark_delivered', async ({ conversationId }) => {
      try {
        await chatService.markMessagesDelivered(conversationId, userId);
        chatNs.to(convoRoom(conversationId)).emit('messages_delivered', {
          conversationId, deliveredTo: userId, deliveredAt: new Date(),
        });
      } catch (err) {
        emitError(socket, 'mark_delivered', err.message);
      }
    });

    socket.on('typing', async ({ conversationId, isTyping }) => {
      try {
        await chatService.setTyping(conversationId, userId, isTyping);
        socket.to(convoRoom(conversationId)).emit('user_typing', {
          conversationId, userId, userName: socket.user.name, isTyping,
        });
      } catch (_) {
        /* suppress typing errors — non-critical, ephemeral */
      }
    });

    socket.on('edit_message', async ({ messageId, text }, ack) => {
      try {
        const msg = await chatService.editMessage(messageId, userId, text);
        chatNs.to(convoRoom(msg.conversation.toString())).emit('message_edited', msg);
        if (ack) ack({ success: true, message: msg });
      } catch (err) {
        emitError(socket, 'edit_message', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('delete_message', async ({ messageId, scope }, ack) => {
      try {
        const msg = await Message.findById(messageId).select('conversation');
        if (!msg) throw new Error('Message not found');

        const result = await chatService.deleteMessage(messageId, userId, scope);

        if (scope === 'for_all') {
          chatNs.to(convoRoom(msg.conversation.toString())).emit('message_deleted', {
            messageId, conversationId: msg.conversation, scope,
          });
        }
        if (ack) ack({ success: true, ...result });
      } catch (err) {
        emitError(socket, 'delete_message', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('react_message', async ({ messageId, emoji }, ack) => {
      try {
        const msg = await Message.findById(messageId).select('conversation');
        if (!msg) throw new Error('Message not found');

        const reactions = await chatService.reactToMessage(messageId, userId, emoji);
        chatNs.to(convoRoom(msg.conversation.toString())).emit('message_reaction', {
          messageId, conversationId: msg.conversation, reactions,
        });
        if (ack) ack({ success: true, reactions });
      } catch (err) {
        emitError(socket, 'react_message', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    // ══════════════════════════════════════════════════════════════════════
    // CALL SIGNALING
    // ══════════════════════════════════════════════════════════════════════

    /**
     * FIX: no more manual activeCall read-then-write here. agoraService
     * .initiateCall() does the atomic claim internally and throws 409 if
     * a call is already active — caught below like any other error.
     */
    socket.on('call_initiate', async ({ conversationId, type = 'audio' }, ack) => {
      try {
        const convo = await Conversation.findById(conversationId).select('participants type');
        if (!convo) throw new Error('Conversation not found');

        const isMember = convo.participants.some(
          (p) => (p.user._id || p.user).toString() === userId && !p.isDeleted,
        );
        if (!isMember) throw Object.assign(new Error('Not a member'), { statusCode: 403 });

        const invitedIds = convo.participants
          .filter((p) => (p.user._id || p.user).toString() !== userId && !p.isDeleted)
          .map((p) => (p.user._id || p.user).toString());

        const result = await agoraService.initiateCall({
          conversationId,
          initiatorId:    userId,
          type,
          invitedUserIds: invitedIds,
        });

        socket.join(callRoom(result.call._id.toString()));

        for (const invitedId of invitedIds) {
          chatNs.to(userRoom(invitedId)).emit('incoming_call', {
            callId:         result.call._id,
            conversationId,
            type,
            channelName:    result.channelName,
            appId:          result.appId,
            initiator: {
              id:     userId,
              name:   socket.user.name,
              avatar: socket.user.avatar,
              role:   socket.user.role,
            },
          });
        }

        if (ack) ack({
          success:     true,
          callId:      result.call._id,
          channelName: result.channelName,
          token:       result.token,
          uid:         result.uid,
          appId:       result.appId,
          expiresAt:   result.expiresAt,
        });
      } catch (err) {
        emitError(socket, 'call_initiate', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('call_join', async ({ callId }, ack) => {
      try {
        const result = await agoraService.joinCall(callId, userId);

        socket.join(callRoom(callId));

        chatNs.to(callRoom(callId)).emit('call_participant_joined', {
          callId, userId, name: socket.user.name, avatar: socket.user.avatar,
        });

        if (ack) ack({
          success:     true,
          callId:      result.call._id,
          channelName: result.channelName,
          token:       result.token,
          uid:         result.uid,
          appId:       result.appId,
          expiresAt:   result.expiresAt,
        });
      } catch (err) {
        emitError(socket, 'call_join', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('call_decline', async ({ callId }, ack) => {
      try {
        const call = await agoraService.endCall(callId, userId, 'declined');

        chatNs.to(callRoom(callId)).emit('call_declined', {
          callId, declinedBy: { id: userId, name: socket.user.name },
        });
        chatNs.to(userRoom(call.initiator.toString())).emit('call_declined', {
          callId, declinedBy: { id: userId, name: socket.user.name },
        });

        socket.leave(callRoom(callId));
        if (ack) ack({ success: true });
      } catch (err) {
        emitError(socket, 'call_decline', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('call_end', async ({ callId }, ack) => {
      try {
        const call = await agoraService.endCall(callId, userId, 'ended');

        chatNs.to(callRoom(callId)).emit('call_ended', {
          callId, endedBy: { id: userId, name: socket.user.name }, duration: call.duration,
        });

        socket.leave(callRoom(callId));
        if (ack) ack({ success: true, duration: call.duration });
      } catch (err) {
        emitError(socket, 'call_end', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('call_cancel', async ({ callId }, ack) => {
      try {
        await agoraService.endCall(callId, userId, 'cancelled');

        chatNs.to(callRoom(callId)).emit('call_cancelled', {
          callId, cancelledBy: { id: userId, name: socket.user.name },
        });

        socket.leave(callRoom(callId));
        if (ack) ack({ success: true });
      } catch (err) {
        emitError(socket, 'call_cancel', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    socket.on('call_token_renew', async ({ callId }, ack) => {
      try {
        const result = await agoraService.refreshCallToken(callId, userId);
        if (ack) ack({ success: true, ...result });
      } catch (err) {
        emitError(socket, 'call_token_renew', err.message);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    /**
     * FIX: now verifies the socket has actually joined this call's room
     * before relaying mute/cam state — previously any authenticated socket
     * could spoof state updates for a callId it was never part of.
     */
    socket.on('call_mute_toggle', ({ callId, isMuted, isCamOff }) => {
      if (!socket.rooms.has(callRoom(callId))) {
        return emitError(socket, 'call_mute_toggle', 'Not part of this call');
      }
      socket.to(callRoom(callId)).emit('call_participant_state', {
        callId, userId, isMuted: isMuted ?? false, isCamOff: isCamOff ?? false,
      });
    });

    // ══════════════════════════════════════════════════════════════════════
    // DISCONNECT
    // ══════════════════════════════════════════════════════════════════════

    socket.on('disconnect', async () => {
      try {
        await chatService.setUserOffline(userId);
        const lastseen = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastseen });

        // FIX: scoped broadcast, same as connect
        await broadcastPresenceToContacts(chatNs, userId, { userId, isOnline: false, lastseen });

        console.log(`[Socket] ${socket.user.name} disconnected`);
      } catch (err) {
        console.error('[Socket] disconnect cleanup error:', err.message);
      }
    });

    // ── Initial state ─────────────────────────────────────────────────────
    try {
      const unread = await chatService.getTotalUnreadCount(userId);
      socket.emit('init', { userId, unreadCount: unread, serverTime: new Date() });
    } catch (err) {
      console.error('[Socket] init emit error:', err.message);
    }
  });

  return chatNs;
};

export default { attachChatSocket };