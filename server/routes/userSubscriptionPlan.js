import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';

// ── Models ────────────────────────────────────────────────────────────────────
import UserSubscription      from '../models/UserSubscription.js';
import SubscriptionPlan      from '../models/SubscriptionPlan.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import PromotionCoupon       from '../models/PromotionCoupon.js';
import Notification          from '../models/Notification.js';
import Wallet                from '../models/Wallet.js';

// ── Middleware ────────────────────────────────────────────────────────────────
import { protect, authorize } from '../middleware/authMiddleware.js';

dotenv.config();
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/** Wrap async route handlers */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Centralised express-validator result check */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — PLAN CATALOGUE  (read-only, customer-facing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/subscriptions/plans
 * @desc    List all active plans visible to the requesting customer.
 *          Fixed plans  → visible to everyone.
 *          Custom plans → visible only to the customer who created them.
 * @access  Private (customer, admin, superadmin)
 */
router.get(
    '/plans',
    protect,
    authorize('customer', 'admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

        const filter = isAdmin
            ? { isActive: true }
            : {
                isActive: true,
                $or: [
                    { visibleToCustomerOnly: false },
                    { visibleToCustomerOnly: true, createdByCustomer: req.user._id },
                ],
            };

        const plans = await SubscriptionPlan.find(filter)
            .sort({ displayOrder: 1 })
            .lean();

        res.status(200).json({ success: true, count: plans.length, data: plans });
    })
);

/**
 * @route   GET /api/v1/subscriptions/plans/:planId
 * @desc    Get a single plan by ID.
 * @access  Private (customer, admin, superadmin)
 */
router.get(
    '/plans/:planId',
    protect,
    authorize('customer', 'admin', 'superadmin'),
    [param('planId').isMongoId().withMessage('Invalid planId')],
    validate,
    asyncHandler(async (req, res) => {
        const plan = await SubscriptionPlan.findOne({
            _id:      req.params.planId,
            isActive: true,
        }).lean();

        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

        if (
            !isAdmin &&
            plan.visibleToCustomerOnly &&
            String(plan.createdByCustomer) !== String(req.user._id)
        ) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this plan.',
            });
        }

        res.status(200).json({ success: true, data: plan });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — CUSTOM PLAN BUILDER  (customer self-service)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/subscriptions/custom-plan/pricing
 * @desc    Return unit prices for each custom-plan option block.
 * @access  Private (customer)
 */
router.get(
    '/custom-plan/pricing',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const config = await PlatformPricingConfig.getGlobal();

        res.status(200).json({
            success: true,
            data: {
                unitPrices: config.customPlanOptions,
                caps:       config.caps,
            },
        });
    })
);

/**
 * @route   POST /api/v1/subscriptions/custom-plan
 * @desc    Customer builds a custom plan.
 * @access  Private (customer)
 */
router.post(
    '/custom-plan',
    protect,
    authorize('customer'),
    [
        body('name').trim().notEmpty().withMessage('Plan name is required'),
        body('options')
            .isArray({ min: 1 })
            .withMessage('At least one option must be selected'),
        body('options.*.optionKey')
            .isIn([
                'consultations', 'transport', 'diagnostics', 'pharmacy',
                'careAssistant', 'homeSampleCollection', 'prioritySupport',
            ])
            .withMessage('Invalid optionKey'),
        body('options.*.quantity')
            .isNumeric()
            .custom((v) => v >= 0)
            .withMessage('Quantity must be ≥ 0'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { name, options } = req.body;

        const config       = await PlatformPricingConfig.getGlobal();
        const optionPrices = config.customPlanOptions;
        const caps         = config.caps;

        const unitPriceMap = {
            consultations:        optionPrices.consultationPricePerUnit,
            transport:            optionPrices.transportRidePricePerUnit,
            diagnostics:          optionPrices.diagnosticsDiscountPricePerPercent,
            pharmacy:             optionPrices.pharmacyDiscountPricePerPercent,
            careAssistant:        optionPrices.careAssistantVisitPricePerUnit,
            homeSampleCollection: optionPrices.homeSampleCollectionFlatPrice,
            prioritySupport:      optionPrices.prioritySupportFlatPrice,
        };

        const builtOptions = [];

        for (const opt of options) {
            const { optionKey, quantity, label = '' } = opt;
            let qty = Number(quantity);

            if (optionKey === 'pharmacy'      && qty > caps.pharmacyDiscountMax)
                return res.status(400).json({ success: false, message: `Pharmacy discount cannot exceed ${caps.pharmacyDiscountMax}%.` });
            if (optionKey === 'diagnostics'   && qty > caps.diagnosticsDiscountMax)
                return res.status(400).json({ success: false, message: `Diagnostics discount cannot exceed ${caps.diagnosticsDiscountMax}%.` });
            if (optionKey === 'consultations' && qty > caps.consultationsMaxPerMonth)
                return res.status(400).json({ success: false, message: `Consultations cannot exceed ${caps.consultationsMaxPerMonth}/month.` });
            if (optionKey === 'careAssistant' && qty > caps.careAssistantMaxVisitsPerMonth)
                return res.status(400).json({ success: false, message: `Care-assistant visits cannot exceed ${caps.careAssistantMaxVisitsPerMonth}/month.` });
            if (optionKey === 'transport'     && qty > caps.transportMaxRidesPerMonth)
                return res.status(400).json({ success: false, message: `Transport rides cannot exceed ${caps.transportMaxRidesPerMonth}/month.` });

            if (['homeSampleCollection', 'prioritySupport'].includes(optionKey))
                qty = qty > 0 ? 1 : 0;

            const unitPrice = unitPriceMap[optionKey] ?? 0;
            builtOptions.push({
                optionKey,
                label:     label || optionKey,
                quantity:  qty,
                unitPrice,
                lineTotal: +(qty * unitPrice).toFixed(2),
            });
        }

        const totalMonthly = +builtOptions.reduce((s, o) => s + o.lineTotal, 0).toFixed(2);
        const slug         = `custom-${req.user._id}-${Date.now()}`;

        // Deactivate previous custom plans for this user
        await SubscriptionPlan.updateMany(
            { planType: 'custom', createdByCustomer: req.user._id, isActive: true },
            { $set: { isActive: false } }
        );

        const plan = await SubscriptionPlan.create({
            name,
            slug,
            planType:              'custom',
            fixedTier:             null,
            visibleToCustomerOnly: true,
            createdByCustomer:     req.user._id,
            isActive:              true,
            pricing: {
                monthly:      totalMonthly,
                billingCycle: 'custom',
                billingLabel: '/month',
                currency:     'INR',
            },
            customOptions: builtOptions,
        });

        res.status(201).json({ success: true, data: plan });
    })
);

/**
 * @route   PUT /api/v1/subscriptions/custom-plan/:planId
 * @desc    Update an existing custom plan (only by the owning customer).
 * @access  Private (customer)
 */
router.put(
    '/custom-plan/:planId',
    protect,
    authorize('customer'),
    [
        param('planId').isMongoId().withMessage('Invalid planId'),
        body('options')
            .isArray({ min: 1 })
            .withMessage('At least one option must be selected'),
        body('options.*.optionKey')
            .isIn([
                'consultations', 'transport', 'diagnostics', 'pharmacy',
                'careAssistant', 'homeSampleCollection', 'prioritySupport',
            ])
            .withMessage('Invalid optionKey'),
        body('options.*.quantity')
            .isNumeric()
            .custom((v) => v >= 0)
            .withMessage('Quantity must be ≥ 0'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const plan = await SubscriptionPlan.findOne({
            _id:               req.params.planId,
            planType:          'custom',
            createdByCustomer: req.user._id,
            isActive:          true,
        });

        if (!plan)
            return res.status(404).json({ success: false, message: 'Custom plan not found or you do not own it.' });

        const linked = await UserSubscription.exists({ plan: plan._id, status: 'Active' });
        if (linked)
            return res.status(400).json({ success: false, message: 'Cannot edit a custom plan that is currently active on a subscription.' });

        const { name, options } = req.body;

        const config       = await PlatformPricingConfig.getGlobal();
        const optionPrices = config.customPlanOptions;
        const caps         = config.caps;

        const unitPriceMap = {
            consultations:        optionPrices.consultationPricePerUnit,
            transport:            optionPrices.transportRidePricePerUnit,
            diagnostics:          optionPrices.diagnosticsDiscountPricePerPercent,
            pharmacy:             optionPrices.pharmacyDiscountPricePerPercent,
            careAssistant:        optionPrices.careAssistantVisitPricePerUnit,
            homeSampleCollection: optionPrices.homeSampleCollectionFlatPrice,
            prioritySupport:      optionPrices.prioritySupportFlatPrice,
        };

        const builtOptions = [];
        for (const opt of options) {
            const { optionKey, quantity, label = '' } = opt;
            let qty = Number(quantity);

            if (optionKey === 'pharmacy'      && qty > caps.pharmacyDiscountMax)
                return res.status(400).json({ success: false, message: `Pharmacy discount cannot exceed ${caps.pharmacyDiscountMax}%.` });
            if (optionKey === 'diagnostics'   && qty > caps.diagnosticsDiscountMax)
                return res.status(400).json({ success: false, message: `Diagnostics discount cannot exceed ${caps.diagnosticsDiscountMax}%.` });
            if (optionKey === 'consultations' && qty > caps.consultationsMaxPerMonth)
                return res.status(400).json({ success: false, message: `Consultations cannot exceed ${caps.consultationsMaxPerMonth}/month.` });
            if (optionKey === 'careAssistant' && qty > caps.careAssistantMaxVisitsPerMonth)
                return res.status(400).json({ success: false, message: `Care-assistant visits cannot exceed ${caps.careAssistantMaxVisitsPerMonth}/month.` });
            if (optionKey === 'transport'     && qty > caps.transportMaxRidesPerMonth)
                return res.status(400).json({ success: false, message: `Transport rides cannot exceed ${caps.transportMaxRidesPerMonth}/month.` });

            if (['homeSampleCollection', 'prioritySupport'].includes(optionKey))
                qty = qty > 0 ? 1 : 0;

            const unitPrice = unitPriceMap[optionKey] ?? 0;
            builtOptions.push({
                optionKey,
                label:     label || optionKey,
                quantity:  qty,
                unitPrice,
                lineTotal: +(qty * unitPrice).toFixed(2),
            });
        }

        if (name) plan.name = name;
        plan.customOptions = builtOptions;
        await plan.save(); // pre-save hook recomputes pricing.monthly

        res.status(200).json({ success: true, data: plan });
    })
);

/**
 * @route   DELETE /api/v1/subscriptions/custom-plan/:planId
 * @desc    Soft-delete (deactivate) a custom plan owned by the customer.
 * @access  Private (customer)
 */
router.delete(
    '/custom-plan/:planId',
    protect,
    authorize('customer'),
    [param('planId').isMongoId().withMessage('Invalid planId')],
    validate,
    asyncHandler(async (req, res) => {
        const plan = await SubscriptionPlan.findOne({
            _id:               req.params.planId,
            planType:          'custom',
            createdByCustomer: req.user._id,
            isActive:          true,
        });

        if (!plan)
            return res.status(404).json({ success: false, message: 'Custom plan not found or already inactive.' });

        const linked = await UserSubscription.exists({ plan: plan._id, status: 'Active' });
        if (linked)
            return res.status(400).json({ success: false, message: 'Cannot delete a plan linked to an active subscription.' });

        plan.isActive = false;
        await plan.save();

        res.status(200).json({ success: true, message: 'Custom plan deactivated.' });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — PURCHASE FLOW  (Razorpay + ₹0 free plans)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/subscriptions/buy
 * @desc    Initiate a purchase for the selected plan.
 *
 *          TWO paths:
 *            A) Amount > 0  → Create a Razorpay order; return orderId.
 *               Frontend opens Razorpay checkout, then calls /verify.
 *
 *            B) Amount === 0 (free plan / 100%-off coupon)
 *               → Activate subscription immediately WITHOUT Razorpay.
 *               Returns { success, activated: true, data: subscription }.
 *
 *          FIX: body('amount') now accepts 0 via isFloat({ min: 0 }) instead
 *          of isNumeric() so "0" passes validation.
 *
 * @access  Private (customer)
 */
router.post(
    '/buy',
    protect,
    authorize('customer'),
    [
        body('planId')
            .isMongoId()
            .withMessage('planId must be a valid Mongo ID'),
        body('amount')
            .isFloat({ min: 0 })
            .withMessage('amount must be a non-negative number'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { planId, amount, couponCode } = req.body;

        // ── Guard: no existing active/trial subscription ───────────────────────
        const existingSub = await UserSubscription.findOne({
            user:       req.user._id,
            status:     { $in: ['Active', 'Trial'] },
            expiryDate: { $gt: new Date() },
        });
        if (existingSub)
            return res.status(400).json({
                success: false,
                message: 'You already have an active subscription or trial.',
            });

        // ── Verify the plan ────────────────────────────────────────────────────
        const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        if (
            plan.planType === 'custom' &&
            String(plan.createdByCustomer) !== String(req.user._id)
        ) {
            return res.status(403).json({ success: false, message: 'You do not have access to this custom plan.' });
        }

        // ── Coupon discount ────────────────────────────────────────────────────
        let discount = 0;
        if (couponCode) {
            const coupon = await PromotionCoupon.findOne({
                code:          couponCode,
                isActive:      true,
                'validity.to': { $gt: new Date() },
            });
            if (coupon) {
                discount =
                    coupon.benefit.type === 'Flat_Amount'
                        ? coupon.benefit.value
                        : (Number(amount) * coupon.benefit.value) / 100;
            }
        }

        const finalAmount = Math.max(Number(amount) - discount, 0);

        // ── PATH B: free / ₹0 — activate immediately without Razorpay ─────────
        if (finalAmount === 0) {
            const expiry = new Date();
            if (plan.pricing.billingCycle === 'till_delivery') {
                expiry.setDate(expiry.getDate() + 280);
            } else {
                expiry.setDate(expiry.getDate() + 30);
            }

            const sub = await UserSubscription.create({
                user:       req.user._id,
                plan:       planId,
                status:     'Active',
                expiryDate: expiry,
                autoRenew:  plan.pricing.billingCycle !== 'till_delivery',
                paymentHistory: [], // no charge
            });

            await Notification.create({
                recipient: req.user._id,
                title:     'Subscription Activated 🎉',
                body:      `Your ${plan.name} plan is now active until ${expiry.toLocaleDateString()}.`,
                type:      'Account_Status',
                priority:  'Normal',
            });

            return res.status(201).json({
                success:   true,
                activated: true,          // flag so frontend knows no payment needed
                message:   'Subscription activated for free.',
                data:      sub,
            });
        }

        // ── PATH A: paid — create Razorpay order ───────────────────────────────
        const razorpayOrder = await razorpay.orders.create({
            amount:   Math.round(finalAmount * 100), // paise
            currency: 'INR',
            receipt:  `rcpt_${Date.now()}`,
            notes:    { userId: req.user._id.toString(), planId: planId.toString() },
        });

        res.status(200).json({
            success:   true,
            activated: false,
            orderId:   razorpayOrder.id,
            amount:    finalAmount,
            discount,
            planName:  plan.name,
            planType:  plan.planType,
            // Echo planId & amount so the frontend can include them in /verify body
            planId,
        });
    })
);

/**
 * @route   POST /api/v1/subscriptions/verify
 * @desc    Verify Razorpay payment signature and activate subscription.
 *
 *          FIX: planId and amount are now optional in the body — if missing
 *          the route resolves them from the Razorpay order notes.
 *          This prevents the "Invalid value" validation error when the
 *          frontend only sends the three Razorpay response fields.
 *
 * @access  Private (any authenticated user)
 */
router.post(
    '/verify',
    protect,
    [
        body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required'),
        body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required'),
        body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required'),
        // planId and amount are OPTIONAL — resolved from Razorpay order notes when absent
        body('planId').optional().isMongoId().withMessage('planId must be a valid Mongo ID'),
        body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        let { planId, amount } = req.body;

        // ── Signature verification ─────────────────────────────────────────────
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        if (hmac.digest('hex') !== razorpay_signature)
            return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

        // ── Resolve planId / amount from Razorpay order notes when not in body ─
        if (!planId || amount === undefined) {
            try {
                const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
                if (!planId)   planId = rzpOrder.notes?.planId;
                if (amount === undefined) amount = rzpOrder.amount / 100; // paise → ₹
            } catch (fetchErr) {
                return res.status(400).json({
                    success: false,
                    message: 'Could not resolve plan details from Razorpay order. Please supply planId and amount.',
                });
            }
        }

        if (!planId)
            return res.status(400).json({ success: false, message: 'planId is required.' });

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        if (
            plan.planType === 'custom' &&
            String(plan.createdByCustomer) !== String(req.user._id)
        ) {
            return res.status(403).json({ success: false, message: 'Access denied to this custom plan.' });
        }

        // ── Calculate expiry ───────────────────────────────────────────────────
        const expiry = new Date();
        if (plan.pricing.billingCycle === 'till_delivery') {
            expiry.setDate(expiry.getDate() + 280);
        } else {
            expiry.setDate(expiry.getDate() + 30);
        }

        // ── Create subscription ────────────────────────────────────────────────
        const sub = await UserSubscription.create({
            user:       req.user._id,
            plan:       planId,
            status:     'Active',
            expiryDate: expiry,
            autoRenew:  plan.pricing.billingCycle !== 'till_delivery',
            paymentHistory: [{
                transactionId: razorpay_payment_id,
                amount:        Number(amount),
                paidAt:        new Date(),
            }],
        });

        await Notification.create({
            recipient: req.user._id,
            title:     'Subscription Activated 🎉',
            body:      `Your ${plan.name} plan is now active until ${expiry.toLocaleDateString()}.`,
            type:      'Account_Status',
            priority:  'Normal',
        });

        res.status(201).json({ success: true, data: sub });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — CUSTOMER SUBSCRIPTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/subscriptions/my
 * @desc    Get the current user's most recent subscription with plan details.
 * @access  Private (customer)
 */
router.get(
    '/my',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const sub = await UserSubscription.findOne({ user: req.user._id })
            .populate('plan')
            .sort({ createdAt: -1 });

        if (!sub)
            return res.status(404).json({ success: false, message: 'No subscription found.' });

        res.status(200).json({ success: true, data: sub });
    })
);

/**
 * @route   GET /api/v1/subscriptions/my/history
 * @desc    Full subscription history for the logged-in customer (paginated).
 * @access  Private (customer)
 */
router.get(
    '/my/history',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const total = await UserSubscription.countDocuments({ user: req.user._id });
        const subs  = await UserSubscription.find({ user: req.user._id })
            .populate('plan')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       subs,
        });
    })
);

/**
 * @route   PUT /api/v1/subscriptions/upgrade
 * @desc    Upgrade/switch plan for the active or trial subscription.
 *
 *          FIX: now accepts status 'Active' OR 'Trial' so users on a free
 *          trial can upgrade to a different plan.
 *          When upgrading from a Trial the new plan is paid via Razorpay
 *          through the normal /buy → /verify flow.  This endpoint handles
 *          the plan-swap after payment has already been verified.
 *
 * @access  Private (customer)
 */
router.put(
    '/upgrade',
    protect,
    authorize('customer'),
    [body('newPlanId').isMongoId().withMessage('newPlanId must be a valid Mongo ID')],
    validate,
    asyncHandler(async (req, res) => {
        // Accept both Active and Trial statuses
        const sub = await UserSubscription.findOne({
            user:   req.user._id,
            status: { $in: ['Active', 'Trial'] },
        });
        if (!sub)
            return res.status(400).json({ success: false, message: 'No active or trial subscription found.' });

        const newPlan = await SubscriptionPlan.findOne({
            _id:      req.body.newPlanId,
            isActive: true,
        });
        if (!newPlan)
            return res.status(404).json({ success: false, message: 'New plan not found.' });

        if (
            newPlan.planType === 'custom' &&
            String(newPlan.createdByCustomer) !== String(req.user._id)
        ) {
            return res.status(403).json({ success: false, message: 'You do not have access to this custom plan.' });
        }

        const previousStatus = sub.status;
        sub.plan      = newPlan._id;
        sub.status    = 'Active'; // upgrading from trial → always becomes Active
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        sub.expiryDate = newExpiry;
        // If upgrading FROM trial, mark trialUsed (already true but ensure consistency)
        if (previousStatus === 'Trial') sub.trialUsed = true;
        await sub.save();

        await Notification.create({
            recipient: req.user._id,
            title:     'Plan Upgraded',
            body:      `Your plan has been switched to ${newPlan.name}. New expiry: ${newExpiry.toLocaleDateString()}.`,
            type:      'Account_Status',
            priority:  'Normal',
        });

        res.status(200).json({ success: true, data: sub });
    })
);

/**
 * @route   PUT /api/v1/subscriptions/cancel
 * @desc    Customer cancels their active or trial subscription.
 * @access  Private (customer)
 */
router.put(
    '/cancel',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const sub = await UserSubscription.findOne({
            user:   req.user._id,
            status: { $in: ['Active', 'Trial'] },
        });
        if (!sub)
            return res.status(400).json({ success: false, message: 'No active or trial subscription to cancel.' });

        sub.status    = 'Cancelled';
        sub.autoRenew = false;
        await sub.save();

        await Notification.create({
            recipient: req.user._id,
            title:     'Subscription Cancelled',
            body:      'Your subscription has been cancelled. You retain access until the current period ends.',
            type:      'Account_Status',
            priority:  'Normal',
        });

        res.status(200).json({ success: true, message: 'Subscription cancelled.', data: sub });
    })
);

/**
 * @route   PUT /api/v1/subscriptions/toggle-auto-renew
 * @desc    Toggle the autoRenew flag on the active subscription.
 * @access  Private (customer)
 */
router.put(
    '/toggle-auto-renew',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const sub = await UserSubscription.findOne({
            user:   req.user._id,
            status: 'Active',
        });
        if (!sub)
            return res.status(400).json({ success: false, message: 'No active subscription found.' });

        sub.autoRenew = !sub.autoRenew;
        await sub.save();

        res.status(200).json({
            success:   true,
            autoRenew: sub.autoRenew,
            message:   `Auto-renew ${sub.autoRenew ? 'enabled' : 'disabled'}.`,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — FREE TRIAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/subscriptions/free-trial/start
 * @desc    Customer starts a free trial.
 *
 *          Rules:
 *            1. Plan must have freeTrial.enabled === true.
 *            2. Customer must never have used a trial (lifetime trialUsed flag).
 *            3. No currently active subscription or trial.
 *            4. If freeTrial.requiresPaymentMethod === true, a
 *               razorpay_payment_method_id must be supplied.
 *            5. Trial status = 'Trial'; NO Razorpay charge is made here.
 *               The trial is always ₹0 at start.
 *
 * @access  Private (customer)
 */
router.post(
    '/free-trial/start',
    protect,
    authorize('customer'),
    [
        body('planId')
            .isMongoId()
            .withMessage('planId must be a valid Mongo ID'),
        body('razorpay_payment_method_id')
            .optional()
            .isString()
            .withMessage('razorpay_payment_method_id must be a string'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { planId, razorpay_payment_method_id } = req.body;

        // 1. Plan validation
        const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        if (!plan.freeTrial?.enabled)
            return res.status(400).json({ success: false, message: 'This plan does not offer a free trial.' });

        if (
            plan.planType === 'custom' &&
            String(plan.createdByCustomer) !== String(req.user._id)
        ) {
            return res.status(403).json({ success: false, message: 'You do not have access to this custom plan.' });
        }

        // 2. Lifetime trial check
        const previousTrial = await UserSubscription.findOne({
            user:      req.user._id,
            trialUsed: true,
        });
        if (previousTrial)
            return res.status(400).json({
                success: false,
                message: 'You have already used your free trial. Each account is eligible for one trial only.',
            });

        // 3. No currently active / in-trial subscription
        const activeSub = await UserSubscription.findOne({
            user:       req.user._id,
            status:     { $in: ['Active', 'Trial'] },
            expiryDate: { $gt: new Date() },
        });
        if (activeSub)
            return res.status(400).json({ success: false, message: 'You already have an active subscription or ongoing trial.' });

        // 4. Payment method gate
        if (plan.freeTrial.requiresPaymentMethod && !razorpay_payment_method_id)
            return res.status(400).json({ success: false, message: 'This plan requires a saved payment method to start a free trial.' });

        // 5. Compute expiry
        const trialDays   = plan.freeTrial.durationDays || 7;
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + trialDays);

        // 6. Create Trial subscription — ₹0, no Razorpay call
        const sub = await UserSubscription.create({
            user:       req.user._id,
            plan:       plan._id,
            status:     'Trial',
            expiryDate: trialExpiry,
            autoRenew:  false,
            trialUsed:  true,
            ...(razorpay_payment_method_id && { savedPaymentMethodId: razorpay_payment_method_id }),
            paymentHistory: [],
        });

        await Notification.create({
            recipient: req.user._id,
            title:     `Your ${trialDays}-Day Free Trial Has Started!`,
            body:      `Enjoy full access to ${plan.name} until ${trialExpiry.toLocaleDateString()}. Subscribe before your trial ends to continue uninterrupted.`,
            type:      'Account_Status',
            priority:  'Normal',
        });

        try {
            const emailHtml = transactionalTemplate({
                header:     'FREE TRIAL',
                title:      'Your Free Trial is Active',
                body:       `Hi ${req.user.name},<br><br>Your <b>${trialDays}-day free trial</b> for the <b>${plan.name}</b> plan is now active.<br><br>Trial ends on: <b>${trialExpiry.toLocaleDateString()}</b>.`,
                buttonText: 'Explore Your Plan',
                buttonLink: 'https://likeson.in/dashboard/subscription',
            });
            await sendEmail({ email: req.user.email, subject: `Your ${trialDays}-day free trial for ${plan.name} is now active`, html: emailHtml });
        } catch (_) { /* email failure must not block response */ }

        res.status(201).json({
            success:     true,
            message:     `Free trial started. Enjoy ${trialDays} days of ${plan.name}.`,
            trialExpiry,
            data:        sub,
        });
    })
);

/**
 * @route   GET /api/v1/subscriptions/free-trial/eligibility
 * @desc    Check whether the requesting customer is eligible to start a free trial.
 * @access  Private (customer)
 */
router.get(
    '/free-trial/eligibility',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const previous = await UserSubscription.findOne({ user: req.user._id, trialUsed: true });

        if (previous) {
            return res.status(200).json({
                success:       true,
                eligible:      false,
                reason:        'Free trial already used. Each account is eligible for one trial only.',
                eligiblePlans: [],
            });
        }

        const activeSub = await UserSubscription.findOne({
            user:       req.user._id,
            status:     { $in: ['Active', 'Trial'] },
            expiryDate: { $gt: new Date() },
        }).populate('plan', 'name fixedTier');

        if (activeSub) {
            return res.status(200).json({
                success:       true,
                eligible:      false,
                reason:        `You currently have an active ${activeSub.status === 'Trial' ? 'trial' : 'subscription'} (${activeSub.plan?.name || 'plan'}).`,
                eligiblePlans: [],
            });
        }

        const eligiblePlans = await SubscriptionPlan.find({
            isActive:            true,
            'freeTrial.enabled': true,
            planType:            'fixed',
        })
            .select('name slug fixedTier freeTrial pricing badgeLabel')
            .sort({ displayOrder: 1 })
            .lean();

        res.status(200).json({ success: true, eligible: true, reason: null, eligiblePlans });
    })
);

/**
 * @route   GET /api/v1/subscriptions/free-trial/status
 * @desc    Get the current trial status for the logged-in customer.
 * @access  Private (customer)
 */
router.get(
    '/free-trial/status',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const trial = await UserSubscription.findOne({
            user:   req.user._id,
            status: 'Trial',
        }).populate('plan');

        if (!trial)
            return res.status(404).json({ success: false, activeTrial: false, message: 'No active trial found.' });

        const now      = new Date();
        const daysLeft = Math.max(Math.ceil((trial.expiryDate - now) / (1000 * 60 * 60 * 24)), 0);

        res.status(200).json({
            success:     true,
            activeTrial: trial.expiryDate > now,
            daysLeft,
            trialExpiry: trial.expiryDate,
            plan:        trial.plan,
            data:        trial,
        });
    })
);

/**
 * @route   POST /api/v1/subscriptions/free-trial/convert
 * @desc    Convert an active trial into a paid subscription via Razorpay.
 *
 *          TWO paths (mirrors /buy logic):
 *            A) plan.pricing.monthly > 0 → create Razorpay order; return orderId.
 *            B) plan.pricing.monthly === 0 (or 100%-off coupon)
 *               → activate immediately, return { activated: true }.
 *
 * @access  Private (customer)
 */
router.post(
    '/free-trial/convert',
    protect,
    authorize('customer'),
    [body('couponCode').optional().isString()],
    validate,
    asyncHandler(async (req, res) => {
        const { couponCode } = req.body;

        const trial = await UserSubscription.findOne({
            user:   req.user._id,
            status: 'Trial',
        }).populate('plan');

        if (!trial)
            return res.status(400).json({ success: false, message: 'No active trial found to convert.' });

        const plan   = trial.plan;
        let   amount = plan.pricing.monthly;

        // Coupon discount
        let discount = 0;
        if (couponCode) {
            const coupon = await PromotionCoupon.findOne({
                code:          couponCode,
                isActive:      true,
                'validity.to': { $gt: new Date() },
            });
            if (coupon) {
                discount =
                    coupon.benefit.type === 'Flat_Amount'
                        ? coupon.benefit.value
                        : (amount * coupon.benefit.value) / 100;
            }
        }

        const finalAmount = Math.max(amount - discount, 0);

        // PATH B: ₹0 — activate immediately
        if (finalAmount === 0) {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 30);

            trial.status    = 'Active';
            trial.expiryDate = newExpiry;
            trial.autoRenew = true;
            await trial.save();

            await Notification.create({
                recipient: req.user._id,
                title:     'Trial Converted — Welcome Aboard! 🎉',
                body:      `Your ${plan.name} subscription is now fully active until ${newExpiry.toLocaleDateString()}.`,
                type:      'Account_Status',
                priority:  'Normal',
            });

            return res.status(200).json({
                success:    true,
                activated:  true,
                message:    'Trial converted to a free paid subscription.',
                data:       trial,
            });
        }

        // PATH A: paid — create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount:   Math.round(finalAmount * 100),
            currency: 'INR',
            receipt:  `trial_conv_${Date.now()}`,
            notes:    {
                userId:         req.user._id.toString(),
                planId:         plan._id.toString(),
                isTrialConvert: 'true',
            },
        });

        res.status(200).json({
            success:    true,
            activated:  false,
            message:    'Complete payment to convert your trial to a paid subscription.',
            orderId:    razorpayOrder.id,
            amount:     finalAmount,
            discount,
            planName:   plan.name,
            trialSubId: trial._id,
        });
    })
);

/**
 * @route   POST /api/v1/subscriptions/free-trial/verify-convert
 * @desc    Verify Razorpay payment for a trial-to-paid conversion.
 *          Upgrades the existing Trial UserSubscription to Active.
 *
 *          FIX: amount is now optional — resolved from Razorpay order when absent.
 *
 * @access  Private (customer)
 */
router.post(
    '/free-trial/verify-convert',
    protect,
    authorize('customer'),
    [
        body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required'),
        body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required'),
        body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required'),
        body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        let { amount } = req.body;

        // Signature verification
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        if (hmac.digest('hex') !== razorpay_signature)
            return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

        // Resolve amount from Razorpay when not supplied
        if (amount === undefined) {
            try {
                const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
                amount = rzpOrder.amount / 100;
            } catch (_) {
                amount = 0;
            }
        }

        // Find the active trial
        const trial = await UserSubscription.findOne({
            user:   req.user._id,
            status: 'Trial',
        }).populate('plan');

        if (!trial)
            return res.status(400).json({ success: false, message: 'No active trial found for this account.' });

        // Upgrade Trial → Active
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);

        trial.status     = 'Active';
        trial.expiryDate = newExpiry;
        trial.autoRenew  = true;
        trial.paymentHistory.push({
            transactionId: razorpay_payment_id,
            amount:        Number(amount),
            paidAt:        new Date(),
        });
        await trial.save();

        await Notification.create({
            recipient: req.user._id,
            title:     'Trial Converted — Welcome Aboard! 🎉',
            body:      `Your ${trial.plan?.name} subscription is now fully active until ${newExpiry.toLocaleDateString()}.`,
            type:      'Account_Status',
            priority:  'Normal',
        });

        try {
            const emailHtml = transactionalTemplate({
                header:     'SUBSCRIPTION ACTIVE',
                title:      'Your Trial Has Been Converted',
                body:       `Hi ${req.user.name},<br><br>Your <b>${trial.plan?.name}</b> subscription is now active.<br><br>Next renewal: <b>${newExpiry.toLocaleDateString()}</b>.`,
                buttonText: 'Go to Dashboard',
                buttonLink: 'https://likeson.in/dashboard/subscription',
            });
            await sendEmail({ email: req.user.email, subject: `Subscription Confirmed — ${trial.plan?.name}`, html: emailHtml });
        } catch (_) { /* email failure must not block response */ }

        res.status(200).json({
            success: true,
            message: 'Trial successfully converted to a paid subscription.',
            data:    trial,
        });
    })
);

/**
 * @route   POST /api/v1/subscriptions/free-trial/expire-stale
 * @desc    Cron: Expire all Trial subscriptions whose expiryDate has passed.
 * @access  Private (admin, superadmin)
 */
router.post(
    '/free-trial/expire-stale',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const now = new Date();

        const staleTrials = await UserSubscription.find({
            status:     'Trial',
            expiryDate: { $lt: now },
        })
            .populate('user', 'name email')
            .populate('plan', 'name pricing');

        let expiredCount = 0;
        const logs = [];

        for (const trial of staleTrials) {
            trial.status    = 'Expired';
            trial.autoRenew = false;
            await trial.save();
            expiredCount++;

            await Notification.create({
                recipient: trial.user._id,
                title:     'Your Free Trial Has Ended',
                body:      `Your free trial for ${trial.plan?.name || 'your plan'} has expired. Subscribe now to continue enjoying all benefits.`,
                type:      'Account_Status',
                priority:  'High',
            });

            try {
                const emailHtml = transactionalTemplate({
                    header:     'TRIAL ENDED',
                    title:      'Your Free Trial Has Expired',
                    body:       `Hi ${trial.user.name},<br><br>Your free trial for <b>${trial.plan?.name}</b> has ended.<br><br>Subscribe now for just <b>₹${trial.plan?.pricing?.monthly}/month</b> to continue accessing all benefits.`,
                    buttonText: 'Subscribe Now',
                    buttonLink: 'https://likeson.in/dashboard/subscription',
                });
                await sendEmail({ email: trial.user.email, subject: `Your free trial for ${trial.plan?.name} has expired`, html: emailHtml });
                logs.push({ userId: trial.user._id, email: trial.user.email, status: 'Success' });
            } catch (err) {
                logs.push({ userId: trial.user._id, email: trial.user.email, status: 'Failed', error: err.message });
            }
        }

        res.status(200).json({ success: true, expiredCount, details: logs });
    })
);

/**
 * @route   GET /api/v1/subscriptions/admin/trials
 * @desc    Admin: paginated list of all Trial subscriptions.
 * @access  Private (admin, superadmin)
 */
router.get(
    '/admin/trials',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const page   = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const filter = { trialUsed: true };

        if (req.query.status) filter.status = req.query.status;
        if (req.query.userId) filter.user   = req.query.userId;

        const total  = await UserSubscription.countDocuments(filter);
        const trials = await UserSubscription.find(filter)
            .populate('user', 'name email phone')
            .populate('plan', 'name fixedTier pricing freeTrial')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       trials,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — CRON / SYSTEM JOBS  (admin / superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/subscriptions/send-expiry-alerts
 * @desc    Cron: Email + in-app notification to users expiring within 7 days.
 * @access  Private (admin, superadmin)
 */
router.post(
    '/send-expiry-alerts',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const today            = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(today.getDate() + 7);

        const expiringSoon = await UserSubscription.find({
            status:     'Active',
            expiryDate: { $gte: today, $lte: sevenDaysFromNow },
        })
            .populate('user')
            .populate('plan');

        let sentCount = 0;
        const logs    = [];

        for (const sub of expiringSoon) {
            const daysLeft = Math.ceil((sub.expiryDate - today) / (1000 * 60 * 60 * 24));

            await Notification.create({
                recipient: sub.user._id,
                title:     'Subscription Expiring Soon!',
                body:      `Your ${sub.plan?.name || 'Membership'} expires in ${daysLeft} day(s). Renew now to avoid interruption.`,
                type:      'Account_Status',
                priority:  'High',
            });

            try {
                const emailHtml = transactionalTemplate({
                    header:     'REMINDER',
                    title:      'Your Membership is Expiring',
                    body:       `Hello ${sub.user.name},<br><br>Your <b>${sub.plan?.name}</b> subscription expires on <b>${sub.expiryDate.toLocaleDateString()}</b> (${daysLeft} day(s) left).<br><br>Renew today to continue enjoying all benefits without any interruption.`,
                    buttonText: 'Renew Now',
                    buttonLink: 'https://likeson.in/dashboard/subscription',
                });
                await sendEmail({ email: sub.user.email, subject: `Reminder: Your subscription expires in ${daysLeft} day(s)`, html: emailHtml });
                sentCount++;
                logs.push({ userId: sub.user._id, email: sub.user.email, status: 'Success' });
            } catch (err) {
                logs.push({ userId: sub.user._id, email: sub.user.email, status: 'Failed', error: err.message });
            }
        }

        res.status(200).json({ success: true, totalProcessed: expiringSoon.length, totalEmailsSent: sentCount, details: logs });
    })
);

/**
 * @route   POST /api/v1/subscriptions/auto-renew-trigger
 * @desc    Cron: Auto-renew subscriptions expiring within 24 hours using wallet balance.
 * @access  Private (admin, superadmin)
 */
router.post(
    '/auto-renew-trigger',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const expiring = await UserSubscription.find({
            status:     'Active',
            autoRenew:  true,
            expiryDate: { $lte: cutoff },
        }).populate('plan');

        const results = { renewed: [], expired: [], skipped: [] };

        for (const sub of expiring) {
            if (sub.plan?.pricing?.billingCycle === 'till_delivery') {
                results.skipped.push(sub._id);
                continue;
            }

            const wallet        = await Wallet.findOne({ user: sub.user });
            const renewalAmount = sub.plan?.pricing?.monthly ?? 500;

            if (wallet && wallet.balance >= renewalAmount) {
                wallet.balance -= renewalAmount;
                sub.expiryDate  = new Date(sub.expiryDate.getTime() + 30 * 24 * 60 * 60 * 1000);

                await wallet.save();
                await sub.save();

                await Notification.create({
                    recipient: sub.user,
                    title:     'Subscription Auto-Renewed',
                    body:      `₹${renewalAmount} deducted from your wallet. Your plan is active until ${sub.expiryDate.toLocaleDateString()}.`,
                    type:      'Account_Status',
                    priority:  'Normal',
                });

                results.renewed.push(sub._id);
            } else {
                sub.status    = 'Expired';
                sub.autoRenew = false;
                await sub.save();

                await Notification.create({
                    recipient: sub.user,
                    title:     'Subscription Expired',
                    body:      'Insufficient wallet balance for auto-renewal. Your subscription has expired.',
                    type:      'Account_Status',
                    priority:  'High',
                });

                results.expired.push(sub._id);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Auto-renewal process complete.',
            summary: {
                renewed: results.renewed.length,
                expired: results.expired.length,
                skipped: results.skipped.length,
            },
            details: results,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 7 — ADMIN PLAN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/subscriptions/admin/all
 * @desc    Paginated list of ALL UserSubscription records.
 * @access  Private (admin, superadmin)
 */
router.get(
    '/admin/all',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const page   = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const filter = {};

        if (req.query.status) filter.status = req.query.status;
        if (req.query.userId) filter.user   = req.query.userId;

        const total = await UserSubscription.countDocuments(filter);
        const subs  = await UserSubscription.find(filter)
            .populate('user', 'name email phone role')
            .populate('plan')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       subs,
        });
    })
);

/**
 * @route   GET /api/v1/subscriptions/admin/plans
 * @desc    Admin: list all SubscriptionPlan documents.
 * @access  Private (admin, superadmin)
 */
router.get(
    '/admin/plans',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const filter = {};
        if (req.query.planType !== undefined) filter.planType = req.query.planType;
        if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

        const plans = await SubscriptionPlan.find(filter)
            .populate('createdByCustomer', 'name email')
            .sort({ displayOrder: 1, createdAt: -1 });

        res.status(200).json({ success: true, count: plans.length, data: plans });
    })
);

/**
 * @route   POST /api/v1/subscriptions/admin/plans
 * @desc    Admin: create a FIXED subscription plan.
 * @access  Private (admin, superadmin)
 */
router.post(
    '/admin/plans',
    protect,
    authorize('admin', 'superadmin'),
    [
        body('name').trim().notEmpty().withMessage('name is required'),
        body('slug').trim().notEmpty().withMessage('slug is required'),
        body('fixedTier')
            .isIn(['Basic Care', 'Premium Care', 'Family Care', 'Pregnant Women Care', "NRI's Care"])
            .withMessage('Invalid fixedTier'),
        body('pricing.monthly').isNumeric().withMessage('pricing.monthly is required'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const existing = await SubscriptionPlan.findOne({ slug: req.body.slug });
        if (existing)
            return res.status(409).json({ success: false, message: 'A plan with this slug already exists.' });

        const plan = await SubscriptionPlan.create({
            ...req.body,
            planType:              'fixed',
            visibleToCustomerOnly: false,
            createdByCustomer:     null,
            createdBy:             req.user._id,
        });

        res.status(201).json({ success: true, data: plan });
    })
);

/**
 * @route   PUT /api/v1/subscriptions/admin/plans/:planId
 * @desc    Admin: update any plan (fixed or custom).
 * @access  Private (admin, superadmin)
 */
router.put(
    '/admin/plans/:planId',
    protect,
    authorize('admin', 'superadmin'),
    [param('planId').isMongoId().withMessage('Invalid planId')],
    validate,
    asyncHandler(async (req, res) => {
        const forbidden = ['planType', 'createdByCustomer', 'customOptions', 'slug'];
        forbidden.forEach((f) => delete req.body[f]);

        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.planId,
            { ...req.body, updatedBy: req.user._id },
            { new: true, runValidators: true }
        );

        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        res.status(200).json({ success: true, data: plan });
    })
);

/**
 * @route   DELETE /api/v1/subscriptions/admin/plans/:planId
 * @desc    Admin: soft-delete (deactivate) any plan.
 * @access  Private (superadmin only)
 */
router.delete(
    '/admin/plans/:planId',
    protect,
    authorize('superadmin'),
    [param('planId').isMongoId().withMessage('Invalid planId')],
    validate,
    asyncHandler(async (req, res) => {
        const plan = await SubscriptionPlan.findByIdAndUpdate(
            req.params.planId,
            { isActive: false, updatedBy: req.user._id },
            { new: true }
        );

        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        res.status(200).json({ success: true, message: 'Plan deactivated.', data: plan });
    })
);

/**
 * @route   PUT /api/v1/subscriptions/admin/subscriptions/:subId
 * @desc    Admin: manually override a UserSubscription.
 * @access  Private (admin, superadmin)
 */
router.put(
    '/admin/subscriptions/:subId',
    protect,
    authorize('admin', 'superadmin'),
    [param('subId').isMongoId().withMessage('Invalid subId')],
    validate,
    asyncHandler(async (req, res) => {
        const allowed = ['status', 'expiryDate', 'autoRenew', 'plan'];
        const patch   = {};
        allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });

        const sub = await UserSubscription.findByIdAndUpdate(
            req.params.subId,
            patch,
            { new: true, runValidators: true }
        ).populate('user plan');

        if (!sub)
            return res.status(404).json({ success: false, message: 'Subscription not found.' });

        res.status(200).json({ success: true, data: sub });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL ERROR HANDLER  (must be last)
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
    console.error('[SubscriptionRouter Error]', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error.' });
});

export default router;