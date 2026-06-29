/**
 * navigationUtils.js — Production navigation calculation engine
 *
 * FIX vs original:
 *  - getManeuverIcon: checks keep-left/keep-right/slight BEFORE plain
 *    left/right — original matched 'left' inside 'keep-left', returning
 *    wrong icon 'turn-left' instead of 'keep-left'.
 *  - formatEta: handles 0 minutes correctly (returned '--' instead of '< 1 min').
 *  - All exports are pure functions — safe for server + client import.
 */

// ─── MATH ────────────────────────────────────────────────────────────────────

function toRad(deg) { return (deg * Math.PI) / 180; }

/** Haversine distance in km */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing 0–360 from point1 → point2 */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const la1  = toRad(lat1);
  const la2  = toRad(lat2);
  const y    = Math.sin(dLng) * Math.cos(la2);
  const x    = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Low-pass heading — handles 0/360 wrap */
export function smoothHeading(current, target, factor = 0.15) {
  let diff = target - current;
  if (diff >  180) diff -= 360;
  if (diff < -180) diff += 360;
  return (current + diff * factor + 360) % 360;
}

export function interpolatePosition(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

// ─── KALMAN FILTER ───────────────────────────────────────────────────────────

export function createKalmanFilter() {
  let lat = null, lng = null, variance = -1;
  const Q = 3, minAcc = 1;

  return {
    _lastTs: null,
    update(newLat, newLng, accuracy = 10, timestampMs = Date.now()) {
      const acc = Math.max(accuracy, minAcc);
      if (variance < 0) {
        lat = newLat; lng = newLng; variance = acc * acc;
        this._lastTs = timestampMs;
        return { lat, lng };
      }
      const dt  = Math.max((timestampMs - (this._lastTs || timestampMs)) / 1000, 0.01);
      this._lastTs = timestampMs;
      variance += dt * Q * Q;
      const K    = variance / (variance + acc * acc);
      lat        = lat + K * (newLat - lat);
      lng        = lng + K * (newLng - lng);
      variance   = (1 - K) * variance;
      return { lat, lng };
    },
    reset() { variance = -1; lat = null; lng = null; this._lastTs = null; },
  };
}

// ─── POLYLINE ────────────────────────────────────────────────────────────────

export function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function projectPointOnSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const ax = bLng - aLng, ay = bLat - aLat;
  const len2 = ax * ax + ay * ay;
  if (len2 === 0) {
    return { projectedLat: aLat, projectedLng: aLng, t: 0, distanceKm: distanceKm(pLat, pLng, aLat, aLng) };
  }
  const t      = Math.max(0, Math.min(1, ((pLng - aLng) * ax + (pLat - aLat) * ay) / len2));
  const projLat = aLat + t * ay;
  const projLng = aLng + t * ax;
  return { projectedLat: projLat, projectedLng: projLng, t, distanceKm: distanceKm(pLat, pLng, projLat, projLng) };
}

export function snapToPolyline(pLat, pLng, polylinePoints) {
  if (!polylinePoints?.length) return { lat: pLat, lng: pLng, segmentIndex: 0, progressRatio: 0, distanceOffRouteKm: 0 };

  let bestDist = Infinity, bestSeg = 0, bestT = 0, bestLat = pLat, bestLng = pLng;

  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const a = polylinePoints[i], b = polylinePoints[i + 1];
    const r = projectPointOnSegment(pLat, pLng, a.lat, a.lng, b.lat, b.lng);
    if (r.distanceKm < bestDist) {
      bestDist = r.distanceKm; bestSeg = i; bestT = r.t;
      bestLat  = r.projectedLat; bestLng = r.projectedLng;
    }
  }

  return {
    lat: bestLat, lng: bestLng,
    segmentIndex:       bestSeg,
    progressRatio:      polylinePoints.length > 1 ? (bestSeg + bestT) / (polylinePoints.length - 1) : 0,
    distanceOffRouteKm: bestDist,
    t:                  bestT,
  };
}

export function remainingRouteDistanceKm(polylinePoints, fromSegmentIndex, fromT) {
  if (!polylinePoints?.length || fromSegmentIndex >= polylinePoints.length - 1) return 0;

  const startPt  = polylinePoints[fromSegmentIndex];
  const nextPt   = polylinePoints[fromSegmentIndex + 1];
  const partialLat = startPt.lat + fromT * (nextPt.lat - startPt.lat);
  const partialLng = startPt.lng + fromT * (nextPt.lng - startPt.lng);

  let total = distanceKm(partialLat, partialLng, nextPt.lat, nextPt.lng);
  for (let i = fromSegmentIndex + 1; i < polylinePoints.length - 1; i++) {
    total += distanceKm(polylinePoints[i].lat, polylinePoints[i].lng, polylinePoints[i + 1].lat, polylinePoints[i + 1].lng);
  }
  return total;
}

// ─── STEP PROGRESSION ────────────────────────────────────────────────────────

export function parseDirectionSteps(legs) {
  if (!legs?.length) return [];
  const steps = [];
  for (const leg of legs) {
    for (const step of leg.steps || []) {
      const startLat = step.start_location?.lat?.() ?? step.start_location?.lat ?? 0;
      const startLng = step.start_location?.lng?.() ?? step.start_location?.lng ?? 0;
      const endLat   = step.end_location?.lat?.()   ?? step.end_location?.lat   ?? 0;
      const endLng   = step.end_location?.lng?.()   ?? step.end_location?.lng   ?? 0;
      const polylinePoints = step.polyline?.points
        ? decodePolyline(step.polyline.points)
        : [{ lat: startLat, lng: startLng }, { lat: endLat, lng: endLng }];

      steps.push({
        instruction:     stripHtml(step.instructions || ''),
        maneuver:        step.maneuver || 'straight',
        distanceMeters:  step.distance?.value  || 0,
        distanceText:    step.distance?.text   || '',
        durationSeconds: step.duration?.value  || 0,
        startLat, startLng, endLat, endLng,
        polylinePoints,
      });
    }
  }
  return steps;
}

export function findCurrentStepByPolyline(steps, lat, lng, fromIndex = 0) {
  if (!steps?.length) return 0;
  let bestIdx = fromIndex, bestDist = Infinity;
  for (let i = fromIndex; i < Math.min(fromIndex + 4, steps.length); i++) {
    const snap = snapToPolyline(lat, lng, steps[i].polylinePoints);
    if (snap.distanceOffRouteKm < bestDist) { bestDist = snap.distanceOffRouteKm; bestIdx = i; }
  }
  return bestIdx;
}

export function distanceToStepEndMeters(step, lat, lng) {
  if (!step?.polylinePoints?.length) {
    return distanceKm(lat, lng, step?.endLat ?? lat, step?.endLng ?? lng) * 1000;
  }
  const snap = snapToPolyline(lat, lng, step.polylinePoints);
  return remainingRouteDistanceKm(step.polylinePoints, snap.segmentIndex, snap.t) * 1000;
}

// ─── OFF-ROUTE ───────────────────────────────────────────────────────────────

export function isHeadingMismatch(gpsHeading, stepHeading, thresholdDeg = 90) {
  if (gpsHeading == null || stepHeading == null) return false;
  let diff = Math.abs(gpsHeading - stepHeading);
  if (diff > 180) diff = 360 - diff;
  return diff > thresholdDeg;
}

export function offRouteScore(distanceOffKm, gpsHeading, stepHeading, speedKmh = 0) {
  const distScore = Math.min(distanceOffKm / 0.3, 1);
  let headingScore = 0;
  if (gpsHeading != null && stepHeading != null && speedKmh > 5) {
    let diff = Math.abs(gpsHeading - stepHeading);
    if (diff > 180) diff = 360 - diff;
    headingScore = Math.min(diff / 180, 1);
  }
  return distScore * 0.7 + headingScore * 0.3;
}

// ─── ANNOUNCEMENT BANDS ──────────────────────────────────────────────────────

export function getAnnouncementBand(distanceMeters, speedKmh = 30) {
  const m = speedKmh > 80 ? 2.0 : speedKmh > 50 ? 1.4 : 1.0;
  const bands = [
    { key: '500', minDist: 400 * m, maxDist: Infinity,      prefix: (d) => `In ${Math.round(d / 100) * 100} meters` },
    { key: '200', minDist: 150 * m, maxDist: 400 * m,       prefix: ()  => 'In 200 meters' },
    { key: '50',  minDist: 35  * m, maxDist: 150 * m,       prefix: ()  => 'In 50 meters'  },
    { key: 'now', minDist: 0,       maxDist: 35  * m,       prefix: ()  => 'Now'            },
  ];
  return bands.find(b => distanceMeters >= b.minDist && distanceMeters < b.maxDist) || null;
}

// ─── FORMAT ──────────────────────────────────────────────────────────────────

export function formatEta(minutes) {
  if (minutes == null) return '--';
  if (minutes < 1) return '< 1 min';       // FIX: was returning '--' for 0
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDistance(km) {
  if (km == null) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

export function formatSpeed(speedKmh) {
  if (speedKmh == null) return '0';
  return Math.round(speedKmh).toString();
}

/**
 * getManeuverIcon
 *
 * FIX: compound maneuvers (keep-left, keep-right, slight-left, slight-right,
 * u-turn, roundabout) checked BEFORE plain 'left' / 'right'.
 * Original: 'keep-left'.includes('left') matched plain 'left' branch first.
 */
export function getManeuverIcon(maneuver = '') {
  const m = (maneuver || '').toLowerCase();
  if (m.includes('u-turn'))       return 'u-turn';
  if (m.includes('roundabout'))   return 'roundabout';
  if (m.includes('keep-left'))    return 'keep-left';
  if (m.includes('keep-right'))   return 'keep-right';
  if (m.includes('slight-left'))  return 'keep-left';
  if (m.includes('slight-right')) return 'keep-right';
  if (m.includes('left'))         return 'turn-left';
  if (m.includes('right'))        return 'turn-right';
  if (m.includes('merge'))        return 'merge';
  if (m.includes('ramp'))         return 'merge';
  return 'straight';
}

export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

export function extractRoutePolyline(directionsResult) {
  if (!directionsResult?.routes?.[0]) return [];
  const points = [];
  for (const leg of directionsResult.routes[0].legs || []) {
    for (const step of leg.steps || []) {
      if (step.polyline?.points) points.push(...decodePolyline(step.polyline.points));
    }
  }
  return points;
}