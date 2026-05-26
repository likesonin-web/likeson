'use client';

/**
 * useRideTracking.js — Likeson.in
 *
 * FIXES vs previous version:
 *  - GPS watchPosition inside hook called startGpsTracking (socketService) NOT dispatch(startGpsTracking)
 *    on every tick — that was dispatching a Redux thunk once per GPS position update (very wrong)
 *  - startGpsTracking dispatched ONCE on mount; stopGpsTracking dispatched ONCE on unmount
 *  - speed guard: same fix as socketService.js — null/negative check before * 3.6
 *  - verifyOtpThunk import fixed: it lives in operationsSlice (verifyOtpSocket), NOT rideRequestSlice
 *  - verifyOtp: socket path uses socketService.verifyOtpAsync directly (promise with rideId dedup)
 *    rather than dispatching verifyOtpThunk which wraps the same call — avoids double-call
 *  - sendStatusUpdate: DRIVER_STATUS.OTP_VERIFIED is not a driver action to send; removed from map
 *    (OTP verify has its own verifyOtp fn)
 *  - socket listeners: removed fine-grained events (driver_accepted, driver_en_route, etc.) —
 *    server does NOT emit these as separate events; RIDE_STATUS_CHANGED covers all transitions
 *  - socket listeners: wired in a single effect that does NOT depend on `connected` changing —
 *    socketService.on() queues if not connected; no need to re-register on reconnect
 *  - cleanup: mountedRef.current = false set FIRST in cleanup (before async callbacks fire)
 *  - offline handler: removed stale closure over connected (captured at effect time)
 *  - requestBookingState dispatched only once after join, not also inside online handler
 *    (requestBookingStateAsync is a promise — no double-fire)
 *  - bookingId guard: joinBookingRoom / leaveBookingRoom only fire when bookingId is defined
 *  - No import of updateRideStatus from rideRequestSlice (it's in rideRequestSlice, was being
 *    shadowed by verifyOtpSocket — cleaned up imports)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector }                 from 'react-redux';
import { useSocket }                                from '@/context/SocketProvider';
import socketService                                from '@/services/socketService';

// ── rideRequestSlice ─────────────────────────────────────────────────────────
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
  selectActiveNavigationTarget,
} from '@/store/slices/rideRequestSlice';

// ── operationsSlice ──────────────────────────────────────────────────────────
import {
  joinBookingRoom,
  leaveBookingRoom,
  startGpsTracking,
  stopGpsTracking,
  updateDriverStatusSocket,
  triggerSos,
  requestBookingState,
  verifyOtpSocket,          // ← correct home: operationsSlice, not rideRequestSlice
  setLiveLocation,
  setEtaUpdate,
  setRideStatus,
  setNavigationTarget,
  selectNavigationTarget,
  selectEtaUpdate,
  DRIVER_STATUS,
  acceptRide,
  markDriverArrived,
} from '@/store/slices/operationsSlice';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * useRideTracking
 * Master hook for RideLiveTracking page.
 *
 * @param {{ rideId: string, bookingId?: string }} params
 */
export function useRideTracking({ rideId, bookingId }) {
  const dispatch = useDispatch();
  const { on, connected, SOCKET_EVENTS: EV } = useSocket();

  // ── Redux state ──────────────────────────────────────────────────────────
  const currentRide      = useSelector(selectCurrentRide);
  const trackingData     = useSelector(selectTrackingData);
  const socketLive       = useSelector(selectSocketLive);
  const rideStatus       = useSelector(selectRideStatus);
  const navigationTarget = useSelector(selectNavigationTarget);
  const etaUpdate        = useSelector(selectEtaUpdate);

  // ── Local state ──────────────────────────────────────────────────────────
  const [isLoadingRide,   setIsLoadingRide]   = useState(true);
  const [gpsError,        setGpsError]        = useState(null);
  const [isOffline,       setIsOffline]       = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const gpsWatchIdRef   = useRef(null);
  const lastPositionRef = useRef(null);
  const mountedRef      = useRef(true);
  const lastSetPosAt    = useRef(0);  // throttle React re-renders to 1/s

  // ── 1. Initial data fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    setIsLoadingRide(true);
    dispatch(fetchRideTracking({ rideId }))
      .finally(() => { if (mountedRef.current) setIsLoadingRide(false); });
  }, [rideId, dispatch]);

  // ── 2. Socket room: join once when connected + bookingId available ────────
  useEffect(() => {
    if (!connected || !bookingId) return;
    dispatch(joinBookingRoom({ bookingId }));
    dispatch(requestBookingState({ bookingId }));
    return () => { dispatch(leaveBookingRoom({ bookingId })); };
  }, [connected, bookingId, dispatch]);

  // ── 3. Socket event listeners — registered ONCE, not per-connection ───────
  //
  // socketService.on() queues events if not yet connected so we don't need to
  // re-register on every connected change. Re-registering would create duplicate
  // listeners on reconnect.
  //
  // Fine-grained events (driver_accepted, driver_en_route, …) are NOT emitted
  // as separate top-level events by the server — RIDE_STATUS_CHANGED carries
  // all status transitions. Those reducers (socketDriverAccepted, etc.) can be
  // called from RIDE_STATUS_CHANGED if the UI needs them.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
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
  if (data.status === 'completed')    dispatch(socketRideCompleted(data));
  if (data.status === 'otp_verified') dispatch(socketOtpVerified(data));
  // NEW: sync activeNavigationTarget from status event
  if (data.activeNavigationTarget) {
    dispatch(setNavigationTarget({
      currentTarget:          data.activeNavigationTarget,
      activeNavigationTarget: data.activeNavigationTarget,
      bookingId:              data.bookingId,
      rideId:                 data.rideId,
    }));
    dispatch(socketNavigationTargetChanged({
      currentTarget: data.activeNavigationTarget,
    }));
  }
}),

      on(EV.NAVIGATION_TARGET_CHANGED, (data) => {
        dispatch(socketNavigationTargetChanged(data));
        dispatch(setNavigationTarget(data));
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [on, EV, dispatch]); // EV and on are stable refs from context

  // ── 4. GPS — internal watchPosition (does NOT call socketService.startGpsTracking) ──
  //
  // socketService.startGpsTracking() creates its OWN watchPosition internally.
  // If we also create one here, we get TWO concurrent GPS watches. The correct
  // approach is ONE of:
  //   A) Use socketService.startGpsTracking() exclusively (hands off to the service), OR
  //   B) Own the watchPosition here and emit manually via socketService.emit().
  //
  // This hook uses approach B so it can:
  //   - compute heading from movement delta when device doesn't provide it
  //   - throttle React state updates independently of socket emit rate
  //   - expose currentPosition to the UI
  //
  // We still dispatch startGpsTracking() / stopGpsTracking() to update Redux
  // gpsTracking flag (used by UI to show GPS indicator).
  // ─────────────────────────────────────────────────────────────────────────

  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('GPS not supported on this device');
      return;
    }

    // Clear any existing watch before starting a new one
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, accuracy } = pos.coords;
        const rawSpeed = pos.coords.speed;

        // FIX: guard null / negative speed before unit conversion (same fix as socketService.js)
        const speedKmh = rawSpeed != null && rawSpeed >= 0
          ? +(rawSpeed * 3.6).toFixed(1)
          : 0;

        // Compute heading from movement delta when device omits it
        let computedHeading = heading;
        if ((computedHeading === null || computedHeading === undefined) && lastPositionRef.current) {
          const prev = lastPositionRef.current;
          const dLat = lat - prev.lat;
          const dLng = lng - prev.lng;
          computedHeading = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
        }

        const position = {
          lat,
          lng,
          heading:  +(computedHeading ?? 0).toFixed(1),
          speed:    speedKmh,
          accuracy: accuracy ?? null,
        };

        lastPositionRef.current = position;

        // Throttle React state update to 1/s — prevents render flood
        const now = Date.now();
        if (now - lastSetPosAt.current > 1000) {
          lastSetPosAt.current = now;
          if (mountedRef.current) setCurrentPosition({ ...position });
        }

        // Emit to server via socketService directly (service has its own 2s throttle)
        socketService.emit('driver_location', {
          bookingId: bookingId ?? undefined,
          lat,
          lng,
          heading:  position.heading,
          speed:    speedKmh,
          accuracy: accuracy ?? undefined,
        });

        if (mountedRef.current && gpsError) setGpsError(null);
      },
      (err) => {
        if (!mountedRef.current) return;
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('GPS permission denied. Enable location access.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('GPS signal unavailable.');
        } else {
          setGpsError('GPS timeout. Retrying…');
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10_000 }
    );

    // Update Redux GPS tracking flag
    dispatch(startGpsTracking({ bookingId }));
  }, [bookingId, dispatch, gpsError]);

  const stopTracking = useCallback(() => {
    if (gpsWatchIdRef.current !== null) {
      navigator?.geolocation?.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    dispatch(stopGpsTracking());
  }, [dispatch]);

  // Start GPS once on mount; stop on unmount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []); // intentionally empty — start once, stop once; eslint-disable-line

  // ── 5. Offline detection ─────────────────────────────────────────────────
  useEffect(() => {
    const onOffline = () => { if (mountedRef.current) setIsOffline(true); };
    const onOnline  = () => {
      if (!mountedRef.current) return;
      setIsOffline(false);
      // Refresh ride data after reconnect
      if (rideId) dispatch(fetchRideTracking({ rideId }));
      // Don't call requestBookingState here — the socket room effect handles
      // it on reconnect (connected → false → true triggers the room effect).
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online',  onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online',  onOnline);
    };
  }, [rideId, dispatch]);

  // ── 6. Cleanup mountedRef ────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // stopTracking called by GPS effect cleanup — no double-call needed here
    };
  }, []);

  // ── sendStatusUpdate ─────────────────────────────────────────────────────
  /**
   * Sends status via:
   *   1. HTTP PATCH /ride-requests/:rideId/status  (primary — state machine)
   *   2. Socket driver_status_update               (real-time room broadcast)
   *
   * Legacy booking-based HTTP routes (accept, arrived) dispatched separately.
   */
  const sendStatusUpdate = useCallback(async (action, extras = {}) => {
    const pos = lastPositionRef.current;

    // Map DRIVER_STATUS constants → HTTP action strings for /ride-requests/:rideId/status
    // OTP_VERIFIED intentionally omitted — use verifyOtp() instead
    const driverStatusToAction = {
      [DRIVER_STATUS.ACCEPTED]:      'accept',
      [DRIVER_STATUS.EN_ROUTE]:      'start_route',
      [DRIVER_STATUS.ARRIVED]:       'arrived',
      [DRIVER_STATUS.RIDE_STARTED]:  'start_ride',
      [DRIVER_STATUS.AT_STOP]:       'at_stop',
      [DRIVER_STATUS.STOP_DEPARTED]: 'resume',
      [DRIVER_STATUS.COMPLETED]:     'complete',
      [DRIVER_STATUS.CANCELLED]:     'cancel',
    };

    const httpAction = driverStatusToAction[action] ?? action;

    // Special cases: booking-based HTTP routes (legacy)
    if (action === DRIVER_STATUS.ACCEPTED && bookingId) {
      await dispatch(acceptRide({ bookingId }));
    } else if (action === DRIVER_STATUS.ARRIVED && bookingId) {
      await dispatch(markDriverArrived({ bookingId }));
    } else if (rideId) {
      await dispatch(updateRideStatus({ rideId, action: httpAction, ...extras }));
    }

    // Always broadcast via socket for real-time location + status to room
    if (bookingId && rideId) {
      dispatch(updateDriverStatusSocket({
        bookingId,
        rideId,
        status: action,
        lat: pos?.lat,
        lng: pos?.lng,
        ...extras,
      }));
    }

    // Refresh tracking data after transition (short delay for DB to settle)
    if (rideId) {
      setTimeout(() => {
        if (mountedRef.current) dispatch(fetchRideTracking({ rideId }));
      }, 800);
    }
  }, [bookingId, rideId, dispatch]);

  // ── verifyOtp ─────────────────────────────────────────────────────────────
  /**
   * Primary: HTTP verify_otp via ride state machine.
   * Secondary: socket verifyOtpAsync for real-time room event.
   *
   * Uses socketService.verifyOtpAsync directly (not via thunk) because the
   * thunk wraps the same promise — dispatching the thunk AND calling the service
   * directly would fire two socket emits.
   */
  const verifyOtp = useCallback(async (otp) => {
    if (!rideId) return { success: false, message: 'No rideId' };

    // HTTP primary
    const httpResult = await dispatch(updateRideStatus({ rideId, action: 'verify_otp', otp }));

    // Socket secondary — real-time room broadcast (best-effort, don't await)
    if (bookingId) {
      socketService.verifyOtpAsync({ bookingId, rideId, otp }).catch(() => {});
    }

    return httpResult;
  }, [bookingId, rideId, dispatch]);

  // ── triggerSosAlert ───────────────────────────────────────────────────────
  const triggerSosAlert = useCallback((sosType = 'safety') => {
    const pos = lastPositionRef.current;
    dispatch(triggerSos({
      bookingId: bookingId || '',
      rideId:    rideId    || '',
      lat:       pos?.lat,
      lng:       pos?.lng,
      sosType,
    }));
  }, [bookingId, rideId, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  return {
  ride:            currentRide,
  tracking:        trackingData,
  socketLive,
  rideStatus:      rideStatus || currentRide?.status,
  rideStage:       socketLive?.rideStage || currentRide?.rideStage,  // ← ADD
  activeNavigationTarget: socketLive?.activeNavigationTarget || currentRide?.activeNavigationTarget,  // ← ADD
  navigationTarget,
  etaUpdate,
  currentPosition,
  isLoadingRide,
  gpsError,
  isOffline,
  connected,
  sendStatusUpdate,
  verifyOtp,
  triggerSosAlert,
  startTracking,
  stopTracking,
  DRIVER_STATUS,
};
}