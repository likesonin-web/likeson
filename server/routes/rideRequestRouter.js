/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RIDE REQUEST ROUTER — Likeson.in
 * routes/rideRequestRouter.js
 *
 * Standalone ride request (NOT tied to booking creation).
 * Customer or care assistant requests transport only.
 *
 * FLOW:
 *   Customer/CA → POST /customer           → creates Ride (status: searching)
 *   Customer/CA → POST /care-assistant     → CA requests ride for patient
 *   Admin       → GET  /admin/all          → list pending requests
 *   Admin       → GET  /admin/:id/nearby   → 30km driver/TP search
 *   Admin       → POST /admin/:id/assign   → assign TP or SoloDriver
 *   TP          → PATCH /tp/:id/assign-driver → TP assigns driver
 *
 * DRIVER STATE MACHINE (Uber/Rapido pattern):
 *   PATCH /:rideId/status { action }
 *     accept       → driver_accepted
 *     start_route  → driver_en_route
 *     arrived      → driver_arrived  (generates + sends OTP to customer + admin)
 *     verify_otp   → otp_verified    (RAW string compare — matches 'arrived' storage)
 *     start_ride   → in_progress     (map switches to dropoff for ALL roles)
 *     at_stop      → at_stop
 *     resume       → in_progress
 *     complete     → completed
 *     cancel       → cancelled
 *
 * LIVE TRACKING:
 *   GET  /:rideId/live            → lightweight position + ETA (polling fallback)
 *   GET  /:rideId/tracking        → full snapshot (breadcrumbs, milestones, polyline)
 *   POST /:rideId/tracking/milestone → HTTP milestone write (offline retry)
 *
 * FIXES IN THIS VERSION:
 *   - createRideRequest() helper defined (was called but never declared → ReferenceError)
 *   - ensureRideTracking() uses upsert → no duplicate RideTracking docs
 *   - verify_otp: RAW string compare (pickupOtp stored raw in 'arrived' case)
 *   - Socket bookingSocketService.js must also use raw compare (not hashOtp)
 *   - Ride.driver = Driver._id (NOT User._id) — consistent throughout
 *   - role strings: 'care_assistant' (underscore, NOT space)
 *   - OTP generated on 'arrived' action only. Sent to customer + admin:ops
 *   - Socket is primary for live events; HTTP is initial load + fallback
 *   - Canonical route locked at driver assignment (async, non-blocking)
 *
 * MOUNT: /api/ride-requests
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express  from 'express';
import mongoose from 'mongoose';

import Ride                 from '../models/Ride.js';
import Driver               from '../models/Driver.js';
import TransportPartner     from '../models/TransportPartner.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import User                 from '../models/User.js';
import Booking              from '../models/Booking.js';
import RideTracking         from '../models/RideTracking.js';

import { protect, authorize }      from '../middleware/authMiddleware.js';
import { getBookingSocketService } from '../services/bookingSocketService.js';
import sendSms                     from '../services/Sendsms.js';
import { otpSms }                  from '../utils/Smstemplates.js';
import {
  genOtp,
  haversineKm,
  createNotification,
  buildRidePayload,
  resolveCareRideKmRate,
  calculateCanonicalRoute,
  findNearestHospital,
calculateEtaMinutes,
  CARE_RIDE_RADIUS_M,
  RIDE_STATUSES_ACTIVE,
} from './bookingRouterShared.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CARE_RIDE_RADIUS_RAD = CARE_RIDE_RADIUS_M / 1000 / 6378.1; // 30 km in radians

/** Cancellable statuses (driver can cancel before driver_arrived; admin anytime) */
const CANCELLABLE_STATUSES        = ['searching', 'driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived'];
const DRIVER_CANCELLABLE_STATUSES = ['searching', 'driver_assigned', 'driver_accepted', 'driver_en_route'];

/** Socket event per ride status */
const STATUS_SOCKET_EVENT = {
  driver_accepted: 'driver_accepted',
  driver_en_route: 'driver_en_route',
  driver_arrived:  'driver_arrived',
  otp_verified:    'otp_verified',
  in_progress:     'ride_started',
  at_stop:         'at_stop',
  completed:       'ride_completed',
  cancelled:       'ride_cancelled',
};

/** Milestone name per ride status */
const STATUS_MILESTONE = {
  driver_accepted: 'driver_accepted',
  driver_en_route: 'driver_en_route',
  driver_arrived:  'driver_arrived',
  otp_verified:    'otp_verified',
  in_progress:     'ride_started',
  at_stop:         'stop_reached',
  completed:       'ride_completed',
  cancelled:       'ride_cancelled',
};

/** Milestones that escalate to admin:ops alert */
const ADMIN_ALERT_MILESTONES = [
  'sos_triggered', 'vehicle_breakdown', 'route_deviated',
  'driver_replaced', 'ride_cancelled',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const isValidObjId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateLocations = (pickup, destination) => {
  if (!pickup?.coordinates?.length)       return 'pickupLocation.coordinates required';
  if (!destination?.coordinates?.length)  return 'destinationLocation.coordinates required';
  const [pLng, pLat] = pickup.coordinates;
  const [dLng, dLat] = destination.coordinates;
  if (pLng === dLng && pLat === dLat)     return 'Pickup and destination cannot be the same location';
  return null;
};

const buildGeo = (loc) => ({
  type:        'Point',
  coordinates: loc.coordinates,
  label:       loc.label   || '',
  address:     loc.address || '',
  city:        loc.city    || '',
});

/**
 * Resolve Driver._id from User._id.
 * Ride.driver = Driver._id always.
 */
const resolveDriverId = async (userId) => {
  const dr = await Driver.findOne({ user: userId }).select('_id').lean();
  return dr ? dr._id : null;
};

/**
 * Get customer User._id from a ride (via booking).
 */
const getCustomerFromRide = async (ride) => {
  if (!ride.booking) return null;
  const booking = await Booking.findById(ride.booking).select('customer').lean();
  return booking?.customer || null;
};

const resolveRideWaypoints = async ({
  pickupGeo,
  dropoffGeo,
  careAssistantProfile,
}) => {

  const waypoints = [];

  if (
    careAssistantProfile?.currentLocation?.coordinates?.length
  ) {

    const caCoords =
      careAssistantProfile.currentLocation.coordinates;

    const patientDistance = haversineKm(
      caCoords,
      pickupGeo.coordinates
    );

    const hospitalDistance = haversineKm(
      caCoords,
      dropoffGeo.coordinates
    );

    const shouldPickupCAFirst =
      patientDistance < hospitalDistance;

    waypoints.push({
      type: 'care_assistant_join',
      pickupFirst: shouldPickupCAFirst,

      location: {
        type: 'Point',
        coordinates: caCoords,
        address:
          careAssistantProfile.currentLocation.address || '',
      },
    });
  }

  return waypoints;
};

/**
 * FIX: createRideRequest — was called in both POST /customer and POST /care-assistant
 * but never defined, causing ReferenceError on every ride creation.
 * Creates a minimal Ride doc with status:'searching'.
 */
const createRideRequest = async ({
  pickupGeo,
  dropoffGeo,
  scheduledAt,
  bookingId,
  createdBy,
  careAssistantId = null,
}) => {

  let nearestHospitalData = null;

  try {
    nearestHospitalData = await findNearestHospital(
      dropoffGeo.coordinates
    );
  } catch (e) {
    console.error('[nearestHospital]', e.message);
  }

  const ride = await Ride.create({
    ...buildRidePayload({
      bookingId,
      rideType: 'patient',
      vehicleClass: 'four_wheeler',

      pickupCoords: pickupGeo.coordinates,
      pickupAddress: pickupGeo.address || '',
      pickupCity: pickupGeo.city || '',

      dropoffCoords: dropoffGeo.coordinates,
      dropoffAddress: dropoffGeo.address || '',
      dropoffCity: dropoffGeo.city || '',
      waypoints: dynamicWaypoints,

activeNavigationTarget:
  dynamicWaypoints.length
    ? 'pickup_care_assistant'
    : 'pickup_patient',

      scheduledPickupAt: scheduledAt || null,
      createdBy,
    }),

    status: 'searching',
  });

  const careAssistantProfileDoc =
  careAssistantId
    ? await CareAssistantProfile.findById(
        careAssistantId
      ).lean()
    : null;

const dynamicWaypoints =
  await resolveRideWaypoints({
    pickupGeo,
    dropoffGeo,
    careAssistantProfile:
      careAssistantProfileDoc,
  });

  await RideTracking.findOneAndUpdate(
    { ride: ride._id },
    {
      $set: {
        booking: bookingId,

        ride: ride._id,

        careAssistant: careAssistantId,

        hospital: nearestHospitalData?.hospital?._id || null,

        activeTarget: careAssistantId
          ? 'pickup_care_assistant'
          : 'pickup_patient',

        'liveRouteContext.nearestHospitalDistanceKm':
          nearestHospitalData?.distanceKm || 0,

        'liveRouteContext.currentLegEtaMinutes':
          nearestHospitalData?.etaMinutes || 0,

        'liveRouteContext.nearestHospitalCalculatedAt':
          new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    }
  );

  return {
    ride,
    nearestHospitalData,
  };
};

/**
 * canAccessRide — DB-verified access check.
 * FIX: Ride.driver = Driver._id. Resolve Driver._id from User._id for comparison.
 */
const canAccessRide = async (userId, role, ride) => {
  if (['admin', 'superadmin'].includes(role)) return { allowed: true };

  if (role === 'customer' && ride.booking) {
    const booking = await Booking.findById(ride.booking).select('customer').lean();
    if (booking?.customer?.toString() === userId) return { allowed: true };
  }

  // FIX: Ride.driver = Driver._id — resolve from User._id
  if (['driver', 'solodriverpartner'].includes(role)) {
    const driverObjId = await resolveDriverId(userId);
    if (driverObjId && ride.driver?.toString() === driverObjId.toString())
      return { allowed: true };
  }

  // 'care_assistant' underscore
  if (role === 'care_assistant' && ride.booking) {
    const ca = await CareAssistantProfile.findOne({ user: userId }).select('_id').lean();
    if (ca) {
      const booking = await Booking.findById(ride.booking).select('careAssistant').lean();
      if (booking?.careAssistant?.toString() === ca._id.toString()) return { allowed: true };
    }
  }

  if (role === 'transportpartner' && ride.transportPartner) {
    const tp = await TransportPartner.findOne({ user: userId }).select('_id').lean();
    if (tp && ride.transportPartner.toString() === tp._id.toString()) return { allowed: true };
  }

  return { allowed: false, reason: 'Not authorised to access this ride' };
};

/**
 * canDriverMutateRide — for state machine actions.
 * FIX: Ride.driver = Driver._id — resolve from User._id.
 */
const canDriverMutateRide = async (userId, role, ride) => {
  if (['admin', 'superadmin'].includes(role)) return { allowed: true };
  if (!['driver', 'solodriverpartner'].includes(role))
    return { allowed: false, reason: 'Driver only action' };

  const driverObjId = await resolveDriverId(userId);
  if (driverObjId && ride.driver?.toString() === driverObjId.toString())
    return { allowed: true };

  return { allowed: false, reason: 'You are not the assigned driver for this ride' };
};

/**
 * FIX: ensureRideTracking — uses findOneAndUpdate with upsert + $setOnInsert.
 * Previous version used findOne + create in two steps → race condition between
 * admin assign and TP assign could create two RideTracking docs for same ride.
 * Requires unique index on RideTracking: { ride: 1 }
 * Add to RideTracking model if missing: rideTrackingSchema.index({ ride: 1 }, { unique: true })
 */
const ensureRideTracking = async (ride) => {
  const tracking = await RideTracking.findOneAndUpdate(
    { ride: ride._id },
    {
      $setOnInsert: {
        ride:              ride._id,
        booking:           ride.booking || null,
        driver:            ride.driver  || null, // ← Driver._id (correct)
        breadcrumbs:       [],
        breadcrumbCount:   0,
        milestones:        [],
        hasActiveSos:      false,
        totalDistanceKm:   ride.estimatedDistanceKm  || 0,
        currentEtaMinutes: ride.estimatedDurationMin || null,
      },
    },
    { upsert: true, new: true }
  );
  return tracking;
};

/**
 * Lock canonical route after driver assignment.
 * Non-blocking — called with .then() / .catch() after response sent.
 * Stores polyline in RideTracking.expectedRoutePolyline.
 */
const lockCanonicalRouteAsync = (ride, trackingId) => {
  if (!ride.pickup?.coordinates || !ride.dropoff?.coordinates) return;
  calculateCanonicalRoute(ride.pickup.coordinates, ride.dropoff.coordinates)
    .then(async ({ distanceKm, durationMin, polyline }) => {
      await Promise.all([
        Ride.findByIdAndUpdate(ride._id, {
          $set: {
            estimatedDistanceKm:  distanceKm,
            estimatedDurationMin: durationMin,
          },
        }),
        RideTracking.findByIdAndUpdate(trackingId, {
          $set: {
            totalDistanceKm:       distanceKm,
            currentEtaMinutes:     durationMin,
            expectedRoutePolyline: polyline,
          },
        }),
      ]);
    })
    .catch(e => console.error('[lockCanonicalRoute]', e.message));
};

/**
 * broadcastRideStatus — emit socket events + record milestone.
 */
const broadcastRideStatus = async ({ ride, newStatus, extraPayload = {}, socketService }) => {
  if (!socketService) return;

  const event = STATUS_SOCKET_EVENT[newStatus];
  if (!event) return;

  const basePayload = {
    rideId:    String(ride._id),
    bookingId: ride.booking ? String(ride.booking) : null,
    status:    newStatus,
    timestamp: new Date().toISOString(),
    ...extraPayload,
  };

  if (ride.booking) {
    socketService.emitToRoom(`booking:${ride.booking}`, event, basePayload);
  }

  socketService.emitToAdminOps('ride_status_changed', { ...basePayload, event });

  // Record milestone
  const milestoneName = STATUS_MILESTONE[newStatus];
  if (milestoneName) {
    const coords = ride.liveLocation?.coordinates || null;
    try {
      await RideTracking.addMilestone(String(ride._id), milestoneName, {
        coordinates:      coords,
        recordedBy:       'driver',
        recordedByUserId: ride.driver, // ← Driver._id
      });
    } catch (e) {
      console.error('[broadcastRideStatus] milestone:', e.message);
    }
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMER — request new standalone ride
// POST /api/ride-requests/customer
// ═════════════════════════════════════════════════════════════════════════════

router.post('/customer',
  protect, authorize('customer'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation, scheduledAt, bookingId, notes } = req.body;

      const locErr = validateLocations(pickupLocation, destinationLocation);
      if (locErr) return res.status(400).json({ success: false, message: locErr });

      if (bookingId) {
        if (!isValidObjId(bookingId))
          return res.status(400).json({ success: false, message: 'Invalid bookingId' });

        const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id })
          .select('_id').lean();
        if (!booking)
          return res.status(404).json({ success: false, message: 'Booking not found or not yours' });

        const activeRide = await Ride.findOne({ booking: bookingId, status: { $in: RIDE_STATUSES_ACTIVE } })
          .select('_id').lean();
        if (activeRide)
          return res.status(400).json({ success: false, message: 'Active ride already exists on this booking' });
      }

      const pickupGeo    = buildGeo(pickupLocation);
      const dropoffGeo   = buildGeo(destinationLocation);
      const [pLng, pLat] = pickupLocation.coordinates;

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(req.user._id);
      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      const nearbyCount = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        location: { $geoWithin: { $centerSphere: [[pLng, pLat], CARE_RIDE_RADIUS_RAD] } },
      });

      // FIX: createRideRequest now defined above
      const { ride } = await createRideRequest({
        pickupGeo, dropoffGeo, scheduledAt,
        bookingId:  bookingId || null,
        createdBy:  req.user._id,
      });

      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          $push: { rides: ride._id },
          $set: {
            primaryRide:                  ride._id,
            patientLocation:              pickupGeo,
            destinationLocation:          dropoffGeo,
            'fareBreakdown.transportFee': transportFee,
          },
        });

        getBookingSocketService()?.emitJoinRoom(String(req.user._id), `booking:${bookingId}`);
      }

      getBookingSocketService()?.emitToAdminOps('ride_requested', {
        rideId:         ride._id,
        bookingId:      bookingId || null,
        requesterType:  'customer',
        customerId:     req.user._id,
        pickup:         pickupGeo,
        destination:    dropoffGeo,
        distKm:         +distKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby: nearbyCount === 0,
        searchRadiusKm: 30,
        notes:          notes || null,
        timestamp:      new Date(),
      });

      return res.status(201).json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Waiting for admin to assign driver.',
        data: {
          rideId:         ride._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +distKm.toFixed(2),
          ratePerKm, rateSource, transportFee,
          searchRadiusKm: 30,
          status:         'searching',
          socketHint: bookingId
            ? { room: `booking:${bookingId}`, event: 'ride_assigned' }
            : null,
        },
      });
    } catch (err) {
      console.error('[POST /customer]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT — request ride for patient
// POST /api/ride-requests/care-assistant
// ═════════════════════════════════════════════════════════════════════════════

router.post('/care-assistant',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation, scheduledAt, bookingId, notes } = req.body;

      const locErr = validateLocations(pickupLocation, destinationLocation);
      if (locErr) return res.status(400).json({ success: false, message: locErr });

      if (!bookingId)
        return res.status(400).json({ success: false, message: 'bookingId required for care assistant ride request' });
      if (!isValidObjId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });

      const profile = await CareAssistantProfile.findOne({ user: req.user._id })
        .select('_id fullName').lean();
      if (!profile)
        return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({
        _id:           bookingId,
        careAssistant: profile._id,
        status:        { $in: ['confirmed', 'in_progress'] },
      }).select('_id customer scheduledAt bookingCode').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      const activeRide = await Ride.findOne({ booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE } })
        .select('_id').lean();
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists on this booking' });

      const pickupGeo    = buildGeo(pickupLocation);
      const dropoffGeo   = buildGeo(destinationLocation);
      const [pLng, pLat] = pickupLocation.coordinates;

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);
      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      const nearbyCount = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        location: { $geoWithin: { $centerSphere: [[pLng, pLat], CARE_RIDE_RADIUS_RAD] } },
      });

      const { ride } = await createRideRequest({
        pickupGeo, dropoffGeo,
        scheduledAt: scheduledAt || booking.scheduledAt,
        bookingId:   booking._id,
        createdBy:   req.user._id,
      });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set: {
          primaryRide:                  ride._id,
          patientLocation:              pickupGeo,
          destinationLocation:          dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
        },
      });

      const socketService = getBookingSocketService();
      socketService?.emitJoinRoom(String(booking.customer), `booking:${booking._id}`);

      socketService?.emitToAdminOps('ride_requested', {
        rideId:            ride._id,
        bookingId:         booking._id,
        bookingCode:       booking.bookingCode,
        requesterType:     'care_assistant',
        careAssistantId:   profile._id,
        careAssistantName: profile.fullName,
        customerId:        booking.customer,
        pickup:            pickupGeo,
        destination:       dropoffGeo,
        distKm:            +distKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby:    nearbyCount === 0,
        searchRadiusKm:    30,
        notes:             notes || null,
        timestamp:         new Date(),
      });

      socketService?.emitToRoom(`booking:${booking._id}`, 'ride_requested', {
        rideId:       ride._id,
        requestedBy:  'care_assistant',
        pickup:       pickupGeo,
        destination:  dropoffGeo,
        distKm:       +distKm.toFixed(2),
        transportFee,
        timestamp:    new Date(),
      });

      await createNotification({
        recipient: booking.customer,
        title:     'Ride Requested',
        body:      'Your care assistant requested a ride for your appointment.',
        type:      'Ride_Update',
        bookingId: booking._id,
      });

      return res.status(201).json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Waiting for admin to assign driver.',
        data: {
          rideId:         ride._id,
          bookingId:      booking._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +distKm.toFixed(2),
          ratePerKm, rateSource, transportFee,
          searchRadiusKm: 30,
          status:         'searching',
          socketHint:     { room: `booking:${booking._id}`, event: 'ride_assigned' },
        },
      });
    } catch (err) {
      console.error('[POST /care-assistant]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMER/CA/DRIVER/TP — get single ride
// GET /api/ride-requests/:rideId
// ═════════════════════════════════════════════════════════════════════════════

router.get('/:rideId',
  protect,
  authorize('customer', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      if (!isValidObjId(req.params.rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(req.params.rideId)
        .select('-pickupOtp')
        .populate('booking', 'bookingCode bookingType status')
        .lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const { allowed, reason } = await canAccessRide(String(req.user._id), req.user.role, ride);
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      return res.json({ success: true, data: { ride } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — list all rides by status
// GET /api/ride-requests/admin/all
// ═════════════════════════════════════════════════════════════════════════════

router.get('/admin/all',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { status = 'searching', page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [rides, total] = await Promise.all([
        Ride.find({ status })
          .select('-pickupOtp')
          .populate('booking', 'bookingCode bookingType customer patientInfo status')
          .sort({ createdAt: -1 })
          .skip(skip).limit(parseInt(limit))
          .lean(),
        Ride.countDocuments({ status }),
      ]);

      return res.json({
        success: true,
        data: { rides, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — nearby drivers/TPs for a ride (30 km)
// GET /api/ride-requests/admin/:rideId/nearby
// ═════════════════════════════════════════════════════════════════════════════

router.get('/admin/:rideId/nearby',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      if (!isValidObjId(req.params.rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(req.params.rideId).select('pickup dropoff booking').lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const coords = ride.pickup?.coordinates;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'Ride has no pickup coordinates' });

      const [lng, lat] = coords;

      const [soloDrivers, agencyDrivers, tps] = await Promise.all([
        Driver.find({
          soloPartner: { $ne: null },
          isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], CARE_RIDE_RADIUS_RAD] } },
        })
          .populate('soloPartner', 'legalName phone vehicle partnershipStatus isOnboardingComplete')
          .select('_id driverCode location performance assignedVehicleSnapshot soloPartner')
          .limit(15).lean(),

        Driver.find({
          ownerAgency: { $ne: null },
          isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], CARE_RIDE_RADIUS_RAD] } },
        })
          .populate('ownerAgency', 'businessName partnershipStatus')
          .select('_id driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency user')
          .limit(15).lean(),

        TransportPartner.find({ partnershipStatus: 'active', isAvailable: true })
          .select('_id businessName ownerPhone fleetInfo serviceZones isOnboardingComplete')
          .limit(10).lean(),
      ]);

      const booking = ride.booking
        ? await Booking.findById(ride.booking).select('customer').lean()
        : null;
      const { ratePerKm, source: rateSource } = booking
        ? await resolveCareRideKmRate(booking.customer)
        : { ratePerKm: 21, source: 'care_ride_default' };

      const distKm = ride.dropoff?.coordinates
        ? haversineKm(coords, ride.dropoff.coordinates)
        : 0;

      return res.json({
        success: true,
        data: {
          rideId:         ride._id,
          searchRadiusKm: 30,
          ratePerKm, rateSource,
          distKm:         +distKm.toFixed(2),
          estimatedFare:  +(distKm * ratePerKm).toFixed(2),

          soloDrivers: soloDrivers
            .filter(d => d.soloPartner?.partnershipStatus === 'active' && d.soloPartner?.isOnboardingComplete)
            .map(d => ({
              driverId:   d._id, // ← Driver._id (for assign body)
              soloId:     d.soloPartner?._id,
              name:       d.soloPartner?.legalName,
              phone:      d.soloPartner?.phone,
              vehicle:    d.assignedVehicleSnapshot,
              rating:     d.performance?.rating,
              distanceKm: +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
            })),

          agencyDrivers: agencyDrivers
            .filter(d => d.ownerAgency?.partnershipStatus === 'active')
            .map(d => ({
              driverId:   d._id, // ← Driver._id
              agencyId:   d.ownerAgency?._id,
              agencyName: d.ownerAgency?.businessName,
              name:       d.legalName,
              phone:      d.phone,
              vehicle:    d.assignedVehicleSnapshot,
              rating:     d.performance?.rating,
              distanceKm: +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
            })),

          transportPartners: tps
            .filter(tp => tp.isOnboardingComplete)
            .map(tp => ({
              tpId:          tp._id,
              businessName:  tp.businessName,
              ownerPhone:    tp.ownerPhone,
              totalDrivers:  tp.fleetInfo?.totalDrivers  || 0,
              activeDrivers: tp.fleetInfo?.activeDrivers || 0,
            })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — assign TP or SoloDriver to ride
// POST /api/ride-requests/admin/:rideId/assign
// Body: { assignType: 'tp'|'solo', assignId }
// ═════════════════════════════════════════════════════════════════════════════

router.post('/admin/:rideId/assign',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { assignType, assignId } = req.body;

      if (!['tp', 'solo'].includes(assignType))
        return res.status(400).json({ success: false, message: 'assignType must be tp or solo' });
      if (!assignId || !isValidObjId(assignId))
        return res.status(400).json({ success: false, message: 'assignId (valid ObjectId) required' });
      if (!isValidObjId(req.params.rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(req.params.rideId);
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['searching', 'requested'].includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot assign from status: ${ride.status}` });

      const socketService = getBookingSocketService();

      // ── Assign Transport Partner ──────────────────────────────────────────
      if (assignType === 'tp') {
        const tp = await TransportPartner.findOne({
          _id: assignId, partnershipStatus: 'active', isAvailable: true,
        }).populate('user', 'name phone email').lean();
        if (!tp)
          return res.status(404).json({ success: false, message: 'Transport partner not found or not active' });

        ride.transportPartner = tp._id;
        ride.status           = 'searching'; // TP still needs to assign driver
        await ride.save();

        await createNotification({
          recipient: tp.user._id,
          title:     'New Ride Request',
          body:      'New ride assigned to your fleet. Please assign a driver.',
          type:      'Ride_Request',
          bookingId: ride.booking,
        });

        socketService?.emitToRoom(`tp:${tp._id}`, 'ride_request_assigned', {
          rideId:      ride._id,
          pickup:      ride.pickup,
          destination: ride.dropoff,
          scheduledAt: ride.scheduledPickupAt,
          timestamp:   new Date(),
        });

        socketService?.emitToAdminOps('ride_driver_assigned', {
          rideId:    ride._id,
          type:      'tp_pending_driver',
          tpId:      tp._id,
          tpName:    tp.businessName,
          timestamp: new Date(),
        });

        return res.json({
          success: true,
          message: 'Transport partner assigned. Waiting for driver assignment from TP.',
          data:    { rideId: ride._id, assignedTo: 'tp', tpId: tp._id },
        });
      }

      // ── Assign Solo Driver ────────────────────────────────────────────────
      // assignId = SoloDriverPartner._id (admin picks from nearby results)
      const soloPartner = await SoloDriverPartner.findOne({
        _id: assignId, partnershipStatus: 'active', isOnboardingComplete: true,
      }).populate('user', 'name phone').lean();
      if (!soloPartner)
        return res.status(404).json({ success: false, message: 'Solo driver partner not found or not active' });
      if (!soloPartner.driverProfile)
        return res.status(400).json({ success: false, message: 'Solo partner has no linked Driver profile' });

      // Ride.driver = Driver._id = soloPartner.driverProfile
      ride.driver           = soloPartner.driverProfile; // ← Driver._id
      ride.soloPartner      = soloPartner._id;
      ride.status           = 'driver_assigned';
      ride.driverAssignedAt = new Date();
      await ride.save();

      // FIX: upsert — no duplicate tracking doc even if called twice
      const tracking = await ensureRideTracking(ride);
      lockCanonicalRouteAsync(ride, tracking._id);

      await createNotification({
        recipient: soloPartner.user._id,
        title:     'New Ride Assigned',
        body:      'New ride request assigned to you.',
        type:      'Ride_Request',
        bookingId: ride.booking,
      });

      if (ride.booking) {
        socketService?.emitJoinRoom(String(soloPartner.user._id), `booking:${ride.booking}`);
        socketService?.emitToRoom(`booking:${ride.booking}`, 'ride_assigned', {
          rideId:         ride._id,
          bookingId:      String(ride.booking),
          status:         'driver_assigned',
          driverSnapshot: { name: soloPartner.user.name, phone: soloPartner.user.phone },
          timestamp:      new Date().toISOString(),
        });
      }

      socketService?.emitToAdminOps('ride_driver_assigned', {
        rideId:     ride._id,
        driverName: soloPartner.user.name,
        type:       'solo',
        timestamp:  new Date(),
      });

      return res.json({
        success: true,
        message: 'Solo driver assigned.',
        data:    { rideId: ride._id, assignedTo: 'solo', soloPartnerId: soloPartner._id },
      });
    } catch (err) {
      console.error('[POST /admin/:rideId/assign]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// TP — assign driver to ride
// PATCH /api/ride-requests/tp/:rideId/assign-driver
// Body: { driverId }  ← Driver._id (NOT User._id)
// ═════════════════════════════════════════════════════════════════════════════

router.patch('/tp/:rideId/assign-driver',
  protect, authorize('transportpartner'),
  async (req, res) => {
    try {
      const { driverId } = req.body; // ← Driver._id
      if (!driverId || !isValidObjId(driverId))
        return res.status(400).json({ success: false, message: 'driverId (Driver._id) required' });
      if (!isValidObjId(req.params.rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!tp)
        return res.status(404).json({ success: false, message: 'Transport partner not found' });

      const ride = await Ride.findOne({
        _id: req.params.rideId, transportPartner: tp._id, status: 'searching',
      });
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found or not assigned to your fleet' });

      const driver = await Driver.findOne({
        _id:         driverId, // ← Driver._id directly
        ownerAgency: tp._id,
        isActive:    true,
        isVerified:  true,
        isBlocked:   false,
        status:      'Available',
      }).select('_id user assignedVehicleSnapshot performance')
        .populate('user', 'name phone')
        .lean();
      if (!driver)
        return res.status(404).json({ success: false, message: 'Driver not found or not available in your fleet' });

      // Ride.driver = Driver._id
      ride.driver           = driver._id; // ← Driver._id
      ride.transportPartner = tp._id;
      ride.status           = 'driver_assigned';
      ride.driverAssignedAt = new Date();
      await ride.save();

      // FIX: upsert — no duplicate tracking doc even if ensureRideTracking called twice
      const tracking = await ensureRideTracking(ride);
      lockCanonicalRouteAsync(ride, tracking._id);

      await createNotification({
        recipient: driver.user._id,
        title:     'Ride Assigned',
        body:      'New ride assigned by your transport partner.',
        type:      'Ride_Request',
        bookingId: ride.booking,
      });

      const socketService = getBookingSocketService();

      if (ride.booking) {
        socketService?.emitJoinRoom(String(driver.user._id), `booking:${ride.booking}`);
        socketService?.emitToRoom(`booking:${ride.booking}`, 'ride_assigned', {
          rideId:         ride._id,
          bookingId:      String(ride.booking),
          status:         'driver_assigned',
          driverSnapshot: {
            name:          driver.user.name,
            phone:         driver.user.phone,
            rating:        driver.performance?.rating,
            vehicleNumber: driver.assignedVehicleSnapshot?.registrationNumber,
          },
          timestamp:      new Date().toISOString(),
        });
      }

      socketService?.emitToAdminOps('ride_driver_assigned', {
        rideId:     ride._id,
        driverName: driver.user.name,
        type:       'agency',
        tpId:       tp._id,
        timestamp:  new Date(),
      });

      return res.json({
        success: true,
        message: 'Driver assigned to ride.',
        data:    { rideId: ride._id, driverId: driver._id, status: ride.status },
      });
    } catch (err) {
      console.error('[PATCH /tp/:rideId/assign-driver]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER STATE MACHINE — PATCH /:rideId/status
//
// Flow: accept → start_route → arrived → verify_otp → start_ride → [at_stop/resume] → complete
//       cancel (driver: before arrived; admin: anytime)
//
// OTP STORAGE STRATEGY (consistent):
//   'arrived'    → stores RAW OTP string in ride.pickupOtp (no hash)
//   'verify_otp' → compares RAW string directly
//   Socket verify_otp in bookingSocketService.js MUST also use raw compare (not hashOtp)
// ═══════════════════════════════════════════════════════════════════════════════

router.patch('/:rideId/status',
  protect,
  authorize('driver', 'solodriverpartner', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId }                                    = req.params;
      const { action, otp, stopIndex, cancelReason, eta } = req.body;

      if (!isValidObjId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });
      if (!action)
        return res.status(400).json({ success: false, message: 'action required' });

      const ride = await Ride.findById(rideId);
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

      const { allowed, reason } = isAdmin
        ? { allowed: true }
        : await canDriverMutateRide(String(req.user._id), req.user.role, ride);
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      const socketService = getBookingSocketService();
      const currentStatus = ride.status;

      switch (action) {

        // ── ACCEPT ───────────────────────────────────────────────────────────
        case 'accept': {
          if (currentStatus !== 'driver_assigned')
            return res.status(400).json({ success: false, message: `Cannot accept from: ${currentStatus}` });

          ride.status           = 'driver_accepted';
          ride.driverAcceptedAt = new Date();
          await ride.save();

          await broadcastRideStatus({ ride, newStatus: 'driver_accepted', socketService });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId, title: 'Driver Accepted',
            body:      'Your driver has accepted the ride.',
            type:      'Ride_Update', bookingId: ride.booking,
          });

          return res.json({ success: true, message: 'Ride accepted.', data: { status: 'driver_accepted' } });
        }

        // ── START_ROUTE ───────────────────────────────────────────────────────
        case 'start_route': {
          if (currentStatus !== 'driver_accepted')
            return res.status(400).json({ success: false, message: `Cannot start_route from: ${currentStatus}` });

          ride.status          = 'driver_en_route';
          ride.driverEnRouteAt = new Date();
          await ride.save();

          const trackingEta = await RideTracking.findOne({ ride: rideId })
            .select('currentEtaMinutes expectedRoutePolyline').lean();

          await broadcastRideStatus({
            ride, newStatus: 'driver_en_route',
            extraPayload: {
              currentEtaMinutes:     trackingEta?.currentEtaMinutes    ?? null,
              expectedRoutePolyline: trackingEta?.expectedRoutePolyline ?? null,
              currentTarget:         'pickup',
              driverSnapshot:        ride.driverSnapshot,
              vehicleSnapshot:       ride.vehicleSnapshot,
            },
            socketService,
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId, title: 'Driver On The Way',
            body:      'Your driver is heading to your pickup location.',
            type:      'Ride_Update', bookingId: ride.booking,
          });

          return res.json({ success: true, message: 'Driver en route.', data: { status: 'driver_en_route' } });
        }

        // ── ARRIVED ───────────────────────────────────────────────────────────
        // Generates OTP → stored as RAW string (no hash) in ride.pickupOtp
        // verify_otp below does plain string compare to match
       case 'arrived': {
          if (currentStatus !== 'driver_en_route')
            return res.status(400).json({ success: false, message: `Cannot arrive from: ${currentStatus}` });

          const otpCode        = genOtp();
          ride.status          = 'driver_arrived';
          ride.driverArrivedAt = new Date();
          
          // ❌ OLD CODE: ride.pickupOtp = hashOtp(otpCode);
          // ✅ NEW CODE: Store the raw string directly so verify_otp can match it
          ride.pickupOtp = otpCode; 

          await ride.save();

          await broadcastRideStatus({
            ride, newStatus: 'driver_arrived', socketService,
            extraPayload: { currentTarget: 'pickup', otp: otpCode },
          });

          const custId   = await getCustomerFromRide(ride);
          const custUser = custId ? await User.findById(custId).select('email phone name').lean() : null;

          await createNotification({
            recipient: custId,
            title:     'Driver Arrived',
            body:      `Your driver has arrived. Share OTP ${otpCode} to start the ride.`,
            type:      'Driver_Arrived',
            bookingId: ride.booking,
            priority:  'High',
            otp:       otpCode,
          });

          if (custUser?.phone) {
            sendSms({
              to:      custUser.phone,
              message: otpSms({ otpCode, purpose: 'ride start' }),
            }).catch(e => console.error('[arrived] OTP SMS:', e.message));
          }

          if (custUser?.email) {
            // Dynamic import only for email queue — not a hot path, driver has arrived
            import('../services/emailQueueService.js')
              .then(({ sendOtpEmail }) => sendOtpEmail(custUser.email, {
                rideId:  String(ride._id),
                otpCode,
                title:   'Your driver has arrived!',
                body:    'Share this OTP with your driver to start the ride.',
              }))
              .catch(e => console.error('[arrived] queue OTP email:', e.message));
          }

          const booking = ride.booking
            ? await Booking.findById(ride.booking).select('bookingCode').lean()
            : null;

          socketService?.emitOtpToAdmin({
            bookingId:     ride.booking,
            bookingCode:   booking?.bookingCode,
            rideId:        ride._id,
            otp:           otpCode,
            customerName:  custUser?.name,
            customerPhone: custUser?.phone,
          });

          if (ride.booking) {
            socketService?.emitToRoom(`booking:${ride.booking}`, 'otp_required', {
              bookingId:     String(ride.booking),
              rideId:        String(ride._id),
              currentTarget: 'pickup',
              otp:           otpCode, // customer sees on live tracking screen
              timestamp:     new Date().toISOString(),
            });
          }

          return res.json({
            success: true,
            message: 'Driver arrived. OTP sent to customer.',
            data:    { status: 'driver_arrived' },
          });
        }

        // ── VERIFY_OTP ────────────────────────────────────────────────────────
        // FIX: pickupOtp stored as RAW string → compare RAW string directly.
        // Previous version had NO comparison at all — any OTP was accepted.
        // NOTE: bookingSocketService.js verify_otp handler must ALSO use raw
        // compare (not hashOtp) to stay consistent with this storage strategy.
        case 'verify_otp': {
          if (currentStatus !== 'driver_arrived')
            return res.status(400).json({ success: false, message: 'OTP verify only when driver_arrived' });
          if (!otp)
            return res.status(400).json({ success: false, message: 'otp required' });

          // Re-fetch with +pickupOtp since it may be excluded by default select
          const rideWithOtp = await Ride.findById(rideId).select('+pickupOtp').lean();
          if (!rideWithOtp?.pickupOtp)
            return res.status(400).json({ success: false, message: 'OTP not set for this ride' });

          // RAW string compare — matches how 'arrived' stores it
          if (String(otp).trim() !== String(rideWithOtp.pickupOtp).trim()) {
            socketService?.emitToAdminOps('otp_failed_attempt', {
              rideId, bookingId: ride.booking ? String(ride.booking) : null,
              timestamp: new Date().toISOString(),
            });
            if (ride.booking) {
              socketService?.emitToRoom(`booking:${ride.booking}`, 'otp_wrong_attempt', {
                bookingId: String(ride.booking), timestamp: new Date().toISOString(),
              });
            }
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
          }

          ride.status              = 'otp_verified';
          ride.pickupOtpVerifiedAt = new Date();
          await ride.save();

          await broadcastRideStatus({ ride, newStatus: 'otp_verified', socketService });

          socketService?.emitToAdminOps('otp_verified_success', {
            rideId:    String(ride._id),
            bookingId: ride.booking ? String(ride.booking) : null,
            timestamp: new Date().toISOString(),
          });

          return res.json({ success: true, message: 'OTP verified.', data: { status: 'otp_verified' } });
        }

        // ── START_RIDE (in_progress) — map switches to dropoff ────────────────
        case 'start_ride': {
          if (currentStatus !== 'otp_verified')
            return res.status(400).json({ success: false, message: `Cannot start ride from: ${currentStatus}` });

          ride.status        = 'in_progress';
          ride.rideStartedAt = new Date();
          await ride.save();

          await broadcastRideStatus({
            ride, newStatus: 'in_progress',
            extraPayload: { rideStartedAt: ride.rideStartedAt.toISOString() },
            socketService,
          });

          // ALL roles switch map target to dropoff immediately on ride start
          const trackingDoc = await RideTracking.findOne({ ride: rideId })
            .select('expectedRoutePolyline').lean();

          if (ride.booking) {
            socketService?.emitToRoom(`booking:${ride.booking}`, 'navigation_target_changed', {
              bookingId:     String(ride.booking),
              rideId:        String(ride._id),
              currentTarget: 'dropoff',
              coords:        ride.dropoff?.coordinates,
              address:       ride.dropoff?.address,
              polyline:      trackingDoc?.expectedRoutePolyline || null,
              _serverTime:   new Date().toISOString(),
            });
          }

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId, title: 'Ride Started',
            body:      'Your ride has started. Have a safe journey!',
            type:      'Ride_Update', bookingId: ride.booking,
          });

          return res.json({ success: true, message: 'Ride started.', data: { status: 'in_progress' } });
        }

        // ── AT_STOP ───────────────────────────────────────────────────────────
        case 'at_stop': {
          if (currentStatus !== 'in_progress')
            return res.status(400).json({ success: false, message: `Cannot mark stop from: ${currentStatus}` });

          ride.status = 'at_stop';
          await ride.save();

          const stopCoords = ride.liveLocation?.coordinates || null;
          await broadcastRideStatus({
            ride, newStatus: 'at_stop',
            extraPayload: { stopIndex: stopIndex ?? null, coordinates: stopCoords },
            socketService,
          });

          return res.json({ success: true, message: 'At stop.', data: { status: 'at_stop', stopIndex } });
        }

        // ── RESUME (from stop) ────────────────────────────────────────────────
        case 'resume': {
          if (currentStatus !== 'at_stop')
            return res.status(400).json({ success: false, message: `Cannot resume from: ${currentStatus}` });

          ride.status = 'in_progress';
          await ride.save();

          if (ride.booking) {
            socketService?.emitToRoom(`booking:${ride.booking}`, 'ride_resumed', {
              rideId:    String(ride._id),
              bookingId: String(ride.booking),
              timestamp: new Date().toISOString(),
            });
          }

          await RideTracking.addMilestone(String(ride._id), 'stop_departed', {
            coordinates:      ride.liveLocation?.coordinates || null,
            meta:             { stopIndex: stopIndex ?? null },
            recordedBy:       'driver',
            recordedByUserId: ride.driver,
          }).catch(() => {});

          return res.json({ success: true, message: 'Ride resumed.', data: { status: 'in_progress' } });
        }

        // ── COMPLETE ──────────────────────────────────────────────────────────
        case 'complete': {
          if (!['in_progress', 'at_stop'].includes(currentStatus))
            return res.status(400).json({ success: false, message: `Cannot complete from: ${currentStatus}` });

          ride.status          = 'completed';
          ride.rideCompletedAt = new Date();

          const tracking = await RideTracking.findOne({ ride: rideId })
            .select('breadcrumbs totalDistanceKm breadcrumbCount').lean();

          let actualDistanceKm = ride.estimatedDistanceKm || 0;
          if (tracking?.breadcrumbs?.length > 1) {
            const crumbs = tracking.breadcrumbs;
            let total = 0;
            for (let i = 1; i < crumbs.length; i++) {
              total += haversineKm(crumbs[i - 1].coordinates, crumbs[i].coordinates);
            }
            actualDistanceKm = +total.toFixed(2);
          }

          ride.actualDistanceKm = actualDistanceKm;
          await ride.save();

          // Mark driver Available by Driver._id (ride.driver = Driver._id)
          await Driver.findByIdAndUpdate(ride.driver, {
            $set: { status: 'Available', currentRide: null },
          });

          const durationMin = ride.rideStartedAt
            ? Math.round((ride.rideCompletedAt - new Date(ride.rideStartedAt)) / 60000)
            : null;

          await RideTracking.findOneAndUpdate(
            { ride: rideId },
            {
              $set: {
                'summary.totalDistanceKm':  actualDistanceKm,
                'summary.totalDurationMin': durationMin,
                'summary.isCompleted':      true,
                'summary.completedAt':      new Date(),
              },
            }
          );

          await broadcastRideStatus({
            ride, newStatus: 'completed',
            extraPayload: { actualDistanceKm, durationMin },
            socketService,
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId, title: 'Ride Completed',
            body:      `Your ride has ended. Distance: ${actualDistanceKm} km.`,
            type:      'Ride_Update', bookingId: ride.booking,
          });

          return res.json({
            success: true,
            message: 'Ride completed.',
            data:    { status: 'completed', actualDistanceKm, durationMin },
          });
        }

        // ── CANCEL ────────────────────────────────────────────────────────────
        case 'cancel': {
          if (!CANCELLABLE_STATUSES.includes(currentStatus))
            return res.status(400).json({ success: false, message: `Cannot cancel from: ${currentStatus}` });

          if (!isAdmin && !DRIVER_CANCELLABLE_STATUSES.includes(currentStatus))
            return res.status(403).json({ success: false, message: 'Cannot cancel after driver arrived. Contact admin.' });

          ride.status      = 'cancelled';
          ride.cancelledAt = new Date();
          ride.cancellation = {
            cancelledBy:       isAdmin ? 'admin' : 'driver',
            cancelledByUserId: req.user._id,
            reason:            cancelReason || (isAdmin ? 'admin_cancel' : 'driver_cancel'),
            cancelledAt:       new Date(),
          };
          await ride.save();

          // Mark driver Available by Driver._id
          if (ride.driver) {
            await Driver.findByIdAndUpdate(ride.driver, {
              $set: { status: 'Available', currentRide: null },
            });
          }

          await broadcastRideStatus({
            ride, newStatus: 'cancelled',
            extraPayload: {
              cancelReason: cancelReason || null,
              cancelledBy:  req.user.role,
            },
            socketService,
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId, title: 'Ride Cancelled',
            body:      `Your ride has been cancelled. Reason: ${ride.cancellation.reason}.`,
            type:      'Ride_Update', bookingId: ride.booking,
          });

          return res.json({ success: true, message: 'Ride cancelled.', data: { status: 'cancelled' } });
        }

        default:
          return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
      }
    } catch (err) {
      console.error('[PATCH /:rideId/status]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TRACKING ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ride-requests/:rideId/tracking
 *
 * Full snapshot — breadcrumbs (latest N), milestones, ETA, SOS, polylines.
 * Socket is primary; this is initial load + reconnect fallback only.
 * Does NOT create any documents — read-only, safe to poll.
 * Query: ?breadcrumbs=100 (default 100, max 500)
 */
router.get('/:rideId/tracking',
  protect,
  authorize('customer', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId }      = req.params;
      const breadcrumbLimit = Math.min(parseInt(req.query.breadcrumbs) || 100, 500);

      if (!isValidObjId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(rideId).select('-pickupOtp').lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const { allowed, reason } = await canAccessRide(String(req.user._id), req.user.role, ride);
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      // Read-only fetch — no create, no upsert here
      const tracking = await RideTracking.findOne({ ride: rideId })
        .select(
          'milestones breadcrumbs breadcrumbCount currentEtaMinutes currentEtaTarget ' +
          'totalDistanceKm hasActiveSos hasUnacknowledgedDeviation sosEvents ' +
          'routeDeviations summary expectedRoutePolyline actualRoutePolyline ' +
          'etaUpdates createdAt updatedAt'
        )
        .lean();

      let breadcrumbs     = [];
      let breadcrumbCount = 0;
      if (tracking) {
        breadcrumbs     = (tracking.breadcrumbs || []).slice(-breadcrumbLimit);
        breadcrumbCount = tracking.breadcrumbCount || 0;
        delete tracking.breadcrumbs;
      }

      // Strip sensitive SOS detail from customer view
      let sosEvents = tracking?.sosEvents || [];
      if (req.user.role === 'customer') {
        sosEvents = sosEvents.map(e => ({
          sosType:     e.sosType,
          triggeredAt: e.triggeredAt,
          isResolved:  e.isResolved,
          resolvedAt:  e.resolvedAt,
        }));
      }

      return res.json({
        success: true,
        data: {
          ride: {
            _id:                  ride._id,
            rideCode:             ride.rideCode,
            status:               ride.status,
            rideType:             ride.rideType,
            pickup:               ride.pickup,
            dropoff:              ride.dropoff,
            stops:                ride.stops,
            liveLocation:         ride.liveLocation,
            currentEtaMinutes:    ride.currentEtaMinutes,
            driverSnapshot:       ride.driverSnapshot,
            vehicleSnapshot:      ride.vehicleSnapshot,
            scheduledPickupAt:    ride.scheduledPickupAt,
            driverAssignedAt:     ride.driverAssignedAt,
            driverArrivedAt:      ride.driverArrivedAt,
            rideStartedAt:        ride.rideStartedAt,
            rideCompletedAt:      ride.rideCompletedAt,
            estimatedDistanceKm:  ride.estimatedDistanceKm,
            estimatedDurationMin: ride.estimatedDurationMin,
            actualDistanceKm:     ride.actualDistanceKm,
          },
          tracking: tracking
            ? {
                currentEtaMinutes:          tracking.currentEtaMinutes,
                currentEtaTarget:           tracking.currentEtaTarget,
                totalDistanceKm:            tracking.totalDistanceKm,
                hasActiveSos:               tracking.hasActiveSos,
                hasUnacknowledgedDeviation: tracking.hasUnacknowledgedDeviation,
                milestones:                 tracking.milestones  || [],
                breadcrumbs,
                breadcrumbCount,
                totalBreadcrumbsInWindow:   breadcrumbs.length,
                sosEvents,
                routeDeviations:            tracking.routeDeviations || [],
                expectedRoutePolyline:      tracking.expectedRoutePolyline,
                actualRoutePolyline:        tracking.actualRoutePolyline,
                summary:                    tracking.summary,
                lastUpdatedAt:              tracking.updatedAt,
              }
            : null,
          socketHint: ride.booking
            ? { room: `booking:${ride.booking}`, events: ['location_update', 'eta_update', 'ride_status_changed'] }
            : null,
          _serverTime: new Date().toISOString(),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/ride-requests/:rideId/live
 *
 * Lightweight position + ETA. Use for: initial render, reconnect bridge, 5s polling fallback.
 * Read-only — does NOT create any documents. Safe to call on every poll.
 * Socket equivalent: 'location_update' on booking:{bookingId}
 */
router.get('/:rideId/live',
  protect,
  authorize('customer', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;

      if (!isValidObjId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(rideId)
        .select('status liveLocation currentEtaMinutes booking driver driverSnapshot vehicleSnapshot pickup dropoff transportPartner soloPartner')
        .lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const { allowed, reason } = await canAccessRide(String(req.user._id), req.user.role, ride);
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      // Read-only fetch — no create here
      const trackingEta = await RideTracking.findOne({ ride: rideId })
        .select('currentEtaMinutes currentEtaTarget hasActiveSos')
        .lean();

      const live        = ride.liveLocation;
      const hasPosition = live?.coordinates?.length === 2;

      const socketService = getBookingSocketService();
      // Ride.driver = Driver._id; resolve User._id to check online status
      const driverDoc     = ride.driver
        ? await Driver.findById(ride.driver).select('user').lean()
        : null;
      const driverUserId   = driverDoc?.user ? String(driverDoc.user) : null;
      const isDriverOnline = driverUserId
        ? (socketService?.isUserOnline(driverUserId) ?? false)
        : false;

      const isDriver = ['driver', 'solodriverpartner'].includes(req.user.role);

      return res.json({
        success: true,
        data: {
          rideId:  ride._id,
          status:  ride.status,

          liveLocation: hasPosition
            ? {
                lat:       live.coordinates[1],
                lng:       live.coordinates[0],
                heading:   live.heading   ?? 0,
                speedKmh:  live.speedKmh  ?? 0,
                updatedAt: live.updatedAt,
              }
            : null,

          currentEtaMinutes: trackingEta?.currentEtaMinutes ?? ride.currentEtaMinutes ?? null,
          currentEtaTarget:  trackingEta?.currentEtaTarget  ?? null,
          hasActiveSos:      trackingEta?.hasActiveSos       ?? false,

          driverSnapshot: !isDriver ? {
            name:     ride.driverSnapshot?.legalName,
            rating:   ride.driverSnapshot?.rating,
            phone:    ride.driverSnapshot?.phone,
            photoUrl: ride.driverSnapshot?.photoUrl,
          } : undefined,

          vehicleSnapshot: !isDriver ? {
            make:               ride.vehicleSnapshot?.make,
            model:              ride.vehicleSnapshot?.model,
            color:              ride.vehicleSnapshot?.color,
            registrationNumber: ride.vehicleSnapshot?.registrationNumber,
            vehicleType:        ride.vehicleSnapshot?.vehicleType,
          } : undefined,

          pickup:  { lat: ride.pickup?.coordinates?.[1],  lng: ride.pickup?.coordinates?.[0],  label: ride.pickup?.label  },
          dropoff: { lat: ride.dropoff?.coordinates?.[1], lng: ride.dropoff?.coordinates?.[0], label: ride.dropoff?.label },

          socketHint: {
            room:              ride.booking ? `booking:${ride.booking}` : null,
            events:            ['location_update', 'eta_update', 'driver_en_route', 'driver_arrived', 'ride_started', 'ride_completed'],
            isDriverOnline,
            pollingFallbackMs: isDriverOnline ? null : 5000,
          },

          _serverTime: new Date().toISOString(),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/ride-requests/:rideId/tracking/milestone
 *
 * HTTP fallback for milestone writes (driver offline queue retry, admin manual log).
 * Primary path: status transitions via PATCH /:rideId/status auto-record milestones.
 */
router.post('/:rideId/tracking/milestone',
  protect,
  authorize('driver', 'solodriverpartner', 'care_assistant', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const { name, coordinates = null, stopSequence = null, meta = null } = req.body;

      if (!isValidObjId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });
      if (!name)
        return res.status(400).json({ success: false, message: 'Milestone name required' });

      if (coordinates !== null) {
        if (!Array.isArray(coordinates) || coordinates.length !== 2)
          return res.status(400).json({ success: false, message: 'coordinates must be [lng, lat]' });
        const [mLng, mLat] = coordinates;
        if (typeof mLng !== 'number' || typeof mLat !== 'number' ||
            mLat < -90 || mLat > 90 || mLng < -180 || mLng > 180)
          return res.status(400).json({ success: false, message: 'Invalid coordinates' });
      }

      const ride = await Ride.findById(rideId)
        .select('booking driver status transportPartner soloPartner')
        .lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const { allowed, reason } = await canAccessRide(String(req.user._id), req.user.role, ride);
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      const trackingExists = await RideTracking.exists({ ride: rideId });
      if (!trackingExists)
        return res.status(404).json({
          success: false,
          message: 'RideTracking not found. Tracking may not have started yet.',
        });

      let recordedBy = 'system';
      if (['driver', 'solodriverpartner'].includes(req.user.role)) recordedBy = 'driver';
      else if (req.user.role === 'care_assistant')                  recordedBy = 'driver';
      else if (['admin', 'superadmin'].includes(req.user.role))     recordedBy = 'admin';

      const updated      = await RideTracking.addMilestone(rideId, name, {
        coordinates, stopSequence, meta, recordedBy, recordedByUserId: req.user._id,
      });
      const newMilestone = updated?.milestones?.[updated.milestones.length - 1];

      const socketService = getBookingSocketService();
      if (ride.booking) {
        socketService?.emitToRoom(`booking:${ride.booking}`, 'milestone_recorded', {
          rideId,
          bookingId: String(ride.booking),
          milestone: {
            name, occurredAt: newMilestone?.occurredAt ?? new Date().toISOString(),
            coordinates, stopSequence, meta, recordedBy,
          },
          _serverTime: new Date().toISOString(),
        });
      }

      if (ADMIN_ALERT_MILESTONES.includes(name)) {
        socketService?.emitToAdminOps('milestone_alert', {
          rideId,
          bookingId:  ride.booking ? String(ride.booking) : null,
          milestone:  name,
          meta,
          coordinates,
          recordedBy: req.user.role,
          userId:     String(req.user._id),
          timestamp:  new Date().toISOString(),
        });
      }

      return res.status(201).json({
        success: true,
        message: `Milestone '${name}' recorded.`,
        data: {
          rideId,
          milestone:   { name, occurredAt: newMilestone?.occurredAt, coordinates, stopSequence, meta, recordedBy },
          bookingRoom: ride.booking ? `booking:${ride.booking}` : null,
        },
      });
    } catch (err) {
      if (err.message?.startsWith('Unknown milestone name'))
        return res.status(400).json({ success: false, message: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/:rideId/care-assistant-live',

  protect,

  async (req, res) => {

    try {

      const ride =
        await Ride.findById(
          req.params.rideId
        ).lean();

      if (!ride) {

        return res.status(404).json({
          success: false,
          message: 'Ride not found',
        });
      }

      const tracking =
        await RideTracking
          .findOne({
            ride: ride._id,
          })
          .populate('hospital')
          .lean();

      return res.json({
        success: true,

        data: {

          activeTarget:
            tracking?.activeTarget,

          liveRouteContext:
            tracking
              ?.liveRouteContext || null,

          hospital:
            tracking?.hospital || null,
        },
      });

    } catch (err) {

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

export default router;