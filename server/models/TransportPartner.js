import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * TransportPartner Model — Likeson.in
 *
 * Represents the transport agency / business entity that owns vehicles and
 * employs / contracts drivers.
 *
 * CHANGES (latest):
 *  1. commissionOverridePercent removed — replaced by platformFeeOverride
 *     using the same { type, value } shape as PlatformPricingConfig.
 *     null = fall back to PlatformPricingConfig.transport.platformFee.
 *  2. vehicleType enum expanded to cover every category from two-wheelers
 *     to heavy commercial vehicles.
 *  3. vehicles[] remains an embedded array on TransportPartner.
 *  4. All other corrections from the previous version retained.
 */

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * platformFeeOverrideSchema
 * Mirrors PlatformPricingConfig → platformFeeSchema exactly.
 * type: 'fixed'      → value is a flat INR amount deducted per ride
 * type: 'percentage' → value is a % of ride fare
 */
const platformFeeOverrideSchema = new Schema(
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

const vehicleSchema = new Schema(
  {
    vehicleCode: { type: String, uppercase: true, trim: true },

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

    /**
     * vehicleType — covers the full spectrum from two-wheelers to heavy
     * commercial / specialised vehicles used in patient transport.
     *
     * Two-wheelers
     *   Bike            – standard motorcycle / scooter (medicine delivery, escort)
     *   Scooter         – step-through scooter
     *
     * Three-wheelers
     *   Auto            – CNG / electric auto-rickshaw
     *   E-Rickshaw      – battery electric rickshaw
     *
     * Four-wheelers — personal / taxi
     *   Hatchback       – compact car (Swift, i20 …)
     *   Sedan           – standard saloon (Dzire, Amaze …)
     *   SUV             – mid/full-size SUV (Ertiga, Innova, Scorpio …)
     *   MUV             – multi-utility vehicle (Marazzo, Lodgy …)
     *   Crossover       – compact crossover (Brezza, Nexon …)
     *
     * Vans / Minibuses
     *   Van             – cargo / passenger van (Eeco, Omni, Bolero Pickup …)
     *   Minivan         – 7–9 seater people carrier
     *   Tempo-Traveller – 10–14 seater force / Traveller
     *   Minibus         – 15–26 seater mini bus
     *
     * Specialised / Accessibility
     *   Wheelchair-Van      – van modified with ramp/lift for wheelchairs
     
     *   Mortuary-Van        – hearse / mortuary vehicle
     *
     * Heavy / Commercial
     *   Bus             – 27+ seater full-size bus
     *   Truck           – goods truck (may be used for equipment transport)
     *   Pickup          – open / closed pickup truck
     */
    vehicleType: {
      type:     String,
      required: true,
      enum: [
        // Two-wheelers
        'Bike',
        'Scooter',

        // Three-wheelers
        'Auto',
        'E-Rickshaw',

        // Four-wheelers — personal / taxi
        'Hatchback',
        'Sedan',
        'SUV',
        'MUV',
        'Crossover',

        // Vans / Minibuses
        'Van',
        'Minivan',
        'Tempo-Traveller',
        'Minibus',

        // Specialised / Accessibility
        'Wheelchair-Van',
        'Mortuary-Van',

        // Heavy / Commercial
        'Bus',
        'Truck',
        'Pickup',
      ],
    },

    seatingCapacity: { type: Number, default: 4, min: 1 },

    // ── Medical / Accessibility ───────────────────────────────────────────
    isWheelchairAccessible: { type: Boolean, default: false },
    hasStretcherSupport:    { type: Boolean, default: false },
    hasOxygenSupport:       { type: Boolean, default: false },
    hasMedicalKit:          { type: Boolean, default: false },
    hasAC:                  { type: Boolean, default: true  },

    // ── Documents ─────────────────────────────────────────────────────────
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

    // ── GPS / Live Location ───────────────────────────────────────────────
    gpsDeviceId: { type: String },
    lastKnownLocation: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] }, // [lng, lat]
    },
    lastLocationUpdatedAt: { type: Date },

    // ── Assignment ────────────────────────────────────────────────────────
    assignedDriver: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
    },

    // ── Status & Verification ─────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    verificationStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
  },
  { _id: true, timestamps: true }
);

vehicleSchema.index({ lastKnownLocation: '2dsphere' });

// ─────────────────────────────────────────────────────────────────────────────

const bankAccountSchema = new Schema(
  {
    accountHolderName:  { type: String, trim: true, required: true },
    accountNumber:      { type: String, trim: true, required: true, select: false },
    accountLast4:       { type: String, maxlength: 4 },
    ifscCode: {
      type:      String,
      trim:      true,
      uppercase: true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'],
    },
    bankName:           { type: String, trim: true },
    branchName:         { type: String, trim: true },
    accountType:        { type: String, enum: ['Savings', 'Current', 'OD'], default: 'Current' },
    isPrimary:          { type: Boolean, default: false },
    isVerified:         { type: Boolean, default: false },
    cancelledChequeUrl: { type: String },
    verifiedAt:         { type: Date },
    verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const upiSchema = new Schema(
  {
    upiId:      { type: String, trim: true },
    upiName:    { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    isPrimary:  { type: Boolean, default: false },
  },
  { _id: true }
);

const gatewayAccountSchema = new Schema(
  {
    provider: {
      type:     String,
      enum:     ['Razorpay', 'Cashfree', 'PayU', 'Stripe', 'PhonePe Business'],
      required: true,
    },
    accountId:     { type: String, trim: true },
    isActive:      { type: Boolean, default: true },
    linkedAt:      { type: Date, default: Date.now },
    webhookSecret: { type: String, select: false },
  },
  { _id: true }
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

const pricingSchema = new Schema(
  {
    baseFare:              { type: Number, default: 0 },
    baseFarePerKm:         { type: Number, default: 0 },
    minimumFare:           { type: Number, default: 500 },
    waitingChargePerMin:   { type: Number, default: 2 },
    freeWaitingMinutes:    { type: Number, default: 10 },
    nightSurchargePercent: { type: Number, default: 20 },
    wheelchairSurcharge:   { type: Number, default: 100 },
    currency:              { type: String, default: 'INR' },
  },
  { _id: false }
);

/**
 * fleetInfo — denormalised counters written by Driver.post('save') hook.
 */
const fleetInfoSchema = new Schema(
  {
    totalVehicles:  { type: Number, default: 0 },
    activeVehicles: { type: Number, default: 0 },
    totalDrivers:   { type: Number, default: 0 },
    activeDrivers:  { type: Number, default: 0 },
  },
  { _id: false }
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
 * ownerKycSchema — replaces the removed TransportPartnerProfile collection.
 */
const ownerKycSchema = new Schema(
  {
    fullName:    { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    },
    profilePhotoUrl: { type: String },

    address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    aadhaarNumber:   { type: String, select: false },
    aadhaarLast4:    { type: String, maxlength: 4 },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    panNumber:   { type: String, uppercase: true, select: false },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },

    drivingLicenseNumber: { type: String, sparse: true },
    drivingLicenseUrl:    { type: String },
    drivingLicenseExpiry: { type: Date },

    kycStatus: {
      type:    String,
      enum:    ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'],
      default: 'not-submitted',
    },
    kycVerifiedAt:      { type: Date },
    kycVerifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    kycRejectionReason: { type: String },

    emergencyContact: {
      name:         { type: String, trim: true },
      phone:        { type: String },
      relationship: { type: String, trim: true },
    },

    yearsOfExperience: { type: Number, default: 0 },
    languagesSpoken:   [{ type: String, trim: true }],
    bio:               { type: String, maxlength: 500 },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const transportPartnerSchema = new Schema(
  {
    // ── Business Details ──────────────────────────────────────────────────
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    businessType: {
      type:    String,
      enum:    ['individual', 'proprietorship', 'partnership', 'pvt-ltd', 'ltd', 'llp'],
      default: 'proprietorship',
    },
    ownerName:  { type: String, required: true, trim: true },
    ownerPhone: { type: String, required: true },
    ownerEmail: { type: String, lowercase: true, trim: true },

    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // ── Owner KYC (embedded — replaces TransportPartnerProfile) ──────────
    ownerKyc: { type: ownerKycSchema, default: () => ({}) },

    // ── Registered Address ────────────────────────────────────────────────
    registeredAddress: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    // ── Legal / Tax ───────────────────────────────────────────────────────
    gstNumber:       { type: String, uppercase: true, sparse: true },
    panNumber:       { type: String, uppercase: true, select: false },
    msmeUdyamNumber: { type: String, sparse: true },

    // ── Business Documents ────────────────────────────────────────────────
    tradeLicenseUrl:    { type: String },
    tradeLicenseExpiry: { type: Date },
    gstCertificateUrl:  { type: String },
    panCardUrl:         { type: String, select: false },

    // ── Fleet ─────────────────────────────────────────────────────────────
    /**
     * Embedded vehicle array — each element uses vehicleSchema above,
     * which now covers the full vehicle-type spectrum.
     */
    vehicles: { type: [vehicleSchema], default: [] },

    drivers: [{ type: Schema.Types.ObjectId, ref: 'Driver' }],

    fleetInfo: { type: fleetInfoSchema, default: () => ({}) },

    // ── Service Zones & Pricing ───────────────────────────────────────────
    serviceZones: { type: [serviceZoneSchema], default: [] },
    pricing:      { type: pricingSchema, default: () => ({}) },

    // ── Platform Fee Override ─────────────────────────────────────────────
    /**
     * platformFeeOverride
     *
     * When set, this partner's rides use this fee instead of the global
     * PlatformPricingConfig.transport.platformFee.
     *
     * null (default) → use PlatformPricingConfig.transport.platformFee.
     *
     * Examples:
     *   { type: 'percentage', value: 12 }  →  12 % of ride fare
     *   { type: 'fixed',      value: 30  } →  ₹ 30 flat per ride
     *
     * Enforced in the ride-fare calculation service; not validated here
     * beyond the sub-schema constraints.
     */
    platformFeeOverride: {
      type:    platformFeeOverrideSchema,
      default: null,
    },

    settlementCycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
      default: 'Weekly',
    },

    // ── Bank Details ──────────────────────────────────────────────────────
    bankDetails: {
      bankAccounts: { type: [bankAccountSchema], default: [] },
      upiHandles:   { type: [upiSchema], default: [] },
      gatewayAccounts: { type: [gatewayAccountSchema], default: [] },
      preferredSettlementMethod: {
        type:    String,
        enum:    ['Bank Transfer', 'UPI', 'Cheque'],
        default: 'Bank Transfer',
      },
      pendingSettlementAmount: { type: Number, default: 0, min: 0 },
      totalSettledAmount:      { type: Number, default: 0, min: 0 },
      lastSettledAt:           { type: Date },
    },

    // ── Availability ──────────────────────────────────────────────────────
    isAvailable: { type: Boolean, default: true },
    availabilityHours: {
      start: { type: String, default: '06:00' },
      end:   { type: String, default: '22:00' },
    },

    // ── Rating & Performance ──────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    stats: {
      totalRidesCompleted:      { type: Number, default: 0 },
      totalRidesCancelled:      { type: Number, default: 0 },
      totalRidesDisputed:       { type: Number, default: 0 },
      totalEarnings:            { type: Number, default: 0 },
      totalPlatformFeePaid:     { type: Number, default: 0 }, // renamed from totalCommissionPaid
      averagePickupTimeMinutes: { type: Number, default: 0 },
      onTimeArrivalRate:        { type: Number, default: 100, min: 0, max: 100 },
      lastRideAt:               { type: Date },
    },

    // ── Partnership & Onboarding ──────────────────────────────────────────
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

    // ── Notification Preferences ──────────────────────────────────────────
    notifications: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Internal ─────────────────────────────────────────────────────────
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

transportPartnerSchema.virtual('totalVehicles').get(function () {
  return this.vehicles?.length ?? 0;
});

transportPartnerSchema.virtual('activeVehicles').get(function () {
  return this.vehicles?.filter(v => v.verificationStatus === 'verified' && v.isActive).length ?? 0;
});

transportPartnerSchema.virtual('wheelchairVehicles').get(function () {
  return this.vehicles?.filter(
    v => v.isWheelchairAccessible && v.verificationStatus === 'verified'
  ).length ?? 0;
});

transportPartnerSchema.virtual('isDispatchReady').get(function () {
  return (
    this.partnershipStatus === 'active' &&
    this.isAvailable &&
    this.isOnboardingComplete &&
    this.activeVehicles > 0
  );
});

transportPartnerSchema.virtual('isOwnerKycComplete').get(function () {
  return this.ownerKyc?.kycStatus === 'verified';
});

transportPartnerSchema.virtual('ownerAge').get(function () {
  if (!this.ownerKyc?.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.ownerKyc.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

/**
 * effectivePlatformFee virtual
 *
 * Returns the partner-level override if set, otherwise returns null
 * (caller should then read PlatformPricingConfig.transport.platformFee).
 */
transportPartnerSchema.virtual('effectivePlatformFee').get(function () {
  return this.platformFeeOverride ?? null;
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

transportPartnerSchema.pre('save', function () {
  // Auto-generate slug from businessName on creation
  if (this.isNew && !this.slug && this.businessName) {
    this.slug = this.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Auto-generate vehicleCode and sync fleetInfo vehicle counters
  if (this.isModified('vehicles')) {
    this.vehicles.forEach(v => {
      if (!v.vehicleCode) v.vehicleCode = `VH-${v.registrationNumber}`;
    });
    this.fleetInfo.totalVehicles  = this.vehicles.length;
    this.fleetInfo.activeVehicles = this.vehicles.filter(v => v.isActive).length;
  }

  // Mask bank account numbers — store only last 4 digits
  if (this.isModified('bankDetails.bankAccounts')) {
    this.bankDetails.bankAccounts.forEach(acc => {
      if (acc.accountNumber && !acc.accountLast4) {
        acc.accountLast4 = acc.accountNumber.slice(-4);
      }
    });
  }

  // Mask owner Aadhaar — store only last 4 digits
  if (this.isModified('ownerKyc.aadhaarNumber') && this.ownerKyc?.aadhaarNumber) {
    this.ownerKyc.aadhaarLast4 = this.ownerKyc.aadhaarNumber.slice(-4);
  }

  // Auto-mark onboarding complete when required fields are present
  if (
    this.businessName &&
    this.ownerPhone &&
    this.vehicles?.length > 0 &&
    this.bankDetails?.bankAccounts?.some(a => a.isPrimary) &&
    this.serviceZones?.length > 0
  ) {
    this.isOnboardingComplete = true;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

transportPartnerSchema.index({ partnershipStatus: 1, isAvailable: 1 });
transportPartnerSchema.index({ 'serviceZones.city': 1, 'serviceZones.state': 1 });
transportPartnerSchema.index({ 'vehicles.registrationNumber': 1 }, { sparse: true });
// transportPartnerSchema.index({ 'vehicles.lastKnownLocation': '2dsphere' });
// transportPartnerSchema.index({ gstNumber: 1 }, { sparse: true });
// transportPartnerSchema.index({ user: 1 });
// transportPartnerSchema.index({ 'ownerKyc.kycStatus': 1 });

const TransportPartner = mongoose.model('TransportPartner', transportPartnerSchema);
export default TransportPartner;