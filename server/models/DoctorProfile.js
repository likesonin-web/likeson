import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const qualificationSchema = new Schema(
  {
    degree:  { type: String, trim: true },
    college: { type: String, trim: true },
    year:    { type: Number },
  },
  { _id: false }
);

const slotSchema = new Schema(
  {
    startTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:MM (24-hour)'] },
    endTime:   { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:MM (24-hour)'] },
    maxPatients: { type: Number, default: 10, min: [1, 'maxPatients must be at least 1'] },
    consultationType: { type: String, enum: ['inPerson', 'video', 'homeVisit', 'any'], default: 'any' },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const weeklyAvailabilitySchema = new Schema(
  {
    day: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    isAvailable: { type: Boolean, default: true },
    slots: { type: [slotSchema], default: [] },
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
    ifscCode: { type: String, uppercase: true, trim: true, match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'] },
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
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const doctorFeesSchema = new Schema(
  {
    consultationFee:  { type: Number, default: 600, min: 0 }, // if that inperson , video , homevist not have any fee defaults use this it have use that only 
    consultationHonorarium:  { type: Number, default: 600, min: 0 }, 

    // Per-type fee overrides (optional — falls back to consultationFee if unset)
    inPersonFee:   { type: Number, default: null, min: 0 },
    videoFee:      { type: Number, default: null, min: 0 },
    homeVisitFee:  { type: Number, default: null, min: 0 },

    inPersonHonorarium:  { type: Number, default: null, min: 0 },
    videoHonorarium:     { type: Number, default: null, min: 0 },
    homeVisitHonorarium: { type: Number, default: null, min: 0 },

    followUpFee:             { type: Number, default: 0,  min: 0  },
    followUpDiscountPercent: { type: Number, default: 20, min: 0, max: 100 },
    followUpValidDays: { type: Number, default: 7, min: [1, 'Min 1'], max: [90, 'Max 90'] },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const doctorProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    specialization: {
      type: String, required: true,
      enum: [
        'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
        'Oncologist', 'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist',
        'Dermatologist', 'Urologist', 'Psychiatry', 'Physiotherapist',
      ],
    },
    qualifications: { type: [qualificationSchema], default: [] },
    experienceYears: { type: Number, required: true, min: 0, max: 70 },
    registrationNumber: { type: String, unique: true, sparse: true, trim: true },
    registrationCouncil: { type: String, trim: true },
    doctorSignature: { type: String },

    kyc: { type: kycSchema, default: () => ({}) },
    kycStatus: { type: String, enum: ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'], default: 'not-submitted', index: true },
    kycVerifiedAt: { type: Date },
    kycVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    kycRejectionReason: { type: String },

    primaryHospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    otherHospitals:  [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],
    managedHospitals: [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],

    consultationTypes: {
      inPerson:  { type: Boolean, default: true  },
      video:     { type: Boolean, default: false },
      homeVisit: { type: Boolean, default: false },
    },

    fees: { type: doctorFeesSchema, default: () => ({}) },
    platformFee: { type: platformFeeSchema, default: null },

    partnershipStatus: { type: String, enum: ['Pending', 'Active', 'Inactive', 'Suspended'], default: 'Pending', index: true },
    partnerSince: { type: Date },
    contractUrl:  { type: String },

    settlementCycle: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    razorpayContactId: { type: String, select: false },
    razorpayFundAccountId: { type: String, select: false },

    contactPerson: {
      name: { type: String, trim: true },
      designation: { type: String, trim: true },
      phone: { type: String },
      email: { type: String, lowercase: true, trim: true },
    },
    
    earnings: {
      pendingPayout: { type: Number, default: 0, min: 0 }, 
      totalPaid: { type: Number, default: 0, min: 0 },     
      lifetimeEarnings: { type: Number, default: 0, min: 0 }, 
      lastPayoutAt: { type: Date }
    },

    weeklyAvailability: { type: [weeklyAvailabilitySchema], default: [] },
    biography: { type: String, maxlength: [1000, 'Biography cannot exceed 1000 characters'] },
    languagesSpoken: [{ type: String, trim: true }],
    achievements: [{ type: String, trim: true }],
    profilePhotoUrl: { type: String },

    stats: {
      totalConsultations: { type: Number, default: 0 },
      totalHomeVisits: { type: Number, default: 0 },
      totalVideoConsultations: { type: Number, default: 0 },
      lastConsultationAt: { type: Date },
      totalReferrals: { type: Number, default: 0 },
      monthlyReferrals: { type: Number, default: 0 },
      lastReferralAt: { type: Date },
      totalEarnings: { type: Number, default: 0 },
      totalCommissionEarned: { type: Number, default: 0 },
      pendingSettlement: { type: Number, default: 0 },
      totalSettled: { type: Number, default: 0 },
      lastSettledAt: { type: Date },
    },

    rating: { type: ratingSummarySchema, default: () => ({}) },
    isVerified: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },

    onboarding: { step: { type: Number, default: 1 }, isComplete: { type: Boolean, default: false }, completedAt: { type: Date }, agreedToTermsAt: { type: Date } },
    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    notifPrefs: { sms: { type: Boolean, default: true }, email: { type: Boolean, default: true }, push: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },

    adminNotes: { type: String, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

doctorProfileSchema.virtual('isKycComplete').get(function () { return this.kycStatus === 'verified'; });
doctorProfileSchema.virtual('isPartnerActive').get(function () { return this.partnershipStatus === 'Active' && this.isActive && this.isVerified; });
doctorProfileSchema.virtual('hasCustomPlatformFee').get(function () { return this.platformFee !== null && this.platformFee !== undefined; });
doctorProfileSchema.virtual('ownedHospitals', { ref: 'Hospital', localField: 'user', foreignField: 'managedBy', justOne: false, match: { managementModel: 'doctor-owner' } });
doctorProfileSchema.virtual('isProfileComplete').get(function () { return !!this.primaryHospital && this.isVerified; });

// ── Pre-validate Middleware ───────────────────────────────────────────────────

doctorProfileSchema.pre('validate', function () {
  if (this.isModified('weeklyAvailability') && this.weeklyAvailability?.length) {
    const days = this.weeklyAvailability.map(d => d.day);
    if (new Set(days).size !== days.length) throw new Error('weeklyAvailability contains duplicate day entries');

    for (const dayEntry of this.weeklyAvailability) {
      if (!dayEntry.isAvailable) continue;

      for (const slot of dayEntry.slots) {
        if (!slot.isActive || !slot.startTime || !slot.endTime) continue;
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        if (sh * 60 + sm >= eh * 60 + em) {
          throw new Error(`Slot on ${dayEntry.day}: startTime (${slot.startTime}) must be before endTime (${slot.endTime})`);
        }
      }

      const activeSlots = dayEntry.slots.filter(s => s.isActive).map(s => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em, label: `${s.startTime}–${s.endTime}` };
      }).sort((a, b) => a.start - b.start);

      for (let i = 0; i < activeSlots.length - 1; i++) {
        if (activeSlots[i].end > activeSlots[i + 1].start) {
          throw new Error(`Slot overlap on ${dayEntry.day}: ${activeSlots[i].label} overlaps with ${activeSlots[i + 1].label}`);
        }
      }
    }
  }

if (this.isModified('fees') && this.fees) {
    if (this.fees.consultationHonorarium > this.fees.consultationFee) {
      throw new Error('consultationHonorarium cannot exceed consultationFee');
    }

    // Per-type: honorarium must not exceed fee
    const types = ['inPerson', 'video', 'homeVisit'];
    for (const t of types) {
      const fee = this.fees[`${t}Fee`];
      const hon = this.fees[`${t}Honorarium`];
      if (fee != null && hon != null && hon > fee) {
        throw new Error(`${t}Honorarium cannot exceed ${t}Fee`);
      }
    }

    if (this.fees.followUpValidDays < 1 || this.fees.followUpValidDays > 90) throw new Error('followUpValidDays must be between 1 and 90');
    if (this.fees.followUpDiscountPercent < 0 || this.fees.followUpDiscountPercent > 100) throw new Error('followUpDiscountPercent must be between 0 and 100');
  }
});

// ── Pre-save Middleware ───────────────────────────────────────────────────────

doctorProfileSchema.pre('save', function () {
  if (this.isModified('kycStatus')) this.isVerified = this.kycStatus === 'verified';
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  if (this.isModified()) {
    const hasAvailability = this.weeklyAvailability?.some(d => d.isAvailable && d.slots?.length > 0);
    const checks = [
      this.specialization,
      this.registrationNumber,
      this.experienceYears,
      this.qualifications?.length > 0,
      this.primaryHospital,
      this.kyc?.aadhaarVerified,
      this.kyc?.panVerified,
      hasAvailability,
      this.fees?.consultationFee > 0,
      this.profilePhotoUrl,
      this.bankDetails?.isBankVerified,
      this.partnershipStatus === 'Active',
    ];
    this.profileCompletionPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }
});

// ── Static Helpers ────────────────────────────────────────────────────────────

doctorProfileSchema.statics.resolveEffectivePricing = async function (doctorProfileId, consultationType = 'inPerson', isFollowUp = false, followUpFee = 0, session = null) {
  let query = this.findById(doctorProfileId).select('fees platformFee consultationTypes').lean();
  if (session) query = query.session(session);
  const doctor = await query;
  if (!doctor) throw new Error('DoctorProfile not found');

  const docFees = doctor.fees || {};

  // Resolve per-type fee or fall back to base
  const feeKey = `${consultationType}Fee`;         // e.g. inPersonFee
  const honKey = `${consultationType}Honorarium`;  // e.g. inPersonHonorarium

  let baseFee    = docFees[feeKey]    ?? docFees.consultationFee    ?? 600;
  let doctorShare = docFees[honKey]   ?? docFees.consultationHonorarium ?? baseFee;
  let hospitalShare = 0;

  if (isFollowUp) {
    baseFee = followUpFee || docFees.followUpFee || 0;
    const stdFee = docFees[feeKey] ?? docFees.consultationFee ?? 1;
    const stdHon = docFees[honKey] ?? docFees.consultationHonorarium ?? 0
    doctorShare = Math.round(baseFee * (stdHon / stdFee));
    hospitalShare = Math.max(0, baseFee - doctorShare);
  } else {
    hospitalShare = Math.max(0, baseFee - doctorShare);
  }

  return {
    source: 'doctor',
    fees: docFees,
    calculated: { baseFee, doctorShare, hospitalShare },
    platformFee: doctor.platformFee ?? null,
    note: 'Fees strictly managed at the doctor profile level.',
  };
};

// ── Indexes ───────────────────────────────────────────────────────────────────

doctorProfileSchema.index({ specialization: 1 });
doctorProfileSchema.index({ primaryHospital: 1 });
doctorProfileSchema.index({ otherHospitals: 1 });
doctorProfileSchema.index({ partnershipStatus: 1, isActive: 1 });
doctorProfileSchema.index({ 'rating.averageRating': -1 });
doctorProfileSchema.index({ createdAt: -1 });

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
export default DoctorProfile;