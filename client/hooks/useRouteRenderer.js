'use client';

import { useRef, useCallback, useEffect } from 'react';
import { extractRoutePolyline, snapToPolyline } from '@/utils/navigationUtils';

/**
 * useRouteRenderer
 * 
 * Replaces DirectionsRenderer entirely.
 * Renders route as raw google.maps.Polyline objects:
 *   - traversedLine: driven portion (faded, thinner)
 *   - remainingLine: upcoming portion (vivid, thicker)
 * 
 * No flickering. No marker interference. No React re-renders.
 */
export function useRouteRenderer(mapRef) {
  const traversedLineRef  = useRef(null);  // driven portion
  const remainingLineRef  = useRef(null);  // upcoming portion
  const borderLineRef     = useRef(null);  // outline/border for remaining
  const routePointsRef    = useRef([]);    // full decoded polyline

  // Colors for dual modes
  const COLORS = {
    toPickup: {
      remaining: '#10b981',   // green — driver going to customer
      traversed: '#6ee7b7',
      border:    '#059669',
    },
    toDropoff: {
      remaining: '#3b82f6',   // blue — trip in progress
      traversed: '#93c5fd',
      border:    '#1d4ed8',
    },
  };

  // ── Create polyline objects ────────────────────────────────────────────────
  const ensureLines = useCallback((routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.Polyline) return;

    const colors = COLORS[routeType] || COLORS.toPickup;

    if (!borderLineRef.current) {
      borderLineRef.current = new window.google.maps.Polyline({
        map,
        path:         [],
        strokeColor:  colors.border,
        strokeWeight: 10,
        strokeOpacity: 0.5,
        zIndex:       1,
        clickable:    false,
      });
    }

    if (!remainingLineRef.current) {
      remainingLineRef.current = new window.google.maps.Polyline({
        map,
        path:         [],
        strokeColor:  colors.remaining,
        strokeWeight: 7,
        strokeOpacity: 0.95,
        zIndex:       2,
        clickable:    false,
        icons: [{
          icon:   { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#fff', strokeWeight: 1 },
          offset: '100%',
          repeat: '120px',
        }],
      });
    }

    if (!traversedLineRef.current) {
      traversedLineRef.current = new window.google.maps.Polyline({
        map,
        path:         [],
        strokeColor:  colors.traversed,
        strokeWeight: 4,
        strokeOpacity: 0.5,
        zIndex:       1,
        clickable:    false,
      });
    }
  }, [mapRef]);

  // ── Update colors for route type ───────────────────────────────────────────
  const applyColors = useCallback((routeType = 'toPickup') => {
    const colors = COLORS[routeType] || COLORS.toPickup;
    borderLineRef.current?.setOptions({ strokeColor: colors.border });
    remainingLineRef.current?.setOptions({ strokeColor: colors.remaining });
    traversedLineRef.current?.setOptions({ strokeColor: colors.traversed });
  }, []);

  // ── Set new route ──────────────────────────────────────────────────────────
  const setRoute = useCallback((directionsResult, routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !directionsResult) return;

    const points = extractRoutePolyline(directionsResult);
    routePointsRef.current = points;

    ensureLines(routeType);
    applyColors(routeType);

    // Initially: all is remaining, none is traversed
    const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
    borderLineRef.current?.setPath(path);
    remainingLineRef.current?.setPath(path);
    traversedLineRef.current?.setPath([]);
  }, [mapRef, ensureLines, applyColors]);

  // ── Update progress — split polyline at current position ──────────────────
  const updateProgress = useCallback((lat, lng) => {
    const points = routePointsRef.current;
    if (!points?.length || !remainingLineRef.current) return;

    const snap = snapToPolyline(lat, lng, points);
    const idx  = snap.segmentIndex;
    const t    = snap.t;

    // Split point — interpolate within segment
    const segA = points[idx];
    const segB = points[idx + 1] || segA;
    const splitLat = segA.lat + t * (segB.lat - segA.lat);
    const splitLng = segA.lng + t * (segB.lng - segA.lng);
    const splitPt  = { lat: splitLat, lng: splitLng };

    // Traversed: [0..idx] + splitPt
    const traversed = points.slice(0, idx + 1).map(p => ({ lat: p.lat, lng: p.lng }));
    traversed.push(splitPt);

    // Remaining: splitPt + [idx+1..]
    const remaining = [splitPt, ...points.slice(idx + 1).map(p => ({ lat: p.lat, lng: p.lng }))];

    traversedLineRef.current?.setPath(traversed);
    remainingLineRef.current?.setPath(remaining);
    borderLineRef.current?.setPath(remaining);
  }, []);

  // ── Clear all lines ────────────────────────────────────────────────────────
  const clearRoute = useCallback(() => {
    [traversedLineRef, remainingLineRef, borderLineRef].forEach(ref => {
      if (ref.current) {
        ref.current.setMap(null);
        ref.current = null;
      }
    });
    routePointsRef.current = [];
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => clearRoute();
  }, [clearRoute]);

  return {
    setRoute,
    updateProgress,
    clearRoute,
    routePointsRef,
  };
}