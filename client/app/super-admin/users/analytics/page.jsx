'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, UserCheck, UserX, Wifi, Activity,
  ShieldCheck, Stethoscope, Truck, FlaskConical,
  Pill, Landmark, HeartHandshake, RefreshCw, AlertCircle,
  TrendingUp, ArrowUpRight, CircleDot, Sparkles,
} from 'lucide-react';

import {
  fetchUsersAnalytics,
  selectUsersAnalytics,
  selectAnalyticsLoading,
  selectUsersErrors,
} from '@/store/slices/adminUserSlice';

// ─── Role Meta ────────────────────────────────────────────────────────────────
const ROLE_META = {
  customer:         { icon: Users,          label: 'Customers',          color: 'var(--chart-1)' },
  doctor:           { icon: Stethoscope,    label: 'Doctors',            color: 'var(--chart-2)' },
  'lab partner':    { icon: FlaskConical,   label: 'Lab Partners',       color: 'var(--chart-3)' },
  pharmacy:         { icon: Pill,           label: 'Pharmacists',        color: 'var(--chart-4)' },
  transportpartner: { icon: Truck,          label: 'Transport Partners', color: 'var(--chart-5)' },
  finance:          { icon: Landmark,       label: 'Finance',            color: 'var(--chart-6)' },
  'care assistant': { icon: HeartHandshake, label: 'Care Assistants',    color: 'var(--chart-1)' },
  admin:            { icon: ShieldCheck,    label: 'Admins',             color: 'var(--chart-2)' },
  superadmin:       { icon: ShieldCheck,    label: 'Super Admins',       color: 'var(--primary)' },
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 1.4 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to   = Number(value) || 0;
    if (from === to) return;
    prevRef.current = to;
    let startTs = null;
    const raf = (ts) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / (duration * 1000), 1);
      const e = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

// ─── Animated Progress Bar ────────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay = 0, height = 'h-1.5' }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <div ref={ref} className={`${height} rounded-full overflow-hidden w-full`} style={{ background: 'var(--base-300)' }}>
      <motion.div
        className={`${height} rounded-full`}
        style={{ background: color }}
        initial={{ width: 0, opacity: 0 }}
        animate={inView ? { width: `${Math.min(pct, 100)}%`, opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay }}
      />
    </div>
  );
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────
const PulseDot = ({ color = 'var(--primary)' }) => (
  <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
    <motion.span
      className="absolute inline-flex h-full w-full rounded-full"
      style={{ background: color, opacity: 0.5 }}
      animate={{ scale: [1, 2.4, 1], opacity: [0.5, 0, 0.5] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
  </span>
);

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-2xl px-4 py-3 shadow-2xl text-sm"
      style={{
        background: 'var(--base-200)',
        border: '1.5px solid var(--base-300)',
        color: 'var(--base-content)',
        minWidth: 148,
        backdropFilter: 'blur(20px)',
      }}
    >
      <p className="font-black text-[10px] uppercase tracking-[0.18em] mb-2.5" style={{ color: 'var(--primary)' }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--base-content)', opacity: 0.6 }}>
              {entry.name}
            </span>
          </div>
          <span className="text-[11px] font-black tabular-nums" style={{ color: entry.color }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ label, desc, color, icon: Icon }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <CircleDot size={9} style={{ color }} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color }}>{label}</p>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--base-content)', opacity: 0.5 }}>{desc}</p>
    </div>
    <span
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `color-mix(in oklch, ${color} 13%, var(--base-200))`, color }}
    >
      <Icon size={16} strokeWidth={2} />
    </span>
  </div>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skel = ({ className = '' }) => (
  <motion.div
    className={`skeleton ${className}`}
    animate={{ opacity: [0.5, 0.85, 0.5] }}
    transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
  />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, trend, index = 0, pulse = false }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 36, scale: 0.93 },
        show: {
          opacity: 1, y: 0, scale: 1,
          transition: { type: 'spring', stiffness: 230, damping: 22, delay: index * 0.075 },
        },
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -7, transition: { type: 'spring', stiffness: 340, damping: 18 } }}
      className="glass-card p-5 flex flex-col gap-4 relative overflow-hidden cursor-default select-none"
    >
      {/* Radial glow */}
      <motion.span
        className="absolute inset-0 pointer-events-none rounded-[inherit]"
        style={{ background: `radial-gradient(ellipse at 80% 10%, color-mix(in oklch, ${color} 24%, transparent), transparent 60%)` }}
        animate={{ opacity: hovered ? 1 : 0.45 }}
        transition={{ duration: 0.35 }}
      />

      <div className="flex items-start justify-between relative z-10">
        <motion.span
          className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
          style={{ background: `color-mix(in oklch, ${color} 17%, var(--base-200))`, color }}
          animate={hovered ? { scale: 1.12, rotate: 8 } : { scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 16 }}
        >
          <Icon size={20} strokeWidth={2} />
        </motion.span>

        <div className="flex flex-col items-end gap-1.5">
          {pulse && <PulseDot color={color} />}
          {trend !== undefined && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + index * 0.075 }}
              className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full"
              style={{
                background: 'color-mix(in oklch, var(--success) 14%, var(--base-200))',
                color: 'var(--success)',
              }}
            >
              <TrendingUp size={10} />+{trend}%
            </motion.span>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-[2rem] font-black tabular-nums tracking-tight leading-none mb-1" style={{ color: 'var(--base-content)' }}>
          <AnimatedNumber value={value} />
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--base-content)', opacity: 0.42 }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-1.5 font-bold" style={{ color }}>
            {sub}
          </p>
        )}
      </div>

      {/* Bottom shimmer bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-[3px] rounded-b-[inherit]"
        style={{ background: `linear-gradient(90deg, ${color} 0%, transparent 100%)` }}
        initial={{ width: '30%' }}
        animate={{ width: hovered ? '100%' : '30%' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </motion.div>
  );
};

// ─── Role Row ─────────────────────────────────────────────────────────────────
const RoleRow = ({ roleKey, count, total, index = 0 }) => {
  const meta = ROLE_META[roleKey] ?? { icon: Users, label: roleKey, color: 'var(--chart-1)' };
  const Icon = meta.icon;
  const pct  = total ? Math.round((count / total) * 100) : 0;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -18 },
        show: { opacity: 1, x: 0, transition: { duration: 0.4, delay: 0.3 + index * 0.07, ease: 'easeOut' } },
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors duration-200"
      style={{ background: hovered ? `color-mix(in oklch, ${meta.color} 9%, var(--base-200))` : 'transparent' }}
    >
      <motion.span
        animate={hovered ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in oklch, ${meta.color} 18%, var(--base-200))`, color: meta.color }}
      >
        <Icon size={14} strokeWidth={2.2} />
      </motion.span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold" style={{ color: 'var(--base-content)', opacity: 0.75 }}>{meta.label}</span>
          <span className="text-xs font-black tabular-nums" style={{ color: meta.color }}>{count.toLocaleString()}</span>
        </div>
        <AnimatedBar pct={pct} color={meta.color} delay={0.4 + index * 0.07} />
      </div>

      <span className="text-[10px] font-black w-8 text-right tabular-nums" style={{ color: 'var(--base-content)', opacity: 0.3 }}>
        {pct}%
      </span>
    </motion.div>
  );
};

// ─── Health Metric ────────────────────────────────────────────────────────────
const HealthMetric = ({ label, value, sub, color, pct, index = 0 }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 14 },
      show: { opacity: 1, y: 0, transition: { delay: 0.2 + index * 0.1, ease: 'easeOut', duration: 0.4 } },
    }}
    whileHover={{ x: 5, transition: { type: 'spring', stiffness: 300 } }}
    className="flex items-center gap-4 p-3.5 rounded-2xl cursor-default"
    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
  >
    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: 'var(--base-content)', opacity: 0.62 }}>{label}</span>
        <span className="text-sm font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
      <AnimatedBar pct={pct} color={color} delay={0.3 + index * 0.1} />
      <p className="text-[10px] mt-1.5 font-medium" style={{ color: 'var(--base-content)', opacity: 0.36 }}>{sub}</p>
    </div>
    <motion.div
      initial={{ opacity: 0.4 }}
      whileHover={{ opacity: 1, x: 3 }}
      style={{ color }}
    >
      <ArrowUpRight size={15} />
    </motion.div>
  </motion.div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function UsersOverview() {
  const dispatch  = useDispatch();
  const analytics = useSelector(selectUsersAnalytics);
  const loading   = useSelector(selectAnalyticsLoading);
  const errors    = useSelector(selectUsersErrors);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    dispatch(fetchUsersAnalytics());
    setRefreshKey(k => k + 1);
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const summary        = analytics?.summary        ?? {};
  const byRole         = analytics?.byRole         ?? {};
  const trend          = analytics?.registrationTrend ?? [];
  const orderStats     = analytics?.orders         ?? {};

  const totalUsers     = summary.totalUsers     ?? 0;
  const blockedUsers   = summary.blockedUsers   ?? 0;
  const verifiedEmails = summary.verifiedEmails ?? 0;
  const onlineUsers    = summary.onlineUsers    ?? 0;
  const newThisWeek    = summary.newThisWeek    ?? 0;

  const pieData = Object.entries(byRole)
    .filter(([, v]) => v > 0)
    .map(([role, count]) => ({
      name:  ROLE_META[role]?.label ?? role,
      value: count,
      color: ROLE_META[role]?.color ?? 'var(--chart-1)',
    }));

  const orderBarData = Object.entries(orderStats).map(([status, d]) => ({
    status,
    Orders: d.count,
    'Revenue (₹)': Math.round(d.revenue ?? 0),
  }));

  // Enrich trend with rolling average
  const enrichedTrend = trend.map((d, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 3), i + 1);
    const ma    = Math.round(slice.reduce((s, x) => s + x.count, 0) / slice.length);
    return { ...d, ma };
  });

  const containerV = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  };

  const cardV = {
    hidden: { opacity: 0, y: 28, scale: 0.96 },
    show:   { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 22 } },
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-8 relative" style={{ background: 'var(--base-100)' }}>

      {/* ── Atmospheric blobs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 680, height: 680, top: -220, right: -180,
            background: 'var(--primary)', opacity: 0.055,
          }}
          animate={{ scale: [1, 1.07, 1], rotate: [0, 18, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 480, height: 480, bottom: -80, left: -120,
            background: 'var(--secondary)', opacity: 0.045,
          }}
          animate={{ scale: [1, 1.12, 1], rotate: [0, -22, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 320, height: 320, top: '50%', left: '45%',
            background: 'var(--accent)', opacity: 0.03,
          }}
          animate={{ scale: [1, 1.2, 1], x: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        />
      </div>

      <div className="relative z-10 max-w-screen-2xl mx-auto">

        {/* ══════════════════════════════════ HEADER ══════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-start justify-between gap-4 mb-10"
        >
          <div>
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="flex items-center gap-2 mb-3"
            >
              <span
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] px-3 py-1.5 rounded-full"
                style={{
                  background: 'color-mix(in oklch, var(--primary) 11%, var(--base-200))',
                  color:      'var(--primary)',
                  border:     '1px solid color-mix(in oklch, var(--primary) 24%, var(--base-300))',
                }}
              >
                <PulseDot color="var(--primary)" />
                Live Analytics
              </span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-2">
              <span style={{ color: 'var(--base-content)' }}>Users </span>
              <span className="text-gradient-primary">Overview</span>
            </h1>
            <p className="text-sm font-medium" style={{ color: 'var(--base-content)', opacity: 0.42 }}>
              Platform‑wide user statistics, growth & health metrics
            </p>
          </div>

          <motion.button
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.28 }}
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50"
            style={{
              background:  'color-mix(in oklch, var(--primary) 12%, var(--base-200))',
              color:       'var(--primary)',
              border:      '1.5px solid color-mix(in oklch, var(--primary) 28%, var(--base-300))',
              boxShadow:   '0 4px 20px color-mix(in oklch, var(--primary) 10%, transparent)',
            }}
          >
            <motion.span
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { repeat: Infinity, duration: 0.75, ease: 'linear' } : {}}
            >
              <RefreshCw size={14} />
            </motion.span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </motion.button>
        </motion.div>

        {/* ══════════════════════════════════ ERROR ══════════════════════════════════ */}
        <AnimatePresence>
          {errors.analytics && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={  { opacity: 0, height: 0, marginBottom: 0 }}
              className="alert alert-error overflow-hidden"
            >
              <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <span className="text-sm font-semibold">{errors.analytics}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════ KPI CARDS ══════════════════════════════════ */}
        <motion.div
          key={`kpi-${refreshKey}`}
          variants={containerV}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-8"
        >
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-36 rounded-2xl" />)
            : [
                { icon: Users,     label: 'Total Users',    value: totalUsers,     color: 'var(--chart-1)' },
                { icon: Wifi,      label: 'Online Now',     value: onlineUsers,    color: 'var(--chart-2)', pulse: true },
                { icon: UserCheck, label: 'Verified',       value: verifiedEmails, color: 'var(--chart-3)', sub: summary.verificationRate },
                { icon: UserX,     label: 'Blocked',        value: blockedUsers,   color: 'var(--error)' },
                { icon: Activity,  label: 'New This Week',  value: newThisWeek,    color: 'var(--chart-5)', trend: newThisWeek > 0 ? 12 : undefined },
              ].map((card, i) => <StatCard key={i} {...card} index={i} />)
          }
        </motion.div>

        {/* ══════════════════════════════════ MAIN CHARTS ══════════════════════════════════ */}
        <motion.div
          key={`charts-${refreshKey}`}
          variants={containerV}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
        >
          {/* ── Registration Trend ── */}
          <motion.div variants={cardV} className="glass-card p-6 lg:col-span-2">
            <SectionHeader
              label="Registration Trend"
              desc="New users over the last 30 days"
              color="var(--primary)"
              icon={TrendingUp}
            />

            {loading ? (
              <Skel className="h-56 w-full rounded-xl" />
            ) : trend.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--base-content)', opacity: 0.3 }}>
                <Activity size={30} />
                <p className="text-sm font-semibold">No registration data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={enrichedTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--primary)"   stopOpacity={0.38} />
                      <stop offset="100%" stopColor="var(--primary)"   stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSecondary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--secondary)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 5" stroke="var(--base-300)" vertical={false} opacity={0.7} />
                  <XAxis
                    dataKey="_id"
                    tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4, fontWeight: 700 }}
                    tickFormatter={d => d?.slice(5)}
                    axisLine={false} tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4, fontWeight: 700 }}
                    axisLine={false} tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotoneX"
                    dataKey="count"
                    name="Registrations"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#gPrimary)"
                    dot={false}
                    activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--base-100)', strokeWidth: 3 }}
                    isAnimationActive
                    animationDuration={1600}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotoneX"
                    dataKey="ma"
                    name="Rolling Avg"
                    stroke="var(--secondary)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    fill="url(#gSecondary)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--secondary)', stroke: 'var(--base-100)', strokeWidth: 2 }}
                    isAnimationActive
                    animationDuration={1900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* ── Role Breakdown ── */}
          <motion.div variants={cardV} className="glass-card p-6 flex flex-col">
            <SectionHeader
              label="By Role"
              desc="User distribution"
              color="var(--secondary)"
              icon={Users}
            />

            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-10 rounded-xl" />)}
              </div>
            ) : (
              <>
                {/* Donut with centre stat */}
                {pieData.length > 0 && (
                  <div className="relative flex justify-center mb-4">
                    <ResponsiveContainer width={145} height={145}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={42} outerRadius={64}
                          paddingAngle={3}
                          strokeWidth={0}
                          dataKey="value"
                          isAnimationActive
                          animationBegin={250}
                          animationDuration={1050}
                          animationEasing="ease-out"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centred label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--base-content)' }}>
                        {totalUsers}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--base-content)', opacity: 0.38 }}>
                        Total
                      </span>
                    </div>
                  </div>
                )}

                <div className="h-px mb-2" style={{ background: 'var(--base-300)' }} />

                <motion.div variants={containerV} initial="hidden" animate="show" className="flex flex-col gap-0.5">
                  {Object.entries(byRole).map(([role, count], i) => (
                    <RoleRow key={role} roleKey={role} count={count} total={totalUsers} index={i} />
                  ))}
                  {Object.keys(byRole).length === 0 && (
                    <p className="text-xs text-center py-6 font-medium" style={{ color: 'var(--base-content)', opacity: 0.28 }}>
                      No role data available
                    </p>
                  )}
                </motion.div>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* ══════════════════════════════════ BOTTOM ROW ══════════════════════════════════ */}
        <motion.div
          key={`bottom-${refreshKey}`}
          variants={containerV}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >

          {/* ── Pharmacy Orders ── */}
          <motion.div variants={cardV} className="glass-card p-6">
            <SectionHeader
              label="Pharmacy Orders"
              desc="Orders & revenue by status"
              color="var(--accent)"
              icon={Pill}
            />

            {loading ? (
              <Skel className="h-56 w-full rounded-xl" />
            ) : orderBarData.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--base-content)', opacity: 0.28 }}>
                <Pill size={30} />
                <p className="text-sm font-semibold">No order data</p>
              </div>
            ) : (
              <>
                {/* Status chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {orderBarData.map((d, i) => (
                    <motion.span
                      key={d.status}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.09, type: 'spring', stiffness: 260 }}
                      className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                      style={{
                        background: i === 0
                          ? 'color-mix(in oklch, var(--chart-4) 16%, var(--base-200))'
                          : 'color-mix(in oklch, var(--chart-2) 16%, var(--base-200))',
                        color: i === 0 ? 'var(--chart-4)' : 'var(--chart-2)',
                        border: `1px solid ${i === 0
                          ? 'color-mix(in oklch, var(--chart-4) 28%, var(--base-300))'
                          : 'color-mix(in oklch, var(--chart-2) 28%, var(--base-300))'}`,
                      }}
                    >
                      {d.status} — {d.Orders} orders
                    </motion.span>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={orderBarData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barGap={6}>
                    <defs>
                      <linearGradient id="bOrders"  x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="var(--chart-4)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="bRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="var(--chart-2)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 5" stroke="var(--base-300)" vertical={false} opacity={0.7} />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45, fontWeight: 700 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45, fontWeight: 700 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Orders"      fill="url(#bOrders)"  radius={[7, 7, 0, 0]}
                      isAnimationActive animationDuration={1100} animationEasing="ease-out" />
                    <Bar dataKey="Revenue (₹)" fill="url(#bRevenue)" radius={[7, 7, 0, 0]}
                      isAnimationActive animationDuration={1350} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </motion.div>

          {/* ── Platform Health ── */}
          <motion.div variants={cardV} className="glass-card p-6 flex flex-col">
            <SectionHeader
              label="Platform Health"
              desc="Verification & activity metrics"
              color="var(--success)"
              icon={ShieldCheck}
            />

            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-16 rounded-2xl" />)}
              </div>
            ) : (
              <motion.div variants={containerV} initial="hidden" animate="show" className="flex flex-col gap-3">
                {[
                  {
                    label: 'Email Verification Rate',
                    value: summary.verificationRate ?? '0%',
                    sub:   `${verifiedEmails.toLocaleString()} of ${totalUsers.toLocaleString()} users verified`,
                    color: 'var(--success)',
                    pct:   totalUsers ? (verifiedEmails / totalUsers) * 100 : 0,
                  },
                  {
                    label: 'Account Block Rate',
                    value: totalUsers ? `${((blockedUsers / totalUsers) * 100).toFixed(1)}%` : '0%',
                    sub:   `${blockedUsers.toLocaleString()} accounts suspended`,
                    color: 'var(--error)',
                    pct:   totalUsers ? (blockedUsers / totalUsers) * 100 : 0,
                  },
                  {
                    label: 'Currently Online',
                    value: totalUsers ? `${((onlineUsers / totalUsers) * 100).toFixed(1)}%` : '0%',
                    sub:   `${onlineUsers.toLocaleString()} active sessions right now`,
                    color: 'var(--info)',
                    pct:   totalUsers ? (onlineUsers / totalUsers) * 100 : 0,
                  },
                  {
                    label: 'Weekly Growth',
                    value: `+${newThisWeek.toLocaleString()}`,
                    sub:   'new accounts registered this week',
                    color: 'var(--accent)',
                    pct:   totalUsers ? Math.min((newThisWeek / totalUsers) * 500, 100) : 0,
                  },
                ].map((item, i) => <HealthMetric key={i} {...item} index={i} />)}
              </motion.div>
            )}

            {/* Footer callout */}
            {!loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 }}
                className="mt-4 pt-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--base-300)' }}
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: 'var(--base-content)', opacity: 0.38 }}>
                    Platform Total
                  </p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--base-content)' }}>
                    <AnimatedNumber value={totalUsers} />
                    <span className="text-sm font-bold ml-1.5" style={{ opacity: 0.4 }}>users</span>
                  </p>
                </div>

                {/* Role icon chips */}
                <div className="flex gap-1.5">
                  {pieData.slice(0, 5).map((d, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.95 + i * 0.06, type: 'spring', stiffness: 280 }}
                      whileHover={{ scale: 1.15, y: -3 }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black tabular-nums cursor-default"
                      title={d.name}
                      style={{
                        background: `color-mix(in oklch, ${d.color} 18%, var(--base-200))`,
                        color:      d.color,
                        border:     `1px solid color-mix(in oklch, ${d.color} 30%, var(--base-300))`,
                      }}
                    >
                      {d.value}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
}