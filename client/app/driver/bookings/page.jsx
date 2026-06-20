'use client';

/**
 * DriverBookings.jsx — Likeson.in
 * Driver's assigned rides dashboard.
 * Uses operationsSlice + rideRequestSlice.
 * Tracking button links to existing /tracking/[rideId] page.
 * Styled using global.css classes only — zero inline CSS.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { useRouter }                         from 'next/navigation';
import Link                                  from 'next/link';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  MapPin, Navigation2, Clock, Phone, User,
  CheckCircle2, XCircle, Play, Flag, AlertTriangle,
  Pause, RefreshCw, ChevronRight, Car, Route,
  ArrowLeft, Activity, TrendingUp, Shield, Star, Zap, MoreVertical,
Eye, Radio, Circle,
  QrCode, DollarSign, Wallet,
} from 'lucide-react';

import {
  fetchDriverAssignedRides,
  acceptRide,
  rejectRide,
  markDriverArrived,
  endRide,
  selectDriverAssignedRides,
  selectDriverInfo,
  selectLoading,
  selectActiveRide,
} from '@/store/slices/operationsSlice';

import toast from 'react-hot-toast';

import {
  generatePayAtServiceLink,
  fetchPayAtServiceStatus,
  markCollectedByPartner,
  markServiceComplete,
  paidFromSocket,
  clearSession,
  selectPayAtServiceSession,
  selectPayAtServiceLoading,
  selectCanMarkComplete,
  selectNeedsNewLink,
} from '@/store/slices/payAtServiceSlice';

import {
  updateRideStatus,
  selectStatusUpdating,
} from '@/store/slices/rideRequestSlice';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const STATUS = {
  searching:       { label: 'Searching',    badgeClass: 'badge badge-warning',  pulse: true  },
  driver_assigned: { label: 'Assigned',     badgeClass: 'badge badge-info',     pulse: true  },
  driver_accepted: { label: 'Accepted',     badgeClass: 'badge badge-primary',  pulse: false },
  driver_en_route: { label: 'En Route',     badgeClass: 'badge badge-info',     pulse: true  },
  driver_arrived:  { label: 'Arrived',      badgeClass: 'badge badge-success',  pulse: true  },
  otp_verified:    { label: 'OTP Verified', badgeClass: 'badge badge-success',  pulse: false },
  in_progress:     { label: 'In Progress',  badgeClass: 'badge badge-success',  pulse: true  },
  at_stop:         { label: 'At Stop',      badgeClass: 'badge badge-warning',  pulse: false },
  completed:       { label: 'Completed',    badgeClass: 'badge badge-secondary',pulse: false },
  cancelled:       { label: 'Cancelled',    badgeClass: 'badge badge-error',    pulse: false },
};

const ACTIVE_STATUSES = [
  'driver_assigned','driver_accepted','driver_en_route',
  'driver_arrived','otp_verified','in_progress','at_stop',
];

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BUTTONS PER STATUS
// ─────────────────────────────────────────────────────────────────────────────

const getActions = (ride) => {
  const s   = ride.status;
  const id  = ride._id;
  const bId = ride.booking?._id || ride.booking;
  const actions = [];

  if (s === 'driver_assigned') {
    actions.push({ id: 'accept',      label: 'Accept Ride',   icon: CheckCircle2, btnClass: 'btn btn-success btn-sm', action: 'accept',      rideId: id });
    actions.push({ id: 'reject',      label: 'Reject',        icon: XCircle,      btnClass: 'btn btn-error btn-sm',   action: 'reject',      rideId: id, bookingId: bId });
  }
  if (s === 'driver_accepted') {
    actions.push({ id: 'start_route', label: 'Start Route',   icon: Navigation2,  btnClass: 'btn btn-primary btn-sm', action: 'start_route', rideId: id });
  }
  if (s === 'driver_en_route') {
    actions.push({ id: 'arrived',     label: 'Mark Arrived',  icon: MapPin,       btnClass: 'btn btn-primary btn-sm', action: 'arrived',     rideId: id, bookingId: bId });
  }
  if (s === 'driver_arrived' || s === 'otp_verified') {
    actions.push({ id: 'start_ride',  label: 'Start Ride',    icon: Play,         btnClass: 'btn btn-success btn-sm', action: 'start_ride',  rideId: id });
  }
  if (s === 'in_progress') {
    actions.push({ id: 'at_stop',     label: 'At Stop',       icon: Pause,        btnClass: 'btn btn-warning btn-sm', action: 'at_stop',     rideId: id });
    actions.push({ id: 'complete',    label: 'Complete Ride', icon: Flag,         btnClass: 'btn btn-success btn-sm', action: 'complete',    rideId: id });
  }
  if (s === 'at_stop') {
    actions.push({ id: 'resume',      label: 'Resume',        icon: Play,         btnClass: 'btn btn-primary btn-sm', action: 'resume',      rideId: id });
  }

  return actions;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const truncate = (str, n = 45) =>
  str?.length > n ? str.slice(0, n) + '…' : str || '—';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.cancelled;
  return (
    <span className={cfg.badgeClass}>
      <span className={`status-dot ${
        cfg.pulse ? 'status-dot-warning animate-spin' : ''
      } ${cfg.badgeClass.includes('success') ? 'status-dot-success' :
          cfg.badgeClass.includes('error')   ? 'status-dot-error'   :
          cfg.badgeClass.includes('info')    ? 'status-dot-info'    :
          cfg.badgeClass.includes('warning') ? 'status-dot-warning' : ''
      }`} style={{ animationName: cfg.pulse ? 'pulseRing' : 'none', animationDuration: '1.5s', animationIterationCount: 'infinite' }} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT PILL
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, colorClass }) {
  return (
    <div className={`stat-card flex items-center gap-3 p-3`}>
      <span className={`avatar ${colorClass}`}>
        <div className="w-8 h-8 rounded-lg">
          <Icon size={15} />
        </div>
      </span>
      <div>
        <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({ action, onClick, loading }) {
  const Icon = action.icon;
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick(action)}
      disabled={loading}
      className={action.btnClass}
    >
      {loading
        ? <span className="loading loading-xs loading-spinner" />
        : <Icon size={14} />}
      {action.label}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION ROW
// ─────────────────────────────────────────────────────────────────────────────

function LocationRow({ icon: Icon, label, address, colorClass, iconColorClass }) {
  return (
    <div className="flex gap-3 items-start">
      <span className={`avatar ${colorClass}`}>
        <div className="w-8 h-8 rounded-lg flex-shrink-0">
          <Icon size={14} className={iconColorClass} />
        </div>
      </span>
      <div>
        <div className="label-text-alt uppercase tracking-wider">{label}</div>
        <p className="text-sm mt-1 leading-snug text-base-content/70">{truncate(address)}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE CARD
// ─────────────────────────────────────────────────────────────────────────────

function RideCard({ ride, onAction, actionLoading, onPayAtService }) {
  const [expanded, setExpanded] = useState(false);
  const actions  = getActions(ride);
  const isActive = ACTIVE_STATUSES.includes(ride.status);
  const booking  = ride.booking;
  const patient  = booking?.patientInfo;
  const customer = booking?.customer;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`card overflow-hidden ${isActive ? 'border-primary/30 shadow-primary' : ''}`}
    >
      {/* Active shimmer bar */}
      {isActive && (
        <div className="h-1 bg-gradient-to-r from-primary via-info to-secondary bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]" />
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-base-300">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Car size={17} className="text-primary" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base-content tracking-wide text-sm">
                {ride.rideCode || '—'}
              </span>
              {booking?.bookingCode && (
                <span className="text-base-content/40 text-xs font-semibold">
                  #{booking.bookingCode}
                </span>
              )}
            </div>
            <div className="text-xs text-base-content/40 mt-0.5">{fmt(ride.scheduledPickupAt)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={ride.status} />
          <button
            onClick={() => setExpanded(v => !v)}
            className="btn btn-ghost btn-xs btn-circle"
          >
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={15} />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Patient */}
        {patient && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
            <div className="avatar placeholder flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary">
                <User size={15} className="text-primary-content" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-base-content truncate">{patient.name}</div>
              {customer?.phone && (
                <div className="text-xs text-base-content/50 mt-0.5">{customer.phone}</div>
              )}
            </div>
            {customer?.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="btn btn-success btn-xs btn-circle"
              >
                <Phone size={13} />
              </a>
            )}
          </div>
        )}

        {/* Route */}
        <div className="space-y-3">
          <LocationRow
            icon={MapPin}
            label="Pickup"
            address={ride.pickup?.address || ride.pickup?.label}
            colorClass="bg-success/10 border-success/20"
            iconColorClass="text-success"
          />

          <div className="flex items-center gap-2 pl-2">
            <div className="w-4 h-px bg-base-300" />
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1 h-1 rounded-full bg-base-300" />
              ))}
            </div>
            <div className="flex-1 h-px bg-base-300" />
            {ride.estimatedDistanceKm && (
              <span className="text-xs text-base-content/40 font-semibold">
                {ride.estimatedDistanceKm} km
              </span>
            )}
          </div>

          <LocationRow
            icon={Flag}
            label="Dropoff"
            address={ride.dropoff?.address || ride.dropoff?.label}
            colorClass="bg-warning/10 border-warning/20"
            iconColorClass="text-warning"
          />
        </div>

        {/* Stats chips */}
        <div className="flex flex-wrap gap-2">
          {ride.estimatedDurationMin && (
            <span className="badge badge-secondary badge-sm gap-1">
              <Clock size={11} />
              ~{ride.estimatedDurationMin} min
            </span>
          )}
          {ride.rideType && (
            <span className="badge badge-secondary badge-sm gap-1 capitalize">
              <Activity size={11} />
              {ride.rideType}
            </span>
          )}
          {booking?.fareBreakdown?.transportFee && (
            <span className="badge badge-success badge-sm font-bold">
              ₹{booking.fareBreakdown.transportFee}
            </span>
          )}
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="divider my-0" />
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div>
                  <div className="label-text-alt uppercase tracking-wider">Booking Type</div>
                  <div className="text-sm text-base-content/60 mt-1 capitalize">{booking?.bookingType || '—'}</div>
                </div>
                <div>
                  <div className="label-text-alt uppercase tracking-wider">Vehicle Class</div>
                  <div className="text-sm text-base-content/60 mt-1 capitalize">{ride.vehicleClass || '—'}</div>
                </div>
                {ride.vehicleSnapshot && (
                  <>
                    <div>
                      <div className="label-text-alt uppercase tracking-wider">Vehicle</div>
                      <div className="text-sm text-base-content/60 mt-1">
                        {ride.vehicleSnapshot.make} {ride.vehicleSnapshot.model}
                      </div>
                    </div>
                    <div>
                      <div className="label-text-alt uppercase tracking-wider">Reg. No.</div>
                      <div className="text-sm text-base-content/60 mt-1 font-mono">
                        {ride.vehicleSnapshot.registrationNumber || '—'}
                      </div>
                    </div>
                  </>
                )}
                {ride.driverAssignedAt && (
                  <div className="col-span-2">
                    <div className="label-text-alt uppercase tracking-wider">Assigned At</div>
                    <div className="text-sm text-base-content/60 mt-1">{fmt(ride.driverAssignedAt)}</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA row */}
        <div className="flex flex-wrap gap-2 items-center pt-1">
          {actions.map(action => (
            <ActionButton
              key={action.id}
              action={action}
              onClick={onAction}
              loading={actionLoading === action.rideId + action.id}
            />
          ))}

          {/* QR Pay button — active rides with non-zero amount, non-online */}
          {isActive && booking?._id && booking?.bookingType !== 'doctor_online' && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn btn-sm bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-primary-content gap-1.5"
              onClick={() => onPayAtService({
                bookingId:   booking._id,
                bookingCode: booking.bookingCode,
                amount:      booking.fareBreakdown?.totalAmount ?? booking.fareBreakdown?.transportFee ?? 0,
              })}
            >
              <QrCode size={13} />
              QR Pay
            </motion.button>
          )}

          {isActive && booking?._id && (
  <Link href={`/driver/tracking/${booking._id}/${ride._id}`} passHref legacyBehavior>
    <motion.a
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="btn btn-sm bg-info/10 border-info/30 text-info hover:bg-info hover:text-info-content gap-1.5"
    >
      <Radio size={13} className="animate-pulse" />
      Live Tracking
    </motion.a>
  </Link>
)}

          {ride.status === 'completed' && (
            <Link href={`/tracking/${ride._id}`} passHref legacyBehavior>
              <motion.a
                whileHover={{ scale: 1.03 }}
                className="btn btn-sm btn-ghost gap-1.5"
              >
                <Eye size={13} />
                View Summary
              </motion.a>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ filter }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="avatar placeholder mb-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15">
          <Car size={30} className="text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-extrabold text-base-content mb-2">
        No {filter === 'all' ? '' : filter} rides
      </h3>
      <p className="text-sm text-base-content/50 max-w-xs leading-relaxed">
        {filter === 'active'
          ? 'You have no active rides. New assignments will appear here.'
          : 'Completed and cancelled rides will show here.'}
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER HEADER
// ─────────────────────────────────────────────────────────────────────────────

function DriverHeader({ driver, rides }) {
  const active    = rides.filter(r => ACTIVE_STATUSES.includes(r.status)).length;
  const completed = rides.filter(r => r.status === 'completed').length;
  const total     = rides.length;

  return (
    <div className="card p-5 mb-5">
      {/* Driver info */}
      <div className="flex items-center gap-4 mb-5">
        <div className="avatar placeholder flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary">
            <Car size={24} className="text-primary-content" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-base-content truncate">
              {driver?.legalName || 'Driver Dashboard'}
            </h2>
            <span className="badge badge-success badge-sm">
              {driver?.status || 'Active'}
            </span>
          </div>
          <div className="text-xs text-base-content/40 mt-1">
            {driver?.driverCode && <span className="font-mono">{driver.driverCode}</span>}
            {driver?.type && (
              <span> · {driver.type === 'agency' ? 'Agency Driver' : 'Solo Partner'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="stat-card p-3 text-center">
          <div className="stat-card-value text-info">{active}</div>
          <div className="stat-card-label">Active</div>
        </div>
        <div className="stat-card p-3 text-center">
          <div className="stat-card-value text-success">{completed}</div>
          <div className="stat-card-label">Done</div>
        </div>
        <div className="stat-card p-3 text-center">
          <div className="stat-card-value text-primary">{total}</div>
          <div className="stat-card-label">Total</div>
        </div>
      </div>

      {/* Vehicle */}
      {driver?.assignedVehicleSnapshot && (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-base-200 border border-base-300">
          <Car size={14} className="text-base-content/40 flex-shrink-0" />
          <span className="text-xs text-base-content/50 font-semibold">
            {driver.assignedVehicleSnapshot.make} {driver.assignedVehicleSnapshot.model}
            {driver.assignedVehicleSnapshot.registrationNumber &&
              ` · ${driver.assignedVehicleSnapshot.registrationNumber}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────────────────────

function FilterTabs({ value, onChange }) {
  const tabs = [
    { id: 'active',  label: 'Active',  icon: Activity },
    { id: 'history', label: 'History', icon: Clock    },
    { id: 'all',     label: 'All',     icon: Car      },
  ];

  return (
    <div className="flex gap-1 p-1.5 bg-base-200 rounded-2xl border border-base-300 mb-5">
      {tabs.map(tab => {
        const Icon   = tab.icon;
        const active = value === tab.id;
        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all duration-200 border
              ${active
                ? 'bg-primary/15 text-primary border-primary/30 font-bold'
                : 'bg-transparent text-base-content/40 border-transparent hover:text-base-content/70'
              }`}
          >
            <Icon size={13} />
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
            <span className="xs:hidden sm:hidden">{tab.label.slice(0,3)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETONS
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[0,1,2].map(i => (
        <div
          key={i}
          className="skeleton h-40 rounded-2xl"
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PAY-AT-SERVICE PANEL
// ─────────────────────────────────────────────────────────────────────────────

function PayAtServicePanel({ bookingId, bookingCode, amount, onClose }) {
  const dispatch    = useDispatch();
  const session     = useSelector(selectPayAtServiceSession(bookingId));
  const loadFlags   = useSelector(selectPayAtServiceLoading);
  const canComplete = useSelector(selectCanMarkComplete(bookingId));
  const needsNew    = useSelector(selectNeedsNewLink(bookingId));

  const [cashAmt,  setCashAmt]  = useState(String(amount ?? ''));
  const [cashNote, setCashNote] = useState('');

  // Poll every 5s while link active and unpaid
  useEffect(() => {
    if (!session?.shortUrl || session?.paid || session?.expired) return;
    const id = setInterval(() => dispatch(fetchPayAtServiceStatus({ bookingId })), 5000);
    return () => clearInterval(id);
  }, [session?.shortUrl, session?.paid, session?.expired, bookingId, dispatch]);

  // Cleanup on unmount
  useEffect(() => () => dispatch(clearSession({ bookingId })), [bookingId, dispatch]);

  const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const handleCashCollect = () => {
    const n = parseFloat(cashAmt);
    if (!n || n <= 0) { alert('Enter valid amount'); return; }
    dispatch(markCollectedByPartner({ bookingId, amount: n, method: 'cash', note: cashNote }));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="w-full max-w-md bg-base-100 rounded-t-2xl border-t border-base-300 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-base-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <QrCode size={17} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">Pay at Service</p>
                <p className="text-xs text-base-content/50">#{bookingCode} · {fmtAmt(amount)}</p>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle">✕</button>
          </div>

          <div className="p-5 space-y-4 pb-8">

            {/* Paid */}
            {session?.paid && (
              <div className="flex items-center gap-2 p-3 bg-success/10 rounded-xl border border-success/20">
                <CheckCircle2 size={16} className="text-success" />
                <div>
                  <p className="text-sm font-bold text-success">Payment Confirmed</p>
                  <p className="text-xs text-base-content/60">{fmtAmt(session.amount)} received</p>
                </div>
              </div>
            )}

            {/* Awaiting */}
            {session?.shortUrl && !session?.paid && !session?.expired && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-xl border border-warning/20">
                <Clock size={16} className="text-warning" />
                <div>
                  <p className="text-sm font-semibold text-warning">Awaiting Payment</p>
                  <p className="text-xs text-base-content/60 break-all">{session.shortUrl}</p>
                </div>
              </div>
            )}

            {/* Generate QR */}
            {(needsNew || !session?.shortUrl) && !session?.paid && (
              <div className="space-y-2">
                <p className="text-xs text-base-content/60">Generate Razorpay QR — show to patient</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="btn btn-primary w-full gap-2"
                  disabled={loadFlags.generateLink}
                  onClick={() => dispatch(generatePayAtServiceLink({ bookingId }))}
                >
                  {loadFlags.generateLink
                    ? <span className="loading loading-xs loading-spinner" />
                    : <QrCode size={14} />}
                  {needsNew ? 'Regenerate QR Link' : 'Generate QR Link'}
                </motion.button>
              </div>
            )}

            {/* Cash fallback */}
            {!session?.paid && (
              <div className="border border-base-300 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50 flex items-center gap-1.5">
                  <DollarSign size={12} /> Cash / Manual Fallback
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input input-bordered input-sm flex-1"
                    placeholder="Amount (₹)"
                    value={cashAmt}
                    onChange={(e) => setCashAmt(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input input-bordered input-sm flex-1"
                    placeholder="Note (optional)"
                    value={cashNote}
                    onChange={(e) => setCashNote(e.target.value)}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="btn btn-outline btn-sm w-full gap-2"
                  disabled={loadFlags.markCollected}
                  onClick={handleCashCollect}
                >
                  {loadFlags.markCollected
                    ? <span className="loading loading-xs loading-spinner" />
                    : <Wallet size={13} />}
                  Mark Cash Collected
                </motion.button>
              </div>
            )}

            {/* Mark complete */}
            {canComplete && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="btn btn-success w-full gap-2"
                disabled={loadFlags.markComplete}
                onClick={() => dispatch(markServiceComplete({ bookingId }))}
              >
                {loadFlags.markComplete
                  ? <span className="loading loading-xs loading-spinner" />
                  : <CheckCircle2 size={14} />}
                Mark Service Complete
              </motion.button>
            )}

            {session?.serviceCompleted && (
              <p className="text-center text-xs text-success font-bold">✅ Service marked complete</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverBookings() {
  const dispatch   = useDispatch();
  const router     = useRouter();
  const rides      = useSelector(selectDriverAssignedRides);
  const driver     = useSelector(selectDriverInfo);
  const loadingMap = useSelector(state => state.operations.loading);
  const isFetching = loadingMap['fetchDriverAssignedRides'] ?? false;

const [filter,        setFilter]        = useState('active');
  const [actionLoading, setActionLoading] = useState(null);
  const [payTarget,     setPayTarget]     = useState(null); // { bookingId, bookingCode, amount }

  // Fetch on mount
  useEffect(() => {
    dispatch(fetchDriverAssignedRides());
  }, [dispatch]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => dispatch(fetchDriverAssignedRides()), 30_000);
    return () => clearInterval(t);
  }, [dispatch]);

  // Filter rides
  const filteredRides = rides.filter(r => {
    if (filter === 'active')  return ACTIVE_STATUSES.includes(r.status);
    if (filter === 'history') return ['completed','cancelled'].includes(r.status);
    return true;
  });

  // Handle action
  const handleAction = useCallback(async (action) => {
    const loadingKey = action.rideId + action.id;
    setActionLoading(loadingKey);
    try {
      if (action.action === 'reject') {
        await dispatch(rejectRide({ bookingId: action.bookingId }));
      } else if (action.action === 'arrived' && action.bookingId) {
        await dispatch(markDriverArrived({ bookingId: action.bookingId }));
      } else {
        await dispatch(updateRideStatus({ rideId: action.rideId, action: action.action }));
      }
      dispatch(fetchDriverAssignedRides());
    } finally {
      setActionLoading(null);
    }
  }, [dispatch]);

  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70%  { box-shadow: 0 0 0 6px transparent; opacity: 0.7; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div className="min-h-screen bg-base-100 pb-20 font-sans">

        {/* ── Sticky top bar ── */}
        <div className="sticky top-0 z-40 px-4 py-3 bg-base-100/95 backdrop-blur-strong border-b border-base-300 flex items-center justify-between gap-3">

          {/* Go Back button */}
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm gap-1.5 flex-shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-lg font-black text-base-content tracking-tight leading-tight">
              My Rides
            </h1>
            <p className="text-xs text-base-content/30 font-semibold hidden sm:block">
              Likeson.in Driver Portal
            </p>
          </div>

          {/* Refresh */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => dispatch(fetchDriverAssignedRides())}
            disabled={isFetching}
            className="btn btn-ghost btn-sm btn-circle flex-shrink-0 text-primary border border-primary/20 bg-primary/8"
          >
            <RefreshCw
              size={16}
              className={isFetching ? 'animate-spin' : ''}
            />
          </motion.button>
        </div>

        {/* ── Content ── */}
        <div className="container-custom max-w-2xl py-5 space-y-0">

          {/* Driver header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <DriverHeader driver={driver} rides={rides} />
          </motion.div>

          {/* Filter tabs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <FilterTabs value={filter} onChange={setFilter} />
          </motion.div>

          {/* Loading skeleton */}
          {isFetching && rides.length === 0 && <SkeletonCards />}

          {/* Rides list */}
          {(!isFetching || rides.length > 0) && (
            filteredRides.length === 0
              ? <EmptyState filter={filter} />
              : (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-4">
                    {filteredRides.map((ride, i) => (
                      <motion.div
                        key={ride._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: i * 0.04 }}
                      >
                      <RideCard
                          ride={ride}
                          onAction={handleAction}
                          actionLoading={actionLoading}
                          onPayAtService={setPayTarget}
                        />
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              )
          )}

          {/* Count footer */}
          {filteredRides.length > 0 && (
            <p className="text-center text-xs text-base-content/30 font-semibold pt-6">
              Showing {filteredRides.length} ride{filteredRides.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
    </div>

      {payTarget && (
        <PayAtServicePanel
          bookingId={payTarget.bookingId}
          bookingCode={payTarget.bookingCode}
          amount={payTarget.amount}
          onClose={() => setPayTarget(null)}
        />
      )}
    </>
  );
}
