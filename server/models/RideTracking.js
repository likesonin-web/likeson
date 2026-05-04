import mongoose from 'mongoose';

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// RIDETRACKING MODEL — Likeson.in
//
// Write-heavy GPS time-series + milestone events for a single ride.
// ALWAYS separate from Ride to:
//   1. Keep Ride document lean (fast reads for dispatch/API)
//   2. Isolate high-frequency GPS writes (every 3-5 seconds from driver app)
//   3. Allow independent retention/archival of raw GPS data
//
// ONE RideTracking document per Ride.
//   Ride.trackingId → RideTracking._id (back-ref for fast lookup both ways)
//
// BREADCRUMBS:
//   Capped at MAX_BREADCRUMBS (2000) per ride.
//   At ~1 ping/5s this covers ~2.7 hours of continuous tracking.
//   Older entries are dropped when cap is reached (ring buffer via slice).
//   Production note: for longer rides, emit breadcrumbs to a time-series DB
//   (InfluxDB / TimescaleDB) and keep only last 200 here for live map display.
//
// MILESTONES:
//   Named events with exact timestamps. Used for:
//     - Customer-facing "ride timeline" display
//     - SLA breach detection
//     - Analytics (average pickup time, etc.)
//
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_BREADCRUMBS = 2000;

// ── Milestone Names ───────────────────────────────────────────────────────────

export const MILESTONE_NAMES = [
  // Driver lifecycle
  'ride_created',            // Booking created, ride requested
  'driver_search_started',   // System started searching for driver
  'driver_assigned',         // Driver found + notified
  'driver_accepted',         // Driver confirmed acceptance
  'driver_en_route',         // Driver left for pickup
  'driver_arrived',          // Driver at pickup location
  'otp_verified',            // Patient verified OTP — ride officially started

  // Journey milestones
  'ride_started',            // Vehicle moving towards destination
  'stop_reached',            // Arrived at intermediate stop (dynamic, with stop seq)
  'stop_departed',           // Left intermediate stop
  'hospital_arrived',        // Arrived at hospital/clinic/lab
  'patient_handed_over',     // Patient handed to hospital/care team

  // Care-specific milestones (full_care_ride)
  'care_assistant_joined',   // Care assistant boarded vehicle
  'consultation_started',    // Doctor consultation started
  'consultation_completed',  // Consultation done
  'pharmacy_collected',      // Medicines collected from pharmacy
  'break_taken',             // Lunch/break noted (full_care_ride long trips)
  'diagnosis_completed',     // Diagnosis report received

  // Return journey
  'return_ride_started',     // Return leg of full_care_ride began
  'patient_home_reached',    // Patient dropped at home

  // Delivery milestones (pharmacy / blood_bank)
  'pickup_collected',        // Item collected from source
  'delivery_attempted',      // Delivery tried but no one home
  'delivered',               // Item successfully delivered
  'delivery_otp_verified',   // Delivery OTP confirmed by recipient

  // Exceptions
  'vehicle_breakdown',       // Vehicle broke down mid-ride
  'driver_replaced',         // Driver swap during ride
  'route_deviated',          // Driver significantly off expected route (alert)
  'sos_triggered',           // Emergency SOS by driver or patient
  'ride_paused',             // Ride temporarily paused (e.g. traffic, medical stop)
  'ride_resumed',            // Ride resumed after pause

  // Completion
  'ride_completed',          // All services done, ride closed
  'ride_cancelled',          // Ride cancelled
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * breadcrumbSchema — single GPS position ping from driver app.
 * Written every 3-5 seconds while ride is active.
 * Kept lean — no _id to reduce index overhead on high-volume array.
 */
const breadcrumbSchema = new Schema(
  {
    coordinates: {
      type:     [Number],   // [lng, lat]
      required: true,
    },
    heading:     { type: Number, min: 0, max: 360 },  // degrees
    speedKmh:    { type: Number, min: 0 },
    accuracyM:   { type: Number, min: 0 },             // GPS accuracy in metres
    timestamp:   { type: Date, required: true, default: Date.now },
    source:      { type: String, enum: ['gps', 'network', 'fused'], default: 'fused' },
  },
  { _id: false }
);

/**
 * milestoneSchema — named event in the ride lifecycle.
 * Displayed to customer as a timeline. Used for SLA + analytics.
 */
const milestoneSchema = new Schema(
  {
    name: {
      type:     String,
      required: true,
      enum:     MILESTONE_NAMES,
    },

    /**
     * occurredAt — when this milestone happened.
     * Required. Use server time, not device time.
     */
    occurredAt: {
      type:     Date,
      required: true,
      default:  Date.now,
    },

    /**
     * coordinates — GPS position when milestone was recorded.
     * Optional — may be null for server-side milestones (e.g. ride_created).
     */
    coordinates: {
      type:    [Number],  // [lng, lat]
      default: null,
    },

    /**
     * stopSequence — which stop this milestone refers to.
     * Only set for stop_reached / stop_departed milestones.
     */
    stopSequence: {
      type:    Number,
      default: null,
    },

    /**
     * meta — flexible bag for milestone-specific extra data.
     * Examples:
     *   route_deviated: { deviationKm: 2.3 }
     *   driver_replaced: { newDriverId: '...' }
     *   sos_triggered:   { sosType: 'medical' }
     */
    meta: {
      type:    Schema.Types.Mixed,
      default: null,
    },

    /**
     * recordedBy — who/what recorded this milestone.
     * 'driver' = driver app, 'system' = server logic, 'admin' = manual entry
     */
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

/**
 * etaUpdateSchema — history of ETA calculations for analytics.
 * Useful for measuring driver punctuality and route efficiency.
 */
const etaUpdateSchema = new Schema(
  {
    toWaypoint:        { type: String },   // 'pickup' | 'stop_1' | 'dropoff'
    etaMinutes:        { type: Number },
    distanceRemainingKm:{ type: Number },
    calculatedAt:      { type: Date, default: Date.now },
    source:            { type: String, enum: ['google_maps', 'osrm', 'estimate'], default: 'estimate' },
  },
  { _id: false }
);

/**
 * sosEventSchema — emergency SOS records. Critical data, never deleted.
 */
const sosEventSchema = new Schema(
  {
    triggeredBy:       { type: String, enum: ['driver', 'customer', 'care_assistant', 'system'] },
    triggeredByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    sosType:           { type: String, enum: ['medical', 'safety', 'accident', 'other'] },
    coordinates:       { type: [Number] },         // [lng, lat] at time of SOS
    description:       { type: String },
    resolvedAt:        { type: Date },
    resolvedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes:   { type: String },
    triggeredAt:       { type: Date, default: Date.now },
    isResolved:        { type: Boolean, default: false },
  },
  { _id: true }
);

/**
 * routeDeviationSchema — records when driver strays significantly from expected path.
 * Triggers alert to admin and customer.
 */
const routeDeviationSchema = new Schema(
  {
    detectedAt:     { type: Date, default: Date.now },
    coordinates:    { type: [Number] },           // [lng, lat] at deviation point
    deviationKm:    { type: Number },              // how far from expected route
    wasAcknowledged:{ type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    driverReason:   { type: String },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const rideTrackingSchema = new Schema(
  {
    // ── Ride Link ─────────────────────────────────────────────────────────────
    /**
     * ride — back-reference to the Ride document.
     * Required. One RideTracking per Ride.
     */
    ride: {
      type:     Schema.Types.ObjectId,
      ref:      'Ride',
      required: true,
      unique:   true,   // enforce 1:1
      index:    true,
    },

    /**
     * booking — denormalized for direct queries without joining Ride.
     * e.g. "fetch all tracking for bookings today"
     */
    booking: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },

    /**
     * driver — denormalized for direct driver-based queries.
     */
    driver: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
      index:   true,
    },

    // ── GPS Breadcrumbs ───────────────────────────────────────────────────────
    /**
     * breadcrumbs — ring buffer of GPS pings.
     * New pings are pushed; when length exceeds MAX_BREADCRUMBS,
     * the oldest are sliced off (done in addBreadcrumb static method).
     *
     * These are NOT indexed — only accessed as a full array pull.
     * For production scale, emit to time-series DB and store only last 200 here.
     */
    breadcrumbs: {
      type:    [breadcrumbSchema],
      default: [],
    },

    breadcrumbCount: {
      type:    Number,
      default: 0,
      min:     0,
      comment: 'Total GPS pings received including dropped ones (for analytics)',
    },

    // ── Milestones ────────────────────────────────────────────────────────────
    /**
     * milestones — ordered list of named ride events.
     * New milestones pushed as ride progresses.
     * Used to render customer-facing ride timeline.
     */
    milestones: {
      type:    [milestoneSchema],
      default: [],
    },

    // ── ETA ───────────────────────────────────────────────────────────────────
    /**
     * currentEtaMinutes — latest calculated ETA to the NEXT waypoint.
     * Written on each GPS recalculation.
     * Also stored on Ride.currentEtaMinutes for fast API reads without join.
     */
    currentEtaMinutes: {
      type:    Number,
      default: null,
    },

    currentEtaTarget: {
      type:    String,  // 'pickup' | 'stop_1' | 'dropoff'
      default: null,
    },

    etaUpdates: {
      type:    [etaUpdateSchema],
      default: [],
      comment: 'History of ETA calculations — capped at 100 entries',
    },

    // ── Route Summary ─────────────────────────────────────────────────────────
    /**
     * totalDistanceKm — running sum of GPS ping-to-ping distances.
     * Updated on each breadcrumb push.
     */
    totalDistanceKm: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * expectedRoutePolyline — encoded Google Maps polyline of planned route.
     * Set once at ride start. Used for deviation detection.
     */
    expectedRoutePolyline: {
      type:    String,
      default: null,
    },

    /**
     * actualRoutePolyline — encoded polyline of actual path taken.
     * Generated from breadcrumbs at ride completion.
     */
    actualRoutePolyline: {
      type:    String,
      default: null,
    },

    // ── SOS & Safety ─────────────────────────────────────────────────────────
    sosEvents: {
      type:    [sosEventSchema],
      default: [],
    },

    hasActiveSos: {
      type:    Boolean,
      default: false,
      index:   true,  // indexed for quick admin dashboard alert queries
    },

    // ── Route Deviations ──────────────────────────────────────────────────────
    routeDeviations: {
      type:    [routeDeviationSchema],
      default: [],
    },

    hasUnacknowledgedDeviation: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    // ── Summary Stats (populated at completion) ───────────────────────────────
    /**
     * summary — computed when ride reaches 'completed' status.
     * Denormalized for reporting without re-processing breadcrumbs.
     */
    summary: {
      totalDistanceKm:    { type: Number },
      totalDurationMin:   { type: Number },
      avgSpeedKmh:        { type: Number },
      maxSpeedKmh:        { type: Number },
      pickupWaitMin:      { type: Number }, // driver_arrived → otp_verified
      totalStopWaitMin:   { type: Number }, // sum of all stop waits
      totalPingsReceived: { type: Number },
      isCompleted:        { type: Boolean, default: false },
      completedAt:        { type: Date },
    },

    // ── Archival ──────────────────────────────────────────────────────────────
    /**
     * isArchived — true when breadcrumbs have been offloaded to cold storage.
     * Admin queries should check this flag before requesting breadcrumb data.
     */
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
 * addBreadcrumb — push a GPS ping, maintain ring buffer cap.
 *
 * Usage:
 *   await RideTracking.addBreadcrumb(rideId, { coordinates: [lng, lat], speedKmh: 40, heading: 180 });
 */
rideTrackingSchema.statics.addBreadcrumb = async function (rideId, pingData) {
  const { coordinates, heading, speedKmh, accuracyM, source } = pingData;

  // Calculate incremental distance from last position
  const tracking = await this.findOne({ ride: rideId })
    .select('breadcrumbs totalDistanceKm breadcrumbCount')
    .lean();

  if (!tracking) throw new Error(`RideTracking not found for ride: ${rideId}`);

  let incrementalKm = 0;
  const last = tracking.breadcrumbs?.[tracking.breadcrumbs.length - 1];
  if (last?.coordinates?.length === 2) {
    incrementalKm = haversineKm(last.coordinates, coordinates);
  }

  const breadcrumb = {
    coordinates,
    heading,
    speedKmh,
    accuracyM,
    source: source ?? 'fused',
    timestamp: new Date(),
  };

  const update = {
    $push: {
      breadcrumbs: {
        $each:  [breadcrumb],
        $slice: -MAX_BREADCRUMBS, // keep latest MAX_BREADCRUMBS, drop oldest
      },
    },
    $inc: {
      totalDistanceKm: incrementalKm,
      breadcrumbCount: 1,
    },
  };

  return this.findOneAndUpdate({ ride: rideId }, update, { new: true })
    .select('totalDistanceKm breadcrumbCount currentEtaMinutes');
};

/**
 * addMilestone — record a named lifecycle event.
 *
 * Usage:
 *   await RideTracking.addMilestone(rideId, 'driver_arrived', { coordinates: [lng, lat] });
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
 * triggerSos — record an SOS event and set hasActiveSos = true.
 *
 * Usage:
 *   await RideTracking.triggerSos(rideId, { triggeredBy: 'driver', sosType: 'medical', coordinates: [lng, lat] });
 */
rideTrackingSchema.statics.triggerSos = async function (rideId, sosData) {
  const sosEvent = {
    ...sosData,
    triggeredAt: new Date(),
    isResolved:  false,
  };

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
 * resolveSos — mark SOS as resolved.
 */
rideTrackingSchema.statics.resolveSos = async function (rideId, sosEventId, resolvedBy, resolutionNotes) {
  return this.findOneAndUpdate(
    { ride: rideId, 'sosEvents._id': sosEventId },
    {
      $set: {
        'sosEvents.$.isResolved':     true,
        'sosEvents.$.resolvedAt':     new Date(),
        'sosEvents.$.resolvedBy':     resolvedBy,
        'sosEvents.$.resolutionNotes':resolutionNotes,
        hasActiveSos:                 false,
      },
    },
    { new: true }
  );
};

/**
 * computeSummary — called when ride completes.
 * Derives stats from breadcrumbs and milestones.
 */
rideTrackingSchema.statics.computeSummary = async function (rideId) {
  const tracking = await this.findOne({ ride: rideId }).lean();
  if (!tracking) return null;

  const crumbs = tracking.breadcrumbs ?? [];
  const speeds = crumbs.map(c => c.speedKmh).filter(s => s != null && s >= 0);

  const avgSpeed = speeds.length
    ? +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)
    : 0;
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

  // Pickup wait = driver_arrived → otp_verified
  const arrivedMs = tracking.milestones?.find(m => m.name === 'driver_arrived')?.occurredAt;
  const otpMs     = tracking.milestones?.find(m => m.name === 'otp_verified')?.occurredAt;
  const pickupWaitMin = arrivedMs && otpMs
    ? Math.round((new Date(otpMs) - new Date(arrivedMs)) / 60000)
    : 0;

  // Total stop wait
  const stopDeparted = tracking.milestones?.filter(m => m.name === 'stop_departed') ?? [];
  const stopArrived  = tracking.milestones?.filter(m => m.name === 'stop_reached')  ?? [];
  let totalStopWaitMin = 0;
  for (let i = 0; i < Math.min(stopArrived.length, stopDeparted.length); i++) {
    totalStopWaitMin += Math.round(
      (new Date(stopDeparted[i].occurredAt) - new Date(stopArrived[i].occurredAt)) / 60000
    );
  }

  const summary = {
    totalDistanceKm:    +tracking.totalDistanceKm.toFixed(2),
    totalDurationMin:   null, // computed by caller from Ride timestamps
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
    { $set: { summary } },
    { new: true }
  ).select('summary');
};

// ── Pre-save ──────────────────────────────────────────────────────────────────

rideTrackingSchema.pre('save', function () {
  // Cap etaUpdates at 100 entries
  if (this.isModified('etaUpdates') && this.etaUpdates.length > 100) {
    this.etaUpdates = this.etaUpdates.slice(-100);
  }

  // Sync hasActiveSos from sosEvents array
  if (this.isModified('sosEvents')) {
    this.hasActiveSos = this.sosEvents.some(e => !e.isResolved);
  }

  // Sync hasUnacknowledgedDeviation from routeDeviations array
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

/**
 * haversineKm — great-circle distance between two [lng, lat] points.
 * Used to accumulate totalDistanceKm from GPS pings.
 */
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