'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { useRouter }                         from 'next/navigation';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Calendar, Clock, User, Phone, MapPin, CheckCircle2, XCircle,
  ChevronRight, RefreshCw, AlertTriangle, Activity, Heart,
  FileText, ChevronDown, Stethoscope, Shield, ClipboardList, 
  Search, Filter, Eye, Navigation, ArrowRight,
} from 'lucide-react';

import {
  fetchCABookings,
  fetchCABookingById,
  selectCABookings,
  selectCABookingsTotal,
  selectSelectedCABooking,
  selectClinicalLoading,
  selectClinicalError,
  clearSelectedCABooking,
} from '@/store/slices/clinicalSlice';
import BackButton from '../../../components/BackButton';

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.22 } },
};

const slideIn = {
  hidden:  { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 32, transition: { duration: 0.22 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

// ─── Constants & Helpers ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:        { label: 'Pending',        color: 'badge-warning',   dot: 'status-dot-warning',  icon: Clock },
  confirmed:      { label: 'Confirmed',      color: 'badge-info',      dot: 'status-dot-info',     icon: CheckCircle2 },
  in_progress:    { label: 'In Progress',    color: 'badge-success',   dot: 'status-dot-success',  icon: Activity },
  completed:      { label: 'Completed',      color: 'badge-secondary', dot: 'status-dot-info',     icon: CheckCircle2 },
  cancelled:      { label: 'Cancelled',      color: 'badge-error',     dot: 'status-dot-error',    icon: XCircle },
  no_show:        { label: 'No Show',        color: 'badge-error',     dot: 'status-dot-error',    icon: XCircle },
  payment_pending:{ label: 'Payment Pending',color: 'badge-warning',   dot: 'status-dot-warning',  icon: Clock },
};

const BOOKING_TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Doctor Consultation',
  doctor_online:       'Online Consultation',
  physiotherapist:     'Physiotherapy',
  care_assistant:      'Care Assistant',
  diagnostic_center:   'Diagnostic Center',
  diagnostic_home:     'Home Diagnostic',
  patient_transport:   'Patient Transport',
};

const RIDE_BOOKING_TYPES = new Set(['full_care_ride', 'patient_transport', 'diagnostic_home', 'care_assistant']);
const TRACKABLE_STATUSES = new Set(['pending', 'confirmed', 'in_progress']);
const PAGE_LIMIT = 10;

function getRideId(booking) {
  if (!booking) return null;
  const raw = booking.primaryRide || booking.rides?.[0];
  if (!raw) return null;
  return typeof raw === 'string' ? raw : (raw._id?.toString() ?? raw.toString());
}

function canTrack(booking) {
  if (!booking) return false;
  return RIDE_BOOKING_TYPES.has(booking.bookingType) && !!getRideId(booking) && TRACKABLE_STATUSES.has(booking.status);
}

function FieldNote({ children }) {
  return <span className="block text-[0.68rem] font-medium text-base-content/40 mt-0.5 leading-tight tracking-wide">{children}</span>;
}

function StatusBadge({ status }) {
  const cfg  = STATUS_CONFIG[status] || { label: status, color: 'badge-secondary', dot: '' };
  return (
    <span className={`badge badge-sm ${cfg.color} gap-1.5`}>
      <span className={`status-dot ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function BookingTypePill({ type }) {
  return <span className="badge badge-xs badge-accent">{BOOKING_TYPE_LABELS[type] || type}</span>;
}

function InfoRow({ icon: Icon, label, value, note }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-base-300/60 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-base-content mt-0.5 truncate">{value || '—'}</p>
        {note && <FieldNote>{note}</FieldNote>}
      </div>
    </div>
  );
}

function Spinner({ size = 'md' }) {
  return <span className={`loading loading-spinner loading-${size}`} />;
}

// ─── Components ───────────────────────────────────────────────────────────────

function TrackRideButton({ booking, variant = 'default' }) {
  const router = useRouter();
  if (!canTrack(booking)) return null;
  const rideId = getRideId(booking);

  function handleTrack(e) {
    e.stopPropagation();
    router.push(`/care-assistant/tracking/${booking._id}/${rideId}?type=${booking.bookingType}`);
  }

  if (variant === 'panel') {
    return (
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleTrack}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl transition-all duration-200 bg-[image:var(--bg-gradient-primary)] shadow-primary hover:shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Track Live Ride</p>
            <p className="text-xs text-white/70 mt-0.5">Real-time driver & route tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
          <ChevronRight className="w-4 h-4 text-white/70" />
        </div>
      </motion.button>
    );
  }

  return (
    <button onClick={handleTrack} className="btn btn-primary btn-xs gap-1.5 flex-shrink-0">
      <Navigation className="w-3.5 h-3.5" /> Track
    </button>
  );
}

function BookingRow({ booking, onView }) {
  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown';
  const phone       = booking.customer?.phone   || '—';
  const scheduled   = booking.scheduledAt ? new Date(booking.scheduledAt) : null;

  return (
    <motion.tr variants={fadeUp} className="cursor-pointer hover:bg-primary/5 transition-colors duration-150" onClick={() => onView(booking._id)}>
      <td>
        <div className="flex items-center gap-3 py-1.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-base-content">{patientName}</p>
            <p className="text-xs text-base-content/40 mt-0.5">{phone}</p>
          </div>
        </div>
      </td>
      <td>
        <p className="text-xs font-bold text-primary tracking-wide">{booking.bookingCode || '—'}</p>
      </td>
      <td><BookingTypePill type={booking.bookingType} /></td>
      <td>
        {scheduled ? (
          <div>
            <p className="text-xs font-semibold text-base-content">{scheduled.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
            <p className="text-xs text-base-content/40 mt-0.5">{scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ) : '—'}
      </td>
      <td><StatusBadge status={booking.status} /></td>
      <td>
        <div className="flex items-center gap-2">
          <TrackRideButton booking={booking} />
          <button className="btn btn-ghost btn-xs gap-1 hover:bg-base-200" onClick={e => { e.stopPropagation(); onView(booking._id); }}>
            <Eye className="w-3.5 h-3.5" /> View
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

function BookingDetailPanel({ booking, onClose }) {
  if (!booking) return null;
  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown Patient';
  const scheduled   = booking.scheduledAt ? new Date(booking.scheduledAt) : null;

  return (
    <motion.div variants={slideIn} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 z-50 mt-16 flex justify-end bg-base-300/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      
      <motion.div className="w-full max-w-md h-full bg-base-100 shadow-depth-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 bg-[image:var(--bg-gradient-primary)]">
          <div>
            <p className="text-lg font-black text-primary-content">{patientName}</p>
            <p className="text-xs text-primary-content/80 mt-0.5">Booking Detail View</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <XCircle className="w-5 h-5 text-primary-content" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-base-200 border border-base-300 flex-wrap">
            <StatusBadge status={booking.status} />
            <BookingTypePill type={booking.bookingType} />
          </div>

          <TrackRideButton booking={booking} variant="panel" />

          <div className="card p-5">
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Patient Info
            </p>
            <InfoRow icon={User} label="Full Name" value={patientName} />
            <InfoRow icon={Phone} label="Phone" value={booking.customer?.phone || '—'} />
            <InfoRow icon={Shield} label="Blood Group" value={booking.patientInfo?.bloodGroup || '—'} />
          </div>

          <div className="card p-5">
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Booking Details
            </p>
            <InfoRow icon={FileText} label="Booking Code" value={booking.bookingCode} />
            {scheduled && (
              <InfoRow icon={Calendar} label="Scheduled At"
                value={`${scheduled.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} · ${scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`} />
            )}
          </div>

          {(booking.patientLocation || booking.destinationLocation) && (
            <div className="card p-5">
              <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Location
              </p>
              {booking.patientLocation?.address && <InfoRow icon={MapPin} label="Pickup Location" value={booking.patientLocation.address} />}
              {booking.destinationLocation?.address && <InfoRow icon={ArrowRight} label="Destination" value={booking.destinationLocation.address} />}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FilterBar({ status, onStatus, search, onSearch, onRefresh, isLoading }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-1">
      <div className="relative flex-1  ">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search patient name or code…" className="input-field py-4 pl-10 text-sm shadow-sm" />
      </div>
      <div className="relative">
        <Filter className="absolute left-3.5   top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
        <select value={status} onChange={e => onStatus(e.target.value)} className="input-field py-4 pl-10 pr-8 text-sm appearance-none min-w-[180px] shadow-sm">
          <option value="">All Statuses</option>
          {['pending','confirmed','in_progress','completed','cancelled','no_show'].map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
          ))}
        </select>
      </div>
      <button onClick={onRefresh} disabled={isLoading} className="btn btn-outline   h-12 px-5 gap-2 shadow-sm bg-base-100">
        {isLoading ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />} Refresh
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingManagement() {
  const dispatch = useDispatch();

  const bookings        = useSelector(selectCABookings);
  const bookingsTotal   = useSelector(selectCABookingsTotal);
  const selectedBooking = useSelector(selectSelectedCABooking);

  const loadingBookings = useSelector(selectClinicalLoading('fetchCABookings'));
  const loadingDetail   = useSelector(selectClinicalLoading('fetchCABookingById'));
  const errorBookings   = useSelector(selectClinicalError('fetchCABookings'));

  const [page, setPage]             = useState(1);
  const [status, setStatus]         = useState('');
  const [search, setSearch]         = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  const loadAll = useCallback(() => {
    const params = { page, limit: PAGE_LIMIT };
    if (status) params.status = status;
    dispatch(fetchCABookings(params));
  }, [dispatch, page, status]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleViewDetail(bookingId) {
    await dispatch(fetchCABookingById(bookingId));
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    dispatch(clearSelectedCABooking());
  }

  const filteredBookings = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (b.patientInfo?.name || b.customer?.name || '').toLowerCase();
    const code = (b.bookingCode || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const totalPages = Math.ceil(bookingsTotal / PAGE_LIMIT);

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100 relative overflow-hidden">
      {/* Master Level Background Effects */}
      <div className="fixed top-0 left-1/2 w-[60vw] h-[50vh] -translate-x-1/2 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 mix-blend-multiply dark:mix-blend-screen" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <BackButton className='my-3' />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[image:var(--bg-gradient-primary)] shadow-primary">
                <ClipboardList className="w-6 h-6 text-primary-content" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-base-content tracking-tight">Booking Directory</h1>
                <p className="text-sm text-base-content/50 mt-1">Complete history and management of all assignments</p>
              </div>
            </div>
          </div>
          <div className="stat-card px-5 py-4 flex items-center gap-4 min-w-[160px] shadow-sm">
            <ClipboardList className="w-6 h-6 text-primary" />
            <div>
              <p className="stat-card-value text-2xl">{bookingsTotal}</p>
              <p className="stat-card-label mt-1 text-[0.7rem]">Total Bookings</p>
            </div>
          </div>
        </motion.div>

        {/* Filters & Table */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-5">
          <FilterBar status={status} onStatus={v => { setStatus(v); setPage(1); }} search={search} onSearch={setSearch} onRefresh={loadAll} isLoading={loadingBookings} />

          {errorBookings && (
            <div className="alert alert-error shadow-sm gap-3">
              <AlertTriangle className="w-5 h-5 text-error" />
              <p className="text-sm font-medium">{errorBookings}</p>
            </div>
          )}

          <div className="card overflow-hidden border-base-300 shadow-sm">
            {loadingBookings ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : filteredBookings.length === 0 ? (
              <div className="py-24 text-center">
                <Search className="w-10 h-10 text-base-content/20 mx-auto mb-4" />
                <p className="text-lg font-bold text-base-content/60">No bookings found</p>
                <p className="text-sm text-base-content/40 mt-1">Try adjusting your filters or search term.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead className="bg-base-200/50">
                    <tr>
                      <th className="py-4">Patient</th>
                      <th className="py-4">Booking Code</th>
                      <th className="py-4">Type</th>
                      <th className="py-4">Scheduled</th>
                      <th className="py-4">Status</th>
                      <th className="py-4">Actions</th>
                    </tr>
                  </thead>
                  <motion.tbody variants={stagger} initial="hidden" animate="visible">
                    {filteredBookings.map(b => <BookingRow key={b._id} booking={b} onView={handleViewDetail} />)}
                  </motion.tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-100">
                <p className="text-xs font-medium text-base-content/50">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loadingBookings} className="btn btn-outline  px-4">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loadingBookings} className="btn btn-outline  px-4">Next</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Detail panel overlay */}
        <AnimatePresence>
          {detailOpen && (
            loadingDetail ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-base-300/60 backdrop-blur-sm">
                <div className="bg-base-100 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-depth-lg"><Spinner size="lg" /></div>
              </motion.div>
            ) : selectedBooking && (
              <BookingDetailPanel booking={selectedBooking} onClose={handleCloseDetail} />
            )
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}