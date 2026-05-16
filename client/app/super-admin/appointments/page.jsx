'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, User, Hospital, Filter, Search,
  ChevronLeft, ChevronRight, RefreshCw, Eye,
  AlertCircle, CheckCircle2, XCircle, Timer,
  Activity, TrendingUp, Users, Stethoscope,
  ArrowUpRight, ArrowDownRight, Minus, X,
  MapPin, Phone, Video, Home, Building2, FileText
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

import {
  fetchAppointments,
  fetchAppointmentById,
  resetAppointments,
  resetAppointmentDetail,
  selectAppointmentsData,
  selectAppointmentsLoading,
  selectAppointmentsError,
  selectAppointmentsSummary,
  selectAppointmentsList,
  selectAppointmentDetailData,
  selectAppointmentDetailLoading,
  selectAppointmentDetailBooking,
  selectAppointmentDetailOpRecord,
} from '@/store/slices/adminAnalyticsSlice';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n, decimals = 0) =>
  n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals });

const fmtCurrency = (n) =>
  n == null ? '—' : `₹${fmt(n, 2)}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_META = {
  pending:     { label: 'Pending',     color: 'warning', icon: Timer },
  confirmed:   { label: 'Confirmed',   color: 'info',    icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'primary', icon: Activity },
  completed:   { label: 'Completed',   color: 'success', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'error',   icon: XCircle },
  no_show:     { label: 'No Show',     color: 'error',   icon: AlertCircle },
};

const TYPE_META = {
  doctor_consultation: { label: 'In-Person',    icon: Building2, color: 'primary' },
  doctor_online:       { label: 'Online',        icon: Video,     color: 'info' },
  physiotherapist:     { label: 'Physio',        icon: Activity,  color: 'accent' },
  follow_up:           { label: 'Follow-up',     icon: FileText,  color: 'secondary' },
  full_care_ride:      { label: 'Full Care',     icon: Home,      color: 'success' },
};

const CHART_COLORS = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--success)', 'var(--warning)', 'var(--error)'];

// ─── sub-components ──────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon: Icon, color = 'primary', trend, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    className="stat-card group relative overflow-hidden"
  >
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{ background: `radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--${color}), transparent 92%), transparent 70%)` }}
    />
    <div className="relative z-10 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="stat-card-label truncate">{label}</p>
        <p className="stat-card-value mt-1" style={{ color: `var(--${color})` }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{sub}</p>}
        {trend != null && (
          <div className="flex items-center gap-1 mt-2">
            {trend > 0
              ? <ArrowUpRight size={12} className="text-success" />
              : trend < 0
              ? <ArrowDownRight size={12} className="text-error" />
              : <Minus size={12} className="text-base-content/40" />}
            <span className={`text-xs font-semibold ${trend > 0 ? 'text-success' : trend < 0 ? 'text-error' : 'text-base-content/40'}`}>
              {Math.abs(trend)}% vs last period
            </span>
          </div>
        )}
      </div>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, var(--${color}), transparent 87%)` }}
      >
        <Icon size={18} style={{ color: `var(--${color})` }} />
      </div>
    </div>
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, color: 'neutral', icon: AlertCircle };
  const Icon = meta.icon;
  return (
    <span className={`badge badge-${meta.color} gap-1`} style={{ fontSize: '0.65rem' }}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const meta = TYPE_META[type] || { label: type, icon: Calendar, color: 'primary' };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        background: `color-mix(in srgb, var(--${meta.color}), transparent 87%)`,
        color: `var(--${meta.color})`,
      }}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-xl border border-primary/20">
      <p className="font-bold mb-1 text-base-content">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────

const DetailDrawer = ({ id, onClose }) => {
  const dispatch = useDispatch();
  const booking  = useSelector(selectAppointmentDetailBooking);
  const opRecord = useSelector(selectAppointmentDetailOpRecord);
  const loading  = useSelector(selectAppointmentDetailLoading);

  useEffect(() => {
    if (id) dispatch(fetchAppointmentById(id));
    return () => dispatch(resetAppointmentDetail());
  }, [id, dispatch]);

  const Section = ({ title, children }) => (
    <div className="mb-5">
      <h4 className="text-xs font-bold uppercase tracking-widest mb-3 pb-1.5 border-b border-base-300"
        style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
        {title}
      </h4>
      {children}
    </div>
  );

  const Row = ({ label, value }) => (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-base-300/50 last:border-0">
      <span className="text-xs font-medium text-base-content/50 flex-shrink-0 w-36">{label}</span>
      <span className="text-xs font-semibold text-right break-words">{value ?? '—'}</span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="ml-auto relative w-full max-w-lg h-full flex flex-col"
        style={{ background: 'var(--base-100)', borderLeft: '1px solid var(--base-300)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 flex-shrink-0">
          <div>
            <p className="text-xs text-base-content/50 uppercase tracking-wider font-bold">Appointment Detail</p>
            {booking && <p className="font-bold text-sm mt-0.5">{booking.bookingCode}</p>}
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="loading loading-md" />
            </div>
          ) : booking ? (
            <>
              {/* Status row */}
              <div className="flex items-center gap-2 mb-5">
                <StatusBadge status={booking.status} />
                <TypeBadge type={booking.bookingType} />
                {booking.consultationType && (
                  <span className="badge badge-secondary badge-xs">{booking.consultationType}</span>
                )}
              </div>

              <Section title="Patient Info">
                <Row label="Name"          value={booking.patientInfo?.name} />
                <Row label="Age"           value={booking.patientInfo?.age} />
                <Row label="Customer"      value={booking.customer?.name} />
                <Row label="Phone"         value={booking.customer?.phone} />
                <Row label="Email"         value={booking.customer?.email} />
              </Section>

              <Section title="Doctor & Hospital">
                <Row label="Doctor"        value={booking.doctor?.user?.name} />
                <Row label="Specialization" value={booking.doctor?.specialization} />
                <Row label="Hospital"      value={booking.hospital?.name} />
                <Row label="City"          value={booking.hospital?.address?.city} />
                <Row label="Hospital Type" value={booking.hospital?.hospitalType} />
              </Section>

              <Section title="Schedule & Payment">
                <Row label="Scheduled"    value={`${fmtDate(booking.scheduledAt)} ${fmtTime(booking.scheduledAt)}`} />
                <Row label="Created"      value={fmtDate(booking.createdAt)} />
                <Row label="Total Amount" value={fmtCurrency(booking.fareBreakdown?.totalAmount)} />
                <Row label="Payment"      value={booking.paymentStatus} />
              </Section>

              {opRecord && (
                <Section title="OP Record">
                  <Row label="OP Number"    value={opRecord.opNumber} />
                  <Row label="Status"       value={opRecord.status} />
                  <Row label="Fee"          value={fmtCurrency(opRecord.consultationFee)} />
                  <Row label="Follow-up"    value={opRecord.isFollowUp ? 'Yes' : 'No'} />
                  {opRecord.followUpExpiry && (
                    <Row label="Expiry"     value={fmtDate(opRecord.followUpExpiry)} />
                  )}
                </Section>
              )}

              {booking.careAssistant && (
                <Section title="Care Assistant">
                  <Row label="Name"  value={booking.careAssistant?.fullName} />
                  <Row label="Phone" value={booking.careAssistant?.phone} />
                </Section>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-base-content/40">
              <p className="text-sm">No data found</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const dispatch = useDispatch();
  const data     = useSelector(selectAppointmentsData);
  const loading  = useSelector(selectAppointmentsLoading);
  const error    = useSelector(selectAppointmentsError);
  const summary  = useSelector(selectAppointmentsSummary);
  const listObj  = useSelector(selectAppointmentsList);

  const [filters, setFilters]   = useState({ from: '', to: '', status: '', bookingType: '', page: 1 });
  const [search, setSearch]     = useState('');
  const [drawerId, setDrawerId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    const params = {};
    if (filters.from)        params.from = filters.from;
    if (filters.to)          params.to   = filters.to;
    if (filters.status)      params.status = filters.status;
    if (filters.bookingType) params.bookingType = filters.bookingType;
    params.page = filters.page;
    dispatch(fetchAppointments(params));
  }, [filters, dispatch]);

  useEffect(() => { load(); return () => dispatch(resetAppointments()); }, [load]);

  const appointments = listObj?.data ?? [];
  const pagination   = listObj?.pagination ?? {};

  // Build OP stats chart data
  const opChartData = (summary?.opRecordStats ?? []).map(s => ({
    name: s._id ?? 'Unknown',
    count: s.count,
    avgFee: Math.round(s.avgFee ?? 0),
  }));

  // Status distribution for pie
  const statusDistribution = Object.entries(
    appointments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: STATUS_META[k]?.label ?? k, value: v }));

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }));

  const filteredAppts = search
    ? appointments.filter(a =>
        a.bookingCode?.toLowerCase().includes(search.toLowerCase()) ||
        a.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.hospital?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : appointments;

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-200)' }}>
      {/* Drawer */}
      <AnimatePresence>
        {drawerId && <DetailDrawer id={drawerId} onClose={() => setDrawerId(null)} />}
      </AnimatePresence>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-heading !mb-1">Appointments</h1>
            <p className="section-subheading !mb-0">Monitor, filter & inspect all appointment bookings</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(s => !s)}
              className={`btn btn-sm gap-2 ${showFilters ? 'btn-primary' : 'btn-outline'}`}>
              <Filter size={14} />
              Filters
            </button>
            <button onClick={load} className="btn btn-sm btn-ghost" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </motion.div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* ── Filters ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label-text mb-1 block text-xs">From</label>
                  <input type="date" className="input-field text-xs py-1.5"
                    value={filters.from} onChange={e => setFilter('from', e.target.value)} />
                </div>
                <div>
                  <label className="label-text mb-1 block text-xs">To</label>
                  <input type="date" className="input-field text-xs py-1.5"
                    value={filters.to} onChange={e => setFilter('to', e.target.value)} />
                </div>
                <div>
                  <label className="label-text mb-1 block text-xs">Status</label>
                  <select className="input-field text-xs py-1.5"
                    value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text mb-1 block text-xs">Type</label>
                  <select className="input-field text-xs py-1.5"
                    value={filters.bookingType} onChange={e => setFilter('bookingType', e.target.value)}>
                    <option value="">All Types</option>
                    {Object.entries(TYPE_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Appointments" value={fmt(summary?.total)}       icon={Calendar}     color="primary"   delay={0}    trend={null} />
          <StatCard label="Upcoming (7 days)"  value={fmt(summary?.upcoming)}    icon={Clock}        color="info"      delay={0.05} />
          <StatCard label="No-Shows"           value={fmt(summary?.noShow)}      icon={AlertCircle}  color="error"     delay={0.1}  />
          <StatCard label="Cancellation Rate"  value={`${summary?.cancellationRate ?? 0}%`} icon={TrendingUp} color="warning" delay={0.15} />
        </div>

        {/* ── Charts Row ── */}
        {opChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* OP Record Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }} className="card p-5 lg:col-span-2">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Activity size={14} style={{ color: 'var(--primary)' }} />
                OP Record Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={opChartData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgFee" name="Avg Fee (₹)" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Status Pie */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }} className="card p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                Status Breakdown
              </h3>
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusDistribution} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      paddingAngle={3} dataKey="value">
                      {statusDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">No data</div>
              )}
            </motion.div>
          </div>
        )}

        {/* ── Table ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }} className="card overflow-hidden">

          {/* Table Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users size={14} style={{ color: 'var(--primary)' }} />
              Appointment Records
              {pagination.total != null && (
                <span className="badge badge-primary badge-xs ml-1">{fmt(pagination.total)} total</span>
              )}
            </h3>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                className="input-field pl-8 text-xs py-1.5 w-56"
                placeholder="Search booking, patient, hospital…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="loading loading-lg" />
              </div>
            ) : filteredAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
                <Calendar size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No appointments found</p>
              </div>
            ) : (
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Booking Code</th>
                    <th>Type</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Hospital</th>
                    <th>Scheduled</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredAppts.map((appt, i) => (
                      <motion.tr key={appt._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="cursor-pointer"
                        onClick={() => setDrawerId(appt._id)}
                      >
                        <td>
                          <span className="font-mono text-xs font-bold" style={{ color: 'var(--primary)' }}>
                            {appt.bookingCode}
                          </span>
                        </td>
                        <td><TypeBadge type={appt.bookingType} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)', color: 'var(--primary)' }}>
                              {(appt.patientInfo?.name || appt.customer?.name || '?')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold leading-tight">{appt.patientInfo?.name || appt.customer?.name || '—'}</p>
                              {appt.customer?.phone && (
                                <p className="text-xs text-base-content/40 flex items-center gap-0.5">
                                  <Phone size={9} /> {appt.customer.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-xs font-semibold">{appt.doctor?.user?.name || '—'}</p>
                          <p className="text-xs text-base-content/40">{appt.doctor?.specialization}</p>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <MapPin size={10} className="text-base-content/30 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium leading-tight">{appt.hospital?.name || '—'}</p>
                              <p className="text-xs text-base-content/40">{appt.hospital?.address?.city}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-xs font-semibold">{fmtDate(appt.scheduledAt)}</p>
                          <p className="text-xs text-base-content/40">{fmtTime(appt.scheduledAt)}</p>
                        </td>
                        <td>
                          <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>
                            {fmtCurrency(appt.fareBreakdown?.totalAmount)}
                          </span>
                        </td>
                        <td><StatusBadge status={appt.status} /></td>
                        <td>
                          <button className="btn btn-ghost btn-xs btn-circle"
                            onClick={e => { e.stopPropagation(); setDrawerId(appt._id); }}>
                            <Eye size={13} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
              <p className="text-xs text-base-content/50">
                Page {pagination.page} of {pagination.pages} · {fmt(pagination.total)} records
              </p>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost btn-xs btn-circle"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>
                  <ChevronLeft size={13} />
                </button>
                <span className="text-xs font-bold px-2">{filters.page}</span>
                <button className="btn btn-ghost btn-xs btn-circle"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}