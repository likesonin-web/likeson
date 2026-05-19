import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateBookingCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING MODEL — Likeson.in
//
// FIXES IN THIS VERSION:
//  BUG #3 + #5 FIX: Added subscriptionUsagePending array field.
//    Booking routes push {subId, field} objects here instead of immediately
//    calling incrementSubscriptionUsage(). Actual increment happens after
//    payment is verified in /verify-payment route or
//    POST /subscriptions/flush-pending-usage.
//    On cancellation, this array is cleared so no quota is ever consumed
//    for bookings where payment was not completed.
// ─────────────────────────────────────────────────────────────────────────────

export const BOOKING_TYPES = [
  'full_care_ride',
  'doctor_consultation',
  'doctor_online',
  'physiotherapist',
  'care_assistant',
  'diagnostic_center',
  'diagnostic_home',
  'patient_transport',
  'follow_up',
];

export const BOOKING_STATUSES = [
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'refund_pending',
  'refunded',
];

export const PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'paid',
  'partially_paid',
  'failed',
  'refunded',
  "pending_cash",
  'partially_refunded',
  'waived',
];

export const CANCELLATION_ACTORS = [
  'customer',
  'doctor',
  'hospital',
  'care_assistant',
  'driver',
  'lab_partner',
  'admin',
  'system',
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const geoPointSchema = new Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    label:       { type: String, trim: true },
    address:     { type: String, trim: true },
    city:        { type: String, trim: true },
    pincode:     { type: String, trim: true },
  },
  { _id: false }
);

const fareBreakdownSchema = new Schema(
  {
    consultationFee:   { type: Number, default: 0, min: 0 },
    careAssistantFee:  { type: Number, default: 0, min: 0 },
    transportFee:      { type: Number, default: 0, min: 0 },
    diagnosticFee:     { type: Number, default: 0, min: 0 },
    homeCollectionFee: { type: Number, default: 0, min: 0 },
    platformFee:       { type: Number, default: 0, min: 0 },
    taxes:             { type: Number, default: 0, min: 0 },
    discount:          { type: Number, default: 0, min: 0 },
    couponDiscount:    { type: Number, default: 0, min: 0 },
    walletApplied:     { type: Number, default: 0, min: 0 },
    totalAmount:       { type: Number, default: 0, min: 0 },
    amountPaid:        { type: Number, default: 0, min: 0 },
    refundAmount:      { type: Number, default: 0, min: 0 },
    currency:          { type: String, default: 'INR' },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    gateway:       { type: String, enum: ['Razorpay', 'Cashfree', 'PayU', 'PhonePe', 'Wallet', 'Cash', 'Manual'] },
    transactionId: { type: String, trim: true },
    orderId:       { type: String, trim: true },
    paymentMode:   { type: String, enum: ['UPI', 'Card', 'NetBanking', 'Wallet', 'Cash', 'EMI', 'Other'] },
    amount:        { type: Number, required: true, min: 0 },
    status:        { type: String, enum: ['initiated', 'success', 'failed', 'refunded'], default: 'initiated' },
    paidAt:        { type: Date },
    refundedAt:    { type: Date },
    refundId:      { type: String },
    notes:         { type: String },
  },
  { _id: true, timestamps: true }
);

const patientInfoSchema = new Schema(
  {
    name:       { type: String, required: true, trim: true },
    age:        { type: Number, min: 0, max: 150 },
    gender:     { type: String, enum: ['Male', 'Female', 'Other', 'Prefer Not to Say'] },
    phone:      { type: String },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] },
    weight:     { type: Number, min: 0 },
    isSelf:     { type: Boolean, default: true },
  },
  { _id: false }
);

const documentSchema = new Schema(
  {
    docType: {
      type: String,
      enum: ['prescription', 'lab_report', 'discharge_summary', 'id_proof', 'insurance', 'other'],
    },
    url:          { type: String, required: true },
    originalName: { type: String },
    uploadedAt:   { type: Date, default: Date.now },
  },
  { _id: true }
);

const diagnosticDetailsSchema = new Schema(
  {
    labPartner:         { type: Schema.Types.ObjectId, ref: 'LabPartnerProfile' },
    tests:              [{ type: Schema.Types.ObjectId }],
    testNames:          [{ type: String, trim: true }],
    packages:           [{ type: Schema.Types.ObjectId }],
    packageNames:       [{ type: String, trim: true }],
    sampleCollectedAt:  { type: Date },
    reportDeliveryMode: { type: String, enum: ['Digital (App)', 'Email', 'WhatsApp', 'Physical Copy'] },
    reportUrl:          { type: String },
    reportReadyAt:      { type: Date },
    technicianName:     { type: String },
  },
  { _id: false }
);

const onlineConsultationSchema = new Schema(
  {
    platform:        { type: String, enum: ['Likeson Chat', 'Google Meet', 'Zoom', 'Jitsi', 'Other'], default: 'Likeson Chat' },
    meetingLink:     { type: String },
    meetingId:       { type: String },
    meetingPass:     { type: String, select: false },
    startedAt:       { type: Date },
    endedAt:         { type: Date },
    durationMinutes: { type: Number },
    recordingUrl:    { type: String, select: false },
  },
  { _id: false }
);

const cancellationSchema = new Schema(
  {
    cancelledBy:       { type: String, enum: CANCELLATION_ACTORS },
    cancelledByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason:            { type: String, trim: true },
    refundEligible:    { type: Boolean, default: false },
    refundPercent:     { type: Number, min: 0, max: 100 },
    cancelledAt:       { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusLogSchema = new Schema(
  {
    fromStatus: { type: String },
    toStatus:   { type: String, required: true },
    changedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    reason:     { type: String },
    changedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

const ratingSchema = new Schema(
  {
    doctorRating:         { type: Number, min: 1, max: 5 },
    doctorComment:        { type: String, trim: true },
    careAssistantRating:  { type: Number, min: 1, max: 5 },
    careAssistantComment: { type: String, trim: true },
    driverRating:         { type: Number, min: 1, max: 5 },
    driverComment:        { type: String, trim: true },
    labRating:            { type: Number, min: 1, max: 5 },
    labComment:           { type: String, trim: true },
    overallRating:        { type: Number, min: 1, max: 5 },
    overallComment:       { type: String, trim: true },
    ratedAt:              { type: Date },
    isPublic:             { type: Boolean, default: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG #3 + #5 FIX: Sub-schema for deferred subscription usage increments.
//
// When a booking is created and a subscription benefit is applied (free
// consultation or free care assistant visit), instead of immediately
// incrementing the usage counter, the booking route pushes an entry here.
//
// The actual increment happens ONLY after:
//   A) Razorpay payment is verified in POST /verify-payment
//   B) Wallet payment succeeds in the booking creation route
//   C) Booking total is ₹0 (fully covered) — flushed immediately
//
// On cancellation: this array is cleared — no quota consumed.
// On booking failure: array is never flushed — no quota consumed.
//
// Fields:
//   subId  — UserSubscription._id to increment
//   field  — usageHistory field name (e.g. 'consultationsUsed', 'careAssistantVisitsUsed')
// ─────────────────────────────────────────────────────────────────────────────
const subscriptionUsagePendingSchema = new Schema(
  {
    subId:  { type: String, required: true }, // stored as string to avoid populate overhead
    field:  { type: String, required: true }, // e.g. 'consultationsUsed', 'careAssistantVisitsUsed'
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bookingSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    bookingCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },

    bookingType: {
      type:     String,
      required: true,
      enum:     BOOKING_TYPES,
      index:    true,
    },

    // ── Parties ───────────────────────────────────────────────────────────────
    customer: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    patientInfo: {
      type:     patientInfoSchema,
      required: true,
    },

    // ── Medical Service Providers ─────────────────────────────────────────────
    doctor: {
      type:    Schema.Types.ObjectId,
      ref:     'DoctorProfile',
      default: null,
      index:   true,
    },

    hospital: {
      type:    Schema.Types.ObjectId,
      ref:     'Hospital',
      default: null,
      index:   true,
    },

    careAssistant: {
      type:    Schema.Types.ObjectId,
      ref:     'CareAssistantProfile',
      default: null,
      index:   true,
    },

    transportPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'TransportPartner',
      default: null,
      index:   true,
    },

    driver: {
      type:    Schema.Types.ObjectId,
      ref:     'DriverProfile',
      default: null,
      index:   true,
    },

    solodriverpartner: {
      type:    Schema.Types.ObjectId,
      ref:     'SoloDriverPartner',
      default: null,
      index:   true,
    },

    labPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'LabPartnerProfile',
      default: null,
      index:   true,
    },

    // ── Consultation Details ──────────────────────────────────────────────────
    consultationType: {
      type:    String,
      enum:    ['inPerson', 'video', 'homeVisit', null],
      default: null,
    },

    scheduledAt: {
      type:     Date,
      required: true,
      index:    true,
    },

    slotId: {
      type:    Schema.Types.ObjectId,
      default: null,
    },

    onlineConsultation: {
      type:    onlineConsultationSchema,
      default: null,
    },

    // ── Location ──────────────────────────────────────────────────────────────
    patientLocation: {
      type:    geoPointSchema,
      default: null,
    },

    destinationLocation: {
      type:    geoPointSchema,
      default: null,
    },

    // ── Diagnostic Details ────────────────────────────────────────────────────
    diagnosticDetails: {
      type:    diagnosticDetailsSchema,
      default: null,
    },

    // ── Follow-up Chain ───────────────────────────────────────────────────────
    followUpParentBooking: {
      type:    Schema.Types.ObjectId,
      ref:     'Booking',
      default: null,
      index:   true,
    },

    followUpDiscountPercent: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },

    subscriptionUsagePending: {
  type:    [subscriptionUsagePendingSchema],
  default: [],
},

// CRITICAL FIX: Explicit definition array property for finalized usage items
confirmedSubscriptionUsage: {
  type: [
    {
      subId: { type: String, required: true },
      field: { type: String, required: true } // e.g., 'consultationsUsed'
    }
  ],
  default: []
},
    // ── Ride Linkage ──────────────────────────────────────────────────────────
    rides: [
      {
        type: Schema.Types.ObjectId,
        ref:  'Ride',
      },
    ],

    primaryRide: {
      type:    Schema.Types.ObjectId,
      ref:     'Ride',
      default: null,
      index:   true,
    },

    returnRide: {
      type:    Schema.Types.ObjectId,
      ref:     'Ride',
      default: null,
    },

    // ── Patient Documents ─────────────────────────────────────────────────────
    documents: {
      type:    [documentSchema],
      default: [],
    },

    // ── Pricing & Payment ─────────────────────────────────────────────────────
    fareBreakdown: {
      type:    fareBreakdownSchema,
      default: () => ({}),
    },

    pricingSource: {
      type: String,
      enum: ['hospital', 'doctor', 'platform', 'subscription'],
    },

    paymentStatus: {
      type:    String,
      enum:    PAYMENT_STATUSES,
      default: 'unpaid',
      index:   true,
    },

    payments: {
      type:    [paymentSchema],
      default: [],
    },

    couponCode:    { type: String, uppercase: true, trim: true },
    coinsRedeemed: { type: Number, default: 0, min: 0 },

    // ── Status & Lifecycle ────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    BOOKING_STATUSES,
      default: 'pending',
      index:   true,
    },

    statusLog: {
      type:    [statusLogSchema],
      default: [],
    },

    cancellation: {
      type:    cancellationSchema,
      default: null,
    },

    completedAt: { type: Date },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating:  { type: ratingSchema, default: null },
    isRated: { type: Boolean, default: false, index: true },

    // ── Staff Snapshots ───────────────────────────────────────────────────────
    doctorSnapshot: {
      name:               { type: String },
      specialization:     { type: String },
      registrationNumber: { type: String },
      profilePhotoUrl:    { type: String },
    },

    careAssistantSnapshot: {
      name:     { type: String },
      photoUrl: { type: String },
      phone:    { type: String },
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    notificationsSent: {
      bookingConfirmation: { type: Boolean, default: false },
      reminderSent:        { type: Boolean, default: false },
      rideStarted:         { type: Boolean, default: false },
      completionSummary:   { type: Boolean, default: false },
    },

    // ── BUG #3 + #5 FIX: Deferred subscription usage increments ──────────────
    //
    // Populated by booking creation routes when a subscription benefit is applied.
    // Each entry = one pending usage increment that must be executed after payment.
    //
    // Lifecycle:
    //   1. Booking created → routes push {subId, field} here via queueSubscriptionUsage()
    //   2. Payment verified → /verify-payment flushes all entries here
    //      OR Wallet payment → flushed immediately in booking route
    //      OR ₹0 total → flushed immediately in booking route
    //   3. Booking cancelled → array cleared, no increment ever happens
    //   4. Payment fails → array stays but verify-payment never called, no increment
    //
    // This field is intentionally excluded from API responses (select: false not
    // used because routes need to read it, but it is excluded in .select() queries).
    // ─────────────────────────────────────────────────────────────────────────
    subscriptionUsagePending: {
      type:    [subscriptionUsagePendingSchema],
      default: [],
    },

    // ── Admin / Internal ──────────────────────────────────────────────────────
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    internalNotes:   { type: String, trim: true, select: false },
    isTestBooking:   { type: Boolean, default: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

bookingSchema.virtual('isActive').get(function () {
  return ['pending', 'confirmed', 'in_progress'].includes(this.status);
});

bookingSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

bookingSchema.virtual('isCancelled').get(function () {
  return ['cancelled', 'no_show'].includes(this.status);
});

bookingSchema.virtual('requiresTransport').get(function () {
  return ['full_care_ride', 'patient_transport', 'diagnostic_home'].includes(this.bookingType);
});

bookingSchema.virtual('requiresDoctor').get(function () {
  return ['full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up']
    .includes(this.bookingType);
});

bookingSchema.virtual('requiresCareAssistant').get(function () {
  return ['full_care_ride', 'care_assistant'].includes(this.bookingType);
});

bookingSchema.virtual('amountDue').get(function () {
  const total = this.fareBreakdown?.totalAmount ?? 0;
  const paid  = this.fareBreakdown?.amountPaid  ?? 0;
  return Math.max(0, total - paid);
});

// Virtual: has unresolved pending subscription usage
// Useful for admin dashboards to flag bookings awaiting payment
bookingSchema.virtual('hasSubscriptionUsagePending').get(function () {
  return Array.isArray(this.subscriptionUsagePending) && this.subscriptionUsagePending.length > 0;
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

bookingSchema.pre('validate', function () {
  const t = this.bookingType;

  // full_care_ride: needs doctor + careAssistant + patientLocation
  if (t === 'full_care_ride') {
    if (!this.doctor)          throw new Error('full_care_ride requires doctor');
    if (!this.careAssistant)   throw new Error('full_care_ride requires careAssistant');
    if (!this.patientLocation) throw new Error('full_care_ride requires patientLocation');
  }

  // doctor_consultation requires doctor
  if (t === 'doctor_consultation' && !this.doctor) {
    throw new Error('doctor_consultation requires doctor');
  }

  // doctor_online requires doctor
  if (t === 'doctor_online' && !this.doctor) {
    throw new Error('doctor_online requires doctor');
  }

  // physiotherapist requires doctor (the physio is a doctor profile)
  if (t === 'physiotherapist' && !this.doctor) {
    throw new Error('physiotherapist requires doctor (physiotherapist profile)');
  }

  // care_assistant booking requires careAssistant
  if (t === 'care_assistant' && !this.careAssistant) {
    throw new Error('care_assistant booking requires careAssistant');
  }

  // follow_up requires both parentBooking and doctor
  if (t === 'follow_up') {
    if (!this.followUpParentBooking) throw new Error('follow_up requires followUpParentBooking');
    if (!this.doctor)                throw new Error('follow_up requires doctor');
  }

  // diagnostic_home requires patientLocation
  if (t === 'diagnostic_home' && !this.patientLocation) {
    throw new Error('diagnostic_home requires patientLocation');
  }

  // patient_transport requires both locations
  if (t === 'patient_transport') {
    if (!this.patientLocation)     throw new Error('patient_transport requires patientLocation (pickup)');
    if (!this.destinationLocation) throw new Error('patient_transport requires destinationLocation (dropoff)');
  }

  // returnRide cannot exist without primaryRide
  if (this.returnRide && !this.primaryRide) {
    throw new Error('returnRide requires primaryRide to be set first');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

bookingSchema.pre('save', async function () {
  // Auto-generate bookingCode
  if (this.isNew && !this.bookingCode) {
    let code, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('bookingCode generation failed');
      code   = `BK-${generateBookingCode()}`;
      exists = await mongoose.model('Booking').exists({ bookingCode: code });
    } while (exists);
    this.bookingCode = code;
  }

  // statusLog fromStatus — read from last log entry
  if (this.isModified('status') && !this.isNew) {
    const lastLog    = this.statusLog?.[this.statusLog.length - 1];
    const fromStatus = lastLog?.toStatus ?? null;
    this.statusLog.push({
      fromStatus,
      toStatus:  this.status,
      changedBy: this.updatedBy || null,
      changedAt: new Date(),
    });
  }

  // Sync isRated
  if (this.isModified('rating') && this.rating?.overallRating) {
    this.isRated        = true;
    this.rating.ratedAt = this.rating.ratedAt ?? new Date();
  }

  // Auto-set completedAt
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  // BUG #3 + #5 FIX: On cancellation, clear pending subscription usage
  // so quota is never consumed for cancelled bookings.
  if (this.isModified('status') && this.status === 'cancelled') {
    if (this.subscriptionUsagePending?.length > 0) {
      this.subscriptionUsagePending = [];
    }
  }

  // Doctor snapshot on first assignment
  if (this.isModified('doctor') && this.doctor && !this.doctorSnapshot?.name) {
    const DoctorProfile = mongoose.model('DoctorProfile');
    const doc = await DoctorProfile.findById(this.doctor)
      .populate('user', 'name')
      .select('specialization registrationNumber profilePhotoUrl')
      .lean();
    if (doc) {
      this.doctorSnapshot = {
        name:               doc.user?.name,
        specialization:     doc.specialization,
        registrationNumber: doc.registrationNumber,
        profilePhotoUrl:    doc.profilePhotoUrl,
      };
    }
  }

  // Care assistant snapshot on first assignment
  if (this.isModified('careAssistant') && this.careAssistant && !this.careAssistantSnapshot?.name) {
    const CareAssistantProfile = mongoose.model('CareAssistantProfile');
    const ca = await CareAssistantProfile.findById(this.careAssistant)
      .select('fullName photoUrl phone')
      .lean();
    if (ca) {
      this.careAssistantSnapshot = {
        name:     ca.fullName,
        photoUrl: ca.photoUrl,
        phone:    ca.phone,
      };
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ customer: 1, bookingType: 1 });
bookingSchema.index({ doctor: 1, scheduledAt: 1 });
bookingSchema.index({ doctor: 1, status: 1 });
bookingSchema.index({ hospital: 1, scheduledAt: 1 });
bookingSchema.index({ careAssistant: 1, status: 1 });
bookingSchema.index({ status: 1, scheduledAt: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ scheduledAt: 1 });
bookingSchema.index({ followUpParentBooking: 1 });
bookingSchema.index({ rides: 1 });
bookingSchema.index({ 'diagnosticDetails.labPartner': 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ bookingType: 1, status: 1, scheduledAt: 1 });
// Index for admin dashboard: find bookings with pending subscription usage
bookingSchema.index({ 'subscriptionUsagePending.0': 1, paymentStatus: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;