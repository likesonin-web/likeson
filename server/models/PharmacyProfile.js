import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Payment / Payout sub-schema ───────────────────────────────────────────────
// Stores bank account, UPI, and other payout methods for a pharmacist/store.

const upiSchema = new Schema(
  {
    upiId:       { type: String, trim: true },          // e.g. pharma@ybl
    upiName:     { type: String, trim: true },          // display name on UPI app
    isVerified:  { type: Boolean, default: false },
    isPrimary:   { type: Boolean, default: false },
  },
  { _id: true }
);

const bankAccountSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true, required: true },
    accountNumber:     { type: String, trim: true, required: true },  // store encrypted in prod
    ifscCode:          {
      type:  String,
      trim:  true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'],
    },
    bankName:          { type: String, trim: true },
    branchName:        { type: String, trim: true },
    accountType:       {
      type:    String,
      enum:    ['Savings', 'Current', 'OD'],
      default: 'Current',
    },
    isPrimary:         { type: Boolean, default: false },
    isVerified:        { type: Boolean, default: false },
    verifiedAt:        { type: Date },
    verifiedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledChequeUrl:{ type: String },   // ImageKit / S3 URL
  },
  { _id: true }
);

const paymentDetailsSchema = new Schema(
  {
    // ── Bank accounts (can have multiple, one primary) ──────────────────────
    bankAccounts: { type: [bankAccountSchema], default: [] },

    // ── UPI handles ─────────────────────────────────────────────────────────
    upiHandles: { type: [upiSchema], default: [] },

    // ── Preferred payout method ─────────────────────────────────────────────
    preferredPayoutMethod: {
      type:    String,
      enum:    ['Bank Transfer', 'UPI', 'Cheque', 'Cash'],
      default: 'Bank Transfer',
    },

    // ── GST / PAN for tax compliance ────────────────────────────────────────
    panNumber: {
      type:  String,
      trim:  true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
    },
    gstNumber: {
      type:  String,
      trim:  true,
      uppercase: true,
      match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST format'],
    },

    // ── Payout schedule ─────────────────────────────────────────────────────
    payoutCycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
      default: 'Weekly',
    },

    // ── Razorpay / payment gateway linked account ────────────────────────────
    gatewayAccounts: [
      {
        provider:   { type: String, enum: ['Razorpay', 'Cashfree', 'PayU', 'Stripe'], required: true },
        accountId:  { type: String, trim: true },   // e.g. acc_xxxxx from Razorpay
        isActive:   { type: Boolean, default: true },
        linkedAt:   { type: Date, default: Date.now },
      },
    ],
  },
  { _id: false }   // embedded, no separate _id
);

// ── Main PharmacyProfile schema ───────────────────────────────────────────────

const pharmacyProfileSchema = new Schema(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      unique:   true,
      required: true,
    },

    // Critical link to the PharmacyStore model
    assignedStore: {
      type:     Schema.Types.ObjectId,
      ref:      'PharmacyStore',
      required: true,
      comment:  'The physical store this pharmacist is currently operating',
    },

    pharmacistName:     { type: String, required: true },
    registrationNumber: {
      type:    String,
      unique:  true,
      comment: 'PCI Registration Number',
    },

    qualification: {
      type: String,
      enum: ['D.Pharm', 'B.Pharm', 'M.Pharm', 'Pharm.D'],
    },

    experienceYears: { type: Number, default: 0 },

    roleInStore: {
      type:    String,
      enum:    ['Chief Pharmacist', 'Store Manager', 'Inventory Head', 'Delivery Coordinator'],
      default: 'Store Manager',
    },

    verification: {
      pciCertificateUrl: { type: String },
      idProofUrl:        { type: String },
      isVerified:        { type: Boolean, default: false },
      verifiedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    },

    performance: {
      totalOrdersFulfilled:   { type: Number, default: 0 },
      averageFulfillmentTime: { type: Number },
      rating:                 { type: Number, default: 0 },
    },

    // ── Payment / Payout information ─────────────────────────────────────────
    paymentDetails: { type: paymentDetailsSchema, default: () => ({}) },

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

// Fetch medicine stock for this pharmacist's store
pharmacyProfileSchema.virtual('storeInventory', {
  ref:          'Medicine',
  localField:   'assignedStore',
  foreignField: 'inventory.storeId',
});

// Quick accessor: primary bank account
pharmacyProfileSchema.virtual('primaryBankAccount').get(function () {
  return this.paymentDetails?.bankAccounts?.find(a => a.isPrimary) ?? null;
});

// Quick accessor: primary UPI handle
pharmacyProfileSchema.virtual('primaryUpi').get(function () {
  return this.paymentDetails?.upiHandles?.find(u => u.isPrimary) ?? null;
});

// ── Indexes ───────────────────────────────────────────────────────────────────

pharmacyProfileSchema.index({ assignedStore: 1 });
pharmacyProfileSchema.index({ 'paymentDetails.panNumber': 1 });

const PharmacyProfile = mongoose.model('PharmacyProfile', pharmacyProfileSchema);
export default PharmacyProfile;