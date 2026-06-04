'use client';

/**
 * useRouteRenderer.js — Likeson.in
 *
 * FIXES vs previous version:
 *  - full_care_ride needs TWO separate polyline sets:
 *      1. Driver route (existing: traversed + remaining + border)
 *      2. CA route to join point (new: caRoute line — dashed purple)
 *  - Added setCaRoute(directionsResult | latLngArray) — renders CA route
 *  - Added clearCaRoute() — removes CA route polyline
 *  - Added setCaRouteDirect(pointsArray) — for when we have [lng,lat] pairs
 *    directly (from caJoinPoint.caRoute) without a DirectionsResult
 *  - Colors object extended with CA route color
 *  - ensureLines() never recreates existing lines (guard added)
 *  - clearRoute() also calls clearCaRoute()
 */

import { useRef, useCallback, useEffect } from 'react';
import { extractRoutePolyline, snapToPolyline } from '@/utils/navigationUtils';

export function useRouteRenderer(mapRef) {
  // ── Driver route polylines ────────────────────────────────────────────────
  const traversedLineRef  = useRef(null);  // driven portion
  const remainingLineRef  = useRef(null);  // upcoming portion
  const borderLineRef     = useRef(null);  // outline/border for remaining

  // ── CA route polyline (full_care_ride only) ───────────────────────────────
  const caRouteLineRef    = useRef(null);  // CA path from their position → join point
  const caBorderLineRef   = useRef(null);  // border/shadow for CA route

  // ── Data ──────────────────────────────────────────────────────────────────
  const routePointsRef    = useRef([]);    // full decoded driver polyline
  const caRoutePointsRef  = useRef([]);    // CA route points

  // ── Colors ───────────────────────────────────────────────────────────────
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
    caRoute: {
      line:   '#8b5cf6',      // purple — care assistant route to join point
      border: '#6d28d9',
    },
  };

  // ── Create driver polyline objects ────────────────────────────────────────
  const ensureLines = useCallback((routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.Polyline) return;

    const colors = COLORS[routeType] || COLORS.toPickup;

    if (!borderLineRef.current) {
      borderLineRef.current = new window.google.maps.Polyline({
        map,
        path:          [],
        strokeColor:   colors.border,
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
        strokeColor:   colors.remaining,
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
        strokeColor:   colors.traversed,
        strokeWeight:  4,
        strokeOpacity: 0.5,
        zIndex:        1,
        clickable:     false,
      });
    }
  }, [mapRef]); // eslint-disable-line

  // ── Create CA route polylines ─────────────────────────────────────────────
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
        // Dashed pattern — distinguishes CA route from driver route
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
  }, [mapRef]); // eslint-disable-line

  // ── Apply colors for route type ───────────────────────────────────────────
  const applyColors = useCallback((routeType = 'toPickup') => {
    const colors = COLORS[routeType] || COLORS.toPickup;
    borderLineRef.current?.setOptions({ strokeColor: colors.border });
    remainingLineRef.current?.setOptions({ strokeColor: colors.remaining });
    traversedLineRef.current?.setOptions({ strokeColor: colors.traversed });
  }, []); // eslint-disable-line

  // ── Set driver route (from DirectionsResult) ──────────────────────────────
  const setRoute = useCallback((directionsResult, routeType = 'toPickup') => {
    const map = mapRef.current;
    if (!map || !directionsResult) return;

    const points = extractRoutePolyline(directionsResult);
    routePointsRef.current = points;

    ensureLines(routeType);
    applyColors(routeType);

    const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
    borderLineRef.current?.setPath(path);
    remainingLineRef.current?.setPath(path);
    traversedLineRef.current?.setPath([]);
  }, [mapRef, ensureLines, applyColors]);

  // ── Set CA route from DirectionsResult ───────────────────────────────────
  /**
   * setCaRoute — draws CA path from DirectionsResult.
   * Used when you have a full DirectionsResult for the CA's path to join point.
   *
   * @param {google.maps.DirectionsResult} directionsResult
   */
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

  // ── Set CA route from raw [lng,lat] coordinate pairs ─────────────────────
  /**
   * setCaRouteDirect — draws CA path from raw coordinate array.
   * Used with caJoinPoint.caRoute.from/to or direct coordinate pairs
   * (no DirectionsResult needed — straight-line approximation).
   *
   * @param {{ lat: number, lng: number }[]} points  — already lat/lng objects
   */
  const setCaRouteDirect = useCallback((points) => {
    const map = mapRef.current;
    if (!map || !points?.length) return;

    caRoutePointsRef.current = points;

    ensureCaLines();

    const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
    caBorderLineRef.current?.setPath(path);
    caRouteLineRef.current?.setPath(path);
  }, [mapRef, ensureCaLines]);

  // ── Update driver route progress ──────────────────────────────────────────
  const updateProgress = useCallback((lat, lng) => {
    const points = routePointsRef.current;
    if (!points?.length || !remainingLineRef.current) return;

    const snap = snapToPolyline(lat, lng, points);
    const idx  = snap.segmentIndex;
    const t    = snap.t;

    const segA = points[idx];
    const segB = points[idx + 1] || segA;
    const splitLat = segA.lat + t * (segB.lat - segA.lat);
    const splitLng = segA.lng + t * (segB.lng - segA.lng);
    const splitPt  = { lat: splitLat, lng: splitLng };

    const traversed = points.slice(0, idx + 1).map(p => ({ lat: p.lat, lng: p.lng }));
    traversed.push(splitPt);

    const remaining = [splitPt, ...points.slice(idx + 1).map(p => ({ lat: p.lat, lng: p.lng }))];

    traversedLineRef.current?.setPath(traversed);
    remainingLineRef.current?.setPath(remaining);
    borderLineRef.current?.setPath(remaining);
  }, []);

  // ── Clear CA route only ───────────────────────────────────────────────────
  const clearCaRoute = useCallback(() => {
    [caRouteLineRef, caBorderLineRef].forEach(ref => {
      if (ref.current) {
        ref.current.setMap(null);
        ref.current = null;
      }
    });
    caRoutePointsRef.current = [];
  }, []);

  // ── Clear driver route only ───────────────────────────────────────────────
  const clearDriverRoute = useCallback(() => {
    [traversedLineRef, remainingLineRef, borderLineRef].forEach(ref => {
      if (ref.current) {
        ref.current.setMap(null);
        ref.current = null;
      }
    });
    routePointsRef.current = [];
  }, []);

  // ── Clear ALL routes (driver + CA) ────────────────────────────────────────
  const clearRoute = useCallback(() => {
    clearDriverRoute();
    clearCaRoute();
  }, [clearDriverRoute, clearCaRoute]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => clearRoute();
  }, [clearRoute]);

  return {
    // Driver route
    setRoute,
    updateProgress,
    clearRoute,
    clearDriverRoute,
    routePointsRef,
    // CA route
    setCaRoute,
    setCaRouteDirect,
    clearCaRoute,
    caRoutePointsRef,
  };
}