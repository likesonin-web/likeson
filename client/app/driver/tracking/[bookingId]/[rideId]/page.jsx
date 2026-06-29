'use client';

/**
 * RideLiveTracking.jsx — Likeson Driver Live Tracking Page
 *
 * Production-grade driver ride execution screen.
 * Booking types handled: full_care_ride, patient_transport, care_assistant,
 *   doctor_consultation, diagnostic_home, follow_up
 *
 * Architecture:
 *   useRideTracking     → Redux state + GPS watch + socket CA events
 *   useDriverMarker     → AdvancedMarkerElement (zero DOM rebuild per ping)
 *   useRouteRenderer    → traversed / remaining polylines
 *   useMapCamera        → heading-locked follow mode
 *   useVoiceNavigation  → priority-queued TTS
 *   useRideLiveMap      → Directions API + step progression + off-route
 *
 * Place this file at:   app/(driver)/ride/[rideId]/page.jsx
 *   OR pass bookingId:  app/(driver)/booking/[bookingId]/live/page.jsx
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter }     from 'next/navigation';

// ── hooks ─────────────────────────────────────────────────────────────────────
import { useRideTracking }            from '@/hooks/useRideTracking';
import { useDriverMarker, createStaticMarker } from '@/hooks/useDriverMarker';
import { useRouteRenderer }           from '@/hooks/useRouteRenderer';
import { useMapCamera }               from '@/hooks/useMapCamera';
import { useVoiceNavigation }         from '@/hooks/useVoiceNavigation';
import { useRideLiveMap }             from '@/hooks/useRideLiveMap.js';

// ── redux ─────────────────────────────────────────────────────────────────────
import {
  markArrivedStop,
  departStop,
  driverTriggerSos,
  fetchRideStops,
  fetchActiveRouteVersion,
  fetchRideParticipants,
  selectRideStops,
  selectActiveRouteVersion,
  selectRideParticipants,
} from '@/store/slices/operationsSlice';

import {
  updateRideStatus,
  selectStops,
  selectCurrentStopId,
} from '@/store/slices/rideRequestSlice';

// ── socket ────────────────────────────────────────────────────────────────────
import { useSocket }             from '@/context/SocketProvider';
import socketService, { SOCKET_EVENTS } from '@/services/socketService';

// ── utils ─────────────────────────────────────────────────────────────────────
import { formatEta, formatDistance, getManeuverIcon } from '@/utils/navigationUtils';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const BOOKING_TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  patient_transport:   'Patient Transport',
  care_assistant:      'Care Assistant',
  doctor_consultation: 'Doctor Consultation',
  diagnostic_home:     'Home Diagnostic',
  follow_up:           'Follow-up',
};

const STOP_TYPE_LABELS = {
  PATIENT_PICKUP:      'Patient Pickup',
  CARE_ASSISTANT_JOIN: 'CA Join Point',
  HOSPITAL:            'Destination',
  PHARMACY:            'Pharmacy',
  LAB:                 'Lab',
  BLOOD_BANK:          'Blood Bank',
  CUSTOM:              'Stop',
};

const STOP_TYPE_COLORS = {
  PATIENT_PICKUP:      '#10b981',
  CARE_ASSISTANT_JOIN: '#8b5cf6',
  HOSPITAL:            '#ef4444',
  PHARMACY:            '#f59e0b',
  LAB:                 '#3b82f6',
  BLOOD_BANK:          '#dc2626',
  CUSTOM:              '#6b7280',
};

const SOS_TYPES = [
  { key: 'MEDICAL',           label: 'Medical',     icon: '🏥' },
  { key: 'SAFETY',            label: 'Safety',      icon: '🛡️' },
  { key: 'VEHICLE_BREAKDOWN', label: 'Breakdown',   icon: '🔧' },
  { key: 'ACCIDENT',          label: 'Accident',    icon: '💥' },
  { key: 'PATIENT_CONDITION', label: 'Patient',     icon: '🩺' },
  { key: 'OTHER',             label: 'Other',       icon: '🆘' },
];

const ACTION_BTN_STYLES = {
  primary:  { bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', shadow: '0 4px 20px rgba(59,130,246,0.45)' },
  arrived:  { bg: 'linear-gradient(135deg,#f97316,#ea580c)', shadow: '0 4px 20px rgba(249,115,22,0.45)' },
  otp:      { bg: 'linear-gradient(135deg,#10b981,#059669)', shadow: '0 4px 20px rgba(16,185,129,0.45)' },
  stop:     { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', shadow: '0 4px 20px rgba(139,92,246,0.45)' },
  complete: { bg: 'linear-gradient(135deg,#10b981,#059669)', shadow: '0 4px 20px rgba(16,185,129,0.5)'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE MAPS LOADER  (singleton promise — safe to call multiple times)
// ─────────────────────────────────────────────────────────────────────────────

let _mapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (_mapsPromise) return _mapsPromise;
  if (typeof window !== 'undefined' && window.google?.maps?.Map) {
    return (_mapsPromise = Promise.resolve());
  }
  _mapsPromise = new Promise((resolve, reject) => {
    const s    = document.createElement('script');
    s.src      = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=beta&callback=__gm_cb`;
    s.async    = true;
    s.defer    = true;
    window.__gm_cb = () => { resolve(); delete window.__gm_cb; };
    s.onerror  = reject;
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RideLiveTracking() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const rideId    = params?.rideId    || null;
  const bookingId = params?.bookingId || null;

  // ── core hook ─────────────────────────────────────────────────────────────
  const {
    ride, socketLive, rideStatus, currentPosition,
    isLoadingRide, gpsError, isOffline, connected,
    bookingType, caLiveLocation, caStatus, caJoinPoint, caName,
    sendStatusUpdate, verifyOtp, triggerSosAlert,
  } = useRideTracking({ rideId, bookingId });

  // ── redux ─────────────────────────────────────────────────────────────────
  const rideStopsOps  = useSelector(selectRideStops);
  const rideStopsReq  = useSelector(selectStops);
  const participants  = useSelector(selectRideParticipants);
  const activeVersion = useSelector(selectActiveRouteVersion);
  const currentStopId = useSelector(selectCurrentStopId);

  const stops = useMemo(
    () => rideStopsOps?.length ? rideStopsOps : (rideStopsReq || []),
    [rideStopsOps, rideStopsReq],
  );

  // ── socket ────────────────────────────────────────────────────────────────
  const { on, joinBookingRoom, leaveBookingRoom } = useSocket();

  // ── map refs ──────────────────────────────────────────────────────────────
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const mapLoadedRef    = useRef(false);

  // ── static marker refs ────────────────────────────────────────────────────
  const pickupMarkerRef   = useRef(null);
  const dropoffMarkerRef  = useRef(null);
  const caMarkerRef       = useRef(null);
  const caMarkerPosRef    = useRef(null);   // last known CA position for update
  const jpMarkerRef       = useRef(null);

  // ── sub-hooks ─────────────────────────────────────────────────────────────
  const { updateMarker: updateDriverMarker, destroyMarker } = useDriverMarker(mapRef, mapLoadedRef);
  const {
    setRoute, updateProgress, clearRoute,
    setCaRouteDirect, clearCaRoute,
  } = useRouteRenderer(mapRef);
  const {
    updateCamera, recenter, resetToNorth, zoomIn, zoomOut,
    initCameraListeners, mapBearingRef,
  } = useMapCamera(mapRef);
  const { voiceEnabled, toggleVoice } = useVoiceNavigation();
  const liveMap = useRideLiveMap({
    mapRef, mapLoadedRef, ride, stops, activeVersion, bookingType,
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [panel,          setPanel]        = useState('main');
  const [otpDigits,      setOtpDigits]    = useState(['', '', '', '']);
  const [otpError,       setOtpError]     = useState('');
  const [otpLoading,     setOtpLoading]   = useState(false);
  const [sosType,        setSosType]      = useState('');
  const [sosDesc,        setSosDesc]      = useState('');
  const [sosSent,        setSosSent]      = useState(false);
  const [actionLoading,  setActionLoading] = useState(false);
  const [followMode,     setFollowMode]   = useState(true);
  const [expandedStop,   setExpandedStop] = useState(null);
  const [toast,          setToast]        = useState(null);

  // ── OTP input refs ────────────────────────────────────────────────────────
  const otpInputRefs = useRef([null, null, null, null]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isFullCare = bookingType === 'full_care_ride';
  const caJoined   = caStatus === 'IN_VEHICLE' || caStatus === 'in_ride';

  const currentStop = useMemo(() => {
    if (!currentStopId || !stops.length) return null;
    const id = currentStopId?.toString();
    return stops.find(s => s._id?.toString() === id || s.stopId?.toString() === id) || null;
  }, [stops, currentStopId]);

  const statusFlow = useMemo(() => {
    const s = rideStatus || ride?.status || '';
    return {
      isAssigned:    s === 'driver_assigned',
      isAccepted:    s === 'driver_accepted',
      isEnRoute:     s === 'driver_en_route',
      isArrived:     s === 'driver_arrived',
      isOtpVerified: s === 'otp_verified',
      isInProgress:  s === 'in_progress',
      isAtStop:      s === 'at_stop',
      isCompleted:   s === 'completed',
      isCancelled:   s === 'cancelled',
    };
  }, [rideStatus, ride?.status]);

  const nextAction = useMemo(() => {
    if (statusFlow.isAssigned)    return { label: 'Accept Ride',       action: 'accepted',   variant: 'primary'  };
    if (statusFlow.isAccepted)    return { label: 'Start Navigation',   action: 'en_route',   variant: 'primary'  };
    if (statusFlow.isEnRoute)     return { label: 'Mark Arrived',       action: 'arrived',    variant: 'arrived'  };
    if (statusFlow.isArrived)     return { label: 'Enter OTP',          action: '__otp',      variant: 'otp'      };
    if (statusFlow.isOtpVerified) return { label: 'Start Ride',         action: 'ride_started', variant: 'primary' };
    if (statusFlow.isAtStop)      return { label: 'Depart Stop',        action: 'stop_departed', variant: 'stop'  };
    if (statusFlow.isInProgress) {
      const midStop = stops
        .filter(s => s.status === 'PENDING' && s.stopType !== 'HOSPITAL' && s.stopType !== 'PATIENT_PICKUP')
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))[0];
      if (midStop) return { label: `Arrived at ${STOP_TYPE_LABELS[midStop.stopType]}`, action: '__stop_arrived', variant: 'stop', stopId: midStop._id };
      return { label: 'Complete Ride', action: 'completed', variant: 'complete' };
    }
    return null;
  }, [statusFlow, stops]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Google Maps init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cameraCleanup = () => {};

    loadGoogleMaps(MAPS_API_KEY)
      .then(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new window.google.maps.Map(mapContainerRef.current, {
          zoom:             17,
          center:           { lat: 16.506, lng: 80.648 },
          mapId:            'LIKESON_DRIVER_MAP',
          disableDefaultUI: true,
          gestureHandling:  'greedy',
          clickableIcons:   false,
          tilt:             45,
        });

        mapRef.current      = map;
        mapLoadedRef.current = true;

        cameraCleanup = initCameraListeners(map);

        // Keep followMode React state in sync with camera hook ref
        map.addListener('dragstart', () => setFollowMode(false));
        map.addListener('dragend',   () => setTimeout(() => setFollowMode(true), 12000));
      })
      .catch(err => console.error('[Map] load failed', err));

    return () => {
      cameraCleanup();
      destroyMarker();
      clearRoute();
    };
  }, []); // eslint-disable-line

  // ── Load stops + route version ────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    dispatch(fetchRideStops({ rideId }));
    dispatch(fetchActiveRouteVersion({ rideId }));
    if (isFullCare) dispatch(fetchRideParticipants({ rideId }));
  }, [rideId, isFullCare, dispatch]);

  // ── Join socket booking room ──────────────────────────────────────────────
  useEffect(() => {
    if (!connected || !bookingId) return;
    socketService.joinBookingRoom(bookingId);
    return () => socketService.leaveBookingRoom(bookingId);
  }, [connected, bookingId]);

  // ── Socket: route/stop events ─────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      on(SOCKET_EVENTS.STOP_ARRIVED,   () => { if (rideId) dispatch(fetchRideStops({ rideId })); }),
      on(SOCKET_EVENTS.STOP_DEPARTED,  () => { if (rideId) { dispatch(fetchRideStops({ rideId })); dispatch(fetchActiveRouteVersion({ rideId })); } }),
      on(SOCKET_EVENTS.DESTINATION_CHANGED, () => { showToast('Destination updated by admin', 'info'); if (rideId) dispatch(fetchActiveRouteVersion({ rideId })); }),
      on(SOCKET_EVENTS.JOIN_POINT_CALCULATED, () => { showToast('CA join point updated', 'info'); if (rideId) dispatch(fetchRideStops({ rideId })); }),
    ];
    return () => unsubs.forEach(fn => fn?.());
  }, [on, rideId, dispatch, showToast]);

  // ── Listen for route from useRideLiveMap ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const { result, targetType } = e.detail || {};
      if (!result) return;
      const routeType = (targetType === 'HOSPITAL' || targetType === 'dropoff') ? 'toDropoff' : 'toPickup';
      setRoute(result, routeType);
    };
    window.addEventListener('lrt:route_ready', handler);
    return () => window.removeEventListener('lrt:route_ready', handler);
  }, [setRoute]);

  // ── GPS → marker + camera + progress ────────────────────────────────────
  useEffect(() => {
    if (!currentPosition || !mapLoadedRef.current) return;
    const { lat, lng, heading = 0, speed = 0 } = currentPosition;
    updateDriverMarker(lat, lng, heading, mapBearingRef.current, speed);
    if (followMode) updateCamera(lat, lng, heading, speed);
    updateProgress(lat, lng);
    liveMap.onGpsUpdate(lat, lng, heading, speed);
  }, [currentPosition, followMode, updateDriverMarker, updateCamera, updateProgress, liveMap, mapBearingRef]);

  // ── Place static markers once ride loads ──────────────────────────────────
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current || !ride) return;

    if (ride.pickup?.coordinates?.length === 2 && !pickupMarkerRef.current) {
      const [lng, lat] = ride.pickup.coordinates;
      pickupMarkerRef.current = createStaticMarker(mapRef.current, lat, lng, 'pickup');
    }
    if (ride.dropoff?.coordinates?.length === 2 && !dropoffMarkerRef.current) {
      const [lng, lat] = ride.dropoff.coordinates;
      dropoffMarkerRef.current = createStaticMarker(mapRef.current, lat, lng, 'dropoff');
    }
  }, [ride]); // eslint-disable-line

  // ── CA live marker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFullCare || !caLiveLocation || !mapLoadedRef.current || !mapRef.current) return;
    if (caJoined) {
      if (caMarkerRef.current) { caMarkerRef.current.map = null; caMarkerRef.current = null; }
      return;
    }
    const { lat, lng } = caLiveLocation;
    if (!lat || !lng) return;

    if (!caMarkerRef.current) {
      const anchor = document.createElement('div');
      anchor.style.cssText = 'position:absolute;width:0;height:0;overflow:visible;pointer-events:none;';
      const bubble = document.createElement('div');
      bubble.style.cssText = `
        position:absolute;width:40px;height:40px;left:-20px;top:-40px;
        background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:50%;
        border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 16px rgba(139,92,246,0.6);font-size:18px;
      `;
      bubble.textContent = '👩‍⚕️';
      anchor.appendChild(bubble);
      caMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: anchor, position: { lat, lng }, zIndex: 15,
      });
      caMarkerPosRef.current = { lat, lng };
    } else {
      caMarkerRef.current.position = { lat, lng };
    }
  }, [caLiveLocation, isFullCare, caJoined]);

  // ── CA join-point marker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isFullCare || !caJoinPoint?.coordinates?.length || !mapRef.current || !mapLoadedRef.current) return;
    const [lng, lat] = caJoinPoint.coordinates;
    if (jpMarkerRef.current) { jpMarkerRef.current.map = null; }

    const anchor = document.createElement('div');
    anchor.style.cssText = 'position:absolute;width:0;height:0;overflow:visible;pointer-events:none;';
    anchor.innerHTML = `
      <div style="position:absolute;left:-22px;top:-54px;display:flex;flex-direction:column;align-items:center;">
        <div style="width:44px;height:44px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(139,92,246,0.6);font-size:20px;">📍</div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #8b5cf6;"></div>
        <div style="background:#8b5cf6;color:#fff;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;text-transform:uppercase;white-space:nowrap;margin-top:2px;">CA Join</div>
      </div>
    `;
    jpMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current, content: anchor, position: { lat, lng }, zIndex: 12,
    });
  }, [caJoinPoint, isFullCare]); // eslint-disable-line

  // ── Cleanup static markers ────────────────────────────────────────────────
  useEffect(() => () => {
    [pickupMarkerRef, dropoffMarkerRef, caMarkerRef, jpMarkerRef].forEach(r => {
      if (r.current) { r.current.map = null; r.current = null; }
    });
  }, []);

  // ── Action handler ────────────────────────────────────────────────────────
  const handleAction = useCallback(async (action, extras = {}) => {
    if (action === '__otp') { setPanel('otp'); return; }

    setActionLoading(true);
    try {
      if (action === '__stop_arrived') {
        const stopId = extras.stopId || nextAction?.stopId;
        await dispatch(markArrivedStop({ bookingId, stopId }));
        showToast('Arrived at stop ✓');
        if (rideId) dispatch(fetchRideStops({ rideId }));
      } else if (action === '__stop_depart') {
        await dispatch(departStop({ bookingId, stopId: extras.stopId }));
        showToast('Departed from stop');
        if (rideId) dispatch(fetchRideStops({ rideId }));
      } else {
        await sendStatusUpdate(action, extras);
        const msgs = {
          accepted:    'Ride accepted ✓',
          en_route:    'Navigation started',
          arrived:     'Arrival marked — OTP sent to patient',
          ride_started:'Ride started — navigate to destination',
          completed:   'Ride completed! 🎉',
          cancelled:   'Ride cancelled',
        };
        if (msgs[action]) showToast(msgs[action]);
        if (action === 'en_route') liveMap.requestDirections();
        if (action === 'ride_started') liveMap.requestDirections('dropoff');
        if (action === 'completed') setTimeout(() => router.push('/driver/dashboard'), 2500);
      }
    } catch (err) {
      showToast(err?.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [nextAction, sendStatusUpdate, dispatch, bookingId, rideId, liveMap, router, showToast]);

  // ── OTP ───────────────────────────────────────────────────────────────────
  const otpValue = otpDigits.join('');

  const handleOtpDigit = useCallback((idx, val) => {
    const v = val.replace(/\D/g, '').slice(-1);
    setOtpDigits(prev => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < 3) setTimeout(() => otpInputRefs.current[idx + 1]?.focus(), 0);
  }, []);

  const handleOtpKey = useCallback((idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpInputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter' && otpValue.length === 4) handleOtpSubmit();
  }, [otpDigits, otpValue]); // eslint-disable-line

  const handleOtpSubmit = useCallback(async () => {
    if (otpValue.length < 4) { setOtpError('Enter 4-digit OTP'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      const result = await verifyOtp(otpValue.trim());
      if (result?.error || result?.payload?.error) {
        setOtpError('Invalid OTP — try again');
      } else {
        setPanel('main');
        setOtpDigits(['', '', '', '']);
        showToast('OTP verified — ride started!');
        liveMap.requestDirections('dropoff');
      }
    } catch {
      setOtpError('Invalid OTP — try again');
    } finally {
      setOtpLoading(false);
    }
  }, [otpValue, verifyOtp, showToast, liveMap]);

  // ── SOS ───────────────────────────────────────────────────────────────────
  const handleSos = useCallback(async () => {
    if (!sosType) return;
    await dispatch(driverTriggerSos({
      bookingId,
      sosType,
      description: sosDesc,
      coordinates: currentPosition ? [currentPosition.lng, currentPosition.lat] : undefined,
    }));
    setSosSent(true);
    showToast('🆘 SOS sent — admin notified', 'error');
    setTimeout(() => { setSosSent(false); setSosType(''); setSosDesc(''); setPanel('main'); }, 3000);
  }, [sosType, sosDesc, currentPosition, bookingId, dispatch, showToast]);

  // ── Recenter ──────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!currentPosition) return;
    recenter(currentPosition.lat, currentPosition.lng);
    setFollowMode(true);
  }, [currentPosition, recenter]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>

      {/* MAP */}
      <div ref={mapContainerRef} style={S.map} />

      {/* LOADING OVERLAY */}
      {isLoadingRide && (
        <div style={S.loadingOverlay}>
          <div style={S.spinner} />
          <p style={S.loadingText}>Loading ride…</p>
        </div>
      )}

      {/* OFFLINE */}
      {isOffline && <Banner color="#ef4444">⚡ No internet — GPS paused</Banner>}

      {/* GPS ERROR */}
      {gpsError && !isOffline && <Banner color="#f59e0b">📍 {gpsError}</Banner>}

      {/* TOAST */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981',
        }}>
          {toast.msg}
        </div>
      )}

      {/* TOP HUD */}
      <div style={S.topHud}>
        <HudBtn onClick={() => router.back()} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
        </HudBtn>

        <div style={S.ridePill}>
          <span style={S.pillType}>{BOOKING_TYPE_LABELS[bookingType] || 'Ride'}</span>
          <span style={S.pillCode}>{ride?.rideCode || '—'}</span>
          <StatusDot status={rideStatus || ride?.status} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <HudBtn
            onClick={toggleVoice}
            style={{ background: voiceEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)' }}
            aria-label="Toggle voice"
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </HudBtn>
          <HudBtn onClick={() => setPanel(p => p === 'info' ? 'main' : 'info')} aria-label="Trip info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/></svg>
          </HudBtn>
        </div>
      </div>

      {/* MAP CONTROLS */}
      <div style={S.mapCtrlCol}>
        <MapCtrlBtn onClick={zoomIn}         aria-label="Zoom in">＋</MapCtrlBtn>
        <MapCtrlBtn onClick={zoomOut}        aria-label="Zoom out">－</MapCtrlBtn>
        <MapCtrlBtn onClick={handleRecenter} aria-label="Recenter"
          style={{ background: followMode ? '#3b82f6' : 'rgba(17,24,39,0.9)', color: followMode ? '#fff' : '#9ca3af' }}>
          ◎
        </MapCtrlBtn>
        <MapCtrlBtn onClick={resetToNorth}   aria-label="North up">N</MapCtrlBtn>
      </div>

      {/* ── PANELS ── */}

      {panel === 'main' && (
        <BottomSheet>
          {/* Nav hint */}
          {liveMap.currentStepText && (
            <div style={S.navHint}>
              <ManeuverArrow maneuver={liveMap.currentManeuver} />
              <span style={S.navHintText}>{liveMap.currentStepText}</span>
              {liveMap.etaMinutes != null && (
                <span style={S.navHintEta}>{formatEta(liveMap.etaMinutes)}</span>
              )}
            </div>
          )}

          {/* ETA bar */}
          {(liveMap.etaMinutes != null || liveMap.distanceKm != null || currentStop) && (
            <div style={S.etaBar}>
              {liveMap.etaMinutes != null && <EtaItem value={formatEta(liveMap.etaMinutes)}    label="ETA" />}
              {liveMap.distanceKm  != null && <EtaItem value={formatDistance(liveMap.distanceKm)} label="Distance" />}
              {currentStop && (
                <EtaItem
                  value={STOP_TYPE_LABELS[currentStop.stopType] || 'Stop'}
                  label="Next Stop"
                  color={STOP_TYPE_COLORS[currentStop.stopType]}
                />
              )}
            </div>
          )}

          {/* CA strip — full_care_ride only */}
          {isFullCare && (
            <div style={S.caStrip}>
              <span style={{ fontSize: 20 }}>👩‍⚕️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={S.caName}>{caName || 'Care Assistant'}</span>
                <span style={S.caStatus}>
                  {caJoined ? '✓ In vehicle' :
                   caStatus === 'AT_JOIN_POINT' ? '📍 At join point' :
                   caStatus === 'EN_ROUTE' ? '🚶 En route to join point' : '⏳ Awaiting assignment'}
                </span>
              </div>
              {caJoinPoint?.distCaToJoinKm && !caJoined && (
                <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
                  {caJoinPoint.distCaToJoinKm} km
                </span>
              )}
            </div>
          )}

          {/* Primary action button */}
          {nextAction && (
            <button
              onClick={() => handleAction(nextAction.action, { stopId: nextAction.stopId })}
              disabled={actionLoading}
              style={{
                ...S.actionBtn,
                background:  ACTION_BTN_STYLES[nextAction.variant]?.bg,
                boxShadow:   ACTION_BTN_STYLES[nextAction.variant]?.shadow,
                opacity:     actionLoading ? 0.7 : 1,
              }}
            >
              {actionLoading ? <Spinner /> : nextAction.label}
            </button>
          )}

          {/* Quick row */}
          <div style={S.quickRow}>
            <QuickBtn icon="🗺️" label={`Stops${stops.filter(s=>s.status==='PENDING').length ? ` (${stops.filter(s=>s.status==='PENDING').length})` : ''}`} onClick={() => setPanel('stops')} />
            {isFullCare && <QuickBtn icon="👥" label="Participants" onClick={() => setPanel('participants')} />}
            <QuickBtn icon="🆘" label="SOS" onClick={() => setPanel('sos')} color="#ef4444" />
          </div>
        </BottomSheet>
      )}

      {panel === 'stops' && (
        <SidePanel title="Route Stops" onClose={() => setPanel('main')}>
          {stops.length === 0 && <EmptyState>No stops loaded</EmptyState>}
          {[...stops]
            .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
            .map((stop, i) => {
              const isCurr = stop._id?.toString() === currentStop?._id?.toString();
              const isExp  = expandedStop === stop._id;
              return (
                <div key={stop._id || i}
                  onClick={() => setExpandedStop(isExp ? null : stop._id)}
                  style={{
                    ...S.stopCard,
                    borderLeft: `4px solid ${STOP_TYPE_COLORS[stop.stopType] || '#6b7280'}`,
                    background: isCurr ? 'rgba(59,130,246,0.07)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={S.stopSeq}>{stop.sequence || i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ ...S.stopBadge, background: STOP_TYPE_COLORS[stop.stopType] || '#6b7280' }}>
                        {STOP_TYPE_LABELS[stop.stopType] || stop.stopType}
                      </span>
                      <p style={S.stopAddr}>{stop.location?.address || stop.location?.label || '—'}</p>
                    </div>
                    <StopChip status={stop.status} />
                  </div>
                  {isExp && (
                    <div style={S.stopExpanded}>
                      {stop.arrival?.actualAt    && <p style={S.stopDetail}>Arrived: {new Date(stop.arrival.actualAt).toLocaleTimeString('en-IN')}</p>}
                      {stop.departure?.actualAt  && <p style={S.stopDetail}>Departed: {new Date(stop.departure.actualAt).toLocaleTimeString('en-IN')}</p>}
                      {stop.status === 'PENDING' && isCurr && (
                        <button style={{ ...S.stopActBtn, background: '#3b82f6' }} onClick={e => { e.stopPropagation(); handleAction('__stop_arrived', { stopId: stop._id }); }}>Mark arrived</button>
                      )}
                      {stop.status === 'ARRIVED' && (
                        <button style={{ ...S.stopActBtn, background: '#10b981' }} onClick={e => { e.stopPropagation(); handleAction('__stop_depart', { stopId: stop._id }); }}>Depart from stop</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          }
        </SidePanel>
      )}

      {panel === 'otp' && (
        <ModalSheet>
          <div style={S.modalHeader}>
            <h2 style={S.modalTitle}>Verify Patient OTP</h2>
            <CloseBtn onClick={() => { setPanel('main'); setOtpDigits(['','','','']); setOtpError(''); }} />
          </div>
          <p style={S.modalDesc}>Ask the patient for the 4-digit OTP sent to their phone.</p>
          <div style={S.otpRow}>
            {[0, 1, 2, 3].map(i => (
              <input
                key={i}
                ref={el => otpInputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpDigits[i]}
                onChange={e => handleOtpDigit(i, e.target.value)}
                onKeyDown={e => handleOtpKey(i, e)}
                style={{
                  ...S.otpInput,
                  borderColor: otpError ? '#ef4444' : otpDigits[i] ? '#10b981' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
          {otpError && <p style={S.otpError}>{otpError}</p>}
          <button
            onClick={handleOtpSubmit}
            disabled={otpLoading || otpValue.length < 4}
            style={{ ...S.actionBtn, ...{ background: ACTION_BTN_STYLES.otp.bg, boxShadow: ACTION_BTN_STYLES.otp.shadow }, marginTop: 16, opacity: otpLoading || otpValue.length < 4 ? 0.5 : 1 }}
          >
            {otpLoading ? <Spinner /> : 'Verify & Start Ride'}
          </button>
        </ModalSheet>
      )}

      {panel === 'sos' && (
        <ModalSheet borderTop="4px solid #ef4444">
          <div style={S.modalHeader}>
            <h2 style={{ ...S.modalTitle, color: '#ef4444' }}>🆘 Emergency SOS</h2>
            <CloseBtn onClick={() => setPanel('main')} />
          </div>
          {sosSent ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 52 }}>🆘</div>
              <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 18, marginTop: 12 }}>SOS Sent!</p>
              <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Admin team notified immediately.</p>
            </div>
          ) : (
            <>
              <p style={S.modalDesc}>Select emergency type and tap Send SOS.</p>
              <div style={S.sosGrid}>
                {SOS_TYPES.map(st => (
                  <button key={st.key} onClick={() => setSosType(st.key)} style={{
                    ...S.sosBtn,
                    borderColor: sosType === st.key ? '#ef4444' : 'rgba(255,255,255,0.08)',
                    background:  sosType === st.key ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <span style={{ fontSize: 24 }}>{st.icon}</span>
                    <span style={{ fontSize: 10, color: '#d1d5db', marginTop: 4 }}>{st.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Describe the situation (optional)…"
                value={sosDesc}
                onChange={e => setSosDesc(e.target.value)}
                rows={3}
                style={S.sosTextarea}
              />
              <button onClick={handleSos} disabled={!sosType}
                style={{ ...S.actionBtn, background: '#ef4444', opacity: sosType ? 1 : 0.4 }}>
                Send SOS Alert
              </button>
            </>
          )}
        </ModalSheet>
      )}

      {panel === 'participants' && (
        <SidePanel title="Participants" onClose={() => setPanel('main')}>
          {participants.filter(p => p.isActive).length === 0 && <EmptyState>No active participants</EmptyState>}
          {participants.filter(p => p.isActive).map((p, i) => (
            <div key={p._id || i} style={S.partCard}>
              <span style={{ fontSize: 28 }}>
                {p.role === 'CARE_ASSISTANT' ? '👩‍⚕️' : p.role === 'NURSE' ? '🩺' : p.role === 'FAMILY' ? '👨‍👩‍👧' : '👤'}
              </span>
              <div style={{ flex: 1 }}>
                <p style={S.partName}>{p.snapshot?.name || caName || p.role}</p>
                <p style={S.partRole}>{p.role.replace(/_/g, ' ')}</p>
                <p style={{ fontSize: 12, color: p.status === 'IN_VEHICLE' ? '#10b981' : '#f59e0b', marginTop: 2 }}>
                  {p.status?.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              {p.snapshot?.phone && <a href={`tel:${p.snapshot.phone}`} style={{ fontSize: 22, textDecoration: 'none' }}>📞</a>}
            </div>
          ))}
          {caJoinPoint && (
            <div style={S.jpCard}>
              <p style={S.jpTitle}>📍 CA Join Point</p>
              <p style={S.jpDetail}>Zone: {caJoinPoint.zone?.replace(/_/g, ' ') || '—'}</p>
              <p style={S.jpDetail}>Distance: {caJoinPoint.distCaToJoinKm ? `${caJoinPoint.distCaToJoinKm} km` : '—'}</p>
            </div>
          )}
        </SidePanel>
      )}

      {panel === 'info' && (
        <SidePanel title="Trip Details" onClose={() => setPanel('main')}>
          <InfoRow label="Ride Code"   value={ride?.rideCode || '—'} />
          <InfoRow label="Type"        value={BOOKING_TYPE_LABELS[bookingType] || '—'} />
          <InfoRow label="Status"      value={(rideStatus || ride?.status || '—').replace(/_/g, ' ')} />
          <InfoRow label="Est. Dist"   value={ride?.estimatedDistanceKm ? `${ride.estimatedDistanceKm} km` : '—'} />
          <InfoRow label="Est. Time"   value={ride?.estimatedDurationMin ? `${ride.estimatedDurationMin} min` : '—'} />
          <InfoRow label="Pickup"      value={ride?.pickup?.address || '—'} />
          <InfoRow label="Drop-off"    value={ride?.dropoff?.address || '—'} />
          <InfoRow label="Scheduled"   value={ride?.scheduledPickupAt ? new Date(ride.scheduledPickupAt).toLocaleTimeString('en-IN') : '—'} />
          {ride?.rideStartedAt  && <InfoRow label="Started"  value={new Date(ride.rideStartedAt).toLocaleTimeString('en-IN')} />}
          {activeVersion && <InfoRow label="Route v." value={`v${activeVersion.version?.versionNumber || activeVersion.versionNumber || 1}`} />}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
            Stops ({stops.length})
          </p>
          {stops.map((s, i) => (
            <InfoRow key={i}
              label={`${s.sequence || i + 1}. ${STOP_TYPE_LABELS[s.stopType] || s.stopType}`}
              value={s.status?.toLowerCase().replace(/_/g, ' ') || '—'}
            />
          ))}
        </SidePanel>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function Banner({ children, color }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200, padding: '10px 16px', background: color, color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
      {children}
    </div>
  );
}

function HudBtn({ children, onClick, style = {}, ...rest }) {
  return (
    <button onClick={onClick} {...rest} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(8px)', color: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', ...style }}>
      {children}
    </button>
  );
}

function MapCtrlBtn({ children, onClick, style = {}, ...rest }) {
  return (
    <button onClick={onClick} {...rest} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: 'rgba(17,24,39,0.9)', backdropFilter: 'blur(8px)', color: '#d1d5db', cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', ...style }}>
      {children}
    </button>
  );
}

function BottomSheet({ children }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(11,15,26,0.96)', backdropFilter: 'blur(20px)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '0 16px 28px', boxShadow: '0 -4px 40px rgba(0,0,0,0.5)' }}>
      {children}
    </div>
  );
}

function SidePanel({ title, onClose, children }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60, background: '#0d1320', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 40px rgba(0,0,0,0.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{title}</h3>
        <CloseBtn onClick={onClose} />
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px 28px' }}>{children}</div>
    </div>
  );
}

function ModalSheet({ children, borderTop }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', background: '#0d1320', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px 40px', boxShadow: '0 -4px 40px rgba(0,0,0,0.6)', ...(borderTop ? { borderTop } : {}) }}>
        {children}
      </div>
    </div>
  );
}

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#9ca3af', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
  );
}

function StatusDot({ status }) {
  const c = { driver_assigned: '#f59e0b', driver_accepted: '#3b82f6', driver_en_route: '#8b5cf6', driver_arrived: '#f97316', otp_verified: '#10b981', in_progress: '#10b981', at_stop: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444' }[status] || '#6b7280';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}`, flexShrink: 0, display: 'inline-block', marginLeft: 6 }} />;
}

function EtaItem({ value, label, color }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: color || '#f1f5f9', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: '#6b7280', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function ManeuverArrow({ maneuver }) {
  const MAP = { 'turn-left': '↰', 'turn-right': '↱', 'keep-left': '↖', 'keep-right': '↗', 'u-turn': '↩', roundabout: '⟳', merge: '⇲', straight: '↑' };
  return <span style={{ fontSize: 22, marginRight: 10, lineHeight: 1, flexShrink: 0 }}>{MAP[getManeuverIcon(maneuver)] || '↑'}</span>;
}

function StopChip({ status }) {
  const cfg = { PENDING: ['#1e3a5f', '#93c5fd', 'Pending'], ARRIVED: ['#1a3a2e', '#6ee7b7', 'Arrived'], COMPLETED: ['#1a2e1a', '#86efac', 'Done'], SKIPPED: ['#2d2d1a', '#fde68a', 'Skipped'], MISSED: ['#3a1a1a', '#fca5a5', 'Missed'] };
  const [bg, color, label] = cfg[status] || cfg.PENDING;
  return <span style={{ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{label}</span>;
}

function QuickBtn({ icon, label, onClick, color }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 4px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: color || '#9ca3af', fontSize: 10, fontWeight: 600, gap: 2 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 16 }}>
      <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#94a3b8', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={{ textAlign: 'center', color: '#374151', padding: '40px 0', fontSize: 14 }}>{children}</div>;
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'lrtSpin 0.7s linear infinite' }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  root:          { position: 'fixed', inset: 0, background: '#0f172a', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", userSelect: 'none', overflow: 'hidden' },
  map:           { position: 'absolute', inset: 0, zIndex: 0 },
  loadingOverlay:{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  spinner:       { width: 44, height: 44, border: '3px solid rgba(59,130,246,0.2)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'lrtSpin 0.8s linear infinite' },
  loadingText:   { color: '#93c5fd', fontSize: 15, fontWeight: 500 },
  toast:         { position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 300, padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', maxWidth: '90vw', overflow: 'hidden', textOverflow: 'ellipsis' },
  topHud:        { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 50, display: 'flex', alignItems: 'center', gap: 10 },
  ridePill:      { flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '8px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', overflow: 'hidden' },
  pillType:      { fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 },
  pillCode:      { fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mapCtrlCol:    { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 50, display: 'flex', flexDirection: 'column', gap: 6 },
  navHint:       { display: 'flex', alignItems: 'center', padding: '14px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  navHintText:   { flex: 1, fontSize: 15, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 },
  navHintEta:    { fontSize: 14, fontWeight: 700, color: '#60a5fa', marginLeft: 10, flexShrink: 0 },
  etaBar:        { display: 'flex', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  caStrip:       { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', margin: '10px 0 0', background: 'rgba(139,92,246,0.08)', borderRadius: 12, border: '1px solid rgba(139,92,246,0.15)' },
  caName:        { display: 'block', fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
  caStatus:      { display: 'block', fontSize: 11, color: '#a78bfa', marginTop: 2 },
  actionBtn:     { width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', transition: 'opacity 0.2s' },
  quickRow:      { display: 'flex', gap: 10, marginTop: 14 },
  stopCard:      { borderRadius: 12, marginBottom: 10, padding: '12px 14px', cursor: 'pointer', transition: 'background 0.15s' },
  stopSeq:       { width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#94a3b8', flexShrink: 0 },
  stopBadge:     { display: 'inline-block', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 },
  stopAddr:      { fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '3px 0 0' },
  stopExpanded:  { marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' },
  stopDetail:    { fontSize: 12, color: '#6b7280', margin: '2px 0' },
  stopActBtn:    { display: 'inline-block', marginTop: 8, padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  modalHeader:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle:    { fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  modalDesc:     { fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 },
  otpRow:        { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8 },
  otpInput:      { width: 58, height: 70, borderRadius: 12, border: '2px solid', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 30, fontWeight: 700, textAlign: 'center', outline: 'none', transition: 'border-color 0.15s' },
  otpError:      { color: '#ef4444', fontSize: 13, textAlign: 'center', margin: '4px 0' },
  sosGrid:       { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 },
  sosBtn:        { borderRadius: 12, border: '1.5px solid', padding: '12px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' },
  sosTextarea:   { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0', fontSize: 14, padding: 12, resize: 'none', outline: 'none', marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' },
  partCard:      { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' },
  partName:      { fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 },
  partRole:      { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '2px 0 0' },
  jpCard:        { marginTop: 16, padding: 14, borderRadius: 12, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)' },
  jpTitle:       { fontSize: 13, fontWeight: 600, color: '#a78bfa', margin: '0 0 8px' },
  jpDetail:      { fontSize: 12, color: '#7c3aed', margin: '3px 0' },
};

// ── Global keyframe injection ─────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('lrt-kf')) {
  const st = document.createElement('style');
  st.id = 'lrt-kf';
  st.textContent = `
    @keyframes lrtSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    * { box-sizing:border-box; }
    button:active { transform:scale(0.97); }
    input:focus { outline:none; }
  `;
  document.head.appendChild(st);
}