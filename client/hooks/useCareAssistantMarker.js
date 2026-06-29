'use client';

import { useRef, useCallback, useEffect } from 'react';
import { smoothHeading } from '@/utils/navigationUtils';

/**
 * useCareAssistantMarker
 *
 * Companion to useDriverMarker, dedicated to the Care Assistant (CA).
 * Kept as its own hook (not a variant flag on useDriverMarker) because the
 * two markers have independent lifecycles on a full_care_ride booking —
 * the CA marker must be destroyable the moment the CA boards the vehicle
 * (caViewMode -> 'driver_tracking_only') while the driver marker lives on.
 *
 * Visual language matches the existing CA route color (#8b5cf6 / #6d28d9)
 * defined in useRouteRenderer.js's COLORS.caRoute, so the marker and its
 * route read as the same entity on the map.
 *
 * Status ring colors:
 *   en_route_to_pickup / EN_ROUTE        -> violet pulse (moving toward JP)
 *   at_pickup / AT_JOIN_POINT            -> amber pulse   (waiting at JP)
 *   in_ride / IN_VEHICLE                 -> marker is normally unmounted by
 *                                           the page at this point; if kept
 *                                           mounted it renders solid green.
 *   anything else / not_joined           -> solid grey (idle / not started)
 */
export function useCareAssistantMarker(mapRef, mapLoadedRef) {
  const markerRef      = useRef(null);
  const innerDivRef     = useRef(null);
  const ringRef         = useRef(null);
  const smoothHdgRef    = useRef(0);
  const animFrameRef    = useRef(null);
  const currentPosRef   = useRef(null);
  const targetPosRef    = useRef(null);
  const interpStartRef  = useRef(null);
  const INTERP_MS       = 800;

  const STATUS_COLOR = {
    en_route_to_pickup: '#8b5cf6',
    EN_ROUTE:           '#8b5cf6',
    at_pickup:           '#f59e0b',
    AT_JOIN_POINT:        '#f59e0b',
    in_ride:              '#22c55e',
    IN_VEHICLE:           '#22c55e',
  };
  const DEFAULT_COLOR = '#94a3b8';

  const ensureMarker = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map || markerRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const anchor = document.createElement('div');
    anchor.style.cssText = `
      position: absolute;
      width: 0; height: 0;
      overflow: visible;
      pointer-events: none;
    `;

    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position: absolute;
      width: 56px; height: 56px;
      left: -28px; top: -28px;
      border-radius: 50%;
      background: rgba(139,92,246,0.22);
      animation: caPulse 2.2s ease-out infinite;
      pointer-events: none;
    `;

    const shadow = document.createElement('div');
    shadow.style.cssText = `
      position: absolute;
      width: 40px; height: 12px;
      left: -20px; top: 14px;
      border-radius: 50%;
      background: rgba(0,0,0,0.25);
      filter: blur(4px);
      pointer-events: none;
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      position: absolute;
      width: 46px; height: 46px;
      left: -23px; top: -23px;
      background: linear-gradient(145deg, #a78bfa, #6d28d9);
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 18px rgba(109,40,217,0.6), 0 1px 4px rgba(0,0,0,0.3);
      will-change: transform;
      transform: rotate(0deg);
      pointer-events: none;
      z-index: 2;
    `;
    // Medical-cross glyph — distinguishes CA from the arrow-style driver marker.
    bubble.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">
        <path d="M11 2h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>
      </svg>
    `;

    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute;
      width: 50px; height: 50px;
      left: -25px; top: -25px;
      border-radius: 50%;
      border: 2.5px solid ${DEFAULT_COLOR};
      pointer-events: none;
      z-index: 1;
      transition: border-color 200ms ease;
    `;
    ringRef.current = ring;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes caPulse {
        0%   { transform: scale(0.85); opacity: 0.75; }
        70%  { transform: scale(2.0);  opacity: 0;    }
        100% { transform: scale(2.0);  opacity: 0;    }
      }
    `;

    anchor.appendChild(style);
    anchor.appendChild(pulse);
    anchor.appendChild(shadow);
    anchor.appendChild(ring);
    anchor.appendChild(bubble);
    innerDivRef.current = bubble;

    markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      content:  anchor,
      position: { lat, lng },
      zIndex:   21,
    });
  }, [mapRef]);

  const animatePosition = useCallback(() => {
    if (!markerRef.current || !currentPosRef.current || !targetPosRef.current) return;

    const elapsed = Date.now() - (interpStartRef.current || Date.now());
    const t       = Math.min(elapsed / INTERP_MS, 1);
    const eased   = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const from = currentPosRef.current;
    const to   = targetPosRef.current;
    const lat  = from.lat + (to.lat - from.lat) * eased;
    const lng  = from.lng + (to.lng - from.lng) * eased;

    markerRef.current.position = { lat, lng };

    if (t < 1) {
      animFrameRef.current = requestAnimationFrame(animatePosition);
    } else {
      currentPosRef.current = { ...to };
      animFrameRef.current  = null;
    }
  }, []);

  /**
   * @param {number} lat
   * @param {number} lng
   * @param {number} heading     0-360, only meaningful if the CA is travelling by vehicle
   * @param {number} mapBearing  current map rotation, for screen-relative heading
   * @param {string} status      CA status string — drives the ring color
   */
  const updateMarker = useCallback((lat, lng, heading = 0, mapBearing = 0, status = null) => {
    if (!mapLoadedRef.current) return;

    ensureMarker(lat, lng);
    if (!markerRef.current) return;

    smoothHdgRef.current = smoothHeading(smoothHdgRef.current, heading, 0.18);
    const screenHeading  = (smoothHdgRef.current - mapBearing + 360) % 360;

    if (innerDivRef.current) {
      innerDivRef.current.style.transform = `rotate(${screenHeading}deg)`;
    }
    if (ringRef.current) {
      ringRef.current.style.borderColor = STATUS_COLOR[status] || DEFAULT_COLOR;
    }

    if (!currentPosRef.current) {
      currentPosRef.current = { lat, lng };
      markerRef.current.position = { lat, lng };
    } else {
      const prevTarget = targetPosRef.current || currentPosRef.current;
      const dist = Math.abs(prevTarget.lat - lat) + Math.abs(prevTarget.lng - lng);
      if (dist > 0.00001) {
        targetPosRef.current   = { lat, lng };
        interpStartRef.current = Date.now();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(animatePosition);
      }
    }
  }, [ensureMarker, animatePosition, mapLoadedRef]);

  const destroyMarker = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (markerRef.current) {
      markerRef.current.map = null;
      markerRef.current     = null;
    }
    innerDivRef.current   = null;
    ringRef.current        = null;
    currentPosRef.current  = null;
    targetPosRef.current   = null;
  }, []);

  useEffect(() => () => destroyMarker(), [destroyMarker]);

  return { updateMarker, destroyMarker, markerRef };
}