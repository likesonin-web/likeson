'use client';

import { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, ComposedChart,
} from 'recharts';
import {
  CalendarCheck, TrendingUp, IndianRupee, Users,
  Building2, Stethoscope, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, Filter, ChevronLeft,
  ChevronRight, Eye, Clock, CheckCircle2, XCircle,
  CreditCard, Banknote, Smartphone, FileText,
  BarChart2, Activity, Search, Download,
} from 'lucide-react';

import {
  fetchBookings,
  resetBookings,
  selectBookings,
  selectBookingsData,
  selectBookingsLoading,
  selectBookingsError,
  selectBookingsSummary,
  selectBookingsCharts,
  selectTopDoctors,
  selectTopHospitals,
  selectBookingsList,
} from '@/store/slices/adminAnalyticsSlice';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n ?? 0);

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_META = {
  completed:   { color: 'text-success',  bg: 'bg-success/10',  border: 'border-success/30',  icon: CheckCircle2, label: 'Completed' },
  confirmed:   { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: CalendarCheck, label: 'Confirmed' },
  pending:     { color: 'text-warning',  bg: 'bg-warning/10',  border: 'border-warning/30',  icon: Clock,        label: 'Pending'   },
  cancelled:   { color: 'text-error',    bg: 'bg-error/10',    border: 'border-error/30',    icon: XCircle,      label: 'Cancelled' },
  no_show:     { color: 'text-error',    bg: 'bg-error/10',    border: 'border-error/30',    icon: XCircle,      label: 'No Show'   },
  in_progress: { color: 'text-info',     bg: 'bg-info/10',     border: 'border-info/30',     icon: Activity,     label: 'In Progress' },
};

const PAYMENT_META = {
  paid:    { color: 'text-success', bg: 'bg-success/10', label: 'Paid'    },
  unpaid:  { color: 'text-error',   bg: 'bg-error/10',   label: 'Unpaid'  },
  pending: { color: 'text-warning', bg: 'bg-warning/10', label: 'Pending' },
  refunded:{ color: 'text-info',    bg: 'bg-info/10',    label: 'Refunded'},
};

const TYPE_COLORS = [
  'var(--primary)', '#3b82f6', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

// ─── Animation variants ───────────────────────────────────────────────────────

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const cardAnim  = { hidden: { opacity: 0, y: 20, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };
const fadeUp    = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// ─── Reusable components ──────────────────────────────────────────────────────

const Skeleton = ({ className = '' }) => <div className={`skeleton rounded-lg animate-pulse bg-base-300 ${className}`} />;

const SectionHeader = ({ title, subtitle }) => (
  <motion.div variants={fadeUp} className="mb-5">
    <h2 className="text-lg font-extrabold font-montserrat text-base-content tracking-tight">{title}</h2>
    {subtitle && <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>}
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl shadow-depth-lg p-3 text-xs min-w-[140px]">
      <p className="font-bold text-base-content/60 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-semibold">{p.name}</span>
          <span className="font-bold text-base-content">
            {p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('fare')
              ? fmtCurrency(p.value)
              : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] ?? { color: 'text-base-content/50', bg: 'bg-base-300', border: 'border-base-300', label: status };
  const Icon = meta.icon ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.color} ${meta.bg} ${meta.border}`}>
      <Icon size={9} />
      {meta.label}
    </span>
  );
};

const PaymentBadge = ({ status }) => {
  const meta = PAYMENT_META[status] ?? { color: 'text-base-content/50', bg: 'bg-base-300', label: status };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.color} ${meta.bg}`}>
      {meta.label}
    </span>
  );
};

// ─── Summary Stat Card ────────────────────────────────────────────────────────

const SummaryCard = ({ icon: Icon, label, value, sub, gradient, loading }) => (
  <motion.div variants={cardAnim} className="relative overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm hover:shadow-depth hover:-translate-y-1 transition-all duration-300">
    <div className={`absolute top-0 left-0 right-0 h-0.5 ${gradient}`} />
    <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-5 blur-2xl ${gradient}`} />
    <div className="relative p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${gradient} shadow-sm`}>
        <Icon size={18} color="white" />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24 mb-1.5" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <p className="text-2xl font-black font-montserrat text-base-content">{value}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-base-content/30 mt-1">{sub}</p>}
        </>
      )}
    </div>
  </motion.div>
);

// ─── Filters bar ─────────────────────────────────────────────────────────────

const QUICK_RANGES = [
  { label: '7D',  days: 7   },
  { label: '30D', days: 30  },
  { label: '90D', days: 90  },
  { label: '1Y',  days: 365 },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function BookingAnalysis() {
  const dispatch  = useDispatch();
  const loading   = useSelector(selectBookingsLoading);
  const error     = useSelector(selectBookingsError);
  const summary   = useSelector(selectBookingsSummary);
  const charts    = useSelector(selectBookingsCharts);
  const topDocs   = useSelector(selectTopDoctors);
  const topHosps  = useSelector(selectTopHospitals);
  const listData  = useSelector(selectBookingsList);

  const [range, setRange]     = useState(30);
  const [page,  setPage]      = useState(1);
  const [search, setSearch]   = useState('');
  const [activeTab, setTab]   = useState('volume'); // volume | revenue

  const from = new Date(Date.now() - range * 86400_000).toISOString().split('T')[0];
  const to   = new Date().toISOString().split('T')[0];

  const load = useCallback(() => {
    dispatch(fetchBookings({ from, to, page, limit: 15 }));
  }, [dispatch, from, to, page]);

  useEffect(() => { load(); return () => dispatch(resetBookings()); }, [load]);

  const pagination = listData?.pagination ?? {};
  const rows       = listData?.data ?? [];

  // ── Derived chart data ────────────────────────────────────────────────────

  const dailyVolume  = charts?.dailyVolume ?? [];
  const byType       = summary?.byType     ?? [];
  const byStatus     = summary?.byStatus   ?? [];
  const byPayment    = summary?.byPaymentStatus ?? [];

  const filteredRows = search
    ? rows.filter(r =>
        r.bookingCode?.toLowerCase().includes(search.toLowerCase()) ||
        r.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-200 p-3">

      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-base-content/40">Analytics</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-montserrat text-base-content tracking-tight">
            Booking Analysis
          </h1>
          <p className="text-sm text-base-content/50 mt-1">
            Detailed booking breakdown • {fmtDate(from)} → {fmtDate(to)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* quick range */}
          <div className="flex items-center bg-base-100 border border-base-300 rounded-xl p-1 gap-1">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => { setRange(r.days); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                  range === r.days
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-base-content/50 hover:text-base-content hover:bg-base-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="btn btn-sm btn-outline flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="alert alert-error mb-6"
          >
            <AlertCircle size={15} />
            <span className="text-sm font-semibold">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={container} initial="hidden" animate="visible" className="space-y-8">

        {/* ── §1 SUMMARY CARDS ── */}
        <section>
          <SectionHeader title="Period Summary" subtitle="Aggregated booking metrics for selected range" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={CalendarCheck}
              label="Total Bookings"
              value={fmt(pagination.total)}
              sub={`Across all types`}
              gradient="bg-gradient-to-br from-primary to-secondary"
              loading={loading}
            />
            <SummaryCard
              icon={IndianRupee}
              label="Total Revenue"
              value={fmtCurrency(summary?.totalRevenue)}
              sub={`Paid bookings only`}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
              loading={loading}
            />
            <SummaryCard
              icon={BarChart2}
              label="Avg. Fare"
              value={fmtCurrency(summary?.avgFare)}
              sub="Per paid booking"
              gradient="bg-gradient-to-br from-violet-500 to-purple-600"
              loading={loading}
            />
            <SummaryCard
              icon={Activity}
              label="Booking Types"
              value={fmt(byType.length)}
              sub="Distinct types found"
              gradient="bg-gradient-to-br from-amber-500 to-orange-500"
              loading={loading}
            />
          </div>
        </section>

        {/* ── §2 DAILY VOLUME CHART ── */}
        <section>
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h3 className="text-sm font-bold font-montserrat text-base-content">Daily Booking Volume & Revenue</h3>
                <p className="text-xs text-base-content/40">Day-by-day trend for selected period</p>
              </div>
              {/* tab toggle */}
              <div className="flex items-center bg-base-200 border border-base-300 rounded-xl p-1 gap-1 self-start">
                {['volume', 'revenue'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all duration-200 ${
                      activeTab === t
                        ? 'bg-primary text-primary-content shadow-sm'
                        : 'text-base-content/50 hover:text-base-content'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : dailyVolume.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-base-content/30">No data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={dailyVolume} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis
                    dataKey="_id"
                    tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => v?.slice(5)} // MM-DD
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmt}
                  />
                  {activeTab === 'revenue' && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `₹${fmt(v)}`}
                    />
                  )}
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(v) => <span style={{ color: 'var(--base-content)', opacity: 0.7, fontWeight: 600 }}>{v}</span>}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    name="Bookings"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#volGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 0 }}
                  />
                  {activeTab === 'revenue' && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: '#22c55e', strokeWidth: 0 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </section>

        {/* ── §3 BREAKDOWN CHARTS ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* By Type */}
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <h3 className="text-sm font-bold font-montserrat text-base-content mb-1">By Booking Type</h3>
            <p className="text-xs text-base-content/40 mb-4">Count distribution</p>
            {loading ? <Skeleton className="h-52 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={byType}
                      dataKey="count"
                      nameKey="_id"
                      cx="50%" cy="50%"
                      outerRadius={60}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {byType.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {byType.slice(0, 5).map((t, i) => {
                    const total = byType.reduce((s, x) => s + x.count, 0);
                    const share = total > 0 ? ((t.count / total) * 100).toFixed(0) : 0;
                    return (
                      <div key={t._id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                        <span className="text-xs text-base-content/60 truncate flex-1">{t._id?.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold text-base-content">{share}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* By Status */}
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <h3 className="text-sm font-bold font-montserrat text-base-content mb-1">By Status</h3>
            <p className="text-xs text-base-content/40 mb-4">Booking lifecycle</p>
            {loading ? <Skeleton className="h-52 w-full" /> : (
              <div className="space-y-2.5">
                {byStatus.map((s) => {
                  const total = byStatus.reduce((sum, x) => sum + x.count, 0);
                  const share = total > 0 ? ((s.count / total) * 100).toFixed(1) : 0;
                  const meta  = STATUS_META[s._id] ?? { color: 'text-base-content/50', bg: 'bg-base-300' };
                  return (
                    <div key={s._id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-semibold capitalize ${meta.color}`}>{s._id?.replace(/_/g, ' ')}</span>
                        <span className="font-bold text-base-content">{fmt(s.count)} <span className="text-base-content/40">({share}%)</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-base-300 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${share}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className={`h-full rounded-full ${meta.bg}`}
                          style={{ background: meta.color?.includes('success') ? 'var(--success)'
                            : meta.color?.includes('error') ? 'var(--error)'
                            : meta.color?.includes('warning') ? 'var(--warning)'
                            : meta.color?.includes('info') ? 'var(--info)'
                            : 'var(--primary)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* By Payment Status */}
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <h3 className="text-sm font-bold font-montserrat text-base-content mb-1">By Payment</h3>
            <p className="text-xs text-base-content/40 mb-4">Payment status split</p>
            {loading ? <Skeleton className="h-52 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={byPayment} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="_id" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Bookings" radius={[4, 4, 0, 0]}>
                      {byPayment.map((p, i) => (
                        <Cell
                          key={i}
                          fill={
                            p._id === 'paid'    ? 'var(--success)'
                            : p._id === 'unpaid'  ? 'var(--error)'
                            : p._id === 'pending' ? 'var(--warning)'
                            : 'var(--info)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {byPayment.map((p) => {
                    const meta = PAYMENT_META[p._id] ?? { color: 'text-base-content/50', bg: 'bg-base-300', label: p._id };
                    return (
                      <div key={p._id} className={`rounded-lg ${meta.bg} p-2 text-center`}>
                        <p className={`text-sm font-black font-montserrat ${meta.color}`}>{fmt(p.count)}</p>
                        <p className="text-[10px] text-base-content/40 font-semibold uppercase">{meta.label}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </section>

        {/* ── §4 TOP DOCTORS & HOSPITALS ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top Doctors */}
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Stethoscope size={16} color="white" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-montserrat text-base-content">Top Doctors</h3>
                <p className="text-xs text-base-content/40">By booking count this period</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !topDocs?.length ? (
              <p className="text-sm text-base-content/30 text-center py-8">No data available</p>
            ) : (
              <div className="space-y-2">
                {topDocs.map((doc, i) => {
                  const maxCount = topDocs[0]?.count ?? 1;
                  const share    = ((doc.count / maxCount) * 100).toFixed(0);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-all duration-200"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-primary">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-base-content truncate">{doc.doctorName ?? 'Unknown'}</p>
                        <p className="text-xs text-base-content/40 truncate">{doc.specialization}</p>
                        <div className="mt-1 h-1 rounded-full bg-base-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${share}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black font-montserrat text-base-content">{fmt(doc.count)}</p>
                        <p className="text-[10px] text-base-content/40">{fmtCurrency(doc.revenue)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Top Hospitals */}
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Building2 size={16} color="white" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-montserrat text-base-content">Top Hospitals</h3>
                <p className="text-xs text-base-content/40">By booking count this period</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !topHosps?.length ? (
              <p className="text-sm text-base-content/30 text-center py-8">No data available</p>
            ) : (
              <div className="space-y-2">
                {topHosps.map((hosp, i) => {
                  const maxCount = topHosps[0]?.count ?? 1;
                  const share    = ((hosp.count / maxCount) * 100).toFixed(0);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-all duration-200"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-600/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-indigo-500">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-base-content truncate">{hosp.hospitalName ?? 'Unknown'}</p>
                        <p className="text-xs text-base-content/40 truncate">{hosp.city} • {hosp.hospitalType}</p>
                        <div className="mt-1 h-1 rounded-full bg-base-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${share}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black font-montserrat text-base-content">{fmt(hosp.count)}</p>
                        <p className="text-[10px] text-base-content/40">{fmtCurrency(hosp.revenue)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </section>

        {/* ── §5 REVENUE BY TYPE BAR ── */}
        <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
          <div className="mb-5">
            <h3 className="text-sm font-bold font-montserrat text-base-content">Revenue by Booking Type</h3>
            <p className="text-xs text-base-content/40">Gross revenue breakdown across all booking categories</p>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byType} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => v?.replace(/_/g, ' ')}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={45}
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${fmt(v)}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]}>
                  {byType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ── §6 BOOKING LIST TABLE ── */}
        <section>
          <motion.div variants={cardAnim} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden">

            {/* Table header */}
            <div className="p-5 border-b border-base-300 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h3 className="text-sm font-bold font-montserrat text-base-content">Booking Records</h3>
                <p className="text-xs text-base-content/40">
                  {pagination.total ? `${pagination.total} total` : ''} • Page {pagination.page ?? 1} of {pagination.pages ?? 1}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30" />
                  <input
                    type="text"
                    placeholder="Search code / name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field pl-7 pr-3 py-2 text-xs w-44 sm:w-56"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5 space-y-3">
                  {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarCheck size={28} className="text-base-content/20 mx-auto mb-2" />
                  <p className="text-sm text-base-content/30">No bookings found</p>
                </div>
              ) : (
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Booking Code</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th>Doctor / Hospital</th>
                      <th>Scheduled</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredRows.map((b, i) => (
                        <motion.tr
                          key={b._id ?? i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                        >
                          <td>
                            <span className="text-xs font-mono font-bold text-primary">{b.bookingCode ?? '—'}</span>
                          </td>
                          <td>
                            <div>
                              <p className="text-xs font-semibold text-base-content">{b.customer?.name ?? '—'}</p>
                              <p className="text-[10px] text-base-content/40">{b.customer?.phone ?? ''}</p>
                            </div>
                          </td>
                          <td>
                            <span className="text-xs font-medium text-base-content/60 bg-base-200 px-2 py-0.5 rounded-lg">
                              {b.bookingType?.replace(/_/g, ' ') ?? '—'}
                            </span>
                          </td>
                          <td>
                            <div>
                              <p className="text-xs font-semibold text-base-content truncate max-w-[120px]">
                                {b.doctor?.user?.name ?? b.hospital?.name ?? '—'}
                              </p>
                              <p className="text-[10px] text-base-content/40 truncate max-w-[120px]">
                                {b.doctor?.specialization ?? b.hospital?.hospitalType ?? ''}
                              </p>
                            </div>
                          </td>
                          <td>
                            <div>
                              <p className="text-xs font-semibold text-base-content">{fmtDate(b.scheduledAt)}</p>
                              <p className="text-[10px] text-base-content/40">{fmtTime(b.scheduledAt)}</p>
                            </div>
                          </td>
                          <td>
                            <span className="text-xs font-bold text-base-content">
                              {fmtCurrency(b.fareBreakdown?.totalAmount)}
                            </span>
                          </td>
                          <td><StatusBadge status={b.status} /></td>
                          <td><PaymentBadge status={b.paymentStatus} /></td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-base-300 flex items-center justify-between">
                <p className="text-xs text-base-content/40">
                  Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="btn btn-sm btn-ghost btn-circle"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {/* page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      const p = Math.max(1, Math.min(pagination.pages - 4, page - 2)) + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            p === page
                              ? 'bg-primary text-primary-content'
                              : 'text-base-content/50 hover:bg-base-200'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages || loading}
                    className="btn btn-sm btn-ghost btn-circle"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Footer ── */}
        <motion.div variants={fadeUp} className="flex items-center justify-between py-2">
          <p className="text-xs text-base-content/30 font-medium">
            Likeson Healthcare • Booking Analytics
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-xs text-base-content/30 font-medium">Live data</p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}