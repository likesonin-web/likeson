/**
 * RideOrchestratorService.js
 *
 * SINGLE source of truth for all ride business logic.
 * Socket layer calls methods here. No business logic in socket handlers.
 *
 * Handles:
 *   - Driver location updates + ETA
 *   - Care assistant location updates
 *   - OTP verify
 *   - Ride stage transitions
 *   - Care assistant dynamic injection
 *   - SOS
 *   - Route deviation
 *   - Booking status sync
 */

import mongoose from 'mongoose';

import Ride                 from '../../models/Ride.js';
import RideTracking         from '../../models/RideTracking.js';
import Driver               from '../../models/Driver.js';
import SoloDriverPartner    from '../../models/SoloDriverPartner.js';
import CareAssistantProfile from '../../models/CareAssistantProfile.js';
import Booking              from '../../models/Booking.js';
import User                 from '../../models/User.js';

import { RideSocketEmitter }           from './RideSocketEmitter.js';
import { milestones }                  from './RideMilestoneService.js';
import { recalcAndPersistEta,
         persistHospitalEta }          from './RideEtaService.js';
import { applyNavigationTransition,
         completeCaWaypoint,
         injectCareAssistantWaypoint } from './RideNavigationService.js';

import {
  hashOtp,
  syncBookingStatusFromRide,
  haversineKm,
} from '../../routes/bookingRouterShared.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTIVE_RIDE_STATUSES = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived',  'otp_verified',    'in_progress', 'at_stop',
];

const LOCATION_THROTTLE_MS   = 2_000;
const ETA_RECALC_THROTTLE_MS = 30_000;

// Per-socket throttle maps (passed in from socket service)
const _locationThrottle = new Map();
const _etaThrottle      = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

const resolveTargetCoords = (ride) => {
  switch (ride.activeNavigationTarget) {
    case 'pickup_care_assistant': {
      const caWp = ride.waypoints?.find(wp => wp.type === 'care_assistant_join' && !wp.isCompleted);
      return caWp?.location?.coordinates || null;
    }
    case 'pickup_patient':
      return ride.pickup?.coordinates || null;
    case 'dropoff_hospital':
    case 'dropoff_destination':
      return ride.dropoff?.coordinates || null;
    default:
      return ride.dropoff?.coordinates || null;
  }
};

// ── HANDLER: Driver Location Update ──────────────────────────────────────────

export const handleDriverLocationUpdate = async ({
  socketId,
  userId,
  driverObjectId,
  role,
  name,
  payload,
}) => {
  const { bookingId, lat, lng, heading, speed, accuracy } = payload;

  // Throttle
  const now  = Date.now();
  const last = _locationThrottle.get(socketId) ?? 0;
  if (now - last < LOCATION_THROTTLE_MS) return;
  _locationThrottle.set(socketId, now);

  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

  const coords = [lng, lat];

  // 1. Update Driver location
  await Driver.findOneAndUpdate(
    { user: userId },
    {
      'location.type':        'Point',
      'location.coordinates': coords,
      'location.heading':     heading ?? 0,
      'location.speedKmh':    speed   ?? 0,
      'location.updatedAt':   new Date(),
    }
  );

  if (role === 'solodriverpartner') {
    await SoloDriverPartner.findOneAndUpdate(
      { user: userId },
      {
        'vehicle.lastKnownLocation.type':        'Point',
        'vehicle.lastKnownLocation.coordinates': coords,
        'vehicle.lastLocationUpdatedAt':         new Date(),
      }
    );
  }

  // 2. Broadcast admin location
  RideSocketEmitter.driverLocationAdmin({ userId, driverObjectId, name, lat, lng, heading, speed, bookingId });

  if (!bookingId || !driverObjectId) return;

  // 3. Find active ride
  const ride = await Ride.findOne({
    booking: bookingId,
    driver:  driverObjectId,
    status:  { $in: ACTIVE_RIDE_STATUSES },
  }).select('_id status rideStage activeNavigationTarget waypoints trackingId pickup dropoff estimatedDistanceKm').lean();

  if (!ride) return;

  // 4. Update ride live location
  await Ride.findByIdAndUpdate(ride._id, {
    liveLocation: {
      type: 'Point', coordinates: coords,
      heading:  heading ?? 0,
      speedKmh: speed   ?? 0,
      updatedAt: new Date(),
    },
  });

  // 5. Breadcrumb
  if (ride.trackingId) {
    RideTracking.addBreadcrumb(ride._id, {
      coordinates: coords, heading: heading ?? 0,
      speedKmh: speed ?? 0, accuracyM: accuracy ?? null, source: 'gps',
    }).catch(e => console.error('[Orchestrator] breadcrumb:', e.message));
  }

  // 6. Broadcast to booking room
  RideSocketEmitter.driverLocation({
    bookingId, rideId: String(ride._id),
    lat, lng, heading, speed,
    rideStatus:            ride.status,
    activeNavigationTarget: ride.activeNavigationTarget,
  });

  // 7. ETA recalc (throttled)
  const lastEta = _etaThrottle.get(socketId) ?? 0;
  if (now - lastEta > ETA_RECALC_THROTTLE_MS) {
    _etaThrottle.set(socketId, now);

    const targetCoords = resolveTargetCoords(ride);

    if (targetCoords) {
      const speedKmh    = (speed && speed > 2) ? speed : 30;
      const { distanceKm, etaMinutes } = await recalcAndPersistEta({
        rideId:       ride._id,
        driverCoords: coords,
        targetCoords,
        targetLabel:  ride.activeNavigationTarget,
        speedKmh,
      });

      RideSocketEmitter.etaUpdate({
        bookingId,
        etaMinutes,
        distanceRemainingKm: distanceKm,
        currentTarget:       ride.activeNavigationTarget,
      });
    }

    // Hospital ETA if enroute
    if (['patient_onboard', 'care_assistant_joined', 'enroute_hospital'].includes(ride.rideStage)) {
      const tracking = await RideTracking.findOne({ ride: ride._id })
        .select('hospital').lean();

      if (tracking?.hospital) {
        const hospitalEta = await persistHospitalEta({
          rideId:      ride._id,
          driverCoords: coords,
          hospitalId:  tracking.hospital,
        });
        if (hospitalEta) {
          RideSocketEmitter.hospitalEtaUpdate({ bookingId, ...hospitalEta });
        }
      }
    }
  }
};

// ── HANDLER: Care Assistant Location Update ───────────────────────────────────

export const handleCaLocationUpdate = async ({
  socketId,
  userId,
  payload,
}) => {
  const { bookingId, lat, lng, heading, speed, status } = payload;

  const now  = Date.now();
  const last = _locationThrottle.get(`ca:${socketId}`) ?? 0;
  if (now - last < LOCATION_THROTTLE_MS) return;
  _locationThrottle.set(`ca:${socketId}`, now);

  if (typeof lat !== 'number' || typeof lng !== 'number') return;

  const coords = [lng, lat];

  // Update CA profile location
  await CareAssistantProfile.findOneAndUpdate(
    { user: userId },
    {
      'location.type':        'Point',
      'location.coordinates': coords,
      'location.updatedAt':   new Date(),
    }
  );

  if (bookingId) {
    // Update RideTracking CA location
    const activeRide = await Ride.findOne({
      booking: bookingId,
      status:  { $in: ACTIVE_RIDE_STATUSES },
    }).select('_id').lean();

    if (activeRide) {
      await RideTracking.updateCareAssistantLocation(activeRide._id, {
        coordinates: coords, heading, speedKmh: speed,
      }).catch(e => console.error('[Orchestrator] CA location:', e.message));

      if (status) {
        await RideTracking.updateCareAssistantStatus(activeRide._id, status)
          .catch(e => console.error('[Orchestrator] CA status:', e.message));
      }
    }

    RideSocketEmitter.caLocation({
      bookingId, lat, lng, heading, speed,
      careAssistantStatus: status ?? null,
    });
  }
};

// ── HANDLER: OTP Verify ───────────────────────────────────────────────────────

export const handleOtpVerify = async ({
  socketId,
  userId,
  driverObjectId,
  name,
  payload,
}) => {
  const { bookingId, rideId, otp } = payload;

  if (!bookingId || !rideId || !otp) {
    return { success: false, message: 'bookingId, rideId, otp required' };
  }
  if (!driverObjectId) {
    return { success: false, message: 'Driver profile not found' };
  }

  const ride = await Ride.findOne({
    _id:     rideId,
    booking: bookingId,
    driver:  driverObjectId,
    status:  'driver_arrived',
  }).select('+pickupOtp trackingId dropoff');

  if (!ride) {
    return { success: false, message: 'Ride not ready for OTP' };
  }

  // Verify hashed OTP
  if (hashOtp(String(otp).trim()) !== String(ride.pickupOtp).trim()) {
    RideSocketEmitter.otpWrongAttempt({ bookingId });
    return { success: false, message: 'Invalid OTP' };
  }

  // Update ride
  ride.status              = 'otp_verified';
  ride.pickupOtpVerifiedAt = new Date();
  ride.updatedBy           = userId;
  await ride.save();

  // Sync booking
  try {
    await syncBookingStatusFromRide(bookingId, 'otp_verified', userId);
  } catch (e) {
    await Booking.findByIdAndUpdate(bookingId, {
      $set: { status: 'in_progress', updatedBy: userId },
    });
  }

  // Navigation transition
  const transition = await applyNavigationTransition({
    rideId, event: 'otp_verified', updatedBy: userId,
  });

  // Milestones
  if (ride.trackingId) {
    await Promise.all([
      milestones.otpVerified(ride._id, null, userId),
      milestones.rideStarted(ride._id, null, userId),
    ]);
    await RideTracking.findByIdAndUpdate(ride.trackingId, {
      $set: { driver: driverObjectId },
    });
  }

  // Get tracking for polyline
  const trackingDoc = ride.trackingId
    ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
    : null;

  // Emit
  RideSocketEmitter.navigationTargetChanged({
    bookingId, rideId,
    activeNavigationTarget: transition?.transition?.target || 'dropoff_hospital',
    coords:   ride.dropoff?.coordinates,
    address:  ride.dropoff?.address,
    polyline: trackingDoc?.expectedRoutePolyline || null,
  });

  RideSocketEmitter.rideStatusChanged({
    bookingId, rideId,
    status:                'otp_verified',
    rideStage:             transition?.ride?.rideStage || 'patient_onboard',
    activeNavigationTarget: transition?.transition?.target || 'dropoff_hospital',
    driverName:            name,
  });

  RideSocketEmitter.bookingStatusChanged({
    bookingId, status: 'in_progress', source: 'otp_verified',
  });

  return { success: true };
};

// ── HANDLER: Ride Stage Transition (driver_status_update) ─────────────────────

export const handleRideStageTransition = async ({
  userId,
  driverObjectId,
  name,
  payload,
}) => {
  const { bookingId, rideId, status, lat, lng, meta } = payload;

  const STATUS_MAP = {
    accepted:      'driver_accepted',
    en_route:      'driver_en_route',
    arrived:       'driver_arrived',
    otp_verified:  'otp_verified',
    ride_started:  'in_progress',
    at_stop:       'at_stop',
    stop_departed: 'in_progress',
    completed:     'completed',
    cancelled:     'cancelled',
  };

  const EVENT_MAP = {
    driver_accepted: 'driver_accepted',
    driver_en_route: null,
    driver_arrived:  null,
    otp_verified:    'otp_verified',
    in_progress:     null,
    completed:       'completed',
  };

  const mappedStatus = STATUS_MAP[status];
  if (!mappedStatus) return { success: false, message: `Unknown status: ${status}` };

  const ride = await Ride.findOne({
    _id: rideId, booking: bookingId, driver: driverObjectId,
  }).select('_id status rideStage trackingId activeNavigationTarget waypoints');

  if (!ride) return { success: false, message: 'Ride not found or not yours' };

  ride.status    = mappedStatus;
  ride.updatedBy = userId;
  await ride.save();

  // Booking sync
  try {
    const updatedBooking = await syncBookingStatusFromRide(bookingId, mappedStatus, userId);
    if (updatedBooking) {
      RideSocketEmitter.bookingStatusChanged({
        bookingId, status: updatedBooking.status, source: 'ride_status_sync',
      });
    }
  } catch (e) {
    console.error('[Orchestrator] booking sync:', e.message);
  }

  // Navigation transition
  const navEvent = EVENT_MAP[mappedStatus];
  let transition = null;
  if (navEvent) {
    transition = await applyNavigationTransition({
      rideId, event: navEvent, updatedBy: userId,
    });
  }

  // Milestone
  const MILESTONE_MAP = {
    driver_accepted: () => milestones.driverAccepted(ride._id, lat && lng ? [lng, lat] : null, userId),
    driver_en_route: () => milestones.driverEnRoute(ride._id,  lat && lng ? [lng, lat] : null, userId),
    driver_arrived:  () => milestones.driverArrived(ride._id,  lat && lng ? [lng, lat] : null, userId),
    otp_verified:    () => milestones.otpVerified(ride._id,    lat && lng ? [lng, lat] : null, userId),
    in_progress:     () => milestones.rideStarted(ride._id,    lat && lng ? [lng, lat] : null, userId),
    completed:       () => milestones.rideCompleted(ride._id,  lat && lng ? [lng, lat] : null, userId),
  };
  MILESTONE_MAP[mappedStatus]?.().catch(() => {});

  // Navigation target after OTP
  if (mappedStatus === 'otp_verified' || mappedStatus === 'in_progress') {
    const trackingDoc = ride.trackingId
      ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
      : null;
    RideSocketEmitter.navigationTargetChanged({
      bookingId, rideId,
      activeNavigationTarget: transition?.transition?.target || 'dropoff_hospital',
      coords:   ride.dropoff?.coordinates,
      address:  ride.dropoff?.address,
      polyline: trackingDoc?.expectedRoutePolyline || null,
    });
  }

  RideSocketEmitter.rideStatusChanged({
    bookingId, rideId,
    status:                mappedStatus,
    rideStage:             transition?.ride?.rideStage || ride.rideStage,
    activeNavigationTarget: transition?.transition?.target || ride.activeNavigationTarget,
    driverName:            name,
    meta:                  meta ?? null,
  });

  return { success: true };
};

// ── HANDLER: SOS ──────────────────────────────────────────────────────────────

export const handleSos = async ({
  userId,
  role,
  payload,
}) => {
  const { bookingId, rideId, lat, lng, sosType, description } = payload;

  const ride = await Ride.findOne({ _id: rideId, booking: bookingId })
    .select('_id trackingId').lean();
  if (!ride) return { success: false, message: 'Ride not found' };

  if (ride.trackingId) {
    await RideTracking.triggerSos(ride._id, {
      triggeredBy: role, triggeredByUserId: userId,
      sosType:     sosType || 'other',
      coordinates: lat && lng ? [lng, lat] : null,
      description: description || null,
    });
    await milestones.sosTrigger(ride._id, lat && lng ? [lng, lat] : null, userId, sosType);
  }

  RideSocketEmitter.sosAlert({
    bookingId, rideId, triggeredBy: role,
    sosType: sosType || 'other', lat, lng, description,
  });

  return { success: true };
};

// ── HANDLER: Route Deviation ──────────────────────────────────────────────────

export const handleRouteDeviation = async ({
  userId,
  payload,
}) => {
  const { bookingId, rideId, lat, lng, deviationKm, driverReason } = payload;

  const ride = await Ride.findOne({ _id: rideId, booking: bookingId })
    .select('_id trackingId').lean();
  if (!ride) return;

  if (ride.trackingId) {
    await RideTracking.findOneAndUpdate({ ride: ride._id }, {
      $push: {
        routeDeviations: {
          detectedAt:    new Date(),
          coordinates:   lat && lng ? [lng, lat] : null,
          deviationKm:   deviationKm ?? 0,
          wasAcknowledged: false,
          driverReason:  driverReason || null,
        },
      },
      $set: { hasUnacknowledgedDeviation: true },
    });
    await milestones.routeDeviated(ride._id, lat && lng ? [lng, lat] : null, userId, deviationKm);
  }

  RideSocketEmitter.routeDeviationAlert({
    bookingId, rideId, lat, lng, deviationKm, driverReason,
  });
};

// ── PUBLIC: Assign CA to active ride ─────────────────────────────────────────

export const assignCareAssistantToRide = async ({
  rideId,
  bookingId,
  careAssistantProfileId,
  careAssistantName,
  updatedBy,
}) => {
  // Get CA location for waypoint
  const ca = await CareAssistantProfile.findById(careAssistantProfileId)
    .select('location fullName').lean();

  if (!ca) throw new Error('Care assistant profile not found');

  const caCoords = ca.location?.coordinates;

  // Inject waypoint (handles safety checks internally)
  const injection = caCoords
    ? await injectCareAssistantWaypoint({
        rideId,
        caLocation: caCoords,
        caAddress:  '',
        pickupFirst: true,
      })
    : { injected: false, reason: 'No CA location available' };

  // Attach to RideTracking
  await RideTracking.attachCareAssistant(rideId, careAssistantProfileId);

  // Emit
  RideSocketEmitter.caAttachedToRide({
    bookingId,
    rideId,
    careAssistantId:   careAssistantProfileId,
    careAssistantName: careAssistantName || ca.fullName,
  });

  return { attached: true, waypointInjected: injection };
};

// ── CLEANUP: remove socket throttle on disconnect ─────────────────────────────

export const cleanupSocketThrottle = (socketId) => {
  _locationThrottle.delete(socketId);
  _locationThrottle.delete(`ca:${socketId}`);
  _etaThrottle.delete(socketId);
};