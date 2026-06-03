/**
 * useGoogleMaps.js — Likeson.in
 * Consumes GoogleMapsProvider context. Never calls useJsApiLoader directly.
 */
import { useContext } from 'react';
import { GoogleMapsContext } from '@/context/GoogleMapsProvider';

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
}

export default useGoogleMaps;