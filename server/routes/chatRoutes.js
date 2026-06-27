 

import express from 'express';
import multer  from 'multer';

import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler            from '../utils/asyncHandler.js';
import chatService             from '../services/chatService.js';
import agoraService             from '../services/chat/agoraService.js';
import { Call, Conversation, Message } from '../models/chat.js';

const router = express.Router();

// ─── Multer — in-memory for ImageKit upload ───────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // FIX: pass an Error so multer surfaces it via next(err) instead of
      // silently dropping req.file and producing a misleading "No file uploaded".
      return cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { statusCode: 400 }));
    }
    cb(null, true);
  },
});

// ─── Shorthand middleware combos ─────────────────────────────────────────────
const auth        = [protect];
const adminOnly   = [protect, authorize('superadmin', 'admin')];
const staffRoles  = [protect, authorize('superadmin', 'admin', 'doctor', 'hospital', 'pharmacy', 'lab_partner', 'blood_bank', 'care_assistant', 'finance')];

// ═════════════════════════════════════════════════════════════════════════════
// ── A. CONVERSATIONS ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/conversations
 * Query: ?page=1&limit=20&type=direct|group|order|service|support
 */
router.get(
  '/conversations',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const result = await chatService.getUserConversations(req.user._id, {
      page:  parseInt(page,  10),
      limit: parseInt(limit, 10),
      type,
    });
    res.json({ success: true, ...result });
  }),
);

/**
 * POST /api/chat/conversations/direct
 * Body: { targetUserId }
 */
router.post(
  '/conversations/direct',
  auth,
  asyncHandler(async (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId required' });

    const convo = await chatService.getOrCreateDirectConversation(req.user._id, targetUserId);
    res.status(201).json({ success: true, conversation: convo });
  }),
);

/**
 * POST /api/chat/conversations/group
 * Body: { name, description?, memberIds[] }
 */
router.post(
  '/conversations/group',
  auth,
  asyncHandler(async (req, res) => {
    const { name, description, memberIds = [] } = req.body;
    const convo = await chatService.createGroupConversation({
      creatorId: req.user._id,
      name,
      description,
      memberIds,
      type: 'group',
    });
    res.status(201).json({ success: true, conversation: convo });
  }),
);

/**
 * POST /api/chat/conversations/linked
 * Roles: admin, doctor, hospital, pharmacy, lab_partner, blood_bank, care_assistant, finance
 * Body: { type, refModel, refId, participantIds[], name? }
 */
router.post(
  '/conversations/linked',
  staffRoles,
  asyncHandler(async (req, res) => {
    const { type, refModel, refId, participantIds, name } = req.body;
    const convo = await chatService.createLinkedConversation({ type, refModel, refId, participantIds, name });
    res.status(201).json({ success: true, conversation: convo });
  }),
);

/**
 * GET /api/chat/conversations/:conversationId
 */
router.get(
  '/conversations/:conversationId',
  auth,
  asyncHandler(async (req, res) => {
    const convo = await chatService.getConversationById(req.params.conversationId, req.user._id);
    res.json({ success: true, conversation: convo });
  }),
);

/**
 * PATCH /api/chat/conversations/:conversationId
 * Body: { name?, description?, avatar? }
 */
router.patch(
  '/conversations/:conversationId',
  auth,
  asyncHandler(async (req, res) => {
    const convo = await chatService.updateGroupConversation(req.params.conversationId, req.user._id, req.body);
    res.json({ success: true, conversation: convo });
  }),
);

/**
 * POST /api/chat/conversations/:conversationId/members
 * Body: { memberIds[] }
 */
router.post(
  '/conversations/:conversationId/members',
  auth,
  asyncHandler(async (req, res) => {
    const convo = await chatService.addGroupMembers(req.params.conversationId, req.user._id, req.body.memberIds || []);
    res.json({ success: true, conversation: convo });
  }),
);

/**
 * DELETE /api/chat/conversations/:conversationId/members/:memberId
 */
router.delete(
  '/conversations/:conversationId/members/:memberId',
  auth,
  asyncHandler(async (req, res) => {
    const convo = await chatService.removeGroupMember(req.params.conversationId, req.user._id, req.params.memberId);
    res.json({ success: true, conversation: convo });
  }),
);

/**
 * POST /api/chat/conversations/:conversationId/block
 */
router.post(
  '/conversations/:conversationId/block',
  auth,
  asyncHandler(async (req, res) => {
    const convo = await chatService.blockConversation(req.params.conversationId, req.user._id);
    res.json({ success: true, conversation: convo });
  }),
);

/**
 * PATCH /api/chat/conversations/:conversationId/archive
 * Body: { archive: true|false }
 */
router.patch(
  '/conversations/:conversationId/archive',
  auth,
  asyncHandler(async (req, res) => {
    const { archive = true } = req.body;
    await Conversation.updateOne(
      { _id: req.params.conversationId, 'participants.user': req.user._id },
      { $set: { 'participants.$.isArchived': archive } },
    );
    res.json({ success: true, archived: archive });
  }),
);

/**
 * PATCH /api/chat/conversations/:conversationId/mute
 * Body: { mute: true|false, mutedUntil?: ISO date }
 */
router.patch(
  '/conversations/:conversationId/mute',
  auth,
  asyncHandler(async (req, res) => {
    const { mute = true, mutedUntil } = req.body;
    await Conversation.updateOne(
      { _id: req.params.conversationId, 'participants.user': req.user._id },
      {
        $set: {
          'participants.$.isMuted':    mute,
          'participants.$.mutedUntil': mute && mutedUntil ? new Date(mutedUntil) : null,
        },
      },
    );
    res.json({ success: true, muted: mute });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── B. MESSAGES ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/conversations/:conversationId/messages
 * Query: ?limit=50&before=<messageId>
 */
router.get(
  '/conversations/:conversationId/messages',
  auth,
  asyncHandler(async (req, res) => {
    const { limit = 50, before } = req.query;
    const messages = await chatService.getMessages(req.params.conversationId, req.user._id, {
      limit: parseInt(limit, 10), before,
    });
    res.json({ success: true, messages });
  }),
);

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Body: { type, text?, location?, cardPayload?, replyTo? }
 */
router.post(
  '/conversations/:conversationId/messages',
  auth,
  asyncHandler(async (req, res) => {
    const { type = 'text', text, location, cardPayload, replyTo } = req.body;
    const msg = await chatService.sendMessage({
      conversationId: req.params.conversationId,
      senderId:       req.user._id,
      type, text, location, cardPayload, replyTo,
    });
    res.status(201).json({ success: true, message: msg });
  }),
);

/**
 * POST /api/chat/conversations/:conversationId/messages/media
 * Multipart: field name = 'file'
 */
router.post(
  '/conversations/:conversationId/messages/media',
  auth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const msg = await chatService.sendMediaMessageV2({
      conversationId: req.params.conversationId,
      senderId:       req.user._id,
      fileBuffer:     req.file.buffer,
      originalName:   req.file.originalname,
      mimeType:       req.file.mimetype,
      fileSize:       req.file.size,
      duration:       req.body.duration ? parseFloat(req.body.duration) : undefined,
    });
    res.status(201).json({ success: true, message: msg });
  }),
);

/**
 * POST /api/chat/conversations/:conversationId/messages/read
 */
router.post(
  '/conversations/:conversationId/messages/read',
  auth,
  asyncHandler(async (req, res) => {
    const result = await chatService.markMessagesRead(req.params.conversationId, req.user._id);
    res.json({ success: true, ...result });
  }),
);

/**
 * POST /api/chat/conversations/:conversationId/messages/delivered
 */
router.post(
  '/conversations/:conversationId/messages/delivered',
  auth,
  asyncHandler(async (req, res) => {
    const result = await chatService.markMessagesDelivered(req.params.conversationId, req.user._id);
    res.json({ success: true, ...result });
  }),
);

/**
 * GET /api/chat/conversations/:conversationId/messages/pinned
 */
router.get(
  '/conversations/:conversationId/messages/pinned',
  auth,
  asyncHandler(async (req, res) => {
    const messages = await chatService.getPinnedMessages(req.params.conversationId, req.user._id);
    res.json({ success: true, messages });
  }),
);

/**
 * GET /api/chat/conversations/:conversationId/messages/search
 * Query: ?q=search+term&limit=30
 */
router.get(
  '/conversations/:conversationId/messages/search',
  auth,
  asyncHandler(async (req, res) => {
    const { q, limit = 30 } = req.query;
    if (!q?.trim()) return res.status(400).json({ success: false, message: 'Query required' });

    const messages = await chatService.searchMessages(req.params.conversationId, req.user._id, q, {
      limit: parseInt(limit, 10),
    });
    res.json({ success: true, messages });
  }),
);

/**
 * GET /api/chat/conversations/:conversationId/media
 * Query: ?page=1&limit=50&type=image|video|file
 */
router.get(
  '/conversations/:conversationId/media',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, type } = req.query;
    const mediaMessages = await chatService.getConversationMedia(req.params.conversationId, req.user._id, {
      page: parseInt(page, 10), limit: parseInt(limit, 10), type,
    });
    res.json({ success: true, messages: mediaMessages });
  }),
);

/**
 * DELETE /api/chat/conversations/:conversationId/clear
 */
router.delete(
  '/conversations/:conversationId/clear',
  auth,
  asyncHandler(async (req, res) => {
    const result = await chatService.clearConversation(req.params.conversationId, req.user._id);
    res.json(result);
  }),
);

/**
 * PATCH /api/chat/conversations/:conversationId/members/:memberId/admin
 * Body: { isAdmin: true|false }
 */
router.patch(
  '/conversations/:conversationId/members/:memberId/admin',
  auth,
  asyncHandler(async (req, res) => {
    const { isAdmin } = req.body;
    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isAdmin boolean is required' });
    }
    const convo = await chatService.updateGroupAdminStatus(
      req.params.conversationId, req.user._id, req.params.memberId, isAdmin,
    );
    res.json({ success: true, conversation: convo });
  }),
);

/**
 * PATCH /api/chat/messages/:messageId
 * Body: { text }
 */
router.patch(
  '/messages/:messageId',
  auth,
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'text required' });

    const msg = await chatService.editMessage(req.params.messageId, req.user._id, text);
    res.json({ success: true, message: msg });
  }),
);

/**
 * DELETE /api/chat/messages/:messageId
 * Body: { scope: 'for_me' | 'for_all' }
 */
router.delete(
  '/messages/:messageId',
  auth,
  asyncHandler(async (req, res) => {
    const scope  = req.body.scope || 'for_me';
    const result = await chatService.deleteMessage(req.params.messageId, req.user._id, scope);
    res.json({ success: true, ...result });
  }),
);

/**
 * DELETE /api/chat/messages/:messageId/admin
 * Roles: superadmin, admin
 */
router.delete(
  '/messages/:messageId/admin',
  adminOnly,
  asyncHandler(async (req, res) => {
    await Message.findByIdAndUpdate(req.params.messageId, {
      deletedForAll: true,
      isDeleted:     true,
      deletedAt:     new Date(),
      text:          null,
      media:         null,
    });
    res.json({ success: true, deleted: true });
  }),
);

/**
 * POST /api/chat/messages/:messageId/react
 * Body: { emoji }
 */
router.post(
  '/messages/:messageId/react',
  auth,
  asyncHandler(async (req, res) => {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'emoji required' });

    const reactions = await chatService.reactToMessage(req.params.messageId, req.user._id, emoji);
    res.json({ success: true, reactions });
  }),
);

/**
 * PATCH /api/chat/messages/:messageId/pin
 * Body: { pin: true|false }
 */
router.patch(
  '/messages/:messageId/pin',
  auth,
  asyncHandler(async (req, res) => {
    const { pin = true } = req.body;
    const msg = await chatService.pinMessage(req.params.messageId, req.user._id, pin);
    res.json({ success: true, message: msg });
  }),
);

/**
 * POST /api/chat/messages/:messageId/forward
 * Body: { targetConversationId }
 */
router.post(
  '/messages/:messageId/forward',
  auth,
  asyncHandler(async (req, res) => {
    const { targetConversationId } = req.body;
    if (!targetConversationId) {
      return res.status(400).json({ success: false, message: 'targetConversationId required' });
    }
    const msg = await chatService.forwardMessage(req.params.messageId, req.user._id, targetConversationId);
    res.status(201).json({ success: true, message: msg });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── C. UNREAD COUNT ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  '/unread',
  auth,
  asyncHandler(async (req, res) => {
    const count = await chatService.getTotalUnreadCount(req.user._id);
    res.json({ success: true, unreadCount: count });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── D. BLOCK / UNBLOCK USERS ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  '/blocked-users',
  auth,
  asyncHandler(async (req, res) => {
    const list = await chatService.getBlockedUsers(req.user._id);
    res.json({ success: true, blockedUsers: list });
  }),
);

router.post(
  '/blocked-users',
  auth,
  asyncHandler(async (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId required' });

    const block = await chatService.blockUser(req.user._id, targetUserId);
    res.status(201).json({ success: true, block });
  }),
);

router.delete(
  '/blocked-users/:targetUserId',
  auth,
  asyncHandler(async (req, res) => {
    const result = await chatService.unblockUser(req.user._id, req.params.targetUserId);
    res.json({ success: true, ...result });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── E. AGORA / CALLS ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/agora/rtm-token
 * FIX: appId now comes from agoraService response, not a separate
 * agora.config.js file (removed).
 */
router.get(
  '/agora/rtm-token',
  auth,
  asyncHandler(async (req, res) => {
    const result = await agoraService.generateRtmToken(req.user._id);
    res.json({
      success:   true,
      appId:     result.appId,
      uid:       req.user._id.toString(),
      rtmToken:  result.token,
      expiresAt: result.expiresAt,
    });
  }),
);

/**
 * POST /api/chat/calls
 * Body: { conversationId, type: 'audio'|'video' }
 */
router.post(
  '/calls',
  auth,
  asyncHandler(async (req, res) => {
    const { conversationId, type = 'audio' } = req.body;
    if (!conversationId) return res.status(400).json({ success: false, message: 'conversationId required' });

    const convo = await Conversation.findById(conversationId).select('participants');
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const isMember = convo.participants.some(
      (p) => p.user.toString() === req.user._id.toString() && !p.isDeleted,
    );
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member of this conversation' });

    const invitedIds = convo.participants
      .filter((p) => p.user.toString() !== req.user._id.toString() && !p.isDeleted)
      .map((p) => p.user.toString());

    const result = await agoraService.initiateCall({
      conversationId,
      initiatorId:    req.user._id,
      type,
      invitedUserIds: invitedIds,
    });

    res.status(201).json({
      success:     true,
      callId:      result.call._id,
      channelName: result.channelName,
      token:       result.token,
      uid:         result.uid,
      appId:       result.appId,
      expiresAt:   result.expiresAt,
    });
  }),
);

/**
 * POST /api/chat/calls/:callId/join
 */
router.post(
  '/calls/:callId/join',
  auth,
  asyncHandler(async (req, res) => {
    const result = await agoraService.joinCall(req.params.callId, req.user._id);
    res.json({
      success:     true,
      callId:      result.call._id,
      channelName: result.channelName,
      token:       result.token,
      uid:         result.uid,
      appId:       result.appId,
      expiresAt:   result.expiresAt,
    });
  }),
);

/**
 * POST /api/chat/calls/:callId/end
 * Body: { status: 'ended'|'declined'|'cancelled' }
 */
router.post(
  '/calls/:callId/end',
  auth,
  asyncHandler(async (req, res) => {
    const status = req.body.status || 'ended';
    const call   = await agoraService.endCall(req.params.callId, req.user._id, status);
    res.json({ success: true, callId: call._id, status: call.status, duration: call.duration });
  }),
);

/**
 * POST /api/chat/calls/:callId/token/refresh
 */
router.post(
  '/calls/:callId/token/refresh',
  auth,
  asyncHandler(async (req, res) => {
    const result = await agoraService.refreshCallToken(req.params.callId, req.user._id);
    res.json({ success: true, ...result });
  }),
);

/**
 * GET /api/chat/calls/:callId
 */
router.get(
  '/calls/:callId',
  auth,
  asyncHandler(async (req, res) => {
    const call = await Call.findById(req.params.callId)
      .populate('participants.user', 'name avatar role')
      .populate('initiator', 'name avatar role');

    if (!call) return res.status(404).json({ success: false, message: 'Call not found' });

    const isParticipant = call.participants.some((p) => p.user._id.toString() === req.user._id.toString());
    if (!isParticipant && !['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, call });
  }),
);

/**
 * GET /api/chat/calls
 * Query: ?limit=20&page=1&status=ended|missed|declined
 */
router.get(
  '/calls',
  auth,
  asyncHandler(async (req, res) => {
    const { limit = 20, page = 1, status } = req.query;
    const skip   = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const filter = { 'participants.user': req.user._id };
    if (status) filter.status = status;

    const [calls, total] = await Promise.all([
      Call.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('initiator', 'name avatar role')
        .populate('participants.user', 'name avatar role')
        .lean(),
      Call.countDocuments(filter),
    ]);

    res.json({ success: true, calls, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  }),
);

// ─── Admin: all calls ─────────────────────────────────────────────────────────

router.get(
  '/admin/calls',
  adminOnly,
  asyncHandler(async (req, res) => {
    const { limit = 50, page = 1, status } = req.query;
    const skip   = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const filter = status ? { status } : {};

    const [calls, total] = await Promise.all([
      Call.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('initiator', 'name avatar role')
        .lean(),
      Call.countDocuments(filter),
    ]);
    res.json({ success: true, calls, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  }),
);

// ─── Admin: all conversations ─────────────────────────────────────────────────

router.get(
  '/admin/conversations',
  adminOnly,
  asyncHandler(async (req, res) => {
    const { type, refModel, refId, limit = 50, page = 1 } = req.query;
    const skip   = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const filter = {};
    if (type)     filter.type     = type;
    if (refModel) filter.refModel = refModel;
    if (refId)    filter.refId    = refId;

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('participants.user', 'name avatar role')
        .lean(),
      Conversation.countDocuments(filter),
    ]);
    res.json({ success: true, conversations, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  }),
);

router.get(
  '/admin/conversations/:conversationId/messages',
  adminOnly,
  asyncHandler(async (req, res) => {
    const { limit = 100, before } = req.query;
    const filter = { conversation: req.params.conversationId, deletedForAll: false };
    if (before) {
      const pivot = await Message.findById(before).select('createdAt');
      if (pivot) filter.createdAt = { $lt: pivot.createdAt };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .populate('sender', 'name avatar role')
      .lean();

    res.json({ success: true, messages: messages.reverse() });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── F. AGORA WEBHOOK  (Agora → Server) ───────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/agora/webhook
 * Signature verification via HMAC-SHA1 (header: Agora-Signature).
 * IMPORTANT: requires raw body — see file header note on express.json() ordering.
 */
router.post(
  '/agora/webhook',
  express.raw({ type: '*/*' }),
  asyncHandler(async (req, res) => {
    const sig = req.headers['agora-signature'];
    if (!sig) return res.status(401).json({ message: 'Missing signature' });

    const rawBody = req.body; // Buffer (express.raw)
    const valid   = agoraService.verifyAgoraWebhook(rawBody, sig);
    if (!valid) return res.status(401).json({ message: 'Invalid signature' });

    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ message: 'Invalid JSON' });
    }

    await agoraService.handleAgoraChannelEvent(payload);
    res.json({ success: true });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── G. PRESENCE ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  '/presence/:userId',
  auth,
  asyncHandler(async (req, res) => {
    const isOnline = await chatService.isUserOnline(req.params.userId);
    const User     = (await import('../models/User.js')).default;
    const user     = await User.findById(req.params.userId).select('lastseen').lean();
    res.json({ success: true, userId: req.params.userId, isOnline, lastseen: user?.lastseen });
  }),
);

/**
 * POST /api/chat/presence/bulk
 * Body: { userIds: [] }
 */
router.post(
  '/presence/bulk',
  auth,
  asyncHandler(async (req, res) => {
    const { userIds = [] } = req.body;
    const results = await Promise.all(
      userIds.map(async (id) => ({ userId: id, isOnline: await chatService.isUserOnline(id) })),
    );
    res.json({ success: true, presence: results });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── H. ROLE-SPECIFIC CONVERSATION LOOKUPS ────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  '/order/:orderId/conversation',
  [protect, authorize('superadmin', 'admin', 'customer', 'pharmacy', 'driver', 'solodriverpartner', 'transportpartner', 'care_assistant')],
  asyncHandler(async (req, res) => {
    const convo = await Conversation.findOne({
      refModel: 'Order',
      refId:    req.params.orderId,
      'participants.user': req.user._id,
    })
      .populate('participants.user', 'name avatar role')
      .lean();

    if (!convo) return res.status(404).json({ success: false, message: 'No conversation for this order' });
    res.json({ success: true, conversation: convo });
  }),
);

router.get(
  '/booking/:bookingId/conversation',
  [protect, authorize('superadmin', 'admin', 'customer', 'doctor', 'hospital', 'care_assistant')],
  asyncHandler(async (req, res) => {
    const convo = await Conversation.findOne({
      refModel: 'Booking',
      refId:    req.params.bookingId,
      'participants.user': req.user._id,
    })
      .populate('participants.user', 'name avatar role')
      .lean();

    if (!convo) return res.status(404).json({ success: false, message: 'No conversation for this booking' });
    res.json({ success: true, conversation: convo });
  }),
);

router.get(
  '/blood-request/:requestId/conversation',
  [protect, authorize('superadmin', 'admin', 'customer', 'blood_bank')],
  asyncHandler(async (req, res) => {
    const convo = await Conversation.findOne({
      refModel: 'BloodRequest',
      refId:    req.params.requestId,
      'participants.user': req.user._id,
    })
      .populate('participants.user', 'name avatar role')
      .lean();

    if (!convo) return res.status(404).json({ success: false, message: 'No conversation for this request' });
    res.json({ success: true, conversation: convo });
  }),
);

router.get(
  '/lab-test/:testId/conversation',
  [protect, authorize('superadmin', 'admin', 'customer', 'lab_partner')],
  asyncHandler(async (req, res) => {
    const convo = await Conversation.findOne({
      refModel: 'LabTest',
      refId:    req.params.testId,
      'participants.user': req.user._id,
    })
      .populate('participants.user', 'name avatar role')
      .lean();

    if (!convo) return res.status(404).json({ success: false, message: 'No conversation for this test' });
    res.json({ success: true, conversation: convo });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── I. FINANCE READ-ONLY ACCESS ──────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  '/finance/order/:orderId/conversation',
  [protect, authorize('superadmin', 'admin', 'finance')],
  asyncHandler(async (req, res) => {
    const convo = await Conversation.findOne({ refModel: 'Order', refId: req.params.orderId })
      .populate('participants.user', 'name avatar role')
      .lean();

    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found' });
    res.json({ success: true, conversation: convo });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// ── MULTER ERROR HANDLER (must be last, after all routes using `upload`) ─────
// FIX: previously absent — rejected uploads (size limit, bad mimetype) fell
// through to the generic Express error handler with no clean shape. Now
// caught explicitly and returned as 400 with the real reason.
// ═════════════════════════════════════════════════════════════════════════════

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.statusCode === 400) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

export default router;