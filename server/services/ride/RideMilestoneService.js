/**
 * RideMilestoneService.js
 * All milestone recording. Single path — no milestone writes elsewhere.
 */

import RideTracking from '../../models/RideTracking.js';
import { MILESTONE_NAMES } from '../../models/RideTracking.js';

export const recordMilestone = async ({
  rideId,
  name,
  coordinates = null,
  meta = null,
  recordedBy = 'system',
  recordedByUserId = null,
}) => {
  if (!MILESTONE_NAMES.includes(name)) {
    console.error(`[RideMilestoneService] Unknown milestone: ${name}`);
    return null;
  }

  try {
    return await RideTracking.addMilestone(rideId, name, {
      coordinates,
      meta,
      recordedBy,
      recordedByUserId,
    });
  } catch (e) {
    console.error(`[RideMilestoneService] Failed ${name}:`, e.message);
    return null;
  }
};

// Convenience wrappers — most common milestones
export const milestones = {
  driverAccepted:       (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'driver_accepted', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  driverEnRoute:        (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'driver_en_route', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  driverArrived:        (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'driver_arrived', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  otpVerified:          (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'otp_verified', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  rideStarted:          (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'ride_started', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  careAssistantJoined:  (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'care_assistant_joined', coordinates: coords, recordedBy: 'system', recordedByUserId: userId }),

  hospitalArrived:      (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'hospital_arrived', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  rideCompleted:        (rideId, coords, userId) =>
    recordMilestone({ rideId, name: 'ride_completed', coordinates: coords, recordedBy: 'driver', recordedByUserId: userId }),

  rideCancelled:        (rideId, coords, userId, reason) =>
    recordMilestone({ rideId, name: 'ride_cancelled', coordinates: coords, meta: { reason }, recordedBy: 'system', recordedByUserId: userId }),

  sosTrigger:           (rideId, coords, userId, sosType) =>
    recordMilestone({ rideId, name: 'sos_triggered', coordinates: coords, meta: { sosType }, recordedBy: 'system', recordedByUserId: userId }),

  routeDeviated:        (rideId, coords, userId, deviationKm) =>
    recordMilestone({ rideId, name: 'route_deviated', coordinates: coords, meta: { deviationKm }, recordedBy: 'system', recordedByUserId: userId }),
};