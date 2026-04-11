import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * SoloDriverPartner Model — Likeson.in
 *
 * Represents a self-employed driver who:
 *   1. Owns and operates their OWN vehicle (no parent agency).
 *   2. Has a User account with role: 'solodriverpartner'.
 *   3. Is BOTH the business entity AND the driver — so this model
 *      embeds vehicle details AND driver KYC/operational fields.
 *
 * Key distinctions from the other two models:
 *   - TransportPartner  → agency that employs/contracts multiple drivers
 *   - Driver            → employee/contractor under a TransportPartner
 *   - SoloDriverPartner → self-employed, one vehicle, no sub-drivers
 *
 * Platform Fee (replaces commissionOverridePercent):
 *   By default, the platform fee applied to this partner's rides is read
 *   from PlatformPricingConfig.transport.platformFee.
 *   An admin can override it per-partner using platformFeeOverride, which
 *   mirrors the { type: 'fixed'|'percentage', value: Number } shape used
 *   throughout PlatformPricingConfig.  null = use global config.
 *
 * SECTIONS
 *  §1  Sub-schemas (vehicle, kyc, bank, medical fitness)
 *  §2  Main schema
 *  §3  Virtuals
 *  §4  Pre-save middleware
 *  §5  Indexes
 */

// ── §1  Sub-Schemas ───────────────────────────────────────────────────────────

/**
 * Mirrors platformFeeSchema in PlatformPricingConfig.
 * Kept as a local sub-schema so the SoloDriverPartner collection is
 * self-contained and does not require a join to read the override value.
 */
const partnerPlatformFeeSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ['fixed', 'percentage'],
      required: true,
    },
    /**
     * If type === 'percentage' → value is 0–100 (e.g. 15 means 15 %).
     * If type === 'fixed'      → value is an amount in INR (e.g. 50 means ₹50 flat).
     */
    value: {
      type:     Number,
      required: true,
      min:      0,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embedded vehicle — a solo partner owns exactly ONE vehicle.
 * Mirrors the vehicleSchema in TransportPartner but is singular, not an array.
 */
const soloVehicleSchema = new Schema(
  {
    vehicleCode:        { type: String, uppercase: true, trim: true },
    registrationNumber: {
      type:      String,
      required:  [true, 'Vehicle registration number is required'],
      uppercase: true,
      trim:      true,
    },
    make:  { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year:  { type: Number },
    color: { type: String, trim: true },

    vehicleType: {
      type:     String,
      required: true,
      enum:     [
        'Sedan', 'SUV', 'Van', 'Minivan', 'Wheelchair-Van',
        'Tempo-Traveller', 'Hatchback', 'Auto',
      ],
    },
    seatingCapacity: { type: Number, default: 4, min: 1 },

    // Medical / Accessibility features
    isWheelchairAccessible: { type: Boolean, default: false },
    hasStretcherSupport:    { type: Boolean, default: false },
    hasOxygenSupport:       { type: Boolean, default: false },
    hasMedicalKit:          { type: Boolean, default: false },
    hasAC:                  { type: Boolean, default: true  },

    // Vehicle Documents
    rcBookUrl:           { type: String },
    insurancePolicyUrl:  { type: String },
    insuranceExpiry:     { type: Date },
    pollutionCertUrl:    { type: String },
    pollutionCertExpiry: { type: Date },
    fitnessCertUrl:      { type: String },
    fitnessCertExpiry:   { type: Date },
    permitType: {
      type: String,
      enum: ['Commercial', 'Tourist', 'Private', 'Contract Carriage'],
    },
    permitExpiry: { type: Date },

    photos: [{ type: String }],

    // GPS / Live location
    gpsDeviceId:           { type: String },
    lastKnownLocation: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] }, // [lng, lat]
    },
    lastLocationUpdatedAt: { type: Date },

    // Verification
    verificationStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    isActive:        { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

soloVehicleSchema.index({ lastKnownLocation: '2dsphere' });

// ─────────────────────────────────────────────────────────────────────────────

const soloKycSchema = new Schema(
  {
    // Aadhaar
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

    // Driving Licence — required for a solo driver-partner
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

    // PSV Badge (Public Service Vehicle) — required for commercial operation
    psvBadgeNumber: { type: String, uppercase: true, trim: true },
    psvBadgeExpiry: { type: Date },
    psvBadgeDocUrl: { type: String },

    // PAN
    panNumber: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
      select:    false,
    },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },

    // KYC workflow status
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

// ─────────────────────────────────────────────────────────────────────────────

const soloBankSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
    accountLast4:      { type: String, maxlength: 4 },
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

// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Partner's own ride-pricing preferences.
 * These are ADDITIVE to the platform base fare from PlatformPricingConfig.
 * The actual fare billed to the customer = platform base + partner surcharges.
 */
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

// ── §2  Main Schema ───────────────────────────────────────────────────────────

const soloDriverPartnerSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────

    /**
     * Linked User account (role: 'solodriverpartner').
     * The User.profile virtual resolves to this document for that role.
     */
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User reference is required'],
      unique:   true,
      index:    true,
    },

    /**
     * After onboarding is complete, a companion Driver document is created
     * so the dispatch engine can treat SoloDriverPartner and agency Driver
     * records identically (same geospatial queries, same status enum, etc.).
     *
     * This is the _id of that Driver document.
     * null = Driver doc not yet created (onboarding in progress).
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
    vehicle: { type: soloVehicleSchema, default: () => ({}) },

    // ── Service Zones & Pricing ───────────────────────────────────────────────
    serviceZones: { type: [serviceZoneSchema], default: [] },

    /**
     * Partner's own surcharge preferences.
     * NOTE: These are partner-side fare components, not the platform fee.
     * The platform fee is in platformFeeOverride (or global config).
     */
    pricing: { type: pricingSchema, default: () => ({}) },

    // ── Platform Fee Override ─────────────────────────────────────────────────
    /**
     * Per-partner platform fee override.
     *
     * null (default) → use PlatformPricingConfig.transport.platformFee
     * set by admin   → overrides the global config for this partner only
     *
     * Shape mirrors PlatformPricingConfig.platformFeeSchema:
     *   { type: 'percentage', value: 12 }   → 12% of ride fare
     *   { type: 'fixed',      value: 40 }   → ₹40 flat per ride
     *
     * Access pattern in fare calculation:
     *   const fee = partner.platformFeeOverride ?? globalConfig.transport.platformFee;
     */
    platformFeeOverride: {
      type:    partnerPlatformFeeSchema,
      default: null,
    },

    // ── Settlement ────────────────────────────────────────────────────────────
    /**
     * How often the partner is paid out.
     * Mirrors PlatformPricingConfig terminology; no "commission" reference.
     */
    settlementCycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
      default: 'Weekly',
    },

    // ── Bank Details ──────────────────────────────────────────────────────────
    bankDetails: { type: soloBankSchema, default: () => ({}) },

    settlement: {
      preferredMethod: {
        type:    String,
        enum:    ['Bank Transfer', 'UPI'],
        default: 'Bank Transfer',
      },
      pendingAmount: { type: Number, default: 0, min: 0 },
      totalSettled:  { type: Number, default: 0, min: 0 },
      lastSettledAt: { type: Date },
    },

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
      totalEarnings:            { type: Number, default: 0 },
      /**
       * Renamed from totalCommissionPaid → totalPlatformFeePaid
       * to align with PlatformPricingConfig terminology.
       */
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

/** True when vehicle is verified and active */
soloDriverPartnerSchema.virtual('hasActiveVehicle').get(function () {
  return (
    this.vehicle?.verificationStatus === 'verified' &&
    this.vehicle?.isActive === true
  );
});

/** True when all conditions are met to accept rides */
soloDriverPartnerSchema.virtual('isDispatchReady').get(function () {
  return (
    this.partnershipStatus === 'active' &&
    this.isAvailable &&
    this.isOnboardingComplete &&
    this.hasActiveVehicle &&
    !!this.driverProfile
  );
});

/** True when KYC is admin-approved */
soloDriverPartnerSchema.virtual('isKycComplete').get(function () {
  return this.kyc?.verificationStatus === 'verified';
});

/** True when any compliance document expires within 30 days */
soloDriverPartnerSchema.virtual('hasExpiringCompliance').get(function () {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return (
    (this.kyc?.drivingLicenceExpiry    && this.kyc.drivingLicenceExpiry    < soon) ||
    (this.kyc?.psvBadgeExpiry          && this.kyc.psvBadgeExpiry          < soon) ||
    (this.medicalFitness?.expiryDate   && this.medicalFitness.expiryDate   < soon) ||
    (this.vehicle?.insuranceExpiry     && this.vehicle.insuranceExpiry     < soon) ||
    (this.vehicle?.pollutionCertExpiry && this.vehicle.pollutionCertExpiry < soon) ||
    (this.vehicle?.fitnessCertExpiry   && this.vehicle.fitnessCertExpiry   < soon) ||
    (this.vehicle?.permitExpiry        && this.vehicle.permitExpiry        < soon)
  );
});

/** Masked Aadhaar display */
soloDriverPartnerSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

/**
 * Resolves the effective platform fee for this partner.
 *
 * Returns platformFeeOverride when set, otherwise returns null to signal
 * that the caller must fall back to PlatformPricingConfig.transport.platformFee.
 *
 * Usage in fare calculation:
 *   const effectiveFee = partner.effectivePlatformFee
 *     ?? (await PlatformPricingConfig.getGlobal()).transport.platformFee;
 */
soloDriverPartnerSchema.virtual('effectivePlatformFee').get(function () {
  return this.platformFeeOverride ?? null;
});

// ── §4  Pre-save Middleware ───────────────────────────────────────────────────

soloDriverPartnerSchema.pre('save', async function () {
  // Auto-generate unique partner code
  if (!this.partnerCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-2).toUpperCase();
    this.partnerCode = `LKS-SDP-${ts}${rand}`;
  }

  // Auto-generate vehicle code from registration number
  if (this.isModified('vehicle.registrationNumber') && this.vehicle?.registrationNumber) {
    if (!this.vehicle.vehicleCode) {
      this.vehicle.vehicleCode = `VH-${this.vehicle.registrationNumber}`;
    }
  }

  // Mask Aadhaar — keep only last 4 digits
  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  // Mask bank account — keep only last 4 digits
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  // Sync KYC isVerified flag from verificationStatus
  if (this.isModified('kyc.verificationStatus')) {
    this.kyc.isVerified = this.kyc.verificationStatus === 'verified';
    if (this.kyc.isVerified && !this.kyc.submittedAt) {
      this.kyc.submittedAt = new Date();
    }
  }

  // Record KYC submission date when DL number is first provided
  if (
    this.isModified('kyc.drivingLicenceNumber') &&
    this.kyc?.drivingLicenceNumber &&
    !this.kyc.submittedAt
  ) {
    this.kyc.submittedAt = new Date();
  }

  // Validate platformFeeOverride when set
  if (this.isModified('platformFeeOverride') && this.platformFeeOverride) {
    const { type, value } = this.platformFeeOverride;
    if (type === 'percentage' && (value < 0 || value > 100)) {
      throw new Error('platformFeeOverride.value must be 0–100 for percentage type');
    }
    if (type === 'fixed' && value < 0) {
      throw new Error('platformFeeOverride.value must be ≥ 0 for fixed type');
    }
  }

  // Auto-mark onboarding complete when all required fields are present
  if (
    this.legalName &&
    this.phone &&
    this.vehicle?.registrationNumber &&
    this.vehicle?.verificationStatus === 'verified' &&
    this.bankDetails?.accountNumber &&
    this.serviceZones?.length > 0 &&
    this.kyc?.drivingLicenceNumber
  ) {
    this.isOnboardingComplete = true;
  }

  // Recalculate profile completion percentage
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
      this.vehicle?.registrationNumber,
      this.vehicle?.rcBookUrl,
      this.bankDetails?.accountNumber,
      this.emergencyContact?.phone,
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }
});

// ── §5  Indexes ───────────────────────────────────────────────────────────────

soloDriverPartnerSchema.index({ partnershipStatus: 1, isAvailable: 1 });
soloDriverPartnerSchema.index({ 'serviceZones.city': 1, 'serviceZones.state': 1 });
soloDriverPartnerSchema.index({ 'vehicle.registrationNumber': 1 }, { sparse: true });
// soloDriverPartnerSchema.index({ 'vehicle.lastKnownLocation': '2dsphere' });
soloDriverPartnerSchema.index({ 'kyc.verificationStatus': 1 });
soloDriverPartnerSchema.index({ 'kyc.drivingLicenceExpiry': 1 });
soloDriverPartnerSchema.index({ 'medicalFitness.expiryDate': 1 });
// soloDriverPartnerSchema.index({ driverProfile: 1 });
// soloDriverPartnerSchema.index({ user: 1 }, { unique: true });
// soloDriverPartnerSchema.index({ partnerCode: 1 });

const SoloDriverPartner = mongoose.model('SoloDriverPartner', soloDriverPartnerSchema);
export default SoloDriverPartner;