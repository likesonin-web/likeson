"use client";

/**
 * MedicineCategories.jsx
 * Browse all medicine categories with real-time inventory stats,
 * drill-down into category-filtered medicines, and quick actions.
 *
 * Stack: Next.js 14 · Redux Toolkit · Framer Motion · Recharts · Lucide
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Droplets,
  Syringe,
  Wind,
  Eye,
  Ear,
  Heart,
  Layers,
  Package,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowRight,
  ChevronLeft,
  AlertTriangle,
  Clock,
  BarChart2,
  X,
  RefreshCw,
  Plus,
  Filter,
  Info,
  Zap,
  CheckCircle2,
} from "lucide-react";

import {
  fetchMedicines,
  fetchInventorySummary,
  addStock,
  requestStock,
  clearSuccess,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

// ── Recharts dynamic ─────────────────────────────────────────────────────────
const PieChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.PieChart })),
  { ssr: false }
);
const Pie = dynamic(
  () => import("recharts").then((m) => ({ default: m.Pie })),
  { ssr: false }
);
const Cell = dynamic(
  () => import("recharts").then((m) => ({ default: m.Cell })),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => ({ default: m.Tooltip })),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => ({ default: m.ResponsiveContainer })),
  { ssr: false }
);
const RadialBarChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.RadialBarChart })),
  { ssr: false }
);
const RadialBar = dynamic(
  () => import("recharts").then((m) => ({ default: m.RadialBar })),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// § CATEGORY METADATA
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_META = {
  Tablet: {
    icon: Pill,
    color: "oklch(50% 0.20 155)",    // primary green
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    description: "Solid oral dosage forms",
    route: "Oral",
  },
  Capsule: {
    icon: Pill,
    color: "oklch(64% 0.14 170)",
    bg: "bg-secondary/10",
    text: "text-secondary",
    border: "border-secondary/20",
    description: "Gelatin shell encapsulated",
    route: "Oral",
  },
  Syrup: {
    icon: Droplets,
    color: "oklch(70% 0.17 88)",
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
    description: "Liquid oral formulations",
    route: "Oral",
  },
  Suspension: {
    icon: Droplets,
    color: "oklch(62% 0.16 228)",
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/20",
    description: "Particles suspended in liquid",
    route: "Oral",
  },
  Solution: {
    icon: Droplets,
    color: "oklch(60% 0.20 152)",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
    description: "Homogeneous liquid mixtures",
    route: "Various",
  },
  Injection: {
    icon: Syringe,
    color: "oklch(60% 0.22 22)",
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
    description: "Parenteral administration",
    route: "IV/IM/SC",
  },
  Infusion: {
    icon: Syringe,
    color: "oklch(72% 0.17 72)",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
    description: "Large-volume parenteral",
    route: "Intravenous",
  },
  Ointment: {
    icon: Package,
    color: "oklch(50% 0.20 155)",
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    description: "Semi-solid topical base",
    route: "Topical",
  },
  Cream: {
    icon: Package,
    color: "oklch(64% 0.14 170)",
    bg: "bg-secondary/10",
    text: "text-secondary",
    border: "border-secondary/20",
    description: "Oil-in-water emulsion",
    route: "Topical",
  },
  Gel: {
    icon: Droplets,
    color: "oklch(70% 0.17 88)",
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
    description: "Semi-solid colloidal system",
    route: "Topical",
  },
  Lotion: {
    icon: Droplets,
    color: "oklch(62% 0.16 228)",
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/20",
    description: "Low-viscosity topical liquid",
    route: "Topical",
  },
  Drops: {
    icon: Eye,
    color: "oklch(60% 0.20 152)",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
    description: "Eye / Ear / Nasal drops",
    route: "Ophthalmic/Otic/Nasal",
  },
  Inhaler: {
    icon: Wind,
    color: "oklch(60% 0.22 22)",
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
    description: "Aerosolised medication",
    route: "Inhalation",
  },
  "Nasal Spray": {
    icon: Wind,
    color: "oklch(72% 0.17 72)",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
    description: "Nasal aerosol delivery",
    route: "Nasal",
  },
  Patch: {
    icon: Heart,
    color: "oklch(50% 0.20 155)",
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    description: "Transdermal drug delivery",
    route: "Transdermal",
  },
  Suppository: {
    icon: Package,
    color: "oklch(64% 0.14 170)",
    bg: "bg-secondary/10",
    text: "text-secondary",
    border: "border-secondary/20",
    description: "Rectal / vaginal solid forms",
    route: "Rectal/Vaginal",
  },
  Powder: {
    icon: Layers,
    color: "oklch(70% 0.17 88)",
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
    description: "Dry powder formulations",
    route: "Various",
  },
  Granules: {
    icon: Layers,
    color: "oklch(62% 0.16 228)",
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/20",
    description: "Aggregated granular particles",
    route: "Oral",
  },
  Lozenge: {
    icon: Pill,
    color: "oklch(60% 0.20 152)",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
    description: "Slow-dissolving oral solids",
    route: "Oral",
  },
  Implant: {
    icon: Syringe,
    color: "oklch(60% 0.22 22)",
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
    description: "Subcutaneous sustained release",
    route: "Subcutaneous",
  },
  Others: {
    icon: Package,
    color: "oklch(72% 0.17 72)",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
    description: "Miscellaneous dosage forms",
    route: "Various",
  },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META);

// ─────────────────────────────────────────────────────────────────────────────
// § ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const slideRight = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 24, transition: { duration: 0.2 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// § UTILS
// ─────────────────────────────────────────────────────────────────────────────

const clsx = (...args) => args.filter(Boolean).join(" ");

const fmt = {
  currency: (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n ?? 0),
  date: (d) =>
    d
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(d))
      : "—",
  daysLeft: (d) => {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const CategoryCardSkeleton = memo(() => (
  <div className="card p-5 space-y-4">
    <div className="flex items-center gap-3">
      <div className="skeleton-shimmer w-12 h-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-4 w-24 rounded" />
        <div className="skeleton-shimmer h-3 w-32 rounded" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-shimmer h-12 rounded-lg" />
      ))}
    </div>
    <div className="skeleton-shimmer h-8 rounded-lg" />
  </div>
));
CategoryCardSkeleton.displayName = "CategoryCardSkeleton";

const MedicineListSkeleton = memo(() => (
  <div className="space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-base-200 rounded-xl">
        <div className="skeleton-shimmer w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-shimmer h-4 w-1/2 rounded" />
          <div className="skeleton-shimmer h-3 w-1/3 rounded" />
        </div>
        <div className="skeleton-shimmer h-6 w-16 rounded-full" />
      </div>
    ))}
  </div>
));
MedicineListSkeleton.displayName = "MedicineListSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// § MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StockBadge = memo(({ qty }) => {
  if (qty === 0)
    return <span className="badge badge-error text-xs">Out</span>;
  if (qty <= 5)
    return <span className="badge badge-warning text-xs">Low · {qty}</span>;
  return <span className="badge badge-success text-xs">{qty}</span>;
});
StockBadge.displayName = "StockBadge";

const ExpiryBadge = memo(({ date }) => {
  const days = fmt.daysLeft(date);
  if (days === null) return <span className="text-xs text-base-content/30">—</span>;
  if (days < 0) return <span className="badge badge-error text-xs">Expired</span>;
  if (days <= 30) return <span className="badge badge-warning text-xs">{days}d</span>;
  return <span className="text-xs text-base-content/50">{fmt.date(date)}</span>;
});
ExpiryBadge.displayName = "ExpiryBadge";

// ─────────────────────────────────────────────────────────────────────────────
// § DISTRIBUTION PIE CHART
// ─────────────────────────────────────────────────────────────────────────────

const DistributionChart = memo(({ categoryStats }) => {
  const data = useMemo(
    () =>
      Object.entries(categoryStats)
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([cat, v]) => ({
          name: cat,
          value: v.count,
          color: CATEGORY_META[cat]?.color ?? "oklch(50% 0.20 155)",
        })),
    [categoryStats]
  );

  if (!data.length) return null;

  return (
    <Suspense fallback={<div className="skeleton-shimmer h-48 rounded-xl" />}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--base-200)",
                border: "1px solid var(--base-300)",
                borderRadius: "0.75rem",
                fontSize: 12,
              }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Suspense>
  );
});
DistributionChart.displayName = "DistributionChart";

// ─────────────────────────────────────────────────────────────────────────────
// § CATEGORY CARD
// ─────────────────────────────────────────────────────────────────────────────

const CategoryCard = memo(({ category, stats, onClick }) => {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.Others;
  const Icon = meta.icon;
  const { count, totalStock, lowStockCount, expiringCount, avgMrp } = stats;
  const healthScore = count > 0
    ? Math.max(0, Math.round(100 - (lowStockCount / count) * 60 - (expiringCount / count) * 40))
    : 100;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className={clsx(
        "card p-5 flex flex-col gap-4 cursor-pointer border",
        meta.border,
        "hover:shadow-primary"
      )}
      onClick={() => onClick(category)}
      role="button"
      tabIndex={0}
      aria-label={`View ${category} medicines`}
      onKeyDown={(e) => e.key === "Enter" && onClick(category)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center", meta.bg)}>
            <Icon size={22} className={meta.text} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-base-content leading-tight">{category}</h3>
            <p className="text-xs text-base-content/40 mt-0.5">{meta.description}</p>
          </div>
        </div>
        <ArrowRight size={14} className="text-base-content/20 mt-1 flex-shrink-0" />
      </div>

      {/* Route badge */}
      <div className="flex items-center gap-2">
        <span className={clsx("badge text-xs", meta.bg, meta.text, "border", meta.border)}>
          {meta.route}
        </span>
        {count === 0 && (
          <span className="badge badge-error text-xs">Unstocked</span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-base-200 rounded-lg py-2.5 px-1">
          <p className="text-xs text-base-content/40 mb-0.5">SKUs</p>
          <p className="font-extrabold text-base-content font-montserrat text-base">
            {count}
          </p>
        </div>
        <div className="bg-base-200 rounded-lg py-2.5 px-1">
          <p className="text-xs text-base-content/40 mb-0.5">Units</p>
          <p className="font-extrabold text-base-content font-montserrat text-base">
            {totalStock > 999
              ? `${(totalStock / 1000).toFixed(1)}k`
              : totalStock}
          </p>
        </div>
        <div className="bg-base-200 rounded-lg py-2.5 px-1">
          <p className="text-xs text-base-content/40 mb-0.5">Avg MRP</p>
          <p className="font-extrabold text-base-content font-montserrat text-xs">
            {avgMrp > 0 ? fmt.currency(avgMrp) : "—"}
          </p>
        </div>
      </div>

      {/* Alert indicators */}
      {(lowStockCount > 0 || expiringCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-warning">
              <TrendingDown size={11} />
              {lowStockCount} low stock
            </span>
          )}
          {expiringCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-error">
              <Clock size={11} />
              {expiringCount} expiring
            </span>
          )}
        </div>
      )}

      {/* Health bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-base-content/40">Inventory Health</span>
          <span
            className={clsx(
              "text-xs font-bold",
              healthScore >= 80
                ? "text-success"
                : healthScore >= 50
                ? "text-warning"
                : "text-error"
            )}
          >
            {count === 0 ? "N/A" : `${healthScore}%`}
          </span>
        </div>
        <div className="progress-bar">
          <motion.div
            className={clsx(
              "progress-bar-fill",
              healthScore >= 80
                ? "bg-success"
                : healthScore >= 50
                ? "bg-warning"
                : "bg-error"
            )}
            initial={{ width: 0 }}
            animate={{ width: count === 0 ? "0%" : `${healthScore}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          />
        </div>
      </div>

      {/* View button */}
      <button
        className={clsx(
          "w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors",
          meta.bg,
          meta.text,
          "hover:opacity-80"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick(category);
        }}
        tabIndex={-1}
      >
        Browse Medicines
        <ArrowRight size={12} />
      </button>
    </motion.div>
  );
});
CategoryCard.displayName = "CategoryCard";

// ─────────────────────────────────────────────────────────────────────────────
// § MEDICINE LIST ITEM (inside drill-down panel)
// ─────────────────────────────────────────────────────────────────────────────

const MedicineListItem = memo(({ medicine, index }) => {
  const meta = CATEGORY_META[medicine.category] ?? CATEGORY_META.Others;
  const Icon = meta.icon;
  const totalStock = medicine?.storeInventory?.reduce(
    (s, i) => s + (i.stockQuantity ?? 0), 0
  ) ?? 0;
  const nearestExpiry = medicine?.storeInventory?.reduce((earliest, inv) => {
    if (!earliest) return inv.expiryDate;
    return new Date(inv.expiryDate) < new Date(earliest) ? inv.expiryDate : earliest;
  }, null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-center gap-4 p-4 bg-base-200 rounded-xl hover:bg-base-300/50 transition-colors"
    >
      <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", meta.bg)}>
        <Icon size={16} className={meta.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-base-content truncate">
          {medicine.brandName}
        </p>
        <p className="text-xs text-base-content/40 truncate">
          {medicine.genericName} · {medicine.dosage}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StockBadge qty={totalStock} />
        <ExpiryBadge date={nearestExpiry} />
        <span className="text-xs font-semibold text-base-content/60 hidden sm:block">
          {fmt.currency(medicine.mrp)}
        </span>
        {medicine.isPrescriptionRequired && (
          <span className="badge badge-warning text-xs hidden sm:inline-flex">Rx</span>
        )}
      </div>
    </motion.div>
  );
});
MedicineListItem.displayName = "MedicineListItem";

// ─────────────────────────────────────────────────────────────────────────────
// § DRILL-DOWN PANEL
// ─────────────────────────────────────────────────────────────────────────────

const DrillDownPanel = memo(
  ({ category, medicines, loading, pagination, onClose, onPageChange }) => {
    const meta = CATEGORY_META[category] ?? CATEGORY_META.Others;
    const Icon = meta.icon;
    const [search, setSearch] = useState("");

    const filtered = useMemo(
      () =>
        search
          ? medicines.filter(
              (m) =>
                m.brandName?.toLowerCase().includes(search.toLowerCase()) ||
                m.genericName?.toLowerCase().includes(search.toLowerCase()) ||
                m.name?.toLowerCase().includes(search.toLowerCase())
            )
          : medicines,
      [medicines, search]
    );

    return (
      <motion.div
        variants={slideRight}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-40 flex"
      >
        {/* Backdrop */}
        <div
          className="flex-1 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        {/* Panel */}
        <div className="w-full max-w-xl bg-base-100 h-full overflow-y-auto shadow-2xl flex flex-col">
          {/* Panel Header */}
          <div className={clsx("px-6 py-5 border-b border-base-200", meta.bg)}>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-base-300/30 text-base-content/60 transition-colors"
                aria-label="Close panel"
              >
                <ChevronLeft size={18} />
              </button>
              <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center bg-base-100/50")}>
                <Icon size={20} className={meta.text} />
              </div>
              <div>
                <h2 className="font-extrabold text-lg text-base-content font-montserrat leading-tight">
                  {category}
                </h2>
                <p className="text-xs text-base-content/50">{meta.description}</p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-base-300/30 text-base-content/40 transition-colors"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search within category */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search in ${category}…`}
                className="input-field w-full pl-9 text-sm py-2.5"
                aria-label="Search within category"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30"
                  aria-label="Clear"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 px-5 py-5 space-y-3">
            {loading ? (
              <MedicineListSkeleton />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className={clsx("w-16 h-16 rounded-2xl flex items-center justify-center mb-4", meta.bg)}>
                  <Icon size={28} className={clsx(meta.text, "opacity-40")} />
                </div>
                <p className="font-semibold text-base-content/50 text-sm">
                  {search ? "No matches found" : "No medicines stocked"}
                </p>
                <p className="text-xs text-base-content/30 mt-1">
                  {search
                    ? "Try a different search term"
                    : `No ${category} medicines in your store yet`}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-base-content/40 px-1">
                  {search
                    ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`
                    : `${pagination?.totalItems ?? filtered.length} medicine${(pagination?.totalItems ?? filtered.length) !== 1 ? "s" : ""} in this category`}
                </p>
                {filtered.map((med, idx) => (
                  <MedicineListItem
                    key={med._id}
                    medicine={med}
                    index={idx}
                  />
                ))}
              </>
            )}
          </div>

          {/* Pagination footer */}
          {!search && pagination && pagination.totalPages > 1 && (
            <div className="px-5 py-4 border-t border-base-200 flex items-center justify-between">
              <span className="text-xs text-base-content/40">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onPageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => onPageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors"
                  aria-label="Next page"
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);
DrillDownPanel.displayName = "DrillDownPanel";

// ─────────────────────────────────────────────────────────────────────────────
// § SUMMARY STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const SummaryCard = memo(({ icon: Icon, label, value, sub, colorClass, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="stat-card flex items-start gap-4"
  >
    <div className={clsx("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", colorClass)}>
      <Icon size={18} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="stat-card-label truncate">{label}</p>
      <p className="stat-card-value">{value}</p>
      {sub && <p className="text-xs text-base-content/40 mt-0.5 truncate">{sub}</p>}
    </div>
  </motion.div>
));
SummaryCard.displayName = "SummaryCard";

// ─────────────────────────────────────────────────────────────────────────────
// § MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicineCategories() {
  const dispatch = useDispatch();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = useSelector((s) => s.user?.user) ?? null;

  // ── Redux ────────────────────────────────────────────────────────────────
  const {
    medicines,
    medicinesPagination,
    inventorySummary,
    loading,
  } = useSelector((s) => s.pharmacyStore);

  // ── Local state ───────────────────────────────────────────────────────────
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drillPage, setDrillPage] = useState(1);
  const [sortBy, setSortBy] = useState("count"); // count | name | stock

  // ── Fetch all categories overview (no category filter, large limit) ───────
  const [allMedicines, setAllMedicines] = useState([]);
  const [allLoading, setAllLoading] = useState(true);

  useEffect(() => {
    dispatch(fetchInventorySummary());
  }, [dispatch]);

  // Fetch all medicines for stats (limit 200, no filters)
  useEffect(() => {
    const load = async () => {
      setAllLoading(true);
      try {
        const result = await dispatch(
          fetchMedicines({ page: 1, limit: 200 })
        ).unwrap();
        setAllMedicines(result?.medicines ?? []);
      } catch {
        // handle silently — error shown via Redux
      } finally {
        setAllLoading(false);
      }
    };
    load();
  }, [dispatch]);

  // ── Fetch medicines for drill-down ────────────────────────────────────────
  useEffect(() => {
    if (!selectedCategory) return;
    dispatch(
      fetchMedicines({
        page: drillPage,
        limit: 20,
        category: selectedCategory,
      })
    );
  }, [dispatch, selectedCategory, drillPage]);

  // ── Compute per-category stats from allMedicines ──────────────────────────
  const categoryStats = useMemo(() => {
    const stats = {};
    ALL_CATEGORIES.forEach((cat) => {
      stats[cat] = {
        count: 0,
        totalStock: 0,
        lowStockCount: 0,
        expiringCount: 0,
        totalMrp: 0,
        avgMrp: 0,
      };
    });

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 30);

    allMedicines.forEach((med) => {
      const cat = med.category;
      if (!stats[cat]) return;
      stats[cat].count += 1;
      stats[cat].totalMrp += med.mrp ?? 0;

      (med.storeInventory ?? []).forEach((inv) => {
        const qty = inv.stockQuantity ?? 0;
        stats[cat].totalStock += qty;
        if (qty <= 5) stats[cat].lowStockCount += 1;
        if (inv.expiryDate) {
          const exp = new Date(inv.expiryDate);
          if (exp >= now && exp <= cutoff) stats[cat].expiringCount += 1;
        }
      });
    });

    Object.keys(stats).forEach((cat) => {
      const s = stats[cat];
      s.avgMrp = s.count > 0 ? Math.round(s.totalMrp / s.count) : 0;
    });

    return stats;
  }, [allMedicines]);

  // ── Filtered + sorted categories ──────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    let cats = ALL_CATEGORIES;
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase();
      cats = cats.filter(
        (c) =>
          c.toLowerCase().includes(q) ||
          CATEGORY_META[c]?.description.toLowerCase().includes(q) ||
          CATEGORY_META[c]?.route.toLowerCase().includes(q)
      );
    }

    return [...cats].sort((a, b) => {
      if (sortBy === "name") return a.localeCompare(b);
      if (sortBy === "stock")
        return categoryStats[b].totalStock - categoryStats[a].totalStock;
      // default: count
      return categoryStats[b].count - categoryStats[a].count;
    });
  }, [categorySearch, sortBy, categoryStats]);

  // ── Summary numbers ───────────────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const activeCategories = ALL_CATEGORIES.filter(
      (c) => categoryStats[c].count > 0
    ).length;
    const totalMedicines = Object.values(categoryStats).reduce(
      (s, c) => s + c.count, 0
    );
    const totalUnits = Object.values(categoryStats).reduce(
      (s, c) => s + c.totalStock, 0
    );
    const alertCategories = ALL_CATEGORIES.filter(
      (c) => categoryStats[c].lowStockCount > 0 || categoryStats[c].expiringCount > 0
    ).length;
    return { activeCategories, totalMedicines, totalUnits, alertCategories };
  }, [categoryStats]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCategoryClick = useCallback((cat) => {
    setSelectedCategory(cat);
    setDrillPage(1);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedCategory(null);
    setDrillPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    setAllLoading(true);
    dispatch(fetchInventorySummary());
    try {
      const result = await dispatch(fetchMedicines({ page: 1, limit: 200 })).unwrap();
      setAllMedicines(result?.medicines ?? []);
    } finally {
      setAllLoading(false);
    }
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // § RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-100 font-poppins">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── PAGE HEADER ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Layers size={15} className="text-primary-content" />
              </div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">
                Pharmacy
              </p>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-base-content font-montserrat">
              Medicine Categories
            </h1>
            <p className="text-sm text-base-content/50 mt-0.5">
              {ALL_CATEGORIES.length} dosage form categories · Live inventory view
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={allLoading}
            className="self-start sm:self-auto flex items-center gap-2 py-2 px-4 rounded-xl border border-base-300 hover:bg-base-200 text-sm font-semibold text-base-content/70 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={allLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </motion.div>

        {/* ── GLOBAL SUMMARY CARDS ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            icon={Layers}
            label="Active Categories"
            value={allLoading ? "—" : globalStats.activeCategories}
            sub={`of ${ALL_CATEGORIES.length} total`}
            colorClass="bg-primary"
            delay={0}
          />
          <SummaryCard
            icon={Pill}
            label="Total SKUs"
            value={allLoading ? "—" : globalStats.totalMedicines.toLocaleString("en-IN")}
            sub="Stocked medicines"
            colorClass="bg-secondary"
            delay={0.06}
          />
          <SummaryCard
            icon={Package}
            label="Total Units"
            value={allLoading ? "—" : globalStats.totalUnits.toLocaleString("en-IN")}
            sub="Across all batches"
            colorClass="bg-accent"
            delay={0.12}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Alert Categories"
            value={allLoading ? "—" : globalStats.alertCategories}
            sub="Need attention"
            colorClass="bg-warning"
            delay={0.18}
          />
        </div>

        {/* ── DISTRIBUTION CHART + LEGEND ───────────────────────────────── */}
        {!allLoading && allMedicines.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="card p-5"
          >
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={15} className="text-primary" />
                  <h3 className="font-bold text-sm text-base-content">
                    Category Distribution
                  </h3>
                  <span className="badge badge-primary text-xs">Top 8</span>
                </div>
                <DistributionChart categoryStats={categoryStats} />
              </div>
              {/* Legend */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {ALL_CATEGORIES.filter((c) => categoryStats[c].count > 0)
                  .sort((a, b) => categoryStats[b].count - categoryStats[a].count)
                  .slice(0, 9)
                  .map((cat) => {
                    const meta = CATEGORY_META[cat] ?? CATEGORY_META.Others;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategoryClick(cat)}
                        className={clsx(
                          "flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left hover:shadow-sm",
                          meta.bg,
                          meta.border,
                          "hover:opacity-80"
                        )}
                      >
                        <Icon size={14} className={meta.text} />
                        <div className="min-w-0">
                          <p className={clsx("text-xs font-bold truncate", meta.text)}>
                            {cat}
                          </p>
                          <p className="text-xs text-base-content/50">
                            {categoryStats[cat].count} SKU
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── FILTERS BAR ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none"
            />
            <input
              type="search"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search categories, routes, descriptions…"
              className="input-field w-full pl-9 text-sm"
              aria-label="Search categories"
            />
            {categorySearch && (
              <button
                onClick={() => setCategorySearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content transition-colors"
                aria-label="Clear"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-base-content/40 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field text-sm py-2.5"
              aria-label="Sort categories"
            >
              <option value="count">Sort by SKUs</option>
              <option value="stock">Sort by Units</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        {/* Search result count */}
        {categorySearch && (
          <p className="text-xs text-base-content/40">
            {filteredCategories.length} categor{filteredCategories.length !== 1 ? "ies" : "y"} matched
          </p>
        )}

        {/* ── CATEGORY GRID ─────────────────────────────────────────────── */}
        {allLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <CategoryCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-base-200 flex items-center justify-center mb-5">
              <Layers size={32} className="text-base-content/20" />
            </div>
            <p className="font-bold text-base-content/50 font-montserrat mb-2">
              No categories found
            </p>
            <p className="text-sm text-base-content/30 mb-5">
              Try adjusting your search
            </p>
            <button
              onClick={() => setCategorySearch("")}
              className="btn-secondary py-2 px-5 text-sm"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {filteredCategories.map((cat) => (
              <CategoryCard
                key={cat}
                category={cat}
                stats={categoryStats[cat]}
                onClick={handleCategoryClick}
              />
            ))}
          </motion.div>
        )}

        {/* ── UNSTOCKED CATEGORIES CALLOUT ──────────────────────────────── */}
        {!allLoading && !categorySearch && (
          () => {
            const unstocked = ALL_CATEGORIES.filter(
              (c) => categoryStats[c].count === 0
            );
            if (!unstocked.length) return null;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="alert alert-info"
              >
                <Info size={16} className="text-info flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-base-content">
                    {unstocked.length} unstocked categor{unstocked.length !== 1 ? "ies" : "y"}
                  </p>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    {unstocked.slice(0, 5).join(", ")}
                    {unstocked.length > 5 ? ` and ${unstocked.length - 5} more` : ""}
                  </p>
                </div>
              </motion.div>
            );
          }
        )()}
      </div>

      {/* ── DRILL-DOWN PANEL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCategory && (
          <DrillDownPanel
            key="drill"
            category={selectedCategory}
            medicines={medicines}
            loading={loading.medicines}
            pagination={medicinesPagination}
            onClose={handleClosePanel}
            onPageChange={setDrillPage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}