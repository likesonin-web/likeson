import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * SoloDriverPartner Model — Likeson.in
 *
 * Self-employed driver: owns their own vehicle, no parent agency, IS the
 * settling entity (own PartnerWallet, partnerRole='solodriverpartner').
 *
 * VEHICLE — lives in standalone `Vehicle` collection now (ownerType=
 * 'SoloDriverPartner', ownerId=this._id), not embedded. `vehicleStatus`
 * below is a small read cache synced by Vehicle.post-save — NOT the
 * source of truth. Use getVehicle() for the live doc.
 *
 * MONEY — no embedded earnings/settlement block. PartnerWallet (keyed off
 * `user`, partnerRole='solodriverpartner') is the only source of truth.
 *
 * §1 Sub-schemas  §2 Main schema  §3 Virtuals  §4 Pre-save  §5 Methods  §6 Indexes
 */

// ── §1  Sub-Schemas ───────────────────────────────────────────────────────────

/** CONFIG, not balance — mirrors TransportPartner.platformFeeOverride. Keep. */
const partnerPlatformFeeSchema = new Schema(
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

const soloKycSchema = new Schema(
  {
    aadhaarNumber: {
      type:   String,
      trim:   true,
      match:  [/^\d{12}$/, 'Aadhaar must be 12 digits'],
      select: false,
    },
    aadhaarLast4:    { type: String, maxlength: 4 },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    drivingLicenceNumber: {
      type:      String,
      required:  [true, 'Driving licence number is required'],
      uppercase: true,
      trim:      true,
    },
    drivingLicenceExpiry: {
      type:     Date,
      required: [true, 'DL expiry date is required'],
    },
    drivingLicenceDocUrl: { type: String },
    licenceClass:         [{ type: String, trim: true }],

    psvBadgeNumber: { type: String, uppercase: true, trim: true },
    psvBadgeExpiry: { type: Date },
    psvBadgeDocUrl: { type: String },

    panNumber: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
      select:    false,
    },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },

    verificationStatus: {
      type:    String,
      enum:    ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'],
      default: 'not-submitted',
    },
    isVerified:      { type: Boolean, default: false },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    submittedAt:     { type: Date },
  },
  { _id: false }
);

/** Record-keeping only — payout source is PartnerWallet, not this. */
const soloBankSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
    ifscCode: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'],
    },
    bankName:    { type: String, trim: true },
    upiId:       { type: String, trim: true },
    upiName:     { type: String, trim: true },
    accountType: {
      type:    String,
      enum:    ['Savings', 'Current'],
      default: 'Savings',
    },
    isVerified:         { type: Boolean, default: false },
    cancelledChequeUrl: { type: String },
    verifiedAt:         { type: Date },
    verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const soloMedicalFitnessSchema = new Schema(
  {
    certificateNumber: { type: String, trim: true },
    issuedBy:          { type: String, trim: true },
    issuedAt:          { type: Date },
    expiryDate:        { type: Date },
    documentUrl:       { type: String },
    bloodGroup: {
      type:    String,
      enum:    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
      default: 'Unknown',
    },
    isValid: { type: Boolean, default: false },
  },
  { _id: false }
);

const pricingSchema = new Schema(
  {
    baseFare:              { type: Number, default: 0   },
    baseFarePerKm:         { type: Number, default: 0   },
    minimumFare:           { type: Number, default: 500 },
    waitingChargePerMin:   { type: Number, default: 2   },
    freeWaitingMinutes:    { type: Number, default: 10  },
    nightSurchargePercent: { type: Number, default: 20  },
    wheelchairSurcharge:   { type: Number, default: 100 },
    currency:              { type: String, default: 'INR' },
  },
  { _id: false }
);

const serviceZoneSchema = new Schema(
  {
    city:     { type: String, required: true, trim: true },
    state:    { type: String, required: true, trim: true },
    pinCodes: [{ type: String }],
    radiusKm: { type: Number, default: 15 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalRides:    { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * vehicleStatus — read cache only, synced by Vehicle.post-save hook.
 * Replaces the old embedded `vehicle` object. For full vehicle data
 * (docs, photos, GPS) always query the Vehicle collection directly.
 */
const vehicleStatusSchema = new Schema(
  {
    hasVehicle:         { type: Boolean, default: false },
    registrationNumber: { type: String },
    verificationStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'verified', 'rejected'],
      default: 'pending',
    },
    isActive:  { type: Boolean, default: false },
    syncedAt:  { type: Date },
  },
  { _id: false }
);

// ── §2  Main Schema ───────────────────────────────────────────────────────────

const soloDriverPartnerSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User reference is required'],
      unique:   true,
      index:    true,
    },

    /**
     * driverProfile — companion Driver doc for dispatch (geo queries,
     * status enum) shared with agency drivers. Created via
     * createDriverProfile() once onboarding completes — see §5.
     */
    driverProfile: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
      index:   true,
    },

    // ── Personal Details ──────────────────────────────────────────────────────
    partnerCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },

    legalName:       { type: String, required: true, trim: true },
    displayName:     { type: String, trim: true },
    dateOfBirth:     { type: Date },
    gender:          { type: String, enum: ['Male', 'Female', 'Other', 'Prefer Not to Say'] },
    profilePhotoUrl: { type: String },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone: {
      type:     String,
      required: [true, 'Phone number is required'],
      match:    [/^[6-9]\d{9}$/, 'Invalid mobile number'],
    },
    altPhone:       { type: String },
    whatsappNumber: { type: String },
    email:          { type: String, lowercase: true, trim: true },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, required: true, trim: true },
      state:   { type: String, required: true, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    // ── Business / Tax Details ────────────────────────────────────────────────
    businessType: {
      type:    String,
      enum:    ['individual', 'proprietorship'],
      default: 'individual',
    },
    tradeName:       { type: String, trim: true },
    gstNumber:       { type: String, uppercase: true, sparse: true },
    panNumber:       { type: String, uppercase: true, select: false },
    msmeUdyamNumber: { type: String, sparse: true },

    // ── KYC ───────────────────────────────────────────────────────────────────
    kyc: {
      type:     soloKycSchema,
      required: true,
      default:  () => ({}),
    },

    // ── Medical Fitness ───────────────────────────────────────────────────────
    medicalFitness: { type: soloMedicalFitnessSchema, default: () => ({}) },

    // ── Professional ──────────────────────────────────────────────────────────
    yearsOfExperience:      { type: Number, default: 0, min: 0, max: 60 },
    hasMedicalTransportExp: { type: Boolean, default: false },
    hasAmbulanceExp:        { type: Boolean, default: false },
    languagesSpoken: [
      {
        type: String,
        enum: ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Other'],
      },
    ],
    trainingCertificates: [
      {
        name:        { type: String, trim: true, required: true },
        issuedBy:    { type: String, trim: true },
        issuedAt:    { type: Date },
        expiresAt:   { type: Date },
        documentUrl: { type: String },
      },
    ],
    bio: { type: String, maxlength: 500 },

    // ── Vehicle ───────────────────────────────────────────────────────────────
    // Live data in standalone `Vehicle` collection (ownerType='SoloDriverPartner').
    // vehicleStatus is a synced read cache only — see vehicleStatusSchema above.
    vehicleStatus: { type: vehicleStatusSchema, default: () => ({}) },

    // ── Service Zones & Pricing ───────────────────────────────────────────────
    serviceZones: { type: [serviceZoneSchema], default: [] },
    pricing: { type: pricingSchema, default: () => ({}) },

    // ── Platform Fee Override (config — keep, not money state) ───────────────
    platformFeeOverride: {
      type:    partnerPlatformFeeSchema,
      default: null,
    },

    // ── Settlement ────────────────────────────────────────────────────────────
    settlementCycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
      default: 'Weekly',
    },

    // ── Bank Details (KYC / payment-method data, NOT settlement state) ────────
    bankDetails: { type: soloBankSchema, default: () => ({}) },

    razorpayContactId:     { type: String, select: false },
    razorpayFundAccountId: { type: String, select: false },

    // ── Availability ──────────────────────────────────────────────────────────
    isAvailable: { type: Boolean, default: false },
    availabilityHours: {
      start: { type: String, default: '06:00' },
      end:   { type: String, default: '22:00' },
    },

    // ── Emergency Contact ─────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone:        { type: String },
    },

    // ── Rating & Performance ──────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    stats: {
      totalRidesCompleted:      { type: Number, default: 0 },
      totalRidesCancelled:      { type: Number, default: 0 },
      totalRidesDisputed:       { type: Number, default: 0 },
      // Analytics cache — re-derive from PartnerWalletTransaction /
      // BookingPartnerAllocation. PartnerWallet/PartnerSettlement are
      // the real source of truth, never hand-incremented here.
      totalEarnings:            { type: Number, default: 0 },
      totalPlatformFeePaid:     { type: Number, default: 0 },
      averagePickupTimeMinutes: { type: Number, default: 0 },
      onTimeArrivalRate:        { type: Number, default: 100, min: 0, max: 100 },
      lastRideAt:               { type: Date },
    },

    // ── Partnership Status ────────────────────────────────────────────────────
    partnershipStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'active', 'suspended', 'rejected'],
      default: 'pending',
      index:   true,
    },
    isOnboardingComplete: { type: Boolean, default: false },
    partnerSince:         { type: Date },
    contractUrl:          { type: String },

    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },

    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifications: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    adminNotes:    { type: String, maxlength: 1000, select: false },
    tags:          [{ type: String, trim: true, lowercase: true }],
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── §3  Virtuals ──────────────────────────────────────────────────────────────

soloDriverPartnerSchema.virtual('hasActiveVehicle').get(function () {
  return (
    this.vehicleStatus?.verificationStatus === 'verified' &&
    this.vehicleStatus?.isActive === true
  );
});

soloDriverPartnerSchema.virtual('isDispatchReady').get(function () {
  return (
    this.partnershipStatus === 'active' &&
    this.isAvailable &&
    this.isOnboardingComplete &&
    this.hasActiveVehicle &&
    !!this.driverProfile
  );
});

soloDriverPartnerSchema.virtual('isKycComplete').get(function () {
  return this.kyc?.verificationStatus === 'verified';
});

soloDriverPartnerSchema.virtual('hasExpiringCompliance').get(function () {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return (
    (this.kyc?.drivingLicenceExpiry  && this.kyc.drivingLicenceExpiry  < soon) ||
    (this.kyc?.psvBadgeExpiry        && this.kyc.psvBadgeExpiry        < soon) ||
    (this.medicalFitness?.expiryDate && this.medicalFitness.expiryDate < soon)
    // Vehicle document expiries (insurance/pollution/fitness/permit) now
    // live on the Vehicle doc — check via getVehicle().hasExpiringDocs
    // (virtual on Vehicle model) rather than here.
  );
});

soloDriverPartnerSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

soloDriverPartnerSchema.virtual('effectivePlatformFee').get(function () {
  return this.platformFeeOverride ?? null;
});

// ── §4  Pre-save Middleware ───────────────────────────────────────────────────

soloDriverPartnerSchema.pre('save', async function () {
  if (!this.partnerCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-2).toUpperCase();
    this.partnerCode = `LKS-SDP-${ts}${rand}`;
  }

  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  if (this.isModified('kyc.verificationStatus')) {
    this.kyc.isVerified = this.kyc.verificationStatus === 'verified';
    if (this.kyc.isVerified && !this.kyc.submittedAt) {
      this.kyc.submittedAt = new Date();
    }
  }

  if (
    this.isModified('kyc.drivingLicenceNumber') &&
    this.kyc?.drivingLicenceNumber &&
    !this.kyc.submittedAt
  ) {
    this.kyc.submittedAt = new Date();
  }

  if (this.isModified('platformFeeOverride') && this.platformFeeOverride) {
    const { type, value } = this.platformFeeOverride;
    if (type === 'percentage' && (value < 0 || value > 100)) {
      throw new Error('platformFeeOverride.value must be 0–100 for percentage type');
    }
    if (type === 'fixed' && value < 0) {
      throw new Error('platformFeeOverride.value must be ≥ 0 for fixed type');
    }
  }

  // Onboarding complete check — vehicleStatus is the synced cache
  // (kept current by Vehicle.post-save), safe to read directly here.
  if (
    this.legalName &&
    this.phone &&
    this.vehicleStatus?.hasVehicle &&
    this.vehicleStatus?.verificationStatus === 'verified' &&
    this.bankDetails?.accountNumber &&
    this.serviceZones?.length > 0 &&
    this.kyc?.drivingLicenceNumber
  ) {
    this.isOnboardingComplete = true;
  }

  if (this.isModified()) {
    const checks = [
      this.legalName,
      this.dateOfBirth,
      this.phone,
      this.profilePhotoUrl,
      this.address?.city,
      this.kyc?.aadhaarNumber,
      this.kyc?.drivingLicenceNumber,
      this.kyc?.drivingLicenceDocUrl,
      this.kyc?.isVerified,
      this.medicalFitness?.certificateNumber,
      this.vehicleStatus?.hasVehicle,
      this.bankDetails?.accountNumber,
      this.emergencyContact?.phone,
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }
});

// ── §5  Instance Methods ──────────────────────────────────────────────────────

/** Live Vehicle doc (source of truth — vehicleStatus is just a cache). */
soloDriverPartnerSchema.methods.getVehicle = function () {
  return mongoose.model('Vehicle').findOne({ ownerType: 'SoloDriverPartner', ownerId: this._id });
};

soloDriverPartnerSchema.methods.getWallet = function () {
  if (!this.user) return null;
  return mongoose.model('PartnerWallet').findOne({ partner: this.user, partnerRole: 'solodriverpartner' });
};

soloDriverPartnerSchema.methods.getPendingSettlements = function () {
  if (!this.user) return [];
  return mongoose.model('PartnerSettlement').find({ partnerId: this.user, settlementStatus: 'PENDING' });
};

soloDriverPartnerSchema.methods.getOpenLiabilities = function () {
  if (!this.user) return [];
  return mongoose.model('PartnerCollectionLiability').find({
    partner: this.user,
    status: { $in: ['OPEN', 'PARTIALLY_RECOVERED'] },
  });
};

/**
 * createDriverProfile — was referenced in comments on the old schema but
 * never implemented. Call once onboarding completes (isOnboardingComplete
 * flips true) so the dispatch engine can geo-query this solo partner
 * identically to agency drivers via the Driver collection.
 * Idempotent — returns existing Driver if driverProfile already set.
 */
soloDriverPartnerSchema.methods.createDriverProfile = async function () {
  if (this.driverProfile) {
    return mongoose.model('Driver').findById(this.driverProfile);
  }
  if (!this.isOnboardingComplete) {
    throw new Error('Cannot create driver profile before onboarding is complete');
  }

  const vehicle = await this.getVehicle();

  const Driver = mongoose.model('Driver');
  const driver = await Driver.create({
    user:        this.user,
    soloPartner: this._id,
    legalName:   this.legalName,
    dateOfBirth: this.dateOfBirth,
    gender:      this.gender,
    photoUrl:    this.profilePhotoUrl,
    phone:       this.phone,
    altPhone:    this.altPhone,
    whatsappNumber: this.whatsappNumber,
    email:       this.email,
    yearsOfExperience:      this.yearsOfExperience,
    languagesSpoken:        this.languagesSpoken,
    hasMedicalTransportExp: this.hasMedicalTransportExp,
    hasAmbulanceExp:        this.hasAmbulanceExp,
    kyc: {
      aadhaarNumber:         undefined, // not re-readable (select:false) — sync via service layer if needed
      drivingLicenceNumber:  this.kyc.drivingLicenceNumber,
      drivingLicenceExpiry:  this.kyc.drivingLicenceExpiry,
      drivingLicenceDocUrl:  this.kyc.drivingLicenceDocUrl,
      psvBadgeNumber:        this.kyc.psvBadgeNumber,
      psvBadgeExpiry:        this.kyc.psvBadgeExpiry,
      verificationStatus:    this.kyc.verificationStatus === 'verified' ? 'Verified' : 'Pending',
    },
    emergencyContact: this.emergencyContact,
  });

  if (vehicle) {
    await driver.assignVehicle(vehicle._id);
  }

  this.driverProfile = driver._id;
  await this.save();
  return driver;
};

// ── §6  Indexes ───────────────────────────────────────────────────────────────

soloDriverPartnerSchema.index({ partnershipStatus: 1, isAvailable: 1 });
soloDriverPartnerSchema.index({ 'serviceZones.city': 1, 'serviceZones.state': 1 });
soloDriverPartnerSchema.index({ 'kyc.verificationStatus': 1 });
soloDriverPartnerSchema.index({ 'kyc.drivingLicenceExpiry': 1 });
soloDriverPartnerSchema.index({ 'medicalFitness.expiryDate': 1 });

const SoloDriverPartner = mongoose.model('SoloDriverPartner', soloDriverPartnerSchema);
export default SoloDriverPartner;