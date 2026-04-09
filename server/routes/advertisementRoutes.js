import express from 'express';
import Advertisement from '../models/Advertisement.js';
import Notification from '../models/Notification.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';

const router = express.Router();

/**
 * @route   GET /api/ads
 * @desc    Admin: Fetch all ads
 */
router.get('/', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    const ads = await Advertisement.find(filter)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email');

    res.status(200).json({ success: true, count: ads.length, data: ads });
}));

/**
 * @route   POST /api/ads
 * @desc    Admin: Create Ad
 */
router.post('/', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const ad = await Advertisement.create({
        ...req.body,
        createdBy: req.user._id
    });

    await Notification.create({
        recipient: req.user._id,
        title: "Campaign Launched 🚀",
        body: `Ad "${ad.adContent.headline}" is now live.`,
        type: 'Promo_Marketing'
    });

    res.status(201).json({ success: true, data: ad });
}));

/**
 * @route   GET /api/ads/serve
 * @desc    User: Fetch Active Banners by Page/Slot
 */
router.get('/serve', protect, asyncHandler(async (req, res) => {
    const { page, slot } = req.query;
    const now = new Date();

    // 1. Maintenance: Archive expired ads
    await Advertisement.updateMany(
        { status: 'Active', 'schedule.endDate': { $lt: now } },
        { $set: { status: 'Archived' } }
    );

    // 2. Fetch Logic
    const query = {
        status: 'Active',
        'placement.page': page,
        'placement.slot': slot,
        'schedule.startDate': { $lte: now },
        $or: [
            { 'schedule.endDate': { $exists: false } },
            { 'schedule.endDate': { $gte: now } }
        ]
    };

    const ads = await Advertisement.find(query)
        .sort({ 'placement.priority': -1, createdAt: -1 })
        .limit(10);

    // 3. Final Budget Filter
    const validAds = ads.filter(ad => ad.budget.currentSpend < ad.budget.totalMax);

    res.status(200).json({ success: true, count: validAds.length, data: validAds });
}));

/**
 * @route   PATCH /api/ads/:id/track
 * @desc    Track Interaction & Budget
 */
router.patch('/:id/track', protect, asyncHandler(async (req, res) => {
    const { type } = req.body; // 'click' or 'view'
    const ad = await Advertisement.findById(req.params.id);

    if (!ad || ad.status !== 'Active') {
        return res.status(404).json({ success: false, message: "Ad not active" });
    }

    const cost = type === 'click' ? 1.0 : 0.05;

    const updatedAd = await Advertisement.findByIdAndUpdate(
        req.params.id,
        { 
            $inc: { [`analytics.${type}s`]: 1, 'budget.currentSpend': cost }, 
            $set: { 'analytics.lastEventAt': new Date() } 
        },
        { new: true }
    );

    // Check Depletion
    if (updatedAd.budget.currentSpend >= updatedAd.budget.totalMax) {
        updatedAd.status = 'Depleted';
        await updatedAd.save();

        // Alert Owner
        await sendEmail({
            email: req.user.email,
            subject: "⚠️ Ad Budget Depleted",
            html: transactionalTemplate({
                header: "PAUSED",
                title: updatedAd.adContent.headline,
                body: "Budget reached 100%. Campaign paused.",
                buttonText: "Manage Ads",
                buttonLink: "https://likeson.in/admin/ads"
            })
        });
    }

    res.status(200).json({ success: true, spend: updatedAd.budget.currentSpend });
}));

/**
 * @route   PUT /api/ads/:id
 * @desc    Admin: Update Ad
 */
router.put('/:id', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    const updatedAd = await Advertisement.findByIdAndUpdate(
        req.params.id, 
        { ...req.body, updatedBy: req.user._id }, 
        { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: updatedAd });
}));

/**
 * @route   DELETE /api/ads/:id
 * @desc    Admin: Soft Delete
 */
router.delete('/:id', protect, authorize('admin', 'superadmin'), asyncHandler(async (req, res) => {
    await Advertisement.findByIdAndUpdate(req.params.id, { 
        status: 'Archived', 
        updatedBy: req.user._id 
    });
    res.status(200).json({ success: true, message: "Archived" });
}));

export default router;