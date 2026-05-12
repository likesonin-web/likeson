import mongoose from 'mongoose';

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// RIDETRACKING MODEL — Likeson.in
//
// Write-heavy GPS time-series + milestone events for a single ride.
// ONE RideTracking document per Ride (1:1, enforced by unique index).
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_BREADCRUMBS  = 2000;
const        MAX_ETA_UPDATES  = 100;  // FIX #14: enforced in $push $slice, not just pre-save

// ── Milestone Names ───────────────────────────────────────────────────────────

export const MILESTONE_NAMES = [
  'ride_created',
  'driver_search_started',
  'driver_assigned',
  'driver_accepted',
  'driver_en_route',
  'driver_arrived',
  'otp_verified',
  'ride_started',
  'stop_reached',
  'stop_departed',
  'hospital_arrived',
  'patient_handed_over',
  'care_assistant_joined',
  'consultation_started',
  'consultation_completed',
  'pharmacy_collected',
  'break_taken',
  'diagnosis_completed',
  'return_ride_started',
  'patient_home_reached',
  'pickup_collected',
  'delivery_attempted',
  'delivered',
  'delivery_otp_verified',
  'vehicle_breakdown',
  'driver_replaced',
  'route_deviated',
  'sos_triggered',
  'ride_paused',
  'ride_resumed',
  'ride_completed',
  'ride_cancelled',
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const breadcrumbSchema = new Schema(
  {
    coordinates: { type: [Number], required: true },
    heading:     { type: Number, min: 0, max: 360 },
    speedKmh:    { type: Number, min: 0 },
    accuracyM:   { type: Number, min: 0 },
    timestamp:   { type: Date, required: true, default: Date.now },
    source:      { type: String, enum: ['gps', 'network', 'fused'], default: 'fused' },
  },
  { _id: false }
);

const milestoneSchema = new Schema(
  {
    name: {
      type:     String,
      required: true,
      enum:     MILESTONE_NAMES,
    },
    occurredAt: {
      type:     Date,
      required: true,
      default:  Date.now,
    },
    coordinates:  { type: [Number], default: null },
    stopSequence: { type: Number,   default: null },
    meta:         { type: Schema.Types.Mixed, default: null },
    recordedBy: {
      type:    String,
      enum:    ['driver', 'system', 'admin', 'customer'],
      default: 'system',
    },
    recordedByUserId: {
      type:    Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
  },
  { _id: true }
);

const etaUpdateSchema = new Schema(
  {
    toWaypoint:          { type: String },
    etaMinutes:          { type: Number },
    distanceRemainingKm: { type: Number },
    calculatedAt:        { type: Date, default: Date.now },
    source:              { type: String, enum: ['google_maps', 'osrm', 'estimate'], default: 'estimate' },
  },
  { _id: false }
);

const sosEventSchema = new Schema(
  {
    triggeredBy:       { type: String, enum: ['driver', 'customer', 'care_assistant', 'system'] },
    triggeredByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    sosType:           { type: String, enum: ['medical', 'safety', 'accident', 'other'] },
    coordinates:       { type: [Number] },
    description:       { type: String },
    resolvedAt:        { type: Date },
    resolvedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes:   { type: String },
    triggeredAt:       { type: Date, default: Date.now },
    isResolved:        { type: Boolean, default: false },
  },
  { _id: true }
);

const routeDeviationSchema = new Schema(
  {
    detectedAt:      { type: Date, default: Date.now },
    coordinates:     { type: [Number] },
    deviationKm:     { type: Number },
    wasAcknowledged: { type: Boolean, default: false },
    acknowledgedAt:  { type: Date },
    driverReason:    { type: String },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const rideTrackingSchema = new Schema(
  {
    ride: {
      type:     Schema.Types.ObjectId,
      ref:      'Ride',
      required: true,
      unique:   true,
      index:    true,
    },

    booking: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },

    driver: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
      index:   true,
    },

    // ── GPS Breadcrumbs ───────────────────────────────────────────────────────
    breadcrumbs: {
      type:    [breadcrumbSchema],
      default: [],
    },

    breadcrumbCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Milestones ────────────────────────────────────────────────────────────
    milestones: {
      type:    [milestoneSchema],
      default: [],
    },

    // ── ETA ───────────────────────────────────────────────────────────────────
    currentEtaMinutes: { type: Number, default: null },
    currentEtaTarget:  { type: String, default: null },

    // FIX #14: etaUpdates cap enforced at DB level via $slice in addEtaUpdate static.
    // pre-save cap remains as safety net but $push $slice is the primary guard.
    etaUpdates: {
      type:    [etaUpdateSchema],
      default: [],
    },

    // ── Route Summary ─────────────────────────────────────────────────────────
    totalDistanceKm:       { type: Number, default: 0, min: 0 },
    expectedRoutePolyline: { type: String, default: null },
    actualRoutePolyline:   { type: String, default: null },

    // ── SOS ───────────────────────────────────────────────────────────────────
    sosEvents:    { type: [sosEventSchema], default: [] },
    hasActiveSos: { type: Boolean, default: false, index: true },

    // ── Route Deviations ──────────────────────────────────────────────────────
    routeDeviations:            { type: [routeDeviationSchema], default: [] },
    hasUnacknowledgedDeviation: { type: Boolean, default: false, index: true },

    // ── Summary (populated at ride completion) ────────────────────────────────
    summary: {
      totalDistanceKm:    { type: Number },
      totalDurationMin:   { type: Number },  // FIX #12: now computed in computeSummary
      avgSpeedKmh:        { type: Number },
      maxSpeedKmh:        { type: Number },
      pickupWaitMin:      { type: Number },
      totalStopWaitMin:   { type: Number },
      totalPingsReceived: { type: Number },
      isCompleted:        { type: Boolean, default: false },
      completedAt:        { type: Date },
    },

    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

rideTrackingSchema.virtual('latestPosition').get(function () {
  if (!this.breadcrumbs?.length) return null;
  return this.breadcrumbs[this.breadcrumbs.length - 1];
});

rideTrackingSchema.virtual('lastMilestone').get(function () {
  if (!this.milestones?.length) return null;
  return this.milestones[this.milestones.length - 1];
});

rideTrackingSchema.virtual('milestoneCount').get(function () {
  return this.milestones?.length ?? 0;
});

rideTrackingSchema.virtual('hasSosEvents').get(function () {
  return this.sosEvents?.length > 0;
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * addBreadcrumb — push GPS ping, maintain ring buffer cap.
 *
 * FIX #13: Single DB op — no separate findOne. We use $push $slice $inc together.
 * Incremental distance calculated from last breadcrumb pulled in the same update
 * is not feasible in one op without transactions. Accepted trade-off: distance
 * accumulation done via separate lean fetch only when needed, otherwise rely on
 * computeSummary at ride end using full breadcrumb array.
 *
 * For production scale: pipe breadcrumbs to InfluxDB/TimescaleDB and store only
 * last 200 here for live map display.
 *
 * @param {ObjectId|string} rideId  - Ride._id (NOT booking ID)
 * @param {{ coordinates, heading?, speedKmh?, accuracyM?, source? }} pingData
 */
rideTrackingSchema.statics.addBreadcrumb = async function (rideId, pingData) {
  const { coordinates, heading, speedKmh, accuracyM, source } = pingData;

  if (!coordinates || coordinates.length !== 2) {
    throw new Error('addBreadcrumb: coordinates [lng, lat] required');
  }

  const breadcrumb = {
    coordinates,
    heading:   heading   ?? 0,
    speedKmh:  speedKmh  ?? 0,
    accuracyM: accuracyM ?? null,
    source:    source    ?? 'fused',
    timestamp: new Date(),
  };

  // FIX #13: single atomic op — $push with $slice keeps ring buffer,
  // $inc bumps counter. No separate findOne round trip.
  // Distance accumulation deferred to computeSummary (acceptable for our scale).
  return this.findOneAndUpdate(
    { ride: rideId },
    {
      $push: {
        breadcrumbs: {
          $each:  [breadcrumb],
          $slice: -MAX_BREADCRUMBS,
        },
      },
      $inc: { breadcrumbCount: 1 },
    },
    { new: true }
  ).select('breadcrumbCount currentEtaMinutes totalDistanceKm');
};

/**
 * addMilestone — record a named lifecycle event.
 *
 * @param {ObjectId|string} rideId
 * @param {string} name — must be in MILESTONE_NAMES
 * @param {{ coordinates?, stopSequence?, meta?, recordedBy?, recordedByUserId? }} opts
 */
rideTrackingSchema.statics.addMilestone = async function (
  rideId,
  name,
  { coordinates = null, stopSequence = null, meta = null, recordedBy = 'system', recordedByUserId = null } = {}
) {
  if (!MILESTONE_NAMES.includes(name)) {
    throw new Error(`Unknown milestone name: ${name}`);
  }

  const milestone = {
    name,
    occurredAt: new Date(),
    coordinates,
    stopSequence,
    meta,
    recordedBy,
    recordedByUserId,
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    { $push: { milestones: milestone } },
    { new: true }
  ).select('milestones');
};

/**
 * addEtaUpdate — push ETA recalculation, capped at MAX_ETA_UPDATES.
 *
 * FIX #14: $slice in $push enforces cap at DB level — bypasses pre-save,
 * works correctly even when called via findOneAndUpdate directly.
 *
 * @param {ObjectId|string} rideId
 * @param {{ toWaypoint, etaMinutes, distanceRemainingKm, source? }} etaData
 */
rideTrackingSchema.statics.addEtaUpdate = async function (rideId, etaData) {
  const { toWaypoint, etaMinutes, distanceRemainingKm, source } = etaData;

  const entry = {
    toWaypoint,
    etaMinutes,
    distanceRemainingKm,
    source:       source ?? 'estimate',
    calculatedAt: new Date(),
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    {
      $push: {
        etaUpdates: {
          $each:  [entry],
          $slice: -MAX_ETA_UPDATES,  // FIX #14: DB-level cap, not pre-save only
        },
      },
      $set: {
        currentEtaMinutes: etaMinutes,
        currentEtaTarget:  toWaypoint,
      },
    },
    { new: true }
  ).select('currentEtaMinutes currentEtaTarget');
};

/**
 * triggerSos — record SOS event, set hasActiveSos = true.
 */
rideTrackingSchema.statics.triggerSos = async function (rideId, sosData) {
  const sosEvent = { ...sosData, triggeredAt: new Date(), isResolved: false };

  return this.findOneAndUpdate(
    { ride: rideId },
    {
      $push: { sosEvents: sosEvent },
      $set:  { hasActiveSos: true },
    },
    { new: true }
  ).select('sosEvents hasActiveSos');
};

/**
 * resolveSos — mark SOS resolved.
 */
rideTrackingSchema.statics.resolveSos = async function (rideId, sosEventId, resolvedBy, resolutionNotes) {
  return this.findOneAndUpdate(
    { ride: rideId, 'sosEvents._id': sosEventId },
    {
      $set: {
        'sosEvents.$.isResolved':      true,
        'sosEvents.$.resolvedAt':      new Date(),
        'sosEvents.$.resolvedBy':      resolvedBy,
        'sosEvents.$.resolutionNotes': resolutionNotes,
        hasActiveSos:                  false,
      },
    },
    { new: true }
  );
};

/**
 * computeSummary — called when ride completes.
 *
 * FIX #12: totalDurationMin now computed from Ride.rideStartedAt / rideCompletedAt
 * fetched directly inside this static — no longer null.
 *
 * @param {ObjectId|string} rideId  - Ride._id
 */
rideTrackingSchema.statics.computeSummary = async function (rideId) {
  const [tracking, ride] = await Promise.all([
    this.findOne({ ride: rideId }).lean(),
    mongoose.model('Ride').findById(rideId)
      .select('rideStartedAt rideCompletedAt')
      .lean(),
  ]);

  if (!tracking) return null;

  const crumbs = tracking.breadcrumbs ?? [];
  const speeds = crumbs.map(c => c.speedKmh).filter(s => s != null && s >= 0);

  const avgSpeed = speeds.length
    ? +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)
    : 0;
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

  // FIX #12: compute totalDurationMin from Ride timestamps
  let totalDurationMin = null;
  if (ride?.rideStartedAt && ride?.rideCompletedAt) {
    totalDurationMin = Math.round(
      (new Date(ride.rideCompletedAt) - new Date(ride.rideStartedAt)) / 60000
    );
  }

  // Pickup wait = driver_arrived → otp_verified
  const arrivedMs  = tracking.milestones?.find(m => m.name === 'driver_arrived')?.occurredAt;
  const otpMs      = tracking.milestones?.find(m => m.name === 'otp_verified')?.occurredAt;
  const pickupWaitMin = arrivedMs && otpMs
    ? Math.round((new Date(otpMs) - new Date(arrivedMs)) / 60000)
    : 0;

  // Total stop wait
  const stopArrived  = tracking.milestones?.filter(m => m.name === 'stop_reached')  ?? [];
  const stopDeparted = tracking.milestones?.filter(m => m.name === 'stop_departed') ?? [];
  let totalStopWaitMin = 0;
  for (let i = 0; i < Math.min(stopArrived.length, stopDeparted.length); i++) {
    totalStopWaitMin += Math.round(
      (new Date(stopDeparted[i].occurredAt) - new Date(stopArrived[i].occurredAt)) / 60000
    );
  }

  // Recompute totalDistanceKm from breadcrumbs using haversine
  let totalDistanceKm = 0;
  for (let i = 1; i < crumbs.length; i++) {
    totalDistanceKm += haversineKm(crumbs[i - 1].coordinates, crumbs[i].coordinates);
  }
  totalDistanceKm = +totalDistanceKm.toFixed(2);

  const summary = {
    totalDistanceKm,
    totalDurationMin,   // FIX #12: no longer null
    avgSpeedKmh:        avgSpeed,
    maxSpeedKmh:        maxSpeed,
    pickupWaitMin,
    totalStopWaitMin,
    totalPingsReceived: tracking.breadcrumbCount,
    isCompleted:        true,
    completedAt:        new Date(),
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    { $set: { summary, totalDistanceKm } },
    { new: true }
  ).select('summary');
};

// ── Pre-save ──────────────────────────────────────────────────────────────────

rideTrackingSchema.pre('save', function () {
  // Safety net cap for etaUpdates (primary cap is $slice in addEtaUpdate)
  if (this.isModified('etaUpdates') && this.etaUpdates.length > MAX_ETA_UPDATES) {
    this.etaUpdates = this.etaUpdates.slice(-MAX_ETA_UPDATES);
  }

  // Sync hasActiveSos
  if (this.isModified('sosEvents')) {
    this.hasActiveSos = this.sosEvents.some(e => !e.isResolved);
  }

  // Sync hasUnacknowledgedDeviation
  if (this.isModified('routeDeviations')) {
    this.hasUnacknowledgedDeviation = this.routeDeviations.some(d => !d.wasAcknowledged);
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

rideTrackingSchema.index({ booking: 1 });
rideTrackingSchema.index({ driver: 1, createdAt: -1 });
rideTrackingSchema.index({ hasActiveSos: 1 });
rideTrackingSchema.index({ hasUnacknowledgedDeviation: 1 });
rideTrackingSchema.index({ isArchived: 1, createdAt: -1 });
rideTrackingSchema.index({ createdAt: -1 });

// ── Utility — Haversine distance ──────────────────────────────────────────────

function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * (Math.PI / 180); }

// ─────────────────────────────────────────────────────────────────────────────

const RideTracking = mongoose.model('RideTracking', rideTrackingSchema);
export default RideTracking;