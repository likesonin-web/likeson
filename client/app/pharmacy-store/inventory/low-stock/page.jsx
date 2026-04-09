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
  Beaker,
  Building2,
  Percent,
  CircleDot,
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PieChart,
  Pie,
  Legend,
} from "recharts";

/* ─── Motion variants ─────────────────────────────────────── */
const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } } };
const stagger = { hidden: {},                     show: { transition: { staggerChildren: 0.07 } } };

/* ─── CSS row stagger (table-safe) ───────────────────────── */
const rowStyle = (i) => ({
  animation: "fadeInRow 0.35s ease both",
  animationDelay: `${i * 0.045}s`,
});

/* ─── Urgency helpers ─────────────────────────────────────── */
/**
 * lowStockItems[] from API:
 *   { name, brandName, category, medicineId, batchNumber,
 *     stockQuantity, expiryDate, pricePerUnit }
 */
const urgencyLevel = (qty) =>
  qty === 0 ? "out" : qty <= 3 ? "critical" : qty <= 7 ? "urgent" : "low";

const URGENCY_META = {
  out:      { label: "Out of Stock", color: "var(--error)",   bg: "color-mix(in oklch, var(--error)   13%, var(--base-200))", border: "color-mix(in oklch, var(--error)   35%, var(--base-300))" },
  critical: { label: "Critical",     color: "var(--error)",   bg: "color-mix(in oklch, var(--error)   10%, var(--base-200))", border: "color-mix(in oklch, var(--error)   25%, var(--base-300))" },
  urgent:   { label: "Urgent",       color: "var(--warning)", bg: "color-mix(in oklch, var(--warning) 12%, var(--base-200))", border: "color-mix(in oklch, var(--warning) 30%, var(--base-300))" },
  low:      { label: "Low",          color: "var(--accent)",  bg: "color-mix(in oklch, var(--accent)  12%, var(--base-200))", border: "color-mix(in oklch, var(--accent)  25%, var(--base-300))" },
};

const daysToExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate) - Date.now()) / 86400000);
};

/* ─── Background ──────────────────────────────────────────── */
function WarningBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      {/* Diagonal warning grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--warning) 0, var(--warning) 1px, transparent 0, transparent 50%)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Ambient glows */}
      <motion.div
        animate={{ opacity: [0.1, 0.22, 0.1], scale: [1, 1.15, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-24 -left-24 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--warning), transparent 65%)" }}
      />
      <motion.div
        animate={{ opacity: [0.07, 0.16, 0.07], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--error), transparent 65%)" }}
      />
      <motion.div
        animate={{ opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />
    </div>
  );
}

/* ─── Urgency badge ───────────────────────────────────────── */
function UrgencyBadge({ qty }) {
  const u = URGENCY_META[urgencyLevel(qty)];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black"
      style={{ background: u.bg, color: u.color, border: `1px solid ${u.border}` }}
    >
      <CircleDot size={8} />
      {u.label}
    </span>
  );
}

/* ─── Stat card ───────────────────────────────────────────── */
const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, color, pulse }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5 relative overflow-hidden group">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 80% 20%, color-mix(in oklch,${color} 10%,transparent), transparent 70%)` }}
      />
      {pulse && (
        <motion.div
          animate={{ opacity: [0, 0.12, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-2xl"
          style={{ background: color }}
        />
      )}
      <div className="flex items-start justify-between mb-3 relative">
        <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in oklch,${color} 15%,var(--base-200))` }}>
          <Icon size={17} style={{ color }} />
        </div>
        <ArrowUpRight size={13} className="text-base-content/25 group-hover:text-primary transition-colors" />
      </div>
      <p className="text-2xl font-black font-montserrat relative" style={{ color }}>{value ?? "—"}</p>
      <p className="text-xs font-semibold text-base-content/55 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>}
    </motion.div>
  );
});

/* ─── Custom recharts tooltip ─────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
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

/* ─── Category bar chart ──────────────────────────────────── */
const CategoryChart = memo(function CategoryChart({ items }) {
  const data = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      const cat = it.category || "General";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.slice(0, 10), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [items]);

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} barCategoryGap="35%">
        <defs>
          <linearGradient id="lowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--warning)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--error)"   stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.45 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.45 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--warning)", opacity: 0.05 }} />
        <Bar dataKey="count" fill="url(#lowGrad)" radius={[6, 6, 0, 0]} name="Items" />
      </BarChart>
    </ResponsiveContainer>
  );
});

/* ─── Urgency distribution pie ────────────────────────────── */
const UrgencyPie = memo(function UrgencyPie({ items }) {
  const data = useMemo(() => {
    const out      = items.filter((i) => i.stockQuantity === 0).length;
    const critical = items.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= 3).length;
    const urgent   = items.filter((i) => i.stockQuantity > 3 && i.stockQuantity <= 7).length;
    const low      = items.filter((i) => i.stockQuantity > 7).length;
    return [
      { name: "Out of Stock", value: out,      color: "var(--error)"   },
      { name: "Critical ≤3",  value: critical, color: "oklch(62% 0.22 25)" },
      { name: "Urgent ≤7",    value: urgent,   color: "var(--warning)" },
      { name: "Low ≤10",      value: low,      color: "var(--accent)"  },
    ].filter((d) => d.value > 0);
  }, [items]);

  if (!data.length) return (
    <div className="h-[190px] flex items-center justify-center text-xs text-base-content/30">
      No data
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={190}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={72}
          paddingAngle={3}
          dataKey="value"
          animationBegin={0}
          animationDuration={1000}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 10 }}
          formatter={(v) => <span style={{ color: "var(--base-content)", opacity: 0.55 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

/* ─── Stock detail modal ──────────────────────────────────── */
/**
 * medicineStockDetail from fetchMedicineStock(medicineId: string)
 * Shape: { medicineId, name, storeInventory[], totalStock, isLowStock }
 */
const StockDetailModal = memo(function StockDetailModal({ item, onClose, stockDetail, isLoading }) {
  const batches = useMemo(
    () =>
      stockDetail?.medicineId === item?.medicineId
        ? stockDetail.storeInventory ?? []
        : [],
    [stockDetail, item]
  );

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const itemDays = daysToExpiry(item?.expiryDate);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 32 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.88, opacity: 0, y: 32  }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="glass-card w-full max-w-lg p-6 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning strip for critical items */}
        {item?.stockQuantity <= 3 && (
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="h-1 w-full rounded-full mb-4"
            style={{ background: "linear-gradient(90deg, var(--error), var(--warning), var(--error))" }}
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl shrink-0"
              style={{ background: "color-mix(in oklch, var(--warning) 14%, var(--base-200))" }}
            >
              <ShieldAlert size={20} style={{ color: "var(--warning)" }} />
            </div>
            <div>
              <h3 className="font-black text-lg font-montserrat text-base-content leading-tight">
                {item?.name}
              </h3>
              <p className="text-xs text-base-content/50 mt-0.5">{item?.brandName}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <UrgencyBadge qty={item?.stockQuantity} />
                <span className="badge badge-info text-xs">{item?.category || "General"}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl hover:bg-base-300 transition-colors shrink-0 focus-visible:outline-none"
          >
            <X size={15} />
          </button>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              label: "Stock Left",
              value: item?.stockQuantity,
              icon: Package,
              color: item?.stockQuantity === 0 ? "var(--error)" : item?.stockQuantity <= 7 ? "var(--warning)" : "var(--accent)",
            },
            {
              label: "Price/Unit",
              value: item?.pricePerUnit ? `₹${item.pricePerUnit}` : "—",
              icon: Tag,
              color: "var(--primary)",
            },
            {
              label: "Expiry",
              value: itemDays !== null ? `${itemDays}d` : "—",
              icon: Calendar,
              color: itemDays !== null && itemDays <= 30 ? "var(--warning)" : "var(--success)",
            },
          ].map((s) => (
            <div key={s.label} className="bg-base-200 rounded-xl p-3 text-center">
              <s.icon size={13} className="mx-auto mb-1 opacity-50" style={{ color: s.color }} />
              <p className="text-lg font-black font-montserrat" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-base-content/45 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Batch & expiry detail */}
        <div className="bg-base-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2 flex items-center gap-1">
            <Hash size={10} /> Batch Detail
          </p>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            {[
              { label: "Batch No.",  value: item?.batchNumber || "—" },
              { label: "Category",   value: item?.category || "—"   },
              {
                label: "Expiry Date",
                value: item?.expiryDate
                  ? new Date(item.expiryDate).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })
                  : "—",
              },
              {
                label: "Days Left",
                value: itemDays !== null
                  ? <span style={{ color: itemDays <= 30 ? "var(--warning)" : "var(--success)" }}>{itemDays} days</span>
                  : "—",
              },
            ].map((r) => (
              <div key={r.label}>
                <span className="text-base-content/40 font-semibold">{r.label}: </span>
                <span className="text-base-content font-bold">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* All store batches (from fetchMedicineStock) */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2 flex items-center gap-1">
            <Layers size={10} /> All Store Batches
            {isLoading && <span className="ml-1 text-primary animate-pulse text-xs">· loading…</span>}
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}
            </div>
          ) : batches.length === 0 ? (
            <p className="text-xs text-base-content/30 py-4 text-center">
              Select medicine to load all batches
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {batches.map((b, i) => {
                const bDays = daysToExpiry(b.expiryDate);
                const bColor = b.stockQuantity === 0 ? "var(--error)" : b.stockQuantity <= 7 ? "var(--warning)" : "var(--success)";
                return (
                  <motion.div
                    key={b._id || i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1,  x: 0  }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between bg-base-200 rounded-xl px-3 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-bold text-base-content">{b.batchNumber}</p>
                      <p className="text-xs text-base-content/40">
                        {b.expiryDate
                          ? new Date(b.expiryDate).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })
                          : "—"}
                        {bDays !== null && (
                          <span style={{ color: bDays <= 30 ? "var(--warning)" : "var(--base-content)", opacity: bDays <= 30 ? 1 : 0.4 }}>
                            {" "}· {bDays}d left
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black" style={{ color: bColor }}>{b.stockQuantity}</p>
                      <p className="text-xs text-base-content/35">units</p>
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

/* ─── Table skeleton ──────────────────────────────────────── */
function TableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: 7 }).map((_, j) => (
        <td key={j} className="py-4 px-4">
          <div className="skeleton h-4 w-full rounded-lg" />
        </td>
      ))}
    </tr>
  ));
}

/* ─── Low stock table row ─────────────────────────────────── */
const LowStockRow = memo(function LowStockRow({ item, index, onView }) {
  const u       = URGENCY_META[urgencyLevel(item.stockQuantity)];
  const expDays = useMemo(() => daysToExpiry(item.expiryDate), [item.expiryDate]);
  const handle  = useCallback(() => onView(item), [item, onView]);

  /* animated stock bar width as % of threshold (10) */
  const pct = Math.min((item.stockQuantity / 10) * 100, 100);

  return (
    <tr
      className="border-b border-base-300/40 hover:bg-warning/5 transition-colors duration-200 group"
      style={rowStyle(index)}
    >
      {/* Medicine */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div
            className="p-1.5 rounded-lg shrink-0"
            style={{ background: u.bg }}
          >
            <Pill size={12} style={{ color: u.color }} />
          </div>
          <div>
            <p className="font-semibold text-sm text-base-content leading-tight">{item.name}</p>
            <p className="text-xs text-base-content/40 mt-0.5">{item.brandName || "—"}</p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-3.5 px-4">
        <span className="badge badge-info text-xs">{item.category || "General"}</span>
      </td>

      {/* Batch */}
      <td className="py-3.5 px-4">
        <span className="font-mono text-xs bg-base-200 px-2 py-1 rounded-lg text-base-content/60">
          {item.batchNumber || "—"}
        </span>
      </td>

      {/* Stock qty + mini bar */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-base-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, delay: index * 0.04, ease: "easeOut" }}
              style={{ background: u.color }}
            />
          </div>
          <span className="text-sm font-black tabular-nums" style={{ color: u.color }}>
            {item.stockQuantity}
          </span>
        </div>
      </td>

      {/* Expiry */}
      <td className="py-3.5 px-4">
        <div>
          <p className="text-xs text-base-content/55 flex items-center gap-1">
            <Calendar size={9} />
            {item.expiryDate
              ? new Date(item.expiryDate).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                })
              : "—"}
          </p>
          {expDays !== null && (
            <p
              className="text-xs font-bold mt-0.5"
              style={{ color: expDays <= 30 ? "var(--warning)" : "var(--success)" }}
            >
              {expDays}d left
            </p>
          )}
        </div>
      </td>

      {/* Price */}
      <td className="py-3.5 px-4">
        <span className="text-sm font-semibold text-base-content">
          {item.pricePerUnit ? `₹${item.pricePerUnit}` : "—"}
        </span>
      </td>

      {/* Status + action */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <UrgencyBadge qty={item.stockQuantity} />
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={handle}
            aria-label={`View details for ${item.name}`}
            className="p-1.5 rounded-lg hover:bg-base-200 transition-colors focus-visible:outline-none"
            style={{ color: "var(--primary)" }}
          >
            <Eye size={13} />
          </motion.button>
        </div>
      </td>
    </tr>
  );
});

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function LowStock() {
  const dispatch = useDispatch();

  /* ── Slice selectors ── */
  const { lowStockItems, lowStockMeta, medicineStockDetail, loading } =
    useSelector((s) => s.pharmacyStore);

  /* ── Local UI state ── */
  const [search,   setSearch  ] = useState("");
  const [sortKey,  setSortKey ] = useState("stockQuantity"); // "stockQuantity" | "name" | "expiryDate"
  const [sortAsc,  setSortAsc ] = useState(true);
  const [catFilter,setCatFilter] = useState("all");
  const [selected, setSelected ] = useState(null); // item for modal

  const isLoading     = loading.lowStock;
  const isStockLoading = loading.medicineStock;

  /* ── Fetch on mount ── */
  useEffect(() => {
    dispatch(fetchLowStock({}));
  }, [dispatch]);

  /* ── Fetch stock detail when modal opens ── */
  useEffect(() => {
    if (selected?.medicineId) {
      dispatch(fetchMedicineStock(selected.medicineId));
    }
  }, [dispatch, selected?.medicineId]);

  /* ── Derived data ── */
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(lowStockItems.map((i) => i.category || "General").filter(Boolean)))],
    [lowStockItems]
  );

  const filtered = useMemo(() => {
    let list = lowStockItems;
    if (catFilter !== "all") list = list.filter((i) => (i.category || "General") === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.brandName?.toLowerCase().includes(q) ||
          i.batchNumber?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "expiryDate") { av = av ? new Date(av) : Infinity; bv = bv ? new Date(bv) : Infinity; }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ?  1 : -1;
      return 0;
    });
  }, [lowStockItems, search, catFilter, sortKey, sortAsc]);

  /* ── Stat derivations ── */
  const outCount      = useMemo(() => lowStockItems.filter((i) => i.stockQuantity === 0).length,          [lowStockItems]);
  const criticalCount = useMemo(() => lowStockItems.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= 3).length, [lowStockItems]);
  const urgentCount   = useMemo(() => lowStockItems.filter((i) => i.stockQuantity > 3 && i.stockQuantity <= 7).length, [lowStockItems]);
  const expiringSoon  = useMemo(() => lowStockItems.filter((i) => { const d = daysToExpiry(i.expiryDate); return d !== null && d <= 30; }).length, [lowStockItems]);

  /* ── Sort toggle ── */
  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

  const SortIcon = ({ col }) => (
    sortKey === col
      ? sortAsc ? <ChevronUp size={11} className="inline ml-0.5" /> : <ChevronDown size={11} className="inline ml-0.5" />
      : null
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <WarningBg />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1,  y: 0  }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
              >
                <ShieldAlert size={17} style={{ color: "var(--warning)" }} />
              </motion.div>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--warning)" }}>
                Reorder Required
              </span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Low <span className="text-gradient-primary">Stock</span>
            </h1>
            <p className="text-sm text-base-content/50 mt-1">
              {lowStockMeta?.count ?? lowStockItems.length} items below threshold
              {lowStockMeta?.threshold != null && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-xs font-bold" style={{ background: "color-mix(in oklch, var(--warning) 12%, var(--base-200))", color: "var(--warning)" }}>
                  ≤ {lowStockMeta.threshold} units
                </span>
              )}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => dispatch(fetchLowStock({}))}
            disabled={isLoading}
            aria-label="Refresh low stock"
            className="btn-primary-cta flex items-center gap-2 text-xs px-4 py-2.5 disabled:opacity-60"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </motion.button>
        </motion.div>

        {/* ── Stat cards ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
        >
          <StatCard icon={TrendingDown}  label="Total Low Stock"  value={lowStockMeta?.count ?? lowStockItems.length} sub={`threshold ≤ ${lowStockMeta?.threshold ?? 10}`} color="var(--warning)" />
          <StatCard icon={Zap}           label="Out of Stock"     value={outCount}      color="var(--error)"   pulse={outCount > 0} />
          <StatCard icon={ShieldAlert}   label="Critical (≤3)"   value={criticalCount} color="oklch(62% 0.22 25)" />
          <StatCard icon={AlertTriangle} label="Urgent (≤7)"      value={urgentCount}   color="var(--accent)"  />
          <StatCard icon={Calendar}      label="Expiring ≤30d"   value={expiringSoon}  color="var(--info)"    />
        </motion.div>

        {/* ── Charts ── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-1 flex items-center gap-2 text-base-content">
              <SlidersHorizontal size={13} className="text-warning" /> Low Stock by Category
            </p>
            <p className="text-xs text-base-content/40 mb-4">Items count per medicine category</p>
            <CategoryChart items={lowStockItems} />
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5">
            <p className="font-bold text-sm mb-1 flex items-center gap-2 text-base-content">
              <Zap size={13} className="text-error" /> Urgency Breakdown
            </p>
            <p className="text-xs text-base-content/40 mb-4">Distribution by severity level</p>
            <UrgencyPie items={lowStockItems} />
          </motion.div>
        </div>

        {/* ── Filters ── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap"
        >
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type="search"
              placeholder="Search medicine, brand, batch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search low stock items"
              className="input-field w-full pl-8 text-xs py-2"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
                  catFilter === cat
                    ? "bg-warning text-warning-content"
                    : "bg-base-200 hover:bg-base-300 text-base-content/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <p className="text-xs text-base-content/40 ml-auto shrink-0">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </p>
        </motion.div>

        {/* ── Table ──────────────────────────────────────────────────
            IMPORTANT: plain <table>/<tbody>/<tr> only.
            No motion.table / motion.tbody / motion.tr —
            they render as <div> and break HTML table structure.
        ─────────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Low stock medicines table">
              <thead>
                <tr className="border-b border-base-300 bg-base-200/60">
                  {[
                    { key: "name",          label: "Medicine"     },
                    { key: null,            label: "Category"     },
                    { key: null,            label: "Batch"        },
                    { key: "stockQuantity", label: "Stock Qty"    },
                    { key: "expiryDate",    label: "Expiry"       },
                    { key: null,            label: "Price"        },
                    { key: null,            label: "Status"       },
                  ].map(({ key, label }) => (
                    <th
                      key={label}
                      scope="col"
                      onClick={key ? () => toggleSort(key) : undefined}
                      className={`text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-base-content/45 ${key ? "cursor-pointer hover:text-warning select-none" : ""}`}
                    >
                      {label}
                      {key && <SortIcon col={key} />}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* plain <tbody> — never motion.tbody */}
              <tbody>
                {isLoading ? (
                  <TableSkeleton rows={8} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-2xl bg-base-200">
                          <Package size={28} className="text-base-content/25" />
                        </div>
                        <p className="text-sm text-base-content/40 font-semibold">No low-stock items found</p>
                        {search && (
                          <button
                            onClick={() => setSearch("")}
                            className="text-xs text-primary hover:underline"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* plain <tr> with CSS animation — never motion.tr */
                  filtered.map((item, i) => (
                    <LowStockRow
                      key={`${item.medicineId}-${item.batchNumber}-${i}`}
                      item={item}
                      index={i}
                      onView={setSelected}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-base-300/50">
              <p className="text-xs text-base-content/40">
                Showing <strong className="text-base-content/60">{filtered.length}</strong> of{" "}
                <strong className="text-base-content/60">{lowStockItems.length}</strong> low-stock items
              </p>
              <div className="flex items-center gap-1.5 text-xs text-base-content/40">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--error)" }} />   Out of Stock: {outCount}
                <div className="w-2 h-2 rounded-full ml-2" style={{ background: "var(--warning)" }} /> Urgent: {urgentCount + criticalCount}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Stock detail modal ── */}
      <AnimatePresence>
        {selected && (
          <StockDetailModal
            item={selected}
            onClose={() => setSelected(null)}
            stockDetail={
              medicineStockDetail?.medicineId === selected.medicineId
                ? medicineStockDetail
                : null
            }
            isLoading={isStockLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}