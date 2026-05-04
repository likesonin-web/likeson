import express from 'express';
import Banner from '../models/Banner.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import cache from '../middleware/cache.js';
import { invalidatePattern } from '../utils/cacheInvalidation.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

const clearBannerCaches = async () => {
    await invalidatePattern('GET:/api/banners*');
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/banners/active?position=Home_Top&screen=mobile
 * @desc    Public: Fetch active banners for position + resolve image by screen
 * @screen  mobile | tablet | desktop (default: mobile)
 */
router.get(
    '/active',
    cache(60, (req) => {
        const pos = req.query.position || 'Home_Top';
        const screen = req.query.screen || 'mobile';
        // FIX: screen in cache key — mobile/desktop get different cached responses
        return `GET:/api/banners/active?position=${pos}&screen=${screen}`;
    }),
    asyncHandler(async (req, res) => {
        const { position, screen = 'mobile' } = req.query;
        const now = new Date();

        // FIX: removed $exists:false — startDate always set via default
        const query = {
            isActive: true,
            position: position || 'Home_Top',
            startDate: { $lte: now },
            $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gt: now } }
            ]
        };

        const banners = await Banner.find(query).sort({ priority: -1, createdAt: -1 });

        if (banners.length > 0) {
            Banner.updateMany(
                { _id: { $in: banners.map(b => b._id) } },
                { $inc: { 'analytics.views': 1 } }
            ).exec();
        }

        // FIX: resolve correct image per screen using imageFor() method
        const data = banners.map(b => {
            const obj = b.toObject({ virtuals: true });
            obj.resolvedImage = b.imageFor(screen); // e.g. desktop falls back to mobile
            return obj;
        });

        res.status(200).json({ success: true, data });
    })
);

/**
 * @route   GET /api/banners
 * @desc    Admin: Fetch ALL banners
 */
router.get(
    '/',
    protect,
    authorize('admin', 'superadmin'),
    cache(60),
    asyncHandler(async (req, res) => {
        const banners = await Banner.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email role')
            .populate('updatedBy', 'name email');

        res.status(200).json({ success: true, count: banners.length, data: banners });
    })
);

/**
 * @route   POST /api/banners
 * @desc    Admin: Create banner
 */
router.post(
    '/',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        // FIX: both createdBy + updatedBy set — schema requires both
        const banner = await Banner.create({
            ...req.body,
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        await clearBannerCaches();
        res.status(201).json({ success: true, data: banner });
    })
);

/**
 * @route   PATCH /api/banners/:id/click
 * @desc    Public: Increment click count
 */
router.patch(
    '/:id/click',
    asyncHandler(async (req, res) => {
        // FIX: check banner exists — silent fail on bad ID prevented
        const banner = await Banner.findByIdAndUpdate(
            req.params.id,
            { $inc: { 'analytics.clicks': 1 } },
            { new: true }
        );

        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

        res.status(200).json({ success: true });
    })
);

/**
 * @route   PUT /api/banners/:id
 * @desc    Admin: Update banner
 */
router.put(
    '/:id',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        // FIX: destructure out protected fields — prevent user overwriting audit/analytics
        const { createdBy, analytics, _id, __v, ...safeBody } = req.body;

        const banner = await Banner.findByIdAndUpdate(
            req.params.id,
            { ...safeBody, updatedBy: req.user._id },
            { new: true, runValidators: true }
        );

        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

        await clearBannerCaches();
        res.status(200).json({ success: true, data: banner });
    })
);

/**
 * @route   DELETE /api/banners/:id
 * @desc    Admin: Delete banner
 */
router.delete(
    '/:id',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

        await clearBannerCaches();
        res.status(200).json({ success: true, message: 'Banner removed successfully' });
    })
);

export default router;