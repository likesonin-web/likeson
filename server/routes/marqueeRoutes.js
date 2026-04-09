/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MARQUEE ROUTER  —  Likeson.in Healthcare Platform
 * All route logic is inline (no external controller).
 *
 * Public/User routes   → require `protect`
 * Admin/SuperAdmin     → require `protect` + `authorize('superadmin','admin')`
 *
 * Base path (mount in app.js):  app.use('/api/marquee', marqueeRouter)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express  from 'express';
import mongoose from 'mongoose';
import Marquee  from '../models/Marquee.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js'; 
import { invalidatePattern, invalidateKey } from '../utils/cacheInvalidation.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  CACHE INVALIDATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wipes out all marquee-related caches.
 * Clears admin lists, analytics, individual marquee details, and ALL user-specific marquee feeds.
 */
const clearMarqueeCaches = async (marqueeId = null) => {
  // Clear admin lists and analytics summaries
  await invalidatePattern('GET:/api/marquee/admin*');
  
  // Clear all user-specific marquee feeds
  await invalidatePattern('user:*:marquees');

  // Clear specific marquee detail cache if an ID is provided
  if (marqueeId) {
    await invalidateKey(`marquee:${marqueeId}`);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * buildLiveQuery
 * ──────────────
 * Returns a Mongoose filter for "currently live" marquees visible to a given
 * user.  The targeting union logic is:
 *
 * SHOW the marquee if ALL of these are true:
 * 1. isActive === true
 * 2. isArchived === false
 * 3. startsAt <= now
 * 4. endsAt is null  OR  endsAt > now
 * 5. This user has NOT already dismissed it
 * 6. ONE of the following audience rules matches:
 * (a) PUBLIC  — both targetRoles[] and targetUsers[] are empty
 * (b) ROLES   — targetRoles is non-empty AND user's role is in it
 * (c) USERS   — targetUsers is non-empty AND user's _id is in it
 * (d) BOTH    — (b) OR (c)  [union, not intersection]
 *
 * NOTE: rules (a)/(b)/(c)/(d) are mutually exclusive by design but we still
 * use a clean $or so any combination stored in the DB works correctly.
 *
 * @param {string} role   - e.g. 'customer' | 'doctor' | 'admin' …
 * @param {ObjectId|string} userId
 */
const buildLiveQuery = (role, userId) => {
  const now = new Date();
  const userOid = new mongoose.Types.ObjectId(String(userId));

  return {
    isActive: true,
    isArchived: false,
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
    'dismissedBy.user': { $ne: userOid },
    
    // ── Corrected Audience Targeting Logic ──
    $or: [
      // 1. Global: Both arrays are empty (shown to everyone)
      { targetRoles: { $size: 0 }, targetUsers: { $size: 0 } },
      
      // 2. Role-based: User's role is in the targetRoles array
      { targetRoles: role },
      
      // 3. User-based: User's specific ID is in the targetUsers array
      { targetUsers: userOid }
    ]
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC / USER ROUTE
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/', 
  protect, 
  cache(60, (req) => `user:${req.user._id}:marquees`), 
  async (req, res) => {
    try {
      const { role, _id: userId } = req.user;

      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
      }

      // Pass the role and userId to the corrected query builder
      const query = buildLiveQuery(role, userId);

      const marquees = await Marquee.find(query)
        .select('-dismissedBy -__v')         
        .sort({ priority: -1, createdAt: -1 })
        .lean();

      // Fire-and-forget impression counter (runs on cache miss)
      if (marquees.length > 0) {
        const ids = marquees.map((m) => m._id);
        Marquee.updateMany(
          { _id: { $in: ids } },
          { $inc: { 'analytics.impressions': 1 } },
        ).catch(() => {});
      }

      res.json({ success: true, marquees });
    } catch (err) {
      console.error('[Marquee GET /]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
/**
 * POST /api/marquee/:id/dismiss
 *
 * Marks a marquee as dismissed for the current user.
 */
router.post('/:id/dismiss', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid marquee id' });
    }

    const marquee = await Marquee.findById(req.params.id);
    if (!marquee) {
      return res.status(404).json({ success: false, message: 'Marquee not found' });
    }

    if (!marquee.isDismissible) {
      return res.status(400).json({ success: false, message: 'This marquee cannot be dismissed' });
    }

    const alreadyDismissed = marquee.dismissedBy.some(
      (d) => d.user.toString() === req.user._id.toString(),
    );

    if (!alreadyDismissed) {
      marquee.dismissedBy.push({ user: req.user._id, dismissedAt: new Date() });
      marquee.analytics.dismissals += 1;
      await marquee.save();
      
      // Invalidate ONLY this specific user's marquee cache so it disappears immediately
      await invalidateKey(`user:${req.user._id}:marquees`);
    }

    res.json({ success: true, message: 'Marquee dismissed' });
  } catch (err) {
    console.error('[Marquee POST /dismiss]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/marquee/:id/click
 *
 * Tracks a CTA click for analytics.
 */
router.post('/:id/click', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid marquee id' });
    }

    await Marquee.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.clicks': 1 },
    });

    // We do NOT clear the cache here to prevent unnecessary DB hits just for tracking clicks.
    res.json({ success: true });
  } catch (err) {
    console.error('[Marquee POST /click]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/marquee/admin/analytics/summary
 * Cached for 60 seconds
 */
router.get(
  '/admin/analytics/summary',
  protect,
  authorize('superadmin', 'admin'),
  cache(60),
  async (req, res) => {
    try {
      const [totals, byType, topClicked] = await Promise.all([
        Marquee.aggregate([
          {
            $group: {
              _id:           null,
              totalMarquees: { $sum: 1 },
              activeCount:   { $sum: { $cond: ['$isActive', 1, 0] } },
              impressions:   { $sum: '$analytics.impressions' },
              clicks:        { $sum: '$analytics.clicks' },
              dismissals:    { $sum: '$analytics.dismissals' },
            },
          },
        ]),

        Marquee.aggregate([
          {
            $group: {
              _id:         '$type',
              count:       { $sum: 1 },
              impressions: { $sum: '$analytics.impressions' },
            },
          },
          { $sort: { count: -1 } },
        ]),

        Marquee.find()
          .select('message type analytics priority isActive')
          .sort({ 'analytics.clicks': -1 })
          .limit(5)
          .lean(),
      ]);

      res.json({
        success:    true,
        summary:    totals[0] || {
          totalMarquees: 0, activeCount: 0,
          impressions: 0, clicks: 0, dismissals: 0,
        },
        byType,
        topClicked,
      });
    } catch (err) {
      console.error('[Marquee GET /admin/analytics/summary]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * GET /api/marquee/admin
 * Cached for 60 seconds based on query params
 */
router.get(
  '/admin',
  protect,
  authorize('superadmin', 'admin'),
  cache(60),
  async (req, res) => {
    try {
      const {
        page       = 1,
        limit      = 20,
        type,
        isActive,
        isArchived,
        role,
        search,
      } = req.query;

      const filter = {};

      if (type)                     filter.type        = type;
      if (isActive   !== undefined) filter.isActive    = isActive   === 'true';
      if (isArchived !== undefined) filter.isArchived  = isArchived === 'true';
      if (role)                     filter.targetRoles = role;          
      if (search)                   filter.message     = { $regex: search, $options: 'i' };

      const skip  = (Number(page) - 1) * Number(limit);
      const total = await Marquee.countDocuments(filter);

      const marquees = await Marquee.find(filter)
        .populate('createdBy', 'name role avatar')
        .populate('updatedBy', 'name role')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      res.json({
        success: true,
        marquees,
        pagination: {
          total,
          pages: Math.ceil(total / Number(limit)),
          page:  Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      console.error('[Marquee GET /admin]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * GET /api/marquee/admin/:id
 * Cached for 60 seconds with a custom key
 */
router.get(
  '/admin/:id',
  protect,
  authorize('superadmin', 'admin'),
  cache(60, (req) => `marquee:${req.params.id}`),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid marquee id' });
      }

      const marquee = await Marquee.findById(req.params.id)
        .populate('createdBy',        'name role avatar')
        .populate('updatedBy',        'name role')
        .populate('dismissedBy.user', 'name role avatar')
        .populate('targetUsers',      'name role avatar email');   

      if (!marquee) {
        return res.status(404).json({ success: false, message: 'Marquee not found' });
      }

      res.json({ success: true, marquee });
    } catch (err) {
      console.error('[Marquee GET /admin/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * POST /api/marquee/admin
 */
router.post(
  '/admin',
  protect,
  authorize('superadmin', 'admin'),
  async (req, res) => {
    try {
      const {
        message, subText, icon, type, speed, priority,
        isDismissible, cta, targetRoles, targetUsers,
        targetPages, startsAt, endsAt, isActive,
      } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ success: false, message: 'message is required' });
      }

      const safeTargetUsers = Array.isArray(targetUsers)
        ? targetUsers.filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        : [];

      const marquee = await Marquee.create({
        message:       message.trim(),
        subText:       subText?.trim()  || '',
        icon:          icon?.trim()     || '',
        type:          type             || 'info',
        speed:         speed            || 'normal',
        priority:      Number(priority) || 0,
        isDismissible: isDismissible !== false,
        cta: {
          label:  cta?.label?.trim() || '',
          url:    cta?.url?.trim()   || '',
          target: cta?.target        || '_self',
        },
        targetRoles:  Array.isArray(targetRoles) ? targetRoles : [],
        targetUsers:  safeTargetUsers,
        targetPages:  Array.isArray(targetPages) ? targetPages : [],
        startsAt:     startsAt ? new Date(startsAt) : new Date(),
        endsAt:       endsAt   ? new Date(endsAt)   : null,
        isActive:     isActive !== false,
        createdBy:    req.user._id,
      });

      const populated = await marquee.populate([
        { path: 'createdBy', select: 'name role avatar' },
        { path: 'targetUsers', select: 'name role avatar email' },
      ]);

      // Global invalidation so the new marquee appears instantly for eligible users
      await clearMarqueeCaches();

      res.status(201).json({ success: true, marquee: populated });
    } catch (err) {
      console.error('[Marquee POST /admin]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * PATCH /api/marquee/admin/:id
 */
router.patch(
  '/admin/:id',
  protect,
  authorize('superadmin', 'admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid marquee id' });
      }

      const marquee = await Marquee.findById(req.params.id);
      if (!marquee) {
        return res.status(404).json({ success: false, message: 'Marquee not found' });
      }

      const SCALAR_FIELDS = [
        'message', 'subText', 'icon', 'type', 'speed', 'priority',
        'isDismissible', 'targetPages', 'isActive', 'isArchived',
      ];

      SCALAR_FIELDS.forEach((key) => {
        if (req.body[key] !== undefined) marquee[key] = req.body[key];
      });

      if (req.body.startsAt !== undefined) {
        marquee.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
      }
      if (req.body.endsAt !== undefined) {
        marquee.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
      }

      if (Array.isArray(req.body.targetRoles)) {
        marquee.targetRoles = req.body.targetRoles;
      }

      if (Array.isArray(req.body.targetUsers)) {
        marquee.targetUsers = req.body.targetUsers.filter(
          (id) => mongoose.Types.ObjectId.isValid(String(id)),
        );
      }

      if (req.body.cta) {
        marquee.cta = { ...marquee.cta.toObject(), ...req.body.cta };
      }

      marquee.updatedBy = req.user._id;
      await marquee.save();

      const populated = await marquee.populate([
        { path: 'createdBy',   select: 'name role avatar' },
        { path: 'updatedBy',   select: 'name role' },
        { path: 'targetUsers', select: 'name role avatar email' },
      ]);

      // Global invalidation
      await clearMarqueeCaches(marquee._id);

      res.json({ success: true, marquee: populated });
    } catch (err) {
      console.error('[Marquee PATCH /admin/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * PATCH /api/marquee/admin/:id/toggle
 */
router.patch(
  '/admin/:id/toggle',
  protect,
  authorize('superadmin', 'admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid marquee id' });
      }

      const marquee = await Marquee.findById(req.params.id);
      if (!marquee) {
        return res.status(404).json({ success: false, message: 'Marquee not found' });
      }

      marquee.isActive  = !marquee.isActive;
      marquee.updatedBy = req.user._id;
      await marquee.save();

      // Global invalidation
      await clearMarqueeCaches(marquee._id);

      res.json({
        success:  true,
        isActive: marquee.isActive,
        message:  `Marquee ${marquee.isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (err) {
      console.error('[Marquee PATCH /admin/:id/toggle]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * PATCH /api/marquee/admin/:id/archive
 */
router.patch(
  '/admin/:id/archive',
  protect,
  authorize('superadmin', 'admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid marquee id' });
      }

      const archive = req.body.archive !== false;   // default true

      const marquee = await Marquee.findByIdAndUpdate(
        req.params.id,
        {
          isArchived: archive,
          ...(archive ? { isActive: false } : {}),
          updatedBy: req.user._id,
        },
        { new: true },
      );

      if (!marquee) {
        return res.status(404).json({ success: false, message: 'Marquee not found' });
      }

      // Global invalidation
      await clearMarqueeCaches(marquee._id);

      res.json({
        success: true,
        message: archive ? 'Marquee archived' : 'Marquee unarchived',
        marquee,
      });
    } catch (err) {
      console.error('[Marquee PATCH /admin/:id/archive]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * DELETE /api/marquee/admin/:id
 */
router.delete(
  '/admin/:id',
  protect,
  authorize('superadmin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid marquee id' });
      }

      const marquee = await Marquee.findByIdAndDelete(req.params.id);
      if (!marquee) {
        return res.status(404).json({ success: false, message: 'Marquee not found' });
      }

      // Global invalidation
      await clearMarqueeCaches(req.params.id);

      res.json({ success: true, message: 'Marquee permanently deleted' });
    } catch (err) {
      console.error('[Marquee DELETE /admin/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * DELETE /api/marquee/admin/:id/dismissals
 */
router.delete(
  '/admin/:id/dismissals',
  protect,
  authorize('superadmin', 'admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid marquee id' });
      }

      await Marquee.findByIdAndUpdate(req.params.id, {
        $set: { dismissedBy: [], 'analytics.dismissals': 0 },
      });

      // Global invalidation so the marquee reappears for everyone who previously dismissed it
      await clearMarqueeCaches(req.params.id);

      res.json({ success: true, message: 'Dismissal log cleared' });
    } catch (err) {
      console.error('[Marquee DELETE /admin/:id/dismissals]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

export default router;