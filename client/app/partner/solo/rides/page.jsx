'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector }  from 'react-redux';
import { useRouter }                 from 'next/navigation';
import { motion, AnimatePresence }   from 'framer-motion';
import {
  Navigation, MapPin, Phone, User, Clock,
  CheckCircle, XCircle, AlertCircle, Loader2,
  RefreshCw, Calendar, Car, Package, ChevronRight,
  Zap, Route, ArrowRight, Wifi, WifiOff,
  Activity, Shield, Star, TrendingUp, Filter,
  Search, Bell, MoreVertical, Eye, Play,
  CheckSquare, Map, BadgeCheck, AlertTriangle,
  Stethoscope, Heart, Ambulance, PhoneCall,
  Navigation2, Timer, IndianRupee,
} from 'lucide-react';

import {
  fetchDriverAssignedRides,
  acceptRide,
  rejectRide,
  selectDriverAssignedRides,
  selectDriverInfo,
  selectLoading,
  selectError,
  selectSocketConnected,
} from '@/store/slices/operationsSlice';
import BackButton from '../../../../components/BackButton';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  driver_assigned: {
    label: 'New Ride', color: 'text-warning', bg: 'bg-warning/10',
    border: 'border-warning/30', dot: 'bg-warning', pulse: true,
  },
  driver_accepted: {
    label: 'Accepted', color: 'text-info', bg: 'bg-info/10',
    border: 'border-info/30', dot: 'bg-info', pulse: false,
  },
  driver_en_route: {
    label: 'En Route', color: 'text-primary', bg: 'bg-primary/10',
    border: 'border-primary/30', dot: 'bg-primary', pulse: true,
  },
  driver_arrived: {
    label: 'Arrived', color: 'text-accent', bg: 'bg-accent/10',
    border: 'border-accent/30', dot: 'bg-accent', pulse: false,
  },
  otp_verified: {
    label: 'OTP ✓', color: 'text-success', bg: 'bg-success/10',
    border: 'border-success/30', dot: 'bg-success', pulse: false,
  },
  in_progress: {
    label: 'In Progress', color: 'text-success', bg: 'bg-success/10',
    border: 'border-success/30', dot: 'bg-success', pulse: true,
  },
  at_stop: {
    label: 'At Stop', color: 'text-secondary', bg: 'bg-secondary/10',
    border: 'border-secondary/30', dot: 'bg-secondary', pulse: false,
  },
  completed: {
    label: 'Completed', color: 'text-base-content/50', bg: 'bg-base-300/50',
    border: 'border-base-300', dot: 'bg-base-content/30', pulse: false,
  },
  cancelled: {
    label: 'Cancelled', color: 'text-error', bg: 'bg-error/10',
    border: 'border-error/30', dot: 'bg-error', pulse: false,
  },
  searching: {
    label: 'Searching', color: 'text-base-content/50', bg: 'bg-base-300/50',
    border: 'border-base-300', dot: 'bg-base-content/30', pulse: false,
  },
};

const BOOKING_TYPE_META = {
  full_care_ride:      { icon: Heart,       label: 'Full Care',        color: 'text-error',     bg: 'bg-error/10' },
  doctor_consultation: { icon: Stethoscope, label: 'Consultation',     color: 'text-primary',   bg: 'bg-primary/10' },
  doctor_online:       { icon: Stethoscope, label: 'Online Consult',   color: 'text-info',      bg: 'bg-info/10' },
  patient_transport:   { icon: Ambulance,   label: 'Patient Transport',color: 'text-warning',   bg: 'bg-warning/10' },
  care_assistant:      { icon: Shield,      label: 'Care Assistant',   color: 'text-accent',    bg: 'bg-accent/10' },
  physiotherapist:     { icon: Activity,    label: 'Physiotherapy',    color: 'text-success',   bg: 'bg-success/10' },
  follow_up:           { icon: RefreshCw,   label: 'Follow Up',        color: 'text-secondary', bg: 'bg-secondary/10' },
  diagnostic_center:   { icon: Package,     label: 'Diagnostic',       color: 'text-warning',   bg: 'bg-warning/10' },
  diagnostic_home:     { icon: Package,     label: 'Home Diagnostic',  color: 'text-warning',   bg: 'bg-warning/10' },
};

const ACTIVE_STATUSES = [
  'driver_assigned','driver_accepted','driver_en_route',
  'driver_arrived','otp_verified','in_progress','at_stop',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const today = new Date();
  const diff = Math.floor((d - today) / 86400000);
  if (Math.abs(diff) < 1) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const truncate = (str, n = 32) => str && str.length > n ? str.slice(0, n) + '…' : str || '—';

// ─────────────────────────────────────────────────────────────────────────────
// REJECT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function RejectModal({ ride, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  const REASONS = [
    'Vehicle breakdown', 'Personal emergency',
    'Too far from pickup', 'Already on another trip', 'Other',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-neutral/80 backdrop-blur-soft flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl bg-base-200 border border-base-300 p-6 pb-10"
      >
        <div className="w-10 h-1.5 rounded-full bg-base-300 mx-auto mb-5" />
        
        {/* Modal header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-error/10 border border-error/30 flex items-center justify-center">
            <XCircle size={18} className="text-error" />
          </div>
          <div>
            <h3 className="text-sm font-black text-base-content">Reject this ride?</h3>
            <p className="text-xs text-base-content/45 mt-0.5">Booking #{ride?.booking?.bookingCode || '—'}</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-3">Select a reason</p>
        <div className="flex flex-col gap-2 mb-5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold text-left transition-all duration-150 cursor-pointer ${
                reason === r
                  ? 'bg-error/12 border-error/50 text-error'
                  : 'bg-base-300/40 border-base-300 text-base-content/70 hover:border-error/30 hover:bg-error/5'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                reason === r ? 'border-error bg-error' : 'border-base-content/25 bg-transparent'
              }`}>
                {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              {r}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1 rounded-xl border border-base-300 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason || loading}
            className="btn btn-error flex-[2] rounded-xl text-sm font-bold"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> Confirm Reject</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, value, label, color, bg }) {
  return (
    <div className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl border border-base-300 flex-1 ${bg || 'bg-base-200'}`}>
      <Icon size={14} className={color} />
      <span className={`text-sm font-black leading-tight text-center truncate w-full text-center ${color}`}>{value ?? '—'}</span>
      <span className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider text-center leading-tight">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE CARD
// ─────────────────────────────────────────────────────────────────────────────

function RideCard({ ride, onAccept, onReject, onNavigate, acceptingId, rejectingId }) {
  const bk       = ride.booking;
  const status   = ride.status || 'searching';
  const meta     = STATUS_META[status] || STATUS_META.searching;
  const bkType   = BOOKING_TYPE_META[bk?.bookingType] || BOOKING_TYPE_META.patient_transport;
  const TypeIcon = bkType.icon;

  const isNew       = status === 'driver_assigned';
  const canNavigate = ['driver_accepted','driver_en_route','driver_arrived','otp_verified','in_progress','at_stop'].includes(status);
  const isDone      = ['completed','cancelled'].includes(status);

  const isAccepting = acceptingId === ride._id;
  const isRejecting = rejectingId === ride._id;

  const pickup  = ride.pickup?.address  || bk?.patientLocation?.address  || '—';
  const dropoff = ride.dropoff?.address || bk?.destinationLocation?.address || '—';
  const sched   = bk?.scheduledAt || ride.scheduledPickupAt;
  const patient = bk?.patientInfo?.name || bk?.customer?.name || '—';
  const phone   = bk?.customer?.phone || '—';

  const distKm  = ride.estimatedDistanceKm ? `${ride.estimatedDistanceKm.toFixed(1)} km` : null;
  const durMin  = ride.estimatedDurationMin ? `${ride.estimatedDurationMin} min` : null;
  const fare    = bk?.fareBreakdown?.transportFee ? bk.fareBreakdown.transportFee.toFixed(0) : null;
  const totalFare = bk?.fareBreakdown?.totalAmount ? bk.fareBreakdown.totalAmount.toFixed(0) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl bg-base-200 border transition-all duration-200 ${
        isNew
          ? 'border-warning/50 shadow-[0_0_0_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.10)]'
          : isDone
          ? 'border-base-300 opacity-75'
          : 'border-base-300/80 shadow-depth'
      }`}
    >
      {/* New ride glow bar */}
      {isNew && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-warning" style={{ boxShadow: '0 0 8px var(--warning)' }} />
      )}

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-base-300/50">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bkType.bg} border border-base-300`}>
            <TypeIcon size={17} className={bkType.color} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-base-content tracking-tight">
                #{bk?.bookingCode || ride.rideCode || '—'}
              </span>
              {ride.isReturnRide && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-secondary/15 border border-secondary/30 text-[9px] font-bold text-secondary uppercase tracking-wider">
                  <RefreshCw size={7} /> Return
                </span>
              )}
            </div>
            <span className="text-[10px] text-base-content/40 font-semibold">{bkType.label}</span>
          </div>
        </div>

        {/* Status + fare */}
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${meta.bg} ${meta.border} ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot} ${meta.pulse ? 'animate-pulse' : ''}`} />
            {meta.label}
          </span>
          {fare && (
            <span className="text-xs font-black text-warning flex items-center gap-0.5">
              <IndianRupee size={10} />
              {fare}
            </span>
          )}
        </div>
      </div>

      {/* ── PATIENT INFO ── */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-base-300/50 bg-base-100/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-base-content">{patient}</p>
            <p className="text-[10px] text-base-content/40 font-medium">Patient</p>
          </div>
        </div>

        {/* CALL BUTTON — always visible, prominent */}
        {phone !== '—' && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/12 border border-success/35 text-success text-xs font-bold hover:bg-success hover:text-success-content transition-all duration-200 no-underline"
          >
            <PhoneCall size={13} />
            <span>{phone}</span>
          </a>
        )}
      </div>

      {/* ── ROUTE ── */}
      <div className="px-4 py-3 border-b border-base-300/50">
        <div className="flex gap-3">
          {/* Route line visual */}
          <div className="flex flex-col items-center gap-0.5 pt-1 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-success border-2 border-base-100 shadow-sm" />
            <div className="w-px flex-1 bg-gradient-to-b from-success/50 to-error/50 min-h-[22px]" style={{ minHeight: 22 }} />
            <div className="w-3 h-3 rounded-full bg-error border-2 border-base-100 shadow-sm" />
          </div>

          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-base-content leading-snug truncate">{truncate(pickup, 40)}</p>
              <p className="text-[9px] text-success font-semibold uppercase tracking-wider mt-0.5">Pickup</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-base-content leading-snug truncate">{truncate(dropoff, 40)}</p>
              <p className="text-[9px] text-error font-semibold uppercase tracking-wider mt-0.5">Drop-off</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRIP META ── */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-base-300/50">
        {sched && (
          <div className="flex items-center gap-1.5 bg-base-300/50 rounded-lg px-2.5 py-1.5">
            <Calendar size={10} className="text-base-content/40 flex-shrink-0" />
            <span className="text-[10px] text-base-content/65 font-semibold whitespace-nowrap">
              {fmtDate(sched)} · {fmtTime(sched)}
            </span>
          </div>
        )}
        {distKm && (
          <div className="flex items-center gap-1.5 bg-primary/8 rounded-lg px-2.5 py-1.5">
            <Route size={10} className="text-primary flex-shrink-0" />
            <span className="text-[10px] text-primary font-bold">{distKm}</span>
          </div>
        )}
        {durMin && (
          <div className="flex items-center gap-1.5 bg-base-300/50 rounded-lg px-2.5 py-1.5">
            <Timer size={10} className="text-base-content/40 flex-shrink-0" />
            <span className="text-[10px] text-base-content/60 font-semibold">{durMin}</span>
          </div>
        )}
        {totalFare && (
          <div className="flex items-center gap-1 ml-auto bg-warning/10 rounded-lg px-2.5 py-1.5 border border-warning/25">
            <IndianRupee size={9} className="text-warning flex-shrink-0" />
            <span className="text-[10px] font-black text-warning">{totalFare} total</span>
          </div>
        )}
      </div>

      {/* ── ACTIONS ── */}
      <div className="px-4 py-3">

        {/* NEW RIDE: Reject + Accept */}
        {isNew && (
          <div className="flex gap-2.5">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onReject(ride)}
              disabled={isAccepting || isRejecting}
              className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-error/35 bg-error/8 text-error text-xs font-bold transition-all hover:bg-error/15 disabled:opacity-50 cursor-pointer"
            >
              {isRejecting ? <Loader2 size={13} className="animate-spin" /> : <><XCircle size={13} /> Reject</>}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onAccept(ride)}
              disabled={isAccepting || isRejecting}
              className="flex items-center justify-center gap-2 flex-[2.5] py-3 rounded-xl bg-success text-success-content text-xs font-black shadow-success transition-all hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              {isAccepting
                ? <Loader2 size={13} className="animate-spin" />
                : <><CheckCircle size={14} /> Accept Ride</>}
            </motion.button>
          </div>
        )}

        {/* ACTIVE RIDE: Navigate */}
        {canNavigate && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate(ride)}
            className="  gap-2 w-full py-3 rounded-xl  btn btn-primary text-primary-content text-xs font-black shadow-primary transition-all hover:brightness-105 cursor-pointer"
          >
            <Navigation2 size={14} />
            <span>Navigate to Pickup</span>
            <ChevronRight size={13} className="ml-auto" />
          </motion.button>
        )}

        {/* DONE: View details */}
        {!isNew && !canNavigate && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate(ride)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-base-300/60 border border-base-300 text-base-content/55 text-xs font-semibold transition-all hover:border-primary/40 hover:text-primary cursor-pointer"
          >
            <Eye size={13} /> View Details
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ filter }) {
  const msgs = {
    active: { title: 'No active rides', sub: 'Accept a ride to see it here' },
    new:    { title: 'No new requests', sub: 'New rides will appear instantly' },
    done:   { title: 'No completed rides', sub: 'Finished rides show here' },
    all:    { title: 'No rides yet', sub: 'Assignments will appear here' },
  };
  const m = msgs[filter] || msgs.all;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-3xl bg-base-200 border border-base-300 flex items-center justify-center">
          <Car size={28} className="text-base-content/20" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-base-300 border border-base-200 flex items-center justify-center">
          <Clock size={13} className="text-base-content/30" />
        </div>
      </div>
      <p className="text-sm font-black text-base-content/55 mb-1.5">{m.title}</p>
      <p className="text-xs text-base-content/30 font-medium">{m.sub}</p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-base-200 border border-base-300 overflow-hidden">
      <div className="p-4 border-b border-base-300/50 flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton h-2 w-16 rounded" />
        </div>
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="p-4 border-b border-base-300/50 flex items-center gap-3">
        <div className="skeleton w-8 h-8 rounded-full" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="skeleton h-2.5 w-32 rounded" />
          <div className="skeleton h-2 w-16 rounded" />
        </div>
        <div className="skeleton h-8 w-28 rounded-xl" />
      </div>
      <div className="p-4 border-b border-base-300/50 flex flex-col gap-3">
        <div className="skeleton h-2.5 w-4/5 rounded" />
        <div className="skeleton h-2.5 w-3/5 rounded" />
      </div>
      <div className="p-4">
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SoloDriverBookings() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const rides        = useSelector(selectDriverAssignedRides);
  const driverInfo   = useSelector(selectDriverInfo);
  const loadingRides = useSelector(selectLoading('fetchDriverAssignedRides'));
  const socketConn   = useSelector(selectSocketConnected);

  const [filter,      setFilter]      = useState('all');
  const [rejectRide,  setRejectRide]  = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  useEffect(() => { dispatch(fetchDriverAssignedRides()); }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchDriverAssignedRides());
    setRefreshing(false);
  }, [dispatch]);

  const handleAccept = useCallback(async (ride) => {
    const bookingId = ride.booking?._id || ride.booking;
    setAcceptingId(ride._id);
    try {
      await dispatch(acceptRide({ bookingId })).unwrap();
      dispatch(fetchDriverAssignedRides());
    } catch (_) {}
    finally { setAcceptingId(null); }
  }, [dispatch]);

  const handleRejectConfirm = useCallback(async (reason) => {
    if (!rejectRide) return;
    const bookingId = rejectRide.booking?._id || rejectRide.booking;
    setRejectingId(rejectRide._id);
    try {
      await dispatch(rejectRide({ bookingId, reason })).unwrap();
      dispatch(fetchDriverAssignedRides());
    } catch (_) {}
    finally { setRejectingId(null); setRejectRide(null); }
  }, [dispatch, rejectRide]);

  const handleNavigate = useCallback((ride) => {
    const bookingId = ride.booking?._id || ride.booking;
    if (bookingId && ride._id) router.push(`/partner/solo/tracking/${bookingId}/${ride._id}`);
  }, [router]);

  const newCount    = useMemo(() => rides.filter(r => r.status === 'driver_assigned').length, [rides]);
  const activeCount = useMemo(() => rides.filter(r => ACTIVE_STATUSES.includes(r.status) && r.status !== 'driver_assigned').length, [rides]);
  const doneCount   = useMemo(() => rides.filter(r => ['completed','cancelled'].includes(r.status)).length, [rides]);

  const filtered = useMemo(() => {
    if (!rides?.length) return [];
    switch (filter) {
      case 'new':    return rides.filter(r => r.status === 'driver_assigned');
      case 'active': return rides.filter(r => ACTIVE_STATUSES.includes(r.status) && r.status !== 'driver_assigned');
      case 'done':   return rides.filter(r => ['completed','cancelled'].includes(r.status));
      default:       return rides;
    }
  }, [rides, filter]);

  const FILTERS = [
    { key: 'all',    label: 'All',    count: rides.length,   accent: null },
    { key: 'new',    label: 'New',    count: newCount,        accent: 'warning' },
    { key: 'active', label: 'Active', count: activeCount,     accent: 'success' },
    { key: 'done',   label: 'Done',   count: doneCount,       accent: null },
  ];

  return (
    <div className="min-h-screen bg-base-100 flex flex-col font-poppins">
            <BackButton className=' my-2 rounded-md px-3' />
      
      {/* ── HEADER ── */}
      <div className="bg-base-200 border-b border-base-300 px-4 pb-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Car size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-base font-black text-base-content leading-tight">My Rides</h1>
              {driverInfo && (
                <p className="text-[10px] text-base-content/40 font-semibold">
                  {driverInfo.driverCode}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold transition-all ${
              socketConn
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-error/10 border-error/30 text-error'
            }`}>
              {socketConn ? <Wifi size={9} /> : <WifiOff size={9} />}
              {socketConn ? 'Live' : 'Offline'}
            </div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleRefresh}
              disabled={loadingRides || refreshing}
              className="w-9 h-9 rounded-xl bg-base-300/60 border border-base-300 flex items-center justify-center cursor-pointer text-base-content/50 hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={loadingRides || refreshing ? 'animate-spin' : ''} />
            </motion.button>
          </div>
        </div>

        {/* Driver stats row */}
        {driverInfo && (
          <div className="flex gap-2 mb-4">
            <StatPill
              icon={Car}
              value={driverInfo.assignedVehicleSnapshot?.registrationNumber?.slice(-6) || '—'}
              label="Vehicle"
              color="text-primary"
            />
            <StatPill
              icon={Activity}
              value={driverInfo.status || 'Available'}
              label="Status"
              color={driverInfo.status === 'On-Trip' ? 'text-success' : 'text-accent'}
            />
            <StatPill
              icon={CheckCircle}
              value={doneCount}
              label="Done"
              color="text-success"
            />
          </div>
        )}

        {/* New ride alert banner */}
        <AnimatePresence>
          {newCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-warning/12 border border-warning/35">
                <div className="w-6 h-6 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
                  <Bell size={11} className="text-warning animate-pulse" />
                </div>
                <p className="text-xs font-bold text-warning flex-1">
                  {newCount} new ride{newCount > 1 ? 's' : ''} waiting for your response
                </p>
                <div className="w-2 h-2 rounded-full bg-warning animate-ping" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {FILTERS.map((f) => (
            <motion.button
              key={f.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all duration-150 flex-shrink-0 cursor-pointer ${
                filter === f.key
                  ? 'bg-primary text-primary-content border-primary shadow-primary'
                  : 'bg-base-300/50 text-base-content/55 border-base-300 hover:border-primary/40 hover:text-base-content'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black ${
                  filter === f.key
                    ? 'bg-white/20 text-primary-content'
                    : f.accent === 'warning'
                    ? 'bg-warning text-warning-content'
                    : f.accent === 'success'
                    ? 'bg-success text-success-content'
                    : 'bg-base-content/15 text-base-content/60'
                }`}>
                  {f.count}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">

        {/* Loading skeleton */}
        {loadingRides && !rides.length && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Ride list */}
        {(!loadingRides || rides.length > 0) && (
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              <div className="flex flex-col gap-3">
                {filtered.map((ride) => (
                  <RideCard
                    key={ride._id}
                    ride={ride}
                    onAccept={handleAccept}
                    onReject={setRejectRide}
                    onNavigate={handleNavigate}
                    acceptingId={acceptingId}
                    rejectingId={rejectingId}
                  />
                ))}
              </div>
            ) : (
              <EmptyState filter={filter} />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ── REJECT MODAL ── */}
      <AnimatePresence>
        {rejectRide && (
          <RejectModal
            ride={rejectRide}
            onConfirm={handleRejectConfirm}
            onClose={() => setRejectRide(null)}
            loading={rejectingId === rejectRide._id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}