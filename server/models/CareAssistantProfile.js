import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Schema: Training Certificates
// ─────────────────────────────────────────────────────────────────────────────
const trainingCertificateSchema = new Schema(
  {
    name:        { type: String, trim: true, required: true },
    issuedBy:    { type: String, trim: true },
    issuedAt:    { type: Date },
    expiresAt:   { type: Date },
    documentUrl: { type: String },
    isVerified:  { type: Boolean, default: false },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Schema: Performance
// ─────────────────────────────────────────────────────────────────────────────
const performanceSchema = new Schema(
  {
    averageRating:       { type: Number, default: 5, min: 0, max: 5 },
    totalRatings:        { type: Number, default: 0 },
    totalTasksCompleted: { type: Number, default: 0 },
    totalTasksCancelled: { type: Number, default: 0 },
    cancellationRate:    { type: Number, default: 0, min: 0, max: 100 }, // percentage
    totalEarnings:       { type: Number, default: 0 },
    monthlyTasks:        { type: Number, default: 0 },
    lastTaskAt:          { type: Date },
    complaintsCount:     { type: Number, default: 0 },
    complimentsCount:    { type: Number, default: 0 },
    onTimeArrivalRate:   { type: Number, default: 100, min: 0, max: 100 },
    repeatClientRate:    { type: Number, default: 0,   min: 0, max: 100 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Schema: KYC
// ─────────────────────────────────────────────────────────────────────────────
const kycSchema = new Schema(
  {
    aadhaarNumber:   {
      type: String, trim: true, select: false,
      match: [/^\d{12}$/, 'Aadhaar must be 12 digits'],
    },
    aadhaarLast4:    { type: String, maxlength: 4 },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    panNumber:   { type: String, uppercase: true, trim: true, select: false },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },

    verificationStatus: {
      type:    String,
      enum:    ['Pending', 'Under-Review', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    submittedAt:     { type: Date },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Schema: Weekly Shift Schedule
// Defines working hours per day of the week.
// ─────────────────────────────────────────────────────────────────────────────
const shiftDaySchema = new Schema(
  {
    isAvailable:    { type: Boolean, default: false },
    startTime:      { type: String, match: [/^\d{2}:\d{2}$/, 'Use HH:MM format'] }, // e.g. "08:00"
    endTime:        { type: String, match: [/^\d{2}:\d{2}$/, 'Use HH:MM format'] }, // e.g. "20:00"
    maxHoursPerDay: { type: Number, default: 12, min: 1, max: 24 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema: CareAssistantProfile
//
// NOTE ON PRICING:
//   All monetary pricing (chargeToUser, payoutToAssistant, platformFee,
//   bonuses, penalties) is owned by PlatformPricingConfig.careAssistant.
//   This profile stores only operational and identity data.
// ─────────────────────────────────────────────────────────────────────────────
const careAssistantProfileSchema = new Schema(
  {
    // ── Link to User account ────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Personal Details ────────────────────────────────────────────────────
    fullName:    { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender:      { type: String, enum: ['Male', 'Female', 'Other', 'Prefer Not to Say'] },
    photoUrl:    { type: String },
    bio:         { type: String, trim: true, maxlength: 500 },

    // ── Contact ─────────────────────────────────────────────────────────────
    phone:          { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    email:          { type: String, trim: true, lowercase: true },

    // ── Address ─────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    // ── Professional Credentials & Training ─────────────────────────────────
    experienceYears: { type: Number, default: 0, min: 0 },
    specializations: [{ type: String, trim: true }], // e.g. ['Dementia Care', 'Post-Surgery']
    languagesKnown:  [{ type: String, trim: true }],

    training: {
      isFirstAidCertified:     { type: Boolean, default: false },
      patientEtiquetteTrained: { type: Boolean, default: false },
      mobilitySupportTrained:  { type: Boolean, default: false },
      medicationManagement:    { type: Boolean, default: false },
      woundCare:               { type: Boolean, default: false },
      certificates:            { type: [trainingCertificateSchema], default: [] },
    },

    // ── Work Type & Engagement Mode ──────────────────────────────────────────
    /**
     * workType – how the assistant operates on the platform:
     *   Full-Time     : 8+ hrs/day, every day
     *   Part-Time     : fewer than 8 hrs/day or select days
     *   Weekends-Only : available only on Sat/Sun
     *   On-Call       : accepts bookings only when manually set online
     */
    workType: {
      type:    String,
      enum:    ['Full-Time', 'Part-Time', 'Weekends-Only', 'On-Call'],
      default: 'Part-Time',
      index:   true,
    },

    // ── Weekly Shift Schedule ────────────────────────────────────────────────
    weeklySchedule: {
      monday:    { type: shiftDaySchema, default: () => ({}) },
      tuesday:   { type: shiftDaySchema, default: () => ({}) },
      wednesday: { type: shiftDaySchema, default: () => ({}) },
      thursday:  { type: shiftDaySchema, default: () => ({}) },
      friday:    { type: shiftDaySchema, default: () => ({}) },
      saturday:  { type: shiftDaySchema, default: () => ({}) },
      sunday:    { type: shiftDaySchema, default: () => ({}) },
    },

    // ── KYC ─────────────────────────────────────────────────────────────────
    kyc: { type: kycSchema, default: () => ({}) },

    // ── Police / Background Verification ────────────────────────────────────
    verification: {
      policeVerificationStatus: {
        type:    String,
        enum:    ['Pending', 'Completed', 'Rejected'],
        default: 'Pending',
      },
      backgroundCheckUrl:  { type: String },
      backgroundCheckDate: { type: Date },
      isVerified:          { type: Boolean, default: false },
      verifiedAt:          { type: Date },
      verifiedBy:          { type: Schema.Types.ObjectId, ref: 'User' },
    },

    // ── Health & Fitness Declaration ─────────────────────────────────────────
    healthDeclaration: {
      isMedicallyFit:     { type: Boolean, default: false },
      declaredAt:         { type: Date },
      anyKnownConditions: { type: String, trim: true, select: false },
    },

    // ── Emergency Contact ────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String, trim: true },
      phone:        { type: String },
      relationship: { type: String, trim: true },
    },

    // ── Real-time Logistics ──────────────────────────────────────────────────
    availability: {
      isOnline:         { type: Boolean, default: false },
      currentCity:      { type: String, default: 'Vijayawada', trim: true },
      minNoticeMinutes: { type: Number, default: 60, min: 0 }, // min advance notice for bookings
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] }, // [lng, lat] — Vijayawada
      updatedAt:   { type: Date, default: Date.now },
    },

    // ── Status ──────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['Available', 'On-Task', 'Offline', 'On-Break', 'Suspended'],
      default: 'Offline',
      index:   true,
    },
    currentActiveTask: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },

    // ── Service Area ─────────────────────────────────────────────────────────
    preferredServiceAreas: [{ type: String, trim: true }],
    maxServiceRadiusKm:    { type: Number, default: 10, min: 1 },

    // ── Bank Details (for payout) ────────────────────────────────────────────
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber:     { type: String, trim: true, select: false },
      accountLast4:      { type: String, maxlength: 4 },
      ifscCode: {
        type:  String, uppercase: true, trim: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'],
      },
      bankName:       { type: String, trim: true },
      upiId:          { type: String, trim: true },
      isBankVerified: { type: Boolean, default: false },
    },

    // ── Performance ──────────────────────────────────────────────────────────
    performance: { type: performanceSchema, default: () => ({}) },

    // ── Earnings Ledger ──────────────────────────────────────────────────────
    // Stores cumulative payout totals only — pricing rates live in PlatformPricingConfig
    earnings: {
      totalPaid:        { type: Number, default: 0 },
      pendingPayout:    { type: Number, default: 0 },
      lastPayoutAt:     { type: Date },
      lifetimeBookings: { type: Number, default: 0 },
    },

    // ── Onboarding ───────────────────────────────────────────────────────────
    onboarding: {
      step:            { type: Number,  default: 1 },
      isComplete:      { type: Boolean, default: false },
      completedAt:     { type: Date },
      agreedToTermsAt: { type: Date },
    },

    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    isActive:    { type: Boolean, default: false },
    isBlocked:   { type: Boolean, default: false },
    blockReason: { type: String },

    // ── Notification Preferences ─────────────────────────────────────────────
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    deviceTokens: [{ type: String }], // FCM tokens for push notifications

    // ── Internal ─────────────────────────────────────────────────────────────
    adminNotes: { type: String, select: false },
    tags:       [{ type: String, trim: true, lowercase: true }],
    createdBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

careAssistantProfileSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

/** True only when all conditions required for dispatch are met */
careAssistantProfileSchema.virtual('isDispatchable').get(function () {
  return (
    this.isActive &&
    this.verification?.isVerified &&
    !this.isBlocked &&
    this.status === 'Available' &&
    this.kyc?.verificationStatus === 'Verified'
  );
});

careAssistantProfileSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

// ─────────────────────────────────────────────────────────────────────────────
// Pre-save Middleware
// ─────────────────────────────────────────────────────────────────────────────

careAssistantProfileSchema.pre('save', function () {
  // Mask Aadhaar
  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  // Mask bank account
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  // Sync verification & activation when KYC status changes
  if (this.isModified('kyc.verificationStatus')) {
    this.verification.isVerified = this.kyc.verificationStatus === 'Verified';
    if (this.verification.isVerified) {
      this.isActive = true;
      this.verification.verifiedAt = new Date();
    }
  }

  // Auto-suspend when blocked
  if (this.isModified('isBlocked') && this.isBlocked) {
    this.status = 'Suspended';
  }

  // Profile completion score
  if (this.isModified()) {
    const checks = [
      !!this.fullName,
      !!this.dateOfBirth,
      !!this.photoUrl,
      this.experienceYears >= 0,
      !!this.phone,
      !!this.kyc?.aadhaarNumber,
      this.kyc?.aadhaarVerified === true,
      !!this.kyc?.panNumber,
      this.verification?.policeVerificationStatus === 'Completed',
      this.training?.isFirstAidCertified === true,
      !!this.bankDetails?.accountNumber,
      !!this.emergencyContact?.phone,
      !!this.weeklySchedule,
      this.healthDeclaration?.isMedicallyFit === true,
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

careAssistantProfileSchema.index({ location: '2dsphere' });
careAssistantProfileSchema.index({ status: 1, 'availability.currentCity': 1 });
careAssistantProfileSchema.index({ workType: 1, status: 1 });
careAssistantProfileSchema.index({ 'kyc.verificationStatus': 1 });
careAssistantProfileSchema.index({ 'verification.isVerified': 1 });
careAssistantProfileSchema.index({ 'performance.averageRating': -1 });
careAssistantProfileSchema.index({ isActive: 1, isBlocked: 1 });
careAssistantProfileSchema.index({ createdAt: -1 });

const CareAssistantProfile = mongoose.model('CareAssistantProfile', careAssistantProfileSchema);
export default CareAssistantProfile;