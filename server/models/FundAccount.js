import mongoose from 'mongoose';
const { Schema } = mongoose;

// ══════════════════════════════════════════════════════════════════════════════
// FUND ACCOUNT MODEL — Likeson.in
//
// RazorpayX fund accounts are IMMUTABLE after creation.
// Every time a partner updates their bank/UPI details:
//   1. NEW FundAccount doc created → Razorpay API called → new fund_account_id
//   2. Old FundAccount marked isActive: false (NOT deleted — payout history)
//   3. Partner model's razorpayFundAccountId updated to new ID
//   4. All NEW payouts use new fund account
//   5. In-flight payouts keep old fund account (already dispatched)
//
// WHY THIS MODEL EXISTS (vs just storing on partner doc):
//   - Full history of all bank accounts ever used
//   - Know EXACTLY which fund account was used for each payout
//   - Audit trail for disputes / fraud
//   - Support multiple UPI handles or bank accounts per partner (future)
// ══════════════════════════════════════════════════════════════════════════════

export const FUND_ACCOUNT_TYPES = ['bank_account', 'vpa'];  // vpa = UPI Virtual Payment Address

export const PARTNER_MODEL_MAP = {
  doctor:            'DoctorProfile',
  hospital:          'Hospital',
  transportpartner:  'TransportPartner',
  driver:            'Driver',
  solodriverpartner: 'SoloDriverPartner',
  pharmacy:          'PharmacyStore',
  care_assistant:    'CareAssistantProfile',
  lab_partner:       'LabPartnerProfile',
  customer:          'User',
};

// ── Main Schema ───────────────────────────────────────────────────────────────

const fundAccountSchema = new Schema(
  {
    // ── Owner ─────────────────────────────────────────────────────────────────
    partnerType: {
      type:     String,
      required: true,
      enum:     Object.keys(PARTNER_MODEL_MAP),
      index:    true,
    },

    partnerUserId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    /**
     * partnerProfileId — _id of the role-specific profile doc.
     * For customers: same as partnerUserId.
     */
    partnerProfileId: {
      type:  Schema.Types.ObjectId,
      index: true,
    },

    // ── Razorpay IDs ──────────────────────────────────────────────────────────
    /**
     * razorpayContactId — Contact object in RazorpayX.
     * One contact per partner. Reused across fund account updates.
     * If null: contact not yet created on Razorpay.
     */
    razorpayContactId: {
      type:  String,
      index: true,
    },

    /**
     * razorpayFundAccountId — Fund Account object in RazorpayX.
     * Immutable. New one created on each bank update.
     */
    razorpayFundAccountId: {
      type:   String,
      unique: true,
      sparse: true,
      index:  true,
    },

    // ── Account Details ───────────────────────────────────────────────────────
    accountType: {
      type:     String,
      required: true,
      enum:     FUND_ACCOUNT_TYPES,
    },

    // Bank account fields (accountType === 'bank_account')
    bank: {
      accountHolderName: { type: String, trim: true },
      accountNumber:     { type: String, trim: true, select: false },  // encrypted in prod
      accountNumberLast4:{ type: String, maxlength: 4 },              // for display
      ifscCode:          { type: String, uppercase: true, trim: true },
      bankName:          { type: String, trim: true },
      branchName:        { type: String, trim: true },
      accountType:       { type: String, enum: ['savings', 'current'], default: 'savings' },
    },

    // UPI fields (accountType === 'vpa')
    vpa: {
      address:  { type: String, trim: true },   // e.g. partner@ybl
      name:     { type: String, trim: true },   // account holder name from VPA
    },

    // ── State ─────────────────────────────────────────────────────────────────
    /**
     * isActive — only ONE fund account per partner should be active.
     * When partner updates bank: old.isActive = false, new.isActive = true.
     */
    isActive: { type: Boolean, default: true, index: true },

    /**
     * isVerified — Razorpay successfully created/validated this fund account.
     * false = pending API call or API returned error.
     */
    isVerified: { type: Boolean, default: false },

    verifiedAt: { type: Date },

    /**
     * deactivatedAt — when this fund account was replaced by a newer one.
     * null if still active.
     */
    deactivatedAt: { type: Date, default: null },

    /**
     * deactivatedReason — why this account was replaced.
     * e.g. 'partner_bank_update', 'admin_correction', 'invalid_account'
     */
    deactivatedReason: { type: String },

    /**
     * replacedBy — _id of the NEW FundAccount that replaced this one.
     * Enables full chain traversal of bank update history.
     */
    replacedBy: {
      type:    Schema.Types.ObjectId,
      ref:     'FundAccount',
      default: null,
    },

    /**
     * replacedFrom — _id of the OLD FundAccount this one replaced.
     */
    replacedFrom: {
      type:    Schema.Types.ObjectId,
      ref:     'FundAccount',
      default: null,
    },

    // ── Validation ────────────────────────────────────────────────────────────
    /**
     * pennyDropVerified — platform sent ₹1 to verify account is valid.
     * Critical before first large payout.
     */
    pennyDropVerified:  { type: Boolean, default: false },
    pennyDropAt:        { type: Date },
    pennyDropReference: { type: String },  // transaction reference

    // ── Source ────────────────────────────────────────────────────────────────
    /**
     * addedBy — who added this bank account.
     * 'partner' = partner themselves via app
     * 'admin'   = admin entered on behalf of partner
     */
    addedBy: {
      type:    String,
      enum:    ['partner', 'admin'],
      default: 'partner',
    },

    addedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },

    razorpayRawResponse: { type: Schema.Types.Mixed, select: false },   // raw API response

    notes: { type: String, trim: true },

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

fundAccountSchema.virtual('displayAccount').get(function () {
  if (this.accountType === 'bank_account') {
    return `${this.bank?.bankName ?? 'Bank'} ••••${this.bank?.accountNumberLast4 ?? '????'}`;
  }
  return `UPI: ${this.vpa?.address ?? '—'}`;
});

fundAccountSchema.virtual('isReadyForPayout').get(function () {
  return (
    this.isActive &&
    this.isVerified &&
    !!this.razorpayFundAccountId
  );
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

fundAccountSchema.pre('save', function () {
  // Mask account number — keep only last 4 digits
  if (
    this.isModified('bank.accountNumber') &&
    this.bank?.accountNumber
  ) {
    this.bank.accountNumberLast4 = this.bank.accountNumber.slice(-4);
  }

  // Auto-stamp deactivatedAt
  if (this.isModified('isActive') && !this.isActive && !this.deactivatedAt) {
    this.deactivatedAt = new Date();
  }
});

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Get active fund account for a partner.
 * Usage: await FundAccount.getActive('doctor', userId)
 */
fundAccountSchema.statics.getActive = function (partnerType, partnerUserId) {
  return this.findOne({
    partnerType,
    partnerUserId,
    isActive:   true,
    isVerified: true,
  }).lean();
};

/**
 * Deactivate current active fund account and activate a new one.
 * Called by PayoutService when partner updates bank/UPI.
 *
 * @param {ObjectId} oldFundAccountId - existing active FundAccount._id
 * @param {ObjectId} newFundAccountId - newly created FundAccount._id
 * @param {string}   reason           - why replaced
 * @param {ObjectId} updatedBy        - User who triggered update
 */
fundAccountSchema.statics.rotate = async function (
  oldFundAccountId,
  newFundAccountId,
  reason = 'partner_bank_update',
  updatedBy = null
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await this.findByIdAndUpdate(
      oldFundAccountId,
      {
        isActive:          false,
        deactivatedAt:     new Date(),
        deactivatedReason: reason,
        replacedBy:        newFundAccountId,
        updatedBy,
      },
      { session }
    );
    await this.findByIdAndUpdate(
      newFundAccountId,
      { replacedFrom: oldFundAccountId, updatedBy },
      { session }
    );
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ── Indexes ───────────────────────────────────────────────────────────────────

fundAccountSchema.index({ partnerUserId: 1, isActive: 1 });
fundAccountSchema.index({ partnerUserId: 1, createdAt: -1 });
fundAccountSchema.index({ partnerType: 1, isActive: 1 });
fundAccountSchema.index({ razorpayFundAccountId: 1 }, { sparse: true });
fundAccountSchema.index({ razorpayContactId: 1 },     { sparse: true });
fundAccountSchema.index({ createdAt: -1 });

const FundAccount = mongoose.model('FundAccount', fundAccountSchema);
export default FundAccount;