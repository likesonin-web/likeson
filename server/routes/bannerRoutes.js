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

/**
 * Wipes out all banner-related caches.
 * Clears /api/banners/active?position=..., /api/banners, etc.
 */
const clearBannerCaches = async () => {
    await invalidatePattern('GET:/api/banners*');
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/banners/active
 * @desc    Public: Fetch valid banners for a specific UI position
 * Cached for 60 seconds based on position query param
 */
router.get('/active', cache(60, (req) => `GET:/api/banners/active?position=${req.query.position || 'Home_Top'}`), asyncHandler(async (req, res) => {
    const { position } = req.query;
    const now = new Date();

    const query = {
        isActive: true,
        position: position || 'Home_Top',
        $or: [
            { startDate: { $lte: now } },
            { startDate: { $exists: false } }
        ],
        $and: [
            {
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: { $gt: now } },
                    { endDate: null }
                ]
            }
        ]
    };

    const banners = await Banner.find(query).sort({ priority: -1, createdAt: -1 });

    // Background increment
    // Note: With caching enabled, this will only run when the cache expires and refreshes.
    if (banners.length > 0) {
        Banner.updateMany(
            { _id: { $in: banners.map(b => b._id) } },
            { $inc: { 'analytics.views': 1 } }
        ).exec();
    }

    res.status(200).json({ success: true, data: banners });
}));

/**
 * @route   GET /api/banners
 * @desc    Admin: Fetch ALL banners with creator details
 * Cached for 60 seconds
 */
router.get('/', protect, authorize('admin', 'superadmin'), cache(60), asyncHandler(async (req, res) => {
    const banners = await Banner.find()
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email role')
        .populate('updatedBy', 'name email');

    res.status(200).json({ 
        success: true, 
        count: banners.length, 
        data: banners 
    });
}));

/**
 * @route   POST /api/banners
 * @desc    Admin: Create New Banner
 */
router.post('/', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const banner = await Banner.create({
        ...req.body,
        createdBy: req.user._id
    });

    // Invalidate caches so the new banner appears immediately
    await clearBannerCaches();

    res.status(201).json({ success: true, data: banner });
}));

/**
 * @route   PATCH /api/banners/:id/click
 * @desc    Public: Increment Click Count
 */
router.patch('/:id/click', asyncHandler(async (req, res) => {
    await Banner.findByIdAndUpdate(req.params.id, { 
        $inc: { 'analytics.clicks': 1 } 
    });
    
    // Deliberately NOT invalidating the cache here to prevent cache thrashing.
    // The active banner list will still load fast, and clicks will update in the DB.
    // Admin dashboard might see up to 60s of cache delay for click stats, which is usually acceptable.

    res.status(200).json({ success: true });
}));

/**
 * @route   PUT /api/banners/:id
 * @desc    Admin: Update Banner Details
 */
router.put('/:id', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const banner = await Banner.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );

    if (!banner) return res.status(404).json({ message: "Banner not found" });
    
    // Invalidate caches to reflect updates (like text changes or toggling isActive)
    await clearBannerCaches();

    res.status(200).json({ success: true, data: banner });
}));

/**
 * @route   DELETE /api/banners/:id
 * @desc    Admin: Permanent Delete
 */
router.delete('/:id', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });
    
    // Invalidate caches to remove the deleted banner from active lists
    await clearBannerCaches();

    res.status(200).json({ success: true, message: "Banner removed successfully" });
}));

export default router;