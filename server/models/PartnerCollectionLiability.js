import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * PartnerCollectionLiability
 *
 * Created when PAY_AT_SERVICE booking completes and cash collector
 * received more cash than their own entitlement.
 *
 * Tracks running liability + recovery progress.
 * Automatically closed when outstandingLiability reaches 0.
 *
 * Example:
 *   Booking total ₹2000. Doctor=₹800, CA=₹600, Driver=₹400, Platform=₹200.
 *   Driver collects all ₹2000.
 *   Driver liability = ₹2000 - ₹400 = ₹1600
 *   Doctor + CA wallets credited immediately.
 *   Driver future earnings auto-deducted until ₹1600 recovered.
 */

export const LIABILITY_STATUSES = [
  'OPEN',                // outstanding > 0; recovery active
  'PARTIALLY_RECOVERED', // partial recovery done; still outstanding
  'RECOVERED',           // fully recovered
  'WAIVED',              // admin waived outstanding balance
];

const recoveryEventSchema = new Schema(
  {
    amount:      { type: Number, required: true, min: 0 },
    bookingId:   { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    allocationId:{ type: Schema.Types.ObjectId, ref: 'BookingPartnerAllocation', default: null },
    txnId:       { type: Schema.Types.ObjectId, ref: 'PartnerWalletTransaction', default: null },
    recoveredAt: { type: Date, default: Date.now },
    remarks:     { type: String },
  },
  { _id: true }
);

const partnerCollectionLiabilitySchema = new Schema(
  {
    // ── Who ──────────────────────────────────────────────────────────────────
    partner: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    partnerRole: {
      type:     String,
      required: true,
     enum:     ['driver', 'solodriverpartner', 'care_assistant', 'lab_partner', 'doctor', 'transportpartner'],
    },

    walletId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWallet',
      required: true,
    },

    // ── Source Booking ────────────────────────────────────────────────────────
    booking: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },

    bookingType: { type: String },

    // ── Amounts at Liability Creation Time ───────────────────────────────────
    /**
     * amountCollected — total cash received from customer.
     */
    amountCollected: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * ownEarning — what this partner was entitled to.
     */
    ownEarning: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * othersEarning — sum of other partners' entitlements collected by this partner.
     */
    othersEarning: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * platformShare — platform's portion collected by this partner.
     */
    platformShare: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * totalLiability — initial total to recover.
     * = othersEarning + platformShare
     * = amountCollected - ownEarning
     */
    totalLiability: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * amountRecovered — running total recovered so far.
     */
    amountRecovered: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * outstandingLiability — remaining to recover.
     * = totalLiability - amountRecovered
     * Auto-computed on save.
     */
    outstandingLiability: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Recovery Events ───────────────────────────────────────────────────────
    /**
     * recoveryEvents — append-only log of each recovery deduction.
     * One entry per booking settlement that contributed to recovery.
     */
    recoveryEvents: { type: [recoveryEventSchema], default: [] },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    LIABILITY_STATUSES,
      default: 'OPEN',
      index:   true,
    },

    recoveredAt: { type: Date, default: null },

    // ── Waiver ───────────────────────────────────────────────────────────────
    waivedAt:     { type: Date, default: null },
    waivedBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
    waivedAmount: { type: Number, default: 0 },
    waiverReason: { type: String, default: null },

    // ── Audit ────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    remarks:   { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save: auto-compute outstandingLiability + sync status ────────────────

partnerCollectionLiabilitySchema.pre('save', function () {
  this.outstandingLiability = Math.max(
    0,
    +(this.totalLiability - this.amountRecovered).toFixed(2)
  );

  // Auto-close when fully recovered
  if (this.outstandingLiability === 0 && this.status !== 'WAIVED' && this.amountRecovered > 0) {
    this.status = 'RECOVERED';
    if (!this.recoveredAt) this.recoveredAt = new Date();
  } else if (this.amountRecovered > 0 && this.outstandingLiability > 0 && this.status === 'OPEN') {
    this.status = 'PARTIALLY_RECOVERED';
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

partnerCollectionLiabilitySchema.index({ partner: 1, status: 1 });
partnerCollectionLiabilitySchema.index({ booking: 1 });
partnerCollectionLiabilitySchema.index({ status: 1, outstandingLiability: -1 });

const PartnerCollectionLiability = mongoose.model(
  'PartnerCollectionLiability',
  partnerCollectionLiabilitySchema
);
export default PartnerCollectionLiability;