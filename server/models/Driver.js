import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Driver Model — Likeson.in
 *
 * Represents an individual driver. Two types of drivers exist on the platform:
 *
 *   Type A — Agency driver
 *     ownerAgency  = ObjectId of a TransportPartner
 *     soloPartner  = null
 *     The driver is employed / contracted by a transport agency.
 *
 *   Type B — Solo driver-partner
 *     ownerAgency  = null
 *     soloPartner  = ObjectId of a SoloDriverPartner
 *     The driver owns their own vehicle. A SoloDriverPartner document
 *     holds business/vehicle/KYC data; this Driver document handles
 *     dispatch (live location, status, ride assignment, rewards, etc.).
 *
 * Either ownerAgency OR soloPartner must be set — not both, not neither.
 * This is enforced by the pre-save hook below.
 *
 * Vehicle data:
 *   - Agency drivers: vehicle lives inside TransportPartner.vehicles[].
 *     assignedVehicleId stores the embedded sub-doc _id.
 *     assignedVehicleSnapshot caches key fields for display.
 *   - Solo drivers: vehicle lives inside SoloDriverPartner.vehicle.
 *     assignedVehicleId is null (vehicle is implicit from soloPartner).
 *     assignedVehicleSnapshot is still populated for uniform dispatch reads.
 *
 * SECTIONS
 *  §1  Sub-schemas
 *  §2  Badges & coins system
 *  §3  Main schema
 *  §4  Indexes
 *  §5  Virtuals
 *  §6  Pre-save middleware
 *  §7  Post-save hook — sync agency fleet counters (agency drivers only)
 *  §8  Instance methods
 *  §9  Statics
 */

// ── §1  Sub-Schemas ───────────────────────────────────────────────────────────

const driverKycSchema = new Schema(
  {
    aadhaarNumber: {
      type:     String,
      required: [true, 'Aadhaar number is required'],
      trim:     true,
      match:    [/^\d{12}$/, 'Aadhaar must be 12 digits'],
      select:   false,
    },
    aadhaarLast4:  { type: String, maxlength: 4 },
    aadhaarDocUrl: { type: String },

    drivingLicenceNumber: {
      type:      String,
      required:  [true, 'Driving licence is required'],
      uppercase: true,
      trim:      true,
    },
    drivingLicenceExpiry: { type: Date, required: [true, 'DL expiry is required'] },
    drivingLicenceDocUrl: { type: String },
    licenceClass:         [{ type: String, trim: true }],

    psvBadgeNumber: { type: String, uppercase: true, trim: true },
    psvBadgeExpiry: { type: Date },
    psvBadgeDocUrl: { type: String },

    panNumber: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN'],
    },
    panDocUrl: { type: String },

    verificationStatus: {
      type:    String,
      enum:    ['Pending', 'Under-Review', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:      { type: Date },
    rejectionReason: { type: String },
    submittedAt:     { type: Date },
    isVerified:      { type: Boolean, default: false },
  },
  { _id: false }
);

const medicalFitnessSchema = new Schema(
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

const driverBankSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
    accountLast4:      { type: String, maxlength: 4 },
    ifscCode: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'],
    },
    bankName:       { type: String, trim: true },
    upiId:          { type: String, trim: true },
    isBankVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

// ── §2  Badges & Coins System ─────────────────────────────────────────────────

const driverBadgeSchema = new Schema(
  {
    badgeId: {
      type: String,
      enum: [
        'FIRST_RIDE', 'RIDES_10', 'RIDES_50', 'RIDES_100', 'RIDES_500',
        'RIDES_1000', 'TOP_RATED', 'PERFECT_WEEK', 'SPEED_KING',
        'ZERO_CANCEL_MONTH', 'SAFE_DRIVER', 'NIGHT_OWL', 'LONG_HAUL',
        'VERIFIED_DRIVER', 'LOYAL_DRIVER_1Y', 'LOYAL_DRIVER_2Y', 'EARLY_ADOPTER',
        'SOLO_PARTNER',  // badge exclusive to solo driver-partners
      ],
      required: true,
    },
    name:        { type: String, required: true },
    description: { type: String },
    iconUrl:     { type: String },
    earnedAt:    { type: Date, default: Date.now },
    isActive:    { type: Boolean, default: true },
  },
  { _id: true }
);

const driverCoinTxnSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ['EARN', 'REDEEM', 'EXPIRE', 'BONUS', 'ADMIN_CREDIT', 'ADMIN_DEBIT'],
      required: true,
    },
    amount:      { type: Number, required: true, min: 0 },
    balance:     { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceModel: {
      type:    String,
      enum:    ['Ride', 'Redemption', null],
      default: null,
    },
    expiresAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const driverRewardSchema = new Schema(
  {
    coinBalance:      { type: Number, default: 0, min: 0 },
    totalCoinsEarned: { type: Number, default: 0, min: 0 },
    totalCoinsRedeem: { type: Number, default: 0, min: 0 },
    coinTransactions: [driverCoinTxnSchema],
    badges:           [driverBadgeSchema],
    tier: {
      type:    String,
      enum:    ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      default: 'Bronze',
    },
    tierUpdatedAt:       { type: Date },
    coinsPerRide:        { type: Number, default: 5 },
    bonusCoinsThisMonth: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── §3  Main Schema ───────────────────────────────────────────────────────────

const driverSchema = new Schema(
  {
    // ── Identity / Ownership ──────────────────────────────────────────────────

    /**
     * Linked User account (role: 'driver' for agency drivers,
     * 'solodriverpartner' for solo drivers).
     */
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User reference is required'],
      unique:   true,
      index:    true,
    },

    /**
     * TYPE A — Agency driver.
     * The TransportPartner (agency) that employs / contracts this driver.
     * null for solo driver-partners.
     */
    ownerAgency: {
      type:    Schema.Types.ObjectId,
      ref:     'TransportPartner',
      default: null,
      index:   true,
    },

    /**
     * TYPE B — Solo driver-partner.
     * The SoloDriverPartner document that owns the vehicle and holds KYC/
     * business details for this self-employed driver.
     * null for agency drivers.
     *
     * NOTE: Exactly one of { ownerAgency, soloPartner } must be non-null.
     *       Enforced in pre-save hook (§6).
     */
    soloPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'SoloDriverPartner',
      default: null,
      index:   true,
    },

    /**
     * The _id of an embedded vehicle sub-document inside
     * TransportPartner.vehicles (agency drivers only).
     * null for solo drivers — their vehicle lives in SoloDriverPartner.vehicle.
     */
    assignedVehicleId: {
      type:    Schema.Types.ObjectId,
      default: null,
      index:   true,
    },

    /**
     * Denormalised vehicle snapshot — populated regardless of driver type.
     * For agency drivers: synced from TransportPartner.vehicles.
     * For solo drivers:   synced from SoloDriverPartner.vehicle.
     * Use for display / dispatch; do not rely on for document verification.
     */
    assignedVehicleSnapshot: {
      vehicleCode:        { type: String },
      registrationNumber: { type: String },
      make:               { type: String },
      model:              { type: String },
      vehicleType:        { type: String },
      color:              { type: String },
    },

    // ── Personal ──────────────────────────────────────────────────────────────
    driverCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },
    legalName:   { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender:      { type: String, enum: ['Male', 'Female', 'Other', 'Prefer Not to Say'] },
    photoUrl:    { type: String },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone:          { type: String, match: [/^[6-9]\d{9}$/, 'Invalid mobile'] },
    altPhone:       { type: String },
    whatsappNumber: { type: String },
    email:          { type: String, lowercase: true, trim: true },

    // ── Professional ──────────────────────────────────────────────────────────
    yearsOfExperience:      { type: Number, default: 0, min: 0, max: 60 },
    languagesSpoken: [
      {
        type: String,
        enum: ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Other'],
      },
    ],
    hasMedicalTransportExp: { type: Boolean, default: false },
    hasAmbulanceExp:        { type: Boolean, default: false },
    trainingCertificates: [
      {
        name:        { type: String, trim: true, required: true },
        issuedBy:    { type: String, trim: true },
        issuedAt:    { type: Date },
        expiresAt:   { type: Date },
        documentUrl: { type: String },
      },
    ],

    // ── KYC ───────────────────────────────────────────────────────────────────
    kyc: { type: driverKycSchema, required: true },

    // ── Medical Fitness ───────────────────────────────────────────────────────
    medicalFitness: { type: medicalFitnessSchema, default: () => ({}) },

    // ── Bank ──────────────────────────────────────────────────────────────────
    bankDetails: { type: driverBankSchema, default: () => ({}) },

    // ── Emergency Contact ─────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone:        { type: String, match: [/^[6-9]\d{9}$/, 'Invalid mobile'] },
    },

    // ── Shift / Availability ──────────────────────────────────────────────────
    shift: {
      shiftType: {
        type:    String,
        enum:    ['Morning', 'Afternoon', 'Evening', 'Night', 'Full-Day', 'On-Call'],
        default: 'Full-Day',
      },
      startTime:       { type: String, default: '08:00' },
      endTime:         { type: String, default: '20:00' },
      daysAvailable:   [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
      isAvailableNow:  { type: Boolean, default: false },
      nextAvailableAt: { type: Date },
    },

    // ── Live Location ─────────────────────────────────────────────────────────
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] },
      heading:     { type: Number, min: 0, max: 360 },
      speedKmh:    { type: Number, min: 0 },
      updatedAt:   { type: Date, default: Date.now },
    },

    // ── Performance ───────────────────────────────────────────────────────────
    performance: {
      rating:               { type: Number, default: 0, min: 0, max: 5 },
      ratingCount:          { type: Number, default: 0 },
      totalRidesCompleted:  { type: Number, default: 0 },
      totalRidesCancelled:  { type: Number, default: 0 },
      cancellationRate:     { type: Number, default: 0 },
      avgPickupTimeMinutes: { type: Number, default: 0 },
      totalDistanceKm:      { type: Number, default: 0 },
      totalEarnings:        { type: Number, default: 0 },
      monthlyRides:         { type: Number, default: 0 },
      lastRideAt:           { type: Date },
      performanceTier: {
        type:    String,
        enum:    ['Platinum', 'Gold', 'Silver', 'Bronze', 'Probation'],
        default: 'Bronze',
      },
      warningCount:     { type: Number, default: 0 },
      complaintsCount:  { type: Number, default: 0 },
      complimentsCount: { type: Number, default: 0 },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['Available', 'On-Trip', 'Offline', 'On-Break', 'Suspended'],
      default: 'Offline',
      index:   true,
    },
    isActive:    { type: Boolean, default: false },
    isVerified:  { type: Boolean, default: false },
    isBlocked:   { type: Boolean, default: false },
    blockReason: { type: String },
    isPaused:    { type: Boolean, default: false },
    pauseReason: { type: String },
    pausedUntil: { type: Date },

    currentRide: { type: Schema.Types.ObjectId, ref: 'Ride', default: null },

    // ── Rewards ───────────────────────────────────────────────────────────────
    rewards: { type: driverRewardSchema, default: () => ({}) },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: {
      step:            { type: Number,  default: 1 },
      isComplete:      { type: Boolean, default: false },
      completedAt:     { type: Date },
      agreedToTermsAt: { type: Date },
      agreedToTermsIp: { type: String },
    },

    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifPrefs: {
      smsAlerts:         { type: Boolean, default: true },
      whatsappAlerts:    { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },

    adminNotes: { type: String, maxlength: 1000 },
    tags:       [{ type: String, trim: true, lowercase: true }],
    createdBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── §4  Indexes ───────────────────────────────────────────────────────────────

driverSchema.index({ location: '2dsphere' });
driverSchema.index({ ownerAgency: 1, status: 1 });
driverSchema.index({ ownerAgency: 1, isActive: 1 });
driverSchema.index({ soloPartner: 1 });
driverSchema.index({ user: 1 }, { unique: true });
driverSchema.index({ driverCode: 1 });
driverSchema.index({ assignedVehicleId: 1 });
driverSchema.index({ 'kyc.verificationStatus': 1 });
driverSchema.index({ 'kyc.drivingLicenceExpiry': 1 });
driverSchema.index({ 'medicalFitness.expiryDate': 1 });
driverSchema.index({ 'performance.rating': -1 });
driverSchema.index({ createdAt: -1 });

// ── §5  Virtuals ──────────────────────────────────────────────────────────────

driverSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

/** Whether this driver belongs to an agency or is self-employed */
driverSchema.virtual('driverType').get(function () {
  if (this.ownerAgency) return 'agency';
  if (this.soloPartner) return 'solo';
  return 'unlinked';
});

/** True when the driver is fully cleared for dispatch */
driverSchema.virtual('isDispatchable').get(function () {
  return (
    this.isActive &&
    this.isVerified &&
    !this.isBlocked &&
    !this.isPaused &&
    this.status === 'Available' &&
    this.kyc?.verificationStatus === 'Verified'
  );
});

/** True when any compliance document expires within 30 days */
driverSchema.virtual('hasExpiringCompliance').get(function () {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return (
    (this.kyc?.drivingLicenceExpiry  && this.kyc.drivingLicenceExpiry  < soon) ||
    (this.kyc?.psvBadgeExpiry        && this.kyc.psvBadgeExpiry        < soon) ||
    (this.medicalFitness?.expiryDate && this.medicalFitness.expiryDate < soon)
  );
});

// ── §6  Pre-save Middleware ───────────────────────────────────────────────────

driverSchema.pre('save', async function () {
  // Validate: exactly one of ownerAgency / soloPartner must be set
  if (this.ownerAgency && this.soloPartner) {
    throw new Error(
      'A Driver cannot be linked to both an agency (ownerAgency) and a ' +
      'solo partner (soloPartner) simultaneously.'
    );
  }
  if (!this.ownerAgency && !this.soloPartner) {
    throw new Error(
      'A Driver must be linked to either an agency (ownerAgency) or a ' +
      'solo partner (soloPartner). Both are null.'
    );
  }

  // Auto-generate driverCode
  if (!this.driverCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-2).toUpperCase();
    this.driverCode = `LKS-DRV-${ts}${rand}`;
  }

  // Mask Aadhaar
  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  // Mask bank account
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  // Sync isVerified / isActive from KYC status
  if (this.isModified('kyc.verificationStatus')) {
    this.isVerified = this.kyc.verificationStatus === 'Verified';
    if (this.isVerified && !this.isActive) this.isActive = true;
    if (this.isVerified) this.kyc.isVerified = true;
  }

  // Record KYC submission date when DL first provided
  if (
    this.isModified('kyc.drivingLicenceNumber') &&
    this.kyc?.drivingLicenceNumber &&
    !this.kyc.submittedAt
  ) {
    this.kyc.submittedAt = new Date();
  }

  // Clear blockReason when unblocking
  if (this.isModified('isBlocked') && !this.isBlocked) this.blockReason = undefined;

  // Auto-unpause when pause window expired
  if (this.isPaused && this.pausedUntil && this.pausedUntil < new Date()) {
    this.isPaused    = false;
    this.pausedUntil = undefined;
    this.pauseReason = undefined;
  }

  // Recalculate profile completion percentage
  if (this.isModified()) {
    const checks = [
      this.legalName,
      this.dateOfBirth,
      this.phone,
      this.kyc?.aadhaarNumber,
      this.kyc?.drivingLicenceNumber,
      this.kyc?.drivingLicenceDocUrl,
      this.kyc?.isVerified,
      this.medicalFitness?.certificateNumber,
      this.bankDetails?.accountNumber,
      this.emergencyContact?.phone,
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }

  // Update reward tier based on total rides completed
  if (this.isModified('performance.totalRidesCompleted')) {
    const rides = this.performance.totalRidesCompleted;
    let tier = 'Bronze';
    if      (rides >= 1000) tier = 'Diamond';
    else if (rides >= 500)  tier = 'Platinum';
    else if (rides >= 200)  tier = 'Gold';
    else if (rides >= 50)   tier = 'Silver';
    if (this.rewards.tier !== tier) {
      this.rewards.tier          = tier;
      this.rewards.tierUpdatedAt = new Date();
    }
  }
});

// ── §7  Post-save — sync agency fleet counters (agency drivers only) ──────────

driverSchema.post('save', async function () {
  // Solo driver-partners have no agency; nothing to sync
  if (!this.ownerAgency) return;

  try {
    const [totals] = await mongoose.model('Driver').aggregate([
      { $match: { ownerAgency: this.ownerAgency } },
      {
        $group: {
          _id:           null,
          totalDrivers:  { $sum: 1 },
          activeDrivers: {
            $sum: { $cond: [{ $in: ['$status', ['Available', 'On-Trip']] }, 1, 0] },
          },
        },
      },
    ]);

    if (totals) {
      await mongoose.model('TransportPartner').findByIdAndUpdate(
        this.ownerAgency,
        {
          'fleetInfo.totalDrivers':  totals.totalDrivers,
          'fleetInfo.activeDrivers': totals.activeDrivers,
        }
      );
    }
  } catch (err) {
    console.error('[Driver.post-save] fleet counter sync failed:', err.message);
  }
});

// ── §8  Instance Methods ──────────────────────────────────────────────────────

driverSchema.methods.earnCoins = async function (amount, description, referenceId, referenceModel) {
  this.rewards.coinBalance      += amount;
  this.rewards.totalCoinsEarned += amount;
  this.rewards.coinTransactions.push({
    type:           'EARN',
    amount,
    balance:        this.rewards.coinBalance,
    description,
    referenceId,
    referenceModel,
    expiresAt:      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });
  return this.save();
};

driverSchema.methods.redeemCoins = async function (amount, description, referenceId) {
  if (this.rewards.coinBalance < amount) {
    throw new Error(
      `Insufficient coins. Balance: ${this.rewards.coinBalance}, Requested: ${amount}`
    );
  }
  this.rewards.coinBalance      -= amount;
  this.rewards.totalCoinsRedeem += amount;
  this.rewards.coinTransactions.push({
    type:           'REDEEM',
    amount,
    balance:        this.rewards.coinBalance,
    description,
    referenceId,
    referenceModel: 'Redemption',
  });
  return this.save();
};

driverSchema.methods.awardBadge = async function (badgeId, name, description, iconUrl) {
  const already = this.rewards.badges.some(b => b.badgeId === badgeId);
  if (already) return this;
  this.rewards.badges.push({ badgeId, name, description, iconUrl });
  return this.save();
};

// ── §9  Statics ───────────────────────────────────────────────────────────────

/**
 * Find nearest available, verified, unblocked drivers within a radius.
 * Returns up to 10 results ordered by proximity.
 * Works for both agency drivers AND solo driver-partners.
 *
 * @param {number}   lng                - Longitude
 * @param {number}   lat                - Latitude
 * @param {number}   maxDistanceMeters  - Search radius (default 10 km)
 * @param {ObjectId} [agencyId]         - Optionally restrict to one TransportPartner
 */
driverSchema.statics.findNearestAvailable = function (
  lng, lat, maxDistanceMeters = 10_000, agencyId
) {
  const filter = {
    isActive:   true,
    isVerified: true,
    isBlocked:  false,
    isPaused:   false,
    status:     'Available',
    'kyc.verificationStatus': 'Verified',
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters,
      },
    },
  };
  if (agencyId) filter.ownerAgency = agencyId;

  return this.find(filter)
    .populate('user', 'name phone avatar')
    .limit(10);
};

/**
 * Find all drivers for a given agency, optionally filtered by status.
 */
driverSchema.statics.findByAgency = function (agencyId, status) {
  const filter = { ownerAgency: agencyId };
  if (status) filter.status = status;
  return this.find(filter).sort({ createdAt: -1 });
};

/**
 * Find the Driver document for a solo driver-partner.
 */
driverSchema.statics.findBySoloPartner = function (soloPartnerId) {
  return this.findOne({ soloPartner: soloPartnerId });
};

// ─────────────────────────────────────────────────────────────────────────────

const Driver = mongoose.model('Driver', driverSchema);
export default Driver;