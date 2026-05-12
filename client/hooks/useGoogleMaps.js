/**
 * useGoogleMaps.js — Likeson.in
 *
 * Single shared Google Maps loader.
 * Import THIS in every component that needs Maps — never call
 * useJsApiLoader directly in individual components.
 *
 * Prevents: "Loader must not be called again with different options"
 *
 * Usage:
 *   import { useGoogleMaps } from '@/hooks/useGoogleMaps';
 *   const { isLoaded } = useGoogleMaps();
 */

import { useJsApiLoader } from '@react-google-maps/api';

// Libraries array must be STABLE (outside component) to prevent re-init
const LIBRARIES = ['geometry', 'places', 'marker'];

/**
 * useGoogleMaps — wraps useJsApiLoader with consistent options.
 * Safe to call in multiple components — @react-google-maps/api
 * deduplicates when id + options match exactly.
 */
export function useGoogleMaps() {
  return useJsApiLoader({
    id:              'google-map-script',          // same id everywhere
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
    mapIds:          [process.env.NEXT_PUBLIC_MAP_ID || ''],
    libraries:       LIBRARIES,
  });
}

export default useGoogleMaps;