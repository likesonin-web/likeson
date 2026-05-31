'use client';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { decodePolyline } from '@/utils/navigationUtils';
import {
  buildDriverMarkerSVG,
  buildPatientMarkerSVG,
  buildCareAssistantMarkerSVG,
  buildHospitalMarkerSVG,
  buildDestinationMarkerSVG,
  createOrUpdateMarker,
  removeMarker,
} from './RideMarkerLayer';
import RideMapControls from './RideMapControls';

/**
 * RideLiveMap
 *
 * Props:
 *  - mapRef           {object}  from useGoogleMaps()
 *  - isLoaded         {boolean}
 *  - driverLocation   {{ lat, lng, heading, speedKmh }}
 *  - patientLocation  {{ lat, lng }}
 *  - caLocation       {{ lat, lng }}
 *  - hospitalLocation {{ lat, lng }}
 *  - destLocation     {{ lat, lng }}
 *  - routePolyline    {string}  encoded polyline
 *  - rideType         {string}  'full_care_ride' | 'care_assistant'
 *  - rideStatus       {string}
 */
export default function RideLiveMap({
  mapRef,
  isLoaded,
  driverLocation,
  patientLocation,
  caLocation,
  hospitalLocation,
  destLocation,
  routePolyline,
  rideType = 'full_care_ride',
  rideStatus,
}) {
  const mapContainerRef = useRef(null);
  const googleMapRef    = useRef(null);
  const markersRef      = useRef({ driver: null, patient: null, ca: null, hospital: null, dest: null });
  const polylineRef     = useRef(null);
  const [cameraMode, setCameraMode]  = useState('follow'); // follow | overview | fitBounds
  const isFullCare = rideType === 'full_care_ride';

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || googleMapRef.current) return;
    if (!window.google?.maps) return;

    const center = driverLocation
      ? { lat: driverLocation.lat, lng: driverLocation.lng }
      : patientLocation
        ? { lat: patientLocation.lat, lng: patientLocation.lng }
        : { lat: 16.506, lng: 80.648 }; // Vijayawada default

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 15,
      mapTypeControl:        false,
      fullscreenControl:     false,
      streetViewControl:     false,
      zoomControl:           false,
      gestureHandling:       'greedy',
      mapId:                 'care_ride_tracking_map',
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    googleMapRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ── Driver marker (live update) ──────────────────────────────────────────
  useEffect(() => {
    if (!googleMapRef.current || !driverLocation) return;
    const svgContent = buildDriverMarkerSVG(driverLocation.heading ?? 0);
    markersRef.current.driver = createOrUpdateMarker(
      googleMapRef.current,
      driverLocation,
      svgContent,
      'Driver',
      markersRef.current.driver,
    );

    if (cameraMode === 'follow') {
      googleMapRef.current.panTo({ lat: driverLocation.lat, lng: driverLocation.lng });
    }
  }, [driverLocation, cameraMode]);

  // ── Static markers ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map) return;

    if (patientLocation && isFullCare) {
      markersRef.current.patient = createOrUpdateMarker(
        map, patientLocation, buildPatientMarkerSVG(), 'Patient', markersRef.current.patient,
      );
    }

    if (caLocation) {
      markersRef.current.ca = createOrUpdateMarker(
        map, caLocation, buildCareAssistantMarkerSVG(), 'Care Assistant', markersRef.current.ca,
      );
    }

    if (hospitalLocation) {
      markersRef.current.hospital = createOrUpdateMarker(
        map, hospitalLocation, buildHospitalMarkerSVG(), 'Hospital', markersRef.current.hospital,
      );
    }

    if (destLocation) {
      markersRef.current.dest = createOrUpdateMarker(
        map, destLocation, buildDestinationMarkerSVG(), 'Destination', markersRef.current.dest,
      );
    }
  }, [patientLocation, caLocation, hospitalLocation, destLocation, isFullCare]);

  // ── Route polyline ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !routePolyline) return;

    const decoded = decodePolyline(routePolyline);
    if (!decoded.length) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    polylineRef.current = new window.google.maps.Polyline({
      path:          decoded,
      geodesic:      true,
      strokeColor:   getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#2563eb',
      strokeOpacity: 0.85,
      strokeWeight:  4,
      map,
    });
  }, [routePolyline]);

  // ── Camera modes ─────────────────────────────────────────────────────────
  const handleFollowDriver = useCallback(() => {
    setCameraMode('follow');
    if (driverLocation && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: driverLocation.lat, lng: driverLocation.lng });
      googleMapRef.current.setZoom(16);
    }
  }, [driverLocation]);

  const handleOverview = useCallback(() => {
    setCameraMode('overview');
    if (googleMapRef.current) googleMapRef.current.setZoom(13);
  }, []);

  const handleFitBounds = useCallback(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;
    setCameraMode('fitBounds');

    const bounds = new window.google.maps.LatLngBounds();
    const locs = [driverLocation, patientLocation, caLocation, hospitalLocation, destLocation];
    locs.forEach(loc => { if (loc?.lat) bounds.extend({ lat: loc.lat, lng: loc.lng }); });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [driverLocation, patientLocation, caLocation, hospitalLocation, destLocation]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.keys(markersRef.current).forEach(k => {
        markersRef.current[k] = removeMarker(markersRef.current[k]);
      });
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[240px] bg-base-200">
      {/* Map canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
          <div className="loading loading-md" aria-label="Loading map" />
        </div>
      )}

      {/* Map controls — top right */}
      <div className="absolute top-3 right-3 z-10">
        <RideMapControls
          cameraMode={cameraMode}
          onFollowDriver={handleFollowDriver}
          onOverview={handleOverview}
          onFitBounds={handleFitBounds}
        />
      </div>

      {/* Speed badge — bottom left when following */}
      {cameraMode === 'follow' && driverLocation?.speedKmh != null && (
        <div className="absolute bottom-3 left-3 z-10 bg-base-100/90 backdrop-blur-sm border border-base-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-base-content shadow-sm">
          {Math.round(driverLocation.speedKmh)} km/h
        </div>
      )}
    </div>
  );
}