'use client';

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, CalendarCheck, ShoppingBag, CreditCard,
  Stethoscope, Building2, Car, FlaskConical,
  TrendingUp, TrendingDown, Minus, RefreshCw,
  Activity, AlertCircle, CheckCircle2, XCircle,
  IndianRupee, Clock, Shield, Wallet,
  ArrowUpRight, ArrowDownRight, Heart,
} from 'lucide-react';

import {
  fetchOverview,
  selectOverviewData,
  selectOverviewLoading,
  selectOverviewError,
  selectOverviewTrends,
  selectOverviewTotals,
  selectOverviewRevenue,
  selectPendingKycDoctors,
  selectActiveSubscriptions,
} from '@/store/slices/adminAnalyticsSlice';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(n ?? 0);

const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const pct = (n) => `${n > 0 ? '+' : ''}${n ?? 0}%`;

// ─── Animation variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

// ─── Trend Badge ─────────────────────────────────────────────────────────────

const TrendBadge = ({ trend, changePercent }) => {
  if (trend === 'up')
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded-full">
        <ArrowUpRight size={11} /> {pct(changePercent)}
      </span>
    );
  if (trend === 'down')
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-error bg-error/10 border border-error/30 px-2 py-0.5 rounded-full">
        <ArrowDownRight size={11} /> {pct(changePercent)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-base-content/50 bg-base-300/60 px-2 py-0.5 rounded-full">
      <Minus size={11} /> 0%
    </span>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, trend, changePercent, sub, gradient, loading }) => (
  <motion.div variants={cardVariants} className="group relative overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm hover:shadow-depth transition-all duration-300 hover:-translate-y-1">
    {/* gradient accent bar */}
    <div className={`absolute top-0 left-0 right-0 h-0.5 ${gradient}`} />

    {/* icon glow bg */}
    <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-8 blur-2xl ${gradient}`} />

    <div className="relative p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${gradient} shadow-sm`}>
          <Icon size={20} color="white" />
        </div>
        {loading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <TrendBadge trend={trend} changePercent={changePercent} />
        )}
      </div>

      {loading ? (
        <>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <p className="text-xl font-black font-montserrat text-base-content tracking-tight">{value}</p>
          <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-base-content/40 mt-1.5">{sub}</p>}
        </>
      )}
    </div>
  </motion.div>
);

// ─── Metric Row ──────────────────────────────────────────────────────────────

const MetricRow = ({ icon: Icon, label, value, color = 'primary', loading }) => (
  <div className="flex items-center justify-between py-3 border-b border-base-300 last:border-0">
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg bg-${color}/10 border border-${color}/20 flex items-center justify-center flex-shrink-0`}>
        <Icon size={14} className={`text-${color}`} />
      </div>
      <span className="text-xs font-medium text-base-content/70">{label}</span>
    </div>
    {loading ? (
      <Skeleton className="h-5 w-16" />
    ) : (
      <span className="text-xs font-bold text-base-content">{value}</span>
    )}
  </div>
);

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl shadow-depth-lg p-3 text-[10px]">
      <p className="font-bold text-base-content/60 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmtCurrency(p.value) : fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Revenue Mini Chart data builder ────────────────────────────────────────

const buildRevenueData = (revenue) => {
  if (!revenue) return [];
  return [
    { name: 'Bookings', value: revenue.bookingRevenue ?? 0 },
    { name: 'Pharmacy', value: revenue.pharmacyRevenue ?? 0 },
  ];
};

// ─── Booking Snapshot Chart data ─────────────────────────────────────────────

const buildBookingData = (snapshot) => {
  if (!snapshot) return [];
  return [
    { name: 'Active',    value: snapshot.active    ?? 0, color: '#3b82f6' },
    { name: 'Completed', value: snapshot.completed  ?? 0, color: '#22c55e' },
    { name: 'Cancelled', value: snapshot.cancelled  ?? 0, color: '#ef4444' },
  ];
};

// ─── Trend sparkline mock (period-based) ─────────────────────────────────────
// Real app: fetch daily breakdown; for now derive from trend data

const buildSparkData = (current, previous) => {
  const mid = (current + previous) / 2;
  return [
    { v: previous * 0.7 },
    { v: previous * 0.85 },
    { v: previous },
    { v: mid * 0.9 },
    { v: mid },
    { v: (mid + current) / 2 },
    { v: current },
  ];
};

// ─── Section Header ──────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle }) => (
  <motion.div variants={fadeUp} className="mb-5">
    <h2 className="text-lg font-extrabold font-montserrat text-base-content tracking-tight">{title}</h2>
    {subtitle && <p className="text-[10px] text-base-content/50 mt-0.5">{subtitle}</p>}
  </motion.div>
);

// ─── Chart Card wrapper ───────────────────────────────────────────────────────

const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <motion.div variants={cardVariants} className={`rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5 ${className}`}>
    <div className="mb-4">
      <h3 className="text-xs font-bold font-montserrat text-base-content">{title}</h3>
      {subtitle && <p className="text-[10px] text-base-content/40 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </motion.div>
);

// ─── COLORS ──────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  primary:   'var(--primary)',
  secondary: 'var(--secondary)',
  success:   'var(--success)',
  warning:   'var(--warning)',
  error:     'var(--error)',
  accent:    'var(--accent)',
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function Overview() {
  const dispatch    = useDispatch();
  const data        = useSelector(selectOverviewData);
  const loading     = useSelector(selectOverviewLoading);
  const error       = useSelector(selectOverviewError);
  const trends      = useSelector(selectOverviewTrends);
  const totals      = useSelector(selectOverviewTotals);
  const revenue     = useSelector(selectOverviewRevenue);
  const pendingKyc  = useSelector(selectPendingKycDoctors);
  const activeSubs  = useSelector(selectActiveSubscriptions);

  const load = useCallback(() => dispatch(fetchOverview()), [dispatch]);

  useEffect(() => { load(); }, [load]);

  const bookingSnapshot = data?.bookingSnapshot;
  const driverSnapshot  = data?.driverSnapshot;

  // ── Stat cards config ──────────────────────────────────────────────────────
  const statCards = [
    {
      icon: Users,
      label: 'New Users',
      value: fmt(trends?.users?.current),
      trend: trends?.users?.trend,
      changePercent: trends?.users?.changePercent,
      sub: `${fmt(totals?.users)} total users`,
      gradient: 'bg-gradient-to-br from-primary to-secondary',
    },
    {
      icon: CalendarCheck,
      label: 'New Bookings',
      value: fmt(trends?.bookings?.current),
      trend: trends?.bookings?.trend,
      changePercent: trends?.bookings?.changePercent,
      sub: `${fmt(totals?.bookings)} total bookings`,
      gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    },
    {
      icon: ShoppingBag,
      label: 'Pharmacy Orders',
      value: fmt(trends?.pharmacyOrders?.current),
      trend: trends?.pharmacyOrders?.trend,
      changePercent: trends?.pharmacyOrders?.changePercent,
      sub: `${fmt(totals?.pharmacyOrders)} total orders`,
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    },
    {
      icon: CreditCard,
      label: 'Subscriptions',
      value: fmt(trends?.subscriptions?.current),
      trend: trends?.subscriptions?.trend,
      changePercent: trends?.subscriptions?.changePercent,
      sub: `${fmt(activeSubs)} active now`,
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
  ];

  // ── Total count cards ──────────────────────────────────────────────────────
  const totalCards = [
    { icon: Stethoscope,  label: 'Doctors',       value: fmt(totals?.doctors),      color: 'text-blue-500'   },
    { icon: Building2,    label: 'Hospitals',      value: fmt(totals?.hospitals),    color: 'text-indigo-500' },
    { icon: Car,          label: 'Drivers',        value: fmt(totals?.drivers),      color: 'text-amber-500'  },
    { icon: FlaskConical, label: 'Lab Partners',   value: fmt(totals?.labPartners),  color: 'text-purple-500' },
    { icon: Heart,        label: 'Blood Banks',    value: fmt(totals?.bloodBanks),   color: 'text-red-500'    },
  ];

  // ── Revenue donut data ────────────────────────────────────────────────────
  const revData = buildRevenueData(revenue);
  const bookingPieData = buildBookingData(bookingSnapshot);

  // ── Spark data ────────────────────────────────────────────────────────────
  const userSparkData  = trends?.users    ? buildSparkData(trends.users.current,    trends.users.previous)    : [];
  const bookSparkData  = trends?.bookings ? buildSparkData(trends.bookings.current, trends.bookings.previous) : [];

  return (
    <div className="min-h-screen bg-base-200  p-3">

      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
 
          </div>
          <h1 className="text-xl md:text-3xl font-black font-montserrat text-base-content tracking-tight">
            Platform Overview
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            Real-time analytics • Last 30 days vs prior period
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* live dot */}
          <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-bold text-success">Live</span>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="btn btn-sm btn-outline flex items-center gap-2"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Error State ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="alert alert-error mb-6"
          >
            <AlertCircle size={16} />
            <span className="text-xs font-semibold">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >

        {/* ── §1 TREND STAT CARDS ── */}
        <section>
          <SectionHeader
            title="Period Trends"
            subtitle="New activity this period compared to previous period"
          />
          <div className="grid grid-cols-1 sm:grid-cols-4 xl:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} loading={loading} />
            ))}
          </div>
        </section>

        {/* ── §2 REVENUE + BOOKING SNAPSHOT ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue Summary Big Card */}
          <motion.div
            variants={cardVariants}
            className="lg:col-span-2 rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden"
          >
            <div className="relative p-5 pb-4 border-b border-base-300 bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="absolute top-0 right-0 w-40 h-full opacity-10">
                <div className="w-full h-full bg-gradient-to-l from-primary to-transparent" />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-1">Total Revenue</p>
                  {loading ? (
                    <Skeleton className="h-10 w-40" />
                  ) : (
                    <p className="text-3xl sm:text-4xl font-bold font-montserrat text-base-content tracking-tight">
                      {fmtCurrency(revenue?.total)}
                    </p>
                  )}
                  <p className="text-[10px] text-base-content/40 mt-1">
                    Period: {revenue?.period?.from ? new Date(revenue.period.from).toLocaleDateString('en-IN') : '—'}{' '}
                    → {revenue?.period?.to ? new Date(revenue.period.to).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-primary">
                  <IndianRupee size={22} color="white" />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-[10px] text-base-content/60">
                    Bookings: <strong className="text-base-content">{fmtCurrency(revenue?.bookingRevenue)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-base-content/60">
                    Pharmacy: <strong className="text-base-content">{fmtCurrency(revenue?.pharmacyRevenue)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue donut chart */}
            <div className="p-5">
              {loading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-48 h-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revData}
                          cx="50%" cy="50%"
                          innerRadius={52} outerRadius={72}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {revData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={i === 0 ? 'var(--primary)' : '#22c55e'}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-3 w-full">
                    {revData.map((item, i) => {
                      const total = revData.reduce((s, r) => s + r.value, 0);
                      const share = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                      return (
                        <div key={item.name}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-semibold text-base-content/70">{item.name}</span>
                            <span className="font-bold text-base-content">{share}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-base-300 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${share}%` }}
                              transition={{ duration: 0.8, delay: i * 0.2 }}
                              className="h-full rounded-full"
                              style={{ background: i === 0 ? 'var(--primary)' : '#22c55e' }}
                            />
                          </div>
                          <p className="text-[10px] text-base-content/40 mt-0.5">{fmtCurrency(item.value)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Booking Snapshot */}
          <motion.div variants={cardVariants} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold font-montserrat text-base-content">Booking Status</h3>
                <p className="text-[10px] text-base-content/40">All-time snapshot</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Activity size={16} color="white" />
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={bookingPieData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {bookingPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    { label: 'Active',    val: bookingSnapshot?.active,    icon: Clock,        color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Done',      val: bookingSnapshot?.completed, icon: CheckCircle2, color: 'text-success',  bg: 'bg-success/10'  },
                    { label: 'Cancelled', val: bookingSnapshot?.cancelled, icon: XCircle,      color: 'text-error',    bg: 'bg-error/10'    },
                  ].map(({ label, val, icon: Icon, color, bg }) => (
                    <div key={label} className={`rounded-xl ${bg} p-2.5 text-center`}>
                      <Icon size={14} className={`${color} mx-auto mb-1`} />
                      <p className={`text-xs font-bold font-montserrat ${color}`}>{fmt(val)}</p>
                      <p className="text-[10px] text-base-content/40 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </section>

        {/* ── §3 SPARKLINE TREND CARDS ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <ChartCard title="User Growth Trend" subtitle="This period vs previous period">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={userSparkData}>
                  <defs>
                    <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <YAxis hide tickFormatter={fmt} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="v"
                    name="Users"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#ugGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {!loading && trends?.users && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-300">
                <span className="text-[10px] text-base-content/50">Previous: <strong className="text-base-content">{fmt(trends.users.previous)}</strong></span>
                <span className="text-[10px] text-base-content/50">Current: <strong className="text-base-content">{fmt(trends.users.current)}</strong></span>
                <TrendBadge trend={trends.users.trend} changePercent={trends.users.changePercent} />
              </div>
            )}
          </ChartCard>

          <ChartCard title="Booking Volume Trend" subtitle="Appointment booking momentum">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={bookSparkData}>
                  <defs>
                    <linearGradient id="bkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <YAxis hide tickFormatter={fmt} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="v"
                    name="Bookings"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#bkGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {!loading && trends?.bookings && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-300">
                <span className="text-[10px] text-base-content/50">Previous: <strong className="text-base-content">{fmt(trends.bookings.previous)}</strong></span>
                <span className="text-[10px] text-base-content/50">Current: <strong className="text-base-content">{fmt(trends.bookings.current)}</strong></span>
                <TrendBadge trend={trends.bookings.trend} changePercent={trends.bookings.changePercent} />
              </div>
            )}
          </ChartCard>
        </section>

        {/* ── §4 PLATFORM TOTALS + QUICK ALERTS ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Platform Entity Totals */}
          <motion.div variants={cardVariants} className="lg:col-span-2 rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xs font-bold font-montserrat text-base-content">Platform Entities</h3>
                <p className="text-[10px] text-base-content/40">All-time registered counts</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {totalCards.map(({ icon: Icon, label, value, color }) => (
                loading ? (
                  <Skeleton key={label} className="h-20 rounded-xl" />
                ) : (
                  <motion.div
                    key={label}
                    whileHover={{ scale: 1.04, y: -2 }}
                    className="rounded-xl border border-base-300 bg-base-200 p-3 text-center hover:border-primary/30 transition-all duration-200"
                  >
                    <Icon size={18} className={`${color} mx-auto mb-2`} />
                    <p className="text-lg font-bold font-montserrat text-base-content">{value}</p>
                    <p className="text-[10px] text-base-content/40 font-medium mt-0.5">{label}</p>
                  </motion.div>
                )
              ))}
            </div>

            {/* total users big display */}
            <div className="mt-4 rounded-xl bg-gradient-to-r from-primary/8 to-secondary/5 border border-primary/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Users size={18} color="white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Total Users (All Roles)</p>
                  {loading ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold font-montserrat text-primary">{fmt(totals?.users)}</p>
                  )}
                </div>
              </div>
              <ArrowUpRight size={20} className="text-primary/40" />
            </div>
          </motion.div>

          {/* Quick Alerts / Operational Cards */}
          <motion.div variants={cardVariants} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-center">
                <AlertCircle size={14} className="text-warning" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-montserrat text-base-content">Operational Alerts</h3>
                <p className="text-[10px] text-base-content/40">Needs attention</p>
              </div>
            </div>

            <div className="space-y-0">
              <MetricRow icon={Shield}        label="Pending KYC Doctors"  value={loading ? '—' : fmt(pendingKyc)}              color="warning" loading={loading} />
              <MetricRow icon={CreditCard}    label="Active Subscriptions" value={loading ? '—' : fmt(activeSubs)}              color="success" loading={loading} />
              <MetricRow icon={Car}           label="Drivers On Duty"      value={loading ? '—' : fmt(driverSnapshot?.onDuty)}  color="info"    loading={loading} />
              <MetricRow icon={Wallet}        label="Total Subscriptions"  value={loading ? '—' : fmt(totals?.subscriptions)}   color="primary" loading={loading} />
            </div>

            {/* KYC urgency badge */}
            {!loading && pendingKyc > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 rounded-xl bg-warning/10 border border-warning/30 p-3 flex items-start gap-2"
              >
                <AlertCircle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-warning font-semibold leading-snug">
                  {pendingKyc} doctor{pendingKyc > 1 ? 's' : ''} pending KYC review. Review to activate.
                </p>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* ── §5 COMPARISON BAR: ALL TRENDS ── */}
        <motion.div variants={cardVariants} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xs font-bold font-montserrat text-base-content">Period Comparison — All Metrics</h3>
              <p className="text-[10px] text-base-content/40">Current vs previous period side by side</p>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  {
                    name: 'Users',
                    Current:  trends?.users?.current  ?? 0,
                    Previous: trends?.users?.previous ?? 0,
                  },
                  {
                    name: 'Bookings',
                    Current:  trends?.bookings?.current  ?? 0,
                    Previous: trends?.bookings?.previous ?? 0,
                  },
                  {
                    name: 'Pharmacy',
                    Current:  trends?.pharmacyOrders?.current  ?? 0,
                    Previous: trends?.pharmacyOrders?.previous ?? 0,
                  },
                  {
                    name: 'Subscriptions',
                    Current:  trends?.subscriptions?.current  ?? 0,
                    Previous: trends?.subscriptions?.previous ?? 0,
                  },
                ]}
                barCategoryGap="25%"
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmt}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => (
                    <span style={{ color: 'var(--base-content)', opacity: 0.7, fontWeight: 600 }}>{value}</span>
                  )}
                />
                <Bar dataKey="Previous" name="Previous" fill="var(--base-300)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Current"  name="Current"  fill="var(--primary)"   radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ── §6 FOOTER META ── */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-between gap-2 py-2">
          <p className="text-[10px] text-base-content/30 font-medium">
            Likeson Healthcare Admin • Data auto-refreshes every session load
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-[10px] text-base-content/30 font-medium">All systems operational</p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}