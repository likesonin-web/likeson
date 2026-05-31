'use client';
/**
 * useRideTracking.js
 *
 * Wires:
 *  - Redux selectors from rideRequestSlice + operationsSlice
 *  - Socket events via SocketProvider hooks
 *  - Initial HTTP fetch via fetchRideTracking thunk
 *  - Live updates dispatched to Redux on each socket event
 *
 * Returns unified tracking state for CareRideLiveTrackingPage.
 */

import { useEffect, useCallback, useRef, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// rideRequestSlice selectors + actions
import {
  fetchRideTracking,
  fetchRideLive,
  selectCurrentRide,
  selectTrackingData,
  selectSocketLive,
  selectLiveData,
  selectHospitalEta,
  selectCareAssistantTracking,
  selectActiveTarget,
  selectRideStage,
  selectActiveNavigationTarget,
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketNavigationTargetChanged,
  socketDriverAccepted,
  socketDriverEnRoute,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketRideCompleted,
  socketRideCancelled,
  socketRideAssigned,
  socketHospitalEtaUpdate,
  socketCareAssistantTracking,
} from '@/redux/slices/rideRequestSlice';

// operationsSlice selectors + actions
import {
  selectCareTrackingSnapshot,
  selectCareAssistantLocation,
  selectCareAssistantStatus,
  selectCareAssistantJoined,
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  fetchCareTrackingSnapshot,
} from '@/redux/slices/operationsSlice';

import { useSocket } from '@/context/SocketProvider';
import { SOCKET_EVENTS } from '@/services/socketService';

// ── Activity feed reducer (local, not in Redux — display only) ────────────────
function feedReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [action.event, ...state].slice(0, 100);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

let _feedId = 0;
function mkFeedEvent(type, label, detail) {
  return { id: ++_feedId, type, label, detail, ts: Date.now() };
}

export default function useRideTracking({ rideId, bookingId, rideType = 'full_care_ride' }) {
  const dispatch   = useDispatch();
  const { on, connected, joinBookingRoom, leaveBookingRoom } = useSocket();

  // ── Redux state ─────────────────────────────────────────────────────────────
  const currentRide          = useSelector(selectCurrentRide);
  const trackingData         = useSelector(selectTrackingData);
  const socketLive           = useSelector(selectSocketLive);
  const liveData             = useSelector(selectLiveData);
  const hospitalEta          = useSelector(selectHospitalEta);
  const careAssistantTracking= useSelector(selectCareAssistantTracking);
  const careSnapshot         = useSelector(selectCareTrackingSnapshot);
  const caLocation           = useSelector(selectCareAssistantLocation);
  const caStatus             = useSelector(selectCareAssistantStatus);
  const caJoined             = useSelector(selectCareAssistantJoined);
  const activeTarget         = useSelector(selectActiveTarget);
  const rideStage            = useSelector(selectRideStage);
  const activeNavTarget      = useSelector(selectActiveNavigationTarget);

  // ── Local activity feed ─────────────────────────────────────────────────────
  const [activityFeed, dispatchFeed] = useReducer(feedReducer, []);
  const addEvent = useCallback((type, label, detail) => {
    dispatchFeed({ type: 'ADD', event: mkFeedEvent(type, label, detail) });
  }, []);

  // ── Initial fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    dispatch(fetchRideTracking({ rideId, breadcrumbs: 50 }));
    dispatch(fetchRideLive(rideId));

    if (bookingId && rideType === 'full_care_ride') {
      dispatch(fetchCareTrackingSnapshot({ bookingId }));
    }
  }, [rideId, bookingId, rideType, dispatch]);

  // ── Join socket room ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId || !connected) return;
    joinBookingRoom(bookingId);
    return () => leaveBookingRoom(bookingId);
  }, [bookingId, connected, joinBookingRoom, leaveBookingRoom]);

  // ── Socket event subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const EV = SOCKET_EVENTS;

    const unsubs = [
      // Driver GPS
      on(EV.LOCATION_UPDATE, (d) => {
        dispatch(socketLocationUpdate(d));
        addEvent('location_update', 'Driver location updated',
          d.speedKmh != null ? `${Math.round(d.speedKmh)} km/h` : null);
      }),

      // ETA
      on(EV.ETA_UPDATE, (d) => {
        dispatch(socketEtaUpdate(d));
        addEvent('eta_update', 'ETA updated',
          d.etaMinutes != null ? `${Math.round(d.etaMinutes)} min` : null);
      }),

      // Ride status
      on(EV.RIDE_STATUS_CHANGED, (d) => {
        dispatch(socketRideStatusChanged(d));
        addEvent('ride_status_changed', `Status → ${d.status}`, d.rideStage ?? null);
      }),

      // Navigation target
      on(EV.NAVIGATION_TARGET_CHANGED, (d) => {
        dispatch(socketNavigationTargetChanged(d));
        addEvent('navigation_target_changed', 'Navigation target changed', d.currentTarget);
      }),

      // Hospital ETA (both event names)
      on('hospital_eta_update', (d) => {
        dispatch(socketHospitalEtaUpdate(d));
        addEvent('hospital_eta_update', 'Hospital ETA updated',
          d.etaMinutes != null ? `${Math.round(d.etaMinutes)} min` : null);
      }),
      on('hospital:eta:update', (d) => {
        dispatch(socketHospitalEtaUpdate(d));
      }),

      // Care assistant tracking
      on('care-assistant:ride:tracking', (d) => {
        dispatch(socketCareAssistantTracking(d));
        addEvent('care_assistant_joined', 'Care assistant tracking update');
      }),

      // Care assistant location
      on('care_assistant_location_update', (d) => {
        dispatch(setCareAssistantLocation(d));
        addEvent('location_update', 'Care assistant location updated');
      }),

      // Care assistant status
      on('care_assistant_status_change', (d) => {
        dispatch(setCareAssistantStatus(d));
        addEvent('care_assistant_joined', `CA status → ${d.careAssistantStatus}`);
      }),

      // Care assistant joined
      on('care_assistant_joined_ride', (d) => {
        dispatch(setCareAssistantJoined(d));
        addEvent('care_assistant_joined_ride', 'Care assistant joined ride');
      }),
      on('care_assistant_attached_to_ride', (d) => {
        dispatch(setCareAssistantJoined(d));
        addEvent('care_assistant_joined_ride', 'Care assistant attached to ride');
      }),

      // Fine-grained ride status
      on('driver_accepted',  (d) => { dispatch(socketDriverAccepted(d));  addEvent('driver_en_route', 'Driver accepted ride'); }),
      on('driver_en_route',  (d) => { dispatch(socketDriverEnRoute(d));   addEvent('driver_en_route', 'Driver en route'); }),
      on('driver_arrived',   (d) => { dispatch(socketDriverArrived(d));   addEvent('driver_arrived',  'Driver arrived'); }),
      on('otp_verified',     (d) => { dispatch(socketOtpVerified(d));     addEvent('otp_verified',    'OTP verified'); }),
      on('ride_started',     (d) => { dispatch(socketRideStarted(d));     addEvent('ride_started',    'Ride started'); }),
      on('ride_completed',   (d) => { dispatch(socketRideCompleted(d));   addEvent('ride_completed',  'Ride completed'); }),
      on('ride_cancelled',   (d) => { dispatch(socketRideCancelled(d));   addEvent('ride_completed',  'Ride cancelled'); }),
      on('ride_assigned',    (d) => { dispatch(socketRideAssigned(d));    addEvent('ride_status_changed', 'Driver assigned'); }),

      // SOS
      on(EV.SOS_ALERT, (d) => {
        addEvent('sos_alert', '🚨 SOS Alert triggered', d.sosType ?? null);
      }),

      // Booking state snapshot (reconnect)
      on(EV.BOOKING_STATE_SNAPSHOT, (d) => {
        if (d.ride) dispatch(socketRideStatusChanged({ status: d.ride.status, rideStage: d.ride.rideStage, activeNavigationTarget: d.ride.activeNavigationTarget }));
        addEvent('ride_status_changed', 'State snapshot received');
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, dispatch]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const ride         = currentRide ?? trackingData?.ride ?? null;
  const tracking     = trackingData?.tracking ?? null;
  const milestones   = tracking?.milestones ?? [];
  const polyline     = tracking?.expectedRoutePolyline ?? null;
  const hasActiveSos = tracking?.hasActiveSos ?? socketLive?.hasActiveSos ?? false;

  const liveLocation = socketLive?.liveLocation ?? liveData?.liveLocation ?? null;
  const status       = socketLive?.status ?? ride?.status ?? null;
  const etaMinutes   = socketLive?.etaMinutes ?? tracking?.currentEtaMinutes ?? null;
  const etaTarget    = socketLive?.etaTarget  ?? tracking?.currentEtaTarget  ?? null;
  const navTarget    = socketLive?.activeNavigationTarget ?? activeNavTarget ?? ride?.activeNavigationTarget ?? null;
  const stage        = socketLive?.rideStage  ?? rideStage ?? ride?.rideStage ?? null;

  // Care assistant live location (from tracking snapshot or socket)
  const caLiveLocation = caLocation ?? careSnapshot?.careAssistant?.liveLocation ?? null;
  const caCurrentStatus = caStatus?.careAssistantStatus
    ?? careSnapshot?.careAssistant?.status
    ?? 'not_joined';

  return {
    // Ride data
    ride,
    tracking,
    milestones,
    polyline,
    hasActiveSos,

    // Live state
    liveLocation,
    status,
    etaMinutes,
    etaTarget,
    navTarget,
    rideStage: stage,
    hospitalEta,
    careAssistantTracking,

    // Care assistant
    careSnapshot,
    caLiveLocation,
    caCurrentStatus,
    caJoined,

    // Activity feed
    activityFeed,

    // Connection
    connected,
  };
}