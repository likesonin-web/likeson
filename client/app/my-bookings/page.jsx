'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, MapPin, Activity, ChevronRight, Filter,
  Search, X, Car, User, Stethoscope, FlaskConical, HeartPulse,
  Video, Dumbbell, RefreshCw, AlertCircle, CheckCircle2, Loader2,
  Package, Star, ArrowUpRight, SlidersHorizontal, ChevronLeft,
  ChevronRight as ChevronRightIcon, Home, Ambulance, RotateCcw,
} from 'lucide-react';

import {
  fetchMyBookings,
  selectMyBookings,
  selectMyBookingsMeta,
  selectMyBookingsLoading,
  patchBookingStatus,
} from '@/store/slices/bookingSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_TYPE_META = {
  full_care_ride:      { label: 'Full Care Ride',       icon: Ambulance,    color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20'  },
  doctor_consultation: { label: 'Doctor Consultation',  icon: Stethoscope,  color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/30'     },
  doctor_online:       { label: 'Online Consultation',  icon: Video,        color: 'text-accent',    bg: 'bg-accent/5',     border: 'border-accent/30'   },
  physiotherapist:     { label: 'Physiotherapy',        icon: Dumbbell,     color: 'text-success',   bg: 'bg-success/10',   border: 'border-success/40'  },
  care_assistant:      { label: 'Care Assistant',       icon: HeartPulse,   color: 'text-secondary', bg: 'bg-secondary/20', border: 'border-primary/20'  },
  diagnostic_center:   { label: 'Diagnostic Center',    icon: FlaskConical, color: 'text-warning',   bg: 'bg-warning/10',   border: 'border-warning/30'  },
  diagnostic_home:     { label: 'Home Diagnostics',     icon: Home,         color: 'text-warning',   bg: 'bg-warning/5',    border: 'border-warning/40'  },
  patient_transport:   { label: 'Patient Transport',    icon: Car,          color: 'text-accent',    bg: 'bg-accent/5',     border: 'border-accent/30'   },
  follow_up:           { label: 'Follow-Up',            icon: RotateCcw,    color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/30'     },
};

const STATUS_META = {
  draft:              { label: 'Draft',            color: 'text-base-content/50', bg: 'bg-base-300/60',   dot: 'bg-base-content/40' },
  pending:            { label: 'Pending',          color: 'text-warning',          bg: 'bg-warning/10',    dot: 'bg-warning'          },
  confirmed:          { label: 'Confirmed',        color: 'text-success',          bg: 'bg-success/10',    dot: 'bg-success'          },
  in_progress:        { label: 'In Progress',      color: 'text-info',             bg: 'bg-info/10',       dot: 'bg-info'             },
  completed:          { label: 'Completed',        color: 'text-success',          bg: 'bg-success/10',    dot: 'bg-success'          },
  cancelled:          { label: 'Cancelled',        color: 'text-error',            bg: 'bg-error/5',       dot: 'bg-error'            },
  no_show:            { label: 'No Show',          color: 'text-error',            bg: 'bg-error/5',       dot: 'bg-error'            },
  refund_pending:     { label: 'Refund Pending',   color: 'text-warning',          bg: 'bg-warning/10',    dot: 'bg-warning'          },
  refunded:           { label: 'Refunded',         color: 'text-base-content/60',  bg: 'bg-base-300/60',   dot: 'bg-base-content/40'  },
};

const ALL_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const ALL_TYPES    = Object.keys(BOOKING_TYPE_META);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const formatTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${m.color} ${m.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} shrink-0`} />
      {m.label}
    </span>
  );
}

function BookingTypeChip({ type }) {
  const m = BOOKING_TYPE_META[type] || BOOKING_TYPE_META.patient_transport;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${m.color} ${m.bg} ${m.border}`}>
      <Icon size={11} />
      {m.label}
    </span>
  );
}

function BookingCard({ booking, index }) {
  const router = useRouter();
  const meta   = BOOKING_TYPE_META[booking.bookingType] || BOOKING_TYPE_META.patient_transport;
  const Icon   = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => router.push(`/my-bookings/${booking._id}`)}
      className="card group cursor-pointer hover:shadow-primary transition-all duration-300"
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} border ${meta.border}`}>
              <Icon size={18} className={meta.color} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-base-content truncate">{meta.label}</p>
              <p className="text-xs text-base-content/50 font-mono mt-0.5">{booking.bookingCode}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {/* Patient */}
        <div className="flex items-center gap-2 mb-3">
          <User size={13} className="text-base-content/40 shrink-0" />
          <span className="text-sm text-base-content/70 truncate">
            {booking.patientInfo?.name || '—'}
          </span>
          {booking.patientInfo?.age && (
            <span className="text-xs text-base-content/40">• {booking.patientInfo.age}y</span>
          )}
        </div>

        {/* Scheduled */}
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={13} className="text-base-content/40 shrink-0" />
          <span className="text-sm text-base-content/70">
            {formatDate(booking.scheduledAt)}
          </span>
          <span className="text-xs text-base-content/40">
            {formatTime(booking.scheduledAt)}
          </span>
        </div>

        {/* Doctor / Hospital if present */}
        {(booking.doctor || booking.hospital) && (
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={13} className="text-base-content/40 shrink-0" />
            <span className="text-sm text-base-content/60 truncate">
              {booking.hospital?.name || booking.doctor?.user?.name || '—'}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="divider my-3" />

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base-content/40 text-xs mb-0.5">Total Amount</p>
            <p className="font-black text-base text-base-content">
              {formatCurrency(booking.fareBreakdown?.totalAmount)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {booking.isRated && (
              <span className="inline-flex items-center gap-1 text-xs text-warning font-semibold">
                <Star size={11} fill="currentColor" />
                Rated
              </span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg} group-hover:bg-primary group-hover:text-primary-content transition-colors duration-200`}>
              <ChevronRight size={15} className={`${meta.color} group-hover:text-primary-content`} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center mb-5">
        <Package size={32} className="text-base-content/30" />
      </div>
      <h3 className="text-xl font-bold text-base-content mb-2">
        {hasFilters ? 'No bookings match your filters' : 'No bookings yet'}
      </h3>
      <p className="text-base-content/50 text-sm mb-6 max-w-xs">
        {hasFilters
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'Your booking history will appear here once you make your first booking.'}
      </p>
      {hasFilters && (
        <button onClick={onClear} className="btn btn-outline btn-sm gap-2">
          <X size={14} />
          Clear filters
        </button>
      )}
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-3 w-48 rounded" />
      <div className="skeleton h-3 w-40 rounded" />
      <div className="divider my-0" />
      <div className="flex justify-between items-center">
        <div className="skeleton h-5 w-24 rounded" />
        <div className="skeleton w-8 h-8 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const dispatch  = useDispatch();
  const router    = useRouter();

  const bookings  = useSelector(selectMyBookings);
  const meta      = useSelector(selectMyBookingsMeta);
  const loading   = useSelector(selectMyBookingsLoading);

  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);

  const LIMIT = 9;

  const load = useCallback(() => {
    dispatch(fetchMyBookings({
      page,
      limit: LIMIT,
      ...(statusFilter ? { status: statusFilter }      : {}),
      ...(typeFilter   ? { bookingType: typeFilter }   : {}),
    }));
  }, [dispatch, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side search filter
  const filtered = search.trim()
    ? bookings.filter((b) =>
        b.bookingCode?.toLowerCase().includes(search.toLowerCase()) ||
        b.patientInfo?.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.hospital?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : bookings;

  const hasFilters = !!(search || statusFilter || typeFilter);
  const totalPages = Math.ceil((meta.total || 0) / LIMIT);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPage(1);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--base-100)' }}>
      {/* ── Page Header ── */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-20">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="section-heading text-2xl md:text-3xl mb-0">My Bookings</h1>
              <p className="text-base-content/50 text-xs mt-0.5">
                {meta.total != null ? `${meta.total} booking${meta.total !== 1 ? 's' : ''} total` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="btn btn-ghost btn-sm btn-circle"
                title="Refresh"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowFilters((p) => !p)}
                className={`btn btn-sm gap-2 ${showFilters ? 'btn-primary' : 'btn-outline'}`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {hasFilters && (
                  <span className="w-4 h-4 rounded-full bg-error text-error-content text-[10px] font-bold flex items-center justify-center">
                    !
                  </span>
                )}
              </button>
            <Link href="/book-appointment" className="btn btn-primary btn-sm gap-2">
                <ArrowUpRight size={14} />
                New Booking
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        {/* ── Search + Filters Panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="card p-4 space-y-4">
                {/* Search bar */}
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by code, patient, or hospital…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field w-full pl-9 pr-9"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-error"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* Status filter */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="label-text block mb-1.5">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                      className="input-field w-full"
                    >
                      <option value="">All Statuses</option>
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Type filter */}
                  <div className="flex-1 min-w-[180px]">
                    <label className="label-text block mb-1.5">Booking Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                      className="input-field w-full"
                    >
                      <option value="">All Types</option>
                      {ALL_TYPES.map((t) => (
                        <option key={t} value={t}>{BOOKING_TYPE_META[t]?.label || t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Clear */}
                  {hasFilters && (
                    <div className="flex items-end">
                      <button onClick={clearFilters} className="btn btn-ghost btn-sm gap-1.5 text-error">
                        <X size={13} />
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active filter chips ── */}
        {hasFilters && !showFilters && (
          <div className="flex flex-wrap gap-2 mb-5">
            {search && (
              <span className="badge badge-primary gap-1.5">
                <Search size={10} />
                "{search}"
                <button onClick={() => setSearch('')}><X size={10} /></button>
              </span>
            )}
            {statusFilter && (
              <span className="badge badge-info gap-1.5">
                {STATUS_META[statusFilter]?.label}
                <button onClick={() => setStatusFilter('')}><X size={10} /></button>
              </span>
            )}
            {typeFilter && (
              <span className="badge badge-warning gap-1.5">
                {BOOKING_TYPE_META[typeFilter]?.label}
                <button onClick={() => setTypeFilter('')}><X size={10} /></button>
              </span>
            )}
          </div>
        )}

        {/* ── Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <motion.div key={`sk-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Skeleton />
                </motion.div>
              ))
            ) : filtered.length === 0 ? (
              <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
            ) : (
              filtered.map((b, i) => (
                <BookingCard key={b._id} booking={b} index={i} />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 mt-8"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const pg = i + 1;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`btn btn-sm btn-circle ${pg === page ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {pg}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <ChevronRightIcon size={16} />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}