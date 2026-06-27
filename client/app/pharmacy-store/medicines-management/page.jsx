"use client";

/**
 * MedicinesManagement.jsx
 * Pharmacy-role: Medicine CATALOGUE management only.
 * Create / Edit / Discontinue medicines + sync inventory placeholders.
 * NO stock / batch / inventory operations here.
 */

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Plus, Edit3, Trash2, RefreshCw,
  HelpCircle, X, ChevronRight, BookOpen, Zap,
  CheckCircle2, AlertCircle, Loader2, Info,
  ChevronDown, ChevronUp, Eye, RotateCcw,
  Pill, AlertTriangle, Layers, BarChart2,
  Activity, FileText, Tag, ShoppingBag,
} from "lucide-react";

import {
  fetchMedicines,
  fetchMedicineBySlug,
  createMedicine,
  updateMedicine,
  discontinueMedicine,
  syncOneMedicineInventory,
  fetchHsnCodes,
  clearMedicineError,
  clearSuccessMessage,
  clearMedicineDetail,
} from "@/store/slices/medicineSlice";

import {
  selectMedicines,
  selectMedicineDetail,
  selectHsnCodes,
  selectMedicineLoading,
  selectActionLoading,
  selectMedicineError,
  selectActionError,
  selectSuccessMessage,
  selectMedicinePagination,
} from "@/store/slices/medicineSlice";

// ─────────────────────────────────────────────────────────────────────────────
// § ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" },
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28 } },
};

const modalVariant = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.22 } },
  exit:   { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "catalogue", label: "Catalogue",    icon: Layers   },
  { id: "add",       label: "Add Medicine", icon: Plus     },
  { id: "help",      label: "Help & Guide", icon: BookOpen },
];

const CATEGORIES = [
  "Tablet","Capsule","Syrup","Suspension","Solution","Injection","Infusion",
  "Ointment","Cream","Gel","Lotion","Drops","Inhaler","Nasal Spray","Patch",
  "Suppository","Powder","Granules","Lozenge","Implant","Others",
];

const SCHEDULES = ["H","H1","X","G","J","C","C1","None"];

const ROUTES = [
  "Oral","Intravenous","Intramuscular","Subcutaneous","Topical",
  "Inhalation","Rectal","Vaginal","Ophthalmic","Otic",
  "Nasal","Sublingual","Transdermal","Others",
];

const GST_SLABS = [0, 5, 12, 18, 28];

const BLANK_FORM = {
  name: "", brandName: "", genericName: "", description: "",
  category: "Tablet", dosage: "", routeOfAdministration: "Oral",
  packaging: "", manufacturer: "", countryOfOrigin: "India",
  schedule: "None", isPrescriptionRequired: true,
  gstPercentage: 5, hsnCode: "", referenceMrp: "",
  therapeuticClass: "", pharmacologicalClass: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// § SMALL UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function FieldNote({ children }) {
  return (
    <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
      <Info size={11} className="flex-shrink-0" />{children}
    </p>
  );
}

function Spinner({ size = "md" }) {
  return <div className={`loading loading-${size}`} role="status" aria-label="Loading" />;
}

function Toast({ message, type = "success", onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`alert alert-${type} fixed top-6 right-6 z-50 max-w-sm shadow-depth`}
    >
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle"><X size={14} /></button>
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon size={20} /></div>
      <div>
        <h2 className="text-lg font-bold text-base-content">{title}</h2>
        {subtitle && <p className="text-xs text-base-content/50">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-base-200 mb-4"><Icon size={32} className="text-base-content/30" /></div>
      <p className="font-semibold text-base-content/60">{title}</p>
      {sub && <p className="text-sm text-base-content/40 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide = false }) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral/60 backdrop-blur-soft"
          />
          <motion.div
            variants={modalVariant} initial="hidden" animate="visible" exit="exit"
            className={`relative card p-6 w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[92vh] overflow-y-auto z-10`}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-base-content">{title}</h3>
              <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle"><X size={16} /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § MEDICINE FORM  (shared by Add + Edit)
// ─────────────────────────────────────────────────────────────────────────────

function MedicineForm({ initial = BLANK_FORM, onSubmit, loading, submitLabel = "Save", onCancel }) {
  const hsnCodes = useSelector(selectHsnCodes);
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  // Sync form if initial changes (edit modal re-opens with new medicine)
  useEffect(() => { setForm(initial); }, [JSON.stringify(initial)]);

  const required = form.name && form.brandName && form.genericName &&
    form.category && form.dosage && form.packaging && form.manufacturer;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Identity ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Identity</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label"><span className="label-text">Medicine Name *</span></label>
            <input className="input-field" placeholder="e.g. Paracetamol 500mg Tab" value={form.name} onChange={set("name")} />
            <FieldNote>Full descriptive name including strength and form.</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Brand Name *</span></label>
            <input className="input-field" placeholder="e.g. Calpol" value={form.brandName} onChange={set("brandName")} />
            <FieldNote>Trademarked brand name as printed on the package.</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Generic Name *</span></label>
            <input className="input-field" placeholder="e.g. Paracetamol" value={form.genericName} onChange={set("genericName")} />
            <FieldNote>INN (International Non-proprietary Name) of the active ingredient.</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Manufacturer *</span></label>
            <input className="input-field" placeholder="e.g. GSK Pharma" value={form.manufacturer} onChange={set("manufacturer")} />
            <FieldNote>Registered name of the manufacturing company.</FieldNote>
          </div>
          <div className="sm:col-span-2">
            <label className="label"><span className="label-text">Description</span></label>
            <textarea className="input-field" rows={2} placeholder="Short product description…" value={form.description} onChange={set("description")} />
            <FieldNote>Optional summary shown on the medicine detail page.</FieldNote>
          </div>
        </div>
      </div>

      {/* ── Classification ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Classification</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label"><span className="label-text">Category *</span></label>
            <select className="input-field" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <FieldNote>Physical dosage form of the medicine.</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Schedule</span></label>
            <select className="input-field" value={form.schedule} onChange={set("schedule")}>
              {SCHEDULES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <FieldNote>India Drugs & Cosmetics Act schedule. H/H1 = prescription-only; X = narcotic; None = OTC.</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Therapeutic Class</span></label>
            <input className="input-field" placeholder="e.g. Analgesics, Antibiotics" value={form.therapeuticClass} onChange={set("therapeuticClass")} />
            <FieldNote>Drug class by therapeutic use (e.g. NSAIDs, Beta-lactams).</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Pharmacological Class</span></label>
            <input className="input-field" placeholder="e.g. COX inhibitor" value={form.pharmacologicalClass} onChange={set("pharmacologicalClass")} />
            <FieldNote>Mechanism-based classification (optional but useful for searches).</FieldNote>
          </div>
        </div>
      </div>

      {/* ── Dosage & Route ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Dosage & Route</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label"><span className="label-text">Dosage *</span></label>
            <input className="input-field" placeholder="e.g. 500mg, 5mg/ml" value={form.dosage} onChange={set("dosage")} />
            <FieldNote>Strength per unit (e.g. 500mg per tablet, 5mg/ml for syrup).</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Route of Administration</span></label>
            <select className="input-field" value={form.routeOfAdministration} onChange={set("routeOfAdministration")}>
              {ROUTES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <FieldNote>How the medicine enters the body (Oral, IV, Topical, etc.).</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Packaging *</span></label>
            <input className="input-field" placeholder="e.g. Strip of 10 Tablets" value={form.packaging} onChange={set("packaging")} />
            <FieldNote>Pack description exactly as printed on box (used in search & listings).</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">Country of Origin</span></label>
            <input className="input-field" placeholder="India" value={form.countryOfOrigin} onChange={set("countryOfOrigin")} />
            <FieldNote>Manufacturing country. Default: India.</FieldNote>
          </div>
        </div>
      </div>

      {/* ── Pricing & Tax ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Pricing & Tax</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label"><span className="label-text">Reference MRP (₹)</span></label>
            <input className="input-field" type="number" step="0.01" placeholder="e.g. 150.00" value={form.referenceMrp} onChange={set("referenceMrp")} />
            <FieldNote>Suggested MRP from manufacturer. Actual selling MRP is set per-store in inventory.</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">GST %</span></label>
            <select className="input-field" value={form.gstPercentage} onChange={set("gstPercentage")}>
              {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
            </select>
            <FieldNote>Indian GST slab: 0% (life-saving), 5% (most pharma), 12% (patent drugs), 18% (OTC cosmetics).</FieldNote>
          </div>
          <div>
            <label className="label"><span className="label-text">HSN Code</span></label>
            <select className="input-field" value={form.hsnCode} onChange={set("hsnCode")}>
              <option value="">— Select HSN (optional) —</option>
              {hsnCodes.map((h) => (
                <option key={h._id} value={h._id}>{h.hsnCode} — {h.description?.slice(0, 40)}</option>
              ))}
            </select>
            <FieldNote>Harmonised System of Nomenclature code for this product. Drives CGST/SGST/IGST computation.</FieldNote>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              id="rx"
              checked={form.isPrescriptionRequired}
              onChange={set("isPrescriptionRequired")}
            />
            <label htmlFor="rx" className="label cursor-pointer">
              <span className="label-text">Prescription Required</span>
            </label>
          </div>
        </div>
        <FieldNote>Prescription flag controls checkout flow — customers must upload Rx for Schedule H/H1/X medicines.</FieldNote>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-base-300">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
        )}
        <button
          type="button"
          onClick={() => onSubmit(form)}
          className="btn btn-primary btn-sm gap-2"
          disabled={loading || !required}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § MEDICINE DETAIL MODAL (View + Edit + Discontinue + Sync)
// ─────────────────────────────────────────────────────────────────────────────

function MedicineDetailModal({ open, onClose, medicine }) {
  const dispatch = useDispatch();
  const actionLoading = useSelector(selectActionLoading);
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [confirmDisc, setConfirmDisc] = useState(false);
  const [discReason, setDiscReason] = useState("");

  useEffect(() => {
    if (!open) { setMode("view"); setConfirmDisc(false); setDiscReason(""); }
  }, [open]);

  if (!medicine) return null;

  const handleEdit = async (form) => {
    await dispatch(updateMedicine({ id: medicine._id, updates: form }));
    setMode("view");
    onClose();
  };

  const handleDisc = async () => {
    await dispatch(discontinueMedicine(medicine._id));
    onClose();
  };

  const handleSync = async () => {
    await dispatch(syncOneMedicineInventory(medicine._id));
  };

  const editInitial = {
    name:                   medicine.name ?? "",
    brandName:              medicine.brandName ?? "",
    genericName:            medicine.genericName ?? "",
    description:            medicine.description ?? "",
    category:               medicine.category ?? "Tablet",
    dosage:                 medicine.dosage ?? "",
    routeOfAdministration:  medicine.routeOfAdministration ?? "Oral",
    packaging:              medicine.packaging ?? "",
    manufacturer:           medicine.manufacturer ?? "",
    countryOfOrigin:        medicine.countryOfOrigin ?? "India",
    schedule:               medicine.schedule ?? "None",
    isPrescriptionRequired: medicine.isPrescriptionRequired ?? true,
    gstPercentage:          medicine.gstPercentage ?? 5,
    hsnCode:                medicine.hsnCode?._id ?? medicine.hsnCode ?? "",
    referenceMrp:           medicine.referenceMrp ?? "",
    therapeuticClass:       medicine.therapeuticClass ?? "",
    pharmacologicalClass:   medicine.pharmacologicalClass ?? "",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? `Edit — ${medicine.brandName}` : medicine.brandName}
      wide
    >
      {mode === "view" ? (
        <>
          {/* View detail */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
            {[
              ["Generic Name",    medicine.genericName],
              ["Category",        medicine.category],
              ["Dosage",          medicine.dosage],
              ["Packaging",       medicine.packaging],
              ["Manufacturer",    medicine.manufacturer],
              ["Schedule",        medicine.schedule],
              ["GST",             `${medicine.gstPercentage ?? 5}%`],
              ["Ref. MRP",        medicine.referenceMrp ? `₹${medicine.referenceMrp}` : "—"],
              ["HSN Code",        medicine.hsnCode?.hsnCode ?? "—"],
              ["Rx Required",     medicine.isPrescriptionRequired ? "Yes" : "No"],
              ["Therapeutic",     medicine.therapeuticClass ?? "—"],
              ["Status",          medicine.isDiscontinued ? "Discontinued" : "Active"],
            ].map(([label, val]) => (
              <div key={label} className="bg-base-200 rounded-xl p-3">
                <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide mb-0.5">{label}</p>
                <p className="font-semibold text-base-content truncate">{val ?? "—"}</p>
              </div>
            ))}
          </div>

          {medicine.description && (
            <p className="text-sm text-base-content/60 mb-6 leading-relaxed border-l-2 border-primary/30 pl-3">
              {medicine.description}
            </p>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-base-300">
            <button onClick={() => setMode("edit")} className="btn btn-primary btn-sm gap-2">
              <Edit3 size={14} /> Edit Medicine
            </button>
            <button
              onClick={handleSync}
              className="btn btn-ghost btn-sm gap-2"
              disabled={actionLoading}
              title="Creates zero-stock inventory placeholders for any store that doesn't have this medicine yet."
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Sync Inventory
            </button>
            {!medicine.isDiscontinued && (
              <button
                onClick={() => setConfirmDisc(true)}
                className="btn btn-error btn-sm gap-2 ml-auto"
              >
                <Trash2 size={14} /> Discontinue
              </button>
            )}
          </div>

          {/* Discontinue confirm */}
          <AnimatePresence>
            {confirmDisc && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
              >
                <div className="p-4 bg-error/10 border border-error/30 rounded-xl">
                  <p className="text-sm font-semibold text-error mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} /> Confirm Discontinuation
                  </p>
                  <p className="text-xs text-base-content/60 mb-3">
                    This will mark <strong>{medicine.brandName}</strong> as discontinued, soft-delete all store inventory records,
                    and send compliance emails to all pharmacies. This action cannot be undone from the pharmacy portal.
                  </p>
                  <textarea
                    className="input-field mb-3"
                    rows={2}
                    placeholder="Reason for discontinuation…"
                    value={discReason}
                    onChange={(e) => setDiscReason(e.target.value)}
                  />
                  <FieldNote>Reason is stored in the audit log and sent in compliance emails.</FieldNote>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setConfirmDisc(false)} className="btn btn-ghost btn-sm">Cancel</button>
                    <button onClick={handleDisc} className="btn btn-error btn-sm" disabled={actionLoading}>
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      Confirm Discontinue
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <MedicineForm
          initial={editInitial}
          onSubmit={handleEdit}
          loading={actionLoading}
          submitLabel="Update Medicine"
          onCancel={() => setMode("view")}
        />
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § CATALOGUE TAB
// ─────────────────────────────────────────────────────────────────────────────

function CatalogueTab() {
  const dispatch = useDispatch();
  const medicines = useSelector(selectMedicines);
  const loading = useSelector(selectMedicineLoading);
  const pagination = useSelector(selectMedicinePagination);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const load = (p = 1) => {
    dispatch(fetchMedicines({ search: search || undefined, category: category || undefined, page: p, limit: 20 }));
    setPage(p);
  };

  useEffect(() => { load(1); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(1);
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <SectionHeader
        icon={Layers}
        title="Medicine Catalogue"
        subtitle="Browse, view, edit or discontinue medicines in the catalogue."
      />

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            className="input-field pl-9"
            placeholder="Search brand or generic name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field max-w-[160px]" value={category} onChange={(e) => { setCategory(e.target.value); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn btn-primary btn-sm gap-2">
          <Search size={14} /> Search
        </button>
        <button
          type="button"
          onClick={() => { setSearch(""); setCategory(""); load(1); }}
          className="btn btn-ghost btn-sm"
        >
          <RefreshCw size={14} />
        </button>
      </form>
      <FieldNote>Showing active, non-deleted medicines from the global catalogue. Click any row to view details or edit.</FieldNote>

      {/* Table */}
      <div className="card overflow-hidden mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : medicines.length === 0 ? (
          <EmptyState icon={Package} title="No medicines found" sub="Try a different search term or category filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Category</th>
                  <th>Dosage</th>
                  <th>Schedule</th>
                  <th>GST</th>
                  <th>Ref. MRP</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((med, i) => (
                  <motion.tr key={med._id} variants={fadeUp} custom={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        {med.images?.[0]?.url ? (
                          <img
                            src={med.images[0].url}
                            alt={med.brandName}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-base-300"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center flex-shrink-0 border border-base-300">
                            <Pill size={16} className="text-base-content/30" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-base-content truncate max-w-[150px]">{med.brandName}</p>
                          <p className="text-xs text-base-content/50 truncate max-w-[150px]">{med.genericName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs">{med.category}</td>
                    <td className="text-xs font-mono">{med.dosage}</td>
                    <td>
                      <span className={`badge badge-sm ${med.schedule === "None" ? "badge-success" : med.schedule === "X" ? "badge-error" : "badge-warning"}`}>
                        {med.schedule === "None" ? "OTC" : med.schedule}
                      </span>
                    </td>
                    <td className="text-xs">{med.gstPercentage ?? 5}%</td>
                    <td className="text-xs tabular-nums">{med.referenceMrp ? `₹${med.referenceMrp}` : "—"}</td>
                    <td>
                      {med.isDiscontinued
                        ? <span className="badge badge-error badge-sm">Discontinued</span>
                        : <span className="badge badge-success badge-sm">Active</span>
                      }
                    </td>
                    <td>
                      <button
                        onClick={() => setSelected(med)}
                        className="btn btn-ghost btn-xs gap-1"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => load(page - 1)}
            className="btn btn-ghost btn-sm"
            disabled={page <= 1 || loading}
          >
            ← Prev
          </button>
          <span className="text-sm text-base-content/60">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            className="btn btn-ghost btn-sm"
            disabled={page >= pagination.totalPages || loading}
          >
            Next →
          </button>
        </div>
      )}

      <MedicineDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        medicine={selected}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § ADD MEDICINE TAB
// ─────────────────────────────────────────────────────────────────────────────

function AddMedicineTab({ onSwitchToCatalogue }) {
  const dispatch = useDispatch();
  const actionLoading = useSelector(selectActionLoading);
  const successMessage = useSelector(selectSuccessMessage);
  const [done, setDone] = useState(false);

  const handleCreate = async (form) => {
    const payload = {
      ...form,
      referenceMrp: form.referenceMrp ? Number(form.referenceMrp) : undefined,
      gstPercentage: Number(form.gstPercentage),
      hsnCode: form.hsnCode || undefined,
    };
    const res = await dispatch(createMedicine(payload));
    if (!res.error) {
      setDone(true);
      setTimeout(() => { setDone(false); onSwitchToCatalogue(); }, 2000);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <SectionHeader
        icon={Plus}
        title="Add New Medicine"
        subtitle="Create a catalogue entry. Stock details are added separately via Inventory."
      />

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="alert alert-success mb-5"
          >
            <CheckCircle2 size={16} />
            <span className="text-sm">Medicine created! Redirecting to catalogue…</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card p-6">
        <div className="alert alert-info mb-5">
          <Info size={15} />
          <span className="text-xs">
            This creates a <strong>catalogue entry only</strong>. It does not add stock.
            After creating, go to <strong>Inventory → Add Stock</strong> to add batches.
          </span>
        </div>
        <MedicineForm
          initial={BLANK_FORM}
          onSubmit={handleCreate}
          loading={actionLoading}
          submitLabel="Create Medicine"
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § HELP TAB
// ─────────────────────────────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    icon: Layers,
    title: "Catalogue — What It Is",
    content: `The Medicine Catalogue is the global product database. It contains:
• Medicine name, brand name, generic name
• Dosage, packaging, route of administration
• Schedule (H/H1/X = prescription; None = OTC)
• GST percentage and HSN code for tax computation
• Reference MRP (suggested; actual MRP is set per-store in Inventory)

As a pharmacy user you can: view all medicines, edit metadata, add new medicines, and discontinue medicines.
You CANNOT edit stock here — stock lives in the Inventory section.`,
  },
  {
    icon: Plus,
    title: "Adding a New Medicine",
    content: `Fill every required field (*) and click "Create Medicine":

Identity:
  Name* — full name with strength (e.g. "Paracetamol 500mg Tab")
  Brand Name* — trademarked name (e.g. Calpol)
  Generic Name* — INN active ingredient (e.g. Paracetamol)
  Manufacturer* — registered company name

Classification:
  Category* — physical form (Tablet, Capsule, Syrup, etc.)
  Schedule — H/H1 = Rx required; X = narcotic; None = OTC
  Therapeutic / Pharmacological Class — optional; improves search

Dosage:
  Dosage* — strength per unit (500mg, 5mg/ml)
  Route — how it enters the body
  Packaging* — strip/bottle description (e.g. "Strip of 10 Tablets")

Pricing & Tax:
  Reference MRP — manufacturer suggested price (store can override)
  GST % — use 5% for most pharma; 0% for life-saving drugs
  HSN Code — select from uploaded HSN list; auto-fills CGST/SGST/IGST
  Prescription Required — toggle ON for Schedule H/H1/X

After creating, the system automatically creates zero-stock inventory placeholders for all stores.`,
  },
  {
    icon: Edit3,
    title: "Editing a Medicine",
    content: `Click View on any catalogue row → then Edit Medicine.
• Only catalogue metadata can be edited here (name, GST, packaging, etc.)
• Stock quantity, batch, and pricing changes go through Inventory → Add/Deduct Stock
• After editing, click "Update Medicine" to save
• Changes propagate immediately to all store inventory records for display purposes`,
  },
  {
    icon: RotateCcw,
    title: "Sync Inventory",
    content: `"Sync Inventory" appears in the View modal. Use it when:
• A new store was added after this medicine was created
• The medicine's inventory placeholder is missing for some stores

The sync creates zero-stock MedicineInventory placeholder records for any store
that doesn't already have one. It does NOT add physical stock.`,
  },
  {
    icon: Trash2,
    title: "Discontinuing a Medicine",
    content: `Discontinuation is irreversible from the pharmacy portal:
• Marks the medicine isDiscontinued = true in the catalogue
• Soft-deletes all MedicineInventory records across all stores
• Sends compliance emails to all pharmacy accounts

When to discontinue:
  → Product recalled by manufacturer
  → Drug withdrawn by regulatory authority
  → Replaced by a newer formulation

Do NOT discontinue just because you're out of stock — use Restock Request instead.`,
  },
  {
    icon: Tag,
    title: "Schedule & Prescription Rules",
    content: `India schedule reference (Drugs & Cosmetics Act):
  H   — Prescription only (most antibiotics, antifungals)
  H1  — Prescription + special pharmacist recording
  X   — Narcotic/psychotropic (opioids, benzodiazepines) — narcotic licence needed
  G   — Caution label required
  J   — No advertising to public
  C   — Biological products requiring refrigeration
  C1  — Stricter biological conditions
  None — Over-the-counter (OTC), no prescription needed

Setting Prescription Required = ON shows a "Upload Rx" step at checkout.`,
  },
  {
    icon: ShoppingBag,
    title: "GST & HSN Codes",
    content: `Indian pharma GST rates (2024):
  0%  — Life-saving drugs notified by Govt (e.g. insulin)
  5%  — Most medicines, APIs, Ayurvedic formulations
  12% — Patent-protected drugs, some medical devices
  18% — Cosmetics / toiletries classified as OTC
  28% — Rarely applicable to pharma

HSN Code:
  4-digit code classifies the product under Harmonised System of Nomenclature.
  Selecting an HSN auto-fills CGST (GST/2), SGST (GST/2), IGST (= GST) on invoices.
  Upload HSN codes via Admin → HSN Upload before they appear in this dropdown.`,
  },
];

function HelpTab() {
  const [open, setOpen] = useState(null);
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <SectionHeader
        icon={BookOpen}
        title="Help & Guide"
        subtitle="Learn how to manage the medicine catalogue effectively."
      />

      <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
        <Zap size={18} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">Quick Start</p>
          <p className="text-xs text-base-content/60 mt-1">
            Browse medicines in <strong>Catalogue</strong>. Click <strong>Add Medicine</strong> to create a new entry.
            Click <strong>View</strong> on any medicine to edit or discontinue it.
            Stock management is in the separate <strong>Inventory</strong> section.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {HELP_SECTIONS.map((section, i) => {
          const Icon = section.icon;
          const isOpen = open === i;
          return (
            <motion.div key={i} variants={fadeUp} custom={i} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex items-center justify-between w-full p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <Icon size={16} />
                  </div>
                  <span className="font-semibold text-sm text-base-content">{section.title}</span>
                </div>
                {isOpen
                  ? <ChevronUp size={16} className="text-base-content/40 flex-shrink-0" />
                  : <ChevronDown size={16} className="text-base-content/40 flex-shrink-0" />}
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 border-t border-base-300">
                      <pre className="text-xs text-base-content/70 leading-relaxed whitespace-pre-wrap mt-3"
                        style={{ fontFamily: "var(--font-family-poppins)" }}>
                        {section.content}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicinesManagement() {
  const dispatch = useDispatch();
  const error = useSelector(selectMedicineError);
  const actionError = useSelector(selectActionError);
  const successMessage = useSelector(selectSuccessMessage);

  const [activeTab, setActiveTab] = useState("catalogue");

  // Load HSN codes for the form dropdown
  useEffect(() => {
    dispatch(fetchHsnCodes({ isActive: "true", limit: 200 }));
  }, [dispatch]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => dispatch(clearSuccessMessage()), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage, dispatch]);

  useEffect(() => {
    if (actionError || error) {
      const t = setTimeout(() => dispatch(clearMedicineError()), 5000);
      return () => clearTimeout(t);
    }
  }, [actionError, error, dispatch]);

  return (
    <div className="min-h-screen bg-base-100">

      {/* Global toasts */}
      <AnimatePresence>
        {successMessage && (
          <Toast key="s" message={successMessage} type="success" onClose={() => dispatch(clearSuccessMessage())} />
        )}
        {(actionError || error) && (
          <Toast key="e" message={actionError ?? error} type="error" onClose={() => dispatch(clearMedicineError())} />
        )}
      </AnimatePresence>

      <div className="container-custom py-6 max-w-6xl mx-auto">

        {/* Page header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6">
          <div className="flex items-center gap-2 text-xs text-base-content/40 mb-2">
            <span>Pharmacy</span>
            <ChevronRight size={12} />
            <span className="text-base-content/60">Medicines</span>
          </div>
          <h1 className="text-2xl font-extrabold text-base-content" style={{ fontFamily: "var(--font-family-montserrat)" }}>
            Medicine Management
          </h1>
          <p className="text-sm text-base-content/50 mt-1">
            Add, edit, and manage the medicine catalogue for your pharmacy.
          </p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-thin">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                  active
                    ? "bg-primary text-primary-content shadow-primary"
                    : "text-base-content/60 hover:bg-base-200"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={slideIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: 12 }}
          >
            {activeTab === "catalogue" && <CatalogueTab />}
            {activeTab === "add"       && (
              <AddMedicineTab onSwitchToCatalogue={() => setActiveTab("catalogue")} />
            )}
            {activeTab === "help"      && <HelpTab />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}