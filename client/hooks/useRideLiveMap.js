'use client';

/**
 * useRideLiveMap.js
 *
 * Manages Google Directions + step-by-step turn navigation for the driver.
 * Handles:
 *  - Requesting directions to current target (pickup / CA join / hospital)
 *  - Step progression as driver moves
 *  - Off-route detection + rerouting
 *  - ETA / distance updates
 *  - Route polyline drawing via useRouteRenderer
 *  - Voice announcement triggers
 *
 * Does NOT own Redux state — calls back via callbacks or lets parent dispatch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseDirectionSteps,
  findCurrentStepByPolyline,
  distanceToStepEndMeters,
  snapToPolyline,
  remainingRouteDistanceKm,
  offRouteScore,
  getAnnouncementBand,
  formatEta,
  formatDistance,
  extractRoutePolyline,
  decodePolyline,
} from '@/utils/navigationUtils';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const OFF_ROUTE_SCORE_THRESHOLD = 0.65;   // trigger reroute
const OFF_ROUTE_MIN_SPEED_KMH   = 8;      // don't reroute if nearly stationary
const OFF_ROUTE_CONFIRM_TICKS   = 3;      // consecutive off-route GPS pings to confirm
const REROUTE_COOLDOWN_MS       = 15_000; // min ms between reroutes
const ETA_UPDATE_INTERVAL_MS    = 8_000;  // how often to push ETA updates
const STEP_LOOKAHEAD            = 4;      // steps to search ahead for current

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   mapRef: React.MutableRefObject,
 *   mapLoadedRef: React.MutableRefObject,
 *   ride: object,
 *   stops: object[],
 *   activeVersion: object,
 *   bookingType: string,
 *   onReroute?: () => void,
 *   onStepChange?: (step, idx) => void,
 *   onEtaUpdate?: (etaMin, distKm) => void,
 * }} params
 */
export function useRideLiveMap({
  mapRef,
  mapLoadedRef,
  ride,
  stops,
  activeVersion,
  bookingType,
  onReroute,
  onStepChange,
  onEtaUpdate,
}) {
  // ── Directions state ──────────────────────────────────────────────────────
  const [currentStepText,    setCurrentStepText]    = useState('');
  const [currentManeuver,    setCurrentManeuver]     = useState('straight');
  const [nextStepText,       setNextStepText]        = useState('');
  const [etaMinutes,         setEtaMinutes]          = useState(null);
  const [distanceKm,         setDistanceKm]          = useState(null);
  const [isRerouting,        setIsRerouting]         = useState(false);
  const [hasRoute,           setHasRoute]            = useState(false);
  const [routeTarget,        setRouteTarget]         = useState(null); // 'pickup' | 'ca_join' | 'dropoff'

  // ── Refs (no re-render on update) ─────────────────────────────────────────
  const directionsRef       = useRef(null);
  const stepsRef            = useRef([]);
  const currentStepIdxRef   = useRef(0);
  const polylinePointsRef   = useRef([]);
  const offRouteCountRef    = useRef(0);
  const lastRerouteRef      = useRef(0);
  const lastEtaPushRef      = useRef(0);
  const rendererRef         = useRef(null);   // DirectionsRenderer (hidden — we draw our own lines)
  const lastPositionRef     = useRef(null);
  const announcedBandsRef   = useRef({});     // `${stepIdx}_${bandKey}` dedup
  const mountedRef          = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Determine current navigation target from stops ────────────────────────
  const resolveTarget = useCallback(() => {
    if (!stops?.length) {
      // Fallback to ride fields
      if (ride?.pickup?.coordinates) return { type: 'pickup',  coords: ride.pickup.coordinates,  address: ride.pickup.address };
      return null;
    }

    // Find the first PENDING stop
    const pending = [...stops]
      .filter(s => s.status === 'PENDING' && s.isActive !== false)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    if (!pending.length) return null;

    const stop = pending[0];
    return {
      type:     stop.stopType,
      stopId:   stop._id,
      coords:   stop.location?.coordinates,
      address:  stop.location?.address || stop.location?.label || '',
    };
  }, [stops, ride]);

  // ── Request directions ────────────────────────────────────────────────────
  const requestDirections = useCallback((targetOverride = null) => {
    if (!mapLoadedRef.current || !window.google?.maps) return;
    if (!lastPositionRef.current) return;

    let target = null;
    if (targetOverride === 'dropoff' && ride?.dropoff?.coordinates?.length) {
      target = { type: 'HOSPITAL', coords: ride.dropoff.coordinates, address: ride.dropoff.address };
    } else if (targetOverride === 'pickup' && ride?.pickup?.coordinates?.length) {
      target = { type: 'PATIENT_PICKUP', coords: ride.pickup.coordinates, address: ride.pickup.address };
    } else {
      target = resolveTarget();
    }

    if (!target?.coords?.length) return;

    const [tLng, tLat] = target.coords;
    const { lat: oLat, lng: oLng } = lastPositionRef.current;

    const svc = new window.google.maps.DirectionsService();
    setIsRerouting(true);

    svc.route(
      {
        origin:      new window.google.maps.LatLng(oLat, oLng),
        destination: new window.google.maps.LatLng(tLat, tLng),
        travelMode:  window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel:  window.google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (!mountedRef.current) return;
        setIsRerouting(false);
        if (status !== 'OK' || !result) {
          console.warn('[RideLiveMap] Directions failed:', status);
          return;
        }

        directionsRef.current = result;
        const steps           = parseDirectionSteps(result.routes[0]?.legs);
        stepsRef.current      = steps;
        currentStepIdxRef.current = 0;
        polylinePointsRef.current = extractRoutePolyline(result);
        offRouteCountRef.current  = 0;
        announcedBandsRef.current = {};

        setHasRoute(true);
        setRouteTarget(target.type);

        // Seed ETA from Directions API (more accurate)
        const totalDurationSec = result.routes[0]?.legs?.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0) || 0;
        const totalDistM       = result.routes[0]?.legs?.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0) || 0;
        const etaMin           = totalDurationSec / 60;
        const distKm           = totalDistM / 1000;

        if (mountedRef.current) {
          setEtaMinutes(etaMin);
          setDistanceKm(distKm);
        }

        onEtaUpdate?.(etaMin, distKm);

        // Seed first step text
        if (steps.length) {
          setCurrentStepText(steps[0].instruction);
          setCurrentManeuver(steps[0].maneuver);
          if (steps[1]) setNextStepText(steps[1].instruction);
        }

        // Draw route via parent (caller owns renderer refs)
        // Emit event so RideLiveTracking can call setRoute()
        window.dispatchEvent(new CustomEvent('lrt:route_ready', {
          detail: { result, polylinePoints: polylinePointsRef.current, targetType: target.type },
        }));
      }
    );
  }, [mapLoadedRef, ride, resolveTarget, onEtaUpdate]);

  // ── GPS update handler ────────────────────────────────────────────────────
  const onGpsUpdate = useCallback((lat, lng, heading = 0, speedKmh = 0) => {
    lastPositionRef.current = { lat, lng, heading, speedKmh };

    const steps   = stepsRef.current;
    const points  = polylinePointsRef.current;
    if (!steps.length || !points.length) return;

    // ── Step progression ──────────────────────────────────────────────────
    const fromIdx   = currentStepIdxRef.current;
    const newIdx    = findCurrentStepByPolyline(steps, lat, lng, fromIdx);
    const didChange = newIdx !== fromIdx;

    if (didChange) {
      currentStepIdxRef.current = newIdx;
      announcedBandsRef.current = {}; // reset per-step bands
      const step = steps[newIdx];
      if (step && mountedRef.current) {
        setCurrentStepText(step.instruction);
        setCurrentManeuver(step.maneuver || 'straight');
        if (steps[newIdx + 1]) setNextStepText(steps[newIdx + 1].instruction);
        else setNextStepText('');
      }
      onStepChange?.(steps[newIdx], newIdx);
    }

    // ── Voice announcement ────────────────────────────────────────────────
    const step = steps[currentStepIdxRef.current];
    if (step) {
      const distToTurnM = distanceToStepEndMeters(step, lat, lng);
      const band        = getAnnouncementBand(distToTurnM, speedKmh);
      if (band) {
        const key = `${currentStepIdxRef.current}_${band.key}`;
        if (!announcedBandsRef.current[key]) {
          announcedBandsRef.current[key] = true;
          const text = band.key === 'now'
            ? step.instruction
            : `${band.prefix(distToTurnM)}, ${step.instruction.toLowerCase()}`;
          window.dispatchEvent(new CustomEvent('lrt:announce', { detail: { text, priority: band.key === 'now' ? 'HIGH' : 'NORMAL' } }));
        }
      }
    }

    // ── Remaining distance / ETA ──────────────────────────────────────────
    const snap = snapToPolyline(lat, lng, points);
    const remKm = remainingRouteDistanceKm(points, snap.segmentIndex, snap.t);

    const now = Date.now();
    if (now - lastEtaPushRef.current > ETA_UPDATE_INTERVAL_MS) {
      lastEtaPushRef.current = now;
      const avgSpeedKmh = speedKmh > 3 ? speedKmh : 25;
      const etaMin      = (remKm / avgSpeedKmh) * 60;
      if (mountedRef.current) {
        setEtaMinutes(etaMin);
        setDistanceKm(remKm);
      }
      onEtaUpdate?.(etaMin, remKm);
    }

    // ── Off-route detection ───────────────────────────────────────────────
    if (speedKmh >= OFF_ROUTE_MIN_SPEED_KMH && snap.distanceOffRouteKm > 0.05) {
      const stepBearing = step
        ? Math.atan2(step.endLng - step.startLng, step.endLat - step.startLat) * 180 / Math.PI
        : null;
      const score = offRouteScore(snap.distanceOffRouteKm, heading, stepBearing, speedKmh);

      if (score >= OFF_ROUTE_SCORE_THRESHOLD) {
        offRouteCountRef.current++;
        if (
          offRouteCountRef.current >= OFF_ROUTE_CONFIRM_TICKS &&
          now - lastRerouteRef.current > REROUTE_COOLDOWN_MS
        ) {
          offRouteCountRef.current = 0;
          lastRerouteRef.current   = now;
          window.dispatchEvent(new CustomEvent('lrt:announce', { detail: { text: 'Recalculating route.', priority: 'CRITICAL' } }));
          requestDirections();
          onReroute?.();
        }
      } else {
        offRouteCountRef.current = Math.max(0, offRouteCountRef.current - 1);
      }
    } else {
      offRouteCountRef.current = 0;
    }
  }, [requestDirections, onReroute, onStepChange, onEtaUpdate]);

  // ── Auto-request directions when stops load ───────────────────────────────
  useEffect(() => {
    if (!stops?.length || !lastPositionRef.current) return;
    if (hasRoute) return; // don't re-request if already have route
    requestDirections();
  }, [stops, hasRoute, requestDirections]);

  // ── Re-request when route version changes (destination changed) ───────────
  useEffect(() => {
    if (!activeVersion) return;
    requestDirections();
  }, [activeVersion?.versionNumber]); // eslint-disable-line

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.setMap(null);
        rendererRef.current = null;
      }
    };
  }, []);

  return {
    currentStepText,
    currentManeuver,
    nextStepText,
    etaMinutes,
    distanceKm,
    isRerouting,
    hasRoute,
    routeTarget,
    requestDirections,
    onGpsUpdate,
  };
}