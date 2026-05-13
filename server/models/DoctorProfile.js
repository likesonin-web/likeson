import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR PRICING RULES
//
//  managementModel === 'hospital-manager'
//    → Doctor's fees (inPerson, video, homeVisit, followUp) are controlled
//      by the Hospital.consultationPricing — set by the hospital manager.
//    → DoctorProfile.fees is READ-ONLY / ignored for these doctors.
//    → DoctorProfile.platformFee is also ignored; hospital's platformFee applies.
//    → Doctor CAN still set their own availability / slots.
//
//  managementModel === 'doctor-owner'  (Clinic / Nursing Home)
//    → Doctor controls ALL their own pricing via DoctorProfile.fees.
//    → DoctorProfile.platformFee overrides global PlatformPricingConfig if set.
//    → null platformFee → falls back to global config.
//
// To check which model applies at booking time:
//   1. Find DoctorProfile → check primaryHospital
//   2. Find Hospital → check managementModel
//   3. If 'hospital-manager' → use Hospital.consultationPricing
//      If 'doctor-owner'     → use DoctorProfile.fees
// ─────────────────────────────────────────────────────────────────────────────

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const qualificationSchema = new Schema(
  {
    degree:  { type: String, trim: true }, // e.g. MBBS, MD, MS
    college: { type: String, trim: true },
    year:    { type: Number },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY SLOT AVAILABILITY
//
// Doctors define their available time slots per day of the week.
// Each slot has:
//   - startTime / endTime  : "HH:MM" 24-hour format (e.g. "09:00", "13:30")
//   - maxPatients          : booking capacity per slot
//   - consultationType     : which type of appointment this slot accepts
//   - isActive             : slot can be temporarily disabled without deleting
//
// Validation rules (pre-validate hook):
//   • startTime must be before endTime
//   • Slots within the same day must not overlap
//   • maxPatients must be ≥ 1
//
// For doctor-owner hospitals: doctor sets these freely.
// For hospital-manager hospitals: doctor sets their own slots; hospital
//   cannot override slot availability (only pricing is hospital-controlled).
// ─────────────────────────────────────────────────────────────────────────────
const slotSchema = new Schema(
  {
    startTime: {
      type:     String,
      required: true,
      match:    [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:MM (24-hour)'],
    },
    endTime: {
      type:     String,
      required: true,
      match:    [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:MM (24-hour)'],
    },
    maxPatients: {
      type:    Number,
      default: 10,
      min:     [1, 'maxPatients must be at least 1'],
    },
    consultationType: {
      type:    String,
      enum:    ['inPerson', 'video', 'homeVisit', 'any'],
      default: 'any',
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const weeklyAvailabilitySchema = new Schema(
  {
    day: {
      type:     String,
      required: true,
      enum:     ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    isAvailable: { type: Boolean, default: true }, // false = day off / holiday
    slots:       { type: [slotSchema], default: [] },
  },
  { _id: true }
);

const kycSchema = new Schema(
  {
    aadhaarNumber:   { type: String, trim: true, select: false },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    panNumber:   { type: String, uppercase: true, trim: true, select: false },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { _id: false }
);

const bankDetailsSchema = new Schema(
  {
    accountHolderName:  { type: String, trim: true },
    accountNumber:      { type: String, trim: true, select: false },
    accountLast4:       { type: String, maxlength: 4 },
    ifscCode: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'],
    },
    bankName:           { type: String, trim: true },
    branchName:         { type: String, trim: true },
    upiId:              { type: String, trim: true },
    gstNumber:          { type: String, trim: true },
    isBankVerified:     { type: Boolean, default: false },
    verifiedAt:         { type: Date },
    cancelledChequeUrl: { type: String },
  },
  { _id: false }
);

const platformFeeSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ['fixed', 'percentage'],
      required: true,
    },
    value: {
      type:     Number,
      required: true,
      min:      0,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR FEES  (doctor-owner only)
//
// Only respected when the doctor's primary hospital is managementModel === 'doctor-owner'
// OR when the doctor has no primaryHospital set.
//
// When managementModel === 'hospital-manager', these values are informational
// only — the actual charge/honorarium comes from Hospital.consultationPricing.
// ─────────────────────────────────────────────────────────────────────────────
const doctorFeesSchema = new Schema(
  {
    inPersonFee:  { type: Number, default: 0, min: 0 },
    videoFee:     { type: Number, default: 0, min: 0 },
    homeVisitFee: { type: Number, default: 0, min: 0 },

    // ── Follow-Up Policy ──────────────────────────────────────────────────────
    followUpFee:             { type: Number, default: 0,  min: 0  },        // 0 = free
    followUpDiscountPercent: { type: Number, default: 20, min: 0, max: 100 }, // % off full fee
    followUpValidDays: {
      type:    Number,
      default: 7,
      min:     [1,  'followUpValidDays must be at least 1'],
      max:     [90, 'followUpValidDays cannot exceed 90'],
    },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const doctorProfileSchema = new Schema(
  {
    // ── Link to User account ──────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Professional Credentials ──────────────────────────────────────────────
    specialization: {
      type:     String,
      required: true,
      enum: [
        'General Physician',
        'Cardiologist',
        'Neurologist',
        'Pediatrician',
        'Oncologist',
        'Orthopedic Surgeon',
        'Gastroenterologist',
        'Gynecologist',
        'Dermatologist',
        'Urologist',
        'Psychiatry',
        'Physiotherapist',
      ],
    },
    qualifications:      { type: [qualificationSchema], default: [] },
    experienceYears:     { type: Number, required: true, min: 0, max: 70 },
    registrationNumber: {
      type:    String,
      unique:  true,
      sparse:  true,
      trim:    true,
      comment: 'Medical Council of India (MCI) or State Medical Council Reg No.',
    },
    registrationCouncil: { type: String, trim: true },

    // ── KYC ───────────────────────────────────────────────────────────────────
    kyc:                { type: kycSchema, default: () => ({}) },
    kycStatus: {
      type:    String,
      enum:    ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'],
      default: 'not-submitted',
      index:   true,
    },
    kycVerifiedAt:      { type: Date },
    kycVerifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    kycRejectionReason: { type: String },

    // ── Hospital Affiliations ─────────────────────────────────────────────────
    /**
     * primaryHospital — determines which pricing model is used for bookings:
     *
     *   If Hospital.managementModel === 'hospital-manager':
     *     → Use Hospital.consultationPricing (hospital controls fees)
     *
     *   If Hospital.managementModel === 'doctor-owner':
     *     → Use DoctorProfile.fees (doctor controls fees)
     *
     *   If null → Use DoctorProfile.fees (doctor controls fees)
     */
    primaryHospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    otherHospitals:  [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],
    managedHospitals: [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],
    // ── Consultation Types Offered ────────────────────────────────────────────
    /**
     * For hospital-manager doctors: this mirrors Hospital.consultationPricing.consultationTypes
     * For doctor-owner doctors: doctor sets this themselves
     *
     * At the API layer, when primaryHospital is 'hospital-manager', sync this
     * from Hospital.consultationPricing.consultationTypes on read.
     */
    consultationTypes: {
      inPerson:  { type: Boolean, default: true  },
      video:     { type: Boolean, default: false },
      homeVisit: { type: Boolean, default: false },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // FEES — doctor-owner hospitals ONLY
    //
    // When primaryHospital.managementModel === 'hospital-manager':
    //   These values are IGNORED at booking time.
    //   Actual pricing comes from Hospital.consultationPricing.
    //   You may store them here as the doctor's "preferred" rates but
    //   they have no effect on charges until the doctor switches hospitals.
    //
    // When primaryHospital.managementModel === 'doctor-owner' OR no hospital:
    //   These ARE the active pricing values used at booking time.
    // ─────────────────────────────────────────────────────────────────────────
    fees: { type: doctorFeesSchema, default: () => ({}) },

    // ─────────────────────────────────────────────────────────────────────────
    // PLATFORM FEE OVERRIDE — doctor-owner only
    //
    // null  → use global PlatformPricingConfig.doctor.platformFee
    // set   → use this doctor-specific override (doctor-owner only)
    //
    // For hospital-manager doctors: IGNORED. Hospital.consultationPricing.platformFee
    // is used instead (superadmin-controlled).
    //
    // Only superadmin / admin can set this field.
    // ─────────────────────────────────────────────────────────────────────────
    platformFee: {
      type:    platformFeeSchema,
      default: null,
    },

    // ── Partnership ───────────────────────────────────────────────────────────
    partnershipStatus: {
      type:    String,
      enum:    ['Pending', 'Active', 'Inactive', 'Suspended'],
      default: 'Pending',
      index:   true,
    },
    partnerSince: { type: Date },
    contractUrl:  { type: String },

    // ── Settlement ────────────────────────────────────────────────────────────
    settlementCycle: {
      type:    String,
      enum:    ['weekly', 'biweekly', 'monthly'],
      default: 'monthly',
    },

    // ── Bank Details ──────────────────────────────────────────────────────────
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },

    // ── Contact Person ────────────────────────────────────────────────────────
    contactPerson: {
      name:        { type: String, trim: true },
      designation: { type: String, trim: true },
      phone:       { type: String },
      email:       { type: String, lowercase: true, trim: true },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // WEEKLY AVAILABILITY
    //
    // Replaces the old flat `availability` array.
    // One entry per day of the week. Doctor sets:
    //   - isAvailable: false → day off (no slots bookable)
    //   - slots[]     → one or more time windows within that day
    //
    // Both hospital-manager AND doctor-owner doctors manage their own slots.
    // The hospital controls PRICING; the doctor controls AVAILABILITY.
    //
    // Validation (pre-validate):
    //   • No duplicate days
    //   • Within each day: startTime < endTime
    //   • Within each day: slots must not overlap
    // ─────────────────────────────────────────────────────────────────────────
    weeklyAvailability: { type: [weeklyAvailabilitySchema], default: [] },

    // ── Professional Profile ──────────────────────────────────────────────────
    biography:       { type: String, maxlength: [1000, 'Biography cannot exceed 1000 characters'] },
    languagesSpoken: [{ type: String, trim: true }],
    achievements:    [{ type: String, trim: true }],
    profilePhotoUrl: { type: String },

    // ── Performance Stats ─────────────────────────────────────────────────────
    stats: {
      totalConsultations:      { type: Number, default: 0 },
      totalHomeVisits:         { type: Number, default: 0 },
      totalVideoConsultations: { type: Number, default: 0 },
      lastConsultationAt:      { type: Date },

      totalReferrals:          { type: Number, default: 0 },
      monthlyReferrals:        { type: Number, default: 0 },
      lastReferralAt:          { type: Date },

      totalEarnings:           { type: Number, default: 0 },
      totalCommissionEarned:   { type: Number, default: 0 },
      pendingSettlement:       { type: Number, default: 0 },
      totalSettled:            { type: Number, default: 0 },
      lastSettledAt:           { type: Date },
    },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    // ── Verification Status ───────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false, index: true },
    isActive:   { type: Boolean, default: true },
    isOnline:   { type: Boolean, default: false },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: {
      step:            { type: Number,  default: 1 },
      isComplete:      { type: Boolean, default: false },
      completedAt:     { type: Date },
      agreedToTermsAt: { type: Date },
    },

    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Internal ──────────────────────────────────────────────────────────────
    adminNotes: { type: String, select: false },
    createdBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

doctorProfileSchema.virtual('isKycComplete').get(function () {
  return this.kycStatus === 'verified';
});

doctorProfileSchema.virtual('isPartnerActive').get(function () {
  return (
    this.partnershipStatus === 'Active' &&
    this.isActive &&
    this.isVerified
  );
});

/**
 * hasCustomPlatformFee
 * Only meaningful for doctor-owner doctors.
 * For hospital-manager doctors, Hospital.consultationPricing.platformFee applies.
 */
doctorProfileSchema.virtual('hasCustomPlatformFee').get(function () {
  return this.platformFee !== null && this.platformFee !== undefined;
});

/**
 * ownedHospitals — Clinic / Nursing Home hospitals where this doctor is the owner.
 * Source of truth: Hospital.managedBy === this.user && managementModel === 'doctor-owner'
 */
doctorProfileSchema.virtual('ownedHospitals', {
  ref:          'Hospital',
  localField:   'user',
  foreignField: 'managedBy',
  justOne:      false,
  match:        { managementModel: 'doctor-owner' },
});

// ── Pre-validate Middleware ───────────────────────────────────────────────────

doctorProfileSchema.pre('validate', function () {
  // ── Validate weekly availability ────────────────────────────────────────────
  if (this.isModified('weeklyAvailability') && this.weeklyAvailability?.length) {
    const days = this.weeklyAvailability.map(d => d.day);

    // No duplicate days
    if (new Set(days).size !== days.length) {
      throw new Error('weeklyAvailability contains duplicate day entries');
    }

    for (const dayEntry of this.weeklyAvailability) {
      if (!dayEntry.isAvailable) continue; // skip validation for days off

      for (const slot of dayEntry.slots) {
        if (!slot.isActive) continue;

        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins   = eh * 60 + em;

        // startTime must be before endTime
        if (startMins >= endMins) {
          throw new Error(
            `Slot on ${dayEntry.day}: startTime (${slot.startTime}) must be before endTime (${slot.endTime})`
          );
        }
      }

      // Check for overlapping slots within the same day
      const activeSlots = dayEntry.slots
        .filter(s => s.isActive)
        .map(s => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          return { start: sh * 60 + sm, end: eh * 60 + em, label: `${s.startTime}–${s.endTime}` };
        })
        .sort((a, b) => a.start - b.start);

      for (let i = 0; i < activeSlots.length - 1; i++) {
        if (activeSlots[i].end > activeSlots[i + 1].start) {
          throw new Error(
            `Slot overlap on ${dayEntry.day}: ${activeSlots[i].label} overlaps with ${activeSlots[i + 1].label}`
          );
        }
      }
    }
  }

  // ── Validate fees (doctor-owner) ────────────────────────────────────────────
  if (this.isModified('fees') && this.fees) {
    if (this.fees.followUpValidDays < 1 || this.fees.followUpValidDays > 90) {
      throw new Error('followUpValidDays must be between 1 and 90');
    }
    if (this.fees.followUpDiscountPercent < 0 || this.fees.followUpDiscountPercent > 100) {
      throw new Error('followUpDiscountPercent must be between 0 and 100');
    }
  }
});

// ── Pre-save Middleware ───────────────────────────────────────────────────────

doctorProfileSchema.pre('save', function () {
  // 1. Sync isVerified with kycStatus
  if (this.isModified('kycStatus')) {
    this.isVerified = this.kycStatus === 'verified';
  }

  // 2. Mask account number → last 4 digits only
  if (
    this.isModified('bankDetails.accountNumber') &&
    this.bankDetails?.accountNumber
  ) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  // 3. Profile completion percentage
  if (this.isModified()) {
    const hasAvailability = this.weeklyAvailability?.some(
      d => d.isAvailable && d.slots?.length > 0
    );
    const checks = [
      this.specialization,
      this.registrationNumber,
      this.experienceYears,
      this.qualifications?.length > 0,
      this.primaryHospital,
      this.kyc?.aadhaarVerified,
      this.kyc?.panVerified,
      hasAvailability,
      this.fees?.inPersonFee > 0,
      this.profilePhotoUrl,
      this.bankDetails?.isBankVerified,
      this.partnershipStatus === 'Active',
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }
});

// ── Static Helpers ────────────────────────────────────────────────────────────

/**
 * Resolve effective pricing for a doctor at booking time.
 *
 * Usage:
 *   const pricing = await DoctorProfile.resolveEffectivePricing(doctorProfileId);
 *   // → { source: 'hospital' | 'doctor', fees: {...}, platformFee: {...} }
 */
doctorProfileSchema.statics.resolveEffectivePricing = async function (doctorProfileId) {
  const Hospital = mongoose.model('Hospital');

  const doctor = await this.findById(doctorProfileId)
    .select('fees platformFee primaryHospital consultationTypes')
    .lean();

  if (!doctor) throw new Error('DoctorProfile not found');

  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select('managementModel consultationPricing platformFee')
      .lean();

    if (hospital?.managementModel === 'hospital-manager' && hospital.consultationPricing) {
      return {
        source:      'hospital',                          // pricing controlled by hospital
        fees:        hospital.consultationPricing,
        platformFee: hospital.consultationPricing.platformFee ?? null,
        note:        'Fees set by hospital manager. platformFee set by superadmin.',
      };
    }
  }

  // doctor-owner or no hospital → doctor controls pricing
  return {
    source:      'doctor',
    fees:        doctor.fees,
    platformFee: doctor.platformFee ?? null,  // null = fall back to global config
    note:        'Fees set by doctor. platformFee: null means global config applies.',
  };
};
doctorProfileSchema.virtual('isProfileComplete').get(function () {
  return !!this.primaryHospital && this.isVerified;
});

// ── Indexes ───────────────────────────────────────────────────────────────────

doctorProfileSchema.index({ specialization: 1 });
doctorProfileSchema.index({ primaryHospital: 1 });
doctorProfileSchema.index({ otherHospitals: 1 });
// doctorProfileSchema.index({ kycStatus: 1 });
doctorProfileSchema.index({ partnershipStatus: 1, isActive: 1 });
doctorProfileSchema.index({ 'rating.averageRating': -1 });
doctorProfileSchema.index({ createdAt: -1 });

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
export default DoctorProfile;