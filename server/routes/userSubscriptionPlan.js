/**
 * subscriptionRouter.js — Likeson.in
 *
 * FIXES IN THIS VERSION:
 *  BUG #1 FIXED: resolveCustomOptionUnitPrice transport case — dead b.km replaced with slab index lookup
 *  BUG #2 FIXED: snapshotLimits now reads customOptions for custom plans (consultations, careAssistant, transport)
 *  BUG #3 FIXED: incrementSubscriptionUsage moved to post-payment via subscriptionUsagePending on Booking
 *                (this router exposes POST /flush-pending-usage called by verify-payment route)
 *
 * Other corrections retained from previous version:
 *  1. customPlanOptions unit-price resolution fixed to match actual
 *     PlatformPricingConfig.customPlanOptions schema fields
 *  2. SystemLog imported and wired to every mutating/sensitive route
 *  3. UserSubscription.create now snapshots planName, planType,
 *     fixedTier, and limits from the plan at purchase time
 *  4. Admin controls pricing — customer READ-ONLY access to pricing enforced
 *  5. /upgrade also snapshots limits on plan change
 */

import express                         from 'express';
import { body, param, validationResult } from 'express-validator';
import Razorpay                        from 'razorpay';
import crypto                          from 'crypto';
import dotenv                          from 'dotenv';

import sendEmail                       from '../utils/sendEmail.js';
import { transactionalTemplate }       from '../utils/emailTemplates.js';

// ── Models ────────────────────────────────────────────────────────────────────
import UserSubscription      from '../models/UserSubscription.js';
import SubscriptionPlan      from '../models/SubscriptionPlan.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import PromotionCoupon       from '../models/PromotionCoupon.js';
import Notification          from '../models/Notification.js';
import Wallet                from '../models/Wallet.js';
import SystemLog             from '../models/SystemLog.js';
import Booking               from '../models/Booking.js';

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

/** Wrap async route handlers — no unhandled rejections */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Centralised express-validator result check */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });
    next();
};

/**
 * resolveClientIp — works behind reverse proxies (trust proxy enabled on app).
 */
const resolveClientIp = (req) =>
    (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .toString()
        .split(',')[0]
        .trim();

/**
 * buildActor — standard actor block for SystemLog from an authenticated request.
 */
const buildActor = (req) => ({
    userId:    req.user?._id   ?? null,
    name:      req.user?.name  ?? 'system',
    email:     req.user?.email ?? null,
    role:      req.user?.role  ?? 'anonymous',
    ip:        resolveClientIp(req),
    userAgent: req.headers['user-agent'] ?? null,
    platform:  detectPlatform(req),
});

const detectPlatform = (req) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (ua.includes('android'))                       return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    if (ua.includes('electron'))                      return 'desktop';
    if (req.headers['x-platform'])                    return req.headers['x-platform'];
    return 'web';
};

/**
 * log — fire-and-forget SystemLog wrapper.
 * Never throws; never blocks the request.
 */
const log = (payload) => SystemLog.createLog(payload).catch(() => null);

// ─────────────────────────────────────────────────────────────────────────────
//  PRICING HELPERS  (customPlanOptions — admin-controlled)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolveCustomOptionUnitPrice
 *
 * BUG #1 FIX: transport case previously used b.km / s.km which do not exist
 * in the schema (schema only has pricePerKm + packagePrice).
 * Fixed: use slab index directly. qty for transport = slabIndex (0-based).
 * lineTotal = slab.packagePrice (flat bundle price for that slab).
 *
 * extras.careAssistantTierIndex — index into customPlanOptions.careAssistant.pricingTiers
 * extras.slabIndex              — index into transport.kmSlabs (for transport option)
 */
const resolveCustomOptionUnitPrice = (optionPrices, optionKey, quantity, extras = {}) => {
    let unitPrice = 0;

    switch (optionKey) {
        case 'consultations': {
            unitPrice = optionPrices?.consultation?.pricePerConsultation ?? 0;
            break;
        }

        case 'transport': {
            // BUG #1 FIX: use slabIndex not s.km / b.km (those fields don't exist)
            const slabs = optionPrices?.transport?.kmSlabs ?? [];
            if (slabs.length > 0) {
                // qty/slabIndex is the 0-based index the customer selected
                const idx  = Math.max(0, Math.min(Math.floor(Number(extras.slabIndex ?? quantity ?? 0)), slabs.length - 1));
                const slab = slabs[idx];
                if (slab) {
                    // unitPrice = packagePrice (flat monthly bundle price for this slab)
                    // lineTotal = packagePrice (not qty × unitPrice — flat bundle)
                    unitPrice = slab.packagePrice ?? 0;
                }
            }
            break;
        }

        case 'diagnostics': {
            const slabs = optionPrices?.diagnosticsDiscount?.slabs ?? [];
            if (slabs.length > 0) {
                const exact = slabs.find((s) => s.percent === quantity);
                if (exact) {
                    unitPrice = exact.price;
                } else {
                    const floor = [...slabs]
                        .sort((a, b) => b.percent - a.percent)
                        .find((s) => s.percent <= quantity);
                    unitPrice = floor?.price ?? 0;
                }
            }
            break;
        }

        case 'pharmacy': {
            const slabs = optionPrices?.pharmacyDiscount?.slabs ?? [];
            if (slabs.length > 0) {
                const exact = slabs.find((s) => s.percent === quantity);
                if (exact) {
                    unitPrice = exact.price;
                } else {
                    const floor = [...slabs]
                        .sort((a, b) => b.percent - a.percent)
                        .find((s) => s.percent <= quantity);
                    unitPrice = floor?.price ?? 0;
                }
            }
            break;
        }

        case 'careAssistant': {
            // Use the tier index the customer selected, not always tiers[0]
            const caTiers = optionPrices?.careAssistant?.pricingTiers ?? [];
            if (caTiers.length > 0) {
                const tierIdx = Number(extras.careAssistantTierIndex ?? 0);
                const tier    = caTiers[tierIdx] ?? caTiers[0];
                unitPrice     = tier?.chargeToUser ?? 0;
            }
            // lineTotal = qty (visits) × unitPrice (chargeToUser per visit)
            break;
        }

        case 'homeSampleCollection': {
            unitPrice = optionPrices?.addOns?.homeSampleCollection ?? 199;
            break;
        }

        case 'prioritySupport': {
            unitPrice = optionPrices?.addOns?.prioritySupport ?? 99;
            break;
        }

        default:
            unitPrice = 0;
    }

    return unitPrice;
};


/**
 * snapshotLimits
 *
 * BUG #2 FIX: previously always read fixed plan fields, returning 0
 * for custom plan consultation/careAssistant quotas even when customer
 * paid for them via customOptions. Now reads customOptions for custom plans.
 *
 * Pull the plan's benefit limits into a flat object for storage on
 * UserSubscription.limits at purchase time.
 */
const snapshotLimits = (plan) => {
    // Start with fixed plan defaults
    let consultationsPerMonth       = plan.consultations?.freePerMonth        ?? 0;
    let careAssistantVisitsPerMonth = plan.careAssistant?.visitsPerMonth      ?? null;
    let transportRatePerKm          = plan.transport?.ratePerKm               ?? null;
    let transportRidesPerMonth      = plan.transport?.ridesPerMonth           ?? null;
    let pharmacyDiscountPercent     = plan.pharmacy?.discountMin ?? plan.pharmacy?.discountMax ?? 0;
    let diagnosticsDiscountPercent  = plan.diagnostics?.discountPercent       ?? 0;
    let homeSampleCollection        = plan.diagnostics?.homeSampleCollection  ?? false;

    // BUG #2 FIX: for custom plans, override with values from customOptions
    // because fixed plan fields are null/0 for custom plans — the real values
    // live in customOptions[].quantity
    if (plan.planType === 'custom' && Array.isArray(plan.customOptions)) {
        const consultOpt = plan.customOptions.find(o => o.optionKey === 'consultations');
        if (consultOpt?.quantity > 0) {
            consultationsPerMonth = consultOpt.quantity;
        }

        const caOpt = plan.customOptions.find(o => o.optionKey === 'careAssistant');
        if (caOpt?.quantity > 0) {
            careAssistantVisitsPerMonth = caOpt.quantity;
        }

        // Transport: unitPrice stored on option = pricePerKm for this slab
        // We snapshot it as transportRatePerKm so resolveKmRate can read it
        const tOpt = plan.customOptions.find(o => o.optionKey === 'transport');
        if (tOpt?.unitPrice > 0) {
            // For transport option, unitPrice = packagePrice (flat bundle),
            // but sub.limits.transportRatePerKm is used by resolveKmRate.
            // We store the pricePerKm from the slab — need to resolve from plan
            // At snapshot time we don't have full slab data, so use unitPrice as rate.
            // resolveKmRate in shared will read sub.limits.transportRatePerKm.
            // NOTE: unitPrice for transport = packagePrice not pricePerKm.
            // The actual pricePerKm must be pulled from the slab at booking time.
            // We flag transportRatePerKm = -1 to signal "custom transport option active"
            // and resolveKmRate will look up the actual rate from the plan's customOptions.
            transportRatePerKm = -1; // sentinel: custom transport active, look up from plan
        }

        const diagOpt = plan.customOptions.find(o => o.optionKey === 'diagnostics');
        if (diagOpt?.quantity > 0) {
            diagnosticsDiscountPercent = diagOpt.quantity; // quantity = discount %
        }

        const pharmOpt = plan.customOptions.find(o => o.optionKey === 'pharmacy');
        if (pharmOpt?.quantity > 0) {
            pharmacyDiscountPercent = pharmOpt.quantity;
        }

        const homeOpt = plan.customOptions.find(o => o.optionKey === 'homeSampleCollection');
        if (homeOpt?.quantity > 0) {
            homeSampleCollection = true;
        }
    }

    return {
        consultationsPerMonth,
        transportRidesPerMonth,
        careAssistantVisitsPerMonth,
        labTestsPerMonth:            0,
        pharmacyDiscountPercent,
        diagnosticsDiscountPercent,
        transportRatePerKm,
        homeSampleCollection,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — PLAN CATALOGUE  (read-only, customer-facing)
// ─────────────────────────────────────────────────────────────────────────────

router.get(
    '/plans',
    asyncHandler(async (req, res) => {
        const plans = await SubscriptionPlan.find({
            isActive:              true,
            visibleToCustomerOnly: false,
        })
            .sort({ displayOrder: 1 })
            .lean();

        res.status(200).json({ success: true, count: plans.length, data: plans });
    })
);

/**
 * GET /api/v1/subscriptions/plans/:planId
 * Single plan by ID.
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
            return res.status(403).json({ success: false, message: 'You do not have access to this plan.' });
        }

        res.status(200).json({ success: true, data: plan });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — CUSTOM PLAN BUILDER  (customer self-service)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/subscriptions/custom-plan/pricing
 *
 * Returns admin-controlled pricing for custom plan option blocks.
 * Customers READ pricing — they CANNOT set it.
 * Admin sets pricing via PlatformPricingConfig.customPlanOptions.
 */
router.get(
    '/custom-plan/pricing',
    protect,
    authorize('customer', 'admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const config = await PlatformPricingConfig.getGlobal();

        res.status(200).json({
            success: true,
            data: {
                optionPricing: config.customPlanOptions,
                caps:          config.caps,
            },
        });
    })
);

/**
 * POST /api/v1/subscriptions/custom-plan
 * Customer builds a custom plan.
 * Unit prices resolved server-side from PlatformPricingConfig.
 * Supports careAssistantTierIndex + slabIndex extras.
 */
router.post(
    '/custom-plan',
    protect,
    authorize('customer'),
    [
        body('name').trim().notEmpty().withMessage('Plan name is required'),
        body('options.*.slabIndex')
            .optional()
            .isInt({ min: 0 })
            .withMessage('slabIndex must be a non-negative integer'),
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
            .isFloat({ min: 0 })
            .withMessage('Quantity must be ≥ 0'),
        body('options.*.careAssistantTierIndex')
            .optional()
            .isInt({ min: 0 })
            .withMessage('careAssistantTierIndex must be a non-negative integer'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { name, options } = req.body;

        const config       = await PlatformPricingConfig.getGlobal();
        const optionPrices = config.customPlanOptions;
        const caps         = config.caps;

        const caTiers = optionPrices?.careAssistant?.pricingTiers ?? [];

        const builtOptions = [];

        for (const opt of options) {
            const { optionKey, label = '' } = opt;
            let qty = Number(opt.quantity);

            // ── Cap enforcement ───────────────────────────────────────────────
            if (optionKey === 'pharmacy' && qty > caps.pharmacyDiscountMax)
                return res.status(400).json({ success: false, message: `Pharmacy discount cannot exceed ${caps.pharmacyDiscountMax}%.` });
            if (optionKey === 'diagnostics' && qty > caps.diagnosticsDiscountMax)
                return res.status(400).json({ success: false, message: `Diagnostics discount cannot exceed ${caps.diagnosticsDiscountMax}%.` });
            if (optionKey === 'consultations' && qty > caps.consultationsMaxPerMonth)
                return res.status(400).json({ success: false, message: `Consultations cannot exceed ${caps.consultationsMaxPerMonth}/month.` });
            if (optionKey === 'careAssistant' && qty > caps.careAssistantMaxVisitsPerMonth)
                return res.status(400).json({ success: false, message: `Care-assistant visits cannot exceed ${caps.careAssistantMaxVisitsPerMonth}/month.` });
            if (optionKey === 'transport' && qty > caps.transportMaxRidesPerMonth)
                return res.status(400).json({ success: false, message: `Transport rides cannot exceed ${caps.transportMaxRidesPerMonth}/month.` });

            // Boolean add-ons: clamp to 0 or 1
            if (['homeSampleCollection', 'prioritySupport'].includes(optionKey))
                qty = qty > 0 ? 1 : 0;

            // ── Resolve extras ────────────────────────────────────────────────

            // careAssistant: validate tier index against actual tiers array
            let careAssistantTierIndex = 0;
            if (optionKey === 'careAssistant') {
                const requestedIdx = Number(opt.careAssistantTierIndex ?? 0);
                if (caTiers.length === 0)
                    return res.status(400).json({ success: false, message: 'Care assistant pricing tiers not configured. Contact admin.' });
                if (requestedIdx < 0 || requestedIdx >= caTiers.length)
                    return res.status(400).json({ success: false, message: `careAssistantTierIndex must be between 0 and ${caTiers.length - 1}.` });
                careAssistantTierIndex = requestedIdx;
            }

            // BUG #1 FIX: transport uses slabIndex not qty as km distance band
            let slabIndex = 0;
            if (optionKey === 'transport') {
                const totalSlabs       = (optionPrices?.transport?.kmSlabs ?? []).length;
                const requestedSlabIdx = Number(opt.slabIndex ?? 0);
                if (totalSlabs === 0)
                    return res.status(400).json({ success: false, message: 'Transport slabs not configured. Contact admin.' });
                if (requestedSlabIdx < 0 || requestedSlabIdx >= totalSlabs)
                    return res.status(400).json({ success: false, message: `slabIndex must be between 0 and ${totalSlabs - 1}.` });
                slabIndex = requestedSlabIdx;
                qty       = slabIndex; // qty for transport = slab index (used as index in resolveCustomOptionUnitPrice)
            }

            const extras    = { careAssistantTierIndex, slabIndex };
            const unitPrice = resolveCustomOptionUnitPrice(optionPrices, optionKey, qty, extras);

            // BUG #1 FIX: transport lineTotal = packagePrice (flat), not qty × unitPrice
            const lineTotal = optionKey === 'transport'
                ? unitPrice   // unitPrice = packagePrice = flat bundle price
                : +(qty * unitPrice).toFixed(2);

            builtOptions.push({
                optionKey,
                label:    label || optionKey,
                quantity: qty,
                unitPrice,
                lineTotal,
                ...(optionKey === 'careAssistant' && { careAssistantTierIndex }),
                ...(optionKey === 'transport'     && { slabIndex }),
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
            createdBy:     req.user._id,
        });

        await log({
            level:    'success',
            category: 'user',
            message:  `Custom plan created by customer: ${plan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'SubscriptionPlan', entityId: plan._id, label: plan.name },
            request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
            metadata: { planId: plan._id, totalMonthly, optionCount: builtOptions.length },
        });

        res.status(201).json({ success: true, data: plan });
    })
);

/**
 * PUT /api/v1/subscriptions/custom-plan/:planId
 * Update an existing custom plan (owning customer only).
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
            .isFloat({ min: 0 })
            .withMessage('Quantity must be ≥ 0'),
        body('options.*.careAssistantTierIndex')
            .optional()
            .isInt({ min: 0 })
            .withMessage('careAssistantTierIndex must be a non-negative integer'),
        body('options.*.slabIndex')
            .optional()
            .isInt({ min: 0 })
            .withMessage('slabIndex must be a non-negative integer'),
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

        const linked = await UserSubscription.exists({
            plan:   plan._id,
            status: { $in: ['Active', 'Trial'] },
        });
        if (linked)
            return res.status(400).json({ success: false, message: 'Cannot edit a custom plan linked to an active or trial subscription.' });

        const { name, options } = req.body;

        const config       = await PlatformPricingConfig.getGlobal();
        const optionPrices = config.customPlanOptions;
        const caps         = config.caps;

        const caTiers = optionPrices?.careAssistant?.pricingTiers ?? [];

        const builtOptions = [];

        for (const opt of options) {
            const { optionKey, label = '' } = opt;
            let qty = Number(opt.quantity);

            // ── Cap enforcement ───────────────────────────────────────────────
            if (optionKey === 'pharmacy' && qty > caps.pharmacyDiscountMax)
                return res.status(400).json({ success: false, message: `Pharmacy discount cannot exceed ${caps.pharmacyDiscountMax}%.` });
            if (optionKey === 'diagnostics' && qty > caps.diagnosticsDiscountMax)
                return res.status(400).json({ success: false, message: `Diagnostics discount cannot exceed ${caps.diagnosticsDiscountMax}%.` });
            if (optionKey === 'consultations' && qty > caps.consultationsMaxPerMonth)
                return res.status(400).json({ success: false, message: `Consultations cannot exceed ${caps.consultationsMaxPerMonth}/month.` });
            if (optionKey === 'careAssistant' && qty > caps.careAssistantMaxVisitsPerMonth)
                return res.status(400).json({ success: false, message: `Care-assistant visits cannot exceed ${caps.careAssistantMaxVisitsPerMonth}/month.` });
            if (optionKey === 'transport' && qty > caps.transportMaxRidesPerMonth)
                return res.status(400).json({ success: false, message: `Transport rides cannot exceed ${caps.transportMaxRidesPerMonth}/month.` });

            // Boolean add-ons: clamp to 0 or 1
            if (['homeSampleCollection', 'prioritySupport'].includes(optionKey))
                qty = qty > 0 ? 1 : 0;

            // ── Resolve extras ────────────────────────────────────────────────
            let careAssistantTierIndex = 0;
            if (optionKey === 'careAssistant') {
                const requestedIdx = Number(opt.careAssistantTierIndex ?? 0);
                if (caTiers.length === 0)
                    return res.status(400).json({ success: false, message: 'Care assistant pricing tiers not configured. Contact admin.' });
                if (requestedIdx < 0 || requestedIdx >= caTiers.length)
                    return res.status(400).json({ success: false, message: `careAssistantTierIndex must be between 0 and ${caTiers.length - 1}.` });
                careAssistantTierIndex = requestedIdx;
            }

            // BUG #1 FIX: transport slabIndex
            let slabIndex = 0;
            if (optionKey === 'transport') {
                const totalSlabs       = (optionPrices?.transport?.kmSlabs ?? []).length;
                const requestedSlabIdx = Number(opt.slabIndex ?? 0);
                if (totalSlabs === 0)
                    return res.status(400).json({ success: false, message: 'Transport slabs not configured. Contact admin.' });
                if (requestedSlabIdx < 0 || requestedSlabIdx >= totalSlabs)
                    return res.status(400).json({ success: false, message: `slabIndex must be between 0 and ${totalSlabs - 1}.` });
                slabIndex = requestedSlabIdx;
                qty       = slabIndex;
            }

            const extras    = { careAssistantTierIndex, slabIndex };
            const unitPrice = resolveCustomOptionUnitPrice(optionPrices, optionKey, qty, extras);

            // BUG #1 FIX: transport lineTotal = packagePrice (flat)
            const lineTotal = optionKey === 'transport'
                ? unitPrice
                : +(qty * unitPrice).toFixed(2);

            builtOptions.push({
                optionKey,
                label:    label || optionKey,
                quantity: qty,
                unitPrice,
                lineTotal,
                ...(optionKey === 'careAssistant' && { careAssistantTierIndex }),
                ...(optionKey === 'transport'     && { slabIndex }),
            });
        }

        if (name) plan.name = name;
        plan.customOptions = builtOptions;
        plan.updatedBy     = req.user._id;
        await plan.save(); // pre-save recomputes pricing.monthly from lineTotal sum

        await log({
            level:    'info',
            category: 'user',
            message:  `Custom plan updated by customer`,
            actor:    buildActor(req),
            relatedEntity: { model: 'SubscriptionPlan', entityId: plan._id, label: plan.name },
            request:  { method: 'PUT', path: req.originalUrl, statusCode: 200 },
            metadata: { planId: plan._id, newTotal: plan.pricing.monthly },
        });

        res.status(200).json({ success: true, data: plan });
    })
);

/**
 * DELETE /api/v1/subscriptions/custom-plan/:planId
 * Soft-delete custom plan (owning customer only).
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

        const linked = await UserSubscription.exists({ plan: plan._id, status: { $in: ['Active', 'Trial'] } });
        if (linked)
            return res.status(400).json({ success: false, message: 'Cannot delete a plan linked to an active subscription.' });

        plan.isActive  = false;
        plan.updatedBy = req.user._id;
        await plan.save();

        await log({
            level:    'warning',
            category: 'user',
            message:  `Custom plan deactivated by customer`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: plan._id, label: plan.name },
            request:  { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
        });

        res.status(200).json({ success: true, message: 'Custom plan deactivated.' });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — PURCHASE FLOW  (Razorpay + ₹0 free plans)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/subscriptions/buy
 *
 * PATH A: amount > 0  → Razorpay order; return orderId
 * PATH B: amount === 0 → activate immediately
 */
router.post(
    '/buy',
    protect,
    authorize('customer'),
    [
        body('planId').isMongoId().withMessage('planId must be a valid Mongo ID'),
        body('amount').isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { planId, amount, couponCode } = req.body;

        // Guard: no existing active/trial sub
        const existingSub = await UserSubscription.findOne({
            user:       req.user._id,
            status:     { $in: ['Active', 'Trial'] },
            expiryDate: { $gt: new Date() },
        });
        if (existingSub)
            return res.status(400).json({ success: false, message: 'You already have an active subscription or trial.' });

        const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        if (plan.planType === 'custom' && String(plan.createdByCustomer) !== String(req.user._id))
            return res.status(403).json({ success: false, message: 'You do not have access to this custom plan.' });

        // Coupon discount
        let discount = 0;
        if (couponCode) {
            const coupon = await PromotionCoupon.findOne({
                code:          couponCode,
                isActive:      true,
                'validity.to': { $gt: new Date() },
            });
            if (coupon) {
                discount = coupon.benefit.type === 'Flat_Amount'
                    ? coupon.benefit.value
                    : (Number(amount) * coupon.benefit.value) / 100;
            }
        }

        const finalAmount = Math.max(Number(amount) - discount, 0);

        // PATH B: ₹0 — activate immediately
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
                planName:   plan.name,
                planType:   plan.planType,
                fixedTier:  plan.fixedTier ?? null,
                status:     'Active',
                expiryDate: expiry,
                autoRenew:  plan.pricing.billingCycle !== 'till_delivery',
                limits:     snapshotLimits(plan),
                paymentHistory: [],
            });

            await Notification.create({
                recipient: req.user._id,
                title:     'Subscription Activated 🎉',
                body:      `Your ${plan.name} plan is now active until ${expiry.toLocaleDateString()}.`,
                type:      'Account_Status',
                priority:  'Normal',
            });

            await log({
                level:    'success',
                category: 'payment',
                message:  `Free subscription activated: ${plan.name}`,
                actor:    buildActor(req),
                relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: plan.name },
                request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
                metadata: { planId, finalAmount: 0, discount },
            });

            return res.status(201).json({
                success:   true,
                activated: true,
                message:   'Subscription activated for free.',
                data:      sub,
            });
        }

        // PATH A: paid — Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount:   Math.round(finalAmount * 100),
            currency: 'INR',
            receipt:  `rcpt_${Date.now()}`,
            notes:    { userId: req.user._id.toString(), planId: planId.toString() },
        });

        await log({
            level:    'info',
            category: 'payment',
            message:  `Razorpay order created for plan: ${plan.name}`,
            actor:    buildActor(req),
            request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            metadata: { planId, finalAmount, discount, orderId: razorpayOrder.id },
        });

        res.status(200).json({
            success:   true,
            activated: false,
            orderId:   razorpayOrder.id,
            amount:    finalAmount,
            discount,
            planName:  plan.name,
            planType:  plan.planType,
            planId,
        });
    })
);

/**
 * POST /api/v1/subscriptions/verify
 * Verify Razorpay payment and activate subscription.
 * planId and amount optional — resolved from order notes when absent.
 */
router.post(
    '/verify',
    protect,
    [
        body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required'),
        body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required'),
        body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required'),
        body('planId').optional().isMongoId().withMessage('planId must be a valid Mongo ID'),
        body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        let { planId, amount } = req.body;

        // Signature verification
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        if (hmac.digest('hex') !== razorpay_signature) {
            await log({
                level:    'error',
                category: 'security',
                message:  'Invalid Razorpay payment signature detected',
                actor:    buildActor(req),
                request:  { method: 'POST', path: req.originalUrl, statusCode: 400 },
                metadata: { razorpay_order_id, razorpay_payment_id },
            });
            return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        }

        // Resolve planId / amount from Razorpay order notes when not in body
        if (!planId || amount === undefined) {
            try {
                const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
                if (!planId)              planId = rzpOrder.notes?.planId;
                if (amount === undefined) amount = rzpOrder.amount / 100;
            } catch {
                return res.status(400).json({ success: false, message: 'Could not resolve plan details from Razorpay order. Please supply planId and amount.' });
            }
        }

        if (!planId)
            return res.status(400).json({ success: false, message: 'planId is required.' });

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });

        if (plan.planType === 'custom' && String(plan.createdByCustomer) !== String(req.user._id))
            return res.status(403).json({ success: false, message: 'Access denied to this custom plan.' });

        const expiry = new Date();
        if (plan.pricing.billingCycle === 'till_delivery') {
            expiry.setDate(expiry.getDate() + 280);
        } else {
            expiry.setDate(expiry.getDate() + 30);
        }

        const sub = await UserSubscription.create({
            user:       req.user._id,
            plan:       planId,
            planName:   plan.name,
            planType:   plan.planType,
            fixedTier:  plan.fixedTier ?? null,
            status:     'Active',
            expiryDate: expiry,
            autoRenew:  plan.pricing.billingCycle !== 'till_delivery',
            limits:     snapshotLimits(plan),
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

        await log({
            level:    'success',
            category: 'payment',
            message:  `Subscription activated via Razorpay: ${plan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: plan.name },
            request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
            metadata: { planId, amount, razorpay_payment_id, razorpay_order_id },
        });

        res.status(201).json({ success: true, data: sub });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3B — BUG #3 FIX: POST-PAYMENT USAGE FLUSH
//
//  Called by bookingRouterCustomer.js /verify-payment route after Razorpay
//  signature is verified. Executes subscriptionUsagePending increments that
//  were deferred at booking creation time to prevent premature decrement.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/subscriptions/flush-pending-usage
 *
 * Body: { bookingId }
 *
 * Finds all pending subscription usage increments stored on the booking
 * (Booking.subscriptionUsagePending), executes them, then clears the pending list.
 *
 * This route is called internally by /bookings/verify-payment after signature
 * verification succeeds. It can also be called by admin to manually flush
 * for bookings where payment was confirmed externally (Cash/Wallet).
 */
router.post(
    '/flush-pending-usage',
    protect,
    asyncHandler(async (req, res) => {
        const { bookingId } = req.body;

        if (!bookingId)
            return res.status(400).json({ success: false, message: 'bookingId required.' });

        const booking = await Booking.findById(bookingId).select('subscriptionUsagePending customer').lean();
        if (!booking)
            return res.status(404).json({ success: false, message: 'Booking not found.' });

        // Only the booking's customer or admin can flush
        const isAdmin = ['admin', 'superadmin'].includes(req.user?.role);
        if (!isAdmin && String(booking.customer) !== String(req.user._id))
            return res.status(403).json({ success: false, message: 'Not authorised.' });

        const pending = booking.subscriptionUsagePending || [];

        if (pending.length === 0) {
            return res.status(200).json({ success: true, message: 'No pending usage to flush.', flushed: 0 });
        }

        let flushed = 0;
        const now = new Date();

        for (const { subId, field } of pending) {
            if (!subId || !field) continue;

            // Try to increment in existing usageHistory entry for this month
            const updated = await UserSubscription.findOneAndUpdate(
                { _id: subId, 'usageHistory.month': now.getMonth() + 1, 'usageHistory.year': now.getFullYear() },
                { $inc: { [`usageHistory.$.${field}`]: 1 } }
            );

            if (!updated) {
                // No entry for this month yet — create one
                await UserSubscription.findByIdAndUpdate(subId, {
                    $push: {
                        usageHistory: {
                            month:  now.getMonth() + 1,
                            year:   now.getFullYear(),
                            [field]: 1,
                        },
                    },
                });
            }

            flushed++;
        }

        // Clear pending list on booking
        await Booking.findByIdAndUpdate(bookingId, {
            $set: { subscriptionUsagePending: [] },
        });

        await log({
            level:    'info',
            category: 'system',
            message:  `Flushed ${flushed} pending subscription usage increments for booking ${bookingId}`,
            actor:    buildActor(req),
            request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            metadata: { bookingId, flushed, pending },
        });

        return res.status(200).json({ success: true, flushed, pending });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — CUSTOMER SUBSCRIPTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/subscriptions/my
 * Current user's most recent subscription with plan populated.
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
 * GET /api/v1/subscriptions/my/history
 * Paginated subscription history for the logged-in customer.
 */
router.get(
    '/my/history',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const page  = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        const [total, subs] = await Promise.all([
            UserSubscription.countDocuments({ user: req.user._id }),
            UserSubscription.find({ user: req.user._id })
                .populate('plan')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       subs,
        });
    })
);

/**
 * PUT /api/v1/subscriptions/upgrade
 * Upgrade/switch plan for active or trial subscription.
 * Snapshots new plan limits on upgrade.
 */
router.put(
    '/upgrade',
    protect,
    authorize('customer'),
    [body('newPlanId').isMongoId().withMessage('newPlanId must be a valid Mongo ID')],
    validate,
    asyncHandler(async (req, res) => {
        const sub = await UserSubscription.findOne({
            user:   req.user._id,
            status: { $in: ['Active', 'Trial'] },
        });
        if (!sub)
            return res.status(400).json({ success: false, message: 'No active or trial subscription found.' });

        const newPlan = await SubscriptionPlan.findOne({ _id: req.body.newPlanId, isActive: true });
        if (!newPlan)
            return res.status(404).json({ success: false, message: 'New plan not found.' });

        if (newPlan.planType === 'custom' && String(newPlan.createdByCustomer) !== String(req.user._id))
            return res.status(403).json({ success: false, message: 'You do not have access to this custom plan.' });

        const previousPlan   = sub.plan;
        const previousStatus = sub.status;

        sub.plan      = newPlan._id;
        sub.planName  = newPlan.name;
        sub.planType  = newPlan.planType;
        sub.fixedTier = newPlan.fixedTier ?? null;
        sub.status    = 'Active';
        sub.limits    = snapshotLimits(newPlan); // BUG #2 FIX: uses updated snapshotLimits

        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        sub.expiryDate = newExpiry;

        if (previousStatus === 'Trial') sub.trialUsed = true;

        await sub.save();

        await Notification.create({
            recipient: req.user._id,
            title:     'Plan Upgraded',
            body:      `Your plan has been switched to ${newPlan.name}. New expiry: ${newExpiry.toLocaleDateString()}.`,
            type:      'Account_Status',
            priority:  'Normal',
        });

        await log({
            level:    'info',
            category: 'user',
            message:  `Subscription plan upgraded: ${newPlan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: newPlan.name },
            request:  { method: 'PUT', path: req.originalUrl, statusCode: 200 },
            metadata: { previousPlan, previousStatus, newPlanId: newPlan._id },
        });

        res.status(200).json({ success: true, data: sub });
    })
);

/**
 * PUT /api/v1/subscriptions/cancel
 * Customer cancels active or trial subscription.
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

        sub.status             = 'Cancelled';
        sub.autoRenew          = false;
        sub.cancelledAt        = new Date();
        sub.cancellationReason = req.body.reason ?? null;
        await sub.save();

        await Notification.create({
            recipient: req.user._id,
            title:     'Subscription Cancelled',
            body:      'Your subscription has been cancelled. You retain access until the current period ends.',
            type:      'Account_Status',
            priority:  'Normal',
        });

        await log({
            level:    'warning',
            category: 'user',
            message:  `Subscription cancelled by customer`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: sub.planName },
            request:  { method: 'PUT', path: req.originalUrl, statusCode: 200 },
            metadata: { reason: sub.cancellationReason },
        });

        res.status(200).json({ success: true, message: 'Subscription cancelled.', data: sub });
    })
);

/**
 * PUT /api/v1/subscriptions/toggle-auto-renew
 * Toggle autoRenew flag on active subscription.
 */
router.put(
    '/toggle-auto-renew',
    protect,
    authorize('customer'),
    asyncHandler(async (req, res) => {
        const sub = await UserSubscription.findOne({ user: req.user._id, status: 'Active' });
        if (!sub)
            return res.status(400).json({ success: false, message: 'No active subscription found.' });

        sub.autoRenew = !sub.autoRenew;
        await sub.save();

        await log({
            level:    'info',
            category: 'user',
            message:  `Auto-renew toggled: ${sub.autoRenew ? 'enabled' : 'disabled'}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: sub.planName },
            request:  { method: 'PUT', path: req.originalUrl, statusCode: 200 },
        });

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
 * POST /api/v1/subscriptions/free-trial/start
 * Customer starts a free trial (one lifetime trial per account).
 */
router.post(
    '/free-trial/start',
    protect,
    authorize('customer'),
    [
        body('planId').isMongoId().withMessage('planId must be a valid Mongo ID'),
        body('razorpay_payment_method_id').optional().isString(),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { planId, razorpay_payment_method_id } = req.body;

        const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found.' });
        if (!plan.freeTrial?.enabled)
            return res.status(400).json({ success: false, message: 'This plan does not offer a free trial.' });
        if (plan.planType === 'custom' && String(plan.createdByCustomer) !== String(req.user._id))
            return res.status(403).json({ success: false, message: 'You do not have access to this custom plan.' });

        // Lifetime trial check
        const previousTrial = await UserSubscription.findOne({ user: req.user._id, trialUsed: true });
        if (previousTrial)
            return res.status(400).json({ success: false, message: 'You have already used your free trial. Each account is eligible for one trial only.' });

        // No active/trial subscription
        const activeSub = await UserSubscription.findOne({
            user:       req.user._id,
            status:     { $in: ['Active', 'Trial'] },
            expiryDate: { $gt: new Date() },
        });
        if (activeSub)
            return res.status(400).json({ success: false, message: 'You already have an active subscription or ongoing trial.' });

        if (plan.freeTrial.requiresPaymentMethod && !razorpay_payment_method_id)
            return res.status(400).json({ success: false, message: 'This plan requires a saved payment method to start a free trial.' });

        const trialDays   = plan.freeTrial.durationDays || 7;
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + trialDays);

        const sub = await UserSubscription.create({
            user:       req.user._id,
            plan:       plan._id,
            planName:   plan.name,
            planType:   plan.planType,
            fixedTier:  plan.fixedTier ?? null,
            status:     'Trial',
            expiryDate: trialExpiry,
            autoRenew:  false,
            trialUsed:  true,
            limits:     snapshotLimits(plan), // BUG #2 FIX: reads customOptions for custom plans
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

        await log({
            level:    'success',
            category: 'user',
            message:  `Free trial started: ${plan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: plan.name },
            request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
            metadata: { trialDays, trialExpiry },
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
 * GET /api/v1/subscriptions/free-trial/eligibility
 * Check if requesting customer is eligible for a free trial.
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
 * GET /api/v1/subscriptions/free-trial/status
 * Current trial status for logged-in customer.
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
 * POST /api/v1/subscriptions/free-trial/convert
 * Convert active trial to paid subscription via Razorpay (or free if ₹0).
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

        let discount = 0;
        if (couponCode) {
            const coupon = await PromotionCoupon.findOne({
                code:          couponCode,
                isActive:      true,
                'validity.to': { $gt: new Date() },
            });
            if (coupon) {
                discount = coupon.benefit.type === 'Flat_Amount'
                    ? coupon.benefit.value
                    : (amount * coupon.benefit.value) / 100;
            }
        }

        const finalAmount = Math.max(amount - discount, 0);

        // PATH B: ₹0
        if (finalAmount === 0) {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 30);

            trial.status     = 'Active';
            trial.expiryDate = newExpiry;
            trial.autoRenew  = true;
            await trial.save();

            await Notification.create({
                recipient: req.user._id,
                title:     'Trial Converted — Welcome Aboard! 🎉',
                body:      `Your ${plan.name} subscription is now fully active until ${newExpiry.toLocaleDateString()}.`,
                type:      'Account_Status',
                priority:  'Normal',
            });

            await log({
                level:    'success',
                category: 'payment',
                message:  `Trial converted to free paid subscription: ${plan.name}`,
                actor:    buildActor(req),
                relatedEntity: { model: 'UserSubscription', entityId: trial._id, label: plan.name },
                request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            });

            return res.status(200).json({ success: true, activated: true, message: 'Trial converted to a free paid subscription.', data: trial });
        }

        // PATH A: paid — Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount:   Math.round(finalAmount * 100),
            currency: 'INR',
            receipt:  `trial_conv_${Date.now()}`,
            notes:    { userId: req.user._id.toString(), planId: plan._id.toString(), isTrialConvert: 'true' },
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
 * POST /api/v1/subscriptions/free-trial/verify-convert
 * Verify Razorpay payment for trial-to-paid conversion.
 */
router.post(
    '/free-trial/verify-convert',
    protect,
    authorize('customer'),
    [
        body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required'),
        body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required'),
        body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required'),
        body('amount').optional().isFloat({ min: 0 }),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        let { amount } = req.body;

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        if (hmac.digest('hex') !== razorpay_signature) {
            await log({
                level:    'error',
                category: 'security',
                message:  'Invalid Razorpay signature on trial-convert',
                actor:    buildActor(req),
                request:  { method: 'POST', path: req.originalUrl, statusCode: 400 },
                metadata: { razorpay_order_id },
            });
            return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        }

        if (amount === undefined) {
            try {
                const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
                amount = rzpOrder.amount / 100;
            } catch (_) {
                amount = 0;
            }
        }

        const trial = await UserSubscription.findOne({ user: req.user._id, status: 'Trial' }).populate('plan');
        if (!trial)
            return res.status(400).json({ success: false, message: 'No active trial found for this account.' });

        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);

        trial.status     = 'Active';
        trial.expiryDate = newExpiry;
        trial.autoRenew  = true;
        trial.paymentHistory.push({ transactionId: razorpay_payment_id, amount: Number(amount), paidAt: new Date() });
        await trial.save();

        await Notification.create({
            recipient: req.user._id,
            title:     'Trial Converted — Welcome Aboard! 🎉',
            body:      `Your ${trial.plan?.name} subscription is now fully active until ${newExpiry.toLocaleDateString()}.`,
            type:      'Account_Status',
            priority:  'Normal',
        });

        await log({
            level:    'success',
            category: 'payment',
            message:  `Trial converted via Razorpay: ${trial.plan?.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: trial._id, label: trial.plan?.name },
            request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            metadata: { amount, razorpay_payment_id },
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

        res.status(200).json({ success: true, message: 'Trial successfully converted to a paid subscription.', data: trial });
    })
);

/**
 * POST /api/v1/subscriptions/free-trial/expire-stale
 * Cron: expire all Trial subscriptions past their expiryDate.
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
        const logs       = [];

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

        await log({
            level:    'info',
            category: 'system',
            message:  `Cron: expired ${expiredCount} stale trial(s)`,
            actor:    buildActor(req),
            request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            metadata: { expiredCount },
        });

        res.status(200).json({ success: true, expiredCount, details: logs });
    })
);

/**
 * GET /api/v1/subscriptions/admin/trials
 * Admin: paginated list of all Trial subscriptions.
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

        const [total, trials] = await Promise.all([
            UserSubscription.countDocuments(filter),
            UserSubscription.find(filter)
                .populate('user', 'name email phone')
                .populate('plan', 'name fixedTier pricing freeTrial')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       trials,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — CRON / SYSTEM JOBS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/subscriptions/send-expiry-alerts
 * Cron: email + in-app notification for subscriptions expiring within 7 days.
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
        const results = [];

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
                    body:       `Hello ${sub.user.name},<br><br>Your <b>${sub.plan?.name}</b> subscription expires on <b>${sub.expiryDate.toLocaleDateString()}</b> (${daysLeft} day(s) left).<br><br>Renew today to continue enjoying all benefits.`,
                    buttonText: 'Renew Now',
                    buttonLink: 'https://likeson.in/dashboard/subscription',
                });
                await sendEmail({ email: sub.user.email, subject: `Reminder: Your subscription expires in ${daysLeft} day(s)`, html: emailHtml });
                sentCount++;
                results.push({ userId: sub.user._id, email: sub.user.email, status: 'Success' });
            } catch (err) {
                results.push({ userId: sub.user._id, email: sub.user.email, status: 'Failed', error: err.message });
            }
        }

        await log({
            level:    'info',
            category: 'system',
            message:  `Cron: expiry alerts sent to ${sentCount} users`,
            actor:    buildActor(req),
            request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            metadata: { totalProcessed: expiringSoon.length, sentCount },
        });

        res.status(200).json({ success: true, totalProcessed: expiringSoon.length, totalEmailsSent: sentCount, details: results });
    })
);

/**
 * POST /api/v1/subscriptions/auto-renew-trigger
 * Cron: auto-renew subscriptions expiring within 24h using wallet balance.
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

        const summary = { renewed: [], expired: [], skipped: [] };

        for (const sub of expiring) {
            if (sub.plan?.pricing?.billingCycle === 'till_delivery') {
                summary.skipped.push(sub._id);
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

                summary.renewed.push(sub._id);
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

                summary.expired.push(sub._id);
            }
        }

        await log({
            level:    'info',
            category: 'system',
            message:  `Cron: auto-renew complete — renewed: ${summary.renewed.length}, expired: ${summary.expired.length}`,
            actor:    buildActor(req),
            request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
            metadata: {
                renewed: summary.renewed.length,
                expired: summary.expired.length,
                skipped: summary.skipped.length,
            },
        });

        res.status(200).json({
            success: true,
            message: 'Auto-renewal process complete.',
            summary: {
                renewed: summary.renewed.length,
                expired: summary.expired.length,
                skipped: summary.skipped.length,
            },
            details: summary,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 7 — ADMIN PLAN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/subscriptions/admin/all
 * Paginated list of ALL UserSubscription records.
 */
router.get(
    '/admin/all',
    protect,
    authorize('admin', 'superadmin'),
    asyncHandler(async (req, res) => {
        const page   = Math.max(parseInt(req.query.page)  || 1, 1);
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const filter = {};

        if (req.query.status)   filter.status    = req.query.status;
        if (req.query.userId)   filter.user      = req.query.userId;
        if (req.query.planType) filter.planType  = req.query.planType;

        const [total, subs] = await Promise.all([
            UserSubscription.countDocuments(filter),
            UserSubscription.find(filter)
                .populate('user', 'name email phone role')
                .populate('plan')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        res.status(200).json({
            success:    true,
            pagination: { total, page, pages: Math.ceil(total / limit) },
            data:       subs,
        });
    })
);

/**
 * GET /api/v1/subscriptions/admin/plans
 * Admin: list all SubscriptionPlan documents.
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
 * POST /api/v1/subscriptions/admin/plans
 * Admin: create a fixed subscription plan.
 */
router.post(
    '/admin/plans',
    protect,
    authorize('admin', 'superadmin'),
    [
        body('name').trim().notEmpty().withMessage('name is required'),
        body('slug').trim().notEmpty().withMessage('slug is required'),
        body('fixedTier')
            .isIn(['Basic Care', 'Standard Care', 'Premium Care', 'Family Care', 'Pregnant Women Care', "NRI's Care"])
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

        await log({
            level:    'success',
            category: 'system',
            message:  `Fixed plan created by admin: ${plan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'SubscriptionPlan', entityId: plan._id, label: plan.name },
            request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
            metadata: { fixedTier: plan.fixedTier, monthly: plan.pricing.monthly },
        });

        res.status(201).json({ success: true, data: plan });
    })
);

/**
 * PUT /api/v1/subscriptions/admin/plans/:planId
 * Admin: update any plan.
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

        await log({
            level:    'info',
            category: 'system',
            message:  `Plan updated by admin: ${plan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'SubscriptionPlan', entityId: plan._id, label: plan.name },
            request:  { method: 'PUT', path: req.originalUrl, statusCode: 200 },
            metadata: req.body,
        });

        res.status(200).json({ success: true, data: plan });
    })
);

/**
 * DELETE /api/v1/subscriptions/admin/plans/:planId
 * Superadmin: soft-delete any plan.
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

        await log({
            level:    'warning',
            category: 'system',
            message:  `Plan deactivated by superadmin: ${plan.name}`,
            actor:    buildActor(req),
            relatedEntity: { model: 'SubscriptionPlan', entityId: plan._id, label: plan.name },
            request:  { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
        });

        res.status(200).json({ success: true, message: 'Plan deactivated.', data: plan });
    })
);

/**
 * PUT /api/v1/subscriptions/admin/subscriptions/:subId
 * Admin: manually override a UserSubscription.
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

        await log({
            level:    'warning',
            category: 'system',
            message:  `Subscription manually overridden by admin`,
            actor:    buildActor(req),
            relatedEntity: { model: 'UserSubscription', entityId: sub._id, label: sub.planName },
            request:  { method: 'PUT', path: req.originalUrl, statusCode: 200 },
            metadata: patch,
        });

        res.status(200).json({ success: true, data: sub });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL ERROR HANDLER  (must be last)
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, _next) => {
    console.error('[SubscriptionRouter Error]', err);

    SystemLog.createLog({
        level:    'error',
        category: 'api',
        message:  err.message || 'Internal server error',
        details:  err.stack   || null,
        actor:    buildActor(req),
        request: {
            method:     req.method,
            path:       req.originalUrl,
            statusCode: err.status || 500,
        },
    }).catch(() => null);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error.',
    });
});

export default router;