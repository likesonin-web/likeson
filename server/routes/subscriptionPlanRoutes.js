import express from 'express';
import mongoose from 'mongoose';

// Models
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import UserSubscription from '../models/UserSubscription.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Utilities & Middleware
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * INTERNAL HELPERS & REUSABLE LOGIC
 * ─────────────────────────────────────────────────────────────────────────────
 */

const logger = {
    info: (msg, meta = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta),
    error: (msg, meta = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta),
    warn: (msg, meta = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, meta),
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ROUTE HANDLERS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @route   POST /api/v1/plans
 * @desc    Create a new subscription plan
 * @access  Private/Admin
 */
router.post('/', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const plan = await SubscriptionPlan.create(req.body);

    // Notify internal stakeholders
    const admins = await User.find({ role: { $in: ['superadmin', 'admin'] } }).select('_id');
    const notifications = admins.map(admin => ({
        recipient: admin._id,
        title: 'New Offering Launched',
        body: `Healthcare plan "${plan.name}" is now live.`,
        type: 'Promo_Marketing',
        priority: 'Medium',
        actionData: { screen: 'PLAN_MANAGEMENT', referenceId: plan._id }
    }));
    await Notification.insertMany(notifications);

    logger.info('New subscription plan created', { planId: plan._id, adminId: req.user._id });
    res.status(201).json({ success: true, data: plan });
}));

/**
 * @route   GET /api/v1/plans
 * @desc    Get all active subscription plans with pagination
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const plans = await SubscriptionPlan.find({ isActive: true })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit);

    const total = await SubscriptionPlan.countDocuments({ isActive: true });

    res.status(200).json({
        success: true,
        count: plans.length,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: plans
    });
}));

/**
 * @route   GET /api/v1/plans/active-subscriptions
 * @desc    Admin: View all users with active subscriptions (Enterprise Analytics)
 * @access  Private/Admin
 */
router.get('/active-subscriptions', protect, authorize('superadmin', 'admin', 'finance'), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const activeSubs = await UserSubscription.aggregate([
        { $match: { status: 'Active', expiryDate: { $gte: new Date() } } },
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: '$userDetails' },
        {
            $lookup: {
                from: 'subscriptionplans',
                localField: 'plan',
                foreignField: '_id',
                as: 'planDetails'
            }
        },
        { $unwind: '$planDetails' },
        {
            $project: {
                _id: 1,
                status: 1,
                expiryDate: 1,
                userName: '$userDetails.name',
                userEmail: '$userDetails.email',
                planName: '$planDetails.name',
                usage: '$usageThisMonth'
            }
        },
        { $skip: (page - 1) * limit },
        { $limit: limit }
    ]);

    res.status(200).json({ success: true, count: activeSubs.length, data: activeSubs });
}));

/**
 * @route   DELETE /api/v1/plans/:id
 * @desc    Soft delete a plan
 * @access  Private/Admin
 */
router.delete('/:id', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    await Notification.create({
        recipient: req.user._id,
        title: 'Plan Deactivated',
        body: `Access to ${plan.name} has been restricted.`,
        type: 'Account_Status',
        priority: 'High'
    });

    res.status(200).json({ success: true, message: "Plan disabled" });
}));

// Error Handling Middleware (Centralized for this Router)
router.use((err, req, res, next) => {
    logger.error('Plan Router Error', { 
        path: req.path, 
        message: err.message, 
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

export default router;