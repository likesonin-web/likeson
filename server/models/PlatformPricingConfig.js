import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// COMMON: Platform Fee Schema
// ─────────────────────────────────────────────────────────────────────────────
const platformFeeSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT: Duration-Based Pricing Tier
//
// Each tier defines a booking-duration window and what the platform:
//   - charges the user  (chargeToUser)
//   - pays the assistant (payoutToAssistant)
//   - retains as fee    (platformFee — derived or explicit)
//
// Tier matching rule:  minHours <= bookingHours < maxHours
//                      maxHours: null  →  no upper limit (open-ended)
//
// Default tiers:
//   Tier 1 :  0 –  4 hrs  →  user ₹400  / assistant ₹300
//   Tier 2 :  4 –  8 hrs  →  user ₹700  / assistant ₹550
//   Tier 3 :  8 – 12 hrs  →  user ₹1000 / assistant ₹800
//   Tier 4 : 12 – 24 hrs  →  user ₹1400 / assistant ₹1100  (full-day / live-in)
// ─────────────────────────────────────────────────────────────────────────────
const careAssistantPricingTierSchema = new Schema(
  {
    label:             { type: String, trim: true, required: true }, // e.g. "0 – 4 Hours"
    minHours:          { type: Number, required: true, min: 0 },     // inclusive
    maxHours:          { type: Number, default: null },               // exclusive; null = open-ended
    chargeToUser:      { type: Number, required: true, min: 0 },     // amount billed to patient/family
    payoutToAssistant: { type: Number, required: true, min: 0 },     // amount paid to care assistant
    isActive:          { type: Boolean, default: true },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT PRICING (replaces flat payoutPerVisit / chargeToUser)
// ─────────────────────────────────────────────────────────────────────────────
const careAssistantPricingSchema = new Schema(
  {
    // Duration-based tiered pricing (primary pricing model)
    pricingTiers: {
      type: [careAssistantPricingTierSchema],
      default: () => [
        { label: '0 – 4 Hours',   minHours: 0,  maxHours: 4,   chargeToUser: 400,  payoutToAssistant: 300  },
        { label: '4 – 8 Hours',   minHours: 4,  maxHours: 8,   chargeToUser: 700,  payoutToAssistant: 550  },
        { label: '8 – 12 Hours',  minHours: 8,  maxHours: 12,  chargeToUser: 1000, payoutToAssistant: 800  },
        { label: '12 – 24 Hours', minHours: 12, maxHours: null, chargeToUser: 1400, payoutToAssistant: 1100 },
      ],
    },

    // Platform fee applied on top of / derived from each tier's margin
    platformFee: { type: platformFeeSchema, required: true },

    // Dedicated (full-time monthly) assistant — flat monthly payout
    dedicatedMonthlyPayout:   { type: Number, default: 8000 },
    dedicatedMonthlyCharge:   { type: Number, default: 10000 }, // charge to the family/user

    // Incentives & penalties
    punctualityBonusPerVisit: { type: Number, default: 25 },
    noShowPenalty:            { type: Number, default: 100 },

    // Overtime rate beyond the last tier's maxHours limit (per extra hour)
    overtimeRatePerHour:      { type: Number, default: 120 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// VERSION HISTORY
// ─────────────────────────────────────────────────────────────────────────────
const versionHistorySchema = new Schema(
  {
    changedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedByRole: { type: String, enum: ['admin', 'superadmin'], required: true },
    changeNote:    { type: String },
    snapshot:      { type: Schema.Types.Mixed },
    changedAt:     { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CAPS
// ─────────────────────────────────────────────────────────────────────────────
const capsSchema = new Schema(
  {
    pharmacyDiscountMax:            { type: Number, default: 25, min: 0, max: 100 },
    diagnosticsDiscountMax:         { type: Number, default: 25, min: 0, max: 100 },
    careAssistantMaxVisitsPerMonth: { type: Number, default: 30 },
    consultationsMaxPerMonth:       { type: Number, default: 30 },
    transportMaxRidesPerMonth:      { type: Number, default: 20 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────
const transportPricingSchema = new Schema(
  {
    baseFare:         { type: Number, default: 50 },
    defaultRatePerKm: { type: Number, default: 21 },

    planRateOverrides: {
      type: Map,
      of: Number,
      default: {
        'basic-care':           20,
        'standard-care':        19,
        'premium-care':         18,
        'family-care':          18,
        'pregnant-women-care':  18,
        'nris-care':            null,
      },
    },

    platformFee: { type: platformFeeSchema, required: true },

    nightSurchargeMultiplier: { type: Number, default: 1.2 },
    nightStartHour:           { type: Number, default: 22 },
    nightEndHour:             { type: Number, default: 6 },

    waitingFreeMinutes:       { type: Number, default: 5 },
    waitingChargePerMinute:   { type: Number, default: 2 },

    cancellationFeePercent:   { type: Number, default: 50 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR
// ─────────────────────────────────────────────────────────────────────────────
const doctorPricingSchema = new Schema(
  {
    honorariumPerConsultation: { type: Number, default: 400 },
    chargeToUser:              { type: Number, default: 600 },

    platformFee: { type: platformFeeSchema, required: true },

    teleConsultationChargeToUser: { type: Number, default: 500 },
    teleConsultationHonorarium:   { type: Number, default: 350 },

    homeVisitChargeToUser: { type: Number, default: 1000 },
    homeVisitHonorarium:   { type: Number, default: 700 },

    followUpDiscountPercent: { type: Number, default: 20 },
    followUpValidDays:       { type: Number, default: 7 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL
// ─────────────────────────────────────────────────────────────────────────────
const hospitalSchema = new Schema(
  {
    platformFee:       { type: platformFeeSchema, required: true },
    hospitalOverrides: { type: Map, of: platformFeeSchema, default: {} },
    settlementCycle:   { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────
const diagnosticsSchema = new Schema(
  {
    platformFee:                { type: platformFeeSchema, required: true },
    homeSampleCollectionCharge: { type: Number, default: 75 },
    homeSamplePlatformFee:      { type: platformFeeSchema, required: true },
    physicalReportFee:          { type: Number, default: 50 },
    settlementCycle:            { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY
// ─────────────────────────────────────────────────────────────────────────────
const pharmacySchema = new Schema(
  {
    platformFee:               { type: platformFeeSchema, required: true },
    ownStoreMarginPercent:     { type: Number, default: 30 },
    expressDeliveryCharge:     { type: Number, default: 49 },
    deliveryAgentPayout:       { type: Number, default: 30 },
    freeDeliveryMinOrderValue: { type: Number, default: 200 },
    settlementCycle:           { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PLAN OPTIONS
// ─────────────────────────────────────────────────────────────────────────────
const customPlanOptionPricingSchema = new Schema(
  {
    consultation: {
      pricePerConsultation: { type: Number, required: true },
      doctorPricingTiers: [
        {
          doctorCount:     { type: Number, required: true },
          additionalPrice: { type: Number, required: true },
        },
      ],
      maxDoctorsAllowed: { type: Number, default: 5 },
    },

    transport: {
      kmSlabs: [
        {
          km:    { type: Number, required: true },
          price: { type: Number, required: true },
        },
      ],
    },

    diagnosticsDiscount: {
      slabs: [
        {
          percent: { type: Number, required: true },
          price:   { type: Number, required: true },
        },
      ],
    },

    pharmacyDiscount: {
      slabs: [
        {
          percent: { type: Number, required: true },
          price:   { type: Number, required: true },
        },
      ],
    },

    // Custom plan care assistant uses the same tiered structure,
    // but allows plan-specific price overrides per tier
    careAssistant: {
      pricingTiers: {
        type: [careAssistantPricingTierSchema],
        default: () => [],  // empty = fall back to global careAssistant.pricingTiers
      },
    },

    addOns: {
      homeSampleCollection: { type: Number, default: 199 },
      prioritySupport:      { type: Number, default: 99 },
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADS
// ─────────────────────────────────────────────────────────────────────────────
const adsSchema = new Schema(
  {
    sponsoredListingMonthly: { type: Number, default: 5000 },
    homePageBannerMonthly:   { type: Number, default: 15000 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// TAX
// ─────────────────────────────────────────────────────────────────────────────
const taxSchema = new Schema(
  {
    defaultGstPercent:       { type: Number, default: 18 },
    pharmacyGstPercent:      { type: Number, default: 12 },
    transportGstPercent:     { type: Number, default: 5 },
    consultationGstPercent:  { type: Number, default: 0 },
    diagnosticsGstPercent:   { type: Number, default: 5 },
    careAssistantGstPercent: { type: Number, default: 18 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// REFUND POLICY
// ─────────────────────────────────────────────────────────────────────────────
const refundPolicySchema = new Schema(
  {
    rideFullRefundHoursThreshold: { type: Number, default: 24 },
    ridePartialRefundPercent:     { type: Number, default: 50 },
    refundProcessingDaysMin:      { type: Number, default: 5 },
    refundProcessingDaysMax:      { type: Number, default: 12 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const platformPricingConfigSchema = new Schema(
  {
    configName: { type: String, default: 'global', unique: true },
    isActive:   { type: Boolean, default: true },

    caps:              { type: capsSchema,                     default: () => ({}) },
    transport:         { type: transportPricingSchema,         required: true },
    careAssistant:     { type: careAssistantPricingSchema,     required: true },
    doctor:            { type: doctorPricingSchema,            required: true },
    hospital:          { type: hospitalSchema,                 required: true },
    diagnostics:       { type: diagnosticsSchema,              required: true },
    pharmacy:          { type: pharmacySchema,                 required: true },
    customPlanOptions: { type: customPlanOptionPricingSchema,  required: true },

    ads:          { type: adsSchema,          default: () => ({}) },
    tax:          { type: taxSchema,          default: () => ({}) },
    refundPolicy: { type: refundPolicySchema, default: () => ({}) },

    lastUpdatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedByRole: { type: String, enum: ['admin', 'superadmin'] },

    versionHistory: { type: [versionHistorySchema], default: [] },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE: Validate care assistant pricing tiers (no gaps / overlaps)
// ─────────────────────────────────────────────────────────────────────────────
platformPricingConfigSchema.pre('save', function () {
  const tiers = this.careAssistant?.pricingTiers;
  if (!tiers?.length) return;

  const active = tiers.filter((t) => t.isActive);
  // Sort by minHours ascending before validation
  active.sort((a, b) => a.minHours - b.minHours);

  for (let i = 0; i < active.length - 1; i++) {
    const curr = active[i];
    const next = active[i + 1];
    if (curr.maxHours === null) {
      throw new Error(
        `Pricing tier "${curr.label}" has maxHours: null but is not the last active tier.`
      );
    }
    if (next.minHours !== curr.maxHours) {
      throw new Error(
        `Gap or overlap between care assistant pricing tiers ` +
        `"${curr.label}" (maxHours: ${curr.maxHours}) and ` +
        `"${next.label}" (minHours: ${next.minHours}).`
      );
    }
    if (curr.payoutToAssistant > curr.chargeToUser) {
      throw new Error(
        `Tier "${curr.label}": payoutToAssistant (${curr.payoutToAssistant}) ` +
        `cannot exceed chargeToUser (${curr.chargeToUser}).`
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────
platformPricingConfigSchema.statics.getGlobal = async function () {
  let config = await this.findOne({ configName: 'global', isActive: true });
  if (!config) config = await this.create({ configName: 'global' });
  return config;
};

/**
 * Resolve the correct care assistant pricing tier for a given booking duration.
 *
 * Usage:
 *   const config = await PlatformPricingConfig.getGlobal();
 *   const tier   = PlatformPricingConfig.resolveCareAssistantTier(config, 6);
 *   // → { label: '4 – 8 Hours', chargeToUser: 700, payoutToAssistant: 550, … }
 */
platformPricingConfigSchema.statics.resolveCareAssistantTier = function (config, durationHours) {
  const tiers = config?.careAssistant?.pricingTiers ?? [];
  return (
    tiers.find(
      (t) =>
        t.isActive &&
        durationHours >= t.minHours &&
        (t.maxHours === null || durationHours < t.maxHours)
    ) || null
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────
platformPricingConfigSchema.methods.saveWithAudit = async function (
  adminUserId,
  adminRole,
  note = ''
) {
  if (!['admin', 'superadmin'].includes(adminRole)) {
    throw new Error('Unauthorized');
  }

  this.versionHistory.push({
    changedBy:     adminUserId,
    changedByRole: adminRole,
    changeNote:    note,
    snapshot:      this.toObject(),
    changedAt:     new Date(),
  });

  this.lastUpdatedBy     = adminUserId;
  this.lastUpdatedByRole = adminRole;

  return this.save();
};

const PlatformPricingConfig = mongoose.model(
  'PlatformPricingConfig',
  platformPricingConfigSchema
);

export default PlatformPricingConfig;