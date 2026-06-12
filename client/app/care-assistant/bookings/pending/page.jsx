'use client';

/**
 * ActiveBookings.jsx
 * Care Assistant — Active Bookings & Live Tracking Hub
 * Stack: Next.js · Redux Toolkit (clinicalSlice) · Tailwind CSS · Lucide · Framer Motion
 * Theme: care-assistant (Rose)
 */

import { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { useRouter }                         from 'next/navigation';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Activity, Navigation, Clock, User, Phone, MapPin,
  RefreshCw, Calendar, ChevronRight, Heart, Radio,
  Stethoscope, FileText, AlertTriangle, Inbox,
  ArrowRight, Shield, ClipboardList, Eye, Loader2,
  CheckCircle2, XCircle, UserX, Zap,
} from 'lucide-react';

import {
  fetchCABookings,
  fetchActiveCareRecord,
  fetchCareRecords,
  selectCABookings,
  selectCABookingsTotal,
  selectActiveCareRecord,
  selectCareRecords,
  selectCareRecordsTotal,
  selectClinicalLoading,
  selectClinicalError,
} from '@/store/slices/clinicalSlice';
import BackButton from '@/components/BackButton';

// ─── Constants ────────────────────────────────────────────────────────────────

const RIDE_BOOKING_TYPES = new Set([
  'full_care_ride',
  'patient_transport',
  'diagnostic_home',
  'care_assistant',
]);

const TRACKABLE_STATUSES = new Set([
  'pending',
  'confirmed',
  'in_progress',
]);

const STATUS_CFG = {
  pending:         { label: 'Pending',        dot: 'bg-warning',  text: 'text-warning',  bg: 'bg-warning/10',  icon: Clock },
  confirmed:       { label: 'Confirmed',      dot: 'bg-info',     text: 'text-info',     bg: 'bg-info/10',     icon: CheckCircle2 },
  in_progress:     { label: 'In Progress',    dot: 'bg-success',  text: 'text-success',  bg: 'bg-success/10',  icon: Activity },
  completed:       { label: 'Completed',      dot: 'bg-info',     text: 'text-info',     bg: 'bg-info/10',     icon: CheckCircle2 },
  cancelled:       { label: 'Cancelled',      dot: 'bg-error',    text: 'text-error',    bg: 'bg-error/10',    icon: XCircle },
  no_show:         { label: 'No Show',        dot: 'bg-error',    text: 'text-error',    bg: 'bg-error/10',    icon: UserX },
  payment_pending: { label: 'Pmt Pending',    dot: 'bg-warning',  text: 'text-warning',  bg: 'bg-warning/10',  icon: Clock },
  draft:           { label: 'Draft',          dot: 'bg-base-300', text: 'text-base-content/40', bg: 'bg-base-200', icon: FileText },
  active:          { label: 'Active',         dot: 'bg-success',  text: 'text-success',  bg: 'bg-success/10',  icon: Activity },
  discharged:      { label: 'Discharged',     dot: 'bg-info',     text: 'text-info',     bg: 'bg-info/10',     icon: CheckCircle2 },
  transferred:     { label: 'Transferred',    dot: 'bg-warning',  text: 'text-warning',  bg: 'bg-warning/10',  icon: ArrowRight },
  on_hold:         { label: 'On Hold',        dot: 'bg-warning',  text: 'text-warning',  bg: 'bg-warning/10',  icon: Clock },
};

const TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Doctor Consult',
  doctor_online:       'Online Consult',
  physiotherapist:     'Physiotherapy',
  care_assistant:      'Care Assistant',
  diagnostic_center:   'Diagnostic Center',
  diagnostic_home:     'Home Diagnostic',
  patient_transport:   'Patient Transport',
  follow_up:           'Follow-Up',
};

const CARE_STATUS_ORDER = ['active', 'on_hold', 'transferred', 'discharged'];

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0,   transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

const pulse = {
  animate: {
    scale: [1, 1.15, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRideId(booking) {
  if (!booking) return null;
  const raw = booking.primaryRide || booking.rides?.[0];
  if (!raw) return null;
  return typeof raw === 'string' ? raw : (raw._id?.toString() ?? raw.toString());
}

function canTrack(booking) {
  if (!booking) return false;
  return (
    RIDE_BOOKING_TYPES.has(booking.bookingType) &&
    !!getRideId(booking) &&
    TRACKABLE_STATUSES.has(booking.status)
  );
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Tiny Components ──────────────────────────────────────────────────────────

function Spinner({ size = 'md' }) {
  const sz = size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return <Loader2 className={`${sz} animate-spin text-primary`} />;
}

function StatusPill({ status }) {
  const cfg  = STATUS_CFG[status] || { label: status, dot: 'bg-base-300', text: 'text-base-content/50', bg: 'bg-base-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
}

function TypeChip({ type }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase tracking-wider bg-primary/10 text-primary">
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-base-content/40 mb-0.5">
      {children}
    </p>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible"
      className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-7 h-7 text-primary/40" />
      </div>
      <div>
        <p className="text-sm font-bold text-base-content/60">{title}</p>
        <p className="text-xs text-base-content/40 mt-1 max-w-xs">{sub}</p>
      </div>
    </motion.div>
  );
}

// ─── Track Ride Button ────────────────────────────────────────────────────────

function TrackButton({ booking, variant = 'compact' }) {
  const router  = useRouter();
  if (!canTrack(booking)) return null;
  const rideId  = getRideId(booking);

  function go(e) {
    e.stopPropagation();
    router.push(`/care-assistant/tracking/${booking._id}/${rideId}?type=${booking.bookingType}`);
  }

  if (variant === 'hero') {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={go}
        className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-white"
        style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold">Track Live Ride</p>
            <p className="text-xs opacity-70 mt-0.5">Real-time driver & route</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            className="w-2 h-2 rounded-full bg-white"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }} />
          <ChevronRight className="w-4 h-4 opacity-70" />
        </div>
      </motion.button>
    );
  }

  return (
    <button
      onClick={go}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors duration-150 flex-shrink-0">
      <Navigation className="w-3.5 h-3.5" />
      Track
    </button>
  );
}

// ─── Active Care Record Hero ──────────────────────────────────────────────────

function ActiveCareHero({ record }) {
  const router = useRouter();
  if (!record) return null;

  const vitals    = record.vitalsLog?.[record.vitalsLog.length - 1];
  const openAlerts = (record.careNotes || []).filter(n => n.severity === 'critical' && !n.isResolved);

  return (
    <motion.div variants={fadeUp}
      className="card overflow-hidden border-l-4 border-success">

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-success/15 flex items-center justify-center">
              <Heart className="w-6 h-6 text-success" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-success border-2 border-base-100"
              {...pulse} />
          </div>
          <div>
            <p className="text-xs font-bold text-success uppercase tracking-widest mb-1">Active Care Session</p>
            <p className="text-base font-black text-base-content">
              {record.patientName || 'Patient'}
            </p>
            <p className="text-xs text-base-content/40 mt-0.5">
              Since {fmtDate(record.assignedAt)} · {fmtTime(record.assignedAt)}
            </p>
          </div>
        </div>
        <StatusPill status={record.status} />
      </div>

      {/* Vitals strip */}
      {vitals && (
        <div className="mx-5 mb-4 p-3 rounded-xl bg-base-200 grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: 'BP',   val: vitals.bloodPressure   || '—',          unit: '' },
            { label: 'HR',   val: vitals.pulseRate        ? `${vitals.pulseRate}` : '—', unit: 'bpm' },
            { label: 'SpO₂', val: vitals.spO2            ? `${vitals.spO2}` : '—',       unit: '%' },
            { label: 'Temp', val: vitals.temperature     ? `${vitals.temperature}` : '—', unit: '°C' },
            { label: 'Sugar',val: vitals.bloodSugar      ? `${vitals.bloodSugar}` : '—',  unit: '' },
          ].map(v => (
            <div key={v.label} className="text-center">
              <p className="text-[0.6rem] font-bold uppercase tracking-wider text-base-content/40">{v.label}</p>
              <p className="text-sm font-black text-primary mt-0.5">{v.val}<span className="text-[0.6rem] font-semibold text-base-content/40 ml-0.5">{v.unit}</span></p>
            </div>
          ))}
        </div>
      )}

      {/* Open alerts */}
      {openAlerts.length > 0 && (
        <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-error/10 border border-error/20">
          <AlertTriangle className="w-4 h-4 text-error flex-shrink-0" />
          <p className="text-xs font-bold text-error">
            {openAlerts.length} critical alert{openAlerts.length > 1 ? 's' : ''} unresolved
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 pb-5 flex flex-wrap gap-2">
        <button
          onClick={() => router.push(`/care-assistant/care-record/${record._id}`)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
          <ClipboardList className="w-3.5 h-3.5" />
          View Care Record
        </button>
        <button
          onClick={() => router.push(`/care-assistant/care-record/${record._id}/vitals`)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-success/10 text-success">
          <Activity className="w-3.5 h-3.5" />
          Log Vitals
        </button>
        <button
          onClick={() => router.push(`/care-assistant/care-record/${record._id}/notes`)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-warning/10 text-warning">
          <FileText className="w-3.5 h-3.5" />
          Add Note
        </button>
      </div>
    </motion.div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }) {
  const router   = useRouter();
  const trackable = canTrack(booking);
  const rideId   = getRideId(booking);
  const scheduled = booking.scheduledAt ? new Date(booking.scheduledAt) : null;
  const patient   = booking.patientInfo?.name || booking.customer?.name || 'Patient';
  const phone     = booking.customer?.phone || booking.patientInfo?.phone || '';
  const hasCare   = !!booking.careRecord;

  return (
    <motion.div variants={fadeUp}
      className="card overflow-hidden group cursor-pointer"
      onClick={() => router.push(`/care-assistant/bookings/${booking._id}`)}>

      {/* Accent strip */}
      <div className={`h-1 w-full ${trackable ? 'bg-gradient-to-r from-primary to-secondary' : hasCare ? 'bg-success' : 'bg-base-300'}`} />

      <div className="p-4 space-y-3">

        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-base-content truncate">{patient}</p>
              {phone && (
                <p className="text-xs text-base-content/40 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {phone}
                </p>
              )}
            </div>
          </div>
          <StatusPill status={booking.status} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          <TypeChip type={booking.bookingType} />
          {booking.bookingCode && (
            <span className="text-[0.65rem] font-mono font-bold text-primary/70">{booking.bookingCode}</span>
          )}
        </div>

        {/* Schedule */}
        {scheduled && (
          <div className="flex items-center gap-2 text-xs text-base-content/50">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{fmtDate(booking.scheduledAt)} · {fmtTime(booking.scheduledAt)}</span>
          </div>
        )}

        {/* Location */}
        {booking.patientLocation?.address && (
          <div className="flex items-start gap-2 text-xs text-base-content/50">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-1">{booking.patientLocation.address}</span>
          </div>
        )}

        {/* Care record link */}
        {hasCare && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10">
            <Activity className="w-3.5 h-3.5 text-success flex-shrink-0" />
            <p className="text-xs font-bold text-success">Care Record Active</p>
            <span className="ml-auto text-[0.6rem] font-semibold text-success/70 uppercase tracking-wider">
              {booking.careRecord.status}
            </span>
          </div>
        )}

        {/* Track hero button — prominent if trackable */}
        {trackable && (
          <TrackButton booking={booking} variant="hero" />
        )}

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-1 border-t border-base-300/60">
          <span className="text-[0.65rem] text-base-content/30">
            {fmtRelative(booking.updatedAt || booking.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            {!trackable && rideId && (
              <span className="text-[0.65rem] font-mono text-base-content/30 bg-base-200 px-2 py-0.5 rounded">
                Ride #{rideId.slice(-6)}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); router.push(`/care-assistant/bookings/${booking._id}`); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-base-200 text-base-content/60 hover:bg-primary/10 hover:text-primary transition-colors duration-150">
              <Eye className="w-3.5 h-3.5" /> Details
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Care Record Row ──────────────────────────────────────────────────────────

function CareRecordRow({ record }) {
  const router     = useRouter();
  const vitals     = record.vitalsLog?.[record.vitalsLog.length - 1];
  const openAlerts = (record.careNotes || []).filter(n => n.severity === 'critical' && !n.isResolved);

  return (
    <motion.div variants={fadeUp}
      className="flex items-start gap-4 p-4 rounded-2xl bg-base-200 hover:bg-primary/5 transition-colors duration-150 cursor-pointer"
      onClick={() => router.push(`/care-assistant/care-record/${record._id}`)}>

      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Stethoscope className="w-5 h-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-base-content truncate">{record.patientName || 'Patient'}</p>
          <StatusPill status={record.status} />
          {openAlerts.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-error/10 text-error">
              <AlertTriangle className="w-3 h-3" /> {openAlerts.length} alert{openAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-base-content/40 mt-0.5">
          Since {fmtDate(record.assignedAt)} · Updated {fmtRelative(record.updatedAt)}
        </p>
        {vitals && (
          <p className="text-xs text-base-content/50 mt-1">
            Last vitals: BP {vitals.bloodPressure || '—'} · HR {vitals.pulseRate || '—'} bpm · SpO₂ {vitals.spO2 || '—'}%
          </p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-base-content/30 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
    </motion.div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ bookings, careRecords, active }) {
  const liveRides   = bookings.filter(b => canTrack(b)).length;
  const inProgress  = bookings.filter(b => b.status === 'in_progress').length;
  const activeCares = careRecords.filter(r => r.status === 'active').length;

  const stats = [
    { label: 'Active Session',  val: active ? '1' : '0', icon: Heart,         color: 'text-success' },
    { label: 'In Progress',     val: inProgress,          icon: Activity,      color: 'text-primary' },
    { label: 'Live Rides',      val: liveRides,           icon: Navigation,    color: 'text-info'    },
    { label: 'Care Records',    val: activeCares,         icon: ClipboardList, color: 'text-accent'  },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label}
          className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0">
            <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
          </div>
          <div>
            <p className="text-xl font-black text-primary leading-none">{s.val}</p>
            <p className="text-[0.65rem] font-semibold text-base-content/40 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange, tabs }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-base-200 w-fit overflow-x-auto scrollbar-thin">
      {tabs.map(t => (
        <button key={t.key}
          onClick={() => onChange(t.key)}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 relative',
            active === t.key
              ? 'bg-base-100 text-primary shadow-sm'
              : 'text-base-content/50 hover:text-base-content/80',
          ].join(' ')}>
          <t.icon className="w-4 h-4" />
          {t.label}
          {t.badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-warning text-warning-content text-[0.55rem] font-black flex items-center justify-center">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActiveBookings() {
  const dispatch = useDispatch();

  const bookings      = useSelector(selectCABookings);
  const bookingTotal  = useSelector(selectCABookingsTotal);
  const activeRecord  = useSelector(selectActiveCareRecord);
  const careRecords   = useSelector(selectCareRecords);
  const careTotal     = useSelector(selectCareRecordsTotal);

  const loadingBookings = useSelector(selectClinicalLoading('fetchCABookings'));
  const loadingActive   = useSelector(selectClinicalLoading('fetchActiveCareRecord'));
  const loadingCare     = useSelector(selectClinicalLoading('fetchCareRecords'));

  const errBookings = useSelector(selectClinicalError('fetchCABookings'));
  const errCare     = useSelector(selectClinicalError('fetchCareRecords'));

  const [tab, setTab] = useState('bookings');

  const loadAll = useCallback(() => {
    dispatch(fetchCABookings({ limit: 50, status: 'in_progress' }));
    dispatch(fetchCareRecords({ status: 'active', limit: 20 }));
    dispatch(fetchActiveCareRecord({ bookingId: undefined, patientId: undefined })).catch(() => {});
  }, [dispatch]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Bookings with active rides first
  const sortedBookings = [...bookings].sort((a, b) => {
    const aT = canTrack(a) ? 0 : 1;
    const bT = canTrack(b) ? 0 : 1;
    return aT - bT;
  });

  const liveRideCount = bookings.filter(canTrack).length;

  const tabs = [
    { key: 'bookings',   label: 'Active Bookings', icon: Activity,   badge: liveRideCount   },
    { key: 'care',       label: 'Care Records',    icon: Stethoscope, badge: 0              },
  ];

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">

      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-25"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 45% at 15% -5%, color-mix(in srgb, var(--primary), transparent 82%), transparent),
            radial-gradient(ellipse 55% 35% at 85% 110%, color-mix(in srgb, var(--secondary), transparent 86%), transparent)
          `,
        }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <BackButton className="mb-3" />
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-base-content tracking-tight">Active Bookings</h1>
                <p className="text-sm text-base-content/40 mt-0.5">Care Assistant Portal · Likeson.in</p>
              </div>
            </div>

            <button
              onClick={loadAll}
              disabled={loadingBookings || loadingActive || loadingCare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-base-200 text-base-content/60 hover:bg-primary/10 hover:text-primary transition-colors duration-150 self-start sm:self-auto">
              {(loadingBookings || loadingActive || loadingCare)
                ? <Spinner size="xs" />
                : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.06 }}>
          <StatsBar bookings={bookings} careRecords={careRecords} active={activeRecord} />
        </motion.div>

        {/* Active Care Hero */}
        <AnimatePresence>
          {loadingActive ? (
            <motion.div key="active-load" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
              className="flex justify-center py-8"><Spinner /></motion.div>
          ) : activeRecord ? (
            <motion.div key="active-record" variants={fadeUp} initial="hidden" animate="visible" exit="exit">
              <ActiveCareHero record={activeRecord} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Live ride alert banner */}
        <AnimatePresence>
          {liveRideCount > 0 && (
            <motion.div key="live-alert"
              variants={fadeUp} initial="hidden" animate="visible" exit="exit"
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20">
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
                <Radio className="w-5 h-5 text-primary" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-bold text-primary">
                  {liveRideCount} live ride{liveRideCount > 1 ? 's' : ''} trackable
                </p>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Tap "Track" on any booking below to open live map
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <TabBar active={tab} onChange={setTab} tabs={tabs} />
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">

          {/* BOOKINGS TAB */}
          {tab === 'bookings' && (
            <motion.div key="bookings-tab"
              variants={stagger} initial="hidden" animate="visible" exit="exit"
              className="space-y-4">

              {/* Error */}
              {errBookings && (
                <motion.div variants={fadeUp}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-error/10 border border-error/20">
                  <AlertTriangle className="w-4 h-4 text-error flex-shrink-0" />
                  <p className="text-sm text-error">{errBookings}</p>
                </motion.div>
              )}

              {/* Loader */}
              {loadingBookings && !bookings.length && (
                <div className="flex justify-center py-12"><Spinner /></div>
              )}

              {/* Empty */}
              {!loadingBookings && !bookings.length && !errBookings && (
                <EmptyState
                  icon={Inbox}
                  title="No active bookings"
                  sub="In-progress bookings you're assigned to will appear here." />
              )}

              {/* Cards */}
              {sortedBookings.length > 0 && (
                <>
                  {/* Live / trackable first */}
                  {sortedBookings.filter(canTrack).length > 0 && (
                    <div className="space-y-3">
                      <SectionLabel>Live Rides — Tap to Track</SectionLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedBookings.filter(canTrack).map(b => (
                          <BookingCard key={b._id} booking={b} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Non-trackable bookings */}
                  {sortedBookings.filter(b => !canTrack(b)).length > 0 && (
                    <div className="space-y-3">
                      <SectionLabel>Other Active Bookings</SectionLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedBookings.filter(b => !canTrack(b)).map(b => (
                          <BookingCard key={b._id} booking={b} />
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-center text-xs text-base-content/30 pt-2">
                    Showing {bookings.length} of {bookingTotal} in-progress bookings
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* CARE RECORDS TAB */}
          {tab === 'care' && (
            <motion.div key="care-tab"
              variants={stagger} initial="hidden" animate="visible" exit="exit"
              className="space-y-4">

              {errCare && (
                <motion.div variants={fadeUp}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-error/10 border border-error/20">
                  <AlertTriangle className="w-4 h-4 text-error flex-shrink-0" />
                  <p className="text-sm text-error">{errCare}</p>
                </motion.div>
              )}

              {loadingCare && !careRecords.length && (
                <div className="flex justify-center py-12"><Spinner /></div>
              )}

              {!loadingCare && !careRecords.length && !errCare && (
                <EmptyState
                  icon={Stethoscope}
                  title="No active care records"
                  sub="Care records for your active patients appear here." />
              )}

              {careRecords.length > 0 && (
                <div className="card p-2 space-y-1">
                  <div className="px-2 pt-2 pb-1">
                    <SectionLabel>Active Care Records — {careTotal} total</SectionLabel>
                  </div>
                  {CARE_STATUS_ORDER.flatMap(status =>
                    careRecords.filter(r => r.status === status).map(r => (
                      <CareRecordRow key={r._id} record={r} />
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}