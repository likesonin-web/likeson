import express from 'express';
import { body, param, validationResult } from 'express-validator';
import dotenv from 'dotenv';

import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

dotenv.config();
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

const sanitiseConfig = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.versionHistory;
  // Serialize Maps to plain objects for JSON transport
  if (obj.transport?.planRateOverrides instanceof Map)
    obj.transport.planRateOverrides = Object.fromEntries(obj.transport.planRateOverrides);
  if (obj.hospital?.hospitalOverrides instanceof Map)
    obj.hospital.hospitalOverrides = Object.fromEntries(obj.hospital.hospitalOverrides);
  return obj;
};

// platformFee sub-doc validator factory
const platformFeeValidators = (prefix) => [
  body(`${prefix}.type`)
    .optional()
    .isIn(['fixed', 'percentage'])
    .withMessage(`${prefix}.type must be 'fixed' or 'percentage'`),
  body(`${prefix}.value`)
    .optional()
    .isFloat({ min: 0 })
    .withMessage(`${prefix}.value must be >= 0`),
];

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/pricing/config
 * @desc    Admin / superadmin: fetch the full global PlatformPricingConfig
 *          (all 11 sections, no versionHistory).
 * @access  Private (admin, superadmin)
 */
router.get(
  '/config',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    res.status(200).json({ success: true, data: sanitiseConfig(config) });
  })
);

/**
 * @route   GET /api/v1/pricing/public
 * @desc    Customer-safe read.
 *          Returns caps, customPlanOptions, tax, refundPolicy only.
 * @access  Private (customer, admin, superadmin)
 */
router.get(
  '/public',
  protect,
  authorize('customer', 'admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    res.status(200).json({
      success: true,
      data: {
        caps:              config.caps,
        customPlanOptions: config.customPlanOptions,
        tax:               config.tax,
        refundPolicy:      config.refundPolicy,
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — FULL CONFIG UPDATE  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/v1/pricing/config
 * @desc    Superadmin: replace one or more top-level sections atomically.
 *          Send only the sections you want to update.
 *
 *  platformFee objects everywhere follow: { type: 'fixed'|'percentage', value: number }
 *
 * @access  Private (superadmin)
 */
router.patch(
  '/config',
  protect,
  authorize('superadmin'),
  [
    body('note').optional().isString(),

    // caps
    body('caps.pharmacyDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('caps.diagnosticsDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('caps.careAssistantMaxVisitsPerMonth').optional().isInt({ min: 0 }),
    body('caps.consultationsMaxPerMonth').optional().isInt({ min: 0 }),
    body('caps.transportMaxRidesPerMonth').optional().isInt({ min: 0 }),

    // transport scalars
    body('transport.baseFare').optional().isFloat({ min: 0 }),
    body('transport.defaultRatePerKm').optional().isFloat({ min: 0 }),
    body('transport.nightSurchargeMultiplier').optional().isFloat({ min: 1 }),
    body('transport.nightStartHour').optional().isInt({ min: 0, max: 23 }),
    body('transport.nightEndHour').optional().isInt({ min: 0, max: 23 }),
    body('transport.waitingFreeMinutes').optional().isInt({ min: 0 }),
    body('transport.waitingChargePerMinute').optional().isFloat({ min: 0 }),
    body('transport.cancellationFeePercent').optional().isFloat({ min: 0, max: 100 }),
    ...platformFeeValidators('transport.platformFee'),

    // careAssistant
    body('careAssistant.payoutPerVisit').optional().isFloat({ min: 0 }),
    body('careAssistant.chargeToUser').optional().isFloat({ min: 0 }),
    body('careAssistant.dedicatedMonthlyPayout').optional().isFloat({ min: 0 }),
    body('careAssistant.punctualityBonusPerVisit').optional().isFloat({ min: 0 }),
    body('careAssistant.noShowPenalty').optional().isFloat({ min: 0 }),
    ...platformFeeValidators('careAssistant.platformFee'),

    // doctor
    body('doctor.honorariumPerConsultation').optional().isFloat({ min: 0 }),
    body('doctor.chargeToUser').optional().isFloat({ min: 0 }),
    body('doctor.teleConsultationChargeToUser').optional().isFloat({ min: 0 }),
    body('doctor.teleConsultationHonorarium').optional().isFloat({ min: 0 }),
    body('doctor.homeVisitChargeToUser').optional().isFloat({ min: 0 }),
    body('doctor.homeVisitHonorarium').optional().isFloat({ min: 0 }),
    body('doctor.followUpDiscountPercent').optional().isFloat({ min: 0, max: 100 }),
    body('doctor.followUpValidDays').optional().isInt({ min: 1 }),
    ...platformFeeValidators('doctor.platformFee'),

    // hospital
    body('hospital.settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('hospital.platformFee'),

    // diagnostics
    body('diagnostics.homeSampleCollectionCharge').optional().isFloat({ min: 0 }),
    body('diagnostics.physicalReportFee').optional().isFloat({ min: 0 }),
    body('diagnostics.settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('diagnostics.platformFee'),
    ...platformFeeValidators('diagnostics.homeSamplePlatformFee'),

    // pharmacy
    body('pharmacy.ownStoreMarginPercent').optional().isFloat({ min: 0, max: 100 }),
    body('pharmacy.expressDeliveryCharge').optional().isFloat({ min: 0 }),
    body('pharmacy.deliveryAgentPayout').optional().isFloat({ min: 0 }),
    body('pharmacy.freeDeliveryMinOrderValue').optional().isFloat({ min: 0 }),
    body('pharmacy.settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('pharmacy.platformFee'),

    // ads
    body('ads.sponsoredListingMonthly').optional().isFloat({ min: 0 }),
    body('ads.homePageBannerMonthly').optional().isFloat({ min: 0 }),

    // tax
    body('tax.defaultGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.pharmacyGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.transportGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.consultationGstPercent')
      .optional()
      .isFloat({ min: 0, max: 0 })
      .withMessage('Consultations are GST-exempt — must be 0'),
    body('tax.diagnosticsGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.careAssistantGstPercent').optional().isFloat({ min: 0, max: 100 }),

    // refundPolicy
    body('refundPolicy.rideFullRefundHoursThreshold').optional().isInt({ min: 0 }),
    body('refundPolicy.ridePartialRefundPercent').optional().isFloat({ min: 0, max: 100 }),
    body('refundPolicy.refundProcessingDaysMin').optional().isInt({ min: 0 }),
    body('refundPolicy.refundProcessingDaysMax').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', ...sections } = req.body;

    const ALLOWED_SECTIONS = [
      'caps', 'transport', 'careAssistant', 'doctor',
      'hospital', 'diagnostics', 'pharmacy', 'customPlanOptions',
      'ads', 'tax', 'refundPolicy',
    ];

    for (const section of ALLOWED_SECTIONS) {
      if (sections[section] && typeof sections[section] === 'object') {
        // For sections that contain nested platformFee, handle carefully
        const { platformFee, homeSamplePlatformFee, planRateOverrides, hospitalOverrides, ...rest } = sections[section];

        Object.assign(config[section], rest);

        if (platformFee) {
          Object.assign(config[section].platformFee, platformFee);
        }
        if (homeSamplePlatformFee && section === 'diagnostics') {
          Object.assign(config.diagnostics.homeSamplePlatformFee, homeSamplePlatformFee);
        }

        config.markModified(section);
      }
    }

    // Handle transport planRateOverrides (Map)
    if (sections.transport?.planRateOverrides) {
      for (const [slug, rate] of Object.entries(sections.transport.planRateOverrides)) {
        config.transport.planRateOverrides.set(slug, rate === null ? null : Number(rate));
      }
      config.markModified('transport.planRateOverrides');
    }

    // Handle hospital hospitalOverrides (Map of platformFeeSchema)
    if (sections.hospital?.hospitalOverrides) {
      for (const [id, feeObj] of Object.entries(sections.hospital.hospitalOverrides)) {
        config.hospital.hospitalOverrides.set(id, feeObj);
      }
      config.markModified('hospital.hospitalOverrides');
    }

    await config.saveWithAudit(req.user._id, req.user.role, note);

    res.status(200).json({
      success: true,
      message: 'Platform pricing updated and audit snapshot saved.',
      data:    sanitiseConfig(config),
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — SECTION-LEVEL PATCH ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/v1/pricing/caps
 * @desc    Update global discount caps and monthly usage limits.
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/caps',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('pharmacyDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('diagnosticsDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('careAssistantMaxVisitsPerMonth').optional().isInt({ min: 0 }),
    body('consultationsMaxPerMonth').optional().isInt({ min: 0 }),
    body('transportMaxRidesPerMonth').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', ...fields } = req.body;

    Object.assign(config.caps, fields);
    config.markModified('caps');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated caps');

    res.status(200).json({ success: true, message: 'Caps updated.', data: config.caps });
  })
);

/**
 * @route   PATCH /api/v1/pricing/transport
 * @desc    Update transport pricing.
 *          platformFee: { type: 'fixed'|'percentage', value: number }
 *          planRateOverrides: { [planSlug]: number | null }
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/transport',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('baseFare').optional().isFloat({ min: 0 }),
    body('defaultRatePerKm').optional().isFloat({ min: 0 }),
    body('nightSurchargeMultiplier').optional().isFloat({ min: 1 }),
    body('nightStartHour').optional().isInt({ min: 0, max: 23 }),
    body('nightEndHour').optional().isInt({ min: 0, max: 23 }),
    body('waitingFreeMinutes').optional().isInt({ min: 0 }),
    body('waitingChargePerMinute').optional().isFloat({ min: 0 }),
    body('cancellationFeePercent').optional().isFloat({ min: 0, max: 100 }),
    body('planRateOverrides').optional().isObject(),
    ...platformFeeValidators('platformFee'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', planRateOverrides, platformFee, ...fields } = req.body;

    const SCALAR = [
      'baseFare', 'defaultRatePerKm', 'nightSurchargeMultiplier',
      'nightStartHour', 'nightEndHour', 'waitingFreeMinutes',
      'waitingChargePerMinute', 'cancellationFeePercent',
    ];
    for (const k of SCALAR) {
      if (fields[k] !== undefined) config.transport[k] = fields[k];
    }

    if (platformFee) {
      Object.assign(config.transport.platformFee, platformFee);
    }

    if (planRateOverrides) {
      for (const [slug, rate] of Object.entries(planRateOverrides)) {
        config.transport.planRateOverrides.set(slug, rate === null ? null : Number(rate));
      }
      config.markModified('transport.planRateOverrides');
    }

    config.markModified('transport');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated transport pricing');

    res.status(200).json({
      success: true,
      message: 'Transport pricing updated.',
      data: {
        ...config.transport.toObject(),
        planRateOverrides: Object.fromEntries(config.transport.planRateOverrides),
      },
    });
  })
);

/**
 * @route   PATCH /api/v1/pricing/care-assistant
 * @desc    Update care-assistant payout / charge / bonus / penalty.
 *          platformFee: { type: 'fixed'|'percentage', value: number }
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/care-assistant',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('payoutPerVisit').optional().isFloat({ min: 0 }),
    body('chargeToUser').optional().isFloat({ min: 0 }),
    body('dedicatedMonthlyPayout').optional().isFloat({ min: 0 }),
    body('punctualityBonusPerVisit').optional().isFloat({ min: 0 }),
    body('noShowPenalty').optional().isFloat({ min: 0 }),
    ...platformFeeValidators('platformFee'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', platformFee, ...fields } = req.body;

    const SCALAR = [
      'payoutPerVisit', 'chargeToUser', 'dedicatedMonthlyPayout',
      'punctualityBonusPerVisit', 'noShowPenalty',
    ];
    for (const k of SCALAR) {
      if (fields[k] !== undefined) config.careAssistant[k] = fields[k];
    }

    if (platformFee) {
      Object.assign(config.careAssistant.platformFee, platformFee);
    }

    config.markModified('careAssistant');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated care-assistant pricing');

    res.status(200).json({ success: true, message: 'Care-assistant pricing updated.', data: config.careAssistant });
  })
);

/**
 * @route   PATCH /api/v1/pricing/doctor
 * @desc    Update doctor honorarium, charges, tele, home visit, follow-up.
 *          platformFee: { type: 'fixed'|'percentage', value: number }
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/doctor',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('honorariumPerConsultation').optional().isFloat({ min: 0 }),
    body('chargeToUser').optional().isFloat({ min: 0 }),
    body('teleConsultationChargeToUser').optional().isFloat({ min: 0 }),
    body('teleConsultationHonorarium').optional().isFloat({ min: 0 }),
    body('homeVisitChargeToUser').optional().isFloat({ min: 0 }),
    body('homeVisitHonorarium').optional().isFloat({ min: 0 }),
    body('followUpDiscountPercent').optional().isFloat({ min: 0, max: 100 }),
    body('followUpValidDays').optional().isInt({ min: 1 }),
    ...platformFeeValidators('platformFee'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', platformFee, ...fields } = req.body;

    const SCALAR = [
      'honorariumPerConsultation', 'chargeToUser',
      'teleConsultationChargeToUser', 'teleConsultationHonorarium',
      'homeVisitChargeToUser', 'homeVisitHonorarium',
      'followUpDiscountPercent', 'followUpValidDays',
    ];
    for (const k of SCALAR) {
      if (fields[k] !== undefined) config.doctor[k] = fields[k];
    }

    if (platformFee) {
      Object.assign(config.doctor.platformFee, platformFee);
    }

    config.markModified('doctor');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated doctor pricing');

    res.status(200).json({ success: true, message: 'Doctor pricing updated.', data: config.doctor });
  })
);

/**
 * @route   PATCH /api/v1/pricing/hospital
 * @desc    Update hospital platform fee, per-hospital overrides, settlement cycle.
 *
 *          platformFee:       { type, value }   — default fee applied to all hospitals
 *          hospitalOverrides: { [hospitalId]: { type, value } }  — per-hospital fee overrides
 *
 *          To remove an override use: DELETE /hospital/override/:hospitalId
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/hospital',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('platformFee'),
    body('hospitalOverrides').optional().isObject(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', platformFee, hospitalOverrides, ...fields } = req.body;

    if (fields.settlementCycle !== undefined)
      config.hospital.settlementCycle = fields.settlementCycle;

    if (platformFee) {
      Object.assign(config.hospital.platformFee, platformFee);
    }

    if (hospitalOverrides) {
      for (const [id, feeObj] of Object.entries(hospitalOverrides)) {
        // feeObj must be { type, value }
        config.hospital.hospitalOverrides.set(id, feeObj);
      }
      config.markModified('hospital.hospitalOverrides');
    }

    config.markModified('hospital');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated hospital commission');

    res.status(200).json({
      success: true,
      message: 'Hospital commission updated.',
      data: {
        ...config.hospital.toObject(),
        hospitalOverrides: Object.fromEntries(config.hospital.hospitalOverrides),
      },
    });
  })
);

/**
 * @route   DELETE /api/v1/pricing/hospital/override/:hospitalId
 * @desc    Remove a specific hospital's platform fee override.
 * @access  Private (admin, superadmin)
 */
router.delete(
  '/hospital/override/:hospitalId',
  protect,
  authorize('admin', 'superadmin'),
  [param('hospitalId').notEmpty().withMessage('hospitalId is required')],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();

    if (!config.hospital.hospitalOverrides.has(req.params.hospitalId))
      return res.status(404).json({ success: false, message: 'Override not found for this hospital.' });

    config.hospital.hospitalOverrides.delete(req.params.hospitalId);
    config.markModified('hospital.hospitalOverrides');
    await config.saveWithAudit(req.user._id, req.user.role, `Removed hospital override: ${req.params.hospitalId}`);

    res.status(200).json({
      success: true,
      message: 'Hospital override removed.',
      data: Object.fromEntries(config.hospital.hospitalOverrides),
    });
  })
);

/**
 * @route   PATCH /api/v1/pricing/diagnostics
 * @desc    Update diagnostics platform fee, home sample fee, physical report fee,
 *          settlement cycle.
 *
 *          platformFee:          { type, value }  — default lab commission
 *          homeSamplePlatformFee: { type, value }  — fee applied to home sample collection
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/diagnostics',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('homeSampleCollectionCharge').optional().isFloat({ min: 0 }),
    body('physicalReportFee').optional().isFloat({ min: 0 }),
    body('settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('platformFee'),
    ...platformFeeValidators('homeSamplePlatformFee'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', platformFee, homeSamplePlatformFee, ...fields } = req.body;

    const SCALAR = ['homeSampleCollectionCharge', 'physicalReportFee', 'settlementCycle'];
    for (const k of SCALAR) {
      if (fields[k] !== undefined) config.diagnostics[k] = fields[k];
    }

    if (platformFee) {
      Object.assign(config.diagnostics.platformFee, platformFee);
    }
    if (homeSamplePlatformFee) {
      Object.assign(config.diagnostics.homeSamplePlatformFee, homeSamplePlatformFee);
    }

    config.markModified('diagnostics');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated diagnostics pricing');

    res.status(200).json({ success: true, message: 'Diagnostics pricing updated.', data: config.diagnostics });
  })
);

/**
 * @route   PATCH /api/v1/pricing/pharmacy
 * @desc    Update pharmacy platform fee, margin, delivery charges, settlement.
 *          platformFee: { type, value }  — applied to partner pharmacy transactions
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/pharmacy',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('ownStoreMarginPercent').optional().isFloat({ min: 0, max: 100 }),
    body('expressDeliveryCharge').optional().isFloat({ min: 0 }),
    body('deliveryAgentPayout').optional().isFloat({ min: 0 }),
    body('freeDeliveryMinOrderValue').optional().isFloat({ min: 0 }),
    body('settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('platformFee'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', platformFee, ...fields } = req.body;

    const SCALAR = [
      'ownStoreMarginPercent', 'expressDeliveryCharge',
      'deliveryAgentPayout', 'freeDeliveryMinOrderValue', 'settlementCycle',
    ];
    for (const k of SCALAR) {
      if (fields[k] !== undefined) config.pharmacy[k] = fields[k];
    }

    if (platformFee) {
      Object.assign(config.pharmacy.platformFee, platformFee);
    }

    config.markModified('pharmacy');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated pharmacy pricing');

    res.status(200).json({ success: true, message: 'Pharmacy pricing updated.', data: config.pharmacy });
  })
);

/**
 * @route   PATCH /api/v1/pricing/custom-plan-options
 * @desc    Update the custom plan option pricing blocks.
 *
 *          consultation:
 *            pricePerConsultation, maxDoctorsAllowed
 *            doctorPricingTiers: [{ doctorCount, additionalPrice }]
 *
 *          transport:
 *            kmSlabs: [{ km, price }]
 *
 *          diagnosticsDiscount:
 *            slabs: [{ percent, price }]
 *
 *          pharmacyDiscount:
 *            slabs: [{ percent, price }]
 *
 *          careAssistant:
 *            pricePerVisit
 *
 *          addOns:
 *            homeSampleCollection, prioritySupport
 *
 *          NOTE: changes here do NOT affect already-saved custom plans.
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/custom-plan-options',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),

    // consultation block
    body('consultation.pricePerConsultation').optional().isFloat({ min: 0 }),
    body('consultation.maxDoctorsAllowed').optional().isInt({ min: 1 }),
    body('consultation.doctorPricingTiers').optional().isArray(),
    body('consultation.doctorPricingTiers.*.doctorCount').optional().isInt({ min: 1 }),
    body('consultation.doctorPricingTiers.*.additionalPrice').optional().isFloat({ min: 0 }),

    // transport block
    body('transport.kmSlabs').optional().isArray(),
    body('transport.kmSlabs.*.km').optional().isFloat({ min: 0 }),
    body('transport.kmSlabs.*.price').optional().isFloat({ min: 0 }),

    // diagnosticsDiscount block
    body('diagnosticsDiscount.slabs').optional().isArray(),
    body('diagnosticsDiscount.slabs.*.percent').optional().isFloat({ min: 0, max: 100 }),
    body('diagnosticsDiscount.slabs.*.price').optional().isFloat({ min: 0 }),

    // pharmacyDiscount block
    body('pharmacyDiscount.slabs').optional().isArray(),
    body('pharmacyDiscount.slabs.*.percent').optional().isFloat({ min: 0, max: 100 }),
    body('pharmacyDiscount.slabs.*.price').optional().isFloat({ min: 0 }),

    // careAssistant block
    body('careAssistant.pricePerVisit').optional().isFloat({ min: 0 }),

    // addOns block
    body('addOns.homeSampleCollection').optional().isFloat({ min: 0 }),
    body('addOns.prioritySupport').optional().isFloat({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', ...blocks } = req.body;

    const BLOCKS = [
      'consultation', 'transport', 'diagnosticsDiscount',
      'pharmacyDiscount', 'careAssistant', 'addOns',
    ];

    for (const block of BLOCKS) {
      if (blocks[block] && typeof blocks[block] === 'object') {
        Object.assign(config.customPlanOptions[block], blocks[block]);
      }
    }

    config.markModified('customPlanOptions');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated custom plan option prices');

    res.status(200).json({
      success: true,
      message: 'Custom plan option prices updated. Existing custom plans are unaffected.',
      data: config.customPlanOptions,
    });
  })
);

/**
 * @route   PATCH /api/v1/pricing/ads
 * @desc    Update advertisement / sponsored listing pricing.
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/ads',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('sponsoredListingMonthly').optional().isFloat({ min: 0 }),
    body('homePageBannerMonthly').optional().isFloat({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', ...fields } = req.body;

    Object.assign(config.ads, fields);
    config.markModified('ads');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated ads pricing');

    res.status(200).json({ success: true, message: 'Ads pricing updated.', data: config.ads });
  })
);

/**
 * @route   PATCH /api/v1/pricing/tax
 * @desc    Update GST rates per service type. Superadmin only — regulatory.
 *          consultationGstPercent is locked at 0 (medical exemption by law).
 * @access  Private (superadmin)
 */
router.patch(
  '/tax',
  protect,
  authorize('superadmin'),
  [
    body('note').optional().isString(),
    body('defaultGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('pharmacyGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('transportGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('consultationGstPercent')
      .optional()
      .isFloat({ min: 0, max: 0 })
      .withMessage('Consultations are GST-exempt — must be 0'),
    body('diagnosticsGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('careAssistantGstPercent').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', ...fields } = req.body;

    Object.assign(config.tax, fields);
    config.markModified('tax');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated tax/GST rates');

    res.status(200).json({ success: true, message: 'Tax rates updated.', data: config.tax });
  })
);

/**
 * @route   PATCH /api/v1/pricing/refund-policy
 * @desc    Update ride cancellation & refund policy thresholds.
 *          Validates that min processing days ≤ max.
 * @access  Private (admin, superadmin)
 */
router.patch(
  '/refund-policy',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('note').optional().isString(),
    body('rideFullRefundHoursThreshold').optional().isInt({ min: 0 }),
    body('ridePartialRefundPercent').optional().isFloat({ min: 0, max: 100 }),
    body('refundProcessingDaysMin').optional().isInt({ min: 0 }),
    body('refundProcessingDaysMax').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const { note = '', ...fields } = req.body;

    const minDays = fields.refundProcessingDaysMin ?? config.refundPolicy.refundProcessingDaysMin;
    const maxDays = fields.refundProcessingDaysMax ?? config.refundPolicy.refundProcessingDaysMax;
    if (minDays > maxDays)
      return res.status(400).json({
        success: false,
        message: 'refundProcessingDaysMin cannot be greater than refundProcessingDaysMax.',
      });

    Object.assign(config.refundPolicy, fields);
    config.markModified('refundPolicy');
    await config.saveWithAudit(req.user._id, req.user.role, note || 'Updated refund policy');

    res.status(200).json({ success: true, message: 'Refund policy updated.', data: config.refundPolicy });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — TRANSPORT RATE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/pricing/transport/rate/:planSlug
 * @desc    Resolve the per-km transport rate for a given plan slug.
 *          Returns null for NRI plan (not applicable).
 * @access  Private (customer, admin, superadmin)
 */
router.get(
  '/transport/rate/:planSlug',
  protect,
  authorize('customer', 'admin', 'superadmin'),
  [param('planSlug').notEmpty().withMessage('planSlug is required')],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();

    const planRateOverrides = config.transport.planRateOverrides;
    const slugRate = planRateOverrides.get(req.params.planSlug);
    const ratePerKm = slugRate !== undefined ? slugRate : config.transport.defaultRatePerKm;

    res.status(200).json({
      success: true,
      data: {
        planSlug:   req.params.planSlug,
        ratePerKm,                           // null = NRI plan; number otherwise
        baseFare:   config.transport.baseFare,
        platformFee: config.transport.platformFee,
        currency:   'INR',
        applicable: ratePerKm !== null,
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — AUDIT / VERSION HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/pricing/history
 * @desc    Paginated audit log (newest first).
 *          Query: page (default 1), limit (default 20, max 100)
 * @access  Private (admin, superadmin)
 */
router.get(
  '/history',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();

    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const history = [...config.versionHistory].reverse();
    const total   = history.length;
    const slice   = history.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      success:    true,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data:       slice,
    });
  })
);

/**
 * @route   GET /api/v1/pricing/history/:index
 * @desc    Fetch a single snapshot by 0-based index (-1 = latest).
 * @access  Private (superadmin)
 */
router.get(
  '/history/:index',
  protect,
  authorize('superadmin'),
  [param('index').isInt().withMessage('index must be an integer')],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const idx    = parseInt(req.params.index);
    const entry  = config.versionHistory[idx < 0 ? config.versionHistory.length + idx : idx];

    if (!entry)
      return res.status(404).json({ success: false, message: 'No version history entry at that index.' });

    res.status(200).json({ success: true, data: entry });
  })
);

/**
 * @route   POST /api/v1/pricing/restore/:index
 * @desc    Restore full config to a historical snapshot.
 *          WARNING: overwrites ALL sections. Restore is itself recorded in history.
 * @access  Private (superadmin)
 */
router.post(
  '/restore/:index',
  protect,
  authorize('superadmin'),
  [
    param('index').isInt().withMessage('index must be an integer'),
    body('note').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();
    const idx    = parseInt(req.params.index);
    const entry  = config.versionHistory[idx < 0 ? config.versionHistory.length + idx : idx];

    if (!entry)
      return res.status(404).json({ success: false, message: 'No version history entry at that index.' });

    const snapshot = entry.snapshot;
    const SECTIONS = [
      'caps', 'transport', 'careAssistant', 'doctor',
      'hospital', 'diagnostics', 'pharmacy', 'customPlanOptions',
      'ads', 'tax', 'refundPolicy',
    ];

    for (const s of SECTIONS) {
      if (snapshot[s]) {
        config[s] = snapshot[s];
        config.markModified(s);
      }
    }

    const note = req.body.note || `Restored to snapshot at history index ${idx} (originally saved ${entry.changedAt})`;
    await config.saveWithAudit(req.user._id, req.user.role, note);

    res.status(200).json({
      success: true,
      message: `Config restored to snapshot from ${new Date(entry.changedAt).toLocaleString()}. Restore action recorded in version history.`,
      data:    sanitiseConfig(config),
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  console.error('[PricingRouter Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

export default router;