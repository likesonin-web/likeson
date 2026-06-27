/**
 * routes/support/analytics.routes.js
 * Admin/SuperAdmin analytics — aggregation pipelines.
 * Business logic inline.
 */

import express from 'express';
import redisClient from '../../config/redis.js';
import { Ticket, TicketMessage, TicketRating, TicketActivity } from '../../models/ticket.model.js';
 
import { protect, authorize } from '../../middleware/authMiddleware.js'; // adjust path

const router = express.Router();

const CACHE_TTL = 300; // 5 min cache for analytics

// ─── Helper: get date range filter ────────────────────────────────────────────

function dateFilter(q) {
  const f = {};
  const s = q.startDate ? new Date(q.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const e = q.endDate   ? new Date(q.endDate)   : new Date();
  f.$gte = s;
  f.$lte = e;
  return f;
}

// ─── GET /analytics/overview ──────────────────────────────────────────────────

router.get('/overview', protect, authorize('admin', 'superadmin', 'finance'), async (req, res) => {
  try {
    const cacheKey = `analytics:overview:${JSON.stringify(req.query)}`;
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    const df = dateFilter(req.query);

    const [statusCounts, priorityCounts, deptCounts, slaBreaches, avgTimes, ratingAvg] = await Promise.all([
      // Ticket counts by status
      Ticket.aggregate([
        { $match: { createdAt: df, isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // By priority
      Ticket.aggregate([
        { $match: { createdAt: df, isDeleted: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // By department
      Ticket.aggregate([
        { $match: { createdAt: df, isDeleted: false } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),

      // SLA breaches (resolved/closed after deadline)
      Ticket.countDocuments({
        createdAt: df,
        isDeleted: false,
        $or: [
          { resolvedAt: { $exists: true }, $expr: { $gt: ['$resolvedAt', '$slaDeadline'] } },
          { closedAt: { $exists: true }, $expr: { $gt: ['$closedAt', '$slaDeadline'] } },
          { status: { $nin: ['RESOLVED', 'CLOSED'] }, slaDeadline: { $lt: new Date() } },
        ],
      }),

      // Avg first response + resolution times (ms)
      Ticket.aggregate([
        { $match: { createdAt: df, isDeleted: false, firstResponseAt: { $exists: true } } },
        {
          $project: {
            firstResponseMs: { $subtract: ['$firstResponseAt', '$createdAt'] },
            resolutionMs: { $cond: [{ $ifNull: ['$resolvedAt', false] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] },
          },
        },
        {
          $group: {
            _id: null,
            avgFirstResponseMs: { $avg: '$firstResponseMs' },
            avgResolutionMs: { $avg: '$resolutionMs' },
          },
        },
      ]),

      // Avg rating
      TicketRating.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap = {};
    statusCounts.forEach((s) => { statusMap[s._id] = s.count; });
    const priorityMap = {};
    priorityCounts.forEach((p) => { priorityMap[p._id] = p.count; });
    const deptMap = {};
    deptCounts.forEach((d) => { deptMap[d._id] = d.count; });

    const times = avgTimes[0] || {};
    const toHours = (ms) => ms ? +(ms / (1000 * 60 * 60)).toFixed(2) : null;

    const result = {
      success: true,
      data: {
        tickets: {
          byStatus: statusMap,
          byPriority: priorityMap,
          byDepartment: deptMap,
          total: Object.values(statusMap).reduce((a, b) => a + b, 0),
        },
        sla: {
          breaches: slaBreaches,
        },
        performance: {
          avgFirstResponseHours: toHours(times.avgFirstResponseMs),
          avgResolutionHours: toHours(times.avgResolutionMs),
        },
        rating: {
          avg: ratingAvg[0]?.avgRating ? +ratingAvg[0].avgRating.toFixed(2) : null,
          count: ratingAvg[0]?.count || 0,
        },
      },
    };

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {});

    return res.json(result);
  } catch (err) {
    console.error('[GET /analytics/overview]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /analytics/admin-performance ────────────────────────────────────────

router.get('/admin-performance', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const cacheKey = `analytics:admin-perf:${JSON.stringify(req.query)}`;
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    const df = dateFilter(req.query);

    const perf = await Ticket.aggregate([
      { $match: { createdAt: df, isDeleted: false, assignedAdmins: { $exists: true, $not: { $size: 0 } } } },
      { $unwind: '$assignedAdmins' },
      {
        $group: {
          _id: '$assignedAdmins',
          totalAssigned: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
          escalated: { $sum: { $cond: ['$isEscalated', 1, 0] } },
          avgFirstResponseMs: {
            $avg: {
              $cond: [
                { $ifNull: ['$firstResponseAt', false] },
                { $subtract: ['$firstResponseAt', '$createdAt'] },
                null,
              ],
            },
          },
          avgResolutionMs: {
            $avg: {
              $cond: [
                { $ifNull: ['$resolvedAt', false] },
                { $subtract: ['$resolvedAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'admin',
          pipeline: [{ $project: { name: 1, email: 1, avatar: 1, role: 1 } }],
        },
      },
      { $unwind: '$admin' },
      { $sort: { resolved: -1 } },
    ]);

    const result = {
      success: true,
      data: perf.map((p) => ({
        admin: p.admin,
        totalAssigned: p.totalAssigned,
        resolved: p.resolved,
        closed: p.closed,
        escalated: p.escalated,
        resolutionRate: p.totalAssigned ? +((p.resolved / p.totalAssigned) * 100).toFixed(1) : 0,
        avgFirstResponseHours: p.avgFirstResponseMs ? +(p.avgFirstResponseMs / 3600000).toFixed(2) : null,
        avgResolutionHours: p.avgResolutionMs ? +(p.avgResolutionMs / 3600000).toFixed(2) : null,
      })),
    };

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {});

    return res.json(result);
  } catch (err) {
    console.error('[GET /analytics/admin-performance]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /analytics/partner-trends ───────────────────────────────────────────

router.get('/partner-trends', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const df = dateFilter(req.query);

    const trends = await Ticket.aggregate([
      { $match: { createdAt: df, isDeleted: false, partner: { $exists: true } } },
      {
        $group: {
          _id: { partner: '$partner', department: '$department' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.partner',
          foreignField: '_id',
          as: 'partner',
          pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      { $unwind: '$partner' },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    return res.json({ success: true, data: trends });
  } catch (err) {
    console.error('[GET /analytics/partner-trends]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /analytics/customer-trends ──────────────────────────────────────────

router.get('/customer-trends', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const df = dateFilter(req.query);

    const trends = await Ticket.aggregate([
      { $match: { createdAt: df, isDeleted: false, customer: { $exists: true } } },
      { $group: { _id: '$department', count: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } } } },
      { $sort: { count: -1 } },
    ]);

    return res.json({ success: true, data: trends });
  } catch (err) {
    console.error('[GET /analytics/customer-trends]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /analytics/top-tags ──────────────────────────────────────────────────

router.get('/top-tags', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const df = dateFilter(req.query);

    const tags = await Ticket.aggregate([
      { $match: { createdAt: df, isDeleted: false, tags: { $exists: true, $not: { $size: 0 } } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    return res.json({ success: true, data: tags });
  } catch (err) {
    console.error('[GET /analytics/top-tags]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /analytics/sla-breach-report ────────────────────────────────────────

router.get('/sla-breach-report', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const df = dateFilter(req.query);
    const { page, limit: qLimit, skip } = { page: 1, limit: 20, skip: 0, ...req.query };
    const limit = Math.min(100, parseInt(qLimit) || 20);

    const filter = {
      createdAt: df,
      isDeleted: false,
      $or: [
        { resolvedAt: { $exists: true }, $expr: { $gt: ['$resolvedAt', '$slaDeadline'] } },
        { closedAt: { $exists: true }, $expr: { $gt: ['$closedAt', '$slaDeadline'] } },
        { status: { $nin: ['RESOLVED', 'CLOSED'] }, slaDeadline: { $lt: new Date() } },
      ],
    };

    const [breaches, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ slaDeadline: 1 })
        .skip((parseInt(page) - 1) * limit)
        .limit(limit)
        .populate('customer', 'name email')
        .populate('partner', 'name email role')
        .populate('assignedAdmins', 'name email')
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return res.json({ success: true, data: breaches, pagination: { page: parseInt(page), limit, total } });
  } catch (err) {
    console.error('[GET /analytics/sla-breach-report]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;