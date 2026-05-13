import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL TYPE CLASSIFICATION
//
//  MANAGED hospitals  → Multi-Specialty | Super-Specialty | Trust | Government
//    • managementModel: 'hospital-manager'
//    • managedBy  → User{ role: 'hospital' }
//    • PRICING IS SET AT HOSPITAL LEVEL — not doctor level
//      - Doctors linked to this hospital use the hospital's consultation fees
//      - platformFee is set/overridden by superadmin only
//
//  OWNER-OPERATED hospitals → Clinic | Nursing Home
//    • managementModel: 'doctor-owner'
//    • managedBy  → User{ role: 'doctor' }
//    • PRICING IS SET AT DOCTOR LEVEL — doctor controls their own fees
//      - hospitalConsultationPricing is NOT used for these
//
// ─────────────────────────────────────────────────────────────────────────────

export const MANAGED_HOSPITAL_TYPES   = ['Multi-Specialty', 'Super-Specialty', 'Trust', 'Government'];
export const OWNER_OPERATED_TYPES     = ['Clinic', 'Nursing Home'];
export const ALL_HOSPITAL_TYPES       = [...MANAGED_HOSPITAL_TYPES, ...OWNER_OPERATED_TYPES];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const operatingHoursSchema = new Schema(
  {
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    openTime:  { type: String }, // "08:00"
    closeTime: { type: String }, // "20:00"
    is24Hours: { type: Boolean, default: false },
    isClosed:  { type: Boolean, default: false },
  },
  { _id: true }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { _id: false }
);

const platformFeeSchema = new Schema(
  {
    type:  { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL CONSULTATION PRICING
//
// Only applies when managementModel === 'hospital-manager'.
// For 'doctor-owner' hospitals, pricing lives on DoctorProfile.fees instead.
//
// The hospital manager sets these prices for ALL doctors practicing here.
// platformFee within this block can only be changed by superadmin.
// ─────────────────────────────────────────────────────────────────────────────
const hospitalConsultationPricingSchema = new Schema(
  {
    // ── Consultation Fees (set by hospital manager) ───────────────────────────
    inPersonFee:  { type: Number, default: 600,  min: 0 }, // charged to patient
    videoFee:     { type: Number, default: 500,  min: 0 },
    homeVisitFee: { type: Number, default: 1000, min: 0 },

    // ── Doctor Honorarium (set by hospital manager) ───────────────────────────
    // What the hospital pays the doctor per consultation type
    inPersonHonorarium:  { type: Number, default: 400, min: 0 },
    videoHonorarium:     { type: Number, default: 350, min: 0 },
    homeVisitHonorarium: { type: Number, default: 700, min: 0 },

    // ── Follow-Up Policy ──────────────────────────────────────────────────────
    followUpFee:             { type: Number, default: 0,  min: 0 },   // 0 = free follow-up
    followUpDiscountPercent: { type: Number, default: 20, min: 0, max: 100 }, // % off full fee
    followUpValidDays:       { type: Number, default: 7,  min: 1, max: 90  }, // days after first visit

    // ── Consultation Types Offered ────────────────────────────────────────────
    consultationTypes: {
      inPerson:  { type: Boolean, default: true  },
      video:     { type: Boolean, default: false },
      homeVisit: { type: Boolean, default: false },
    },

    // ── Platform Fee (superadmin-controlled only) ─────────────────────────────
    // Superadmin sets or overrides this. Hospital manager CANNOT change this.
    // null → fall back to global PlatformPricingConfig.doctor.platformFee
    platformFee: { type: platformFeeSchema, default: null },

    // ── Last Updated Audit ────────────────────────────────────────────────────
    lastUpdatedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastUpdatedByRole: {
      type:    String,
      enum:    ['admin', 'superadmin', 'hospital'],
      default: null,
    },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const hospitalSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type:     String,
      required: true,
      trim:     true,
      index:    true,
    },
    slug: {
      type:      String,
      unique:    true,
      lowercase: true,
      trim:      true,
      index:     true,
    },

    hospitalType: {
      type:     String,
      required: true,
      enum:     ALL_HOSPITAL_TYPES,
    },

    /**
     * managementModel — NEVER set directly; derived from hospitalType.
     *
     *  'hospital-manager'  → MANAGED type; pricing set at hospital level
     *  'doctor-owner'      → OWNER-OPERATED; pricing set at doctor level
     */
    managementModel: {
      type:  String,
      enum:  ['hospital-manager', 'doctor-owner'],
      index: true,
    },

    managedBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

   // ── Blood Bank References ─────────────────────────────────────────────────
 
  /**
   * bloodBanks — blood banks associated with this hospital.
   *
   * Two categories of entries:
   *   1. hospital_embedded banks (BloodBank.bankType === 'hospital_embedded',
   *      BloodBank.hospital === this._id) — physically inside this hospital.
   *   2. standalone banks in supply agreement
   *      (BloodBank.linkedHospitals contains this._id).
   *
   * This array is the hospital-side mirror. Keep in sync when:
   *   - A BloodBank is created with bankType 'hospital_embedded' + this hospital
   *   - A supply agreement is added/removed (linkedHospitals update)
   *
   * Usage:
   *   await Hospital.findById(id).populate('bloodBanks', 'name bankCode status contact location')
   */
  bloodBanks: [
    {
      type: Schema.Types.ObjectId,
      ref:  'BloodBank',
    },
  ],
 
  /**
   * primaryBloodBank — the main/embedded blood bank of this hospital.
   * Null if hospital has no dedicated blood bank.
   * Usually the first hospital_embedded BloodBank created for this hospital.
   */
  primaryBloodBank: {
    type:    Schema.Types.ObjectId,
    ref:     'BloodBank',
    default: null,
  },
 
  /**
   * acceptsBloodRequests — hospital can place BloodRequests on platform.
   * Default true. Set false if hospital has own sufficient supply chain.
   */
  acceptsBloodRequests: { type: Boolean, default: true },

    description: { type: String, maxlength: 1000 },
    logo:        { type: String },
    images: {
      type:     [String],
      default:  [],
      validate: [v => v.length <= 20, 'Max 20 images allowed'],
    },

    // ── Accreditations ────────────────────────────────────────────────────────
    accreditations:     [{ type: String, enum: ['NABH', 'NABL', 'JCI', 'ISO', 'AHPI', 'Other'] }],
    nabledLabAvailable: { type: Boolean, default: false },

    // ── Contact ───────────────────────────────────────────────────────────────
    contact: {
      email:          { type: String, lowercase: true, trim: true },
      phone:          { type: String, required: true },
      emergencyPhone: { type: String },
      alternatePhone: { type: String },
      website:        { type: String },
      whatsapp:       { type: String },
    },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      line1:    { type: String, required: true, trim: true },
      line2:    { type: String, trim: true },
      landmark: { type: String, trim: true },
      city:     { type: String, default: 'Vijayawada', trim: true },
      state:    { type: String, default: 'Andhra Pradesh', trim: true },
      pincode: {
        type:     String,
        required: true,
        trim:     true,
        match:    [/^[1-9][0-9]{5}$/, 'Invalid Indian PIN code'],
      },
    },

   location: {
  type:        { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [80.648, 16.506] },
 
},
    googleMapsUrl: { type: String },

    // ── Services & Specialties ────────────────────────────────────────────────
    specialties:     [{ type: String, trim: true }],
    facilities:      [{ type: String, trim: true }],
    acceptedSchemes: [{ type: String, trim: true }],

    bedCount: {
      total: { type: Number, default: 0, min: 0 },
      icu:   { type: Number, default: 0, min: 0 },
    },

    // ── Facility Flags ────────────────────────────────────────────────────────
    isEmergencyReady:    { type: Boolean, default: false },
    hasICU:              { type: Boolean, default: false },
    hasBloodBank:        { type: Boolean, default: false },
    hasPharmacy:         { type: Boolean, default: false },
    hasDiagnostics:      { type: Boolean, default: false },
    hasAmbulance:        { type: Boolean, default: false },
    hasWheelchairAccess: { type: Boolean, default: false },
    is24x7:              { type: Boolean, default: false },

    // ── Operating Hours ───────────────────────────────────────────────────────
    operatingHours: { type: [operatingHoursSchema], default: [] },

    // ── Registration / Legal ──────────────────────────────────────────────────
    registrationDetails: {
      licenseNumber: { type: String, required: true, trim: true },
      gstNumber:     { type: String, trim: true },
      panNumber: {
        type:      String,
        trim:      true,
        uppercase: true,
        match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN'],
      },
      documentUrl:   { type: String },
      licenseExpiry: { type: Date },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONSULTATION PRICING — hospital-manager hospitals ONLY
    //
    // Populated when managementModel === 'hospital-manager'.
    // For doctor-owner hospitals this is null; pricing is on DoctorProfile.
    //
    // platformFee inside this block → superadmin-controlled only.
    // Hospital manager can update fees/honorariums but NOT platformFee.
    // ─────────────────────────────────────────────────────────────────────────
    consultationPricing: {
      type:    hospitalConsultationPricingSchema,
      default: null,
    },

    // ── Settlement (superadmin / admin set these) ─────────────────────────────
    platformFee: {
      type:    platformFeeSchema,
      default: null,
    },
    settlementCycle: {
      type:    String,
      enum:    ['weekly', 'biweekly', 'monthly'],
      default: null,
    },

    // ── Linked Doctors ────────────────────────────────────────────────────────
    /**
     * hospital-manager: manager adds/removes doctors via hospital panel.
     *   All linked doctors follow consultationPricing set by hospital.
     *
     * doctor-owner: owner-doctor's DoctorProfile._id auto-pushed on creation.
     *   Owner can invite additional doctors (read-only hospital access for them).
     *   Each linked doctor controls their own pricing via DoctorProfile.fees.
     */
    linkedDoctors: [{ type: Schema.Types.ObjectId, ref: 'DoctorProfile' }],

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    // ── Verification & Status ─────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isActive:   { type: Boolean, default: true, index: true },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: {
      step:        { type: Number,  default: 1 },
      isComplete:  { type: Boolean, default: false },
      completedAt: { type: Date },
    },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

hospitalSchema.virtual('isOperational').get(function () {
  return this.isActive && this.isVerified;
});

hospitalSchema.virtual('isManagedHospital').get(function () {
  return this.managementModel === 'hospital-manager';
});

hospitalSchema.virtual('isOwnerOperated').get(function () {
  return this.managementModel === 'doctor-owner';
});

hospitalSchema.virtual('hasCustomPlatformFee').get(function () {
  return this.platformFee !== null && this.platformFee !== undefined;
});

hospitalSchema.virtual('hasCustomSettlementCycle').get(function () {
  return this.settlementCycle !== null && this.settlementCycle !== undefined;
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

hospitalSchema.pre('validate', async function () {
  // Step 1 — derive managementModel from hospitalType
  if (this.isModified('hospitalType') || this.isNew) {
    if (MANAGED_HOSPITAL_TYPES.includes(this.hospitalType)) {
      this.managementModel = 'hospital-manager';
    } else if (OWNER_OPERATED_TYPES.includes(this.hospitalType)) {
      this.managementModel = 'doctor-owner';
    }
  }

  // Step 2 — auto-initialise consultationPricing for managed hospitals
  if (this.isNew && this.managementModel === 'hospital-manager' && !this.consultationPricing) {
    this.consultationPricing = {};  // uses schema defaults
  }

  // Step 3 — enforce correct User role for managedBy
  if (
    (this.isModified('managedBy') || this.isModified('managementModel') || this.isNew) &&
    this.managedBy
  ) {
    const User    = mongoose.model('User');
    const manager = await User.findById(this.managedBy).select('role').lean();

    if (!manager) {
      throw new Error('managedBy references a non-existent User');
    }
    if (this.managementModel === 'hospital-manager' && manager.role !== 'hospital') {
      throw new Error(
        `${this.hospitalType} hospitals require managedBy to be a User with role "hospital" — got "${manager.role}"`
      );
    }
    if (this.managementModel === 'doctor-owner' && manager.role !== 'doctor') {
      throw new Error(
        `${this.hospitalType} hospitals require managedBy to be a User with role "doctor" — got "${manager.role}"`
      );
    }
  }

  // Step 4 — validate consultationPricing only for managed hospitals
  if (this.managementModel === 'hospital-manager' && this.consultationPricing) {
    const cp = this.consultationPricing;

    // Honorarium must not exceed charge to patient
    if (cp.inPersonHonorarium > cp.inPersonFee) {
      throw new Error('inPersonHonorarium cannot exceed inPersonFee');
    }
    if (cp.videoHonorarium > cp.videoFee) {
      throw new Error('videoHonorarium cannot exceed videoFee');
    }
    if (cp.homeVisitHonorarium > cp.homeVisitFee) {
      throw new Error('homeVisitHonorarium cannot exceed homeVisitFee');
    }

    // followUpValidDays sanity
    if (cp.followUpValidDays < 1 || cp.followUpValidDays > 90) {
      throw new Error('followUpValidDays must be between 1 and 90');
    }
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

hospitalSchema.pre('save', function () {
  // Auto-generate slug from name
  if ((this.isNew || this.isModified('name')) && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Sync hasICU flag with bedCount.icu
  if (this.isModified('bedCount.icu')) {
    this.hasICU = (this.bedCount?.icu ?? 0) > 0;
  }

  // doctor-owner hospitals must NOT have consultationPricing
  if (this.managementModel === 'doctor-owner' && this.consultationPricing) {
    this.consultationPricing = null;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ 'address.city': 1, isActive: 1 });
hospitalSchema.index({ hospitalType: 1, isActive: 1 });
hospitalSchema.index({ managementModel: 1, isActive: 1 });
// hospitalSchema.index({ managedBy: 1 });
hospitalSchema.index({ 'rating.averageRating': -1 });
hospitalSchema.index(
  { 'registrationDetails.licenseNumber': 1 },
  { unique: true, sparse: true }
);
// hospitalSchema.index({ slug: 1 });
hospitalSchema.index({ linkedDoctors: 1 });
hospitalSchema.index({ isVerified: 1, isActive: 1 });
hospitalSchema.index({ location: '2dsphere' });          // line near bottom
hospitalSchema.index({ bloodBanks: 1 });
hospitalSchema.index({ primaryBloodBank: 1 });
const Hospital = mongoose.model('Hospital', hospitalSchema);
export default Hospital;