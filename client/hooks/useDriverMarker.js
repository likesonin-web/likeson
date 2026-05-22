'use client';

import { useRef, useCallback, useEffect } from 'react';
import { smoothHeading } from '@/utils/navigationUtils';

/**
 * useDriverMarker
 * 
 * Creates AdvancedMarkerElement ONCE. All subsequent updates mutate only:
 *   - marker.position        (lat/lng)
 *   - innerEl.style.transform (heading rotation)
 * 
 * Zero innerHTML recreation on position updates → no layout thrash, no flicker.
 */
export function useDriverMarker(mapRef, mapLoadedRef) {
  const markerRef       = useRef(null);
  const innerDivRef     = useRef(null);   // the rotating arrow bubble
  const smoothHdgRef    = useRef(0);
  const animFrameRef    = useRef(null);
  const currentPosRef   = useRef(null);
  const targetPosRef    = useRef(null);
  const interpStartRef  = useRef(null);
  const INTERP_MS       = 800;            // smooth position interpolation duration

  // ── Create marker once ────────────────────────────────────────────────────
  const ensureMarker = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map || markerRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // ── Outer anchor — zero-size, centered ──
    const anchor       = document.createElement('div');
    anchor.style.cssText = `
      position: absolute;
      width: 0; height: 0;
      overflow: visible;
      pointer-events: none;
    `;

    // ── Pulse ring ──
    const pulse       = document.createElement('div');
    pulse.style.cssText = `
      position: absolute;
      width: 56px; height: 56px;
      left: -28px; top: -28px;
      border-radius: 50%;
      background: rgba(66,133,244,0.22);
      animation: drvPulse 2.2s ease-out infinite;
      pointer-events: none;
    `;

    // ── Shadow under bubble ──
    const shadow       = document.createElement('div');
    shadow.style.cssText = `
      position: absolute;
      width: 40px; height: 12px;
      left: -20px; top: 14px;
      border-radius: 50%;
      background: rgba(0,0,0,0.25);
      filter: blur(4px);
      pointer-events: none;
    `;

    // ── Arrow bubble — ONLY this rotates ──
    const bubble       = document.createElement('div');
    bubble.style.cssText = `
      position: absolute;
      width: 46px; height: 46px;
      left: -23px; top: -23px;
      background: linear-gradient(145deg, #5b9cf6, #3b82f6);
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 18px rgba(59,130,246,0.65), 0 1px 4px rgba(0,0,0,0.3);
      will-change: transform;
      transform: rotate(0deg);
      pointer-events: none;
      z-index: 2;
    `;
    bubble.innerHTML = `
      <svg width="21" height="21" viewBox="0 0 24 24" fill="white" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">
        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
      </svg>
    `;

    // ── Speed indicator dot ──
    const speedDot     = document.createElement('div');
    speedDot.style.cssText = `
      position: absolute;
      width: 8px; height: 8px;
      right: -2px; bottom: -2px;
      border-radius: 50%;
      background: #22c55e;
      border: 1.5px solid white;
      z-index: 3;
    `;

    // ── Keyframe style ──
    const style        = document.createElement('style');
    style.textContent  = `
      @keyframes drvPulse {
        0%   { transform: scale(0.85); opacity: 0.75; }
        70%  { transform: scale(2.0);  opacity: 0;    }
        100% { transform: scale(2.0);  opacity: 0;    }
      }
    `;

    bubble.appendChild(speedDot);
    anchor.appendChild(style);
    anchor.appendChild(pulse);
    anchor.appendChild(shadow);
    anchor.appendChild(bubble);
    innerDivRef.current = bubble;

    markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      content:  anchor,
      position: { lat, lng },
      zIndex:   20,
    });
  }, [mapRef]);

  // ── Smooth position interpolation via rAF ─────────────────────────────────
  const animatePosition = useCallback(() => {
    if (!markerRef.current || !currentPosRef.current || !targetPosRef.current) return;

    const elapsed  = Date.now() - (interpStartRef.current || Date.now());
    const t        = Math.min(elapsed / INTERP_MS, 1);
    const eased    = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;  // easeInOut

    const from = currentPosRef.current;
    const to   = targetPosRef.current;

    const lat = from.lat + (to.lat - from.lat) * eased;
    const lng = from.lng + (to.lng - from.lng) * eased;

    markerRef.current.position = { lat, lng };

    if (t < 1) {
      animFrameRef.current = requestAnimationFrame(animatePosition);
    } else {
      currentPosRef.current = { ...to };
      animFrameRef.current  = null;
    }
  }, []);

  // ── Update — called each GPS tick ─────────────────────────────────────────
  const updateMarker = useCallback((lat, lng, heading = 0, mapBearing = 0, speedKmh = 0) => {
    if (!mapLoadedRef.current) return;

    ensureMarker(lat, lng);
    if (!markerRef.current) return;

    // ── Smooth heading ──
    smoothHdgRef.current = smoothHeading(smoothHdgRef.current, heading, 0.18);
    const screenHeading  = (smoothHdgRef.current - mapBearing + 360) % 360;

    // ── Update rotation via CSS only — no DOM rebuild ──
    if (innerDivRef.current) {
      innerDivRef.current.style.transform = `rotate(${screenHeading}deg)`;

      // Speed indicator color: green = moving, orange = slow, grey = stopped
      const dot = innerDivRef.current.querySelector('div');
      if (dot) {
        dot.style.background = speedKmh > 20 ? '#22c55e'
          : speedKmh > 3 ? '#f97316'
          : '#94a3b8';
      }
    }

    // ── Interpolate position ──
    if (!currentPosRef.current) {
      currentPosRef.current = { lat, lng };
      markerRef.current.position = { lat, lng };
    } else {
      // Only start new interp if target changed significantly (> 1m)
      const prevTarget = targetPosRef.current || currentPosRef.current;
      const dist = Math.abs(prevTarget.lat - lat) + Math.abs(prevTarget.lng - lng);
      if (dist > 0.00001) {
        targetPosRef.current  = { lat, lng };
        interpStartRef.current = Date.now();

        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(animatePosition);
      }
    }
  }, [ensureMarker, animatePosition, mapLoadedRef]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const destroyMarker = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (markerRef.current) {
      markerRef.current.map = null;
      markerRef.current     = null;
    }
    innerDivRef.current    = null;
    currentPosRef.current  = null;
    targetPosRef.current   = null;
  }, []);

  useEffect(() => {
    return () => destroyMarker();
  }, [destroyMarker]);

  return { updateMarker, destroyMarker };
}

// ── Pickup / Dropoff marker factories ─────────────────────────────────────────

export function createStaticMarker(map, lat, lng, type = 'pickup') {
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return null;

  const isPickup = type === 'pickup';
  const color    = isPickup ? '#10b981' : '#ef4444';
  const gradFrom = isPickup ? '#10b981' : '#ef4444';
  const gradTo   = isPickup ? '#059669' : '#f97316';
  const label    = isPickup ? 'Pickup' : 'Drop-off';
  const iconPath = isPickup
    ? 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'
    : 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

  const anchor = document.createElement('div');
  anchor.style.cssText = `position:absolute;width:0;height:0;overflow:visible;pointer-events:none;`;
  anchor.innerHTML = `
    <div style="
      position:absolute;
      display:flex;flex-direction:column;align-items:center;
      left:-22px;top:-72px;
      pointer-events:none;
    ">
      <div style="
        width:44px;height:44px;
        background:linear-gradient(135deg,${gradFrom},${gradTo});
        border-radius:50%;border:3px solid #fff;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 18px ${color}88;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="${iconPath}"/>
        </svg>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${color};margin-top:-1px;"></div>
      <div style="
        background:${color};color:#fff;
        padding:2px 10px;border-radius:20px;
        font-size:10px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;
        white-space:nowrap;margin-top:2px;
        box-shadow:0 3px 10px rgba(0,0,0,0.25);
        font-family:system-ui,sans-serif;
      ">${label}</div>
    </div>
  `;

  return new window.google.maps.marker.AdvancedMarkerElement({
    map,
    content:  anchor,
    position: { lat, lng },
    zIndex:   10,
  });
}