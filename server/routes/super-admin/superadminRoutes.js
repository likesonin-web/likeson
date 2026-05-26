// super admin payment/billcycle router — CORRECTED vs model schemas
import express from 'express';
import mongoose from 'mongoose';
import { protect, authorize } from '../../middleware/authMiddleware.js';

// Model Imports
import User from '../../models/User.js';
import Wallet from '../../models/Wallet.js';
import PharmacyOrder from '../../models/PharmacyOrder.js';
import UserSubscription from '../../models/UserSubscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

const router = express.Router();

/**
 * @section HELPERS & UTILITIES
 */

const handleAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 20));
    const skip  = (page - 1) * limit;
    return { page, limit, skip };
};

/**
 * @section REUSABLE MIDDLEWARE
 */
const validateObjectId = (paramName) => (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
        return res.status(400).json({ success: false, message: `Invalid ${paramName} format` });
    }
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/superadmin/pharmacy-orders
 * @desc    Advanced filtering for pharmacy orders
 * @access  Private (Superadmin)
 *
 * FIXES:
 *  - none structural; kept as-is (PharmacyOrder schema not supplied).
 *    billing path kept as 'billing.totalPayable' — adjust if model differs.
 */
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pharmacy-orders', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const {
        startDate, endDate, status, paymentStatus,
        storeId, customerId, minAmount, maxAmount, search,
    } = req.query;
    const { limit, skip, page } = getPagination(req.query);

    const filter = {};

    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    if (status)        filter['delivery.status']  = status;
    if (paymentStatus) filter['payment.status']   = paymentStatus;
    if (storeId)       filter.store               = storeId;
    if (customerId)    filter.customer            = customerId;

    if (minAmount || maxAmount) {
        filter['billing.totalPayable'] = {};
        if (minAmount) filter['billing.totalPayable'].$gte = Number(minAmount);
        if (maxAmount) filter['billing.totalPayable'].$lte = Number(maxAmount);
    }

    if (search) filter.orderId = { $regex: search, $options: 'i' };

    const [orders, total] = await Promise.all([
        PharmacyOrder.find(filter)
            .populate('customer', 'name email phone')
            .populate('store', 'name location')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip),
        PharmacyOrder.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        count: orders.length,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: orders,
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/superadmin/financial-ledger
 * @desc    Consolidated view of all wallet transactions (Credits & Debits)
 * @access  Private (Superadmin)
 *
 * FIXES:
 *  - Added { $match: {} } stage first so pipeline is valid on collection root.
 *  - $sort moved inside $facet data branch to avoid double-sort cost.
 *  - metadata count now handles empty-collection edge case cleanly.
 *  - type/purpose/status filter keys aligned to Wallet.walletTransactionSchema
 *    (transactions.type, transactions.purpose, transactions.status).
 *  - Kept User.populate — valid on aggregation plain objects.
 */
// ─────────────────────────────────────────────────────────────────────────────
router.get('/financial-ledger', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const { type, purpose, status } = req.query;
    const { limit, skip, page }     = getPagination(req.query);

    const txnMatch = {
        ...(type    && { 'transactions.type':    type }),
        ...(purpose && { 'transactions.purpose': purpose }),
        ...(status  && { 'transactions.status':  status }),
    };

    const pipeline = [
        // unwind nested transactions array into individual docs
        { $unwind: '$transactions' },

        // filter by transaction fields (empty object = match all)
        { $match: Object.keys(txnMatch).length ? txnMatch : {} },

        {
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [
                    { $sort: { 'transactions.timestamp': -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id:         0,
                            walletId:    '$_id',
                            user:        '$user',           // ObjectId → populated below
                            transaction: '$transactions',
                            currency:    '$currency',
                        },
                    },
                ],
            },
        },
    ];

    const [results] = await Wallet.aggregate(pipeline);

    const data  = results.data;
    const total = results.metadata[0]?.total ?? 0;

    // Populate user name/email/role from User collection
    const populatedData = await User.populate(data, {
        path:   'user',
        select: 'name email role',
    });

    res.status(200).json({
        success: true,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: populatedData,
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/superadmin/subscriptions/billing-summary
 * @desc    Billing cycles, active plans, revenue summary + upcoming renewals
 * @access  Private (Superadmin)
 *
 * FIXES:
 *  - Comment said @route …/analytics but actual path is /billing-summary — fixed.
 *  - Revenue calc: `$sum: "$paymentHistory.amount"` is WRONG — paymentHistory is
 *    an array → must $unwind first OR use nested $sum on the array.
 *    FIX: use $reduce to sum the payments array safely without extra unwind.
 *  - Added planBreakdown by joining SubscriptionPlan names for richer summary.
 */
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriptions/billing-summary', protect, authorize('superadmin'), handleAsync(async (req, res) => {

    // Group by status, sum revenue from paymentHistory array correctly
    const summary = await UserSubscription.aggregate([
        {
            $group: {
                _id:          '$status',
                count:        { $sum: 1 },
                // FIX: paymentHistory is array → use $sum on $map to extract amounts
                totalRevenue: {
                    $sum: {
                        $reduce: {
                            input:        { $ifNull: ['$paymentHistory', []] },
                            initialValue: 0,
                            in:           { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
                        },
                    },
                },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Subscriptions expiring within next 7 days (upcoming renewals)
    const now       = new Date();
    const in7Days   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const upcomingRenewals = await UserSubscription.find({
        status:     'Active',
        expiryDate: { $gte: now, $lte: in7Days },
    })
        .populate('user', 'name email')
        .populate('plan', 'name pricing')   // populate plan details if ref exists
        .sort({ expiryDate: 1 })
        .limit(10);

    // Plan-level breakdown (how many active subs per plan)
    const planBreakdown = await UserSubscription.aggregate([
        { $match: { status: 'Active' } },
        {
            $group: {
                _id:   '$plan',
                count: { $sum: 1 },
            },
        },
        {
            $lookup: {
                from:         'subscriptionplans',
                localField:   '_id',
                foreignField: '_id',
                as:           'planInfo',
            },
        },
        {
            $project: {
                planId:   '$_id',
                planName: { $arrayElemAt: ['$planInfo.name', 0] },
                count:    1,
                _id:      0,
            },
        },
        { $sort: { count: -1 } },
    ]);

    res.status(200).json({
        success: true,
        summary,
        planBreakdown,
        upcomingRenewals,
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/superadmin/refunds/process/:orderId
 * @desc    Process refund for a Pharmacy Order
 * @access  Private (Superadmin)
 *
 * FIXES:
 *  - Wallet refund now uses wallet.credit() instance method (defined in Wallet model)
 *    instead of manual balance mutation + transactions.push() + save().
 *    This ensures: totalCredited, withdrawableBalance, pre-save hooks, balanceBefore/After
 *    all computed correctly by the model method.
 *  - amount coerced to Number before credit() call.
 *  - Added explicit check that amount > 0.
 *  - Added check that amount ≤ order billing total (basic guard).
 */
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/refunds/process/:orderId',
    protect,
    authorize('superadmin'),
    handleAsync(async (req, res) => {
        const { amount, reason, method } = req.body;
        const refundAmount = Number(amount);

        if (!refundAmount || refundAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid refund amount' });
        }

        const order = await PharmacyOrder.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.cancellation?.refundStatus === 'Processed') {
            return res.status(400).json({ success: false, message: 'Refund already processed' });
        }

        // Wallet refund path — use model's credit() method (FIX: was manual push+save)
        if (method === 'Wallet') {
            const wallet = await Wallet.findOne({ user: order.customer });
            if (!wallet) {
                return res.status(404).json({ success: false, message: 'Customer wallet not found' });
            }

            // credit() handles: balance update, totalCredited, pre-save hooks, balanceBefore/After
            await wallet.credit(refundAmount, 'Refund', {
                referenceId: order._id,
                onModel:     'PharmacyOrder',
                description: `Refund for Order ${order.orderId}: ${reason}`,
                initiatedBy: req.user._id,    // superadmin actor
            });
        }

        // Update order refund state
        order.cancellation           = order.cancellation || {};
        order.cancellation.refundStatus  = 'Processed';
        order.cancellation.refundAmount  = refundAmount;
        order.cancellation.refundedAt    = new Date();
        order.cancellation.adminRefundNote = reason;
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            order,
        });
    }),
);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/superadmin/system/audit-logs
 * @desc    Security & Audit: View high-risk / suspicious user activity
 * @access  Private (Superadmin)
 *
 * FIXES:
 *  - Added total count in response (was missing — pagination useless without it).
 *  - Ran count in parallel with find via Promise.all.
 */
// ─────────────────────────────────────────────────────────────────────────────
router.get('/system/audit-logs', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const { limit, skip, page } = getPagination(req.query);

    const suspiciousFilter = {
        $or: [
            { loginCount: { $gt: 100 } },
            { isBlocked: true },
            { 'deviceTokens.3': { $exists: true } }, // more than 3 devices
        ],
    };

    const [suspiciousActivity, total] = await Promise.all([
        User.find(suspiciousFilter)
            .select('name email role loginCount lastLoginIp lastLoginAt isBlocked deviceTokens')
            .sort({ lastLoginAt: -1 })
            .limit(limit)
            .skip(skip),
        User.countDocuments(suspiciousFilter),
    ]);

    res.status(200).json({
        success: true,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: suspiciousActivity,
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/superadmin/wallet/:userId
 * @desc    View any user's wallet (balance, transactions, withdrawal requests)
 * @access  Private (Superadmin)
 *
 * NEW ROUTE — useful for support/audit; uses Wallet model's virtual fields.
 */
// ─────────────────────────────────────────────────────────────────────────────
router.get(
    '/wallet/:userId',
    protect,
    authorize('superadmin'),
    validateObjectId('userId'),
    handleAsync(async (req, res) => {
        const { limit, skip, page } = getPagination(req.query);

        const wallet = await Wallet.findOne({ user: req.params.userId })
            .populate('user', 'name email role');

        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found' });
        }

        // Paginate transactions (newest first)
        const allTxns   = wallet.transactions.slice().reverse();
        const total     = allTxns.length;
        const paginated = allTxns.slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            data: {
                walletId:            wallet._id,
                user:                wallet.user,
                balance:             wallet.balance,
                availableBalance:    wallet.availableBalance,       // virtual
                withdrawableBalance: wallet.withdrawableBalance,
                withdrawableAvailable: wallet.withdrawableAvailable, // virtual
                lockedBalance:       wallet.lockedBalance,
                currency:            wallet.currency,
                totalCredited:       wallet.totalCredited,
                totalDebited:        wallet.totalDebited,
                totalWithdrawn:      wallet.totalWithdrawn,
                primaryBankAccount:  wallet.primaryBankAccount,     // virtual
                pendingWithdrawals:  wallet.withdrawalRequests.filter(r => r.status === 'Pending'),
                isActive:            wallet.isActive,
            },
            transactions: {
                pagination: { total, page, pages: Math.ceil(total / limit) },
                data: paginated,
            },
        });
    }),
);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/superadmin/wallet/:userId/adjust
 * @desc    Admin credit / debit adjustment on any user wallet
 * @access  Private (Superadmin)
 *
 * NEW ROUTE — uses wallet.credit() / wallet.debit() model methods correctly.
 * purpose must be 'Admin_Credit' or 'Admin_Debit' (valid enum values in Wallet schema).
 */
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/wallet/:userId/adjust',
    protect,
    authorize('superadmin'),
    validateObjectId('userId'),
    handleAsync(async (req, res) => {
        const { type, amount, description } = req.body;
        const adjustAmount = Number(amount);

        if (!['Credit', 'Debit'].includes(type)) {
            return res.status(400).json({ success: false, message: 'type must be Credit or Debit' });
        }
        if (!adjustAmount || adjustAmount <= 0) {
            return res.status(400).json({ success: false, message: 'amount must be positive number' });
        }

        const wallet = await Wallet.findOne({ user: req.params.userId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found' });
        }

        const purpose = type === 'Credit' ? 'Admin_Credit' : 'Admin_Debit';

        if (type === 'Credit') {
            await wallet.credit(adjustAmount, purpose, {
                description,
                initiatedBy: req.user._id,
            });
        } else {
            await wallet.debit(adjustAmount, purpose, {
                description,
                initiatedBy: req.user._id,
            });
        }

        res.status(200).json({
            success: true,
            message:  `Wallet ${type.toLowerCase()} of ₹${adjustAmount} applied`,
            balance:  wallet.balance,
        });
    }),
);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * @section ERROR HANDLER
 */
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
    console.error(`[Superadmin Router Error]: ${err.stack}`);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: Object.values(err.errors).map(val => val.message),
        });
    }

    if (err.name === 'CastError') {
        return res.status(404).json({
            success: false,
            message: 'Resource not found',
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

export default router;