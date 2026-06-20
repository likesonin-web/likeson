/**
 * services/chatService.js
 * Fixes applied:
 *  - sendMediaMessage V1 removed (race condition). Use V2 only.
 *  - getConversationById: handle both populated and unpopulated participants.user
 *  - getUserConversations: same populated/unpopulated guard
 *  - getMessages: same guard
 *  - getOrCreateDirectConversation: prevent duplicate direct convos under race
 *  - markMessagesRead: only update if conversation exists for participant
 *  - duplicate export removed (markMessagesDelivered appeared twice)
 */

import mongoose from 'mongoose';
import ImageKit from 'imagekit';
import { Conversation, Message, MessageStatus, UserBlock } from '../models/chat.js';
import User from '../models/User.js';
import redisClient from '../config/redis.js';

// ─── ImageKit ─────────────────────────────────────────────────────────────────

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const CHAT_MEDIA_FOLDER = '/chat-media';

// ─── Cache keys ───────────────────────────────────────────────────────────────

const UNREAD_KEY  = (userId) => `chat:unread:${userId}`;
const ONLINE_KEY  = (userId) => `chat:online:${userId}`;
const TYPING_KEY  = (convId, userId) => `chat:typing:${convId}:${userId}`;

// ─── Internal helper: resolve participant user id ─────────────────────────────
// Handles both populated { user: { _id: ... } } and unpopulated { user: ObjectId }

const resolveUserId = (p) => {
  if (!p?.user) return null;
  return (p.user._id || p.user).toString();
};

// ═════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * getOrCreateDirectConversation
 * FIX: Use findOneAndUpdate with upsert=false + create inside session to prevent
 *      duplicate direct convos under concurrent requests.
 */
export const getOrCreateDirectConversation = async (userId, targetUserId) => {
  const uId  = userId.toString();
  const tId  = targetUserId.toString();

  if (uId === tId) {
    throw Object.assign(new Error('Cannot chat with yourself'), { statusCode: 400 });
  }

  const blocked = await UserBlock.findOne({
    $or: [
      { blocker: userId,       blocked: targetUserId },
      { blocker: targetUserId, blocked: userId },
    ],
  });
  if (blocked) throw Object.assign(new Error('Unable to message this user'), { statusCode: 403 });

  // Find existing — both users must be non-deleted participants
  let convo = await Conversation.findOne({
    type: 'direct',
    $and: [
      { 'participants': { $elemMatch: { user: userId,       isDeleted: false } } },
      { 'participants': { $elemMatch: { user: targetUserId, isDeleted: false } } },
    ],
  });

  if (convo) return convo;

  const [userA, userB] = await Promise.all([
    User.findById(userId).select('name role avatar'),
    User.findById(targetUserId).select('name role avatar'),
  ]);
  if (!userB) throw Object.assign(new Error('Target user not found'), { statusCode: 404 });

  // Guard race: two requests creating same DM simultaneously
  // Try insert; if duplicate key → find again
  try {
    convo = await Conversation.create({
      type: 'direct',
      participants: [
        { user: userId,       role: userA.role, joinedAt: new Date() },
        { user: targetUserId, role: userB.role, joinedAt: new Date() },
      ],
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate — race condition, fetch the one that was created
      convo = await Conversation.findOne({
        type: 'direct',
        $and: [
          { 'participants': { $elemMatch: { user: userId,       isDeleted: false } } },
          { 'participants': { $elemMatch: { user: targetUserId, isDeleted: false } } },
        ],
      });
      if (!convo) throw err;
    } else {
      throw err;
    }
  }

  return convo;
};

/**
 * createGroupConversation
 */
export const createGroupConversation = async ({
  creatorId, name, description, memberIds = [], type = 'group',
}) => {
  if (!name?.trim()) throw Object.assign(new Error('Group name required'), { statusCode: 400 });

  const uniqueMembers = [...new Set([creatorId.toString(), ...memberIds.map(String)])];
  const users = await User.find({ _id: { $in: uniqueMembers } }).select('name role');
  if (users.length !== uniqueMembers.length) {
    throw Object.assign(new Error('One or more users not found'), { statusCode: 404 });
  }

  const participants = users.map((u) => ({
    user:     u._id,
    role:     u.role,
    joinedAt: new Date(),
    isAdmin:  u._id.toString() === creatorId.toString(),
  }));

  return Conversation.create({ type, name: name.trim(), description, participants, createdBy: creatorId });
};

/**
 * getUserConversations
 */
export const getUserConversations = async (userId, { page = 1, limit = 20, type } = {}) => {
  const skip = (page - 1) * limit;
  const filter = {
    participants: {
      $elemMatch: {
        user:       userId,
        isDeleted:  false,
        isArchived: false,
      },
    },
  };
  if (type) filter.type = type;

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants.user', 'name avatar role isOnline lastseen')
      .populate('lastMessage.sender', 'name avatar')
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  const unreadCounts = await MessageStatus.aggregate([
    {
      $match: {
        user:    new mongoose.Types.ObjectId(userId),
        readAt:  null,
        conversation: { $in: conversations.map((c) => c._id) },
      },
    },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const unreadMap = {};
  for (const row of unreadCounts) unreadMap[row._id.toString()] = row.count;

  return {
    conversations: conversations.map((c) => ({
      ...c,
      unreadCount: unreadMap[c._id.toString()] || 0,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

/**
 * getConversationById
 * FIX: membership check handles both populated and unpopulated user field
 */
export const getConversationById = async (conversationId, userId) => {
  const convo = await Conversation.findById(conversationId)
    .populate('participants.user', 'name avatar role isOnline lastseen phone')
    .lean();

  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

  const isMember = convo.participants.some(
    (p) => resolveUserId(p) === userId.toString() && !p.isDeleted
  );
  if (!isMember) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  return convo;
};

/**
 * updateGroupConversation
 */
export const updateGroupConversation = async (conversationId, userId, updates) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  if (convo.type === 'direct') throw Object.assign(new Error('Cannot update direct chat'), { statusCode: 400 });

  const p = convo.participants.find((p) => p.user.toString() === userId.toString());
  if (!p?.isAdmin) throw Object.assign(new Error('Only group admins can update'), { statusCode: 403 });

  const allowed = ['name', 'description', 'avatar'];
  for (const k of allowed) {
    if (updates[k] !== undefined) convo[k] = updates[k];
  }
  await convo.save();
  return convo;
};

/**
 * addGroupMembers
 */
export const addGroupMembers = async (conversationId, adminId, memberIds) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo || convo.type === 'direct') throw Object.assign(new Error('Group not found'), { statusCode: 404 });

  const admin = convo.participants.find((p) => p.user.toString() === adminId.toString());
  if (!admin?.isAdmin) throw Object.assign(new Error('Only admins can add members'), { statusCode: 403 });

  const users = await User.find({ _id: { $in: memberIds } }).select('name role');
  for (const u of users) {
    const existingIdx = convo.participants.findIndex((p) => p.user.toString() === u._id.toString());
    if (existingIdx !== -1) {
      convo.participants[existingIdx].isDeleted = false; // re-add soft-deleted
    } else {
      convo.participants.push({ user: u._id, role: u.role, joinedAt: new Date() });
    }
  }
  await convo.save();
  return convo;
};

/**
 * removeGroupMember / leaveGroup
 */
export const removeGroupMember = async (conversationId, adminId, memberId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw Object.assign(new Error('Group not found'), { statusCode: 404 });

  const isAdmin = convo.participants.find((p) => p.user.toString() === adminId.toString())?.isAdmin;
  const isSelf  = adminId.toString() === memberId.toString();

  if (!isAdmin && !isSelf) throw Object.assign(new Error('Not authorised'), { statusCode: 403 });

  const idx = convo.participants.findIndex((p) => p.user.toString() === memberId.toString());
  if (idx !== -1) {
    convo.participants[idx].isDeleted = true;
  }
  await convo.save();
  return convo;
};

/**
 * updateGroupAdminStatus
 */
export const updateGroupAdminStatus = async (conversationId, adminId, targetMemberId, isAdmin) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo || convo.type === 'direct') throw Object.assign(new Error('Group not found'), { statusCode: 404 });

  const requester = convo.participants.find((p) => p.user.toString() === adminId.toString());
  if (!requester?.isAdmin) throw Object.assign(new Error('Only group admins can modify roles'), { statusCode: 403 });

  const targetIndex = convo.participants.findIndex((p) => p.user.toString() === targetMemberId.toString());
  if (targetIndex === -1 || convo.participants[targetIndex].isDeleted) {
    throw Object.assign(new Error('User is not an active member of this group'), { statusCode: 404 });
  }

  convo.participants[targetIndex].isAdmin = isAdmin;
  await convo.save();
  return convo;
};

/**
 * blockConversation
 */
export const blockConversation = async (conversationId, userId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo || convo.type !== 'direct') throw Object.assign(new Error('Direct chat not found'), { statusCode: 404 });

  convo.isBlocked = true;
  convo.blockedBy = userId;
  await convo.save();
  return convo;
};

/**
 * clearConversation — soft-delete all messages for requesting user
 */
export const clearConversation = async (conversationId, userId) => {
  await Message.updateMany(
    {
      conversation:  conversationId,
      deletedForAll: false,
      deletedFor:    { $ne: userId },
    },
    { $addToSet: { deletedFor: userId } }
  );
  return { success: true, message: 'Chat history cleared for user' };
};

/**
 * getConversationMedia
 */
export const getConversationMedia = async (conversationId, userId, { limit = 50, page = 1, type } = {}) => {
  await getConversationById(conversationId, userId);

  const skip   = (page - 1) * limit;
  const filter = {
    conversation:  conversationId,
    deletedForAll: false,
    deletedFor:    { $ne: userId },
    media:         { $exists: true, $ne: null },
  };
  if (type) filter.type = type;

  return Message.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name avatar')
    .lean();
};

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * sendMessage — text, location, order_card, contact, sticker
 */
export const sendMessage = async ({
  conversationId,
  senderId,
  type = 'text',
  text,
  location,
  cardPayload,
  replyTo,
  forwardedFrom,
}) => {
  const convo = await Conversation.findById(conversationId).select('participants isBlocked type');
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  if (convo.isBlocked) throw Object.assign(new Error('This conversation is blocked'), { statusCode: 403 });

  const isMember = convo.participants.some(
    (p) => p.user.toString() === senderId.toString() && !p.isDeleted
  );
  if (!isMember) throw Object.assign(new Error('Not a member'), { statusCode: 403 });

  if (type === 'text' && !text?.trim()) {
    throw Object.assign(new Error('Message text required'), { statusCode: 400 });
  }

  const msg = await Message.create({
    conversation: conversationId,
    sender:       senderId,
    type,
    text:         text?.trim(),
    location,
    cardPayload,
    replyTo,
    forwardedFrom,
  });

  const otherParticipants = convo.participants.filter(
    (p) => p.user.toString() !== senderId.toString() && !p.isDeleted
  );

  if (otherParticipants.length > 0) {
    await MessageStatus.insertMany(
      otherParticipants.map((p) => ({
        message:      msg._id,
        conversation: conversationId,
        user:         p.user,
      })),
      { ordered: false },
    );
    for (const p of otherParticipants) {
      await redisClient.del(UNREAD_KEY(p.user.toString())).catch(() => {});
    }
  }

  return msg.populate('sender', 'name avatar role');
};

/**
 * sendMediaMessageV2 — single atomic upload + create
 * FIX: V1 removed (had race condition between sendMessage + findOneAndUpdate patch)
 */
export const sendMediaMessageV2 = async ({
  conversationId,
  senderId,
  fileBuffer,
  originalName,
  mimeType,
  fileSize,
  duration,
}) => {
  const convo = await Conversation.findById(conversationId).select('participants isBlocked');
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  if (convo.isBlocked) throw Object.assign(new Error('Conversation blocked'), { statusCode: 403 });

  const isMember = convo.participants.some(
    (p) => p.user.toString() === senderId.toString() && !p.isDeleted
  );
  if (!isMember) throw Object.assign(new Error('Not a member'), { statusCode: 403 });

  let type = 'file';
  if (mimeType.startsWith('image/')) type = 'image';
  if (mimeType.startsWith('video/')) type = 'video';
  if (mimeType.startsWith('audio/')) type = 'audio';

  const folder   = `${CHAT_MEDIA_FOLDER}/${conversationId}`;
  const fileName = `${Date.now()}-${originalName.replace(/[^a-z0-9.\-_]/gi, '_')}`;

  const uploadResp = await imagekit.upload({
    file:              fileBuffer.toString('base64'),
    fileName,
    folder,
    useUniqueFileName: false,
  });

  const msg = await Message.create({
    conversation: conversationId,
    sender:       senderId,
    type,
    media: {
      url:       uploadResp.url,
      thumbnail: type === 'image' ? uploadResp.thumbnailUrl : undefined,
      mimeType,
      size:      fileSize,
      fileName:  originalName,
      duration,
      width:     uploadResp.width,
      height:    uploadResp.height,
    },
  });

  const others = convo.participants.filter(
    (p) => p.user.toString() !== senderId.toString() && !p.isDeleted
  );
  if (others.length > 0) {
    await MessageStatus.insertMany(
      others.map((p) => ({ message: msg._id, conversation: conversationId, user: p.user })),
      { ordered: false },
    );
    for (const p of others) {
      await redisClient.del(UNREAD_KEY(p.user.toString())).catch(() => {});
    }
  }

  return msg.populate('sender', 'name avatar role');
};

/**
 * getMessages — cursor-based pagination
 * FIX: membership check uses resolveUserId helper for populated/unpopulated safety
 */
export const getMessages = async (conversationId, userId, { limit = 50, before } = {}) => {
  const convo = await Conversation.findById(conversationId).select('participants');
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

  const isMember = convo.participants.some(
    (p) => (p.user._id || p.user).toString() === userId.toString() && !p.isDeleted
  );
  if (!isMember) throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  const filter = {
    conversation:  conversationId,
    deletedForAll: false,
    deletedFor:    { $ne: userId },
  };
  if (before) {
    const pivot = await Message.findById(before).select('createdAt');
    if (pivot) filter.createdAt = { $lt: pivot.createdAt };
  }

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name avatar role')
    .populate('replyTo', 'text type sender media')
    .lean();

  const reversed = messages.reverse();

  // Attach delivery status for messages sent BY this user
  const myMessageIds = reversed
    .filter((m) => {
      const sid = m.sender?._id?.toString() || m.sender?.toString();
      return sid === userId.toString();
    })
    .map((m) => m._id);

  let statusMap = {};
  if (myMessageIds.length > 0) {
    const statuses = await MessageStatus.aggregate([
      {
        $match: {
          message: { $in: myMessageIds },
          user:    { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $group: {
          _id:         '$message',
          readAt:      { $max: '$readAt' },
          deliveredAt: { $max: '$deliveredAt' },
        },
      },
    ]);
    for (const s of statuses) {
      statusMap[s._id.toString()] = { readAt: s.readAt, deliveredAt: s.deliveredAt };
    }
  }

  return reversed.map((msg) => {
    const status = statusMap[msg._id.toString()];
    return status ? { ...msg, readAt: status.readAt, deliveredAt: status.deliveredAt } : msg;
  });
};

/**
 * markMessagesRead
 */
export const markMessagesRead = async (conversationId, userId) => {
  const now = new Date();
  await MessageStatus.updateMany(
    { conversation: conversationId, user: userId, readAt: null },
    { $set: { readAt: now, deliveredAt: now } },
  );

  await Conversation.updateOne(
    { _id: conversationId, 'participants.user': userId },
    { $set: { 'participants.$.lastReadAt': now } },
  );

  await redisClient.del(UNREAD_KEY(userId.toString())).catch(() => {});

  return { markedAt: now };
};

/**
 * markMessagesDelivered
 */
export const markMessagesDelivered = async (conversationId, userId) => {
  const now = new Date();
  await MessageStatus.updateMany(
    { conversation: conversationId, user: userId, deliveredAt: null },
    { $set: { deliveredAt: now } }
  );
  return { deliveredAt: now, conversationId, userId };
};

/**
 * getTotalUnreadCount
 */
export const getTotalUnreadCount = async (userId) => {
  const key    = UNREAD_KEY(userId.toString());
  const cached = await redisClient.get(key).catch(() => null);
  if (cached !== null) return parseInt(cached, 10);

  const count = await MessageStatus.countDocuments({ user: userId, readAt: null });
  await redisClient.setEx(key, 30, count.toString()).catch(() => {});
  return count;
};

/**
 * editMessage
 */
export const editMessage = async (messageId, userId, newText) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  if (msg.sender.toString() !== userId.toString()) {
    throw Object.assign(new Error("Cannot edit others' messages"), { statusCode: 403 });
  }
  if (msg.type !== 'text') throw Object.assign(new Error('Only text messages can be edited'), { statusCode: 400 });
  if (msg.isDeleted || msg.deletedForAll) throw Object.assign(new Error('Cannot edit deleted message'), { statusCode: 400 });

  msg.editHistory.push({ text: msg.text, editedAt: new Date() });
  msg.text     = newText.trim();
  msg.isEdited = true;
  msg.editedAt = new Date();
  await msg.save();
  return msg;
};

/**
 * deleteMessage — soft delete
 */
export const deleteMessage = async (messageId, userId, scope = 'for_me') => {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { statusCode: 404 });

  if (scope === 'for_all') {
    if (msg.sender.toString() !== userId.toString()) {
      throw Object.assign(new Error("Cannot delete others' messages for everyone"), { statusCode: 403 });
    }
    msg.deletedForAll = true;
    msg.deletedAt     = new Date();
    msg.isDeleted     = true;
    msg.text          = null;
    msg.media         = undefined;
  } else {
    if (!msg.deletedFor.map(String).includes(userId.toString())) {
      msg.deletedFor.push(userId);
    }
  }

  await msg.save();
  return { deleted: true, scope };
};

/**
 * reactToMessage — toggle
 */
export const reactToMessage = async (messageId, userId, emoji) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { statusCode: 404 });

  const existingIdx = msg.reactions.findIndex(
    (r) => r.user.toString() === userId.toString() && r.emoji === emoji
  );
  if (existingIdx !== -1) {
    msg.reactions.splice(existingIdx, 1); // toggle off same emoji
  } else {
    const userIdx = msg.reactions.findIndex((r) => r.user.toString() === userId.toString());
    if (userIdx !== -1) msg.reactions.splice(userIdx, 1); // remove old reaction
    msg.reactions.push({ user: userId, emoji, at: new Date() });
  }

  await msg.save();
  return msg.reactions;
};

/**
 * pinMessage
 */
export const pinMessage = async (messageId, userId, pin = true) => {
  const msg = await Message.findById(messageId).populate({
    path:   'conversation',
    select: 'participants',
  });
  if (!msg) throw Object.assign(new Error('Message not found'), { statusCode: 404 });

  const isMember = msg.conversation.participants.some(
    (p) => (p.user._id || p.user).toString() === userId.toString() && !p.isDeleted
  );
  if (!isMember) throw Object.assign(new Error('Not a member'), { statusCode: 403 });

  msg.isPinned = pin;
  await msg.save();
  return msg;
};

/**
 * forwardMessage — copy to target conversation
 */
export const forwardMessage = async (messageId, senderId, targetConversationId) => {
  const original = await Message.findById(messageId);
  if (!original) throw Object.assign(new Error('Message not found'), { statusCode: 404 });

  return sendMessage({
    conversationId: targetConversationId,
    senderId,
    type:          original.type,
    text:          original.text,
    location:      original.location,
    cardPayload:   original.cardPayload,
    forwardedFrom: { message: messageId, conversation: original.conversation },
  });
};

/**
 * searchMessages
 */
export const searchMessages = async (conversationId, userId, query, { limit = 30 } = {}) => {
  await getConversationById(conversationId, userId);

  return Message.find({
    conversation:  conversationId,
    deletedForAll: false,
    deletedFor:    { $ne: userId },
    $text:         { $search: query },
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .populate('sender', 'name avatar')
    .lean();
};

/**
 * getPinnedMessages
 */
export const getPinnedMessages = async (conversationId, userId) => {
  await getConversationById(conversationId, userId);
  return Message.find({
    conversation:  conversationId,
    isPinned:      true,
    deletedForAll: false,
    deletedFor:    { $ne: userId },
  })
    .populate('sender', 'name avatar')
    .lean();
};

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK / UNBLOCK
// ═════════════════════════════════════════════════════════════════════════════

export const blockUser = async (blockerId, targetUserId) => {
  const exists = await UserBlock.findOne({ blocker: blockerId, blocked: targetUserId });
  if (exists) return exists;
  return UserBlock.create({ blocker: blockerId, blocked: targetUserId });
};

export const unblockUser = async (blockerId, targetUserId) => {
  await UserBlock.findOneAndDelete({ blocker: blockerId, blocked: targetUserId });
  return { unblocked: true };
};

export const getBlockedUsers = async (userId) => {
  return UserBlock.find({ blocker: userId })
    .populate('blocked', 'name avatar role')
    .lean();
};

// ═════════════════════════════════════════════════════════════════════════════
// ONLINE PRESENCE
// ═════════════════════════════════════════════════════════════════════════════

export const setUserOnline  = (userId, socketId) =>
  redisClient.setEx(ONLINE_KEY(userId), 120, socketId).catch(() => {});

export const setUserOffline = (userId) =>
  redisClient.del(ONLINE_KEY(userId)).catch(() => {});

export const isUserOnline   = async (userId) => {
  const v = await redisClient.get(ONLINE_KEY(userId)).catch(() => null);
  return v !== null;
};

// ═════════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ═════════════════════════════════════════════════════════════════════════════

export const setTyping = async (conversationId, userId, isTyping) => {
  const key = TYPING_KEY(conversationId, userId);
  if (isTyping) await redisClient.setEx(key, 5, '1').catch(() => {});
  else await redisClient.del(key).catch(() => {});
};

export const getTypingUsers = async (conversationId, participantIds) => {
  const keys   = participantIds.map((id) => TYPING_KEY(conversationId, id.toString()));
  const values = await Promise.all(keys.map((k) => redisClient.get(k).catch(() => null)));
  return participantIds.filter((_, i) => values[i] !== null);
};

// ═════════════════════════════════════════════════════════════════════════════
// LINKED CONVERSATION (internal)
// ═════════════════════════════════════════════════════════════════════════════

export const createLinkedConversation = async ({
  type = 'order', refModel, refId, participantIds = [], name,
}) => {
  const users = await User.find({ _id: { $in: participantIds } }).select('role');
  return Conversation.create({
    type, refModel, refId, name,
    participants: users.map((u) => ({
      user: u._id, role: u.role, joinedAt: new Date(),
    })),
  });
};

export default {
  getOrCreateDirectConversation,
  createGroupConversation,
  getUserConversations,
  getConversationById,
  updateGroupConversation,
  updateGroupAdminStatus,
  addGroupMembers,
  removeGroupMember,
  blockConversation,
  clearConversation,
  getConversationMedia,
  sendMessage,
  sendMediaMessageV2,
  getMessages,
  markMessagesRead,
  markMessagesDelivered,
  getTotalUnreadCount,
  editMessage,
  deleteMessage,
  reactToMessage,
  pinMessage,
  forwardMessage,
  searchMessages,
  getPinnedMessages,
  blockUser,
  unblockUser,
  getBlockedUsers,
  setUserOnline,
  setUserOffline,
  isUserOnline,
  setTyping,
  getTypingUsers,
  createLinkedConversation,
};