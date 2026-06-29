'use client';

import { useEffect, useState } from 'react';

let loaderPromise = null;

function isMapsReady() {
  return typeof window !== 'undefined'
    && !!window.google?.maps?.marker?.AdvancedMarkerElement
    && !!window.google?.maps?.DirectionsService;
}

function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isMapsReady()) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-js-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id    = 'google-maps-js-sdk';
    // `libraries=marker` -> AdvancedMarkerElement (used by every marker hook
    // in this codebase). `v=weekly` keeps the marker library out of beta.
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly&loading=async`;
    script.async = true;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps JS SDK'));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/**
 * useGoogleMapsLoader
 * Singleton script loader — safe to call from multiple components/pages
 * mounted at once; the underlying <script> tag and network request happen
 * exactly once per page session.
 *
 * @returns {{ loaded: boolean, error: string|null }}
 */
export function useGoogleMapsLoader() {
  const [loaded, setLoaded] = useState(isMapsReady());
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (loaded) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
      return;
    }

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => { if (!cancelled) setLoaded(true); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load Google Maps'); });

    return () => { cancelled = true; };
  }, [loaded]);

  return { loaded, error };
}