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
  fetchMedicines,
  fetchMedicineStock,
  fetchLowStock,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  Search,
  Package,
  AlertTriangle,
  TrendingDown,
  Filter,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Layers,
  Pill,
  BarChart3,
  ArrowUpRight,
  Eye,
  Activity,
  X,
  Calendar,
  Tag,
  Beaker,
  Building2,
  Hash,
  Percent,
  User,
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

/* ─── motion variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } },
};

/* ─── helpers ─────────────────────────────────────────────── */
/** Sum all storeInventory batch quantities for a medicine object */
const totalStock = (med) =>
  (med.storeInventory || []).reduce((s, b) => s + (b.stockQuantity || 0), 0);

/** Nearest expiry date (ISO string → formatted) */
const nearestExpiry = (med) => {
  const dates = (med.storeInventory || [])
    .map((b) => b.expiryDate && new Date(b.expiryDate))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dates[0]
    ? dates[0].toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";
};

/* ─── Background orbs ─────────────────────────────────────── */
function BackgroundOrbs() {
  return (
    <>
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {[
        { color: "var(--primary)",   pos: "-top-32 -left-32",    size: "w-[500px] h-[500px]", dur: 8 },
        { color: "var(--secondary)", pos: "bottom-0 right-0",    size: "w-[400px] h-[400px]", dur: 10, delay: 2 },
        { color: "var(--accent)",    pos: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", size: "w-[600px] h-[600px]", dur: 12, delay: 4 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.22, 0.12] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: "easeInOut", delay: orb.delay || 0 }}
          className={`absolute rounded-full ${orb.pos} ${orb.size}`}
          style={{ background: `radial-gradient(circle, ${orb.color}, transparent 70%)` }}
        />
      ))}
    </div>
    </>
  );
}

/* ─── Stat card ───────────────────────────────────────────── */
const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <motion.div variants={itemVariants} className="glass-card p-5 relative overflow-hidden group cursor-default">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 80% 20%, color-mix(in oklch,${color} 12%,transparent),transparent 70%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in oklch,${color} 15%,var(--base-200))` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <ArrowUpRight size={14} className="text-base-content/30 group-hover:text-primary transition-colors" />
      </div>
      <p className="text-2xl font-black font-montserrat" style={{ color }}>{value ?? "—"}</p>
      <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-base-content/40 mt-0.5">{sub}</p>}
    </motion.div>
  );
});

/* ─── Custom recharts tooltip ─────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs" style={{ border: "1px solid var(--base-300)" }}>
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/* ─── Stock bar chart (top 10 by total stock) ─────────────── */
const StockBarChart = memo(function StockBarChart({ medicines }) {
  const data = useMemo(
    () =>
      medicines.slice(0, 10).map((m) => ({
        name:  m.name?.slice(0, 9) + (m.name?.length > 9 ? "…" : ""),
        stock: totalStock(m),
      })),
    [medicines]
  );
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} barCategoryGap="30%">
        <defs>
          <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--primary)"   stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--primary)", opacity: 0.06 }} />
        <Bar dataKey="stock" fill="url(#stockGrad)" radius={[6, 6, 0, 0]} name="Units" />
      </BarChart>
    </ResponsiveContainer>
  );
});

/* ─── Category pie chart ──────────────────────────────────── */
const CategoryPieChart = memo(function CategoryPieChart({ medicines }) {
  const data = useMemo(() => {
    const counts = {};
    medicines.forEach((m) => { counts[m.category || "Other"] = (counts[m.category || "Other"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [medicines]);

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
});

/* ─── Expiry timeline chart ───────────────────────────────── */
const ExpiryTimeline = memo(function ExpiryTimeline({ medicines }) {
  const data = useMemo(() => {
    const now     = new Date();
    const buckets = { "< 3 mo": 0, "3–6 mo": 0, "6–12 mo": 0, "> 12 mo": 0 };
    medicines.forEach((m) =>
      (m.storeInventory || []).forEach((b) => {
        if (!b.expiryDate) return;
        const mo = (new Date(b.expiryDate) - now) / (1000 * 60 * 60 * 24 * 30);
        if      (mo < 3)  buckets["< 3 mo"]++;
        else if (mo < 6)  buckets["3–6 mo"]++;
        else if (mo < 12) buckets["6–12 mo"]++;
        else              buckets["> 12 mo"]++;
      })
    );
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [medicines]);

  const COLORS = ["var(--error)", "var(--warning)", "var(--info)", "var(--success)"];
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} barCategoryGap="40%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} name="Batches">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

/* ─── Low-stock alert banner ──────────────────────────────── */
/**
 * lowStockItems shape from API:
 *   { name, brandName, category, medicineId, batchNumber, stockQuantity, expiryDate, pricePerUnit }
 */
const LowStockAlerts = memo(function LowStockAlerts({ lowStockItems, threshold }) {
  if (!lowStockItems?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border-l-4 mb-6"
      style={{ borderLeftColor: "var(--warning)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} style={{ color: "var(--warning)" }} />
        <p className="font-bold text-sm text-base-content">
          Low Stock Alerts
          <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-xs" style={{ background: "color-mix(in oklch,var(--warning) 15%,var(--base-200))", color: "var(--warning)" }}>
            {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""} · threshold ≤ {threshold ?? 10}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {lowStockItems.map((item, i) => (
          <motion.div
            key={item.medicineId || i}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{
              background: "color-mix(in oklch,var(--warning) 12%,var(--base-200))",
              border:     "1px solid color-mix(in oklch,var(--warning) 30%,transparent)",
              color:      "var(--warning)",
            }}
          >
            <Pill size={10} />
            {item.name}
            {item.brandName && <span className="opacity-60">({item.brandName})</span>}
            <span className="font-black">{item.stockQuantity} left</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});

/* ─── Table skeleton rows ─────────────────────────────────── */
function TableSkeleton({ rows = 7 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, j) => (
        <td key={j} className="py-4 px-4">
          <div className="skeleton h-4 w-full rounded-lg" />
        </td>
      ))}
    </tr>
  ));
}

/* ─── Medicine table row ──────────────────────────────────── */
const MedicineRow = memo(function MedicineRow({ med, index, onView }) {
  const total  = useMemo(() => totalStock(med), [med]);
  const isLow  = total > 0 && total <= 10;
  const isOut  = total === 0;
  const pct    = useMemo(() => Math.min((total / Math.max(total + 50, 100)) * 100, 100), [total]);
  const expiry = useMemo(() => nearestExpiry(med), [med]);
  const handle = useCallback(() => onView(med), [med, onView]);

  const stockColor = isOut ? "var(--error)" : isLow ? "var(--warning)" : "var(--success)";

  return (
    <tr
      className="group border-b border-base-300/50 hover:bg-primary/5 transition-colors duration-200"
      style={{ animation: `fadeInRow 0.35s ease both`, animationDelay: `${index * 0.04}s` }}
    >
      {/* Name */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
            <Pill size={13} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-base-content leading-tight">{med.name}</p>
            <p className="text-xs text-base-content/45 mt-0.5">{med.brandName || "—"}</p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-3.5 px-4">
        <span className="badge badge-info text-xs">{med.category || "General"}</span>
      </td>

      {/* MRP */}
      <td className="py-3.5 px-4 text-sm font-semibold text-base-content">
        ₹{med.mrp ?? "—"}
      </td>

      {/* Stock bar */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-base-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, delay: index * 0.04, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: stockColor }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: stockColor }}>{total}</span>
        </div>
      </td>

      {/* Batches */}
      <td className="py-3.5 px-4">
        <span className="text-xs font-semibold text-base-content/55">
          {med.storeInventory?.length ?? 0} batch{(med.storeInventory?.length ?? 0) !== 1 ? "es" : ""}
        </span>
      </td>

      {/* Nearest expiry */}
      <td className="py-3.5 px-4">
        <span className="text-xs text-base-content/50 flex items-center gap-1">
          <Calendar size={10} />
          {expiry}
        </span>
      </td>

      {/* Status */}
      <td className="py-3.5 px-4">
        {isOut  ? <span className="badge badge-error">Out of Stock</span>
        : isLow ? <span className="badge badge-warning">Low Stock</span>
                : <span className="badge badge-success">In Stock</span>}
      </td>

      {/* View */}
      <td className="py-3.5 px-4">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={handle}
          aria-label={`View details for ${med.name}`}
          className="flex items-center gap-1.5 text-primary text-xs font-semibold hover:underline focus-visible:outline-none"
        >
          <Eye size={13} /> View
        </motion.button>
      </td>
    </tr>
  );
});

/* ─── Stock detail modal ──────────────────────────────────── */
/**
 * stockDetail comes from fetchMedicineStock → state.pharmacyStore.medicineStockDetail
 * Shape: { medicineId, name, storeInventory[], totalStock, isLowStock }
 *
 * Falls back to med.storeInventory if stockDetail is not yet loaded for this medicine.
 */
const StockDetailModal = memo(function StockDetailModal({ med, onClose, stockDetail, isLoadingStock }) {
  // Use live stock-detail batches if they belong to this medicine; else fall back
  const batches = useMemo(
    () =>
      stockDetail?.medicineId === med?._id
        ? stockDetail.storeInventory ?? []
        : med?.storeInventory ?? [],
    [stockDetail, med]
  );
  const total = useMemo(() => batches.reduce((s, b) => s + (b.stockQuantity || 0), 0), [batches]);
  const primaryImage = med?.images?.find((i) => i.isPrimary)?.url;

  // Close on Escape
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Stock details for ${med?.name}`}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 30 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.88, opacity: 0, y: 30  }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="glass-card w-full max-w-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="flex items-center gap-4">
            {primaryImage && (
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-base-200 shrink-0">
                <img src={primaryImage} alt={med.name} className="w-full h-full object-contain p-1" loading="lazy" />
              </div>
            )}
            <div>
              <h3 className="font-black text-lg font-montserrat text-base-content leading-tight">{med?.name}</h3>
              <p className="text-xs text-base-content/50 mt-0.5">{med?.brandName} · {med?.genericName}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="badge badge-info text-xs">{med?.category}</span>
                {med?.isPrescriptionRequired && <span className="badge badge-warning text-xs">Rx Required</span>}
                {med?.schedule && med.schedule !== "None" && (
                  <span className="badge badge-error text-xs">Schedule {med.schedule}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-base-300 transition-colors shrink-0 focus-visible:outline-none"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "MRP",     value: `₹${med?.mrp ?? "—"}`,             icon: Tag     },
            { label: "Batches", value: batches.length,                     icon: Layers  },
            { label: "Total Stock", value: total,                          icon: Package },
            { label: "GST",     value: `${med?.gstPercentage ?? "—"}%`,    icon: Percent },
          ].map((s) => (
            <div key={s.label} className="bg-base-200 rounded-xl p-3 text-center">
              <s.icon size={13} className="mx-auto mb-1 text-primary opacity-60" />
              <p className="text-lg font-black font-montserrat text-primary">{s.value}</p>
              <p className="text-xs text-base-content/50 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Medicine info */}
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {/* Salt composition */}
          <div className="bg-base-200 rounded-xl p-3">
            <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-1.5 flex items-center gap-1">
              <Beaker size={10} /> Salt Composition
            </p>
            {(med?.saltComposition || []).length > 0 ? (
              <div className="space-y-1">
                {med.saltComposition.map((s, i) => (
                  <p key={i} className="text-xs text-base-content font-medium">
                    {s.ingredient} <span className="text-primary font-bold">{s.strength}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-base-content/40">—</p>
            )}
          </div>

          {/* Manufacturer */}
          <div className="bg-base-200 rounded-xl p-3">
            <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-1.5 flex items-center gap-1">
              <Building2 size={10} /> Manufacturer
            </p>
            <p className="text-xs text-base-content font-semibold">{med?.manufacturer || "—"}</p>
            <p className="text-xs text-base-content/50 mt-1">HSN: {med?.hsnCode || "—"}</p>
            <p className="text-xs text-base-content/50">Pack: {med?.packaging || "—"}</p>
          </div>
        </div>

        {/* Dosage */}
        {med?.dosage && (
          <div className="bg-base-200 rounded-xl p-3 mb-4">
            <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-1">Dosage</p>
            <p className="text-xs text-base-content/70">{med.dosage}</p>
          </div>
        )}

        {/* Batch inventory */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2 flex items-center gap-1">
            <Hash size={10} /> Batch Inventory
            {isLoadingStock && <span className="ml-1 text-primary animate-pulse">· loading…</span>}
          </p>

          {isLoadingStock ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
            </div>
          ) : batches.length === 0 ? (
            <p className="text-sm text-center text-base-content/40 py-6">No batch data</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {batches.map((b, i) => {
                const isLow = b.stockQuantity > 0 && b.stockQuantity <= 10;
                const isOut = b.stockQuantity === 0;
                const qtyColor = isOut ? "var(--error)" : isLow ? "var(--warning)" : "var(--success)";
                return (
                  <motion.div
                    key={b._id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between bg-base-200 rounded-xl p-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-base-content">{b.batchNumber}</p>
                      <p className="text-xs text-base-content/50">
                        Exp:{" "}
                        {b.expiryDate
                          ? new Date(b.expiryDate).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })
                          : "—"}
                      </p>
                      {b.pricePerUnit != null && (
                        <p className="text-xs text-base-content/50">₹{b.pricePerUnit}/unit</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black" style={{ color: qtyColor }}>{b.stockQuantity}</p>
                      <p className="text-xs text-base-content/40">units</p>
                      {b.isLowStock && (
                        <span className="text-xs font-bold" style={{ color: "var(--warning)" }}>Low</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function CurrentStock() {
  const dispatch = useDispatch();

  /* ── Slice selectors — exact initialState keys ── */
  const {
    medicines,
    medicinesPagination,
    lowStockItems,
    lowStockMeta,
    medicineStockDetail,
    loading,
  } = useSelector((s) => s.pharmacyStore);

  /* Current authenticated user */
  const user = useSelector((state) => state.user?.user) ?? null;

  /* ── Local UI state ── */
  const [search,      setSearch     ] = useState("");
  const [filter,      setFilter     ] = useState("all");   // "all" | "low" | "expiry"
  const [page,        setPage       ] = useState(1);
  const [selected,    setSelected   ] = useState(null);    // medicine object for modal
  const [activeChart, setActiveChart] = useState("stock"); // "stock" | "category" | "expiry"

  /* ── Loading flags — exact slice keys ── */
  const isMedicinesLoading = loading.medicines;
  const isStockLoading     = loading.medicineStock;

  /* ── Derived stats from real storeInventory data ── */
  const outOfStock = useMemo(
    () => medicines.filter((m) => totalStock(m) === 0).length,
    [medicines]
  );

  const allBatches = useMemo(
    () => medicines.reduce((s, m) => s + (m.storeInventory?.length || 0), 0),
    [medicines]
  );

  const allUnits = useMemo(
    () => medicines.reduce((s, m) => s + totalStock(m), 0),
    [medicines]
  );

  /* ── Fetch medicines when page / search / filter changes ── */
  useEffect(() => {
    dispatch(
      fetchMedicines({
        page,
        limit: 20,
        search: search || undefined,
        ...(filter === "low"    && { lowStock: true }),
        ...(filter === "expiry" && { expiringSoon: true }),
      })
    );
  }, [dispatch, page, search, filter]);

  /* ── Fetch low-stock list once on mount ── */
  useEffect(() => {
    dispatch(fetchLowStock({}));
  }, [dispatch]);

  /* ── Fetch live stock detail when a medicine is selected.
        fetchMedicineStock signature: async (medicineId: string, ...) ── */
  useEffect(() => {
    if (selected?._id) {
      dispatch(fetchMedicineStock(selected._id));
    }
  }, [dispatch, selected?._id]);

  /* ── Stable handlers ── */
  const handleRefresh = useCallback(() => {
    dispatch(fetchMedicines({ page, limit: 20, search: search || undefined }));
    dispatch(fetchLowStock({}));
  }, [dispatch, page, search]);

  const handleSearch = useCallback((e) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((f) => {
    setFilter(f);
    setPage(1);
  }, []);

  const handleCloseModal = useCallback(() => setSelected(null), []);

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <BackgroundOrbs />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1,  y: 0   }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Current <span className="text-gradient-primary">Stock</span>
            </h1>
            <p className="text-sm text-base-content/50 mt-1 flex items-center gap-2">
              Live inventory · {medicinesPagination?.totalItems ?? medicines.length} medicines
              {user?.name && (
                <span className="inline-flex items-center gap-1 text-primary/60">
                  <User size={11} /> {user.name}
                </span>
              )}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleRefresh}
            disabled={isMedicinesLoading}
            aria-label="Refresh inventory"
            className="btn-primary-cta flex items-center gap-2 text-xs px-4 py-2.5 disabled:opacity-60"
          >
            <RefreshCw size={14} className={isMedicinesLoading ? "animate-spin" : ""} />
            Refresh
          </motion.button>
        </motion.div>

        {/* ── Low-stock alert banner ── */}
        {/* lowStockItems[] from API: { name, brandName, category, medicineId, batchNumber, stockQuantity, expiryDate, pricePerUnit } */}
        <LowStockAlerts lowStockItems={lowStockItems} threshold={lowStockMeta?.threshold} />

        {/* ── Stat cards ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
        >
          <StatCard
            icon={Package}
            label="Total Medicines"
            value={medicinesPagination?.totalItems ?? medicines.length}
            color="var(--primary)"
          />
          <StatCard
            icon={AlertTriangle}
            label="Low Stock"
            value={lowStockMeta?.count ?? lowStockItems?.length ?? 0}
            sub={`threshold ≤ ${lowStockMeta?.threshold ?? 10}`}
            color="var(--warning)"
          />
          <StatCard
            icon={TrendingDown}
            label="Out of Stock"
            value={outOfStock}
            color="var(--error)"
          />
          <StatCard
            icon={Layers}
            label="Total Batches"
            value={allBatches}
            color="var(--secondary)"
          />
          <StatCard
            icon={Activity}
            label="Total Units"
            value={allUnits.toLocaleString("en-IN")}
            sub="in inventory"
            color="var(--success)"
          />
        </motion.div>

        {/* ── Charts + Filter panel ── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">

          {/* Analytics */}
          <motion.div variants={itemVariants} initial="hidden" animate="show" className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={15} className="text-primary" />
                <p className="font-bold text-sm text-base-content">Inventory Analytics</p>
              </div>
              <div className="flex gap-1">
                {[
                  { key: "stock",    label: "Stock Levels" },
                  { key: "category", label: "Categories"   },
                  { key: "expiry",   label: "Expiry"       },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveChart(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeChart === tab.key
                        ? "bg-primary text-primary-content"
                        : "hover:bg-base-200 text-base-content/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeChart}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{   opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeChart === "stock"    && <StockBarChart    medicines={medicines} />}
                {activeChart === "category" && <CategoryPieChart medicines={medicines} />}
                {activeChart === "expiry"   && <ExpiryTimeline   medicines={medicines} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Filter card */}
          <motion.div variants={itemVariants} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm text-base-content mb-4 flex items-center gap-2">
              <Filter size={13} className="text-primary" /> Filter &amp; Search
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="search"
                placeholder="Search medicine…"
                value={search}
                onChange={handleSearch}
                aria-label="Search medicines"
                className="input-field w-full pl-9 text-sm py-2.5"
              />
            </div>

            {/* Filter buttons */}
            {[
              { key: "all",    label: "All Medicines", emoji: "💊" },
              { key: "low",    label: "Low Stock",      emoji: "⚠" },
              { key: "expiry", label: "Expiring Soon",  emoji: "⏰" },
            ].map((f) => (
              <motion.button
                key={f.key}
                whileHover={{ x: 4 }}
                onClick={() => handleFilter(f.key)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold mb-1.5 transition-all flex items-center gap-2 ${
                  filter === f.key
                    ? "bg-primary text-primary-content"
                    : "hover:bg-base-200 text-base-content/70"
                }`}
              >
                <span>{f.emoji}</span> {f.label}
              </motion.button>
            ))}

            {/* Quick stats */}
            <div className="mt-4 pt-4 border-t border-base-300/60 space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2">Quick Stats</p>
              {[
                { label: "Avg. units/medicine", value: medicines.length > 0 ? Math.round(allUnits / medicines.length) : 0 },
                { label: "Rx medicines",        value: medicines.filter((m) => m.isPrescriptionRequired).length },
                { label: "OTC medicines",       value: medicines.filter((m) => !m.isPrescriptionRequired).length },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <p className="text-xs text-base-content/50">{s.label}</p>
                  <p className="text-xs font-black text-primary">{s.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Inventory table ── */}
        <motion.div variants={itemVariants} initial="hidden" animate="show" className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Medicine inventory table" role="table">
              <thead>
                <tr className="border-b border-base-300 bg-base-200/60">
                  {["Medicine", "Category", "MRP", "Stock", "Batches", "Nearest Expiry", "Status", ""].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-base-content/50"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isMedicinesLoading ? (
                  <TableSkeleton rows={8} />
                ) : medicines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-2xl bg-base-200">
                          <Package size={28} className="text-base-content/30" />
                        </div>
                        <p className="text-base-content/40 text-sm font-semibold">No medicines found</p>
                        <p className="text-base-content/30 text-xs">Try adjusting your search or filter</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  medicines.map((m, i) => (
                    <MedicineRow key={m._id} med={m} index={i} onView={setSelected} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300/50">
            <p className="text-xs text-base-content/40">
              Page{" "}
              <strong className="text-base-content/70">{medicinesPagination?.currentPage ?? page}</strong>
              {" "}of{" "}
              <strong className="text-base-content/70">{medicinesPagination?.totalPages || 1}</strong>
              {medicinesPagination?.totalItems ? ` · ${medicinesPagination.totalItems} total` : ""}
            </p>
            <div className="flex gap-2">
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
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                disabled={page >= (medicinesPagination?.totalPages || 1)}
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

      {/* ── Stock detail modal ── */}
      <AnimatePresence>
        {selected && (
          <StockDetailModal
            med={selected}
            onClose={handleCloseModal}
            /**
             * Pass live medicineStockDetail only when it matches the selected medicine.
             * medicineStockDetail shape: { medicineId, name, storeInventory[], totalStock, isLowStock }
             */
            stockDetail={
              medicineStockDetail?.medicineId === selected._id ? medicineStockDetail : null
            }
            isLoadingStock={isStockLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}