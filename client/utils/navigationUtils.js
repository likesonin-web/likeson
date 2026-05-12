/**
 * navigationUtils.js
 * Pure utility functions for navigation calculations.
 * No React — safe to import from server and client components.
 */

/** Haversine distance km between two lat/lng objects */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/** Calculate bearing (0-360) from point1 to point2 */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const la1 = toRad(lat1);
  const la2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smooth heading interpolation — avoids jumpy marker rotation */
export function smoothHeading(current, target, factor = 0.15) {
  let diff = target - current;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (current + diff * factor + 360) % 360;
}

/** Interpolate position between two lat/lng points */
export function interpolatePosition(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

/** Format ETA minutes to human string */
export function formatEta(minutes) {
  if (!minutes && minutes !== 0) return '--';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Format distance km */
export function formatDistance(km) {
  if (!km && km !== 0) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

/** Format speed kmh */
export function formatSpeed(speedKmh) {
  if (!speedKmh && speedKmh !== 0) return '0';
  return Math.round(speedKmh).toString();
}

/** Get maneuver icon name from Google step instruction */
export function getManeuverIcon(maneuver) {
  if (!maneuver) return 'straight';
  const m = maneuver.toLowerCase();
  if (m.includes('left')) return 'turn-left';
  if (m.includes('right')) return 'turn-right';
  if (m.includes('u-turn')) return 'u-turn';
  if (m.includes('roundabout')) return 'roundabout';
  if (m.includes('merge')) return 'merge';
  if (m.includes('ramp')) return 'ramp';
  return 'straight';
}

/** Strip HTML tags from Google directions instruction */
export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

/** Parse Google directions steps into nav steps array */
export function parseDirectionSteps(legs) {
  if (!legs?.length) return [];
  const steps = [];
  for (const leg of legs) {
    for (const step of leg.steps || []) {
      steps.push({
        instruction: stripHtml(step.instructions || ''),
        maneuver: step.maneuver || 'straight',
        distanceMeters: step.distance?.value || 0,
        distanceText: step.distance?.text || '',
        durationSeconds: step.duration?.value || 0,
        startLat: step.start_location?.lat(),
        startLng: step.start_location?.lng(),
        endLat: step.end_location?.lat(),
        endLng: step.end_location?.lng(),
      });
    }
  }
  return steps;
}

/** Find next step based on current position */
export function findNextStep(steps, currentLat, currentLng, completedIndex = -1) {
  if (!steps?.length) return { step: null, index: -1 };

  for (let i = Math.max(0, completedIndex + 1); i < steps.length; i++) {
    const step = steps[i];
    const dist = distanceKm(currentLat, currentLng, step.endLat, step.endLng);
    if (dist > 0.03) { // 30m threshold
      return { step, index: i };
    }
  }
  return { step: steps[steps.length - 1], index: steps.length - 1 };
}