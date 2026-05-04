import express from 'express';
import Advertisement from '../models/Advertisement.js';
import Notification from '../models/Notification.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';
import { VALID_TRACK_TYPES } from '../models/Advertisement.js';

const router = express.Router();

export const archiveExpiredAds = async () => {
    const now = new Date();
    const result = await Advertisement.updateMany(
        { status: 'Active', 'schedule.endDate': { $lt: now } },
        { $set: { status: 'Archived' } }
    );
    return result.modifiedCount;
};

/** GET /api/ads — Admin: all ads */
router.get('/', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    const ads = await Advertisement.find(filter)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email');
    res.status(200).json({ success: true, count: ads.length, data: ads });
}));

/** GET /api/ads/analytics — Admin: aggregated stats */
router.get('/analytics', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const [agg] = await Advertisement.aggregate([
        {
            $group: {
                _id: null,
                totalViews:  { $sum: '$analytics.views' },
                totalClicks: { $sum: '$analytics.clicks' },
                activeCount: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
            },
        },
        {
            $project: {
                _id: 0,
                totalViews: 1,
                totalClicks: 1,
                activeCount: 1,
                avgCtr: {
                    $cond: [
                        { $gt: ['$totalViews', 0] },
                        { $multiply: [{ $divide: ['$totalClicks', '$totalViews'] }, 100] },
                        0,
                    ],
                },
            },
        },
    ]);
    res.status(200).json({
        success: true,
        data: agg ?? { totalViews: 0, totalClicks: 0, activeCount: 0, avgCtr: 0 },
    });
}));

/** POST /api/ads — Admin: create ad */
router.post('/', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const ad = await Advertisement.create({ ...req.body, createdBy: req.user._id });
    await Notification.create({
        recipient: req.user._id,
        title: 'Campaign Launched 🚀',
        body: `Ad "${ad.adContent.headline}" is now live.`,
        type: 'Promo_Marketing',
    });
    res.status(201).json({ success: true, data: ad });
}));

/**
 * GET /api/ads/serve — Public (authenticated): serve ads to customer
 *
 * Filters applied:
 *   1. status = Active
 *   2. placement.page + placement.slot match query params
 *   3. schedule window (startDate ≤ now ≤ endDate)
 *   4. displayHours — current UTC hour must be in allowed hours (if set)
 *   5. budget guard — currentSpend < totalMax
 *   6. geo filter — if ad has non-zero coordinates AND customer location known,
 *      only serve if customer is within ad's radiusInKm
 */
router.get('/serve', protect, asyncHandler(async (req, res) => {
    const { page, slot } = req.query;

    // BUG FIX: page + slot are mandatory — without them query returns garbage
    if (!page || !slot) {
        return res.status(400).json({ success: false, message: 'page and slot query params required' });
    }

    const now = new Date();
    const currentHour = now.getUTCHours(); // 0–23

    // Customer location from User record (set by app on each request / login)
    const customerCoords = req.user?.location?.coordinates; // [lng, lat]
    const hasCustomerLocation =
        Array.isArray(customerCoords) &&
        customerCoords.length === 2 &&
        (customerCoords[0] !== 0 || customerCoords[1] !== 0);

    // ── Base query (index-friendly fields first) ──────────────────────────────
    const baseQuery = {
        status: 'Active',
        'placement.page': page,
        'placement.slot': slot,
        'schedule.startDate': { $lte: now },
        $or: [
            { 'schedule.endDate': { $exists: false } },
            { 'schedule.endDate': { $gte: now } },
        ],
        // BUG FIX: budget guard — never serve depleted ads that slipped through
        $expr: { $lt: ['$budget.currentSpend', '$budget.totalMax'] },
        // BUG FIX: displayHours — empty array means "all hours allowed"
        $and: [
            {
                $or: [
                    { 'schedule.displayHours': { $size: 0 } },
                    { 'schedule.displayHours': { $exists: false } },
                    { 'schedule.displayHours': currentHour },
                ],
            },
        ],
    };

    let ads;

    if (hasCustomerLocation) {
        // BUG FIX: geo filter — ads with radiusInKm > 0 must be within range.
        // Ads with coordinates [0,0] treated as "global" (no geo restriction).
        // Use $geoNear aggregation for distance filtering.
        const [lng, lat] = customerCoords;

        ads = await Advertisement.aggregate([
            {
                // Stage 1: geo candidates — only ads whose targeting.location
                // is within MAX possible radius (500 km safety cap).
                // Ads at [0,0] (global) pass through because we handle them in stage 3.
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: '_distanceMeters',
                    maxDistance: 500 * 1000, // 500 km outer cap
                    spherical: true,
                    query: baseQuery,
                },
            },
            {
                // Stage 2: keep ad if:
                //   a) targeting.location is [0,0] (global — no geo restriction), OR
                //   b) customer distance ≤ ad's radiusInKm
                $match: {
                    $or: [
                        // Global ad: coordinates are exactly [0, 0]
                        {
                            'targeting.location.coordinates': [0, 0],
                        },
                        // Geo-targeted ad: customer within radius
                        {
                            $expr: {
                                $lte: [
                                    '$_distanceMeters',
                                    { $multiply: ['$targeting.radiusInKm', 1000] },
                                ],
                            },
                        },
                    ],
                },
            },
            { $sort: { 'placement.priority': -1, createdAt: -1 } },
            { $limit: 10 },
            { $unset: '_distanceMeters' }, // clean internal field before response
        ]);
    } else {
        // No customer location — only serve global ads (coordinates [0,0])
        // BUG FIX: was serving ALL ads regardless of geo targeting when location unknown
        ads = await Advertisement.find({
            ...baseQuery,
            'targeting.location.coordinates': [0, 0],
        })
            .sort({ 'placement.priority': -1, createdAt: -1 })
            .limit(10)
            .lean();
    }

    res.status(200).json({ success: true, count: ads.length, data: ads });
}));

// ── Cooldown store (replace with Redis in prod) ───────────────────────────────
const trackCooldown = new Map();
const COOLDOWN_MS = 5000;

/**
 * PATCH /api/ads/:id/track — track click/view + budget depletion
 */
router.patch('/:id/track', protect, asyncHandler(async (req, res) => {
    const { type } = req.body;

    if (!VALID_TRACK_TYPES.includes(type)) {
        return res.status(400).json({
            success: false,
            message: `Invalid type "${type}". Must be one of: ${VALID_TRACK_TYPES.join(', ')}`,
        });
    }

    const cooldownKey = `${req.user._id}:${req.params.id}:${type}`;
    const lastTracked = trackCooldown.get(cooldownKey);
    const now = Date.now();

    if (lastTracked && now - lastTracked < COOLDOWN_MS) {
        return res.status(200).json({ success: true, spend: null, deduplicated: true });
    }
    trackCooldown.set(cooldownKey, now);

    if (trackCooldown.size > 50000) {
        const cutoff = now - COOLDOWN_MS * 2;
        for (const [key, ts] of trackCooldown.entries()) {
            if (ts < cutoff) trackCooldown.delete(key);
        }
    }

    const ad = await Advertisement.findById(req.params.id).populate('createdBy', 'email name');

    if (!ad || ad.status !== 'Active') {
        return res.status(404).json({ success: false, message: 'Ad not active' });
    }

    // BUG FIX: correct field names — 'clicks' not 'click', 'views' not 'view'
    const analyticsField = type === 'click' ? 'analytics.clicks' : 'analytics.views';
    const cost = type === 'click' ? 1.0 : 0.05;

    const updatedAd = await Advertisement.findByIdAndUpdate(
        req.params.id,
        {
            $inc: { [analyticsField]: 1, 'budget.currentSpend': cost },
            $set: { 'analytics.lastEventAt': new Date() },
        },
        { new: true }
    );

    if (updatedAd.budget.currentSpend >= updatedAd.budget.totalMax) {
        updatedAd.status = 'Depleted';
        await updatedAd.save();

        const ownerEmail = ad.createdBy?.email;
        if (ownerEmail) {
            await sendEmail({
                email: ownerEmail,
                subject: '⚠️ Ad Budget Depleted',
                html: transactionalTemplate({
                    header: 'PAUSED',
                    title: updatedAd.adContent.headline,
                    body: 'Budget reached 100%. Campaign paused.',
                    buttonText: 'Manage Ads',
                    buttonLink: 'https://likeson.in/admin/ads',
                }),
            });
        }
    }

    res.status(200).json({ success: true, spend: updatedAd.budget.currentSpend });
}));

/** PUT /api/ads/:id — Admin: update ad */
router.put('/:id', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const updatedAd = await Advertisement.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );
    if (!updatedAd) return res.status(404).json({ success: false, message: 'Ad not found' });
    res.status(200).json({ success: true, data: updatedAd });
}));

/** DELETE /api/ads/:id — Admin: soft delete */
router.delete('/:id', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const ad = await Advertisement.findByIdAndUpdate(
        req.params.id,
        { status: 'Archived', updatedBy: req.user._id },
        { new: true }
    );
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    res.status(200).json({ success: true, message: 'Archived' });
}));

export default router;