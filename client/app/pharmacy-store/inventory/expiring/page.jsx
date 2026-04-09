"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { fetchExpiryAlerts, fetchLowStock } from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  AlertTriangle, Clock, Bell, Mail, BellRing, Flame, Shield,
  ChevronDown, RefreshCw, TriangleAlert, CalendarClock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
// NOTE: RadialBarChart removed — it was imported but never used

/* ── Variants ────────────────────────────────────────── */
const spring  = { type: "spring", stiffness: 280, damping: 22 };
const fadeUp  = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: spring } };
const stagger = { hidden: {},                     show: { transition: { staggerChildren: 0.07 } } };

/* ── Danger pulse bg ─────────────────────────────────── */
function DangerBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        animate={{ opacity: [0.08, 0.18, 0.08], scale: [1, 1.2, 1] }}
        transition={{ duration: 5, repeat: Infinity }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse, var(--warning), transparent 70%)" }}
      />
      <motion.div
        animate={{ opacity: [0.05, 0.14, 0.05], scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, delay: 2 }}
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--error), transparent 70%)" }}
      />
    </div>
  );
}

/* ── Severity badge ──────────────────────────────────── */
function SeverityBadge({ days }) {
  if (days <= 7)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-red-500/15 text-red-500 border border-red-400/30">
        <Flame size={10} /> CRITICAL
      </span>
    );
  if (days <= 15)
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black"
        style={{
          background: "color-mix(in oklch, var(--error) 12%, var(--base-200))",
          color: "var(--error)",
        }}
      >
        <TriangleAlert size={10} /> URGENT
      </span>
    );
  if (days <= 30) return <span className="badge badge-warning">WARNING</span>;
  return <span className="badge badge-info">WATCH</span>;
}

/* ── Alert Card ───────────────────────────────────────────
   motion.div here is CORRECT — AlertCard renders as a <div>,
   not inside a <table>, so Framer Motion works fine.
──────────────────────────────────────────────────────── */
function AlertCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = item.daysLeft <= 7;
  const isUrgent   = item.daysLeft <= 15;

  return (
    <motion.div
      variants={fadeUp}
      className="glass-card overflow-hidden group"
      style={{
        borderColor: isCritical
          ? "color-mix(in oklch, var(--error)   40%, var(--base-300))"
          : isUrgent
          ? "color-mix(in oklch, var(--warning) 35%, var(--base-300))"
          : undefined,
      }}
    >
      {/* Critical pulse strip */}
      {isCritical && (
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--error), var(--warning), var(--error))",
          }}
        />
      )}

      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="p-2 rounded-xl shrink-0"
            style={{
              background: isCritical
                ? "color-mix(in oklch, var(--error)   16%, var(--base-200))"
                : "color-mix(in oklch, var(--warning) 14%, var(--base-200))",
            }}
          >
            <AlertTriangle
              size={16}
              style={{ color: isCritical ? "var(--error)" : "var(--warning)" }}
            />
          </motion.div>
          <div>
            <p className="font-bold text-sm text-base-content">{item.name}</p>
            <p className="text-xs text-base-content/50">
              {item.brandName} · Batch: {item.batchNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SeverityBadge days={item.daysLeft} />
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} className="text-base-content/40" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={  { height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-base-300/40 pt-3">
              {[
                { label: "Days Left",  value: item.daysLeft,              unit: "days",  danger: true },
                { label: "Stock Qty",  value: item.stockQuantity,         unit: "units"              },
                { label: "Category",   value: item.category || "General", unit: ""                   },
              ].map((s) => (
                <div key={s.label} className="bg-base-200 rounded-xl p-3 text-center">
                  <p
                    className="text-lg font-black font-montserrat"
                    style={{
                      color:
                        s.danger && item.daysLeft <= 7
                          ? "var(--error)"
                          : "var(--primary)",
                    }}
                  >
                    {s.value}
                    <span className="text-xs font-normal text-base-content/40 ml-1">
                      {s.unit}
                    </span>
                  </p>
                  <p className="text-xs text-base-content/40 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Custom pie label ────────────────────────────────── */
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x      = cx + radius * Math.cos(-midAngle * RADIAN);
  const y      = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="bold"
    >
      {value}
    </text>
  );
};

/* ── Main ────────────────────────────────────────────── */
export default function ExpiryAlerts() {
  const dispatch = useDispatch();
  const { expiryAlerts, expiryAlertsMeta, lowStockItems, loading } =
    useSelector((s) => s.pharmacyStore);

  const [days,      setDays     ] = useState(30);
  const [emailSent, setEmailSent] = useState(false);
  // FIX: removed unused `sendEmail` state — it was set but never read

  useEffect(() => {
    dispatch(fetchExpiryAlerts({ days }));
    dispatch(fetchLowStock({}));
  }, [dispatch, days]);

  const handleEmailAlert = async () => {
    await dispatch(fetchExpiryAlerts({ days, sendEmail: "true" }));
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  /* Severity buckets */
  const critical = expiryAlerts.filter((a) => a.daysLeft <= 7);
  const urgent   = expiryAlerts.filter((a) => a.daysLeft > 7  && a.daysLeft <= 15);
  const warning  = expiryAlerts.filter((a) => a.daysLeft > 15 && a.daysLeft <= 30);
  const watch    = expiryAlerts.filter((a) => a.daysLeft > 30);

  const pieData = [
    { name: "Critical ≤7d",  value: critical.length, color: "var(--error)"       },
    { name: "Urgent ≤15d",   value: urgent.length,   color: "oklch(62% 0.20 25)" },
    { name: "Warning ≤30d",  value: warning.length,  color: "var(--warning)"     },
    { name: "Watch >30d",    value: watch.length,    color: "var(--info)"        },
  ].filter((d) => d.value > 0);

  const barData = expiryAlerts.slice(0, 10).map((a) => ({
    name: a.name?.slice(0, 8),
    days: a.daysLeft,
    qty:  a.stockQuantity,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <DangerBg />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -22 }}
          animate={{ opacity: 1,  y: 0  }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <BellRing size={18} style={{ color: "var(--warning)" }} />
              </motion.div>
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--warning)" }}
              >
                Expiry Alert System
              </span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Expiry{" "}
              <span
                style={{
                  WebkitTextFillColor: "transparent",
                  background: "linear-gradient(135deg, var(--warning), var(--error))",
                  WebkitBackgroundClip: "text",
                }}
              >
                Alerts
              </span>
            </h1>
            <p className="text-sm text-base-content/50 mt-1">
              {expiryAlertsMeta.count} medicines expiring within{" "}
              <strong>{expiryAlertsMeta.alertDays}</strong> days
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Days filter */}
            <div className="flex gap-1 p-1 bg-base-200 rounded-xl">
              {[7, 30, 60, 90].map((d) => (
                <motion.button
                  key={d}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    days === d
                      ? "bg-primary text-primary-content"
                      : "text-base-content/50 hover:bg-base-300"
                  }`}
                >
                  {d}d
                </motion.button>
              ))}
            </div>

            {/* Email alert */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleEmailAlert}
              disabled={loading.expiryAlerts}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                emailSent
                  ? "bg-success/20 text-success border border-success/40"
                  : "btn-primary-cta"
              }`}
            >
              <Mail size={13} />
              {emailSent ? "Sent ✓" : "Email Alert"}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Severity KPI row ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Critical", count: critical.length, color: "var(--error)",            icon: Flame         },
            { label: "Urgent",   count: urgent.length,   color: "oklch(62% 0.20 25)",      icon: TriangleAlert },
            { label: "Warning",  count: warning.length,  color: "var(--warning)",           icon: AlertTriangle },
            { label: "Watch",    count: watch.length,    color: "var(--info)",              icon: Shield        },
          ].map(({ label, count, color, icon: Icon }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className="glass-card p-5 relative overflow-hidden"
              style={
                count > 0 && label === "Critical"
                  ? {
                      boxShadow: `0 0 30px color-mix(in oklch, ${color} 20%, transparent)`,
                      borderColor: `color-mix(in oklch, ${color} 35%, var(--base-300))`,
                    }
                  : {}
              }
            >
              {label === "Critical" && count > 0 && (
                <motion.div
                  animate={{ opacity: [0, 0.15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: color }}
                />
              )}
              <Icon size={20} className="mb-2" style={{ color }} />
              <p className="text-3xl font-black font-montserrat" style={{ color }}>{count}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mt-1">
                {label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Charts ── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">

          {/* Pie — severity distribution */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-4 flex items-center gap-2">
              <Clock size={14} style={{ color: "var(--warning)" }} /> Severity Distribution
            </p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={CustomLabel}
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--base-200)",
                      border: "1px solid var(--base-300)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span
                        style={{ fontSize: 11, color: "var(--base-content)", opacity: 0.6 }}
                      >
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-base-content/30">
                No expiring items 🎉
              </div>
            )}
          </motion.div>

          {/* Bar — days left per item */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-4 flex items-center gap-2">
              <CalendarClock size={14} style={{ color: "var(--error)" }} /> Days Left Per Item
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="35%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--base-300)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--base-200)",
                    border: "1px solid var(--base-300)",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="days" radius={[5, 5, 0, 0]} animationDuration={1200}>
                  {barData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.days <= 7
                          ? "var(--error)"
                          : d.days <= 15
                          ? "oklch(62% 0.20 25)"
                          : "var(--warning)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* ── Alert list ─────────────────────────────────────────
            motion.div stagger wrapper is CORRECT here:
            AlertCard renders as <div> cards, not table rows.
        ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-black text-base font-montserrat text-base-content flex items-center gap-2">
              <Bell size={16} className="text-warning" />
              All Expiry Alerts
              <span className="badge badge-warning ml-2">{expiryAlerts.length}</span>
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => dispatch(fetchExpiryAlerts({ days }))}
              aria-label="Refresh expiry alerts"
              className="p-2 rounded-xl hover:bg-base-200 transition-colors focus-visible:outline-none"
            >
              <RefreshCw size={14} className="text-base-content/50" />
            </motion.button>
          </div>

          {loading.expiryAlerts ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : expiryAlerts.length === 0 ? (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="glass-card p-12 text-center"
            >
              <Shield size={40} className="mx-auto mb-3 text-success" />
              <p className="font-bold text-base-content/60">
                All medicines are well within expiry!
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {expiryAlerts
                .slice()
                .sort((a, b) => a.daysLeft - b.daysLeft)
                .map((alert, i) => (
                  <AlertCard
                    key={`${alert.batchNumber}-${i}`}
                    item={alert}
                    index={i}
                  />
                ))}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}