'use client';

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  DirectionsRenderer,
  Circle,
  OverlayView,
} from '@react-google-maps/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Navigation, Phone, MapPin, Flag,
  Clock, Gauge, CheckCircle, XCircle, AlertCircle,
  RotateCcw, StopCircle, Play, Loader2, Shield,
  Route, Star, Car, Bell, RefreshCw, AlertTriangle,
  Check, Crosshair, Wifi, WifiOff, Menu, X,
} from 'lucide-react';

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  updateRideStatus,
  fetchRideLive,
  fetchRideTracking,
  recordMilestone,
  socketLiveUpdate,
  socketRideAssigned,
  socketDriverAccepted,
  socketDriverEnRoute,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketAtStop,
  socketRideResumed,
  socketRideCompleted,
  socketRideCancelled,
  socketEtaUpdated,
  socketMilestoneReceived,
  socketTrackingSnapshot,
} from '@/store/slices/rideRequestSlice';

import {
  emitDriverLocation,
  emitSoloLocation,
  liveLocationUpdated,
} from '@/store/slices/operationsSlice';

import { fetchDriverMe } from '@/store/slices/transportPartnerSlice';
import { useSocket } from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
const LIBRARIES        = ['geometry', 'places'];
const EMIT_THROTTLE_MS = 2000;
const DIR_DEBOUNCE_MS  = 4000;   // ← fix: longer debounce stops direction loop
const DIR_DIST_THRESH  = 0.05;   // km — only refetch if moved > 50 m

const ACTIVE_STATUSES = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived',  'otp_verified',    'in_progress', 'at_stop',
];

// ─────────────────────────────────────────────────────────────────────────────
// MAP STYLE  — clean light Uber-style
// ─────────────────────────────────────────────────────────────────────────────

const MAP_STYLE = [
  { elementType: 'geometry',                       stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon',                    stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',               stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke',             stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road',        elementType: 'geometry',         stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',        elementType: 'geometry.stroke',  stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road',        elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road.highway',elementType: 'geometry',         stylers: [{ color: '#f9e0b0' }] },
  { featureType: 'road.highway',elementType: 'geometry.stroke',  stylers: [{ color: '#f0c060' }] },
  { featureType: 'poi',         elementType: 'geometry',         stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi.park',    elementType: 'geometry',         stylers: [{ color: '#d5e8d4' }] },
  { featureType: 'poi.park',    elementType: 'labels.text.fill', stylers: [{ color: '#64a060' }] },
  { featureType: 'water',       elementType: 'geometry',         stylers: [{ color: '#cde8f5' }] },
  { featureType: 'water',       elementType: 'labels.text.fill', stylers: [{ color: '#6db5d8' }] },
  { featureType: 'transit',                                       stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape',   elementType: 'geometry',         stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative', elementType: 'geometry',      stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  searching:        { label: 'Searching',     cssClass: 'badge-warning',   icon: RotateCcw,   routeColor: '#f59e0b' },
  driver_assigned:  { label: 'Assigned',      cssClass: 'badge-accent',    icon: Car,         routeColor: '#f59e0b' },
  driver_accepted:  { label: 'Accepted',      cssClass: 'badge-info',      icon: CheckCircle, routeColor: '#3b82f6' },
  driver_en_route:  { label: 'En Route',      cssClass: 'badge-secondary', icon: Navigation,  routeColor: '#6366f1' },
  driver_arrived:   { label: 'Arrived',       cssClass: 'badge-success',   icon: MapPin,      routeColor: '#22c55e' },
  otp_verified:     { label: 'OTP Verified',  cssClass: 'badge-success',   icon: Shield,      routeColor: '#22c55e' },
  in_progress:      { label: 'In Progress',   cssClass: 'badge-success',   icon: Play,        routeColor: '#22c55e' },
  at_stop:          { label: 'At Stop',       cssClass: 'badge-warning',   icon: StopCircle,  routeColor: '#f97316' },
  completed:        { label: 'Completed',     cssClass: 'badge-success',   icon: CheckCircle, routeColor: '#22c55e' },
  cancelled:        { label: 'Cancelled',     cssClass: 'badge-error',     icon: XCircle,     routeColor: '#ef4444' },
  no_driver_found:  { label: 'No Driver',     cssClass: 'badge-error',     icon: AlertCircle, routeColor: '#6b7280' },
};

const ACTION_MAP = {
  driver_assigned: [
    { action: 'accept',      label: 'Accept Ride',        icon: CheckCircle, primary: true,  color: 'success' },
    { action: 'cancel',      label: 'Decline',            icon: XCircle,     primary: false, color: 'error'   },
  ],
  driver_accepted: [
    { action: 'start_route', label: 'Navigate to Pickup', icon: Navigation,  primary: true,  color: 'info'    },
  ],
  driver_en_route: [
    { action: 'arrived',     label: 'I Have Arrived',     icon: MapPin,      primary: true,  color: 'success' },
  ],
  driver_arrived:  [],
  otp_verified: [
    { action: 'start_ride',  label: 'Start Ride',         icon: Play,        primary: true,  color: 'success' },
  ],
  in_progress: [
    { action: 'complete',    label: 'Complete Ride',      icon: Flag,        primary: true,  color: 'success' },
    { action: 'at_stop',     label: 'At Stop',            icon: StopCircle,  primary: false, color: 'warning' },
  ],
  at_stop: [
    { action: 'resume',      label: 'Resume Ride',        icon: Play,        primary: true,  color: 'info'    },
    { action: 'complete',    label: 'Complete Ride',      icon: Flag,        primary: false, color: 'success' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const [lng1, lat1] = Array.isArray(a) ? a : [a.lng ?? 0, a.lat ?? 0];
  const [lng2, lat2] = Array.isArray(b) ? b : [b.lng ?? 0, b.lat ?? 0];
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const fmtDuration = (sec) => {
  if (!sec && sec !== 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtEta = (min) => {
  if (min == null) return '--';
  if (min < 1)    return '< 1 min';
  if (min >= 60)  { const h = Math.floor(min / 60); const r = min % 60; return r ? `${h}h ${r}m` : `${h}h`; }
  return `${Math.ceil(min)} min`;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAP ICON BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const buildCarIcon = (heading = 0, color = '#1a1a2e') => {
  if (typeof window === 'undefined' || !window.google) return null;
  return {
    path: 'M23.5 7h-1.086a7.217 7.217 0 0 0-14.828 0H6.5A2.5 2.5 0 0 0 4 9.5v1A2.5 2.5 0 0 0 6.5 13H7v5.5A1.5 1.5 0 0 0 8.5 20h1A1.5 1.5 0 0 0 11 18.5V18h8v.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5V13h.5a2.5 2.5 0 0 0 2.5-2.5v-1A2.5 2.5 0 0 0 23.5 7zM10 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm10 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM15 3a5.2 5.2 0 0 1 5.15 4H9.85A5.2 5.2 0 0 1 15 3z',
    fillColor:   color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    rotation:    heading,
    scale:       1.2,
    anchor:      new window.google.maps.Point(15, 12),
  };
};

const buildPinIcon = (color = '#22c55e') => {
  if (typeof window === 'undefined' || !window.google) return null;
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor:   color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
    scale:       1.8,
    anchor:      new window.google.maps.Point(12, 22),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveTracking() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();
  const { socket, joinBookingRoom, leaveBookingRoom, requestBookingState } = useSocket();

  const rideId = params?.rideId || params?.id;

  // ── Redux ──────────────────────────────────────────────────────────────────
  const live            = useSelector((s) => s.rideRequest?.live);
  const tracking        = useSelector((s) => s.rideRequest?.tracking);
  const loadingFlags    = useSelector((s) => s.rideRequest?.loading ?? {});
  const socketConnected = useSelector((s) => s.operations?.socket?.connected ?? false);
  const user            = useSelector((s) => s.auth?.user);
  const driverProfile   = useSelector((s) => s.transportPartner?.driverMe ?? null);

  // ── Map state ──────────────────────────────────────────────────────────────
  const [mapLoaded,     setMapLoaded]     = useState(false);
  const [driverPos,     setDriverPos]     = useState(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [driverSpeed,   setDriverSpeed]   = useState(0);
  const [directions,    setDirections]    = useState(null);
  const [routePhase,    setRoutePhase]    = useState('to_pickup');
  const [breadcrumbs,   setBreadcrumbs]   = useState([]);
  const [followDriver,  setFollowDriver]  = useState(true);

  const [carIcon,     setCarIcon]     = useState(null);
  const [pickupIcon,  setPickupIcon]  = useState(null);
  const [dropoffIcon, setDropoffIcon] = useState(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [otpDigits,     setOtpDigits]     = useState(['', '', '', '', '', '']);
  const [otpError,      setOtpError]      = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [toastState,    setToastState]    = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);

  // ── Ride progress ──────────────────────────────────────────────────────────
  const [elapsedSec,    setElapsedSec]    = useState(0);
  const [rideStartTime, setRideStartTime] = useState(null);
  const [distTravelled, setDistTravelled] = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mapRef           = useRef(null);
  const timerRef         = useRef(null);
  const watchIdRef       = useRef(null);
  const lastEmitRef      = useRef(0);
  const dirTimerRef      = useRef(null);
  const lastDirPosRef    = useRef(null);   // ← fix direction loop: track last pos used
  const dirFetchingRef   = useRef(false);  // ← fix: prevent concurrent fetches
  const otpRefs          = useRef([]);

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────────────────────────────────────

  const rideStatus  = live?.status ?? 'searching';
  const cfg         = STATUS_CFG[rideStatus] ?? STATUS_CFG.searching;
  const actionBtns  = ACTION_MAP[rideStatus] ?? [];
  const isActive    = ACTIVE_STATUSES.includes(rideStatus);
  const isSolo      = user?.role === 'solodriverpartner';
  const isDriver    = ['driver', 'solodriverpartner'].includes(user?.role);
  const isCompleted = rideStatus === 'completed';
  const isCancelled = rideStatus === 'cancelled';

  const pickupCoord  = live?.pickup?.lat  != null ? { lat: live.pickup.lat,  lng: live.pickup.lng  } : null;
  const dropoffCoord = live?.dropoff?.lat != null ? { lat: live.dropoff.lat, lng: live.dropoff.lng } : null;

  const bookingId    = live?.socketHint?.room?.replace('booking:', '') ?? null;
  const etaMin       = live?.currentEtaMinutes ?? tracking?.tracking?.currentEtaMinutes ?? null;
  const rideCode     = live?.rideId ?? rideId ?? '';
  const pickupLabel  = live?.pickup?.label  ?? live?.pickup?.address  ?? 'Pickup';
  const dropoffLabel = live?.dropoff?.label ?? live?.dropoff?.address ?? 'Drop-off';

  const driverSnap  = driverProfile ?? live?.driverSnapshot ?? tracking?.ride?.driverSnapshot ?? null;
  const vehicleSnap = driverProfile?.assignedVehicleSnapshot ?? live?.vehicleSnapshot ?? tracking?.ride?.vehicleSnapshot ?? null;

  const distKm = useMemo(() => {
    if (tracking?.ride?.estimatedDistanceKm) return +tracking.ride.estimatedDistanceKm;
    if (pickupCoord && dropoffCoord)
      return haversineKm([pickupCoord.lng, pickupCoord.lat], [dropoffCoord.lng, dropoffCoord.lat]);
    return 0;
  }, [tracking, pickupCoord, dropoffCoord]);

  const remainingKm = useMemo(() => {
    if (!driverPos) return distKm;
    const target = routePhase === 'to_dropoff' ? dropoffCoord : pickupCoord;
    if (!target) return 0;
    return haversineKm([driverPos.lng, driverPos.lat], [target.lng, target.lat]);
  }, [driverPos, routePhase, pickupCoord, dropoffCoord, distKm]);

  const routeLineColor = routePhase === 'to_dropoff' ? '#22c55e' : '#3b82f6';

  // ─────────────────────────────────────────────────────────────────────────
  // GOOGLE MAPS LOADER
  // ─────────────────────────────────────────────────────────────────────────

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries:        LIBRARIES,
  });

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    setPickupIcon(buildPinIcon('#22c55e'));
    setDropoffIcon(buildPinIcon('#ef4444'));
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    setCarIcon(buildCarIcon(driverHeading, '#1a1a2e'));
  }, [isLoaded, driverHeading]);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH DRIVER PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isDriver) dispatch(fetchDriverMe());
  }, [isDriver, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH RIDE DATA
  // ─────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!rideId) return;
    await Promise.all([
      dispatch(fetchRideLive(rideId)),
      dispatch(fetchRideTracking({ rideId, breadcrumbs: 300 })),
    ]);
  }, [rideId, dispatch]);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => { if (!socketConnected) fetchData(); }, 15000);
    return () => clearInterval(id);
  }, [fetchData, socketConnected]);

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET — JOIN ROOM
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !bookingId) return;
    joinBookingRoom(bookingId);
    requestBookingState(bookingId);
    return () => leaveBookingRoom(bookingId);
  }, [socket, bookingId, joinBookingRoom, leaveBookingRoom, requestBookingState]);

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET — EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;
    const on  = (ev, fn) => socket.on(ev, fn);
    const off = (ev, fn) => socket.off(ev, fn);

    const onLocation = (payload) => {
      dispatch(liveLocationUpdated(payload));
      dispatch(socketLiveUpdate(payload));
      if (!isDriver && payload.lat != null && payload.lng != null) {
        setDriverPos({ lat: payload.lat, lng: payload.lng });
        setDriverHeading(payload.heading ?? 0);
        setDriverSpeed(payload.speed ?? 0);
        if (followDriver && mapRef.current) {
          mapRef.current.panTo({ lat: payload.lat, lng: payload.lng });
        }
      }
    };

    const onRideAssigned   = (p) => { dispatch(socketRideAssigned(p));   showToast('Driver found!', 'success');              fetchData(); };
    const onDriverAccepted = (p) => { dispatch(socketDriverAccepted(p)); showToast('Driver accepted.', 'success');           fetchData(); };
    const onDriverEnRoute  = (p) => { dispatch(socketDriverEnRoute(p));  showToast('Driver on the way.', 'info');            fetchData(); };
    const onDriverArrived  = (p) => { dispatch(socketDriverArrived(p));  showToast('Driver arrived! Share OTP.', 'warning'); fetchData(); };
    const onOtpVerified    = (p) => { dispatch(socketOtpVerified(p));    showToast('OTP verified!', 'success');              fetchData(); };
    const onRideStarted    = (p) => { dispatch(socketRideStarted(p));    showToast('Ride started.', 'success'); setRideStartTime(Date.now()); fetchData(); };
    const onAtStop         = (p) => { dispatch(socketAtStop(p));         showToast('At waypoint.', 'info');                  fetchData(); };
    const onRideResumed    = (p) => { dispatch(socketRideResumed(p));    fetchData(); };
    const onRideCompleted  = (p) => { dispatch(socketRideCompleted(p));  showToast('Ride completed!', 'success');            fetchData(); };
    const onRideCancelled  = (p) => { dispatch(socketRideCancelled(p)); showToast(`Ride cancelled${p?.cancelReason ? ': ' + p.cancelReason : ''}.`, 'error'); fetchData(); };
    const onEtaUpdated     = (p) => dispatch(socketEtaUpdated(p));
    const onMilestone      = (p) => dispatch(socketMilestoneReceived(p));
    const onSnapshot       = (p) => dispatch(socketTrackingSnapshot(p));
    const onOtpResend      = ()  => showToast('Customer requests OTP resend.', 'warning');

    on('location_update',        onLocation);
    on('ride_assigned',          onRideAssigned);
    on('driver_accepted',        onDriverAccepted);
    on('driver_en_route',        onDriverEnRoute);
    on('driver_arrived',         onDriverArrived);
    on('otp_verified',           onOtpVerified);
    on('ride_started',           onRideStarted);
    on('at_stop',                onAtStop);
    on('ride_resumed',           onRideResumed);
    on('ride_completed',         onRideCompleted);
    on('ride_cancelled',         onRideCancelled);
    on('eta_updated',            onEtaUpdated);
    on('milestone_recorded',     onMilestone);
    on('booking_state_snapshot', onSnapshot);
    on('otp_resend_requested',   onOtpResend);

    return () => {
      off('location_update',        onLocation);
      off('ride_assigned',          onRideAssigned);
      off('driver_accepted',        onDriverAccepted);
      off('driver_en_route',        onDriverEnRoute);
      off('driver_arrived',         onDriverArrived);
      off('otp_verified',           onOtpVerified);
      off('ride_started',           onRideStarted);
      off('at_stop',                onAtStop);
      off('ride_resumed',           onRideResumed);
      off('ride_completed',         onRideCompleted);
      off('ride_cancelled',         onRideCancelled);
      off('eta_updated',            onEtaUpdated);
      off('milestone_recorded',     onMilestone);
      off('booking_state_snapshot', onSnapshot);
      off('otp_resend_requested',   onOtpResend);
    };
  }, [socket, isDriver, followDriver, dispatch, fetchData]);

  // ─────────────────────────────────────────────────────────────────────────
  // GPS — DRIVER LOCATION EMIT
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || !isDriver || !rideId || typeof navigator === 'undefined') return;
    let prevPos = null;

    const handlePos = (pos) => {
      const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
      const kmh = speed ? speed * 3.6 : 0;
      const deg = heading ?? 0;

      setDriverPos({ lat, lng });
      setDriverHeading(deg);
      setDriverSpeed(kmh);

      if (prevPos) {
        const km = haversineKm([prevPos.lng, prevPos.lat], [lng, lat]);
        if (km > 0.001 && km < 1) setDistTravelled((d) => +(d + km).toFixed(3));
      }
      prevPos = { lat, lng };
      setBreadcrumbs((prev) => [...prev, { lat, lng }].slice(-400));

      const now = Date.now();
      if (now - lastEmitRef.current >= EMIT_THROTTLE_MS) {
        lastEmitRef.current = now;
        const payload = { socket, lat, lng, heading: deg, speed: kmh, bookingId };
        if (isSolo) dispatch(emitSoloLocation(payload));
        else        dispatch(emitDriverLocation(payload));
      }

      if (followDriver && mapRef.current) mapRef.current.panTo({ lat, lng });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePos,
      (err) => console.error('[GPS]', err.message),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, isDriver, rideId, bookingId, isSolo, followDriver, socket, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC DRIVER POS FROM REDUX
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const ll = live?.liveLocation;
    if (!ll?.lat || !ll?.lng) return;
    if (!isDriver || !driverPos) {
      setDriverPos({ lat: ll.lat, lng: ll.lng });
      setDriverHeading(ll.heading  ?? 0);
      setDriverSpeed(ll.speedKmh   ?? 0);
    }
  }, [live?.liveLocation]);

  // ─────────────────────────────────────────────────────────────────────────
  // ROUTE PHASE
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (['otp_verified', 'in_progress', 'at_stop'].includes(rideStatus)) {
      setRoutePhase('to_dropoff');
    } else if (ACTIVE_STATUSES.slice(0, 4).includes(rideStatus)) {
      setRoutePhase('to_pickup');
    }
  }, [rideStatus]);

  // ─────────────────────────────────────────────────────────────────────────
  // DIRECTIONS API  —  FIX: debounce + distance threshold + single-fetch guard
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded || !window.google || !driverPos) return;

    const destination = routePhase === 'to_dropoff' ? dropoffCoord : pickupCoord;
    if (!destination) { setDirections(null); return; }

    // Only re-fetch if driver moved > DIR_DIST_THRESH km from last used pos
    if (lastDirPosRef.current) {
      const moved = haversineKm(lastDirPosRef.current, driverPos);
      if (moved < DIR_DIST_THRESH) return;   // ← key fix: skip if barely moved
    }

    if (dirTimerRef.current) clearTimeout(dirTimerRef.current);

    dirTimerRef.current = setTimeout(() => {
      if (dirFetchingRef.current) return;    // ← key fix: prevent concurrent
      dirFetchingRef.current = true;

      new window.google.maps.DirectionsService().route(
        {
          origin:      { lat: driverPos.lat, lng: driverPos.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode:  window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          dirFetchingRef.current = false;
          if (status === 'OK') {
            setDirections(result);
            lastDirPosRef.current = { ...driverPos };
          }
        }
      );
    }, DIR_DEBOUNCE_MS);

    return () => {
      if (dirTimerRef.current) clearTimeout(dirTimerRef.current);
    };
  }, [isLoaded, driverPos?.lat, driverPos?.lng, routePhase, pickupCoord, dropoffCoord]);

  // ─────────────────────────────────────────────────────────────────────────
  // RESET DIRECTION CACHE WHEN PHASE CHANGES
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    lastDirPosRef.current = null;
    setDirections(null);
  }, [routePhase]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-FIT MAP
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded || !mapLoaded || !mapRef.current || !window.google) return;
    const pts = [driverPos, pickupCoord, dropoffCoord].filter(Boolean);
    if (pts.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, { top: 80, bottom: 120, left: 40, right: 40 });
  }, [isLoaded, mapLoaded, pickupCoord?.lat, dropoffCoord?.lat]);

  // ─────────────────────────────────────────────────────────────────────────
  // RIDE TIMER
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (rideStatus === 'in_progress' && !rideStartTime) setRideStartTime(Date.now());
    if (['completed', 'cancelled'].includes(rideStatus) && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [rideStatus]);

  useEffect(() => {
    if (!rideStartTime) return;
    timerRef.current = setInterval(
      () => setElapsedSec(Math.floor((Date.now() - rideStartTime) / 1000)), 1000
    );
    return () => clearInterval(timerRef.current);
  }, [rideStartTime]);

  // ─────────────────────────────────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────────────────────────────────

  const showToast = useCallback((message, type = 'success') => {
    setToastState({ message, type, id: Date.now() });
    setTimeout(() => setToastState(null), 4000);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  const handleAction = useCallback(async (action, extra = {}) => {
    if (actionLoading) return;
    setActionLoading(true);
    setOtpError('');
    try {
      const res = await dispatch(updateRideStatus({ rideId, action, ...extra })).unwrap();
      showToast(res?.message ?? 'Done.', 'success');
      await fetchData();
      if (action === 'start_ride') setRideStartTime(Date.now());
      if (['complete', 'cancel'].includes(action)) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message ?? 'Action failed');
      if (action === 'verify_otp') setOtpError(msg);
      else showToast(msg, 'error');
    } finally {
      setActionLoading(false);
      setCancelConfirm(false);
    }
  }, [rideId, actionLoading, dispatch, fetchData, showToast]);

  // ─────────────────────────────────────────────────────────────────────────
  // OTP
  // ─────────────────────────────────────────────────────────────────────────

  const handleOtpChange = useCallback((i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => { const n = [...prev]; n[i] = digit; return n; });
    setOtpError('');
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }, []);

  const handleOtpKeyDown = useCallback((i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }, [otpDigits]);

  const handleOtpSubmit = useCallback(() => {
    const otp = otpDigits.join('');
    if (otp.length < 4) { setOtpError('Enter at least 4 digits'); return; }
    handleAction('verify_otp', { otp });
  }, [otpDigits, handleAction]);

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH / MAP CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    showToast('Refreshed', 'success');
  }, [fetchData, showToast]);

  const onMapLoad     = useCallback((map) => { mapRef.current = map; setMapLoaded(true); }, []);
  const onMapDragStart = useCallback(() => setFollowDriver(false), []);
  const recenter      = useCallback(() => {
    setFollowDriver(true);
    if (driverPos && mapRef.current) { mapRef.current.panTo(driverPos); mapRef.current.setZoom(16); }
  }, [driverPos]);

  // ─────────────────────────────────────────────────────────────────────────
  // BREADCRUMB PATH
  // ─────────────────────────────────────────────────────────────────────────

  const crumbPath = useMemo(() => {
    const server = (tracking?.tracking?.breadcrumbs ?? [])
      .map((b) => ({ lat: b.coordinates?.[1], lng: b.coordinates?.[0] }))
      .filter((b) => b.lat && b.lng);
    return [...server, ...breadcrumbs].slice(-400);
  }, [tracking?.tracking?.breadcrumbs, breadcrumbs]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const statusHeading = {
    in_progress:     'Ride In Progress',
    driver_arrived:  'At Pickup',
    driver_en_route: 'Heading to Pickup',
    driver_assigned: 'New Ride Assigned',
    driver_accepted: 'Navigate to Pickup',
    otp_verified:    'OTP Verified',
    at_stop:         'At Waypoint',
    completed:       'Ride Completed',
    cancelled:       'Ride Cancelled',
  }[rideStatus] ?? 'Connecting…';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — LOAD ERROR
  // ─────────────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-base-200">
        <div className="text-center px-6">
          <div className="w-14 h-14 rounded-full bg-error/10 border border-error/30
                          flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-error" />
          </div>
          <p className="text-base font-bold text-base-content mb-1">Maps failed to load</p>
          <p className="text-xs text-base-content/50">Check API key or network.</p>
          <button onClick={() => window.location.reload()} className="btn btn-error btn-sm mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme={isSolo ? 'solodriverpartner' : 'driver'}
      className="relative w-full overflow-hidden bg-base-100 select-none"
      style={{ height: '100dvh', fontFamily: 'var(--font-family-poppins)' }}
    >

      {/* ══════════════════════════════════════════════════════
          GOOGLE MAP  — full screen
          ══════════════════════════════════════════════════════ */}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          center={driverPos ?? { lat: 16.506, lng: 80.648 }}
          zoom={15}
          options={{
            styles:            MAP_STYLE,
            disableDefaultUI:  true,
            gestureHandling:   'greedy',
            clickableIcons:    false,
            zoomControl:       false,
            fullscreenControl: false,
          }}
          onLoad={onMapLoad}
          onDragStart={onMapDragStart}
        >
          {/* Route */}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor:   routeLineColor,
                  strokeOpacity: 0.9,
                  strokeWeight:  6,
                  zIndex:        5,
                },
              }}
            />
          )}

          {/* Breadcrumb trail */}
          {crumbPath.length > 1 && (
            <Polyline
              path={crumbPath}
              options={{
                strokeColor:   '#6366f1',
                strokeOpacity: 0.35,
                strokeWeight:  3,
                zIndex:        4,
              }}
            />
          )}

          {/* Driver */}
          {driverPos && carIcon && (
            <Marker position={driverPos} icon={carIcon} zIndex={20} title="Vehicle" />
          )}

          {/* Pickup */}
          {pickupCoord && pickupIcon && routePhase !== 'to_dropoff' && (
            <>
              <Marker position={pickupCoord} icon={pickupIcon} zIndex={10} title="Pickup" />
              {rideStatus === 'driver_arrived' && (
                <Circle
                  center={pickupCoord}
                  radius={70}
                  options={{
                    fillColor: '#22c55e', fillOpacity: 0.1,
                    strokeColor: '#22c55e', strokeOpacity: 0.4, strokeWeight: 1.5,
                  }}
                />
              )}
              <OverlayView position={pickupCoord} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="absolute -translate-x-1/2 -translate-y-12 pointer-events-none">
                  <span className="badge badge-success text-[9px] shadow-lg whitespace-nowrap max-w-[110px] truncate">
                    📍 {pickupLabel}
                  </span>
                </div>
              </OverlayView>
            </>
          )}

          {/* Dropoff */}
          {dropoffCoord && dropoffIcon && (
            <>
              <Marker position={dropoffCoord} icon={dropoffIcon} zIndex={10} title="Drop-off" />
              <OverlayView position={dropoffCoord} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div className="absolute -translate-x-1/2 -translate-y-12 pointer-events-none">
                  <span className="badge badge-error text-[9px] shadow-lg whitespace-nowrap max-w-[110px] truncate">
                    🏁 {dropoffLabel}
                  </span>
                </div>
              </OverlayView>
            </>
          )}
        </GoogleMap>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-base-200 gap-3">
          <div className="loading loading-lg loading-spinner" />
          <p className="text-xs text-base-content/40">Loading map…</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TOP BAR  — back + status + wifi + refresh
          ══════════════════════════════════════════════════════ */}
      <div
        className="absolute top-0 left-0 right-0 z-30 px-3 pt-3 pb-2 flex items-center gap-2"
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.96) 0%,rgba(255,255,255,0.82) 70%,transparent 100%)' }}
      >
        {/* Back */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="btn btn-ghost btn-circle bg-base-100 border border-base-300 flex-shrink-0"
          style={{ width: 36, height: 36 }}
        >
          <ChevronLeft className="w-4 h-4 text-base-content/70" />
        </motion.button>

        {/* Status */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <AnimatePresence mode="wait">
            <motion.span
              key={rideStatus}
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0,  scale: 1   }}
              exit={{    opacity: 0, y:  6, scale: 0.9  }}
              className={`badge badge-sm ${cfg.cssClass}`}
              style={{ fontSize: '0.65rem' }}
            >
              {React.createElement(cfg.icon, { className: 'w-2.5 h-2.5' })}
              {cfg.label}
            </motion.span>
          </AnimatePresence>
          <span className="text-[10px] text-base-content/30 font-mono truncate">
            #{String(rideCode).slice(-8).toUpperCase()}
          </span>
        </div>

        {/* Wifi */}
        {socketConnected
          ? <Wifi    className="w-3.5 h-3.5 text-success flex-shrink-0" />
          : <WifiOff className="w-3.5 h-3.5 text-error flex-shrink-0" />}

        {/* Refresh */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleRefresh}
          className="btn btn-ghost btn-circle bg-base-100 border border-base-300 flex-shrink-0"
          style={{ width: 36, height: 36 }}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-base-content/40 ${refreshing ? 'animate-spin' : ''}`} />
        </motion.button>

        {/* Menu — open panel */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setPanelOpen(true)}
          className="btn btn-ghost btn-circle bg-base-100 border border-base-300 flex-shrink-0"
          style={{ width: 36, height: 36 }}
        >
          <Menu className="w-4 h-4 text-base-content/70" />
        </motion.button>
      </div>

      {/* ══════════════════════════════════════════════════════
          FLOATING HUD  — timer, km done, remaining km, speed
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0   }}
            exit={{    opacity: 0, y: -16  }}
            className="absolute top-16 left-3 right-3 z-20 flex gap-2"
          >
            {/* ETA + remaining km pill */}
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl border border-base-300"
              style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
            >
              <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0" />
              <span className="text-xs font-bold text-base-content">{fmtEta(etaMin)}</span>
              <div className="w-px h-3 bg-base-300" />
              <Route className="w-3.5 h-3.5 text-info flex-shrink-0" />
              <span className="text-xs font-bold text-base-content">{remainingKm.toFixed(1)} km</span>
              <div className="w-px h-3 bg-base-300" />
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: routeLineColor }} />
              <span className="text-[10px] text-base-content/40 truncate">
                {routePhase === 'to_dropoff' ? 'to drop' : 'to pickup'}
              </span>
            </div>

            {/* Speed + elapsed when in_progress */}
            <AnimatePresence>
              {rideStatus === 'in_progress' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0  }}
                  exit={{    opacity: 0, x: 20  }}
                  className="flex flex-col gap-1"
                >
                  <HudChip
                    value={`${Math.round(driverSpeed)}`}
                    unit="km/h"
                    accent="var(--warning)"
                  />
                  <HudChip
                    value={fmtDuration(elapsedSec)}
                    unit="time"
                    accent="var(--secondary)"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          RECENTER  — only when user dragged map
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {!followDriver && driverPos && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1   }}
            exit={{    opacity: 0, scale: 0.7  }}
            whileTap={{ scale: 0.88 }}
            onClick={recenter}
            className="absolute right-3 z-20 border border-info/40 text-info shadow-depth"
            style={{
              bottom: 28,
              width: 40, height: 40,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Crosshair className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          BOTTOM ACTION STRIP  — primary action always visible
          ══════════════════════════════════════════════════════ */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-4 pt-3"
        style={{
          background: 'linear-gradient(0deg,rgba(255,255,255,1) 60%,rgba(255,255,255,0) 100%)',
        }}
      >
        {/* OTP panel inline (driver_arrived) */}
        <AnimatePresence>
          {rideStatus === 'driver_arrived' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0  }}
              exit={{    opacity: 0, y: 16  }}
              className="mb-3 rounded-2xl p-3 border border-success/30 bg-success/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-xs font-bold text-success">Enter Passenger OTP</span>
              </div>
              <div className="flex gap-1.5 justify-center mb-2">
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="input-field text-center font-black p-0"
                    style={{
                      width: 40, height: 48,
                      fontSize: '1.25rem',
                      borderColor: d ? 'var(--success)' : undefined,
                    }}
                  />
                ))}
              </div>
              {otpError && (
                <p className="text-error text-[10px] flex items-center gap-1 mb-2">
                  <AlertCircle className="w-3 h-3" />{otpError}
                </p>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleOtpSubmit}
                disabled={actionLoading || otpDigits.join('').length < 4}
                className="btn btn-success w-full"
                style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Verify OTP
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {actionBtns.length > 0 && (
          <div className={`grid gap-2 ${actionBtns.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {actionBtns.map((btn) => {
              if (btn.action === 'cancel' && !cancelConfirm) {
                return (
                  <motion.button
                    key={btn.action}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCancelConfirm(true)}
                    disabled={actionLoading}
                    className="btn btn-outline border-error/40 text-error bg-error/5"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                  >
                    {React.createElement(btn.icon, { className: 'w-4 h-4' })}
                    {btn.label}
                  </motion.button>
                );
              }
              return (
                <motion.button
                  key={btn.action}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAction(btn.action)}
                  disabled={actionLoading}
                  className={btn.primary ? 'btn btn-primary-cta w-full' : 'btn btn-outline w-full'}
                  style={{
                    fontSize: '0.8rem', padding: '0.55rem 1rem',
                    ...(btn.primary ? {
                      background: `var(--${btn.color})`,
                      color: `var(--${btn.color}-content)`,
                      border: 'none',
                      boxShadow: `0 4px 16px color-mix(in srgb, var(--${btn.color}), transparent 60%)`,
                    } : {
                      borderColor: `color-mix(in srgb, var(--${btn.color}), transparent 40%)`,
                      color: `var(--${btn.color})`,
                      background: `color-mix(in srgb, var(--${btn.color}), transparent 90%)`,
                    }),
                  }}
                >
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : React.createElement(btn.icon, { className: 'w-4 h-4' })}
                  {btn.label}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Cancel confirm */}
        <AnimatePresence>
          {cancelConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: 8 }}
              className="mt-2 rounded-2xl bg-error/5 border border-error/30 p-3"
            >
              <p className="text-xs font-bold text-error mb-0.5">Cancel this ride?</p>
              <p className="text-[10px] text-base-content/40 mb-2">This cannot be undone.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction('cancel', { cancelReason: 'cancelled_by_driver' })}
                  disabled={actionLoading}
                  className="btn btn-error"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Cancel'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="btn btn-ghost border border-base-300"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                >
                  Keep Ride
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completed card */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1    }}
              className="rounded-2xl bg-success/5 border border-success/30 p-4 text-center"
            >
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="text-base font-black text-base-content" style={{ fontFamily: 'var(--font-family-montserrat)' }}>
                Ride Completed!
              </p>
              <p className="text-[11px] text-base-content/40 mt-0.5">
                {distTravelled > 0 ? `${distTravelled.toFixed(2)} km · ${fmtDuration(elapsedSec)}` : `${distKm.toFixed(1)} km total`}
              </p>
              <button
                onClick={() => router.push('/driver/dashboard')}
                className="btn btn-success w-full mt-3"
                style={{ fontSize: '0.8rem' }}
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════
          SLIDE-UP DETAIL PANEL  (opened via Menu icon)
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{    opacity: 0 }}
              className="absolute inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
              onClick={() => setPanelOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0       }}
              exit={{    y: '100%'  }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
              style={{
                maxHeight: '82dvh',
                background: 'var(--base-100)',
                border: '1px solid var(--base-300)',
                borderBottom: 'none',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
              }}
            >
              {/* Handle + close */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex-1" />
                <div className="w-8 h-1 rounded-full bg-base-300 mx-auto" />
                <div className="flex-1 flex justify-end">
                  <button
                    onClick={() => setPanelOpen(false)}
                    className="btn btn-ghost btn-xs btn-circle text-base-content/40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div
                className="overflow-y-auto px-4 pb-8 space-y-3 scrollbar-thin"
                style={{ maxHeight: 'calc(82dvh - 48px)' }}
              >
                {/* Header */}
                <div>
                  <h2
                    className="text-lg font-black text-base-content leading-tight"
                    style={{ fontFamily: 'var(--font-family-montserrat)', fontSize: 'clamp(1rem,4vw,1.25rem)' }}
                  >
                    {statusHeading}
                  </h2>
                  <p className="text-[10px] text-base-content/30 font-mono mt-0.5">
                    #{String(rideCode).toUpperCase()}
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat icon={<Route  className="w-3.5 h-3.5" />} value={`${distKm.toFixed(1)} km`} label="Distance" color="var(--info)"      />
                  <MiniStat icon={<Clock  className="w-3.5 h-3.5" />} value={fmtEta(etaMin)}             label="ETA"      color="var(--warning)"    />
                  <MiniStat icon={<Gauge  className="w-3.5 h-3.5" />}
                    value={rideStatus === 'in_progress' ? `${Math.round(driverSpeed)}` : '--'}
                    label={rideStatus === 'in_progress' ? 'km/h' : 'Speed'}
                    color="var(--secondary)"
                  />
                </div>

                {/* Driver + vehicle */}
                {(driverSnap || vehicleSnap) && (
                  <div
                    className="card p-3"
                    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)', border: '1px solid color-mix(in srgb, var(--primary), transparent 70%)' }}
                      >
                        <Car className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {(driverSnap?.legalName || driverSnap?.driverCode) && (
                          <p className="text-xs font-semibold text-base-content truncate">
                            {driverSnap?.legalName ?? driverSnap?.driverCode}
                          </p>
                        )}
                        {vehicleSnap && (
                          <p className="text-[10px] text-base-content/50 truncate mt-0.5">
                            {[vehicleSnap.make, vehicleSnap.model, vehicleSnap.color].filter(Boolean).join(' · ')}
                            {vehicleSnap.registrationNumber ? ` · ${vehicleSnap.registrationNumber}` : ''}
                          </p>
                        )}
                        {(driverSnap?.performance?.rating || driverSnap?.rating) > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="w-3 h-3 text-warning fill-warning" />
                            <span className="text-[10px] text-warning font-bold">
                              {Number(driverSnap?.performance?.rating ?? driverSnap?.rating).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      {driverSnap?.phone && (
                        <a
                          href={`tel:${driverSnap.phone}`}
                          className="btn btn-circle btn-sm"
                          style={{ background: 'color-mix(in srgb, var(--success), transparent 88%)', border: '1px solid color-mix(in srgb, var(--success), transparent 60%)', color: 'var(--success)' }}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Route */}
                <div
                  className="card p-3"
                  style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-success ring-2 ring-success/20" />
                      <div className="w-px flex-1 bg-base-300" style={{ minHeight: 18 }} />
                      <div className="w-2 h-2 rounded-full bg-error ring-2 ring-error/20" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <p className="text-[9px] text-base-content/30 font-bold uppercase tracking-wider">Pickup</p>
                        <p className="text-xs text-base-content font-medium truncate mt-0.5">{pickupLabel}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-base-content/30 font-bold uppercase tracking-wider">Drop-off</p>
                        <p className="text-xs text-base-content font-medium truncate mt-0.5">{dropoffLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fare */}
                <div
                  className="card p-3"
                  style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                >
                  <p className="text-[9px] text-base-content/30 font-bold uppercase tracking-widest mb-2">Fare</p>
                  <FareRow label="Total distance" value={`${distKm.toFixed(2)} km`} />
                  <FareRow label="Rate / km"      value={`₹${tracking?.ride?.fare?.ratePerKm ?? '21'}`} />
                  <FareRow
                    label="Estimated fare"
                    value={`₹${tracking?.ride?.fare?.totalFare ?? live?.transportFee ?? Math.round(distKm * (tracking?.ride?.fare?.ratePerKm || 21))}`}
                    bold
                  />
                  {distTravelled > 0 && <FareRow label="Distance covered" value={`${distTravelled.toFixed(2)} km`} />}
                </div>

                {/* Timeline */}
                {(tracking?.tracking?.milestones?.length ?? 0) > 0 && (
                  <div
                    className="card p-3"
                    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                  >
                    <p className="text-[9px] text-base-content/30 font-bold uppercase tracking-widest mb-2">Timeline</p>
                    <div className="relative pl-4">
                      <div className="absolute left-1.5 top-0 bottom-0 w-px bg-base-300" />
                      <div className="space-y-2.5">
                        {[...tracking.tracking.milestones].reverse().slice(0, 8).map((m, i) => (
                          <div key={i} className="relative flex items-start gap-2">
                            <div className="absolute -left-4 w-2.5 h-2.5 rounded-full bg-primary/70
                                            border border-primary/40 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-base-content/80 font-medium capitalize">
                                {m.name.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[9px] text-base-content/30 font-mono mt-0.5">
                                {new Date(m.occurredAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit', minute: '2-digit', hour12: true,
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Event log */}
                {rideStatus === 'in_progress' && (
                  <div>
                    <p className="text-[9px] text-base-content/30 font-bold uppercase tracking-widest mb-2">Report Event</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { name: 'vehicle_breakdown', label: 'Breakdown', color: 'warning' },
                        { name: 'sos_triggered',     label: '🆘 SOS',    color: 'error'   },
                        { name: 'route_deviated',    label: 'Off Route', color: 'info'    },
                      ].map((ev) => (
                        <button
                          key={ev.name}
                          onClick={() => dispatch(recordMilestone({ rideId, name: ev.name }))}
                          className="btn btn-xs"
                          style={{
                            fontSize: '0.7rem',
                            background: `color-mix(in srgb, var(--${ev.color}), transparent 90%)`,
                            borderColor: `color-mix(in srgb, var(--${ev.color}), transparent 55%)`,
                            color: `var(--${ev.color})`,
                          }}
                        >
                          <Bell className="w-3 h-3" />
                          {ev.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          TOAST
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {toastState && (
          <motion.div
            key={toastState.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y:   0, scale: 1    }}
            exit={{    opacity: 0, y: -10, scale: 0.96  }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50
                       px-3 py-2 rounded-full shadow-depth-lg border backdrop-blur-strong
                       flex items-center gap-2 max-w-[82vw]"
            style={{
              fontSize: '0.75rem', fontWeight: 600,
              background: toastState.type === 'error'   ? 'color-mix(in srgb, var(--error),   transparent 88%)' :
                          toastState.type === 'warning'  ? 'color-mix(in srgb, var(--warning), transparent 85%)' :
                          toastState.type === 'info'     ? 'color-mix(in srgb, var(--info),    transparent 88%)' :
                                                           'color-mix(in srgb, var(--success), transparent 88%)',
              borderColor: toastState.type === 'error'  ? 'color-mix(in srgb, var(--error),   transparent 60%)' :
                           toastState.type === 'warning' ? 'color-mix(in srgb, var(--warning), transparent 55%)' :
                           toastState.type === 'info'    ? 'color-mix(in srgb, var(--info),    transparent 60%)' :
                                                           'color-mix(in srgb, var(--success), transparent 60%)',
              color: toastState.type === 'error'   ? 'var(--error)'   :
                     toastState.type === 'warning'  ? 'color-mix(in oklch, var(--warning) 70%, oklch(20% 0.04 72))' :
                     toastState.type === 'info'     ? 'var(--info)'    : 'var(--success)',
            }}
          >
            {toastState.type === 'error'
              ? <XCircle     className="w-3.5 h-3.5 flex-shrink-0" />
              : toastState.type === 'warning'
              ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {toastState.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          INITIAL LOADING OVERLAY
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {!live && (loadingFlags?.fetchLive || loadingFlags?.fetchTracking) && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{    opacity: 0, transition: { duration: 0.35 } }}
            className="absolute inset-0 z-50 bg-base-100 flex flex-col items-center justify-center gap-3"
          >
            <div className="relative">
              <div className="loading loading-lg" style={{ borderTopColor: 'var(--primary)' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Car className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-base-content/40">Loading ride…</p>
            <p className="text-[10px] text-base-content/20 font-mono">{rideId}</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Small floating chip for HUD */
function HudChip({ value, unit, accent = 'var(--primary)' }) {
  return (
    <div
      className="text-center px-2.5 py-1.5 rounded-xl border"
      style={{
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        borderColor: `color-mix(in srgb, ${accent}, transparent 55%)`,
        minWidth: 52,
      }}
    >
      <div className="font-black leading-none" style={{ fontSize: '0.95rem', color: accent, fontFamily: 'var(--font-family-montserrat)' }}>
        {value}
      </div>
      <div className="font-semibold mt-0.5" style={{ fontSize: '0.6rem', color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
        {unit}
      </div>
    </div>
  );
}

/** Stat card inside the slide panel */
function MiniStat({ icon, value, label, color = 'var(--primary)' }) {
  return (
    <div
      className="card p-2.5 text-center"
      style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderTopColor: `color-mix(in srgb, ${color}, transparent 55%)` }}
    >
      <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
      <div className="font-black leading-tight text-base-content" style={{ fontSize: '0.8rem', fontFamily: 'var(--font-family-montserrat)' }}>
        {value}
      </div>
      <div className="font-bold uppercase tracking-wide mt-0.5" style={{ fontSize: '0.6rem', color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
        {label}
      </div>
    </div>
  );
}

/** Fare row */
function FareRow({ label, value, bold = false }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-base-content/40">{label}</span>
      <span className={`text-[11px] ${bold ? 'font-bold text-base-content' : 'text-base-content/60'}`}>
        {value}
      </span>
    </div>
  );
}