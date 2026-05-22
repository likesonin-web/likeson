// page route //app/context/GoogleMapsProvider.jsx
'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

// ── SINGLE SOURCE OF TRUTH for all Google Maps config ─────────────────────────
// Change libraries here ONLY — never in individual components.
// 'places' is intentionally OMITTED — use google.maps.importLibrary("places") instead.
const MAPS_CONFIG = {
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
  libraries:        ['geometry', 'marker'],  // ← the ONLY allowed array in the app
  mapIds:           [process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f'],
};

// ── Context ────────────────────────────────────────────────────────────────────
const GoogleMapsContext = createContext({ isLoaded: false, loadError: undefined });

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}

// ── Provider — mount once at app/layout level ──────────────────────────────────
export function GoogleMapsProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader(MAPS_CONFIG);
  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}


// ── How to use Google Places Autocomplete WITHOUT 'places' in the library list ──
// In any component that needs Places:
//
// const loadAutocomplete = useCallback(async (inputEl) => {
//   const { Autocomplete } = await window.google.maps.importLibrary('places');
//   return new Autocomplete(inputEl, { types: ['geocode'], componentRestrictions: { country: 'in' } });
// }, []);
//
// Or for the new PlaceAutocompleteElement (Maps JS API v3.56+):
// const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');