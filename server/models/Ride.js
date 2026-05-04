import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateRideCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// ─────────────────────────────────────────────────────────────────────────────
// RIDE MODEL — Likeson.in
//
// Pure transport record. One Booking may generate 1-2 Ride documents.
// Ride is separate from Booking so:
//   - Transport team queries rides without touching booking/medical logic
//   - GPS write-heavy updates go to RideTracking (not here)
//   - Fare calculations for transport are isolated
//
// RIDE TYPES:
//   patient          → patient being transported (home→hospital or return)
//   care_assistant   → care assistant vehicle to join patient
//   diagnostic_tech  → lab technician dispatched for home sample collection
//   pharmacy_delivery→ medicine delivery to patient
//   blood_bank       → blood component delivery to hospital/patient
//
// DRIVER TYPES:
//   Ride uses either:
//     a) Agency driver: driver → Driver ref, via TransportPartner
//     b) Solo driver:   driver → Driver ref (driver.soloPartner is set)
//   Both use the same Driver model — dispatch layer handles the difference.
//
// VEHICLE:
//   vehicleSnapshot is denormalized at assignment time for fast display.
//   Source of truth remains TransportPartner.vehicles[] or SoloDriverPartner.vehicle.
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────────

export const RIDE_TYPES = [
  'patient',
  'care_assistant',
  'diagnostic_tech',
  'pharmacy_delivery',
  'blood_bank',
];

export const RIDE_STATUSES = [
  'requested',        // Booking placed, no driver assigned yet
  'searching',        // System searching for available driver
  'driver_assigned',  // Driver found and notified
  'driver_accepted',  // Driver confirmed they will take the ride
  'driver_en_route',  // Driver travelling to pickup point
  'driver_arrived',   // Driver at pickup location
  'otp_verified',     // Patient verified OTP — ride started
  'in_progress',      // En route to destination
  'at_stop',          // Paused at intermediate stop
  'completed',        // Dropped at destination
  'cancelled',        // Cancelled before completion
  'no_driver_found',  // Search timed out
];

export const RIDE_VEHICLE_CLASSES = [
  'two_wheeler',  // Bike / Scooter — medicine delivery, quick escort
  'four_wheeler', // Car / SUV / Van / Tempo — patient transport
  'ambulance',    // Future: ambulance integration
];

export const RIDE_CANCEL_ACTORS = [
  'customer',
  'driver',
  'admin',
  'system',
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * rideGeoPointSchema — GeoJSON point with address label for ride waypoints.
 */
const rideGeoPointSchema = new Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    label:       { type: String, trim: true },        // "Home", "Hospital Gate 1", "Lab"
    address:     { type: String, trim: true },        // full formatted address
    city:        { type: String, trim: true },
    pincode:     { type: String, trim: true },
    arrivedAt:   { type: Date },                      // when driver arrived at this point
    departedAt:  { type: Date },                      // when driver left this point
  },
  { _id: false }
);

/**
 * stopSchema — intermediate stops between pickup and final dropoff.
 * Example: Home → Pharmacy (collect meds) → Hospital
 */
const stopSchema = new Schema(
  {
    sequence:    { type: Number, required: true },  // 1, 2, 3 ...
    location:    { type: rideGeoPointSchema, required: true },
    purpose:     {
      type: String,
      enum: ['pharmacy_pickup', 'hospital_gate', 'lab_collection', 'blood_bank', 'other'],
    },
    waitMinutes: { type: Number, default: 0 },      // actual wait time recorded
    isCompleted: { type: Boolean, default: false },
  },
  { _id: true }
);

/**
 * vehicleSnapshotSchema — denormalized vehicle data captured at assignment.
 * Prevents broken references if vehicle record is edited after ride completes.
 */
const vehicleSnapshotSchema = new Schema(
  {
    vehicleCode:            { type: String },
    registrationNumber:     { type: String },
    make:                   { type: String },
    model:                  { type: String },
    color:                  { type: String },
    vehicleType:            { type: String }, // Sedan, SUV, Bike etc.
    vehicleClass:           { type: String, enum: RIDE_VEHICLE_CLASSES },
    seatingCapacity:        { type: Number },
    isWheelchairAccessible: { type: Boolean },
    hasStretcherSupport:    { type: Boolean },
    hasOxygenSupport:       { type: Boolean },
    hasAC:                  { type: Boolean },
  },
  { _id: false }
);

/**
 * driverSnapshotSchema — denormalized driver data at assignment time.
 */
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

/**
 * rideFareBreakdownSchema — transport-specific fare components.
 * This is the transport slice of the parent Booking.fareBreakdown.
 */
const rideFareBreakdownSchema = new Schema(
  {
    baseFare:              { type: Number, default: 0, min: 0 },
    distanceFare:          { type: Number, default: 0, min: 0 }, // perKm × distanceKm
    waitingCharge:         { type: Number, default: 0, min: 0 }, // per-minute waiting fee
    nightSurcharge:        { type: Number, default: 0, min: 0 },
    wheelchairSurcharge:   { type: Number, default: 0, min: 0 },
    stopCharges:           { type: Number, default: 0, min: 0 }, // fee for intermediate stops
    platformFee:           { type: Number, default: 0, min: 0 }, // platform cut
    taxes:                 { type: Number, default: 0, min: 0 },
    discount:              { type: Number, default: 0, min: 0 },
    totalFare:             { type: Number, default: 0, min: 0 },

    // Driver payout breakdown
    driverEarnings:        { type: Number, default: 0, min: 0 },
    agencyEarnings:        { type: Number, default: 0, min: 0 }, // 0 if solo driver

    // Pricing basis (captured at ride creation)
    ratePerKm:             { type: Number, default: 0 },
    minimumFare:           { type: Number, default: 0 },
    waitingRatePerMin:     { type: Number, default: 0 },
    currency:              { type: String, default: 'INR' },

    // Platform fee structure used (snapshot from PlatformPricingConfig)
    platformFeeType:       { type: String, enum: ['fixed', 'percentage'] },
    platformFeeValue:      { type: Number },
  },
  { _id: false }
);

/**
 * liveLocationSchema — current driver position (updated by driver app via socket).
 * Latest position only — breadcrumb history lives in RideTracking.
 */
const liveLocationSchema = new Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [80.648, 16.506] }, // [lng, lat]
    heading:     { type: Number, min: 0, max: 360 },            // degrees
    speedKmh:    { type: Number, min: 0 },
    updatedAt:   { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * cancellationSchema — ride-level cancellation record.
 */
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

/**
 * rideRatingSchema — customer rates driver after ride completes.
 */
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
      uppercase: true,
      trim:      true,
      index:     true,
      comment:   'Format: RD-XXXXXXXX — auto-generated on create',
    },

    rideType: {
      type:     String,
      required: true,
      enum:     RIDE_TYPES,
      index:    true,
    },

    vehicleClass: {
      type:     String,
      enum:     RIDE_VEHICLE_CLASSES,
      required: true,
    },

    // ── Booking Link ──────────────────────────────────────────────────────────
    /**
     * booking — the parent Booking that created this ride.
     * Required. Every ride must belong to a booking.
     */
    booking: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },

    /**
     * isReturnRide — true when this is the return leg of a full_care_ride.
     * The outbound ride is Booking.primaryRide; return is Booking.returnRide.
     */
    isReturnRide: { type: Boolean, default: false },

    // ── Driver & Vehicle ──────────────────────────────────────────────────────
    /**
     * driver → Driver model ref.
     * Works for both agency drivers (driver.ownerAgency set) and
     * solo driver-partners (driver.soloPartner set).
     * null until a driver is assigned.
     */
    driver: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
      index:   true,
    },

    /**
     * transportPartner — set when driver is an agency driver.
     * Null for solo driver-partners.
     * Used for fare settlement → agency.
     */
    transportPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'TransportPartner',
      default: null,
      index:   true,
    },

    /**
     * soloPartner — set when driver is a self-employed driver.
     * Null for agency drivers.
     * Used for fare settlement → solo partner.
     */
    soloPartner: {
      type:    Schema.Types.ObjectId,
      ref:     'SoloDriverPartner',
      default: null,
    },

    /**
     * assignedVehicleId — _id of the embedded vehicle sub-document
     * inside TransportPartner.vehicles[]. Null for solo drivers
     * (their vehicle lives in SoloDriverPartner.vehicle).
     */
    assignedVehicleId: {
      type:    Schema.Types.ObjectId,
      default: null,
    },

    // Denormalized snapshots — captured at assignment time
    vehicleSnapshot: { type: vehicleSnapshotSchema, default: null },
    driverSnapshot:  { type: driverSnapshotSchema,  default: null },

    // ── Route ─────────────────────────────────────────────────────────────────
    /**
     * pickup — where driver picks up the patient / item.
     */
    pickup: {
      type:     rideGeoPointSchema,
      required: true,
    },

    /**
     * dropoff — final destination.
     */
    dropoff: {
      type:     rideGeoPointSchema,
      required: true,
    },

    /**
     * stops — intermediate waypoints between pickup and dropoff.
     * Ordered by sequence field. Example: Home → Pharmacy → Hospital.
     */
    stops: {
      type:    [stopSchema],
      default: [],
    },

    // ── Live Position ─────────────────────────────────────────────────────────
    /**
     * liveLocation — driver's current position.
     * Updated in real-time by driver app via WebSocket.
     * History of positions → RideTracking.breadcrumbs (write-heavy, separate collection).
     */
    liveLocation: {
      type:    liveLocationSchema,
      default: () => ({}),
    },

    /**
     * currentEtaMinutes — estimated minutes to next waypoint.
     * Recalculated on each GPS ping and stored here for fast API reads.
     */
    currentEtaMinutes: { type: Number, default: null },

    // ── Timing ────────────────────────────────────────────────────────────────
    scheduledPickupAt:   { type: Date, required: true, index: true },
    driverAssignedAt:    { type: Date },
    driverAcceptedAt:    { type: Date },
    driverArrivedAt:     { type: Date },   // arrived at pickup
    rideStartedAt:       { type: Date },   // OTP verified
    rideCompletedAt:     { type: Date },
    driverEnRouteAt:     { type: Date },   // left for pickup

    // ── Distance & Duration ───────────────────────────────────────────────────
    estimatedDistanceKm: { type: Number, default: 0 },  // from Google Maps at booking time
    estimatedDurationMin:{ type: Number, default: 0 },
    actualDistanceKm:    { type: Number, default: 0 },   // from GPS tracking
    actualDurationMin:   { type: Number, default: 0 },

    // ── OTP Verification ──────────────────────────────────────────────────────
    /**
     * pickupOtp — 4-digit OTP patient shares with driver to start ride.
     * Stored hashed. Never sent in API responses.
     */
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

    /**
     * driverSearchAttempts — how many drivers were offered this ride before acceptance.
     * Used for analytics and dispatch tuning.
     */
    driverSearchAttempts: { type: Number, default: 0 },

    /**
     * declinedDrivers — drivers who declined this ride.
     * Prevents re-offering same ride to same driver.
     */
    declinedDrivers: [{ type: Schema.Types.ObjectId, ref: 'Driver' }],

    cancellation: {
      type:    rideCancellationSchema,
      default: null,
    },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: {
      type:    rideRatingSchema,
      default: null,
    },

    isRated: { type: Boolean, default: false },

    // ── RideTracking Link ─────────────────────────────────────────────────────
    /**
     * trackingId — ObjectId of the RideTracking document for this ride.
     * Populated when RideTracking is created (on driver_assigned or ride start).
     * Use this to fetch GPS breadcrumbs and milestones.
     */
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

/**
 * driverType — whether this ride uses an agency driver or solo partner.
 * Derived from which ref is set.
 */
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

  // Cannot have both transportPartner and soloPartner set
  if (this.transportPartner && this.soloPartner) {
    throw new Error('Ride cannot reference both a transportPartner and a soloPartner');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

rideSchema.pre('save', async function () {
  // Auto-generate rideCode
  if (this.isNew && !this.rideCode) {
    let code, exists;
    do {
      code   = `RD-${generateRideCode()}`;
      exists = await mongoose.model('Ride').exists({ rideCode: code });
    } while (exists);
    this.rideCode = code;
  }

  // Auto-set timing fields on status transitions
  const now = new Date();
  if (this.isModified('status')) {
    switch (this.status) {
      case 'driver_assigned': this.driverAssignedAt  = this.driverAssignedAt  ?? now; break;
      case 'driver_accepted': this.driverAcceptedAt  = this.driverAcceptedAt  ?? now; break;
      case 'driver_en_route': this.driverEnRouteAt   = this.driverEnRouteAt   ?? now; break;
      case 'driver_arrived':  this.driverArrivedAt   = this.driverArrivedAt   ?? now; break;
      case 'otp_verified':    this.rideStartedAt     = this.rideStartedAt     ?? now; break;
      case 'completed':       this.rideCompletedAt   = this.rideCompletedAt   ?? now; break;
    }
  }

  // Sync isRated
  if (this.isModified('rating') && this.rating?.rating) {
    this.isRated = true;
    this.rating.ratedAt = this.rating.ratedAt ?? now;
  }

  // Capture driver snapshot when driver is first assigned
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

  // Derive vehicleClass from vehicleSnapshot.vehicleType if not set
  if (this.isModified('vehicleSnapshot') && this.vehicleSnapshot?.vehicleType && !this.vehicleClass) {
    const twoWheelerTypes = ['Bike', 'Scooter'];
    this.vehicleClass = twoWheelerTypes.includes(this.vehicleSnapshot.vehicleType)
      ? 'two_wheeler'
      : 'four_wheeler';
  }
});

// ── Post-save — update driver status when ride starts/ends ───────────────────

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

/**
 * Find all active rides for a given driver.
 */
rideSchema.statics.findActiveByDriver = function (driverId) {
  return this.find({
    driver: driverId,
    status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'otp_verified', 'in_progress', 'at_stop'] },
  });
};

/**
 * Find all rides for a given booking.
 */
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