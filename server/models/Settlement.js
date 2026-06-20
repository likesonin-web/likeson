import mongoose from 'mongoose';
const { Schema } = mongoose;

// ══════════════════════════════════════════════════════════════════════════════
// SETTLEMENT MODEL — Likeson.in
//
// A Settlement is a CYCLE-LEVEL grouping of earnings that will be
// (or have been) paid out to a partner.
//
// Flow:
//   1. Booking completes → partner's earnings.pendingPayoutPaise incremented
//   2. Cron runs at cycle end (weekly/monthly) OR admin triggers manual
//   3. Settlement doc created → status: 'pending'
//   4. All unsettled bookings for period → earningLines built
//   5. Payout doc created → Settlement.payoutId set → status: 'processing'
//   6. RazorpayX webhook confirms → Settlement status: 'paid'
//   7. Partner's earnings.pendingPayoutPaise decremented
//             earnings.totalPaidPaise incremented
//
// BANK UPDATE DURING SETTLEMENT:
//   If partner updates bank WHILE settlement is in 'processing':
//     - DO NOT cancel the in-flight Payout (money may already be in transit)
//     - New fund_account created + stored on partner doc
//     - NEXT settlement uses new fund account
//     - Current settlement completes on old fund account (immutable snapshot)
// ══════════════════════════════════════════════════════════════════════════════

export const SETTLEMENT_STATUSES = [
  'pending',       // computed, payout not yet dispatched
  'processing',    // Payout doc created, RazorpayX call in-flight
  'paid',          // RazorpayX confirmed success
  'failed',        // payout failed (will retry or needs admin action)
  'cancelled',     // cancelled before dispatch (e.g. zero amount)
  'on_hold',       // admin placed on hold (dispute / KYC issue)
];

export const SETTLEMENT_TRIGGER = [
  'scheduled',   // cron triggered based on settlementCycle
  'manual',      // admin triggered via dashboard
  'instant',     // partner requested early payout (future feature)
];

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const statusLogSchema = new Schema(
  {
    status:    { type: String, required: true },
    note:      { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * Per-booking earning line within this settlement period.
 * Mirrors Payout.earningLineSchema — denormalised here for settlement reports.
 */
const settledBookingSchema = new Schema(
  {
    bookingId:        { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    bookingCode:      { type: String },
    bookingType:      { type: String },
    serviceDate:      { type: Date },
    grossAmountPaise: { type: Number, default: 0 },
    platformFeePaise: { type: Number, default: 0 },
    netAmountPaise:   { type: Number, default: 0 },   // gross - platformFee
    notes:            { type: String },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const settlementSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    settlementCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      index:     true,
      trim:      true,
      uppercase: true,
    },

    // ── Partner ───────────────────────────────────────────────────────────────
    partnerType: {
      type:     String,
      required: true,
      enum:     [
        'doctor', 'hospital', 'transportpartner', 'driver',
        'solodriverpartner', 'pharmacy', 'care_assistant', 'lab_partner',
        'customer',  // for grouped refund settlements
      ],
      index: true,
    },

    partnerUserId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    partnerProfileId: {
      type:  Schema.Types.ObjectId,
      index: true,
    },

    partnerName: { type: String, trim: true },  // denormalised

    // ── Period ────────────────────────────────────────────────────────────────
    periodStart: { type: Date, required: true, index: true },
    periodEnd:   { type: Date, required: true, index: true },

    cycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Manual'],
      default: 'Weekly',
    },

    trigger: {
      type:    String,
      enum:    SETTLEMENT_TRIGGER,
      default: 'scheduled',
    },

    // ── Amounts (all in PAISE) ────────────────────────────────────────────────
    totalGrossAmountPaise:    { type: Number, default: 0, min: 0 },
    totalPlatformFeePaise:    { type: Number, default: 0, min: 0 },
    totalNetAmountPaise:      { type: Number, default: 0, min: 0 },  // what partner gets
    adjustmentsPaise:         { type: Number, default: 0 },          // +/- corrections
    finalPayableAmountPaise:  { type: Number, default: 0, min: 0 },  // totalNet + adjustments

    currency: { type: String, default: 'INR' },

    // ── Bookings Covered ──────────────────────────────────────────────────────
    totalBookings:  { type: Number, default: 0 },
    settledBookings:{ type: [settledBookingSchema], default: [] },

    // ── Payout Link ───────────────────────────────────────────────────────────
    /**
     * payoutId — the Payout doc created to disburse this settlement.
     * null until payout is dispatched.
     */
    payoutId: {
      type:    Schema.Types.ObjectId,
      ref:     'Payout',
      default: null,
      index:   true,
    },

    /**
     * Fund account used for payout (copied from Payout doc after creation).
     * Denormalised here so settlement report can show bank details
     * without joining to Payout.
     */
    fundAccountSnapshot: {
      razorpayFundAccountId: { type: String },
      accountType:           { type: String },
      accountHolderName:     { type: String },
      accountNumber:         { type: String },  // masked last 4
      ifscCode:              { type: String },
      bankName:              { type: String },
      upiId:                 { type: String },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    SETTLEMENT_STATUSES,
      default: 'pending',
      index:   true,
    },

    statusLog: { type: [statusLogSchema], default: [] },

    holdReason:   { type: String },   // set when status = 'on_hold'
    failureNote:  { type: String },

    // ── Timing ───────────────────────────────────────────────────────────────
    scheduledAt:  { type: Date },     // when this settlement was queued
    processedAt:  { type: Date },     // when payout was dispatched
    completedAt:  { type: Date },     // when RazorpayX confirmed

    // ── Admin / Internal ──────────────────────────────────────────────────────
    initiatedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    notes:        { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

settlementSchema.virtual('finalPayableRupees').get(function () {
  return +(this.finalPayableAmountPaise / 100).toFixed(2);
});

settlementSchema.virtual('isPaid').get(function () {
  return this.status === 'paid';
});

settlementSchema.virtual('isDispatchable').get(function () {
  return this.status === 'pending' && this.finalPayableAmountPaise >= 100;
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

settlementSchema.pre('save', async function () {
  // Auto-generate settlementCode
  if (this.isNew && !this.settlementCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-3).toUpperCase();
    this.settlementCode = `STL-${ts}-${rand}`;
  }

  // Recalculate finalPayableAmountPaise from net + adjustments
  if (
    this.isModified('totalNetAmountPaise') ||
    this.isModified('adjustmentsPaise')
  ) {
    this.finalPayableAmountPaise = Math.max(
      0,
      (this.totalNetAmountPaise || 0) + (this.adjustmentsPaise || 0)
    );
  }

  // Status log
  if (this.isModified('status') && !this.isNew) {
    this.statusLog.push({
      status:    this.status,
      changedBy: this.updatedBy || null,
      changedAt: new Date(),
    });
  }

  // Stamp timing
  if (this.isModified('status')) {
    if (this.status === 'processing' && !this.processedAt) this.processedAt = new Date();
    if (this.status === 'paid'       && !this.completedAt) this.completedAt = new Date();
  }

  // totalBookings = settledBookings.length
  if (this.isModified('settledBookings')) {
    this.totalBookings = this.settledBookings.length;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

settlementSchema.index({ partnerUserId: 1, status: 1 });
settlementSchema.index({ partnerUserId: 1, periodStart: -1 });
settlementSchema.index({ partnerType: 1, status: 1 });
settlementSchema.index({ status: 1, scheduledAt: 1 });    // cron: process pending
settlementSchema.index({ payoutId: 1 }, { sparse: true });
settlementSchema.index({ periodStart: 1, periodEnd: 1 });
settlementSchema.index({ createdAt: -1 });

const Settlement = mongoose.model('Settlement', settlementSchema);
export default Settlement;