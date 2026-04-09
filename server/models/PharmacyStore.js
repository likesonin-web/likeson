import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Bank account sub-schema (store-level) ─────────────────────────────────────

const storeBankAccountSchema = new Schema(
  {
    accountHolderName:  { type: String, trim: true, required: true },
    accountNumber:      { type: String, trim: true, required: true },  // encrypt in prod
    ifscCode: {
      type:      String,
      trim:      true,
      uppercase: true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'],
    },
    bankName:            { type: String, trim: true },
    branchName:          { type: String, trim: true },
    accountType: {
      type:    String,
      enum:    ['Savings', 'Current', 'OD'],
      default: 'Current',
    },
    isPrimary:           { type: Boolean, default: false },
    isVerified:          { type: Boolean, default: false },
    cancelledChequeUrl:  { type: String },
    verifiedAt:          { type: Date },
    verifiedBy:          { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

// ── UPI sub-schema ─────────────────────────────────────────────────────────────

const storeUpiSchema = new Schema(
  {
    upiId:      { type: String, trim: true },   // store@ybl / storeid@ibl
    upiName:    { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    isPrimary:  { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Gateway linked-account sub-schema ─────────────────────────────────────────

const gatewayAccountSchema = new Schema(
  {
    provider:  { type: String, enum: ['Razorpay', 'Cashfree', 'PayU', 'Stripe', 'PhonePe Business'], required: true },
    accountId: { type: String, trim: true },   // e.g. acc_xxxxx (Razorpay route account)
    isActive:  { type: Boolean, default: true },
    linkedAt:  { type: Date, default: Date.now },
    webhookSecret: { type: String, select: false },   // stored encrypted
  },
  { _id: true }
);

// ── Main PharmacyStore schema ─────────────────────────────────────────────────

const pharmacyStoreSchema = new Schema(
  {
    storeName: { type: String, required: true, trim: true },
    slug:      { type: String, unique: true, lowercase: true },

    storeType: {
      type:     String,
      enum:     ['Owned', 'Partnered'],
      required: true,
    },

    priority: {
      type:    String,
      enum:    ['High', 'Medium', 'Low'],
      default: 'Medium',
    },

    contact: {
      email:          { type: String, required: true },
      phone:          { type: String, required: true },
      alternatePhone: String,
    },

    address: {
      line1:   { type: String, required: true },
      city:    { type: String, default: 'Vijayawada' },
      state:   { type: String, default: 'Andhra Pradesh' },
      pincode: { type: String, required: true },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    legal: {
      dlNumber:       { type: String, required: true },
      gstNumber:      { type: String },
      panNumber: {
        type:      String,
        trim:      true,
        uppercase: true,
        match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
      },
      licenseExpiry:  { type: Date },
      documentUrl:    String,
    },

    deliverySettings: {
      canDeliver:            { type: Boolean, default: true },
      deliveryRadiusKm:      { type: Number,  default: 5 },
      estimatedDeliveryTime: { type: String,  default: '2 Hours' },
    },

    specializations: [
      {
        type: String,
        enum: ['Generic', 'Ayurvedic', 'Critical Care', 'Homeopathy', 'Surgical Supplies'],
      },
    ],

    timings: [
      {
        day:   { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
        open:  String,
        close: String,
        is24x7: { type: Boolean, default: false },
      },
    ],

    status: {
      type:    String,
      enum:    ['Open', 'Closed', 'Under-Maintenance', 'Inactive'],
      default: 'Open',
    },

    isVerified: { type: Boolean, default: false },

    managedBy: {
      type:    Schema.Types.ObjectId,
      ref:     'User',
      comment: "The User with 'pharmacy' role who owns/administers this store",
    },

    // ── Financial / Payout Details ──────────────────────────────────────────
    bankDetails: {
      // Multiple bank accounts (one marked primary)
      bankAccounts: { type: [storeBankAccountSchema], default: [] },

      // UPI handles (one marked primary)
      upiHandles:   { type: [storeUpiSchema], default: [] },

      // Payment gateway linked accounts (Razorpay route accounts etc.)
      gatewayAccounts: { type: [gatewayAccountSchema], default: [] },

      // Settlement / payout preferences
      preferredSettlementMethod: {
        type:    String,
        enum:    ['Bank Transfer', 'UPI', 'Cheque'],
        default: 'Bank Transfer',
      },

      settlementCycle: {
        type:    String,
        enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
        default: 'Weekly',
      },

      // Commission / revenue share (for Partnered stores)
      commissionPercent: {
        type: Number,
        min:  0,
        max:  100,
        default: 0,
        comment: 'Platform commission % deducted before payout',
      },

      // Running balance (pending settlement)
      pendingSettlementAmount: { type: Number, default: 0, min: 0 },
      totalSettledAmount:      { type: Number, default: 0, min: 0 },
      lastSettledAt:           { type: Date },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

pharmacyStoreSchema.index({ 'address.coordinates': '2dsphere' });
pharmacyStoreSchema.index({ status: 1, isVerified: 1 });
pharmacyStoreSchema.index({ 'legal.gstNumber': 1 });

const PharmacyStore = mongoose.model('PharmacyStore', pharmacyStoreSchema);
export default PharmacyStore;