"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart as AreaChartIcon,
  TrendingUp,
  RotateCcw,
  Pill,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  ShoppingBag,
  IndianRupee,
  BarChart2,
  PackageX,
  PackageCheck,
  Truck,
  Percent,
  Target,
  Zap,
  TrendingDown,
  Award,
  Hash,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Scatter,
  ReferenceLine,
  Brush,
} from "recharts";
import {
  fetchAnalyticsOverview,
  fetchRevenueAnalytics,
  fetchReturnAnalytics,
  fetchTopMedicines,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

// ─── CSS variables pulled from globals.css pharmacy theme ────────────────────
const C = {
  primary:    "var(--color-primary,   oklch(50% .20 155))",
  secondary:  "var(--color-secondary, oklch(64% .14 170))",
  accent:     "var(--color-accent,    oklch(70% .17  88))",
  success:    "var(--color-success,   oklch(60% .20 152))",
  warning:    "var(--color-warning,   oklch(72% .17  72))",
  error:      "var(--color-error,     oklch(60% .22  22))",
  info:       "var(--color-info,      oklch(60% .16 228))",
  base100:    "var(--color-base-100)",
  base200:    "var(--color-base-200)",
  base300:    "var(--color-base-300)",
  content:    "var(--color-base-content)",
  // Chart palette — intentionally distinct, pharmacy-contextual
  chart: [
    "#22c55e",  // vivid green  — revenue
    "#3b82f6",  // clear blue   — orders
    "#f59e0b",  // warm amber   — warnings/returns
    "#ef4444",  // red          — errors/high return
    "#8b5cf6",  // violet       — premium medicines
    "#06b6d4",  // cyan         — info
    "#f97316",  // orange       — mid tier
    "#ec4899",  // pink         — 8th category
  ],
};

// ─── format helpers ──────────────────────────────────────────────────────────
const fmtCur = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n ?? 0);

const fmtShort = (n) => {
  if (!n && n !== 0) return "—";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
};

const fmtNum = (n) =>
  new Intl.NumberFormat("en-IN").format(n ?? 0);

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : 0);

// ─── motion presets ──────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [.25,.46,.45,.94] } } };
const fadeIn  = { hidden: { opacity: 0 },         show: { opacity: 1, transition: { duration: 0.35 } } };
const stagger = (delay = 0.06) => ({ hidden: {}, show: { transition: { staggerChildren: delay } } });
const scaleIn = { hidden: { opacity: 0, scale: 0.93 }, show: { opacity: 1, scale: 1, transition: { duration: 0.38, ease: "easeOut" } } };

// ─── custom tooltip (shared) ─────────────────────────────────────────────────
const PharmTooltip = ({ active, payload, label, valueFormatter = fmtCur, labelKey }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl shadow-depth px-4 py-3 min-w-[160px]">
      <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">
        {labelKey ? payload[0]?.payload?.[labelKey] : label}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-base-content/60">{p.name}</span>
          </span>
          <span className="font-bold text-base-content">{valueFormatter(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── reusable primitives ─────────────────────────────────────────────────────

function KpiCard({ label, value, sub, delta, deltaLabel, icon: Icon, accent, loading: isLoading }) {
  const isPos = delta > 0;
  const isNeutral = delta === 0 || delta === undefined;
  return (
    <motion.div variants={scaleIn}
      className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3
        ${accent ? "bg-primary/[.06] border-primary/25" : "bg-base-100 border-base-300"}
        group transition-all duration-300 hover:border-primary/40 hover:shadow-depth`}
    >
      {/* Background watermark */}
      {Icon && (
        <div className="absolute -right-3 -top-3 opacity-[.04] group-hover:opacity-[.07] transition-opacity">
          <Icon size={72} />
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center
          ${accent ? "bg-primary/15" : "bg-base-200"}`}>
          {Icon && <Icon size={16} className={accent ? "text-primary" : "text-base-content/50"} />}
        </div>
        {delta !== undefined && !isNeutral && (
          <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full
            ${isPos ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
            {isPos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="h-8 w-28 bg-base-300 rounded-lg animate-pulse" />
      ) : (
        <div>
          <p className={`text-2xl font-black font-montserrat leading-none
            ${accent ? "text-primary" : "text-base-content"}`}>{value}</p>
          {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-widest text-base-content/45">{label}</p>
      {deltaLabel && !isNeutral && (
        <p className="text-[11px] text-base-content/35">{deltaLabel}</p>
      )}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <motion.div variants={fadeUp} className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-2xl font-black font-montserrat text-base-content tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-base-content/45 mt-1">{subtitle}</p>}
      </div>
      {action}
    </motion.div>
  );
}

function DateFilterBar({ value, onChange }) {
  const opts = [
    { v: "today",       l: "Today" },
    { v: "yesterday",   l: "Yesterday" },
    { v: "last7days",   l: "7 Days" },
    { v: "last30days",  l: "30 Days" },
  ];
  return (
    <div className="flex items-center gap-1 p-1 bg-base-200 rounded-xl">
      {opts.map(({ v, l }) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
            ${value === v
              ? "bg-primary text-primary-content shadow-sm"
              : "text-base-content/50 hover:text-base-content hover:bg-base-100"
            }`}
        >{l}</button>
      ))}
    </div>
  );
}

function RefreshBtn({ onClick, loading: isLoading }) {
  return (
    <button onClick={onClick} disabled={isLoading}
      className="flex items-center gap-2 text-sm text-primary hover:text-primary/70 transition-colors disabled:opacity-50">
      <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );
}

function EmptyState({ message = "No data available for this period" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center">
        <AlertCircle size={24} className="text-base-content/25" />
      </div>
      <p className="text-base-content/35 text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}

function SectionLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-base-300" />
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin absolute inset-0" />
      </div>
      <p className="text-sm text-base-content/40 font-medium">Crunching your data…</p>
    </div>
  );
}

// ─── gradient defs helper ─────────────────────────────────────────────────────
function GradientDefs() {
  return (
    <defs>
      <linearGradient id="gradGreen"  x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradBlue"   x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradAmber"  x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.25} />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.25} />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// §  SECTION 1 — OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function OverviewSection() {
  const dispatch = useDispatch();
  const { analyticsOverview, loading } = useSelector((s) => s.pharmacyStore);
  const [filter, setFilter] = useState("today");

  const load = useCallback((f) => dispatch(fetchAnalyticsOverview({ dateFilter: f })), [dispatch]);
  useEffect(() => { load(filter); }, [filter, load]);

  const d    = analyticsOverview;
  const busy = loading.analyticsOverview;

  // Build status breakdown chart data
  const statusData = useMemo(() => {
    if (!d?.statusBreakdown) return [];
    return Object.entries(d.statusBreakdown)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
      .sort((a, b) => b.value - a.value);
  }, [d]);

  const totalStatus = statusData.reduce((s, x) => s + x.value, 0);

  // KPIs
  const kpis = useMemo(() => {
    if (!d) return [];
    const avgOrder = d.totalOrders ? (d.totalRevenue / d.totalOrders) : 0;
    return [
      { label: "Total Orders",    value: fmtNum(d.totalOrders),  icon: ShoppingBag,   accent: false },
      { label: "Total Revenue",   value: fmtShort(d.totalRevenue), icon: IndianRupee,  accent: true  },
      { label: "GST Collected",   value: fmtShort(d.gstCollected), icon: Percent,      accent: false },
      { label: "Avg Order Value", value: fmtShort(avgOrder),      icon: Target,        accent: false },
    ];
  }, [d]);

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-7">
      <SectionHeader
        title="Analytics Overview"
        subtitle="Real-time performance snapshot across all metrics"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <DateFilterBar value={filter} onChange={(f) => { setFilter(f); load(f); }} />
            <RefreshBtn onClick={() => load(filter)} loading={busy} />
          </div>
        }
      />

      {/* KPI row */}
      <motion.div variants={stagger(0.05)} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {busy
          ? [1,2,3,4].map((i) => (
              <div key={i} className="h-[130px] bg-base-200 rounded-2xl animate-pulse" />
            ))
          : kpis.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))
        }
      </motion.div>

      {/* Two-column: status donut + status bar */}
      {statusData.length > 0 && (
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Donut */}
          <div className="lg:col-span-2 bg-base-100 border border-base-300 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-4">
              Order Status Split
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={C.chart[i % C.chart.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PharmTooltip valueFormatter={fmtNum} />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(v) => <span className="text-xs text-base-content/60">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Horizontal bar breakdown */}
          <div className="lg:col-span-3 bg-base-100 border border-base-300 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-2">
              Status Breakdown
            </p>
            {statusData.map((s, i) => {
              const width = pct(s.value, totalStatus);
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-base-content/70 capitalize">{s.name}</span>
                    <span className="font-bold text-base-content">{fmtNum(s.value)}</span>
                  </div>
                  <div className="h-2 bg-base-300 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.7, delay: i * 0.06, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: C.chart[i % C.chart.length] }}
                    />
                  </div>
                  <p className="text-[11px] text-base-content/35">{width}% of all orders</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Revenue vs GST comparison — composed chart */}
      {d && (
        <motion.div variants={fadeUp}
          className="bg-base-100 border border-base-300 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-5">
            Revenue Composition
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Gross Revenue", value: d.totalRevenue },
                  { name: "GST Collected", value: d.gstCollected },
                  { name: "Net Revenue",   value: d.totalRevenue - d.gstCollected },
                ]}
                layout="vertical"
                margin={{ left: 4, right: 16, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <Tooltip content={<PharmTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                  {["#22c55e","#f59e0b","#3b82f6"].map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {!d && !busy && <EmptyState />}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// §  SECTION 2 — REVENUE TRENDS
// ══════════════════════════════════════════════════════════════════════════════
function RevenueTrendsSection() {
  const dispatch = useDispatch();
  const { revenueAnalytics, loading } = useSelector((s) => s.pharmacyStore);
  const [filter, setFilter] = useState("last30days");

  const load = useCallback((f) => dispatch(fetchRevenueAnalytics({ dateFilter: f })), [dispatch]);
  useEffect(() => { load(filter); }, [filter, load]);

  const raw   = revenueAnalytics?.revenueByDay || [];
  const busy  = loading.analyticsRevenue;

  // Enrich with cumulative and 7-day rolling avg
  const data = useMemo(() => {
    let cumulative = 0;
    return raw.map((row, i) => {
      cumulative += row.revenue || 0;
      const window = raw.slice(Math.max(0, i - 6), i + 1);
      const rollingAvg = window.reduce((s, r) => s + (r.revenue || 0), 0) / window.length;
      return {
        date: row._id?.slice(5),   // MM-DD
        revenue: row.revenue || 0,
        orders:  row.orders  || 0,
        cumulative,
        rollingAvg: Math.round(rollingAvg),
      };
    });
  }, [raw]);

  // Summary stats
  const stats = useMemo(() => {
    if (!data.length) return null;
    const total   = data.reduce((s, d) => s + d.revenue, 0);
    const avgDay  = total / data.length;
    const maxDay  = Math.max(...data.map((d) => d.revenue));
    const minDay  = Math.min(...data.map((d) => d.revenue));
    const peak    = data.find((d) => d.revenue === maxDay);
    return { total, avgDay, maxDay, minDay, peak };
  }, [data]);

  // Orders bars overlay
  const maxOrders  = Math.max(...data.map((d) => d.orders), 1);
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-7">
      <SectionHeader
        title="Revenue Trends"
        subtitle="Daily revenue patterns, growth trajectory, and moving averages"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <DateFilterBar value={filter} onChange={(f) => { setFilter(f); load(f); }} />
            <RefreshBtn onClick={() => load(filter)} loading={busy} />
          </div>
        }
      />

      {/* KPI summary strip */}
      {stats && (
        <motion.div variants={stagger(0.04)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Revenue"      value={fmtShort(stats.total)}  icon={IndianRupee}  accent />
          <KpiCard label="Daily Average"      value={fmtShort(stats.avgDay)} icon={Activity} />
          <KpiCard label="Peak Day Revenue"   value={fmtShort(stats.maxDay)}
            sub={stats.peak ? `on ${stats.peak.date}` : undefined}   icon={Zap} />
          <KpiCard label="Lowest Day"         value={fmtShort(stats.minDay)} icon={TrendingDown} />
        </motion.div>
      )}

      {busy ? <SectionLoader /> : data.length === 0 ? <EmptyState /> : (
        <>
          {/* Main area chart — revenue + rolling avg */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">
                Daily Revenue &amp; 7-Day Rolling Average
              </p>
              <div className="flex items-center gap-5 text-xs text-base-content/50">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] bg-[#22c55e] inline-block rounded" /> Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] bg-[#3b82f6] inline-block rounded border-dashed border-b border-[#3b82f6]" /> 7D Avg
                </span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <GradientDefs />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--color-base-content)", opacity: 0.45 }}
                    axisLine={false} tickLine={false}
                    interval={Math.floor(data.length / 8)}
                  />
                  <YAxis
                    yAxisId="rev"
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.45 }}
                    axisLine={false} tickLine={false}
                    width={52}
                  />
                  <Tooltip content={<PharmTooltip />} />
                  <Area
                    yAxisId="rev"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    fill="url(#gradGreen)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0, fill: "#22c55e" }}
                  />
                  <Line
                    yAxisId="rev"
                    type="monotone"
                    dataKey="rollingAvg"
                    name="7D Avg"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    dot={false}
                  />
                  {stats?.peak && (
                    <ReferenceLine
                      yAxisId="rev"
                      x={stats.peak.date}
                      stroke="#22c55e"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                  )}
                  <Brush
                    dataKey="date"
                    height={22}
                    stroke="var(--color-base-300)"
                    fill="var(--color-base-200)"
                    travellerWidth={6}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Cumulative + daily orders side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cumulative area */}
            <motion.div variants={fadeUp}
              className="bg-base-100 border border-base-300 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-4">
                Cumulative Revenue Growth
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false} interval={Math.floor(data.length / 5)} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, opacity: 0.45 }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<PharmTooltip />} />
                    <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradViolet)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Orders per day bars */}
            <motion.div variants={fadeUp}
              className="bg-base-100 border border-base-300 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-4">
                Orders per Day
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false} interval={Math.floor(data.length / 5)} />
                    <YAxis tick={{ fontSize: 11, opacity: 0.45 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<PharmTooltip valueFormatter={fmtNum} />} />
                    <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                      {data.map((entry, i) => (
                        <Cell key={i}
                          fill={entry.orders === maxOrders ? "#22c55e" : "#3b82f6"}
                          fillOpacity={entry.orders === maxOrders ? 1 : 0.65}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Revenue density heatmap-style table (top/bottom days) */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-4">
              Top &amp; Bottom Revenue Days
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { label: "Top 5 Days",    items: [...data].sort((a,b)=>b.revenue-a.revenue).slice(0,5), color: "#22c55e" },
                { label: "Bottom 5 Days", items: [...data].sort((a,b)=>a.revenue-b.revenue).slice(0,5), color: "#ef4444" },
              ].map(({ label, items, color }) => (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-semibold text-base-content/50">{label}</p>
                  {items.map((row, i) => (
                    <div key={row.date} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-base-content/25 w-4">{i+1}</span>
                      <span className="text-sm font-medium text-base-content/70 flex-1">{row.date}</span>
                      <span className="text-sm font-bold" style={{ color }}>{fmtShort(row.revenue)}</span>
                      <span className="text-xs text-base-content/35">{fmtNum(row.orders)} orders</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// §  SECTION 3 — RETURNS ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════
function ReturnsSection() {
  const dispatch = useDispatch();
  const { returnAnalytics, loading } = useSelector((s) => s.pharmacyStore);
  const [filter, setFilter] = useState("last30days");

  const load = useCallback((f) => dispatch(fetchReturnAnalytics({ dateFilter: f })), [dispatch]);
  useEffect(() => { load(filter); }, [filter, load]);

  const raw  = returnAnalytics?.returnMetrics || [];
  const busy = loading.analyticsReturns;

  // Status → display props
  const statusMeta = {
    Return_Requested: { label: "Requested",    color: "#f59e0b", icon: PackageX },
    Return_Accepted:  { label: "Accepted",     color: "#3b82f6", icon: PackageCheck },
    Returned:         { label: "Fully Returned",color: "#22c55e", icon: Truck },
  };

  const metrics = useMemo(() =>
    raw.map((r) => ({
      ...r,
      ...(statusMeta[r._id] || { label: r._id?.replace(/_/g," "), color: "#8b5cf6", icon: RotateCcw }),
    })), [raw]);

  const totalReturns = metrics.reduce((s, m) => s + m.count, 0);
  const totalValue   = metrics.reduce((s, m) => s + (m.totalValue || 0), 0);

  // Funnel data — show return journey
  const funnelData = [
    { name: "Requested", value: metrics.find(m=>m._id==="Return_Requested")?.count || 0, color: "#f59e0b" },
    { name: "Accepted",  value: metrics.find(m=>m._id==="Return_Accepted")?.count  || 0, color: "#3b82f6" },
    { name: "Completed", value: metrics.find(m=>m._id==="Returned")?.count         || 0, color: "#22c55e" },
  ].filter(d => d.value > 0);

  // Radar for return severity
  const radarData = metrics.map((m) => ({
    metric: m.label,
    count:  m.count,
    value:  Math.round((m.totalValue || 0) / 1000),
  }));

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-7">
      <SectionHeader
        title="Returns Analysis"
        subtitle="Track return requests, acceptance rates, and financial impact"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <DateFilterBar value={filter} onChange={(f) => { setFilter(f); load(f); }} />
            <RefreshBtn onClick={() => load(filter)} loading={busy} />
          </div>
        }
      />

      {busy ? <SectionLoader /> : raw.length === 0 ? (
        <motion.div variants={fadeIn}
          className="bg-success/5 border border-success/20 rounded-2xl p-8 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
            <PackageCheck size={22} className="text-success" />
          </div>
          <p className="font-bold text-base-content text-center">No returns in this period 🎉</p>
          <p className="text-sm text-base-content/45 text-center max-w-xs">
            Zero returns recorded for the selected date range. Excellent fulfillment quality!
          </p>
        </motion.div>
      ) : (
        <>
          {/* KPI cards */}
          <motion.div variants={stagger(0.05)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Returns"    value={fmtNum(totalReturns)} icon={RotateCcw}    accent />
            <KpiCard label="Total Return Value" value={fmtShort(totalValue)} icon={IndianRupee} />
            {metrics.slice(0, 2).map((m) => (
              <KpiCard key={m._id} label={m.label}
                value={fmtNum(m.count)}
                sub={fmtShort(m.totalValue)}
                icon={m.icon}
              />
            ))}
          </motion.div>

          {/* Funnel + donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Funnel bars */}
            <motion.div variants={fadeUp}
              className="bg-base-100 border border-base-300 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">
                Return Journey Funnel
              </p>
              {funnelData.map((f, i) => {
                const width = funnelData[0].value ? pct(f.value, funnelData[0].value) : 0;
                return (
                  <div key={f.name} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-base-content/70 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: f.color }} />
                        {f.name}
                      </span>
                      <span className="text-sm font-bold text-base-content">{fmtNum(f.value)}</span>
                    </div>
                    <div className="h-3 bg-base-300 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: f.color }}
                      />
                    </div>
                    <p className="text-[11px] text-base-content/35">
                      {width}% of initial requests
                      {i > 0 && funnelData[i-1].value
                        ? ` · ${pct(f.value, funnelData[i-1].value)}% from prev stage`
                        : ""
                      }
                    </p>
                  </div>
                );
              })}
            </motion.div>

            {/* Donut by value */}
            <motion.div variants={fadeUp}
              className="bg-base-100 border border-base-300 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-3">
                Returns by Value Share
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics}
                      dataKey="totalValue"
                      nameKey="label"
                      cx="50%" cy="50%"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={4}
                      strokeWidth={0}
                    >
                      {metrics.map((m, i) => (
                        <Cell key={i} fill={m.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PharmTooltip />} />
                    <Legend
                      iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-xs text-base-content/60">{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Radar chart — multi-axis comparison */}
          {radarData.length >= 2 && (
            <motion.div variants={fadeUp}
              className="bg-base-100 border border-base-300 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">
                  Count vs Value Radar
                </p>
                <div className="flex items-center gap-5 text-xs text-base-content/40">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-[2px] bg-[#22c55e] inline-block" /> Count
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-[2px] bg-[#3b82f6] inline-block" /> Value (₹K)
                  </span>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="var(--color-base-300)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.6 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9, opacity: 0.4 }} />
                    <Radar name="Count"     dataKey="count" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
                    <Radar name="Value (K)" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2} />
                    <Tooltip content={<PharmTooltip valueFormatter={fmtNum} />} />
                    <Legend formatter={(v) => <span className="text-xs text-base-content/60">{v}</span>} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Detailed table */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-base-300">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">Return Metrics Breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-base-200/60">
                    {["Status", "Count", "Total Value", "% of Returns", "Avg Value"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-base-content/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m, i) => {
                    const Icon = m.icon;
                    return (
                      <tr key={i} className="border-t border-base-300/50 hover:bg-base-200/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: m.color + "22" }}>
                              <Icon size={13} style={{ color: m.color }} />
                            </div>
                            <span className="font-semibold text-base-content capitalize">{m.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-base-content">{fmtNum(m.count)}</td>
                        <td className="px-5 py-3.5 font-bold text-base-content">{fmtCur(m.totalValue)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-base-300 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct(m.count, totalReturns)}%`, background: m.color }} />
                            </div>
                            <span className="text-xs text-base-content/50">{pct(m.count, totalReturns)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-base-content/60">{m.count ? fmtCur((m.totalValue||0)/m.count) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// §  SECTION 4 — TOP MEDICINES
// ══════════════════════════════════════════════════════════════════════════════
function TopMedicinesSection() {
  const dispatch = useDispatch();
  const { topMedicines, loading } = useSelector((s) => s.pharmacyStore);
  const [filter, setFilter]   = useState("last30days");
  const [limit,  setLimit]    = useState(10);
  const [sortBy, setSortBy]   = useState("revenue"); // "revenue" | "qty"

  const load = useCallback((f, l) => dispatch(fetchTopMedicines({ dateFilter: f, limit: l })), [dispatch]);
  useEffect(() => { load(filter, limit); }, [filter, limit, load]);

  const raw  = topMedicines || [];
  const busy = loading.topMedicines;

  const data = useMemo(() => {
    const sorted = [...raw].sort((a, b) =>
      sortBy === "revenue" ? (b.totalRevenue - a.totalRevenue) : (b.totalQty - a.totalQty)
    );
    const maxRev = Math.max(...sorted.map(d => d.totalRevenue), 1);
    const maxQty = Math.max(...sorted.map(d => d.totalQty), 1);
    return sorted.map((m, i) => ({
      ...m,
      shortName: m.name?.length > 22 ? m.name.slice(0, 22) + "…" : m.name,
      rank: i + 1,
      revenueShare: pct(m.totalRevenue, raw.reduce((s, r) => s + r.totalRevenue, 0)),
      maxRev, maxQty,
    }));
  }, [raw, sortBy]);

  const totalRev = data.reduce((s, d) => s + d.totalRevenue, 0);
  const totalQty = data.reduce((s, d) => s + d.totalQty, 0);

  // Pareto — cumulative revenue %
  const paretoData = useMemo(() => {
    let cum = 0;
    return [...data]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((m, i) => {
        cum += m.totalRevenue;
        return { name: m.shortName, revenue: m.totalRevenue, cumPct: Math.round(cum / totalRev * 100) };
      });
  }, [data, totalRev]);

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-7">
      <SectionHeader
        title="Top Medicines"
        subtitle="Best-performing medicines by revenue and quantity sold"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sort toggle */}
            <div className="flex items-center gap-1 p-1 bg-base-200 rounded-xl">
              {[["revenue","By Revenue"],["qty","By Quantity"]].map(([v,l]) => (
                <button key={v} onClick={() => setSortBy(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${sortBy===v ? "bg-primary text-primary-content" : "text-base-content/50 hover:bg-base-100"}`}
                >{l}</button>
              ))}
            </div>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {[5,10,15,20].map((n) => (
                <option key={n} value={n}>Top {n}</option>
              ))}
            </select>
            <DateFilterBar value={filter} onChange={(f) => { setFilter(f); load(f, limit); }} />
            <RefreshBtn onClick={() => load(filter, limit)} loading={busy} />
          </div>
        }
      />

      {busy ? <SectionLoader /> : data.length === 0 ? <EmptyState /> : (
        <>
          {/* Summary KPIs */}
          <motion.div variants={stagger(0.04)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Medicines Tracked" value={fmtNum(data.length)}    icon={Pill}         accent />
            <KpiCard label="Combined Revenue"  value={fmtShort(totalRev)}     icon={IndianRupee} />
            <KpiCard label="Units Sold"         value={fmtNum(totalQty)}       icon={Hash} />
            <KpiCard label="Top Medicine Share" value={`${data[0]?.revenueShare || 0}%`}
              sub={data[0]?.name}                                              icon={Award} />
          </motion.div>

          {/* Main leaderboard — horizontal bar chart */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">
                {sortBy === "revenue" ? "Revenue Leaderboard" : "Units Sold Leaderboard"}
              </p>
              <p className="text-xs text-base-content/35">Sorted by {sortBy}</p>
            </div>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={sortBy === "revenue" ? fmtShort : fmtNum}
                    tick={{ fontSize: 10, opacity: 0.45 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={130}
                    tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.65 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    content={
                      <PharmTooltip
                        valueFormatter={sortBy === "revenue" ? fmtCur : fmtNum}
                        labelKey="shortName"
                      />
                    }
                  />
                  <Bar
                    dataKey={sortBy === "revenue" ? "totalRevenue" : "totalQty"}
                    name={sortBy === "revenue" ? "Revenue" : "Units"}
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                  >
                    {data.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={C.chart[i % C.chart.length]}
                        fillOpacity={1 - (i / data.length) * 0.35}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Pareto analysis */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">Pareto Analysis</p>
                <p className="text-xs text-base-content/35 mt-0.5">Cumulative revenue contribution (80/20 rule)</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-base-content/40">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] bg-[#22c55e] inline-block" /> Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] bg-[#f59e0b] inline-block border-dashed" /> Cum %
                </span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData} margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
                  <GradientDefs />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, opacity: 0.45 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                  <YAxis yAxisId="rev" tickFormatter={fmtShort} tick={{ fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false} width={50} />
                  <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<PharmTooltip />} />
                  <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#22c55e" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="cumPct" name="Cum %" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  <ReferenceLine yAxisId="pct" y={80} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Revenue vs Quantity scatter */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/45 mb-4">
              Revenue vs. Units Sold (Bubble View)
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
                  <XAxis
                    type="number" dataKey="totalQty" name="Units Sold"
                    tickFormatter={fmtNum}
                    tick={{ fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false}
                    label={{ value: "Units Sold", position: "insideBottom", offset: -4, fontSize: 11, opacity: 0.4 }}
                  />
                  <YAxis
                    type="number" dataKey="totalRevenue" name="Revenue"
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 shadow-depth">
                          <p className="font-bold text-base-content text-sm mb-1">{d?.name}</p>
                          <p className="text-xs text-base-content/50">Revenue: <span className="text-base-content font-bold">{fmtCur(d?.totalRevenue)}</span></p>
                          <p className="text-xs text-base-content/50">Units: <span className="text-base-content font-bold">{fmtNum(d?.totalQty)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={data} shape={(props) => {
                    const { cx, cy, payload, index } = props;
                    const r = 6 + (data.length - index) * 1.2;
                    return (
                      <circle cx={cx} cy={cy} r={Math.min(r, 18)}
                        fill={C.chart[index % C.chart.length]}
                        fillOpacity={0.75}
                        stroke={C.chart[index % C.chart.length]}
                        strokeOpacity={0.4}
                        strokeWidth={2}
                      />
                    );
                  }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Ranked detail table */}
          <motion.div variants={fadeUp}
            className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/45">Full Ranking Table</p>
              <p className="text-xs text-base-content/30">{data.length} medicines</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-base-200/50">
                    {["#", "Medicine", "Revenue", "Units", "Revenue Share", "Avg/Unit"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-base-content/35">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((m, i) => (
                    <motion.tr
                      key={m._id || i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-t border-base-300/40 hover:bg-base-200/30 transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center text-xs font-black
                          ${i === 0 ? "bg-[#f59e0b]/20 text-[#f59e0b]"
                          : i === 1 ? "bg-base-300/60 text-base-content/60"
                          : i === 2 ? "bg-[#f97316]/15 text-[#f97316]"
                          : "bg-base-200 text-base-content/35"
                          }`}
                        >
                          {m.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: C.chart[i % C.chart.length] + "22" }}>
                            <Pill size={13} style={{ color: C.chart[i % C.chart.length] }} />
                          </div>
                          <span className="font-semibold text-base-content max-w-[200px] truncate" title={m.name}>
                            {m.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-base-content">{fmtCur(m.totalRevenue)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-base-content/70 font-medium">{fmtNum(m.totalQty)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-base-300 rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${m.revenueShare}%`, background: C.chart[i % C.chart.length] }} />
                          </div>
                          <span className="text-xs text-base-content/45">{m.revenueShare}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-base-content/55 text-xs">
                        {m.totalQty ? fmtCur(m.totalRevenue / m.totalQty) : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// §  NAV CONFIG
// ══════════════════════════════════════════════════════════════════════════════
const NAV_LINKS = [
  { name: "Overview",         href: "/pharmacy-store/analytics/overview",      icon: AreaChartIcon,  section: "overview"      },
  { name: "Revenue Trends",   href: "/pharmacy-store/analytics/revenue",       icon: TrendingUp,     section: "revenue"       },
  { name: "Returns Analysis", href: "/pharmacy-store/analytics/returns",       icon: RotateCcw,      section: "returns"       },
  { name: "Top Medicines",    href: "/pharmacy-store/analytics/top-medicines", icon: Pill,           section: "top-medicines" },
];

const SECTION_MAP = {
  overview:       OverviewSection,
  revenue:        RevenueTrendsSection,
  returns:        ReturnsSection,
  "top-medicines": TopMedicinesSection,
};

// ──────────────────────────────────────────────────────────────────────────────
function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-base-content/40 mb-7 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={11} />}
          <span className={i === items.length - 1 ? "text-base-content font-semibold" : ""}>{item}</span>
        </span>
      ))}
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// §  MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const pathname = usePathname();
  const router   = useRouter();

  const activeSection = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    const ai   = segs.indexOf("analytics");
    if (ai === -1) return "overview";
    const rest = segs.slice(ai + 1).join("/");
    return rest || "overview";
  }, [pathname]);

  const activeLink = NAV_LINKS.find((l) => l.section === activeSection);
  const ActiveComp = SECTION_MAP[activeSection];

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page header ── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-1">
                Pharmacy Analytics
              </p>
              <h1 className="text-3xl lg:text-4xl font-black font-montserrat text-base-content tracking-tight">
                Performance Intelligence
              </h1>
              <p className="text-sm text-base-content/45 mt-1.5 max-w-lg">
                Deep-dive into your store's sales patterns, return behavior, and medicine performance
              </p>
            </div>
            {/* Active indicator badge */}
            {activeLink && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
                {<activeLink.icon size={15} className="text-primary" />}
                <span className="text-sm font-bold text-primary">{activeLink.name}</span>
              </div>
            )}
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Sidebar ── */}
          <motion.aside
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="lg:w-56 xl:w-60 shrink-0"
          >
            <div className="bg-base-100 border border-base-300 rounded-2xl p-2.5 sticky top-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-base-content/35 px-2.5 pt-1.5 pb-3">
                Analytics Sections
              </p>
              <nav className="space-y-0.5">
                {NAV_LINKS.map(({ name, href, icon: Icon, section }) => {
                  const isActive = section === activeSection;
                  return (
                    <motion.button
                      key={section}
                      whileHover={{ x: isActive ? 0 : 2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => router.push(href)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left
                        ${isActive
                          ? "bg-primary text-primary-content shadow-sm"
                          : "text-base-content/55 hover:bg-base-200 hover:text-base-content"
                        }`}
                    >
                      <Icon size={15} className={isActive ? "text-primary-content" : "text-base-content/35"} />
                      <span className="flex-1">{name}</span>
                      {isActive && (
                        <motion.div
                          layoutId="navDot"
                          className="w-1.5 h-1.5 rounded-full bg-primary-content/70"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </nav>

              {/* Small footer hint */}
              <div className="mt-4 mx-2.5 mb-1 p-3 rounded-xl bg-base-200 border border-base-300">
                <p className="text-[10px] font-semibold text-base-content/35 uppercase tracking-wide mb-1">Tip</p>
                <p className="text-[11px] text-base-content/45 leading-relaxed">
                  Use date filters to compare performance across periods.
                </p>
              </div>
            </div>
          </motion.aside>

          {/* ── Main panel ── */}
          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="flex-1 min-w-0"
          >
            <div className="bg-base-100 border border-base-300 rounded-2xl p-6 lg:p-7">
              <Breadcrumb items={["Pharmacy", "Analytics", activeLink?.name || activeSection]} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {ActiveComp ? <ActiveComp /> : (
                    <EmptyState message="This section is not yet configured." />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  );
}