'use client';

/**
 * useRouteRenderer.js
 *
 * Manages Google Maps Polyline objects for driver route (traversed/remaining)
 * and CA route (dashed purple).
 *
 * FIX vs original:
 *   - ensureLines() already calls applyColors() — setRoute() does NOT call
 *     applyColors() again. Previously it was called twice causing double-paint.
 *   - clearRoute cancels map reference before nulling ref (prevents Google Maps
 *     internal error on fast unmount).
 *
 * FIX (this pass — restored, were dropped from this version):
 *   - `setRouteFromPolyline` — CareAssistantLiveTracking.jsx renders the
 *     driver's route, once the CA has boarded, straight from
 *     RideTracking.expectedRoutePolyline (already computed server-side) —
 *     no reason to burn a Directions API call just to redraw a route the
 *     backend already solved. Without this export the page crashes with
 *     "routes.setRouteFromPolyline is not a function" the moment phase
 *     flips to 'in_vehicle'.
 *   - `updateCaProgress` — trims the CA's own route line as the CA moves
 *     toward the join point / patient, same idea as `updateProgress` but
 *     scoped to `caRoutePointsRef`. Without it the CA tracking page crashes
 *     on the very first GPS tick in the 'navigate_to_jp' / 'standalone'
 *     phases.
 */

import { useCallback, useEffect, useRef } from 'react';
import { extractRoutePolyline, snapToPolyline, decodePolyline } from '@/utils/navigationUtils';

const COLORS = {
  toPickup: {
    remaining: '#10b981',
    traversed: '#6ee7b7',
    border:    '#059669',
  },
  toDropoff: {
    remaining: '#3b82f6',
    traversed: '#93c5fd',
    border:    '#1d4ed8',
  },
  caRoute: {
    line:   '#8b5cf6',
    border: '#6d28d9',
  },
};

export function useRouteRenderer(mapRef) {
  const traversedLineRef = useRef(null);
  const remainingLineRef = useRef(null);
  const borderLineRef    = useRef(null);
  const caRouteLineRef   = useRef(null);
  const caBorderLineRef  = useRef(null);
  const routePointsRef   = useRef([]);
  const caRoutePointsRef = useRef([]);

  // ── Color-only update — does not recreate Polyline objects ────────────────
  const applyColors = useCallback((routeType = 'toPickup') => {
    const c = COLORS[routeType] || COLORS.toPickup;
    borderLineRef.current?.setOptions({ strokeColor: c.border });
    remainingLineRef.current?.setOptions({ strokeColor: c.remaining });
    traversedLineRef.current?.setOptions({ strokeColor: c.traversed });
  }, []);

  // ── Create driver polylines (once), then recolor ──────────────────────────
  const ensureLines = useCallback((routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.Polyline) return;
    const c = COLORS[routeType] || COLORS.toPickup;

    if (!borderLineRef.current) {
      borderLineRef.current = new window.google.maps.Polyline({
        map,
        path:          [],
        strokeColor:   c.border,
        strokeWeight:  10,
        strokeOpacity: 0.5,
        zIndex:        1,
        clickable:     false,
      });
    }

    if (!remainingLineRef.current) {
      remainingLineRef.current = new window.google.maps.Polyline({
        map,
        path:          [],
        strokeColor:   c.remaining,
        strokeWeight:  7,
        strokeOpacity: 0.95,
        zIndex:        2,
        clickable:     false,
        icons: [{
          icon: {
            path:          window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale:         3,
            strokeColor:   '#fff',
            strokeWeight:  1,
          },
          offset: '100%',
          repeat: '120px',
        }],
      });
    }

    if (!traversedLineRef.current) {
      traversedLineRef.current = new window.google.maps.Polyline({
        map,
        path:          [],
        strokeColor:   c.traversed,
        strokeWeight:  4,
        strokeOpacity: 0.5,
        zIndex:        1,
        clickable:     false,
      });
    }

    // FIX: recolor existing lines if routeType changed — called once here,
    // NOT repeated in setRoute().
    applyColors(routeType);
  }, [mapRef, applyColors]);

  // ── CA dashed route polylines ─────────────────────────────────────────────
  const ensureCaLines = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.Polyline) return;

    if (!caBorderLineRef.current) {
      caBorderLineRef.current = new window.google.maps.Polyline({
        map,
        path:          [],
        strokeColor:   COLORS.caRoute.border,
        strokeWeight:  8,
        strokeOpacity: 0.3,
        zIndex:        1,
        clickable:     false,
      });
    }

    if (!caRouteLineRef.current) {
      caRouteLineRef.current = new window.google.maps.Polyline({
        map,
        path:          [],
        strokeColor:   COLORS.caRoute.line,
        strokeWeight:  4,
        strokeOpacity: 0.85,
        zIndex:        2,
        clickable:     false,
        icons: [
          {
            icon: {
              path:          'M 0,-1 0,1',
              strokeOpacity: 1,
              scale:         3,
              strokeColor:   COLORS.caRoute.line,
            },
            offset: '0',
            repeat: '14px',
          },
          {
            icon: {
              path:          window.google.maps.SymbolPath.FORWARD_OPEN_ARROW,
              scale:         2.5,
              strokeColor:   '#fff',
              strokeWeight:  1,
              strokeOpacity: 0.8,
            },
            offset: '100%',
            repeat: '80px',
          },
        ],
      });
    }
  }, [mapRef]);

  // ── Shared point-list applier (driver lines) ──────────────────────────────
  // Both setRoute (Directions API result) and setRouteFromPolyline (backend
  // canonical polyline string) end up here so there's one code path for
  // "draw the driver route," not two slightly-different copies.
  const applyDriverRoutePoints = useCallback((points, routeType) => {
    routePointsRef.current = points;
    ensureLines(routeType);
    const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
    borderLineRef.current?.setPath(path);
    remainingLineRef.current?.setPath(path);
    traversedLineRef.current?.setPath([]);
  }, [ensureLines]);

  // ── Set driver route from DirectionsResult ────────────────────────────────
  // FIX: does NOT call applyColors() — ensureLines() already did it.
  const setRoute = useCallback((directionsResult, routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !directionsResult) return;
    applyDriverRoutePoints(extractRoutePolyline(directionsResult), routeType);
  }, [mapRef, applyDriverRoutePoints]);

  /**
   * setRouteFromPolyline — render the driver route directly from the encoded
   * polyline the backend already computed (RideTracking.expectedRoutePolyline),
   * skipping a redundant google.maps.DirectionsService round trip.
   */
  const setRouteFromPolyline = useCallback((encodedPolyline, routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !encodedPolyline) return;
    const points = decodePolyline(encodedPolyline);
    if (!points.length) return;
    applyDriverRoutePoints(points, routeType);
  }, [mapRef, applyDriverRoutePoints]);

  // ── CA route from DirectionsResult ────────────────────────────────────────
  const setCaRoute = useCallback((directionsResult) => {
    const map = mapRef.current;
    if (!map || !directionsResult) return;
    const points = extractRoutePolyline(directionsResult);
    caRoutePointsRef.current = points;
    ensureCaLines();
    const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
    caBorderLineRef.current?.setPath(path);
    caRouteLineRef.current?.setPath(path);
  }, [mapRef, ensureCaLines]);

  // ── CA route from raw {lat,lng} array ─────────────────────────────────────
  const setCaRouteDirect = useCallback((points) => {
    const map = mapRef.current;
    if (!map || !points?.length) return;
    caRoutePointsRef.current = points;
    ensureCaLines();
    const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
    caBorderLineRef.current?.setPath(path);
    caRouteLineRef.current?.setPath(path);
  }, [mapRef, ensureCaLines]);

  // ── Update traversed / remaining split (driver) ───────────────────────────
  const updateProgress = useCallback((lat, lng) => {
    const points = routePointsRef.current;
    if (!points?.length || !remainingLineRef.current) return;

    const snap  = snapToPolyline(lat, lng, points);
    const idx   = snap.segmentIndex;
    const t     = snap.t;
    const segA  = points[idx];
    const segB  = points[idx + 1] || segA;

    const splitPt = {
      lat: segA.lat + t * (segB.lat - segA.lat),
      lng: segA.lng + t * (segB.lng - segA.lng),
    };

    const traversed = [
      ...points.slice(0, idx + 1).map(p => ({ lat: p.lat, lng: p.lng })),
      splitPt,
    ];
    const remaining = [
      splitPt,
      ...points.slice(idx + 1).map(p => ({ lat: p.lat, lng: p.lng })),
    ];

    traversedLineRef.current?.setPath(traversed);
    remainingLineRef.current?.setPath(remaining);
    borderLineRef.current?.setPath(remaining);
  }, []);

  /**
   * updateCaProgress — trims the CA's own route line as the CA moves toward
   * the join point / patient. No traversed/remaining split for the CA
   * line (it's already visually distinct as a dashed purple line) — just
   * drop the portion already covered so the line keeps pointing from
   * "where the CA is right now" to "where they're headed."
   */
  const updateCaProgress = useCallback((lat, lng) => {
    const points = caRoutePointsRef.current;
    if (!points?.length || !caRouteLineRef.current) return;

    const snap = snapToPolyline(lat, lng, points);
    const idx  = snap.segmentIndex;
    const t    = snap.t;
    const segA = points[idx];
    const segB = points[idx + 1] || segA;

    const splitPt = {
      lat: segA.lat + t * (segB.lat - segA.lat),
      lng: segA.lng + t * (segB.lng - segA.lng),
    };

    const remaining = [splitPt, ...points.slice(idx + 1).map(p => ({ lat: p.lat, lng: p.lng }))];
    caRouteLineRef.current?.setPath(remaining);
    caBorderLineRef.current?.setPath(remaining);
  }, []);

  // ── Clear helpers ─────────────────────────────────────────────────────────
  const clearCaRoute = useCallback(() => {
    [caRouteLineRef, caBorderLineRef].forEach(ref => {
      if (ref.current) { ref.current.setMap(null); ref.current = null; }
    });
    caRoutePointsRef.current = [];
  }, []);

  const clearDriverRoute = useCallback(() => {
    [traversedLineRef, remainingLineRef, borderLineRef].forEach(ref => {
      if (ref.current) { ref.current.setMap(null); ref.current = null; }
    });
    routePointsRef.current = [];
  }, []);

  const clearRoute = useCallback(() => {
    clearDriverRoute();
    clearCaRoute();
  }, [clearDriverRoute, clearCaRoute]);

  useEffect(() => () => clearRoute(), [clearRoute]);

  return {
    setRoute,
    setRouteFromPolyline,
    updateProgress,
    clearRoute,
    clearDriverRoute,
    setCaRoute,
    setCaRouteDirect,
    updateCaProgress,
    clearCaRoute,
    routePointsRef,
    caRoutePointsRef,
  };
}