import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL TYPE CLASSIFICATION
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

// ── Main Schema ───────────────────────────────────────────────────────────────

const hospitalSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, lowercase: true, trim: true, index: true },
    hospitalType: { type: String, required: true, enum: ALL_HOSPITAL_TYPES },
    managementModel: { type: String, enum: ['hospital-manager', 'doctor-owner'], index: true },
    managedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // ── Blood Bank References ─────────────────────────────────────────────────
    bloodBanks: [{ type: Schema.Types.ObjectId, ref: 'BloodBank' }],
    primaryBloodBank: { type: Schema.Types.ObjectId, ref: 'BloodBank', default: null },
    acceptsBloodRequests: { type: Boolean, default: true },

    description: { type: String, maxlength: 1000 },
    logo:        { type: String },
    images: { type: [String], default: [], validate: [v => v.length <= 20, 'Max 20 images allowed'] },

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
      pincode:  { type: String, required: true, trim: true, match: [/^[1-9][0-9]{5}$/, 'Invalid Indian PIN code'] },
    },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: String,
    },
    googleMapsUrl: { type: String },

    // ── Services & Specialties ────────────────────────────────────────────────
    specialties:     [{ type: String, trim: true }],
    facilities:      [{ type: String, trim: true }],
    acceptedSchemes: [{ type: String, trim: true }],
    bedCount: { total: { type: Number, default: 0, min: 0 }, icu: { type: Number, default: 0, min: 0 } },

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
      panNumber:     { type: String, trim: true, uppercase: true, match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN'] },
      documentUrl:   { type: String },
      licenseExpiry: { type: Date },
    },

    // ── Settlement ────────────────────────────────────────────────────────────
    settlementCycle: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: null },

    // ── Linked Doctors ────────────────────────────────────────────────────────
    linkedDoctors: [{ type: Schema.Types.ObjectId, ref: 'DoctorProfile' }],

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    // ── Verification & Status ─────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isActive:   { type: Boolean, default: true, index: true },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: { step: { type: Number, default: 1 }, isComplete: { type: Boolean, default: false }, completedAt: { type: Date } },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

hospitalSchema.virtual('isOperational').get(function () { return this.isActive && this.isVerified; });
hospitalSchema.virtual('isManagedHospital').get(function () { return this.managementModel === 'hospital-manager'; });
hospitalSchema.virtual('isOwnerOperated').get(function () { return this.managementModel === 'doctor-owner'; });
hospitalSchema.virtual('hasCustomSettlementCycle').get(function () { return this.settlementCycle !== null && this.settlementCycle !== undefined; });

// ── Pre-validate ──────────────────────────────────────────────────────────────

hospitalSchema.pre('validate', async function () {
  if (this.isModified('hospitalType') || this.isNew) {
    if (MANAGED_HOSPITAL_TYPES.includes(this.hospitalType)) {
      this.managementModel = 'hospital-manager';
    } else if (OWNER_OPERATED_TYPES.includes(this.hospitalType)) {
      this.managementModel = 'doctor-owner';
    }
  }

  if ((this.isModified('managedBy') || this.isModified('managementModel') || this.isNew) && this.managedBy) {
    const User    = mongoose.model('User');
    const manager = await User.findById(this.managedBy).select('role').lean();

    if (!manager) throw new Error('managedBy references a non-existent User');
    if (this.managementModel === 'hospital-manager' && manager.role !== 'hospital') {
      throw new Error(`${this.hospitalType} hospitals require managedBy to be a User with role "hospital" — got "${manager.role}"`);
    }
    if (this.managementModel === 'doctor-owner' && manager.role !== 'doctor') {
      throw new Error(`${this.hospitalType} hospitals require managedBy to be a User with role "doctor" — got "${manager.role}"`);
    }
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

hospitalSchema.pre('save', function () {
  if ((this.isNew || this.isModified('name')) && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  if (this.isModified('bedCount.icu')) {
    this.hasICU = (this.bedCount?.icu ?? 0) > 0;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ 'address.city': 1, isActive: 1 });
hospitalSchema.index({ hospitalType: 1, isActive: 1 });
hospitalSchema.index({ managementModel: 1, isActive: 1 });
hospitalSchema.index({ 'rating.averageRating': -1 });
hospitalSchema.index({ 'registrationDetails.licenseNumber': 1 }, { unique: true, sparse: true });
hospitalSchema.index({ linkedDoctors: 1 });
hospitalSchema.index({ isVerified: 1, isActive: 1 });
hospitalSchema.index({ bloodBanks: 1 });
hospitalSchema.index({ primaryBloodBank: 1 });

const Hospital = mongoose.model('Hospital', hospitalSchema);
export default Hospital;