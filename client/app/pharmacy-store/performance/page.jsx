"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  fetchRevenueAnalytics,
  fetchReturnAnalytics,
  fetchTotalEarnings,
  fetchEarningsHistory,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  TrendingUp, TrendingDown, IndianRupee, RefreshCw,
  RotateCcw, Target, Zap, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, Percent, Clock,
  ChevronLeft, ChevronRight, Package, Sparkles,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";

/* ── Variants ─────────────────────────────────────────────── */
const fadeUp  = { hidden: { opacity:0, y:24 }, show: { opacity:1, y:0, transition:{ type:"spring", stiffness:260, damping:22 } } };
const stagger = { hidden:{}, show:{ transition:{ staggerChildren:0.07 } } };

/* ── Row CSS stagger (table-safe) ────────────────────────── */
const rowStyle = (i) => ({ animation:"fadeInRow 0.35s ease both", animationDelay:`${i*0.04}s` });

/* ── Date filter options ─────────────────────────────────── */
const DATE_OPTS = [
  { key:"today",      label:"Today"   },
  { key:"last7days",  label:"7 Days"  },
  { key:"last30days", label:"30 Days" },
  { key:"last90days", label:"90 Days" },
];

/* ── Background ───────────────────────────────────────────── */
function PerfBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <style>{`
        @keyframes fadeInRow { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      {/* Upward-trending lines motif */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage:"repeating-linear-gradient(60deg, var(--success) 0, var(--success) 1px, transparent 0, transparent 50%)", backgroundSize:"24px 24px" }} />
      <motion.div animate={{ opacity:[0.07,0.18,0.07], scale:[1,1.1,1] }} transition={{ duration:10, repeat:Infinity }}
        className="absolute -top-24 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--success), transparent 65%)" }} />
      <motion.div animate={{ opacity:[0.05,0.12,0.05] }} transition={{ duration:8, repeat:Infinity, delay:5 }}
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--primary), transparent 65%)" }} />
    </div>
  );
}

/* ── Custom tooltip ───────────────────────────────────────── */
function ChartTip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs" style={{ border:"1px solid var(--base-300)" }}>
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{currency && typeof p.value === "number" ? `₹${p.value.toLocaleString("en-IN")}` : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Delta badge ──────────────────────────────────────────── */
function DeltaBadge({ value }) {
  if (value === undefined || value === null) return null;
  const pos = value >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color: pos ? "var(--success)" : "var(--error)", background: pos ? "color-mix(in oklch,var(--success) 12%,var(--base-200))" : "color-mix(in oklch,var(--error) 12%,var(--base-200))" }}>
      {pos ? <ArrowUpRight size={9}/> : <ArrowDownRight size={9}/>}{Math.abs(value)}%
    </span>
  );
}

/* ── Metric card ──────────────────────────────────────────── */
const MetricCard = memo(function MetricCard({ icon:Icon, label, value, sub, color, delta }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5 relative overflow-hidden group">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background:`radial-gradient(ellipse at 80% 20%, color-mix(in oklch,${color} 9%,transparent), transparent 70%)` }} />
      <div className="flex items-start justify-between mb-3 relative">
        <div className="p-2.5 rounded-xl" style={{ background:`color-mix(in oklch,${color} 14%,var(--base-200))` }}>
          <Icon size={17} style={{ color }} />
        </div>
        <DeltaBadge value={delta} />
      </div>
      <p className="text-2xl font-black font-montserrat relative" style={{ color }}>{value ?? "—"}</p>
      <p className="text-xs font-semibold text-base-content/55 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>}
    </motion.div>
  );
});

/* ── Table skeleton ───────────────────────────────────────── */
function TableSkeleton({ rows=6, cols=6 }) {
  return Array.from({ length:rows }).map((_,i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length:cols }).map((_,j) => (
        <td key={j} className="py-4 px-4"><div className="skeleton h-4 rounded-lg" /></td>
      ))}
    </tr>
  ));
}

/* ── Status badge ─────────────────────────────────────────── */
function StatusBadge({ status }) {
  const s = (status||"").toLowerCase();
  const cls = s==="delivered"||s==="paid" ? "badge-success" : s==="pending" ? "badge-warning" : s==="cancelled" ? "badge-error" : "badge-info";
  return <span className={`badge ${cls} text-xs capitalize`}>{status||"—"}</span>;
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Performance() {
  const dispatch = useDispatch();
  const {
    revenueAnalytics,
    returnAnalytics,
    totalEarnings,
    earningsHistory,
    earningsHistoryPagination,
    earningsHistorySummary,
    loading,
  } = useSelector((s) => s.pharmacyStore);

  const [revFilter,  setRevFilter ] = useState("last30days");
  const [retFilter,  setRetFilter ] = useState("last30days");
  const [histPage,   setHistPage  ] = useState(1);
  const [activeTab,  setActiveTab ] = useState("revenue");

  /* ── Fetch ── */
  useEffect(() => {
    dispatch(fetchRevenueAnalytics({ dateFilter: revFilter }));
  }, [dispatch, revFilter]);

  useEffect(() => {
    dispatch(fetchReturnAnalytics({ dateFilter: retFilter }));
  }, [dispatch, retFilter]);

  useEffect(() => {
    dispatch(fetchTotalEarnings());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchEarningsHistory({ page: histPage, limit: 15 }));
  }, [dispatch, histPage]);

  /* ── Derived ── */
  const total = totalEarnings || {};

  const revenueByDay = useMemo(() =>
    (revenueAnalytics?.revenueByDay || []).map(d => ({
      date:    d._id?.slice(5) || "—",
      revenue: d.revenue  || d.totalRevenue || 0,
      orders:  d.orders   || d.orderCount   || 0,
      gst:     d.gst      || d.gstCollected || 0,
      net:     (d.revenue || 0) - (d.gst || 0),
    })), [revenueAnalytics]);

  const returnMetrics = useMemo(() => {
    const rm = returnAnalytics?.returnMetrics || returnAnalytics || {};
    return rm;
  }, [returnAnalytics]);

  /* Return trend by day (if available) */
  const returnByDay = useMemo(() =>
    (returnAnalytics?.byDay || returnAnalytics?.returnsByDay || []).map(d => ({
      date:    d._id?.slice(5) || "—",
      returns: d.returns || d.count || 0,
      amount:  d.amount  || d.refundAmount || 0,
    })), [returnAnalytics]);

  /* Monthly trend for total earnings */
  const monthlyTrend = useMemo(() =>
    (total.monthlyTrend || []).map(m => ({
      month:   m._id?.slice(5) || "—",
      revenue: m.revenue || 0,
      orders:  m.orders  || 0,
    })), [total]);

  /* Radar data for performance health */
  const radarData = useMemo(() => {
    const totalRev = total.grossRevenue || 0;
    const totalOrd = total.totalOrders  || 0;
    const retRate  = returnMetrics.returnRate ?? 0;
    return [
      { subject:"Revenue",      value: Math.min((totalRev / 500000) * 100, 100) },
      { subject:"Orders",       value: Math.min((totalOrd / 500)    * 100, 100) },
      { subject:"Return Rate",  value: Math.max(100 - (retRate * 10), 0)       },
      { subject:"GST Collected",value: Math.min(((total.gstCollected || 0) / 50000) * 100, 100) },
      { subject:"Net Revenue",  value: Math.min(((total.netRevenue || 0) / 400000) * 100, 100)  },
    ];
  }, [total, returnMetrics]);

  return (
    <div className="min-h-screen" style={{ background:"var(--base-100)" }}>
      <PerfBg />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={15} className="text-success" />
              <span className="text-xs font-black uppercase tracking-widest text-success/70">Performance</span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Store <span className="text-gradient-success">Performance</span>
            </h1>
            <p className="text-sm text-base-content/50 mt-1">Revenue trends, return analytics & earnings history</p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-base-200 rounded-xl">
            {[
              { key:"revenue", label:"Revenue"  },
              { key:"returns", label:"Returns"  },
              { key:"history", label:"History"  },
            ].map(t => (
              <motion.button key={t.key} whileTap={{ scale:0.94 }} onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${activeTab===t.key ? "bg-success text-success-content shadow-sm" : "text-base-content/50 hover:bg-base-300"}`}>
                {t.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Lifetime KPI row ── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard icon={IndianRupee} label="Lifetime Gross"  value={total.grossRevenue ? `₹${total.grossRevenue.toLocaleString("en-IN")}` : "—"} color="var(--primary)"   delta={12} />
          <MetricCard icon={TrendingUp}  label="Net Revenue"     value={total.netRevenue   ? `₹${total.netRevenue.toLocaleString("en-IN")}`   : "—"} color="var(--success)"  delta={9}  />
          <MetricCard icon={BarChart3}   label="Total Orders"    value={total.totalOrders  ?? "—"}                                                    color="var(--secondary)" />
          <MetricCard icon={Percent}     label="GST Collected"   value={total.gstCollected ? `₹${total.gstCollected.toLocaleString("en-IN")}`  : "—"} color="var(--info)"     />
        </motion.div>

        {/* ══════ REVENUE TAB ══════ */}
        {activeTab === "revenue" && (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="space-y-6">

            {/* Revenue + orders composed chart */}
            <div className="grid lg:grid-cols-3 gap-6">
              <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-2"><Activity size={13} className="text-success" /> Revenue &amp; Orders</p>
                    <p className="text-xs text-base-content/40">Daily breakdown</p>
                  </div>
                  <div className="flex gap-1 p-0.5 bg-base-200 rounded-lg flex-wrap">
                    {DATE_OPTS.map(f => (
                      <button key={f.key} onClick={() => setRevFilter(f.key)}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${revFilter===f.key ? "bg-success text-success-content" : "text-base-content/40 hover:text-base-content"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {loading.analyticsRevenue ? (
                  <div className="h-56 flex items-center justify-center"><div className="spinner" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <ComposedChart data={revenueByDay}>
                      <defs>
                        <linearGradient id="revGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--success)" stopOpacity={0}    />
                        </linearGradient>
                        <linearGradient id="netGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.4 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.4 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip currency />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" fill="url(#revGreen)" stroke="var(--success)" strokeWidth={2.5} dot={false} />
                      <Area type="monotone" dataKey="net"     name="Net"     fill="url(#netGreen)" stroke="var(--accent)"  strokeWidth={1.5} dot={false} />
                      <Bar  dataKey="orders" name="Orders" fill="var(--primary)" opacity={0.4} radius={[3,3,0,0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </motion.div>

              {/* Performance health radar */}
              <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
                <p className="font-bold text-sm mb-1 flex items-center gap-2"><Target size={13} className="text-accent" /> Health Score</p>
                <p className="text-xs text-base-content/40 mb-3">Lifetime benchmarks</p>
                <ResponsiveContainer width="100%" height={210}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--base-300)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.5 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0,100]} />
                    <Radar name="Score" dataKey="value" stroke="var(--success)" fill="var(--success)" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Monthly trend bar */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
              <p className="font-bold text-sm mb-1 flex items-center gap-2"><TrendingUp size={13} className="text-primary" /> Monthly Revenue Trend</p>
              <p className="text-xs text-base-content/40 mb-4">Lifetime month-by-month</p>
              {monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthlyTrend} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.4 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.4 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip currency />} />
                    <Bar dataKey="revenue" name="Revenue" radius={[5,5,0,0]} animationDuration={1200}>
                      {monthlyTrend.map((_,i) => (
                        <Cell key={i} fill={`oklch(${62+i*2}% 0.17 ${150+i*4})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex items-center justify-center text-xs text-base-content/30">No monthly data</div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ══════ RETURNS TAB ══════ */}
        {activeTab === "returns" && (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="space-y-6">

            {/* Return KPI cards */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label:"Total Returns",     value: returnMetrics.totalReturns   ?? "—",   icon:RotateCcw,   color:"var(--warning)" },
                { label:"Refund Amount",      value: returnMetrics.totalRefundAmount != null ? `₹${returnMetrics.totalRefundAmount.toLocaleString("en-IN")}` : "—", icon:IndianRupee, color:"var(--error)" },
                { label:"Return Rate",        value: returnMetrics.returnRate    != null ? `${returnMetrics.returnRate.toFixed(2)}%` : "—", icon:Percent, color:"var(--accent)" },
                { label:"Avg Refund/Return",  value: returnMetrics.avgRefundPerReturn != null ? `₹${returnMetrics.avgRefundPerReturn.toLocaleString("en-IN")}` : "—", icon:TrendingDown, color:"var(--info)" },
              ].map(s => (
                <MetricCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} />
              ))}
            </motion.div>

            {/* Return trend area */}
            <div className="grid lg:grid-cols-3 gap-6">
              <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-2"><RotateCcw size={13} className="text-warning" /> Return Trend</p>
                    <p className="text-xs text-base-content/40">Returns over time</p>
                  </div>
                  <div className="flex gap-1 p-0.5 bg-base-200 rounded-lg flex-wrap">
                    {DATE_OPTS.slice(1).map(f => (
                      <button key={f.key} onClick={() => setRetFilter(f.key)}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${retFilter===f.key ? "bg-warning text-warning-content" : "text-base-content/40 hover:text-base-content"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {loading.analyticsReturns ? (
                  <div className="h-52 flex items-center justify-center"><div className="spinner" /></div>
                ) : returnByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={returnByDay}>
                      <defs>
                        <linearGradient id="retArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--warning)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                      <XAxis dataKey="date"    tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.4 }} axisLine={false} tickLine={false} />
                      <YAxis                   tick={{ fontSize:9, fill:"var(--base-content)", opacity:0.4 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="returns" name="Returns" fill="url(#retArea)" stroke="var(--warning)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-52 flex items-center justify-center text-xs text-base-content/30">No return trend data for this period</div>
                )}
              </motion.div>

              {/* Return summary card */}
              <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
                <p className="font-bold text-sm mb-4 flex items-center gap-2">
                  <Package size={13} className="text-warning" /> Return Summary
                </p>
                <div className="space-y-3">
                  {[
                    { label:"Total Returns",           value: returnMetrics.totalReturns ?? "—",     color:"var(--warning)" },
                    { label:"Approved Returns",        value: returnMetrics.approvedReturns ?? "—",  color:"var(--success)" },
                    { label:"Pending Returns",         value: returnMetrics.pendingReturns ?? "—",   color:"var(--accent)"  },
                    { label:"Rejected Returns",        value: returnMetrics.rejectedReturns ?? "—",  color:"var(--error)"   },
                    { label:"Total Refund Amount",     value: returnMetrics.totalRefundAmount != null ? `₹${returnMetrics.totalRefundAmount.toLocaleString("en-IN")}` : "—", color:"var(--info)" },
                    { label:"Return Rate",             value: returnMetrics.returnRate != null ? `${returnMetrics.returnRate.toFixed(2)}%` : "—", color:"var(--primary)" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between bg-base-200 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-base-content/55 font-semibold">{s.label}</p>
                      <p className="text-sm font-black" style={{ color:s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ══════ HISTORY TAB ══════ */}
        {activeTab === "history" && (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="space-y-6">

            {/* Summary strip */}
            {earningsHistorySummary && (
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label:"Period Revenue",  value: earningsHistorySummary.totalRevenue  != null ? `₹${earningsHistorySummary.totalRevenue.toLocaleString("en-IN")}`  : "—", color:"var(--primary)" },
                  { label:"Period GST",      value: earningsHistorySummary.totalGst       != null ? `₹${earningsHistorySummary.totalGst.toLocaleString("en-IN")}`       : "—", color:"var(--info)"    },
                  { label:"Period Net",      value: earningsHistorySummary.netRevenue     != null ? `₹${earningsHistorySummary.netRevenue.toLocaleString("en-IN")}`      : "—", color:"var(--success)" },
                  { label:"Period Orders",   value: earningsHistorySummary.totalOrders    ?? "—",                                                                               color:"var(--accent)"  },
                ].map(s => (
                  <motion.div key={s.label} variants={fadeUp} className="glass-card px-4 py-3.5">
                    <p className="text-xl font-black font-montserrat" style={{ color:s.color }}>{s.value}</p>
                    <p className="text-xs text-base-content/40 mt-0.5">{s.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* History table ─────────────────────────────────────────
                FIX: plain <table>/<tbody>/<tr> only — no motion.tr
            ──────────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-base-300/50">
                <p className="font-bold text-sm flex items-center gap-2">
                  <Clock size={13} className="text-primary" /> Earnings History
                </p>
                {earningsHistoryPagination && (
                  <p className="text-xs text-base-content/40">
                    Page <strong>{earningsHistoryPagination.currentPage}</strong> / {earningsHistoryPagination.totalPages || 1}
                    {earningsHistoryPagination.totalItems ? ` · ${earningsHistoryPagination.totalItems} records` : ""}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Earnings history table">
                  <thead>
                    <tr className="bg-base-200/60">
                      {["Order ID","Customer","Amount","GST","Discount","Status","Date"].map(h => (
                        <th key={h} scope="col" className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-base-content/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  {/* plain <tbody> — NOT motion.tbody */}
                  <tbody>
                    {loading.earningsHistory ? (
                      <TableSkeleton rows={6} cols={7} />
                    ) : earningsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-14 text-center text-sm text-base-content/30">No earnings history</td>
                      </tr>
                    ) : (
                      /* plain <tr> with CSS animation — NOT motion.tr */
                      earningsHistory.map((o, i) => (
                        <tr key={o._id || i}
                          className="border-b border-base-300/40 hover:bg-success/4 transition-colors"
                          style={rowStyle(i)}>
                          <td className="py-3 px-4 font-mono text-xs text-primary font-bold">#{o.orderId}</td>
                          <td className="py-3 px-4 text-xs text-base-content">{o.customer?.name || "—"}</td>
                          <td className="py-3 px-4 text-sm font-bold text-success">
                            {o.billing?.totalPayable != null ? `₹${o.billing.totalPayable.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="py-3 px-4 text-xs text-base-content/50">
                            {o.billing?.gstAmount != null ? `₹${o.billing.gstAmount.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="py-3 px-4 text-xs text-warning">
                            {o.billing?.discount != null ? `₹${o.billing.discount.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="py-3 px-4"><StatusBadge status={o.delivery?.status} /></td>
                          <td className="py-3 px-4 text-xs text-base-content/40">
                            {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-base-300/40">
                <p className="text-xs text-base-content/40">
                  {earningsHistory.length} records shown
                </p>
                <div className="flex gap-2">
                  <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }}
                    disabled={histPage <= 1} onClick={() => setHistPage(p => p-1)}
                    aria-label="Previous page"
                    className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none">
                    <ChevronLeft size={14} />
                  </motion.button>
                  <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }}
                    disabled={histPage >= (earningsHistoryPagination?.totalPages || 1)} onClick={() => setHistPage(p => p+1)}
                    aria-label="Next page"
                    className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none">
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

      </div>
    </div>
  );
}