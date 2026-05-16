'use client';

/**
 * AppointmentsManagement.jsx
 * Likeson.in — Doctor Dashboard
 *
 * Covers:
 *  - Fetch & display all doctor appointments (fetchDoctorAppointments)
 *  - Fetch OP records (fetchOPRecords)
 *  - Stats cards with Recharts mini-chart
 *  - Filters: status, consultationType, date range
 *  - Per-row actions: View OP, Write / View Prescription → links to EPrescription page
 *  - Completes OP (completeOPRecord)
 *  - Framer Motion staggered list
 *  - Fully typed with doctor CSS theme
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import {
  Calendar, Clock, User, ChevronRight, ChevronLeft,
  FileText, Stethoscope, Video, Home, Search, Filter,
  CheckCircle2, AlertCircle, XCircle, Clock3, RefreshCw,
  Plus, Download, Eye, TrendingUp, Activity, Users,
  ArrowUpRight, CalendarDays, MoreVertical, Layers,
  ClipboardList, PenLine, BadgeCheck, PhoneCall,
} from 'lucide-react';

import {
  fetchDoctorAppointments,
  fetchOPRecords,
  completeOPRecord,
  selectDoctorAppointments,
  selectDoctorAppointmentsTotal,
  selectOPRecords,
  selectClinicalLoading,
  selectClinicalError,
} from '@/store/slices/clinicalSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: '',           label: 'All Status',   color: 'var(--base-content)' },
  { value: 'pending',    label: 'Pending',       color: 'var(--warning)'      },
  { value: 'confirmed',  label: 'Confirmed',     color: 'var(--info)'         },
  { value: 'in_progress',label: 'In Progress',   color: 'var(--primary)'      },
  { value: 'completed',  label: 'Completed',     color: 'var(--success)'      },
  { value: 'cancelled',  label: 'Cancelled',     color: 'var(--error)'        },
  { value: 'no_show',    label: 'No Show',       color: 'var(--error)'        },
];

const CONSULT_TYPES = [
  { value: '',          label: 'All Types' },
  { value: 'inPerson',  label: 'In Person' },
  { value: 'video',     label: 'Video'     },
  { value: 'homeVisit', label: 'Home Visit'},
];

const BOOKING_TYPE_LABEL = {
  full_care_ride:    'Full Care Ride',
  doctor_consultation:'Consultation',
  doctor_online:     'Online',
  physiotherapist:   'Physio',
  follow_up:         'Follow-up',
};

const PAGE_LIMIT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig = (status) => {
  const map = {
    pending:     { label: 'Pending',     bg: 'bg-warning/10',  text: 'text-warning',  Icon: Clock3        },
    confirmed:   { label: 'Confirmed',   bg: 'bg-info/10',     text: 'text-info',     Icon: BadgeCheck    },
    in_progress: { label: 'In Progress', bg: 'bg-primary/10',  text: 'text-primary',  Icon: Activity      },
    completed:   { label: 'Completed',   bg: 'bg-success/10',  text: 'text-success',  Icon: CheckCircle2  },
    cancelled:   { label: 'Cancelled',   bg: 'bg-error/10',    text: 'text-error',    Icon: XCircle       },
    no_show:     { label: 'No Show',     bg: 'bg-error/10',    text: 'text-error',    Icon: AlertCircle   },
  };
  return map[status] || { label: status, bg: 'bg-base-200', text: 'text-base-content', Icon: Clock3 };
};

const consultIcon = (type) => {
  if (type === 'video')     return <Video    size={14} />;
  if (type === 'homeVisit') return <Home     size={14} />;
  return <Stethoscope size={14} />;
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const formatShortDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// Build mini weekly chart data from appointments array
const buildChartData = (appointments) => {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { date: formatShortDate(d), count: 0, key: d.toDateString() };
  });
  appointments.forEach((a) => {
    const k = new Date(a.scheduledAt).toDateString();
    const slot = days.find((d) => d.key === k);
    if (slot) slot.count += 1;
  });
  return days;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color, chartData }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="stat-card relative overflow-hidden flex flex-col gap-3 p-5 rounded-2xl border border-base-300 bg-base-100"
    style={{ borderTop: `3px solid ${color}` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-1">{label}</p>
        <p className="text-3xl font-black font-montserrat" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
      </div>
      <div className="p-2 rounded-xl" style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
    {chartData && (
      <div className="h-12 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2}
              fill={`url(#grad-${label})`} dot={false} />
            <Tooltip
              contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'var(--base-content)' }}
              itemStyle={{ color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const { label, bg, text, Icon } = statusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${bg} ${text}`}>
      <Icon size={10} />
      {label}
    </span>
  );
};

const ActionMenu = ({ booking, opRecord, onComplete, router }) => {
  const [open, setOpen] = useState(false);
  const canComplete = booking.status === 'in_progress' || booking.status === 'confirmed';
  const hasPrescription = !!booking._id;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="btn btn-ghost btn-xs btn-circle"
        title="Actions"
      >
        <MoreVertical size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-20 w-52 bg-base-100 border border-base-300 rounded-xl shadow-depth py-1 overflow-hidden"
            >
              {/* View Booking Detail */}
              <button
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-primary/5 text-base-content transition-colors"
                onClick={() => { setOpen(false); router.push(`/doctor/appointments/${booking._id}`); }}
              >
                <Eye size={14} className="text-primary" /> View Details
              </button>

              {/* Write / View Prescription */}
              <button
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-primary/5 text-base-content transition-colors"
                onClick={() => { setOpen(false); router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`); }}
              >
                <PenLine size={14} className="text-accent" /> Write Prescription
              </button>

              {/* View existing prescriptions */}
              <button
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-primary/5 text-base-content transition-colors"
                onClick={() => { setOpen(false); router.push(`/doctor/prescriptions?bookingId=${booking._id}`); }}
              >
                <ClipboardList size={14} className="text-secondary" /> View Prescriptions
              </button>

              {/* View OP Record if exists */}
              {opRecord && (
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-primary/5 text-base-content transition-colors"
                  onClick={() => { setOpen(false); router.push(`/doctor/op-records/${opRecord._id}`); }}
                >
                  <FileText size={14} className="text-info" /> OP Record
                </button>
              )}

              {/* Complete Consultation */}
              {canComplete && (
                <>
                  <div className="h-px bg-base-300 mx-3 my-1" />
                  <button
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-success/5 text-success transition-colors"
                    onClick={() => { setOpen(false); onComplete(booking._id, opRecord?._id); }}
                  >
                    <CheckCircle2 size={14} /> Mark Complete
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Complete Modal ───────────────────────────────────────────────────────────

const CompleteModal = ({ open, onClose, onSubmit, loading }) => {
  const [notes, setNotes] = useState('');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    onSubmit({ doctorNotes: notes, diagnosisCode: code, reasonForVisit: reason });
    setNotes(''); setCode(''); setReason('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="bg-base-100 border border-base-300 rounded-2xl shadow-depth-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-success/10">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div>
                <h3 className="font-bold text-base-content text-lg font-montserrat">Complete Consultation</h3>
                <p className="text-xs text-base-content/50">Fill in clinical summary</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Reason for Visit</label>
                <input
                  className="input-field"
                  placeholder="Chief complaints / reason..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">ICD-10 Diagnosis Code <span className="text-base-content/30 font-normal">(optional)</span></label>
                <input
                  className="input-field font-mono"
                  placeholder="e.g. J06.9"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">Doctor Notes</label>
                <textarea
                  className="input-field min-h-[96px] resize-none"
                  placeholder="Clinical findings, advice, observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="btn btn-success flex-1 gap-2"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-xs loading-spinner" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppointmentsManagement() {
  const dispatch = useDispatch();
  const router   = useRouter();

  // Redux state
  const appointments   = useSelector(selectDoctorAppointments);
  const total          = useSelector(selectDoctorAppointmentsTotal);
  const opRecords      = useSelector(selectOPRecords);
  const loadingAppts   = useSelector(selectClinicalLoading('fetchDoctorAppointments'));
  const loadingOP      = useSelector(selectClinicalLoading('completeOPRecord'));
  const error          = useSelector(selectClinicalError('fetchDoctorAppointments'));

  // Local state — filters
  const [status,   setStatus]   = useState('');
  const [consType, setConsType] = useState('');
  const [search,   setSearch]   = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [page,     setPage]     = useState(1);

  // Complete modal
  const [completeTarget, setCompleteTarget] = useState(null); // { bookingId, opId }
  const [showComplete,   setShowComplete]   = useState(false);

  // Fetch
  const fetchData = useCallback(() => {
    dispatch(fetchDoctorAppointments({
      status:  status  || undefined,
      from:    from    || undefined,
      to:      to      || undefined,
      page,
      limit: PAGE_LIMIT,
    }));
    dispatch(fetchOPRecords({ page: 1, limit: 100 }));
  }, [dispatch, status, from, to, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [status, consType, from, to, search]);

  // Derived — OP record map keyed by booking id
  const opByBooking = useMemo(() => {
    const map = {};
    opRecords.forEach((op) => {
      if (op.booking) map[op.booking.toString()] = op;
    });
    return map;
  }, [opRecords]);

  // Client-side search + consultationType filter
  const filtered = useMemo(() => {
    let list = appointments;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.patientInfo?.name?.toLowerCase().includes(q) ||
          a.bookingCode?.toLowerCase().includes(q) ||
          a.patientInfo?.phone?.includes(q)
      );
    }
    if (consType) {
      list = list.filter((a) => a.consultationType === consType);
    }
    return list;
  }, [appointments, search, consType]);

  // Stats
  const stats = useMemo(() => {
    const all = appointments;
    return {
      total:      total,
      completed:  all.filter((a) => a.status === 'completed').length,
      today:      all.filter((a) => {
        const d = new Date(a.scheduledAt);
        const n = new Date();
        return d.toDateString() === n.toDateString();
      }).length,
      pending:    all.filter((a) => ['pending', 'confirmed'].includes(a.status)).length,
    };
  }, [appointments, total]);

  const chartData = useMemo(() => buildChartData(appointments), [appointments]);

  // Pagination
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  // Complete action
  const handleCompleteClick = (bookingId, opId) => {
    setCompleteTarget({ bookingId, opId });
    setShowComplete(true);
  };

  const handleCompleteSubmit = async (body) => {
    if (!completeTarget?.opId) return;
    await dispatch(completeOPRecord({ id: completeTarget.opId, ...body }));
    setShowComplete(false);
    fetchData();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme="doctor"
      className="min-h-screen bg-base-100 text-base-content"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <CalendarDays size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black font-montserrat text-base-content leading-tight">
                Appointments
              </h1>
              <p className="text-xs text-base-content/40">
                {total} total · Doctor Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loadingAppts}
              className="btn btn-ghost btn-sm gap-1.5"
            >
              <RefreshCw size={14} className={loadingAppts ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/doctor/prescriptions/new')}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Plus size={14} />
              New Prescription
            </button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Layers} label="Total Appointments" value={stats.total}
            color="var(--primary)" sub="All time" chartData={chartData}
          />
          <StatCard
            icon={CalendarDays} label="Today" value={stats.today}
            color="var(--info)" sub="Scheduled today"
          />
          <StatCard
            icon={CheckCircle2} label="Completed" value={stats.completed}
            color="var(--success)" sub="This fetch"
          />
          <StatCard
            icon={Clock3} label="Pending" value={stats.pending}
            color="var(--warning)" sub="Awaiting"
          />
        </div>

        {/* Filters Bar */}
        <div className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              className="input-field pl-9 text-sm"
              placeholder="Search patient, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  status === s.value
                    ? 'border-primary bg-primary text-primary-content'
                    : 'border-base-300 text-base-content/60 hover:border-primary/40 hover:text-base-content'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            className="input-field text-sm w-auto min-w-[130px]"
            value={consType}
            onChange={(e) => setConsType(e.target.value)}
          >
            {CONSULT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex flex-col md:flex-row items-center gap-1.5">
            <input
              type="date"
              className="input-field text-sm w-auto"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-base-content/30 text-sm">→</span>
            <input
              type="date"
              className="input-field text-sm w-auto"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {(status || consType || from || to || search) && (
            <button
              className="btn btn-ghost btn-sm text-error gap-1"
              onClick={() => { setStatus(''); setConsType(''); setFrom(''); setTo(''); setSearch(''); }}
            >
              <XCircle size={13} /> Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Booking</th>
                  <th>Type</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>OP Record</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingAppts && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="loading loading-md loading-spinner" />
                        <span className="text-sm text-base-content/40">Loading appointments...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loadingAppts && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-base-content/40">
                        <CalendarDays size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">No appointments found</p>
                        <p className="text-xs">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
                <AnimatePresence mode="popLayout">
                  {!loadingAppts && filtered.map((booking, i) => {
                    const op = opByBooking[booking._id?.toString()];
                    return (
                      <motion.tr
                        key={booking._id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-primary/5 cursor-default group"
                      >
                        {/* Patient */}
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="avatar placeholder">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm">
                                <span>{booking.patientInfo?.name?.[0] || '?'}</span>
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-base-content leading-tight">
                                {booking.patientInfo?.name || '—'}
                              </p>
                              <p className="text-xs text-base-content/40">
                                {booking.patientInfo?.phone || booking.customer?.phone || '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Booking code */}
                        <td>
                          <div>
                            <p className="font-mono text-xs font-bold text-primary">
                              {booking.bookingCode || '—'}
                            </p>
                            <p className="text-xs text-base-content/40">
                              {BOOKING_TYPE_LABEL[booking.bookingType] || booking.bookingType}
                            </p>
                          </div>
                        </td>

                        {/* Type */}
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-base-content/60">
                            {consultIcon(booking.consultationType)}
                            {booking.consultationType || '—'}
                          </span>
                        </td>

                        {/* Scheduled */}
                        <td>
                          <p className="text-sm text-base-content">{formatDate(booking.scheduledAt)}</p>
                        </td>

                        {/* Status */}
                        <td><StatusBadge status={booking.status} /></td>

                        {/* Payment */}
                        <td>
                          <span className={`text-xs font-semibold ${
                            booking.paymentStatus === 'paid' ? 'text-success' :
                            booking.paymentStatus === 'unpaid' ? 'text-error' : 'text-warning'
                          }`}>
                            {booking.paymentStatus || '—'}
                          </span>
                        </td>

                        {/* OP Record */}
                        <td>
                          {op ? (
                            <button
                              onClick={() => router.push(`/doctor/op-records/${op._id}`)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <FileText size={11} />
                              {op.opNumber || 'View'}
                            </button>
                          ) : (
                            <span className="text-xs text-base-content/30">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Quick: Write Prescription */}
                            <button
                              title="Write Prescription"
                              className="btn btn-ghost btn-xs gap-1 text-accent hover:bg-accent/10"
                              onClick={() =>
                                router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)
                              }
                            >
                              <PenLine size={13} />
                              <span className="hidden lg:inline text-xs">Prescribe</span>
                            </button>

                            {/* More actions */}
                            <ActionMenu
                              booking={booking}
                              opRecord={op}
                              onComplete={handleCompleteClick}
                              router={router}
                            />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-base-300">
            {loadingAppts && (
              <div className="py-16 flex justify-center">
                <span className="loading loading-md loading-spinner" />
              </div>
            )}
            <AnimatePresence>
              {!loadingAppts && filtered.map((booking, i) => {
                const op = opByBooking[booking._id?.toString()];
                return (
                  <motion.div
                    key={booking._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                    exit={{ opacity: 0 }}
                    className="p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="avatar placeholder">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold">
                            <span>{booking.patientInfo?.name?.[0] || '?'}</span>
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-base-content text-sm">{booking.patientInfo?.name}</p>
                          <p className="text-xs text-base-content/40">{booking.bookingCode}</p>
                        </div>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-base-content/40 font-semibold uppercase tracking-wide mb-0.5">Scheduled</p>
                        <p className="text-base-content">{formatDate(booking.scheduledAt)}</p>
                      </div>
                      <div>
                        <p className="text-base-content/40 font-semibold uppercase tracking-wide mb-0.5">Type</p>
                        <p className="flex items-center gap-1">{consultIcon(booking.consultationType)} {booking.consultationType || '—'}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary btn-sm flex-1 gap-1 text-xs"
                        onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
                      >
                        <PenLine size={12} /> Prescribe
                      </button>
                      {op && (
                        <button
                          className="btn btn-outline btn-sm gap-1 text-xs"
                          onClick={() => router.push(`/doctor/op-records/${op._id}`)}
                        >
                          <FileText size={12} /> OP
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-base-300 px-6 py-4 flex items-center justify-between">
              <p className="text-sm text-base-content/50">
                Page {page} of {totalPages} · {total} appointments
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={n}
                      className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Complete Modal */}
      <CompleteModal
        open={showComplete}
        onClose={() => setShowComplete(false)}
        onSubmit={handleCompleteSubmit}
        loading={loadingOP}
      />
    </div>
  );
}