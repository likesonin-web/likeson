'use client';
 
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  memo,
  createContext,
  useContext,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/GoogleMapsProvider';

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  fetchRide,
  fetchRideLive,
  fetchRideTracking,
  selectCurrentRide,
  selectSocketLive,
  selectLiveData,
  selectTrackingData,
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketDriverAccepted,
  socketDriverEnRoute,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketAtStop,
  socketRideCompleted,
  socketRideCancelled,
  socketNavigationTargetChanged,
  socketHospitalEtaUpdate,
  socketCareAssistantTracking,
  socketRideAssigned,
} from '@/store/slices/rideRequestSlice';

import {
  fetchCareTrackingSnapshot,
  careJoinRide,
  selectCareTrackingSnapshot,
  selectCareAssistantLocation,
  selectCareRideStatus,
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  setCareRideWorkflow,
} from '@/store/slices/operationsSlice';

// ── Socket ────────────────────────────────────────────────────────────────────
import { useSocket, useSos } from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID     = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const LERP_T     = 0.10;
const POLL_MS    = 6_000;
const GPS_STALE  = 30_000;          // ms before GPS considered stale
const ROUTE_THROTTLE = 8_000;       // ms between DirectionsService calls
const DEFAULT_CENTER = { lat: 16.506, lng: 80.648 };
const MAP_LIBS   = ['places', 'geometry', 'marker'];

export const RIDE_STATUSES = {
  SEARCHING:       'searching',
  ASSIGNED:        'driver_assigned',
  ACCEPTED:        'driver_accepted',
  EN_ROUTE:        'driver_en_route',
  ARRIVED:         'driver_arrived',
  OTP_VERIFIED:    'otp_verified',
  IN_PROGRESS:     'in_progress',
  AT_STOP:         'at_stop',
  COMPLETED:       'completed',
  CANCELLED:       'cancelled',
  SOS:             'sos_triggered',
};

const STATUS_META = {
  searching:       { label: 'Searching Driver',  color: '#f59e0b', pulse: true  },
  driver_assigned: { label: 'Driver Assigned',   color: '#3b82f6', pulse: false },
  driver_accepted: { label: 'Driver Accepted',   color: '#3b82f6', pulse: false },
  driver_en_route: { label: 'Driver En Route',   color: '#6366f1', pulse: true  },
  driver_arrived:  { label: 'Driver Arrived',    color: '#f97316', pulse: true  },
  otp_verified:    { label: 'OTP Verified',      color: '#10b981', pulse: false },
  in_progress:     { label: 'Ride In Progress',  color: '#10b981', pulse: true  },
  at_stop:         { label: 'At Stop',           color: '#f59e0b', pulse: false },
  completed:       { label: 'Completed',         color: '#10b981', pulse: false },
  cancelled:       { label: 'Cancelled',         color: '#ef4444', pulse: false },
  sos_triggered:   { label: 'SOS ACTIVE',        color: '#ef4444', pulse: true  },
};

const TARGET_LABELS = {
  pickup_patient:        'Patient Pickup',
  pickup_care_assistant: 'CA Pickup',
  hospital_drop:         'Hospital',
  patient_drop:          'Patient Drop',
};

const TIMELINE_NODES = [
  { key: 'searching',       label: 'Search'    },
  { key: 'driver_assigned', label: 'Assign'    },
  { key: 'driver_en_route', label: 'En Route'  },
  { key: 'driver_arrived',  label: 'Arrived'   },
  { key: 'otp_verified',    label: 'OTP ✓'     },
  { key: 'in_progress',     label: 'Moving'    },
  { key: 'completed',       label: 'Done'      },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING STATE CONTEXT — avoids prop-drilling across all sub-components
// ─────────────────────────────────────────────────────────────────────────────

const TrackingCtx = createContext(null);
const useTracking = () => useContext(TrackingCtx);

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING STATE REDUCER — single source of truth for all live state
// ─────────────────────────────────────────────────────────────────────────────

const INIT_TRACKING = {
    rideStatus:    null,
  rideStage:     null,      // ← ADD
  etaMinutes:    null,
  
  distKm:         null,
  driverLat:      null,
  driverLng:      null,
  driverHeading:  0,
  driverSpeed:    0,
  activeTarget:   null,
  hasDeviation:   false,
  lastGpsAt:      null,
  lastEventAt:    null,
  joinLoading:    false,
  sosActive:      false,
};

function trackingReducer(state, action) {
  switch (action.type) {
   case 'STATUS':
  return { 
    ...state, 
    rideStatus:  action.status, 
    rideStage:   action.rideStage ?? state.rideStage,  // ← ADD
    lastEventAt: Date.now() 
  };
    case 'ETA':
      return { ...state, etaMinutes: action.eta, distKm: action.distKm ?? state.distKm, lastEventAt: Date.now() };
    case 'LOCATION':
      return {
        ...state,
        driverLat:     action.lat,
        driverLng:     action.lng,
        driverHeading: action.heading ?? state.driverHeading,
        driverSpeed:   action.speed   ?? state.driverSpeed,
        lastGpsAt:     Date.now(),
        lastEventAt:   Date.now(),
      };
    case 'TARGET':
      return { ...state, activeTarget: action.target, lastEventAt: Date.now() };
    case 'DEVIATION':
      return { ...state, hasDeviation: action.value, lastEventAt: Date.now() };
    case 'JOIN_LOADING':
      return { ...state, joinLoading: action.value };
    case 'SOS':
      return { ...state, sosActive: action.value, lastEventAt: Date.now() };
    case 'SEED':
  return {
    ...state,
    rideStatus:    action.status    ?? state.rideStatus,
    rideStage:     action.rideStage ?? state.rideStage,    // ← ADD
    etaMinutes:    action.eta       ?? state.etaMinutes,
    driverLat:     action.lat       ?? state.driverLat,
    driverLng:     action.lng       ?? state.driverLng,
    driverHeading: action.heading   ?? state.driverHeading,
    activeTarget:  action.target    ?? state.activeTarget,
  };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;

const fmt = {
  eta:   (m) => m == null ? '—' : m < 1 ? '<1 min' : `${Math.round(m)} min`,
  km:    (k) => k == null ? '—' : k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1)} km`,
  speed: (s) => !s || s < 1 ? '0' : Math.round(s).toString(),
  time:  (d) => !d ? '—' : new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  ago:   (ts) => !ts ? '—' : `${Math.round((Date.now() - ts) / 1000)}s ago`,
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER DOM FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

function makeDriverEl(heading = 0) {
  const d = document.createElement('div');
  d.className = 'lt-driver-wrap';
  d.innerHTML = `
    <div class="lt-driver-ring"></div>
    <div class="lt-driver-body" style="transform:translate(-50%,-50%) rotate(${heading}deg)">
      <div class="lt-driver-icon">🚑</div>
    </div>
  `;
  return d;
}

function makeStaticEl(emoji, label, color) {
  const d = document.createElement('div');
  d.className = 'lt-pin-wrap';
  d.innerHTML = `
    <div class="lt-pin-head" style="background:${color}">${emoji}</div>
    <div class="lt-pin-tip" style="border-top-color:${color}"></div>
    <div class="lt-pin-label" style="background:${color}">${label}</div>
  `;
  return d;
}

const MARKER_DEFS = {
  patient:        { emoji: '🏠', label: 'PATIENT',   color: '#3b82f6' },
  care_assistant: { emoji: '👤', label: 'CA PICKUP', color: '#8b5cf6' },
  hospital:       { emoji: '🏥', label: 'HOSPITAL',  color: '#ef4444' },
  dropoff:        { emoji: '📍', label: 'DROP',      color: '#10b981' },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER STYLES — injected once
// ─────────────────────────────────────────────────────────────────────────────

const MARKER_CSS = `
  @keyframes lt-ring { 0%{transform:scale(.7);opacity:.9} 100%{transform:scale(3);opacity:0} }
  @keyframes lt-sos   { 0%,100%{opacity:1} 50%{opacity:.3} }

  .lt-driver-wrap   { position:relative;width:0;height:0;pointer-events:none }
  .lt-driver-ring   {
    position:absolute;width:52px;height:52px;left:-26px;top:-26px;
    border-radius:50%;background:rgba(16,185,129,.35);
    animation:lt-ring 2.2s ease-out infinite
  }
  .lt-driver-body   {
    position:absolute;width:44px;height:44px;left:0;top:0;
    display:flex;align-items:center;justify-content:center;
    transition:transform .35s ease-out;z-index:2;pointer-events:none;
    filter:drop-shadow(0 4px 10px rgba(16,185,129,.5))
  }
  .lt-driver-icon   {
    width:38px;height:38px;background:linear-gradient(135deg,#10b981,#3b82f6);
    border-radius:10px;display:flex;align-items:center;justify-content:center;
    font-size:20px;border:2px solid rgba(255,255,255,.25);
    box-shadow:0 4px 16px rgba(0,0,0,.4)
  }
  .lt-pin-wrap      { position:relative;width:0;height:0;pointer-events:none;display:flex;flex-direction:column;align-items:center }
  .lt-pin-head      {
    position:absolute;width:38px;height:38px;left:-19px;top:-54px;
    border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:16px;border:2.5px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.3)
  }
  .lt-pin-tip       {
    position:absolute;width:0;height:0;left:-6px;top:-17px;
    border-left:6px solid transparent;border-right:6px solid transparent;
    border-top-width:9px;border-top-style:solid
  }
  .lt-pin-label     {
    position:absolute;top:-5px;left:50%;transform:translateX(-50%);
    color:#fff;padding:1px 7px;border-radius:20px;font-size:9px;
    font-weight:800;letter-spacing:.08em;white-space:nowrap;
    box-shadow:0 2px 8px rgba(0,0,0,.25);font-family:monospace
  }
  .lt-sos-flash     { animation:lt-sos .7s infinite }
`;

function injectStyles() {
  if (document.getElementById('lt-styles')) return;
  const s = document.createElement('style');
  s.id = 'lt-styles';
  s.textContent = MARKER_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING MAP — isolated map + marker logic
// GPS animation via RAF; no React state updates in animation loop
// ─────────────────────────────────────────────────────────────────────────────

const TrackingMap = memo(function TrackingMap({ onMapReady }) {
  const { driverLat, driverLng, driverHeading, activeTarget, rideStatus, sosActive } = useTracking();
  const redux      = useSelector(selectCurrentRide);
  const trackData  = useSelector(selectTrackingData);
  const careSnap   = useSelector(selectCareTrackingSnapshot);

  // Refs — map + markers + animation
  const mapRef      = useRef(null);
  const markerRefs  = useRef({});     // driver, patient, ca, hospital, dropoff
  const rafRef      = useRef(null);
  const routeRef    = useRef(null);
  const dirSvcRef   = useRef(null);
  const lastRouteAt = useRef(0);

  // Smoothed driver position — pure ref, no state
  const smoothPos   = useRef({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
  const targetPos   = useRef(null);

  // Coords derived from redux (stable refs — update only when values change)
  const coordsRef   = useRef({});

  // Compute static coords from data
  useMemo(() => {
    const rd = redux;
    const td = trackData?.ride;
    const cs = careSnap;

    const get = (arr) => arr?.length === 2 ? { lat: arr[1], lng: arr[0] } : null;

    coordsRef.current = {
      pickup:    get(rd?.pickup?.coordinates          || td?.pickup?.coordinates),
      dropoff:   get(rd?.dropoff?.coordinates         || td?.dropoff?.coordinates),
      hospital:  get(cs?.hospital?.location?.coordinates || td?.tracking?.liveRouteContext?.hospitalCoords),
      caPickup:  get(cs?.liveRouteContext?.careAssistantPickupCoords),
    };
  }, [redux, trackData, careSnap]);

  // ── Map init ────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    dirSvcRef.current = new window.google.maps.DirectionsService();
    injectStyles();
    onMapReady?.(map);
  }, [onMapReady]);

  // ── Create / update driver marker ───────────────────────────────────────
  const ensureDriverMarker = useCallback(() => {
    if (!mapRef.current || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    if (!markerRefs.current.driver) {
      const el = makeDriverEl(driverHeading);
      markerRefs.current.driver = new window.google.maps.marker.AdvancedMarkerElement({
        map:          mapRef.current,
        content:      el,
        position:     smoothPos.current,
        zIndex:       30,
        gmpClickable: false,
        title:        'Medical transport vehicle',
      });
    }
  }, [driverHeading]);

  // ── Create static markers ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const { pickup, dropoff, hospital, caPickup } = coordsRef.current;
    const AME = window.google.maps.marker.AdvancedMarkerElement;

    const make = (key, coords, def) => {
      if (coords && !markerRefs.current[key]) {
        markerRefs.current[key] = new AME({
          map:          mapRef.current,
          content:      makeStaticEl(def.emoji, def.label, def.color),
          position:     coords,
          zIndex:       10,
          gmpClickable: false,
          title:        def.label,
        });
      }
    };

    make('patient',   pickup,   MARKER_DEFS.patient);
    make('ca',        caPickup, MARKER_DEFS.care_assistant);
    make('hospital',  hospital, MARKER_DEFS.hospital);
    make('dropoff',   dropoff,  MARKER_DEFS.dropoff);
  }, [coordsRef.current.pickup, coordsRef.current.hospital]); // eslint-disable-line

  // ── RAF animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    let hidden = false;

    const onVisChange = () => { hidden = document.hidden; };
    document.addEventListener('visibilitychange', onVisChange);

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (hidden) return;

      const tgt = targetPos.current;
      if (!tgt) return;

      const s = smoothPos.current;
      const nLat = lerp(s.lat, tgt.lat, LERP_T);
      const nLng = lerp(s.lng, tgt.lng, LERP_T);
      smoothPos.current = { lat: nLat, lng: nLng };

      ensureDriverMarker();
      const dm = markerRefs.current.driver;
      if (dm) {
        dm.position = smoothPos.current;
        const body = dm.content?.querySelector('.lt-driver-body');
        if (body) body.style.transform = `translate(-50%,-50%) rotate(${driverHeading}deg)`;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [ensureDriverMarker, driverHeading]);

  // ── Update target position when live coords change ──────────────────────
  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    targetPos.current = { lat: driverLat, lng: driverLng };
  }, [driverLat, driverLng]);

  // ── Draw / update route polyline (throttled) ────────────────────────────
  const drawRoute = useCallback(async (origin, dest) => {
    if (!dirSvcRef.current || !origin || !dest) return;
    const now = Date.now();
    if (now - lastRouteAt.current < ROUTE_THROTTLE) return;
    lastRouteAt.current = now;

    try {
      const result = await dirSvcRef.current.route({
        origin, destination: dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      if (result.status !== 'OK') return;

      const pts = window.google.maps.geometry.encoding.decodePath(
        result.routes?.[0]?.overview_polyline?.points || ''
      );

      if (!routeRef.current) {
        routeRef.current = new window.google.maps.Polyline({
          map:           mapRef.current,
          strokeColor:   '#6366f1',
          strokeWeight:  4,
          strokeOpacity: 0.9,
          icons: [{
            icon:   { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
            offset: '0', repeat: '16px',
          }],
        });
      }
      routeRef.current.setPath(pts);
    } catch (e) { /* silent — DirectionsService quota */ }
  }, []);

  // Trigger route draw when activeTarget or driver position changes
  useEffect(() => {
    if (!mapRef.current || !driverLat || !driverLng) return;
    const { pickup, hospital, caPickup, dropoff } = coordsRef.current;
    const origin = { lat: driverLat, lng: driverLng };

    let dest = null;
    if (activeTarget === 'hospital_drop')         dest = hospital;
    else if (activeTarget === 'pickup_care_assistant') dest = caPickup;
    else if (activeTarget === 'patient_drop')      dest = dropoff;
    else                                           dest = pickup;

    if (dest) drawRoute(origin, dest);
  }, [activeTarget, drawRoute, driverLat, driverLng]); // eslint-disable-line

  // ── Dynamic map bounds — ONLY on activeTarget change, not every GPS tick
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const { pickup, hospital, caPickup, dropoff } = coordsRef.current;
    const bounds = new window.google.maps.LatLngBounds();
    let added = 0;

    const add = (c) => { if (c) { bounds.extend(c); added++; } };

    if (activeTarget === 'hospital_drop') {
      add(hospital);
      if (driverLat && driverLng) add({ lat: driverLat, lng: driverLng });
    } else if (activeTarget === 'pickup_care_assistant') {
      add(caPickup);
      if (driverLat && driverLng) add({ lat: driverLat, lng: driverLng });
    } else {
      add(pickup);
      if (driverLat && driverLng) add({ lat: driverLat, lng: driverLng });
    }

    if (added > 1) {
      mapRef.current.fitBounds(bounds, { top: 80, bottom: 180, left: 40, right: 40 });
    } else if (added === 1) {
      mapRef.current.panTo(bounds.getCenter());
    }
  }, [activeTarget]); // only on target change, not GPS tick

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    Object.values(markerRefs.current).forEach(m => { if (m) m.map = null; });
    markerRefs.current = {};
    if (routeRef.current) routeRef.current.setMap(null);
  }, []);

  const initialCenter = useMemo(() => {
    if (driverLat && driverLng) return { lat: driverLat, lng: driverLng };
    return coordsRef.current.pickup || DEFAULT_CENTER;
  }, []); // eslint-disable-line

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={initialCenter}
      zoom={14}
      options={{
        mapId:             MAP_ID,
        disableDefaultUI:  true,
        gestureHandling:   'greedy',
        clickableIcons:    false,
        backgroundColor:   '#1a1f2e',
      }}
      onLoad={onMapLoad}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING SOCKET MANAGER — single subscription hub, no duplicates
// ─────────────────────────────────────────────────────────────────────────────

function TrackingSocketManager({ bookingId, rideId, dispatch, trackingDispatch }) {
  const { on, connected } = useSocket();
  const mounted = useRef(true);

  // Re-subscribe on bookingId change; cleanup on unmount
  useEffect(() => {
    mounted.current = true;
    if (!bookingId) return;

    const safe = (fn) => (...args) => { if (mounted.current) fn(...args); };

    const unsubs = [
      on('ride_status_changed', safe((d) => {
  trackingDispatch({ type: 'STATUS', status: d.status });
  dispatch(socketRideStatusChanged(d));
  if (d.activeNavigationTarget) {
    trackingDispatch({ type: 'TARGET', target: d.activeNavigationTarget });
  }
  if (d.rideStage) {
    dispatch(setCareRideWorkflow({
      rideStage:             d.rideStage,
      activeNavigationTarget: d.activeNavigationTarget || null,
    }));
  }
})),
      on('driver_accepted',    safe((d) => { trackingDispatch({ type: 'STATUS', status: 'driver_accepted' }); dispatch(socketDriverAccepted(d)); })),
      on('driver_en_route',    safe((d) => { trackingDispatch({ type: 'STATUS', status: 'driver_en_route' }); dispatch(socketDriverEnRoute(d)); })),
      on('driver_arrived',     safe((d) => { trackingDispatch({ type: 'STATUS', status: 'driver_arrived' }); dispatch(socketDriverArrived(d)); })),
      on('otp_verified',       safe((d) => { trackingDispatch({ type: 'STATUS', status: 'otp_verified' }); dispatch(socketOtpVerified(d)); })),
      on('ride_started',       safe((d) => { trackingDispatch({ type: 'STATUS', status: 'in_progress' }); dispatch(socketRideStarted(d)); })),
      on('at_stop',            safe((d) => { trackingDispatch({ type: 'STATUS', status: 'at_stop' }); dispatch(socketAtStop(d)); })),
      on('ride_completed',     safe((d) => { trackingDispatch({ type: 'STATUS', status: 'completed' }); dispatch(socketRideCompleted(d)); })),
      on('ride_cancelled',     safe((d) => { trackingDispatch({ type: 'STATUS', status: 'cancelled' }); dispatch(socketRideCancelled(d)); })),
      on('ride_assigned',      safe((d) => { trackingDispatch({ type: 'STATUS', status: d.status }); dispatch(socketRideAssigned(d)); })),

      on('location_update', safe((d) => {
        trackingDispatch({ type: 'LOCATION', lat: d.lat, lng: d.lng, heading: d.heading, speed: d.speed });
        dispatch(socketLocationUpdate(d));
      })),

      on('eta_update', safe((d) => {
        trackingDispatch({ type: 'ETA', eta: d.etaMinutes, distKm: d.distanceRemainingKm });
        dispatch(socketEtaUpdate(d));
      })),

      on('navigation_target_changed', safe((d) => {
        trackingDispatch({ type: 'TARGET', target: d.currentTarget });
        dispatch(socketNavigationTargetChanged(d));
      })),

      on('hospital_eta_update', safe((d) => { dispatch(socketHospitalEtaUpdate(d)); })),
on('hospital:eta:update', safe((d) => { dispatch(socketHospitalEtaUpdate(d)); })), 
      // ADD: handle new rideStage + activeNavigationTarget from ride_status_changed
on('ride_status_changed', safe((d) => {
  trackingDispatch({ type: 'STATUS', status: d.status });
  dispatch(socketRideStatusChanged(d));
  // NEW: sync navigation target from status event
  if (d.activeNavigationTarget) {
    trackingDispatch({ type: 'TARGET', target: d.activeNavigationTarget });
    dispatch(setCareRideWorkflow({ 
      rideStage: d.rideStage,
      activeNavigationTarget: d.activeNavigationTarget,
    }));
  }
})),

      on('care-assistant:ride:tracking', safe((d) => {
        trackingDispatch({ type: 'TARGET', target: d.activeTarget });
        dispatch(socketCareAssistantTracking(d));
      })),

      on('care_assistant_location_update', safe((d) => {
        dispatch(setCareAssistantLocation(d));
      })),
      on('care_assistant_status_change', safe((d) => {
        dispatch(setCareAssistantStatus(d));
      })),
      on('care_assistant_joined_ride', safe((d) => {
        dispatch(setCareAssistantJoined(d));
        dispatch(setCareRideWorkflow({ careAssistantJoined: true }));
      })),
      on('care_assistant_attached_to_ride', safe((d) => {
        dispatch(setCareAssistantJoined(d));
      })),

      on('route_deviation_alert', safe(() => {
        trackingDispatch({ type: 'DEVIATION', value: true });
        setTimeout(() => { if (mounted.current) trackingDispatch({ type: 'DEVIATION', value: false }); }, 60_000);
      })),

      on('sos_alert', safe(() => {
        trackingDispatch({ type: 'SOS', value: true });
      })),
    ];

    return () => {
      mounted.current = false;
      unsubs.forEach(fn => fn?.());
    };
  }, [bookingId, on, dispatch, trackingDispatch]);

  return null; // render nothing
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING HEADER — sticky ops bar
// ─────────────────────────────────────────────────────────────────────────────

const TrackingHeader = memo(function TrackingHeader({ rideCode, bookingCode, onBack, onCenter, onRefresh, connected }) {
  const { rideStatus, etaMinutes, distKm, activeTarget, driverLat, lastGpsAt, sosActive } = useTracking();
  const meta = STATUS_META[rideStatus] || STATUS_META.searching;
  const gpsStale = lastGpsAt && (Date.now() - lastGpsAt) > GPS_STALE;
  const hasSignal = connected && driverLat != null;

  return (
    <header
      className="lt-header"
      role="banner"
      aria-label="Transport operations header"
    >
      {/* Back + identity */}
      <div className="lt-header-left">
        <button onClick={onBack} className="lt-icon-btn" aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <div className="lt-header-codes">
            {rideCode && <span className="lt-mono">{rideCode}</span>}
            {bookingCode && <span className="lt-header-sep">/</span>}
            {bookingCode && <span className="lt-mono lt-dim">{bookingCode}</span>}
          </div>
          <div className="lt-status-row" aria-live="polite">
            {meta.pulse
              ? <span className="lt-dot lt-dot-pulse" style={{ '--dot-color': meta.color }} />
              : <span className="lt-dot" style={{ '--dot-color': meta.color }} />
            }
            <span className="lt-status-label" style={{ color: meta.color }}>{meta.label}</span>
          </div>
        </div>
      </div>

      {/* Center: ETA readout */}
      <div className="lt-header-center" aria-label="ETA and distance">
        <div className="lt-eta-block">
          <span className="lt-eta-time">{fmt.eta(etaMinutes)}</span>
          <span className="lt-eta-sub">{fmt.km(distKm)}</span>
          {activeTarget && (
            <span className="lt-eta-target">→ {TARGET_LABELS[activeTarget] || activeTarget}</span>
          )}
        </div>
      </div>

      {/* Right: signals + controls */}
      <div className="lt-header-right">
        {sosActive && (
          <span className="lt-sos-badge lt-sos-flash" aria-live="assertive" role="alert">⚠ SOS</span>
        )}
        <div className="lt-signal-cluster">
          <div className={`lt-sig lt-sig-${connected ? 'ok' : 'err'}`} title="Socket">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 8.9a14.6 14.6 0 0121 0l-1.6 1.7a12.3 12.3 0 00-17.8 0L1.5 8.9zm4.5 4.6a9 9 0 0112 0l-1.6 1.7a6.8 6.8 0 00-8.8 0L6 13.5zm4.6 4.6a4 4 0 015 0l-2.5 2.5-2.5-2.5z"/></svg>
            <span>{connected ? 'LIVE' : 'OFF'}</span>
          </div>
          <div className={`lt-sig ${gpsStale ? 'lt-sig-warn' : hasSignal ? 'lt-sig-ok' : 'lt-sig-err'}`} title="GPS">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/><path d="M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
            <span>GPS</span>
          </div>
        </div>
        <button onClick={onCenter} className="lt-icon-btn" aria-label="Center map on driver">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
        </button>
        <button onClick={onRefresh} className="lt-icon-btn" aria-label="Refresh tracking data">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0113.9-3.4L23 10M1 14l5.6 4.4A9 9 0 0020.5 15"/></svg>
        </button>
      </div>
    </header>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

const TrackingTimeline = memo(function TrackingTimeline() {
  const { rideStatus } = useTracking();

  const activeIdx = useMemo(() => {
    if (!rideStatus) return 0;
    // Normalize at_stop → in_progress for timeline
    const s = rideStatus === 'at_stop' ? 'in_progress' : rideStatus;
    const i = TIMELINE_NODES.findIndex(n => n.key === s);
    return i >= 0 ? i : 0;
  }, [rideStatus]);

  const pct = (activeIdx / Math.max(TIMELINE_NODES.length - 1, 1)) * 100;

  return (
    <div className="lt-timeline" role="progressbar" aria-label="Ride progress" aria-valuenow={activeIdx} aria-valuemax={TIMELINE_NODES.length - 1}>
      <div className="lt-timeline-track">
        <div className="lt-timeline-fill" style={{ width: `${pct}%` }} />
      </div>
      {TIMELINE_NODES.map((n, i) => {
        const done   = i <= activeIdx;
        const active = i === activeIdx;
        return (
          <div key={n.key} className="lt-tl-node">
            <div className={`lt-tl-dot ${done ? 'lt-tl-done' : ''} ${active ? 'lt-tl-active' : ''}`}>
              {done && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </div>
            <span className={`lt-tl-label ${done ? 'lt-tl-label-done' : ''}`}>{n.label}</span>
          </div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING DRIVER CARD
// ─────────────────────────────────────────────────────────────────────────────

const TrackingDriverCard = memo(function TrackingDriverCard({ driverSnapshot, vehicleSnapshot }) {
  if (!driverSnapshot) {
    return (
      <section className="lt-card lt-card-skeleton" aria-label="Driver info loading">
        <div className="lt-skel lt-skel-sm" />
        <div className="lt-skel lt-skel-md" />
        <div className="lt-skel lt-skel-sm" />
      </section>
    );
  }

  const name   = driverSnapshot.legalName || driverSnapshot.name || 'Driver';
  const phone  = driverSnapshot.phone;
  const rating = driverSnapshot.rating;
  const photo  = driverSnapshot.photoUrl;
  const veh    = vehicleSnapshot;

  return (
    <section className="lt-card" aria-label="Driver information">
      <h3 className="lt-card-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        Driver
      </h3>
      <div className="lt-driver-info">
        <div className="lt-avatar" aria-hidden="true">
          {photo
            ? <img src={photo} alt={name} />
            : <span className="lt-avatar-init">{name.charAt(0).toUpperCase()}</span>
          }
        </div>
        <div className="lt-driver-details">
          <div className="lt-driver-name-row">
            <span className="lt-driver-name">{name}</span>
            {rating != null && <span className="lt-rating">★ {rating.toFixed(1)}</span>}
          </div>
          {veh && (
            <p className="lt-vehicle-line">
              {[veh.make, veh.model, veh.color].filter(Boolean).join(' · ')}
              {veh.registrationNumber && ` · ${veh.registrationNumber}`}
            </p>
          )}
        </div>
        {phone && (
          <a href={`tel:${phone}`} className="lt-call-btn" aria-label={`Call driver ${name}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
          </a>
        )}
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING PATIENT CARD
// ─────────────────────────────────────────────────────────────────────────────

const TrackingPatientCard = memo(function TrackingPatientCard({ booking, patientInfo, bookingCode, bookingType, patientLocation }) {
  return (
    <section className="lt-card" aria-label="Patient information">
      <h3 className="lt-card-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Patient
      </h3>
      {patientInfo ? (
        <div className="lt-patient-grid">
          <div className="lt-patient-row">
            <span className="lt-field-label">Name</span>
            <span className="lt-field-val">{patientInfo.name || '—'}</span>
          </div>
          {(patientInfo.age || patientInfo.gender) && (
            <div className="lt-patient-row">
              <span className="lt-field-label">Profile</span>
              <span className="lt-field-val">
                {[patientInfo.age && `${patientInfo.age}y`, patientInfo.gender, patientInfo.bloodGroup].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
          {bookingCode && (
            <div className="lt-patient-row">
              <span className="lt-field-label">Booking</span>
              <span className="lt-field-val lt-mono">{bookingCode}</span>
            </div>
          )}
          {bookingType && (
            <div className="lt-patient-row">
              <span className="lt-field-label">Type</span>
              <span className="lt-field-val lt-capitalize">{bookingType.replace(/_/g, ' ')}</span>
            </div>
          )}
          {patientLocation?.address && (
            <div className="lt-patient-addr">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0,marginTop:2}}><path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z"/></svg>
              <span>{patientLocation.address}</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="lt-skel lt-skel-sm" />
          <div className="lt-skel lt-skel-md" />
        </>
      )}
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING HOSPITAL CARD
// ─────────────────────────────────────────────────────────────────────────────

const TrackingHospitalCard = memo(function TrackingHospitalCard({ hospital, nearestDistKm, hospitalEta }) {
  if (!hospital && nearestDistKm == null) return null;

  const name = hospital?.name || 'Nearest Hospital';
  const addr = hospital?.address?.line1 || hospital?.address?.city || '';

  return (
    <section className="lt-card lt-card-hospital" aria-label="Hospital routing">
      <h3 className="lt-card-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H8v-4h4v4zm0-6H8V7h4v4zm4 6h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
        Hospital
      </h3>
      <div className="lt-hosp-body">
        <span className="lt-hosp-name">{name}</span>
        {addr && <span className="lt-hosp-addr">{addr}</span>}
        <div className="lt-hosp-metrics">
          {nearestDistKm != null && (
            <div className="lt-hosp-metric">
              <span className="lt-hosp-metric-val">{fmt.km(nearestDistKm)}</span>
              <span className="lt-hosp-metric-lbl">Distance</span>
            </div>
          )}
          {hospitalEta?.etaMinutes != null && (
            <div className="lt-hosp-metric">
              <span className="lt-hosp-metric-val lt-color-warn">{fmt.eta(hospitalEta.etaMinutes)}</span>
              <span className="lt-hosp-metric-lbl">ETA</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING METRICS
// ─────────────────────────────────────────────────────────────────────────────

const TrackingMetrics = memo(function TrackingMetrics({ tracking }) {
  const { driverSpeed, etaMinutes, distKm, hasDeviation, activeTarget } = useTracking();

  const metrics = [
    { id: 'speed', label: 'Speed',    val: `${fmt.speed(driverSpeed)} km/h`, color: 'var(--lt-cyan)' },
    { id: 'eta',   label: 'ETA',      val: fmt.eta(etaMinutes),              color: 'var(--lt-violet)' },
    { id: 'dist',  label: 'Distance', val: fmt.km(distKm),                   color: 'var(--lt-blue)' },
    { id: 'route', label: 'Route',    val: hasDeviation ? 'Deviated' : 'On Track',
      color: hasDeviation ? 'var(--lt-amber)' : 'var(--lt-green)' },
  ];

  return (
    <section className="lt-card" aria-label="Live ride metrics">
      <h3 className="lt-card-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Live Metrics
      </h3>
      <div className="lt-metrics-grid">
        {metrics.map(m => (
          <div key={m.id} className="lt-metric-cell">
            <span className="lt-metric-val" style={{ color: m.color }}>{m.val}</span>
            <span className="lt-metric-lbl">{m.label}</span>
          </div>
        ))}
      </div>
      {activeTarget && (
        <div className="lt-target-strip">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>{TARGET_LABELS[activeTarget] || activeTarget.replace(/_/g, ' ')}</span>
        </div>
      )}
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING EMERGENCY PANEL
// ─────────────────────────────────────────────────────────────────────────────

const TrackingEmergencyPanel = memo(function TrackingEmergencyPanel({ sosEvents, hasActiveSos, bookingId, rideId }) {
  const { trigger, dismiss } = useSos(bookingId, rideId);

  const activeEv = sosEvents?.find(e => !e.isResolved);

  return (
    <section className="lt-card lt-card-emergency" aria-label="Emergency controls">
      <h3 className="lt-card-label lt-label-emergency">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/></svg>
        Emergency
      </h3>

      {hasActiveSos && activeEv ? (
        <div className="lt-sos-active" role="alert" aria-live="assertive">
          <div className="lt-sos-header lt-sos-flash">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
            <span>SOS — {activeEv.sosType?.toUpperCase() || 'EMERGENCY'}</span>
          </div>
          {activeEv.triggeredAt && (
            <div className="lt-sos-meta">Triggered {fmt.time(activeEv.triggeredAt)}</div>
          )}
          {activeEv.description && (
            <div className="lt-sos-desc">{activeEv.description}</div>
          )}
          <button onClick={dismiss} className="lt-btn lt-btn-outline-err">Dismiss Alert</button>
        </div>
      ) : (
        <div className="lt-sos-idle">
          <div className="lt-secure-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-2 13l-3-3 1.4-1.4L10 11.2l5.6-5.6L17 7l-7 7z"/></svg>
            <span>No Active Emergency</span>
          </div>
          <button
            onClick={() => trigger({ sosType: 'safety' })}
            className="lt-btn lt-btn-sos"
            aria-label="Trigger emergency SOS alert"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
            Trigger SOS
          </button>
        </div>
      )}
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

const TrackingDiagnostics = memo(function TrackingDiagnostics({ connected }) {
  const { lastGpsAt, lastEventAt, driverLat } = useTracking();

  const gpsStale    = lastGpsAt && (Date.now() - lastGpsAt) > GPS_STALE;
  const hasSignal   = connected && driverLat != null;

  const rows = [
    { label: 'Socket',     val: connected ? 'Connected'    : 'Disconnected', ok: connected },
    { label: 'GPS Feed',   val: gpsStale  ? 'Stale >30s'  : hasSignal ? 'Live' : 'No signal', ok: !gpsStale && hasSignal },
    { label: 'Last GPS',   val: fmt.ago(lastGpsAt),   ok: lastGpsAt && !gpsStale },
    { label: 'Last Event', val: fmt.ago(lastEventAt), ok: lastEventAt && (Date.now() - lastEventAt) < 15_000 },
  ];

  return (
    <section className="lt-card" aria-label="Connection diagnostics">
      <h3 className="lt-card-label">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
        Diagnostics
      </h3>
      <div className="lt-diag-rows">
        {rows.map(r => (
          <div key={r.label} className="lt-diag-row">
            <span className="lt-diag-label">{r.label}</span>
            <div className="lt-diag-val-wrap">
              <span className="lt-diag-dot" style={{ background: r.ok ? 'var(--lt-green)' : 'var(--lt-red)' }} />
              <span className="lt-diag-val" style={{ color: r.ok ? 'var(--lt-green)' : 'var(--lt-red)' }}>{r.val}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING ACTION BAR — floating action buttons on mobile map
// ─────────────────────────────────────────────────────────────────────────────

const TrackingActionBar = memo(function TrackingActionBar({ onCenter, onRefresh, driverPhone }) {
  return (
    <div className="lt-fab-cluster" role="toolbar" aria-label="Map action controls">
      {driverPhone && (
        <a href={`tel:${driverPhone}`} className="lt-fab lt-fab-call" aria-label="Call driver">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
        </a>
      )}
      <button onClick={onCenter} className="lt-fab" aria-label="Center map">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
      </button>
      <button onClick={onRefresh} className="lt-fab" aria-label="Refresh">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0113.9-3.4L23 10M1 14l5.6 4.4A9 9 0 0020.5 15"/></svg>
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING SIDEBAR — desktop left operations panel
// ─────────────────────────────────────────────────────────────────────────────

function TrackingSidebar({ driverSnapshot, vehicleSnapshot, patientInfo, booking, bookingCode, bookingType, patientLocation, hospital, nearestDistKm, hospitalEta, tracking, sosEvents, hasActiveSos, bookingId, rideId, connected, rideCode, onJoinRide }) {
  const { rideStatus, joinLoading } = useTracking();

  const canJoin = ['driver_accepted', 'driver_en_route', 'driver_arrived', 'otp_verified', 'in_progress', 'at_stop'].includes(rideStatus);
  const joined  = booking?.careAssistant || false;

  return (
    <aside className="lt-sidebar" aria-label="Operations panel">
      <div className="lt-sidebar-inner">
        {/* Ride code header in sidebar */}
        {rideCode && (
          <div className="lt-sidebar-rideheader">
            <span className="lt-sidebar-ridecode lt-mono">{rideCode}</span>
            <div className="lt-otp-status" aria-live="polite">
              {rideStatus === 'driver_arrived' && (
                <span className="lt-otp-pending">OTP Pending</span>
              )}
              {rideStatus === 'otp_verified' && (
                <span className="lt-otp-done">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  OTP Verified
                </span>
              )}
            </div>
          </div>
        )}

        <TrackingTimeline />

        {/* Join ride CTA */}
        {canJoin && (
          <div className="lt-join-panel">
            <button
              onClick={onJoinRide}
              disabled={joinLoading}
              className={`lt-btn lt-btn-join ${joinLoading ? 'lt-btn-loading' : ''}`}
              aria-label="Join active ride session"
            >
              {joinLoading ? (
                <>
                  <span className="lt-spinner" />
                  Joining Session…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                  Join Ride Session
                </>
              )}
            </button>
          </div>
        )}

        <TrackingDriverCard driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot} />
        <TrackingPatientCard
          booking={booking}
          patientInfo={patientInfo}
          bookingCode={bookingCode}
          bookingType={bookingType}
          patientLocation={patientLocation}
        />
        <TrackingHospitalCard hospital={hospital} nearestDistKm={nearestDistKm} hospitalEta={hospitalEta} />
        <TrackingMetrics tracking={tracking} />
        <TrackingEmergencyPanel sosEvents={sosEvents} hasActiveSos={hasActiveSos} bookingId={bookingId} rideId={rideId} />
        <TrackingDiagnostics connected={connected} />
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING BOTTOM SHEET — mobile swipeable ops panel
// Three snap points: collapsed (status bar only) / mid / full
// ─────────────────────────────────────────────────────────────────────────────

const SNAP = { COLLAPSED: 0, MID: 1, FULL: 2 };
const SNAP_HEIGHTS = { 0: 64, 1: '45vh', 2: '82vh' };

function TrackingBottomSheet({ children, rideStatus, etaMinutes, sosActive }) {
  const [snap, setSnap] = useState(SNAP.COLLAPSED);
  const touchStart      = useRef(null);
  const sheetRef        = useRef(null);
  const meta            = STATUS_META[rideStatus] || STATUS_META.searching;

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientY; };
  const handleTouchEnd   = (e) => {
    if (!touchStart.current) return;
    const dy = touchStart.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 12) return;
    if (dy > 0) setSnap(s => Math.min(s + 1, SNAP.FULL));   // swipe up
    else         setSnap(s => Math.max(s - 1, SNAP.COLLAPSED)); // swipe down
    touchStart.current = null;
  };

  const h = SNAP_HEIGHTS[snap];
  const heightVal = typeof h === 'number' ? `${h}px` : h;

  return (
    <div
      ref={sheetRef}
      className="lt-sheet"
      style={{ height: heightVal }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="complementary"
      aria-label="Ride information panel"
      aria-expanded={snap !== SNAP.COLLAPSED}
    >
      {/* Handle + compact status */}
      <div
        className="lt-sheet-handle-area"
        onClick={() => setSnap(s => s === SNAP.FULL ? SNAP.COLLAPSED : s + 1)}
        role="button"
        tabIndex={0}
        aria-label={snap === SNAP.FULL ? 'Collapse panel' : 'Expand panel'}
        onKeyDown={e => e.key === 'Enter' && setSnap(s => s === SNAP.FULL ? SNAP.COLLAPSED : s + 1)}
      >
        <div className="lt-sheet-knob" />
        <div className="lt-sheet-status-row">
          <div className="lt-sheet-status-left">
            {meta.pulse
              ? <span className="lt-dot-sm lt-dot-pulse" style={{ '--dot-color': meta.color }} />
              : <span className="lt-dot-sm" style={{ '--dot-color': meta.color }} />
            }
            <span className="lt-sheet-status-label">{meta.label}</span>
          </div>
          <div className="lt-sheet-status-right">
            {etaMinutes != null && (
              <span className="lt-sheet-eta">{fmt.eta(etaMinutes)}</span>
            )}
            {sosActive && <span className="lt-sos-badge lt-sos-flash">SOS</span>}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ transform: snap === SNAP.FULL ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
            >
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      {snap !== SNAP.COLLAPSED && (
        <div className="lt-sheet-content">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON + ERROR STATES
// ─────────────────────────────────────────────────────────────────────────────

function TrackingLoader() {
  return (
    <div className="lt-fullscreen lt-loader-bg">
      <div className="lt-loader-inner">
        <div className="lt-loader-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="lt-spin-svg">
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>
          </svg>
        </div>
        <p className="lt-loader-label">Loading transport data</p>
        <div className="lt-loader-dots">
          {[0, 1, 2].map(i => <span key={i} className="lt-loader-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
        </div>
      </div>
    </div>
  );
}

function TrackingError({ message, onRetry }) {
  return (
    <div className="lt-fullscreen lt-loader-bg">
      <div className="lt-err-inner">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--lt-red)" strokeWidth="1.5">
          <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
        </svg>
        <h3 className="lt-err-title">Tracking Error</h3>
        <p className="lt-err-msg">{message}</p>
        <button onClick={onRetry} className="lt-btn lt-btn-primary">Retry</button>
      </div>
    </div>
  );
}

function ReconnectBanner({ connected, onRetry }) {
  if (connected) return null;
  return (
    <div className="lt-reconnect-bar" role="alert" aria-live="polite">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 1l22 22M16.7 16.7A7.5 7.5 0 013.6 8.6M6.3 3.8A7.5 7.5 0 0120.4 15.4"/></svg>
      <span>Socket offline — GPS paused</span>
      <button onClick={onRetry} className="lt-reconnect-btn">Retry</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — all styles scoped to lt- prefix
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
  :root {
    --lt-bg:       #0d1117;
    --lt-bg2:      #161b22;
    --lt-bg3:      #1c2230;
    --lt-border:   #21262d;
    --lt-border2:  #30363d;
    --lt-text:     #e6edf3;
    --lt-text2:    #8b949e;
    --lt-text3:    #484f58;
    --lt-green:    #10b981;
    --lt-blue:     #3b82f6;
    --lt-violet:   #8b5cf6;
    --lt-cyan:     #06b6d4;
    --lt-amber:    #f59e0b;
    --lt-red:      #ef4444;
    --lt-orange:   #f97316;
    --lt-font:     'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --lt-mono:     'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  }

  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

  @keyframes lt-pulse-dot { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes lt-spin       { to{transform:rotate(360deg)} }
  @keyframes lt-sos-blink  { 0%,100%{opacity:1} 50%{opacity:.2} }
  @keyframes lt-loader-dot { 0%,80%,100%{opacity:.2;transform:scale(.7)} 40%{opacity:1;transform:scale(1)} }
  @keyframes lt-slide-in   { from{transform:translateX(-100%);opacity:0} to{transform:translateX(0);opacity:1} }

  .lt-fullscreen    { position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--lt-bg);z-index:100 }
  .lt-loader-bg     { background:var(--lt-bg) }
  .lt-loader-inner  { display:flex;flex-direction:column;align-items:center;gap:12px }
  .lt-loader-icon   { width:64px;height:64px;border-radius:16px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;color:var(--lt-violet) }
  .lt-spin-svg      { animation:lt-spin 1.2s linear infinite }
  .lt-loader-label  { font-family:var(--lt-font);font-size:13px;font-weight:600;color:var(--lt-text2);letter-spacing:.06em;text-transform:uppercase }
  .lt-loader-dots   { display:flex;gap:6px }
  .lt-loader-dot    { width:7px;height:7px;border-radius:50%;background:var(--lt-violet);animation:lt-loader-dot 1.2s ease-in-out infinite }

  .lt-err-inner  { display:flex;flex-direction:column;align-items:center;gap:14px;max-width:320px;text-align:center;padding:20px }
  .lt-err-title  { font-family:var(--lt-font);font-size:16px;font-weight:700;color:var(--lt-text) }
  .lt-err-msg    { font-family:var(--lt-font);font-size:13px;color:var(--lt-text2) }

  /* LAYOUT */
  .lt-root         { position:fixed;inset:0;background:var(--lt-bg);color:var(--lt-text);font-family:var(--lt-font);display:flex;flex-direction:column;overflow:hidden }
  .lt-body-desktop { display:flex;flex:1;overflow:hidden }
  .lt-map-container{ flex:1;position:relative;overflow:hidden }
  .lt-body-mobile  { flex:1;position:relative;overflow:hidden }

  /* HEADER */
  .lt-header          { display:flex;align-items:center;gap:0;background:var(--lt-bg2);border-bottom:1px solid var(--lt-border);height:56px;flex-shrink:0;z-index:20 }
  .lt-header-left     { display:flex;align-items:center;gap:12px;padding:0 16px;flex:1;min-width:0 }
  .lt-header-center   { display:flex;flex-direction:column;align-items:center;padding:0 20px;border-left:1px solid var(--lt-border);border-right:1px solid var(--lt-border);min-width:160px }
  .lt-header-right    { display:flex;align-items:center;gap:10px;padding:0 16px }
  .lt-header-codes    { display:flex;align-items:center;gap:6px }
  .lt-header-sep      { color:var(--lt-text3);font-size:12px }

  .lt-status-row      { display:flex;align-items:center;gap:6px;margin-top:2px }
  .lt-status-label    { font-family:var(--lt-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase }

  .lt-eta-block       { display:flex;flex-direction:column;align-items:center;gap:1px }
  .lt-eta-time        { font-family:var(--lt-mono);font-size:18px;font-weight:700;color:var(--lt-violet);letter-spacing:-.01em;line-height:1 }
  .lt-eta-sub         { font-family:var(--lt-mono);font-size:10px;color:var(--lt-text2) }
  .lt-eta-target      { font-size:9px;font-weight:600;color:var(--lt-text3);letter-spacing:.06em;text-transform:uppercase;margin-top:1px }

  .lt-signal-cluster  { display:flex;gap:4px }
  .lt-sig             { display:flex;align-items:center;gap:3px;padding:3px 6px;border-radius:4px;font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.05em;border:1px solid }
  .lt-sig-ok   { color:var(--lt-green);border-color:rgba(16,185,129,.25);background:rgba(16,185,129,.08) }
  .lt-sig-err  { color:var(--lt-red);  border-color:rgba(239,68,68,.25);  background:rgba(239,68,68,.08) }
  .lt-sig-warn { color:var(--lt-amber);border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.08) }

  .lt-sos-badge { font-family:var(--lt-mono);font-size:9px;font-weight:800;letter-spacing:.1em;padding:3px 8px;border-radius:4px;background:var(--lt-red);color:#fff;text-transform:uppercase }
  .lt-sos-flash { animation:lt-sos-blink .7s infinite }

  /* SIDEBAR */
  .lt-sidebar       { width:300px;flex-shrink:0;background:var(--lt-bg2);border-right:1px solid var(--lt-border);display:flex;flex-direction:column;overflow:hidden }
  .lt-sidebar-inner { flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--lt-border2) transparent }
  .lt-sidebar-rideheader { padding:12px 16px 0;display:flex;align-items:center;justify-content:space-between }
  .lt-sidebar-ridecode   { font-family:var(--lt-mono);font-size:11px;font-weight:600;color:var(--lt-text2);letter-spacing:.06em }
  .lt-otp-status  { display:flex;align-items:center }
  .lt-otp-pending { font-family:var(--lt-mono);font-size:9px;font-weight:700;color:var(--lt-orange);letter-spacing:.06em;animation:lt-pulse-dot 1.5s infinite }
  .lt-otp-done    { display:flex;align-items:center;gap:4px;font-family:var(--lt-mono);font-size:9px;font-weight:700;color:var(--lt-green);letter-spacing:.06em }

  /* CARDS */
  .lt-card         { padding:14px 16px;border-bottom:1px solid var(--lt-border) }
  .lt-card-hospital{ background:linear-gradient(135deg,rgba(239,68,68,.04),transparent) }
  .lt-card-emergency{background:linear-gradient(135deg,rgba(239,68,68,.05),transparent) }
  .lt-card-skeleton{ opacity:.5 }

  .lt-card-label   { font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--lt-text3);margin:0 0 10px;display:flex;align-items:center;gap:6px }
  .lt-label-emergency { color:rgba(239,68,68,.7) }

  /* TIMELINE */
  .lt-timeline       { padding:14px 16px;border-bottom:1px solid var(--lt-border);position:relative }
  .lt-timeline-track { position:absolute;top:22px;left:28px;right:28px;height:1px;background:var(--lt-border2) }
  .lt-timeline-fill  { height:100%;background:var(--lt-violet);transition:width .6s ease }
  .lt-timeline       { display:flex;justify-content:space-between;align-items:flex-start }
  .lt-tl-node        { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:5px }
  .lt-tl-dot         { width:20px;height:20px;border-radius:50%;border:2px solid var(--lt-border2);background:var(--lt-bg3);display:flex;align-items:center;justify-content:center;transition:all .3s }
  .lt-tl-done        { background:var(--lt-violet);border-color:var(--lt-violet) }
  .lt-tl-active      { transform:scale(1.25);box-shadow:0 0 0 4px rgba(99,102,241,.2) }
  .lt-tl-label       { font-family:var(--lt-mono);font-size:8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--lt-text3);white-space:nowrap }
  .lt-tl-label-done  { color:var(--lt-violet) }

  /* DRIVER CARD */
  .lt-driver-info    { display:flex;align-items:center;gap:12px }
  .lt-avatar         { width:40px;height:40px;border-radius:10px;background:rgba(99,102,241,.15);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center }
  .lt-avatar img     { width:100%;height:100%;object-fit:cover }
  .lt-avatar-init    { font-size:16px;font-weight:700;color:var(--lt-violet) }
  .lt-driver-details { flex:1;min-width:0 }
  .lt-driver-name-row{ display:flex;align-items:center;gap:8px }
  .lt-driver-name    { font-size:13px;font-weight:600;color:var(--lt-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .lt-rating         { font-family:var(--lt-mono);font-size:10px;font-weight:700;color:var(--lt-amber);flex-shrink:0 }
  .lt-vehicle-line   { font-size:11px;color:var(--lt-text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  .lt-call-btn       { width:36px;height:36px;border-radius:10px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);display:flex;align-items:center;justify-content:center;color:var(--lt-green);flex-shrink:0;text-decoration:none;transition:background .2s }
  .lt-call-btn:hover { background:rgba(16,185,129,.22) }

  /* PATIENT CARD */
  .lt-patient-grid   { display:flex;flex-direction:column;gap:5px }
  .lt-patient-row    { display:flex;align-items:center;justify-content:space-between }
  .lt-field-label    { font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lt-text3) }
  .lt-field-val      { font-size:11px;font-weight:500;color:var(--lt-text) }
  .lt-patient-addr   { display:flex;align-items:flex-start;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid var(--lt-border);font-size:11px;color:var(--lt-text2);line-height:1.4 }

  /* HOSPITAL CARD */
  .lt-hosp-body      { display:flex;flex-direction:column;gap:6px }
  .lt-hosp-name      { font-size:13px;font-weight:700;color:var(--lt-red) }
  .lt-hosp-addr      { font-size:11px;color:var(--lt-text2) }
  .lt-hosp-metrics   { display:flex;gap:16px;margin-top:4px }
  .lt-hosp-metric    { display:flex;flex-direction:column;gap:2px }
  .lt-hosp-metric-val{ font-family:var(--lt-mono);font-size:14px;font-weight:700;color:var(--lt-text) }
  .lt-hosp-metric-lbl{ font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lt-text3) }
  .lt-color-warn     { color:var(--lt-amber) }

  /* METRICS */
  .lt-metrics-grid  { display:grid;grid-template-columns:1fr 1fr;gap:6px }
  .lt-metric-cell   { background:var(--lt-bg3);border:1px solid var(--lt-border);border-radius:6px;padding:9px 10px;display:flex;flex-direction:column;gap:2px }
  .lt-metric-val    { font-family:var(--lt-mono);font-size:14px;font-weight:700;line-height:1 }
  .lt-metric-lbl    { font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lt-text3) }
  .lt-target-strip  { display:flex;align-items:center;gap:6px;margin-top:8px;padding:6px 8px;background:rgba(99,102,241,.08);border-radius:5px;border:1px solid rgba(99,102,241,.15);font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lt-violet) }

  /* EMERGENCY */
  .lt-sos-active   { display:flex;flex-direction:column;gap:8px }
  .lt-sos-header   { display:flex;align-items:center;gap:8px;font-family:var(--lt-mono);font-size:12px;font-weight:800;color:var(--lt-red);letter-spacing:.06em }
  .lt-sos-meta     { font-family:var(--lt-mono);font-size:10px;color:rgba(239,68,68,.6) }
  .lt-sos-desc     { font-size:12px;color:var(--lt-text2);line-height:1.5 }
  .lt-sos-idle     { display:flex;align-items:center;justify-content:space-between;gap:8px }
  .lt-secure-badge { display:flex;align-items:center;gap:6px;font-family:var(--lt-mono);font-size:10px;font-weight:700;letter-spacing:.05em;color:var(--lt-green) }

  /* DIAGNOSTICS */
  .lt-diag-rows    { display:flex;flex-direction:column;gap:5px }
  .lt-diag-row     { display:flex;align-items:center;justify-content:space-between }
  .lt-diag-label   { font-family:var(--lt-mono);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lt-text3) }
  .lt-diag-val-wrap{ display:flex;align-items:center;gap:5px }
  .lt-diag-dot     { width:6px;height:6px;border-radius:50%;flex-shrink:0 }
  .lt-diag-val     { font-family:var(--lt-mono);font-size:10px;font-weight:700 }

  /* BUTTONS */
  .lt-btn          { display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:8px 14px;border-radius:6px;font-family:var(--lt-font);font-size:12px;font-weight:700;letter-spacing:.01em;border:none;cursor:pointer;transition:all .2s;width:100% }
  .lt-btn-primary  { background:var(--lt-violet);color:#fff }
  .lt-btn-primary:hover { filter:brightness(1.1) }
  .lt-btn-join     { background:linear-gradient(135deg,rgba(99,102,241,.9),rgba(139,92,246,.9));color:#fff;border:1px solid rgba(99,102,241,.4) }
  .lt-btn-join:hover { filter:brightness(1.1) }
  .lt-btn-loading  { opacity:.7;cursor:wait }
  .lt-btn-sos      { background:rgba(239,68,68,.12);color:var(--lt-red);border:1px solid rgba(239,68,68,.3);width:auto;padding:6px 12px }
  .lt-btn-sos:hover{ background:rgba(239,68,68,.22) }
  .lt-btn-outline-err { background:transparent;color:var(--lt-red);border:1px solid rgba(239,68,68,.4) }
  .lt-btn-outline-err:hover { background:rgba(239,68,68,.1) }

  .lt-icon-btn     { width:32px;height:32px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid var(--lt-border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--lt-text2);transition:all .2s }
  .lt-icon-btn:hover { background:rgba(255,255,255,.08);color:var(--lt-text) }

  /* SPINNER */
  .lt-spinner      { width:12px;height:12px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:lt-spin .8s linear infinite;flex-shrink:0 }

  /* DOTS */
  .lt-dot          { display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--dot-color,currentColor);flex-shrink:0 }
  .lt-dot-sm       { display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dot-color,currentColor);flex-shrink:0 }
  .lt-dot-pulse    { animation:lt-pulse-dot 1.6s ease-in-out infinite }

  /* SKELETONS */
  .lt-skel         { border-radius:4px;background:linear-gradient(90deg,var(--lt-bg3) 25%,var(--lt-border2) 50%,var(--lt-bg3) 75%);background-size:200% 100%;animation:lt-skel-wave 1.4s ease-in-out infinite }
  @keyframes lt-skel-wave { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .lt-skel-sm      { height:10px;width:60%;margin-bottom:6px }
  .lt-skel-md      { height:10px;width:85% }

  /* JOIN PANEL */
  .lt-join-panel   { padding:10px 16px;border-bottom:1px solid var(--lt-border) }

  /* FAB CLUSTER — mobile */
  .lt-fab-cluster  { position:absolute;right:14px;bottom:80px;z-index:20;display:flex;flex-direction:column;gap:8px }
  .lt-fab          { width:44px;height:44px;border-radius:12px;background:var(--lt-bg2);border:1px solid var(--lt-border2);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--lt-text2);box-shadow:0 4px 14px rgba(0,0,0,.5);transition:all .2s }
  .lt-fab:hover    { background:var(--lt-bg3);color:var(--lt-text) }
  .lt-fab-call     { color:var(--lt-green);border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.1);text-decoration:none }
  .lt-fab-call:hover { background:rgba(16,185,129,.2) }

  /* BOTTOM SHEET */
  .lt-sheet         { position:absolute;bottom:0;left:0;right:0;z-index:30;background:var(--lt-bg2);border-top:1px solid var(--lt-border);border-radius:16px 16px 0 0;transition:height .3s cubic-bezier(.4,0,.2,1);overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.5) }
  .lt-sheet-handle-area { padding:10px 16px 8px;cursor:pointer }
  .lt-sheet-knob    { width:36px;height:3px;border-radius:2px;background:var(--lt-border2);margin:0 auto 10px }
  .lt-sheet-status-row   { display:flex;align-items:center;justify-content:space-between }
  .lt-sheet-status-left  { display:flex;align-items:center;gap:8px }
  .lt-sheet-status-right { display:flex;align-items:center;gap:10px }
  .lt-sheet-status-label { font-family:var(--lt-mono);font-size:11px;font-weight:700;color:var(--lt-text);letter-spacing:.04em }
  .lt-sheet-eta     { font-family:var(--lt-mono);font-size:14px;font-weight:800;color:var(--lt-violet) }
  .lt-sheet-content { overflow-y:auto;max-height:calc(82vh - 64px);padding-bottom:env(safe-area-inset-bottom,0px) }

  /* RECONNECT BAR */
  .lt-reconnect-bar { display:flex;align-items:center;justify-content:center;gap:8px;padding:7px 16px;background:rgba(245,158,11,.1);border-bottom:1px solid rgba(245,158,11,.25);font-family:var(--lt-mono);font-size:10px;font-weight:700;letter-spacing:.05em;color:var(--lt-amber);flex-shrink:0 }
  .lt-reconnect-btn { font-family:var(--lt-mono);font-size:9px;font-weight:800;letter-spacing:.06em;text-decoration:underline;background:none;border:none;color:var(--lt-amber);cursor:pointer;padding:0;margin-left:4px }

  /* UTILS */
  .lt-mono         { font-family:var(--lt-mono) }
  .lt-dim          { opacity:.45 }
  .lt-capitalize   { text-transform:capitalize }

  /* RESPONSIVE */
  @media (max-width:767px) {
    .lt-header-center { min-width:130px;padding:0 12px }
    .lt-eta-time      { font-size:15px }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CareAssistantRideLiveTracking() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const bookingId = params?.bookingId || null;
  const rideId    = params?.rideId    || null;

  const { isLoaded, loadError } = useGoogleMaps();
  const { connected, joinBookingRoom } = useSocket();

  // Redux selectors
  const redux      = useSelector(selectCurrentRide);
  const liveData   = useSelector(selectLiveData);
  const trackData  = useSelector(selectTrackingData);
  const careSnap   = useSelector(selectCareTrackingSnapshot);
  const socketLive = useSelector(selectSocketLive);

  // Local tracking state — reducer-driven
  const [ts, trackingDispatch] = useReducer(trackingReducer, INIT_TRACKING);

  // Init loading
  const [initLoading, setInitLoading] = useState(true);
  const [initError,   setInitError]   = useState(null);
  const mapCenterRef = useRef(null);

  // ── Initial data fetch ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setInitLoading(true);
      setInitError(null);
      try {
        const tasks = [];
        if (rideId)    tasks.push(dispatch(fetchRide(rideId)), dispatch(fetchRideLive(rideId)), dispatch(fetchRideTracking({ rideId, breadcrumbs: 80 })));
        if (bookingId) tasks.push(dispatch(fetchCareTrackingSnapshot({ bookingId })));
        await Promise.allSettled(tasks);
      } catch (e) {
        setInitError(e.message || 'Failed to load tracking data');
      } finally {
        setInitLoading(false);
      }
    };
    load();
  }, [rideId, bookingId, dispatch]);

  // ── Seed reducer from fetched data ───────────────────────────────────────
  useEffect(() => {
    const rd  = redux || liveData;
    const ll  = liveData?.liveLocation;
    if (!rd && !ll) return;

    trackingDispatch({
      type:    'SEED',
      status:  rd?.status || socketLive?.status,
      eta:     liveData?.currentEtaMinutes ?? socketLive?.etaMinutes,
      lat:     ll?.lat ?? ll?.coordinates?.[1],
      lng:     ll?.lng ?? ll?.coordinates?.[0],
      heading: ll?.heading,
      target:  careSnap?.activeTarget || trackData?.tracking?.activeTarget,
    });
  }, [redux, liveData, careSnap, trackData, socketLive]);

  // ── Socket room join ─────────────────────────────────────────────────────
 // ── Socket room join ─────────────────────────────────────────────────────
useEffect(() => {
  console.log("Checking Room Join Data:", { connected, bookingId }); 
  if (connected && bookingId) joinBookingRoom(bookingId);
}, [connected, bookingId, joinBookingRoom]);

  // ── Polling fallback ─────────────────────────────────────────────────────
  const pollRef = useRef(null);
  useEffect(() => {
    if (connected) { clearInterval(pollRef.current); return; }
    if (!rideId)   return;
    pollRef.current = setInterval(async () => {
      await dispatch(fetchRideLive(rideId));
      if (bookingId) await dispatch(fetchCareTrackingSnapshot({ bookingId }));
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [connected, rideId, bookingId, dispatch]);

  // ── On reconnect: refetch + rejoin ───────────────────────────────────────
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      // Reconnected
      if (rideId)    dispatch(fetchRideLive(rideId));
      if (bookingId) { joinBookingRoom(bookingId); dispatch(fetchCareTrackingSnapshot({ bookingId })); }
    }
    wasConnected.current = connected;
  }, [connected, rideId, bookingId, dispatch, joinBookingRoom]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const rd = useMemo(() => redux || liveData || trackData?.ride || null, [redux, liveData, trackData]);

  const trackingDoc = useMemo(() => trackData?.tracking || null, [trackData]);

  const driverSnapshot  = rd?.driverSnapshot  || careSnap?.driver?.snapshot  || null;
  const vehicleSnapshot = rd?.vehicleSnapshot || careSnap?.driver?.vehicleSnapshot || null;
  const patientInfo     = rd?.booking?.patientInfo  || null;
  const bookingCode     = rd?.booking?.bookingCode  || null;
  const bookingType     = rd?.booking?.bookingType  || null;
  const patientLocation = rd?.pickup || null;
  const rideCode        = rd?.rideCode || null;

  const hospital        = trackingDoc?.hospital || careSnap?.hospital || null;
  const nearestDistKm   = trackingDoc?.liveRouteContext?.nearestHospitalDistanceKm || null;
  const hospitalEta     = socketLive?.hospitalEta || null;
  const sosEvents       = trackingDoc?.sosEvents || [];
  const hasActiveSos    = trackingDoc?.hasActiveSos || ts.sosActive;

  // ── Map center ref (for "center map" button) ─────────────────────────────
  const handleMapReady = useCallback((map) => { mapCenterRef.current = map; }, []);

  const handleCenter = useCallback(() => {
    if (!mapCenterRef.current || (!ts.driverLat && !ts.driverLng)) return;
    mapCenterRef.current.panTo({ lat: ts.driverLat, lng: ts.driverLng });
    mapCenterRef.current.setZoom(15);
  }, [ts.driverLat, ts.driverLng]);

  const handleRefresh = useCallback(async () => {
    if (rideId)    dispatch(fetchRideLive(rideId));
    if (bookingId) dispatch(fetchCareTrackingSnapshot({ bookingId }));
  }, [rideId, bookingId, dispatch]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history?.length > 1) router.back();
    else router.push('/care-assistant/bookings');
  }, [router]);

  const handleJoinRide = useCallback(async () => {
    if (!bookingId) return;
    trackingDispatch({ type: 'JOIN_LOADING', value: true });
    try {
      await dispatch(careJoinRide({ bookingId })).unwrap();
      dispatch(setCareRideWorkflow({ careAssistantJoined: true, status: 'en_route_to_pickup' }));
    } catch (e) {
      console.error('[TrackingJoin]', e.message);
    } finally {
      trackingDispatch({ type: 'JOIN_LOADING', value: false });
    }
  }, [bookingId, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────────────────────

  if (initLoading || !isLoaded) return <TrackingLoader />;
  if (loadError)   return <TrackingError message="Google Maps failed to initialize." onRetry={handleRefresh} />;
  if (initError)   return <TrackingError message={initError} onRetry={handleRefresh} />;

  // ─────────────────────────────────────────────────────────────────────────
  // PANEL CONTENT — shared between sidebar and bottom sheet
  // ─────────────────────────────────────────────────────────────────────────

  const PanelContent = () => (
    <>
      <TrackingTimeline />
      <div className="lt-join-panel" style={{ display: ['driver_accepted','driver_en_route','driver_arrived','otp_verified','in_progress','at_stop'].includes(ts.rideStatus) ? 'block' : 'none' }}>
        <button onClick={handleJoinRide} disabled={ts.joinLoading} className={`lt-btn lt-btn-join ${ts.joinLoading ? 'lt-btn-loading' : ''}`}>
          {ts.joinLoading ? <><span className="lt-spinner" />Joining…</> : <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            Join Ride Session
          </>}
        </button>
      </div>
      <TrackingDriverCard driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot} />
      <TrackingPatientCard patientInfo={patientInfo} bookingCode={bookingCode} bookingType={bookingType} patientLocation={patientLocation} />
      <TrackingHospitalCard hospital={hospital} nearestDistKm={nearestDistKm} hospitalEta={hospitalEta} />
      <TrackingMetrics tracking={trackingDoc} />
      <TrackingEmergencyPanel sosEvents={sosEvents} hasActiveSos={hasActiveSos} bookingId={bookingId} rideId={rideId} />
      <TrackingDiagnostics connected={connected} />
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FULL RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>

      {/* Socket manager — renders nothing, manages all subscriptions */}
      <TrackingSocketManager
        bookingId={bookingId}
        rideId={rideId}
        dispatch={dispatch}
        trackingDispatch={trackingDispatch}
      />

      <TrackingCtx.Provider value={ts}>
        <div className="lt-root" data-theme="care-assistant">

          {/* Reconnect banner */}
          <ReconnectBanner connected={connected} onRetry={handleRefresh} />

          {/* Sticky header */}
          <TrackingHeader
            rideCode={rideCode}
            bookingCode={bookingCode}
            onBack={handleBack}
            onCenter={handleCenter}
            onRefresh={handleRefresh}
            connected={connected}
          />

          {/* ── DESKTOP: sidebar + map ────────────────────────────────── */}
          <div className="lt-body-desktop" style={{ display: 'none' }} id="lt-desktop">
            <TrackingSidebar
              driverSnapshot={driverSnapshot}
              vehicleSnapshot={vehicleSnapshot}
              patientInfo={patientInfo}
              booking={rd?.booking}
              bookingCode={bookingCode}
              bookingType={bookingType}
              patientLocation={patientLocation}
              hospital={hospital}
              nearestDistKm={nearestDistKm}
              hospitalEta={hospitalEta}
              tracking={trackingDoc}
              sosEvents={sosEvents}
              hasActiveSos={hasActiveSos}
              bookingId={bookingId}
              rideId={rideId}
              connected={connected}
              rideCode={rideCode}
              onJoinRide={handleJoinRide}
            />
            <div className="lt-map-container">
              <TrackingMap onMapReady={handleMapReady} />
            </div>
          </div>

          {/* ── MOBILE: fullscreen map + bottom sheet ─────────────────── */}
          <div className="lt-body-mobile" id="lt-mobile">
            <TrackingMap onMapReady={handleMapReady} />
            <TrackingActionBar
              onCenter={handleCenter}
              onRefresh={handleRefresh}
              driverPhone={driverSnapshot?.phone}
            />
            <TrackingBottomSheet
              rideStatus={ts.rideStatus}
              etaMinutes={ts.etaMinutes}
              sosActive={hasActiveSos}
            >
              <PanelContent />
            </TrackingBottomSheet>
          </div>

        </div>
      </TrackingCtx.Provider>

      {/* Responsive: show sidebar on md+ */}
      <style>{`
        @media (min-width: 768px) {
          #lt-desktop { display: flex !important }
          #lt-mobile  { display: none  !important }
        }
        @media (max-width: 767px) {
          #lt-desktop { display: none  !important }
          #lt-mobile  { display: flex  !important; flex-direction: column }
        }
      `}</style>
    </>
  );
}