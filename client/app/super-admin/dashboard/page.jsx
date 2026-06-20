"use client";

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  CalendarCheck2,
  ShoppingBag,
  CreditCard,
  Stethoscope,
  Building2,
  Car,
  FlaskConical,
  Droplets,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  BadgeAlert,
  Wallet,
  Star,
  Activity,
} from "lucide-react";

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
} from "@/store/slices/adminAnalyticsSlice";

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const pulseVariants = {
  animate: {
    scale: [1, 1.04, 1],
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n, opts = {}) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-IN", opts);
};

const fmtCurrency = (n) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(2)}`;
};

const TrendIcon = ({ trend, size = 14 }) => {
  if (trend === "up") return <TrendingUp size={size} className="text-success" />;
  if (trend === "down") return <TrendingDown size={size} className="text-error" />;
  return <Minus size={size} className="text-warning" />;
};

const TrendBadge = ({ trend, changePercent }) => {
  const colorClass =
    trend === "up"
      ? "bg-success/10 text-success border-success/30"
      : trend === "down"
      ? "bg-error/10 text-error border-error/30"
      : "bg-warning/10 text-warning border-warning/30";

  return (
    <span
      className={`badge badge-xs border ${colorClass} flex items-center gap-1`}
    >
      <TrendIcon trend={trend} size={10} />
      {Math.abs(changePercent ?? 0)}%
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="card p-5 space-y-3">
    <div className="skeleton h-4 w-24 rounded" />
    <div className="skeleton h-8 w-32 rounded" />
    <div className="skeleton h-3 w-16 rounded" />
  </div>
);

const SkeletonChart = ({ h = "h-56" }) => (
  <div className={`card p-5 ${h} flex items-end gap-2 overflow-hidden`}>
    {[60, 80, 45, 90, 55, 70, 40, 85, 65, 75, 50, 95].map((v, i) => (
      <div
        key={i}
        className="skeleton flex-1 rounded-t"
        style={{ height: `${v}%` }}
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, trend, changePercent, iconBg, delay = 0 }) => (
  <motion.div
    variants={cardVariants}
    whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
    className="card p-5 flex flex-col gap-3 cursor-default"
  >
    <div className="flex items-start justify-between">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}
      >
        <Icon size={20} className="text-primary" />
      </div>
      {trend && <TrendBadge trend={trend} changePercent={changePercent} />}
    </div>
    <div>
      <p className="stat-card-label">{label}</p>
      <motion.p
        className="stat-card-value mt-1"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.15, type: "spring", stiffness: 200 }}
      >
        {value}
      </motion.p>
    </div>
    {sub && (
      <p className="text-base-content/50 text-xs">{sub}</p>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label, currency = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card !hover:transform-none px-3 py-2 text-xs shadow-depth">
      <p className="font-semibold text-base-content/70 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {currency ? fmtCurrency(p.value) : fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING SNAPSHOT CARD
// ─────────────────────────────────────────────────────────────────────────────

const BookingSnapshotCard = ({ snapshot }) => {
  const items = [
    { label: "Active", value: snapshot?.active ?? 0, icon: Activity, cls: "text-info bg-info/10" },
    { label: "Completed", value: snapshot?.completed ?? 0, icon: CheckCircle2, cls: "text-success bg-success/10" },
    { label: "Cancelled", value: snapshot?.cancelled ?? 0, icon: XCircle, cls: "text-error bg-error/10" },
  ];

  const total = (snapshot?.active ?? 0) + (snapshot?.completed ?? 0) + (snapshot?.cancelled ?? 0);

  return (
    <motion.div variants={cardVariants} className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-montserrat font-bold text-base text-base-content">
          Booking Status
        </h3>
        <span className="badge badge-sm badge-primary">{fmt(total)} total</span>
      </div>
      <div className="space-y-3">
        {items.map(({ label, value, icon: Icon, cls }) => {
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className={`flex items-center gap-2 px-2 py-0.5 rounded-lg ${cls}`}>
                  <Icon size={13} />
                  <span className="font-semibold">{label}</span>
                </div>
                <span className="font-bold text-base-content">{fmt(value)}</span>
              </div>
              <div className="progress-bar">
                <motion.div
                  className="progress-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM REVENUE CARD
// ─────────────────────────────────────────────────────────────────────────────

const RevenueCard = ({ revenue }) => {
  const data = revenue
    ? [
        { name: "Bookings", value: revenue.bookingRevenue ?? 0 },
        { name: "Pharmacy", value: revenue.pharmacyRevenue ?? 0 },
      ]
    : [];

  const COLORS = ["var(--chart-1)", "var(--chart-2)"];

  return (
    <motion.div variants={cardVariants} className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-montserrat font-bold text-base text-base-content">
          Revenue Breakdown
        </h3>
        <span className="badge badge-sm badge-accent">{fmtCurrency(revenue?.total)}</span>
      </div>

      {data.every((d) => d.value === 0) ? (
        <p className="text-base-content/40 text-sm text-center py-8">No revenue data</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-36 h-36 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={4}
                  dataKey="value"
                  animationBegin={300}
                  animationDuration={900}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip currency />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 flex-1">
            {data.map((d, i) => (
              <div key={d.name} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: COLORS[i] }}
                    />
                    {d.name}
                  </span>
                  <span className="text-base-content">{fmtCurrency(d.value)}</span>
                </div>
                <div className="progress-bar !h-1.5">
                  <motion.div
                    className="progress-bar-fill"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${revenue?.total > 0 ? (d.value / revenue.total) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TREND CHART (Area)
// ─────────────────────────────────────────────────────────────────────────────

const TrendAreaChart = ({ trends }) => {
  if (!trends) return null;

  const data = Object.entries(trends).map(([key, val]) => ({
    metric: key.charAt(0).toUpperCase() + key.slice(1),
    current: val.current ?? 0,
    previous: val.previous ?? 0,
    change: val.changePercent ?? 0,
  }));

  return (
    <motion.div variants={cardVariants} className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-montserrat font-bold text-base text-base-content">
          Period Comparison
        </h3>
        <p className="text-base-content/40 text-xs">Current vs Previous</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barGap={6} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
          <XAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.55 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.55 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />
          <Bar dataKey="current" name="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar dataKey="previous" name="Previous" fill="var(--chart-2)" radius={[4, 4, 0, 0]} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM TOTALS GRID
// ─────────────────────────────────────────────────────────────────────────────

const TotalsGrid = ({ totals }) => {
  const items = [
    { label: "Doctors", value: fmt(totals?.doctors), icon: Stethoscope },
    { label: "Hospitals", value: fmt(totals?.hospitals), icon: Building2 },
    { label: "Drivers", value: fmt(totals?.drivers), icon: Car },
    { label: "Lab Partners", value: fmt(totals?.labPartners), icon: FlaskConical },
    { label: "Blood Banks", value: fmt(totals?.bloodBanks), icon: Droplets },
    { label: "Subscriptions", value: fmt(totals?.subscriptions), icon: CreditCard },
    { label: "Pharmacy Orders", value: fmt(totals?.pharmacyOrders), icon: ShoppingBag },
    { label: "Bookings", value: fmt(totals?.bookings), icon: CalendarCheck2 },
  ];

  return (
    <motion.div variants={cardVariants} className="card p-5 space-y-4">
      <h3 className="font-montserrat font-bold text-base text-base-content">
        Platform Totals
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(({ label, value, icon: Icon }, i) => (
          <motion.div
            key={label}
            className="bg-base-200 rounded-xl p-3 flex flex-col gap-1.5 border border-base-300 hover:border-primary/30 transition-colors duration-200"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, type: "spring", stiffness: 220 }}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
              <Icon size={15} className="text-primary" />
            </div>
            <p className="font-montserrat font-extrabold text-lg text-primary leading-none">
              {value}
            </p>
            <p className="text-base-content/50 text-xs font-semibold uppercase tracking-wider">
              {label}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ALERT STRIP
// ─────────────────────────────────────────────────────────────────────────────

const AlertStrip = ({ pendingKyc, activeSubs, driverOnDuty }) => {
  const alerts = [
    pendingKyc > 0 && {
      icon: BadgeAlert,
      text: `${pendingKyc} doctor${pendingKyc > 1 ? "s" : ""} awaiting KYC`,
      cls: "alert-warning",
    },
    activeSubs > 0 && {
      icon: Star,
      text: `${fmt(activeSubs)} active subscriptions`,
      cls: "alert-success",
    },
    driverOnDuty > 0 && {
      icon: Car,
      text: `${fmt(driverOnDuty)} driver${driverOnDuty > 1 ? "s" : ""} on duty`,
      cls: "alert-info",
    },
  ].filter(Boolean);

  if (!alerts.length) return null;

  return (
    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
      {alerts.map(({ icon: Icon, text, cls }, i) => (
        <div key={i} className={`alert ${cls} flex-1 py-2.5`}>
          <Icon size={15} />
          <span className="text-xs font-semibold">{text}</span>
        </div>
      ))}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────

const ErrorState = ({ error, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="card p-10 flex flex-col items-center gap-4 text-center"
  >
    <motion.div
      animate={{ rotate: [0, -5, 5, 0] }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <AlertCircle size={40} className="text-error" />
    </motion.div>
    <div>
      <p className="font-montserrat font-bold text-base-content">Failed to load overview</p>
      <p className="text-base-content/50 text-sm mt-1">{error}</p>
    </div>
    <button onClick={onRetry} className="btn btn-primary btn-sm gap-2">
      <RefreshCw size={14} /> Retry
    </button>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

const PageHeader = ({ period, loading, onRefresh }) => (
  <motion.div
    variants={fadeUp}
    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
  >
    <div>
      <h1 className="font-montserrat font-black text-2xl md:text-3xl text-base-content tracking-tight">
        Dashboard{" "}
        <span className="text-gradient-primary">Overview</span>
      </h1>
      {period && (
        <p className="text-base-content/40 text-xs mt-1 flex items-center gap-1">
          <Clock size={11} />
          {new Date(period.from).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}{" "}
          —{" "}
          {new Date(period.to).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </div>
    <button
      onClick={onRefresh}
      disabled={loading}
      className="btn btn-outline btn-sm gap-2 self-start sm:self-auto"
    >
      <motion.span
        animate={loading ? { rotate: 360 } : {}}
        transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
      >
        <RefreshCw size={13} />
      </motion.span>
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Overview() {
  const dispatch = useDispatch();

  const data = useSelector(selectOverviewData);
  const loading = useSelector(selectOverviewLoading);
  const error = useSelector(selectOverviewError);
  const trends = useSelector(selectOverviewTrends);
  const totals = useSelector(selectOverviewTotals);
  const revenue = useSelector(selectOverviewRevenue);
  const pendingKyc = useSelector(selectPendingKycDoctors);
  const activeSubs = useSelector(selectActiveSubscriptions);

  const load = useCallback(() => {
    dispatch(fetchOverview());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  // ── TOP METRIC CARDS ────────────────────────────────────────────────────────

  const topCards = [
    {
      icon: Users,
      label: "New Users",
      value: fmt(trends?.users?.current),
      trend: trends?.users?.trend,
      changePercent: trends?.users?.changePercent,
      sub: `${fmt(totals?.users)} total users`,
      iconBg: "bg-primary/8",
    },
    {
      icon: CalendarCheck2,
      label: "New Bookings",
      value: fmt(trends?.bookings?.current),
      trend: trends?.bookings?.trend,
      changePercent: trends?.bookings?.changePercent,
      sub: `${fmt(totals?.bookings)} all time`,
      iconBg: "bg-secondary/10",
    },
    {
      icon: ShoppingBag,
      label: "Pharmacy Orders",
      value: fmt(trends?.pharmacyOrders?.current),
      trend: trends?.pharmacyOrders?.trend,
      changePercent: trends?.pharmacyOrders?.changePercent,
      sub: `${fmt(totals?.pharmacyOrders)} all time`,
      iconBg: "bg-success/10",
    },
    {
      icon: CreditCard,
      label: "New Subscriptions",
      value: fmt(trends?.subscriptions?.current),
      trend: trends?.subscriptions?.trend,
      changePercent: trends?.subscriptions?.changePercent,
      sub: `${fmt(totals?.subscriptions)} total`,
      iconBg: "bg-accent/5",
    },
    {
      icon: Wallet,
      label: "Period Revenue",
      value: fmtCurrency(revenue?.total),
      trend: null,
      sub: `Bookings + Pharmacy`,
      iconBg: "bg-warning/10",
    },
    {
      icon: Car,
      label: "Drivers On Duty",
      value: fmt(data?.driverSnapshot?.onDuty),
      trend: null,
      sub: `${fmt(totals?.drivers)} total drivers`,
      iconBg: "bg-info/10",
    },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <motion.section
      className="space-y-6 p-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* HEADER */}
      <PageHeader
        period={data?.period}
        loading={loading}
        onRefresh={load}
      />

      {/* ALERT STRIP */}
      <AnimatePresence>
        {!loading && data && (
          <AlertStrip
            pendingKyc={pendingKyc}
            activeSubs={activeSubs}
            driverOnDuty={data?.driverSnapshot?.onDuty}
          />
        )}
      </AnimatePresence>

      {/* ERROR */}
      <AnimatePresence>
        {error && !loading && <ErrorState error={error} onRetry={load} />}
      </AnimatePresence>

      {/* TOP METRIC CARDS */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : topCards.map((card, i) => (
              <StatCard key={card.label} {...card} delay={i * 0.05} />
            ))}
      </motion.div>

      {/* MID ROW — booking snapshot + revenue */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        variants={containerVariants}
      >
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <BookingSnapshotCard snapshot={data?.bookingSnapshot} />
            <RevenueCard revenue={revenue} />
          </>
        )}
      </motion.div>

      {/* TREND COMPARISON CHART */}
      {loading ? (
        <SkeletonChart h="h-64" />
      ) : (
        trends && <TrendAreaChart trends={trends} />
      )}

      {/* PLATFORM TOTALS */}
      {loading ? (
        <SkeletonCard />
      ) : (
        totals && <TotalsGrid totals={totals} />
      )}

      {/* PERIOD STAMP */}
      {!loading && data && (
        <motion.p
          variants={fadeUp}
          className="text-center text-base-content/30 text-xs"
        >
          Last refreshed {new Date().toLocaleTimeString("en-IN")}
        </motion.p>
      )}
    </motion.section>
  );
}