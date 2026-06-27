/**
 * routes/support/admin.routes.js
 * Admin-only operations: assign, bulk, audit logs, merge tickets.
 * Business logic inline.
 */

import express from 'express';
import User from '../../models/User.js';
import sendEmail from '../../utils/sendEmail.js';
import redisClient from '../../config/redis.js';

import { protect, authorize } from '../../middleware/authMiddleware.js'; // adjust path

import {
  Ticket, TicketMessage, TicketAssignment, TicketActivity,
  TicketAuditLog, TICKET_STATUSES, TICKET_PRIORITIES, TICKET_DEPARTMENTS,
} from '../../models/ticket.model.js';

import {
  logActivity, logAudit, createTicketNotification, paginationOptions,
  isValidObjectId, calcSlaDeadline,
} from '../../utils/helpers.js';

import { ticketAssignedEmail } from '../../utils/emailTemplates.js';

const router = express.Router();

// ─── POST /admin/tickets/:id/assign ──────────────────────────────────────────

router.post('/tickets/:id/assign', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { adminIds = [], reason, type = 'ASSIGN' } = req.body;
    const { id } = req.params;

    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    if (!adminIds.length) return res.status(400).json({ success: false, message: 'adminIds required' });

    // Validate all are admin-role users
    const admins = await User.find({ _id: { $in: adminIds }, role: { $in: ['admin', 'superadmin', 'finance'] } }, '_id name email role').lean();
    if (admins.length !== adminIds.length) {
      return res.status(400).json({ success: false, message: 'Some IDs are not valid admin users' });
    }

    const ticket = await Ticket.findOne({ _id: id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const oldAdmins = [...(ticket.assignedAdmins || [])].map((a) => a.toString());
    const newAdmins = [...new Set([...oldAdmins, ...adminIds.map(String)])];

    ticket.assignedAdmins = newAdmins;
    if (ticket.status === 'OPEN') ticket.status = 'ASSIGNED';
    await ticket.save();

    // Assignment history
    const assignmentDocs = adminIds.map((adminId) => ({
      ticket: ticket._id,
      assignedBy: req.user._id,
      assignedTo: adminId,
      assignedAt: new Date(),
      reason: reason || '',
      type,
    }));
    await TicketAssignment.insertMany(assignmentDocs);

    await logActivity(ticket._id, req.user, 'TICKET_ASSIGNED', { assignedTo: adminIds, reason });
    await logAudit({ ticketId: ticket._id, actor: req.user, action: 'TICKET_ASSIGNED', req, oldValue: { assignedAdmins: oldAdmins }, newValue: { assignedAdmins: newAdmins } });

    // Notify newly assigned admins
    const newlyAssigned = adminIds.filter((a) => !oldAdmins.includes(a.toString()));
    if (newlyAssigned.length) {
      await createTicketNotification({
        recipients: newlyAssigned,
        type: 'Ticket_Assigned',
        title: `Ticket assigned to you: ${ticket.ticketNumber}`,
        body: ticket.subject,
        ticketId: ticket._id,
        senderId: req.user._id,
      });

      // Email newly assigned
      for (const a of admins.filter((x) => newlyAssigned.includes(x._id.toString()))) {
        try {
          const tmpl = ticketAssignedEmail({ ticketNumber: ticket.ticketNumber, subject: ticket.subject, adminName: a.name, recipientName: a.name });
          await sendEmail({ email: a.email, ...tmpl });
        } catch (e) { /* non-fatal */ }
      }
    }

    // Also notify customer/partner
    const ticketOwner = ticket.customer || ticket.partner;
    if (ticketOwner) {
      await createTicketNotification({
        recipients: [ticketOwner],
        type: 'Ticket_Assigned',
        title: `Your ticket ${ticket.ticketNumber} has been assigned`,
        body: ticket.subject,
        ticketId: ticket._id,
        senderId: req.user._id,
      });
    }

    req.io?.to(`ticket:${ticket._id}`).emit('ticket:assigned', { ticketId: ticket._id, assignedAdmins: ticket.assignedAdmins });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[POST /admin/tickets/:id/assign]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /admin/tickets/:id/assign/:adminId — Unassign ─────────────────────

router.delete('/tickets/:id/assign/:adminId', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { id, adminId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(adminId)) return res.status(400).json({ success: false, message: 'Invalid IDs' });

    const ticket = await Ticket.findOne({ _id: id, isDeleted: false });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const oldAdmins = ticket.assignedAdmins.map((a) => a.toString());
    ticket.assignedAdmins = ticket.assignedAdmins.filter((a) => a.toString() !== adminId);
    await ticket.save();

    await TicketAssignment.create({
      ticket: ticket._id,
      assignedBy: req.user._id,
      assignedTo: adminId,
      assignedAt: new Date(),
      type: 'UNASSIGN',
    });

    await logActivity(ticket._id, req.user, 'ADMIN_UNASSIGNED', { adminId });
    await logAudit({ ticketId: ticket._id, actor: req.user, action: 'ADMIN_UNASSIGNED', req, oldValue: { assignedAdmins: oldAdmins }, newValue: { assignedAdmins: ticket.assignedAdmins } });

    await createTicketNotification({
      recipients: [adminId],
      type: 'Assignment_Changed',
      title: `You were unassigned from ${ticket.ticketNumber}`,
      body: ticket.subject,
      ticketId: ticket._id,
      senderId: req.user._id,
    });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[DELETE /admin/tickets/:id/assign/:adminId]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /admin/tickets/bulk — Bulk Actions ──────────────────────────────────

router.post('/tickets/bulk', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { ticketIds, action, payload = {} } = req.body;

    if (!Array.isArray(ticketIds) || !ticketIds.length) {
      return res.status(400).json({ success: false, message: 'ticketIds array required' });
    }
    if (!action) return res.status(400).json({ success: false, message: 'action required' });

    const validIds = ticketIds.filter(isValidObjectId);
    if (!validIds.length) return res.status(400).json({ success: false, message: 'No valid ticket IDs' });

    let updateQuery = {};
    let activityAction = '';

    switch (action) {
      case 'CLOSE':
        updateQuery = { status: 'CLOSED', closedAt: new Date() };
        activityAction = 'STATUS_CHANGED_TO_CLOSED';
        break;
      case 'RESOLVE':
        updateQuery = { status: 'RESOLVED', resolvedAt: new Date() };
        activityAction = 'STATUS_CHANGED_TO_RESOLVED';
        break;
      case 'CHANGE_PRIORITY':
        if (!TICKET_PRIORITIES.includes(payload.priority)) return res.status(400).json({ success: false, message: 'Invalid priority' });
        updateQuery = { priority: payload.priority, slaDeadline: calcSlaDeadline(payload.priority) };
        activityAction = 'PRIORITY_CHANGED';
        break;
      case 'CHANGE_DEPARTMENT':
        if (!TICKET_DEPARTMENTS.includes(payload.department)) return res.status(400).json({ success: false, message: 'Invalid department' });
        updateQuery = { department: payload.department };
        activityAction = 'DEPARTMENT_CHANGED';
        break;
      case 'ASSIGN':
        if (!payload.adminId || !isValidObjectId(payload.adminId)) return res.status(400).json({ success: false, message: 'Valid adminId required' });
        updateQuery = { $addToSet: { assignedAdmins: payload.adminId } };
        activityAction = 'TICKET_ASSIGNED';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown action' });
    }

    const result = await Ticket.updateMany(
      { _id: { $in: validIds }, isDeleted: false },
      action === 'ASSIGN' ? updateQuery : { $set: updateQuery }
    );

    // Log activity for each
    await TicketActivity.insertMany(
      validIds.map((ticketId) => ({
        ticket: ticketId,
        actor: req.user._id,
        actorRole: req.user.role,
        action: activityAction,
        metadata: { bulk: true, payload },
      }))
    );

    await logAudit({ ticketId: null, actor: req.user, action: `BULK_${action}`, req, newValue: { ticketIds: validIds, payload } });

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[POST /admin/tickets/bulk]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /admin/tickets/:id/merge — Merge Tickets ───────────────────────────

router.post('/tickets/:id/merge', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { targetTicketId } = req.body;
    const { id: sourceId } = req.params;

    if (!isValidObjectId(sourceId) || !isValidObjectId(targetTicketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket IDs' });
    }
    if (sourceId === targetTicketId) return res.status(400).json({ success: false, message: 'Cannot merge ticket with itself' });

    const [source, target] = await Promise.all([
      Ticket.findOne({ _id: sourceId, isDeleted: false }),
      Ticket.findOne({ _id: targetTicketId, isDeleted: false }),
    ]);

    if (!source || !target) return res.status(404).json({ success: false, message: 'One or both tickets not found' });

    // Move all messages from source → target
    await TicketMessage.updateMany({ ticket: sourceId }, { $set: { ticket: targetTicketId } });

    // Close source ticket
    source.status = 'CLOSED';
    source.closedAt = new Date();
    source.metadata.mergedInto = targetTicketId;
    source.isDeleted = true;
    source.deletedBy = req.user._id;
    source.deletedAt = new Date();
    await source.save();

    // Update target metadata
    target.metadata.mergedFrom = target.metadata.mergedFrom || [];
    target.metadata.mergedFrom.push(sourceId);
    await target.save();

    await logActivity(targetTicketId, req.user, 'TICKET_MERGED', { sourceTicketId: sourceId, sourceTicketNumber: source.ticketNumber });
    await logAudit({ ticketId: targetTicketId, actor: req.user, action: 'TICKET_MERGED', req, newValue: { sourceId, targetId: targetTicketId } });

    return res.json({ success: true, message: `Ticket ${source.ticketNumber} merged into ${target.ticketNumber}` });
  } catch (err) {
    console.error('[POST /admin/tickets/:id/merge]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /admin/tickets/:id/audit — Audit Logs ────────────────────────────────

router.get('/tickets/:id/audit', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const { page, limit, skip } = paginationOptions(req.query);

    const [logs, total] = await Promise.all([
      TicketAuditLog.find({ ticket: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name email role')
        .lean(),
      TicketAuditLog.countDocuments({ ticket: id }),
    ]);

    return res.json({ success: true, data: logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[GET /admin/tickets/:id/audit]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /admin/tickets/:id/assignment-history ────────────────────────────────

router.get('/tickets/:id/assignment-history', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const history = await TicketAssignment.find({ ticket: id })
      .sort({ assignedAt: -1 })
      .populate('assignedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .lean();

    return res.json({ success: true, data: history });
  } catch (err) {
    console.error('[GET /admin/tickets/:id/assignment-history]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /admin/tickets/:id/watchers — Add Watcher ──────────────────────────

router.post('/tickets/:id/watchers', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;

    if (!isValidObjectId(id) || !isValidObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid IDs' });

    const ticket = await Ticket.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $addToSet: { watchers: userId } },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    await logActivity(ticket._id, req.user, 'WATCHER_ADDED', { watcherId: userId });

    return res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('[POST /admin/tickets/:id/watchers]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /admin/audit-logs — Global Audit (SuperAdmin) ────────────────────────

router.get('/audit-logs', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { page, limit, skip } = paginationOptions(req.query);
    const { actorId, action, startDate, endDate } = req.query;

    const filter = {};
    if (actorId && isValidObjectId(actorId)) filter.actor = actorId;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      TicketAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'name email role')
        .lean(),
      TicketAuditLog.countDocuments(filter),
    ]);

    return res.json({ success: true, data: logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[GET /admin/audit-logs]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /admin/agents — List Admin Users ─────────────────────────────────────

router.get('/agents', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = { role: { $in: ['admin', 'superadmin', 'finance'] } };
    if (role && ['admin', 'superadmin', 'finance'].includes(role)) filter.role = role;

    const agents = await User.find(filter, 'name email avatar role isOnline lastActiveAt').lean();

    // Enrich with ticket counts
    const agentIds = agents.map((a) => a._id);
    const ticketCounts = await Ticket.aggregate([
      { $match: { assignedAdmins: { $in: agentIds }, isDeleted: false, status: { $nin: ['CLOSED', 'RESOLVED'] } } },
      { $unwind: '$assignedAdmins' },
      { $match: { assignedAdmins: { $in: agentIds } } },
      { $group: { _id: '$assignedAdmins', openTickets: { $sum: 1 } } },
    ]);

    const countMap = {};
    ticketCounts.forEach((c) => { countMap[c._id.toString()] = c.openTickets; });

    const enriched = agents.map((a) => ({ ...a, openTickets: countMap[a._id.toString()] || 0 }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('[GET /admin/agents]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
