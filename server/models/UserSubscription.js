import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * UserSubscription Model — Likeson.in
 *
 * FIXES IN THIS VERSION:
 *  BUG #2 FIX: fixedTier enum now includes 'Standard Care' (was missing,
 *              causing validation errors when admin created Standard Care plan).
 *
 *  BUG #3 + #5 FIX: subscriptionUsagePending field lives on Booking model
 *              (see Booking.js). This model only stores the actual confirmed
 *              usage in usageHistory. No changes needed here for that fix.
 *
 *  All other fields unchanged from previous version.
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
 * One user can have ONE active subscription at a time.
 * Past subscriptions are kept with status 'Expired' / 'Cancelled' for history.
 *
 * SYNC NOTE: Status enum, field names, and paymentHistory structure are
 * kept in sync with subscriptionRouter.js (PascalCase status values,
 * expiryDate, trialUsed, savedPaymentMethodId, paymentHistory[]).
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
     *   status: 'Active'    — paid & within expiry window
     *   status: 'Trial'     — within the free-trial window
     *   status: 'Paused'    — paused by admin / customer
     *   status: 'Cancelled' — cancelled; access until expiryDate
     *   status: 'Expired'   — past expiryDate or delivery date
     */
    status: {
      type:    String,
      enum:    ['Trial', 'Active', 'Paused', 'Cancelled', 'Expired'],
      default: 'Trial',
      index:   true,
    },

    // ── Free Trial ────────────────────────────────────────────────────────────
    /**
     * trialUsed — lifetime flag; set to true when a Trial subscription is
     * created and never cleared. The router checks this field to enforce
     * the "one free trial per account" rule.
     */
    trialUsed: { type: Boolean, default: false, index: true },

    /**
     * Stored for plans where freeTrial.requiresPaymentMethod === true.
     * Used to auto-charge when the trial ends.
     */
    savedPaymentMethodId: { type: String, default: null },

    // ── Expiry / Billing Dates ────────────────────────────────────────────────
    /**
     * Single source-of-truth for when access ends.
     *   - Paid plans:         today + 30 days
     *   - Pregnant Women Care: today + 280 days  (till_delivery)
     *   - Free trial:         today + plan.freeTrial.durationDays
     */
    expiryDate: { type: Date, required: true, index: true },

    currentPeriodStart: { type: Date },
    nextBillingDate:    { type: Date, index: true }, // used by billing cron

    autoRenew: { type: Boolean, default: true },

    /**
     * For Pregnant Women Care ("Till Delivery").
     * When the delivery date is reached the pre-save hook sets status to Expired.
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
     * BUG #2 FIX: snapshotLimits in subscriptionRouter.js now correctly
     * reads customOptions for custom plans, so these fields are properly
     * populated for custom plan subscribers too.
     *
     * Snapshotting means the customer keeps their contracted limits even if
     * the admin later changes the plan defaults.
     *
     * Special value for transportRatePerKm:
     *   null   = not applicable (NRI plan) or no transport in custom plan
     *   > 0    = fixed plan rate
     *   -1     = sentinel: custom plan transport active, actual pricePerKm
     *            resolved from plan.customOptions at booking time by resolveKmRate()
     */
    limits: {
      consultationsPerMonth:       { type: Number, default: 0 },
      transportRidesPerMonth:      { type: Number, default: null },
      careAssistantVisitsPerMonth: { type: Number, default: null },
      labTestsPerMonth:            { type: Number, default: 0 },
      pharmacyDiscountPercent:     { type: Number, default: 0 },
      diagnosticsDiscountPercent:  { type: Number, default: 0 },
      transportRatePerKm:          { type: Number, default: null },
      homeSampleCollection:        { type: Boolean, default: false },
    },

    // ── Monthly Usage Tracking ────────────────────────────────────────────────
    /**
     * New entry appended each billing cycle by the usage-tracking service.
     *
     * BUG #3 + #5 FIX: These fields are now only incremented AFTER payment
     * is verified. Booking routes queue pending increments on the Booking
     * document (Booking.subscriptionUsagePending) and flush here only after
     * Razorpay signature verified or wallet payment confirmed.
     * Cancelled bookings never flush — quota is never consumed.
     */
    usageHistory: { type: [monthlyUsageSchema], default: [] },

    // ── Payment History ───────────────────────────────────────────────────────
    /**
     * Array of all payment records for this subscription.
     * The router appends a new entry on every successful Razorpay payment
     * (initial purchase AND trial-to-paid conversion).
     * Auto-renewal deductions (wallet) are also appended by the cron route.
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

// ─── Virtual: remaining consultations this month ──────────────────────────────
userSubscriptionSchema.virtual('consultationsRemaining').get(function () {
  if (this.limits.consultationsPerMonth === -1) return Infinity; // unlimited
  const used = this.currentMonthUsage?.consultationsUsed ?? 0;
  return Math.max(0, this.limits.consultationsPerMonth - used);
});

// ─── Virtual: remaining care assistant visits this month ──────────────────────
userSubscriptionSchema.virtual('careAssistantVisitsRemaining').get(function () {
  if (!this.limits.careAssistantVisitsPerMonth) return 0;
  if (this.limits.careAssistantVisitsPerMonth === -1) return Infinity; // unlimited
  const used = this.currentMonthUsage?.careAssistantVisitsUsed ?? 0;
  return Math.max(0, this.limits.careAssistantVisitsPerMonth - used);
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