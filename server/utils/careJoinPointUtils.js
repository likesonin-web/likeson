/**
 * careJoinPointUtils.js — Likeson.in
 *
 * Utilities for:
 *   1. Decoding Google encoded polyline → array of [lng, lat] coords
 *   2. Snapping a point to nearest segment on a polyline
 *   3. Resolving CA join point on full_care_ride route
 *   4. Splitting route into driver-leg and CA-leg
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. POLYLINE DECODER
//    Google encoded polyline → [[lng, lat], ...]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * decodePolyline
 * @param {string} encoded — Google encoded polyline string
 * @returns {Array<[number, number]>} array of [lng, lat]
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

    // decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    // decode longitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    // Google polyline is [lat, lng] → store as [lng, lat] (GeoJSON order)
    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. HAVERSINE (local, no import needed in util)
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
//
//    For each segment A→B, find closest point P on segment to target T.
//    Use parametric projection: t = dot(AT, AB) / dot(AB, AB), clamp [0,1].
//    Return closest projected point + distance + segment index.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * snapToPolyline
 * @param {[number,number]} target   — [lng, lat] of CA current location
 * @param {Array<[number,number]>} polylineCoords — decoded polyline
 * @returns {{ snapPoint: [number,number], distanceKm: number, segmentIndex: number }}
 */
export const snapToPolyline = (target, polylineCoords) => {
  if (!polylineCoords || polylineCoords.length === 0) return null;
  if (polylineCoords.length === 1) {
    return {
      snapPoint:    polylineCoords[0],
      distanceKm:   haversineKm(target, polylineCoords[0]),
      segmentIndex: 0,
    };
  }

  let bestDist     = Infinity;
  let bestPoint    = null;
  let bestSegIdx   = 0;

  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const A = polylineCoords[i];
    const B = polylineCoords[i + 1];
    const T = target;

    // vectors in degrees (good enough for short segments)
    const ABx = B[0] - A[0];
    const ABy = B[1] - A[1];
    const ATx = T[0] - A[0];
    const ATy = T[1] - A[1];

    const dot_AB_AB = ABx * ABx + ABy * ABy;
    let t = 0;

    if (dot_AB_AB > 0) {
      t = (ATx * ABx + ATy * ABy) / dot_AB_AB;
      t = Math.max(0, Math.min(1, t)); // clamp to [0,1]
    }

    const projX = A[0] + t * ABx;
    const projY = A[1] + t * ABy;
    const proj  = [projX, projY];
    const dist  = haversineKm(T, proj);

    if (dist < bestDist) {
      bestDist   = dist;
      bestPoint  = proj;
      bestSegIdx = i;
    }
  }

  return {
    snapPoint:    bestPoint,
    distanceKm:   bestDist,
    segmentIndex: bestSegIdx,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RESOLVE CA JOIN POINT FOR full_care_ride
//
//    Route has 3 key coords: driverCoords, pickupCoords, dropoffCoords
//    Full polyline covers: driver → pickup → dropoff
//
//    Steps:
//      a) Decode full polyline (or build from 3 coords if no polyline)
//      b) Snap CA location to nearest point on full polyline
//      c) Determine which "zone" the snap falls in:
//           - Before pickup  → join point is on driver→pickup leg
//           - After pickup   → join point is on pickup→dropoff leg
//      d) Return:
//           - joinPoint coords (snapped)
//           - caRoute: CA current location → joinPoint (CA travels here independently)
//           - driverWaypoint: inserted into driver's route at joinPoint
//           - zone: 'before_pickup' | 'at_pickup' | 'after_pickup'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolveCaJoinPoint
 *
 * @param {object} params
 * @param {[number,number]} params.caCoords         — CA current [lng, lat]
 * @param {[number,number]} params.driverCoords     — Driver current [lng, lat]
 * @param {[number,number]} params.pickupCoords     — Patient pickup [lng, lat]
 * @param {[number,number]} params.dropoffCoords    — Hospital/dropoff [lng, lat]
 * @param {string|null}     params.encodedPolyline  — Full route polyline or null
 *
 * @returns {{
 *   joinPoint: [number,number],
 *   joinPointAddress: string,
 *   distCaToJoinKm: number,
 *   zone: 'before_pickup'|'at_pickup'|'after_pickup',
 *   segmentIndex: number,
 *   caRoute: { from: [number,number], to: [number,number], distKm: number },
 *   waypointForDriver: { type: string, coordinates: [number,number], label: string }
 * }}
 */
export const resolveCaJoinPoint = ({
  caCoords,
  driverCoords,
  pickupCoords,
  dropoffCoords,
  encodedPolyline = null,
}) => {
  // Build polyline coords: decode if available, else use 3 fixed points
  let polyCoords;

  if (encodedPolyline) {
    polyCoords = decodePolyline(encodedPolyline);
  }

  // Fallback: synthesize from 3 key points if polyline missing or too short
  if (!polyCoords || polyCoords.length < 3) {
    polyCoords = [driverCoords, pickupCoords, dropoffCoords];
  }

  // Snap CA to nearest point on full polyline
  const snap = snapToPolyline(caCoords, polyCoords);

  if (!snap) {
    // Ultimate fallback: nearest of 3 fixed points
    const dists = [
      { point: driverCoords,  dist: haversineKm(caCoords, driverCoords),  zone: 'before_pickup' },
      { point: pickupCoords,  dist: haversineKm(caCoords, pickupCoords),  zone: 'at_pickup'     },
      { point: dropoffCoords, dist: haversineKm(caCoords, dropoffCoords), zone: 'after_pickup'  },
    ];
    dists.sort((a, b) => a.dist - b.dist);
    const best = dists[0];
    return {
      joinPoint:         best.point,
      joinPointAddress:  '',
      distCaToJoinKm:    +best.dist.toFixed(2),
      zone:              best.zone,
      segmentIndex:      0,
      caRoute: {
        from:   caCoords,
        to:     best.point,
        distKm: +best.dist.toFixed(2),
      },
      waypointForDriver: {
        type:        'care_assistant_join',
        coordinates: best.point,
        label:       'Care Assistant Join Point',
        pickupFirst: false,
        isCompleted: false,
        meta:        { zone: best.zone },
      },
    };
  }

  const { snapPoint, distanceKm: distCaToJoin, segmentIndex } = snap;

  // Determine zone: find which segment index pickup falls on
  // pickup is the transition point between leg1 (driver→pickup) and leg2 (pickup→dropoff)
  // Find the polyline index nearest to pickupCoords
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
  if (segmentIndex < pickupPolyIdx) {
    zone = 'before_pickup';
  } else if (segmentIndex === pickupPolyIdx) {
    zone = 'at_pickup';
  } else {
    zone = 'after_pickup';
  }

  const distCaToJoinKm = +distCaToJoin.toFixed(2);

  return {
    joinPoint:        snapPoint,
    joinPointAddress: '',            // caller can reverse-geocode if needed
    distCaToJoinKm,
    zone,
    segmentIndex,
    caRoute: {
      from:   caCoords,
      to:     snapPoint,
      distKm: distCaToJoinKm,
    },
    waypointForDriver: {
      type:        'care_assistant_join',
      coordinates: snapPoint,
      label:       'Care Assistant Join Point',
      pickupFirst: zone !== 'before_pickup', // if before pickup, driver picks CA before patient
      isCompleted: false,
      completedAt: null,
      meta: {
        zone,
        segmentIndex,
        distCaToJoinKm,
      },
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. BUILD CA JOIN WAYPOINT FOR RIDE.waypoints ARRAY
//    Returns waypoint object matching Ride schema waypoints sub-schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildCaJoinWaypoint
 * @param {ReturnType<typeof resolveCaJoinPoint>} joinResult
 * @returns {object} waypoint matching Ride.waypoints schema
 */
export const buildCaJoinWaypoint = (joinResult) => ({
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
});