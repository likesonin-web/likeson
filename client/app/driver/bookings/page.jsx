'use client';

/**
 * BookingManagement.jsx — Likeson.in Driver Portal
 * FIX: libraries const hoisted to module level (prevents useLoadScript reload warning)
 * FIX: removed illegal top-level await import of @react-google-maps/api
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  useEffect, useState, useCallback, useRef, memo, useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoadScript } from '@react-google-maps/api';
import {
  Truck, MapPin, Clock, CheckCircle, XCircle, Navigation,
  Phone, User, RefreshCw, Activity, TrendingUp, Star,
  Shield, Send, PlayCircle, StopCircle, Calendar, DollarSign,
  BarChart2, Map, ArrowRight, Signal,
  ChevronDown, Radio, Crosshair,
} from 'lucide-react';

import {
  fetchDriverAssignedRides,
  acceptRide,
  rejectRide,
  markDriverArrived,
  endRide,
  updateDriverLocationHttp,
  selectDriverAssignedRides,
  selectDriverInfo,
  selectLoading,
} from '@/store/slices/operationsSlice';

import { fetchDriverMe } from '@/store/slices/transportPartnerSlice';

// ── Google Maps (lazy) ──────────────────────────────────────────────────────
const GoogleMap = dynamic(
  () => import('@react-google-maps/api').then(m => m.GoogleMap),
  { ssr: false, loading: () => <MapSkeleton /> }
);
const Marker = dynamic(
  () => import('@react-google-maps/api').then(m => m.Marker),
  { ssr: false }
);
const DirectionsRenderer = dynamic(
  () => import('@react-google-maps/api').then(m => m.DirectionsRenderer),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX: LIBRARIES MUST BE MODULE-LEVEL CONST — never inline array in component
// Passing `['places']` inline = new array ref each render = reload loop
// ─────────────────────────────────────────────────────────────────────────────
const MAPS_LIBRARIES = ['places'];
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const RIDE_STATUSES_ACTIVE = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
];

const STATUS_CFG = {
  driver_assigned: { label: 'Assigned',    icon: Truck,       neon: '#f59e0b' },
  driver_accepted: { label: 'Accepted',    icon: CheckCircle, neon: '#3b82f6' },
  driver_en_route: { label: 'En Route',    icon: Navigation,  neon: '#8b5cf6' },
  driver_arrived:  { label: 'Arrived',     icon: MapPin,      neon: '#06b6d4' },
  in_progress:     { label: 'In Progress', icon: Activity,    neon: '#10b981' },
  at_stop:         { label: 'At Stop',     icon: MapPin,      neon: '#f59e0b' },
};

const RIDE_ACTIONS = {
  driver_assigned: ['accept', 'reject'],
  driver_accepted: ['arrived'],
  driver_en_route: ['arrived'],
  driver_arrived:  ['start'],
  in_progress:     ['end'],
  at_stop:         ['end'],
};

const REJECT_REASONS = [
  'Vehicle issue', 'Too far', 'Medical emergency', 'Route not feasible', 'Other',
];

const MAP_DARK_STYLE = [
  { elementType: 'geometry',             stylers: [{ color: '#0f0f23' }] },
  { elementType: 'labels.text.stroke',   stylers: [{ color: '#0f0f23' }] },
  { elementType: 'labels.text.fill',     stylers: [{ color: '#6b7280' }] },
  { featureType: 'road', elementType: 'geometry',        stylers: [{ color: '#1e1b4b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#312e81' }] },
  { featureType: 'road.highway', elementType: 'geometry',stylers: [{ color: '#312e81' }] },
  { featureType: 'water', elementType: 'geometry',       stylers: [{ color: '#06001a' }] },
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 200 } },
  exit:   { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1, transition: { type: 'spring', damping: 22, stiffness: 250 } },
  exit:   { opacity: 0, scale: 0.88, transition: { duration: 0.15 } },
};

const slideLeft = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0, transition: { type: 'spring', damping: 22, stiffness: 220 } },
  exit:   { opacity: 0, x: -40, transition: { duration: 0.2 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────────────────

const MapSkeleton = memo(() => (
  <div className="w-full h-full bg-base-200 animate-pulse flex items-center justify-center rounded-xl">
    <Map size={24} className="text-base-content/20" />
  </div>
));
MapSkeleton.displayName = 'MapSkeleton';

const RideCardSkeleton = memo(() => (
  <motion.div variants={fadeUp} className="card p-5 animate-pulse border border-base-300/50" aria-hidden>
    <div className="flex gap-3 mb-4">
      <div className="skeleton w-12 h-12 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3 rounded-lg" />
        <div className="skeleton h-3 w-1/4 rounded-lg" />
      </div>
      <div className="skeleton w-16 h-8 rounded-xl" />
    </div>
    <div className="space-y-2">
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-4/5 rounded" />
      <div className="skeleton h-36 w-full rounded-xl mt-3" />
      <div className="skeleton h-10 w-full rounded-xl mt-2" />
    </div>
  </motion.div>
));
RideCardSkeleton.displayName = 'RideCardSkeleton';

const AnalyticsSkeleton = memo(() => (
  <div className="space-y-4" aria-hidden>
    {[1, 2].map(i => (
      <div key={i} className="card p-6 animate-pulse">
        <div className="skeleton h-5 w-1/4 rounded mb-4" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    ))}
  </div>
));
AnalyticsSkeleton.displayName = 'AnalyticsSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(({ icon: Icon, label, value, sub, neon = '#8b5cf6', index = 0 }) => (
  <motion.div
    variants={fadeUp}
    custom={index}
    className="relative overflow-hidden rounded-2xl border border-base-300/40 bg-base-200/60 backdrop-blur-sm p-5"
    style={{ boxShadow: `0 0 24px ${neon}18` }}
    whileHover={{ scale: 1.02, boxShadow: `0 0 32px ${neon}30` }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    role="region"
    aria-label={label}
  >
    <div
      className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-xl opacity-30"
      style={{ background: neon }}
    />
    <div className="flex items-center gap-2 mb-3">
      <span
        className="p-2 rounded-xl"
        style={{ background: `${neon}20`, border: `1px solid ${neon}30` }}
      >
        <Icon size={14} style={{ color: neon }} />
      </span>
      <span className="text-xs font-mono uppercase tracking-widest text-base-content/40">{label}</span>
    </div>
    <div className="text-2xl font-black" style={{ color: neon }}>{value}</div>
    {sub && <p className="text-xs text-base-content/30 mt-1 font-mono">{sub}</p>}
  </motion.div>
));
StatCard.displayName = 'StatCard';

// ─────────────────────────────────────────────────────────────────────────────
// MINI ROUTE MAP
// ─────────────────────────────────────────────────────────────────────────────

function MiniRouteMap({ pickupCoords, dropoffCoords }) {
  const [directions, setDirections] = useState(null);
  const [mapLoaded, setMapLoaded]   = useState(false);

  const center = useMemo(() => {
    if (!pickupCoords) return { lat: 16.506, lng: 80.648 };
    return { lat: pickupCoords[1], lng: pickupCoords[0] };
  }, [pickupCoords]);

  useEffect(() => {
    if (!mapLoaded || !pickupCoords || !dropoffCoords) return;
    if (typeof window === 'undefined' || !window.google?.maps) return;
    const svc = new window.google.maps.DirectionsService();
    svc.route(
      {
        origin:      { lat: pickupCoords[1], lng: pickupCoords[0] },
        destination: { lat: dropoffCoords[1], lng: dropoffCoords[0] },
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => { if (status === 'OK') setDirections(result); }
    );
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  if (!pickupCoords) return null;

  return (
    <div className="w-full h-36 rounded-xl overflow-hidden border border-base-300/30 mt-3">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={12}
        options={{
          styles:           MAP_DARK_STYLE,
          disableDefaultUI: true,
          gestureHandling:  'none',
          zoomControl:      false,
        }}
        onLoad={() => setMapLoaded(true)}
      >
        {directions ? (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: { strokeColor: '#8b5cf6', strokeWeight: 3, strokeOpacity: 0.9 },
            }}
          />
        ) : (
          <Marker position={{ lat: pickupCoords[1], lng: pickupCoords[0] }} />
        )}
      </GoogleMap>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODAL
// ─────────────────────────────────────────────────────────────────────────────

const OtpModal = memo(({ onConfirm, onClose, loading }) => {
  const [otp, setOtp] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        variants={scaleIn} initial="hidden" animate="show" exit="exit"
        className="relative overflow-hidden rounded-3xl border border-warning/30 bg-base-200/90 backdrop-blur-xl p-8 w-80 shadow-2xl"
        style={{ boxShadow: '0 0 60px #f59e0b20' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-warning/20 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2.5 bg-warning/15 border border-warning/30 rounded-2xl">
            <Shield size={20} style={{ color: 'var(--warning)' }} />
          </span>
          <div>
            <h2 className="text-base font-black">Verify OTP</h2>
            <p className="text-xs font-mono text-base-content/40">Customer shares 6-digit code</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="number"
          maxLength={6}
          value={otp}
          onChange={e => setOtp(e.target.value.slice(0, 6))}
          placeholder="000000"
          className="input-field w-full text-center text-3xl font-black tracking-[0.6em] mb-4"
          style={{ fontFamily: 'monospace', letterSpacing: '0.5em' }}
          aria-label="6-digit OTP"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => otp.length === 6 && onConfirm(otp)}
            disabled={otp.length !== 6 || loading}
            className="btn btn-warning flex-1 gap-2"
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />}
            Verify
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
OtpModal.displayName = 'OtpModal';

// ─────────────────────────────────────────────────────────────────────────────
// REJECT MODAL
// ─────────────────────────────────────────────────────────────────────────────

const RejectModal = memo(({ bookingCode, onConfirm, onClose, loading }) => {
  const [reason, setReason] = useState('');

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        variants={scaleIn} initial="hidden" animate="show" exit="exit"
        className="relative overflow-hidden rounded-3xl border border-error/30 bg-base-200/90 backdrop-blur-xl p-8 w-80 shadow-2xl"
        style={{ boxShadow: '0 0 60px #ef444420' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-error/20 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2.5 bg-error/15 border border-error/30 rounded-2xl">
            <XCircle size={20} style={{ color: 'var(--error)' }} />
          </span>
          <div>
            <h2 className="text-base font-black">Reject Ride</h2>
            <p className="text-xs font-mono text-base-content/40">#{bookingCode}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {REJECT_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`btn btn-xs transition-all ${
                reason === r
                  ? 'btn-error'
                  : 'btn-ghost border border-error/20 text-error/70 hover:border-error/40'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Custom reason..."
          rows={2}
          className="input-field w-full resize-none mb-4 text-sm"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="btn btn-error flex-1 gap-2"
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : <XCircle size={14} />}
            Reject
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
RejectModal.displayName = 'RejectModal';

// ─────────────────────────────────────────────────────────────────────────────
// END RIDE MODAL
// ─────────────────────────────────────────────────────────────────────────────

const EndRideModal = memo(({ bookingCode, onConfirm, onClose, loading }) => {
  const [dist, setDist] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        variants={scaleIn} initial="hidden" animate="show" exit="exit"
        className="relative overflow-hidden rounded-3xl border border-success/30 bg-base-200/90 backdrop-blur-xl p-8 w-80 shadow-2xl"
        style={{ boxShadow: '0 0 60px #10b98120' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-success/20 rounded-full blur-2xl" />
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2.5 bg-success/15 border border-success/30 rounded-2xl">
            <StopCircle size={20} style={{ color: 'var(--success)' }} />
          </span>
          <div>
            <h2 className="text-base font-black">Complete Ride</h2>
            <p className="text-xs font-mono text-base-content/40">#{bookingCode}</p>
          </div>
        </div>
        <label className="text-xs font-mono text-base-content/40 uppercase tracking-wider mb-2 block">
          Actual Distance (km)
        </label>
        <input
          ref={inputRef}
          type="number"
          value={dist}
          onChange={e => setDist(e.target.value)}
          placeholder="0.0"
          className="input-field w-full text-2xl font-black text-center font-mono mb-4"
          min="0"
          step="0.1"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => onConfirm(parseFloat(dist) || 0)}
            disabled={loading}
            className="btn btn-success flex-1 gap-2"
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
            Complete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
EndRideModal.displayName = 'EndRideModal';

// ─────────────────────────────────────────────────────────────────────────────
// RIDE CARD
// ─────────────────────────────────────────────────────────────────────────────

const RideCard = memo(({ ride, onAction, actionLoading, activeBookingId, mapsLoaded }) => {
  const [expanded, setExpanded] = useState(false);
  const booking    = ride.booking || {};
  const status     = ride.status;
  const cfg        = STATUS_CFG[status] || { label: status, neon: '#6b7280', icon: Truck };
  const StatusIcon = cfg.icon;
  const actions    = RIDE_ACTIONS[status] || [];
  const bookingId  = booking._id;
  const isLoading  = actionLoading && activeBookingId === bookingId;
  const fare       = booking.fareBreakdown?.totalAmount;
  const patient    = booking.patientInfo;
  const pickup     = booking.patientLocation;
  const dropoff    = booking.destinationLocation;
  const showTrack  = RIDE_STATUSES_ACTIVE.includes(status);

  const scheduledDate = useMemo(() => {
    if (!booking.scheduledAt) return null;
    return new Date(booking.scheduledAt).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }, [booking.scheduledAt]);

  const handleAction = useCallback(
    type => onAction(type, bookingId),
    [onAction, bookingId]
  );

  return (
    <motion.article
      variants={fadeUp}
      layout
      className="relative overflow-hidden rounded-2xl border bg-base-200/60 backdrop-blur-sm"
      style={{
        borderColor: `${cfg.neon}30`,
        boxShadow:   `0 0 32px ${cfg.neon}12, inset 0 1px 0 ${cfg.neon}15`,
      }}
      whileHover={{ boxShadow: `0 0 48px ${cfg.neon}20, inset 0 1px 0 ${cfg.neon}25` }}
      aria-label={`Ride ${booking.bookingCode || bookingId}`}
    >
      {/* Top neon bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${cfg.neon}, transparent)` }}
      />
      {/* Left status stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: `linear-gradient(180deg, ${cfg.neon}, ${cfg.neon}40)` }}
      />

      <div className="pl-4 pr-4 pt-4 pb-4">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.span
              className="p-3 rounded-2xl flex items-center justify-center"
              style={{ background: `${cfg.neon}15`, border: `1px solid ${cfg.neon}30` }}
              animate={{ boxShadow: [`0 0 8px ${cfg.neon}00`, `0 0 16px ${cfg.neon}40`, `0 0 8px ${cfg.neon}00`] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <StatusIcon size={18} style={{ color: cfg.neon }} />
            </motion.span>
            <div>
              <p className="font-black text-sm tracking-tight font-mono">
                {booking.bookingCode || '—'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold font-mono"
                  style={{ background: `${cfg.neon}15`, color: cfg.neon, border: `1px solid ${cfg.neon}25` }}
                >
                  {cfg.label}
                </span>
                <span className="text-xs text-base-content/40 font-mono">
                  {booking.bookingType?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fare != null && (
              <div className="text-right">
                <p className="font-black text-lg" style={{ color: 'var(--accent)' }}>
                  ₹{Number(fare).toFixed(0)}
                </p>
                <p className="text-xs text-base-content/30 font-mono">fare</p>
              </div>
            )}
            <motion.button
              onClick={() => setExpanded(p => !p)}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-xl bg-base-300/50 text-base-content/40 hover:text-base-content"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={15} />
              </motion.div>
            </motion.button>
          </div>
        </div>

        {/* Patient */}
        {patient && (
          <div className="flex items-center gap-2 mb-3 bg-base-300/40 rounded-xl px-3 py-2 border border-base-300/30">
            <User size={13} className="text-base-content/30" />
            <span className="text-sm font-bold">{patient.name}</span>
            {patient.age    && <span className="text-xs text-base-content/30">· {patient.age}y</span>}
            {patient.gender && <span className="text-xs text-base-content/30">· {patient.gender}</span>}
            {patient.bloodGroup && (
              <span className="text-xs px-1.5 py-0.5 bg-error/15 text-error border border-error/20 rounded-md font-mono ml-1">
                {patient.bloodGroup}
              </span>
            )}
            {patient.phone && (
              <a href={`tel:${patient.phone}`} className="ml-auto text-primary hover:text-primary/80" aria-label={`Call ${patient.name}`}>
                <Phone size={13} />
              </a>
            )}
          </div>
        )}

        {/* Route summary */}
        {(pickup?.address || dropoff?.address) && (
          <div className="flex items-start gap-3 mb-3">
            <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
              <div className="w-2 h-2 rounded-full bg-success" />
              <div className="w-px h-6 bg-base-content/10" />
              <div className="w-2 h-2 rounded-full bg-accent" />
            </div>
            <div className="flex-1 space-y-1">
              {pickup?.address && (
                <div>
                  <p className="text-xs font-mono text-base-content/30 uppercase">Pickup</p>
                  <p className="text-sm leading-tight text-base-content/80 truncate">{pickup.address}</p>
                </div>
              )}
              {dropoff?.address && (
                <div>
                  <p className="text-xs font-mono text-base-content/30 uppercase">Drop</p>
                  <p className="text-sm leading-tight text-base-content/80 truncate">{dropoff.address}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="overflow-hidden"
            >
              {mapsLoaded && pickup?.coordinates && dropoff?.coordinates && (
                <MiniRouteMap
                  pickupCoords={pickup.coordinates}
                  dropoffCoords={dropoff.coordinates}
                />
              )}
              {scheduledDate && (
                <div className="flex items-center gap-2 mt-3 text-xs text-base-content/40 font-mono">
                  <Calendar size={12} />
                  <time dateTime={booking.scheduledAt}>{scheduledDate}</time>
                </div>
              )}
              {booking.fareBreakdown && (
                <div className="flex gap-2 flex-wrap mt-3">
                  {booking.fareBreakdown.transportFee > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-mono">
                      Transport ₹{booking.fareBreakdown.transportFee}
                    </span>
                  )}
                  {booking.fareBreakdown.taxes > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-info/10 text-info border border-info/20 rounded-full font-mono">
                      Tax ₹{booking.fareBreakdown.taxes}
                    </span>
                  )}
                  {booking.fareBreakdown.discount > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-success/10 text-success border border-success/20 rounded-full font-mono">
                      -{booking.fareBreakdown.discount}% off
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        {actions.length > 0 && (
          <motion.div layout className="flex flex-col gap-2 mt-4">
            <div className="flex gap-2">
              {actions.includes('accept') && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleAction('accept')} disabled={isLoading} className="btn btn-success btn-sm flex-1 gap-1.5">
                  {isLoading ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={13} />} Accept
                </motion.button>
              )}
              {actions.includes('reject') && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleAction('reject')} disabled={isLoading} className="btn btn-sm flex-1 gap-1.5 border border-error/30 text-error bg-error/5 hover:bg-error/10">
                  <XCircle size={13} /> Reject
                </motion.button>
              )}
              {actions.includes('arrived') && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleAction('arrived')} disabled={isLoading} className="btn btn-info btn-sm flex-1 gap-1.5">
                  {isLoading ? <span className="loading loading-spinner loading-xs" /> : <MapPin size={13} />} Mark Arrived
                </motion.button>
              )}
              {actions.includes('start') && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleAction('start')} disabled={isLoading} className="btn btn-accent btn-sm flex-1 gap-1.5">
                  {isLoading ? <span className="loading loading-spinner loading-xs" /> : <PlayCircle size={13} />} Start Ride
                </motion.button>
              )}
              {actions.includes('end') && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => handleAction('end')} disabled={isLoading} className="btn btn-primary btn-sm flex-1 gap-1.5">
                  {isLoading ? <span className="loading loading-spinner loading-xs" /> : <StopCircle size={13} />} End Ride
                </motion.button>
              )}
            </div>

            {showTrack && (
              <Link
                href={`/driver/tracking/${booking._id}/${ride._id}`}
                className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl border text-sm font-semibold transition-all"
                style={{ borderColor: `${cfg.neon}40`, color: cfg.neon, background: `${cfg.neon}08` }}
                onMouseEnter={e => { e.currentTarget.style.background = `${cfg.neon}15`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${cfg.neon}08`; }}
              >
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Radio size={13} />
                </motion.span>
                Open Live Tracking
                <ArrowRight size={13} />
              </Link>
            )}
          </motion.div>
        )}
      </div>
    </motion.article>
  );
});
RideCard.displayName = 'RideCard';

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(({ onRefresh, isLoading }) => (
  <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-24 text-center" role="status">
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className="relative mb-6"
    >
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1e1b4b, #0f0f23)', border: '1px solid #312e81' }}
      >
        <Truck size={36} className="text-primary/30" />
      </div>
      <motion.span
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute -bottom-1 -right-1 w-8 h-8 bg-base-300 border border-base-content/10 rounded-full flex items-center justify-center"
      >
        <Signal size={12} className="text-base-content/30" />
      </motion.span>
    </motion.div>
    <p className="font-mono text-sm uppercase tracking-widest text-base-content/30 mb-2">No Active Rides</p>
    <p className="text-xs text-base-content/20 max-w-xs mb-8 leading-relaxed">
      Standing by. New bookings will appear here when dispatched.
    </p>
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onRefresh}
      disabled={isLoading}
      className="btn btn-ghost btn-sm border border-base-content/10 gap-2 font-mono"
    >
      <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
      Check Again
    </motion.button>
  </motion.div>
));
EmptyState.displayName = 'EmptyState';

// ─────────────────────────────────────────────────────────────────────────────
// GPS PULSE
// ─────────────────────────────────────────────────────────────────────────────

const GpsPulse = ({ active }) => (
  <div className="relative flex items-center justify-center w-5 h-5">
    {active && (
      <>
        <motion.div
          className="absolute inset-0 rounded-full bg-success"
          animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 rounded-full bg-success"
          animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
      </>
    )}
    <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-success' : 'bg-base-content/20'}`} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS PANEL (lazy recharts)
// ─────────────────────────────────────────────────────────────────────────────

// Weekly static data — replace with real Redux state as needed
const WEEKLY_DATA = [
  { day: 'Mon', rides: 4, earnings: 1240 },
  { day: 'Tue', rides: 6, earnings: 1890 },
  { day: 'Wed', rides: 3, earnings: 940  },
  { day: 'Thu', rides: 8, earnings: 2450 },
  { day: 'Fri', rides: 5, earnings: 1560 },
  { day: 'Sat', rides: 9, earnings: 2810 },
  { day: 'Sun', rides: 7, earnings: 2190 },
];

const PERF_METRICS = [
  { label: 'Rating',        value: '4.8', icon: Star,        neon: '#f59e0b', sub: '127 reviews'   },
  { label: 'Acceptance',    value: '94%', icon: CheckCircle, neon: '#10b981', sub: 'this week'     },
  { label: 'On-time',       value: '88%', icon: Clock,       neon: '#3b82f6', sub: 'avg punctual'  },
  { label: 'Cancellations', value: '2',   icon: XCircle,     neon: '#ef4444', sub: 'this month'    },
];

function AnalyticsPanel() {
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    import('recharts').then(m => setCharts(m));
  }, []);

  if (!charts) return <AnalyticsSkeleton />;

  const {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
  } = charts;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-base-300/30 bg-base-200/90 backdrop-blur-sm px-4 py-3 shadow-2xl text-sm">
        <p className="text-xs font-mono text-base-content/40 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-black" style={{ color: p.color }}>
            {p.name === 'earnings' ? `₹${p.value}` : p.value} {p.name}
          </p>
        ))}
      </div>
    );
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Earnings */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-primary/20 bg-base-200/60 backdrop-blur-sm p-6"
        style={{ boxShadow: '0 0 32px #8b5cf610' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-black text-base">Weekly Earnings</h2>
            <p className="text-xs font-mono text-base-content/30 mt-0.5">Last 7 days</p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-bold text-success">
            <TrendingUp size={14} /> +12.4%
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={WEEKLY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="earn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day"      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone" dataKey="earnings" stroke="#8b5cf6" strokeWidth={2} fill="url(#earn)"
              dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Rides per day */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-accent/20 bg-base-200/60 backdrop-blur-sm p-6"
        style={{ boxShadow: '0 0 32px #ec489910' }}
      >
        <h2 className="font-black text-sm mb-4">Rides Per Day</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={WEEKLY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="rides" fill="#ec4899" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Performance metrics */}
      <motion.div variants={fadeUp}>
        <h2 className="font-black text-sm mb-4">Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PERF_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              variants={fadeUp}
              custom={i}
              className="rounded-2xl border bg-base-200/60 backdrop-blur-sm p-4 text-center"
              style={{ borderColor: `${m.neon}25`, boxShadow: `0 0 16px ${m.neon}10` }}
              whileHover={{ scale: 1.03 }}
            >
              <m.icon size={16} style={{ color: m.neon }} className="mx-auto mb-2" />
              <p className="text-2xl font-black" style={{ color: m.neon }}>{m.value}</p>
              <p className="text-xs font-bold text-base-content/50">{m.label}</p>
              <p className="text-xs font-mono text-base-content/25 mt-0.5">{m.sub}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rides',     label: 'Active Rides', icon: Truck    },
  { id: 'analytics', label: 'Analytics',    icon: BarChart2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingManagement() {
  const dispatch = useDispatch();

  const rides          = useSelector(selectDriverAssignedRides) ?? [];
  const driverInfo     = useSelector(selectDriverInfo);
  const isLoading      = useSelector(selectLoading('fetchDriverAssignedRides'));
  const acceptLoading  = useSelector(selectLoading('acceptRide'));
  const rejectLoading  = useSelector(selectLoading('rejectRide'));
  const arrivedLoading = useSelector(selectLoading('markDriverArrived'));
  const endLoading     = useSelector(selectLoading('endRide'));
  const actionLoading  = acceptLoading || rejectLoading || arrivedLoading || endLoading;

  const [modal,            setModal]            = useState(null);
  const [activeTab,        setActiveTab]        = useState('rides');
  const [locationTracking, setLocationTracking] = useState(false);
  const [currentTime,      setCurrentTime]      = useState('');
  const [gpsCoords,        setGpsCoords]        = useState(null);

  const locationIntervalRef = useRef(null);

  // ── FIX: libraries is module-level MAPS_LIBRARIES const, not inline array ──
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: MAPS_KEY,
    libraries:        MAPS_LIBRARIES,   // ← stable ref, no reload warning
  });

  // Clock
  useEffect(() => {
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch on mount
  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverAssignedRides());
  }, [dispatch]);

  // GPS polling
  useEffect(() => {
    if (!locationTracking) {
      clearInterval(locationIntervalRef.current);
      return;
    }
    locationIntervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        const activeRide = rides.find(r =>
          ['driver_accepted', 'driver_en_route', 'driver_arrived', 'in_progress', 'at_stop'].includes(r.status)
        );
        dispatch(updateDriverLocationHttp({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading || 0,
          speed:     pos.coords.speed ? pos.coords.speed * 3.6 : 0,
          bookingId: activeRide?.booking?._id,
        }));
      });
    }, 5000);
    return () => clearInterval(locationIntervalRef.current);
  }, [locationTracking, rides, dispatch]);

  const handleAction = useCallback((type, bookingId) => {
    const ride        = rides.find(r => r.booking?._id === bookingId);
    const bookingCode = ride?.booking?.bookingCode || bookingId;
    if      (type === 'accept')  dispatch(acceptRide({ bookingId }));
    else if (type === 'arrived') dispatch(markDriverArrived({ bookingId }));
    else if (type === 'reject')  setModal({ type: 'reject', bookingId, bookingCode });
    else if (type === 'start')   setModal({ type: 'otp',    bookingId, bookingCode });
    else if (type === 'end')     setModal({ type: 'end',    bookingId, bookingCode });
  }, [rides, dispatch]);

  // OTP via socket only — HTTP /ride/start removed
  const handleOtpConfirm    = useCallback(() => setModal(null), []);
  const handleRejectConfirm = useCallback(reason => {
    dispatch(rejectRide({ bookingId: modal.bookingId, reason }));
    setModal(null);
  }, [dispatch, modal]);
  const handleEndConfirm    = useCallback(dist => {
    dispatch(endRide({ bookingId: modal.bookingId, actualDistanceKm: dist }));
    setModal(null);
  }, [dispatch, modal]);

  const handleRefresh = useCallback(() => dispatch(fetchDriverAssignedRides()), [dispatch]);

  const statusCounts = useMemo(
    () => rides.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    [rides]
  );
  const totalFare  = useMemo(() => rides.reduce((s, r) => s + (r.booking?.fareBreakdown?.totalAmount || 0), 0), [rides]);
  const inProgress = statusCounts.in_progress || 0;
  const assigned   = statusCounts.driver_assigned || 0;

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 btn btn-primary btn-sm z-50">
        Skip to content
      </a>

      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-success/5 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(var(--base-content) 1px, transparent 1px), linear-gradient(90deg, var(--base-content) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div id="main-content" className="relative z-10 min-h-screen bg-base-100 text-base-content" data-theme="driver">
        <div className="container-custom max-w-5xl py-8 px-4">

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <motion.span
                    className="p-3 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #312e81, #1e1b4b)', border: '1px solid #4f46e520', boxShadow: '0 0 24px #8b5cf620' }}
                    animate={{ boxShadow: ['0 0 16px #8b5cf620', '0 0 32px #8b5cf640', '0 0 16px #8b5cf620'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Truck size={22} style={{ color: '#8b5cf6' }} />
                  </motion.span>
                  <div>
                    <h1 className="text-3xl font-black tracking-tighter leading-none">
                      Booking{' '}
                      <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Control
                      </span>
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5" role="status" aria-live="polite">
                        <GpsPulse active={!isLoading && rides.length > 0} />
                        <span className="text-xs font-mono text-base-content/30">
                          {isLoading ? 'syncing...' : `${rides.length} active`}
                        </span>
                      </div>
                      <span className="text-base-content/10">·</span>
                      <span className="text-xs font-mono text-base-content/20">{currentTime}</span>
                    </div>
                  </div>
                </div>

                {driverInfo && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 ml-16 mt-1">
                    <span className="text-xs font-mono text-base-content/30 bg-base-300/40 border border-base-300/30 px-2 py-0.5 rounded-full">
                      {driverInfo.driverCode || driverInfo.legalName || 'Driver'}
                    </span>
                    {driverInfo.type === 'solo' && (
                      <span className="text-xs font-mono text-accent/60 bg-accent/5 border border-accent/15 px-2 py-0.5 rounded-full">Solo</span>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setLocationTracking(p => !p)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold font-mono border transition-all ${
                    locationTracking
                      ? 'bg-success/10 border-success/30 text-success'
                      : 'bg-base-200/60 border-base-300/30 text-base-content/40 hover:text-base-content/70'
                  }`}
                  aria-pressed={locationTracking}
                  style={locationTracking ? { boxShadow: '0 0 16px #10b98125' } : {}}
                >
                  <GpsPulse active={locationTracking} />
                  {locationTracking ? 'GPS ON' : 'GPS OFF'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9, rotate: 180 }}
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-2 rounded-xl bg-base-200/60 border border-base-300/30 text-base-content/40 hover:text-base-content transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </motion.button>
              </div>
            </div>
          </motion.header>

          {/* Stat cards */}
          <motion.section variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" aria-label="Statistics">
            <StatCard icon={Truck}       label="Total Active" value={rides.length}               sub="live bookings"    neon="#8b5cf6" index={0} />
            <StatCard icon={Clock}       label="Assigned"     value={assigned}                   sub="awaiting accept"  neon="#f59e0b" index={1} />
            <StatCard icon={Activity}    label="In Progress"  value={inProgress}                 sub="en route"         neon="#10b981" index={2} />
            <StatCard icon={DollarSign}  label="Fare Total"   value={`₹${totalFare.toFixed(0)}`} sub="all active rides" neon="#ec4899" index={3} />
          </motion.section>

          {/* GPS strip */}
          <AnimatePresence>
            {locationTracking && gpsCoords && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-success/5 border border-success/20 text-xs font-mono text-success/70">
                  <Crosshair size={12} className="text-success" />
                  <span>GPS ACTIVE</span>
                  <span className="text-base-content/30">·</span>
                  <span>{gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}</span>
                  <motion.div
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-success"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <div
            className="flex gap-1 mb-6 bg-base-200/60 border border-base-300/30 rounded-2xl p-1 w-fit backdrop-blur-sm"
            role="tablist"
          >
            {TABS.map(tab => (
              <motion.button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  activeTab === tab.id ? 'text-primary' : 'text-base-content/30 hover:text-base-content/60'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                    style={{ boxShadow: '0 0 12px #8b5cf615' }}
                  />
                )}
                <tab.icon size={13} className="relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Tab panels */}
          <AnimatePresence mode="wait">
            {activeTab === 'rides' && (
              <motion.section
                key="rides"
                variants={slideLeft}
                initial="hidden"
                animate="show"
                exit="exit"
                id="panel-rides"
                role="tabpanel"
              >
                {/* Status pills */}
                {Object.keys(statusCounts).length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 mb-5">
                    {Object.entries(statusCounts).map(([s, count]) => {
                      const c = STATUS_CFG[s];
                      if (!c) return null;
                      return (
                        <span
                          key={s}
                          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-mono font-bold border"
                          style={{ background: `${c.neon}10`, color: c.neon, borderColor: `${c.neon}25` }}
                        >
                          <c.icon size={10} /> {c.label}: {count}
                        </span>
                      );
                    })}
                  </motion.div>
                )}

                {isLoading && rides.length === 0 && (
                  <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
                    {[0, 1, 2].map(i => <RideCardSkeleton key={i} />)}
                  </motion.div>
                )}

                {!isLoading && rides.length === 0 && (
                  <motion.div variants={fadeUp} initial="hidden" animate="show">
                    <EmptyState onRefresh={handleRefresh} isLoading={isLoading} />
                  </motion.div>
                )}

                {rides.length > 0 && (
                  <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-4" aria-label="Active rides">
                    <AnimatePresence>
                      {rides.map((ride, i) => (
                        <motion.li key={ride._id || i} variants={fadeUp} layout>
                          <RideCard
                            ride={ride}
                            onAction={handleAction}
                            actionLoading={actionLoading}
                            activeBookingId={modal?.bookingId || null}
                            mapsLoaded={mapsLoaded}
                          />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </motion.section>
            )}

            {activeTab === 'analytics' && (
              <motion.section
                key="analytics"
                variants={slideLeft}
                initial="hidden"
                animate="show"
                exit="exit"
                id="panel-analytics"
                role="tabpanel"
              >
                <AnalyticsPanel />
              </motion.section>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === 'otp' && (
          <OtpModal key="otp" onConfirm={handleOtpConfirm} onClose={() => setModal(null)} loading={actionLoading} />
        )}
        {modal?.type === 'reject' && (
          <RejectModal key="reject" bookingCode={modal.bookingCode} onConfirm={handleRejectConfirm} onClose={() => setModal(null)} loading={actionLoading} />
        )}
        {modal?.type === 'end' && (
          <EndRideModal key="end" bookingCode={modal.bookingCode} onConfirm={handleEndConfirm} onClose={() => setModal(null)} loading={actionLoading} />
        )}
      </AnimatePresence>
    </>
  );
}