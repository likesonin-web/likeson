"use client";

/**
 * MedicinesManagement.jsx — Pharmacy Store (Split-Panel Layout)
 *
 * FIXES APPLIED:
 *  1. Modal z-index: `z-500` (invalid) → `z-[9999]` — modal always on top of sticky header & panels
 *  2. Modal backdrop: separate element at `z-[9998]` prevents bleed-through when page is scrolled
 *  3. Scroll lock: compensates scrollbar width so page doesn't jump when modal opens
 *  4. Auto-scroll: selected medicine scrolls into view in the left list (useRef + scrollIntoView)
 *  5. Pro design: tighter spacing, refined cards, better shadows using pharmacy CSS design system
 */

import React, {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from "react";
import dynamic from "next/dynamic";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, RefreshCw, X, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, Package, PackagePlus, PackageMinus,
  TrendingDown, Layers, CheckCircle2, XCircle, AlertCircle, Bell,
  Info, Pill, ScanBarcode, Shield, Thermometer, Droplets, Wind,
  Send, PackageSearch, Boxes, Archive, Hash, FlaskConical,
} from "lucide-react";

const BarChart            = dynamic(() => import("recharts").then(m => ({ default: m.BarChart })),            { ssr: false });
const Bar                 = dynamic(() => import("recharts").then(m => ({ default: m.Bar })),                 { ssr: false });
const XAxis               = dynamic(() => import("recharts").then(m => ({ default: m.XAxis })),               { ssr: false });
const YAxis               = dynamic(() => import("recharts").then(m => ({ default: m.YAxis })),               { ssr: false });
const Tooltip             = dynamic(() => import("recharts").then(m => ({ default: m.Tooltip })),             { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

import {
  fetchMedicines, addStock, deductStock, fetchMedicineStock,
  fetchExpiryAlerts, fetchLowStock, requestStock,
  fetchInventorySummary, clearSuccess,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICON = {
  Tablet: "💊", Capsule: "💊", Syrup: "🧴", Injection: "💉",
  Inhaler: "🫁", Cream: "🧴", Gel: "🧴", Drops: "💧",
  Powder: "🫙", Suspension: "🧴", Solution: "🧪", Others: "📦",
  Ointment: "🧴", Lotion: "🧴", Patch: "🩹", Infusion: "🧪",
};

const SCHEDULE_CFG = {
  H:    { label: "Sch-H",  color: "text-warning bg-warning/10 border-warning/25" },
  H1:   { label: "Sch-H1", color: "text-error bg-error/10 border-error/25"       },
  X:    { label: "Sch-X",  color: "text-error bg-error/15 border-error/40"       },
  G:    { label: "Sch-G",  color: "text-info bg-info/10 border-info/25"          },
  None: { label: "OTC",    color: "text-success bg-success/10 border-success/25" },
};

const URGENCY_CFG = {
  Low:      { cls: "text-success bg-success/10 border-success/30", tip: "Order when convenient"  },
  Medium:   { cls: "text-warning bg-warning/10 border-warning/30", tip: "Reorder within few days" },
  High:     { cls: "text-error bg-error/10 border-error/30",       tip: "Order today"             },
  Critical: { cls: "text-error bg-error/20 border-error/50",       tip: "Order immediately"       },
};

const LOW_THRESH = 5;
const PAGE_SIZE  = 20;

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

const cx = (...args) => args.filter(Boolean).join(" ");

const fmt = {
  currency: (n) => `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
  date:      (d) => d ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "—",
  dateShort: (d) => d ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(d)) : "—",
  daysLeft:  (d) => d ? Math.ceil((new Date(d) - new Date()) / 864e5) : null,
  number:    (n) => Number(n ?? 0).toLocaleString("en-IN"),
};

const getHsnCode = (m) => m?.hsnCode?.hsnCode       ?? null;
const getGst     = (m) => m?.hsnCode?.gstPercentage ?? m?.gstPercentage ?? null;
const getHsnDesc = (m) => m?.hsnCode?.description   ?? null;

const totalStockOf    = (m) => (m?.storeInventory ?? []).reduce((s, i) => s + (i.stockQuantity ?? 0), 0);
const nearestExpiryOf = (m) => (m?.storeInventory ?? []).reduce(
  (e, i) => (!e || new Date(i.expiryDate) < new Date(e)) ? i.expiryDate : e, null
);

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

const fadeIn  = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.22 } } };
const fadeUp  = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } } };
const slideIn = {
  hidden:  { opacity: 0, x: 18 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 14, transition: { duration: 0.16 } },
};
const stagger   = { visible: { transition: { staggerChildren: 0.04 } } };

// FIX: modal animation — subtle spring, no jarring displacement
const modalAnim = {
  hidden:  { opacity: 0, scale: 0.97, y: 8  },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: "spring", stiffness: 380, damping: 30 } },
  exit:    { opacity: 0, scale: 0.97, y: 6,  transition: { duration: 0.14, ease: "easeIn" } },
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const Sk = ({ h = "h-4", w = "w-full", r = "rounded-lg" }) => (
  <div className={cx("skeleton-shimmer", h, w, r)} />
);

// ─────────────────────────────────────────────────────────────────────────────
// MICRO BADGES
// ─────────────────────────────────────────────────────────────────────────────

const StockBadge = memo(({ qty, large }) => {
  const sz = large ? "text-sm px-3 py-1" : "text-[10px] px-2 py-0.5";
  if (qty === 0)
    return <span className={cx("inline-flex items-center gap-1 font-black uppercase tracking-wide rounded-full text-error bg-error/10 border border-error/30", sz)}><XCircle size={large ? 12 : 9} />Out of Stock</span>;
  if (qty <= LOW_THRESH)
    return <span className={cx("inline-flex items-center gap-1 font-black uppercase tracking-wide rounded-full text-warning bg-warning/10 border border-warning/30", sz)}><AlertCircle size={large ? 12 : 9} />Only {qty} Left</span>;
  return <span className={cx("inline-flex items-center gap-1 font-black uppercase tracking-wide rounded-full text-success bg-success/10 border border-success/30", sz)}><CheckCircle2 size={large ? 12 : 9} />{fmt.number(qty)} Units</span>;
});

const ExpiryBadge = memo(({ date, large }) => {
  const d  = fmt.daysLeft(date);
  const sz = large ? "text-sm font-bold" : "text-[10px] font-bold";
  if (d === null) return <span className={cx("text-base-content/40", sz)}>—</span>;
  if (d < 0)    return <span className={cx("text-error bg-error/10 border border-error/25 px-2 py-0.5 rounded-full", sz)}>EXPIRED</span>;
  if (d <= 7)   return <span className={cx("text-error bg-error/10 border border-error/25 px-2 py-0.5 rounded-full", sz)}>{d}d left</span>;
  if (d <= 30)  return <span className={cx("text-warning bg-warning/10 border border-warning/25 px-2 py-0.5 rounded-full", sz)}>{d}d left</span>;
  return <span className={cx("text-base-content/55", sz)}>{fmt.dateShort(date)}</span>;
});

const SchedTag = memo(({ schedule }) => {
  const cfg = SCHEDULE_CFG[schedule] || SCHEDULE_CFG.None;
  if (!schedule || schedule === "None") return null;
  return <span className={cx("text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded border", cfg.color)}>{cfg.label}</span>;
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL  ← CORE FIX
//
// Root problem: original code used `z-500` (not a Tailwind class → compiled to nothing)
// AND placed the backdrop + panel in one div whose z-index was wrong.
// When the page was scrolled, the sticky top-bar (z-30) rendered on top of the modal.
//
// Solution:
//   • Backdrop  → z-[9998]  (fixed, fullscreen, click-to-close)
//   • Panel     → z-[9999]  (fixed, flex-centered, separate stacking context)
//   • Scroll lock compensates scrollbar width to prevent layout shift
// ─────────────────────────────────────────────────────────────────────────────

const Modal = memo(({ open, onClose, title, subtitle, children, size = "md" }) => {
  useEffect(() => {
    if (!open) return;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow     = "hidden";
    document.body.style.paddingRight = `${sw}px`;
    return () => {
      document.body.style.overflow     = "";
      document.body.style.paddingRight = "";
    };
  }, [open]);

  const sizeMap = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────────
              Sits at z-[9998]. Separate element keeps stacking context clean.
              Clicking it closes the modal. */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* ── Panel container ───────────────────────────────────────────────
              z-[9999] ensures it is ALWAYS above the backdrop and the sticky
              top-bar (z-30). pointer-events-none on wrapper so the backdrop
              click-through works; re-enabled on the actual panel. */}
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              key="panel"
              variants={modalAnim}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={cx(
                "pointer-events-auto w-full",
                "bg-base-100 rounded-t-2xl sm:rounded-2xl",
                "border border-base-300/70 shadow-2xl",
                "flex flex-col",
                // Proper max-height — uses dvh so mobile browser chrome is excluded
                "max-h-[92dvh] sm:max-h-[86dvh]",
                sizeMap[size],
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 flex-shrink-0">
                <div>
                  <h3 className="text-sm font-black text-base-content font-montserrat tracking-tight leading-snug">{title}</h3>
                  {subtitle && <p className="text-[11px] text-base-content/40 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close modal"
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-base-200 text-base-content/30 hover:text-base-content transition-all"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable body — overscroll-contain prevents page scroll bleed */}
              <div className="overflow-y-auto flex-1 px-5 py-5 overscroll-contain">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
});
Modal.displayName = "Modal";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD / INPUT ATOMS
// ─────────────────────────────────────────────────────────────────────────────

const Field = ({ label, required, hint, error, children }) => (
  <div>
    <label className="block text-[10px] font-black uppercase tracking-widest text-base-content/50 mb-1.5">
      {label} {required && <span className="text-error">*</span>}
    </label>
    {hint  && <p className="text-xs text-base-content/40 mb-1.5">{hint}</p>}
    {children}
    {error && <p className="text-xs text-error mt-1 font-semibold flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
  </div>
);

const Inp = ({ error, className = "", ...props }) => (
  <input {...props} className={cx("input-field w-full text-sm", error && "border-error", className)} />
);

// ─────────────────────────────────────────────────────────────────────────────
// MED STRIP
// ─────────────────────────────────────────────────────────────────────────────

const MedStrip = memo(({ med, variant = "default" }) => {
  const bg = {
    default: "bg-base-200 border-base-300",
    add:     "bg-primary/5 border-primary/20",
    deduct:  "bg-error/5 border-error/20",
    reorder: "bg-warning/5 border-warning/20",
  }[variant];

  return (
    <div className={cx("rounded-xl px-4 py-3 border flex gap-3 items-center", bg)}>
      <span className="text-2xl">{CATEGORY_ICON[med?.category] || "📦"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-base-content truncate">{med?.brandName}</p>
        <p className="text-xs text-base-content/50 mt-0.5 truncate">{med?.genericName} · {med?.category} · {med?.dosage}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-semibold text-base-content/55">MRP: {fmt.currency(med?.mrp)}</span>
          {getHsnCode(med) && (
            <span className="text-[10px] font-mono font-bold text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded">
              HSN {getHsnCode(med)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD STOCK FORM
// ─────────────────────────────────────────────────────────────────────────────

const AddStockForm = memo(({ medicine, onClose, onSubmit, loading }) => {
  const [form, setForm] = useState({
    stockQuantity: "",
    batchNumber:   "",
    expiryDate:    "",
    pricePerUnit:  medicine?.mrp ?? "",
  });
  const [errors, setErrors] = useState({});

  const ch = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: null }));
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.stockQuantity || Number(form.stockQuantity) <= 0) errs.stockQuantity = "Must be more than 0";
    if (!form.batchNumber.trim()) errs.batchNumber = "Required";
    if (!form.expiryDate)         errs.expiryDate  = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({
      medicineId:    medicine._id,
      stockQuantity: Number(form.stockQuantity),
      batchNumber:   form.batchNumber.trim(),
      expiryDate:    form.expiryDate,
      pricePerUnit:  Number(form.pricePerUnit) || medicine.mrp,
    });
  };

  const hsnCode = getHsnCode(medicine);
  const gst     = getGst(medicine);
  const hsnDesc = getHsnDesc(medicine);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <MedStrip med={medicine} variant="add" />

      {hsnCode && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
            <ScanBarcode size={11} />HSN / Tax Info
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-base-content/40 mb-0.5">HSN Code</p>
              <p className="font-mono font-bold">{hsnCode}</p>
            </div>
            {gst !== null && (
              <div>
                <p className="text-base-content/40 mb-0.5">GST</p>
                <p className="font-bold text-accent">{gst}% (CGST {gst / 2}% + SGST {gst / 2}%)</p>
              </div>
            )}
            {hsnDesc && (
              <div className="col-span-2">
                <p className="text-base-content/40 mb-0.5">Description</p>
                <p className="text-base-content/65 leading-snug">{hsnDesc}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Units to Add" required error={errors.stockQuantity} hint="No. of strips / bottles">
          <Inp name="stockQuantity" type="number" min="1" value={form.stockQuantity} onChange={ch} placeholder="100" error={errors.stockQuantity} />
        </Field>
        <Field label="Price / Unit (₹)" hint="Defaults to MRP">
          <Inp name="pricePerUnit" type="number" min="0" step="0.01" value={form.pricePerUnit} onChange={ch} />
        </Field>
      </div>

      <Field label="Batch Number" required error={errors.batchNumber} hint="Printed on the medicine box">
        <Inp name="batchNumber" type="text" value={form.batchNumber} onChange={ch} placeholder="BT-2025-001" className="font-mono" error={errors.batchNumber} />
      </Field>

      <Field label="Expiry Date" required error={errors.expiryDate} hint="Date on the box / strip">
        <Inp name="expiryDate" type="date" min={new Date().toISOString().split("T")[0]} value={form.expiryDate} onChange={ch} error={errors.expiryDate} />
      </Field>

      {medicine?.storageConditions?.temperature?.label && (
        <div className="flex items-start gap-2 bg-info/5 border border-info/20 rounded-xl px-3 py-2.5">
          <Thermometer size={13} className="text-info mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-info">Storage Requirement</p>
            <p className="text-xs text-base-content/60 mt-0.5">{medicine.storageConditions.temperature.label}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary-cta flex-1 py-3 text-sm flex items-center justify-center gap-2">
          {loading ? <span className="spinner w-4 h-4" /> : <><PackagePlus size={14} />Add Stock</>}
        </button>
      </div>
    </form>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DEDUCT STOCK FORM
// ─────────────────────────────────────────────────────────────────────────────

const DeductStockForm = memo(({ medicine, stockDetail, onClose, onSubmit, loading }) => {
  const [form, setForm]     = useState({ quantity: "", batchNumber: "", reason: "" });
  const [errors, setErrors] = useState({});

  const batches  = useMemo(() => (stockDetail?.storeInventory ?? []).filter(b => b.stockQuantity > 0), [stockDetail]);
  const selBatch = form.batchNumber ? batches.find(b => b.batchNumber === form.batchNumber) : null;

  const ch = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: null }));
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = "Must be more than 0";
    if (selBatch && Number(form.quantity) > selBatch.stockQuantity) errs.quantity = `Only ${selBatch.stockQuantity} units in this batch`;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({
      medicineId:  medicine._id,
      quantity:    Number(form.quantity),
      batchNumber: form.batchNumber || undefined,
      reason:      form.reason,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <MedStrip med={medicine} variant="deduct" />

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Available", value: stockDetail?.totalStock ?? "—", unit: "units"   },
          { label: "Active Batches",  value: batches.length,                  unit: "batches" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-base-200 rounded-xl p-3 text-center border border-base-300">
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-1">{label}</p>
            <p className="text-xl font-extrabold text-base-content font-montserrat">{value}</p>
            <p className="text-xs text-base-content/35">{unit}</p>
          </div>
        ))}
      </div>

      {batches.length > 0 && (
        <Field label="Select Batch (optional)" hint="Leave blank — oldest batch used first (FIFO)">
          <select name="batchNumber" value={form.batchNumber} onChange={ch} className="input-field w-full text-sm">
            <option value="">Auto — use oldest batch first</option>
            {batches.map(b => (
              <option key={b.batchNumber} value={b.batchNumber}>
                {b.batchNumber} — {b.stockQuantity} units — exp {fmt.date(b.expiryDate)}
              </option>
            ))}
          </select>
          {selBatch && (
            <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
              <Info size={10} />Available: <strong>{selBatch.stockQuantity} units</strong>
            </p>
          )}
        </Field>
      )}

      <Field label="Quantity to Remove" required error={errors.quantity} hint="How many units are you taking out?">
        <Inp name="quantity" type="number" min="1" value={form.quantity} onChange={ch} placeholder="10" error={errors.quantity} />
      </Field>

      <Field label="Reason (optional)" hint="e.g. Dispensed, Damaged, Audit">
        <Inp name="reason" type="text" value={form.reason} onChange={ch} placeholder="What happened to this stock?" />
      </Field>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 py-3 text-sm font-bold uppercase tracking-wide rounded-xl bg-error text-white flex items-center justify-center gap-2 hover:bg-error/85 transition-colors">
          {loading ? <span className="spinner w-4 h-4" /> : <><PackageMinus size={14} />Remove Stock</>}
        </button>
      </div>
    </form>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// REORDER FORM
// ─────────────────────────────────────────────────────────────────────────────

const ReorderForm = memo(({ medicine, onClose, onSubmit, loading }) => {
  const [form, setForm]     = useState({ requiredQuantity: "", urgency: "Medium" });
  const [errors, setErrors] = useState({});

  const submit = (e) => {
    e.preventDefault();
    if (!form.requiredQuantity || Number(form.requiredQuantity) <= 0) {
      setErrors({ requiredQuantity: "Enter the quantity needed" });
      return;
    }
    onSubmit({ medicineId: medicine._id, requiredQuantity: Number(form.requiredQuantity), urgency: form.urgency });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <MedStrip med={medicine} variant="reorder" />

      <div className="bg-warning/5 border border-warning/20 rounded-xl p-3">
        <p className="text-xs font-bold text-warning flex items-center gap-1.5 mb-1">
          <Bell size={12} />Reorder Request
        </p>
        <p className="text-xs text-base-content/60">This sends a restock request to admin. They will arrange the supply.</p>
      </div>

      <Field label="Units needed" required error={errors.requiredQuantity} hint="Total quantity you want ordered">
        <Inp
          name="requiredQuantity"
          type="number"
          min="1"
          value={form.requiredQuantity}
          onChange={(e) => { setForm(p => ({ ...p, requiredQuantity: e.target.value })); setErrors({}); }}
          placeholder="500"
          error={errors.requiredQuantity}
        />
      </Field>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-base-content/50 mb-2">How urgent?</label>
        <div className="grid grid-cols-2 gap-2">
          {["Low", "Medium", "High", "Critical"].map(u => {
            const cfg    = URGENCY_CFG[u];
            const active = form.urgency === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => setForm(p => ({ ...p, urgency: u }))}
                className={cx(
                  "py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition-all text-left",
                  active
                    ? cx(cfg.cls, "ring-2 ring-offset-1 ring-current shadow-sm")
                    : "border-base-300 text-base-content/40 hover:border-base-content/30 hover:bg-base-200/50",
                )}
              >
                <span className="block font-black">{u}</span>
                <span className="block text-[10px] font-normal opacity-70 mt-0.5 normal-case">{cfg.tip}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary-cta flex-1 py-3 text-sm flex items-center justify-center gap-2">
          {loading ? <span className="spinner w-4 h-4" /> : <><Send size={14} />Send Request</>}
        </button>
      </div>
    </form>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LEFT PANEL — LIST ITEM
// FIX: accepts a `itemRef` to support auto-scroll
// ─────────────────────────────────────────────────────────────────────────────

const MedListItem = memo(({ med, isSelected, onSelect, itemRef }) => {
  const totalStock    = totalStockOf(med);
  const nearestExpiry = nearestExpiryOf(med);
  const isOut = totalStock === 0;
  const isLow = !isOut && totalStock <= LOW_THRESH;
  const icon  = CATEGORY_ICON[med?.category] || "📦";

  return (
    <motion.button
      ref={itemRef}
      variants={fadeUp}
      onClick={() => onSelect(med)}
      className={cx(
        "w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 border",
        isSelected
          ? "bg-primary/10 border-primary/30 shadow-sm"
          : "bg-transparent border-transparent hover:bg-base-200 hover:border-base-300",
      )}
    >
      <div className={cx(
        "w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border",
        isOut ? "bg-error/8 border-error/15" : isLow ? "bg-warning/8 border-warning/15" : "bg-base-200 border-base-300",
      )}>{icon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className={cx("text-xs font-bold truncate", isSelected ? "text-primary" : "text-base-content")}>{med.brandName}</p>
          {med.isPrescriptionRequired && (
            <span className="text-[7px] font-black bg-warning/15 text-warning border border-warning/25 px-1 py-0.5 rounded-full flex-shrink-0">Rx</span>
          )}
        </div>
        <p className="text-[10px] text-base-content/45 truncate">{med.genericName} · {med.dosage}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {isOut
            ? <span className="text-[9px] font-black text-error">Out of Stock</span>
            : isLow
              ? <span className="text-[9px] font-black text-warning">{totalStock} left</span>
              : <span className="text-[9px] font-semibold text-success">{fmt.number(totalStock)} units</span>
          }
          {(() => {
            const d = fmt.daysLeft(nearestExpiry);
            if (d !== null && d <= 30)
              return <span className={cx("text-[9px] font-bold", d < 0 ? "text-error" : "text-warning")}>· {d < 0 ? "Expired" : `exp ${d}d`}</span>;
            return null;
          })()}
        </div>
      </div>

      {isSelected && <ChevronRight size={12} className="text-primary flex-shrink-0" />}
    </motion.button>
  );
});
MedListItem.displayName = "MedListItem";

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL — DETAIL
// ─────────────────────────────────────────────────────────────────────────────

const InfoRow = ({ label, value, highlight, mono }) => (
  <div className="flex items-start gap-2 py-2 border-b border-base-300/40 last:border-0">
    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/35 w-28 flex-shrink-0 pt-0.5">{label}</span>
    <span className={cx("text-xs font-semibold flex-1", highlight ? "text-primary" : "text-base-content/75", mono && "font-mono")}>{value || "—"}</span>
  </div>
);

const EmptyDetail = () => (
  <div className="h-full flex flex-col items-center justify-center gap-4 text-base-content/20 p-8">
    <div className="w-20 h-20 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center">
      <PackageSearch size={32} />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-base-content/30">Select a medicine</p>
      <p className="text-xs text-base-content/20 mt-0.5">Click any item from the left list to see details and manage stock</p>
    </div>
  </div>
);

const DETAIL_TABS = [
  { id: "overview",  label: "Overview",  icon: Package      },
  { id: "batches",   label: "Batches",   icon: Layers       },
  { id: "clinical",  label: "Clinical",  icon: FlaskConical },
  { id: "pricing",   label: "Pricing",   icon: Hash         },
];

const MedicineDetail = memo(({ medicine: m, stockDetail, loadingStock, onAdd, onDeduct, onReorder }) => {
  const [tab, setTab] = useState("overview");

  if (!m) return <EmptyDetail />;

  const totalStock    = totalStockOf(m);
  const nearestExpiry = nearestExpiryOf(m);
  const isOut  = totalStock === 0;
  const isLow  = !isOut && totalStock <= LOW_THRESH;
  const icon   = CATEGORY_ICON[m?.category] || "📦";
  const hsnCode = getHsnCode(m);
  const gst     = getGst(m);
  const batches = stockDetail?.storeInventory ?? m?.storeInventory ?? [];

  return (
    <motion.div key={m._id} variants={slideIn} initial="hidden" animate="visible" exit="exit" className="h-full flex flex-col">
      {/* accent bar */}
      <div className={cx("h-1 w-full flex-shrink-0 mt-2", isOut ? "bg-error" : isLow ? "bg-warning" : "bg-success")} />

      {/* header */}
      <div className="px-5 pt-4 pb-4 border-b border-base-300 flex-shrink-0">
        <div className="flex items-start gap-4">
          <div className={cx(
            "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 border-2",
            isOut ? "bg-error/8 border-error/20" : isLow ? "bg-warning/8 border-warning/20" : "bg-base-200 border-base-300",
          )}>{icon}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-black text-base-content font-montserrat leading-tight truncate">{m.brandName}</h2>
                <p className="text-xs text-base-content/50 mt-0.5 truncate">{m.genericName} · {m.dosage}</p>
              </div>
              <p className="text-lg font-extrabold text-base-content font-montserrat flex-shrink-0">{fmt.currency(m.mrp)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[9px] font-black uppercase tracking-wide text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">{m.category}</span>
              {m.dosage && <span className="text-[9px] font-bold text-base-content/50 bg-base-200 border border-base-300 px-2 py-0.5 rounded-md">{m.dosage}</span>}
              {m.schedule && m.schedule !== "None" && <SchedTag schedule={m.schedule} />}
              {m.isPrescriptionRequired && (
                <span className="text-[9px] font-black text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                  <Shield size={8} />Rx
                </span>
              )}
              {m?.storageConditions?.requiresColdChain && <span title="Cold Chain"><Thermometer size={11} className="text-info" /></span>}
              {m?.storageConditions?.lightSensitive    && <span title="Light Sensitive"><Wind size={11} className="text-warning" /></span>}
              {m?.storageConditions?.moistureSensitive && <span title="Moisture Sensitive"><Droplets size={11} className="text-info" /></span>}
            </div>
          </div>
        </div>

        {/* stock / expiry / batches strip */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className={cx(
            "rounded-xl p-3 text-center border",
            isOut ? "bg-error/5 border-error/20" : isLow ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20",
          )}>
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Stock</p>
            <StockBadge qty={totalStock} large />
          </div>
          <div className="bg-base-200/70 rounded-xl p-3 text-center border border-base-300/60">
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Nearest Expiry</p>
            <ExpiryBadge date={nearestExpiry} large />
          </div>
          <div className="bg-base-200/70 rounded-xl p-3 text-center border border-base-300/60">
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Batches</p>
            <p className="text-base font-extrabold text-base-content font-montserrat">{batches.length}</p>
          </div>
        </div>
      </div>

      {/* action toolbar */}
      <div className="flex items-stretch gap-2 px-5 py-3 border-b border-base-300 flex-shrink-0 bg-base-200/30">
        <button onClick={() => onAdd(m)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95 transition-all border border-primary/20">
          <PackagePlus size={16} /><span className="text-[10px] font-black uppercase tracking-wide">Add Stock</span>
        </button>
        <button onClick={() => onDeduct(m)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-error/10 text-error hover:bg-error hover:text-white active:scale-95 transition-all border border-error/20">
          <PackageMinus size={16} /><span className="text-[10px] font-black uppercase tracking-wide">Remove</span>
        </button>
        <button onClick={() => onReorder(m)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-warning/10 text-warning hover:bg-warning hover:text-white active:scale-95 transition-all border border-warning/20">
          <Send size={16} /><span className="text-[10px] font-black uppercase tracking-wide">Reorder</span>
        </button>
      </div>

      {/* detail tabs */}
      <div className="flex gap-0 border-b border-base-300 flex-shrink-0 px-2">
        {DETAIL_TABS.map(t => {
          const Ic = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold border-b-2 transition-all whitespace-nowrap",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-base-content/40 hover:text-base-content",
              )}
            >
              <Ic size={12} />{t.label}
            </button>
          );
        })}
      </div>

      {/* tab body */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {tab === "overview" && (
            <motion.div key="ov" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              {m.description && (
                <div className="bg-base-200/50 border border-base-300 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-1.5">Description</p>
                  <p className="text-xs text-base-content/70 leading-relaxed">{m.description}</p>
                </div>
              )}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2">Core Details</p>
                <div className="bg-base-100 border border-base-300 rounded-xl px-3">
                  <InfoRow label="Manufacturer" value={m.manufacturer} />
                  <InfoRow label="Packaging"    value={m.packaging} />
                  <InfoRow label="Route"        value={m.routeOfAdministration} />
                  {m.therapeuticClass && <InfoRow label="Therapeutic" value={m.therapeuticClass} />}
                  <InfoRow label="Country"      value={m.countryOfOrigin || "India"} />
                </div>
              </div>
              {m.saltComposition?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2">Salt Composition</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.saltComposition.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-base-200 border border-base-300 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-base-content/70">
                        <FlaskConical size={10} className="text-primary" />{s.ingredient} · {s.strength} {s.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === "batches" && (
            <motion.div key="bt" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              {loadingStock ? (
                <div className="space-y-2">{[0, 1, 2].map(i => <Sk key={i} h="h-16" />)}</div>
              ) : batches.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { l: "Total Stock", v: fmt.number(totalStock), u: "units"  },
                      { l: "Batches",     v: batches.length,          u: "active" },
                    ].map(({ l, v, u }) => (
                      <div key={l} className="bg-base-200 rounded-xl p-3 text-center border border-base-300">
                        <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35">{l}</p>
                        <p className="text-lg font-extrabold text-base-content font-montserrat mt-1">{v}</p>
                        <p className="text-xs text-base-content/35">{u}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-base-300 overflow-hidden">
                    <div className="grid grid-cols-4 bg-base-200/60 px-3 py-2">
                      {["Batch No.", "Stock", "Expires", "Price/Unit"].map(h => (
                        <span key={h} className="text-[9px] font-black uppercase tracking-widest text-base-content/35">{h}</span>
                      ))}
                    </div>
                    <div className="divide-y divide-base-200 max-h-64 overflow-y-auto">
                      {batches.map((inv, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className={cx("grid grid-cols-4 px-3 py-2.5 items-center", inv.stockQuantity === 0 && "opacity-40")}
                        >
                          <span className="font-mono text-xs font-bold text-primary truncate pr-1">{inv.batchNumber}</span>
                          <StockBadge qty={inv.stockQuantity} />
                          <ExpiryBadge date={inv.expiryDate} />
                          <span className="text-xs font-bold text-right">{fmt.currency(inv.pricePerUnit)}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Package size={32} className="mx-auto mb-3 text-base-content/15" />
                  <p className="text-sm font-bold text-base-content/35">No stock in this store</p>
                  <p className="text-xs text-base-content/25 mt-1">Use "Add Stock" above to get started</p>
                </div>
              )}
            </motion.div>
          )}

          {tab === "clinical" && (
            <motion.div key="cl" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              {[
                { label: "Indications",       items: m.indications,       color: "text-success" },
                { label: "Contraindications", items: m.contraindications, color: "text-error"   },
                { label: "Side Effects",      items: m.sideEffects,       color: "text-warning" },
                { label: "Drug Interactions", items: m.interactions,      color: "text-info"    },
                { label: "Warnings",          items: m.warnings,          color: "text-error"   },
              ].map(({ label, items, color }) => (
                <div key={label}>
                  <p className={cx("text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-70", color)}>{label}</p>
                  {items?.length > 0
                    ? <div className="flex flex-wrap gap-1.5">{items.map((item, i) => <span key={i} className="text-[10px] bg-base-200 border border-base-300 px-2 py-1 rounded-lg font-semibold text-base-content/70">{item}</span>)}</div>
                    : <p className="text-xs text-base-content/25">None recorded</p>
                  }
                </div>
              ))}
              {m.storageConditions && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2">Storage Conditions</p>
                  <div className="bg-base-100 border border-base-300 rounded-xl px-3">
                    {m.storageConditions.temperature?.label && <InfoRow label="Temperature"      value={m.storageConditions.temperature.label} />}
                    <InfoRow label="Light Sensitive"    value={m.storageConditions.lightSensitive    ? "Yes" : "No"} />
                    <InfoRow label="Moisture Sensitive" value={m.storageConditions.moistureSensitive ? "Yes" : "No"} />
                    <InfoRow label="Cold Chain"         value={m.storageConditions.requiresColdChain ? "Required" : "Not Required"} />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === "pricing" && (
            <motion.div key="pr" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "MRP",      value: fmt.currency(m.mrp),              note: "Max Retail Price",    big: true                },
                  { label: "GST Rate", value: gst !== null ? `${gst}%` : "—",  note: "Applied GST",         color: "text-accent"     },
                  { label: "PTR",      value: m.ptr ? fmt.currency(m.ptr) : "—", note: "Price to Retailer"                            },
                  { label: "PTS",      value: m.pts ? fmt.currency(m.pts) : "—", note: "Price to Stockist"                            },
                ].map(({ label, value, note, big, color }) => (
                  <div key={label} className="bg-base-100 border border-base-300 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-base-content/30 mb-0.5">{label}</p>
                    <p className={cx("font-black", big ? "text-2xl" : "text-base", color || "text-base-content")}>{value}</p>
                    <p className="text-[9px] text-base-content/30 mt-0.5">{note}</p>
                  </div>
                ))}
              </div>
              {hsnCode && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2">HSN Details</p>
                  <div className="bg-base-100 border border-base-300 rounded-xl px-3">
                    <InfoRow label="HSN Code"    value={hsnCode} highlight mono />
                    {getHsnDesc(m) && <InfoRow label="Description" value={getHsnDesc(m)} />}
                    <InfoRow label="GST"         value={gst !== null ? `${gst}%` : "—"} />
                    {m.hsnCode?.cgstPercentage !== undefined && <InfoRow label="CGST" value={`${m.hsnCode.cgstPercentage}%`} />}
                    {m.hsnCode?.sgstPercentage !== undefined && <InfoRow label="SGST" value={`${m.hsnCode.sgstPercentage}%`} />}
                  </div>
                </div>
              )}
              {m.regulatoryInfo && Object.values(m.regulatoryInfo).some(Boolean) && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2">Regulatory IDs</p>
                  <div className="bg-base-100 border border-base-300 rounded-xl px-3">
                    {m.regulatoryInfo.cdscoDrugLicenceNo && <InfoRow label="CDSCO"          value={m.regulatoryInfo.cdscoDrugLicenceNo} mono />}
                    {m.regulatoryInfo.stateLicenceNo     && <InfoRow label="State Licence"  value={m.regulatoryInfo.stateLicenceNo}     mono />}
                    {m.regulatoryInfo.importLicenceNo    && <InfoRow label="Import Licence" value={m.regulatoryInfo.importLicenceNo}    mono />}
                    {m.regulatoryInfo.fdaApprovalNo      && <InfoRow label="FDA Approval"   value={m.regulatoryInfo.fdaApprovalNo}      mono />}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
});
MedicineDetail.displayName = "MedicineDetail";

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(({ icon: Icon, label, value, sub, colorClass, delay = 0 }) => (
  <motion.div
    variants={fadeUp}
    custom={delay}
    className="bg-base-100 border border-base-300 rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-all duration-300 relative overflow-hidden"
  >
    <div className={cx("absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 opacity-[0.06]", colorClass)} />
    <div className={cx("w-10 h-10 rounded-xl flex items-center justify-center mb-3", colorClass)}>
      <Icon size={18} className="text-white" />
    </div>
    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40 mb-1">{label}</p>
    <p className="text-2xl font-extrabold text-base-content font-montserrat leading-none">{value}</p>
    {sub && <p className="text-[10px] text-base-content/40 mt-1.5 leading-snug">{sub}</p>}
  </motion.div>
));

// ─────────────────────────────────────────────────────────────────────────────
// LOW STOCK PANEL
// ─────────────────────────────────────────────────────────────────────────────

const LowStockPanel = memo(({ items, loading, meta, onReorder, onEmailAlert }) => (
  <div className="flex flex-col h-full">
    {items.length > 0 && (
      <div className="flex items-center justify-between gap-3 mx-4 mt-4 px-3 py-3 rounded-xl bg-warning/8 border border-warning/25 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-base-content">{items.length} item{items.length !== 1 ? "s" : ""} running low</p>
            <p className="text-[10px] text-base-content/50">Below {meta.threshold ?? 5} units — reorder soon</p>
          </div>
        </div>
        <button onClick={onEmailAlert} className="text-[10px] font-black uppercase text-warning-content bg-warning px-2.5 py-1.5 rounded-lg hover:bg-warning/80 transition-colors flex items-center gap-1">
          <Bell size={10} />Email Alert
        </button>
      </div>
    )}
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {loading ? [0, 1, 2, 3].map(i => <Sk key={i} h="h-14" />) :
        items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-success" />
            </div>
            <p className="text-sm font-bold text-success">All medicines are well stocked!</p>
            <p className="text-xs text-base-content/30">Nothing below threshold</p>
          </div>
        ) : items.map((item, idx) => (
          <motion.div
            key={`${item.medicineId}-${item.batchNumber}-${idx}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="flex items-center gap-3 px-3 py-3 bg-base-100 rounded-xl border border-base-300 hover:border-warning/30 transition-colors"
          >
            <span className="text-xl flex-shrink-0">{CATEGORY_ICON[item.category] || "📦"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-base-content truncate">{item.brandName || item.name}</p>
              <p className="text-[10px] text-base-content/45 mt-0.5 truncate">Batch: <span className="font-mono">{item.batchNumber}</span> · Exp: {fmt.date(item.expiryDate)}</p>
            </div>
            <div className="text-center flex-shrink-0">
              <p className={cx("text-xl font-extrabold font-montserrat", item.stockQuantity === 0 ? "text-error" : "text-warning")}>{item.stockQuantity}</p>
              <p className="text-[9px] text-base-content/35 font-bold">units left</p>
            </div>
            <button
              onClick={() => onReorder(item)}
              className="flex items-center gap-1 text-[10px] font-black uppercase text-warning bg-warning/10 border border-warning/25 px-2.5 py-1.5 rounded-xl hover:bg-warning hover:text-white transition-all flex-shrink-0"
            >
              <Send size={10} />Reorder
            </button>
          </motion.div>
        ))
      }
    </div>
  </div>
));
LowStockPanel.displayName = "LowStockPanel";

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY PANEL
// ─────────────────────────────────────────────────────────────────────────────

const ExpiryPanel = memo(({ items, loading, meta, onEmailAlert }) => (
  <div className="flex flex-col h-full">
    {items.length > 0 && (
      <div className="flex items-center justify-between gap-3 mx-4 mt-4 px-3 py-3 rounded-xl bg-error/8 border border-error/25 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-error flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-base-content">{meta.count} batch{meta.count !== 1 ? "es" : ""} expiring in {meta.alertDays ?? 30} days</p>
            <p className="text-[10px] text-base-content/50">Review and quarantine immediately</p>
          </div>
        </div>
        <button onClick={onEmailAlert} className="text-[10px] font-black uppercase text-error-content bg-error px-2.5 py-1.5 rounded-lg hover:bg-error/80 transition-colors flex items-center gap-1">
          <Bell size={10} />Email Alert
        </button>
      </div>
    )}
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {loading ? [0, 1, 2, 3].map(i => <Sk key={i} h="h-14" />) :
        items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-success" />
            </div>
            <p className="text-sm font-bold text-success">No medicines expiring soon!</p>
            <p className="text-xs text-base-content/30">All batches safe for {meta.alertDays ?? 30} days</p>
          </div>
        ) : items.map((item, idx) => {
          const days = fmt.daysLeft(item.expiryDate);
          return (
            <motion.div
              key={`${item.medicineId}-${item.batchNumber}-${idx}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cx(
                "flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors",
                days !== null && days < 0  ? "bg-error/5 border-error/20"     :
                days !== null && days <= 7 ? "bg-error/3 border-error/15"     :
                days !== null && days <= 30? "bg-warning/3 border-warning/15" :
                                             "bg-base-100 border-base-300",
              )}
            >
              <span className="text-xl flex-shrink-0">{CATEGORY_ICON[item.category] || "📦"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content truncate">{item.brandName || item.name}</p>
                <p className="text-[10px] text-base-content/45 mt-0.5">Batch: <span className="font-mono">{item.batchNumber}</span> · {fmt.number(item.stockQuantity)} units</p>
              </div>
              <div className="text-right flex-shrink-0">
                <ExpiryBadge date={item.expiryDate} large />
                <p className="text-[10px] text-base-content/40 mt-0.5">{fmt.date(item.expiryDate)}</p>
              </div>
            </motion.div>
          );
        })
      }
    </div>
  </div>
));
ExpiryPanel.displayName = "ExpiryPanel";

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

const Pagination = memo(({ pagination: p, onPage }) => {
  if (!p?.totalPages || p.totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onPage(p.currentPage - 1)} disabled={p.currentPage <= 1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-base-300 hover:bg-base-200 disabled:opacity-30 transition-colors">
        <ChevronLeft size={12} />
      </button>
      <span className="text-xs font-semibold text-base-content/50 px-2 tabular-nums">{p.currentPage}/{p.totalPages}</span>
      <button onClick={() => onPage(p.currentPage + 1)} disabled={p.currentPage >= p.totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg border border-base-300 hover:bg-base-200 disabled:opacity-30 transition-colors">
        <ChevronRight size={12} />
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL TABS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const RIGHT_TABS = [
  { id: "detail",    label: "Medicine Detail", icon: Pill,         badge: null        },
  { id: "low-stock", label: "Low Stock",       icon: TrendingDown, badge: "lowStock"  },
  { id: "expiry",    label: "Expiry Alerts",   icon: Clock,        badge: "expiry"    },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicinesManagement() {
  const dispatch = useDispatch();

  const {
    medicines, medicinesPagination,
    medicineStockDetail,
    expiryAlerts, expiryAlertsMeta,
    lowStockItems, lowStockMeta,
    inventorySummary,
    loading, success,
  } = useSelector(s => s.pharmacyStore);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [category,  setCategory]  = useState("");
  const [showLow,   setShowLow]   = useState(false);
  const [showExp,   setShowExp]   = useState(false);
  const [page,      setPage]      = useState(1);
  const [selectedMed, setSelectedMed] = useState(null);
  const [rightTab,    setRightTab]    = useState("detail");

  // Modals
  const [addMed,     setAddMed]     = useState(null);
  const [deductMed,  setDeductMed]  = useState(null);
  const [reorderMed, setReorderMed] = useState(null);

  // ── Auto-scroll refs ──────────────────────────────────────────────────────
  // FIX: keep a map of item refs by medicine _id so we can scroll to selected
  const listScrollRef = useRef(null);
  const itemRefsMap   = useRef({});

  const getItemRef = useCallback((id) => {
    if (!itemRefsMap.current[id]) {
      itemRefsMap.current[id] = React.createRef();
    }
    return itemRefsMap.current[id];
  }, []);

  // Scroll selected item into view whenever it changes
  useEffect(() => {
    if (!selectedMed?._id) return;
    const ref = itemRefsMap.current[selectedMed._id];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedMed]);

  // ── Debounce ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debSearch, category, showLow, showExp]);

  // ── Fetches ───────────────────────────────────────────────────────────────
  useEffect(() => { dispatch(fetchInventorySummary()); }, [dispatch]);

  useEffect(() => {
    dispatch(fetchMedicines({
      page, limit: PAGE_SIZE,
      search:      debSearch  || undefined,
      category:    category   || undefined,
      lowStock:    showLow    ? "true" : undefined,
      expiringSoon:showExp    ? "true" : undefined,
    }));
  }, [dispatch, page, debSearch, category, showLow, showExp]);

  useEffect(() => { if (rightTab === "low-stock") dispatch(fetchLowStock()); },              [dispatch, rightTab]);
  useEffect(() => { if (rightTab === "expiry")    dispatch(fetchExpiryAlerts({ days: 30 })); }, [dispatch, rightTab]);
  useEffect(() => { if (selectedMed?._id) dispatch(fetchMedicineStock(selectedMed._id)); },  [dispatch, selectedMed]);
  useEffect(() => { if (deductMed?._id)   dispatch(fetchMedicineStock(deductMed._id)); },    [dispatch, deductMed]);

  // ── Success handlers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!success.addStock) return;
    setAddMed(null);
    dispatch(clearSuccess("addStock"));
    dispatch(fetchMedicines({ page, limit: PAGE_SIZE }));
    dispatch(fetchInventorySummary());
    if (selectedMed?._id) dispatch(fetchMedicineStock(selectedMed._id));
  }, [success.addStock]);

  useEffect(() => {
    if (!success.deductStock) return;
    setDeductMed(null);
    dispatch(clearSuccess("deductStock"));
    dispatch(fetchMedicines({ page, limit: PAGE_SIZE }));
    dispatch(fetchInventorySummary());
    if (selectedMed?._id) dispatch(fetchMedicineStock(selectedMed._id));
  }, [success.deductStock]);

  useEffect(() => {
    if (!success.requestStock) return;
    setReorderMed(null);
    dispatch(clearSuccess("requestStock"));
  }, [success.requestStock]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleSelectMed = useCallback((med) => {
    setSelectedMed(med);
    setRightTab("detail");
  }, []);

  const handleRefresh = useCallback(() => {
    dispatch(fetchInventorySummary());
    dispatch(fetchMedicines({ page, limit: PAGE_SIZE }));
    if (rightTab === "low-stock") dispatch(fetchLowStock());
    if (rightTab === "expiry")    dispatch(fetchExpiryAlerts({ days: 30 }));
  }, [dispatch, page, rightTab]);

  const isRefreshing = loading.medicines || loading.inventorySummary;
  const stockDetail  = medicineStockDetail?.medicineId === selectedMed?._id ? medicineStockDetail : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200/50">

      {/* ── TOP BAR — z-30 (stays well below modal z-[9998]) ─────────────── */}
      <div className="bg-base-100 border-b border-base-300 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Pill size={14} className="text-primary-content" />
            </div>
            <div>
              <p className="text-sm font-black text-base-content leading-none">Medicines & Inventory</p>
              <p className="text-[9px] text-base-content/40 font-medium">Pharmacy Store Dashboard</p>
            </div>
          </div>

          {/* live summary numbers */}
          <div className="hidden lg:flex items-center gap-5 text-xs">
            {[
              { label: "Products",  value: inventorySummary?.totalSKUs          ?? "—", color: "text-primary"   },
              { label: "Units",     value: inventorySummary?.totalUnits          ?? "—", color: "text-secondary" },
              { label: "Low Stock", value: inventorySummary?.lowStockCount       ?? "—", color: "text-warning"   },
              { label: "Expiring",  value: inventorySummary?.expiringSoonCount   ?? "—", color: "text-error"     },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-base-content/35 font-medium">{label}:</span>
                <span className={cx("font-extrabold", color)}>{fmt.number(value)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />Live
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-base-300 text-xs font-bold text-base-content/55 hover:text-base-content hover:bg-base-200 transition-all disabled:opacity-40"
            >
              <RefreshCw size={13} className={cx(isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── STAT STRIP ───────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-8 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading.inventorySummary ? [0, 1, 2, 3].map(i => (
            <div key={i} className="card p-4 space-y-3">
              <Sk h="h-10" w="w-10" r="rounded-xl" />
              <Sk h="h-7" w="w-1/2" />
              <Sk h="h-3" />
            </div>
          )) : (
            <>
              <StatCard icon={Boxes}         label="Total Products" value={fmt.number(inventorySummary?.totalSKUs ?? 0)}          sub="Different medicines stocked"               colorClass="bg-primary"   delay={0} />
              <StatCard icon={Archive}       label="Total Units"    value={fmt.number(inventorySummary?.totalUnits ?? 0)}         sub="Across all active batches"                 colorClass="bg-secondary" delay={1} />
              <StatCard icon={AlertTriangle} label="Low Stock"      value={inventorySummary?.lowStockCount ?? 0}                  sub={`Under ${inventorySummary?.lowStockThreshold ?? 5} units`}  colorClass="bg-warning"   delay={2} />
              <StatCard icon={Clock}         label="Expiring Soon"  value={inventorySummary?.expiringSoonCount ?? 0}              sub={`In ${inventorySummary?.expiryAlertDays ?? 30} days`}       colorClass="bg-error"     delay={3} />
            </>
          )}
        </div>
      </div>

      {/* ── MAIN SPLIT PANEL ─────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-8 py-4">
        <div className="flex gap-4 h-[calc(100vh-13rem)]">

          {/* ════ LEFT: MEDICINE LIST ════ */}
          <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm">

            {/* list header */}
            <div className="p-3 border-b border-base-300 space-y-2.5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-base-content">
                  Medicines
                  <span className="ml-2 text-[10px] font-normal text-base-content/40 tabular-nums">
                    {fmt.number(medicinesPagination.totalItems ?? 0)} total
                  </span>
                </p>
                {(search || category || showLow || showExp) && (
                  <button
                    onClick={() => { setSearch(""); setCategory(""); setShowLow(false); setShowExp(false); }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, brand…"
                  className="input-field w-full pl-8 pr-7 text-xs py-2"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content">
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* category pills */}
              <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {["All", "Tablet", "Capsule", "Syrup", "Injection", "Cream", "Drops", "Inhaler", "Others"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat === "All" ? "" : cat)}
                    className={cx(
                      "flex-shrink-0 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all whitespace-nowrap",
                      (cat === "All" && !category) || category === cat
                        ? "bg-primary text-primary-content border-primary"
                        : "bg-base-100 border-base-300 text-base-content/40 hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {CATEGORY_ICON[cat] ? CATEGORY_ICON[cat] + " " : ""}{cat}
                  </button>
                ))}
              </div>

              {/* quick toggles */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowLow(v => !v)}
                  className={cx(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all flex-1 justify-center",
                    showLow ? "bg-warning text-warning-content border-warning" : "border-base-300 text-base-content/40 hover:border-warning hover:text-warning",
                  )}
                >
                  <TrendingDown size={11} />Low Stock
                </button>
                <button
                  onClick={() => setShowExp(v => !v)}
                  className={cx(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all flex-1 justify-center",
                    showExp ? "bg-error text-white border-error" : "border-base-300 text-base-content/40 hover:border-error hover:text-error",
                  )}
                >
                  <Clock size={11} />Expiring
                </button>
              </div>
            </div>

            {/* list body — FIX: ref attached for scroll container */}
            <div ref={listScrollRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loading.medicines ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                    <Sk h="h-10" w="w-10" r="rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Sk h="h-3" w="w-3/4" />
                      <Sk h="h-2.5" w="w-1/2" />
                      <Sk h="h-2" w="w-1/3" />
                    </div>
                  </div>
                ))
              ) : medicines.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/20 py-16">
                  <PackageSearch size={36} />
                  <div className="text-center">
                    <p className="text-sm font-bold text-base-content/30">No medicines found</p>
                    <p className="text-xs text-base-content/20 mt-0.5">Try clearing filters</p>
                  </div>
                </div>
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="visible">
                  {medicines.map(med => (
                    <MedListItem
                      key={med._id}
                      med={med}
                      isSelected={selectedMed?._id === med._id}
                      onSelect={handleSelectMed}
                      // FIX: pass per-item ref for auto-scroll
                      itemRef={getItemRef(med._id)}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            {/* list footer */}
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-base-300 flex-shrink-0 bg-base-200/30">
              <p className="text-[10px] text-base-content/35 font-semibold">
                Page {medicinesPagination.currentPage || 1} / {medicinesPagination.totalPages || 1}
              </p>
              <Pagination pagination={medicinesPagination} onPage={setPage} />
            </div>
          </div>

          {/* ════ RIGHT: DETAIL / ALERTS PANEL ════ */}
          <div className="flex-1 min-w-0 flex flex-col bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm">

            {/* right tab bar */}
            <div className="flex items-center gap-0 border-b border-base-300 flex-shrink-0 px-2 bg-base-100">
              {RIGHT_TABS.map(t => {
                const Ic  = t.icon;
                const cnt = t.badge === "lowStock" ? (lowStockMeta.count ?? 0)
                          : t.badge === "expiry"   ? (expiryAlertsMeta.count ?? 0)
                          : 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => setRightTab(t.id)}
                    className={cx(
                      "flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap",
                      rightTab === t.id ? "border-primary text-primary" : "border-transparent text-base-content/40 hover:text-base-content",
                    )}
                  >
                    <Ic size={13} />{t.label}
                    {cnt > 0 && (
                      <span className={cx(
                        "min-w-[18px] h-4 rounded-full text-[9px] font-black px-1.5 leading-4 flex items-center justify-center",
                        rightTab === t.id ? "bg-primary text-primary-content"
                          : t.badge === "lowStock" ? "bg-warning text-warning-content"
                          : "bg-error text-error-content",
                      )}>
                        {cnt > 99 ? "99+" : cnt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* right body */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">

                {rightTab === "detail" && (
                  <motion.div key="detail" variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="absolute inset-0 overflow-y-auto">
                    <AnimatePresence mode="wait">
                      <MedicineDetail
                        key={selectedMed?._id || "empty"}
                        medicine={selectedMed}
                        stockDetail={stockDetail}
                        loadingStock={loading.medicineStock}
                        onAdd={m => setAddMed(m)}
                        onDeduct={m => setDeductMed(m)}
                        onReorder={m => setReorderMed(m)}
                      />
                    </AnimatePresence>
                  </motion.div>
                )}

                {rightTab === "low-stock" && (
                  <motion.div key="low" variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="absolute inset-0 overflow-hidden">
                    <LowStockPanel
                      items={lowStockItems}
                      loading={loading.lowStock}
                      meta={lowStockMeta}
                      onReorder={m => setReorderMed(m)}
                      onEmailAlert={() => dispatch(fetchLowStock({ sendEmail: "true" }))}
                    />
                  </motion.div>
                )}

                {rightTab === "expiry" && (
                  <motion.div key="expiry" variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="absolute inset-0 overflow-hidden">
                    <ExpiryPanel
                      items={expiryAlerts}
                      loading={loading.expiryAlerts}
                      meta={expiryAlertsMeta}
                      onEmailAlert={() => dispatch(fetchExpiryAlerts({ days: 30, sendEmail: "true" }))}
                    />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}

      <Modal
        open={!!addMed}
        onClose={() => setAddMed(null)}
        title="Add Stock"
        subtitle={addMed ? `${addMed.brandName} · ${addMed.dosage ?? ""}` : ""}
        size="md"
      >
        {addMed && (
          <AddStockForm
            medicine={addMed}
            onClose={() => setAddMed(null)}
            onSubmit={p => dispatch(addStock(p))}
            loading={loading.addStock}
          />
        )}
      </Modal>

      <Modal
        open={!!deductMed}
        onClose={() => setDeductMed(null)}
        title="Remove Stock"
        subtitle={deductMed ? `${deductMed.brandName} · ${deductMed.dosage ?? ""}` : ""}
        size="md"
      >
        {deductMed && (
          <DeductStockForm
            medicine={deductMed}
            stockDetail={medicineStockDetail?.medicineId === deductMed._id ? medicineStockDetail : null}
            onClose={() => setDeductMed(null)}
            onSubmit={p => dispatch(deductStock(p))}
            loading={loading.deductStock}
          />
        )}
      </Modal>

      <Modal
        open={!!reorderMed}
        onClose={() => setReorderMed(null)}
        title="Request Restock"
        subtitle="Ask admin to arrange new stock"
        size="sm"
      >
        {reorderMed && (
          <ReorderForm
            medicine={reorderMed}
            onClose={() => setReorderMed(null)}
            onSubmit={p => dispatch(requestStock(p))}
            loading={loading.requestStock}
          />
        )}
      </Modal>
    </div>
  );
}