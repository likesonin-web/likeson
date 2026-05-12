
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket, useBookingRoom } from '@/context/SocketProvider';
import {
  fetchRideTracking,
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
} from '@/store/slices/rideRequestSlice';
import {
  joinBookingRoom,
  leaveBookingRoom,
  verifyOtpSocket,
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
  DRIVER_STATUS,
} from '@/store/slices/operationsSlice';
import { fetchDriverMe } from '@/store/slices/transportPartnerSlice';

/**
 * useRideTracking
 * Master hook orchestrating GPS, socket, Redux for RideLiveTracking page.
 *
 * @param {{ rideId: string, bookingId: string }} params
 */
export function useRideTracking({ rideId, bookingId }) {
  const dispatch = useDispatch();
  const { on, connected, SOCKET_EVENTS: EV } = useSocket();

  // Redux state
  const currentRide = useSelector(selectCurrentRide);
  const trackingData = useSelector(selectTrackingData);
  const socketLive = useSelector(selectSocketLive);
  const rideStatus = useSelector(selectRideStatus);
  const navigationTarget = useSelector(selectNavigationTarget);
  const etaUpdate = useSelector(selectEtaUpdate);

  // Local state
  const [driverMe, setDriverMe] = useState(null);
  const [isLoadingRide, setIsLoadingRide] = useState(true);
  const [gpsError, setGpsError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null); // { lat, lng, heading, speed, accuracy }

  // Refs
  const gpsWatchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Initial data fetch ────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;

    const load = async () => {
      setIsLoadingRide(true);
      try {
        await Promise.all([
          dispatch(fetchRideTracking({ rideId })),
          dispatch(fetchDriverMe()).then(action => {
            if (action.payload) setDriverMe(action.payload);
          }),
        ]);
      } catch (e) {
        console.error('[useRideTracking] initial load', e);
      } finally {
        if (mountedRef.current) setIsLoadingRide(false);
      }
    };

    load();
  }, [rideId, dispatch]);

  // ── Join booking room on socket connect ───────────────────
  useEffect(() => {
    if (!connected || !bookingId) return;

    dispatch(joinBookingRoom({ bookingId }));

    // Request state snapshot for reconnects
    dispatch(requestBookingState({ bookingId }));

    return () => {
      dispatch(leaveBookingRoom({ bookingId }));
    };
  }, [connected, bookingId, dispatch]);

  // ── Socket event listeners ────────────────────────────────
  useEffect(() => {
    if (!connected) return;

    const unsubs = [
      on(EV.LOCATION_UPDATE, (data) => {
        dispatch(socketLocationUpdate(data));
        dispatch(setLiveLocation(data));
      }),
      on(EV.ETA_UPDATE, (data) => {
        dispatch(socketEtaUpdate(data));
        dispatch(setEtaUpdate(data));
      }),
      on(EV.RIDE_STATUS_CHANGED, (data) => {
        dispatch(socketRideStatusChanged(data));
        dispatch(setRideStatus(data));
      }),
      on(EV.NAVIGATION_TARGET_CHANGED, (data) => {
        dispatch(socketNavigationTargetChanged(data));
        dispatch(setNavigationTarget(data));
      }),
      on('otp_verified', (data) => {
        dispatch(socketOtpVerified(data));
      }),
      on('ride_completed', (data) => {
        dispatch(socketRideCompleted(data));
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [connected, on, EV, dispatch]);

  // ── GPS tracking ──────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (!navigator?.geolocation) {
      setGpsError('GPS not supported');
      return;
    }

    const prevId = gpsWatchIdRef.current;
    if (prevId !== null) navigator.geolocation.clearWatch(prevId);

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, speed, accuracy } = pos.coords;

        // Calculate heading manually if unavailable
        let computedHeading = heading;
        if (computedHeading === null && lastPositionRef.current) {
          const prev = lastPositionRef.current;
          const dLat = lat - prev.lat;
          const dLng = lng - prev.lng;
          computedHeading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
          if (computedHeading < 0) computedHeading += 360;
        }

        const speedKmh = speed !== null ? speed * 3.6 : 0;

        const position = {
          lat,
          lng,
          heading: computedHeading ?? 0,
          speed: speedKmh,
          accuracy: accuracy ?? null,
        };

        lastPositionRef.current = position;
        if (mountedRef.current) setCurrentPosition(position);

        // Start socket GPS (delegates to socketService)
        dispatch(startGpsTracking({ bookingId }));
      },
      (err) => {
        console.error('[GPS]', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('GPS permission denied');
        } else {
          setGpsError(err.message);
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }, [bookingId, dispatch]);

  const stopTracking = useCallback(() => {
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    dispatch(stopGpsTracking());
  }, [dispatch]);

  // Start tracking on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // ── Offline detection ─────────────────────────────────────
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      if (bookingId && connected) {
        dispatch(requestBookingState({ bookingId }));
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [bookingId, connected, dispatch]);

  // ── Status actions ────────────────────────────────────────
  const sendStatusUpdate = useCallback((status, extras = {}) => {
    if (!bookingId || !rideId) return;
    const pos = lastPositionRef.current;
    dispatch(updateDriverStatusSocket({
      bookingId,
      rideId,
      status,
      lat: pos?.lat,
      lng: pos?.lng,
      ...extras,
    }));
  }, [bookingId, rideId, dispatch]);

  const verifyOtp = useCallback(async (otp) => {
    const result = await dispatch(verifyOtpSocket({ bookingId, rideId, otp }));
    return result;
  }, [bookingId, rideId, dispatch]);

  const triggerSosAlert = useCallback((sosType = 'safety') => {
    const pos = lastPositionRef.current;
    dispatch(triggerSos({
      bookingId, rideId,
      lat: pos?.lat, lng: pos?.lng,
      sosType,
    }));
  }, [bookingId, rideId, dispatch]);

  // ── Cleanup ───────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopTracking();
      clearTimeout(reconnectTimerRef.current);
    };
  }, [stopTracking]);

  return {
    // Data
    ride: currentRide,
    tracking: trackingData,
    socketLive,
    rideStatus: rideStatus || currentRide?.status,
    navigationTarget,
    etaUpdate,
    currentPosition,
    driverMe,
    isLoadingRide,
    gpsError,
    isOffline,
    connected,
    // Actions
    sendStatusUpdate,
    verifyOtp,
    triggerSosAlert,
    startTracking,
    stopTracking,
    DRIVER_STATUS,
  };
}