'use client';

import { useRef, useCallback, useEffect } from 'react';
import { smoothHeading } from '@/utils/navigationUtils';

const HEADING_DEADZONE_DEG = 8;     // don't rotate map if heading diff < 8°
const FOLLOW_ZOOM          = 17;
const OVERVIEW_ZOOM        = 14;
const TILT_MOVING          = 45;
const TILT_STOPPED         = 0;
const SPEED_TILT_THRESHOLD = 5;     // km/h — below this, flatten map
const CAM_INTERP_FACTOR    = 0.12;  // smoothness 0-1 (lower = smoother)
const RECENTER_DELAY_MS    = 12000; // auto re-engage follow after user pan

/**
 * useMapCamera,
 * 
 * Manages Google Map camera in navigation follow mode.
 * - Heading deadzone prevents micro-jitter
 * - Low-pass filter on heading
 * - Speed-based tilt (moving = 45°, stopped = 0°)
 * - User gesture interrupt → auto recenter after timeout
 */
export function useMapCamera(mapRef) {
  const smoothHdgRef      = useRef(0);
  const currentZoomRef    = useRef(FOLLOW_ZOOM);
  const followModeRef     = useRef(true);
  const userGestureRef    = useRef(false);
  const recenterTimerRef  = useRef(null);
  const animFrameRef      = useRef(null);

  // External read access
  const mapBearingRef     = useRef(0);

  // ── Register map bearing listener ─────────────────────────────────────────
  const initCameraListeners = useCallback((map) => {
    const headingListener = map.addListener('heading_changed', () => {
      mapBearingRef.current = map.getHeading() || 0;
    });

    // Detect user gesture (drag/pinch) → disable follow temporarily
    const dragListener = map.addListener('dragstart', () => {
      userGestureRef.current = true;
      followModeRef.current  = false;
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    });

    const dragEndListener = map.addListener('dragend', () => {
      // Auto re-engage follow after RECENTER_DELAY_MS
      recenterTimerRef.current = setTimeout(() => {
        followModeRef.current  = true;
        userGestureRef.current = false;
      }, RECENTER_DELAY_MS);
    });

    return () => {
      window.google?.maps?.event?.removeListener(headingListener);
      window.google?.maps?.event?.removeListener(dragListener);
      window.google?.maps?.event?.removeListener(dragEndListener);
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── Update camera — called each GPS position update ───────────────────────
  const updateCamera = useCallback((lat, lng, heading = 0, speedKmh = 0, overrideFollow = null) => {
    const map = mapRef.current;
    if (!map) return;

    const shouldFollow = overrideFollow !== null ? overrideFollow : followModeRef.current;
    if (!shouldFollow) return;

    // ── Heading smoothing with deadzone ──
    let targetHeading = smoothHdgRef.current;
    let hdgDiff       = heading - smoothHdgRef.current;
    if (hdgDiff >  180) hdgDiff -= 360;
    if (hdgDiff < -180) hdgDiff += 360;

    if (Math.abs(hdgDiff) > HEADING_DEADZONE_DEG) {
      // Low-pass filter
      targetHeading = smoothHeading(smoothHdgRef.current, heading, CAM_INTERP_FACTOR);
      smoothHdgRef.current = targetHeading;
    }

    // ── Tilt based on speed ──
    const targetTilt = speedKmh > SPEED_TILT_THRESHOLD ? TILT_MOVING : TILT_STOPPED;

    // ── Use moveCamera for atomic update (no jitter from partial updates) ──
    map.moveCamera({
      center:  { lat, lng },
      heading: targetHeading,
      tilt:    targetTilt,
      zoom:    currentZoomRef.current,
    });

    mapBearingRef.current = targetHeading;
  }, [mapRef]);

  // ── Force recenter ────────────────────────────────────────────────────────
  const recenter = useCallback((lat, lng, heading = 0) => {
    const map = mapRef.current;
    if (!map) return;

    followModeRef.current  = true;
    userGestureRef.current = false;

    if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);

    map.moveCamera({
      center:  { lat, lng },
      heading: smoothHdgRef.current,
      tilt:    TILT_MOVING,
      zoom:    FOLLOW_ZOOM,
    });
  }, [mapRef]);

  // ── North-up reset ────────────────────────────────────────────────────────
  const resetToNorth = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    followModeRef.current  = false;
    userGestureRef.current = true;
    smoothHdgRef.current   = 0;

    map.moveCamera({ heading: 0, tilt: 0, zoom: OVERVIEW_ZOOM });
    mapBearingRef.current = 0;
  }, [mapRef]);

  // ── Zoom controls ─────────────────────────────────────────────────────────
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
    smoothHdgRef,
  };
}