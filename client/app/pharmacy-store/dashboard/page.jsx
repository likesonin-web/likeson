"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchAnalyticsOverview,
  fetchDailyEarnings,
  fetchOrders,
  fetchLowStock,
  fetchExpiryAlerts,
  fetchStore,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  TrendingUp, Package, AlertTriangle, ShoppingBag,
  IndianRupee, Clock, CheckCircle2, XCircle, Truck,
  RefreshCw, ArrowUpRight, Activity, Zap, Bell,
  Calendar, Pill, Store, ChevronRight, BarChart3,
  CircleDot, ShieldAlert, Sparkles,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ── Motion variants ─────────────────────────────────────── */
const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

/* ── Row CSS animation (table-safe) ─────────────────────── */
const rowStyle = (i) => ({ animation: "fadeInRow 0.35s ease both", animationDelay: `${i * 0.045}s` });

/* ── Background ──────────────────────────────────────────── */
function DashBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <style>{`
        @keyframes fadeInRow { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dashPulse { 0%,100%{opacity:.06} 50%{opacity:.14} }
      `}</style>
      {/* Subtle hex grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle, var(--primary) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <motion.div animate={{ opacity:[0.08,0.18,0.08], scale:[1,1.12,1] }} transition={{ duration:9, repeat:Infinity }}
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--primary), transparent 65%)" }} />
      <motion.div animate={{ opacity:[0.05,0.13,0.05] }} transition={{ duration:12, repeat:Infinity, delay:4 }}
        className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--success), transparent 65%)" }} />
      <motion.div animate={{ opacity:[0.04,0.1,0.04] }} transition={{ duration:10, repeat:Infinity, delay:7 }}
        className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--accent), transparent 65%)" }} />
    </div>
  );
}

/* ── Custom tooltip ──────────────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs" style={{ border:"1px solid var(--base-300)" }}>
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{typeof p.value === "number" && p.name?.includes("₹") ? `₹${p.value.toLocaleString("en-IN")}` : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────── */
const KpiCard = memo(function KpiCard({ icon: Icon, label, value, sub, color, pulse, trend }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5 relative overflow-hidden group">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background:`radial-gradient(ellipse at 80% 20%, color-mix(in oklch,${color} 10%,transparent), transparent 70%)` }} />
      {pulse && (
        <motion.div animate={{ opacity:[0,0.12,0] }} transition={{ duration:2, repeat:Infinity }}
          className="absolute inset-0 rounded-2xl" style={{ background:color }} />
      )}
      <div className="flex items-start justify-between mb-3 relative">
        <div className="p-2.5 rounded-xl" style={{ background:`color-mix(in oklch,${color} 14%,var(--base-200))` }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ color: trend >= 0 ? "var(--success)":"var(--error)", background: trend >= 0 ? "color-mix(in oklch,var(--success) 12%,var(--base-200))":"color-mix(in oklch,var(--error) 12%,var(--base-200))" }}>
            <ArrowUpRight size={9} />{Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black font-montserrat relative" style={{ color }}>{value ?? "—"}</p>
      <p className="text-xs font-semibold text-base-content/55 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>}
    </motion.div>
  );
});

/* ── Order status badge ──────────────────────────────────── */
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const cls = s === "delivered" ? "badge-success" : s === "pending" ? "badge-warning" : s === "cancelled" ? "badge-error" : "badge-info";
  return <span className={`badge ${cls} text-xs capitalize`}>{status || "—"}</span>;
}

/* ── Store status pill ───────────────────────────────────── */
function StoreStatusPill({ status }) {
  const isOpen = status === "Open" || status === "open";
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
      style={{ background: isOpen ? "color-mix(in oklch,var(--success) 14%,var(--base-200))" : "color-mix(in oklch,var(--error) 14%,var(--base-200))", color: isOpen ? "var(--success)" : "var(--error)", border:`1px solid ${isOpen ? "color-mix(in oklch,var(--success) 30%,var(--base-300))" : "color-mix(in oklch,var(--error) 30%,var(--base-300))"}` }}>
      <motion.span animate={{ scale:[1,1.4,1] }} transition={{ duration:1.5, repeat:Infinity }} className="w-1.5 h-1.5 rounded-full" style={{ background: isOpen ? "var(--success)" : "var(--error)" }} />
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}

/* ── Table skeleton ──────────────────────────────────────── */
function TableSkeleton({ rows = 5, cols = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="py-3.5 px-4"><div className="skeleton h-3.5 rounded-lg" /></td>
      ))}
    </tr>
  ));
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function MyStoreDashboard() {
  const dispatch = useDispatch();
  const {
    analyticsOverview, dailyEarnings,
    orders, ordersPagination,
    lowStockItems, lowStockMeta,
    expiryAlerts, expiryAlertsMeta,
    store, loading,
  } = useSelector((s) => s.pharmacyStore);

  const [refreshing, setRefreshing] = useState(false);

  /* ── Fetch all dashboard data ── */
  useEffect(() => {
    dispatch(fetchAnalyticsOverview({ dateFilter: "today" }));
    dispatch(fetchDailyEarnings());
    dispatch(fetchOrders({ dateFilter: "today", limit: 8 }));
    dispatch(fetchLowStock({}));
    dispatch(fetchExpiryAlerts({ days: 30 }));
    dispatch(fetchStore());
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchAnalyticsOverview({ dateFilter: "today" })),
      dispatch(fetchDailyEarnings()),
      dispatch(fetchOrders({ dateFilter: "today", limit: 8 })),
      dispatch(fetchLowStock({})),
    ]);
    setRefreshing(false);
  };

  /* ── Derived data ── */
  const ov = analyticsOverview || {};
  const de = dailyEarnings     || {};

  const statusData = useMemo(() => {
    const sb = ov.statusBreakdown || {};
    return Object.entries(sb).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [ov]);

  const COLORS = ["var(--primary)","var(--success)","var(--warning)","var(--error)","var(--info)","var(--accent)"];

  const criticalCount = useMemo(() => lowStockItems.filter(i => i.stockQuantity === 0).length, [lowStockItems]);
  const expCritical   = useMemo(() => expiryAlerts.filter(i => { const d = i.expiryDate ? Math.ceil((new Date(i.expiryDate)-Date.now())/86400000) : null; return d !== null && d <= 7; }).length, [expiryAlerts]);

  return (
    <div className="min-h-screen" style={{ background:"var(--base-100)" }}>
      <DashBg />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.div animate={{ rotate:[0,15,-15,0] }} transition={{ duration:3, repeat:Infinity, repeatDelay:5 }}>
                <Sparkles size={15} className="text-accent" />
              </motion.div>
              <span className="text-xs font-black uppercase tracking-widest text-accent/70">Command Centre</span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              My <span className="text-gradient-primary">Store</span>
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <p className="text-sm text-base-content/50">{store?.storeName || "Pharmacy Dashboard"}</p>
              {store?.status && <StoreStatusPill status={store.status} />}
              {store?.deliveryRadiusKm && (
                <span className="text-xs text-base-content/35 flex items-center gap-1">
                  <Truck size={10} /> {store.deliveryRadiusKm} km radius
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Alert chips */}
            {criticalCount > 0 && (
              <motion.div animate={{ scale:[1,1.05,1] }} transition={{ duration:1.5, repeat:Infinity }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background:"color-mix(in oklch,var(--error) 12%,var(--base-200))", color:"var(--error)", border:"1px solid color-mix(in oklch,var(--error) 25%,var(--base-300))" }}>
                <CircleDot size={10} /> {criticalCount} Out of Stock
              </motion.div>
            )}
            {expCritical > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background:"color-mix(in oklch,var(--warning) 12%,var(--base-200))", color:"var(--warning)", border:"1px solid color-mix(in oklch,var(--warning) 25%,var(--base-300))" }}>
                <Bell size={10} /> {expCritical} Expiring Soon
              </div>
            )}
            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              onClick={handleRefresh} disabled={refreshing}
              className="btn-primary-cta flex items-center gap-2 text-xs px-4 py-2.5 disabled:opacity-60">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* ── KPI Row ── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard icon={ShoppingBag}  label="Today's Orders"   value={ov.totalOrders   ?? orders.length}           color="var(--primary)"   sub={`${ordersPagination?.totalItems || 0} total`} />
          <KpiCard icon={IndianRupee}  label="Today's Revenue"  value={de.grossRevenue  != null ? `₹${de.grossRevenue.toLocaleString("en-IN")}` : "—"} color="var(--success)"  trend={8} />
          <KpiCard icon={AlertTriangle} label="Low Stock Items"  value={lowStockMeta?.count ?? lowStockItems.length} color="var(--warning)"  pulse={criticalCount > 0} sub={criticalCount > 0 ? `${criticalCount} out of stock` : undefined} />
          <KpiCard icon={Calendar}     label="Expiry Alerts"    value={expiryAlertsMeta?.count ?? expiryAlerts.length} color="var(--info)" sub={`Within ${expiryAlertsMeta?.alertDays ?? 30} days`} />
        </motion.div>

        {/* ── Revenue + Status pie ── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">

          {/* Daily earnings breakdown */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5 lg:col-span-2">
            <p className="font-bold text-sm mb-1 flex items-center gap-2">
              <Activity size={13} className="text-primary" /> Today's Financial Summary
            </p>
            <p className="text-xs text-base-content/40 mb-4">Gross · Net · GST · Discounts</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:"Gross Revenue", value: de.grossRevenue, color:"var(--primary)" },
                { label:"Net Revenue",   value: de.netRevenue,   color:"var(--success)" },
                { label:"GST Collected", value: de.gstCollected, color:"var(--info)"    },
                { label:"Discounts",     value: de.discounts,    color:"var(--warning)" },
              ].map((s) => (
                <div key={s.label} className="bg-base-200 rounded-xl p-3 text-center">
                  <p className="text-lg font-black font-montserrat" style={{ color:s.color }}>
                    {s.value != null ? `₹${s.value.toLocaleString("en-IN")}` : "—"}
                  </p>
                  <p className="text-xs text-base-content/45 mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <p className="text-xs text-base-content/40 mb-3 font-semibold uppercase tracking-wider">Orders · GST · Discounts</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:"Paid Orders",   value: de.paidOrders,   color:"var(--primary)"   },
                  { label:"GST Amount",    value: de.gstCollected, color:"var(--info)",  prefix:"₹" },
                  { label:"Total Discount",value: de.discounts,    color:"var(--warning)", prefix:"₹" },
                ].map(s => (
                  <div key={s.label} className="bg-base-200/60 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background:s.color }} />
                    <div>
                      <p className="text-sm font-black" style={{ color:s.color }}>
                        {s.value != null ? `${s.prefix||""}${s.value.toLocaleString("en-IN")}` : "—"}
                      </p>
                      <p className="text-xs text-base-content/40">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Order status pie */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-1 flex items-center gap-2">
              <BarChart3 size={13} className="text-secondary" /> Order Status
            </p>
            <p className="text-xs text-base-content/40 mb-3">Today's breakdown</p>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                    paddingAngle={3} dataKey="value" animationDuration={900}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:10 }}
                    formatter={(v) => <span style={{ color:"var(--base-content)", opacity:0.55 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-base-content/30">No orders today</div>
            )}
          </motion.div>
        </div>

        {/* ── Recent orders + alerts row ── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">

          {/* Recent orders table */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between p-4 border-b border-base-300/50">
              <p className="font-bold text-sm flex items-center gap-2">
                <ShoppingBag size={13} className="text-primary" /> Recent Orders
              </p>
              <span className="text-xs text-base-content/40">{orders.length} shown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Recent orders">
                <thead>
                  <tr className="bg-base-200/60">
                    {["Order ID","Customer","Amount","Status","Time"].map(h => (
                      <th key={h} scope="col" className="text-left py-2.5 px-4 text-xs font-black uppercase tracking-widest text-base-content/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading.orders ? <TableSkeleton rows={5} cols={5} /> :
                   orders.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-sm text-base-content/30">No orders today</td></tr>
                  ) : orders.slice(0, 8).map((o, i) => (
                    <tr key={o._id || i} className="border-b border-base-300/40 hover:bg-primary/4 transition-colors" style={rowStyle(i)}>
                      <td className="py-3 px-4 font-mono text-xs text-primary font-bold">#{o.orderId}</td>
                      <td className="py-3 px-4 text-xs text-base-content">{o.customer?.name || "—"}</td>
                      <td className="py-3 px-4 text-sm font-bold text-success">
                        {o.billing?.totalPayable != null ? `₹${o.billing.totalPayable.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={o.delivery?.status} /></td>
                      <td className="py-3 px-4 text-xs text-base-content/40">
                        {o.createdAt ? new Date(o.createdAt).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Alerts panel */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5 flex flex-col gap-4">
            <p className="font-bold text-sm flex items-center gap-2">
              <Bell size={13} className="text-warning" /> Live Alerts
            </p>

            {/* Low stock alerts */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-base-content/35 mb-2 flex items-center gap-1">
                <Package size={9} /> Low Stock ({lowStockMeta?.count ?? lowStockItems.length})
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {lowStockItems.slice(0, 5).map((item, i) => (
                  <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                    className="flex items-center justify-between bg-base-200 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Pill size={10} style={{ color: item.stockQuantity === 0 ? "var(--error)" : "var(--warning)" }} />
                      <p className="text-xs font-semibold text-base-content truncate max-w-[110px]">{item.name}</p>
                    </div>
                    <span className="text-xs font-black tabular-nums"
                      style={{ color: item.stockQuantity === 0 ? "var(--error)" : "var(--warning)" }}>
                      {item.stockQuantity}
                    </span>
                  </motion.div>
                ))}
                {lowStockItems.length === 0 && <p className="text-xs text-base-content/30 py-2 text-center">All stocked up</p>}
              </div>
            </div>

            {/* Expiry alerts */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-base-content/35 mb-2 flex items-center gap-1">
                <Calendar size={9} /> Expiring Soon ({expiryAlertsMeta?.count ?? expiryAlerts.length})
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {expiryAlerts.slice(0, 5).map((item, i) => {
                  const days = item.expiryDate ? Math.ceil((new Date(item.expiryDate) - Date.now()) / 86400000) : null;
                  return (
                    <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.05 }}
                      className="flex items-center justify-between bg-base-200 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-base-content truncate max-w-[120px]">{item.name}</p>
                      <span className="text-xs font-black" style={{ color: days !== null && days <= 7 ? "var(--error)" : "var(--warning)" }}>
                        {days !== null ? `${days}d` : "—"}
                      </span>
                    </motion.div>
                  );
                })}
                {expiryAlerts.length === 0 && <p className="text-xs text-base-content/30 py-2 text-center">No expiry alerts</p>}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Store info strip ── */}
        {store && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-4 flex items-center gap-2">
              <Store size={13} className="text-primary" /> Store Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label:"Store Name",      value: store.storeName || "—" },
                { label:"Delivery Radius", value: store.deliveryRadiusKm ? `${store.deliveryRadiusKm} km` : "—" },
                { label:"Est. Delivery",   value: store.estimatedDeliveryTime || "—" },
                { label:"Status",          value: store.status || "—", colored: true, isOpen: store.status === "Open" },
              ].map(s => (
                <div key={s.label} className="bg-base-200 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-base-content/40 mb-1">{s.label}</p>
                  <p className={`text-sm font-bold ${s.colored ? "" : "text-base-content"}`}
                    style={s.colored ? { color: s.isOpen ? "var(--success)" : "var(--error)" } : {}}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}