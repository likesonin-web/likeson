import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * UserSubscription Model — Likeson.in
 *
 * CHANGES IN THIS VERSION:
 *  FEATURE: careAssistantTierSnapshot — limits now stores tier label, charge,
 *           and index snapshotted from PlatformPricingConfig at subscribe time.
 *
 *  FEATURE: consultationSummary virtual — exposes perMonth / used / remaining
 *           / unlimited flag + plan modes (after populate).
 *
 *  FEATURE: careAssistantSummary virtual — exposes tier info + visits
 *           used / remaining in one object.
 *
 *  FEATURE: transportRidesRemaining virtual — parallel to consultations.
 *
 *  BUG #2 FIX: fixedTier enum includes 'Standard Care'.
 *
 *  BUG #3 + #5 FIX: usageHistory incremented only after payment verified.
 *           Pending increments live on Booking.subscriptionUsagePending.
 *
 * Tracks an individual user's active subscription:
 *   - Which plan (fixed or custom) they are on
 *   - Free-trial window (7 days default)
 *   - Billing cycle dates & auto-renewal
 *   - Monthly benefit consumption (consultations, rides, care visits, lab tests)
 *   - Multi-member slots (Family / NRI plans)
 *   - Payment history array (Razorpay transaction records)
 *   - Cancellation details
 *
 * One user → ONE active subscription at a time.
 * Past subscriptions kept with status 'Expired' / 'Cancelled' for history.
 *
 * SYNC NOTE: Status enum, field names, and paymentHistory structure kept in
 * sync with subscriptionRouter.js (PascalCase status values, expiryDate,
 * trialUsed, savedPaymentMethodId, paymentHistory[]).
 */

// ─── Sub-schema: single payment record ───────────────────────────────────────
const paymentHistorySchema = new Schema(
  {
    transactionId: { type: String, required: true }, // razorpay_payment_id
    amount:        { type: Number, required: true },
    paidAt:        { type: Date,   default: Date.now },
  },
  { _id: false }
);

// ─── Sub-schema: monthly usage snapshot ──────────────────────────────────────
const monthlyUsageSchema = new Schema(
  {
    month: { type: Number, required: true }, // 1–12
    year:  { type: Number, required: true },

    consultationsUsed:       { type: Number, default: 0 },
    transportRidesUsed:      { type: Number, default: 0 },
    labTestsUsed:            { type: Number, default: 0 },
    careAssistantVisitsUsed: { type: Number, default: 0 },
    pharmacyOrdersPlaced:    { type: Number, default: 0 }, // analytics
    diagnosticBookingsMade:  { type: Number, default: 0 }, // analytics
  },
  { _id: false }
);

// ─── Sub-schema: plan member slot (Family / NRI multi-member plans) ──────────
const memberSlotSchema = new Schema(
  {
    memberId:    { type: Schema.Types.ObjectId, ref: 'User' }, // optional link to User collection
    memberEmail: { type: String, required: true },             // denormalised for quick access
    relation:    { type: String, trim: true },                 // "Spouse", "Parent", "Child" …
    addedAt:     { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const userSubscriptionSchema = new Schema(
  {
    // ── Who ───────────────────────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    // ── Which Plan ────────────────────────────────────────────────────────────
    plan: {
      type:     Schema.Types.ObjectId,
      ref:      'SubscriptionPlan',
      required: true,
    },

    /** Denormalised for quick reads without a populate */
    planName:  { type: String },
    planType:  { type: String, enum: ['fixed', 'custom'] },

    /**
     * BUG #2 FIX: 'Standard Care' added to fixedTier enum.
     * Was missing from previous version, causing validation errors when
     * admin created Standard Care subscriptions for users.
     */
    fixedTier: {
      type: String,
      enum: [
        'Basic Care',
        'Standard Care',
        'Premium Care',
        'Family Care',
        'Pregnant Women Care',
        "NRI's Care",
        null,
      ],
      default: null,
    },

    // ── Status ────────────────────────────────────────────────────────────────
    /**
     * PascalCase to match all router comparisons:
     *   'Active'    — paid & within expiry window
     *   'Trial'     — within the free-trial window
     *   'Paused'    — paused by admin / customer
     *   'Cancelled' — cancelled; access until expiryDate
     *   'Expired'   — past expiryDate or delivery date
     */
    status: {
      type:    String,
      enum:    ['Trial', 'Active', 'Paused', 'Cancelled', 'Expired'],
      default: 'Trial',
      index:   true,
    },

    // ── Free Trial ────────────────────────────────────────────────────────────
    /**
     * trialUsed — lifetime flag; set true when Trial subscription created,
     * never cleared. Router checks to enforce "one free trial per account".
     */
    trialUsed: { type: Boolean, default: false, index: true },

    /**
     * Stored for plans where freeTrial.requiresPaymentMethod === true.
     * Used to auto-charge when trial ends.
     */
    savedPaymentMethodId: { type: String, default: null },

    // ── Expiry / Billing Dates ────────────────────────────────────────────────
    /**
     * Single source-of-truth for when access ends.
     *   Paid plans:            today + 30 days
     *   Pregnant Women Care:   today + 280 days  (till_delivery)
     *   Free trial:            today + plan.freeTrial.durationDays
     */
    expiryDate: { type: Date, required: true, index: true },

    currentPeriodStart: { type: Date },
    nextBillingDate:    { type: Date, index: true }, // used by billing cron

    autoRenew: { type: Boolean, default: true },

    /**
     * For Pregnant Women Care ("Till Delivery").
     * When delivery date reached pre-save hook sets status to Expired.
     */
    expectedDeliveryDate: { type: Date, default: null },

    // ── Multi-Member Slots ────────────────────────────────────────────────────
    /**
     * Additional members under Family Care (up to 4 total) or
     * NRI's Care (up to 2 total).
     * Primary subscriber (user field) is member #1 — not duplicated here.
     */
    members: { type: [memberSlotSchema], default: [] },

    // ── Benefit Limits (snapshotted from plan at subscription time) ───────────
    /**
     * Snapshotting means the customer keeps contracted limits even if
     * admin later changes plan defaults.
     *
     * transportRatePerKm special values:
     *   null  = not applicable (NRI plan) or no transport in custom plan
     *   > 0   = fixed plan per-km rate
     *   -1    = sentinel: custom plan transport active; actual pricePerKm
     *           resolved from plan.customOptions at booking time via resolveKmRate()
     *
     * consultationsPerMonth special value:
     *   -1    = unlimited (e.g. Premium Care or future unlimited tier)
     *    0    = none included
     *   > 0   = fixed monthly quota
     *
     * careAssistantVisitsPerMonth:
     *   null  = care assistant not included in plan
     *   -1    = unlimited / dedicated (Pregnant Women Care)
     *   > 0   = monthly visit quota
     *
     * careAssistantTierIndex / careAssistantTierLabel / careAssistantChargePerVisit:
     *   Snapshotted from PlatformPricingConfig.customPlanOptions.careAssistant
     *   .pricingTiers[careAssistantTierIndex] at subscription creation time.
     *   null for fixed plans where care assistant is standard-priced service
     *   (not tier-selected by customer).
     */
    limits: {
      // ── Consultations ──────────────────────────────────────────────────────
      consultationsPerMonth: { type: Number, default: 0 },
      // -1 = unlimited, 0 = none, >0 = monthly quota

      // ── Transport ─────────────────────────────────────────────────────────
      transportRidesPerMonth: { type: Number, default: null },
      transportRatePerKm:     { type: Number, default: null },
      // null = N/A, -1 = resolve from customOptions at booking time

      // ── Care Assistant ─────────────────────────────────────────────────────
      careAssistantVisitsPerMonth: { type: Number, default: null },
      // null = not included, -1 = unlimited/dedicated, >0 = monthly quota

      /**
       * NEW — snapshotted from PlatformPricingConfig.careAssistant.pricingTiers
       * (or customPlanOptions.careAssistant.pricingTiers) at subscribe time.
       *
       * careAssistantTierIndex:
       *   Index into the pricingTiers array that the customer chose (custom plan)
       *   or that the fixed plan maps to. null for fixed plans with standard
       *   service (charge resolved at booking time by care assistant service).
       *
       * careAssistantTierLabel:
       *   Human-readable label snapshotted from the tier, e.g. "2–4 Hours".
       *   For fixed plans with dedicated assistant: 'Dedicated'.
       *   null if care assistant not included.
       *
       * careAssistantChargePerVisit:
       *   ₹ charged to user per visit for this tier, snapshotted.
       *   null for fixed plans where charge is resolved live at booking.
       *   Used in careAssistantSummary virtual for display.
       */
      careAssistantTierIndex:      { type: Number, default: null },
      careAssistantTierLabel:      { type: String, default: null },
      careAssistantChargePerVisit: { type: Number, default: null },

      // ── Lab / Diagnostics ──────────────────────────────────────────────────
      labTestsPerMonth:           { type: Number, default: 0 },
      diagnosticsDiscountPercent: { type: Number, default: 0 },
      homeSampleCollection:       { type: Boolean, default: false },

      // ── Pharmacy ──────────────────────────────────────────────────────────
      pharmacyDiscountPercent: { type: Number, default: 0 },
    },

    // ── Monthly Usage Tracking ────────────────────────────────────────────────
    /**
     * New entry appended each billing cycle by usage-tracking service.
     *
     * BUG #3 + #5 FIX: Fields incremented ONLY after payment verified.
     * Booking routes queue pending increments on Booking.subscriptionUsagePending
     * and flush here only after Razorpay signature verified or wallet payment
     * confirmed. Cancelled bookings never flush — quota never consumed.
     */
    usageHistory: { type: [monthlyUsageSchema], default: [] },

    // ── Payment History ───────────────────────────────────────────────────────
    /**
     * All payment records for this subscription.
     * Router appends on every successful Razorpay payment (initial purchase
     * AND trial-to-paid conversion). Auto-renewal wallet deductions appended
     * by billing cron route.
     */
    paymentHistory: { type: [paymentHistorySchema], default: [] },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancelledAt:        { type: Date },
    cancellationReason: { type: String },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // admin acting on behalf
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtual: current month usage (convenience getter) ───────────────────────
userSubscriptionSchema.virtual('currentMonthUsage').get(function () {
  const now = new Date();
  return (
    this.usageHistory.find(
      (u) => u.month === now.getMonth() + 1 && u.year === now.getFullYear()
    ) || null
  );
});

// ─── Virtual: consultation summary ───────────────────────────────────────────
/**
 * Returns a single object with all consultation info needed for UI / API:
 *   perMonth    — monthly quota (-1 = unlimited, 0 = none)
 *   used        — consumed this month
 *   remaining   — remaining this month (Infinity if unlimited)
 *   unlimited   — boolean shorthand for perMonth === -1
 *   percentUsed — 0–100 (null if unlimited)
 *
 * NOTE: `modes` (inPerson / video / home) live on SubscriptionPlan.consultations.modes.
 * Populate `plan` first and access via sub.plan.consultations.modes if needed.
 */
userSubscriptionSchema.virtual('consultationSummary').get(function () {
  const limit = this.limits.consultationsPerMonth;
  const used  = this.currentMonthUsage?.consultationsUsed ?? 0;
  const unlimited = limit === -1;

  return {
    perMonth:    limit,
    used,
    remaining:   unlimited ? Infinity : Math.max(0, limit - used),
    unlimited,
    percentUsed: unlimited ? null : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)),
  };
});

// ─── Virtual: remaining consultations this month (quick scalar) ──────────────
userSubscriptionSchema.virtual('consultationsRemaining').get(function () {
  if (this.limits.consultationsPerMonth === -1) return Infinity;
  const used = this.currentMonthUsage?.consultationsUsed ?? 0;
  return Math.max(0, this.limits.consultationsPerMonth - used);
});

// ─── Virtual: transport rides remaining this month ───────────────────────────
/**
 * null  = transport not applicable (NRI plan or no transport in custom plan)
 * >= 0  = rides remaining
 */
userSubscriptionSchema.virtual('transportRidesRemaining').get(function () {
  if (this.limits.transportRidesPerMonth === null) return null;
  const used = this.currentMonthUsage?.transportRidesUsed ?? 0;
  return Math.max(0, this.limits.transportRidesPerMonth - used);
});

// ─── Virtual: care assistant summary ─────────────────────────────────────────
/**
 * null if care assistant not included in plan.
 *
 * Returns:
 *   tierIndex       — index into pricingTiers[] snapshotted at subscribe time
 *   tierLabel       — e.g. "2–4 Hours" or "Dedicated"
 *   chargePerVisit  — ₹ per visit for this tier (null if fixed plan live-resolved)
 *   visitsPerMonth  — monthly quota (-1 = unlimited/dedicated)
 *   visitsUsed      — consumed this month
 *   visitsRemaining — remaining this month (Infinity if unlimited)
 *   unlimited       — boolean shorthand
 *   percentUsed     — 0–100 (null if unlimited)
 */
userSubscriptionSchema.virtual('careAssistantSummary').get(function () {
  const limit = this.limits.careAssistantVisitsPerMonth;
  if (limit === null) return null; // not included

  const used      = this.currentMonthUsage?.careAssistantVisitsUsed ?? 0;
  const unlimited = limit === -1;

  return {
    tierIndex:      this.limits.careAssistantTierIndex,
    tierLabel:      this.limits.careAssistantTierLabel,
    chargePerVisit: this.limits.careAssistantChargePerVisit,
    visitsPerMonth:  limit,
    visitsUsed:      used,
    visitsRemaining: unlimited ? Infinity : Math.max(0, limit - used),
    unlimited,
    percentUsed: unlimited ? null : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)),
  };
});

// ─── Virtual: remaining care assistant visits this month (quick scalar) ───────
userSubscriptionSchema.virtual('careAssistantVisitsRemaining').get(function () {
  if (!this.limits.careAssistantVisitsPerMonth) return 0;
  if (this.limits.careAssistantVisitsPerMonth === -1) return Infinity;
  const used = this.currentMonthUsage?.careAssistantVisitsUsed ?? 0;
  return Math.max(0, this.limits.careAssistantVisitsPerMonth - used);
});

// ─── Virtual: lab tests remaining this month ─────────────────────────────────
userSubscriptionSchema.virtual('labTestsRemaining').get(function () {
  if (this.limits.labTestsPerMonth === -1) return Infinity;
  const used = this.currentMonthUsage?.labTestsUsed ?? 0;
  return Math.max(0, this.limits.labTestsPerMonth - used);
});

// ─── Virtual: days remaining until expiry ────────────────────────────────────
userSubscriptionSchema.virtual('daysRemaining').get(function () {
  if (!this.expiryDate) return 0;
  return Math.max(
    Math.ceil((this.expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
    0
  );
});

// ─── Virtual: whether subscription is currently active and valid ──────────────
userSubscriptionSchema.virtual('isCurrentlyActive').get(function () {
  if (!['Active', 'Trial'].includes(this.status)) return false;
  if (!this.expiryDate) return false;
  return new Date(this.expiryDate) > new Date();
});

// ─── Virtual: full benefit snapshot for UI display ───────────────────────────
/**
 * Convenience object aggregating all benefit summaries.
 * Suitable for a "My Plan" dashboard screen.
 */
userSubscriptionSchema.virtual('benefitSnapshot').get(function () {
  return {
    consultations:   this.consultationSummary,
    careAssistant:   this.careAssistantSummary,
    transportRides: {
      perMonth:        this.limits.transportRidesPerMonth,
      ratePerKm:       this.limits.transportRatePerKm,
      used:            this.currentMonthUsage?.transportRidesUsed ?? 0,
      remaining:       this.transportRidesRemaining,
    },
    labTests: {
      perMonth:        this.limits.labTestsPerMonth,
      used:            this.currentMonthUsage?.labTestsUsed ?? 0,
      remaining:       this.labTestsRemaining,
    },
    pharmacy: {
      discountPercent:   this.limits.pharmacyDiscountPercent,
      ordersPlaced:      this.currentMonthUsage?.pharmacyOrdersPlaced ?? 0,
    },
    diagnostics: {
      discountPercent:   this.limits.diagnosticsDiscountPercent,
      homeSample:        this.limits.homeSampleCollection,
      bookingsMade:      this.currentMonthUsage?.diagnosticBookingsMade ?? 0,
    },
  };
});

// ─── Pre-save: auto-expire Pregnant Women Care when delivery date passed ──────
userSubscriptionSchema.pre('save', async function () {
  if (
    this.expectedDeliveryDate &&
    this.expectedDeliveryDate < new Date() &&
    this.status === 'Active'
  ) {
    this.status = 'Expired';
  }
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ nextBillingDate: 1, status: 1 }); // billing cron
userSubscriptionSchema.index({ plan: 1, status: 1 });            // plan analytics
userSubscriptionSchema.index({ expiryDate: 1, status: 1 });      // expiry-alert cron
userSubscriptionSchema.index({ trialUsed: 1, user: 1 });         // trial eligibility check

const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);
export default UserSubscription;

 