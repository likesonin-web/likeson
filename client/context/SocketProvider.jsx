'use client';
// routes app/context/SocketProvider.jsx
/**
 * SocketProvider.jsx — Likeson.in Booking Socket Context
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
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
// CONNECTION STATUS BADGE  (top-right corner, Tailwind + lucide)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  connected:     { label: 'Live',         icon: Wifi,         cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  connecting:    { label: 'Connecting…',  icon: Loader2,      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  disconnected:  { label: 'Offline',      icon: WifiOff,      cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  error:         { label: 'Error',        icon: AlertTriangle, cls: 'bg-red-500/10 text-red-500 border-red-500/30' },
};

function ConnectionBadge({ status }) {
  const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
  const Icon = cfg.icon;

  return (
    <div
      className={`
        fixed bottom-3 right-3 z-50 font-inter
        flex items-center gap-1.5 px-2.5 py-1
        rounded-full border text-xs font-medium
        backdrop-blur-sm transition-all duration-300
        ${cfg.cls}
      `}
    >
      <Icon
        size={12}
        className={status === 'connecting' ? 'animate-spin' : ''}
      />
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

  // ── Init on token change ───────────────────────────────────────────────────
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

    sock.on('connect',        onConn);
    sock.on('disconnect',     onDisc);
    sock.on('error',          onErr);
    sock.on('connect_error',  onCErr);

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
    // State
    connected:  connStatus === 'connected',
    connStatus,
    lastError,

    // Core API — thin wrappers so components don't import socketService directly
    on:           socketService.on.bind(socketService),
    off:          socketService.off.bind(socketService),
    once:         socketService.once.bind(socketService),
    emit:         socketService.emit.bind(socketService),

    // Rooms
    joinBookingRoom:  socketService.joinBookingRoom.bind(socketService),
    leaveBookingRoom: socketService.leaveBookingRoom.bind(socketService),
    joinTpRoom:       socketService.joinTpRoom.bind(socketService),
    leaveTpRoom:      socketService.leaveTpRoom.bind(socketService),

    // GPS
    startGpsTracking: socketService.startGpsTracking.bind(socketService),
    stopGpsTracking:  socketService.stopGpsTracking.bind(socketService),
    emitLocation:     socketService.emitLocation.bind(socketService),

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

    // Re-export constants
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
// ─────────────────────────────────────────────────────────────────────────────

export function useBookingRoom(bookingId) {
  const { on, connected, joinBookingRoom, leaveBookingRoom, requestBookingState, SOCKET_EVENTS: EV } = useSocket();

  const [joined,          setJoined]          = useState(false);
  const [locationUpdate,  setLocationUpdate]  = useState(null);
  const [etaUpdate,       setEtaUpdate]       = useState(null);
  const [rideStatus,      setRideStatus]      = useState(null);
  const [bookingStatus,   setBookingStatus]   = useState(null);
  const [navigationTarget,setNavTarget]       = useState(null);
  const [sosAlert,        setSosAlert]        = useState(null);
  const [routeDeviation,  setRouteDeviation]  = useState(null);
  const [snapshot,        setSnapshot]        = useState(null);

  useEffect(() => {
    if (!bookingId || !connected) return;

    joinBookingRoom(bookingId);

    const unsubs = [
      on(EV.JOINED_ROOM,             (d) => { if (d.bookingId === bookingId) setJoined(true); }),
      on(EV.LOCATION_UPDATE,         setLocationUpdate),
      on(EV.ETA_UPDATE,              setEtaUpdate),
      on(EV.RIDE_STATUS_CHANGED,     setRideStatus),
      on(EV.BOOKING_STATUS_CHANGE,   setBookingStatus),
      on(EV.NAVIGATION_TARGET_CHANGED, setNavTarget),
      on(EV.SOS_ALERT,               setSosAlert),
      on(EV.ROUTE_DEVIATION_ALERT,   setRouteDeviation),
      on(EV.BOOKING_STATE_SNAPSHOT,  setSnapshot),
    ];

    // Request state snapshot on join (for reconnects)
    requestBookingState(bookingId);

    return () => {
      unsubs.forEach((fn) => fn?.());
      leaveBookingRoom(bookingId);
      setJoined(false);
    };
  }, [bookingId, connected]); // eslint-disable-line

  return {
    joined, locationUpdate, etaUpdate,
    rideStatus, bookingStatus, navigationTarget,
    sosAlert, routeDeviation, snapshot,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER STATUS HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useDriverStatus({ bookingId, rideId } = {}) {
  const { updateDriverStatus, on, SOCKET_EVENTS: EV, DRIVER_STATUS: DS } = useSocket();
  const [ack,    setAck]   = useState(null);
  const [error,  setError] = useState(null);
  const [loading,setLoading]= useState(false);

  useEffect(() => {
    const unsubAck = on(EV.STATUS_UPDATE_ACK, (d) => { setAck(d); setLoading(false); });
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
// OTP HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOtp({ bookingId, rideId } = {}) {
  const { verifyOtpAsync, requestOtpResend, on, SOCKET_EVENTS: EV } = useSocket();

  const [result,  setResult]  = useState(null); 
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);

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
// SOS HOOK
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
// GPS HOOK (driver)
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
// CONNECTION STATUS HOOK
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
// ADMIN OPS HOOK
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
      on(EV.DRIVER_LOCATION,     (d) => setDriversOnline((prev) => ({ ...prev, [d.driverObjectId]: d }))),
      on(EV.DRIVER_ONLINE,       (d) => { addFeed('driver_online', d); setDriversOnline((prev) => ({ ...prev, [d.driverObjectId]: d })); }),
      on(EV.DRIVER_OFFLINE,      (d) => { addFeed('driver_offline', d); setDriversOnline((prev) => { const n = { ...prev }; delete n[d.driverObjectId]; return n; }); }),
      on(EV.RIDE_STATUS_CHANGED, (d) => addFeed('ride_status', d)),
      on(EV.BOOKING_STATUS_CHANGE,(d)=> addFeed('booking_status', d)),
      on(EV.SOS_ALERT,           (d) => addFeed('sos', d)),
      on(EV.OTP_FOR_ADMIN,       (d) => addFeed('otp', d)),
      on(EV.OTP_FAILED_ATTEMPT,  (d) => addFeed('otp_fail', d)),
      on(EV.ROUTE_DEVIATION_ALERT,(d)=> addFeed('deviation', d)),
    ];
    return () => unsubs.forEach((fn) => fn?.());
  }, []); // eslint-disable-line

  return { feed, driversOnline };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE COMPONENTS
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
    <button
      onClick={dismiss}
      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white font-bold animate-pulse font-inter"
    >
      <ShieldAlert size={16} />
      SOS Active — Tap to dismiss
    </button>
  ) : (
    <button
      onClick={() => trigger({ sosType: 'safety' })}
      className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/40 px-4 py-2 text-red-400 font-medium hover:bg-red-500/20 transition-colors font-inter"
    >
      <Shield size={16} />
      SOS
    </button>
  );
}

export { SOCKET_EVENTS, CLIENT_EVENTS, DRIVER_STATUS };
export default SocketProvider;