'use client';

import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const GoogleMapsContext = createContext({
  isLoaded: false,
  loadError: null,
});

const GOOGLE_MAPS_LIBRARIES = Object.freeze([
  'places',
  'geometry',
  'marker',
]);

export function GoogleMapsProvider({ children }) {
 const { isLoaded, loadError } = useJsApiLoader({
  id: 'likeson-google-map',
  googleMapsApiKey:
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',

  libraries: GOOGLE_MAPS_LIBRARIES,

  version: 'weekly',

  language: 'en',

  region: 'IN',

  preventGoogleFontsLoading: true,
});

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}