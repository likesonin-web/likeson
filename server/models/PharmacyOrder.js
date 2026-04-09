import mongoose from 'mongoose';

const { Schema } = mongoose;

// ══════════════════════════════════════════════════════════════════════════════
// §1  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const generateOrderId = () => {
  const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = Array.from(
    { length: 6 },
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)],
  ).join('');
  const ts = String(Date.now()).slice(-7);
  return `ORD-${random}-${ts}`;
};

// ══════════════════════════════════════════════════════════════════════════════
// §2  SUB-SCHEMAS
// ══════════════════════════════════════════════════════════════════════════════

const transactionLogSchema = new Schema(
  {
    action:    { type: String, required: true },
    status:    { type: String, required: true },
    note:      { type: String },
    metadata:  { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    status:    { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note:      { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ══════════════════════════════════════════════════════════════════════════════
// §3  MAIN SCHEMA
// ══════════════════════════════════════════════════════════════════════════════

const pharmacyOrderSchema = new Schema(
  {
    // ── ORDER IDENTITY ────────────────────────────────────────────────────────

    orderId: {
      type:     String,
      unique:   true,
      required: true,
      default:  generateOrderId,
      trim:     true,
      index:    true,
    },

    customer: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    store: {
      type:     Schema.Types.ObjectId,
      ref:      'PharmacyStore',
      required: true,
      index:    true,
    },

    // ── ORDER ITEMS ───────────────────────────────────────────────────────────

    items: [
      {
        medicine:      { type: Schema.Types.ObjectId, ref: 'Medicine' },
        name:          { type: String, required: true },
        brandName:     { type: String },
        genericName:   { type: String },
        medicineImage: { type: String },
        hsnCode:       { type: String },
        gstPercentage: { type: Number, default: 12 },
        quantity:      { type: Number, required: true, min: 1 },
        pricePerUnit:  { type: Number, required: true, min: 0 },
        taxAmount:     { type: Number, default: 0,    min: 0 },
        totalPrice:    { type: Number, required: true, min: 0 },
        isPrescriptionRequired: { type: Boolean, default: false },
      },
    ],

    // ── PRESCRIPTION ──────────────────────────────────────────────────────────

    prescription: {
      isRequired: { type: Boolean, default: false },
      imageUrl:   { type: String },
      uploadedAt: { type: Date },
      isVerified:        { type: Boolean, default: false },
      verifiedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt:        { type: Date },
      verificationNotes: { type: String },
      rejectionReason:   { type: String },
      verificationStatus: {
        type:    String,
        enum:    ['Not_Uploaded', 'Pending', 'Approved', 'Rejected'],
        default: 'Not_Uploaded',
      },
    },

    // ── PAYMENT ───────────────────────────────────────────────────────────────

    payment: {
      method: {
        type:     String,
        enum:     ['Razorpay', 'Wallet', 'COD'],
        required: true,
      },
      razorpayOrderId:   { type: String, sparse: true },
      razorpayPaymentId: { type: String, sparse: true },
      razorpaySignature: { type: String, select: false },
      status: {
        type:    String,
        enum:    ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially_Refunded'],
        default: 'Pending',
      },
      paidAt: { type: Date },
      transactionLog: { type: [transactionLogSchema], default: [] },
    },

    // ── BILLING ───────────────────────────────────────────────────────────────

    billing: {
      subTotal:         { type: Number, required: true, min: 0 },
      gstAmount:        { type: Number, default: 0, min: 0 },
      deliveryCharges:  { type: Number, default: 0, min: 0 },
      platformFee:      { type: Number, default: 0, min: 0 },
      discountAmount:   { type: Number, default: 0, min: 0 },
      walletAmountUsed: { type: Number, default: 0, min: 0 },
      promoCode:        { type: String, trim: true },
      totalPayable:     { type: Number, required: true, min: 0 },
    },

    // ── DELIVERY ──────────────────────────────────────────────────────────────

    delivery: {
      address: {
        fullName:    { type: String },
        line1:       { type: String },
        landmark:    { type: String },
        city:        { type: String, default: 'Vijayawada' },
        state:       { type: String, default: 'Andhra Pradesh' },
        pincode:     { type: String },
        phone:       { type: String },
        coordinates: {
          lat: { type: Number },
          lng: { type: Number },
        },
      },
      status: {
        type: String,
        enum: [
          'Placed',
          'Confirmed',
          'Processing',
          'Out-for-Delivery',
          'Delivered',
          'Cancelled',
          'Return_Requested',
          'Return_Accepted',
          'Return_Rejected',
          'Pickup_Assigned',
          'Pickup_Done',
          'Returned',
        ],
        default: 'Placed',
      },
      deliveryType: {
        type:    String,
        enum:    ['Internal', 'Third-Party'],
        default: 'Internal',
      },
      internalPartner: { type: Schema.Types.ObjectId, ref: 'User' },
      pickupPartner:   { type: Schema.Types.ObjectId, ref: 'User' },
      externalPartner: {
        name:        { type: String },
        phone:       { type: String },
        agencyName:  { type: String },
        trackingUrl: { type: String },
      },
      otp:           { type: String, select: false },
      otpVerifiedAt: { type: Date },
      estimatedArrival:  { type: Date },
      pickupEstimatedAt: { type: Date },
      deliveredAt:       { type: Date },
      statusHistory: { type: [statusHistorySchema], default: [] },
    },

    // ── DELIVERY OTP (EMAIL-BASED) ─────────────────────────────────────────────
    // OTP sent to customer email for doorstep delivery confirmation

    deliveryOtp: {
      code:      { type: String, select: false },
      expiresAt: { type: Date },
      verified:  { type: Boolean, default: false },
      sentAt:    { type: Date },
    },

    // ── CANCELLATION · RETURN · REFUND ────────────────────────────────────────

    cancellation: {
      isCancelled:  { type: Boolean, default: false },
      reason:       { type: String },
      cancelledBy:  { type: Schema.Types.ObjectId, ref: 'User' },
      cancelledAt:  { type: Date },

      isReturnRequested: { type: Boolean, default: false },
      returnReason:      { type: String },
      returnRequestedAt: { type: Date },
      returnRequestedBy: { type: Schema.Types.ObjectId, ref: 'User' },

      // ── NEW: Return evidence media ─────────────────────────────────────────
      // Customer must upload images/videos of medicines before return is accepted
      returnEvidence: [
        {
          mediaType: { type: String, enum: ['image', 'video'], required: true },
          url:       { type: String, required: true },
          uploadedAt:{ type: Date, default: Date.now },
        },
      ],

      returnDecision:     { type: String, enum: ['Pending', 'Accepted', 'Rejected'] },
      returnDecisionBy:   { type: Schema.Types.ObjectId, ref: 'User' },
      returnDecisionAt:   { type: Date },
      returnDecisionNote: { type: String },

      pickupConditionGood:  { type: Boolean },
      pickupConditionNotes: { type: String },
      pickupVerifiedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
      pickupVerifiedAt:     { type: Date },

      // ── REFUND ────────────────────────────────────────────────────────────
      refundMethod: {
        type:    String,
        enum:    ['Wallet', 'Original_Source', 'Bank_Transfer', 'None'],
        default: 'None',
      },

      // Customer's chosen refund destination (set at return-request time)
      selectedRefundMethod: {
        type: String,
        enum: ['Wallet', 'Online', 'Bank_Transfer', 'Custom_Bank'],
      },

      // Custom bank details provided by customer at return time
      bankDetails: {
        accountHolderName: { type: String },
        accountNumber:     { type: String },
        ifscCode:          { type: String },
        bankName:          { type: String },
        branchName:        { type: String },
      },

      refundId: { type: String },

      refundStatus: {
        type:    String,
        enum:    ['None', 'Requested', 'In-Progress', 'Processed', 'Failed'],
        default: 'None',
      },

      refundAmount:      { type: Number, default: 0, min: 0 },
      refundInitiatedAt: { type: Date },
      refundedAt:        { type: Date },
      adminRefundNote:   { type: String },
    },

    // ── ADMIN NOTES ───────────────────────────────────────────────────────────

    adminNotes: [
      {
        text:    { type: String, required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // ── CUSTOMER FEEDBACK ─────────────────────────────────────────────────────

    customerFeedback: {
      rating:    { type: Number, min: 1, max: 5 },
      comment:   { type: String, trim: true },
      createdAt: { type: Date },
    },

    /** Soft-delete flag */
    isArchived: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// §4  VIRTUALS
// ══════════════════════════════════════════════════════════════════════════════

pharmacyOrderSchema.virtual('isReturnPending').get(function () {
  return (
    this.cancellation?.isReturnRequested === true &&
    this.delivery?.status === 'Return_Requested'
  );
});

pharmacyOrderSchema.virtual('isRefundPending').get(function () {
  return ['Requested', 'In-Progress'].includes(this.cancellation?.refundStatus);
});

pharmacyOrderSchema.virtual('canBeRefunded').get(function () {
  return (
    this.cancellation?.refundStatus === 'Requested' &&
    this.payment?.status !== 'Refunded'
  );
});

pharmacyOrderSchema.virtual('canRequestReturn').get(function () {
  return (
    this.delivery?.status === 'Delivered' &&
    !this.cancellation?.isReturnRequested
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// §5  PRE-SAVE MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════

pharmacyOrderSchema.pre('save', async function () {

  // 1. Append to statusHistory on every delivery status change
  if (this.isModified('delivery.status')) {
    if (!Array.isArray(this.delivery.statusHistory)) {
      this.delivery.statusHistory = [];
    }
    this.delivery.statusHistory.push({
      status:    this.delivery.status,
      changedBy: this.$locals?.updatedBy ?? undefined,
      timestamp: new Date(),
    });
    if (this.delivery.statusHistory.length > 100) {
      this.delivery.statusHistory = this.delivery.statusHistory.slice(-100);
    }

    // AUTO: Mark payment as Paid when COD order is Delivered
    if (
      this.delivery.status === 'Delivered' &&
      this.payment.method === 'COD' &&
      this.payment.status !== 'Paid'
    ) {
      this.payment.status = 'Paid';
      this.payment.paidAt = new Date();
    }

    // Auto-stamp deliveredAt
    if (this.delivery.status === 'Delivered' && !this.delivery.deliveredAt) {
      this.delivery.deliveredAt = new Date();
    }
  }

  // 2. Sync prescription.verificationStatus
  if (this.isModified('prescription.imageUrl') && this.prescription.imageUrl) {
    this.prescription.verificationStatus = 'Pending';
    this.prescription.uploadedAt         = new Date();
    if (!this.isNew) {
      this.prescription.isVerified = false;
    }
  }

  if (this.isModified('prescription.isVerified') && !this.isNew) {
    if (this.prescription.isVerified === true) {
      this.prescription.verificationStatus = 'Approved';
      this.prescription.verifiedAt         = new Date();
    } else if (this.prescription.isVerified === false && this.prescription.imageUrl) {
      this.prescription.verificationStatus = 'Rejected';
    }
  }

  // 3. Cap payment transactionLog at last 50 entries
  if (
    this.isModified('payment.transactionLog') &&
    Array.isArray(this.payment.transactionLog) &&
    this.payment.transactionLog.length > 50
  ) {
    this.payment.transactionLog = this.payment.transactionLog.slice(-50);
  }

  // 4. Auto-stamp refundInitiatedAt on first refund trigger
  if (
    this.isModified('cancellation.refundStatus') &&
    this.cancellation.refundStatus === 'Requested' &&
    !this.cancellation.refundInitiatedAt
  ) {
    this.cancellation.refundInitiatedAt = new Date();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// §6  INDEXES
// ══════════════════════════════════════════════════════════════════════════════

pharmacyOrderSchema.index({ orderId: 1 }, { unique: true });
pharmacyOrderSchema.index({ customer: 1, createdAt: -1 });
pharmacyOrderSchema.index({ store: 1,    createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, 'delivery.status': 1, createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, isArchived: 1,        createdAt: -1 });
pharmacyOrderSchema.index({ 'payment.razorpayOrderId':   1 }, { sparse: true });
pharmacyOrderSchema.index({ 'payment.razorpayPaymentId': 1 }, { sparse: true });
pharmacyOrderSchema.index({ store: 1, 'payment.status': 1 });
pharmacyOrderSchema.index({ store: 1, 'cancellation.refundStatus': 1 });
pharmacyOrderSchema.index({ store: 1, 'cancellation.isReturnRequested': 1 });
pharmacyOrderSchema.index({ store: 1, 'payment.status': 1, createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, 'delivery.status': 1, 'delivery.deliveredAt': -1 });
pharmacyOrderSchema.index({ orderId: 'text' });

// ══════════════════════════════════════════════════════════════════════════════
// §7  MODEL EXPORT
// ══════════════════════════════════════════════════════════════════════════════

const PharmacyOrder = mongoose.model('PharmacyOrder', pharmacyOrderSchema);
export default PharmacyOrder;