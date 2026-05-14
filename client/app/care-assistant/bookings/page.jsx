'use client';

/**
 * BookingManagement.jsx
 * Care Assistant — Booking & Care Record Hub
 * Uses: clinicalSlice thunks, Next.js, Tailwind CSS, Lucide, Framer Motion
 * Theme: care-assistant (Rose) from globals.css
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, User, Phone, MapPin, CheckCircle2, XCircle,
  ChevronRight, RefreshCw, AlertTriangle, Activity, Heart,
  FileText, ChevronDown, ChevronUp, Stethoscope, Shield,
  ClipboardList, Bell, Search, Filter, Eye, UserCheck, UserX,
  ArrowRight, Loader2, Info, Badge, Inbox
} from 'lucide-react';

import {
  fetchCABookings,
  fetchCAPendingBookings,
  fetchCABookingById,
  acceptCABooking,
  rejectCABooking,
  selectCABookings,
  selectCABookingsTotal,
  selectCAPendingBookings,
  selectSelectedCABooking,
  selectCAPendingCount,
  selectClinicalLoading,
  selectClinicalError,
  clearSelectedCABooking,
} from '@/store/slices/clinicalSlice';

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.22 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const slideIn = {
  hidden:  { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 32, transition: { duration: 0.22 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1,   transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.94, transition: { duration: 0.18 } },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'badge-warning',  dot: 'status-dot-warning',  icon: Clock },
  confirmed:   { label: 'Confirmed',   color: 'badge-info',     dot: 'status-dot-info',     icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'badge-success',  dot: 'status-dot-success',  icon: Activity },
  completed:   { label: 'Completed',   color: 'badge-secondary',dot: 'status-dot-info',     icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'badge-error',    dot: 'status-dot-error',    icon: XCircle },
  no_show:     { label: 'No Show',     color: 'badge-error',    dot: 'status-dot-error',    icon: UserX },
};

const BOOKING_TYPE_LABELS = {
  full_care_ride:    'Full Care Ride',
  doctor_consultation: 'Doctor Consultation',
  doctor_online:     'Online Consultation',
  physiotherapist:   'Physiotherapy',
  care_assistant:    'Care Assistant',
  diagnostic_center: 'Diagnostic Center',
  diagnostic_home:   'Home Diagnostic',
  patient_transport: 'Patient Transport',
  follow_up:         'Follow-Up',
};

const PAGE_LIMIT = 10;

// ─── Helper Components ────────────────────────────────────────────────────────

function FieldNote({ children }) {
  return (
    <span className="block text-[0.68rem] font-medium text-base-content/40 mt-0.5 leading-tight tracking-wide">
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'badge-secondary', dot: '' };
  const Icon = cfg.icon || CheckCircle2;
  return (
    <span className={`badge badge-sm ${cfg.color} gap-1.5`}>
      <span className={`status-dot ${cfg.dot}`} style={{ width: '0.4rem', height: '0.4rem' }} />
      {cfg.label}
    </span>
  );
}

function BookingTypePill({ type }) {
  return (
    <span className="badge badge-xs badge-accent">
      {BOOKING_TYPE_LABELS[type] || type}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, note }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-base-300/60 last:border-0">
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
  return <span className={`loading loading-${size}`} style={{ width: size === 'sm' ? '1.25rem' : '1.75rem', height: size === 'sm' ? '1.25rem' : '1.75rem', borderWidth: '3px' }} />;
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible"
      className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary/50" />
      </div>
      <p className="text-base font-bold text-base-content/60">{title}</p>
      <p className="text-sm text-base-content/40 mt-1 max-w-xs">{subtitle}</p>
    </motion.div>
  );
}

// ─── Pending Booking Card ─────────────────────────────────────────────────────

function PendingBookingCard({ booking, onAccept, onReject, onView, isAccepting, isRejecting }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason]         = useState('');

  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown Patient';
  const phone       = booking.customer?.phone || booking.patientInfo?.phone || '—';
  const scheduled   = booking.scheduledAt ? new Date(booking.scheduledAt) : null;

  function handleReject() {
    onReject(booking._id, reason);
    setRejectOpen(false);
    setReason('');
  }

  return (
    <motion.div variants={fadeUp}
      className="card overflow-hidden border-l-4 border-l-warning"
      style={{ borderLeftColor: 'var(--warning)' }}>

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-warning" style={{ color: 'var(--warning)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate">{patientName}</p>
            <FieldNote>Patient name from booking record</FieldNote>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <StatusBadge status={booking.status} />
              <BookingTypePill type={booking.bookingType} />
            </div>
          </div>
        </div>
        <button onClick={() => onView(booking._id)}
          className="btn btn-ghost btn-xs flex-shrink-0 gap-1">
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Details</span>
        </button>
      </div>

      {/* Body */}
      <div className="px-5 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Booking Code</p>
          <p className="font-bold text-primary text-xs mt-0.5">{booking.bookingCode || '—'}</p>
          <FieldNote>Unique booking identifier</FieldNote>
        </div>
        <div>
          <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Phone</p>
          <p className="font-semibold text-base-content text-xs mt-0.5 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {phone}
          </p>
          <FieldNote>Primary contact number</FieldNote>
        </div>
        {scheduled && (
          <div className="col-span-2">
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Scheduled</p>
            <p className="font-semibold text-base-content text-xs mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {scheduled.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              &nbsp;·&nbsp;
              <Clock className="w-3 h-3" />
              {scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <FieldNote>Appointment date and time</FieldNote>
          </div>
        )}
        {booking.patientLocation?.address && (
          <div className="col-span-2">
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Location</p>
            <p className="font-semibold text-base-content text-xs mt-0.5 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{booking.patientLocation.address}</span>
            </p>
            <FieldNote>Patient pickup / care location</FieldNote>
          </div>
        )}
      </div>

      {/* Reject reason input */}
      <AnimatePresence>
        {rejectOpen && (
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="px-5 pb-3">
            <label className="label">
              <span className="label-text">Reason for rejection</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Personal emergency, scheduling conflict…"
              rows={2}
              className="input-field resize-none text-xs"
            />
            <FieldNote>Reason shown to admin for reassignment. Optional but recommended.</FieldNote>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 pb-5 pt-1 border-t border-base-300/60">
        <button
          onClick={() => onAccept(booking._id)}
          disabled={isAccepting || isRejecting}
          className="btn btn-success btn-sm flex-1 gap-1.5">
          {isAccepting ? <Spinner size="xs" /> : <UserCheck className="w-4 h-4" />}
          Accept
        </button>

        {!rejectOpen ? (
          <button
            onClick={() => setRejectOpen(true)}
            disabled={isAccepting || isRejecting}
            className="btn btn-outline btn-sm flex-1 gap-1.5"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
            <UserX className="w-4 h-4" />
            Reject
          </button>
        ) : (
          <div className="flex gap-2 flex-1">
            <button onClick={handleReject} disabled={isRejecting}
              className="btn btn-error btn-sm flex-1 gap-1">
              {isRejecting ? <Spinner size="xs" /> : <XCircle className="w-3.5 h-3.5" />}
              Confirm
            </button>
            <button onClick={() => setRejectOpen(false)}
              className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Booking List Row ─────────────────────────────────────────────────────────

function BookingRow({ booking, onView }) {
  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown';
  const phone       = booking.customer?.phone || '—';
  const scheduled   = booking.scheduledAt ? new Date(booking.scheduledAt) : null;

  return (
    <motion.tr variants={fadeUp}
      className="cursor-pointer hover:bg-primary/5 transition-colors duration-150"
      onClick={() => onView(booking._id)}>
      <td>
        <div className="flex items-center gap-2.5 py-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-base-content">{patientName}</p>
            <p className="text-xs text-base-content/40">{phone}</p>
          </div>
        </div>
      </td>
      <td>
        <p className="text-xs font-bold text-primary">{booking.bookingCode || '—'}</p>
        <FieldNote>Booking reference</FieldNote>
      </td>
      <td>
        <BookingTypePill type={booking.bookingType} />
      </td>
      <td>
        {scheduled ? (
          <div>
            <p className="text-xs font-semibold text-base-content">
              {scheduled.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </p>
            <p className="text-xs text-base-content/40">
              {scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ) : '—'}
      </td>
      <td><StatusBadge status={booking.status} /></td>
      <td>
        <button className="btn btn-ghost btn-xs gap-1">
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      </td>
    </motion.tr>
  );
}

// ─── Booking Detail Panel ─────────────────────────────────────────────────────

function BookingDetailPanel({ booking, onClose }) {
  if (!booking) return null;

  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown Patient';
  const scheduled   = booking.scheduledAt ? new Date(booking.scheduledAt) : null;
  const fareTotal   = booking.fareBreakdown?.totalAmount;

  return (
    <motion.div variants={slideIn} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 z-50 mt-20 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        className="w-full max-w-md h-full bg-base-100 shadow-depth-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300"
          style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}>
          <div>
            <p className="text-base font-bold text-white">{patientName}</p>
            <p className="text-xs text-white/70 mt-0.5">Booking Detail View</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <XCircle className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">

          {/* Status Row */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-base-200">
            <StatusBadge status={booking.status} />
            <BookingTypePill type={booking.bookingType} />
            {booking.consultationType && (
              <span className="badge badge-xs badge-secondary">{booking.consultationType}</span>
            )}
          </div>

          {/* Patient Info */}
          <div className="card p-4 space-y-1">
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Patient Information
            </p>
            <InfoRow icon={User}    label="Full Name"  value={patientName}                      note="Patient's full name from booking" />
            <InfoRow icon={Phone}   label="Phone"      value={booking.customer?.phone || '—'}    note="Primary contact registered" />
            <InfoRow icon={Shield}  label="Blood Group" value={booking.patientInfo?.bloodGroup || '—'} note="Blood group from patient profile" />
            {booking.patientInfo?.age && (
              <InfoRow icon={Heart} label="Age / Gender"
                value={`${booking.patientInfo.age} yrs · ${booking.patientInfo.gender || '—'}`}
                note="Age and declared gender" />
            )}
          </div>

          {/* Booking Details */}
          <div className="card p-4">
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5" /> Booking Details
            </p>
            <InfoRow icon={FileText}    label="Booking Code"  value={booking.bookingCode}             note="Unique reference for this booking" />
            {scheduled && (
              <InfoRow icon={Calendar}  label="Scheduled At"
                value={`${scheduled.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} · ${scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                note="Confirmed appointment date and time" />
            )}
            <InfoRow icon={Activity}    label="Booking Type"  value={BOOKING_TYPE_LABELS[booking.bookingType]} note="Service type requested" />
          </div>

          {/* Location */}
          {(booking.patientLocation || booking.destinationLocation) && (
            <div className="card p-4">
              <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Location
              </p>
              {booking.patientLocation?.address && (
                <InfoRow icon={MapPin} label="Pickup / Care Location"
                  value={booking.patientLocation.address}
                  note="Where care assistant should report" />
              )}
              {booking.destinationLocation?.address && (
                <InfoRow icon={ArrowRight} label="Destination"
                  value={booking.destinationLocation.address}
                  note="Destination for patient transport" />
              )}
            </div>
          )}

          {/* Fare Breakdown */}
          {booking.fareBreakdown && (
            <div className="card p-4">
              <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Fare Breakdown
              </p>
              {[
                { label: 'Consultation Fee', key: 'consultationFee', note: 'Doctor consultation charge' },
                { label: 'Care Assistant Fee', key: 'careAssistantFee', note: 'CA service charge' },
                { label: 'Transport Fee', key: 'transportFee', note: 'Ambulance / vehicle charge' },
                { label: 'Platform Fee', key: 'platformFee', note: 'Likeson service fee' },
                { label: 'Taxes', key: 'taxes', note: 'GST and applicable taxes' },
                { label: 'Discount', key: 'discount', note: 'Promo / coupon discount applied' },
              ].filter(f => booking.fareBreakdown[f.key]).map(f => (
                <div key={f.key} className="flex justify-between items-start py-1.5 border-b border-base-300/50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-base-content/70">{f.label}</p>
                    <FieldNote>{f.note}</FieldNote>
                  </div>
                  <p className="text-sm font-bold text-base-content">
                    {f.key === 'discount' ? '−' : ''}₹{booking.fareBreakdown[f.key]}
                  </p>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-1">
                <p className="text-sm font-extrabold text-base-content">Total Amount</p>
                <p className="text-lg font-black text-primary">₹{fareTotal || 0}</p>
              </div>
              <FieldNote>Final payable amount including all taxes and deductions</FieldNote>
            </div>
          )}

          {/* Care Record Link */}
          {booking.careRecord && (
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--success), transparent 91%)', borderLeft: '4px solid var(--success)' }}>
              <Activity className="w-5 h-5 text-success" style={{ color: 'var(--success)' }} />
              <div className="flex-1">
                <p className="text-sm font-bold text-base-content">Care Record Active</p>
                <p className="text-xs text-base-content/50 mt-0.5">Status: {booking.careRecord.status}</p>
                <FieldNote>Linked care record for this booking's active care session</FieldNote>
              </div>
              <span className="badge badge-success badge-sm">Live</span>
            </div>
          )}

          {/* OP Record */}
          {booking.opRecord && (
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--info), transparent 91%)', borderLeft: '4px solid var(--info)' }}>
              <Stethoscope className="w-5 h-5 text-info" style={{ color: 'var(--info)' }} />
              <div className="flex-1">
                <p className="text-sm font-bold text-base-content">OP Record #{booking.opRecord.opNumber}</p>
                {booking.opRecord.diagnosisCode && (
                  <p className="text-xs text-base-content/50">Diagnosis: {booking.opRecord.diagnosisCode}</p>
                )}
                <FieldNote>Out-patient record linked from doctor's consultation</FieldNote>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({ status, onStatus, search, onSearch, onRefresh, isLoading }) {
  const statuses = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search patient name or booking code…"
          className="input-field pl-9 text-sm"
        />
        <FieldNote>Filter bookings by patient name or booking reference code</FieldNote>
      </div>

      {/* Status filter */}
      <div className="relative">
        <Filter className="absolute left-3 -mt-2 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
        <select
          value={status}
          onChange={e => onStatus(e.target.value)}
          className="input-field pl-9 pr-8 text-sm appearance-none min-w-[160px]">
          <option value="">All Statuses</option>
          {statuses.slice(1).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
          ))}
        </select>
        <FieldNote>Filter by current booking status</FieldNote>
      </div>

      {/* Refresh */}
      <button onClick={onRefresh} disabled={isLoading}
        className="btn btn-outline btn-sm gap-2 self-start sm:self-auto">
        {isLoading
          ? <Spinner size="xs" />
          : <RefreshCw className="w-4 h-4" />}
        Refresh
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingManagement() {
  const dispatch = useDispatch();

  // ── Selectors ──
  const bookings        = useSelector(selectCABookings);
  const bookingsTotal   = useSelector(selectCABookingsTotal);
  const pendingBookings = useSelector(selectCAPendingBookings);
  const pendingCount    = useSelector(selectCAPendingCount);
  const selectedBooking = useSelector(selectSelectedCABooking);

  const loadingBookings  = useSelector(selectClinicalLoading('fetchCABookings'));
  const loadingPending   = useSelector(selectClinicalLoading('fetchCAPendingBookings'));
  const loadingDetail    = useSelector(selectClinicalLoading('fetchCABookingById'));
  const loadingAccept    = useSelector(selectClinicalLoading('acceptCABooking'));
  const loadingReject    = useSelector(selectClinicalLoading('rejectCABooking'));

  const errorBookings    = useSelector(selectClinicalError('fetchCABookings'));
  const errorPending     = useSelector(selectClinicalError('fetchCAPendingBookings'));

  // ── Local state ──
  const [tab, setTab]           = useState('pending');   // 'pending' | 'all'
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState('');
  const [search, setSearch]     = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  // ── Fetch on mount + deps ──
  const loadPending = useCallback(() => {
    dispatch(fetchCAPendingBookings());
  }, [dispatch]);

  const loadAll = useCallback(() => {
    const params = { page, limit: PAGE_LIMIT };
    if (status) params.status = status;
    dispatch(fetchCABookings(params));
  }, [dispatch, page, status]);

  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => {
    if (tab === 'all') loadAll();
  }, [tab, loadAll]);

  // ── Actions ──
  async function handleAccept(bookingId) {
    setAcceptingId(bookingId);
    await dispatch(acceptCABooking({ bookingId, patientSnapshot: null }));
    setAcceptingId(null);
    loadPending();
  }

  async function handleReject(bookingId, reason) {
    setRejectingId(bookingId);
    await dispatch(rejectCABooking({ bookingId, reason }));
    setRejectingId(null);
    loadPending();
  }

  async function handleViewDetail(bookingId) {
    await dispatch(fetchCABookingById(bookingId));
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    dispatch(clearSelectedCABooking());
  }

  // ── Client-side search filter ──
  const filteredBookings = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name  = (b.patientInfo?.name || b.customer?.name || '').toLowerCase();
    const code  = (b.bookingCode || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const totalPages = Math.ceil(bookingsTotal / PAGE_LIMIT);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">
      {/* ── Background texture ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 50% at 20% -10%, color-mix(in srgb, var(--primary), transparent 85%), transparent),
                            radial-gradient(ellipse 60% 40% at 80% 110%, color-mix(in srgb, var(--secondary), transparent 88%), transparent)`,
        }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Page Header ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--bg-gradient-primary)' }}>
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-base-content tracking-tight">
                  Booking Management
                </h1>
                <p className="text-sm text-base-content/50 mt-0.5">Care Assistant Portal · Likeson.in</p>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-3">
            <div className="stat-card px-4 py-3 flex items-center gap-3 min-w-[140px]">
              <Bell className="w-5 h-5 text-warning" style={{ color: 'var(--warning)' }} />
              <div>
                <p className="stat-card-value text-xl">{pendingCount}</p>
                <p className="stat-card-label text-[0.65rem]">Pending Acceptance</p>
              </div>
            </div>
            <div className="stat-card px-4 py-3 flex items-center gap-3 min-w-[140px]">
              <ClipboardList className="w-5 h-5 text-primary" />
              <div>
                <p className="stat-card-value text-xl">{bookingsTotal}</p>
                <p className="stat-card-label text-[0.65rem]">Total Bookings</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Alert if pending ── */}
        <AnimatePresence>
          {pendingCount > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit">
              <div className="alert alert-warning gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="text-sm font-bold text-base-content">
                    {pendingCount} booking{pendingCount > 1 ? 's' : ''} awaiting your acceptance
                  </p>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    Review and accept or reject before the patient is reassigned by admin.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tabs ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.08 }}>
          <div className="flex gap-1 p-1 rounded-xl bg-base-200 w-fit">
            {[
              { key: 'pending', label: 'Pending Actions', icon: Bell,        badge: pendingCount },
              { key: 'all',     label: 'All Bookings',    icon: ClipboardList, badge: null },
            ].map(t => (
              <button key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative
                  ${tab === t.key
                    ? 'bg-base-100 text-primary shadow-sm'
                    : 'text-base-content/50 hover:text-base-content/80'}`}>
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning text-white text-[0.6rem] font-black flex items-center justify-center"
                    style={{ background: 'var(--warning)', color: 'var(--warning-content)' }}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── TAB: PENDING ── */}
        <AnimatePresence mode="wait">
          {tab === 'pending' && (
            <motion.div key="pending" variants={stagger} initial="hidden" animate="visible" exit="exit">

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-bold text-base-content">Awaiting Your Response</p>
                  <p className="text-xs text-base-content/40 mt-0.5">
                    Accept to create a care record, or reject to release back to admin.
                  </p>
                  <FieldNote>These are confirmed bookings assigned to you that have no active care record yet</FieldNote>
                </div>
                <button onClick={loadPending} disabled={loadingPending}
                  className="btn btn-ghost btn-sm gap-1.5">
                  {loadingPending ? <Spinner size="xs" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>

              {errorPending && (
                <motion.div variants={fadeUp} className="alert alert-error mb-4 gap-3">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--error)' }} />
                  <p className="text-sm">{errorPending}</p>
                </motion.div>
              )}

              {loadingPending ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : pendingBookings.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No pending bookings"
                  subtitle="You're all caught up! New bookings assigned to you will appear here." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pendingBookings.map(b => (
                    <PendingBookingCard
                      key={b._id}
                      booking={b}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      onView={handleViewDetail}
                      isAccepting={acceptingId === b._id && loadingAccept}
                      isRejecting={rejectingId === b._id && loadingReject}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB: ALL BOOKINGS ── */}
          {tab === 'all' && (
            <motion.div key="all" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
              className="space-y-4">

              <FilterBar
                status={status}
                onStatus={v => { setStatus(v); setPage(1); }}
                search={search}
                onSearch={setSearch}
                onRefresh={loadAll}
                isLoading={loadingBookings}
              />

              {errorBookings && (
                <div className="alert alert-error gap-3">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--error)' }} />
                  <p className="text-sm">{errorBookings}</p>
                </div>
              )}

              <div className="card overflow-hidden">
                {loadingBookings ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : filteredBookings.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="No bookings found"
                    subtitle="Try adjusting your filters or search term." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>
                            Patient
                            <FieldNote>Name and contact</FieldNote>
                          </th>
                          <th>
                            Booking Code
                            <FieldNote>Unique reference</FieldNote>
                          </th>
                          <th>
                            Type
                            <FieldNote>Service category</FieldNote>
                          </th>
                          <th>
                            Scheduled
                            <FieldNote>Date and time</FieldNote>
                          </th>
                          <th>
                            Status
                            <FieldNote>Current state</FieldNote>
                          </th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <motion.tbody variants={stagger} initial="hidden" animate="visible">
                        {filteredBookings.map(b => (
                          <BookingRow key={b._id} booking={b} onView={handleViewDetail} />
                        ))}
                      </motion.tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-base-300">
                    <p className="text-xs text-base-content/40">
                      Page {page} of {totalPages} · {bookingsTotal} total bookings
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loadingBookings}
                        className="btn btn-outline btn-xs gap-1">
                        <ChevronDown className="w-3.5 h-3.5 -rotate-90" /> Prev
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loadingBookings}
                        className="btn btn-outline btn-xs gap-1">
                        Next <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Detail panel overlay ── */}
        <AnimatePresence>
          {detailOpen && (
            loadingDetail
              ? (
                <motion.div key="loading-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}>
                  <div className="bg-base-100 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-depth-lg">
                    <Spinner />
                    <p className="text-sm font-semibold text-base-content/60">Loading booking details…</p>
                  </div>
                </motion.div>
              )
              : selectedBooking && (
                <BookingDetailPanel
                  key="detail"
                  booking={selectedBooking}
                  onClose={handleCloseDetail}
                />
              )
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}