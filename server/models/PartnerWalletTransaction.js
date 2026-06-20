import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateTxnId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 12);

/**
 * PartnerWalletTransaction — IMMUTABLE APPEND-ONLY LEDGER
 *
 * SOURCE OF TRUTH for all partner money movement.
 * PartnerWallet balances = projection of this ledger.
 *
 * RULES:
 *   - Never delete documents
 *   - Never update amount/type/beforeBalance/afterBalance after creation
 *   - Corrections = new ADJUSTMENT entries (not edits)
 *   - All mutations go through settlementEngine.service.js
 */

export const LEDGER_TYPES = [
  'BOOKING_EARNING',       // partner earns from completed booking
  'BOOKING_REVERSAL',      // booking cancelled/refunded; reverses earning
  'SETTLEMENT_CREDIT',     // settlement finalized; pending → available
  'RECOVERY_DEDUCTION',    // cash liability deducted from future earning
  'LIABILITY_CREATED',     // cash collection liability opened
  'MANUAL_CREDIT',         // admin manual credit
  'MANUAL_DEBIT',          // admin manual debit
  'WITHDRAWAL_REQUEST',    // partner requests withdrawal; available → locked
  'WITHDRAWAL_SUCCESS',    // payout confirmed; balance finalized
  'WITHDRAWAL_FAILED',     // payout failed
  'WITHDRAWAL_REVERSED',   // failed payout reversed; balance restored
  'ADJUSTMENT',            // finance correction entry
  'REFUND_RECOVERY',       // platform recovers excess from partner (non-cash scenario)
];

export const ACTOR_ROLES = [
  'system',
  'admin',
  'superadmin',
  'finance',
  'partner',    // self-initiated (withdrawal request)
];

const partnerWalletTransactionSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    txnId: {
      type:     String,
      unique:   true,
      index:    true,
    },

    type: {
      type:     String,
      required: true,
      enum:     LEDGER_TYPES,
      index:    true,
    },

    // ── Parties ──────────────────────────────────────────────────────────────
    partnerId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    walletId: {
      type:     Schema.Types.ObjectId,
      ref:      'PartnerWallet',
      required: true,
      index:    true,
    },

    // ── Amounts ──────────────────────────────────────────────────────────────
    /**
     * amount — always positive.
     * Direction encoded in `type` (CREDIT vs DEBIT nature per type):
     *
     * CREDIT types (increase availableBalance or pendingBalance):
     *   BOOKING_EARNING, SETTLEMENT_CREDIT, MANUAL_CREDIT,
     *   WITHDRAWAL_REVERSED, REFUND_RECOVERY (when recovering platform money)
     *
     * DEBIT types (decrease balance):
     *   BOOKING_REVERSAL, RECOVERY_DEDUCTION, MANUAL_DEBIT,
     *   WITHDRAWAL_REQUEST, WITHDRAWAL_SUCCESS
     *
     * NEUTRAL (liability tracking):
     *   LIABILITY_CREATED, ADJUSTMENT (signed via amount + direction field)
     */
    amount: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * direction — explicit debit/credit marker.
     * Redundant with `type` for most entries but makes reporting queries simple.
     */
    direction: {
      type:     String,
      enum:     ['credit', 'debit', 'neutral'],
      required: true,
    },

    currency: { type: String, default: 'INR' },

    // ── Balance Snapshot (IMMUTABLE after creation) ──────────────────────────
    /**
     * availableBalance before/after this transaction.
     * Enables point-in-time ledger reconstruction.
     */
    beforeBalance: {
      type:     Number,
      required: true,
    },
    afterBalance: {
      type:     Number,
      required: true,
    },

    /**
     * Full balance state snapshot for reconciliation.
     * Captures all wallet balance fields at transaction time.
     */
    balanceSnapshot: {
      availableBalance:  { type: Number },
      pendingBalance:    { type: Number },
      withdrawalBalance: { type: Number },
      recoveryBalance:   { type: Number },
    },

    // ── References ───────────────────────────────────────────────────────────
    bookingId: {
      type:    Schema.Types.ObjectId,
      ref:     'Booking',
      default: null,
      index:   true,
    },

    settlementId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerSettlement',
      default: null,
    },

    allocationId: {
      type:    Schema.Types.ObjectId,
      ref:     'BookingPartnerAllocation',
      default: null,
    },

    liabilityId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerCollectionLiability',
      default: null,
    },

    withdrawalId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWithdrawal',
      default: null,
    },

    referenceId: {
      type:    String,
      default: null,
    },

    // ── Actor ────────────────────────────────────────────────────────────────
    actor: {
      type:    Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    actorRole: {
      type:    String,
      enum:    ACTOR_ROLES,
      default: 'system',
    },

    // ── Idempotency ──────────────────────────────────────────────────────────
    /**
     * idempotencyKey — unique key per logical event.
     * Format: `{type}:{bookingId}:{partnerId}` or `{type}:{referenceId}`
     * Prevents duplicate ledger entries on retry.
     */
    idempotencyKey: {
      type:   String,
      unique: true,
      sparse: true,
      index:  true,
    },

    // ── Remarks ──────────────────────────────────────────────────────────────
    remarks: {
      type: String,
      trim: true,
    },

    // ── Internal Flags ───────────────────────────────────────────────────────
    isReversed: { type: Boolean, default: false },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'PartnerWalletTransaction', default: null },

    // ── Tax Metadata (for compliance reporting) ──────────────────────────────
    taxAmount:   { type: Number, default: 0 },
    tdsAmount:   { type: Number, default: 0 },
    grossAmount: { type: Number, default: 0 },
    netAmount:   { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // Prevent updates to core financial fields after creation
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save: auto-generate txnId ─────────────────────────────────────────────

partnerWalletTransactionSchema.pre('save', async function () {
  if (this.isNew && !this.txnId) {
    let id, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('txnId generation failed');
      id     = `PTXN-${generateTxnId()}`;
      exists = await mongoose.model('PartnerWalletTransaction').exists({ txnId: id });
    } while (exists);
    this.txnId = id;
  }

  // Immutability guard — block updates to core financial fields
  if (!this.isNew) {
    const immutable = ['amount', 'direction', 'beforeBalance', 'afterBalance', 'type', 'partnerId'];
    for (const field of immutable) {
      if (this.isModified(field)) {
        throw new Error(`PartnerWalletTransaction: field "${field}" is immutable after creation`);
      }
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

partnerWalletTransactionSchema.index({ partnerId: 1, createdAt: -1 });
partnerWalletTransactionSchema.index({ partnerId: 1, type: 1 });
partnerWalletTransactionSchema.index({ bookingId: 1, partnerId: 1 });
partnerWalletTransactionSchema.index({ settlementId: 1 });
partnerWalletTransactionSchema.index({ withdrawalId: 1 });
partnerWalletTransactionSchema.index({ liabilityId: 1 });
partnerWalletTransactionSchema.index({ createdAt: -1 });

const PartnerWalletTransaction = mongoose.model(
  'PartnerWalletTransaction',
  partnerWalletTransactionSchema
);
export default PartnerWalletTransaction;