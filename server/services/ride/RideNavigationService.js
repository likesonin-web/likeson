/**
 * RideNavigationService.js
 * Single source of truth for navigation target transitions.
 * Called by RideOrchestratorService only.
 */

import Ride         from '../../models/Ride.js';
import RideTracking from '../../models/RideTracking.js';

export const NAVIGATION_TARGETS = {
  PICKUP_CARE_ASSISTANT: 'pickup_care_assistant',
  PICKUP_PATIENT:        'pickup_patient',
  DROPOFF_HOSPITAL:      'dropoff_hospital',
  DROPOFF_DESTINATION:   'dropoff_destination',
  RETURN_PICKUP:         'return_pickup',
};

export const RIDE_STAGES = {
  SEARCHING_DRIVER:      'searching_driver',
  DRIVER_TO_CA:          'driver_to_care_assistant',
  DRIVER_TO_PATIENT:     'driver_to_patient',
  PATIENT_ONBOARD:       'patient_onboard',
  CA_JOINED:             'care_assistant_joined',
  ENROUTE_HOSPITAL:      'enroute_hospital',
  HOSPITAL_REACHED:      'hospital_reached',
  RETURN_TRIP:           'return_trip',
  COMPLETED:             'completed',
  CANCELLED:             'cancelled',
};

/**
 * Determine next navigation target from current stage + event.
 */
export const resolveNextTarget = ({ currentStage, event, ride }) => {
  switch (event) {

    case 'driver_accepted':
      // Has CA waypoint and not yet picked up?
      if (ride.waypoints?.some(wp => wp.type === 'care_assistant_join' && !wp.isCompleted)) {
        return {
          target: NAVIGATION_TARGETS.PICKUP_CARE_ASSISTANT,
          stage:  RIDE_STAGES.DRIVER_TO_CA,
        };
      }
      return {
        target: NAVIGATION_TARGETS.PICKUP_PATIENT,
        stage:  RIDE_STAGES.DRIVER_TO_PATIENT,
      };

    case 'care_assistant_picked_up':
      return {
        target: NAVIGATION_TARGETS.PICKUP_PATIENT,
        stage:  RIDE_STAGES.DRIVER_TO_PATIENT,
      };

    case 'otp_verified':
      return {
        target: NAVIGATION_TARGETS.DROPOFF_HOSPITAL,
        stage:  RIDE_STAGES.PATIENT_ONBOARD,
      };

    case 'care_assistant_joined_enroute':
      return {
        target: NAVIGATION_TARGETS.DROPOFF_HOSPITAL,
        stage:  RIDE_STAGES.CA_JOINED,
      };

    case 'hospital_reached':
      return {
        target: null,
        stage:  RIDE_STAGES.HOSPITAL_REACHED,
      };

    case 'return_started':
      return {
        target: NAVIGATION_TARGETS.RETURN_PICKUP,
        stage:  RIDE_STAGES.RETURN_TRIP,
      };

    case 'completed':
      return {
        target: null,
        stage:  RIDE_STAGES.COMPLETED,
      };

    default:
      return null;
  }
};

/**
 * Apply navigation transition to DB atomically.
 */
export const applyNavigationTransition = async ({
  rideId,
  event,
  updatedBy = null,
}) => {
  const ride = await Ride.findById(rideId)
    .select('rideStage activeNavigationTarget waypoints')
    .lean();

  if (!ride) throw new Error(`Ride ${rideId} not found`);

  const transition = resolveNextTarget({
    currentStage: ride.rideStage,
    event,
    ride,
  });

  if (!transition) return { changed: false, ride };

  const updateData = {
    rideStage: transition.stage,
    ...(transition.target ? { activeNavigationTarget: transition.target } : {}),
    ...(updatedBy ? { updatedBy } : {}),
  };

  const updated = await Ride.findByIdAndUpdate(
    rideId,
    { $set: updateData },
    { new: true }
  ).select('rideStage activeNavigationTarget waypoints');

  // Sync RideTracking activeTarget
  if (transition.target) {
    await RideTracking.findOneAndUpdate(
      { ride: rideId },
      { $set: { activeTarget: transition.target } }
    );
  }

  return { changed: true, ride: updated, transition };
};

/**
 * Mark care assistant waypoint as completed.
 */
export const completeCaWaypoint = async (rideId) => {
  return Ride.findOneAndUpdate(
    {
      _id: rideId,
      'waypoints.type': 'care_assistant_join',
      'waypoints.isCompleted': false,
    },
    {
      $set: {
        'waypoints.$.isCompleted': true,
        'waypoints.$.completedAt': new Date(),
      },
    },
    { new: true }
  ).select('waypoints activeNavigationTarget rideStage');
};

/**
 * Inject CA waypoint dynamically (CA assigned after ride already searching).
 * Only injects if driver has NOT yet reached patient.
 */
export const injectCareAssistantWaypoint = async ({
  rideId,
  caLocation,
  caAddress = '',
  pickupFirst = true,
}) => {
  const ride = await Ride.findById(rideId)
    .select('rideStage activeNavigationTarget waypoints status')
    .lean();

  if (!ride) throw new Error(`Ride ${rideId} not found`);

  // Safety check — patient already onboard = cannot reroute to CA
  const patientOnboardStages = [
    'patient_onboard', 'care_assistant_joined',
    'enroute_hospital', 'hospital_reached',
    'return_trip', 'completed',
  ];
  if (patientOnboardStages.includes(ride.rideStage)) {
    return {
      injected: false,
      reason: 'Patient already onboard — cannot reroute to care assistant',
      rideStage: ride.rideStage,
    };
  }

  // Remove any existing CA waypoint first (idempotent)
  await Ride.findByIdAndUpdate(rideId, {
    $pull: { waypoints: { type: 'care_assistant_join' } },
  });

  // Insert new CA waypoint
  const newWaypoint = {
    type: 'care_assistant_join',
    location: {
      type: 'Point',
      coordinates: caLocation,
      address: caAddress,
    },
    pickupFirst,
    isCompleted: false,
    completedAt: null,
  };

  await Ride.findByIdAndUpdate(rideId, {
    $push: { waypoints: newWaypoint },
  });

  // Switch navigation target if driver not yet at patient
  const newTarget = pickupFirst
    ? NAVIGATION_TARGETS.PICKUP_CARE_ASSISTANT
    : NAVIGATION_TARGETS.PICKUP_PATIENT;

  const newStage = pickupFirst
    ? RIDE_STAGES.DRIVER_TO_CA
    : ride.rideStage;

  await Ride.findByIdAndUpdate(rideId, {
    $set: {
      activeNavigationTarget: newTarget,
      rideStage: newStage,
    },
  });

  await RideTracking.findOneAndUpdate(
    { ride: rideId },
    { $set: { activeTarget: newTarget } }
  );

  return {
    injected: true,
    newTarget,
    newStage,
    waypoint: newWaypoint,
  };
};