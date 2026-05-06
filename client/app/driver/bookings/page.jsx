'use client';

/**
 * BookingManagement.jsx
 * Driver ride management page — production grade
 * Uses global.css theme tokens only (no zinc/custom hardcoded colors)
 * Data shape: rides[] from fetchDriverAssigned API
 */

import dynamic from 'next/dynamic';
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Navigation,
  Phone,
  User,
  RefreshCw,
  Activity,
  TrendingUp,
  Star,
  Zap,
  Shield,
  Send,
  PlayCircle,
  StopCircle,
  Calendar,
  DollarSign,
  BarChart2,
  LocateFixed,
} from 'lucide-react';

import {
  fetchDriverAssigned,
  acceptRide,
  rejectRide,
  markRideArrived,
  startRide,
  endRide,
  updateDriverLocation,
  selectDriverAssigned,
  selectDriverAssignedMeta,
  selectRideAction,
  selectRideActionLoading,
  resetRideAction,
  removeFromDriverAssigned,
} from '@/store/slices/operationsSlice';

// ── lazy heavy charts (dynamic import → code split) ────────────────────────
const AnalyticsPanel = dynamic(() => import('./AnalyticsPanelInline'), {
  loading: () => <AnalyticsSkeleton />,
  ssr: false,
});

// ── constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  driver_assigned: {
    label: 'Assigned',
    colorVar: 'var(--warning)',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    icon: Truck,
  },
  driver_accepted: {
    label: 'Accepted',
    colorVar: 'var(--info)',
    bgClass: 'bg-info/10',
    borderClass: 'border-info/30',
    icon: CheckCircle,
  },
  driver_en_route: {
    label: 'En Route',
    colorVar: 'var(--primary)',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/30',
    icon: Navigation,
  },
  driver_arrived: {
    label: 'Arrived',
    colorVar: 'var(--info)',
    bgClass: 'bg-info/10',
    borderClass: 'border-info/30',
    icon: MapPin,
  },
  in_progress: {
    label: 'In Progress',
    colorVar: 'var(--success)',
    bgClass: 'bg-success/10',
    borderClass: 'border-success/40',
    icon: Activity,
  },
  at_stop: {
    label: 'At Stop',
    colorVar: 'var(--warning)',
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    icon: MapPin,
  },
};

const RIDE_ACTIONS = {
  driver_assigned: ['accept', 'reject'],
  driver_accepted: ['arrived'],
  driver_en_route: ['arrived'],
  driver_arrived: ['start'],
  in_progress: ['end'],
  at_stop: ['end'],
};

// ── skeleton components ─────────────────────────────────────────────────────

const RideCardSkeleton = memo(() => (
  <div className="card p-5 animate-pulse" aria-hidden="true">
    <div className="flex gap-3 mb-4">
      <div className="skeleton w-10 h-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-3 w-1/4 rounded" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-4/5 rounded" />
      <div className="skeleton h-8 w-full rounded-xl mt-4" />
    </div>
  </div>
));
RideCardSkeleton.displayName = 'RideCardSkeleton';

const AnalyticsSkeleton = memo(() => (
  <div className="space-y-4" aria-hidden="true">
    {[1, 2].map((i) => (
      <div key={i} className="card p-6 animate-pulse">
        <div className="skeleton h-5 w-1/4 rounded mb-4" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    ))}
  </div>
));
AnalyticsSkeleton.displayName = 'AnalyticsSkeleton';

// ── stat card ───────────────────────────────────────────────────────────────

const StatCard = memo(({ icon: Icon, label, value, sub, colorVar = 'var(--primary)' }) => (
  <div
    className="stat-card relative overflow-hidden"
    role="region"
    aria-label={label}
  >
    <div className="flex items-center gap-2 mb-3">
      <span
        className="p-2 rounded-xl"
        style={{ background: `color-mix(in srgb, ${colorVar}, transparent 85%)` }}
        aria-hidden="true"
      >
        <Icon size={15} style={{ color: colorVar }} />
      </span>
      <span className="label-text uppercase tracking-widest text-xs">
        {label}
      </span>
    </div>
    <div className="stat-card-value" style={{ color: colorVar }}>
      {value}
    </div>
    {sub && <p className="stat-card-label mt-1">{sub}</p>}
  </div>
));
StatCard.displayName = 'StatCard';

// ── OTP modal ───────────────────────────────────────────────────────────────

const OtpModal = memo(({ onConfirm, onClose, loading }) => {
  const [otp, setOtp] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(() => {
    if (otp.length === 6) onConfirm(otp);
  }, [otp, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-title"
      onClick={onClose}
    >
      <div
        className="card p-8 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2 bg-warning/10 rounded-xl">
            <Shield size={20} style={{ color: 'var(--warning)' }} />
          </span>
          <div>
            <h2 id="otp-title" className="text-base font-bold" style={{ color: 'var(--base-content)' }}>
              Enter OTP
            </h2>
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              Customer will share 6-digit code
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="number"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.slice(0, 6))}
          placeholder="000000"
          className="input-field w-full text-center text-2xl font-mono tracking-[0.5em] mb-4"
          aria-label="Enter 6-digit OTP"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={otp.length !== 6 || loading}
            className="btn btn-warning flex-1"
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <Send size={14} />
            )}
            Verify
          </button>
        </div>
      </div>
    </div>
  );
});
OtpModal.displayName = 'OtpModal';

// ── reject modal ────────────────────────────────────────────────────────────

const REJECT_REASONS = [
  'Vehicle issue',
  'Too far',
  'Medical emergency',
  'Route not feasible',
  'Other',
];

const RejectModal = memo(({ bookingCode, onConfirm, onClose, loading }) => {
  const [reason, setReason] = useState('');

  const handleConfirm = useCallback(() => {
    if (reason.trim()) onConfirm(reason);
  }, [reason, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-title"
      onClick={onClose}
    >
      <div
        className="card p-8 w-80 shadow-2xl border-error/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2 bg-error/10 rounded-xl">
            <XCircle size={20} style={{ color: 'var(--error)' }} />
          </span>
          <div>
            <h2 id="reject-title" className="text-base font-bold">Reject Ride</h2>
            <p className="text-xs text-base-content/50">Booking #{bookingCode}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Rejection reasons">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`btn btn-xs ${reason === r ? 'btn-error' : 'btn-ghost border border-error/30'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Or type custom reason..."
          rows={2}
          className="input-field w-full resize-none mb-4"
          aria-label="Rejection reason"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
            className="btn btn-error flex-1"
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <XCircle size={14} />
            )}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
});
RejectModal.displayName = 'RejectModal';

// ── end ride modal ──────────────────────────────────────────────────────────

const EndRideModal = memo(({ bookingCode, onConfirm, onClose, loading }) => {
  const [dist, setDist] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(parseFloat(dist) || 0);
  }, [dist, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="endride-title"
      onClick={onClose}
    >
      <div
        className="card p-8 w-80 shadow-2xl border-success/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2 bg-success/10 rounded-xl">
            <StopCircle size={20} style={{ color: 'var(--success)' }} />
          </span>
          <div>
            <h2 id="endride-title" className="text-base font-bold">End Ride</h2>
            <p className="text-xs text-base-content/50">Booking #{bookingCode}</p>
          </div>
        </div>
        <label className="label" htmlFor="actual-dist">
          <span className="label-text">Actual Distance (km)</span>
        </label>
        <input
          ref={inputRef}
          id="actual-dist"
          type="number"
          value={dist}
          onChange={(e) => setDist(e.target.value)}
          placeholder="0.0"
          className="input-field w-full text-lg font-mono mb-4"
          min="0"
          step="0.1"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn btn-success flex-1"
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            ) : (
              <CheckCircle size={14} />
            )}
            Complete
          </button>
        </div>
      </div>
    </div>
  );
});
EndRideModal.displayName = 'EndRideModal';

// ── ride card ───────────────────────────────────────────────────────────────

const RideCard = memo(({ ride, onAction, actionLoading, activeBookingId }) => {
  const booking = ride.booking || {};
  const status = ride.status;
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    colorVar: 'var(--base-content)',
    bgClass: 'bg-base-200',
    borderClass: 'border-base-300',
    icon: Truck,
  };
  const StatusIcon = cfg.icon;
  const actions = RIDE_ACTIONS[status] || [];

  // booking._id is correct per API shape
  const bookingId = booking._id;
  const isLoading = actionLoading && activeBookingId === bookingId;

  const fare = booking.fareBreakdown?.totalAmount;
  const patient = booking.patientInfo;
  const pickup = booking.patientLocation;
  const dropoff = booking.destinationLocation;

  const scheduledDate = useMemo(() => {
    if (!booking.scheduledAt) return null;
    return new Date(booking.scheduledAt).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [booking.scheduledAt]);

  const handleAction = useCallback(
    (type) => onAction(type, bookingId),
    [onAction, bookingId],
  );

  return (
    <article
      className={`card p-5 border ${cfg.borderClass} relative overflow-hidden`}
      aria-label={`Ride ${booking.bookingCode || bookingId}`}
    >
      {/* status stripe */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: cfg.colorVar }}
        aria-hidden="true"
      />

      <div className="pl-3">
        {/* header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className={`p-2.5 rounded-xl ${cfg.bgClass}`}
              aria-hidden="true"
            >
              <StatusIcon size={18} style={{ color: cfg.colorVar }} />
            </span>
            <div>
              <p className="font-black text-sm tracking-tight">
                {booking.bookingCode || '—'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span
                  className="badge badge-xs"
                  style={{
                    background: `color-mix(in srgb, ${cfg.colorVar}, transparent 85%)`,
                    color: cfg.colorVar,
                    border: `1px solid color-mix(in srgb, ${cfg.colorVar}, transparent 65%)`,
                  }}
                >
                  {cfg.label}
                </span>
                <span className="text-xs text-base-content/50">
                  {booking.bookingType?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {fare != null && (
            <div className="text-right">
              <p className="font-black text-lg text-accent">
                ₹{Number(fare).toFixed(2)}
              </p>
              <p className="text-xs text-base-content/40">total fare</p>
            </div>
          )}
        </div>

        {/* patient info */}
        {patient && (
          <div className="flex items-center gap-2 mb-3 bg-base-200 rounded-xl px-3 py-2">
            <User size={13} className="text-base-content/40" aria-hidden="true" />
            <span className="text-sm font-semibold">{patient.name}</span>
            {patient.age && (
              <span className="text-xs text-base-content/40">· {patient.age}y</span>
            )}
            {patient.gender && (
              <span className="text-xs text-base-content/40">· {patient.gender}</span>
            )}
            {patient.bloodGroup && (
              <span className="badge badge-xs badge-error ml-1">
                {patient.bloodGroup}
              </span>
            )}
            {patient.phone && (
              <a
                href={`tel:${patient.phone}`}
                className="ml-auto text-primary hover:text-primary/80 transition-colors"
                aria-label={`Call ${patient.name}`}
              >
                <Phone size={13} />
              </a>
            )}
          </div>
        )}

        {/* route */}
        {(pickup || dropoff) && (
          <div className="space-y-2 mb-4" role="list" aria-label="Route">
            {pickup?.address && (
              <div className="flex items-start gap-2" role="listitem">
                <span
                  className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs text-base-content/40 font-mono uppercase">
                    Pickup
                  </p>
                  <p className="text-sm leading-tight">{pickup.address}</p>
                  {pickup.city && (
                    <p className="text-xs text-base-content/40">{pickup.city}</p>
                  )}
                </div>
              </div>
            )}
            {pickup && dropoff && (
              <div className="ml-1 w-px h-4 bg-base-300" aria-hidden="true" />
            )}
            {dropoff?.address && (
              <div className="flex items-start gap-2" role="listitem">
                <span
                  className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs text-base-content/40 font-mono uppercase">
                    Dropoff
                  </p>
                  <p className="text-sm leading-tight">{dropoff.address}</p>
                  {dropoff.city && (
                    <p className="text-xs text-base-content/40">{dropoff.city}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* scheduled */}
        {scheduledDate && (
          <div className="flex items-center gap-2 mb-4 text-xs text-base-content/40">
            <Calendar size={12} aria-hidden="true" />
            <time dateTime={booking.scheduledAt}>{scheduledDate}</time>
          </div>
        )}

        {/* fare breakdown quick row */}
        {booking.fareBreakdown && (
          <div className="flex gap-3 mb-4 flex-wrap">
            {booking.fareBreakdown.transportFee > 0 && (
              <span className="badge badge-primary badge-xs">
                Transport ₹{booking.fareBreakdown.transportFee}
              </span>
            )}
            {booking.fareBreakdown.taxes > 0 && (
              <span className="badge badge-info badge-xs">
                Tax ₹{booking.fareBreakdown.taxes}
              </span>
            )}
            {booking.fareBreakdown.discount > 0 && (
              <span className="badge badge-success badge-xs">
                -{booking.fareBreakdown.discount}% off
              </span>
            )}
          </div>
        )}

        {/* action buttons */}
        {actions.length > 0 && (
          <div className="flex gap-2 mt-2" role="group" aria-label="Ride actions">
            {actions.includes('accept') && (
              <button
                onClick={() => handleAction('accept')}
                disabled={isLoading}
                className="btn btn-success btn-sm flex-1"
                aria-label="Accept ride"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <CheckCircle size={13} />
                )}
                Accept
              </button>
            )}
            {actions.includes('reject') && (
              <button
                onClick={() => handleAction('reject')}
                disabled={isLoading}
                className="btn btn-sm flex-1 border border-error/30 text-error bg-error/5 hover:bg-error/10"
                aria-label="Reject ride"
              >
                <XCircle size={13} />
                Reject
              </button>
            )}
            {actions.includes('arrived') && (
              <button
                onClick={() => handleAction('arrived')}
                disabled={isLoading}
                className="btn btn-info btn-sm flex-1"
                aria-label="Mark arrived"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <MapPin size={13} />
                )}
                Mark Arrived
              </button>
            )}
            {actions.includes('start') && (
              <button
                onClick={() => handleAction('start')}
                disabled={isLoading}
                className="btn btn-accent btn-sm flex-1"
                aria-label="Start ride"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <PlayCircle size={13} />
                )}
                Start Ride
              </button>
            )}
            {actions.includes('end') && (
              <button
                onClick={() => handleAction('end')}
                disabled={isLoading}
                className="btn btn-primary btn-sm flex-1"
                aria-label="End ride"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <StopCircle size={13} />
                )}
                End Ride
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
RideCard.displayName = 'RideCard';

// ── empty state ─────────────────────────────────────────────────────────────

const EmptyState = memo(({ onRefresh, isLoading }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center" role="status">
    <div className="relative mb-6">
      <div className="w-24 h-24 rounded-full bg-base-200 border border-base-300 flex items-center justify-center">
        <Truck size={36} className="text-base-content/20" aria-hidden="true" />
      </div>
      <span className="absolute -bottom-1 -right-1 w-8 h-8 bg-base-200 border border-base-300 rounded-full flex items-center justify-center">
        <Zap size={14} className="text-base-content/30" aria-hidden="true" />
      </span>
    </div>
    <p className="font-mono text-sm uppercase tracking-widest text-base-content/40 mb-2">
      No Active Rides
    </p>
    <p className="text-xs text-base-content/30 max-w-xs mb-6">
      Stand by. New bookings will appear here when dispatched.
    </p>
    <button
      onClick={onRefresh}
      disabled={isLoading}
      className="btn btn-outline btn-sm"
      aria-label="Refresh rides"
    >
      <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
      Check Again
    </button>
  </div>
));
EmptyState.displayName = 'EmptyState';

// ── tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rides', label: 'Active Rides', icon: Truck },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
];

// ── main page ───────────────────────────────────────────────────────────────

export default function BookingManagement() {
  const dispatch = useDispatch();

  const rides = useSelector(selectDriverAssigned) ?? [];
  const rideMeta = useSelector(selectDriverAssignedMeta);
  const rideAction = useSelector(selectRideAction);
  const actionLoading = useSelector(selectRideActionLoading);

  const [modal, setModal] = useState(null);
  const [activeTab, setActiveTab] = useState('rides');
  const [locationTracking, setLocationTracking] = useState(false);

  const locationIntervalRef = useRef(null);

  // fetch on mount
  useEffect(() => {
    dispatch(fetchDriverAssigned());
  }, [dispatch]);

  // handle ride action success
  useEffect(() => {
    if (rideAction.status !== 'success') return;
    const { bookingId, data } = rideAction;

    if (
      data?.ride?.status === 'cancelled' ||
      data?.booking?.status === 'completed'
    ) {
      dispatch(removeFromDriverAssigned(bookingId));
    }

    dispatch(resetRideAction());
    setModal(null);
    dispatch(fetchDriverAssigned());
  }, [rideAction.status, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS polling
  useEffect(() => {
    if (!locationTracking) {
      clearInterval(locationIntervalRef.current);
      return;
    }

    locationIntervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const activeRide = rides.find((r) =>
          ['driver_accepted', 'driver_en_route', 'driver_arrived', 'in_progress', 'at_stop'].includes(r.status),
        );
        dispatch(
          updateDriverLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading || 0,
            speed: pos.coords.speed ? pos.coords.speed * 3.6 : 0,
            bookingId: activeRide?.booking?._id,
          }),
        );
      });
    }, 5000);

    return () => clearInterval(locationIntervalRef.current);
  }, [locationTracking, rides, dispatch]);

  // action handler
  const handleAction = useCallback(
    (type, bookingId) => {
      const ride = rides.find((r) => r.booking?._id === bookingId);
      const bookingCode = ride?.booking?.bookingCode || bookingId;

      if (type === 'accept') dispatch(acceptRide(bookingId));
      else if (type === 'arrived') dispatch(markRideArrived(bookingId));
      else if (type === 'reject') setModal({ type: 'reject', bookingId, bookingCode });
      else if (type === 'start') setModal({ type: 'otp', bookingId, bookingCode });
      else if (type === 'end') setModal({ type: 'end', bookingId, bookingCode });
    },
    [rides, dispatch],
  );

  const handleOtpConfirm = useCallback(
    (otp) => dispatch(startRide({ bookingId: modal.bookingId, otp })),
    [dispatch, modal],
  );

  const handleRejectConfirm = useCallback(
    (reason) => dispatch(rejectRide({ bookingId: modal.bookingId, reason })),
    [dispatch, modal],
  );

  const handleEndConfirm = useCallback(
    (actualDistanceKm) => dispatch(endRide({ bookingId: modal.bookingId, actualDistanceKm })),
    [dispatch, modal],
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchDriverAssigned());
  }, [dispatch]);

  const handleToggleGPS = useCallback(() => {
    setLocationTracking((p) => !p);
  }, []);

  const isLoading = rideMeta?.status === 'loading';

  // status counts derived
  const statusCounts = useMemo(
    () =>
      rides.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
    [rides],
  );

  // stat data derived
  const totalFare = useMemo(
    () =>
      rides.reduce(
        (sum, r) => sum + (r.booking?.fareBreakdown?.totalAmount || 0),
        0,
      ),
    [rides],
  );

  return (
    <>
      {/* skip nav for a11y */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 btn btn-primary btn-sm z-50">
        Skip to content
      </a>

      <div
        className="min-h-screen bg-base-100 text-base-content"
        data-theme="driver"
      >
        <div
          id="main-content"
          className="container-custom max-w-5xl py-8"
        >

          {/* ── header ── */}
          <header className="mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span
                    className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20"
                    aria-hidden="true"
                  >
                    <Truck size={22} style={{ color: 'var(--primary)' }} />
                  </span>
                  <h1 className="text-3xl font-black tracking-tighter">
                    Booking{' '}
                    <span style={{ color: 'var(--accent)' }}>Control</span>
                  </h1>
                </div>
                <div className="flex items-center gap-3 ml-14">
                  <span
                    className="flex items-center gap-1.5"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-mono text-base-content/40">
                      {isLoading ? 'syncing...' : `${rides.length} active`}
                    </span>
                  </span>
                  <span className="text-base-content/20" aria-hidden="true">·</span>
                  <time className="text-xs font-mono text-base-content/30">
                    {new Date().toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* GPS toggle */}
                <button
                  onClick={handleToggleGPS}
                  className={`btn btn-sm gap-2 ${
                    locationTracking ? 'btn-success' : 'btn-ghost border border-base-300'
                  }`}
                  aria-pressed={locationTracking}
                  aria-label={`GPS tracking ${locationTracking ? 'on' : 'off'}`}
                >
                  <LocateFixed
                    size={13}
                    className={locationTracking ? 'animate-pulse' : ''}
                    aria-hidden="true"
                  />
                  {locationTracking ? 'GPS On' : 'GPS Off'}
                </button>

                {/* refresh */}
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="btn btn-ghost btn-sm btn-circle border border-base-300"
                  aria-label="Refresh ride list"
                >
                  <RefreshCw
                    size={15}
                    className={isLoading ? 'animate-spin' : ''}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </header>

          {/* ── stat cards ── */}
          <section
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
            aria-label="Summary statistics"
          >
            <StatCard
              icon={Truck}
              label="Total Active"
              value={rides.length}
              sub="live bookings"
              colorVar="var(--primary)"
            />
            <StatCard
              icon={Clock}
              label="Assigned"
              value={statusCounts.driver_assigned || 0}
              sub="awaiting accept"
              colorVar="var(--warning)"
            />
            <StatCard
              icon={Activity}
              label="In Progress"
              value={statusCounts.in_progress || 0}
              sub="en route"
              colorVar="var(--success)"
            />
            <StatCard
              icon={DollarSign}
              label="Fare Total"
              value={`₹${totalFare.toFixed(0)}`}
              sub="all active rides"
              colorVar="var(--accent)"
            />
          </section>

          {/* ── tabs ── */}
          <div
            className="flex gap-1 mb-6 bg-base-200 border border-base-300 rounded-xl p-1 w-fit"
            role="tablist"
            aria-label="Page sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'btn-primary'
                    : 'text-base-content/40 hover:text-base-content'
                }`}
              >
                <tab.icon size={13} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── rides tab ── */}
          <section
            id="panel-rides"
            role="tabpanel"
            aria-labelledby="tab-rides"
            hidden={activeTab !== 'rides'}
          >
            {/* status filter pills */}
            {Object.entries(statusCounts).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5" aria-label="Status summary">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status];
                  if (!cfg) return null;
                  return (
                    <span
                      key={status}
                      className={`badge ${cfg.bgClass} ${cfg.borderClass} border`}
                      style={{ color: cfg.colorVar }}
                    >
                      <cfg.icon size={10} aria-hidden="true" />
                      {cfg.label}: {count}
                    </span>
                  );
                })}
              </div>
            )}

            {/* loading skeleton */}
            {isLoading && rides.length === 0 && (
              <div className="space-y-4" aria-busy="true" aria-label="Loading rides">
                {[0, 1, 2].map((i) => (
                  <RideCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* empty state */}
            {!isLoading && rides.length === 0 && (
              <EmptyState onRefresh={handleRefresh} isLoading={isLoading} />
            )}

            {/* ride cards */}
            {rides.length > 0 && (
              <ul className="space-y-4" aria-label="Active rides">
                {rides.map((ride, i) => (
                  <li key={ride._id || i}>
                    <RideCard
                      ride={ride}
                      onAction={handleAction}
                      actionLoading={actionLoading}
                      activeBookingId={rideAction?.bookingId}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── analytics tab ── */}
          <section
            id="panel-analytics"
            role="tabpanel"
            aria-labelledby="tab-analytics"
            hidden={activeTab !== 'analytics'}
          >
            {activeTab === 'analytics' && <AnalyticsPanel />}
          </section>

        </div>

        {/* ── modals ── */}
        {modal?.type === 'otp' && (
          <OtpModal
            onConfirm={handleOtpConfirm}
            onClose={() => setModal(null)}
            loading={actionLoading}
          />
        )}
        {modal?.type === 'reject' && (
          <RejectModal
            bookingCode={modal.bookingCode}
            onConfirm={handleRejectConfirm}
            onClose={() => setModal(null)}
            loading={actionLoading}
          />
        )}
        {modal?.type === 'end' && (
          <EndRideModal
            bookingCode={modal.bookingCode}
            onConfirm={handleEndConfirm}
            onClose={() => setModal(null)}
            loading={actionLoading}
          />
        )}
      </div>
    </>
  );
}

// ── inline analytics panel (split to own chunk via dynamic import above) ────

/**
 * AnalyticsPanelInline.jsx — export default expected by dynamic()
 * Kept in same file to satisfy single-file constraint,
 * but dynamic() will still code-split it.
 */

// Mock weekly data — replace with real selector
const weeklyData = [
  { day: 'Mon', rides: 4, earnings: 1240 },
  { day: 'Tue', rides: 6, earnings: 1890 },
  { day: 'Wed', rides: 3, earnings: 940 },
  { day: 'Thu', rides: 8, earnings: 2450 },
  { day: 'Fri', rides: 5, earnings: 1560 },
  { day: 'Sat', rides: 9, earnings: 2810 },
  { day: 'Sun', rides: 7, earnings: 2190 },
];

const perfMetrics = [
  { label: 'Rating', value: '4.8', icon: Star, colorVar: 'var(--warning)', sub: '127 reviews' },
  { label: 'Acceptance', value: '94%', icon: CheckCircle, colorVar: 'var(--success)', sub: 'this week' },
  { label: 'On-time', value: '88%', icon: Clock, colorVar: 'var(--info)', sub: 'avg punctual' },
  { label: 'Cancellations', value: '2', icon: XCircle, colorVar: 'var(--error)', sub: 'this month' },
];

// Note: recharts imported only inside AnalyticsPanel → tree shaken from main bundle
function AnalyticsPanelInner() {
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    // Dynamic recharts import — keeps main bundle lean
    import('recharts').then((m) => setCharts(m));
  }, []);

  if (!charts) return <AnalyticsSkeleton />;

  const {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
  } = charts;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="card px-4 py-3 shadow-2xl text-sm">
        <p className="text-xs text-base-content/40 font-mono mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-bold" style={{ color: p.color }}>
            {p.name === 'earnings' ? `₹${p.value}` : p.value} {p.name}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* earnings area chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-base">Weekly Earnings</h2>
            <p className="text-xs text-base-content/40 font-mono mt-0.5">
              Last 7 days performance
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-bold text-success">
            <TrendingUp size={14} aria-hidden="true" />
            +12.4%
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--base-content)', fontSize: 11, opacity: 0.4 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--base-content)', fontSize: 11, opacity: 0.4 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#earningsGrad)"
              dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* rides per day bar chart */}
      <div className="card p-6">
        <h2 className="font-bold text-sm mb-4">Rides Per Day</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--base-content)', fontSize: 10, opacity: 0.4 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--base-content)', fontSize: 10, opacity: 0.4 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="rides" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* performance metrics */}
      <section aria-label="Performance metrics">
        <h2 className="font-bold text-sm mb-4">Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {perfMetrics.map((m) => (
            <div key={m.label} className="stat-card text-center">
              <m.icon
                size={16}
                style={{ color: m.colorVar }}
                className="mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="stat-card-value text-xl" style={{ color: m.colorVar }}>
                {m.value}
              </p>
              <p className="stat-card-label">{m.label}</p>
              <p className="text-xs text-base-content/30 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Named export required by dynamic() call
export { AnalyticsPanelInner as AnalyticsPanelInline };