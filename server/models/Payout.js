import mongoose from 'mongoose';
const { Schema } = mongoose;

// ══════════════════════════════════════════════════════════════════════════════
// PAYOUT MODEL — Likeson.in
//
// Tracks every money movement OUT of platform to a partner/customer.
//
// PARTNER TYPES (payoutFor):
//   doctor          → DoctorProfile
//   hospital        → Hospital
//   transportpartner→ TransportPartner
//   driver          → Driver
//   solodriverpartner → SoloDriverPartner
//   pharmacy        → PharmacyStore
//   care_assistant  → CareAssistantProfile (future)
//   lab_partner     → LabPartnerProfile
//   customer        → User (refunds on cancel/return)
//
// FUND ACCOUNT SAFETY RULE:
//   Razorpay fund accounts are IMMUTABLE after creation.
//   When partner updates bank/UPI:
//     1. New Razorpay contact+fund_account created
//     2. razorpayFundAccountId updated on partner doc
//     3. Old fund account deactivated (via API)
//     4. All new payouts use new fund account
//     5. In-flight payouts (status=processing) NOT affected — finish on old
//
// AMOUNTS: always stored in PAISE (₹1 = 100 paise) — matches RazorpayX API
// ══════════════════════════════════════════════════════════════════════════════

export const PAYOUT_FOR_TYPES = [
  'doctor',
  'hospital',
  'transportpartner',
  'driver',
  'solodriverpartner',
  'pharmacy',
  'care_assistant',
  'lab_partner',
  'customer',   // refunds
];

export const PAYOUT_STATUSES = [
  'queued',       // created, not yet sent to RazorpayX
  'processing',   // sent to RazorpayX, awaiting confirmation
  'processed',    // RazorpayX confirmed success
  'failed',       // RazorpayX returned failure
  'cancelled',    // cancelled before dispatch (e.g. bank update mid-cycle)
  'reversed',     // processed but later reversed by bank
];

export const PAYOUT_MODES = [
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'card',   // rare but RazorpayX supports
];

export const PAYOUT_PURPOSES = [
  'payout',       // standard partner settlement
  'refund',       // customer refund
  'cashback',
  'salary',
];

// ── Sub-schemas ───────────────────────────────────────────────────────────────

/**
 * Snapshot of fund account used for this payout.
 * Stored immutably so history is preserved even after partner changes bank.
 */
const fundAccountSnapshotSchema = new Schema(
  {
    razorpayContactId:     { type: String },
    razorpayFundAccountId: { type: String },
    accountType:           { type: String, enum: ['bank_account', 'vpa'] }, // vpa = UPI
    // bank
    accountHolderName: { type: String },
    accountNumber:     { type: String },  // masked: last 4 digits only
    ifscCode:          { type: String },
    bankName:          { type: String },
    // upi
    upiId:             { type: String },
  },
  { _id: false }
);

const failureDetailSchema = new Schema(
  {
    code:        { type: String },   // RazorpayX error code
    description: { type: String },
    source:      { type: String },   // 'business' | 'customer' | 'gateway'
    step:        { type: String },
    reason:      { type: String },
    rawResponse: { type: Schema.Types.Mixed, select: false },
  },
  { _id: false }
);

const statusLogSchema = new Schema(
  {
    status:    { type: String, required: true },
    note:      { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    razorpayStatus: { type: String },  // raw status from webhook
  },
  { _id: true }
);

/**
 * Booking-level earnings breakdown that contributed to this payout batch.
 * Used for reconciliation / partner pay-slips.
 */
const earningLineSchema = new Schema(
  {
    bookingId:    { type: Schema.Types.ObjectId, ref: 'Booking' },
    bookingCode:  { type: String },
    bookingType:  { type: String },
    serviceDate:  { type: Date },
    grossAmountPaise: { type: Number },      // amount charged to customer
    platformFeePaise: { type: Number },      // platform cut
    netAmountPaise:   { type: Number },      // grossAmount - platformFee = partner's share
    notes:        { type: String },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const payoutSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    payoutCode: {
      type:    String,
      unique:  true,
      sparse:  true,
      index:   true,
      trim:    true,
      uppercase: true,
    },

    // ── Recipient ─────────────────────────────────────────────────────────────
    payoutFor: {
      type:     String,
      required: true,
      enum:     PAYOUT_FOR_TYPES,
      index:    true,
    },

    /**
     * recipientUserId — the User._id of the partner/customer.
     * Used for quick lookups and notification dispatch.
     */
    recipientUserId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    /**
     * recipientProfileId — _id of the profile doc (DoctorProfile, Hospital, etc.)
     * For customers (refunds): same as recipientUserId.
     */
    recipientProfileId: {
      type:  Schema.Types.ObjectId,
      index: true,
    },

    recipientName: { type: String, trim: true },   // denormalised for pay-slip

    // ── Amount ────────────────────────────────────────────────────────────────
    /**
     * All amounts in PAISE. ₹100 = 10000 paise.
     * Matches RazorpayX /v1/payouts `amount` field.
     */
    amountPaise: {
      type:     Number,
      required: true,
      min:      100,   // RazorpayX minimum: ₹1 = 100 paise
    },

    currency: { type: String, default: 'INR' },

    // ── RazorpayX Fields ──────────────────────────────────────────────────────
    razorpayPayoutId:      { type: String, unique: true, sparse: true, index: true },
    razorpayFundAccountId: { type: String },   // fund_account_id used for THIS payout
    razorpayContactId:     { type: String },
    razorpayBatchId:       { type: String },   // if grouped in a batch

    mode:    { type: String, enum: PAYOUT_MODES, default: 'IMPS' },
    purpose: { type: String, enum: PAYOUT_PURPOSES, default: 'payout' },

    narration: { type: String, trim: true },   // appears on partner's bank statement

    // ── Fund Account Snapshot ─────────────────────────────────────────────────
    /**
     * Immutable copy of bank/UPI used for this payout.
     * Critical: even if partner later changes bank, this record
     * shows exactly where THIS money went.
     */
    fundAccountSnapshot: {
      type:     fundAccountSnapshotSchema,
      required: true,
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    PAYOUT_STATUSES,
      default: 'queued',
      index:   true,
    },

    statusLog: { type: [statusLogSchema], default: [] },

    failureDetail: { type: failureDetailSchema, default: null },

    // ── Settlement Reference ──────────────────────────────────────────────────
    /**
     * settlementId — links to a Settlement doc if this payout is part of a
     * scheduled settlement cycle (weekly/monthly).
     * null for ad-hoc / manual payouts.
     */
    settlementId: {
      type:    Schema.Types.ObjectId,
      ref:     'Settlement',
      default: null,
      index:   true,
    },

    // ── Earnings Breakdown ────────────────────────────────────────────────────
    /**
     * earningLines — individual bookings that contributed to this payout.
     * Used to generate itemised pay-slips.
     * Optional: present for settlement payouts, absent for ad-hoc refunds.
     */
    earningLines: { type: [earningLineSchema], default: [] },

    // ── Timing ───────────────────────────────────────────────────────────────
    scheduledAt:  { type: Date },      // when payout was queued for dispatch
    processedAt:  { type: Date },      // when RazorpayX confirmed success
    failedAt:     { type: Date },
    reversedAt:   { type: Date },

    // ── Retry Logic ───────────────────────────────────────────────────────────
    retryCount:   { type: Number, default: 0, max: 3 },
    retryAfter:   { type: Date },
    parentPayoutId: {
      type:    Schema.Types.ObjectId,
      ref:     'Payout',
      default: null,   // set when this is a retry of a failed payout
    },

    // ── Admin / Internal ──────────────────────────────────────────────────────
    initiatedBy:  { type: Schema.Types.ObjectId, ref: 'User' },   // admin who triggered manual payout
    notes:        { type: String, trim: true },
    tags:         [{ type: String, trim: true, lowercase: true }],

    webhookRaw:   { type: Schema.Types.Mixed, select: false },     // raw RazorpayX webhook payload

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

payoutSchema.virtual('amountRupees').get(function () {
  return +(this.amountPaise / 100).toFixed(2);
});

payoutSchema.virtual('isSettled').get(function () {
  return this.status === 'processed';
});

payoutSchema.virtual('canRetry').get(function () {
  return this.status === 'failed' && this.retryCount < 3;
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

payoutSchema.pre('save', async function () {
  // Auto-generate payoutCode
  if (this.isNew && !this.payoutCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-3).toUpperCase();
    this.payoutCode = `PAY-${ts}-${rand}`;
  }

  // Append to statusLog on status change
  if (this.isModified('status') && !this.isNew) {
    this.statusLog.push({
      status:    this.status,
      changedBy: this.updatedBy || null,
      changedAt: new Date(),
    });
  }

  // Auto-stamp timing fields
  if (this.isModified('status')) {
    if (this.status === 'processed' && !this.processedAt) this.processedAt = new Date();
    if (this.status === 'failed'    && !this.failedAt)    this.failedAt    = new Date();
    if (this.status === 'reversed'  && !this.reversedAt)  this.reversedAt  = new Date();
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

payoutSchema.index({ recipientUserId: 1, status: 1 });
payoutSchema.index({ recipientUserId: 1, createdAt: -1 });
payoutSchema.index({ payoutFor: 1, status: 1 });
payoutSchema.index({ settlementId: 1 });
payoutSchema.index({ razorpayPayoutId: 1 }, { sparse: true });
payoutSchema.index({ status: 1, scheduledAt: 1 });   // cron job: fetch queued payouts
payoutSchema.index({ status: 1, retryAfter: 1 });    // cron job: retry failed
payoutSchema.index({ createdAt: -1 });

const Payout = mongoose.model('Payout', payoutSchema);
export default Payout;