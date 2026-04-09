/**
 * PaymentAccount.js
 *
 * A standalone, reusable model that stores ALL payment/payout methods
 * for ANY user (doctor, driver, transport partner, care assistant, etc.).
 *
 * One PaymentAccount document per user (one-to-one via `user` field).
 * Each sub-array (bankAccounts, upiHandles, etc.) supports multiple entries
 * with one marked `isPrimary: true`.
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Bank Account sub-schema ───────────────────────────────────────────────────

const bankAccountSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true, required: true },
    accountNumber:     {
      type:     String,
      trim:     true,
      required: true,
      // Tip: encrypt this field at rest using a Mongoose plugin like mongoose-field-encryption
    },
    ifscCode: {
      type:      String,
      trim:      true,
      uppercase: true,
      required:  true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g. SBIN0001234)'],
    },
    bankName:    { type: String, trim: true },
    branchName:  { type: String, trim: true },
    city:        { type: String, trim: true },
    accountType: {
      type:    String,
      enum:    ['Savings', 'Current', 'OD', 'NRE', 'NRO'],
      default: 'Savings',
    },

    // Verification
    isPrimary:          { type: Boolean, default: false },
    isVerified:         { type: Boolean, default: false },
    verifiedAt:         { type: Date },
    verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
    verificationMethod: {
      type: String,
      enum: ['Penny Drop', 'Manual', 'Bank Statement'],
    },
    cancelledChequeUrl: { type: String },   // ImageKit / S3 URL

    // Razorpay / Cashfree fund-account ID (for automated payouts)
    fundAccountId: { type: String, trim: true },

    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── UPI Handle sub-schema ─────────────────────────────────────────────────────

const upiSchema = new Schema(
  {
    upiId:      { type: String, trim: true, required: true },   // name@bank
    upiName:    { type: String, trim: true },                   // registered name
    isPrimary:  { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    addedAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Wallet sub-schema ─────────────────────────────────────────────────────────

const walletSchema = new Schema(
  {
    provider:   {
      type:     String,
      enum:     ['Paytm', 'PhonePe', 'Google Pay', 'Amazon Pay', 'MobiKwik', 'Freecharge'],
      required: true,
    },
    mobileNumber: { type: String, trim: true },  // wallet-linked phone
    isPrimary:    { type: Boolean, default: false },
    isVerified:   { type: Boolean, default: false },
    addedAt:      { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Payment Gateway linked account sub-schema ─────────────────────────────────

const gatewayAccountSchema = new Schema(
  {
    provider: {
      type:     String,
      enum:     ['Razorpay', 'Cashfree', 'PayU', 'Stripe', 'PhonePe Business', 'Instamojo'],
      required: true,
    },
    accountId:     { type: String, trim: true },      // e.g. acc_xxxxx
    contactId:     { type: String, trim: true },      // Razorpay contact id
    fundAccountId: { type: String, trim: true },      // Razorpay fund account id
    isActive:      { type: Boolean, default: true },
    linkedAt:      { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Tax / Compliance sub-schema ───────────────────────────────────────────────

const taxInfoSchema = new Schema(
  {
    panNumber: {
      type:      String,
      trim:      true,
      uppercase: true,
      match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
    },
    gstNumber: {
      type:      String,
      trim:      true,
      uppercase: true,
      match:     [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST format'],
    },
    tdsApplicable:   { type: Boolean, default: false },
    tdsPercent:      { type: Number, default: 0 },
    panVerified:     { type: Boolean, default: false },
    panVerifiedAt:   { type: Date },
    gstVerified:     { type: Boolean, default: false },
    gstVerifiedAt:   { type: Date },
    form15GSubmitted:{ type: Boolean, default: false },   // lower TDS deduction
  },
  { _id: false }
);

// ── Settlement history sub-schema ─────────────────────────────────────────────

const settlementHistorySchema = new Schema(
  {
    amount:         { type: Number, required: true },
    method:         { type: String, enum: ['Bank Transfer', 'UPI', 'Cheque', 'Cash'] },
    referenceId:    { type: String },             // UTR / transaction ref
    settledAt:      { type: Date, default: Date.now },
    settledBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    note:           { type: String },
    gatewayPayoutId:{ type: String },             // Razorpay payout_id etc.
  },
  { _id: true }
);

// ── Main PaymentAccount schema ────────────────────────────────────────────────

const paymentAccountSchema = new Schema(
  {
    // ── Owner ────────────────────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Payment methods ───────────────────────────────────────────────────────
    bankAccounts:    { type: [bankAccountSchema],    default: [] },
    upiHandles:      { type: [upiSchema],            default: [] },
    wallets:         { type: [walletSchema],         default: [] },
    gatewayAccounts: { type: [gatewayAccountSchema], default: [] },

    // ── Tax & compliance ──────────────────────────────────────────────────────
    taxInfo: { type: taxInfoSchema, default: () => ({}) },

    // ── Settlement preferences ────────────────────────────────────────────────
    preferredPayoutMethod: {
      type:    String,
      enum:    ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Wallet'],
      default: 'Bank Transfer',
    },

    payoutCycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'On-Demand'],
      default: 'Weekly',
    },

    minimumPayoutAmount: {
      type:    Number,
      default: 100,
      min:     0,
      comment: 'Payout only triggered when pending balance ≥ this value (₹)',
    },

    // ── Wallet balances ───────────────────────────────────────────────────────
    pendingBalance:  { type: Number, default: 0, min: 0 },   // awaiting settlement
    totalEarned:     { type: Number, default: 0, min: 0 },   // lifetime gross
    totalSettled:    { type: Number, default: 0, min: 0 },   // lifetime paid out
    totalDeductions: { type: Number, default: 0, min: 0 },   // commission + TDS

    // ── Settlement history (last N records; archive old ones separately) ──────
    settlementHistory: { type: [settlementHistorySchema], default: [] },

    lastSettledAt: { type: Date },

    // ── Audit ─────────────────────────────────────────────────────────────────
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

paymentAccountSchema.virtual('primaryBankAccount').get(function () {
  return this.bankAccounts.find(a => a.isPrimary) ?? this.bankAccounts[0] ?? null;
});

paymentAccountSchema.virtual('primaryUpi').get(function () {
  return this.upiHandles.find(u => u.isPrimary) ?? this.upiHandles[0] ?? null;
});

paymentAccountSchema.virtual('hasVerifiedPayoutMethod').get(function () {
  const bankOk = this.bankAccounts.some(a => a.isVerified);
  const upiOk  = this.upiHandles.some(u => u.isVerified);
  return bankOk || upiOk;
});

// ── Indexes ───────────────────────────────────────────────────────────────────

paymentAccountSchema.index({ 'taxInfo.panNumber': 1 });
paymentAccountSchema.index({ 'taxInfo.gstNumber': 1 });
paymentAccountSchema.index({ pendingBalance: -1 });

// ── Static helpers ────────────────────────────────────────────────────────────

/**
 * Upsert (find-or-create) for a user's payment account.
 * Usage: const account = await PaymentAccount.findOrCreateForUser(userId);
 */
paymentAccountSchema.statics.findOrCreateForUser = async function (userId) {
  let account = await this.findOne({ user: userId });
  if (!account) {
    account = await this.create({ user: userId });
  }
  return account;
};

const PaymentAccount = mongoose.model('PaymentAccount', paymentAccountSchema);
export default PaymentAccount;