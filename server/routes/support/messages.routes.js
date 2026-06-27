/**
 * routes/support/messages.routes.js
 * Send messages, read receipts, internal notes, mentions.
 * Business logic inline — no controller.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import User from '../../models/User.js';
import sendEmail from '../../utils/sendEmail.js';
import redisClient from '../../config/redis.js';

import { protect, authorize } from '../../middleware/authMiddleware.js'; // adjust path

import {
  Ticket, TicketMessage, TicketParticipant, TicketInternalNote,
  ADMIN_ROLES,
} from '../../models/ticket.model.js';

import {
  isCustomer, isPartner,
  canAccessTicket, canViewInternalNote, logActivity, logAudit,
  createTicketNotification, paginationOptions, isValidObjectId,
  sanitizeText, communicationAllowed,
} from '../../utils/helpers.js';

import { mentionAlertEmail } from '../../utils/emailTemplates.js';

const router = express.Router({ mergeParams: true }); // :ticketId from parent

const replyLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 50, message: 'Too many messages' });

// ─── GET /tickets/:ticketId/messages ─────────────────────────────────────────

router.get('/', protect, async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await Ticket.findOne({ _id: ticketId, isDeleted: false }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ success: false, message: 'Access denied' });

    const { page, limit, skip } = paginationOptions(req.query);

    // Non-admins cannot see INTERNAL_NOTE messages
    const filter = { ticket: ticketId, isDeleted: false };
    if (!ADMIN_ROLES.includes(req.user.role)) {
      filter.messageType = { $ne: 'INTERNAL_NOTE' };
    }

    const [messages, total] = await Promise.all([
      TicketMessage.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name email avatar role')
        .populate('attachments')
        .populate('replyTo', 'message sender senderRole')
        .lean(),
      TicketMessage.countDocuments(filter),
    ]);

    // Mark delivered for current user
    const userId = req.user._id;
    const undelivered = messages.filter(
      (m) => !m.deliveredTo?.some((d) => d.user?.toString() === userId.toString())
    );
    if (undelivered.length) {
      await TicketMessage.updateMany(
        { _id: { $in: undelivered.map((m) => m._id) } },
        { $push: { deliveredTo: { user: userId, deliveredAt: new Date() } } }
      );
    }

    return res.json({ success: true, data: messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[GET /messages]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /tickets/:ticketId/messages ────────────────────────────────────────

router.post('/', protect, replyLimit, async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const { message, messageType = 'TEXT', attachments = [], replyTo, mentions = [] } = req.body;
    const user = req.user;

    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });
    if (message.length > 5000) return res.status(400).json({ success: false, message: 'Message too long (max 5000 chars)' });

    const ticket = await Ticket.findOne({ _id: ticketId, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, user)) return res.status(403).json({ success: false, message: 'Access denied' });
    if (['CLOSED', 'RESOLVED'].includes(ticket.status) && !ADMIN_ROLES.includes(user.role)) {
      return res.status(400).json({ success: false, message: 'Ticket is closed/resolved. Reopen to reply.' });
    }

    // Validate replyTo
    if (replyTo && !isValidObjectId(replyTo)) {
      return res.status(400).json({ success: false, message: 'Invalid replyTo ID' });
    }

    // Validate mentions (admin-only IDs)
    const validMentions = [];
    if (mentions.length && ADMIN_ROLES.includes(user.role)) {
      const mentionedUsers = await User.find({ _id: { $in: mentions }, role: { $in: ADMIN_ROLES } }, '_id name email').lean();
      validMentions.push(...mentionedUsers.map((u) => u._id));
    }

    const msg = await TicketMessage.create({
      ticket: ticketId,
      sender: user._id,
      senderRole: user.role,
      message: sanitizeText(message.trim()),
      messageType,
      attachments,
      replyTo: replyTo || undefined,
      mentions: validMentions,
    });

    // Update ticket lastMessage
    ticket.lastMessageAt = new Date();
    ticket.lastMessageBy = user._id;
    if (!ticket.firstResponseAt && ADMIN_ROLES.includes(user.role)) {
      ticket.firstResponseAt = new Date();
    }
    if (ticket.status === 'OPEN' && ADMIN_ROLES.includes(user.role)) ticket.status = 'IN_PROGRESS';
    if (ticket.status === 'WAITING_FOR_CUSTOMER' && isCustomer(user.role)) ticket.status = 'IN_PROGRESS';
    if (ticket.status === 'WAITING_FOR_PARTNER' && isPartner(user.role)) ticket.status = 'IN_PROGRESS';
    await ticket.save();

    // Ensure participant exists
    await TicketParticipant.findOneAndUpdate(
      { ticket: ticketId, user: user._id },
      { $set: { role: user.role, lastSeenAt: new Date() } },
      { upsert: true }
    );

    // Increment unread for all OTHER participants
    await TicketParticipant.updateMany(
      { ticket: ticketId, user: { $ne: user._id } },
      { $inc: { unreadCount: 1 } }
    );

    await logActivity(ticketId, user, 'MESSAGE_SENT', { messageId: msg._id, messageType });

    // Notify participants
    const participants = await TicketParticipant.find({ ticket: ticketId, user: { $ne: user._id } }, 'user').lean();
    const recipientIds = participants.map((p) => p.user);

    await createTicketNotification({
      recipients: recipientIds,
      type: 'New_Ticket_Message',
      title: `New message in ${ticket.ticketNumber}`,
      body: message.substring(0, 100),
      ticketId: ticket._id,
      senderId: user._id,
    });

    // Handle mentions — notify + email
    if (validMentions.length) {
      const mentionedFull = await User.find({ _id: { $in: validMentions } }, 'name email').lean();
      await createTicketNotification({
        recipients: validMentions,
        type: 'Ticket_Mention',
        title: `You were mentioned in ${ticket.ticketNumber}`,
        body: message.substring(0, 100),
        ticketId: ticket._id,
        senderId: user._id,
      });

      for (const mu of mentionedFull) {
        try {
          const tmpl = mentionAlertEmail({
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            mentionerName: user.name,
            recipientName: mu.name,
          });
          await sendEmail({ email: mu.email, ...tmpl });
        } catch (e) { /* non-fatal */ }
      }

      await logActivity(ticketId, user, 'MENTION_ADDED', { mentions: validMentions });
    }

    // Socket broadcast
    const populated = await msg.populate('sender', 'name email avatar role');
    req.io?.to(`ticket:${ticketId}`).emit('message:received', { message: populated });

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('[POST /messages]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /tickets/:ticketId/messages/:msgId/read ───────────────────────────

router.patch('/:msgId/read', protect, async (req, res) => {
  try {
    const { ticketId, msgId } = req.params;
    if (!isValidObjectId(msgId)) return res.status(400).json({ success: false, message: 'Invalid message ID' });

    const userId = req.user._id;

    await TicketMessage.updateOne(
      { _id: msgId, ticket: ticketId, 'readBy.user': { $ne: userId } },
      { $push: { readBy: { user: userId, readAt: new Date() } } }
    );

    // Reset unread for this participant
    await TicketParticipant.updateOne({ ticket: ticketId, user: userId }, { $set: { unreadCount: 0, lastSeenAt: new Date() } });

    req.io?.to(`ticket:${ticketId}`).emit('message:read', { msgId, userId });

    return res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /messages/:msgId/read]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /tickets/:ticketId/messages/:msgId — SuperAdmin soft-delete ───────

router.delete('/:msgId', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { ticketId, msgId } = req.params;
    const { deleteReason } = req.body;

    if (!isValidObjectId(msgId)) return res.status(400).json({ success: false, message: 'Invalid message ID' });

    const msg = await TicketMessage.findOne({ _id: msgId, ticket: ticketId });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    msg.isDeleted = true;
    msg.deletedBy = req.user._id;
    msg.deletedAt = new Date();
    msg.deleteReason = deleteReason || '';
    await msg.save();

    await logAudit({ ticketId, actor: req.user, action: 'MESSAGE_DELETED', req, oldValue: { message: msg.message }, newValue: { deleteReason } });

    req.io?.to(`ticket:${ticketId}`).emit('message:deleted', { msgId, deletedBy: req.user._id });

    return res.json({ success: true, message: 'Message soft-deleted' });
  } catch (err) {
    console.error('[DELETE /messages/:msgId]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /tickets/:ticketId/internal-notes ───────────────────────────────────

router.post('/internal-notes', protect, authorize('admin', 'superadmin', 'finance'), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { note, attachments = [], mentions = [] } = req.body;

    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    if (!note?.trim()) return res.status(400).json({ success: false, message: 'Note required' });
    if (note.length > 5000) return res.status(400).json({ success: false, message: 'Note too long' });

    const ticket = await Ticket.findOne({ _id: ticketId, isDeleted: false }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Validate mentions
    const validMentions = [];
    if (mentions.length) {
      const mUsers = await User.find({ _id: { $in: mentions }, role: { $in: ADMIN_ROLES } }, '_id name email').lean();
      validMentions.push(...mUsers.map((u) => u._id));
    }

    const internalNote = await TicketInternalNote.create({
      ticket: ticketId,
      author: req.user._id,
      note: sanitizeText(note.trim()),
      attachments,
      mentions: validMentions,
    });

    // Also create as a message of type INTERNAL_NOTE for unified feed
    await TicketMessage.create({
      ticket: ticketId,
      sender: req.user._id,
      senderRole: req.user.role,
      message: sanitizeText(note.trim()),
      messageType: 'INTERNAL_NOTE',
      attachments,
      mentions: validMentions,
    });

    await logActivity(ticketId, req.user, 'INTERNAL_NOTE_ADDED', { noteId: internalNote._id });

    if (validMentions.length) {
      await createTicketNotification({
        recipients: validMentions,
        type: 'Ticket_Mention',
        title: `You were mentioned in internal note — ${ticket.ticketNumber}`,
        body: note.substring(0, 100),
        ticketId: ticket._id,
        senderId: req.user._id,
      });
    }

    req.io?.to('admin_room').emit('internalNote:created', { ticketId, noteId: internalNote._id, mentions: validMentions });

    return res.status(201).json({ success: true, data: internalNote });
  } catch (err) {
    console.error('[POST /internal-notes]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /tickets/:ticketId/internal-notes ────────────────────────────────────

router.get('/internal-notes', protect, authorize('admin', 'superadmin', 'finance'), async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const { page, limit, skip } = paginationOptions(req.query);

    const [notes, total] = await Promise.all([
      TicketInternalNote.find({ ticket: ticketId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'name email avatar role')
        .lean(),
      TicketInternalNote.countDocuments({ ticket: ticketId }),
    ]);

    return res.json({ success: true, data: notes, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[GET /internal-notes]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /tickets/:ticketId/activity ─────────────────────────────────────────

router.get('/activity', protect, async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await Ticket.findOne({ _id: ticketId, isDeleted: false }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ success: false, message: 'Access denied' });

    const { TicketActivity } = await import('../models/ticket.model.js');
    const { page, limit, skip } = paginationOptions(req.query);

    const [activities, total] = await Promise.all([
      TicketActivity.find({ ticket: ticketId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name email avatar role')
        .lean(),
      TicketActivity.countDocuments({ ticket: ticketId }),
    ]);

    return res.json({ success: true, data: activities, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[GET /activity]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;