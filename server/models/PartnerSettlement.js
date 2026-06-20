import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateSettlementId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

/**
 * PartnerSettlement
 *
 * One record per partner per booking.
 * Immutable once settlementStatus = 'SETTLED'.
 * Reversal = new REVERSED record + BOOKING_REVERSAL ledger entry.
 */

export const SETTLEMENT_STATUSES = [
  'PENDING',   // booking completed; settlement not yet processed
  'SETTLED',   // earnings credited to wallet
  'REVERSED',  // booking refunded; settlement reversed
  'FAILED',    // settlement attempt failed (retry)
  'SKIPPED',   // zero-value settlement (no action needed)
];

export const PAYMENT_SOURCES = [
  'ONLINE',          // customer paid online; platform holds money
  'PAY_AT_SERVICE',  // customer paid cash to a partner
  'PARTIAL',         // split payment
  'WALLET_PAYMENT',  // customer paid via Likeson wallet
];

const partnerSettlementSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    settlementId: {
      type:   String,
      unique: true,
      index:  true,
    },

    // ── References ───────────────────────────────────────────────────────────
    bookingId: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },

    partnerId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

 partnerRole: {
      type:     String,
      required: true,
      enum:     ['doctor', 'hospital', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'lab_partner'],
    },

    allocationId: {
      type:    Schema.Types.ObjectId,
      ref:     'BookingPartnerAllocation',
      default: null,
    },

    walletId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWallet',
      default: null,
    },

    // ── Amounts ──────────────────────────────────────────────────────────────
    /**
     * grossAmount — full partner earning before any deductions.
     * = what partner would receive with no platform fee, tax, or recovery.
     */
    grossAmount: {
      type:     Number,
      required: true,
      min:      0,
    },

    platformFee: {
      type:    Number,
      default: 0,
      min:     0,
    },

    taxAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * tdsAmount — TDS deducted at source (if applicable).
     * 1% for transport partners; varies by partner type.
     */
    tdsAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * recoveryDeduction — amount recovered from this settlement
     * to pay off outstanding cash collection liability.
     */
    recoveryDeduction: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * netSettlement — amount actually credited to partner wallet.
     * = grossAmount - platformFee - taxAmount - tdsAmount - recoveryDeduction
     * Can be 0 if fully recovered.
     */
    netSettlement: {
      type:     Number,
      required: true,
      min:      0,
    },

    // ── Subscription Discount Absorption ─────────────────────────────────────
    /**
     * subscriptionAbsorbed — platform absorbs subscription discount.
     * Partner always receives grossAmount regardless of customer discount.
     * This field tracks how much platform absorbed for this settlement.
     */
    subscriptionAbsorbed: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Payment Context ───────────────────────────────────────────────────────
    paymentSource: {
      type:     String,
      enum:     PAYMENT_SOURCES,
      required: true,
    },

    // ── Idempotency ──────────────────────────────────────────────────────────
    idempotencyKey: {
      type:   String,
      unique: true,
      index:  true,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    settlementStatus: {
      type:    String,
      enum:    SETTLEMENT_STATUSES,
      default: 'PENDING',
      index:   true,
    },

    settledAt:         { type: Date, default: null },
    settlementVersion: { type: Number, default: 1 },

    // ── Reversal ─────────────────────────────────────────────────────────────
    reversedAt:       { type: Date, default: null },
    reversalReason:   { type: String, default: null },
    reversedByTxnId:  { type: String, default: null },

    // ── Failure ──────────────────────────────────────────────────────────────
    failureReason:    { type: String, default: null },
    retryCount:       { type: Number, default: 0 },

    // ── Ledger Link ──────────────────────────────────────────────────────────
    ledgerTxnId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWalletTransaction',
      default: null,
    },

    // ── Remarks ──────────────────────────────────────────────────────────────
    remarks:   { type: String, default: null },

    // ── Audit ────────────────────────────────────────────────────────────────
    processedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt:   { type: Date, default: null },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save: auto-generate settlementId + idempotencyKey ────────────────────

partnerSettlementSchema.pre('save', async function () {
  if (this.isNew) {
    if (!this.settlementId) {
      let id, exists;
      let attempts = 0;
      do {
        if (attempts++ > 10) throw new Error('settlementId generation failed');
        id     = `SET-${generateSettlementId()}`;
        exists = await mongoose.model('PartnerSettlement').exists({ settlementId: id });
      } while (exists);
      this.settlementId = id;
    }

    if (!this.idempotencyKey) {
      this.idempotencyKey = `settlement:${this.bookingId}:${this.partnerId}`;
    }
  }

  // Immutability: once SETTLED, core amounts cannot change
  if (!this.isNew && this.settlementStatus === 'SETTLED') {
    const locked = ['grossAmount', 'platformFee', 'taxAmount', 'netSettlement', 'bookingId', 'partnerId'];
    for (const f of locked) {
      if (this.isModified(f)) {
        throw new Error(`PartnerSettlement "${this.settlementId}" is SETTLED — field "${f}" is immutable`);
      }
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

partnerSettlementSchema.index({ partnerId: 1, settlementStatus: 1 });
partnerSettlementSchema.index({ bookingId: 1 });
partnerSettlementSchema.index({ settlementStatus: 1, createdAt: -1 });
partnerSettlementSchema.index({ partnerRole: 1, settlementStatus: 1 });

const PartnerSettlement = mongoose.model('PartnerSettlement', partnerSettlementSchema);
export default PartnerSettlement;