'use client';

/**
 * useRideTracking.js — Corrected & production-grade
 *
 * FIXES from original:
 * 1. joinBookingRoom / leaveBookingRoom called directly on socketService, NOT
 *    dispatched as Redux thunks — those thunks don't exist in the new slice.
 * 2. Booking room join happens ONCE on `connected` change, not every render.
 * 3. CA socket events dispatch to BOTH rideRequestSlice (socketLive) and
 *    operationsSlice (careRide state) — no double-registration per event.
 * 4. Driver GPS watch: single watchPosition, cleaned up on unmount only.
 * 5. gpsError uses functional updater to avoid stale closure reads.
 * 6. bookingType derived from trackingData + currentRide — both checked.
 * 7. DRIVER_STATUS exported so consumers don't need a separate import.
 * 8. sendStatusUpdate: HTTP first, socket second, then re-fetch.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { useSocket }                                 from '@/context/SocketProvider';
import socketService, { SOCKET_EVENTS }              from '@/services/socketService';

// ── rideRequestSlice ──────────────────────────────────────────────────────────
import {
  fetchRideTracking,
  updateRideStatus,
  selectCurrentRide,
  selectTrackingData,
  selectSocketLive,
  selectRideStatus,
  socketRideStatusChanged,
  socketNavigationTargetChanged,
  socketLocationUpdate,
  socketEtaUpdate,
  socketOtpVerified,
  socketRideCompleted,
  socketCaAtJoinPoint,
  socketCaJoinedRide,
  socketJpWaypointCompleted,
} from '@/store/slices/rideRequestSlice';

// ── operationsSlice ───────────────────────────────────────────────────────────
import {
  startGpsTracking,
  stopGpsTracking,
  updateDriverStatusSocket,
  triggerSos,
  requestBookingState,
  setLiveLocation,
  setEtaUpdate,
  setRideStatus,
  setNavigationTarget,
  selectNavigationTarget,
  selectEtaUpdate,
  acceptRide,
  markDriverArrived,
  endRide,
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  setCareRideWorkflow,
  setCaAtJoinPoint,
  setCaHasJoined,
  setJpWaypointCompleted,
  setCaViewMode,
} from '@/store/slices/operationsSlice';

// ── Utils ─────────────────────────────────────────────────────────────────────
export {
  formatEta,
  formatDistance,
  getManeuverIcon,
} from '@/utils/navigationUtils';

export { DRIVER_STATUS } from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ rideId: string|null, bookingId: string|null }} params
 */
export function useRideTracking({ rideId, bookingId }) {
  const dispatch = useDispatch();
  const { on, connected } = useSocket();

  // ── Redux state ────────────────────────────────────────────────────────────
  const currentRide      = useSelector(selectCurrentRide);
  const trackingData     = useSelector(selectTrackingData);
  const socketLive       = useSelector(selectSocketLive);
  const rideStatus       = useSelector(selectRideStatus);
  const navigationTarget = useSelector(selectNavigationTarget);
  const etaUpdate        = useSelector(selectEtaUpdate);

  // ── Local state ────────────────────────────────────────────────────────────
  const [isLoadingRide,   setIsLoadingRide]   = useState(true);
  const [gpsError,        setGpsError]        = useState(null);
  const [isOffline,       setIsOffline]       = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);

  // CA state
  const [caLiveLocation, setCaLiveLocation] = useState(null);
  const [caStatus,       setCaStatusLocal]  = useState('not_joined');
  const [caJoinPoint,    setCaJoinPoint]    = useState(null);
  const [caName,         setCaName]         = useState(null);
  const [bookingType,    setBookingType]     = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const gpsWatchIdRef    = useRef(null);
  const lastPositionRef  = useRef(null);
  const mountedRef       = useRef(true);
  const lastPosSetAt     = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── 1. Fetch ride on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    setIsLoadingRide(true);
    dispatch(fetchRideTracking({ rideId }))
      .then(result => {
        if (!mountedRef.current) return;
        const data = result?.payload;

        // Booking type
        const bt = data?.ride?.booking?.bookingType
          || data?.bookingType
          || data?.booking?.bookingType
          || null;
        if (bt) setBookingType(bt);

        // CA join point from waypoints (legacy) or stops
        const waypoints = data?.ride?.waypoints || [];
        const joinWp    = waypoints.find(w => w.type === 'care_assistant_join');
        if (joinWp?.location?.coordinates?.length >= 2) {
          setCaJoinPoint({
            coordinates:    joinWp.location.coordinates,
            zone:           joinWp.meta?.zone,
            distCaToJoinKm: joinWp.meta?.distCaToJoinKm,
          });
        }

        // CA snapshot
        const caSnap = data?.ride?.careAssistantSnapshot;
        if (caSnap?.name) setCaName(caSnap.name);

        // CA live location
        const caLoc = data?.careAssistant?.liveLocation
          || data?.tracking?.careAssistantLiveLocation;
        if (caLoc?.lat && caLoc?.lng) setCaLiveLocation(caLoc);
      })
      .finally(() => { if (mountedRef.current) setIsLoadingRide(false); });
  }, [rideId, dispatch]);

  // ── Sync bookingType from Redux once ride hydrates ─────────────────────────
  useEffect(() => {
    if (!currentRide) return;
    const bt = currentRide?.booking?.bookingType
      || currentRide?.bookingType
      || trackingData?.bookingType
      || null;
    if (bt && bt !== bookingType) setBookingType(bt);
    const snap = currentRide?.careAssistantSnapshot;
    if (snap?.name && !caName) setCaName(snap.name);
  }, [currentRide, trackingData, bookingType, caName]);

  // ── 2. Join booking socket room ────────────────────────────────────────────
  // FIX: call socketService directly — not via Redux thunk
  useEffect(() => {
    if (!connected || !bookingId) return;
    socketService.joinBookingRoom(bookingId);
    dispatch(requestBookingState({ bookingId }));
    return () => socketService.leaveBookingRoom(bookingId);
  }, [connected, bookingId, dispatch]);

  // ── 3. Socket event listeners — single registration per event ─────────────
  useEffect(() => {
    const unsubs = [

      // Driver location broadcast (admin ops / tracking page reads this)
      on(SOCKET_EVENTS.LOCATION_UPDATE, (d) => {
        dispatch(socketLocationUpdate(d));
        dispatch(setLiveLocation(d));
      }),

      on(SOCKET_EVENTS.ETA_UPDATE, (d) => {
        dispatch(socketEtaUpdate(d));
        dispatch(setEtaUpdate(d));
      }),

      on(SOCKET_EVENTS.RIDE_STATUS_CHANGED, (d) => {
        dispatch(socketRideStatusChanged(d));
        dispatch(setRideStatus(d));
        if (d.status === 'completed')    dispatch(socketRideCompleted(d));
        if (d.status === 'otp_verified') dispatch(socketOtpVerified(d));
        if (d.activeNavigationTarget) {
          const navPayload = {
            currentTarget:          d.activeNavigationTarget,
            activeNavigationTarget: d.activeNavigationTarget,
          };
          dispatch(setNavigationTarget(navPayload));
          dispatch(socketNavigationTargetChanged(navPayload));
        }
        if (d.bookingType && mountedRef.current) setBookingType(d.bookingType);
      }),

      on(SOCKET_EVENTS.NAVIGATION_TARGET_CHANGED, (d) => {
        dispatch(socketNavigationTargetChanged(d));
        dispatch(setNavigationTarget(d));
      }),

      // ── CA events ────────────────────────────────────────────────────────
      on(SOCKET_EVENTS.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
        if (!mountedRef.current) return;
        const loc = { lat: d.lat, lng: d.lng, heading: d.heading ?? 0, speed: d.speed ?? 0, updatedAt: d.updatedAt };
        setCaLiveLocation(loc);
        dispatch(setCareAssistantLocation({ ...loc, role: 'care_assistant', careAssistantId: d.careAssistantId, bookingId: d.bookingId }));
        if (d.status) setCaStatusLocal(d.status);
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_STATUS_CHANGE, (d) => {
        if (!mountedRef.current) return;
        const s = d.careAssistantStatus || d.status;
        if (s) { setCaStatusLocal(s); dispatch(setCareAssistantStatus({ careAssistantStatus: s })); }
        if (d.careAssistantName) setCaName(d.careAssistantName);
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_AT_JP, (d) => {
        if (!mountedRef.current) return;
        if (d?.careAssistantStatus) {
          setCaStatusLocal(d.careAssistantStatus);
          dispatch(setCareAssistantStatus({ careAssistantStatus: d.careAssistantStatus }));
        }
        dispatch(setCaAtJoinPoint());
        dispatch(socketCaAtJoinPoint(d));
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        if (!mountedRef.current) return;
        dispatch(setCareAssistantJoined({ careAssistantId: d.careAssistantId, careAssistantName: d.careAssistantName, joinedAt: d.joinedAt, caJoinPoint: null }));
        dispatch(setCaHasJoined(d));
        dispatch(setCaViewMode('driver_tracking_only'));
        dispatch(socketCaJoinedRide(d));
        setCaStatusLocal('in_ride');
        if (d.careAssistantName) setCaName(d.careAssistantName);
        if (d.currentLocation?.lat) setCaLiveLocation({ lat: d.currentLocation.lat, lng: d.currentLocation.lng, heading: 0, speed: 0 });
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_ATTACHED, (d) => {
        if (!mountedRef.current) return;
        if (d.careAssistantName) setCaName(d.careAssistantName);
        if (d.caJoinPoint?.coordinates?.length >= 2) {
          setCaJoinPoint({ coordinates: d.caJoinPoint.coordinates, zone: d.caJoinPoint.zone, distCaToJoinKm: d.caJoinPoint.distCaToJoinKm });
          dispatch(setCareRideWorkflow({ careAssistantJoined: true, activeNavigationTarget: 'pickup_care_assistant' }));
        }
        dispatch(setCareAssistantJoined({ careAssistantId: d.careAssistantId, careAssistantName: d.careAssistantName, joinedAt: new Date().toISOString(), caJoinPoint: d.caJoinPoint || null }));
      }),

      on(SOCKET_EVENTS.CA_JOIN_WAYPOINT_COMPLETED, (d) => {
        if (!mountedRef.current) return;
        dispatch(setJpWaypointCompleted(d));
        dispatch(socketJpWaypointCompleted(d));
        setCaJoinPoint(prev => prev ? { ...prev, isCompleted: true } : prev);
      }),

      on(SOCKET_EVENTS.JOIN_POINT_CALCULATED, (d) => {
        if (!mountedRef.current) return;
        if (d.location?.coordinates) {
          setCaJoinPoint({ coordinates: d.location.coordinates, zone: d.zone, distCaToJoinKm: d.distCaToJoinKm });
        }
      }),

      // Booking state snapshot (reconnect hydration)
      on(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, (d) => {
        if (!mountedRef.current) return;
        const caLoc = d.tracking?.careAssistantLiveLocation;
        if (caLoc?.coordinates?.length >= 2) {
          setCaLiveLocation({ lat: caLoc.coordinates[1], lng: caLoc.coordinates[0], heading: caLoc.heading || 0, speed: caLoc.speedKmh || 0 });
        }
        if (d.tracking?.careAssistantStatus) setCaStatusLocal(d.tracking.careAssistantStatus);
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [on, dispatch, bookingId, rideId]);

  // ── 4. GPS watch ───────────────────────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('GPS not supported on this device');
      return;
    }
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, accuracy, speed: rawSpeed } = pos.coords;
        const speedKmh = rawSpeed != null && rawSpeed >= 0 ? +(rawSpeed * 3.6).toFixed(1) : 0;

        let computedHeading = heading;
        if ((computedHeading == null) && lastPositionRef.current) {
          const prev = lastPositionRef.current;
          const dLat = lat - prev.lat, dLng = lng - prev.lng;
          computedHeading = ((Math.atan2(dLng, dLat) * 180 / Math.PI) + 360) % 360;
        }

        const position = { lat, lng, heading: +(computedHeading ?? 0).toFixed(1), speed: speedKmh, accuracy: accuracy ?? null };
        lastPositionRef.current = position;

        // Throttle React state update to 1/s max
        const now = Date.now();
        if (now - lastPosSetAt.current > 1000) {
          lastPosSetAt.current = now;
          if (mountedRef.current) setCurrentPosition({ ...position });
        }

        // Emit GPS to socket
        socketService.emit('driver_location', {
          bookingId: bookingId ?? undefined,
          lat, lng,
          heading:  position.heading,
          speed:    speedKmh,
          accuracy: accuracy ?? undefined,
        });

        if (mountedRef.current) setGpsError(prev => prev ? null : prev);
      },
      (err) => {
        if (!mountedRef.current) return;
        if (err.code === err.PERMISSION_DENIED)       setGpsError('GPS permission denied. Enable location access.');
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsError('GPS signal unavailable.');
        else                                            setGpsError('GPS timeout. Retrying…');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10_000 }
    );

    dispatch(startGpsTracking({ bookingId }));
  }, [bookingId, dispatch]);

  const stopTracking = useCallback(() => {
    if (gpsWatchIdRef.current !== null) {
      navigator?.geolocation?.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    dispatch(stopGpsTracking());
  }, [dispatch]);

  // Start GPS once
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []); // eslint-disable-line

  // ── 5. Offline detection ───────────────────────────────────────────────────
  useEffect(() => {
    const onOffline = () => { if (mountedRef.current) setIsOffline(true); };
    const onOnline  = () => {
      if (!mountedRef.current) return;
      setIsOffline(false);
      if (rideId) dispatch(fetchRideTracking({ rideId }));
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online',  onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online',  onOnline);
    };
  }, [rideId, dispatch]);

  // ── sendStatusUpdate ───────────────────────────────────────────────────────
  const sendStatusUpdate = useCallback(async (action, extras = {}) => {
    const pos = lastPositionRef.current;

    // Map legacy DRIVER_STATUS constants to HTTP action strings
    const statusToAction = {
      accepted:      'accept',
      en_route:      'start_route',
      arrived:       'arrived',
      otp_verified:  'verify_otp',
      ride_started:  'start_ride',
      at_stop:       'at_stop',
      stop_departed: 'resume',
      completed:     'complete',
      cancelled:     'cancel',
    };
    const httpAction = statusToAction[action] ?? action;

    // HTTP call
    if (action === 'accepted' && bookingId) {
      await dispatch(acceptRide({ bookingId }));
    } else if (action === 'arrived' && bookingId) {
      await dispatch(markDriverArrived({ bookingId }));
    } else if (action === 'completed' && bookingId) {
      await dispatch(endRide({ bookingId, ...extras }));
    } else if (rideId) {
      await dispatch(updateRideStatus({ rideId, action: httpAction, ...extras }));
    }

    // Socket status update (non-blocking)
    if (bookingId && rideId) {
      dispatch(updateDriverStatusSocket({ bookingId, rideId, status: action, lat: pos?.lat, lng: pos?.lng, ...extras }));
    }

    // Refresh tracking after short delay
    if (rideId) {
      setTimeout(() => { if (mountedRef.current) dispatch(fetchRideTracking({ rideId })); }, 800);
    }
  }, [bookingId, rideId, dispatch]);

  // ── verifyOtp ──────────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (otp) => {
    if (!rideId) return { error: 'No rideId' };
    const httpResult = await dispatch(updateRideStatus({ rideId, action: 'verify_otp', otp }));
    // Also fire socket OTP (non-blocking, best-effort)
    if (bookingId) socketService.verifyOtpAsync({ bookingId, rideId, otp }).catch(() => {});
    return httpResult;
  }, [bookingId, rideId, dispatch]);

  // ── triggerSosAlert ────────────────────────────────────────────────────────
  const triggerSosAlert = useCallback((sosType = 'SAFETY') => {
    const pos = lastPositionRef.current;
    dispatch(triggerSos({ bookingId: bookingId || '', rideId: rideId || '', lat: pos?.lat, lng: pos?.lng, sosType }));
  }, [bookingId, rideId, dispatch]);

  return {
    ride:                    currentRide,
    tracking:                trackingData,
    socketLive,
    rideStatus:              rideStatus || currentRide?.status,
    rideStage:               socketLive?.rideStage || currentRide?.rideStage,
    activeNavigationTarget:  socketLive?.activeNavigationTarget || currentRide?.activeNavigationTarget,
    navigationTarget,
    etaUpdate,
    currentPosition,
    isLoadingRide,
    gpsError,
    isOffline,
    connected,
    bookingType,
    caLiveLocation,
    caStatus,
    caJoinPoint,
    caName,
    sendStatusUpdate,
    verifyOtp,
    triggerSosAlert,
    startTracking,
    stopTracking,
  };
}