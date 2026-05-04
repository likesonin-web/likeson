import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD DONOR MODEL — Likeson.in
//
// Represents an individual blood donor. Two types:
//
//   registered   → Has a User account (role: 'customer' or 'blood_donor')
//                  user field set. Full profile, can be notified for urgent requests.
//
//   walk_in      → Donated at a camp/bank but not registered on platform.
//                  user = null. Minimal data. Can be converted to registered later.
//
// ELIGIBILITY RULES (India NACO / WHO guidelines):
//   - Age: 18–65 years
//   - Weight: ≥ 45 kg
//   - Hemoglobin: ≥ 12.5 g/dL (females), ≥ 13.0 g/dL (males)
//   - Interval between donations: ≥ 90 days (whole blood)
//   - Platelets (apheresis): ≥ 48 hours interval, max 24/year
//   - Must NOT have: HIV, Hepatitis B/C, Malaria (recent), Syphilis,
//     recent surgery, pregnancy, certain medications, high-risk behaviour
//
// TRACEABILITY:
//   BloodInventory.units[].donor → BloodDonor._id
//   BloodDonor.donations[] → references specific bag numbers
//   Full chain: Donor → Bag → Request → Patient (mandatory in India)
//
// VOLUNTEER DONOR POOL:
//   isVolunteerDonor = true → donor opted in for emergency SMS/WhatsApp alerts
//   System queries this pool when a blood type runs critically low.
// ─────────────────────────────────────────────────────────────────────────────

export const DONOR_TYPES = ['registered', 'walk_in'];

export const ELIGIBILITY_STATUSES = [
  'eligible',               // Can donate now
  'deferred_temporary',     // Cannot donate until nextEligibleDate
  'deferred_permanent',     // Cannot donate ever (serious medical condition)
  'under_review',           // Eligibility being assessed
  'not_assessed',           // Never assessed
];

export const DEFERRAL_REASONS = [
  'recent_donation',        // Donated within 90 days
  'low_hemoglobin',
  'low_weight',
  'recent_surgery',
  'recent_pregnancy',
  'recent_illness',
  'recent_travel_malaria_zone',
  'reactive_test',          // One of the 5 tests came back reactive
  'medications',            // On disqualifying medications
  'tattoo_piercing_recent', // Within 6 months
  'dental_procedure_recent',// Within 24 hours
  'high_risk_behaviour',
  'age_out_of_range',
  'chronic_disease',
  'permanent_medical_condition',
  'donor_request',          // Donor requested self-deferral
  'other',
];

export const DONATION_TYPES = [
  'Whole_Blood',        // Standard 450-500ml donation
  'Apheresis_Platelets',// Single donor platelets
  'Apheresis_Plasma',
  'Apheresis_PRBC',
  'Double_Red_Cell',    // 2 units PRBC via apheresis
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * donationRecordSchema — one completed donation event.
 * Linked to specific bag numbers in BloodInventory.
 */
const donationRecordSchema = new Schema(
  {
    donationCode:  { type: String, trim: true },  // internal reference
    bloodBank:     { type: Schema.Types.ObjectId, ref: 'BloodBank', required: true },
    bloodBankName: { type: String },              // denormalized for display
    donationType:  { type: String, enum: DONATION_TYPES, default: 'Whole_Blood' },

    donatedAt:     { type: Date, required: true },
    volumeMl:      { type: Number, required: true, min: 50, max: 500 },

    // Vitals at time of donation
    hemoglobinGdL: { type: Number, min: 0 },
    bloodPressure: { type: String },   // "120/80"
    pulseRate:     { type: Number },
    weightKg:      { type: Number },
    temperatureC:  { type: Number },

    // Bag numbers produced from this donation
    bagNumbers:    [{ type: String, uppercase: true, trim: true }],

    // Camp / event reference (if donation was at a camp)
    campId:        { type: Schema.Types.ObjectId, ref: 'BloodDonationCamp', default: null },

    // Certificate
    certificateUrl:{ type: String },
    certificateNo: { type: String },

    // Donor feedback / adverse reaction
    hadAdverseReaction: { type: Boolean, default: false },
    adverseReactionNote:{ type: String },

    staffName:     { type: String, trim: true },  // phlebotomist name
    notes:         { type: String },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

/**
 * medicalHistorySchema — donor's medical background affecting eligibility.
 * Sensitive data — stored with select: false where appropriate.
 */
const medicalHistorySchema = new Schema(
  {
    // Chronic conditions
    hasDiabetes:           { type: Boolean, default: false },
    hasHypertension:       { type: Boolean, default: false },
    hasHeartDisease:       { type: Boolean, default: false },
    hasAsthma:             { type: Boolean, default: false },
    hasBleedingDisorder:   { type: Boolean, default: false },
    hasAutoimmune:         { type: Boolean, default: false },
    hasHIV:                { type: Boolean, default: false, select: false },
    hasHepatitisB:         { type: Boolean, default: false, select: false },
    hasHepatitisC:         { type: Boolean, default: false, select: false },

    // Recent events
    recentSurgeryDate:     { type: Date },
    recentPregnancyDate:   { type: Date },   // last delivery / miscarriage
    recentTattooDate:      { type: Date },
    recentDentalDate:      { type: Date },
    recentTravelMalariaZone: { type: Boolean, default: false },
    recentTravelCountry:   { type: String },

    // Medications
    onMedications:         { type: Boolean, default: false },
    medications:           [{ type: String, trim: true }],

    // Allergies
    allergies:             [{ type: String, trim: true }],

    // Blood-borne infection history
    everTestedPositive:    { type: Boolean, default: false, select: false },
    testedPositiveFor:     [{ type: String }],

    // Self-reported risk
    highRiskBehaviour:     { type: Boolean, default: false, select: false },

    lastUpdatedAt:         { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * deferralSchema — record of a deferral event (temporary or permanent).
 */
const deferralSchema = new Schema(
  {
    deferralType:   { type: String, enum: ['temporary', 'permanent'], required: true },
    reason:         { type: String, enum: DEFERRAL_REASONS, required: true },
    reasonDetail:   { type: String },
    deferredAt:     { type: Date, default: Date.now },
    deferredUntil:  { type: Date },               // null for permanent
    deferredBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    bloodBank:      { type: Schema.Types.ObjectId, ref: 'BloodBank' },
    isLifted:       { type: Boolean, default: false },
    liftedAt:       { type: Date },
    liftedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

/**
 * kycSchema — donor identity verification.
 */
const donorKycSchema = new Schema(
  {
    aadhaarNumber:   { type: String, trim: true, match: [/^\d{12}$/, 'Invalid Aadhaar'], select: false },
    aadhaarLast4:    { type: String, maxlength: 4 },
    aadhaarFrontUrl: { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    panNumber:       { type: String, uppercase: true, trim: true, select: false },
    panCardUrl:      { type: String },
    panVerified:     { type: Boolean, default: false },

    // Blood group proof (lab report or previous donation card)
    bloodGroupProofUrl: { type: String },
    bloodGroupVerified: { type: Boolean, default: false },

    verificationStatus: {
      type:    String,
      enum:    ['not_submitted', 'pending', 'verified', 'rejected'],
      default: 'not_submitted',
    },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

/**
 * badgeSchema — donor achievement badges (gamification for retention).
 */
const donorBadgeSchema = new Schema(
  {
    badgeId: {
      type: String,
      enum: [
        'FIRST_DONATION',
        'DONATIONS_5',
        'DONATIONS_10',
        'DONATIONS_25',
        'DONATIONS_50',
        'LIFE_SAVER',        // donated for emergency request
        'RARE_BLOOD_HERO',   // O- or AB- donor
        'LOYAL_DONOR_1Y',
        'LOYAL_DONOR_5Y',
        'CAMP_VOLUNTEER',
        'PLATELET_DONOR',
        'PLASMA_DONOR',
      ],
    },
    name:        { type: String },
    earnedAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bloodDonorSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    donorCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
      comment:   'Format: BD-XXXXXXXX — auto-generated',
    },

    donorType: {
      type:    String,
      enum:    DONOR_TYPES,
      default: 'registered',
      index:   true,
    },

    /**
     * user → User._id (role: 'customer' or 'blood_donor').
     * null for walk_in donors not registered on platform.
     */
    user: {
      type:    Schema.Types.ObjectId,
      ref:     'User',
      default: null,
      unique:  true,
      sparse:  true,
      index:   true,
    },

    // ── Personal Details ──────────────────────────────────────────────────────
    fullName:    { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender:      { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    photoUrl:    { type: String },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone: {
      type:     String,
      required: true,
      match:    [/^[6-9]\d{9}$/, 'Invalid mobile'],
    },
    email:          { type: String, lowercase: true, trim: true },
    whatsappNumber: { type: String },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, required: true, trim: true },
      state:   { type: String, required: true, trim: true },
      pinCode: { type: String, trim: true },
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] },
    },

    // ── Blood Profile ─────────────────────────────────────────────────────────
    bloodGroup: {
      type:     String,
      required: true,
      enum:     ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index:    true,
    },

    rhType: {
      type: String,
      enum: ['Positive', 'Negative'],
    },

    /**
     * isRareBloodType — O- and AB- are rare and universally critical.
     * Flagged for priority alerts.
     */
    isRareBloodType: { type: Boolean, default: false },

    // ── Eligibility ───────────────────────────────────────────────────────────
    eligibilityStatus: {
      type:    String,
      enum:    ELIGIBILITY_STATUSES,
      default: 'not_assessed',
      index:   true,
    },

    /**
     * nextEligibleDate — when donor can donate again.
     * Auto-calculated: lastDonationDate + 90 days (whole blood).
     * For apheresis platelets: lastDonationDate + 2 days.
     */
    nextEligibleDate: {
      type:  Date,
      index: true,
    },

    lastDonationDate: { type: Date },
    lastEligibilityCheckAt: { type: Date },

    deferralHistory: {
      type:    [deferralSchema],
      default: [],
    },

    // ── Donation History ──────────────────────────────────────────────────────
    donations: {
      type:    [donationRecordSchema],
      default: [],
    },

    // Lifetime stats
    totalDonations:   { type: Number, default: 0, min: 0 },
    totalVolumeMl:    { type: Number, default: 0, min: 0 },
    lastDonatedAt:    { type: Date },

    /**
     * preferredBanks — blood banks donor prefers to donate at.
     * Used for routing donor notifications.
     */
    preferredBanks: [{ type: Schema.Types.ObjectId, ref: 'BloodBank' }],

    // ── Volunteer Settings ────────────────────────────────────────────────────
    /**
     * isVolunteerDonor — opted in for emergency SMS/WhatsApp alerts.
     * System notifies when their blood type is critically low nearby.
     */
    isVolunteerDonor:       { type: Boolean, default: false, index: true },
    volunteerRadiusKm:      { type: Number, default: 10, min: 1 },  // alert radius
    volunteerNotifVia: {
      sms:      { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      email:    { type: Boolean, default: false },
      push:     { type: Boolean, default: true },
    },
    lastAlertSentAt:        { type: Date },
    totalAlertsResponded:   { type: Number, default: 0 },

    // ── Medical History ───────────────────────────────────────────────────────
    medicalHistory: {
      type:    medicalHistorySchema,
      default: () => ({}),
      select:  false,   // never returned in default queries — must be explicitly selected
    },

    // Physical stats
    weightKg:         { type: Number, min: 0 },
    lastHemoglobin:   { type: Number, min: 0 },  // g/dL — from last donation

    // ── KYC ───────────────────────────────────────────────────────────────────
    kyc: { type: donorKycSchema, default: () => ({}) },

    // ── Gamification ─────────────────────────────────────────────────────────
    badges:        { type: [donorBadgeSchema], default: [] },
    coinsEarned:   { type: Number, default: 0 },   // platform coins for donations
    rewardPoints:  { type: Number, default: 0 },   // blood bank loyalty points

    // ── Registration Channel ──────────────────────────────────────────────────
    registeredAt:    { type: Date, default: Date.now },
    registeredVia: {
      type: String,
      enum: ['app', 'website', 'camp_walk_in', 'blood_bank_desk', 'referral'],
      default: 'app',
    },

    referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive:   { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false },   // KYC verified
    isBlocked:  { type: Boolean, default: false },
    blockReason:{ type: String },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Internal ──────────────────────────────────────────────────────────────
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

// ── Virtuals ──────────────────────────────────────────────────────────────────

bloodDonorSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  return Math.floor((Date.now() - new Date(this.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25));
});

bloodDonorSchema.virtual('isEligibleNow').get(function () {
  if (this.eligibilityStatus !== 'eligible') return false;
  if (this.nextEligibleDate && this.nextEligibleDate > new Date()) return false;
  return true;
});

bloodDonorSchema.virtual('daysUntilEligible').get(function () {
  if (!this.nextEligibleDate) return 0;
  const diff = this.nextEligibleDate - new Date();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
});

bloodDonorSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

bloodDonorSchema.virtual('activeDeferral').get(function () {
  return this.deferralHistory?.find(d => !d.isLifted) ?? null;
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

bloodDonorSchema.pre('validate', function () {
  // Age check: 18–65
  if (this.dateOfBirth) {
    const age = Math.floor((Date.now() - new Date(this.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25));
    if (this.isNew && (age < 18 || age > 65)) {
      // Don't throw — just set eligibility status
      this.eligibilityStatus = 'deferred_temporary';
    }
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

bloodDonorSchema.pre('save', async function () {
  // Auto-generate donorCode
  if (this.isNew && !this.donorCode) {
    const { customAlphabet } = await import('nanoid');
    const gen = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);
    let code, exists;
    do {
      code   = `BD-${gen()}`;
      exists = await mongoose.model('BloodDonor').exists({ donorCode: code });
    } while (exists);
    this.donorCode = code;
  }

  // Mask Aadhaar
  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  // Auto-flag rare blood type
  if (this.isModified('bloodGroup')) {
    this.isRareBloodType = ['O-', 'AB-'].includes(this.bloodGroup);
  }

  // Sync KYC isVerified
  if (this.isModified('kyc.verificationStatus')) {
    this.isVerified = this.kyc.verificationStatus === 'verified';
  }

  // Update donation stats when donations array changes
  if (this.isModified('donations')) {
    this.totalDonations = this.donations.length;
    this.totalVolumeMl  = this.donations.reduce((sum, d) => sum + (d.volumeMl ?? 0), 0);
    const sorted = [...this.donations].sort((a, b) => new Date(b.donatedAt) - new Date(a.donatedAt));
    if (sorted.length > 0) {
      this.lastDonatedAt   = sorted[0].donatedAt;
      this.lastDonationDate = sorted[0].donatedAt;

      // Auto-calculate nextEligibleDate = last donation + 90 days (whole blood)
      const lastType = sorted[0].donationType ?? 'Whole_Blood';
      const intervalDays = lastType === 'Apheresis_Platelets' ? 2 : 90;
      const next = new Date(sorted[0].donatedAt);
      next.setDate(next.getDate() + intervalDays);
      this.nextEligibleDate = next;

      // Update eligibility
      this.eligibilityStatus = next > new Date() ? 'deferred_temporary' : 'eligible';
    }
  }

  // Award badges based on donation count
  if (this.isModified('totalDonations')) {
    const count     = this.totalDonations;
    const badgeMap  = { 1: 'FIRST_DONATION', 5: 'DONATIONS_5', 10: 'DONATIONS_10', 25: 'DONATIONS_25', 50: 'DONATIONS_50' };
    const badgeId   = badgeMap[count];
    if (badgeId && !this.badges.some(b => b.badgeId === badgeId)) {
      this.badges.push({ badgeId, name: badgeId.replace(/_/g, ' '), earnedAt: new Date() });
    }
    if (this.isRareBloodType && count >= 1 && !this.badges.some(b => b.badgeId === 'RARE_BLOOD_HERO')) {
      this.badges.push({ badgeId: 'RARE_BLOOD_HERO', name: 'Rare Blood Hero', earnedAt: new Date() });
    }
  }
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * findEligibleVolunteers — find volunteer donors matching blood group near a location.
 * Used for emergency shortage notifications.
 */
bloodDonorSchema.statics.findEligibleVolunteers = function ({
  bloodGroup,
  lng,
  lat,
  radiusMeters = 15000,
  limit = 50,
}) {
  const now = new Date();
  return this.find({
    bloodGroup,
    isVolunteerDonor: true,
    isActive:         true,
    isBlocked:        false,
    eligibilityStatus: 'eligible',
    $or: [
      { nextEligibleDate: null },
      { nextEligibleDate: { $lte: now } },
    ],
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusMeters,
      },
    },
  })
    .select('fullName phone whatsappNumber bloodGroup volunteerNotifVia lastAlertSentAt donorCode')
    .limit(limit);
};

// ── Indexes ───────────────────────────────────────────────────────────────────

bloodDonorSchema.index({ location: '2dsphere' });
bloodDonorSchema.index({ bloodGroup: 1, eligibilityStatus: 1 });
bloodDonorSchema.index({ bloodGroup: 1, isVolunteerDonor: 1 });
bloodDonorSchema.index({ bloodGroup: 1, location: '2dsphere' });
bloodDonorSchema.index({ nextEligibleDate: 1 });
bloodDonorSchema.index({ isVolunteerDonor: 1, bloodGroup: 1, isActive: 1 });
bloodDonorSchema.index({ 'donations.bloodBank': 1 });
bloodDonorSchema.index({ 'donations.donatedAt': -1 });
bloodDonorSchema.index({ createdAt: -1 });

const BloodDonor = mongoose.model('BloodDonor', bloodDonorSchema);
export default BloodDonor;
