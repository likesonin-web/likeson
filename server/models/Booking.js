import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * Booking Model — Likeson.in
 *
 * Single unified booking document for ALL service types:
 *   - full_care_ride       (transport + care assistant + doctor visit bundled)
 *   - transport_only       (patient transportation)
 *   - care_assistant_only  (care assistant escort)
 *   - doctor_consultation  (in-person / video / home visit)
 *   - diagnostic           (lab test booking / home sample collection)
 *   - pharmacy_order       (medicine delivery — links to PharmacyOrder)
 *   - blood_bank           (blood unit request)
 *
 * Each type uses its own sub-document section; unused sections remain null.
 * Billing is always on the root: grossAmount, discount, tax, netAmount.
 *
 * State machine: pending → confirmed → in_progress → completed
 *                                   ↘ cancelled
 *                                   ↘ no_show
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  'full_care_ride', 'transport_only', 'care_assistant_only',
  'doctor_consultation', 'diagnostic', 'pharmacy_order', 'blood_bank',
];

const BOOKING_STATUSES = [
  'pending', 'confirmed', 'assigned', 'in_progress',
  'completed', 'cancelled', 'no_show', 'refund_initiated', 'refunded',
];

const PAYMENT_STATUSES = ['unpaid', 'paid', 'partial', 'refunded', 'failed'];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

// Shared address snapshot (captured at booking time — not linked to live address)
const addressSnapshotSchema = new Schema(
  {
    label:       { type: String }, // "Home", "Hospital", etc.
    street:      { type: String },
    city:        { type: String },
    state:       { type: String },
    pinCode:     { type: String },
    coordinates: { type: [Number] }, // [lng, lat]
    googleMapsUrl:{ type: String },
  },
  { _id: false }
);

// ── Transport Sub-document ─────────────────────────────────────────────────────
const transportInfoSchema = new Schema(
  {
    driver:              { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    vehicleSnapshot: {
      registrationNumber: { type: String },
      make:               { type: String },
      model:              { type: String },
      color:              { type: String },
      vehicleType:        { type: String },
    },
    pickupAddress:       { type: addressSnapshotSchema },
    dropAddress:         { type: addressSnapshotSchema },
    distanceKm:          { type: Number, default: 0 },
    estimatedDurationMin:{ type: Number, default: 0 },
    farePerKm:           { type: Number }, // locked from PlatformPricingConfig at booking time
    baseFare:            { type: Number },
    waitingCharges:      { type: Number, default: 0 },
    nightSurcharge:      { type: Number, default: 0 },
    driverStartedAt:     { type: Date },
    driverArrivedAt:     { type: Date },
    rideStartedAt:       { type: Date },
    rideEndedAt:         { type: Date },
    otp:                 { type: String, select: false }, // ride start OTP
    otpVerified:         { type: Boolean, default: false },
    liveTrackingUrl:     { type: String },
  },
  { _id: false }
);

// ── Care Assistant Sub-document ────────────────────────────────────────────────
const careAssistantInfoSchema = new Schema(
  {
    careAssistant:   { type: Schema.Types.ObjectId, ref: 'CareAssistantProfile', default: null },
    assignedAt:      { type: Date },
    arrivedAt:       { type: Date },
    taskStartedAt:   { type: Date },
    taskCompletedAt: { type: Date },
    payoutAmount:    { type: Number }, // locked from PlatformPricingConfig
    isPaid:          { type: Boolean, default: false },
    paidAt:          { type: Date },
  },
  { _id: false }
);

// ── Doctor Consultation Sub-document ──────────────────────────────────────────
const consultationInfoSchema = new Schema(
  {
    doctor:              { type: Schema.Types.ObjectId, ref: 'DoctorProfile', default: null },
    hospital:            { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    consultationType:    { type: String, enum: ['in_person', 'video', 'home_visit', 'follow_up'] },
    scheduledAt:         { type: Date },
    startedAt:           { type: Date },
    endedAt:             { type: Date },
    durationMinutes:     { type: Number },
    meetingLink:         { type: String }, // For video consultations
    specialization:      { type: String },
    reasonForVisit:      { type: String, maxlength: 500 },
    doctorNotes:         { type: String, maxlength: 2000 },
    prescriptionUrl:     { type: String },
    followUpDue:         { type: Date },
    honorariumAmount:    { type: Number }, // locked from PlatformPricingConfig
    honorariumPaid:      { type: Boolean, default: false },
    honorariumPaidAt:    { type: Date },
  },
  { _id: false }
);

// ── Diagnostic Sub-document ───────────────────────────────────────────────────
const diagnosticInfoSchema = new Schema(
  {
    labPartner:             { type: Schema.Types.ObjectId, ref: 'LabPartner', default: null },
    isHomeSampleCollection: { type: Boolean, default: false },
    collectionAddress:      { type: addressSnapshotSchema },
    phlebotomist:           { type: String },
    collectionScheduledAt:  { type: Date },
    collectionDoneAt:       { type: Date },
    testsRequested: [
      {
        testName:     { type: String, trim: true, required: true },
        testCode:     { type: String, trim: true },
        price:        { type: Number },
        reportUrl:    { type: String },
        reportReady:  { type: Boolean, default: false },
        reportReadyAt:{ type: Date },
      },
    ],
    prescriptionUrl:     { type: String },
    allReportsReady:     { type: Boolean, default: false },
    reportsReadyAt:      { type: Date },
    reportDeliveryMethod:{ type: String, enum: ['digital', 'physical', 'both'], default: 'digital' },
    commissionAmount:    { type: Number }, // earned from lab
  },
  { _id: false }
);

// ── Blood Bank Sub-document ───────────────────────────────────────────────────
const bloodBankInfoSchema = new Schema(
  {
    bloodGroup:         { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    componentRequired:  { type: String, enum: ['Whole Blood', 'PRBC', 'Platelets', 'FFP', 'Cryoprecipitate'] },
    unitsRequired:      { type: Number, default: 1 },
    hospital:           { type: Schema.Types.ObjectId, ref: 'Hospital' },
    patientName:        { type: String, trim: true },
    requestedForDate:   { type: Date },
    fulfilledAt:        { type: Date },
    notes:              { type: String },
  },
  { _id: false }
);

// ── Timeline Event Sub-document ────────────────────────────────────────────────
const timelineEventSchema = new Schema(
  {
    status:    { type: String, enum: BOOKING_STATUSES },
    note:      { type: String },
    actorType: { type: String, enum: ['system', 'customer', 'driver', 'care_assistant', 'doctor', 'admin'] },
    actor:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

// ── Cancellation Sub-document ─────────────────────────────────────────────────
const cancellationSchema = new Schema(
  {
    cancelledBy:   { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledByRole:{ type: String },
    reason:        { type: String },
    refundPercent: { type: Number, default: 0 },
    refundAmount:  { type: Number, default: 0 },
    refundStatus:  { type: String, enum: ['none', 'pending', 'processed'], default: 'none' },
    refundedAt:    { type: Date },
    refundTxnId:   { type: String },
  },
  { _id: false }
);

// ── Rating Sub-document ────────────────────────────────────────────────────────
const ratingSchema = new Schema(
  {
    ratedAt:     { type: Date, default: Date.now },
    ratingValue: { type: Number, min: 1, max: 5 },
    review:      { type: String, maxlength: 500 },
    ratedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bookingSchema = new Schema(
  {
    // ── Reference Number ────────────────────────────────────────────────────
    bookingNumber: {
      type:   String,
      unique: true,
      index:  true,
      // Generated in pre-save: LKS-BKG-<base36-ts><rand>
    },

    // ── Service Type ────────────────────────────────────────────────────────
    serviceType: {
      type:     String,
      required: true,
      enum:     SERVICE_TYPES,
      index:    true,
    },

    // ── Parties Involved ────────────────────────────────────────────────────
    customer:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /**
     * If a family member is the patient (Family Plan), store separately.
     * patient === customer for solo plans.
     */
    patient:      { type: Schema.Types.ObjectId, ref: 'User', default: null },
    patientName:  { type: String, trim: true }, // denormalised for quick reads

    // ── Subscription Context ────────────────────────────────────────────────
    /**
     * If this booking was made under a subscription, store plan details.
     * Pay-per-service bookings leave this null.
     */
    subscriptionPlan: {
      plan:     { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
      planSlug: { type: String },
      isCoveredByPlan: { type: Boolean, default: false },
    },

    // ── Scheduling ──────────────────────────────────────────────────────────
    scheduledAt:   { type: Date, required: true, index: true },
    scheduledDate: { type: String }, // "YYYY-MM-DD" for quick filter
    scheduledTime: { type: String }, // "HH:MM" for display

    // ── Status & Lifecycle ──────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    BOOKING_STATUSES,
      default: 'pending',
      index:   true,
    },
    timeline: { type: [timelineEventSchema], default: [] },

    // ── Service-Specific Sub-documents ──────────────────────────────────────
    transport:      { type: transportInfoSchema,       default: null },
    careAssistant:  { type: careAssistantInfoSchema,   default: null },
    consultation:   { type: consultationInfoSchema,    default: null },
    diagnostic:     { type: diagnosticInfoSchema,      default: null },
    bloodBank:      { type: bloodBankInfoSchema,       default: null },
    /**
     * For pharmacy orders, we link to a separate PharmacyOrder document
     * to avoid embedding large item arrays here.
     */
    pharmacyOrder:  { type: Schema.Types.ObjectId, ref: 'PharmacyOrder', default: null },

    // ── Billing ──────────────────────────────────────────────────────────────
    billing: {
      /**
       * Pricing snapshot (locked at booking creation from PlatformPricingConfig).
       * This ensures price changes don't affect already-booked services.
       */
      grossAmount:       { type: Number, default: 0 },
      discountPercent:   { type: Number, default: 0 },
      discountAmount:    { type: Number, default: 0 },
      couponCode:        { type: String },
      couponDiscount:    { type: Number, default: 0 },
      coinsUsed:         { type: Number, default: 0 },
      coinsDiscount:     { type: Number, default: 0 },  // coins * (1/COINS_PER_RUPEE)
      taxPercent:        { type: Number, default: 0 },
      taxAmount:         { type: Number, default: 0 },
      netAmount:         { type: Number, default: 0 },  // What customer pays
      platformFee:       { type: Number, default: 0 },  // Likeson's cut
      partnerPayout:     { type: Number, default: 0 },  // Transport / Lab / etc.
      currency:          { type: String, default: 'INR' },
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    payment: {
      status:    { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
      method:    { type: String, enum: ['upi', 'card', 'netbanking', 'wallet', 'cash', 'subscription_credit', null], default: null },
      gatewayOrderId: { type: String },
      gatewayPaymentId: { type: String },
      paidAt:    { type: Date },
      paidAmount:{ type: Number, default: 0 },
    },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancellation: { type: cancellationSchema, default: null },

    // ── Ratings ───────────────────────────────────────────────────────────────
    customerRating:  { type: ratingSchema, default: null },
    providerRating:  { type: ratingSchema, default: null },

    // ── Source ────────────────────────────────────────────────────────────────
    bookingSource: {
      type:    String,
      enum:    ['app_android', 'app_ios', 'web', 'admin_panel', 'whatsapp', 'phone_call'],
      default: 'web',
    },

    // ── Notes ─────────────────────────────────────────────────────────────────
    customerNotes: { type: String, maxlength: 500 },
    adminNotes:    { type: String, select: false },

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

bookingSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

bookingSchema.virtual('isCancellable').get(function () {
  return ['pending', 'confirmed', 'assigned'].includes(this.status);
});

bookingSchema.virtual('fullRefundEligible').get(function () {
  if (!this.scheduledAt) return false;
  const hoursAhead = (this.scheduledAt - new Date()) / (1000 * 60 * 60);
  return hoursAhead > 24;
});

// ── Pre-save Middleware ───────────────────────────────────────────────────────

bookingSchema.pre('save', function () {
  // Generate booking number
  if (this.isNew && !this.bookingNumber) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-3).toUpperCase();
    this.bookingNumber = `LKS-BKG-${ts}${rand}`;
  }

  // Derive scheduledDate and scheduledTime
  if (this.isModified('scheduledAt') && this.scheduledAt) {
    const d = new Date(this.scheduledAt);
    this.scheduledDate = d.toISOString().slice(0, 10);
    this.scheduledTime = d.toTimeString().slice(0, 5);
  }

  // Push timeline event on status change
  if (this.isModified('status')) {
    this.timeline.push({ status: this.status, actorType: 'system' });
  }

  // Compute netAmount
  if (this.isModified('billing')) {
    const b = this.billing;
    const totalDiscount = (b.discountAmount || 0) + (b.couponDiscount || 0) + (b.coinsDiscount || 0);
    b.netAmount = Math.max(0, +(b.grossAmount - totalDiscount + b.taxAmount).toFixed(2));
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ customer: 1, scheduledAt: -1 });
bookingSchema.index({ serviceType: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1, serviceType: 1 });
bookingSchema.index({ 'transport.driver': 1, status: 1 });
bookingSchema.index({ 'careAssistant.careAssistant': 1, status: 1 });
bookingSchema.index({ 'consultation.doctor': 1, status: 1 });
bookingSchema.index({ 'consultation.hospital': 1, scheduledAt: -1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;