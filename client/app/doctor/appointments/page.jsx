'use client';

import {
  useEffect, useState, useCallback, useMemo, useRef, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Calendar, Clock, ChevronRight, ChevronLeft,
  FileText, Stethoscope, Video, Home, Search,
  CheckCircle2, AlertCircle, XCircle, Clock3, RefreshCw,
  Plus, Eye, Activity, CalendarDays, MoreVertical, Layers,
  ClipboardList, PenLine, BadgeCheck, Radio,
} from 'lucide-react';

import {
  fetchDoctorAppointments,
  fetchDoctorTodayAppointments,
  fetchOPRecords,
  completeOPRecord,
  selectDoctorAppointments,
  selectDoctorAppointmentsTotal,
  selectOPRecords,
  selectClinicalLoading,
  selectClinicalError,
} from '@/store/slices/clinicalSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: '',            label: 'All'         },
  { value: 'pending',     label: 'Pending'     },
  { value: 'confirmed',   label: 'Confirmed'   },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
  { value: 'no_show',     label: 'No Show'     },
];

const CONSULT_TYPES = [
  { value: '',          label: 'All Types'  },
  { value: 'inPerson',  label: 'In Person'  },
  { value: 'video',     label: 'Video'      },
  { value: 'homeVisit', label: 'Home Visit' },
];

const BOOKING_TYPE_LABEL = {
  full_care_ride:      'Full Care',
  doctor_consultation: 'Consultation',
  doctor_online:       'Online',
  physiotherapist:     'Physio',
  follow_up:           'Follow-up',
};

const PAGE_LIMIT         = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig = (status) => {
  const map = {
    pending:     { label: 'Pending',     bg: 'bg-warning\/10',  text: 'text-warning',  Icon: Clock3       },
    confirmed:   { label: 'Confirmed',   bg: 'bg-info\/10',     text: 'text-info',     Icon: BadgeCheck   },
    in_progress: { label: 'In Progress', bg: 'bg-primary\/10',  text: 'text-primary',  Icon: Activity     },
    completed:   { label: 'Completed',   bg: 'bg-success\/10',  text: 'text-success',  Icon: CheckCircle2 },
    cancelled:   { label: 'Cancelled',   bg: 'bg-error\/10',    text: 'text-error',    Icon: XCircle      },
    no_show:     { label: 'No Show',     bg: 'bg-error\/10',    text: 'text-error',    Icon: AlertCircle  },
  };
  return map[status] ?? { label: status, bg: 'bg-base-200', text: 'text-base-content', Icon: Clock3 };
};

const consultIcon = (type) => {
  if (type === 'video')     return <Video size={13} />;
  if (type === 'homeVisit') return <Home  size={13} />;
  return <Stethoscope size={13} />;
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return '—'; }
};

const formatShortDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};

const buildChartData = (appointments) => {
  const now  = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { date: formatShortDate(d), count: 0, key: d.toDateString() };
  });
  (appointments || []).forEach((a) => {
    try {
      const k    = new Date(a.scheduledAt).toDateString();
      const slot = days.find((d) => d.key === k);
      if (slot) slot.count += 1;
    } catch {}
  });
  return days;
};

const isOnlineBooking = (b) =>
  b?.bookingType === 'doctor_online' || b?.consultationType === 'video';

const canJoinConsult = (b) =>
  isOnlineBooking(b) && ['confirmed', 'in_progress'].includes(b?.status);

const bookingIdFromOP = (op) => {
  if (!op?.booking) return null;
  if (typeof op.booking === 'string') return op.booking;
  if (typeof op.booking === 'object') return op.booking?._id?.toString() ?? null;
  return null;
};

const getPatientName = (b) => b?.patientInfo?.name ?? b?.customer?.name ?? '—';
const getPatientPhone = (b) => b?.patientInfo?.phone ?? b?.customer?.phone ?? '—';
const getInitial = (b) => (getPatientName(b)?.[0] ?? '?').toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const STAT_COLOR_MAP = {
  primary:   'var(--primary)',
  info:      'var(--info)',
  success:   'var(--success)',
  warning:   'var(--warning)',
  accent:    'var(--accent)',
};

const StatCard = memo(({ icon: Icon, label, value, sub, colorKey = 'primary', chartData, live }) => {
  const color = STAT_COLOR_MAP[colorKey] ?? STAT_COLOR_MAP.primary;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card relative overflow-hidden flex flex-col gap-3"
      aria-label={`${label}: ${value}`}
    >
      {live && (
        <span className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-success font-semibold" aria-label="Live">
          <span className="status-dot status-dot-success animate-pulse" aria-hidden="true" />
          Live
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="label-text-alt uppercase tracking-widest mb-1">{label}</p>
          <p className="stat-card-value">{value}</p>
          {sub && <p className="label-text-alt mt-1">{sub}</p>}
        </div>
        <div
          className="p-2.5 rounded-xl"
          style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}
          aria-hidden="true"
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      {chartData && (
        <div className="h-12 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill={`url(#grad-${label})`} dot={false} />
              <Tooltip
                contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: 'var(--base-content)' }}
                itemStyle={{ color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.article>
  );
});
StatCard.displayName = 'StatCard';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = memo(({ status }) => {
  const { label, bg, text, Icon } = statusConfig(status);
  return (
    <span className={`badge badge-sm ${bg} ${text} border-0`}>
      <Icon size={10} aria-hidden="true" />
      {label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ─────────────────────────────────────────────────────────────────────────────
// CONSULT TYPE BADGE
// ─────────────────────────────────────────────────────────────────────────────

const ConsultTypeBadge = memo(({ type }) => (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-base-content\/60">
    {consultIcon(type)}
    {type ?? '—'}
  </span>
));
ConsultTypeBadge.displayName = 'ConsultTypeBadge';

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT AVATAR
// ─────────────────────────────────────────────────────────────────────────────

const PatientAvatar = memo(({ booking }) => (
  <div className="avatar placeholder" aria-hidden="true">
    <div className="w-9 h-9 rounded-xl bg-primary\/10 text-primary font-bold text-sm">
      <span>{getInitial(booking)}</span>
    </div>
  </div>
));
PatientAvatar.displayName = 'PatientAvatar';

// ─────────────────────────────────────────────────────────────────────────────
// ACTION MENU
// ─────────────────────────────────────────────────────────────────────────────

const MenuItem = ({ icon, label, highlight = '', onClick }) => (
  <button
    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-primary\/5 text-base-content transition-colors ${highlight}`}
    onClick={onClick}
    role="menuitem"
  >
    {icon}
    {label}
  </button>
);

const ActionMenu = memo(({ booking, opRecord, onComplete, router }) => {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const triggerRef      = useRef(null);

  const canComplete = ['in_progress', 'confirmed'].includes(booking?.status);
  const showVideo   = canJoinConsult(booking);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown',   handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('keydown',   handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        className="btn btn-ghost btn-xs btn-circle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-8 z-20 w-56 bg-base-100 border border-base-300 rounded-xl shadow-depth py-1 overflow-hidden"
            role="menu"
          >
            <MenuItem
              icon={<Eye size={14} className="text-primary" />}
              label="View Details"
              onClick={() => { close(); router.push(`/doctor/appointments/${booking._id}`); }}
            />
           
              {showVideo && (
              <MenuItem
                icon={<Video size={14} className="text-info" />}
                label="Join Video Call"
                highlight="text-info"
                // UPDATE THIS LINE BELOW
               onClick={() => { close(); router.push(`/doctor/consultations/${booking.consultationSessionId?.consultationId ?? booking._id}`); }}
              />
            )}
            <MenuItem
              icon={<PenLine size={14} className="text-accent" />}
              label="Write Prescription"
              onClick={() => { close(); router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`); }}
            />
            <MenuItem
              icon={<ClipboardList size={14} className="text-secondary" />}
              label="View Prescriptions"
              onClick={() => { close(); router.push(`/doctor/prescriptions?bookingId=${booking._id}`); }}
            />
            {opRecord && (
              <MenuItem
                icon={<FileText size={14} className="text-info" />}
                label={`OP: ${opRecord.opNumber || 'View Record'}`}
                onClick={() => { close(); router.push(`/doctor/op-records/${opRecord._id}`); }}
              />
            )}
            {canComplete && (
              <>
                <div className="divider my-1 mx-3" role="separator" />
                <MenuItem
                  icon={<CheckCircle2 size={14} className="text-success" />}
                  label="Mark Complete"
                  highlight="text-success hover:bg-success\/5"
                  onClick={() => { close(); onComplete(booking._id, opRecord?._id ?? null); }}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ActionMenu.displayName = 'ActionMenu';

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

const CompleteModal = memo(({ open, onClose, onSubmit, loading }) => {
  const [notes,  setNotes]  = useState('');
  const [code,   setCode]   = useState('');
  const [reason, setReason] = useState('');
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(() => {
    if (loading) return;
    onSubmit({ doctorNotes: notes, diagnosisCode: code, reasonForVisit: reason });
    setNotes(''); setCode(''); setReason('');
  }, [loading, onSubmit, notes, code, reason]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-soft"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Complete consultation"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="bg-base-100 border border-base-300 rounded-2xl shadow-depth-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-success\/10" aria-hidden="true">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div>
                <h3 className="font-bold text-base-content text-lg leading-tight">
                  Complete Consultation
                </h3>
                <p className="label-text-alt mt-0.5">All fields optional — fill as needed</p>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="complete-reason" className="label-text block mb-1.5">
                  Reason for Visit
                </label>
                <input
                  id="complete-reason"
                  ref={firstInputRef}
                  className="input-field"
                  placeholder="Chief complaints / reason…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="complete-code" className="label-text block mb-1.5">
                  ICD-10 Code
                  <span className="label-text-alt font-normal ml-1">(optional)</span>
                </label>
                <input
                  id="complete-code"
                  className="input-field font-mono"
                  placeholder="e.g. J06.9"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="complete-notes" className="label-text block mb-1.5">
                  Doctor Notes
                </label>
                <textarea
                  id="complete-notes"
                  className="input-field min-h-[96px] resize-none"
                  placeholder="Clinical findings, advice, observations…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                className="btn btn-ghost flex-1"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-success flex-1 gap-2"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <span className="loading loading-xs loading-spinner" aria-hidden="true" />
                  : <CheckCircle2 size={15} aria-hidden="true" />
                }
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
CompleteModal.displayName = 'CompleteModal';

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = () => (
  <tr>
    <td colSpan={8} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3 text-base-content\/40">
        <CalendarDays size={36} strokeWidth={1} aria-hidden="true" />
        <p className="font-semibold text-sm">No appointments found</p>
        <p className="text-xs">Try adjusting your filters</p>
      </div>
    </td>
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────────────────────────────────

const LoadingRows = () => (
  <tr>
    <td colSpan={8} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <span className="loading loading-md loading-spinner" aria-hidden="true" />
        <span className="text-sm text-base-content\/40">Loading appointments…</span>
      </div>
    </td>
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENT TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────

const AppointmentRow = memo(({ booking, index, opByBooking, onComplete, router }) => {
  const op       = opByBooking[booking._id?.toString()];
  const joinable = canJoinConsult(booking);

  return (
    <motion.tr
      key={booking._id}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0, transition: { delay: Math.min(index * 0.03, 0.3) } }}
      exit={{ opacity: 0 }}
      className="hover:bg-primary\/5 cursor-default group"
      aria-label={`Appointment for ${getPatientName(booking)}`}
    >
      {/* Patient */}
      <td>
        <div className="flex items-center gap-2.5">
          <PatientAvatar booking={booking} />
          <div>
            <p className="font-semibold text-sm text-base-content leading-tight">
              {getPatientName(booking)}
            </p>
            <p className="label-text-alt">{getPatientPhone(booking)}</p>
          </div>
        </div>
      </td>

      {/* Booking code */}
      <td>
        <p className="font-mono text-xs font-bold text-primary">{booking.bookingCode ?? '—'}</p>
        <p className="label-text-alt">
          {BOOKING_TYPE_LABEL[booking.bookingType] ?? booking.bookingType ?? '—'}
        </p>
      </td>

      {/* Type */}
      <td>
        <ConsultTypeBadge type={booking.consultationType} />
      </td>

      {/* Scheduled */}
      <td>
        <p className="text-sm">{formatDate(booking.scheduledAt)}</p>
      </td>

      {/* Status */}
      <td>
        <StatusBadge status={booking.status} />
      </td>

      {/* Payment */}
      <td>
        <span className={`text-xs font-semibold ${
          booking.paymentStatus === 'paid'   ? 'text-success' :
          booking.paymentStatus === 'unpaid' ? 'text-error'   : 'text-warning'
        }`}>
          {booking.paymentStatus ?? '—'}
        </span>
      </td>

      {/* OP Record */}
      <td>
        {op ? (
          <button
            onClick={() => router.push(`/doctor/op-records/${op._id}`)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            aria-label={`View OP record ${op.opNumber ?? ''}`}
          >
            <FileText size={11} aria-hidden="true" />
            {op.opNumber ?? 'View'}
          </button>
        ) : (
          <span className="label-text-alt">—</span>
        )}
      </td>

      {/* Actions */}
   {/* Actions */}
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          {joinable && (
            <button
              className="btn btn-info btn-xs gap-1"
              // UPDATE THIS LINE BELOW
            onClick={() => router.push(`/doctor/consultations/${booking.consultationSessionId?.consultationId ?? booking._id}`)}
              aria-label="Join video consultation"
            >
              <Video size={12} aria-hidden="true" />
              <span className="hidden lg:inline">Join</span>
            </button>
          )}
          <button
            className="btn btn-ghost btn-xs gap-1 text-accent hover:bg-accent\/10"
            onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
            aria-label="Write prescription"
          >
            <PenLine size={13} aria-hidden="true" />
            <span className="hidden lg:inline text-xs">Prescribe</span>
          </button>
          <ActionMenu
            booking={booking}
            opRecord={op}
            onComplete={onComplete}
            router={router}
          />
        </div>
      </td>
    </motion.tr>
  );
});
AppointmentRow.displayName = 'AppointmentRow';

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CARD
// ─────────────────────────────────────────────────────────────────────────────

const MobileCard = memo(({ booking, index, opByBooking, onComplete, router }) => {
  const op       = opByBooking[booking._id?.toString()];
  const joinable = canJoinConsult(booking);

  return (
    <motion.div
      key={booking._id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.05, 0.3) } }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-3"
      role="listitem"
      aria-label={`Appointment for ${getPatientName(booking)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="avatar placeholder" aria-hidden="true">
            <div className="w-10 h-10 rounded-xl bg-primary\/10 text-primary font-bold">
              <span>{getInitial(booking)}</span>
            </div>
          </div>
          <div>
            <p className="font-bold text-sm">{getPatientName(booking)}</p>
            <p className="label-text-alt">{booking.bookingCode}</p>
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="label-text-alt uppercase tracking-wide mb-0.5">Scheduled</p>
          <p>{formatDate(booking.scheduledAt)}</p>
        </div>
        <div>
          <p className="label-text-alt uppercase tracking-wide mb-0.5">Type</p>
          <ConsultTypeBadge type={booking.consultationType} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {joinable && (
          <Link
            href={`/doctor/consultations/${booking.consultationSessionId?.consultationId ?? booking._id}`}
            className="btn btn-info btn-sm flex-1 gap-1 text-xs"
            aria-label="Join video consultation"
          >
            <Video size={12} aria-hidden="true" /> Join Call
          </Link>
        )}
        <button
          className="btn btn-primary btn-sm flex-1 gap-1 text-xs"
          onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
          aria-label="Write prescription"
        >
          <PenLine size={12} aria-hidden="true" /> Prescribe
        </button>
        {op && (
          <button
            className="btn btn-outline btn-sm gap-1 text-xs"
            onClick={() => router.push(`/doctor/op-records/${op._id}`)}
            aria-label={`View OP record ${op.opNumber ?? ''}`}
          >
            <FileText size={12} aria-hidden="true" /> OP
          </button>
        )}
        <ActionMenu
          booking={booking}
          opRecord={op}
          onComplete={onComplete}
          router={router}
        />
      </div>
    </motion.div>
  );
});
MobileCard.displayName = 'MobileCard';

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

const Pagination = memo(({ page, totalPages, total, onPage }) => {
  const window_ = useMemo(() => {
    const max   = 5;
    const start = Math.max(1, Math.min(page - Math.floor(max / 2), totalPages - max + 1));
    const end   = Math.min(totalPages, start + max - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav
      className="border-t border-base-300 px-6 py-4 flex items-center justify-between flex-wrap gap-3"
      aria-label="Pagination"
    >
      <p className="text-sm text-base-content\/50" aria-live="polite">
        Page {page} of {totalPages} · {total} appointments
      </p>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page === 1}
          onClick={() => onPage((p) => Math.max(1, p - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {window_.map((n) => (
          <button
            key={n}
            className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onPage(n)}
            aria-label={`Page ${n}`}
            aria-current={n === page ? 'page' : undefined}
          >
            {n}
          </button>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          disabled={page === totalPages}
          onClick={() => onPage((p) => Math.min(totalPages, p + 1))}
          aria-label="Next page"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
});
Pagination.displayName = 'Pagination';

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────

const FilterBar = memo(({
  searchRaw, setSearchRaw,
  statusFilter, setStatusFilter,
  consType, setConsType,
  from, setFrom,
  to, setTo,
  hasFilters, onClear,
}) => (
  <section
    aria-label="Appointment filters"
    className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap gap-3 items-center"
  >
    {/* Search */}
    <div className="relative flex-1 min-w-[200px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content\/30" aria-hidden="true" />
      <input
        className="input-field pl-9 text-sm"
        placeholder="Search patient, booking code, phone…"
        value={searchRaw}
        onChange={(e) => setSearchRaw(e.target.value)}
        aria-label="Search appointments"
      />
    </div>

    {/* Status pills */}
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          onClick={() => setStatusFilter(s.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            statusFilter === s.value
              ? 'border-primary bg-primary text-primary-content'
              : 'border-base-300 text-base-content\/60 hover:border-primary\/40'
          }`}
          aria-pressed={statusFilter === s.value}
        >
          {s.label}
        </button>
      ))}
    </div>

    {/* Type select */}
    <select
      className="input-field text-sm w-auto min-w-[130px]"
      value={consType}
      onChange={(e) => setConsType(e.target.value)}
      aria-label="Filter by consultation type"
    >
      {CONSULT_TYPES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>

    {/* Date range */}
    <div className="flex flex-col sm:flex-row items-center gap-1.5">
      <input
        type="date"
        className="input-field text-sm w-auto"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        aria-label="From date"
      />
      <span className="text-base-content\/30 text-sm" aria-hidden="true">→</span>
      <input
        type="date"
        className="input-field text-sm w-auto"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        aria-label="To date"
      />
    </div>

    {hasFilters && (
      <button
        className="btn btn-ghost btn-sm text-error gap-1"
        onClick={onClear}
        aria-label="Clear all filters"
      >
        <XCircle size={13} aria-hidden="true" /> Clear
      </button>
    )}
  </section>
));
FilterBar.displayName = 'FilterBar';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AppointmentsManagement() {
  const dispatch = useDispatch();
  const router   = useRouter();

  // ── Redux ──────────────────────────────────────────────────────────────────
  const appointments = useSelector(selectDoctorAppointments);
  const total        = useSelector(selectDoctorAppointmentsTotal);
  const opRecords    = useSelector(selectOPRecords);
  const loadingAppts = useSelector(selectClinicalLoading('fetchDoctorAppointments'));
  const loadingOP    = useSelector(selectClinicalLoading('completeOPRecord'));
  const error        = useSelector(selectClinicalError('fetchDoctorAppointments'));

  // ── Filter state ───────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('');
  const [consType,     setConsType]     = useState('');
  const [searchRaw,    setSearchRaw]    = useState('');
  const [from,         setFrom]         = useState('');
  const [to,           setTo]           = useState('');
  const [page,         setPage]         = useState(1);

  const search = useDebounce(searchRaw, SEARCH_DEBOUNCE_MS);

  // ── Complete modal ─────────────────────────────────────────────────────────
  const [completeTarget, setCompleteTarget] = useState(null);
  const [showComplete,   setShowComplete]   = useState(false);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    dispatch(fetchDoctorAppointments({
      status:           statusFilter || undefined,
      consultationType: consType     || undefined,
      from:             from         || undefined,
      to:               to           || undefined,
      search:           search       || undefined,
      page,
      limit: PAGE_LIMIT,
    }));
    // Fetch OP records so we can link them against bookings in this page
    dispatch(fetchOPRecords({ page: 1, limit: 200 }));
  }, [dispatch, statusFilter, consType, search, from, to, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  const filtersKey  = `${statusFilter}|${consType}|${search}|${from}|${to}`;
  const prevFilters = useRef(filtersKey);
  useEffect(() => {
    if (prevFilters.current !== filtersKey) {
      prevFilters.current = filtersKey;
      setPage(1);
    }
  }, [filtersKey]);

  // ── Derived data ───────────────────────────────────────────────────────────
  // Map OP records by booking ID (handle both ObjectId and populated object shapes)
  const opByBooking = useMemo(() => {
    const map = {};
    (opRecords || []).forEach((op) => {
      const bk = bookingIdFromOP(op);
      if (!bk) return;
      const existing = map[bk];
      if (!existing || new Date(op.updatedAt) > new Date(existing.updatedAt)) {
        map[bk] = op;
      }
    });
    return map;
  }, [opRecords]);

  const stats = useMemo(() => {
    const appts = appointments || [];
    const today = new Date().toDateString();
    return {
      total,
      completed: appts.filter((a) => a.status === 'completed').length,
      today:     appts.filter((a) => {
        try { return new Date(a.scheduledAt).toDateString() === today; } catch { return false; }
      }).length,
      pending: appts.filter((a) => ['pending', 'confirmed'].includes(a.status)).length,
      online:  appts.filter((a) => a.status === 'in_progress' && isOnlineBooking(a)).length,
    };
  }, [appointments, total]);

  const chartData  = useMemo(() => buildChartData(appointments || []), [appointments]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCompleteClick = useCallback((bookingId, opId) => {
    setCompleteTarget({ bookingId, opId });
    setShowComplete(true);
  }, []);

  const handleCompleteSubmit = useCallback(async (body) => {
    if (!completeTarget) return;
    const { opId } = completeTarget;
    if (!opId) {
      // No linked OP record — cannot call the complete endpoint without an OP id.
      // This is a data integrity issue that should be resolved by admin.
      console.warn('[AppointmentsManagement] No OP record linked — cannot complete.');
      setShowComplete(false);
      return;
    }
    await dispatch(completeOPRecord({ id: opId, ...body }));
    setShowComplete(false);
    fetchData();
  }, [completeTarget, dispatch, fetchData]);

  const clearFilters = useCallback(() => {
    setStatusFilter(''); setConsType(''); setFrom(''); setTo(''); setSearchRaw('');
  }, []);

  const hasFilters = !!(statusFilter || consType || from || to || searchRaw);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary\/10" aria-hidden="true">
              <CalendarDays size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-base-content leading-tight">
                Appointments
              </h1>
              <p className="label-text-alt">
                {total} total
                {stats.online > 0 && (
                  <span className="ml-2 text-success font-semibold">
                    · {stats.online} live
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loadingAppts}
              className="btn btn-ghost btn-sm gap-1.5"
              aria-label="Refresh appointments"
            >
              <RefreshCw size={14} className={loadingAppts ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh
            </button>
            <button
              onClick={() => router.push('/doctor/prescriptions/new')}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Plus size={14} aria-hidden="true" />
              New Prescription
            </button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <section
          aria-label="Appointment statistics"
          className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
          <StatCard
            icon={Layers}
            label="Total"
            value={stats.total}
            colorKey="primary"
            sub="All time"
            chartData={chartData}
          />
          <StatCard
            icon={CalendarDays}
            label="Today"
            value={stats.today}
            colorKey="info"
            sub="Scheduled today"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={stats.completed}
            colorKey="success"
            sub="This page"
          />
          <StatCard
            icon={Clock3}
            label="Pending"
            value={stats.pending}
            colorKey="warning"
            sub="Awaiting"
          />
          <StatCard
            icon={Radio}
            label="Live"
            value={stats.online}
            colorKey="success"
            sub="In progress"
            live={stats.online > 0}
          />
        </section>

        {/* ── Filter Bar ──────────────────────────────────────────────────── */}
        <FilterBar
          searchRaw={searchRaw}  setSearchRaw={setSearchRaw}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          consType={consType}    setConsType={setConsType}
          from={from}            setFrom={setFrom}
          to={to}                setTo={setTo}
          hasFilters={hasFilters}
          onClear={clearFilters}
        />

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Table / Cards ────────────────────────────────────────────────── */}
        <section
          aria-label="Appointments list"
          className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden"
        >
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="table w-full" aria-label="Appointments">
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Booking</th>
                  <th scope="col">Type</th>
                  <th scope="col">Scheduled</th>
                  <th scope="col">Status</th>
                  <th scope="col">Payment</th>
                  <th scope="col">OP Record</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingAppts && <LoadingRows />}
                {!loadingAppts && (appointments || []).length === 0 && <EmptyState />}
                <AnimatePresence mode="popLayout">
                  {!loadingAppts && (appointments || []).map((booking, i) => (
                    <AppointmentRow
                      key={booking._id}
                      booking={booking}
                      index={i}
                      opByBooking={opByBooking}
                      onComplete={handleCompleteClick}
                      router={router}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-base-300" role="list" aria-label="Appointments">
            {loadingAppts && (
              <div className="py-16 flex justify-center" role="status">
                <span className="loading loading-md loading-spinner" aria-label="Loading appointments" />
              </div>
            )}
            <AnimatePresence>
              {!loadingAppts && (appointments || []).map((booking, i) => (
                <MobileCard
                  key={booking._id}
                  booking={booking}
                  index={i}
                  opByBooking={opByBooking}
                  onComplete={handleCompleteClick}
                  router={router}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPage={setPage}
          />
        </section>
      </main>

      {/* ── Complete Modal ───────────────────────────────────────────────── */}
      <CompleteModal
        open={showComplete}
        onClose={() => setShowComplete(false)}
        onSubmit={handleCompleteSubmit}
        loading={loadingOP}
      />
    </div>
  );
}