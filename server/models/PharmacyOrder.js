/**
 * PharmacyOrder.js  (UPDATED)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from original:
 *
 *  1. cancellation.refundStatus  — added 'Failed' enum value
 *  2. cancellation.refundId      — stores Razorpay refund ID (rfnd_xxx)
 *  3. cancellation.refundMethod  — kept, now auto-set by refundService
 *  4. cancellation.selectedRefundMethod — kept, customer sets at return time
 *  5. Pre-save hook: when returnDecision flips to 'Accepted', auto-calls
 *     initiateRefund() in background (non-blocking, logs errors to order).
 *  6. delivery.status gets auto-set to 'Return_Accepted' on returnDecision=Accepted
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
    // IMPORTANT: totalPayable = subTotal + gst + delivery + platform - discount - wallet
    // discountAmount and walletAmountUsed are stored here for refund computation.

    billing: {
      subTotal:         { type: Number, required: true, min: 0 },
      gstAmount:        { type: Number, default: 0,    min: 0 },
      deliveryCharges:  { type: Number, default: 0,    min: 0 },
      platformFee:      { type: Number, default: 0,    min: 0 },
      discountAmount:   { type: Number, default: 0,    min: 0 },  // coupon/promo deducted (customer never paid this)
      walletAmountUsed: { type: Number, default: 0,    min: 0 },  // wallet/coins used at checkout
      promoCode:        { type: String, trim: true },
      totalPayable:     { type: Number, required: true, min: 0 }, // actual cash collected from customer
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

      // Customer must upload images/videos before return is accepted
      returnEvidence: [
        {
          mediaType:  { type: String, enum: ['image', 'video'], required: true },
          url:        { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now },
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

      /**
       * refundMethod: what channel was used to send money back.
       * Set automatically by refundService based on selectedRefundMethod.
       */
      refundMethod: {
        type:    String,
        enum:    ['Wallet', 'Original_Source', 'Bank_Transfer', 'None'],
        default: 'None',
      },

      /**
       * selectedRefundMethod: customer's choice at return-request time.
       * COD orders: only 'Wallet' or 'Bank_Transfer' or 'Custom_Bank' allowed.
       * Online orders: all options available.
       */
      selectedRefundMethod: {
        type: String,
        enum: ['Wallet', 'Online', 'Bank_Transfer', 'Custom_Bank'],
      },

      // Custom bank details provided by customer at return time (for Custom_Bank)
      bankDetails: {
        accountHolderName: { type: String },
        accountNumber:     { type: String },
        ifscCode:          { type: String },
        bankName:          { type: String },
        branchName:        { type: String },
      },

      // Razorpay refund ID (rfnd_xxx) — set by refundService after successful refund
      refundId: { type: String },

      /**
       * refundStatus lifecycle:
       *   None → Requested (on return accepted) → In-Progress (refund initiated)
       *   → Processed (success) | Failed (error, retryable)
       */
      refundStatus: {
        type:    String,
        enum:    ['None', 'Requested', 'In-Progress', 'Processed', 'Failed'],
        default: 'None',
      },

      refundAmount:      { type: Number, default: 0, min: 0 }, // cash portion refunded
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
    ['Requested', 'Failed'].includes(this.cancellation?.refundStatus) &&
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

  // ── A. Delivery status history ──────────────────────────────────────────────
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

  // ── B. Prescription sync ────────────────────────────────────────────────────
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

  // ── C. Cap payment transactionLog ───────────────────────────────────────────
  if (
    this.isModified('payment.transactionLog') &&
    Array.isArray(this.payment.transactionLog) &&
    this.payment.transactionLog.length > 50
  ) {
    this.payment.transactionLog = this.payment.transactionLog.slice(-50);
  }

  // ── D. Auto-stamp refundInitiatedAt ────────────────────────────────────────
  if (
    this.isModified('cancellation.refundStatus') &&
    this.cancellation.refundStatus === 'Requested' &&
    !this.cancellation.refundInitiatedAt
  ) {
    this.cancellation.refundInitiatedAt = new Date();
  }

  // ── E. AUTO-REFUND: trigger when returnDecision flips to 'Accepted' ─────────
  //
  // This is the key integration point.
  // When admin sets cancellation.returnDecision = 'Accepted':
  //   1. Auto-advance delivery status to Return_Accepted
  //   2. Stamp returnDecisionAt
  //   3. Set refundStatus = 'Requested' (initiateRefund() will advance it)
  //   4. Fire initiateRefund() AFTER save completes (post-save, non-blocking)
  //
  // We use a flag (this.$locals._triggerRefund) to pass intent to post-save.
  // The actual Razorpay call happens in post-save to avoid blocking this save.

  if (
    this.isModified('cancellation.returnDecision') &&
    this.cancellation.returnDecision === 'Accepted' &&
    !this.isNew
  ) {
    // Stamp decision timestamp
    if (!this.cancellation.returnDecisionAt) {
      this.cancellation.returnDecisionAt = new Date();
    }

    // Advance delivery status
    if (this.delivery.status === 'Return_Requested') {
      this.delivery.status = 'Return_Accepted';
    }

    // Prime refund status (only if not already in progress)
    if (this.cancellation.refundStatus === 'None' || this.cancellation.refundStatus === 'Failed') {
      this.cancellation.refundStatus      = 'Requested';
      this.cancellation.refundInitiatedAt = new Date();
    }

    // Signal post-save hook to fire refund
    this.$locals._triggerRefund = true;
  }

  // ── F. Return Rejected: update delivery status ──────────────────────────────
  if (
    this.isModified('cancellation.returnDecision') &&
    this.cancellation.returnDecision === 'Rejected' &&
    !this.isNew
  ) {
    if (!this.cancellation.returnDecisionAt) {
      this.cancellation.returnDecisionAt = new Date();
    }
    if (this.delivery.status === 'Return_Requested') {
      this.delivery.status = 'Return_Rejected';
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// §6  POST-SAVE: FIRE REFUND (non-blocking)
// ══════════════════════════════════════════════════════════════════════════════

pharmacyOrderSchema.post('save', function (doc) {
  if (!doc.$locals?._triggerRefund) return;

  // Lazy import to avoid circular dependency (refundService imports PharmacyOrder)
  // Using dynamic import so this file can load without refundService being ready.
  import('./refundService.js')
    .then(({ initiateRefund }) => initiateRefund(doc._id.toString()))
    .then((result) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PharmacyOrder] Auto-refund triggered:', result);
      }
    })
    .catch((err) => {
      // Refund failed — already stamped as 'Failed' in refundService.
      // Alert channel (Slack/email) should be wired here in production.
      console.error('[PharmacyOrder] Auto-refund FAILED for order', doc.orderId, err.message);
      // TODO: send alert to finance team via your notification service
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// §7  INDEXES
// ══════════════════════════════════════════════════════════════════════════════

pharmacyOrderSchema.index({ customer: 1, createdAt: -1 });
pharmacyOrderSchema.index({ store: 1,    createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, 'delivery.status': 1, createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, isArchived: 1,        createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, 'payment.status': 1 });
pharmacyOrderSchema.index({ store: 1, 'cancellation.refundStatus': 1 });
pharmacyOrderSchema.index({ store: 1, 'cancellation.isReturnRequested': 1 });
pharmacyOrderSchema.index({ store: 1, 'payment.status': 1, createdAt: -1 });
pharmacyOrderSchema.index({ store: 1, 'delivery.status': 1, 'delivery.deliveredAt': -1 });
pharmacyOrderSchema.index({ orderId: 'text' });

// ══════════════════════════════════════════════════════════════════════════════
// §8  MODEL EXPORT
// ══════════════════════════════════════════════════════════════════════════════

const PharmacyOrder = mongoose.model('PharmacyOrder', pharmacyOrderSchema);
export default PharmacyOrder;