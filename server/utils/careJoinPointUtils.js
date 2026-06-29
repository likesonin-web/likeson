/**
 * careJoinPointUtils.js — Likeson.in
 *
 * Utilities for resolving Care Assistant join points on full_care_ride.
 *
 *  
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. DECODE GOOGLE ENCODED POLYLINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * decodePolyline
 * @param {string} encoded — Google encoded polyline string
 * @returns {Array<[number, number]>} array of [lng, lat] (GeoJSON order)
 */
export const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    // GeoJSON order: [lng, lat]
    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. HAVERSINE
// ─────────────────────────────────────────────────────────────────────────────

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SNAP POINT TO NEAREST SEGMENT ON POLYLINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * snapToPolyline
 * @param {[number,number]} target   — [lng, lat] of CA current location
 * @param {Array<[number,number]>} polylineCoords — decoded polyline
 * @returns {{ snapPoint, distanceKm, segmentIndex } | null}
 */
export const snapToPolyline = (target, polylineCoords) => {
  if (!polylineCoords || polylineCoords.length === 0) return null;

  // FIX: filter out any NaN coords that could come from bad polyline decode
  const validCoords = polylineCoords.filter(
    c => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1])
  );
  if (validCoords.length === 0) return null;

  if (validCoords.length === 1) {
    return {
      snapPoint:    validCoords[0],
      distanceKm:   haversineKm(target, validCoords[0]),
      segmentIndex: 0,
    };
  }

  let bestDist   = Infinity;
  let bestPoint  = null;
  let bestSegIdx = 0;

  for (let i = 0; i < validCoords.length - 1; i++) {
    const A = validCoords[i];
    const B = validCoords[i + 1];

    const ABx = B[0] - A[0];
    const ABy = B[1] - A[1];
    const ATx = target[0] - A[0];
    const ATy = target[1] - A[1];

    const dot_AB_AB = ABx * ABx + ABy * ABy;
    let t = 0;
    if (dot_AB_AB > 0) {
      t = Math.max(0, Math.min(1, (ATx * ABx + ATy * ABy) / dot_AB_AB));
    }

    const proj = [A[0] + t * ABx, A[1] + t * ABy];
    const dist = haversineKm(target, proj);

    if (dist < bestDist) {
      bestDist   = dist;
      bestPoint  = proj;
      bestSegIdx = i;
    }
  }

  return { snapPoint: bestPoint, distanceKm: bestDist, segmentIndex: bestSegIdx };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RESOLVE CA JOIN POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolveCaJoinPoint
 *
 * FIX: zone 'at_pickup' now included in return but callers should treat
 * 'at_pickup' same as 'after_pickup' for RideStop sequence decisions.
 * Use `joinResult.stopSequence` (added to return) instead of raw zone
 * string when deciding stop insertion order.
 *
 * @returns {{
 *   joinPoint: [number,number],
 *   joinPointAddress: string,
 *   distCaToJoinKm: number,
 *   zone: 'before_pickup'|'at_pickup'|'after_pickup',
 *   stopSequence: 1|2,        // 1 = insert before patient pickup, 2 = after
 *   segmentIndex: number,
 *   caRoute: { from, to, distKm },
 *   waypointForDriver: object  // kept for backward compat, not for schema write
 * }}
 */
export const resolveCaJoinPoint = ({
  caCoords,
  driverCoords,
  pickupCoords,
  dropoffCoords,
  encodedPolyline = null,
}) => {
  // Build polyline: decode if available, else synthesize 3-point fallback
  let polyCoords = null;

  if (encodedPolyline) {
    const decoded = decodePolyline(encodedPolyline);
    if (decoded.length >= 2) polyCoords = decoded;
  }

  // Synthesize from 3 key points when polyline missing or unusable
  if (!polyCoords) {
    polyCoords = [driverCoords, pickupCoords, dropoffCoords];
  }

  const snap = snapToPolyline(caCoords, polyCoords);

  if (!snap) {
    // Ultimate fallback: nearest of 3 fixed points
    const candidates = [
      { point: driverCoords,  dist: haversineKm(caCoords, driverCoords),  zone: 'before_pickup', stopSequence: 1 },
      { point: pickupCoords,  dist: haversineKm(caCoords, pickupCoords),  zone: 'at_pickup',     stopSequence: 2 },
      { point: dropoffCoords, dist: haversineKm(caCoords, dropoffCoords), zone: 'after_pickup',  stopSequence: 2 },
    ];
    candidates.sort((a, b) => a.dist - b.dist);
    const best = candidates[0];

    return _buildResult({
      joinPoint:     best.point,
      distCaToJoin:  best.dist,
      zone:          best.zone,
      stopSequence:  best.stopSequence,
      segmentIndex:  0,
      caCoords,
    });
  }

  const { snapPoint, distanceKm: distCaToJoin, segmentIndex } = snap;

  // Find which polyline index is closest to pickupCoords
  // Everything before that index = before_pickup leg
  let pickupPolyIdx = 0;
  let minPickupDist = Infinity;
  for (let i = 0; i < polyCoords.length; i++) {
    const d = haversineKm(pickupCoords, polyCoords[i]);
    if (d < minPickupDist) {
      minPickupDist = d;
      pickupPolyIdx = i;
    }
  }

  let zone;
  let stopSequence;
  if (segmentIndex < pickupPolyIdx) {
    zone         = 'before_pickup';
    stopSequence = 1; // insert CA join stop BEFORE patient pickup
  } else if (segmentIndex === pickupPolyIdx) {
    zone         = 'at_pickup';
    stopSequence = 2; // treat same as after pickup for sequencing
  } else {
    zone         = 'after_pickup';
    stopSequence = 2; // insert CA join stop AFTER patient pickup
  }

  return _buildResult({
    joinPoint:    snapPoint,
    distCaToJoin,
    zone,
    stopSequence,
    segmentIndex,
    caCoords,
  });
};

/** Internal builder — keeps return shape consistent across all code paths */
const _buildResult = ({ joinPoint, distCaToJoin, zone, stopSequence, segmentIndex, caCoords }) => {
  const distCaToJoinKm = +distCaToJoin.toFixed(2);
  return {
    joinPoint,
    joinPointAddress: '', // caller reverse-geocodes if needed
    distCaToJoinKm,
    zone,
    stopSequence,        // FIX: explicit sequence number avoids zone-to-sequence logic in callers
    segmentIndex,
    caRoute: {
      from:   caCoords,
      to:     joinPoint,
      distKm: distCaToJoinKm,
    },
    // kept for caller backward compat — do NOT write to Ride.waypoints (removed schema field)
    waypointForDriver: {
      type:        'care_assistant_join',
      coordinates: joinPoint,
      label:       'Care Assistant Join Point',
      pickupFirst: zone !== 'before_pickup',
      isCompleted: false,
      completedAt: null,
      meta:        { zone, segmentIndex, distCaToJoinKm },
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. BUILD RIDESTOP CREATION PAYLOAD FOR CA JOIN
//
//    FIX: was buildCaJoinWaypoint returning Ride.waypoints[] shape (removed).
//    Now returns RideStop.create()-compatible object.
//    Caller still provides: rideId, bookingId, routeVersion, sequence.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildCaJoinStopPayload
 *
 * Returns object suitable for RideStop.create() for a CARE_ASSISTANT_JOIN stop.
 *
 * @param {ReturnType<typeof resolveCaJoinPoint>} joinResult
 * @param {{ rideId, bookingId, routeVersion, participantId, caCoords }} opts
 * @returns {object} RideStop creation payload (without _id)
 */
export const buildCaJoinStopPayload = (joinResult, { rideId, bookingId, routeVersion, participantId, caCoords }) => ({
  ride:         rideId,
  booking:      bookingId,
  routeVersion: routeVersion,
  sequence:     joinResult.stopSequence, // use resolved sequence, not raw zone
  stopType:     'CARE_ASSISTANT_JOIN',
  location: {
    type:        'Point',
    coordinates: joinResult.joinPoint,
    address:     joinResult.joinPointAddress || 'Care Assistant Join Point',
    label:       `CA Join — ${joinResult.zone.replace(/_/g, ' ')}`,
  },
  participant: participantId || null,
  status:      'PENDING',
  meta: {
    zone:           joinResult.zone,
    stopSequence:   joinResult.stopSequence,
    segmentIndex:   joinResult.segmentIndex,
    distCaToJoinKm: joinResult.distCaToJoinKm,
    caFrom:         caCoords || joinResult.caRoute.from,
  },
});

/**
 * buildCaJoinWaypoint — DEPRECATED
 *
 * Kept for any callers that haven't migrated yet.
 * Returns the old waypoints[] shape — do NOT write to Ride schema (field removed).
 * Migrate callers to buildCaJoinStopPayload.
 *
 * @deprecated Use buildCaJoinStopPayload instead
 */
export const buildCaJoinWaypoint = (joinResult) => {
  console.warn('[careJoinPointUtils] buildCaJoinWaypoint is deprecated — use buildCaJoinStopPayload. Ride.waypoints[] was removed.');
  return {
    type:        'care_assistant_join',
    location: {
      type:        'Point',
      coordinates: joinResult.joinPoint,
      address:     joinResult.joinPointAddress || 'Care Assistant Join Point',
      label:       `CA Join — ${joinResult.zone.replace(/_/g, ' ')}`,
    },
    pickupFirst: joinResult.waypointForDriver.pickupFirst,
    isCompleted: false,
    completedAt: null,
    meta: {
      zone:           joinResult.zone,
      segmentIndex:   joinResult.segmentIndex,
      distCaToJoinKm: joinResult.distCaToJoinKm,
      caFrom:         joinResult.caRoute.from,
    },
  };
};