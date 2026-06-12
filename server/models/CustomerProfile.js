import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

const imageSchema = new Schema({
  url:       { type: String, required: true },
  publicId:  { type: String },
  uploadedAt:{ type: Date, default: Date.now },
}, { _id: true });

// ─── KYC ──────────────────────────────────────────────────────────────────────

const kycSchema = new Schema({
  type: {
    type: String,
    enum: ['Aadhaar','PAN','VoterID','Driving License','Passport','NREGA Job Card'],
    required: true,
  },
  documentNumber:     { type: String },
  holderName:         { type: String, trim: true },
  documentUrl:        { type: String },
  backSideUrl:        { type: String },
  verificationStatus: {
    type: String,
    enum: ['Pending','In-Review','Verified','Rejected'],
    default: 'Pending',
  },
  rejectionReason:    { type: String },
  verifiedAt:         { type: Date },
  verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

// ─── GOVERNMENT SCHEME ────────────────────────────────────────────────────────

const governmentSchemeSchema = new Schema({
  schemeName: {
    type: String,
    enum: [
      'Ayushman Bharat (PM-JAY)', 'Central Government Health Scheme (CGHS)',
      'Employees State Insurance (ESI)', 'Dr. YSR Aarogyasri (Andhra Pradesh)',
      'Mahatma Jyotiba Phule Jan Arogya Yojana', 'Biju Swasthya Kalyan Yojana',
      'Karunya Health Scheme', 'Tamil Nadu CMCHIS', 'Swasthya Sathi',
      'Aam Aadmi Bima Yojana', 'Rashtriya Swasthya Bima Yojana (RSBY)',
      'Other State Scheme',
    ],
  },
  beneficiaryId: { type: String },
  holderName:    { type: String, trim: true },
  documentUrl:   { type: String },
  isVerified:    { type: Boolean, default: false },
  verifiedAt:    { type: Date },
  verifiedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: true });

// ─── PRIVATE INSURANCE (NEW) ──────────────────────────────────────────────────

const privateInsuranceSchema = new Schema({
  insurerName:    { type: String, trim: true, required: true }, // "Star Health", "Niva Bupa"
  policyNumber:   { type: String, trim: true },
  tpaName:        { type: String, trim: true },                 // Third Party Administrator
  holderName:     { type: String, trim: true },
  sumInsured:     { type: Number },                             // INR
  validFrom:      { type: Date },
  validTo:        { type: Date },
  cardUrl:        { type: String },                             // uploaded insurance card
  isVerified:     { type: Boolean, default: false },
  verifiedAt:     { type: Date },
  verifiedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: true });

// ─── MEDICAL TIMELINE ─────────────────────────────────────────────────────────

const medicalTimelineSchema = new Schema({
  date:         { type: Date, default: Date.now },
  eventTitle:   { type: String, required: true, trim: true },
  hospitalName: { type: String, trim: true },
  description:  { type: String },
  doctorName:   { type: String, trim: true },
  reportUrls:   [{ type: String }],
}, { _id: true });

// ─── MEDICINE HISTORY ─────────────────────────────────────────────────────────

const medicineHistorySchema = new Schema({
  medicineName:      { type: String, required: true, trim: true },
  dosage:            { type: String, trim: true },
  frequency:         { type: String, trim: true },
  startDate:         { type: Date },
  endDate:           { type: Date },
  isOngoing:         { type: Boolean, default: true },
  prescribingDoctor: { type: String, trim: true },
  instructions:      { type: String },
}, { _id: true });

// ─── SUBSCRIPTION HISTORY (NEW — replaces single activeSubscription) ──────────

const subscriptionEntrySchema = new Schema({
  plan:        { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  planSlug:    { type: String },
  planName:    { type: String },                // snapshot
  startDate:   { type: Date },
  endDate:     { type: Date },
  isActive:    { type: Boolean, default: true },
  autoRenew:   { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancelReason:{ type: String },
  /**
   * Family plan: role tells if this user is primary holder or a dependent.
   * primaryHolder ref enables dependent to trace back to plan owner.
   */
  role:            { type: String, enum: ['primary', 'dependent'], default: 'primary' },
  primaryHolder:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

// ─── FAMILY MEMBER ────────────────────────────────────────────────────────────

const familyMemberSchema = new Schema({
  user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  relationship: { type: String, trim: true },     // "Spouse", "Son", "Father"
  addedAt:      { type: Date, default: Date.now },
  /**
   * isPrimary = true means THIS profile is primary holder.
   * Dependent profiles have their own CustomerProfile with role=dependent.
   */
}, { _id: true });

// ─── CONSENT FLAGS (NEW) ──────────────────────────────────────────────────────

const consentSchema = new Schema({
  telemedicineConsent:  { type: Boolean, default: false },
  dataSharingConsent:   { type: Boolean, default: false },  // share with labs/partners
  marketingConsent:     { type: Boolean, default: false },
  recordingConsent:     { type: Boolean, default: false },  // call/video recording
  consentVersion:       { type: String },                   // "v2.1" — track policy version
  consentGivenAt:       { type: Date },
  consentUpdatedAt:     { type: Date },
}, { _id: false });

// ─── MAIN SCHEMA ──────────────────────────────────────────────────────────────

const customerProfileSchema = new Schema(
  {
    // ── Account link ────────────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId, ref: 'User',
      required: true, unique: true, index: true,
    },

    // ── Personal ────────────────────────────────────────────────────────────
    gender: {
      type: String,
      enum: ['Male','Female','Transgender','Other','Prefer not to say'],
    },
    dob:        { type: Date },
    bloodGroup: {
      type: String,
      enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-',
             'Bombay Phenotype (hh)','Rh-null (Golden Blood)','Rare/Other'],
    },
    preferredLanguage: { type: String, default: 'English' }, // top-level, not buried in snapshot

    // ── Address ─────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
      coords:  {                                  // optional GPS for ride/CA dispatch
        lat: { type: Number },
        lng: { type: Number },
      },
    },

    // ── Emergency Contact ───────────────────────────────────────────────────
    emergencyContact: {
      name:     { type: String, trim: true },
      phone:    { type: String },
      relation: { type: String, trim: true },
    },

    // ── KYC ─────────────────────────────────────────────────────────────────
    kyc: { type: [kycSchema], default: [] },

    // ── Insurance & Schemes ─────────────────────────────────────────────────
    governmentSchemes:  { type: [governmentSchemeSchema],  default: [] },
    privateInsurances:  { type: [privateInsuranceSchema],  default: [] },  // NEW

    // ── Medical History ─────────────────────────────────────────────────────
    medicalTimeline: { type: [medicalTimelineSchema],  default: [] },
    medicineHistory: { type: [medicineHistorySchema],  default: [] },
    chronicConditions: [{ type: String, trim: true }],   // promoted from snapshot
    allergies:         [{ type: String, trim: true }],   // promoted from snapshot

    // ── Care Team (NEW) ─────────────────────────────────────────────────────
    /**
     * Patient's preferred / assigned doctors and care managers.
     * Allows quick-dial and pre-fill during booking.
     */
    careTeam: [
      {
        provider:   { type: Schema.Types.ObjectId, ref: 'User' },
        role:       { type: String, enum: ['doctor','care_manager','physiotherapist','dietitian','other'] },
        speciality: { type: String, trim: true },
        isPrimary:  { type: Boolean, default: false },
        addedAt:    { type: Date, default: Date.now },
      },
    ],

    // ── Subscription History (replaces activeSubscription) ──────────────────
    /**
     * Full history. activeSubscription computed via virtual.
     * Supports family plan: dependents have role=dependent + primaryHolder ref.
     */
    subscriptions: { type: [subscriptionEntrySchema], default: [] },

    // ── Family Members ──────────────────────────────────────────────────────
    familyMembers: { type: [familyMemberSchema], default: [] },

    // ── Consent (NEW) ───────────────────────────────────────────────────────
    consent: { type: consentSchema, default: () => ({}) },

    // ── Vitals Snapshot (read from PatientCareRecord via virtual) ────────────
    /**
     * ONLY store last-known baseline. NOT a log.
     * Source of truth for emergency card. Updated when CA records vitals.
     * Full log lives in PatientCareRecord.vitalsLog.
     */
    vitalsBaseline: {
      bloodPressure:   { type: String },
      pulseRate:       { type: Number },
      temperature:     { type: Number },
      spO2:            { type: Number },
      bloodSugar:      { type: Number },
      weightKg:        { type: Number },
      heightCm:        { type: Number },
      lastUpdated:     { type: Date },
    },

    // ── Preferences ─────────────────────────────────────────────────────────
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Booking Stats ────────────────────────────────────────────────────────
    stats: {
      totalBookings:        { type: Number, default: 0 },
      totalConsultations:   { type: Number, default: 0 },
      totalTransportRides:  { type: Number, default: 0 },
      totalCareAssistUses:  { type: Number, default: 0 },
      totalDiagnosticTests: { type: Number, default: 0 },
      totalPharmacyOrders:  { type: Number, default: 0 },
      lastBookingAt:        { type: Date },
      lastActiveAt:         { type: Date },                // NEW — tracks app activity
    },

    // ── Audit ────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:  { virtuals: true },
    toObject:{ virtuals: true },
  }
);

// ─── VIRTUALS ─────────────────────────────────────────────────────────────────

customerProfileSchema.virtual('age').get(function () {
  if (!this.dob) return null;
  return Math.floor((Date.now() - new Date(this.dob)) / (1000 * 60 * 60 * 24 * 365.25));
});

// Active subscription = most recent entry where isActive=true and not expired
customerProfileSchema.virtual('activeSubscription').get(function () {
  if (!this.subscriptions?.length) return null;
  const now = new Date();
  return (
    this.subscriptions
      .filter(s => s.isActive && s.endDate > now)
      .sort((a, b) => b.startDate - a.startDate)[0] ?? null
  );
});

customerProfileSchema.virtual('isSubscribed').get(function () {
  return !!this.activeSubscription;
});

// Virtual populate: all PatientCareRecords for this user
customerProfileSchema.virtual('careRecords', {
  ref:         'PatientCareRecord',
  localField:  'user',
  foreignField:'patient',
  justOne:     false,
});

// ─── INDEXES ──────────────────────────────────────────────────────────────────

customerProfileSchema.index({ 'kyc.verificationStatus': 1 });
customerProfileSchema.index({ 'subscriptions.planSlug': 1 });
customerProfileSchema.index({ 'subscriptions.endDate': 1 });
customerProfileSchema.index({ 'subscriptions.isActive': 1 });
customerProfileSchema.index({ 'privateInsurances.policyNumber': 1 });
customerProfileSchema.index({ 'careTeam.provider': 1 });

const CustomerProfile = mongoose.model('CustomerProfile', customerProfileSchema);
export default CustomerProfile;