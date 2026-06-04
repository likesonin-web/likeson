'use client';

/**
 * useRideTracking.js — Likeson.in
 *
 * FIXES vs previous version:
 *  - Added CARE_ASSISTANT_LOCATION_UPDATE socket listener → exposes caLiveLocation state
 *  - Added CARE_ASSISTANT_STATUS_CHANGE socket listener → exposes caStatus state
 *  - Added CARE_ASSISTANT_JOINED_RIDE + CARE_ASSISTANT_ATTACHED socket listeners
 *  - bookingType derived from tracking data + exposed from hook
 *  - caJoinPoint extracted from tracking snapshot / socket events + exposed
 *  - caName exposed from tracking snapshot
 *  - socketLive now merged with CA fields (careAssistantLiveLocation, careAssistantName)
 *  - GPS watchPosition inside hook (approach B) — not calling socketService.startGpsTracking
 *  - startGpsTracking dispatched ONCE on mount; stopGpsTracking ONCE on unmount
 *  - speed guard: null/negative check before * 3.6
 *  - verifyOtp: socket path uses socketService.verifyOtpAsync directly
 *  - sendStatusUpdate: OTP_VERIFIED omitted (use verifyOtp())
 *  - socket listeners registered ONCE (not per-connection)
 *  - mountedRef.current = false set FIRST in cleanup
 *  - bookingId guard on joinBookingRoom / leaveBookingRoom
 *  - requestBookingState dispatched once after join
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
  verifyOtpSocket,
  setLiveLocation,
  setEtaUpdate,
  setRideStatus,
  setNavigationTarget,
  selectNavigationTarget,
  selectEtaUpdate,
  DRIVER_STATUS,
  acceptRide,
  markDriverArrived,
  // CA reducers
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  setCareRideWorkflow,
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

  // ── CA-specific local state ───────────────────────────────────────────────
  // Stored locally so component can read without full Redux selector chain.
  // Also pushed to Redux via setCareAssistantLocation for persistence.
  const [caLiveLocation, setCaLiveLocation] = useState(null);  // { lat, lng, heading, speed }
  const [caStatus,       setCaStatusLocal]  = useState('not_joined');
  const [caJoinPoint,    setCaJoinPoint]    = useState(null);   // { coordinates, zone, distCaToJoinKm }
  const [caName,         setCaName]         = useState(null);

  // ── Derived booking type ──────────────────────────────────────────────────
  // Read from tracking data (populated by fetchRideTracking) or socketLive
  const [bookingType, setBookingType] = useState(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const gpsWatchIdRef   = useRef(null);
  const lastPositionRef = useRef(null);
  const mountedRef      = useRef(true);
  const lastSetPosAt    = useRef(0);

  // ── 1. Initial data fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    setIsLoadingRide(true);
    dispatch(fetchRideTracking({ rideId }))
      .then((result) => {
        if (!mountedRef.current) return;
        // Extract bookingType from fetched data
        const data = result?.payload;
        const bt = data?.ride?.booking?.bookingType
          || data?.booking?.bookingType
          || data?.bookingType
          || null;
        if (bt) setBookingType(bt);

        // Extract CA join point from ride waypoints
        const waypoints = data?.ride?.waypoints || [];
        const joinWp = waypoints.find(w => w.type === 'care_assistant_join');
        if (joinWp?.location?.coordinates?.length >= 2) {
          setCaJoinPoint({
            coordinates:    joinWp.location.coordinates,
            zone:           joinWp.meta?.zone || null,
            distCaToJoinKm: joinWp.meta?.distCaToJoinKm || null,
          });
        }

        // Extract CA name from tracking snapshot
        const caSnap = data?.ride?.careAssistantSnapshot
          || data?.careAssistant;
        if (caSnap?.name || caSnap?.fullName) {
          setCaName(caSnap.name || caSnap.fullName);
        }

        // Extract CA live location from tracking if present
        const caLoc = data?.careAssistant?.liveLocation
          || data?.tracking?.careAssistantLiveLocation;
        if (caLoc?.lat && caLoc?.lng) {
          setCaLiveLocation(caLoc);
        }
      })
      .finally(() => { if (mountedRef.current) setIsLoadingRide(false); });
  }, [rideId, dispatch]);

  // ── Sync bookingType from Redux once ride loads ───────────────────────────
  useEffect(() => {
    if (!currentRide) return;
    const bt = currentRide?.booking?.bookingType
      || currentRide?.bookingType
      || trackingData?.bookingType
      || null;
    if (bt && bt !== bookingType) setBookingType(bt);

    // CA name from ride snapshot
    const snap = currentRide?.careAssistantSnapshot;
    if (snap?.name && !caName) setCaName(snap.name);
  }, [currentRide, trackingData, bookingType, caName]);

  // ── 2. Socket room: join once when connected + bookingId available ─────────
  useEffect(() => {
    if (!connected || !bookingId) return;
    dispatch(joinBookingRoom({ bookingId }));
    dispatch(requestBookingState({ bookingId }));
    return () => { dispatch(leaveBookingRoom({ bookingId })); };
  }, [connected, bookingId, dispatch]);

  // ── 3. Socket event listeners — registered ONCE ───────────────────────────
  useEffect(() => {
    const unsubs = [

      // ── Driver location ─────────────────────────────────────────────────
      on(EV.LOCATION_UPDATE, (data) => {
        dispatch(socketLocationUpdate(data));
        dispatch(setLiveLocation(data));
      }),

      // ── ETA ─────────────────────────────────────────────────────────────
      on(EV.ETA_UPDATE, (data) => {
        dispatch(socketEtaUpdate(data));
        dispatch(setEtaUpdate(data));
      }),

      // ── Ride status ──────────────────────────────────────────────────────
      on(EV.RIDE_STATUS_CHANGED, (data) => {
        dispatch(socketRideStatusChanged(data));
        dispatch(setRideStatus(data));
        if (data.status === 'completed')    dispatch(socketRideCompleted(data));
        if (data.status === 'otp_verified') dispatch(socketOtpVerified(data));

        // Sync activeNavigationTarget from status event
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

        // Sync bookingType if server sends it
        if (data.bookingType && mountedRef.current) {
          setBookingType(data.bookingType);
        }
      }),

      // ── Navigation target ────────────────────────────────────────────────
      on(EV.NAVIGATION_TARGET_CHANGED, (data) => {
        dispatch(socketNavigationTargetChanged(data));
        dispatch(setNavigationTarget(data));
      }),

      // ── CARE ASSISTANT: live location update ─────────────────────────────
      // Server emits 'care_assistant_location_update' to booking room when CA
      // calls PATCH /care/location or emits care_location socket event.
      on('care_assistant_location_update', (data) => {
        if (!mountedRef.current) return;

        const loc = {
          lat:       data.lat,
          lng:       data.lng,
          heading:   data.heading  ?? 0,
          speed:     data.speed    ?? 0,
          updatedAt: data.updatedAt || new Date().toISOString(),
        };

        // Local state — drives marker in RideLiveTracking
        setCaLiveLocation(loc);

        // Redux — persists across re-renders, readable by other selectors
        dispatch(setCareAssistantLocation({
          ...loc,
          role:           'care_assistant',
          careAssistantId: data.careAssistantId || null,
          bookingId:       data.bookingId       || bookingId,
          rideId:          data.rideId          || rideId,
          status:          data.status          || null,
        }));

        // Also sync CA status if server sends it alongside location
        if (data.status && mountedRef.current) {
          setCaStatusLocal(data.status);
        }
      }),

      // ── CARE ASSISTANT: status change ─────────────────────────────────────
      // Server emits when CA calls PATCH /:id/care/ride-status
      on('care_assistant_status_change', (data) => {
        if (!mountedRef.current) return;

        const newStatus = data.careAssistantStatus || data.status || null;
        if (newStatus) {
          setCaStatusLocal(newStatus);
          dispatch(setCareAssistantStatus({ careAssistantStatus: newStatus }));
        }

        // Update CA name if server sends it
        if (data.careAssistantName && mountedRef.current) {
          setCaName(data.careAssistantName);
        }
      }),

      // ── CARE ASSISTANT: joined ride session ───────────────────────────────
      // Server emits when CA calls POST /:id/care/join-ride
      on('care_assistant_joined_ride', (data) => {
        if (!mountedRef.current) return;

        dispatch(setCareAssistantJoined({
          careAssistantId:   data.careAssistantId,
          careAssistantName: data.careAssistantName,
          joinedAt:          data.joinedAt,
          caJoinPoint:       null, // join-ride doesn't send join point
        }));

        if (data.careAssistantName) setCaName(data.careAssistantName);

        // If server sends current CA location in joined event
        if (data.currentLocation?.lat && data.currentLocation?.lng) {
          const loc = {
            lat:     data.currentLocation.lat,
            lng:     data.currentLocation.lng,
            heading: 0,
            speed:   0,
          };
          setCaLiveLocation(loc);
          dispatch(setCareAssistantLocation({ ...loc, role: 'care_assistant' }));
        }
      }),

      // ── CARE ASSISTANT: attached to ride by admin ──────────────────────────
      // Server emits when admin calls POST /assign/care-assistant
      // This event includes the caJoinPoint geometry
      on('care_assistant_attached_to_ride', (data) => {
        if (!mountedRef.current) return;

        if (data.careAssistantName) setCaName(data.careAssistantName);

        // Extract join point — this is the primary source for full_care_ride
        if (data.caJoinPoint?.coordinates?.length >= 2) {
          setCaJoinPoint({
            coordinates:    data.caJoinPoint.coordinates,
            zone:           data.caJoinPoint.zone           || null,
            distCaToJoinKm: data.caJoinPoint.distCaToJoinKm || null,
          });

          // Persist in Redux careRideStatus
          dispatch(setCareRideWorkflow({
            careAssistantJoined:    true,
            activeNavigationTarget: 'pickup_care_assistant',
          }));
        }

        dispatch(setCareAssistantJoined({
          careAssistantId:   data.careAssistantId,
          careAssistantName: data.careAssistantName,
          joinedAt:          new Date().toISOString(),
          caJoinPoint:       data.caJoinPoint || null,
        }));
      }),

      // ── BOOKING STATE SNAPSHOT (reconnect) ────────────────────────────────
      // Server sends full snapshot on request_booking_state
      on('booking_state_snapshot', (data) => {
        if (!mountedRef.current) return;

        // Restore CA live location from snapshot
        if (data.tracking?.careAssistantLiveLocation) {
          const loc = data.tracking.careAssistantLiveLocation;
          if (loc.coordinates?.length >= 2) {
            setCaLiveLocation({
              lat:     loc.coordinates[1],
              lng:     loc.coordinates[0],
              heading: loc.heading  || 0,
              speed:   loc.speedKmh || 0,
            });
          }
        }

        // Restore CA status from snapshot
        if (data.tracking?.careAssistantStatus) {
          setCaStatusLocal(data.tracking.careAssistantStatus);
        }
      }),

    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [on, EV, dispatch, bookingId, rideId]); // bookingId/rideId needed in closure for dispatch calls

  // ── 4. GPS — internal watchPosition ──────────────────────────────────────
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
        const { latitude: lat, longitude: lng, heading, accuracy } = pos.coords;
        const rawSpeed = pos.coords.speed;

        // Guard null/negative speed before unit conversion
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

        // Emit to server via socketService directly
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
  }, []); // eslint-disable-line

  // ── 5. Offline detection ──────────────────────────────────────────────────
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

  // ── 6. Cleanup mountedRef ────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Set false FIRST before async callbacks fire
      mountedRef.current = false;
    };
  }, []);

  // ── sendStatusUpdate ──────────────────────────────────────────────────────
  const sendStatusUpdate = useCallback(async (action, extras = {}) => {
    const pos = lastPositionRef.current;

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

    if (action === DRIVER_STATUS.ACCEPTED && bookingId) {
      await dispatch(acceptRide({ bookingId }));
    } else if (action === DRIVER_STATUS.ARRIVED && bookingId) {
      await dispatch(markDriverArrived({ bookingId }));
    } else if (rideId) {
      await dispatch(updateRideStatus({ rideId, action: httpAction, ...extras }));
    }

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

    if (rideId) {
      setTimeout(() => {
        if (mountedRef.current) dispatch(fetchRideTracking({ rideId }));
      }, 800);
    }
  }, [bookingId, rideId, dispatch]);

  // ── verifyOtp ─────────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (otp) => {
    if (!rideId) return { success: false, message: 'No rideId' };
    const httpResult = await dispatch(updateRideStatus({ rideId, action: 'verify_otp', otp }));
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
    rideStage:       socketLive?.rideStage || currentRide?.rideStage,
    activeNavigationTarget: socketLive?.activeNavigationTarget || currentRide?.activeNavigationTarget,
    navigationTarget,
    etaUpdate,
    currentPosition,
    isLoadingRide,
    gpsError,
    isOffline,
    connected,
    // ── CA-specific ──────────────────────────────────────────────────────
    bookingType,
    caLiveLocation,   // { lat, lng, heading, speed } — CA live position
    caStatus,         // 'not_joined'|'en_route_to_pickup'|'at_pickup'|'in_ride'|'departed'
    caJoinPoint,      // { coordinates: [lng,lat], zone, distCaToJoinKm } | null
    caName,           // string | null
    // ── Actions ──────────────────────────────────────────────────────────
    sendStatusUpdate,
    verifyOtp,
    triggerSosAlert,
    startTracking,
    stopTracking,
    DRIVER_STATUS,
  };
}