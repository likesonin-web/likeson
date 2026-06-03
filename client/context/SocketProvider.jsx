'use client';
/**
 * SocketProvider.jsx — Likeson.in
 *
 * FIXES:
 * 1. useBookingRoom: add listeners for all CA events:
 *    - care_assistant_location_update
 *    - care_assistant_status_change
 *    - care_assistant_joined_ride
 *    - care_assistant_attached_to_ride
 * 2. SocketProvider ctx: expose startCareGpsTracking, stopCareGpsTracking, emitCareLocation
 * 3. New hook: useCareTracking — full CA tracking hook for care_assistant + full_care_ride
 * 4. useBookingRoom: detect bookingType from snapshot and expose isCareAssistantOnly flag
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  Wifi, WifiOff, AlertTriangle, Loader2,
  MapPin, Clock, Shield, ShieldAlert, Navigation,
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
// CONNECTION STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  connected:    { label: 'Live',        icon: Wifi,          cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  connecting:   { label: 'Connecting…', icon: Loader2,       cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  disconnected: { label: 'Offline',     icon: WifiOff,       cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  error:        { label: 'Error',       icon: AlertTriangle, cls: 'bg-red-500/10 text-red-500 border-red-500/30' },
};

function ConnectionBadge({ status }) {
  const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
  const Icon = cfg.icon;
  return (
    <div className={`fixed bottom-3 right-3 z-50 font-inter flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium backdrop-blur-sm transition-all duration-300 ${cfg.cls}`}>
      <Icon size={12} className={status === 'connecting' ? 'animate-spin' : ''} />
      <span className="tracking-wide">{cfg.label}</span>
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
  const [lastError,  setLastError]  = useState(null);

  useEffect(() => {
    if (!token) {
      socketService.destroy();
      setConnStatus('disconnected');
      return;
    }

    setConnStatus('connecting');
    const sock = socketService.init(token);

    const onConn  = () => { setConnStatus('connected'); setLastError(null); onConnect?.(); };
    const onDisc  = (reason) => { setConnStatus('disconnected'); onDisconnect?.(reason); };
    const onErr   = () => setConnStatus('error');
    const onCErr  = (err) => { setLastError(err.message); setConnStatus('error'); };

    sock.on('connect',       onConn);
    sock.on('disconnect',    onDisc);
    sock.on('error',         onErr);
    sock.on('connect_error', onCErr);

    return () => {
      sock.off('connect',       onConn);
      sock.off('disconnect',    onDisc);
      sock.off('error',         onErr);
      sock.off('connect_error', onCErr);
      socketService.destroy();
      setConnStatus('disconnected');
    };
  }, [token]); // eslint-disable-line

  const ctx = {
    connected:  connStatus === 'connected',
    connStatus,
    lastError,

    on:   socketService.on.bind(socketService),
    off:  socketService.off.bind(socketService),
    once: socketService.once.bind(socketService),
    emit: socketService.emit.bind(socketService),

    joinBookingRoom:  socketService.joinBookingRoom.bind(socketService),
    leaveBookingRoom: socketService.leaveBookingRoom.bind(socketService),
    joinTpRoom:       socketService.joinTpRoom.bind(socketService),
    leaveTpRoom:      socketService.leaveTpRoom.bind(socketService),

    // Driver GPS
    startGpsTracking: socketService.startGpsTracking.bind(socketService),
    stopGpsTracking:  socketService.stopGpsTracking.bind(socketService),

    // FIX: expose CA GPS methods
    startCareGpsTracking: socketService.startCareGpsTracking.bind(socketService),
    stopCareGpsTracking:  socketService.stopCareGpsTracking.bind(socketService),
    emitCareLocation:     socketService.emitCareLocation.bind(socketService),

    // Generic location emit (isCare flag)
    emitLocation: socketService.emitLocation.bind(socketService),

    // Driver
    updateDriverStatus: socketService.updateDriverStatus.bind(socketService),

    // OTP
    verifyOtp:          socketService.verifyOtp.bind(socketService),
    verifyOtpAsync:     socketService.verifyOtpAsync.bind(socketService),
    requestOtpResend:   socketService.requestOtpResend.bind(socketService),

    // SOS
    triggerSos: socketService.triggerSos.bind(socketService),

    // Route
    reportRouteDeviation: socketService.reportRouteDeviation.bind(socketService),

    // State snapshot
    requestBookingState:      socketService.requestBookingState.bind(socketService),
    requestBookingStateAsync: socketService.requestBookingStateAsync.bind(socketService),

    // Health
    pingHealth: socketService.pingHealth.bind(socketService),

    SOCKET_EVENTS,
    CLIENT_EVENTS,
    DRIVER_STATUS,
  };

  return (
    <SocketContext.Provider value={ctx}>
      {showStatusBadge && <ConnectionBadge status={connStatus} />}
      {children}
    </SocketContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be inside <SocketProvider>');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING ROOM HOOK
// FIX: added all CA event listeners
// ─────────────────────────────────────────────────────────────────────────────

export function useBookingRoom(bookingId) {
  const {
    on, connected,
    joinBookingRoom, leaveBookingRoom,
    requestBookingState,
    SOCKET_EVENTS: EV,
  } = useSocket();

  const [joined,           setJoined]           = useState(false);
  const [locationUpdate,   setLocationUpdate]   = useState(null);  // driver
  const [etaUpdate,        setEtaUpdate]        = useState(null);
  const [rideStatus,       setRideStatus]       = useState(null);
  const [bookingStatus,    setBookingStatus]    = useState(null);
  const [navigationTarget, setNavTarget]        = useState(null);
  const [sosAlert,         setSosAlert]         = useState(null);
  const [routeDeviation,   setRouteDeviation]   = useState(null);
  const [snapshot,         setSnapshot]         = useState(null);

  // FIX: CA-specific state in this hook
  const [caLocationUpdate, setCaLocationUpdate] = useState(null);
  const [caStatusChange,   setCaStatusChange]   = useState(null);
  const [caJoinedRide,     setCaJoinedRide]     = useState(null);
  const [caAttached,       setCaAttached]       = useState(null);
  const [hospitalEta,      setHospitalEta]      = useState(null);

  // Derived: is this a care_assistant-only booking (no driver)?
  // Populated once snapshot arrives
  const [isCareAssistantOnly, setIsCareAssistantOnly] = useState(false);

  useEffect(() => {
    if (!bookingId || !connected) return;

    joinBookingRoom(bookingId);

    const unsubs = [
      // Room join ack
      on(EV.JOINED_ROOM, (d) => {
        if (d.bookingId === bookingId) setJoined(true);
      }),

      // Driver location (full_care_ride, patient_transport)
      on(EV.LOCATION_UPDATE, setLocationUpdate),

      // ETA
      on(EV.ETA_UPDATE, setEtaUpdate),

      // Hospital ETA (both event name variants)
      on(EV.HOSPITAL_ETA_UPDATE,   (d) => setHospitalEta(d)),
      on('hospital:eta:update',    (d) => setHospitalEta(d)),

      // Ride / booking status
      on(EV.RIDE_STATUS_CHANGED,       setRideStatus),
      on(EV.BOOKING_STATUS_CHANGE,     setBookingStatus),
      on(EV.NAVIGATION_TARGET_CHANGED, setNavTarget),

      // SOS / deviation
      on(EV.SOS_ALERT,            setSosAlert),
      on(EV.ROUTE_DEVIATION_ALERT,setRouteDeviation),

      // State snapshot (reconnect)
      on(EV.BOOKING_STATE_SNAPSHOT, (d) => {
        setSnapshot(d);
        // Detect care_assistant booking type from snapshot
        if (d?.bookingType === 'care_assistant') {
          setIsCareAssistantOnly(true);
        }
      }),

      // ── FIX: CA events ────────────────────────────────────────────────────

      // CA GPS ping → booking room (PRIMARY for care_assistant booking)
      on(EV.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
        setCaLocationUpdate(d);
        // For care_assistant booking, mirror to locationUpdate so existing
        // map components using locationUpdate still render the moving pin
        if (isCareAssistantOnly) {
          setLocationUpdate(d);
        }
      }),

      // CA status transition
      on(EV.CARE_ASSISTANT_STATUS_CHANGE, (d) => {
        setCaStatusChange(d);
      }),

      // CA joins ride (mid-route for full_care_ride, or at patient for care_assistant)
      on(EV.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        setCaJoinedRide(d);
        // Once CA joins, update snapshot join point if present
        if (d?.caJoinPoint) {
          setSnapshot(prev => prev
            ? { ...prev, route: { ...(prev.route ?? {}), caJoinWaypoint: d.caJoinPoint } }
            : prev
          );
        }
      }),

      // Admin assigns CA to an already-active ride (full_care_ride)
      on(EV.CARE_ASSISTANT_ATTACHED, (d) => {
        setCaAttached(d);
        // Patch join point into snapshot immediately so map re-renders
        if (d?.caJoinPoint) {
          setSnapshot(prev => prev
            ? { ...prev, route: { ...(prev.route ?? {}), caJoinWaypoint: d.caJoinPoint } }
            : prev
          );
        }
      }),
    ];

    // Request state snapshot on join (handles reconnects)
    requestBookingState(bookingId);

    return () => {
      unsubs.forEach((fn) => fn?.());
      leaveBookingRoom(bookingId);
      setJoined(false);
      setIsCareAssistantOnly(false);
    };
  }, [bookingId, connected]); // eslint-disable-line

  return {
    // Standard
    joined,
    locationUpdate,    // driver GPS (or mirrored CA for care_assistant type)
    etaUpdate,
    rideStatus,
    bookingStatus,
    navigationTarget,
    sosAlert,
    routeDeviation,
    snapshot,
    hospitalEta,

    // FIX: CA-specific
    caLocationUpdate,  // raw CA GPS payload
    caStatusChange,    // CA status transition payload
    caJoinedRide,      // CA joined ride payload
    caAttached,        // CA attached to ride (with caJoinPoint)

    // Derived
    isCareAssistantOnly, // true when bookingType === 'care_assistant'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX: useCareTracking — dedicated hook for CA tracking screens
//
// Handles both booking types:
//   care_assistant  → CA is sole tracked entity (no driver)
//   full_care_ride  → CA is secondary tracked entity (driver is primary)
//
// Usage:
//   const { caLiveLocation, joinPoint, caStatus, startTracking, stopTracking }
//     = useCareTracking({ bookingId, bookingType });
// ─────────────────────────────────────────────────────────────────────────────

export function useCareTracking({ bookingId, bookingType, autoStart = false } = {}) {
  const {
    on, connected,
    startCareGpsTracking, stopCareGpsTracking,
    emitCareLocation,
    SOCKET_EVENTS: EV,
  } = useSocket();

  const isCareOnly     = bookingType === 'care_assistant';
  const isFullCareRide = bookingType === 'full_care_ride';

  const [caLiveLocation,  setCaLiveLocation]  = useState(null);
  const [caStatus,        setCaStatus]        = useState(null);
  const [joinPoint,       setJoinPoint]       = useState(null);
  const [caJoinedAt,      setCaJoinedAt]      = useState(null);
  const [tracking,        setTracking]        = useState(false);

  useEffect(() => {
    if (!bookingId || !connected) return;

    const unsubs = [
      // CA GPS → updates map pin
      on(EV.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setCaLiveLocation({ lat: d.lat, lng: d.lng, heading: d.heading, speed: d.speed, updatedAt: d.updatedAt });
      }),

      // CA status change
      on(EV.CARE_ASSISTANT_STATUS_CHANGE, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setCaStatus(d?.careAssistantStatus ?? null);
      }),

      // CA joins ride (full_care_ride: CA boards at join point)
      on(EV.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        setCaJoinedAt(d?.joinedAt ?? new Date().toISOString());
        setCaStatus('in_ride');
        if (d?.caJoinPoint) setJoinPoint(d.caJoinPoint);
      }),

      // Admin assigns CA — join point computed and sent
      on(EV.CARE_ASSISTANT_ATTACHED, (d) => {
        if (d?.bookingId && d.bookingId !== bookingId) return;
        if (d?.caJoinPoint) setJoinPoint(d.caJoinPoint);
        setCaStatus('en_route_to_pickup');
      }),
    ];

    return () => unsubs.forEach((fn) => fn?.());
  }, [bookingId, connected]); // eslint-disable-line

  // Start / stop CA GPS broadcast
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

  // Single manual ping (for when autoGPS is off)
  const pingLocation = useCallback(({ lat, lng, heading, speed, status } = {}) => {
    emitCareLocation({ bookingId, lat, lng, heading, speed, status });
  }, [bookingId, emitCareLocation]);

  useEffect(() => {
    if (autoStart && connected) startTracking();
    return () => { if (autoStart) stopTracking(); };
  }, [autoStart, connected]); // eslint-disable-line

  return {
    // Live state
    caLiveLocation,   // { lat, lng, heading, speed, updatedAt }
    caStatus,         // 'not_joined'|'en_route_to_pickup'|'at_pickup'|'in_ride'|'departed'
    joinPoint,        // { coordinates, zone, distCaToJoinKm, caRoute } — full_care_ride only
    caJoinedAt,

    // GPS control
    tracking,
    startTracking,
    stopTracking,
    pingLocation,

    // Derived flags
    isCareOnly,
    isFullCareRide,
    hasBoardedRide: caStatus === 'in_ride',
    isAtJoinPoint:  caStatus === 'at_pickup',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER STATUS HOOK (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function useDriverStatus({ bookingId, rideId } = {}) {
  const { updateDriverStatus, on, SOCKET_EVENTS: EV, DRIVER_STATUS: DS } = useSocket();
  const [ack,     setAck]    = useState(null);
  const [error,   setError]  = useState(null);
  const [loading, setLoading]= useState(false);

  useEffect(() => {
    const unsubAck = on(EV.STATUS_UPDATE_ACK, (d) => { setAck(d);           setLoading(false); });
    const unsubErr = on(EV.ERROR,             (d) => { setError(d?.message); setLoading(false); });
    return () => { unsubAck?.(); unsubErr?.(); };
  }, []); // eslint-disable-line

  const send = useCallback((status, extras = {}) => {
    setLoading(true);
    setError(null);
    updateDriverStatus({ bookingId, rideId, status, ...extras });
  }, [bookingId, rideId, updateDriverStatus]);

  return { send, ack, error, loading, DRIVER_STATUS: DS };
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP HOOK (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function useOtp({ bookingId, rideId } = {}) {
  const { verifyOtpAsync, requestOtpResend, on, SOCKET_EVENTS: EV } = useSocket();
  const [result,        setResult]       = useState(null);
  const [error,         setError]        = useState(null);
  const [loading,       setLoading]      = useState(false);
  const [wrongAttempts, setWrongAttempts]= useState(0);

  useEffect(() => {
    const unsubWrong = on(EV.OTP_WRONG_ATTEMPT, () => setWrongAttempts((n) => n + 1));
    return () => unsubWrong?.();
  }, []); // eslint-disable-line

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

// ─────────────────────────────────────────────────────────────────────────────
// SOS HOOK (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function useSos(bookingId, rideId) {
  const { triggerSos, on, SOCKET_EVENTS: EV } = useSocket();
  const [sosActive, setSosActive] = useState(false);
  const [sosData,   setSosData]   = useState(null);
  const [acked,     setAcked]     = useState(false);

  useEffect(() => {
    const unsubAlert = on(EV.SOS_ALERT, (d) => { setSosActive(true); setSosData(d); });
    const unsubAck   = on(EV.SOS_ACK,  () => setAcked(true));
    return () => { unsubAlert?.(); unsubAck?.(); };
  }, []); // eslint-disable-line

  const trigger = useCallback(({ sosType = 'other', description, lat, lng } = {}) => {
    triggerSos({ bookingId, rideId, sosType, description, lat, lng });
  }, [bookingId, rideId, triggerSos]);

  const dismiss = useCallback(() => setSosActive(false), []);

  return { trigger, dismiss, sosActive, sosData, acked };
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS HOOK (driver) (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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
    return () => stop();
  }, [autoStart]); // eslint-disable-line

  return { start, stop, tracking };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION STATUS HOOK (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPS HOOK (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminOps({ maxFeed = 50 } = {}) {
  const { on, SOCKET_EVENTS: EV } = useSocket();
  const [feed,          setFeed]          = useState([]);
  const [driversOnline, setDriversOnline] = useState({});

  const addFeed = useCallback((type, data) => {
    setFeed((prev) => [{ type, data, ts: new Date().toISOString() }, ...prev].slice(0, maxFeed));
  }, [maxFeed]);

  useEffect(() => {
    const unsubs = [
      on(EV.DRIVER_LOCATION,      (d) => setDriversOnline((prev) => ({ ...prev, [d.driverObjectId]: d }))),
      on(EV.DRIVER_ONLINE,        (d) => { addFeed('driver_online',  d); setDriversOnline((prev) => ({ ...prev, [d.driverObjectId]: d })); }),
      on(EV.DRIVER_OFFLINE,       (d) => { addFeed('driver_offline', d); setDriversOnline((prev) => { const n = { ...prev }; delete n[d.driverObjectId]; return n; }); }),
      on(EV.RIDE_STATUS_CHANGED,  (d) => addFeed('ride_status',    d)),
      on(EV.BOOKING_STATUS_CHANGE,(d) => addFeed('booking_status', d)),
      on(EV.SOS_ALERT,            (d) => addFeed('sos',            d)),
      on(EV.OTP_FOR_ADMIN,        (d) => addFeed('otp',            d)),
      on(EV.OTP_FAILED_ATTEMPT,   (d) => addFeed('otp_fail',       d)),
      on(EV.ROUTE_DEVIATION_ALERT,(d) => addFeed('deviation',      d)),
      // FIX: also track CA events in admin ops feed
      on(EV.CARE_ASSISTANT_ATTACHED,      (d) => addFeed('ca_attached',      d)),
      on(EV.CARE_ASSISTANT_JOINED_RIDE,   (d) => addFeed('ca_joined',        d)),
      on(EV.CARE_ASSISTANT_STATUS_CHANGE, (d) => addFeed('ca_status_change', d)),
    ];
    return () => unsubs.forEach((fn) => fn?.());
  }, []); // eslint-disable-line

  return { feed, driversOnline };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE COMPONENTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function LiveEtaBadge({ bookingId }) {
  const { etaUpdate } = useBookingRoom(bookingId);
  if (!etaUpdate) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white font-inter">
      <Clock size={14} className="text-amber-400" />
      <span className="font-medium">{etaUpdate.etaMinutes} min</span>
      <span className="text-slate-400">·</span>
      <MapPin size={12} className="text-slate-400" />
      <span className="text-slate-400">{etaUpdate.distanceRemainingKm} km</span>
      <Navigation size={12} className="text-emerald-400" />
      <span className="text-emerald-400 capitalize">{etaUpdate.currentTarget}</span>
    </div>
  );
}

export function SosButton({ bookingId, rideId }) {
  const { trigger, sosActive, dismiss } = useSos(bookingId, rideId);
  return sosActive ? (
    <button onClick={dismiss} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white font-bold animate-pulse font-inter">
      <ShieldAlert size={16} />
      SOS Active — Tap to dismiss
    </button>
  ) : (
    <button onClick={() => trigger({ sosType: 'safety' })} className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/40 px-4 py-2 text-red-400 font-medium hover:bg-red-500/20 transition-colors font-inter">
      <Shield size={16} />
      SOS
    </button>
  );
}

export { SOCKET_EVENTS, CLIENT_EVENTS, DRIVER_STATUS };
export default SocketProvider;