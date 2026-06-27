/**
 * routes/support/tickets.routes.js
 * Business logic lives here — no controller / service layer.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import User from '../../models/User.js'; // adjust path
import sendEmail from '../../utils/sendEmail.js'; // adjust path
import redisClient from '../../config/redis.js'; // adjust path

import { protect, authorize } from '../../middleware/authMiddleware.js'; // adjust path

import {
  Ticket, TicketMessage, TicketParticipant, TicketActivity,
  generateTicketNumber, TICKET_STATUSES, TICKET_PRIORITIES,
  TICKET_DEPARTMENTS, ADMIN_ROLES, PARTNER_ROLES, SLA_HOURS,
} from '../../models/ticket.model.js';

import {
  isPartner, isCustomer, isFinance, canAccessTicket, logActivity, logAudit,
  createTicketNotification, paginationOptions, isValidObjectId,
  calcSlaDeadline, sanitizeText,
} from '../../utils/helpers.js';

import {
  ticketCreatedEmail, ticketResolvedEmail, ticketClosedEmail, ticketEscalatedEmail,
} from '../../utils/emailTemplates.js';

const router = express.Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const createLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many ticket creations' });
const replyLimit  = rateLimit({ windowMs: 5 * 60 * 1000,  max: 30, message: 'Too many messages' });

// ─── POST /tickets — Create Ticket ───────────────────────────────────────────

router.post('/', protect, createLimit, async (req, res) => {
  try {
    const { subject, description, department, priority, tags } = req.body;
    const user = req.user;

    if (!subject?.trim() || !description?.trim() || !department) {
      return res.status(400).json({ success: false, message: 'subject, description, department required' });
    }
    if (!TICKET_DEPARTMENTS.includes(department)) {
      return res.status(400).json({ success: false, message: 'Invalid department' });
    }
    if (priority && !TICKET_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority' });
    }

    const ticketNumber = await generateTicketNumber();
    const resolvedPriority = priority || 'MEDIUM';

    const ticketData = {
      ticketNumber,
      subject: sanitizeText(subject.trim()),
      description: sanitizeText(description.trim()),
      department,
      priority: resolvedPriority,
      slaDeadline: calcSlaDeadline(resolvedPriority),
      createdBy: user._id,
      tags: tags || [],
    };

    if (isCustomer(user.role)) ticketData.customer = user._id;
    if (isPartner(user.role))  ticketData.partner = user._id;

    const ticket = await Ticket.create(ticketData);

    // Create initial participant entry
    await TicketParticipant.create({ ticket: ticket._id, user: user._id, role: user.role });

    await logActivity(ticket._id, user, 'TICKET_CREATED', { ticketNumber, department, priority: resolvedPriority });
    await logAudit({ ticketId: ticket._id, actor: user, action: 'TICKET_CREATED', req, newValue: ticketData });

    // Notify all admins
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }, '_id').lean();
    const adminIds = admins.map((a) => a._id);

    await createTicketNotification({
      recipients: adminIds,
      type: 'Ticket_Created',
      title: `New Ticket: ${ticketNumber}`,
      body: subject,
      ticketId: ticket._id,
      senderId: user._id,
    });

    // Email confirmation to creator
    try {
      const tmpl = ticketCreatedEmail({
        ticketNumber,
        subject,
        department,
        priority: resolvedPriority,
        recipientName: user.name,
      });
      await sendEmail({ email: user.email, ...tmpl });
    } catch (e) { /* non-fatal */ }

    // Socket emit to admin room
    req.io?.to('admin_room').emit('ticket:new', { ticketId: ticket._id, ticketNumber, subject, department });

    return res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    console.error('[POST /tickets]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /tickets — List Tickets ──────────────────────────────────────────────

router.get('/', protect, async (req, res) => {
  try {
    const user = req.user;
    const { page, limit, skip } = paginationOptions(req.query);
    const { status, priority, department, search, startDate, endDate } = req.query;

    const filter = { isDeleted: false };

    // Scope by role
    if (isCustomer(user.role)) filter.customer = user._id;
    else if (isPartner(user.role)) filter.partner = user._id;
    else if (ADMIN_ROLES.includes(user.role)) {
      if (user.role === 'finance') filter.department = 'FINANCE';
      // admin/superadmin sees all
    }

    if (status)     filter.status = status;
    if (priority)   filter.priority = priority;
    // isFinance() was being called here before but was never imported —
    // that was a latent ReferenceError waiting for a finance-role request
    // with a ?department= query param. Now correctly imported above.
    if (department && !isFinance(user.role)) filter.department = department;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const cacheKey = `tickets:list:${user._id}:${JSON.stringify({ filter, page, limit })}`;
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'name email phone avatar role')
        .populate('partner', 'name email phone avatar role')
        .populate('assignedAdmins', 'name email avatar')
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    const result = { success: true, data: tickets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };

    await redisClient.setEx(cacheKey, 30, JSON.stringify(result)).catch(() => {});

    return res.json(result);
  } catch (err) {
    console.error('[GET /tickets]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /tickets/:id — Single Ticket ────────────────────────────────────────

router.get('/:id', protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }

    const ticket = await Ticket.findOne({ _id: req.params.id, isDeleted: false })
      .populate('customer', 'name email phone avatar role')
      .populate('partner', 'name email phone avatar role')
      .populate('createdBy', 'name email role')
      .populate('assignedAdmins', 'name email avatar role')
      .populate('assignedFinanceUsers', 'name email avatar')
      .lean();

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[GET /tickets/:id]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /tickets/:id/status — Change Status ────────────────────────────────

router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status, reason } = req.body;
    const user = req.user;

    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    if (!TICKET_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const ticket = await Ticket.findOne({ _id: req.params.id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, user)) return res.status(403).json({ success: false, message: 'Access denied' });

    // Customers can only resolve/reopen their own tickets
    if (isCustomer(user.role) && !['RESOLVED', 'REOPENED'].includes(status)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    if (isPartner(user.role) && !['RESOLVED', 'REOPENED'].includes(status)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    if (status === 'RESOLVED') ticket.resolvedAt = new Date();
    if (status === 'CLOSED')   ticket.closedAt   = new Date();
    if (status === 'REOPENED') ticket.reopenedCount += 1;

    await ticket.save();

    await logActivity(ticket._id, user, `STATUS_CHANGED_TO_${status}`, { from: oldStatus, to: status, reason });
    await logAudit({ ticketId: ticket._id, actor: user, action: 'STATUS_CHANGED', req, oldValue: { status: oldStatus }, newValue: { status } });

    // Invalidate cache
    await redisClient.del(`tickets:list:${ticket.customer || ticket.partner}:*`).catch(() => {});

    // Notify ticket participants
    const notifyUsers = [...(ticket.assignedAdmins || []), ticket.customer, ticket.partner].filter(Boolean);
    await createTicketNotification({
      recipients: notifyUsers,
      type: status === 'RESOLVED' ? 'Ticket_Resolved' : status === 'CLOSED' ? 'Ticket_Closed' : 'Ticket_Reopened',
      title: `Ticket ${ticket.ticketNumber} ${status.toLowerCase()}`,
      body: ticket.subject,
      ticketId: ticket._id,
      senderId: user._id,
    });

    // Email for resolved/closed
    const notifyUser = await User.findById(ticket.customer || ticket.partner).lean();
    if (notifyUser) {
      try {
        if (status === 'RESOLVED') {
          const tmpl = ticketResolvedEmail({ ticketNumber: ticket.ticketNumber, subject: ticket.subject, recipientName: notifyUser.name });
          await sendEmail({ email: notifyUser.email, ...tmpl });
        }
        if (status === 'CLOSED') {
          const tmpl = ticketClosedEmail({ ticketNumber: ticket.ticketNumber, subject: ticket.subject, recipientName: notifyUser.name });
          await sendEmail({ email: notifyUser.email, ...tmpl });
        }
      } catch (e) { /* non-fatal */ }
    }

    req.io?.to(`ticket:${ticket._id}`).emit('ticket:statusChanged', { ticketId: ticket._id, status, changedBy: user._id });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[PATCH /tickets/:id/status]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /tickets/:id/priority — Change Priority ────────────────────────────

router.patch('/:id/priority', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { priority } = req.body;
    if (!TICKET_PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid priority' });
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const ticket = await Ticket.findOne({ _id: req.params.id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const oldPriority = ticket.priority;
    ticket.priority = priority;
    ticket.slaDeadline = calcSlaDeadline(priority);
    await ticket.save();

    await logActivity(ticket._id, req.user, 'PRIORITY_CHANGED', { from: oldPriority, to: priority });
    await logAudit({ ticketId: ticket._id, actor: req.user, action: 'PRIORITY_CHANGED', req, oldValue: { priority: oldPriority }, newValue: { priority } });

    const notifyUsers = [...(ticket.assignedAdmins || []), ticket.customer, ticket.partner].filter(Boolean);
    await createTicketNotification({
      recipients: notifyUsers,
      type: 'Priority_Changed',
      title: `Priority changed to ${priority}`,
      body: ticket.subject,
      ticketId: ticket._id,
      senderId: req.user._id,
    });

    req.io?.to(`ticket:${ticket._id}`).emit('ticket:priorityChanged', { ticketId: ticket._id, priority });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[PATCH /tickets/:id/priority]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /tickets/:id/department — Transfer Department ──────────────────────

router.patch('/:id/department', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { department } = req.body;
    if (!TICKET_DEPARTMENTS.includes(department)) return res.status(400).json({ success: false, message: 'Invalid department' });
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const ticket = await Ticket.findOne({ _id: req.params.id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const old = ticket.department;
    ticket.department = department;
    await ticket.save();

    await logActivity(ticket._id, req.user, 'DEPARTMENT_CHANGED', { from: old, to: department });
    await logAudit({ ticketId: ticket._id, actor: req.user, action: 'DEPARTMENT_CHANGED', req, oldValue: { department: old }, newValue: { department } });

    const notifyUsers = [...(ticket.assignedAdmins || []), ticket.customer, ticket.partner].filter(Boolean);
    await createTicketNotification({
      recipients: notifyUsers,
      type: 'Department_Changed',
      title: `Ticket moved to ${department.replace(/_/g, ' ')}`,
      body: ticket.subject,
      ticketId: ticket._id,
      senderId: req.user._id,
    });

    req.io?.to(`ticket:${ticket._id}`).emit('ticket:departmentChanged', { ticketId: ticket._id, department });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[PATCH /tickets/:id/department]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /tickets/:id/escalate ───────────────────────────────────────────────

router.post('/:id/escalate', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const ticket = await Ticket.findOne({ _id: req.params.id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    ticket.isEscalated  = true;
    ticket.escalatedAt  = new Date();
    ticket.escalatedBy  = req.user._id;
    ticket.status       = 'ESCALATED';
    ticket.priority     = 'CRITICAL';
    ticket.slaDeadline  = calcSlaDeadline('CRITICAL');
    await ticket.save();

    await logActivity(ticket._id, req.user, 'TICKET_ESCALATED', {});
    await logAudit({ ticketId: ticket._id, actor: req.user, action: 'TICKET_ESCALATED', req });

    const notifyUsers = [...(ticket.assignedAdmins || []), ticket.customer, ticket.partner].filter(Boolean);
    await createTicketNotification({
      recipients: notifyUsers,
      type: 'Ticket_Escalated',
      title: `ESCALATED: ${ticket.ticketNumber}`,
      body: ticket.subject,
      ticketId: ticket._id,
      senderId: req.user._id,
    });

    const notifyUser = await User.findById(ticket.customer || ticket.partner).lean();
    if (notifyUser) {
      try {
        const tmpl = ticketEscalatedEmail({ ticketNumber: ticket.ticketNumber, subject: ticket.subject, recipientName: notifyUser.name });
        await sendEmail({ email: notifyUser.email, ...tmpl });
      } catch (e) { /* non-fatal */ }
    }

    req.io?.to(`ticket:${ticket._id}`).emit('ticket:escalated', { ticketId: ticket._id, escalatedBy: req.user._id });
    req.io?.to('admin_room').emit('ticket:escalated', { ticketId: ticket._id, ticketNumber: ticket.ticketNumber });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[POST /tickets/:id/escalate]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /tickets/:id — Soft Delete (SuperAdmin only) ──────────────────────

router.delete('/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    ticket.isDeleted = true;
    ticket.deletedBy = req.user._id;
    ticket.deletedAt = new Date();
    await ticket.save();

    await logAudit({ ticketId: ticket._id, actor: req.user, action: 'TICKET_DELETED', req });

    return res.json({ success: true, message: 'Ticket soft-deleted' });
  } catch (err) {
    console.error('[DELETE /tickets/:id]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /tickets/:id/rate — Rate Resolved Ticket ───────────────────────────

router.post('/:id/rate', protect, async (req, res) => {
  try {
    const { rating, review } = req.body;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be 1-5' });

    const ticket = await Ticket.findOne({ _id: req.params.id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ success: false, message: 'Access denied' });
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Can only rate resolved/closed tickets' });
    }

    const { TicketRating } = await import('../models/ticket.model.js');
    const existing = await TicketRating.findOne({ ticket: ticket._id });
    if (existing) return res.status(400).json({ success: false, message: 'Already rated' });

    const ticketRating = await TicketRating.create({
      ticket: ticket._id,
      ratedBy: req.user._id,
      rating,
      review: review ? sanitizeText(review) : undefined,
    });

    await logActivity(ticket._id, req.user, 'TICKET_RATED', { rating });

    await createTicketNotification({
      recipients: [...(ticket.assignedAdmins || [])],
      type: 'Ticket_Rated',
      title: `Ticket rated ${rating}/5`,
      body: ticket.subject,
      ticketId: ticket._id,
      senderId: req.user._id,
    });

    return res.status(201).json({ success: true, data: ticketRating });
  } catch (err) {
    console.error('[POST /tickets/:id/rate]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
