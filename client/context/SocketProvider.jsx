/**
 * SocketProvider.jsx — Likeson.in
 *
 * Provides socket connection + booking room subscription to all children.
 * Exposes useSocket() hook for event subscriptions and emit helpers.
 *
 * Usage:
 *   <SocketProvider token={jwt} bookingId={activeBookingId}>
 *     <YourComponent />
 *   </SocketProvider>
 *
 *   const { socket, connected, bookingState, rideStops, participants, on } = useSocket();
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import socketService, { SOCKET_EVENTS } from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const SocketContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   token: string,
 *   bookingId?: string,
 *   tpId?: string,
 *   role?: string,        // 'customer' | 'driver' | 'solodriverpartner' | 'care_assistant' | 'transportpartner' | 'admin' | 'superadmin'
 *   enableGps?: boolean,  // driver auto-starts GPS if true
 *   isCareGps?: boolean,  // CA auto-starts care GPS if true
 *   children: React.ReactNode
 * }} props
 */
export function SocketProvider({
  token,
  bookingId,
  tpId,
  role,
  enableGps   = false,
  isCareGps   = false,
  children,
}) {
  const [connected,     setConnected]     = useState(false);
  const [bookingState,  setBookingState]  = useState(null);
  const [rideStops,     setRideStops]     = useState([]);
  const [participants,  setParticipants]  = useState([]);
  const [activeSos,     setActiveSos]     = useState([]);
  const [liveLocation,  setLiveLocation]  = useState(null);     // driver GPS
  const [caLocation,    setCaLocation]    = useState(null);     // CA GPS
  const [currentStop,   setCurrentStop]   = useState(null);     // active stop
  const [rideStatus,    setRideStatus]    = useState(null);

  // track cleanup fns from on() calls
  const unsubsRef = useRef([]);

  // ── Register + auto-cleanup listeners ──────────────────────────────────────

  const registerListener = useCallback((event, handler) => {
    const unsub = socketService.on(event, handler);
    unsubsRef.current.push(unsub);
    return unsub;
  }, []);

  // ── Init socket ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    const socket = socketService.init(token);

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
      // Don't destroy on unmount — singleton lives for app lifetime.
      // Caller calls socketService.destroy() on logout.
    };
  }, [token]);

  // ── Join booking room ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!bookingId || !connected) return;
    socketService.joinBookingRoom(bookingId);
    // Request initial state
    socketService.requestBookingState(bookingId);
    return () => {
      socketService.leaveBookingRoom(bookingId);
    };
  }, [bookingId, connected]);

  // ── Join TP room ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tpId || !connected) return;
    socketService.joinTpRoom(tpId);
    return () => {
      socketService.leaveTpRoom(tpId);
    };
  }, [tpId, connected]);

  // ── Auto GPS (driver) ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!enableGps || !connected || !bookingId) return;
    socketService.startGpsTracking({ bookingId });
    return () => socketService.stopGpsTracking();
  }, [enableGps, connected, bookingId]);

  // ── Auto GPS (care assistant) ──────────────────────────────────────────────

  useEffect(() => {
    if (!isCareGps || !connected || !bookingId) return;
    socketService.startCareGpsTracking({ bookingId });
    return () => socketService.stopCareGpsTracking();
  }, [isCareGps, connected, bookingId]);

  // ── Core event listeners ───────────────────────────────────────────────────

  useEffect(() => {
    if (!connected) return;

    const unsubs = [

      // Booking state snapshot (full initial state)
      registerListener(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, (data) => {
        setBookingState(data);
        setRideStatus(data?.ride?.status ?? null);
        if (data?.rideStops?.length) setRideStops(data.rideStops);
        if (data?.ride?.currentStop)  setCurrentStop(data.ride.currentStop);
        if (data?.activeSos?.length)  setActiveSos(data.activeSos);
      }),

      // Ride stops snapshot (on-demand request)
      registerListener(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, (data) => {
        if (data?.stops) setRideStops(data.stops);
      }),

      // Participants snapshot (on-demand request)
      registerListener(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, (data) => {
        if (data?.participants) setParticipants(data.participants);
      }),

      // Driver live location
      registerListener(SOCKET_EVENTS.LOCATION_UPDATE, (data) => {
        if (data?.lat && data?.lng) {
          setLiveLocation({ lat: data.lat, lng: data.lng, heading: data.heading, speed: data.speed, updatedAt: new Date() });
        }
      }),

      // CA live location
      registerListener(SOCKET_EVENTS.CARE_ASSISTANT_LOCATION_UPDATE, (data) => {
        if (data?.lat && data?.lng) {
          setCaLocation({ lat: data.lat, lng: data.lng, heading: data.heading, speed: data.speed, updatedAt: new Date() });
        }
      }),

      // Ride / booking status
      registerListener(SOCKET_EVENTS.BOOKING_STATUS_CHANGE, (data) => {
        setRideStatus(data?.status ?? null);
        setBookingState(prev => prev ? { ...prev, bookingStatus: data?.status } : prev);
      }),

      registerListener(SOCKET_EVENTS.RIDE_STATUS_CHANGED, (data) => {
        setRideStatus(data?.status ?? null);
      }),

      // Stop events — update stop list in place
      registerListener(SOCKET_EVENTS.STOP_ARRIVED, (data) => {
        setRideStops(prev => prev.map(s =>
          s.stopId?.toString() === data?.stopId?.toString()
            ? { ...s, status: 'ARRIVED', arrival: { actualAt: data?.timestamp } }
            : s
        ));
      }),

      registerListener(SOCKET_EVENTS.STOP_DEPARTED, (data) => {
        setRideStops(prev => prev.map(s =>
          s.stopId?.toString() === data?.departedStopId?.toString()
            ? { ...s, status: 'COMPLETED' }
            : s
        ));
        if (data?.nextStop) setCurrentStop(data.nextStop);
      }),

      registerListener(SOCKET_EVENTS.STOP_STATUS_CHANGED, (data) => {
        setRideStops(prev => prev.map(s =>
          s.stopId?.toString() === data?.stopId?.toString()
            ? { ...s, status: data.status }
            : s
        ));
      }),

      // Participant events — update participant list in place
      registerListener(SOCKET_EVENTS.PARTICIPANT_ASSIGNED, (data) => {
        // refetch full list on assign
        if (data?.rideId) socketService.requestParticipants({ rideId: data.rideId });
      }),

      registerListener(SOCKET_EVENTS.PARTICIPANT_STATUS_CHANGE, (data) => {
        setParticipants(prev => prev.map(p =>
          p.participantId?.toString() === data?.participantId?.toString()
            ? { ...p, status: data.status }
            : p
        ));
      }),

      registerListener(SOCKET_EVENTS.PARTICIPANT_REMOVED, (data) => {
        setParticipants(prev => prev.filter(
          p => p.participantId?.toString() !== data?.participantId?.toString()
        ));
      }),

      // SOS
      registerListener(SOCKET_EVENTS.SOS_ALERT, (data) => {
        setActiveSos(prev => [...prev, data]);
      }),

      registerListener(SOCKET_EVENTS.SOS_TRIGGERED, (data) => {
        setActiveSos(prev => [...prev, data]);
      }),

      registerListener(SOCKET_EVENTS.SOS_RESOLVED, (data) => {
        setActiveSos(prev => prev.filter(
          e => e.sosEventId?.toString() !== data?.sosEventId?.toString()
        ));
      }),

      // Join point recalculated — update CA join stop in rideStops
      registerListener(SOCKET_EVENTS.JOIN_POINT_RECALCULATED, (data) => {
        if (data?.rideId) {
          socketService.requestRideStops({ rideId: data.rideId });
        }
      }),

      // CA join point missed — admin notified; update local stop status
      registerListener(SOCKET_EVENTS.CA_MISSED_JOINPOINT, () => {
        setRideStops(prev => prev.map(s =>
          s.stopType === 'CARE_ASSISTANT_JOIN' ? { ...s, status: 'MISSED' } : s
        ));
      }),

      // Destination changed — update dropoff in bookingState
      registerListener(SOCKET_EVENTS.DESTINATION_CHANGED, (data) => {
        setBookingState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ride: prev.ride ? {
              ...prev.ride,
              dropoff: { coordinates: data?.newDestination, address: data?.newDestination?.address },
            } : prev.ride,
          };
        });
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub?.();
    };
  }, [connected, registerListener]);

  // ── Expose `on` for consumers wanting raw event access ─────────────────────

  /**
   * on — subscribe to a socket event from inside a component.
   * Returns unsubscribe function — call it in useEffect cleanup.
   *
   * @example
   * const { on } = useSocket();
   * useEffect(() => {
   *   const off = on(SOCKET_EVENTS.RIDE_COMPLETED, (data) => console.log(data));
   *   return off;
   * }, [on]);
   */
  const on = useCallback((event, handler) => {
    return socketService.on(event, handler);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    // Connection
    socket:    socketService,
    connected,

    // State snapshots
    bookingState,
    rideStops,
    participants,
    activeSos,
    liveLocation,
    caLocation,
    currentStop,
    rideStatus,

    // Event subscription
    on,

    // Emit helpers — expose directly for convenience
    joinBookingRoom:      socketService.joinBookingRoom.bind(socketService),
    leaveBookingRoom:     socketService.leaveBookingRoom.bind(socketService),
    requestBookingState:  socketService.requestBookingState.bind(socketService),
    requestRideStops:     socketService.requestRideStops.bind(socketService),
    requestParticipants:  socketService.requestParticipants.bind(socketService),
    emitCareLocation:     socketService.emitCareLocation.bind(socketService),
    emitCaMissedJoinpoint:socketService.emitCaMissedJoinpoint.bind(socketService),
    updateCareStatus:     socketService.updateCareStatus.bind(socketService),
    updateDriverStatus:   socketService.updateDriverStatus.bind(socketService),
    verifyOtp:            socketService.verifyOtp.bind(socketService),
    verifyOtpAsync:       socketService.verifyOtpAsync.bind(socketService),
    triggerSos:           socketService.triggerSos.bind(socketService),
    reportRouteDeviation: socketService.reportRouteDeviation.bind(socketService),
    pingHealth:           socketService.pingHealth.bind(socketService),
    startGpsTracking:     socketService.startGpsTracking.bind(socketService),
    stopGpsTracking:      socketService.stopGpsTracking.bind(socketService),
    startCareGpsTracking: socketService.startCareGpsTracking.bind(socketService),
    stopCareGpsTracking:  socketService.stopCareGpsTracking.bind(socketService),
    stopAllTracking:      socketService.stopAllTracking.bind(socketService),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
}

export default SocketProvider;