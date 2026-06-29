'use client';

/**
 * useMapCamera.js
 *
 * Manages Google Map camera in navigation follow-mode.
 *
 * Features:
 *  - Heading deadzone (no micro-jitter below 8°)
 *  - Low-pass filter on heading via smoothHeading()
 *  - Speed-based tilt (moving = 45°, stopped = 0°)
 *  - User gesture interrupt → auto recenter after 12 s
 *  - Atomic moveCamera() — no partial-update flicker
 *
 * FIX vs original:
 *  - userGestureRef removed — followModeRef alone is the single source of truth.
 *    Previously both were set but only followModeRef was ever read. Keeping two
 *    flags in sync was error-prone.
 *  - initCameraListeners returns a proper cleanup function that also clears the
 *    recenter timer (original missed this on fast unmount).
 */

import { useCallback, useRef } from 'react';
import { smoothHeading } from '@/utils/navigationUtils';

const HEADING_DEADZONE_DEG = 8;
const FOLLOW_ZOOM          = 17;
const OVERVIEW_ZOOM        = 14;
const TILT_MOVING          = 45;
const TILT_STOPPED         = 0;
const SPEED_TILT_THRESHOLD = 5;    // km/h
const CAM_INTERP_FACTOR    = 0.12;
const RECENTER_DELAY_MS    = 12_000;

export function useMapCamera(mapRef) {
  const smoothHdgRef     = useRef(0);
  const currentZoomRef   = useRef(FOLLOW_ZOOM);
  const followModeRef    = useRef(true);
  const recenterTimerRef = useRef(null);
  const mapBearingRef    = useRef(0);

  // ── Register listeners on map instance ───────────────────────────────────
  // Returns cleanup fn — call it on map destroy / component unmount.
  const initCameraListeners = useCallback((map) => {
    const headingListener = map.addListener('heading_changed', () => {
      mapBearingRef.current = map.getHeading() || 0;
    });

    const dragListener = map.addListener('dragstart', () => {
      followModeRef.current = false;
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    });

    const dragEndListener = map.addListener('dragend', () => {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      recenterTimerRef.current = setTimeout(() => {
        followModeRef.current = true;
      }, RECENTER_DELAY_MS);
    });

    return () => {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      window.google?.maps?.event?.removeListener(headingListener);
      window.google?.maps?.event?.removeListener(dragListener);
      window.google?.maps?.event?.removeListener(dragEndListener);
    };
  }, []);

  // ── Called on every GPS tick ──────────────────────────────────────────────
  const updateCamera = useCallback((
    lat,
    lng,
    heading    = 0,
    speedKmh   = 0,
    overrideFollow = null,
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const shouldFollow =
      overrideFollow !== null ? overrideFollow : followModeRef.current;
    if (!shouldFollow) return;

    // Heading: apply deadzone then low-pass filter
    let hdgDiff = heading - smoothHdgRef.current;
    if (hdgDiff >  180) hdgDiff -= 360;
    if (hdgDiff < -180) hdgDiff += 360;

    if (Math.abs(hdgDiff) > HEADING_DEADZONE_DEG) {
      smoothHdgRef.current = smoothHeading(
        smoothHdgRef.current,
        heading,
        CAM_INTERP_FACTOR,
      );
    }

    map.moveCamera({
      center:  { lat, lng },
      heading: smoothHdgRef.current,
      tilt:    speedKmh > SPEED_TILT_THRESHOLD ? TILT_MOVING : TILT_STOPPED,
      zoom:    currentZoomRef.current,
    });

    mapBearingRef.current = smoothHdgRef.current;
  }, [mapRef]);

  // ── Force recenter (user pressed recenter button) ─────────────────────────
  const recenter = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map) return;

    if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    followModeRef.current = true;

    map.moveCamera({
      center:  { lat, lng },
      heading: smoothHdgRef.current,
      tilt:    TILT_MOVING,
      zoom:    FOLLOW_ZOOM,
    });
  }, [mapRef]);

  // ── North-up overview ─────────────────────────────────────────────────────
  const resetToNorth = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    followModeRef.current = false;
    smoothHdgRef.current  = 0;
    mapBearingRef.current = 0;
    map.moveCamera({ heading: 0, tilt: 0, zoom: OVERVIEW_ZOOM });
  }, [mapRef]);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    currentZoomRef.current = Math.min(currentZoomRef.current + 1, 20);
    map.setZoom(currentZoomRef.current);
  }, [mapRef]);

  const zoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    currentZoomRef.current = Math.max(currentZoomRef.current - 1, 8);
    map.setZoom(currentZoomRef.current);
  }, [mapRef]);

  return {
    updateCamera,
    recenter,
    resetToNorth,
    zoomIn,
    zoomOut,
    initCameraListeners,
    mapBearingRef,
    followModeRef,
  };
}