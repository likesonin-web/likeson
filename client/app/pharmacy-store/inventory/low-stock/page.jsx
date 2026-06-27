"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchLowStock,
  fetchMedicineStock,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  AlertTriangle,
  TrendingDown,
  Package,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Pill,
  Calendar,
  Tag,
  Hash,
  Layers,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  Eye,
  SlidersHorizontal,
  CircleDot,
  Building2,
  AlertCircle,Loader2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

/* ─── Motion Variants ─────────────────────────────────────── */
const FADE_UP = { 
  hidden: { opacity: 0, y: 20 }, 
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } } 
};
const STAGGER = { 
  hidden: {}, 
  show: { transition: { staggerChildren: 0.05 } } 
};

/* ─── CSS Row Stagger (Table-Safe) ───────────────────────── */
const rowStyle = (i) => ({
  animation: "fadeInRow 0.4s ease-out forwards",
  animationDelay: `${i * 0.03}s`,
  opacity: 0, // start invisible until animation kicks in
});

/* ─── Urgency Logic ─────────────────────────────────────── */
const urgencyLevel = (qty) =>
  qty === 0 ? "out" : qty <= 3 ? "critical" : qty <= 7 ? "urgent" : "low";

const URGENCY_META = {
  out:      { label: "Out of Stock", color: "var(--error)",   bg: "color-mix(in oklch, var(--error)   10%, transparent)", border: "var(--error)" },
  critical: { label: "Critical",     color: "var(--error)",   bg: "color-mix(in oklch, var(--error)   10%, transparent)", border: "color-mix(in oklch, var(--error) 40%, transparent)" },
  urgent:   { label: "Urgent",       color: "var(--warning)", bg: "color-mix(in oklch, var(--warning) 10%, transparent)", border: "color-mix(in oklch, var(--warning) 40%, transparent)" },
  low:      { label: "Low",          color: "var(--accent)",  bg: "color-mix(in oklch, var(--accent)  10%, transparent)", border: "color-mix(in oklch, var(--accent) 40%, transparent)" },
};

/* ─── Global Background ──────────────────────────────────── */
function WarningBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base-200">
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* Subtle warning mesh */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, var(--error) 0, var(--error) 1px, transparent 0, transparent 50%)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Ambient Glows */}
      <motion.div
        animate={{ opacity: [0.03, 0.08, 0.03], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl bg-error"
      />
    </div>
  );
}

/* ─── Urgency Badge ───────────────────────────────────────── */
function UrgencyBadge({ qty }) {
  const u = URGENCY_META[urgencyLevel(qty)];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ background: u.bg, color: u.color, border: `1px solid ${u.border}` }}
    >
      <CircleDot size={8} className={qty === 0 ? "animate-pulse" : ""} />
      {u.label}
    </span>
  );
}

/* ─── Stat Card ───────────────────────────────────────────── */
const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, color, pulse }) {
  return (
    <motion.div variants={FADE_UP} className="card p-5 relative overflow-hidden group shadow-sm border border-base-300 bg-base-100">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 80% 20%, color-mix(in oklch,${color} 8%,transparent), transparent 60%)` }}
      />
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in oklch,${color} 15%, transparent)` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {pulse && (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: color }}></span>
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-black font-montserrat" style={{ color }}>{value ?? "—"}</p>
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mt-1">{label}</p>
        {sub && <p className="text-[10px] text-base-content/40 mt-1 font-medium">{sub}</p>}
      </div>
    </motion.div>
  );
});

/* ─── Recharts Tooltip ────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 shadow-xl rounded-xl px-4 py-3 text-xs z-50">
      <p className="font-bold text-base-content mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-base-content/70">{p.name}:</span>
          <strong className="text-base-content">{p.value} items</strong>
        </div>
      ))}
    </div>
  );
};

/* ─── Charts ──────────────────────────────────────────────── */
const CategoryChart = memo(function CategoryChart({ items }) {
  const data = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      const cat = it.category || "General";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.slice(0, 12) + (name.length > 12 ? '...' : ''), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [items]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="var(--error)" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--base-300)", opacity: 0.4 }} />
        <Bar dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} barSize={32} name="Inventory Items" />
      </BarChart>
    </ResponsiveContainer>
  );
});

const UrgencyPie = memo(function UrgencyPie({ items }) {
  const data = useMemo(() => {
    const out      = items.filter((i) => (i.availableStock || 0) === 0).length;
    const critical = items.filter((i) => (i.availableStock || 0) > 0 && (i.availableStock || 0) <= 3).length;
    const urgent   = items.filter((i) => (i.availableStock || 0) > 3 && (i.availableStock || 0) <= 7).length;
    const low      = items.filter((i) => (i.availableStock || 0) > 7).length;
    
    return [
      { name: "Out of Stock", value: out,      color: "var(--error)"   },
      { name: "Critical (≤3)",value: critical, color: "oklch(62% 0.22 25)" },
      { name: "Urgent (≤7)",  value: urgent,   color: "var(--warning)" },
      { name: "Low (≤10)",    value: low,      color: "var(--accent)"  },
    ].filter((d) => d.value > 0);
  }, [items]);

  if (!data.length) return (
    <div className="h-[220px] flex items-center justify-center text-xs text-base-content/40 font-medium border border-dashed border-base-300 rounded-xl">
      No Alert Data Available
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
          paddingAngle={4} dataKey="value" animationDuration={800} stroke="none"
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: '10px' }}
          formatter={(v) => <span className="text-base-content/70 font-medium">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

/* ─── Detail Modal ────────────────────────────────────────── */
const StockDetailModal = memo(function StockDetailModal({ item, onClose, stockDetail, isLoading }) {
  const batches = useMemo(
    () => stockDetail?.medicineId === item?.medicineId ? stockDetail.storeInventory ?? [] : [],
    [stockDetail, item]
  );

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const qty = item?.availableStock ?? 0;
  const isOut = qty === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral/60 backdrop-blur-sm"
      onClick={onClose} role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-base-100 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-base-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning strip */}
        {qty <= 3 && (
          <div className="h-1.5 w-full bg-gradient-to-r from-error via-warning to-error bg-[length:200%_auto] animate-[gradient_2s_linear_infinite]" />
        )}

        {/* Header */}
        <div className="px-6 py-5 border-b border-base-200 bg-base-100 flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isOut ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-base-content leading-tight">{item?.name}</h3>
              <p className="text-xs text-base-content/50 mt-1">{item?.brandName}</p>
              <div className="mt-2">
                <UrgencyBadge qty={qty} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:text-base-content">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-base-200/30">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-base-100 border border-base-200 rounded-2xl p-4 text-center shadow-sm">
              <Package size={16} className="mx-auto mb-2 opacity-40 text-base-content" />
              <p className={`text-xl font-black ${isOut ? 'text-error' : 'text-warning'}`}>{qty}</p>
              <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest mt-1">Available</p>
            </div>
            <div className="bg-base-100 border border-base-200 rounded-2xl p-4 text-center shadow-sm">
              <Tag size={16} className="mx-auto mb-2 opacity-40 text-primary" />
              <p className="text-xl font-black text-primary">₹{item?.sellingPrice ?? item?.mrp ?? "—"}</p>
              <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest mt-1">Unit Price</p>
            </div>
            <div className="bg-base-100 border border-base-200 rounded-2xl p-4 text-center shadow-sm">
              <AlertCircle size={16} className="mx-auto mb-2 opacity-40 text-base-content" />
              <p className="text-xl font-black text-base-content">{item?.reorderLevel ?? 10}</p>
              <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest mt-1">Threshold</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
              <Layers size={14} className="text-primary" /> Active Batches in Store
              {isLoading && <Loader2 size={12} className="animate-spin text-primary ml-2" />}
            </h4>

            {isLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-14 w-full rounded-xl bg-base-300" />
                <div className="skeleton h-14 w-full rounded-xl bg-base-300" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-6 bg-base-100 border border-base-200 border-dashed rounded-xl">
                <p className="text-xs font-medium text-base-content/40">No batch records found in registry.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                {batches.map((b, i) => (
                  <div key={b._id || i} className="flex items-center justify-between bg-base-100 border border-base-200 rounded-xl p-3 shadow-sm">
                    <div>
                      <p className="text-sm font-bold text-base-content font-mono">{b.batchNumber || "Unknown Batch"}</p>
                      <p className="text-[11px] text-base-content/50 mt-0.5 flex items-center gap-1.5">
                        <Calendar size={10} />
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-base-content">{b.stockQuantity}</p>
                      <p className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">Units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

/* ─── Table Skeleton ──────────────────────────────────────── */
function TableSkeleton({ rows = 6 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 5 }).map((_, j) => (
        <td key={j} className="py-4 px-6 border-b border-base-200">
          <div className="skeleton h-4 w-full rounded bg-base-300/50" />
        </td>
      ))}
    </tr>
  ));
}

/* ─── Table Row ───────────────────────────────────────────── */
const LowStockRow = memo(function LowStockRow({ item, index, onView }) {
  const qty = item.availableStock ?? 0;
  const u   = URGENCY_META[urgencyLevel(qty)];
  const threshold = item.reorderLevel ?? 10;
  const pct = Math.min((qty / threshold) * 100, 100);

  return (
    <tr className="border-b border-base-200 hover:bg-base-200/50 transition-colors group" style={rowStyle(index)}>
      {/* Medicine Info */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: u.bg, borderColor: u.border }}>
            <Pill size={16} style={{ color: u.color }} />
          </div>
          <div>
            <p className="font-bold text-sm text-base-content">{item.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-base-content/50">{item.brandName || "Generic"}</span>
              <span className="w-1 h-1 rounded-full bg-base-300" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">{item.category || "Item"}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Stock Bar */}
      <td className="py-4 px-6">
        <div className="min-w-[120px]">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-black tabular-nums" style={{ color: u.color }}>{qty}</span>
            <span className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">/ {threshold} min</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-base-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              style={{ background: u.color }}
            />
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-4 px-6">
        <div className="text-sm font-bold text-base-content">
          ₹{item.sellingPrice ?? item.mrp ?? "—"}
        </div>
        <div className="text-[10px] text-base-content/40 uppercase tracking-wider font-semibold mt-0.5">Per Unit</div>
      </td>

      {/* Status */}
      <td className="py-4 px-6">
        <UrgencyBadge qty={qty} />
      </td>

      {/* Actions */}
      <td className="py-4 px-6 text-right">
        <button
          onClick={() => onView(item)}
          className="btn btn-sm btn-ghost border border-base-300 text-base-content/60 hover:text-primary hover:border-primary hover:bg-primary/5"
        >
          <Eye size={14} />
          <span className="hidden lg:inline ml-1">Details</span>
        </button>
      </td>
    </tr>
  );
});

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE EXPORT
═══════════════════════════════════════════════════════════ */
export default function LowStock() {
  const dispatch = useDispatch();

  const { lowStockItems, lowStockMeta, medicineStockDetail, loading } = useSelector((s) => s.pharmacyStore);

  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState("availableStock");
  const [sortAsc, setSortAsc]     = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [selected, setSelected]   = useState(null);

  const isLoading      = loading.lowStock;
  const isStockLoading = loading.medicineStock;

  useEffect(() => {
    dispatch(fetchLowStock({}));
  }, [dispatch]);

  useEffect(() => {
    if (selected?.medicineId) {
      dispatch(fetchMedicineStock(selected.medicineId));
    }
  }, [dispatch, selected?.medicineId]);

  /* ── Derived Data ── */
  const categories = useMemo(() => ["all", ...Array.from(new Set(lowStockItems.map((i) => i.category || "General").filter(Boolean)))], [lowStockItems]);

  const filtered = useMemo(() => {
    let list = lowStockItems;
    if (catFilter !== "all") list = list.filter((i) => (i.category || "General") === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name?.toLowerCase().includes(q) || i.brandName?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let av = a[sortKey] ?? 0; 
      let bv = b[sortKey] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ?  1 : -1;
      return 0;
    });
  }, [lowStockItems, search, catFilter, sortKey, sortAsc]);

  /* ── Stats ── */
  const outCount      = useMemo(() => lowStockItems.filter((i) => (i.availableStock ?? 0) === 0).length, [lowStockItems]);
  const criticalCount = useMemo(() => lowStockItems.filter((i) => (i.availableStock ?? 0) > 0 && (i.availableStock ?? 0) <= 3).length, [lowStockItems]);
  const urgentCount   = useMemo(() => lowStockItems.filter((i) => (i.availableStock ?? 0) > 3 && (i.availableStock ?? 0) <= 7).length, [lowStockItems]);

  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

  return (
    <div data-theme="pharmacy" className="min-h-screen relative z-0 pb-16">
      <WarningBg />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-error">Reorder Required</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black font-montserrat tracking-tight text-base-content">
              Low <span className="text-error">Stock Alerts</span>
            </h1>
            <p className="text-sm text-base-content/50 mt-2 font-medium">
              Monitor inventory nearing depletion. Recommended threshold is <strong className="text-base-content">≤ {lowStockMeta?.threshold ?? 10} units</strong>.
            </p>
          </div>

          <button
            onClick={() => dispatch(fetchLowStock({}))}
            disabled={isLoading}
            className="btn bg-base-100 border border-base-300 text-base-content shadow-sm hover:bg-base-200"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin text-primary" : "text-base-content/60"} />
            <span className="hidden sm:inline">Sync Data</span>
          </button>
        </motion.div>

        {/* ── Stat Cards ── */}
        <motion.div variants={STAGGER} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Layers}        label="Total Alerts"  value={lowStockMeta?.count ?? lowStockItems.length} color="var(--primary)" />
          <StatCard icon={Zap}           label="Out of Stock"  value={outCount}      color="var(--error)"   pulse={outCount > 0} />
          <StatCard icon={ShieldAlert}   label="Critical (≤3)" value={criticalCount} color="oklch(62% 0.22 25)" />
          <StatCard icon={AlertTriangle} label="Urgent (≤7)"   value={urgentCount}   color="var(--warning)"  />
        </motion.div>

        {/* ── Charts ── */}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card bg-base-100 border border-base-300 shadow-sm p-6">
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2 text-base-content uppercase tracking-wider">
              <SlidersHorizontal size={14} className="text-primary" /> Category Distribution
            </h3>
            <p className="text-xs text-base-content/40 mb-6 font-medium">Alerts grouped by product type</p>
            <CategoryChart items={lowStockItems} />
          </motion.div>

          <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card bg-base-100 border border-base-300 shadow-sm p-6">
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2 text-base-content uppercase tracking-wider">
              <ShieldAlert size={14} className="text-error" /> Severity Breakdown
            </h3>
            <p className="text-xs text-base-content/40 mb-6 font-medium">Items categorized by urgency level</p>
            <UrgencyPie items={lowStockItems} />
          </motion.div>
        </div>

        {/* ── Data Table ── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          
          {/* Table Toolbar */}
          <div className="p-4 border-b border-base-200 bg-base-100/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field w-full pl-9 h-10 text-sm bg-base-200/50"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat} onClick={() => setCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap capitalize ${
                    catFilter === cat ? "bg-base-content text-base-100" : "bg-base-200 text-base-content/60 hover:bg-base-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left" aria-label="Low stock items registry">
              <thead className="bg-base-200/50">
                <tr>
                  {[
                    { key: "name",           label: "Product Name" },
                    { key: "availableStock", label: "Available Qty" },
                    { key: "sellingPrice",   label: "Unit Price" },
                    { key: null,             label: "Alert Status" },
                    { key: null,             label: "Actions" },
                  ].map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={key ? () => toggleSort(key) : undefined}
                      className={`py-4 px-6 text-xs font-bold uppercase tracking-widest text-base-content/50 ${key ? "cursor-pointer hover:text-base-content select-none" : ""}`}
                    >
                      <div className={`flex items-center gap-1.5 ${label === 'Actions' ? 'justify-end' : ''}`}>
                        {label}
                        {key && sortKey === key && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton rows={5} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-base-200 mb-4">
                        <Package size={28} className="text-base-content/30" />
                      </div>
                      <h3 className="font-bold text-base-content text-lg">All caught up!</h3>
                      <p className="text-sm text-base-content/50 mt-1 max-w-sm mx-auto">No inventory items are currently falling below their reorder thresholds.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, i) => (
                    <LowStockRow
                      key={item.inventoryId || i}
                      item={item}
                      index={i}
                      onView={setSelected}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer Info */}
          {!isLoading && filtered.length > 0 && (
            <div className="p-4 border-t border-base-200 bg-base-200/30 flex items-center justify-between">
              <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
                Showing {filtered.length} of {lowStockItems.length} Alerts
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selected && (
          <StockDetailModal
            item={selected}
            onClose={() => setSelected(null)}
            stockDetail={medicineStockDetail?.medicineId === selected.medicineId ? medicineStockDetail : null}
            isLoading={isStockLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}