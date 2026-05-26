/**
 * RideEtaService.js
 * All ETA calculation logic. No DB mutations except RideTracking ETA updates.
 */

import RideTracking from '../../models/RideTracking.js';
import Hospital     from '../../models/Hospital.js';
import { haversineKm, calculateEtaMinutes } from '../../routes/bookingRouterShared.js';

/**
 * Calculate ETA from current position to target coords.
 */
export const calcEtaToTarget = ({ fromCoords, toCoords, speedKmh = 30 }) => {
  if (!fromCoords?.length || !toCoords?.length) return { distanceKm: 0, etaMinutes: 0 };
  const distanceKm = haversineKm(fromCoords, toCoords);
  const etaMinutes = Math.round((distanceKm / speedKmh) * 60);
  return { distanceKm: +distanceKm.toFixed(2), etaMinutes };
};

/**
 * Recalculate and persist ETA for active ride.
 * Called by orchestrator on location update (throttled 30s).
 */
export const recalcAndPersistEta = async ({
  rideId,
  driverCoords,
  targetCoords,
  targetLabel,
  speedKmh = 30,
}) => {
  const { distanceKm, etaMinutes } = calcEtaToTarget({
    fromCoords: driverCoords,
    toCoords:   targetCoords,
    speedKmh,
  });

  await RideTracking.addEtaUpdate(rideId, {
    toWaypoint:          targetLabel,
    etaMinutes,
    distanceRemainingKm: distanceKm,
    source:              'estimate',
  });

  return { distanceKm, etaMinutes };
};

/**
 * Calculate hospital ETA from driver current position.
 */
export const calcHospitalEta = async ({ driverCoords, hospitalId }) => {
  if (!hospitalId) return null;

  const hospital = await Hospital.findById(hospitalId)
    .select('location name')
    .lean();

  if (!hospital?.location?.coordinates?.length) return null;

  const { distanceKm, etaMinutes } = calcEtaToTarget({
    fromCoords: driverCoords,
    toCoords:   hospital.location.coordinates,
  });

  return {
    hospitalId:   hospital._id,
    hospitalName: hospital.name,
    distanceKm,
    etaMinutes,
    coordinates:  hospital.location.coordinates,
  };
};

/**
 * Persist hospital ETA into RideTracking.liveRouteContext.
 */
export const persistHospitalEta = async ({ rideId, driverCoords, hospitalId }) => {
  const result = await calcHospitalEta({ driverCoords, hospitalId });
  if (!result) return null;

  await RideTracking.findOneAndUpdate(
    { ride: rideId },
    {
      $set: {
        'liveRouteContext.hospitalEtaMinutes': result.etaMinutes,
        'liveRouteContext.hospitalDistanceKm': result.distanceKm,
        'liveRouteContext.currentLegEtaMinutes': result.etaMinutes,
        'liveRouteContext.currentLegDistanceKm': result.distanceKm,
      },
    }
  );

  return result;
};