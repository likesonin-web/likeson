'use client';

// ─── SVG marker builders ────────────────────────────────────────────────────

export function buildDriverMarkerSVG(heading = 0) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <g transform="rotate(${heading},22,22)">
        <circle cx="22" cy="22" r="20" fill="var(--primary,#2563eb)" opacity="0.18"/>
        <circle cx="22" cy="22" r="13" fill="var(--primary,#2563eb)"/>
        <!-- Arrow pointing up (north = 0°) -->
        <polygon points="22,6 17,22 22,18 27,22" fill="white" opacity="0.95"/>
      </g>
      <!-- Pulse ring -->
      <circle cx="22" cy="22" r="20" fill="none" stroke="var(--primary,#2563eb)" stroke-width="1.5" opacity="0.5">
        <animate attributeName="r" from="20" to="28" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite"/>
      </circle>
    </svg>`;
}

export function buildPatientMarkerSVG() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <path d="M20 2C11.16 2 4 9.16 4 18c0 10.5 16 28 16 28s16-17.5 16-28c0-8.84-7.16-16-16-16z"
            fill="var(--success,#16a34a)" stroke="white" stroke-width="2"/>
      <!-- Person icon -->
      <circle cx="20" cy="15" r="4" fill="white"/>
      <path d="M13 28c0-3.87 3.13-7 7-7s7 3.13 7 7" fill="white"/>
    </svg>`;
}

export function buildCareAssistantMarkerSVG() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <path d="M20 2C11.16 2 4 9.16 4 18c0 10.5 16 28 16 28s16-17.5 16-28c0-8.84-7.16-16-16-16z"
            fill="var(--secondary,#7c3aed)" stroke="white" stroke-width="2"/>
      <!-- Heart cross (care) -->
      <rect x="16" y="12" width="8" height="3" rx="1.5" fill="white"/>
      <rect x="16" y="12" width="8" height="3" rx="1.5" fill="white" transform="rotate(90,20,13.5)"/>
    </svg>`;
}

export function buildHospitalMarkerSVG() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <rect x="2" y="2" width="32" height="32" rx="8" fill="var(--error,#dc2626)" stroke="white" stroke-width="2"/>
      <!-- H cross -->
      <rect x="10" y="15" width="16" height="4" rx="2" fill="white"/>
      <rect x="15" y="10" width="4" height="16" rx="2" fill="white"/>
    </svg>`;
}

export function buildDestinationMarkerSVG() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <path d="M18 2C10.27 2 4 8.27 4 16c0 9.5 14 26 14 26s14-16.5 14-26c0-7.73-6.27-14-14-14z"
            fill="var(--accent,#d97706)" stroke="white" stroke-width="2"/>
      <circle cx="18" cy="16" r="5" fill="white"/>
    </svg>`;
}

/**
 * createMarker — create/update a Google Maps AdvancedMarkerElement or Marker.
 * Handles both Maps v3.55+ AdvancedMarkerElement and legacy Marker.
 *
 * @param {google.maps.Map} map
 * @param {{ lat: number, lng: number }} position
 * @param {string} svgContent
 * @param {string} title
 * @param {google.maps.marker.AdvancedMarkerElement|google.maps.Marker|null} existing
 * @returns {google.maps.marker.AdvancedMarkerElement|google.maps.Marker}
 */
export function createOrUpdateMarker(map, position, svgContent, title, existing = null) {
  if (!map || !position) return existing;

  const latLng = { lat: position.lat, lng: position.lng };

  // Use AdvancedMarkerElement if available
  const AdvancedMarker = window.google?.maps?.marker?.AdvancedMarkerElement;

  if (AdvancedMarker) {
    if (existing) {
      existing.position = latLng;
      return existing;
    }
    const container = document.createElement('div');
    container.innerHTML = svgContent.trim();
    return new AdvancedMarker({ map, position: latLng, content: container, title });
  }

  // Fallback: legacy Marker with SVG icon
  const Marker = window.google?.maps?.Marker;
  if (!Marker) return existing;

  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`,
    anchor: new window.google.maps.Point(22, 22),
  };

  if (existing) {
    existing.setPosition(latLng);
    existing.setIcon(icon);
    return existing;
  }

  return new Marker({ map, position: latLng, icon, title, optimized: false });
}

/**
 * removeMarker — detach from map + nullify.
 */
export function removeMarker(marker) {
  if (!marker) return null;
  if (typeof marker.setMap === 'function') marker.setMap(null);
  if (marker.map !== undefined) marker.map = null;
  return null;
}