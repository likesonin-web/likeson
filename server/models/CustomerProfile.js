import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const kycSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Aadhaar', 'PAN', 'VoterID', 'Driving License', 'Passport', 'NREGA Job Card'],
      required: true,
    },
    documentNumber: { type: String },
    holderName:     { type: String, trim: true },
    documentUrl:    { type: String },
    backSideUrl:    { type: String },
    verificationStatus: {
      type:    String,
      enum:    ['Pending', 'In-Review', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    rejectionReason: { type: String },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const governmentSchemeSchema = new Schema(
  {
    schemeName: {
      type: String,
      enum: [
        'Ayushman Bharat (PM-JAY)',
        'Central Government Health Scheme (CGHS)',
        'Employees State Insurance (ESI)',
        'Dr. YSR Aarogyasri (Andhra Pradesh)',
        'Mahatma Jyotiba Phule Jan Arogya Yojana',
        'Biju Swasthya Kalyan Yojana',
        'Karunya Health Scheme',
        'Tamil Nadu CMCHIS',
        'Swasthya Sathi',
        'Aam Aadmi Bima Yojana',
        'Rashtriya Swasthya Bima Yojana (RSBY)',
        'Other State Scheme',
      ],
    },
    beneficiaryId: { type: String },
    holderName:    { type: String, trim: true },
    documentUrl:   { type: String },
    isVerified:    { type: Boolean, default: false },
    verifiedAt:    { type: Date },
    verifiedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const medicalTimelineSchema = new Schema(
  {
    date:         { type: Date, default: Date.now },
    eventTitle:   { type: String, required: true, trim: true },
    hospitalName: { type: String, trim: true },
    description:  { type: String },
    doctorName:   { type: String, trim: true },
    reportUrls:   [{ type: String }],
  },
  { _id: true }
);

const medicineHistorySchema = new Schema(
  {
    medicineName:      { type: String, required: true, trim: true },
    dosage:            { type: String, trim: true },
    frequency:         { type: String, trim: true },
    startDate:         { type: Date },
    endDate:           { type: Date },
    isOngoing:         { type: Boolean, default: true },
    prescribingDoctor: { type: String, trim: true },
    instructions:      { type: String },
  },
  { _id: true }
);

const activeSubscriptionSchema = new Schema(
  {
    plan:        { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    planSlug:    { type: String },
    startDate:   { type: Date },
    endDate:     { type: Date },
    isActive:    { type: Boolean, default: true },
    autoRenew:   { type: Boolean, default: false },
    membersSince:{ type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const customerProfileSchema = new Schema(
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
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Transgender', 'Other', 'Prefer not to say'],
    },
    dob:        { type: Date },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Bombay Phenotype (hh)', 'Rh-null (Golden Blood)', 'Rare/Other'],
    },

    // ── Address ─────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    // ── Emergency Contact ───────────────────────────────────────────────────
    emergencyContact: {
      name:     { type: String, trim: true },
      phone:    { type: String },
      relation: { type: String, trim: true },
    },

    // ── KYC ────────────────────────────────────────────────────────────────
    kyc: { type: [kycSchema], default: [] },

    // ── Government / Insurance Schemes ──────────────────────────────────────
    governmentSchemes: { type: [governmentSchemeSchema], default: [] },

    // ── Medical History Timeline ─────────────────────────────────────────
    medicalTimeline: { type: [medicalTimelineSchema], default: [] },

    // ── Medicine History ─────────────────────────────────────────────────
    medicineHistory: { type: [medicineHistorySchema], default: [] },

    // ── Active Subscription ─────────────────────────────────────────────
    /**
     * Links to SubscriptionPlan. Family plans may cover multiple family members;
     * each member's CustomerProfile carries this reference.
     */
    activeSubscription: { type: activeSubscriptionSchema, default: null },

    // ── Family Members (for Family Plan) ───────────────────────────────────
    familyMembers: [
      {
        user:         { type: Schema.Types.ObjectId, ref: 'User' },
        relationship: { type: String, trim: true },
        addedAt:      { type: Date, default: Date.now },
      },
    ],

    // ── Quick Access Snapshot (for emergency / care assistants) ────────────
    snapshot: {
      chronicConditions: [{ type: String, trim: true }],
      allergies:         [{ type: String, trim: true }],
      vitals: {
        bloodPressure: { type: String },
        sugarLevel:    { type: String },
        heightCm:      { type: Number },
        weightKg:      { type: Number },
        lastUpdated:   { type: Date },
      },
      primaryLanguage: { type: String, default: 'English' },
    },

    // ── Preferences ────────────────────────────────────────────────────────
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Booking Stats ──────────────────────────────────────────────────────
    stats: {
      totalBookings:        { type: Number, default: 0 },
      totalConsultations:   { type: Number, default: 0 },
      totalTransportRides:  { type: Number, default: 0 },
      totalCareAssistUses:  { type: Number, default: 0 },
      totalDiagnosticTests: { type: Number, default: 0 },
      totalPharmacyOrders:  { type: Number, default: 0 },
      lastBookingAt:        { type: Date },
    },

    // ── Audit ──────────────────────────────────────────────────────────────
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

customerProfileSchema.virtual('age').get(function () {
  if (!this.dob) return null;
  const diff = Date.now() - new Date(this.dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

customerProfileSchema.virtual('isSubscribed').get(function () {
  return !!(
    this.activeSubscription?.isActive &&
    this.activeSubscription?.endDate > new Date()
  );
});

// ── Indexes ───────────────────────────────────────────────────────────────────
customerProfileSchema.index({ 'kyc.verificationStatus': 1 });
customerProfileSchema.index({ 'activeSubscription.planSlug': 1 });
customerProfileSchema.index({ 'activeSubscription.endDate': 1 });

const CustomerProfile = mongoose.model('CustomerProfile', customerProfileSchema);
export default CustomerProfile;