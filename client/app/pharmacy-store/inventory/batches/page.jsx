"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchInventoryBatches,
  fetchExpiryAlerts,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  Boxes, Calendar, AlertCircle, Clock, ChevronRight, ChevronLeft,
  TrendingUp, Package2, Hash, RefreshCw, Activity, Zap,
} from "lucide-react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";

/* ── Variants ─────────────────────────────────────────── */
const fadeUp  = { hidden: { opacity: 0, y: 30  }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } } };
const stagger = { hidden: {},                      show: { transition: { staggerChildren: 0.06 } } };

/* ── Pulsing background grid ─────────────────────────── */
function GridBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* ↓ fadeInRow keyframe injected here once, safe for all table rows */}
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <motion.div
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.12, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 right-0 w-96 h-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--secondary), transparent 70%)" }}
      />
      <motion.div
        animate={{ opacity: [0.1, 0.22, 0.1], scale: [1, 1.1, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-1/4 left-0 w-72 h-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />
    </div>
  );
}

/* ── Expiry timeline chip ─────────────────────────────── */
function DaysChip({ days }) {
  const color =
    days <= 7  ? "var(--error)"
    : days <= 30 ? "var(--warning)"
    :              "var(--success)";
  const bg =
    days <= 7  ? "color-mix(in oklch, var(--error)   12%, var(--base-200))"
    : days <= 30 ? "color-mix(in oklch, var(--warning) 12%, var(--base-200))"
    :              "color-mix(in oklch, var(--success) 12%, var(--base-200))";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
      style={{ color, background: bg }}
    >
      <Clock size={10} /> {days}d
    </span>
  );
}

/* ── Batch Row ────────────────────────────────────────────
   FIX: was <motion.tr variants={fadeUp}> which renders as
        a <div> internally — browser discards it from <tbody>.
        Now: plain <tr> with CSS @keyframes fadeInRow stagger.
──────────────────────────────────────────────────────── */
function BatchRow({ batch, index }) {
  const expiry   = batch.expiryDate ? new Date(batch.expiryDate) : null;
  const daysLeft = expiry ? Math.ceil((expiry - Date.now()) / 86400000) : null;

  return (
    <tr
      className="border-b border-base-300/40 group hover:bg-primary/5 transition-colors duration-200"
      style={{
        animation: "fadeInRow 0.35s ease both",
        animationDelay: `${index * 0.04}s`,
      }}
    >
      {/* Medicine */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full animate-pulse shrink-0"
            style={{ background: "var(--primary)" }}
          />
          <div>
            <p className="font-semibold text-sm text-base-content">{batch.name}</p>
            <p className="text-xs text-base-content/40">{batch.brandName}</p>
          </div>
        </div>
      </td>

      {/* Batch No. */}
      <td className="py-3.5 px-4">
        <span className="font-mono text-xs bg-base-200 px-2 py-1 rounded-lg text-base-content/70">
          {batch.batchNumber || "—"}
        </span>
      </td>

      {/* Qty — motion.div inside <td> is valid */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-base-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((batch.stockQuantity / 200) * 100, 100)}%` }}
              transition={{ duration: 1.2, delay: index * 0.04, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                background:
                  batch.stockQuantity <= 10
                    ? "linear-gradient(90deg, var(--error), var(--warning))"
                    : "linear-gradient(90deg, var(--primary), var(--secondary))",
              }}
            />
          </div>
          <span
            className="text-sm font-black tabular-nums"
            style={{ color: batch.stockQuantity <= 10 ? "var(--warning)" : "var(--primary)" }}
          >
            {batch.stockQuantity}
          </span>
        </div>
      </td>

      {/* Expiry Date */}
      <td className="py-3.5 px-4">
        <p className="text-sm text-base-content/60">
          {expiry
            ? expiry.toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "2-digit",
              })
            : "—"}
        </p>
      </td>

      {/* Days Left */}
      <td className="py-3.5 px-4">
        {daysLeft !== null ? <DaysChip days={daysLeft} /> : "—"}
      </td>

      {/* Price */}
      <td className="py-3.5 px-4">
        <p className="text-sm font-semibold text-base-content">
          ₹{batch.pricePerUnit || "—"}
        </p>
      </td>
    </tr>
  );
}

/* ── Custom scatter dot ───────────────────────────────────
   FIX: was <motion.circle> — Framer Motion animates SVG
        elements incorrectly inside Recharts. Use plain <circle>.
──────────────────────────────────────────────────────── */
const ScatterDot = (props) => {
  const { cx, cy, payload } = props;
  const isLow = payload.y <= 10;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isLow ? 7 : 5}
      fill={isLow ? "var(--warning)" : "var(--primary)"}
      fillOpacity={0.8}
      stroke={isLow ? "var(--warning)" : "var(--secondary)"}
      strokeWidth={2}
    />
  );
};

/* ── Main ─────────────────────────────────────────────── */
export default function BatchMonitoring() {
  const dispatch = useDispatch();
  const { inventoryBatches, batchesPagination, expiryAlerts, loading } =
    useSelector((s) => s.pharmacyStore);

  const [page, setPage] = useState(1);
  const [tab,  setTab ] = useState("all");

  useEffect(() => {
    dispatch(fetchInventoryBatches({ page, limit: 20 }));
    dispatch(fetchExpiryAlerts({ days: 60 }));
  }, [dispatch, page]);

  const displayBatches =
    tab === "expiry"
      ? inventoryBatches.filter((b) => {
          const d = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
          return d <= 30;
        })
      : tab === "low"
      ? inventoryBatches.filter((b) => b.stockQuantity <= 10)
      : inventoryBatches;

  const scatterData = inventoryBatches.slice(0, 30).map((b, i) => ({
    x: i + 1,
    y: b.stockQuantity,
    name: b.name,
  }));

  const areaData = expiryAlerts.slice(0, 14).map((a) => ({
    name: a.name?.slice(0, 8),
    days: a.daysLeft,
  }));

  const totalBatches  = batchesPagination.totalItems || inventoryBatches.length;
  const criticalCount = inventoryBatches.filter((b) => {
    const d = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
    return d <= 7;
  }).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <GridBg />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -22 }}
          animate={{ opacity: 1,  y: 0  }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Activity size={18} className="text-primary" />
              </motion.div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary/60">
                Inventory Intelligence
              </span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Batch <span className="text-gradient-primary">Monitoring</span>
            </h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.04, rotate: 4 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => dispatch(fetchInventoryBatches({ page, limit: 20 }))}
            className="btn-primary-cta flex items-center gap-2 text-xs px-4 py-2.5"
          >
            <RefreshCw size={13} /> Sync
          </motion.button>
        </motion.div>

        {/* ── KPI Row ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { icon: Boxes,       label: "Total Batches",  value: totalBatches,                                                  color: "var(--primary)" },
            { icon: AlertCircle, label: "Expiring ≤30d",  value: expiryAlerts.length,                                           color: "var(--warning)" },
            { icon: Zap,         label: "Critical (≤7d)", value: criticalCount,                                                 color: "var(--error)"   },
            { icon: Package2,    label: "Low Stock",      value: inventoryBatches.filter((b) => b.stockQuantity <= 10).length,  color: "var(--accent)"  },
          ].map(({ icon: Icon, label, value, color }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className="glass-card p-5 relative overflow-hidden group"
            >
              <motion.div
                className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: color, filter: "blur(30px)" }}
              />
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `color-mix(in oklch, ${color} 15%, var(--base-200))` }}
                >
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-black font-montserrat" style={{ color }}>{value}</p>
              <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wider mt-1">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Charts row ── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">

          {/* Scatter — stock distribution */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-1 text-base-content flex items-center gap-2">
              <Hash size={14} className="text-primary" /> Stock Distribution
            </p>
            <p className="text-xs text-base-content/40 mb-4">Batch # vs quantity (yellow = low)</p>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                <XAxis
                  dataKey="x" name="Batch #"
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  dataKey="y" name="Qty"
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false} tickLine={false}
                />
                <ZAxis range={[40, 80]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "var(--base-200)",
                    border: "1px solid var(--base-300)",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                  formatter={(v, n) => [v, n]}
                />
                {/* plain <circle> SVG — motion.circle breaks inside Recharts */}
                <Scatter data={scatterData} shape={<ScatterDot />} />
              </ScatterChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Area — expiry countdown */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-1 text-base-content flex items-center gap-2">
              <Calendar size={14} className="text-warning" /> Expiry Countdown
            </p>
            <p className="text-xs text-base-content/40 mb-4">Days remaining per expiring batch</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData}>
                <defs>
                  <linearGradient id="expiryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--warning)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--warning)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--base-200)",
                    border: "1px solid var(--base-300)",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="days"
                  stroke="var(--warning)"
                  strokeWidth={2.5}
                  fill="url(#expiryGrad)"
                  dot={{ r: 3, fill: "var(--warning)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* ── Table ─────────────────────────────────────────────
            FIX: was <motion.table variants={stagger}> which renders
                 as a <div> — browser strips all <tr> children.
                 Now: plain <table>. Row stagger via CSS animation.
        ──────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card overflow-hidden">

          {/* Tabs */}
          <div className="flex gap-1 p-3 border-b border-base-300/50">
            {[
              { key: "all",    label: "All Batches"   },
              { key: "expiry", label: "⏰ Near Expiry" },
              { key: "low",    label: "⚠ Low Stock"   },
            ].map((t) => (
              <motion.button
                key={t.key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === t.key
                    ? "bg-primary text-primary-content"
                    : "text-base-content/50 hover:bg-base-200"
                }`}
              >
                {t.label}
              </motion.button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {/* plain <table> — NOT motion.table */}
            <table className="w-full" aria-label="Inventory batch table">
              <thead>
                <tr className="bg-base-200/60">
                  {["Medicine", "Batch No.", "Qty", "Expiry Date", "Days Left", "Price"].map((h) => (
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
                {loading.inventoryBatches ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-4 px-4">
                          <div className="skeleton h-4 rounded-lg" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-sm text-base-content/30">
                      No batches found
                    </td>
                  </tr>
                ) : (
                  displayBatches.map((b, i) => (
                    <BatchRow
                      key={`${b.medicineId}-${b.batchNumber}-${i}`}
                      batch={b}
                      index={i}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300/40">
            <p className="text-xs text-base-content/40">
              {displayBatches.length} of {batchesPagination.totalItems || "—"} batches
            </p>
            <div className="flex gap-2 items-center">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none"
              >
                <ChevronLeft size={14} />
              </motion.button>
              <span className="px-3 py-1 text-xs font-bold text-base-content/50">
                {page} / {batchesPagination.totalPages || 1}
              </span>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                disabled={page >= (batchesPagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
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