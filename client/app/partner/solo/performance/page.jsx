'use client';

/**
 * PerformancePage.jsx
 * Solo Driver Partner — Performance Dashboard
 * Next.js · Tailwind · Lucide · Framer Motion · Recharts · global.css
 *
 * Reads from Redux slice selectors:
 *   selectPerformance, selectRewards, selectBadges,
 *   selectDispatch, selectCompliance, selectKyc, selectVehicle,
 *   selectLoading, selectError
 */

import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Star, ShieldCheck, ShieldAlert, ShieldX,
  Zap, Award, Clock, Car, AlertTriangle, CheckCircle2,
  XCircle, Wallet, MapPin, Activity, ChevronRight,
  BarChart2, Target, Flame, RefreshCw, BadgeCheck, Coins,
  ArrowLeft,
} from 'lucide-react';

import {
  fetchPerformance,
  fetchRewards,
  fetchRewardBadges,
  fetchDispatchStatus,
  fetchComplianceDashboard,
  fetchKycStatus,
  fetchVehicle,
  selectPerformance,
  selectRewards,
  selectBadges,
  selectDispatch,
  selectCompliance,
  selectKyc,
  selectVehicle,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';
import BackButton from '../../../../components/BackButton';

// ─── Design tokens (mirror global.css solodriverpartner theme) ────────────────
const T = {
  primary:   'oklch(58% 0.19 250)',
  accent:    'oklch(80% 0.18 80)',
  success:   'oklch(58% 0.18 152)',
  warning:   'oklch(72% 0.17 72)',
  error:     'oklch(60% 0.22 25)',
  base100:   'var(--base-100)',
  base200:   'var(--base-200)',
  base300:   'var(--base-300)',
  content:   'var(--base-content)',
};

// ─── Mocked sparkline data (replace with API data in production) ──────────────
const RIDES_TREND = [
  { week: 'W1', rides: 12, earnings: 4800 },
  { week: 'W2', rides: 18, earnings: 7200 },
  { week: 'W3', rides: 15, earnings: 6000 },
  { week: 'W4', rides: 22, earnings: 8800 },
  { week: 'W5', rides: 19, earnings: 7600 },
  { week: 'W6', rides: 27, earnings: 10800 },
  { week: 'W7', rides: 24, earnings: 9600 },
  { week: 'W8', rides: 31, earnings: 12400 },
];

const MONTHLY_DIST = [
  { month: 'Jan', km: 620 }, { month: 'Feb', km: 810 },
  { month: 'Mar', km: 740 }, { month: 'Apr', km: 930 },
  { month: 'May', km: 870 }, { month: 'Jun', km: 1020 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, prefix = '') =>
  n == null ? '—' : `${prefix}${Number(n).toLocaleString('en-IN')}`;

const pct = (n) => (n == null ? '—' : `${Number(n).toFixed(1)}%`);

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000);
  return diff;
};

const complianceColor = (status) => {
  if (status === 'expired')  return 'text-error border-error/40 bg-error/5';
  if (status === 'expiring') return 'text-warning border-warning/40 bg-warning/5';
  return 'text-success border-success/40 bg-success/5';
};

const complianceIcon = (status) => {
  if (status === 'expired')  return <XCircle size={14} className="text-error" />;
  if (status === 'expiring') return <AlertTriangle size={14} className="text-warning" />;
  return <CheckCircle2 size={14} className="text-success" />;
};

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  show:    { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
};
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.88 },
  show:    { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'backOut' } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Glowing metric card */
function MetricCard({ icon: Icon, label, value, sub, accent = false, glow = false }) {
  return (
    <motion.div
      variants={fadeUp}
      className={[
        'relative overflow-hidden rounded-xl border p-5',
        'bg-base-200 transition-all duration-300',
        accent
          ? 'border-primary/30 shadow-[0_0_24px_-4px_var(--color-primary)]'
          : 'border-base-300 hover:border-primary/20',
      ].join(' ')}
    >
      {glow && (
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      )}
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon size={18} className="text-primary" />
        </div>
        {sub && (
          <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
            {sub}
          </span>
        )}
      </div>
      <p className="mt-4 font-mono text-3xl font-black text-base-content tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-base-content/50">
        {label}
      </p>
    </motion.div>
  );
}

/** Section wrapper with animated header */
function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <motion.section variants={fadeUp} className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Icon size={14} className="text-primary" />
        </div>
        <h2 className="font-display text-sm font-black uppercase tracking-[0.12em] text-base-content/70">
          {title}
        </h2>
        <div className="flex-1 h-px bg-base-300" />
      </div>
      {children}
    </motion.section>
  );
}

/** Recharts custom tooltip */
function ChartTip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 shadow-depth text-xs">
      <p className="font-bold text-base-content/60 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono font-bold">
          {prefix}{Number(p.value).toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
}

/** Tier badge */
const TIER_META = {
  Diamond: { bg: 'bg-info/10 border-info/30 text-info',     emoji: '💎' },
  Platinum:{ bg: 'bg-primary/10 border-primary/30 text-primary', emoji: '⭐' },
  Gold:    { bg: 'bg-accent/10 border-accent/30 text-accent',   emoji: '🥇' },
  Silver:  { bg: 'bg-neutral/10 border-neutral/30 text-base-content', emoji: '🥈' },
  Bronze:  { bg: 'bg-warning/10 border-warning/30 text-warning', emoji: '🥉' },
};

function TierBadge({ tier }) {
  const meta = TIER_META[tier] || TIER_META.Bronze;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${meta.bg}`}>
      <span>{meta.emoji}</span> {tier}
    </span>
  );
}

/** Dispatch status pill */
function StatusPill({ status }) {
  const map = {
    Available: 'bg-success/10 border-success/40 text-success',
    'On-Trip':  'bg-info/10 border-info/40 text-info',
    'On-Break': 'bg-warning/10 border-warning/40 text-warning',
    Offline:    'bg-base-300/60 border-base-300 text-base-content/50',
    Suspended:  'bg-error/10 border-error/40 text-error',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${map[status] || map.Offline}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'Available' ? 'bg-success animate-pulse' : 'bg-current'}`} />
      {status || 'Offline'}
    </span>
  );
}

/** Skeleton loader */
function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

// ─── Custom radial bar label ──────────────────────────────────────────────────
function RatingLabel({ cx, cy, value }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan className="font-mono font-black fill-[var(--base-content)]" fontSize="28">
        {value}
      </tspan>
      <tspan className="fill-[var(--base-content)] opacity-50" fontSize="12" dx="2">
        /5
      </tspan>
    </text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function PerformancePage() {
  const dispatch = useDispatch();

  /* ── Selectors ── */
  const perf       = useSelector(selectPerformance);
  const rewards    = useSelector(selectRewards);
  const badges     = useSelector(selectBadges);
  const dispatch_  = useSelector(selectDispatch);
  const compliance = useSelector(selectCompliance);
  const kyc        = useSelector(selectKyc);
  const vehicle    = useSelector(selectVehicle);

  const loadingPerf  = useSelector(selectLoading('performance'));
  const loadingComp  = useSelector(selectLoading('compliance'));
  const loadingRew   = useSelector(selectLoading('rewards'));

  /* ── Fetch on mount ── */
  useEffect(() => {
    dispatch(fetchPerformance());
    dispatch(fetchRewards());
    dispatch(fetchRewardBadges());
    dispatch(fetchDispatchStatus());
    dispatch(fetchComplianceDashboard());
    dispatch(fetchKycStatus());
    dispatch(fetchVehicle());
  }, [dispatch]);

  /* ── Derived data ── */
  const dp   = perf?.driverPerformance || {};
  const st   = perf?.stats            || {};
  const rat  = perf?.rating           || {};
  const tier = perf?.tier             || rewards?.tier || 'Bronze';

  const rating      = rat.averageRating || dp.rating || 0;
  const totalRides  = rat.totalRides    || dp.totalRidesCompleted || st.totalRidesCompleted || 0;
  const earnings    = dp.totalEarnings  || st.totalEarnings || 0;
  const completion  = perf?.profileCompletion ?? 0;

  const radialData = [{ name: 'Rating', value: rating, fill: 'var(--color-primary)' }];

  const compDocs  = compliance?.documents || [];
  const overallStatus = compliance?.overallStatus || 'good';

  const coinBalance  = rewards?.coinBalance  || 0;
  const coinsEarned  = rewards?.coinsEarned  || 0;
  const coinsRedeem  = rewards?.coinsRedeemed || 0;

  /* ── Header status colours ── */
  const headerGradient = {
    good:     'from-success/10 via-transparent to-transparent',
    warning:  'from-warning/10 via-transparent to-transparent',
    critical: 'from-error/10 via-transparent to-transparent',
  }[overallStatus] || 'from-primary/5 via-transparent to-transparent';

  /* ── Loading state ── */
  const pageLoading = loadingPerf || loadingComp || loadingRew;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      data-theme="solodriverpartner"
      className="min-h-screen bg-base-100 font-poppins"
      style={{ fontFamily: 'var(--font-family-poppins)' }}
    >
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`relative overflow-hidden border-b border-base-300 bg-gradient-to-r ${headerGradient}`}
      >
        {/* Decorative grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(var(--base-content) 1px,transparent 1px),linear-gradient(90deg,var(--base-content) 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />


               <BackButton className=' my-2 rounded-md px-3' />
         

        <div className="container-custom py-8 md:py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-primary" />
                <span className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-base-content/40">
                  Performance Dashboard
                </span>
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-base-content">
                Your Drive,{' '}
                <span className="text-gradient-primary">Your Stats</span>
              </h1>
              <p className="mt-1.5 text-sm text-base-content/50 font-medium">
                Real-time performance, compliance, and rewards at a glance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {dispatch_?.status && <StatusPill status={dispatch_.status} />}
              {tier && <TierBadge tier={tier} />}
              {dispatch_?.isDispatchable && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
                  <Zap size={13} /> Dispatch Ready
                </span>
              )}
            </div>
          </div>

          {/* Profile completion bar */}
          <div className="mt-6 max-w-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                Profile Completion
              </span>
              <span className="font-mono text-xs font-black text-primary">{completion}%</span>
            </div>
            <div className="progress-bar h-1.5">
              <motion.div
                className="progress-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Body ── */}
      <div className="container-custom py-8 md:py-10 space-y-10">

        {/* ══ §1  Key Metrics Strip ══ */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {pageLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[130px]" />
            ))
          ) : (
            <>
              <MetricCard
                icon={BarChart2}
                label="Total Rides"
                value={fmt(totalRides)}
                sub={`+${RIDES_TREND.slice(-1)[0]?.rides ?? 0} this wk`}
                glow
              />
              <MetricCard
                icon={Wallet}
                label="Total Earnings"
                value={fmt(earnings, '₹')}
                accent
              />
              <MetricCard
                icon={Target}
                label="On-Time Arrival"
                value={pct(st.onTimeArrivalRate ?? dp.onTimeArrivalRate ?? 100)}
                sub="Target 95%"
              />
              <MetricCard
                icon={Flame}
                label="Monthly Rides"
                value={fmt(dp.monthlyRides ?? 0)}
              />
            </>
          )}
        </motion.div>

        {/* ══ §2  Charts Row ══ */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >

          {/* Rides & Earnings trend */}
          <motion.div
            variants={fadeUp}
            className="lg:col-span-2 card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-base-content/50">
                  Rides & Earnings
                </p>
                <p className="text-xl font-display font-black text-base-content mt-0.5">
                  Weekly Trend
                </p>
              </div>
              <TrendingUp size={18} className="text-primary" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={RIDES_TREND} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rideGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--color-base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4' }} />
                <Area type="monotone" dataKey="earnings" stroke="var(--color-primary)" strokeWidth={2} fill="url(#earnGrad)" dot={false} name="Earnings (₹)" />
                <Area type="monotone" dataKey="rides"    stroke="var(--color-accent)"  strokeWidth={2} fill="url(#rideGrad)"  dot={false} name="Rides" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-6 pt-2">
              {[
                { color: 'bg-primary', label: 'Earnings (₹)' },
                { color: 'bg-accent',  label: 'Rides' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-xs text-base-content/50 font-semibold">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Rating radial */}
          <motion.div variants={fadeUp} className="card p-6 flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-base-content/50">
                Driver Rating
              </p>
              <Star size={16} className="text-accent" />
            </div>

            <div className="relative w-full">
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart
                  cx="50%" cy="55%"
                  innerRadius="72%" outerRadius="100%"
                  barSize={12}
                  data={[{ value: (rating / 5) * 100, fill: 'var(--color-primary)' }]}
                  startAngle={225} endAngle={-45}
                >
                  <RadialBar background={{ fill: 'var(--color-base-300)' }} dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>

              {/* Centre text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: '8%' }}>
                <span className="font-mono text-4xl font-black text-base-content leading-none">
                  {rating ? rating.toFixed(1) : '—'}
                </span>
                <span className="text-xs font-bold text-base-content/40 mt-1">out of 5.0</span>
              </div>
            </div>

            <div className="w-full grid grid-cols-3 gap-2 mt-2">
              {[
                { label: 'Ratings', val: fmt(rat.totalRatings) },
                { label: 'Compliments', val: fmt(dp.complimentsCount ?? 0) },
                { label: 'Complaints', val: fmt(dp.complaintsCount ?? 0) },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <p className="font-mono text-lg font-black text-base-content">{val}</p>
                  <p className="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* ══ §3  Distance + Cancellation ══ */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Monthly distance */}
          <motion.div variants={fadeUp} className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-base-content/50">Distance Covered</p>
                <p className="text-xl font-display font-black text-base-content mt-0.5">Monthly (km)</p>
              </div>
              <MapPin size={18} className="text-primary" />
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={MONTHLY_DIST} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--color-primary)', opacity: 0.06 }} />
                <Bar dataKey="km" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {MONTHLY_DIST.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === MONTHLY_DIST.length - 1 ? 'var(--color-primary)' : 'var(--color-base-300)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-base-content/40 font-semibold">
              Total: {fmt(dp.totalDistanceKm ?? 0)} km lifetime
            </p>
          </motion.div>

          {/* Cancellation & secondary stats */}
          <motion.div variants={fadeUp} className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-base-content/50">Ride Breakdown</p>
              <Activity size={18} className="text-primary" />
            </div>

            <div className="space-y-3">
              {[
                {
                  label: 'Completed',
                  value: totalRides,
                  max: totalRides + (st.totalRidesCancelled || 0) + (st.totalRidesDisputed || 0),
                  color: 'bg-success',
                  textColor: 'text-success',
                },
                {
                  label: 'Cancelled',
                  value: st.totalRidesCancelled || dp.totalRidesCancelled || 0,
                  max: totalRides + (st.totalRidesCancelled || 0) + (st.totalRidesDisputed || 0),
                  color: 'bg-error',
                  textColor: 'text-error',
                },
                {
                  label: 'Disputed',
                  value: st.totalRidesDisputed || 0,
                  max: totalRides + (st.totalRidesCancelled || 0) + (st.totalRidesDisputed || 0),
                  color: 'bg-warning',
                  textColor: 'text-warning',
                },
              ].map(({ label, value, max, color, textColor }) => {
                const width = max ? Math.round((value / max) * 100) : 0;
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-base-content/70">{label}</span>
                      <span className={`font-mono font-black ${textColor}`}>{fmt(value)}</span>
                    </div>
                    <div className="h-2 bg-base-300 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-base-300 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-base-content/40 uppercase tracking-wider font-semibold">Cancellation Rate</p>
                <p className="font-mono text-xl font-black text-base-content mt-1">
                  {pct(dp.cancellationRate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/40 uppercase tracking-wider font-semibold">Avg Pickup</p>
                <p className="font-mono text-xl font-black text-base-content mt-1">
                  {dp.avgPickupTimeMinutes ?? st.averagePickupTimeMinutes ?? '—'} min
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ══ §4  Compliance Timeline ══ */}
        <Section title="Document Compliance" icon={ShieldCheck}>
          {loadingComp ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : compDocs.length === 0 ? (
            <div className="card p-8 text-center text-base-content/40 text-sm font-semibold">
              No compliance documents found
            </div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              {compDocs.map((doc) => {
                const days = daysLeft(doc.expiry);
                return (
                  <motion.div
                    key={doc.label}
                    variants={scaleIn}
                    className={`relative rounded-xl border p-4 flex flex-col gap-2 ${complianceColor(doc.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                        {doc.label}
                      </span>
                      {complianceIcon(doc.status)}
                    </div>
                    <div>
                      <p className="font-mono text-base font-black">
                        {doc.status === 'missing'
                          ? 'Not Uploaded'
                          : days !== null && days >= 0
                          ? `${days}d left`
                          : 'Expired'}
                      </p>
                      {doc.expiry && (
                        <p className="text-[10px] opacity-60 font-semibold mt-0.5">
                          {new Date(doc.expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Overall badge */}
          {!loadingComp && (
            <div className="flex items-center gap-3 pt-2">
              {overallStatus === 'good' && (
                <div className="flex items-center gap-2 text-success text-sm font-bold">
                  <ShieldCheck size={16} /> All documents in order
                </div>
              )}
              {overallStatus === 'warning' && (
                <div className="flex items-center gap-2 text-warning text-sm font-bold">
                  <ShieldAlert size={16} /> Some documents expiring soon — renew to stay active
                </div>
              )}
              {overallStatus === 'critical' && (
                <div className="flex items-center gap-2 text-error text-sm font-bold">
                  <ShieldX size={16} /> Expired documents detected — action required immediately
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ══ §5  Rewards & Coins ══ */}
        <Section title="Rewards & Coins" icon={Award}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Coin balance */}
            <motion.div
              variants={fadeUp}
              className="card p-6 col-span-1 flex flex-col gap-4 relative overflow-hidden"
            >
              <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-base-content/50">Coin Balance</p>
                <Coins size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-mono text-5xl font-black text-accent">{fmt(coinBalance)}</p>
                <p className="text-xs text-base-content/40 font-semibold mt-1">
                  ≈ ₹{((coinBalance || 0) / 100).toFixed(2)} value
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-base-300">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold">Earned</p>
                  <p className="font-mono font-black text-success">{fmt(coinsEarned)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold">Redeemed</p>
                  <p className="font-mono font-black text-base-content/60">{fmt(coinsRedeem)}</p>
                </div>
              </div>
            </motion.div>

            {/* Badges grid */}
            <motion.div variants={fadeUp} className="card p-6 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-base-content/50">Earned Badges</p>
                <BadgeCheck size={18} className="text-primary" />
              </div>
              {loadingRew ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : badges.length === 0 ? (
                <div className="text-center text-base-content/40 text-sm font-semibold py-8">
                  No badges earned yet — keep driving!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {badges.map((badge) => (
                      <motion.div
                        key={badge.badgeId}
                        variants={scaleIn}
                        className="flex flex-col items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center hover:bg-primary/10 transition-colors cursor-default"
                      >
                        {badge.iconUrl ? (
                          <img src={badge.iconUrl} alt={badge.name} className="h-8 w-8 object-contain" />
                        ) : (
                          <Award size={24} className="text-primary" />
                        )}
                        <p className="text-xs font-bold text-base-content leading-tight">{badge.name}</p>
                        {badge.earnedAt && (
                          <p className="text-[9px] text-base-content/40 font-semibold">
                            {new Date(badge.earnedAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </motion.div>
        </Section>

        {/* ══ §6  Vehicle & Dispatch Quick View ══ */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Vehicle card */}
          <motion.div variants={fadeUp} className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-base-content/50">My Vehicle</p>
              <Car size={18} className="text-primary" />
            </div>

            {vehicle ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-xl font-black text-base-content">
                      {vehicle.make} {vehicle.model}
                    </p>
                    <p className="font-mono text-xs text-base-content/50 mt-1">
                      {vehicle.registrationNumber}
                    </p>
                  </div>
                  <span
                    className={`badge text-[10px] ${
                      vehicle.verificationStatus === 'verified'
                        ? 'badge-success'
                        : vehicle.verificationStatus === 'rejected'
                        ? 'badge-error'
                        : 'badge-warning'
                    }`}
                  >
                    {vehicle.verificationStatus || 'pending'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Type',     val: vehicle.vehicleType },
                    { label: 'Year',     val: vehicle.year },
                    { label: 'Color',    val: vehicle.color || '—' },
                    { label: 'Seating',  val: `${vehicle.seatingCapacity ?? '—'} seats` },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-base-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold">{label}</p>
                      <p className="text-sm font-bold text-base-content mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Accessibility features */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {vehicle.isWheelchairAccessible && <span className="badge badge-primary badge-sm">♿ Wheelchair</span>}
                  {vehicle.hasStretcherSupport    && <span className="badge badge-primary badge-sm">🚑 Stretcher</span>}
                  {vehicle.hasOxygenSupport       && <span className="badge badge-primary badge-sm">🫁 Oxygen</span>}
                  {vehicle.hasMedicalKit          && <span className="badge badge-success badge-sm">🩺 Med Kit</span>}
                  {vehicle.hasAC                  && <span className="badge badge-info badge-sm">❄ AC</span>}
                </div>
              </>
            ) : (
              <div className="text-sm text-base-content/40 font-semibold text-center py-6">
                No vehicle registered
              </div>
            )}
          </motion.div>

          {/* Dispatch status card */}
          <motion.div variants={fadeUp} className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-base-content/50">Dispatch Status</p>
              <Zap size={18} className="text-primary" />
            </div>

            {dispatch_ ? (
              <>
                <div className="flex items-center gap-4">
                  <StatusPill status={dispatch_.status} />
                  {dispatch_.isDispatchable
                    ? <span className="text-xs font-bold text-success flex items-center gap-1"><CheckCircle2 size={13}/> Ready for rides</span>
                    : <span className="text-xs font-bold text-error flex items-center gap-1"><XCircle size={13}/> Not dispatch ready</span>
                  }
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Partnership',       val: dispatch_.partnershipStatus, ok: dispatch_.partnershipStatus === 'active' },
                    { label: 'Onboarding',        val: dispatch_.isOnboardingComplete ? 'Complete' : 'Pending', ok: dispatch_.isOnboardingComplete },
                    { label: 'KYC',               val: dispatch_.kycVerified ? 'Verified' : 'Pending', ok: dispatch_.kycVerified },
                  ].map(({ label, val, ok }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-base-content/60 font-semibold">{label}</span>
                      <span className={`flex items-center gap-1.5 font-bold font-mono ${ok ? 'text-success' : 'text-warning'}`}>
                        {ok ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                        {val}
                      </span>
                    </div>
                  ))}
                </div>

                {dispatch_.shift && (
                  <div className="pt-3 border-t border-base-300">
                    <p className="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold mb-2">Current Shift</p>
                    <div className="flex items-center gap-3 text-sm font-bold text-base-content">
                      <Clock size={14} className="text-primary" />
                      <span>{dispatch_.shift.shiftType || 'Full-Day'}</span>
                      <span className="text-base-content/40">·</span>
                      <span className="font-mono text-xs text-base-content/60">
                        {dispatch_.shift.startTime} – {dispatch_.shift.endTime}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Skeleton className="h-32" />
            )}
          </motion.div>
        </motion.div>

        {/* ══ §7  KYC Status Banner ══ */}
        {kyc && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div
              className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                kyc.kyc?.verificationStatus === 'verified'
                  ? 'border-success/40 bg-success/5'
                  : kyc.kyc?.verificationStatus === 'rejected'
                  ? 'border-error/40 bg-error/5'
                  : 'border-warning/40 bg-warning/5'
              }`}
            >
              <div className="flex items-center gap-3">
                {kyc.kyc?.verificationStatus === 'verified' ? (
                  <ShieldCheck size={20} className="text-success" />
                ) : kyc.kyc?.verificationStatus === 'rejected' ? (
                  <ShieldX size={20} className="text-error" />
                ) : (
                  <ShieldAlert size={20} className="text-warning" />
                )}
                <div>
                  <p className="font-bold text-base-content">
                    KYC Status:{' '}
                    <span className="capitalize font-mono">
                      {kyc.kyc?.verificationStatus || 'not-submitted'}
                    </span>
                  </p>
                  {kyc.isOnboardingComplete
                    ? <p className="text-xs text-success font-semibold mt-0.5">Onboarding complete ✓</p>
                    : <p className="text-xs text-warning font-semibold mt-0.5">Complete onboarding to start accepting rides</p>
                  }
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-base-content/60">
                  Profile: <span className="text-primary font-mono">{kyc.profileCompletionPercent ?? 0}%</span>
                </p>
                <ChevronRight size={16} className="text-base-content/30" />
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ §8  Footer refresh hint ══ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-2 text-xs text-base-content/30 font-semibold pb-4"
        >
          <RefreshCw size={11} />
          Data refreshed on mount · Cached up to 2 min
        </motion.div>

      </div>
    </div>
  );
}