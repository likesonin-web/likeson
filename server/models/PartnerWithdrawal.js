import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateWithdrawalId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

/**
 * PartnerWithdrawal
 *
 * Partner-initiated payout request.
 * Flows through RazorpayX Payout API.
 * Status mirrors RazorpayX payout lifecycle.
 */

export const WITHDRAWAL_STATUSES = [
  // Internal states
  'REQUESTED',    // partner submitted; not yet sent to RazorpayX
  'APPROVED',     // finance approved; queued for RazorpayX
  'REJECTED',     // finance rejected
  // RazorpayX payout states (mirrored)
  'queued',       // RazorpayX queued
  'pending',      // RazorpayX pending
  'processing',   // RazorpayX processing
  'processed',    // RazorpayX completed → WITHDRAWAL_SUCCESS ledger entry
  'reversed',     // RazorpayX reversed → WITHDRAWAL_REVERSED ledger entry
  'cancelled',    // RazorpayX cancelled
  'failed',       // RazorpayX failed → WITHDRAWAL_REVERSED ledger entry
];

const bankAccountSnapshotSchema = new Schema(
  {
    accountHolderName: { type: String },
    accountNumberLast4: { type: String },  // last 4 digits only
    ifscCode:          { type: String },
    bankName:          { type: String },
    upiId:             { type: String, default: null },
    razorpayFundAccountId: { type: String, default: null },
  },
  { _id: false }
);

const partnerWithdrawalSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    withdrawalId: {
      type:   String,
      unique: true,
      index:  true,
    },

    // ── References ───────────────────────────────────────────────────────────
    partnerId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    partnerRole: {
      type: String,
      enum: ['doctor', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'lab_partner'],
    },

    walletId: {
      type:     Schema.Types.ObjectId,
      ref:      'PartnerWallet',
      required: true,
    },

    // ── Amount ───────────────────────────────────────────────────────────────
    amount: {
      type:     Number,
      required: true,
      min:      [100, 'Minimum withdrawal is ₹100'],
    },

    currency: { type: String, default: 'INR' },

    // ── Bank Snapshot ─────────────────────────────────────────────────────────
    /**
     * Snapshot of bank details at time of request.
     * Immutable reference even if partner updates bank details later.
     */
    bankAccountSnapshot: {
      type:     bankAccountSnapshotSchema,
      required: true,
    },

    // ── Razorpay X ───────────────────────────────────────────────────────────
    razorpayContactId:     { type: String, default: null, select: false },
    razorpayFundAccountId: { type: String, default: null, select: false },
    razorpayPayoutId:      { type: String, default: null, index: true },
    razorpayPayoutMode:    { type: String, enum: ['NEFT', 'RTGS', 'IMPS', 'UPI', null], default: null },

    /**
     * utr — Unique Transaction Reference from bank.
     * Available after payout reaches 'processed' state.
     */
    utr:           { type: String, default: null },
    bankReference: { type: String, default: null },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    WITHDRAWAL_STATUSES,
      default: 'REQUESTED',
      index:   true,
    },

    // ── Lifecycle Timestamps ──────────────────────────────────────────────────
    requestedAt:  { type: Date, default: Date.now },
    approvedAt:   { type: Date, default: null },
    processedAt:  { type: Date, default: null },
    completedAt:  { type: Date, default: null },
    rejectedAt:   { type: Date, default: null },
    failedAt:     { type: Date, default: null },

    // ── Failure / Reversal ────────────────────────────────────────────────────
    failureReason:   { type: String, default: null },
    reversalReason:  { type: String, default: null },
    retryCount:      { type: Number, default: 0 },
    maxRetries:      { type: Number, default: 3 },

    // ── Approval / Review ─────────────────────────────────────────────────────
    reviewedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:   { type: Date, default: null },
    reviewNote:   { type: String, default: null },

    // ── Ledger Links ─────────────────────────────────────────────────────────
    requestLedgerTxnId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWalletTransaction',
      default: null,
    },

    completionLedgerTxnId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWalletTransaction',
      default: null,
    },

    // ── Compliance Checks (at request time) ──────────────────────────────────
    complianceChecksPassed: { type: Boolean, default: false },
    complianceChecksLog: [
      {
        check:   { type: String },
        passed:  { type: Boolean },
        details: { type: String },
      },
    ],

    // ── Internal ─────────────────────────────────────────────────────────────
    remarks:   { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save: auto-generate withdrawalId ─────────────────────────────────────

partnerWithdrawalSchema.pre('save', async function () {
  if (this.isNew && !this.withdrawalId) {
    let id, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('withdrawalId generation failed');
      id     = `WD-${generateWithdrawalId()}`;
      exists = await mongoose.model('PartnerWithdrawal').exists({ withdrawalId: id });
    } while (exists);
    this.withdrawalId = id;
  }

  // Terminal state immutability
  const terminal = ['processed', 'REJECTED'];
  if (!this.isNew && terminal.includes(this._originalStatus) && this.isModified('amount')) {
    throw new Error('Cannot modify amount of a terminal withdrawal');
  }
});

// ── Virtuals ─────────────────────────────────────────────────────────────────

partnerWithdrawalSchema.virtual('isTerminal').get(function () {
  return ['processed', 'REJECTED', 'cancelled', 'failed', 'reversed'].includes(this.status);
});

partnerWithdrawalSchema.virtual('isPending').get(function () {
  return ['REQUESTED', 'APPROVED', 'queued', 'pending', 'processing'].includes(this.status);
});

// ── Indexes ───────────────────────────────────────────────────────────────────

partnerWithdrawalSchema.index({ partnerId: 1, status: 1 });
partnerWithdrawalSchema.index({ partnerId: 1, createdAt: -1 });
partnerWithdrawalSchema.index({ status: 1, requestedAt: -1 });
partnerWithdrawalSchema.index({ razorpayPayoutId: 1 });

const PartnerWithdrawal = mongoose.model('PartnerWithdrawal', partnerWithdrawalSchema);
export default PartnerWithdrawal;