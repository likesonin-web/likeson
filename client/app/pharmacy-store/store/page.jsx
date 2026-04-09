"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Package, ChevronRight, Save, Loader2, Check,
  AlertCircle, Clock, MapPin, Truck, Building2, Settings,
  AlertTriangle, TrendingDown, Calendar, BarChart3,
  ShieldCheck, Boxes, Layers, Activity, RefreshCw
} from "lucide-react";
import {
  RadialBarChart, RadialBar, Cell, ResponsiveContainer,
  Tooltip, PieChart, Pie
} from "recharts";
import {
  fetchStore, updateStore, fetchInventorySummary,
  fetchLowStock, fetchExpiryAlerts
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

/* ─── Nav config ──────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { name: "Store Settings",    href: "/pharmacy-store/store",                   icon: Store   },
  { name: "Inventory Summary", href: "/pharmacy-store/store/inventory-summary", icon: Package },
];

/* ─── Motion presets ──────────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function SectionHeader({ title, subtitle }) {
  return (
    <div className="px-6 py-5 border-b border-base-300/50 bg-base-200/30">
      <h3 className="font-black text-lg text-base-content font-montserrat">{title}</h3>
      {subtitle && <p className="text-sm text-base-content/50 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`h-${i === 1 ? 32 : 20} rounded-2xl skeleton-shimmer`} />
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "primary", sub }) {
  return (
    <motion.div variants={fadeUp}
      className={`p-5 rounded-2xl border border-${color}/20 bg-gradient-to-br from-${color}/8 to-${color}/3
        hover:border-${color}/40 transition-all group`}>
      <div className={`p-2.5 rounded-xl bg-${color}/10 text-${color} w-fit mb-3
        group-hover:scale-110 transition-transform`}>
        <Icon size={20} />
      </div>
      <div className={`text-3xl font-black font-montserrat text-${color}`}>{value}</div>
      <div className="text-sm font-semibold text-base-content/60 mt-1">{label}</div>
      {sub && <div className="text-xs text-base-content/40 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

const STATUS_OPTIONS = ["Open", "Closed", "Under-Maintenance", "Inactive"];
const STATUS_COLORS  = {
  Open: "success", Closed: "error", "Under-Maintenance": "warning", Inactive: "neutral"
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ─── Section: Store Settings ─────────────────────────────────────────────── */
function StoreSettings({ dispatch }) {
  const { store, loading, errors, success } = useSelector(s => s.pharmacyStore);
  const [form, setForm] = useState({
    deliveryRadiusKm: 5,
    estimatedDeliveryTime: "2 Hours",
    status: "Open",
    timings: DAYS.map(d => ({ day: d, open: "09:00", close: "21:00", is24x7: false })),
  });

  useEffect(() => {
    dispatch(fetchStore());
  }, []);

  useEffect(() => {
    if (store) {
      setForm({
        deliveryRadiusKm: store.deliverySettings?.deliveryRadiusKm ?? 5,
        estimatedDeliveryTime: store.deliverySettings?.estimatedDeliveryTime ?? "2 Hours",
        status: store.status ?? "Open",
        timings: store.timings?.length ? store.timings : DAYS.map(d => ({
          day: d, open: "09:00", close: "21:00", is24x7: false,
        })),
      });
    }
  }, [store]);

  const handleTimingChange = (idx, field, value) => {
    setForm(p => {
      const t = [...p.timings];
      t[idx] = { ...t[idx], [field]: value };
      return { ...p, timings: t };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(updateStore(form));
  };

  if (loading.store && !store) return <LoadingState />;

  const statusColor = STATUS_COLORS[form.status] ?? "primary";

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Store hero */}
      {store && (
        <motion.div variants={fadeUp}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-base-100 to-secondary/10
            border border-base-300/60 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/4 translate-x-1/4" />
          <div className="relative flex flex-col sm:flex-row items-start gap-4">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              <Store size={28} />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-2xl font-black text-base-content font-montserrat">{store.storeName}</h2>
                {store.isVerified && <ShieldCheck size={20} className="text-success" />}
              </div>
              <p className="text-sm text-base-content/60">
                {store.address?.line1}, {store.address?.city}, {store.address?.state}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                  bg-${STATUS_COLORS[store.status]}/15 text-${STATUS_COLORS[store.status]}
                  border border-${STATUS_COLORS[store.status]}/30`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-${STATUS_COLORS[store.status]}`} />
                  {store.status}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-base-200 text-base-content/70 border border-base-300">
                  {store.storeType}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-base-200 text-base-content/70 border border-base-300">
                  Priority: {store.priority}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status */}
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden shadow-sm">
          <SectionHeader title="Store Status" subtitle="Control your store's operational state" />
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATUS_OPTIONS.map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(p => ({ ...p, status: s }))}
                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border
                    ${form.status === s
                      ? `bg-${STATUS_COLORS[s]} text-${STATUS_COLORS[s] === "warning" ? "warning-content" : `${STATUS_COLORS[s]}-content`} border-${STATUS_COLORS[s]} shadow-sm`
                      : "bg-base-200 text-base-content/70 border-base-300 hover:border-primary hover:text-primary"
                    }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Delivery settings */}
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden shadow-sm">
          <SectionHeader title="Delivery Settings" subtitle="Configure your delivery range and timing" />
          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
                  Delivery Radius (km)
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input type="number" min="1" max="100"
                    value={form.deliveryRadiusKm}
                    onChange={e => setForm(p => ({ ...p, deliveryRadiusKm: Number(e.target.value) }))}
                    className="input-field w-full pl-10" />
                </div>
                <div className="mt-3">
                  <input type="range" min="1" max="50" value={form.deliveryRadiusKm}
                    onChange={e => setForm(p => ({ ...p, deliveryRadiusKm: Number(e.target.value) }))}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-base-content/40 mt-1">
                    <span>1 km</span><span>50 km</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
                  Estimated Delivery Time
                </label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input type="text"
                    value={form.estimatedDeliveryTime}
                    onChange={e => setForm(p => ({ ...p, estimatedDeliveryTime: e.target.value }))}
                    placeholder="e.g. 2 Hours"
                    className="input-field w-full pl-10" />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["30 mins", "1 Hour", "2 Hours", "4 Hours", "Same Day"].map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(p => ({ ...p, estimatedDeliveryTime: t }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border
                        ${form.estimatedDeliveryTime === t
                          ? "bg-primary text-primary-content border-primary"
                          : "bg-base-200 border-base-300 text-base-content/60 hover:border-primary"
                        }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Store timings */}
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden shadow-sm">
          <SectionHeader title="Operating Hours" subtitle="Set your store's weekly schedule" />
          <div className="p-6">
            <div className="space-y-3">
              {form.timings.map((t, i) => (
                <div key={t.day}
                  className="grid grid-cols-[120px_1fr_1fr_auto] sm:grid-cols-[140px_1fr_1fr_auto] items-center gap-3
                    p-3 rounded-xl bg-base-200/50 border border-base-300/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${t.is24x7 ? "bg-success" : "bg-primary"}`} />
                    <span className="text-sm font-semibold text-base-content">{t.day.slice(0, 3)}</span>
                  </div>
                  {t.is24x7 ? (
                    <div className="col-span-2 text-sm font-bold text-success">Open 24 × 7</div>
                  ) : (
                    <>
                      <input type="time" value={t.open}
                        onChange={e => handleTimingChange(i, "open", e.target.value)}
                        className="input-field text-sm" />
                      <input type="time" value={t.close}
                        onChange={e => handleTimingChange(i, "close", e.target.value)}
                        className="input-field text-sm" />
                    </>
                  )}
                  <button type="button"
                    onClick={() => handleTimingChange(i, "is24x7", !t.is24x7)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap
                      ${t.is24x7
                        ? "bg-success text-success-content border-success"
                        : "bg-base-300 border-base-300 text-base-content/60 hover:border-success"
                      }`}>
                    24h
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Submit */}
        <motion.div variants={fadeUp}>
          <AnimatePresence>
            {success.storeUpdate && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-success/10 text-success text-sm border border-success/20 mb-4">
                <Check size={16} /> Store settings updated successfully!
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex justify-end">
            <button type="submit" disabled={loading.store}
              className="btn-primary-cta flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading.store ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Store Settings
            </button>
          </div>
        </motion.div>
      </form>
    </motion.div>
  );
}

/* ─── Section: Inventory Summary ──────────────────────────────────────────── */
function InventorySummary({ dispatch }) {
  const { inventorySummary, lowStockItems, expiryAlerts,
          loading, lowStockMeta, expiryAlertsMeta } = useSelector(s => s.pharmacyStore);

  useEffect(() => {
    dispatch(fetchInventorySummary());
    dispatch(fetchLowStock({ threshold: 5 }));
    dispatch(fetchExpiryAlerts({ days: 30 }));
  }, []);

  const refresh = () => {
    dispatch(fetchInventorySummary());
    dispatch(fetchLowStock({ threshold: 5 }));
    dispatch(fetchExpiryAlerts({ days: 30 }));
  };

  const isLoading = loading.inventorySummary || loading.lowStock || loading.expiryAlerts;

  const stockHealth = inventorySummary
    ? Math.round(
        ((inventorySummary.totalSKUs - (inventorySummary.lowStockCount ?? 0)) /
          Math.max(inventorySummary.totalSKUs, 1)) * 100
      )
    : 0;

  const donutData = [
    { name: "Healthy",    value: inventorySummary?.totalSKUs - (inventorySummary?.lowStockCount ?? 0) ?? 0, fill: "var(--success)" },
    { name: "Low Stock",  value: inventorySummary?.lowStockCount ?? 0,                                       fill: "var(--warning)" },
    { name: "Expiring",   value: inventorySummary?.expiringSoonCount ?? 0,                                   fill: "var(--error)"   },
  ];

  const expiryColors = (days) => {
    if (days <= 7)  return "error";
    if (days <= 15) return "warning";
    return "info";
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total SKUs"        value={inventorySummary?.totalSKUs ?? 0}            icon={Boxes}       color="primary" sub="Unique products" />
        <StatCard label="Total Units"       value={inventorySummary?.totalUnits ?? 0}           icon={Layers}      color="secondary" />
        <StatCard label="Low Stock Items"   value={inventorySummary?.lowStockCount ?? 0}        icon={TrendingDown} color="warning" sub={`≤ ${inventorySummary?.lowStockThreshold ?? 5} units`} />
        <StatCard label="Expiring Soon"     value={inventorySummary?.expiringSoonCount ?? 0}    icon={Calendar}    color="error" sub={`Within ${inventorySummary?.expiryAlertDays ?? 30} days`} />
      </div>

      {/* Health gauge + donut */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Stock health */}
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-base-300/60 bg-base-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-base text-base-content font-montserrat">Stock Health</h3>
              <p className="text-xs text-base-content/50">Overall inventory condition</p>
            </div>
            <button onClick={refresh} disabled={isLoading}
              className="p-2 rounded-xl hover:bg-base-200 text-base-content/50 hover:text-primary
                transition-colors disabled:opacity-40">
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="60%" outerRadius="90%"
                  data={[{ value: stockHealth, fill: "var(--success)" }]}
                  startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "var(--base-300)" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-success font-montserrat">{stockHealth}%</span>
                <span className="text-xs text-base-content/50">Health</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {donutData.map(({ name, value, fill }) => (
                <div key={name}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-base-content/70">{name}</span>
                    <span className="text-base-content">{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-base-300 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round((value / Math.max(inventorySummary?.totalSKUs ?? 1, 1)) * 100)}%`,
                        background: fill,
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Donut chart */}
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-base-300/60 bg-base-100 p-6 shadow-sm">
          <h3 className="font-black text-base text-base-content font-montserrat mb-4">SKU Distribution</h3>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={35} outerRadius={58}
                    paddingAngle={3} dataKey="value">
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--base-200)", border: "1px solid var(--base-300)",
                      borderRadius: "12px", fontSize: "12px", fontFamily: "var(--font-family-poppins)"
                    }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {donutData.map(({ name, value, fill }) => (
                <div key={name} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: fill }} />
                  <span className="text-sm text-base-content/70 flex-1">{name}</span>
                  <span className="text-sm font-bold text-base-content">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Low Stock Table */}
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-warning/20 bg-base-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-warning/20 bg-warning/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-warning/15 text-warning"><AlertTriangle size={18} /></div>
            <div>
              <h3 className="font-black text-base text-base-content font-montserrat">Low Stock Alert</h3>
              <p className="text-xs text-base-content/50">{lowStockMeta.count} items need restocking</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {lowStockItems.length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck size={32} className="mx-auto text-success mb-2" />
              <p className="text-sm font-semibold text-base-content/50">All items are sufficiently stocked</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300/50">
                  {["Medicine", "Category", "Batch", "Stock", "Expiry", "Price"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest
                      text-base-content/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStockItems.slice(0, 10).map((item, i) => (
                  <motion.tr key={i} variants={fadeUp}
                    className="border-b border-base-300/30 hover:bg-warning/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-base-content">{item.brandName || item.name}</div>
                    </td>
                    <td className="px-4 py-3 text-base-content/60">{item.category || "—"}</td>
                    <td className="px-4 py-3 text-base-content/60">{item.batchNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                        ${item.stockQuantity === 0
                          ? "bg-error/15 text-error border border-error/30"
                          : "bg-warning/15 text-warning border border-warning/30"
                        }`}>
                        {item.stockQuantity} units
                      </span>
                    </td>
                    <td className="px-4 py-3 text-base-content/60 text-xs">
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-base-content">
                      ₹{item.pricePerUnit ?? "—"}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Expiry alerts */}
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-error/20 bg-base-100 overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-error/20 bg-error/5">
          <div className="p-2 rounded-xl bg-error/15 text-error"><Calendar size={18} /></div>
          <div>
            <h3 className="font-black text-base text-base-content font-montserrat">Expiring Soon</h3>
            <p className="text-xs text-base-content/50">
              {expiryAlertsMeta.count} batches expiring within {expiryAlertsMeta.alertDays} days
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {expiryAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck size={32} className="mx-auto text-success mb-2" />
              <p className="text-sm font-semibold text-base-content/50">No medicines expiring soon</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300/50">
                  {["Medicine", "Batch", "Expiry Date", "Days Left", "Units"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest
                      text-base-content/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiryAlerts.slice(0, 10).map((item, i) => {
                  const color = expiryColors(item.daysLeft);
                  return (
                    <motion.tr key={i} variants={fadeUp}
                      className="border-b border-base-300/30 hover:bg-error/5 transition-colors">
                      <td className="px-4 py-3 font-semibold text-base-content">
                        {item.brandName || item.name}
                      </td>
                      <td className="px-4 py-3 text-base-content/60">{item.batchNumber}</td>
                      <td className="px-4 py-3 text-base-content/60 text-xs">
                        {new Date(item.expiryDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold
                          bg-${color}/15 text-${color} border border-${color}/30`}>
                          {item.daysLeft}d left
                        </span>
                      </td>
                      <td className="px-4 py-3 text-base-content">{item.stockQuantity}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({ activeSection, onNavigate }) {
  return (
    <nav className="space-y-1">
      {NAV_LINKS.map(({ name, href, icon: Icon }) => {
        const section = href.split("/pharmacy-store/store/")[1] || "index";
        const isActive = activeSection === section;
        return (
          <button key={href} onClick={() => onNavigate(section)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
              transition-all duration-200 group text-left
              ${isActive
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
              }`}>
            <Icon size={17} className={isActive ? "text-primary-content" : "text-base-content/50 group-hover:text-primary"} />
            <span className="flex-1">{name}</span>
            <ChevronRight size={14} className={`transition-transform ${isActive ? "text-primary-content/60" : "text-base-content/30"}`} />
          </button>
        );
      })}
    </nav>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function StorePage({ params }) {
  const dispatch = useDispatch();
  const { store } = useSelector(s => s.pharmacyStore);
  const section = params?.section?.[0] ?? "index";
  const [activeSection, setActiveSection] = useState(section);

  useEffect(() => {
    dispatch(fetchStore());
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case "inventory-summary": return <InventorySummary dispatch={dispatch} />;
      default:                  return <StoreSettings dispatch={dispatch} />;
    }
  };

  const currentLink = NAV_LINKS.find(l => {
    const s = l.href.split("/pharmacy-store/store/")[1] || "index";
    return s === activeSection;
  });

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 text-xs text-base-content/40 font-semibold uppercase tracking-widest mb-3">
            <Building2 size={13} />
            <span>Pharmacy Store</span>
            <ChevronRight size={12} />
            <span className="text-primary">Store</span>
          </div>
          <h1 className="text-3xl font-black text-base-content font-montserrat tracking-tight">
            Store Management
          </h1>
          <p className="text-base-content/50 text-sm mt-1">
            Configure your store settings and monitor inventory health
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }} className="lg:sticky lg:top-6 h-fit">
            {store && (
              <div className="rounded-2xl border border-base-300/60 bg-base-100 p-4 mb-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Store size={18} /></div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-base-content truncate">{store.storeName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full bg-${STATUS_COLORS[store.status]}`} />
                      <p className="text-xs text-base-content/50">{store.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-base-300/60 bg-base-100 p-3 shadow-sm">
              <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeSection}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-2 mb-5">
                  {currentLink && (
                    <>
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <currentLink.icon size={16} />
                      </div>
                      <h2 className="font-black text-xl text-base-content font-montserrat">
                        {currentLink.name}
                      </h2>
                    </>
                  )}
                </div>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}