/**
 * chatRouter.js — Patched Version
 *
 * Changes vs previous version:
 *  1.  POST /messages          → sticker payload (Giphy) support
 *  2.  POST /messages/recording → NEW — upload voice/video recording (multipart)
 *  3.  POST /call/initiate      → mediaConstraints support; emits to online users
 *  4.  POST /messages/forward   → forwards sticker.sticker field too
 */

import express               from 'express';
import multer                from 'multer';
import ImageKit              from 'imagekit';
import mongoose              from 'mongoose';
import path                  from 'path';

import { protect, authorize } from '../middleware/authMiddleware.js';
import User                   from '../models/User.js';
import Conversation           from '../models/Conversation.js';
import Message                from '../models/Message.js';
import Notification           from '../models/Notification.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX     = 100;
const MAX_FILE_SIZE     = 100 * 1024 * 1024; // 100 MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
];
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'audio/aac', 'audio/mp4', 'audio/x-m4a',
];
const ALLOWED_RECORDING_TYPES = [
  'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4',
  'audio/mpeg', 'audio/aac', 'audio/x-m4a',
  'video/webm', 'video/mp4',
];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

// ─────────────────────────────────────────────────────────────────────────────
// IMAGEKIT CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED LOGGER
// ─────────────────────────────────────────────────────────────────────────────

const log = {
  info:  (ctx, msg, meta = {}) =>
    console.log(JSON.stringify({ level: 'info',  ctx, msg, ...meta, ts: new Date().toISOString() })),
  warn:  (ctx, msg, meta = {}) =>
    console.warn(JSON.stringify({ level: 'warn', ctx, msg, ...meta, ts: new Date().toISOString() })),
  error: (ctx, msg, meta = {}) =>
    console.error(JSON.stringify({ level: 'error', ctx, msg, ...meta, ts: new Date().toISOString() })),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function getPagination(query) {
  const page  = Math.max(1, parseInt(query.page  || 1,  10));
  const limit = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, parseInt(query.limit || PAGE_SIZE_DEFAULT, 10))
  );
  return { page, limit, skip: (page - 1) * limit };
}

const ok   = (res, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

const fail = (res, message = 'Internal error', statusCode = 400, extra = {}) =>
  res.status(statusCode).json({ success: false, message, ...extra });

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getIO = (req) => req.app.get('io');

async function uploadToImageKit(buffer, fileName, folder) {
  return imagekit.upload({
    file:              buffer.toString('base64'),
    fileName,
    folder:            `/Likeson/${folder}`,
    useUniqueFileName: true,
  });
}

function classifyMime(mimeType) {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return { type: 'image', folder: 'chat/images' };
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return { type: 'video', folder: 'chat/videos' };
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return { type: 'audio', folder: 'chat/audio'  };
  return { type: 'file', folder: 'chat/files' };
}

function sanitiseLocation(raw) {
  if (!raw) return null;
  let latitude  = null;
  let longitude = null;
  let address   = raw.address || null;

  if (raw.latitude != null && raw.longitude != null) {
    latitude  = Number(raw.latitude);
    longitude = Number(raw.longitude);
  } else if (Array.isArray(raw.coordinates) && raw.coordinates.length === 2) {
    longitude = Number(raw.coordinates[0]);
    latitude  = Number(raw.coordinates[1]);
  }

  if (latitude == null || longitude == null)  return null;
  if (isNaN(latitude)  || isNaN(longitude))   return null;
  return { latitude, longitude, address };
}

async function pushNotification({ recipientId, title, body, type, screen, referenceId }) {
  try {
    await Notification.create({
      recipient:  recipientId,
      title,
      body,
      type:       type || 'Order_Update',
      priority:   'Medium',
      actionData: { screen, referenceId },
      channels:   [{ channel: 'InApp', status: 'Sent' }],
    });
  } catch (err) {
    log.error('pushNotification', err.message, { recipientId });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTER — in-memory, validate file type & size
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// Separate multer instance for recordings — allows recording mime types
const uploadRecording = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_RECORDING_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported recording type: ${file.mimetype}`));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE-LEVEL MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

const validateConvId = (req, res, next) => {
  if (!isValidId(req.params.conversationId))
    return fail(res, 'Invalid conversationId', 400);
  next();
};

const validateMsgId = (req, res, next) => {
  if (!isValidId(req.params.messageId))
    return fail(res, 'Invalid messageId', 400);
  next();
};

const requireParticipant = asyncHandler(async (req, res, next) => {
  const conv = await Conversation.findOne({
    _id:       req.params.conversationId,
    isDeleted: false,
  });

  if (!conv) return fail(res, 'Conversation not found', 404);

  const participant = conv.participants.find(
    (p) =>
      p.user.toString() === req.user._id.toString() &&
      p.isActive &&
      !p.leftAt
  );

  if (!participant)
    return fail(res, 'You are not a member of this conversation', 403);

  req.conversation = conv;
  req.participant  = participant;
  next();
});

const requireAdmin = (req, res, next) => {
  if (!['owner', 'admin'].includes(req.participant?.conversationRole))
    return fail(res, 'Admin or owner role required', 403);
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// ① CONVERSATION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/conversations',
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const userId = req.user._id;

    const matchFilter = {
      'participants.user':     userId,
      'participants.isActive': true,
      'participants.leftAt':   null,
      isDeleted: false,
    };

    if (req.query.type)                 matchFilter.type       = req.query.type;
    if (req.query.archived === 'true')  matchFilter.isArchived = true;
    if (req.query.archived === 'false') matchFilter.isArchived = false;

    const [conversations, total] = await Promise.all([
      Conversation.find(matchFilter)
        .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants.user', 'name avatar role isOnline lastseen')
        .populate('lastMessage.senderId', 'name avatar')
        .lean(),
      Conversation.countDocuments(matchFilter),
    ]);

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const myParticipant = conv.participants.find(
          (p) => p.user._id.toString() === userId.toString()
        );

        let unreadCount = 0;
        if (!myParticipant?.isMuted) {
          const lastReadId = myParticipant?.lastReadMessage;
          const query = {
            conversation: conv._id,
            isDeleted:    false,
            isScheduled:  false,
            sender:       { $ne: userId },
          };
          if (lastReadId) {
            const lastReadMsg = await Message.findById(lastReadId).select('createdAt').lean();
            if (lastReadMsg) query.createdAt = { $gt: lastReadMsg.createdAt };
          }
          unreadCount = await Message.countDocuments(query);
        }

        return { ...conv, unreadCount };
      })
    );

    return ok(res, {
      conversations: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.post(
  '/conversations',
  protect,
  asyncHandler(async (req, res) => {
    const { type = 'direct', name, description, participantIds = [] } = req.body;

    if (!Array.isArray(participantIds) || participantIds.length === 0)
      return fail(res, 'participantIds is required', 400);

    if (participantIds.some((id) => !isValidId(id)))
      return fail(res, 'One or more participantIds are invalid', 400);

    const allIds = [...new Set([req.user._id.toString(), ...participantIds])];
    const users  = await User.find({ _id: { $in: allIds } }).select('_id name').lean();
    if (users.length !== allIds.length)
      return fail(res, 'One or more users not found', 404);

    if (type === 'direct') {
      if (allIds.length !== 2)
        return fail(res, 'Direct conversation requires exactly 1 other participant', 400);

      const existing = await Conversation.findOne({
        type:      'direct',
        isDeleted: false,
        $and: allIds.map((id) => ({ 'participants.user': id })),
      }).lean();

      if (existing)
        return ok(res, { conversation: existing, alreadyExists: true });
    }

    if (['broadcast', 'group'].includes(type) && !name?.trim())
      return fail(res, 'name is required for group/broadcast conversations', 400);

    const participants = allIds.map((id, idx) => ({
      user:             id,
      conversationRole: idx === 0 ? 'owner' : 'member',
      joinedAt:         new Date(),
      addedBy:          req.user._id,
      isActive:         true,
    }));

    const conversation = await Conversation.create({
      type,
      name:        name?.trim()        || null,
      description: description?.trim() || null,
      participants,
      createdBy:   req.user._id,
    });

    const sysMsg = await Message.create({
      conversation: conversation._id,
      sender:       req.user._id,
      type:         'system',
      content:      `${req.user.name} created the conversation`,
      systemEvent:  { event: 'group_created', meta: { name: conversation.name } },
    });

    const io = getIO(req);
    if (io) {
      io.to(conversation._id.toString()).emit('conversation:created', {
        conversation,
        systemMessage: sysMsg,
      });
    }

    log.info('conversation:create', 'Conversation created', {
      conversationId: conversation._id, type, by: req.user._id,
    });

    return ok(res, { conversation }, 201);
  })
);

router.post(
  '/conversations/department',
  protect,
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { departmentRole, name, description } = req.body;

    const validRoles = [
      'superadmin', 'admin', 'doctor', 'transportpartner',
      'driver', 'lab partner', 'customer', 'finance',
      'pharmacy', 'care assistant',
    ];

    if (!departmentRole || !validRoles.includes(departmentRole))
      return fail(res, 'Valid departmentRole is required', 400);

    if (!name?.trim())
      return fail(res, 'name is required', 400);

    const existing = await Conversation.findOne({
      type:           'department',
      departmentRole,
      isDeleted:      false,
    }).lean();

    if (existing)
      return fail(res, `A department channel for ${departmentRole} already exists`, 409, { existing });

    const roleUsers    = await User.find({ role: departmentRole, isBlocked: false }).select('_id').lean();
    const allIds       = [req.user._id.toString(), ...roleUsers.map((u) => u._id.toString())];
    const uniqueIds    = [...new Set(allIds)];

    const participants = uniqueIds.map((id) => ({
      user:             id,
      conversationRole: id === req.user._id.toString() ? 'owner' : 'member',
      joinedAt:         new Date(),
      addedBy:          req.user._id,
      isActive:         true,
    }));

    const conversation = await Conversation.create({
      type:           'department',
      departmentRole,
      name:           name.trim(),
      description:    description?.trim() || null,
      participants,
      createdBy:      req.user._id,
    });

    await Message.create({
      conversation: conversation._id,
      sender:       req.user._id,
      type:         'system',
      content:      `${req.user.name} created the ${departmentRole} department channel`,
      systemEvent:  { event: 'group_created', meta: { name: conversation.name } },
    });

    return ok(res, { conversation, memberCount: participants.length }, 201);
  })
);

router.get(
  '/conversations/department/:role',
  protect,
  asyncHandler(async (req, res) => {
    const { role } = req.params;
    const userRole = req.user.role;
    const isAdmin  = ['superadmin', 'admin'].includes(userRole);

    if (!isAdmin && userRole !== role)
      return fail(res, 'Access denied to this department channel', 403);

    const conv = await Conversation.findOne({
      type:           'department',
      departmentRole: role,
      isDeleted:      false,
    })
      .populate('participants.user', 'name avatar role isOnline lastseen')
      .lean();

    if (!conv) return fail(res, 'Department channel not found', 404);
    return ok(res, { conversation: conv });
  })
);

router.get(
  '/conversations/partners',
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const { role, search }      = req.query;

    const filter = { _id: { $ne: req.user._id }, isBlocked: false };
    if (role)         filter.role = role;
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or  = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email phone avatar role isOnline lastseen')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return ok(res, {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.get(
  '/conversations/:conversationId',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const conv = await Conversation.findById(req.params.conversationId)
      .populate('participants.user', 'name avatar role isOnline lastseen')
      .populate('lastMessage.senderId', 'name avatar')
      .lean();
    return ok(res, { conversation: conv });
  })
);

router.patch(
  '/conversations/:conversationId',
  protect,
  validateConvId,
  requireParticipant,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const allowed = ['name', 'description', 'avatar', 'isReadOnly', 'isPinned'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0)
      return fail(res, 'No valid fields to update', 400);

    updates.updatedBy = req.user._id;

    const conv = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('conversation:updated', {
        conversationId: req.params.conversationId,
        updates,
        updatedBy: req.user._id,
      });
    }

    return ok(res, { conversation: conv });
  })
);

router.patch(
  '/conversations/:conversationId/archive',
  protect,
  validateConvId,
  requireParticipant,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { archive = true } = req.body;

    const conv = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      {
        $set: {
          isArchived: archive,
          archivedAt: archive ? new Date() : null,
          archivedBy: archive ? req.user._id : null,
          updatedBy:  req.user._id,
        },
      },
      { new: true }
    ).lean();

    return ok(res, { conversation: conv });
  })
);

router.patch(
  '/conversations/:conversationId/mute',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { mute = true, mutedUntil } = req.body;

    await Conversation.findOneAndUpdate(
      { _id: req.params.conversationId, 'participants.user': req.user._id },
      {
        $set: {
          'participants.$.isMuted':    mute,
          'participants.$.mutedUntil': mute && mutedUntil ? new Date(mutedUntil) : null,
        },
      }
    );

    return ok(res, { muted: mute, mutedUntil: mute ? mutedUntil || null : null });
  })
);

router.post(
  '/conversations/:conversationId/members',
  protect,
  validateConvId,
  requireParticipant,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userIds = [] } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0)
      return fail(res, 'userIds array is required', 400);

    const conv    = req.conversation;
    const users   = await User.find({ _id: { $in: userIds } }).select('_id name').lean();
    const added   = [];
    const skipped = [];

    for (const u of users) {
      const existing = conv.participants.find((p) => p.user.toString() === u._id.toString());
      if (existing) {
        if (!existing.isActive) { existing.isActive = true; existing.leftAt = null; added.push(u._id); }
        else skipped.push(u._id);
      } else {
        conv.participants.push({ user: u._id, conversationRole: 'member', joinedAt: new Date(), addedBy: req.user._id, isActive: true });
        added.push(u._id);
      }
    }

    conv.updatedBy = req.user._id;
    await conv.save();

    if (added.length > 0) {
      const addedUsers = users.filter((u) => added.map((id) => id.toString()).includes(u._id.toString()));
      const nameList   = addedUsers.map((u) => u.name).join(', ');

      const sysMsg = await Message.create({
        conversation: conv._id,
        sender:       req.user._id,
        type:         'system',
        content:      `${req.user.name} added ${nameList}`,
        systemEvent:  { event: 'member_added', meta: { addedIds: added } },
      });

      const io = getIO(req);
      if (io) {
        io.to(conv._id.toString()).emit('conversation:member_added', {
          conversationId: conv._id,
          addedIds: added,
          addedBy:  { _id: req.user._id, name: req.user.name },
          systemMessage: sysMsg,
        });
      }
    }

    return ok(res, { added, skipped });
  })
);

router.delete(
  '/conversations/:conversationId/members/:userId',
  protect,
  validateConvId,
  requireParticipant,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidId(userId)) return fail(res, 'Invalid userId', 400);

    const conv   = req.conversation;
    const target = conv.participants.find((p) => p.user.toString() === userId && p.isActive);
    if (!target) return fail(res, 'User is not an active member', 404);
    if (target.conversationRole === 'owner') return fail(res, 'Cannot remove the owner', 403);

    target.isActive = false;
    target.leftAt   = new Date();
    conv.updatedBy  = req.user._id;
    await conv.save();

    const targetUser = await User.findById(userId).select('name').lean();

    const sysMsg = await Message.create({
      conversation: conv._id,
      sender:       req.user._id,
      type:         'system',
      content:      `${req.user.name} removed ${targetUser?.name || 'a member'}`,
      systemEvent:  { event: 'member_removed', affectedUser: userId },
    });

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('conversation:member_removed', {
        conversationId: conv._id,
        targetUserId:   userId,
        removedBy:      req.user._id,
        systemMessage:  sysMsg,
      });
    }

    return ok(res, { message: 'Member removed successfully' });
  })
);

router.post(
  '/conversations/:conversationId/leave',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const conv        = req.conversation;
    const participant = req.participant;

    if (participant.conversationRole === 'owner' && conv.type !== 'direct') {
      const nextAdmin = conv.participants.find(
        (p) => p.isActive && p.user.toString() !== req.user._id.toString()
      );
      if (nextAdmin) nextAdmin.conversationRole = 'owner';
    }

    participant.isActive = false;
    participant.leftAt   = new Date();
    conv.updatedBy       = req.user._id;
    await conv.save();

    const sysMsg = await Message.create({
      conversation: conv._id,
      sender:       req.user._id,
      type:         'system',
      content:      `${req.user.name} left the conversation`,
      systemEvent:  { event: 'member_left', affectedUser: req.user._id },
    });

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('conversation:member_left', {
        conversationId: conv._id,
        userId: req.user._id,
        systemMessage: sysMsg,
      });
    }

    return ok(res, { message: 'You have left the conversation' });
  })
);

router.patch(
  '/conversations/:conversationId/promote/:userId',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    if (req.participant.conversationRole !== 'owner')
      return fail(res, 'Only the owner can promote/demote members', 403);

    const { userId }         = req.params;
    const { promote = true } = req.body;

    if (!isValidId(userId)) return fail(res, 'Invalid userId', 400);

    const conv   = req.conversation;
    const target = conv.participants.find((p) => p.user.toString() === userId && p.isActive);
    if (!target) return fail(res, 'User not found in this conversation', 404);

    target.conversationRole = promote ? 'admin' : 'member';
    conv.updatedBy          = req.user._id;
    await conv.save();

    const targetUser = await User.findById(userId).select('name').lean();

    const sysMsg = await Message.create({
      conversation: conv._id,
      sender:       req.user._id,
      type:         'system',
      content:      `${req.user.name} ${promote ? 'promoted' : 'demoted'} ${targetUser?.name || 'a member'}`,
      systemEvent:  { event: promote ? 'admin_promoted' : 'admin_demoted', affectedUser: userId },
    });

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('conversation:updated', {
        conversationId: conv._id,
        systemMessage:  sysMsg,
      });
    }

    return ok(res, { userId, role: target.conversationRole });
  })
);

router.delete(
  '/conversations/:conversationId',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const isOwner      = req.participant.conversationRole === 'owner';
    const isSuperAdmin = req.user.role === 'superadmin';

    if (!isOwner && !isSuperAdmin)
      return fail(res, 'Only the owner or superadmin can delete this conversation', 403);

    await Conversation.findByIdAndUpdate(req.params.conversationId, {
      $set: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id, updatedBy: req.user._id },
    });

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('conversation:deleted', {
        conversationId: req.params.conversationId,
        deletedBy: req.user._id,
      });
    }

    return ok(res, { message: 'Conversation deleted' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ② MESSAGE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/conversations/:conversationId/messages',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const { before }            = req.query;

    const filter = { conversation: req.params.conversationId, isScheduled: false };

    if (before && isValidId(before)) {
      const pivot = await Message.findById(before).select('createdAt').lean();
      if (pivot) filter.createdAt = { $lt: pivot.createdAt };
    }

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip(before ? 0 : skip)
        .limit(limit)
        .populate('sender',        'name avatar role isOnline lastseen')
        .populate('replyTo',       'content type sender sticker')
        .populate('mentions',      'name avatar role')
        .populate('receipts.user', 'name avatar')
        .lean(),
      Message.countDocuments(filter),
    ]);

    return ok(res, {
      messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

/**
 * POST /conversations/:conversationId/messages
 * ── PATCHED: adds sticker (Giphy) payload support ──
 */
router.post(
  '/conversations/:conversationId/messages',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const conv        = req.conversation;
    const participant = req.participant;

    if (conv.type === 'broadcast' && !['owner', 'admin'].includes(participant.conversationRole))
      return fail(res, 'Only admins can send in broadcast channels', 403);

    if (conv.isReadOnly && !['owner', 'admin'].includes(participant.conversationRole))
      return fail(res, 'This conversation is read-only', 403);

    const {
      type        = 'text',
      content     = '',
      location,
      contact,
      replyTo,
      scheduledAt,
      sticker,      // Giphy sticker payload: { giphyId, giphyUrl, previewUrl, title, width, height, rating }
    } = req.body;

    // Type-specific validation
    if (type === 'text' && !content?.trim())
      return fail(res, 'content is required for text messages', 400);

    if (type === 'sticker') {
      if (!sticker?.giphyId || !sticker?.giphyUrl)
        return fail(res, 'sticker.giphyId and sticker.giphyUrl are required', 400);
    }

    if (replyTo && !isValidId(replyTo))
      return fail(res, 'Invalid replyTo messageId', 400);

    // Extract @mentions
    const mentions = [];
    if (content) {
      const handles = content.match(/@(\w+)/g) || [];
      if (handles.length > 0) {
        const participantIds = conv.participants.filter((p) => p.isActive).map((p) => p.user);
        const mentionedUsers = await User.find({
          _id:  { $in: participantIds },
          name: { $in: handles.map((h) => h.slice(1)) },
        }).select('_id').lean();
        mentions.push(...mentionedUsers.map((u) => u._id));
      }
    }

    const isScheduled = !!scheduledAt && new Date(scheduledAt) > new Date();

    const receipts = conv.participants
      .filter((p) => p.isActive && p.user.toString() !== req.user._id.toString())
      .map((p) => ({ user: p.user, deliveredAt: null, readAt: null }));

    const sanitisedLocation = sanitiseLocation(location);

    const messageData = {
      conversation: conv._id,
      sender:       req.user._id,
      type,
      content:      content?.trim() || '',
      contact:      contact  || undefined,
      replyTo:      replyTo  || null,
      mentions,
      receipts,
      isScheduled,
      scheduledAt:  isScheduled ? new Date(scheduledAt) : null,
    };

    if (sanitisedLocation) messageData.location = sanitisedLocation;

    // Attach Giphy sticker data
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
      { path: 'replyTo',       select: 'content type sender sticker' },
      { path: 'mentions',      select: 'name avatar' },
      { path: 'receipts.user', select: 'name avatar' },
    ]);

    if (isScheduled) {
      return ok(res, { message, scheduled: true }, 201);
    }

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('message:new', { message });
    }

    for (const p of conv.participants.filter(
      (p) => p.isActive && p.user.toString() !== req.user._id.toString()
    )) {
      if (!p.isMuted) {
        pushNotification({
          recipientId: p.user,
          title:       `New message from ${req.user.name}`,
          body:        type === 'sticker'
            ? '🎭 Sticker'
            : content?.slice(0, 80) || `[${type}]`,
          type:        'Order_Update',
          screen:      'CHAT_CONVERSATION_SCREEN',
          referenceId: conv._id,
        });
      }
    }

    return ok(res, { message }, 201);
  })
);

/**
 * POST /conversations/:conversationId/messages/recording
 * ── NEW: Upload a voice note or call recording (multipart, field: "recording") ──
 * Body fields: duration (seconds), caption (optional)
 */
router.post(
  '/conversations/:conversationId/messages/recording',
  protect,
  validateConvId,
  requireParticipant,
  uploadRecording.single('recording'),
  asyncHandler(async (req, res) => {
    const conv        = req.conversation;
    const participant = req.participant;

    if (conv.type === 'broadcast' && !['owner', 'admin'].includes(participant.conversationRole))
      return fail(res, 'Only admins can send in broadcast channels', 403);

    if (!req.file)
      return fail(res, 'No recording file uploaded — field name must be "recording"', 400);

    const { originalname, mimetype, buffer, size } = req.file;
    const { duration = 0, caption = '' }            = req.body;

    const isVideoRecording = mimetype.startsWith('video/');
    const msgType          = isVideoRecording ? 'video' : 'audio';
    const ikFolder         = isVideoRecording ? 'chat/recordings/video' : 'chat/recordings/audio';

    let ikResult;
    try {
      ikResult = await uploadToImageKit(
        buffer,
        `rec_${Date.now()}_${path.basename(originalname || `recording.webm`)}`,
        ikFolder
      );
    } catch (err) {
      log.error('imagekit:recording', err.message, { userId: req.user._id });
      return fail(res, 'Recording upload failed. Please try again.', 502);
    }

    const attachment = {
      url:          ikResult.url,
      originalName: originalname || 'recording.webm',
      mimeType:     mimetype,
      size,
      duration:     Number(duration) || 0,
      thumbnailUrl: ikResult.thumbnailUrl || null,
    };

    const receipts = conv.participants
      .filter((p) => p.isActive && p.user.toString() !== req.user._id.toString())
      .map((p) => ({ user: p.user, deliveredAt: null, readAt: null }));

    const message = await Message.create({
      conversation: conv._id,
      sender:       req.user._id,
      type:         msgType,
      content:      caption?.trim() || '',
      attachments:  [attachment],
      receipts,
    });

    await message.populate([
      { path: 'sender',        select: 'name avatar role' },
      { path: 'receipts.user', select: 'name avatar' },
    ]);

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('message:new', { message });
    }

    for (const p of conv.participants.filter(
      (p) => p.isActive && p.user.toString() !== req.user._id.toString()
    )) {
      if (!p.isMuted) {
        pushNotification({
          recipientId: p.user,
          title:       `${req.user.name} sent a ${msgType === 'audio' ? 'voice message' : 'video recording'}`,
          body:        msgType === 'audio' ? '🎤 Voice message' : '🎥 Video recording',
          type:        'Order_Update',
          screen:      'CHAT_CONVERSATION_SCREEN',
          referenceId: conv._id,
        });
      }
    }

    log.info('message:recording', 'Recording uploaded', {
      conversationId: conv._id,
      msgType,
      duration: Number(duration),
      fileSize: size,
      by: req.user._id,
    });

    return ok(res, { message }, 201);
  })
);

router.post(
  '/conversations/:conversationId/messages/media',
  protect,
  validateConvId,
  requireParticipant,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const conv        = req.conversation;
    const participant = req.participant;

    if (conv.type === 'broadcast' && !['owner', 'admin'].includes(participant.conversationRole))
      return fail(res, 'Only admins can send in broadcast channels', 403);

    if (conv.isReadOnly && !['owner', 'admin'].includes(participant.conversationRole))
      return fail(res, 'This conversation is read-only', 403);

    if (!req.file)
      return fail(res, 'No file uploaded', 400);

    const { originalname, mimetype, buffer, size } = req.file;
    const { type: msgType, folder }                = classifyMime(mimetype);
    const { replyTo, caption = '' }                = req.body;

    if (replyTo && !isValidId(replyTo))
      return fail(res, 'Invalid replyTo messageId', 400);

    let ikResult;
    try {
      ikResult = await uploadToImageKit(
        buffer,
        `${Date.now()}_${path.basename(originalname)}`,
        folder
      );
    } catch (err) {
      log.error('imagekit:upload', err.message, { userId: req.user._id });
      return fail(res, 'File upload failed. Please try again.', 502);
    }

    const attachment = {
      url:          ikResult.url,
      originalName: originalname,
      mimeType:     mimetype,
      size,
      thumbnailUrl: ikResult.thumbnailUrl || null,
    };

    const receipts = conv.participants
      .filter((p) => p.isActive && p.user.toString() !== req.user._id.toString())
      .map((p) => ({ user: p.user, deliveredAt: null, readAt: null }));

    const message = await Message.create({
      conversation: conv._id,
      sender:       req.user._id,
      type:         msgType,
      content:      caption.trim(),
      attachments:  [attachment],
      replyTo:      replyTo || null,
      receipts,
    });

    await message.populate([
      { path: 'sender',        select: 'name avatar role' },
      { path: 'receipts.user', select: 'name avatar' },
    ]);

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('message:new', { message });
    }

    const notifBody =
      msgType === 'audio' ? '🎤 Voice message'
      : msgType === 'image' ? '📷 Image'
      : msgType === 'video' ? '🎥 Video'
      : `📎 ${originalname}`;

    for (const p of conv.participants.filter(
      (p) => p.isActive && p.user.toString() !== req.user._id.toString()
    )) {
      if (!p.isMuted) {
        pushNotification({
          recipientId: p.user,
          title:       `${req.user.name} sent a ${msgType}`,
          body:        notifBody,
          type:        'Order_Update',
          screen:      'CHAT_CONVERSATION_SCREEN',
          referenceId: conv._id,
        });
      }
    }

    return ok(res, { message }, 201);
  })
);

router.post(
  '/conversations/:conversationId/messages/media/multiple',
  protect,
  validateConvId,
  requireParticipant,
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const conv        = req.conversation;
    const participant = req.participant;

    if (conv.type === 'broadcast' && !['owner', 'admin'].includes(participant.conversationRole))
      return fail(res, 'Only admins can send in broadcast channels', 403);

    if (!req.files || req.files.length === 0)
      return fail(res, 'No files uploaded', 400);

    const receipts    = conv.participants
      .filter((p) => p.isActive && p.user.toString() !== req.user._id.toString())
      .map((p) => ({ user: p.user }));

    const attachments = [];
    for (const file of req.files) {
      const { folder } = classifyMime(file.mimetype);
      try {
        const ikResult = await uploadToImageKit(
          file.buffer,
          `${Date.now()}_${path.basename(file.originalname)}`,
          folder
        );
        attachments.push({
          url:          ikResult.url,
          originalName: file.originalname,
          mimeType:     file.mimetype,
          size:         file.size,
          thumbnailUrl: ikResult.thumbnailUrl || null,
        });
      } catch (err) {
        log.error('imagekit:multiUpload', err.message, { file: file.originalname });
      }
    }

    if (attachments.length === 0)
      return fail(res, 'All file uploads failed', 502);

    const { type: primaryMsgType } = classifyMime(attachments[0].mimeType);

    const message = await Message.create({
      conversation: conv._id,
      sender:       req.user._id,
      type:         primaryMsgType,
      content:      req.body.caption?.trim() || '',
      attachments,
      receipts,
    });

    await message.populate('sender', 'name avatar role');

    const io = getIO(req);
    if (io) {
      io.to(conv._id.toString()).emit('message:new', { message });
    }

    return ok(res, { message, uploadedCount: attachments.length }, 201);
  })
);

router.patch(
  '/conversations/:conversationId/messages/:messageId',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return fail(res, 'content is required', 400);

    const message = await Message.findOne({
      _id:          req.params.messageId,
      conversation: req.params.conversationId,
    });

    if (!message || message.isDeleted) return fail(res, 'Message not found', 404);
    if (message.sender.toString() !== req.user._id.toString())
      return fail(res, 'You can only edit your own messages', 403);
    if (message.type !== 'text')
      return fail(res, 'Only text messages can be edited', 400);

    const editWindowMs = 15 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > editWindowMs)
      return fail(res, 'Edit window has expired (15 minutes)', 403);

    message.editHistory.push({ content: message.content, editedAt: new Date() });
    message.content  = content.trim();
    message.isEdited = true;
    await message.save();

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('message:edited', {
        messageId:   message._id,
        content:     message.content,
        editedAt:    new Date(),
        editHistory: message.editHistory,
      });
    }

    return ok(res, { message });
  })
);

router.delete(
  '/conversations/:conversationId/messages/:messageId',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { scope = 'deleted_for_everyone' } = req.body;

    const message = await Message.findOne({
      _id:          req.params.messageId,
      conversation: req.params.conversationId,
    });

    if (!message || message.isDeleted) return fail(res, 'Message not found', 404);

    const isSender = message.sender.toString() === req.user._id.toString();
    const isAdmin  = ['owner', 'admin'].includes(req.participant.conversationRole);

    if (!isSender && !isAdmin)
      return fail(res, 'You are not authorised to delete this message', 403);

    message.isDeleted   = true;
    message.deletedAt   = new Date();
    message.deletedBy   = req.user._id;
    message.deleteScope = scope;

    if (scope === 'deleted_for_everyone') {
      message.content     = '';
      message.attachments = [];
    }

    await message.save();

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('message:deleted', {
        messageId: message._id,
        scope,
        deletedBy: req.user._id,
        deletedAt: message.deletedAt,
      });
    }

    return ok(res, { messageId: message._id, scope });
  })
);

router.post(
  '/conversations/:conversationId/messages/:messageId/react',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { emoji } = req.body;
    if (!emoji?.trim()) return fail(res, 'emoji is required', 400);

    const message = await Message.findOne({
      _id:          req.params.messageId,
      conversation: req.params.conversationId,
      isDeleted:    false,
    });

    if (!message) return fail(res, 'Message not found', 404);

    const existingIdx = message.reactions.findIndex(
      (r) => r.user.toString() === req.user._id.toString() && r.emoji === emoji
    );

    let action;
    if (existingIdx >= 0) {
      message.reactions.splice(existingIdx, 1);
      action = 'removed';
    } else {
      message.reactions.push({ user: req.user._id, emoji, reactedAt: new Date() });
      action = 'added';
    }

    await message.save();

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('message:reaction', {
        messageId: message._id,
        userId:    req.user._id,
        emoji,
        action,
        reactions: message.reactions,
      });
    }

    return ok(res, { messageId: message._id, emoji, action, reactions: message.reactions });
  })
);

router.patch(
  '/conversations/:conversationId/messages/:messageId/pin',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { pin = true } = req.body;

    const message = await Message.findOne({
      _id:          req.params.messageId,
      conversation: req.params.conversationId,
      isDeleted:    false,
    });

    if (!message) return fail(res, 'Message not found', 404);

    message.isPinned = pin;
    message.pinnedAt = pin ? new Date() : null;
    message.pinnedBy = pin ? req.user._id : null;
    await message.save();

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('message:pin_updated', {
        messageId: message._id,
        isPinned:  message.isPinned,
        pinnedAt:  message.pinnedAt,
        pinnedBy:  req.user._id,
      });
    }

    return ok(res, { messageId: message._id, isPinned: message.isPinned });
  })
);

router.get(
  '/conversations/:conversationId/messages/pinned',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const messages = await Message.find({
      conversation: req.params.conversationId,
      isPinned:     true,
      isDeleted:    false,
    })
      .sort({ pinnedAt: -1 })
      .populate('sender',   'name avatar role')
      .populate('pinnedBy', 'name')
      .lean();

    return ok(res, { messages });
  })
);

/**
 * POST /messages/:messageId/forward
 * ── PATCHED: also forwards sticker payload ──
 */
router.post(
  '/conversations/:conversationId/messages/:messageId/forward',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { targetConversationIds = [] } = req.body;

    if (!Array.isArray(targetConversationIds) || targetConversationIds.length === 0)
      return fail(res, 'targetConversationIds is required', 400);

    if (targetConversationIds.some((id) => !isValidId(id)))
      return fail(res, 'One or more targetConversationIds are invalid', 400);

    const original = await Message.findOne({
      _id:       req.params.messageId,
      isDeleted: false,
    }).lean();

    if (!original) return fail(res, 'Original message not found', 404);

    const forwarded = [];
    const failed    = [];
    const io        = getIO(req);

    for (const targetId of targetConversationIds) {
      const targetConv = await Conversation.findOne({
        _id:                     targetId,
        isDeleted:               false,
        'participants.user':     req.user._id,
        'participants.isActive': true,
      });

      if (!targetConv) { failed.push(targetId); continue; }

      const receipts = targetConv.participants
        .filter((p) => p.isActive && p.user.toString() !== req.user._id.toString())
        .map((p) => ({ user: p.user }));

      const msgData = {
        conversation:  targetId,
        sender:        req.user._id,
        type:          original.type,
        content:       original.content,
        attachments:   original.attachments,
        forwardedFrom: {
          messageId:      original._id,
          conversationId: original.conversation,
          senderId:       original.sender,
        },
        receipts,
      };

      if (original.location && original.location.latitude != null) {
        msgData.location = original.location;
      }

      // Forward sticker data
      if (original.type === 'sticker' && original.sticker) {
        msgData.sticker = original.sticker;
      }

      const msg = await Message.create(msgData);
      await msg.populate('sender', 'name avatar role');

      if (io) {
        io.to(targetId).emit('message:new', { message: msg });
      }

      forwarded.push({ targetConversationId: targetId, messageId: msg._id });
    }

    return ok(res, { forwarded, failed });
  })
);

router.patch(
  '/conversations/:conversationId/messages/:messageId/read',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const pivot = await Message.findById(req.params.messageId).select('createdAt').lean();
    if (!pivot) return fail(res, 'Message not found', 404);

    const result = await Message.updateMany(
      {
        conversation:      req.params.conversationId,
        'receipts.user':   req.user._id,
        'receipts.readAt': null,
        createdAt:         { $lte: pivot.createdAt },
      },
      { $set: { 'receipts.$.readAt': new Date() } }
    );

    await Conversation.findOneAndUpdate(
      { _id: req.params.conversationId, 'participants.user': req.user._id },
      { $set: { 'participants.$.lastReadMessage': req.params.messageId } }
    );

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('message:read_receipt', {
        conversationId: req.params.conversationId,
        messageId:      req.params.messageId,
        readBy:         req.user._id,
        readAt:         new Date(),
      });
    }

    return ok(res, { updated: result.modifiedCount });
  })
);

router.patch(
  '/conversations/:conversationId/messages/:messageId/delivered',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const message = await Message.findOneAndUpdate(
      {
        _id:                    req.params.messageId,
        conversation:           req.params.conversationId,
        'receipts.user':        req.user._id,
        'receipts.deliveredAt': null,
      },
      { $set: { 'receipts.$.deliveredAt': new Date() } },
      { new: true }
    );

    if (!message) return ok(res, { updated: false });

    const io = getIO(req);
    if (io) {
      io.to(message.sender.toString()).emit('message:delivery_receipt', {
        messageId:   req.params.messageId,
        userId:      req.user._id,
        deliveredAt: new Date(),
      });
    }

    return ok(res, { updated: true });
  })
);

router.get(
  '/conversations/:conversationId/messages/search',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const q = req.query.q;
    if (!q?.trim()) return fail(res, 'Search query (q) is required', 400);

    const filter = {
      conversation: req.params.conversationId,
      isDeleted:    false,
      isScheduled:  false,
      content:      { $regex: q.trim(), $options: 'i' },
    };

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name avatar role')
        .lean(),
      Message.countDocuments(filter),
    ]);

    return ok(res, {
      messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.get(
  '/conversations/:conversationId/messages/media',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const { type }              = req.query;

    const typeFilter = type
      ? { type }
      : { type: { $in: ['image', 'video', 'audio', 'file'] } };

    const filter = {
      conversation: req.params.conversationId,
      isDeleted:    false,
      ...typeFilter,
    };

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name avatar role')
        .lean(),
      Message.countDocuments(filter),
    ]);

    return ok(res, {
      messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.get(
  '/conversations/:conversationId/messages/scheduled',
  protect,
  validateConvId,
  requireParticipant,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const messages = await Message.find({
      conversation: req.params.conversationId,
      isScheduled:  true,
      isDeleted:    false,
      sender:       req.user._id,
    })
      .sort({ scheduledAt: 1 })
      .populate('sender', 'name avatar role')
      .lean();

    return ok(res, { messages });
  })
);

router.delete(
  '/conversations/:conversationId/messages/scheduled/:messageId',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const message = await Message.findOne({
      _id:          req.params.messageId,
      conversation: req.params.conversationId,
      isScheduled:  true,
      sender:       req.user._id,
    });

    if (!message) return fail(res, 'Scheduled message not found', 404);

    message.isDeleted   = true;
    message.deletedAt   = new Date();
    message.deletedBy   = req.user._id;
    message.deleteScope = 'deleted_for_sender';
    await message.save();

    return ok(res, { message: 'Scheduled message cancelled' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ③ CALL SIGNALLING ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /conversations/:conversationId/call/initiate
 * ── PATCHED: mediaConstraints support; emits call:incoming to online targets ──
 */
router.post(
  '/conversations/:conversationId/call/initiate',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { callType = 'audio', mediaConstraints } = req.body;

    if (!['audio', 'video'].includes(callType))
      return fail(res, 'callType must be audio or video', 400);

    const constraints = mediaConstraints || {
      audio: true,
      video: callType === 'video',
    };

    const sysMsg = await Message.create({
      conversation: req.conversation._id,
      sender:       req.user._id,
      type:         'call',
      content:      `${req.user.name} started a ${callType} call`,
      call:         { status: null, callType },
      systemEvent:  { event: 'call_started' },
    });

    await sysMsg.populate('sender', 'name avatar role');

    const io = getIO(req);
    if (io) {
      const callPayload = {
        conversationId:   req.conversation._id,
        callType,
        caller: {
          _id:    req.user._id,
          name:   req.user.name,
          avatar: req.user.avatar,
          role:   req.user.role,
        },
        messageId:        sysMsg._id,
        mediaConstraints: constraints,
      };

      for (const p of req.conversation.participants.filter(
        (p) => p.isActive && p.user.toString() !== req.user._id.toString()
      )) {
        // Emit to personal room (userId room) — socket.js joins each socket to userId room on connect
        io.to(p.user.toString()).emit('call:incoming', callPayload);
      }
    }

    return ok(res, { messageId: sysMsg._id, callType, constraints }, 201);
  })
);

router.patch(
  '/conversations/:conversationId/call/:messageId/end',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { duration = 0 } = req.body;

    const message = await Message.findOneAndUpdate(
      {
        _id:          req.params.messageId,
        conversation: req.params.conversationId,
        type:         'call',
      },
      { $set: { 'call.status': 'answered', 'call.duration': duration } },
      { new: true }
    );

    if (!message) return fail(res, 'Call record not found', 404);

    const io = getIO(req);
    if (io) {
      io.to(req.params.conversationId).emit('call:ended', {
        conversationId: req.params.conversationId,
        endedBy:        req.user._id,
        duration,
      });
    }

    return ok(res, { message });
  })
);

router.patch(
  '/conversations/:conversationId/call/:messageId/status',
  protect,
  validateConvId,
  validateMsgId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['missed', 'declined', 'answered'].includes(status))
      return fail(res, 'status must be missed | declined | answered', 400);

    const message = await Message.findOneAndUpdate(
      {
        _id:          req.params.messageId,
        conversation: req.params.conversationId,
        type:         'call',
      },
      { $set: { 'call.status': status } },
      { new: true }
    );

    if (!message) return fail(res, 'Call record not found', 404);

    const io = getIO(req);
    if (io) {
      if (status === 'declined') {
        io.to(req.params.conversationId).emit('call:declined', {
          conversationId: req.params.conversationId,
          declinedBy:     req.user._id,
        });
      }
      if (status === 'missed') {
        io.to(req.params.conversationId).emit('call:missed', {
          conversationId: req.params.conversationId,
          userId: req.user._id,
        });
      }
    }

    return ok(res, { message });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ④ PRESENCE / UTILITY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/users/online',
  protect,
  asyncHandler(async (req, res) => {
    const rawIds   = (req.query.userIds || '').split(',').filter(Boolean);
    if (rawIds.length === 0) return fail(res, 'userIds query param is required', 400);

    const validIds = rawIds.filter((id) => isValidId(id));
    const users    = await User.find({ _id: { $in: validIds } }).select('_id isOnline lastseen').lean();

    const result = {};
    for (const u of users) {
      result[u._id.toString()] = { isOnline: u.isOnline, lastseen: u.lastseen };
    }

    return ok(res, { presence: result });
  })
);

router.get(
  '/unread/count',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const convs = await Conversation.find({
      'participants.user':     userId,
      'participants.isActive': true,
      isDeleted:               false,
    }).select('participants').lean();

    let totalUnread = 0;

    await Promise.all(
      convs.map(async (conv) => {
        const myParticipant = conv.participants.find(
          (p) => p.user.toString() === userId.toString()
        );
        if (myParticipant?.isMuted) return;

        const count = await Message.countDocuments({
          conversation:      conv._id,
          isDeleted:         false,
          isScheduled:       false,
          sender:            { $ne: userId },
          'receipts.user':   userId,
          'receipts.readAt': null,
        });
        totalUnread += count;
      })
    );

    return ok(res, { unreadCount: totalUnread });
  })
);

router.get(
  '/conversations/:conversationId/unread/count',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const count = await Message.countDocuments({
      conversation:      req.params.conversationId,
      isDeleted:         false,
      isScheduled:       false,
      sender:            { $ne: req.user._id },
      'receipts.user':   req.user._id,
      'receipts.readAt': null,
    });

    return ok(res, { unreadCount: count });
  })
);

router.post(
  '/conversations/:conversationId/read-all',
  protect,
  validateConvId,
  requireParticipant,
  asyncHandler(async (req, res) => {
    const result = await Message.updateMany(
      {
        conversation:      req.params.conversationId,
        'receipts.user':   req.user._id,
        'receipts.readAt': null,
      },
      { $set: { 'receipts.$.readAt': new Date() } }
    );

    const lastMsg = await Message.findOne({
      conversation: req.params.conversationId,
      isDeleted:    false,
    })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();

    if (lastMsg) {
      await Conversation.findOneAndUpdate(
        { _id: req.params.conversationId, 'participants.user': req.user._id },
        { $set: { 'participants.$.lastReadMessage': lastMsg._id } }
      );
    }

    const io = getIO(req);
    if (io && lastMsg) {
      io.to(req.params.conversationId).emit('message:read_receipt', {
        conversationId: req.params.conversationId,
        messageId:      lastMsg._id,
        readBy:         req.user._id,
        readAt:         new Date(),
      });
    }

    return ok(res, { markedRead: result.modifiedCount });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ ADMIN / MODERATION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/admin/conversations',
  protect,
  authorize('superadmin', 'admin'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip }               = getPagination(req.query);
    const { type, isDeleted = false, search } = req.query;

    const filter = { isDeleted: isDeleted === 'true' };
    if (type)           filter.type = type;
    if (search?.trim()) filter.name = { $regex: search.trim(), $options: 'i' };

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants.user', 'name avatar role')
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    return ok(res, {
      conversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.delete(
  '/admin/messages/:messageId',
  protect,
  authorize('superadmin'),
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.messageId)) return fail(res, 'Invalid messageId', 400);

    const message = await Message.findById(req.params.messageId);
    if (!message) return fail(res, 'Message not found', 404);

    message.isDeleted   = true;
    message.deletedAt   = new Date();
    message.deletedBy   = req.user._id;
    message.deleteScope = 'deleted_for_everyone';
    message.content     = '[Removed by admin]';
    message.attachments = [];
    await message.save();

    const io = getIO(req);
    if (io) {
      io.to(message.conversation.toString()).emit('message:deleted', {
        messageId:  message._id,
        scope:      'deleted_for_everyone',
        deletedBy:  req.user._id,
        deletedAt:  message.deletedAt,
      });
    }

    return ok(res, { message: 'Message removed' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CENTRALIZED ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

router.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return fail(res, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`, 413);

  if (err.message?.startsWith('Unsupported file type') ||
      err.message?.startsWith('Unsupported recording type'))
    return fail(res, err.message, 415);

  log.error('chatRouter:unhandled', err.message, {
    stack:  err.stack,
    url:    req.originalUrl,
    method: req.method,
    userId: req.user?._id,
  });

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again.'
        : err.message,
  });
});

export default router;