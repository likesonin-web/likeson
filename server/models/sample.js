import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * SubscriptionPlan Model — Likeson.in
 *
 * Two plan categories:
 *
 *  A) FIXED PLANS  (6 tiers, seeded by admin — visible to ALL customers)
 *       Basic Care | Standard Care | Premium Care |
 *       Family Care | Pregnant Women Care | NRI's Care
 *
 *  B) CUSTOM PLAN  (built per-customer from admin-priced option blocks)
 *       Customer selects what they want; price = sum of chosen option lineTotals.
 *       Discount caps enforced from PlatformPricingConfig
 *       (pharmacy ≤ 25%, diagnostics ≤ 25%).
 *       Custom plans are visible ONLY to the customer who created them.
 *
 * "No Plan" removed — pay-per-use pricing lives in PlatformPricingConfig.
 *
 * Source: WhatsApp_Image_2026-03-14 + Project_Overview_original.pdf
 */

// ─── Canonical fixed tier names ───────────────────────────────────────────────
// Keep in sync with:
//   PlatformPricingConfig.transport.planRateOverrides keys (kebab-case slugs)
//   UserSubscription.fixedTier enum
export const FIXED_TIERS = /** @type {const} */ ([
  'Basic Care',
  'Standard Care',
  'Premium Care',
  'Family Care',
  'Pregnant Women Care',
  "NRI's Care",
]);

// ─── Sub-schema: one selectable option block inside a Custom Plan ─────────────
const customPlanOptionSchema = new Schema(
  {
    /**
     * Which service block this option represents.
     * Admin pre-prices each key in PlatformPricingConfig.customPlanOptions.
     */
    optionKey: {
      type: String,
      required: true,
      enum: [
        'consultations',        // doctor consultations quota
        'transport',            // discounted rides quota
        'diagnostics',          // diagnostic discount %
        'pharmacy',             // pharmacy discount % (max 25%)
        'careAssistant',        // care-assistant visits quota
        'homeSampleCollection', // home sample collection add-on
        'prioritySupport',      // upgrade to Priority support tier
      ],
    },

    /** UI label, e.g. "5 Doctor Consultations/month" */
    label: { type: String, required: true },

    /**
     * Quantity chosen by customer.
     * Meaning depends on optionKey:
     *   consultations / transport / careAssistant → count per month
     *   diagnostics / pharmacy                   → discount % (admin-capped)
     *   homeSampleCollection / prioritySupport   → 1 = enabled
     */
    quantity: { type: Number, required: true, min: 0 },

    /**
     * Unit price (₹) snapshotted from PlatformPricingConfig at plan-creation
     * time so historic plans are unaffected by future admin price changes.
     */
    unitPrice: { type: Number, required: true, default: 0 },

    /** quantity × unitPrice — auto-recomputed in pre-save */
    lineTotal: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const subscriptionPlanSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      // Custom plans use a customer-supplied name so enum is NOT used here;
      // fixedTier handles the strict 6-value validation for fixed plans.
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Fixed: "basic-care", "nris-care" etc.
      // Custom: "custom-<userId>-<timestamp>"
    },

    description: { type: String, trim: true },

    /**
     * 'fixed'  — one of the 6 admin-defined standard tiers (seeded once)
     * 'custom' — built by a specific customer; private to that customer
     */
    planType: {
      type: String,
      required: true,
      enum: ['fixed', 'custom'],
      default: 'fixed',
    },

    /**
     * Only populated when planType === 'fixed'.
     * Validates which of the 6 official tiers this document represents.
     * FIX: removed 'No Plan' (not a real plan tier); added missing 'Standard Care'.
     */
    fixedTier: {
      type: String,
      enum: [...FIXED_TIERS, null],
      default: null,
    },

    /**
     * Fixed plans → false  (platform-wide; every customer sees them)
     * Custom plans → true  (only the owning customer + admin can see them)
     */
    visibleToCustomerOnly: { type: Boolean, default: false },

    /**
     * The customer (User) who built this custom plan.
     * null for fixed plans.
     */
    createdByCustomer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    isActive: { type: Boolean, default: true },

    // ── Pricing ───────────────────────────────────────────────────────────────
    pricing: {
      /**
       * Monthly fee (₹).
       * Fixed plans: defined by admin in seed.
       * Custom plans: auto-computed as sum of customOptions[].lineTotal.
       */
      monthly: { type: Number, required: true, min: 0 },

      /**
       * 'monthly'       — standard recurring (most plans)
       * 'till_delivery' — Pregnant Women Care (one-time until delivery)
       * 'custom'        — customer-built plan billed monthly
       */
      billingCycle: {
        type: String,
        enum: ['monthly', 'till_delivery', 'custom'],
        default: 'monthly',
      },

      /** Display string for pricing cards: "/month", "Till Delivery" */
      billingLabel: { type: String, default: '/month' },

      currency: { type: String, default: 'INR' },
    },

    // ── Free Trial ────────────────────────────────────────────────────────────
    freeTrial: {
      enabled:               { type: Boolean, default: true },
      durationDays:          { type: Number, default: 7 },
      requiresPaymentMethod: { type: Boolean, default: false },
    },

    // ── Membership ────────────────────────────────────────────────────────────
    membership: {
      /** 1 for most; 4 for Family Care; 2 for NRI's Care */
      maxMembers:     { type: Number, default: 1, min: 1 },
      membershipNote: { type: String },
    },

    // ── Doctor Consultations ──────────────────────────────────────────────────
    consultations: {
      /**
       * In-person / general free consultations per month.
       * Basic=2 | Standard=3 | Premium=5 | Family=8 | Pregnant=20 | NRI=0
       * Custom = customer-chosen quantity (from customOptions).
       * -1 = Unlimited.
       */
      freePerMonth:     { type: Number, default: 0 },

      /**
       * Free VIDEO consultations per month (separate from in-person).
       * NRI=3 (video-only plan) | Family=1 (for NRI members in family) | others=0
       */
      videoPerMonth:    { type: Number, default: 0 },

      doctorRangeLabel: { type: String }, // e.g. "1-3 Doctors"

      modes: {
        inPerson: { type: Boolean, default: true },
        video:    { type: Boolean, default: false },
        home:     { type: Boolean, default: false },
      },

      specialNote: { type: String },
    },

    // ── Pharmacy ──────────────────────────────────────────────────────────────
    pharmacy: {
      /**
       * Discount % on online medicine purchases (online booking only — * note).
       * Admin hard-cap: max 25% (enforced via PlatformPricingConfig.caps.pharmacyDiscountMax).
       *
       * Basic:    10–15%  (range, not flat)
       * Standard: 15–20%  (range, not flat)
       * Premium:  flat 20%
       * Family:   flat 20%
       * Pregnant: flat 21%
       * NRI:      0% — international standard e-Prescription instead
       * Custom:   customer picks % up to admin cap (≤25%).
       */
      discountMin:  { type: Number, default: 0, min: 0, max: 25 },
      discountMax:  { type: Number, default: 0, min: 0, max: 25 },
      isFlat:       { type: Boolean, default: false },

      /** For NRI plan: "International standard e-Prescription" */
      specialOffer: { type: String },

      /**
       * Delivery charge per order (₹).
       * null = not applicable (NRI — international standard medical summary instead)
       * 0    = Free delivery  (Standard, Premium, Family, Pregnant Women)
       * 10   = Basic Care (₹10/- charge per delivery)
       * No Plan uses standard delivery charges — not stored (no-plan = no document).
       */
      deliveryChargePerOrder: { type: Number, default: null },

      /**
       * true  = free delivery included  (Standard / Premium / Family / Pregnant)
       * false = charged per order
       */
      freeDelivery: { type: Boolean, default: false },

      deliveryNote: { type: String },
    },

    // ── Diagnostics ───────────────────────────────────────────────────────────
    diagnostics: {
      /**
       * Discount % on diagnostic bookings (online booking only — * note).
       * Admin hard-cap: max 25% (PlatformPricingConfig.caps.diagnosticsDiscountMax).
       *
       * Basic=10% | Standard=10% | Premium=20% | Family=20% | Pregnant=21%
       * NRI = not applicable (isApplicable: false)
       * Custom: customer picks % up to admin cap (≤25%).
       */
      discountPercent:      { type: Number, default: 0, min: 0, max: 25 },
      isApplicable:         { type: Boolean, default: true },

      /**
       * Free home sample collection included.
       * Basic ✓ | Standard ✓ | Premium ✓ | Family ✓ | Pregnant ✓ | NRI -
       */
      homeSampleCollection: { type: Boolean, default: false },
    },

    // ── Transport ─────────────────────────────────────────────────────────────
    transport: {
      /**
       * Per-km rate (₹) snapshotted from PlatformPricingConfig.transport.planRateOverrides.
       * No Plan=21 | Basic=20 | Standard=19 | Premium=18 | Family=18 | Pregnant=18
       * NRI = not applicable (isApplicable: false, ratePerKm: null)
       */
      ratePerKm:    { type: Number, default: null },
      isApplicable: { type: Boolean, default: true },

      /** Rides included/discounted per month (used for custom plan quotas) */
      ridesPerMonth: { type: Number, default: null },
    },

    // ── Care Assistant ────────────────────────────────────────────────────────
    careAssistant: {
      /**
       * included: true = standard service price applies (not free)
       * isDedicated: true = Pregnant Women Care — exclusive dedicated assistant
       */
      included:      { type: Boolean, default: false },
      isDedicated:   { type: Boolean, default: false },

      serviceType: {
        type: String,
        enum: ['None', 'Standard', 'Dedicated'],
        default: 'None',
      },

      /** Visits/month for custom plan */
      visitsPerMonth: { type: Number, default: null },

      note: { type: String },
    },

    // ── Support Tier ──────────────────────────────────────────────────────────
    support: {
      /**
       * ALL plans (including No Plan) show Priority Appointment Scheduling.
       * FIX: default was false — image shows it true for every plan column.
       */
      priorityAppointmentScheduling: { type: Boolean, default: true },

      /**
       * FIX: corrected mapping from image:
       *   Basic Care          → 'Priority'            (Priority customer care Support)
       *   Standard Care       → 'Priority'            (Priority customer care Support)
       *   Premium Care        → 'Dedicated Executive' (Dedicated customer Care Executive)
       *   Family Care         → 'Dedicated Executive' (Dedicated customer Care Executive)
       *   Pregnant Women Care → 'Dedicated Executive' (Dedicated customer Care Executive)
       *   NRI's Care          → '24/7 Service'        (24/7 customer Care Service)
       * (No Plan → 'Standard' — not stored as a document)
       */
      tier: {
        type: String,
        enum: ['Standard', 'Priority', 'Dedicated Executive', '24/7 Service'],
        default: 'Standard',
      },
    },

    // ── Feature Flags ─────────────────────────────────────────────────────────
    features: {
      noHiddenCharges:       { type: Boolean, default: true },
      monthlyHealthSummary:  { type: Boolean, default: false },
      noCancellationCharges: { type: Boolean, default: false },
      autoRefillReminders:   { type: Boolean, default: false },
      digitalReportAccess:   { type: Boolean, default: false },
      additionalFeatures:    [{ type: String }],
    },

    // ── Custom Plan Option Blocks ─────────────────────────────────────────────
    /**
     * ONLY populated when planType === 'custom'.
     * Not stored for fixed plans (undefined, not []).
     * Prices in each block are snapshotted from PlatformPricingConfig at
     * creation time so future admin price changes don't mutate old plans.
     */
    customOptions: {
      type:    [customPlanOptionSchema],
      default: undefined,
    },

    // ── UI / Display ──────────────────────────────────────────────────────────
    idealFor:     { type: String },
    displayOrder: { type: Number, default: 0 },
    isFeatured:   { type: Boolean, default: false },
    badgeLabel:   { type: String }, // "Most Popular", "Best Value", "Maternity Special" …

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // admin who seeded fixed plans
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtual: human-readable price label ─────────────────────────────────────
subscriptionPlanSchema.virtual('priceLabel').get(function () {
  if (this.pricing.billingCycle === 'till_delivery')
    return `₹${this.pricing.monthly} Till Delivery`;
  return `₹${this.pricing.monthly}/month`;
});

// ─── Pre-save: recompute custom plan total ────────────────────────────────────
subscriptionPlanSchema.pre('save', function (next) {
  if (
    this.planType === 'custom' &&
    Array.isArray(this.customOptions) &&
    this.customOptions.length > 0
  ) {
    this.customOptions.forEach(opt => {
      opt.lineTotal = +(opt.quantity * opt.unitPrice).toFixed(2);
    });
    const total = this.customOptions.reduce((sum, opt) => sum + opt.lineTotal, 0);
    this.pricing.monthly = +total.toFixed(2);
    this.pricing.billingCycle = 'custom';
    this.pricing.billingLabel = '/month';
    this.visibleToCustomerOnly = true; // always private
  }
  next();
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
subscriptionPlanSchema.index({ planType: 1, isActive: 1, displayOrder: 1 });
subscriptionPlanSchema.index({ fixedTier: 1 });
subscriptionPlanSchema.index({ createdByCustomer: 1, planType: 1 });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;