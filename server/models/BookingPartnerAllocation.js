import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * BookingPartnerAllocation
 *
 * One record per partner per booking.
 * Created at booking completion (before settlement).
 * Immutable once status = 'settled'.
 *
 * Multi-partner bookings = multiple allocation docs for same bookingId.
 *
 * Example — full_care_ride booking ₹3000:
 *   { partnerId: doctor, grossAmount: 1200, ... }
 *   { partnerId: careAssistant, grossAmount: 1000, ... }
 *   { partnerId: driver, grossAmount: 500, ... }
 *   Platform retains: 300 (not an allocation; tracked separately)
 */

export const ALLOCATION_STATUSES = [
  'pending',    // allocation created; settlement not yet run
  'settled',    // settlement processed; wallet credited
  'reversed',   // booking cancelled; allocation reversed
  'recovery',   // full amount going to recovery (no wallet credit)
  'partial',    // partial wallet credit (rest to recovery)
];

const bookingPartnerAllocationSchema = new Schema(
  {
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

    /**
     * partnerProfileId — role-profile id (DoctorProfile/TransportPartner/
     * SoloDriverPartner/CareAssistantProfile/LabPartnerProfile/Hospital _id)
     * that allocationEngineService originally priced. partnerId above is
     * always the resolved User._id (matches Wallet/Settlement/Ledger
     * convention) — this field keeps the profile-level reference for
     * traceability/debugging.
     */
    partnerProfileId: {
      type:    Schema.Types.ObjectId,
      default: null,
    },

    partnerRole: {
      type:     String,
      required: true,
      enum:     ['doctor', 'hospital', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'lab_partner'],
    },

    /**
     * bookingType — denormalised for reporting without Booking lookup.
     */
    bookingType: {
      type: String,
      enum: [
        'full_care_ride', 'doctor_consultation', 'doctor_online',
        'physiotherapist', 'care_assistant', 'diagnostic_center',
        'diagnostic_home', 'patient_transport', 'follow_up',
      ],
    },

    walletId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerWallet',
      default: null,
    },

    // ── Allocation Amounts ───────────────────────────────────────────────────
    /**
     * grossAmount — full earning before platform deductions.
     * This is what partner is entitled to.
     * Set from booking fare breakdown per partner role.
     */
    grossAmount: {
      type:     Number,
      required: true,
      min:      0,
    },

    /**
     * platformFee — platform's cut from this partner's earning.
     * Computed from PlatformPricingConfig per partner type.
     */
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

    tdsAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * recoveryDeduction — amount taken from this allocation to pay off
     * outstanding cash collection liability.
     * 0 if no outstanding liability.
     */
    recoveryDeduction: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * netPayable — actual amount credited to wallet.
     * = grossAmount - platformFee - taxAmount - tdsAmount - recoveryDeduction
     */
    netPayable: {
      type:     Number,
      required: true,
      min:      0,
    },

    // ── Subscription Absorption ───────────────────────────────────────────────
    /**
     * subscriptionAbsorbed — platform absorbs subscription discount here.
     * Partner grossAmount unchanged; platform revenue reduced.
     */
    subscriptionAbsorbed: {
      type:    Number,
      default: 0,
    },

    // ── Payment Mode Context ─────────────────────────────────────────────────
    paymentSource: {
      type: String,
      enum: ['ONLINE', 'PAY_AT_SERVICE', 'PARTIAL', 'WALLET_PAYMENT'],
    },

    /**
     * isCashCollector — true for partner who received cash from customer.
     * This partner has collector liability for the portion that belongs to others.
     */
    isCashCollector: { type: Boolean, default: false },

    /**
     * cashCollected — amount of cash this partner physically received.
     * Only set when isCashCollector = true.
     * For non-collectors in same booking: 0.
     */
    cashCollected: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ALLOCATION_STATUSES,
      default: 'pending',
      index:   true,
    },

    settledAt: { type: Date, default: null },

    // ── Links ────────────────────────────────────────────────────────────────
    settlementId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerSettlement',
      default: null,
    },

    liabilityId: {
      type:    Schema.Types.ObjectId,
      ref:     'PartnerCollectionLiability',
      default: null,
    },

    // ── Idempotency ──────────────────────────────────────────────────────────
    idempotencyKey: {
      type:   String,
      unique: true,
      index:  true,
    },

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

// ── Pre-save: idempotency key ────────────────────────────────────────────────

bookingPartnerAllocationSchema.pre('save', function () {
  if (this.isNew && !this.idempotencyKey) {
    this.idempotencyKey = `alloc:${this.bookingId}:${this.partnerId}:${this.partnerRole}`;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bookingPartnerAllocationSchema.index({ bookingId: 1, partnerId: 1 }, { unique: true });
bookingPartnerAllocationSchema.index({ partnerId: 1, status: 1 });
bookingPartnerAllocationSchema.index({ bookingId: 1, status: 1 });
bookingPartnerAllocationSchema.index({ isCashCollector: 1, status: 1 });

const BookingPartnerAllocation = mongoose.model(
  'BookingPartnerAllocation',
  bookingPartnerAllocationSchema
);
export default BookingPartnerAllocation;