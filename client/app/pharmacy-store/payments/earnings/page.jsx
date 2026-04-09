"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  fetchDailyEarnings,
  fetchMonthlyEarnings,
  fetchTotalEarnings,
  fetchEarningsHistory,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  TrendingUp, IndianRupee, Receipt, ArrowUpRight, ArrowDownRight,
  Calendar, BarChart3, ChevronLeft, ChevronRight,
  Sparkles, Wallet, Percent, ShoppingCart,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Cell,
} from "recharts";

/* ── Variants ───────────────────────────────────────── */
const fadeUp  = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } } };
const stagger = { hidden: {},                     show: { transition: { staggerChildren: 0.07 } } };

/* ── CSS row animation (table-safe) ────────────────── */
const rowStyle = (i) => ({
  animation: "fadeInRow 0.35s ease both",
  animationDelay: `${i * 0.04}s`,
});

/* ── Animated count ─────────────────────────────────── */
function AnimatedValue({ value, prefix = "", suffix = "" }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {prefix}{typeof value === "number" ? value.toLocaleString("en-IN") : value}{suffix}
    </motion.span>
  );
}

/* ── Wave background ────────────────────────────────── */
function WaveBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* fadeInRow keyframe — injected once, used by all table rows */}
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <motion.div
        animate={{ y: [0, -20, 0], opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-32 left-0 right-0 h-64"
        style={{ background: "linear-gradient(180deg, transparent, color-mix(in oklch, var(--primary) 10%, transparent))" }}
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />
    </div>
  );
}

/* ── Metric card ────────────────────────────────────── */
function MetricCard({ icon: Icon, label, value, sub, color, growth, prefix = "₹" }) {
  const isPositive = growth >= 0;
  return (
    <motion.div variants={fadeUp} className="glass-card p-5 relative overflow-hidden group">
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 blur-2xl"
        style={{ background: color, transform: "translate(30%, -30%)" }}
      />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in oklch, ${color} 15%, var(--base-200))` }}>
          <Icon size={17} style={{ color }} />
        </div>
        {growth !== undefined && (
          <span
            className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              color:      isPositive ? "var(--success)" : "var(--error)",
              background: isPositive
                ? "color-mix(in oklch, var(--success) 12%, var(--base-200))"
                : "color-mix(in oklch, var(--error)   12%, var(--base-200))",
            }}
          >
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black font-montserrat" style={{ color }}>
        <AnimatedValue value={value} prefix={prefix} />
      </p>
      <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mt-1">{label}</p>
      {sub && <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

/* ── Custom tooltip ─────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: ₹{p.value?.toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

/* ── Table skeleton ─────────────────────────────────── */
function TableSkeleton({ rows = 6, cols = 6 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="py-4 px-4">
          <div className="skeleton h-4 rounded-lg" />
        </td>
      ))}
    </tr>
  ));
}

/* ── Status badge helper ────────────────────────────── */
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "delivered" || s === "paid"   ? "badge-success"
    : s === "pending"                   ? "badge-warning"
    : s === "cancelled"                 ? "badge-error"
    :                                     "badge-info";
  return <span className={`badge ${cls} text-xs capitalize`}>{status || "—"}</span>;
}

/* ── Main ───────────────────────────────────────────── */
export default function Earnings() {
  const dispatch = useDispatch();
  const {
    dailyEarnings,
    monthlyEarnings,
    totalEarnings,
    earningsHistory,
    earningsHistoryPagination,
    earningsHistorySummary,
    loading,
  } = useSelector((s) => s.pharmacyStore);

  const [tab,           setTab          ] = useState("daily");
  const [histPage,      setHistPage     ] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    dispatch(fetchDailyEarnings());
    dispatch(fetchMonthlyEarnings({ month: selectedMonth }));
    dispatch(fetchTotalEarnings());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchMonthlyEarnings({ month: selectedMonth }));
  }, [dispatch, selectedMonth]);

  useEffect(() => {
    dispatch(fetchEarningsHistory({ page: histPage, limit: 15 }));
  }, [dispatch, histPage]);

  /* ── Derived ── */
  const daily   = dailyEarnings   || {};
  const monthly = monthlyEarnings || {};
  const total   = totalEarnings   || {};

  const areaData = (monthly.dailyBreakdown || []).map((d) => ({
    date:    d._id?.slice(5),
    revenue: d.revenue,
    orders:  d.orders,
  }));

  const trendData = (total.monthlyTrend || []).map((m) => ({
    month:   m._id?.slice(5),
    revenue: m.revenue,
    orders:  m.orders,
  }));

  const topMeds = (total.topMedicines || []).slice(0, 8).map((m) => ({
    name:    m.name?.slice(0, 10),
    revenue: m.totalRevenue,
    qty:     m.totalQty,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <WaveBg />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1,  y: 0  }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
              >
                <Sparkles size={16} className="text-accent" />
              </motion.div>
              <span className="text-xs font-black uppercase tracking-widest text-accent/70">
                Financial Dashboard
              </span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Earnings &amp;{" "}
              <span className="text-gradient-success">Revenue</span>
            </h1>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-base-200 rounded-xl">
            {["daily", "monthly", "total"].map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.94 }}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  tab === t
                    ? "bg-primary text-primary-content shadow-sm"
                    : "text-base-content/50 hover:bg-base-300"
                }`}
              >
                {t}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── KPI row ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {tab === "daily" && (
            <>
              <MetricCard icon={IndianRupee} label="Gross Revenue"  value={daily.grossRevenue  || 0} color="var(--primary)"   />
              <MetricCard icon={Receipt}     label="GST Collected"  value={daily.gstCollected   || 0} color="var(--info)"      />
              <MetricCard icon={Wallet}      label="Net Revenue"    value={daily.netRevenue     || 0} color="var(--success)"   />
              <MetricCard icon={ShoppingCart} label="Paid Orders"   value={daily.paidOrders     || 0} color="var(--accent)"   prefix="" />
            </>
          )}
          {tab === "monthly" && (
            <>
              <MetricCard icon={IndianRupee} label="Gross Revenue"  value={monthly.grossRevenue || 0} color="var(--primary)"   />
              <MetricCard icon={Percent}     label="Discounts"      value={monthly.discounts    || 0} color="var(--warning)"   />
              <MetricCard icon={Wallet}      label="Net Revenue"    value={monthly.netRevenue   || 0} color="var(--success)"   />
              <MetricCard icon={BarChart3}   label="Total Orders"   value={monthly.totalOrders  || 0} color="var(--secondary)" prefix="" />
            </>
          )}
          {tab === "total" && (
            <>
              <MetricCard icon={IndianRupee} label="Lifetime Gross" value={total.grossRevenue   || 0} color="var(--primary)"   />
              <MetricCard icon={TrendingUp}  label="Net Revenue"    value={total.netRevenue     || 0} color="var(--success)"  growth={12} />
              <MetricCard icon={Receipt}     label="GST Collected"  value={total.gstCollected   || 0} color="var(--info)"      />
              <MetricCard icon={ShoppingCart} label="Total Orders"  value={total.totalOrders    || 0} color="var(--accent)"   prefix="" />
            </>
          )}
        </motion.div>

        {/* ── Charts section ── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">

          {/* Main chart */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-sm flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" />
                {tab === "daily"   ? "Today's Orders"
                : tab === "monthly" ? `Revenue — ${selectedMonth}`
                :                    "12-Month Trend"}
              </p>
              {tab === "monthly" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input-field py-1.5 px-2 text-xs"
                />
              )}
            </div>

            {tab === "total" ? (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={trendData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <YAxis                 tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" fill="url(#revGrad)" stroke="var(--primary)" strokeWidth={2.5} />
                  <Bar  dataKey="orders"  name="Orders"  fill="var(--secondary)" opacity={0.5} radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={areaData.length > 0 ? areaData : [{ date: "—", revenue: 0 }]}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="date"    tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <YAxis                   tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" fill="url(#areaGrad)" stroke="var(--success)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Top medicines */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-4 flex items-center gap-2">
              <Sparkles size={13} className="text-accent" /> Top Medicines
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topMeds} layout="vertical" barCategoryGap="20%">
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.6 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--base-200)",
                    border: "1px solid var(--base-300)",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                  formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[0, 5, 5, 0]} animationDuration={1400}>
                  {topMeds.map((_, i) => (
                    <Cell key={i} fill={`oklch(${58 + i * 3}% 0.18 ${240 - i * 12})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* ── History table ──────────────────────────────────────────
            FIX: was <motion.tr initial animate transition> which renders
                 as <div> — browser silently strips rows from <tbody>.
                 Fixed: plain <tr> with CSS fadeInRow stagger animation.
        ─────────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-base-300/50">
            <p className="font-bold text-sm flex items-center gap-2">
              <Calendar size={14} className="text-primary" /> Earnings History
            </p>
            {earningsHistorySummary && (
              <div className="flex items-center gap-4 text-xs text-base-content/50">
                <span>
                  Total:{" "}
                  <strong className="text-primary">
                    ₹{(earningsHistorySummary.totalRevenue || 0).toLocaleString("en-IN")}
                  </strong>
                </span>
                <span>
                  GST:{" "}
                  <strong className="text-info">
                    ₹{(earningsHistorySummary.totalGst || 0).toLocaleString("en-IN")}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {/* plain <table> — NOT motion.table */}
            <table className="w-full" aria-label="Earnings history table">
              <thead>
                <tr className="bg-base-200/60">
                  {["Order ID", "Customer", "Amount", "GST", "Status", "Date"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-base-content/40"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* plain <tbody> — NOT motion.tbody */}
              <tbody>
                {loading.earningsHistory ? (
                  <TableSkeleton rows={6} cols={6} />
                ) : earningsHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-base-content/30">
                      No earnings recorded yet
                    </td>
                  </tr>
                ) : (
                  /* plain <tr> with CSS animation — NOT motion.tr */
                  earningsHistory.map((order, i) => (
                    <tr
                      key={order._id || i}
                      className="border-b border-base-300/40 hover:bg-primary/5 transition-colors"
                      style={rowStyle(i)}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-primary font-bold">
                        #{order.orderId}
                      </td>
                      <td className="py-3 px-4 text-sm text-base-content">
                        {order.customer?.name || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm font-bold text-success">
                        ₹{(order.billing?.totalPayable || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-xs text-base-content/50">
                        ₹{(order.billing?.gstAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={order.delivery?.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-base-content/50">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })
                          : "—"}
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
              Page{" "}
              <strong className="text-base-content/60">{earningsHistoryPagination.currentPage}</strong>
              {" "}/ {earningsHistoryPagination.totalPages || 1}
              {earningsHistoryPagination.totalItems ? ` · ${earningsHistoryPagination.totalItems} records` : ""}
            </p>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                disabled={histPage <= 1}
                onClick={() => setHistPage((p) => p - 1)}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none"
              >
                <ChevronLeft size={14} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                disabled={histPage >= (earningsHistoryPagination.totalPages || 1)}
                onClick={() => setHistPage((p) => p + 1)}
                aria-label="Next page"
                className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none"
              >
                <ChevronRight size={14} />
              </motion.button>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}