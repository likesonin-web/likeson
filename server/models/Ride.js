import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateRideCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// ─────────────────────────────────────────────────────────────────────────────
// RIDE MODEL — Likeson.in
// ─────────────────────────────────────────────────────────────────────────────

export const RIDE_TYPES = [
  'patient',
  'care_assistant',
  'diagnostic_tech',
  'pharmacy_delivery',
  'blood_bank',
];

export const RIDE_STATUSES = [
  'requested',
  'searching',
  'driver_assigned',
  'driver_accepted',
  'driver_en_route',
  'driver_arrived',
  'otp_verified',
  'in_progress',
  'at_stop',
  'completed',
  'cancelled',
  'no_driver_found',
];

export const RIDE_VEHICLE_CLASSES = [
  'two_wheeler',
  'four_wheeler',
  'ambulance',
];

export const RIDE_CANCEL_ACTORS = [
  'customer',
  'driver',
  'admin',
  'system',
];

// Max declined drivers stored per ride — prevents unbounded array growth (#11)
const MAX_DECLINED_DRIVERS = 50;

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const rideGeoPointSchema = new Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    label:       { type: String, trim: true },
    address:     { type: String, trim: true },
    city:        { type: String, trim: true },
    pincode:     { type: String, trim: true },
    arrivedAt:   { type: Date },
    departedAt:  { type: Date },
  },
  { _id: false }
);

const stopSchema = new Schema(
  {
    sequence:    { type: Number, required: true },
    location:    { type: rideGeoPointSchema, required: true },
    purpose:     {
      type: String,
      enum: ['pharmacy_pickup', 'hospital_gate', 'lab_collection', 'blood_bank', 'other'],
    },
    waitMinutes: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: true }
);

const vehicleSnapshotSchema = new Schema(
  {
    vehicleCode:            { type: String },
    registrationNumber:     { type: String },
    make:                   { type: String },
    model:                  { type: String },
    color:                  { type: String },
    vehicleType:            { type: String },
    vehicleClass:           { type: String, enum: RIDE_VEHICLE_CLASSES },
    seatingCapacity:        { type: Number },
    isWheelchairAccessible: { type: Boolean },
    hasStretcherSupport:    { type: Boolean },
    hasOxygenSupport:       { type: Boolean },
    hasAC:                  { type: Boolean },
  },
  { _id: false }
);

const driverSnapshotSchema = new Schema(
  {
    driverCode:   { type: String },
    legalName:    { type: String },
    phone:        { type: String },
    photoUrl:     { type: String },
    rating:       { type: Number },
    licenceClass: [{ type: String }],
  },
  { _id: false }
);

const rideFareBreakdownSchema = new Schema(
  {
    baseFare:            { type: Number, default: 0, min: 0 },
    distanceFare:        { type: Number, default: 0, min: 0 },
    waitingCharge:       { type: Number, default: 0, min: 0 },
    nightSurcharge:      { type: Number, default: 0, min: 0 },
    wheelchairSurcharge: { type: Number, default: 0, min: 0 },
    stopCharges:         { type: Number, default: 0, min: 0 },
    platformFee:         { type: Number, default: 0, min: 0 },
    taxes:               { type: Number, default: 0, min: 0 },
    discount:            { type: Number, default: 0, min: 0 },
    totalFare:           { type: Number, default: 0, min: 0 },
    driverEarnings:      { type: Number, default: 0, min: 0 },
    agencyEarnings:      { type: Number, default: 0, min: 0 },
    ratePerKm:           { type: Number, default: 0 },
    minimumFare:         { type: Number, default: 0 },
    waitingRatePerMin:   { type: Number, default: 0 },
    currency:            { type: String, default: 'INR' },
    platformFeeType:     { type: String, enum: ['fixed', 'percentage'] },
    platformFeeValue:    { type: Number },
  },
  { _id: false }
);

const liveLocationSchema = new Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [80.648, 16.506] },
    heading:     { type: Number, min: 0, max: 360 },
    speedKmh:    { type: Number, min: 0 },
    updatedAt:   { type: Date, default: Date.now },
  },
  { _id: false }
);

const rideCancellationSchema = new Schema(
  {
    cancelledBy:       { type: String, enum: RIDE_CANCEL_ACTORS },
    cancelledByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason:            { type: String, trim: true },
    cancellationFee:   { type: Number, default: 0, min: 0 },
    cancelledAt:       { type: Date, default: Date.now },
  },
  { _id: false }
);

const rideRatingSchema = new Schema(
  {
    rating:    { type: Number, min: 1, max: 5 },
    comment:   { type: String, trim: true },
    ratedAt:   { type: Date },
    isVisible: { type: Boolean, default: true },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const rideSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    rideCode: {
      type:      String,
      unique:    true,
      sparse:    true,   // FIX #10: sparse prevents null duplicate key collision
      uppercase: true,
      trim:      true,
      index:     true,
    },

    rideType: {
      type:     String,
      required: true,
      enum:     RIDE_TYPES,
      index:    true,
    },

    // FIX #8: vehicleClass NOT required at schema level.
    // It is derived in pre-save from vehicleSnapshot.vehicleType when not provided.
    // Callers SHOULD provide it at creation; pre-save fills it as fallback.
    vehicleClass: {
      type: String,
      enum: RIDE_VEHICLE_CLASSES,
      // required removed — pre-save derives it if missing
    },

    // ── Booking Link ──────────────────────────────────────────────────────────
   booking: {
  type:    Schema.Types.ObjectId,
  ref:     'Booking',
  default: null,
  index:   true,
},

    isReturnRide: { type: Boolean, default: false },

    // ── Driver & Vehicle ──────────────────────────────────────────────────────
    // Ride.driver → Driver._id (NOT User._id). See socket service for why this matters.
    driver: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
      index:   true,
    },

    transportPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'TransportPartner',
      default: null,
      index:   true,
    },

    soloPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'SoloDriverPartner',
      default: null,
    },

    assignedVehicleId: {
      type:    Schema.Types.ObjectId,
      default: null,
    },

    vehicleSnapshot: { type: vehicleSnapshotSchema, default: null },
    driverSnapshot:  { type: driverSnapshotSchema,  default: null },

    // ── Route ─────────────────────────────────────────────────────────────────
    pickup: {
      type:     rideGeoPointSchema,
      required: true,
    },

    dropoff: {
      type:     rideGeoPointSchema,
      required: true,
    },

    stops: {
      type:    [stopSchema],
      default: [],
    },

    // ── Live Position ─────────────────────────────────────────────────────────
    liveLocation: {
      type:    liveLocationSchema,
      default: () => ({}),
    },

    currentEtaMinutes: { type: Number, default: null },

    // ── Timing ────────────────────────────────────────────────────────────────
    scheduledPickupAt:    { type: Date, required: true, index: true },
    driverAssignedAt:     { type: Date },
    driverAcceptedAt:     { type: Date },
    driverArrivedAt:      { type: Date },
    rideStartedAt:        { type: Date },
    rideCompletedAt:      { type: Date },
    driverEnRouteAt:      { type: Date },

    // ── Distance & Duration ───────────────────────────────────────────────────
    estimatedDistanceKm:  { type: Number, default: 0 },
    estimatedDurationMin: { type: Number, default: 0 },
    actualDistanceKm:     { type: Number, default: 0 },
    actualDurationMin:    { type: Number, default: 0 },

    // ── OTP ───────────────────────────────────────────────────────────────────
    pickupOtp: {
      type:   String,
      select: false,
    },

    pickupOtpVerifiedAt: { type: Date },

    // ── Fare ─────────────────────────────────────────────────────────────────
    fare: {
      type:    rideFareBreakdownSchema,
      default: () => ({}),
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    RIDE_STATUSES,
      default: 'requested',
      index:   true,
    },

    driverSearchAttempts: { type: Number, default: 0 },

    // FIX #11: declinedDrivers capped at MAX_DECLINED_DRIVERS in pre-save
    declinedDrivers: [{ type: Schema.Types.ObjectId, ref: 'Driver' }],

    cancellation: {
      type:    rideCancellationSchema,
      default: null,
    },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating:  { type: rideRatingSchema, default: null },
    isRated: { type: Boolean, default: false },

    // ── RideTracking Link ─────────────────────────────────────────────────────
    trackingId: {
      type:    Schema.Types.ObjectId,
      ref:     'RideTracking',
      default: null,
      index:   true,
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

rideSchema.virtual('isActive').get(function () {
  return [
    'driver_assigned', 'driver_accepted', 'driver_en_route',
    'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
  ].includes(this.status);
});

rideSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

rideSchema.virtual('isCancelled').get(function () {
  return this.status === 'cancelled';
});

rideSchema.virtual('isPendingDriver').get(function () {
  return ['requested', 'searching'].includes(this.status);
});

rideSchema.virtual('driverType').get(function () {
  if (this.transportPartner) return 'agency';
  if (this.soloPartner)      return 'solo';
  return null;
});

rideSchema.virtual('waitingTimeMinutes').get(function () {
  if (!this.driverArrivedAt || !this.rideStartedAt) return 0;
  return Math.round((this.rideStartedAt - this.driverArrivedAt) / 60000);
});

rideSchema.virtual('actualDurationFromTimestamps').get(function () {
  if (!this.rideStartedAt || !this.rideCompletedAt) return null;
  return Math.round((this.rideCompletedAt - this.rideStartedAt) / 60000);
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

rideSchema.pre('validate', function () {
  // pickup and dropoff cannot be same coordinates
  if (this.pickup?.coordinates && this.dropoff?.coordinates) {
    const [pLng, pLat] = this.pickup.coordinates;
    const [dLng, dLat] = this.dropoff.coordinates;
    if (pLng === dLng && pLat === dLat) {
      throw new Error('Ride pickup and dropoff cannot be the same location');
    }
  }

  // stops must have unique sequence numbers
  if (this.stops?.length > 0) {
    const seqs = this.stops.map(s => s.sequence);
    if (new Set(seqs).size !== seqs.length) {
      throw new Error('Ride stops must have unique sequence numbers');
    }
  }

  // Cannot have both transportPartner and soloPartner
  if (this.transportPartner && this.soloPartner) {
    throw new Error('Ride cannot reference both a transportPartner and a soloPartner');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

rideSchema.pre('save', async function () {
  // Auto-generate rideCode
  if (this.isNew && !this.rideCode) {
    let code, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('rideCode generation failed');
      code   = `RD-${generateRideCode()}`;
      exists = await mongoose.model('Ride').exists({ rideCode: code });
    } while (exists);
    this.rideCode = code;
  }

  // Auto-set timing fields on status transitions
  const now = new Date();
  if (this.isModified('status')) {
    switch (this.status) {
      case 'driver_assigned': this.driverAssignedAt = this.driverAssignedAt ?? now; break;
      case 'driver_accepted': this.driverAcceptedAt = this.driverAcceptedAt ?? now; break;
      case 'driver_en_route': this.driverEnRouteAt  = this.driverEnRouteAt  ?? now; break;
      case 'driver_arrived':  this.driverArrivedAt  = this.driverArrivedAt  ?? now; break;
      case 'otp_verified':    this.rideStartedAt    = this.rideStartedAt    ?? now; break;
      case 'completed':       this.rideCompletedAt  = this.rideCompletedAt  ?? now; break;
    }
  }

  // Sync isRated
  if (this.isModified('rating') && this.rating?.rating) {
    this.isRated          = true;
    this.rating.ratedAt   = this.rating.ratedAt ?? now;
  }

  // FIX #8: Derive vehicleClass from vehicleSnapshot if not already set.
  // Runs regardless of whether vehicleSnapshot was just modified —
  // so creation without vehicleClass but with vehicleSnapshot works.
  if (!this.vehicleClass && this.vehicleSnapshot?.vehicleType) {
    const twoWheelerTypes = ['Bike', 'Scooter', 'Motorcycle'];
    this.vehicleClass = twoWheelerTypes.includes(this.vehicleSnapshot.vehicleType)
      ? 'two_wheeler'
      : 'four_wheeler';
  }

  // Also sync vehicleClass from vehicleSnapshot.vehicleClass if present
  if (!this.vehicleClass && this.vehicleSnapshot?.vehicleClass) {
    this.vehicleClass = this.vehicleSnapshot.vehicleClass;
  }

  // Driver snapshot on first assignment
  if (this.isModified('driver') && this.driver && !this.driverSnapshot?.driverCode) {
    const Driver = mongoose.model('Driver');
    const drv = await Driver.findById(this.driver)
      .select('driverCode legalName phone photoUrl performance.rating kyc.licenceClass')
      .lean();
    if (drv) {
      this.driverSnapshot = {
        driverCode:   drv.driverCode,
        legalName:    drv.legalName,
        phone:        drv.phone,
        photoUrl:     drv.photoUrl,
        rating:       drv.performance?.rating,
        licenceClass: drv.kyc?.licenceClass,
      };
    }
  }

  // FIX #11: Cap declinedDrivers array to prevent unbounded growth
  if (this.isModified('declinedDrivers') && this.declinedDrivers.length > MAX_DECLINED_DRIVERS) {
    // Keep the most recent MAX_DECLINED_DRIVERS — oldest dropped
    this.declinedDrivers = this.declinedDrivers.slice(-MAX_DECLINED_DRIVERS);
  }
});

// ── Post-save — update Driver status when ride starts/ends ───────────────────

rideSchema.post('save', async function () {
  if (!this.driver) return;

  try {
    if (['otp_verified', 'in_progress', 'at_stop'].includes(this.status)) {
      await mongoose.model('Driver').findByIdAndUpdate(this.driver, {
        status:      'On-Trip',
        currentRide: this._id,
      });
    } else if (['completed', 'cancelled'].includes(this.status)) {
      await mongoose.model('Driver').findByIdAndUpdate(this.driver, {
        status:      'Available',
        currentRide: null,
      });
    }
  } catch (err) {
    console.error('[Ride.post-save] driver status sync failed:', err.message);
  }
});

// ── Static Helpers ────────────────────────────────────────────────────────────

rideSchema.statics.findActiveByDriver = function (driverId) {
  return this.find({
    driver: driverId,
    status: {
      $in: [
        'driver_assigned', 'driver_accepted', 'driver_en_route',
        'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
      ],
    },
  });
};

rideSchema.statics.findByBooking = function (bookingId) {
  return this.find({ booking: bookingId }).sort({ createdAt: 1 });
};

// ── Indexes ───────────────────────────────────────────────────────────────────

rideSchema.index({ pickup:  '2dsphere' }, { sparse: true });
rideSchema.index({ dropoff: '2dsphere' }, { sparse: true });
rideSchema.index({ liveLocation: '2dsphere' });
rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ booking: 1, rideType: 1 });
rideSchema.index({ status: 1, scheduledPickupAt: 1 });
rideSchema.index({ transportPartner: 1, status: 1 });
rideSchema.index({ soloPartner: 1, status: 1 });
rideSchema.index({ scheduledPickupAt: 1 });
rideSchema.index({ createdAt: -1 });

const Ride = mongoose.model('Ride', rideSchema);
export default Ride;