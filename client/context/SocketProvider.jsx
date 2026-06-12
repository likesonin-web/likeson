'use client';

/**
 * @file SocketProvider.jsx
 * @description Manages WebSocket connections and exposes hooks for real-time tracking, 
 * ride updates, and Care Assistant data flow.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';

import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader2,
  MapPin,
  Clock,
  Shield,
  ShieldAlert,
  Navigation,
} from 'lucide-react';

import socketService, {
  SOCKET_EVENTS,
  CLIENT_EVENTS,
  DRIVER_STATUS,
} from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const SocketContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS (Note: In production, move these to a /components directory)
// ─────────────────────────────────────────────────────────────────────────────

function ConnectionBadge({ status }) {
  // Encapsulated configuration logic - prevents global scope pollution
  const getBadgeConfig = (currentStatus) => {
    switch (currentStatus) {
      case 'connected':
        return { label: 'Live', Icon: Wifi, styles: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'connecting':
        return { label: 'Connecting…', Icon: Loader2, styles: 'bg-amber-500/10 text-amber-400 border-amber-500/30', isSpinning: true };
      case 'error':
        return { label: 'Error', Icon: AlertTriangle, styles: 'bg-red-500/10 text-red-500 border-red-500/30' };
      case 'disconnected':
      default:
        return { label: 'Offline', Icon: WifiOff, styles: 'bg-red-500/10 text-red-400 border-red-500/30' };
    }
  };

  const { label, Icon, styles, isSpinning } = getBadgeConfig(status);

  return (
// Replace this line inside your ConnectionBadge component:
<div className={`fixed top-4 right-4 z-10 font-inter flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium backdrop-blur-sm transition-all duration-300 ${styles}`}>
      <Icon size={12} className={isSpinning ? 'animate-spin' : ''} aria-hidden="true" />
      <span className="tracking-wide">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function SocketProvider({
  token,
  children,
  showStatusBadge = true,
  onConnect,
  onDisconnect,
}) {
  const [connStatus, setConnStatus] = useState('disconnected');
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (!token) {
      socketService.destroy();
      setConnStatus('disconnected');
      return;
    }

    setConnStatus('connecting');
    const sock = socketService.init(token);

    const handleConnect = () => {
      setConnStatus('connected');
      setLastError(null);
      if (onConnect) onConnect();
    };

    const handleDisconnect = (reason) => {
      setConnStatus('disconnected');
      if (onDisconnect) onDisconnect(reason);
    };

    const handleError = () => setConnStatus('error');
    const handleConnectError = (err) => {
      setLastError(err.message);
      setConnStatus('error');
    };

    sock.on('connect', handleConnect);
    sock.on('disconnect', handleDisconnect);
    sock.on('error', handleError);
    sock.on('connect_error', handleConnectError);

    return () => {
      sock.off('connect', handleConnect);
      sock.off('disconnect', handleDisconnect);
      sock.off('error', handleError);
      sock.off('connect_error', handleConnectError);
      socketService.destroy();
      setConnStatus('disconnected');
    };
  }, [token, onConnect, onDisconnect]);

  // Memoize context to prevent unnecessary re-renders in consumer components
  const contextValue = useMemo(() => ({
    connected: connStatus === 'connected',
    connStatus,
    lastError,

    // Base Socket Ops
    on: socketService.on.bind(socketService),
    off: socketService.off.bind(socketService),
    once: socketService.once.bind(socketService),
    emit: socketService.emit.bind(socketService),

    // Rooms
    joinBookingRoom: socketService.joinBookingRoom.bind(socketService),
    leaveBookingRoom: socketService.leaveBookingRoom.bind(socketService),
    joinTpRoom: socketService.joinTpRoom.bind(socketService),
    leaveTpRoom: socketService.leaveTpRoom.bind(socketService),

    // Driver Tracking
    startGpsTracking: socketService.startGpsTracking.bind(socketService),
    stopGpsTracking: socketService.stopGpsTracking.bind(socketService),

    // Care Assistant Tracking
    startCareGpsTracking: socketService.startCareGpsTracking.bind(socketService),
    stopCareGpsTracking: socketService.stopCareGpsTracking.bind(socketService),
    emitCareLocation: socketService.emitCareLocation.bind(socketService),

    // Generic
    emitLocation: socketService.emitLocation.bind(socketService),
    updateDriverStatus: socketService.updateDriverStatus.bind(socketService),

    // OTP & Security
    verifyOtp: socketService.verifyOtp.bind(socketService),
    verifyOtpAsync: socketService.verifyOtpAsync.bind(socketService),
    requestOtpResend: socketService.requestOtpResend.bind(socketService),
    triggerSos: socketService.triggerSos.bind(socketService),

    // Routing & State
    reportRouteDeviation: socketService.reportRouteDeviation.bind(socketService),
    requestBookingState: socketService.requestBookingState.bind(socketService),
    requestBookingStateAsync: socketService.requestBookingStateAsync.bind(socketService),
    pingHealth: socketService.pingHealth.bind(socketService),

    // Constants exported to context
    SOCKET_EVENTS,
    CLIENT_EVENTS,
    DRIVER_STATUS,
  }), [connStatus, lastError]);

  return (
    <SocketContext.Provider value={contextValue}>
      {showStatusBadge && <ConnectionBadge status={connStatus} />}
      {children}
    </SocketContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a <SocketProvider>');
  }
  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useBookingRoom(bookingId) {
  const socketCtx = useSocket();
  const { on, connected, joinBookingRoom, leaveBookingRoom, requestBookingState, SOCKET_EVENTS: EV } = socketCtx;

  const [roomState, setRoomState] = useState({
    joined: false,
    locationUpdate: null,
    etaUpdate: null,
    rideStatus: null,
    bookingStatus: null,
    navigationTarget: null,
    sosAlert: null,
    routeDeviation: null,
    snapshot: null,
    hospitalEta: null,
    caLocationUpdate: null,
    caStatusChange: null,
    caJoinedRide: null,
    caAttached: null,
  });

  const [isCareAssistantOnly, setIsCareAssistantOnly] = useState(false);

  useEffect(() => {
    if (!bookingId || !connected) return;

    joinBookingRoom(bookingId);
    
    // Using a cleaner state update pattern for enterprise scale
    const handleUpdate = (key) => (data) => setRoomState((prev) => ({ ...prev, [key]: data }));

    const unsubs = [
      on(EV.JOINED_ROOM, (d) => { if (d.bookingId === bookingId) handleUpdate('joined')(true); }),
      on(EV.LOCATION_UPDATE, handleUpdate('locationUpdate')),
      on(EV.ETA_UPDATE, handleUpdate('etaUpdate')),
      on(EV.HOSPITAL_ETA_UPDATE, handleUpdate('hospitalEta')),
      on('hospital:eta:update', handleUpdate('hospitalEta')),
      on(EV.RIDE_STATUS_CHANGED, handleUpdate('rideStatus')),
      on(EV.BOOKING_STATUS_CHANGE, handleUpdate('bookingStatus')),
      on(EV.NAVIGATION_TARGET_CHANGED, handleUpdate('navigationTarget')),
      on(EV.SOS_ALERT, handleUpdate('sosAlert')),
      on(EV.ROUTE_DEVIATION_ALERT, handleUpdate('routeDeviation')),

      on(EV.BOOKING_STATE_SNAPSHOT, (d) => {
        handleUpdate('snapshot')(d);
        if (d?.bookingType === 'care_assistant') setIsCareAssistantOnly(true);
      }),

      on(EV.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
        handleUpdate('caLocationUpdate')(d);
        if (isCareAssistantOnly) handleUpdate('locationUpdate')(d);
      }),

      on(EV.CARE_ASSISTANT_STATUS_CHANGE, handleUpdate('caStatusChange')),

      on(EV.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        handleUpdate('caJoinedRide')(d);
        if (d?.caJoinPoint) {
          setRoomState((prev) => ({
            ...prev,
            snapshot: prev.snapshot ? { ...prev.snapshot, route: { ...prev.snapshot.route, caJoinWaypoint: d.caJoinPoint } } : null
          }));
        }
      }),

      

on('care_assistant_at_jp', (d) => {
  setRoomState((prev) => ({
    ...prev,
    caStatusChange: { ...d, careAssistantStatus: 'at_pickup' },
  }));
}),

on('ca_join_waypoint_completed', (d) => {
  setRoomState((prev) => {
    // Mark JP as completed in snapshot
    const updatedSnapshot = prev.snapshot
      ? {
          ...prev.snapshot,
          fullCareRide: prev.snapshot.fullCareRide
            ? {
                ...prev.snapshot.fullCareRide,
                caJoinPoint: prev.snapshot.fullCareRide.caJoinPoint
                  ? { ...prev.snapshot.fullCareRide.caJoinPoint, isCompleted: true }
                  : prev.snapshot.fullCareRide.caJoinPoint,
              }
            : prev.snapshot.fullCareRide,
          route: prev.snapshot.route
            ? {
                ...prev.snapshot.route,
                caJoinWaypoint: prev.snapshot.route.caJoinWaypoint
                  ? { ...prev.snapshot.route.caJoinWaypoint, isCompleted: true }
                  : prev.snapshot.route.caJoinWaypoint,
              }
            : prev.snapshot.route,
        }
      : prev.snapshot;
    return { ...prev, snapshot: updatedSnapshot, jpWaypointCompleted: d };
  });
}),

      on(EV.CARE_ASSISTANT_ATTACHED, (d) => {
        handleUpdate('caAttached')(d);
        if (d?.caJoinPoint) {
          setRoomState((prev) => ({
            ...prev,
            snapshot: prev.snapshot ? { ...prev.snapshot, route: { ...prev.snapshot.route, caJoinWaypoint: d.caJoinPoint } } : null
          }));
        }
      }),
    ];

    requestBookingState(bookingId);

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe?.());
      leaveBookingRoom(bookingId);
      setRoomState((prev) => ({ ...prev, joined: false }));
      setIsCareAssistantOnly(false);
    };
  }, [bookingId, connected, joinBookingRoom, leaveBookingRoom, on, requestBookingState, EV, isCareAssistantOnly]);

  return {
    ...roomState,
    isCareAssistantOnly,
  };
}

export function useCareTracking({ bookingId, bookingType, autoStart = false } = {}) {
  const {
    on, connected,
    startCareGpsTracking, stopCareGpsTracking,
    emitCareLocation, SOCKET_EVENTS: EV,
  } = useSocket();

  const isCareOnly     = bookingType === 'care_assistant';
  const isFullCareRide = bookingType === 'full_care_ride';

  const [caLiveLocation,  setCaLiveLocation]  = useState(null);
  const [caStatus,        setCaStatus]        = useState('not_joined');
  const [joinPoint,       setJoinPoint]       = useState(null);
  const [caJoinedAt,      setCaJoinedAt]      = useState(null);
  const [tracking,        setTracking]        = useState(false);

  // NEW: view mode state
  const [caViewMode,      setCaViewMode]      = useState(
    isFullCareRide ? 'navigate_to_jp' : null
  );
  const [caAtJoinPoint,   setCaAtJoinPoint]   = useState(false);
  const [caHasJoined,     setCaHasJoined]     = useState(false);

  useEffect(() => {
    if (!bookingId || !connected) return;

    const unsubs = [
      on(EV.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setCaLiveLocation({
          lat:       d.lat,
          lng:       d.lng,
          heading:   d.heading,
          speed:     d.speed,
          updatedAt: d.updatedAt,
        });
      }),

      on(EV.CARE_ASSISTANT_STATUS_CHANGE, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        const newStatus = d?.careAssistantStatus ?? null;
        if (newStatus) setCaStatus(newStatus);
        // If at_pickup → CA is waiting at JP
        if (newStatus === 'at_pickup') setCaAtJoinPoint(true);
      }),

      // CA reached JP
      on('care_assistant_at_jp', (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setCaStatus('at_pickup');
        setCaAtJoinPoint(true);
      }),

      // CA joined ride → switch view mode
      on(EV.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setCaJoinedAt(d?.joinedAt ?? new Date().toISOString());
        setCaStatus('in_ride');
        setCaHasJoined(true);
        setCaAtJoinPoint(false);
        // VIEW MODE SWITCH: CA now tracks driver only
        setCaViewMode('driver_tracking_only');
        if (d?.caJoinPoint) setJoinPoint(d.caJoinPoint);
      }),

      on(EV.CARE_ASSISTANT_ATTACHED, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        if (d?.caJoinPoint) setJoinPoint(d.caJoinPoint);
        setCaStatus('en_route_to_pickup');
        if (isFullCareRide) setCaViewMode('navigate_to_jp');
      }),

      // JP waypoint completed by driver
      on('ca_join_waypoint_completed', (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setJoinPoint(prev => prev ? { ...prev, isCompleted: true } : prev);
      }),
    ];

    return () => unsubs.forEach((fn) => fn?.());
  }, [bookingId, connected, on, EV, isFullCareRide]);

  const startTracking = useCallback((statusOverride) => {
    startCareGpsTracking({
      bookingId,
      status: statusOverride ?? (isCareOnly ? 'en_route_to_pickup' : undefined),
    });
    setTracking(true);
  }, [bookingId, isCareOnly, startCareGpsTracking]);

  const stopTracking = useCallback(() => {
    stopCareGpsTracking();
    setTracking(false);
  }, [stopCareGpsTracking]);

  const pingLocation = useCallback(({ lat, lng, heading, speed, status } = {}) => {
    emitCareLocation({ bookingId, lat, lng, heading, speed, status });
  }, [bookingId, emitCareLocation]);

  useEffect(() => {
    if (autoStart && connected) startTracking();
    return () => { if (autoStart) stopTracking(); };
  }, [autoStart, connected, startTracking, stopTracking]);

  return {
    caLiveLocation,
    caStatus,
    joinPoint,
    caJoinedAt,
    tracking,
    startTracking,
    stopTracking,
    pingLocation,
    isCareOnly,
    isFullCareRide,
    // NEW view mode fields
    caViewMode,
    caAtJoinPoint,
    caHasJoined,
    hasBoardedRide:  caStatus === 'in_ride' || caHasJoined,
    isAtJoinPoint:   caStatus === 'at_pickup' || caAtJoinPoint,
  };
}

export function useDriverStatus({ bookingId, rideId } = {}) {
  const { updateDriverStatus, on, SOCKET_EVENTS: EV, DRIVER_STATUS: DS } = useSocket();
  const [ack, setAck] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubAck = on(EV.STATUS_UPDATE_ACK, (d) => { setAck(d); setLoading(false); });
    const unsubErr = on(EV.ERROR, (d) => { setError(d?.message); setLoading(false); });
    return () => { unsubAck?.(); unsubErr?.(); };
  }, [on, EV]);

  const send = useCallback((status, extras = {}) => {
    setLoading(true);
    setError(null);
    updateDriverStatus({ bookingId, rideId, status, ...extras });
  }, [bookingId, rideId, updateDriverStatus]);

  return { send, ack, error, loading, DRIVER_STATUS: DS };
}

export function useOtp({ bookingId, rideId } = {}) {
  const { verifyOtpAsync, requestOtpResend, on, SOCKET_EVENTS: EV } = useSocket();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  useEffect(() => {
    const unsubWrong = on(EV.OTP_WRONG_ATTEMPT, () => setWrongAttempts((n) => n + 1));
    return () => unsubWrong?.();
  }, [on, EV]);

  const verify = useCallback(async (otp) => {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOtpAsync({ bookingId, rideId, otp });
      setResult(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [bookingId, rideId, verifyOtpAsync]);

  const resend = useCallback(() => requestOtpResend(bookingId), [bookingId, requestOtpResend]);

  return { verify, resend, result, error, loading, wrongAttempts };
}

export function useSos(bookingId, rideId) {
  const { triggerSos, on, SOCKET_EVENTS: EV } = useSocket();
  const [sosActive, setSosActive] = useState(false);
  const [sosData, setSosData] = useState(null);
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    const unsubAlert = on(EV.SOS_ALERT, (d) => { setSosActive(true); setSosData(d); });
    const unsubAck = on(EV.SOS_ACK, () => setAcked(true));
    return () => { unsubAlert?.(); unsubAck?.(); };
  }, [on, EV]);

  const trigger = useCallback(({ sosType = 'other', description, lat, lng } = {}) => {
    triggerSos({ bookingId, rideId, sosType, description, lat, lng });
  }, [bookingId, rideId, triggerSos]);

  const dismiss = useCallback(() => setSosActive(false), []);

  return { trigger, dismiss, sosActive, sosData, acked };
}

export function useGpsTracking({ bookingId, autoStart = false } = {}) {
  const { startGpsTracking, stopGpsTracking } = useSocket();
  const [tracking, setTracking] = useState(false);

  const start = useCallback(() => {
    startGpsTracking({ bookingId });
    setTracking(true);
  }, [bookingId, startGpsTracking]);

  const stop = useCallback(() => {
    stopGpsTracking();
    setTracking(false);
  }, [stopGpsTracking]);

  useEffect(() => {
    if (autoStart) start();
    return () => { if (autoStart) stop(); };
  }, [autoStart, start, stop]);

  return { start, stop, tracking };
}

export function useConnectionStatus() {
  const { connected, connStatus, lastError, pingHealth, on, SOCKET_EVENTS: EV } = useSocket();
  const [latencyMs, setLatencyMs] = useState(null);

  const ping = useCallback(() => {
    const t0 = Date.now();
    pingHealth();
    const unsub = on(EV.PONG_HEALTH, () => {
      setLatencyMs(Date.now() - t0);
      unsub?.();
    });
  }, [pingHealth, on, EV]);

  return { connected, connStatus, lastError, latencyMs, ping };
}

export function useAdminOps({ maxFeed = 50 } = {}) {
  const { on, SOCKET_EVENTS: EV } = useSocket();
  const [feed, setFeed] = useState([]);
  const [driversOnline, setDriversOnline] = useState({});

  const addFeed = useCallback((type, data) => {
    setFeed((prev) => [{ type, data, ts: new Date().toISOString() }, ...prev].slice(0, maxFeed));
  }, [maxFeed]);

  useEffect(() => {
    const unsubs = [
      on(EV.DRIVER_LOCATION, (d) => setDriversOnline((prev) => ({ ...prev, [d.driverObjectId]: d }))),
      on(EV.DRIVER_ONLINE, (d) => { addFeed('driver_online', d); setDriversOnline((prev) => ({ ...prev, [d.driverObjectId]: d })); }),
      on(EV.DRIVER_OFFLINE, (d) => { 
        addFeed('driver_offline', d); 
        setDriversOnline((prev) => { const n = { ...prev }; delete n[d.driverObjectId]; return n; }); 
      }),
      on(EV.RIDE_STATUS_CHANGED, (d) => addFeed('ride_status', d)),
      on(EV.BOOKING_STATUS_CHANGE, (d) => addFeed('booking_status', d)),
      on(EV.SOS_ALERT, (d) => addFeed('sos', d)),
      on(EV.OTP_FOR_ADMIN, (d) => addFeed('otp', d)),
      on(EV.OTP_FAILED_ATTEMPT, (d) => addFeed('otp_fail', d)),
      on(EV.ROUTE_DEVIATION_ALERT, (d) => addFeed('deviation', d)),
      on(EV.CARE_ASSISTANT_ATTACHED, (d) => addFeed('ca_attached', d)),
      on(EV.CARE_ASSISTANT_JOINED_RIDE, (d) => addFeed('ca_joined', d)),
      on(EV.CARE_ASSISTANT_STATUS_CHANGE, (d) => addFeed('ca_status_change', d)),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe?.());
  }, [on, EV, addFeed]);

  return { feed, driversOnline };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED UI BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export function LiveEtaBadge({ bookingId }) {
  const { etaUpdate } = useBookingRoom(bookingId);
  if (!etaUpdate) return null;
  
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white font-inter">
      <Clock size={14} className="text-amber-400" aria-hidden="true" />
      <span className="font-medium">{etaUpdate.etaMinutes} min</span>
      <span className="text-slate-400" aria-hidden="true">·</span>
      <MapPin size={12} className="text-slate-400" aria-hidden="true" />
      <span className="text-slate-400">{etaUpdate.distanceRemainingKm} km</span>
      <Navigation size={12} className="text-emerald-400" aria-hidden="true" />
      <span className="text-emerald-400 capitalize">{etaUpdate.currentTarget}</span>
    </div>
  );
}

export function SosButton({ bookingId, rideId }) {
  const { trigger, sosActive, dismiss } = useSos(bookingId, rideId);
  
  if (sosActive) {
    return (
      <button 
        onClick={dismiss} 
        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white font-bold animate-pulse font-inter focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        aria-label="Dismiss SOS"
      >
        <ShieldAlert size={16} aria-hidden="true" />
        SOS Active — Tap to dismiss
      </button>
    );
  }

  return (
    <button 
      onClick={() => trigger({ sosType: 'safety' })} 
      className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/40 px-4 py-2 text-red-400 font-medium hover:bg-red-500/20 transition-colors font-inter focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      aria-label="Trigger SOS"
    >
      <Shield size={16} aria-hidden="true" />
      SOS
    </button>
  );
}

export { SOCKET_EVENTS, CLIENT_EVENTS, DRIVER_STATUS };
export default SocketProvider;