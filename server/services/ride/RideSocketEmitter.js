/**
 * RideSocketEmitter.js
 * All socket emissions for ride tracking. No business logic here.
 * Called by RideOrchestratorService only.
 */

import { getBookingSocketService } from '../bookingSocketService.js';

const emit = (room, event, payload) => {
  getBookingSocketService()?.emitToRoom(room, event, {
    ...payload,
    _serverTime: new Date().toISOString(),
  });
};

const emitAdmin = (event, payload) => {
  getBookingSocketService()?.emitToAdminOps(event, {
    ...payload,
    _serverTime: new Date().toISOString(),
  });
};

export const RideSocketEmitter = {

  // ── Location ──────────────────────────────────────────────────────────────

  driverLocation: ({ bookingId, rideId, lat, lng, heading, speed, rideStatus, activeNavigationTarget }) => {
    emit(`booking:${bookingId}`, 'location_update', {
      lat, lng, heading, speed,
      rideId, bookingId,
      role:          'driver',
      currentTarget: activeNavigationTarget,
      rideStatus,
    });
  },

  caLocation: ({ bookingId, lat, lng, heading, speed, careAssistantStatus }) => {
    emit(`booking:${bookingId}`, 'care_assistant_location_update', {
      lat, lng, heading, speed,
      role: 'care_assistant',
      careAssistantStatus,
    });
  },

  // ── ETA ───────────────────────────────────────────────────────────────────

  etaUpdate: ({ bookingId, etaMinutes, distanceRemainingKm, currentTarget }) => {
    emit(`booking:${bookingId}`, 'eta_update', {
      etaMinutes, distanceRemainingKm, currentTarget,
    });
  },

  hospitalEtaUpdate: ({ bookingId, hospitalId, hospitalName, etaMinutes, distanceKm, coordinates }) => {
    emit(`booking:${bookingId}`, 'hospital_eta_update', {
      hospitalId, hospitalName, etaMinutes, distanceKm, coordinates,
    });
  },

  // ── Status ────────────────────────────────────────────────────────────────

  rideStatusChanged: ({ bookingId, rideId, status, rideStage, activeNavigationTarget, driverName, meta }) => {
    emit(`booking:${bookingId}`, 'ride_status_changed', {
      bookingId, rideId, status, rideStage, activeNavigationTarget,
      driverName: driverName || null,
      meta:       meta || null,
    });
    emitAdmin('ride_status_changed', {
      bookingId, rideId, status, rideStage, driverName,
    });
  },

  bookingStatusChanged: ({ bookingId, status, source }) => {
    emit(`booking:${bookingId}`, 'booking_status_change', {
      bookingId, status, source,
    });
  },

  // ── Navigation ────────────────────────────────────────────────────────────

  navigationTargetChanged: ({ bookingId, rideId, activeNavigationTarget, coords, address, polyline }) => {
    emit(`booking:${bookingId}`, 'navigation_target_changed', {
      bookingId, rideId,
      currentTarget: activeNavigationTarget,
      coords, address, polyline: polyline || null,
    });
  },

  // ── OTP ───────────────────────────────────────────────────────────────────

  otpRequired: ({ bookingId, rideId, otp }) => {
    emit(`booking:${bookingId}`, 'otp_required', {
      bookingId, rideId, otp, currentTarget: 'pickup',
    });
  },

  otpWrongAttempt: ({ bookingId }) => {
    emit(`booking:${bookingId}`, 'otp_wrong_attempt', { bookingId });
  },

  otpToAdmin: ({ bookingId, bookingCode, rideId, otp, customerName, customerPhone }) => {
    emitAdmin('otp_for_admin', {
      bookingId, bookingCode, rideId, otp,
      customerName, customerPhone,
    });
  },

  // ── Care Assistant ────────────────────────────────────────────────────────

  caAttachedToRide: ({ bookingId, rideId, careAssistantId, careAssistantName }) => {
    emit(`booking:${bookingId}`, 'care_assistant_attached_to_ride', {
      bookingId, rideId, careAssistantId, careAssistantName,
    });
  },

  caJoinedRide: ({ bookingId, rideId, careAssistantId, careAssistantName, location }) => {
    emit(`booking:${bookingId}`, 'care_assistant_joined_ride', {
      bookingId, rideId, careAssistantId, careAssistantName, location,
    });
  },

  caStatusChanged: ({ bookingId, rideId, careAssistantId, careAssistantName, status, location }) => {
    emit(`booking:${bookingId}`, 'care_assistant_status_change', {
      bookingId, rideId, careAssistantId, careAssistantName,
      careAssistantStatus: status, location,
    });
  },

  // ── SOS ───────────────────────────────────────────────────────────────────

  sosAlert: ({ bookingId, rideId, triggeredBy, sosType, lat, lng, description }) => {
    const payload = { bookingId, rideId, triggeredBy, sosType, lat, lng, description };
    emit(`booking:${bookingId}`, 'sos_alert', payload);
    emitAdmin('sos_alert', payload);
  },

  // ── Route Deviation ───────────────────────────────────────────────────────

  routeDeviationAlert: ({ bookingId, rideId, lat, lng, deviationKm, driverReason }) => {
    const payload = { bookingId, rideId, lat, lng, deviationKm, driverReason };
    emit(`booking:${bookingId}`, 'route_deviation_alert', payload);
    emitAdmin('route_deviation_alert', payload);
  },

  // ── Admin ops ─────────────────────────────────────────────────────────────

  driverOnline:  ({ userId, driverObjectId, name, role }) =>
    emitAdmin('driver_online',  { userId, driverObjectId, name, role }),

  driverOffline: ({ userId, driverObjectId, name, role }) =>
    emitAdmin('driver_offline', { userId, driverObjectId, name, role }),

  driverLocationAdmin: ({ userId, driverObjectId, name, lat, lng, heading, speed, bookingId }) =>
    emitAdmin('driver_location', { userId, driverObjectId, name, lat, lng, heading, speed, bookingId }),
};