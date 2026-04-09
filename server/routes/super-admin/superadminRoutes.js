// super admin payment/billcylce router 
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
 * Logic maintained within the router for production-grade data handling.
 */

const handleAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const getPagination = (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

/**
 * @section REUSABLE MIDDLEWARE (Internal)
 */
const validateObjectId = (paramName) => (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
        return res.status(400).json({ success: false, message: `Invalid ${paramName} format` });
    }
    next();
};

/**
 * @route   GET /api/superadmin/pharmacy-orders
 * @desc    Advanced filtering for pharmacy orders (Date range, status, payment, store)
 * @access  Private (Superadmin)
 */
router.get('/pharmacy-orders', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const { startDate, endDate, status, paymentStatus, storeId, customerId, minAmount, maxAmount, search } = req.query;
    const { limit, skip, page } = getPagination(req.query);

    let filter = {};

    // Date Range Filtering
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Status Enums
    if (status) filter['delivery.status'] = status;
    if (paymentStatus) filter['payment.status'] = paymentStatus;
    
    // Relational Filtering
    if (storeId) filter.store = storeId;
    if (customerId) filter.customer = customerId;

    // Financial Range
    if (minAmount || maxAmount) {
        filter['billing.totalPayable'] = {};
        if (minAmount) filter['billing.totalPayable'].$gte = Number(minAmount);
        if (maxAmount) filter['billing.totalPayable'].$lte = Number(maxAmount);
    }

    // Search by OrderID
    if (search) {
        filter.orderId = { $regex: search, $options: 'i' };
    }

    const orders = await PharmacyOrder.find(filter)
        .populate('customer', 'name email phone')
        .populate('store', 'name location')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

    const total = await PharmacyOrder.countDocuments(filter);

    res.status(200).json({
        success: true,
        count: orders.length,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: orders
    });
}));

/**
 * @route   GET /api/superadmin/financial-ledger
 * @desc    Consolidated view of all transactions (Wallets, Credits, Debits)
 * @access  Private (Superadmin)
 */
router.get('/financial-ledger', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const { type, purpose, status } = req.query;
    const { limit, skip, page } = getPagination(req.query);

    // Using Aggregation to unwind nested transactions from all wallets for a master view
    const pipeline = [
        { $unwind: "$transactions" },
        {
            $match: {
                ...(type && { "transactions.type": type }),
                ...(purpose && { "transactions.purpose": purpose }),
                ...(status && { "transactions.status": status })
            }
        },
        { $sort: { "transactions.timestamp": -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 0,
                            walletId: "$_id",
                            user: "$user",
                            transaction: "$transactions",
                            currency: "$currency"
                        }
                    }
                ]
            }
        }
    ];

    const results = await Wallet.aggregate(pipeline);
    const data = results[0].data;
    const total = results[0].metadata[0]?.total || 0;

    // Populate user details for the master list
    const populatedData = await User.populate(data, { path: 'user', select: 'name email role' });

    res.status(200).json({
        success: true,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: populatedData
    });
}));

/**
 * @route   GET /api/superadmin/subscriptions/analytics
 * @desc    Billing cycles, active plans, and revenue summary
 * @access  Private (Superadmin)
 */
router.get('/subscriptions/billing-summary', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const summary = await UserSubscription.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalRevenue: { $sum: { $sum: "$paymentHistory.amount" } }
            }
        }
    ]);

    const upcomingRenewals = await UserSubscription.find({
        status: 'Active',
        expiryDate: { 
            $gte: new Date(), 
            $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
        }
    }).populate('user', 'name email').limit(10);

    res.status(200).json({
        success: true,
        summary,
        upcomingRenewals
    });
}));

/**
 * @route   POST /api/superadmin/refunds/process
 * @desc    Handle refund logic for Pharmacy Orders
 * @access  Private (Superadmin)
 */
router.post('/refunds/process/:orderId', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const { amount, reason, method } = req.body;
    const order = await PharmacyOrder.findOne({ orderId: req.params.orderId });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.cancellation.refundStatus === 'Processed') {
        return res.status(400).json({ message: "Refund already processed" });
    }

    // Process Wallet Refund if method is Wallet
    if (method === 'Wallet') {
        const wallet = await Wallet.findOne({ user: order.customer });
        if (!wallet) return res.status(404).json({ message: "Customer wallet not found" });

        const balanceBefore = wallet.balance;
        wallet.balance += Number(amount);
        
        wallet.transactions.push({
            type: 'Credit',
            amount: amount,
            purpose: 'Refund',
            referenceId: order._id,
            onModel: 'PharmacyOrder',
            balanceBefore,
            balanceAfter: wallet.balance,
            description: `Refund for Order ${order.orderId}: ${reason}`
        });

        await wallet.save();
    }

    // Update Order Refund State
    order.cancellation.refundStatus = 'Processed';
    order.cancellation.refundAmount = amount;
    order.cancellation.refundedAt = new Date();
    order.cancellation.adminRefundNote = reason;
    await order.save();

    res.status(200).json({ success: true, message: "Refund processed successfully", order });
}));

/**
 * @route   GET /api/superadmin/system/audit-logs
 * @desc    Security & Audit: View high-risk user activities
 * @access  Private (Superadmin)
 */
router.get('/system/audit-logs', protect, authorize('superadmin'), handleAsync(async (req, res) => {
    const { limit, skip, page } = getPagination(req.query);

    // Fetching users with multiple device tokens or high login counts as a proxy for audit logs
    const suspiciousActivity = await User.find({
        $or: [
            { loginCount: { $gt: 100 } },
            { isBlocked: true },
            { 'deviceTokens.3': { $exists: true } } // Users with more than 3 devices
        ]
    })
    .select('name email role loginCount lastLoginIp lastLoginAt isBlocked deviceTokens')
    .sort({ lastLoginAt: -1 })
    .limit(limit)
    .skip(skip);

    res.status(200).json({
        success: true,
        data: suspiciousActivity
    });
}));

/**
 * @section ERROR HANDLER
 * Centralized error management for the Superadmin scope
 */
router.use((err, req, res, next) => {
    console.error(`[Superadmin Router Error]: ${err.stack}`);
    
    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: Object.values(err.errors).map(val => val.message)
        });
    }

    // Cast Error (Invalid ID)
    if (err.name === 'CastError') {
        return res.status(404).json({
            success: false,
            message: 'Resource not found'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

export default router;