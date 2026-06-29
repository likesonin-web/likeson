"use client";

/**
 * MedicinesManagement.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pharmacy Medicine Catalogue Management
 * • URL /pharmacy-store/medicines-management/new → Add tab auto-opens
 * • All fields from Medicine.js model
 * • Image upload (multi, primary flag)
 * • Salt composition, storage conditions, regulatory info
 * • Sync inventory, discontinue with confirm
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Plus, Edit3, Trash2, RefreshCw,
  X, ChevronRight, BookOpen, Zap, CheckCircle2, AlertCircle,
  Loader2, Info, ChevronDown, ChevronUp, Eye, RotateCcw,
  Pill, AlertTriangle, Layers, Tag, ShoppingBag, Upload,
  ImagePlus, Star, StarOff, Thermometer, Shield, FlaskConical,
  FileText, Globe, Building2, Stethoscope, Microscope, Camera,
  Minus, Plus as PlusIcon, ChevronLeft,
} from "lucide-react";

import {
  fetchMedicines, fetchMedicineBySlug, createMedicine, updateMedicine,
  discontinueMedicine, syncOneMedicineInventory, fetchHsnCodes,
  clearMedicineError, clearSuccessMessage, clearMedicineDetail,
} from "@/store/slices/medicineSlice";

import {
  selectMedicines, selectMedicineDetail, selectHsnCodes,
  selectMedicineLoading, selectActionLoading, selectMedicineError,
  selectActionError, selectSuccessMessage, selectMedicinePagination,
} from "@/store/slices/medicineSlice";

// ─────────────────────────────────────────────────────────────────────────────
// § ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" },
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

const modalVariant = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTS — derived from Medicine.js schema
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "catalogue", label: "Catalogue", icon: Layers },
  { id: "add", label: "Add Medicine", icon: Plus },
  { id: "help", label: "Help & Guide", icon: BookOpen },
];

const CATEGORIES = [
  "Tablet", "Capsule", "Syrup", "Suspension", "Solution", "Injection",
  "Infusion", "Ointment", "Cream", "Gel", "Lotion", "Drops", "Inhaler",
  "Nasal Spray", "Patch", "Suppository", "Powder", "Granules", "Lozenge",
  "Implant", "Others",
];

const SCHEDULES = ["H", "H1", "X", "G", "J", "C", "C1", "None"];

const ROUTES = [
  "Oral", "Intravenous", "Intramuscular", "Subcutaneous", "Topical",
  "Inhalation", "Rectal", "Vaginal", "Ophthalmic", "Otic",
  "Nasal", "Sublingual", "Transdermal", "Others",
];

const GST_SLABS = [0, 5, 12, 18, 28];

const BLANK_FORM = {
  // Identity
  name: "", brandName: "", genericName: "", slug: "",
  description: "", drugForm: "",
  // Classification
  category: "Tablet", therapeuticClass: "", pharmacologicalClass: "", atcCode: "",
  // Dosage & Route
  dosage: "", routeOfAdministration: "Oral",
  // Packaging
  packaging: "", packSize: "", packUnit: "",
  // Manufacturer
  manufacturer: "", manufacturerAddress: "", countryOfOrigin: "India",
  // Regulatory
  schedule: "None", isPrescriptionRequired: true, narcoticLicenceRequired: false,
  // Pricing & Tax
  gstPercentage: 5, hsnCode: "", referenceMrp: "", ptr: "", pts: "",
  // Clinical
  indications: [], contraindications: [], sideEffects: [], interactions: [], warnings: [],
  // Salt composition
  saltComposition: [],
  // Storage
  storageConditions: {
    temperature: { min: "", max: "", label: "" },
    lightSensitive: false, moistureSensitive: false, requiresColdChain: false,
  },
  // Regulatory info
  regulatoryInfo: {
    cdscoDrugLicenceNo: "", stateLicenceNo: "", importLicenceNo: "", fdaApprovalNo: "",
  },
  // Search
  searchKeywords: [],
  // Images
  images: [],
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

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3 mt-1 flex items-center gap-2">
      {children}
    </p>
  );
}

function Toast({ message, type = "success", onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`alert alert-${type} fixed top-6 right-6 z-50 max-w-sm shadow-xl`}
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

function Spinner({ size = "md" }) {
  return <div className={`loading loading-${size}`} role="status" aria-label="Loading" />;
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
            className="absolute inset-0 bg-neutral/60 backdrop-blur-sm"
          />
          <motion.div
            variants={modalVariant} initial="hidden" animate="visible" exit="exit"
            className={`relative bg-base-100 rounded-2xl p-6 w-full ${wide ? "max-w-4xl" : "max-w-md"} max-h-[92vh] overflow-y-auto z-10 shadow-2xl`}
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
// § MULTI-VALUE INPUT (for arrays like indications, sideEffects, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function MultiValueInput({ label, values = [], onChange, placeholder, note }) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const remove = (i) => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="label"><span className="label-text">{label}</span></label>
      <div className="flex gap-2">
        <input
          className="input input-field input-sm flex-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <button type="button" onClick={add} className="btn btn-primary btn-sm btn-square">
          <PlusIcon size={14} />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v, i) => (
            <span key={i} className="badge badge-outline badge-sm gap-1 py-2.5">
              {v}
              <button type="button" onClick={() => remove(i)} className="ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § SALT COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────
function SaltCompositionEditor({ value = [], onChange }) {
  const add = () => onChange([...value, { ingredient: "", strength: "", unit: "" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const copy = [...value];
    copy[i] = { ...copy[i], [field]: val };
    onChange(copy);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label-text font-medium">Salt Composition</label>
        <button type="button" onClick={add} className="btn btn-ghost btn-xs gap-1">
          <PlusIcon size={12} /> Add Salt
        </button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-base-content/40 italic py-2">No salts added. Click "Add Salt" to list active ingredients.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((salt, i) => (
            <div key={i} className="flex gap-2 items-start p-3 bg-base-200 rounded-xl">
              <div className="grid grid-cols-3 gap-2 flex-1">
                <div>
                  <label className="label py-0"><span className="label-text text-xs">Ingredient *</span></label>
                  <input
                    className="input input-field input-xs w-full"
                    placeholder="Paracetamol"
                    value={salt.ingredient}
                    onChange={(e) => update(i, "ingredient", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label py-0"><span className="label-text text-xs">Strength *</span></label>
                  <input
                    className="input input-field input-xs w-full"
                    placeholder="500mg"
                    value={salt.strength}
                    onChange={(e) => update(i, "strength", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label py-0"><span className="label-text text-xs">Unit</span></label>
                  <input
                    className="input input-field input-xs w-full"
                    placeholder="mg"
                    value={salt.unit}
                    onChange={(e) => update(i, "unit", e.target.value)}
                  />
                </div>
              </div>
              <button type="button" onClick={() => remove(i)} className="btn btn-ghost btn-xs btn-circle text-error mt-4">
                <Minus size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <FieldNote>Active pharmaceutical ingredients with strength (e.g. Paracetamol / 500mg / mg).</FieldNote>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § IMAGE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function ImageUploadSection({ images = [], onChange }) {
  const fileRef = useRef();

  const handleFiles = (files) => {
    const newImgs = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: "",
      isPrimary: images.length === 0, // first = primary by default
      uploaded: false,
    }));
    onChange([...images, ...newImgs]);
  };

  const remove = (i) => {
    const updated = images.filter((_, idx) => idx !== i);
    // ensure at least one primary
    if (updated.length > 0 && !updated.find((img) => img.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  const setPrimary = (i) => {
    onChange(images.map((img, idx) => ({ ...img, isPrimary: idx === i })));
  };

  const setAlt = (i, val) => {
    const copy = [...images];
    copy[i] = { ...copy[i], altText: val };
    onChange(copy);
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label-text font-medium flex items-center gap-1.5">
          <Camera size={14} /> Product Images
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn btn-ghost btn-xs gap-1"
        >
          <ImagePlus size={12} /> Add Images
        </button>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-base-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={20} className="mx-auto text-base-content/30 mb-1" />
        <p className="text-xs text-base-content/50">Drag & drop or click to upload</p>
        <p className="text-xs text-base-content/30 mt-0.5">PNG, JPG, WEBP up to 10MB each</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {images.map((img, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-base-300 bg-base-200">
              <img
                src={img.previewUrl || img.url}
                alt={img.altText || `Image ${i + 1}`}
                className="w-full h-28 object-cover"
              />
              {/* Primary badge */}
              {img.isPrimary && (
                <span className="absolute top-1.5 left-1.5 badge badge-warning badge-xs">Primary</span>
              )}
              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(i)}
                    className="btn btn-xs btn-warning"
                    title="Set as primary"
                  >
                    <Star size={10} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="btn btn-xs btn-error"
                >
                  <Trash2 size={10} />
                </button>
              </div>
              {/* Alt text */}
              <input
                className="input input-xs w-full rounded-none border-t border-base-300 bg-base-100"
                placeholder="Alt text…"
                value={img.altText || ""}
                onChange={(e) => setAlt(i, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>
      )}
      <FieldNote>First image auto-set as primary. Star icon to change. Alt text for accessibility.</FieldNote>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § MEDICINE FORM — complete, all fields from schema
// ─────────────────────────────────────────────────────────────────────────────
function MedicineForm({ initial = BLANK_FORM, onSubmit, loading, submitLabel = "Save", onCancel }) {
  const hsnCodes = useSelector(selectHsnCodes);
  const [form, setForm] = useState({ ...BLANK_FORM, ...initial });
  const [activeSection, setActiveSection] = useState("identity");

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const setNested = (parent, k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [parent]: { ...f[parent], [k]: val } }));
  };

  const setDeepNested = (parent, sub, k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({
      ...f,
      [parent]: { ...f[parent], [sub]: { ...f[parent][sub], [k]: val } },
    }));
  };

  useEffect(() => {
    setForm({ ...BLANK_FORM, ...initial });
  }, [JSON.stringify(initial)]);

  const required = form.name && form.brandName && form.genericName &&
    form.category && form.dosage && form.packaging && form.manufacturer;

  const SECTIONS = [
    { id: "identity", label: "Identity", icon: Pill },
    { id: "classification", label: "Classification", icon: Layers },
    { id: "dosage", label: "Dosage & Route", icon: Stethoscope },
    { id: "clinical", label: "Clinical Info", icon: FlaskConical },
    { id: "pricing", label: "Pricing & Tax", icon: Tag },
    { id: "storage", label: "Storage", icon: Thermometer },
    { id: "regulatory", label: "Regulatory IDs", icon: Shield },
    { id: "media", label: "Images & Media", icon: Camera },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Section nav */}
      <div className="lg:w-44 flex-shrink-0">
        <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  activeSection === s.id
                    ? "bg-primary text-primary-content"
                    : "text-base-content/60 hover:bg-base-200"
                }`}
              >
                <Icon size={13} />{s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section content */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {/* ── IDENTITY ─────────────────────────────────────────────────── */}
            {activeSection === "identity" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SectionLabel><Pill size={13} /> Identity — Required Fields</SectionLabel>
                </div>
                <div>
                  <label className="label"><span className="label-text">Medicine Name *</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Paracetamol 500mg Tab" value={form.name} onChange={set("name")} />
                  <FieldNote>Full descriptive name with strength and form.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Brand Name *</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Calpol" value={form.brandName} onChange={set("brandName")} />
                  <FieldNote>Trademarked name as printed on package.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Generic Name *</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Paracetamol" value={form.genericName} onChange={set("genericName")} />
                  <FieldNote>INN active ingredient name.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Drug Form</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Dispersible, Chewable" value={form.drugForm} onChange={set("drugForm")} />
                  <FieldNote>Specific physical form variant.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Manufacturer *</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. GSK Pharma" value={form.manufacturer} onChange={set("manufacturer")} />
                  <FieldNote>Registered manufacturing company name.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Manufacturer Address</span></label>
                  <input className="input input-field input-sm w-full" placeholder="Factory address" value={form.manufacturerAddress} onChange={set("manufacturerAddress")} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Country of Origin</span></label>
                  <input className="input input-field input-sm w-full" placeholder="India" value={form.countryOfOrigin} onChange={set("countryOfOrigin")} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Slug (auto-generated)</span></label>
                  <input className="input input-field input-sm w-full" placeholder="auto-filled from brand name" value={form.slug} onChange={set("slug")} />
                  <FieldNote>URL identifier. Leave blank to auto-generate.</FieldNote>
                </div>
                <div className="sm:col-span-2">
                  <label className="label"><span className="label-text">Description</span></label>
                  <textarea className="textarea textarea-bordered w-full text-sm" rows={3} placeholder="Short product description…" value={form.description} onChange={set("description")} />
                  <FieldNote>Summary shown on medicine detail page.</FieldNote>
                </div>
                <div className="sm:col-span-2">
                  <MultiValueInput
                    label="Search Keywords"
                    values={form.searchKeywords}
                    onChange={(v) => setForm((f) => ({ ...f, searchKeywords: v }))}
                    placeholder="Add keyword and press Enter"
                    note="Extra keywords to help search find this medicine."
                  />
                </div>
              </div>
            )}

            {/* ── CLASSIFICATION ───────────────────────────────────────────── */}
            {activeSection === "classification" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SectionLabel><Layers size={13} /> Classification</SectionLabel>
                </div>
                <div>
                  <label className="label"><span className="label-text">Category *</span></label>
                  <select className="select input-field select-sm w-full" value={form.category} onChange={set("category")}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <FieldNote>Physical dosage form of the medicine.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Schedule</span></label>
                  <select className="select input-field select-sm w-full" value={form.schedule} onChange={set("schedule")}>
                    {SCHEDULES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <FieldNote>H/H1 = Rx-only; X = narcotic; None = OTC.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Therapeutic Class</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Antibiotics, NSAIDs" value={form.therapeuticClass} onChange={set("therapeuticClass")} />
                  <FieldNote>Drug class by therapeutic use.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Pharmacological Class</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. COX inhibitor, Beta-lactam" value={form.pharmacologicalClass} onChange={set("pharmacologicalClass")} />
                  <FieldNote>Mechanism-based classification.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">ATC Code</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. N02BE01" value={form.atcCode} onChange={set("atcCode")} />
                  <FieldNote>WHO Anatomical Therapeutic Chemical code.</FieldNote>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" id="rx" checked={form.isPrescriptionRequired} onChange={set("isPrescriptionRequired")} />
                    <label htmlFor="rx" className="label-text cursor-pointer">Prescription Required</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="checkbox checkbox-error checkbox-sm" id="narc" checked={form.narcoticLicenceRequired} onChange={set("narcoticLicenceRequired")} />
                    <label htmlFor="narc" className="label-text cursor-pointer">Narcotic Licence Required</label>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <SaltCompositionEditor
                    value={form.saltComposition}
                    onChange={(v) => setForm((f) => ({ ...f, saltComposition: v }))}
                  />
                </div>
              </div>
            )}

            {/* ── DOSAGE & ROUTE ────────────────────────────────────────────── */}
            {activeSection === "dosage" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SectionLabel><Stethoscope size={13} /> Dosage & Route</SectionLabel>
                </div>
                <div>
                  <label className="label"><span className="label-text">Dosage *</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. 500mg, 5mg/ml" value={form.dosage} onChange={set("dosage")} />
                  <FieldNote>Strength per unit.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Route of Administration</span></label>
                  <select className="select input-field select-sm w-full" value={form.routeOfAdministration} onChange={set("routeOfAdministration")}>
                    {ROUTES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <FieldNote>How medicine enters the body.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Packaging *</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Strip of 10 Tablets" value={form.packaging} onChange={set("packaging")} />
                  <FieldNote>Pack description as printed on box.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Pack Size</span></label>
                  <input className="input input-field input-sm w-full" type="number" placeholder="e.g. 10" value={form.packSize} onChange={set("packSize")} />
                  <FieldNote>Numeric quantity in pack.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">Pack Unit</span></label>
                  <input className="input input-field input-sm w-full" placeholder="e.g. Tablets, ml, g" value={form.packUnit} onChange={set("packUnit")} />
                  <FieldNote>Unit label for pack size.</FieldNote>
                </div>
              </div>
            )}

            {/* ── CLINICAL INFO ─────────────────────────────────────────────── */}
            {activeSection === "clinical" && (
              <div className="flex flex-col gap-4">
                <div>
                  <SectionLabel><FlaskConical size={13} /> Clinical Information</SectionLabel>
                </div>
                <MultiValueInput
                  label="Indications"
                  values={form.indications}
                  onChange={(v) => setForm((f) => ({ ...f, indications: v }))}
                  placeholder="Add indication and press Enter"
                  note="Approved therapeutic uses for this medicine."
                />
                <MultiValueInput
                  label="Contraindications"
                  values={form.contraindications}
                  onChange={(v) => setForm((f) => ({ ...f, contraindications: v }))}
                  placeholder="Add contraindication and press Enter"
                  note="Conditions where this medicine must not be used."
                />
                <MultiValueInput
                  label="Side Effects"
                  values={form.sideEffects}
                  onChange={(v) => setForm((f) => ({ ...f, sideEffects: v }))}
                  placeholder="Add side effect and press Enter"
                  note="Common and serious adverse effects."
                />
                <MultiValueInput
                  label="Drug/Food Interactions"
                  values={form.interactions}
                  onChange={(v) => setForm((f) => ({ ...f, interactions: v }))}
                  placeholder="Add interaction and press Enter"
                  note="Drug-drug or drug-food interactions to flag."
                />
                <MultiValueInput
                  label="Warnings"
                  values={form.warnings}
                  onChange={(v) => setForm((f) => ({ ...f, warnings: v }))}
                  placeholder="Add warning and press Enter"
                  note="Black-box warnings or special safety notices."
                />
              </div>
            )}

            {/* ── PRICING & TAX ─────────────────────────────────────────────── */}
            {activeSection === "pricing" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SectionLabel><Tag size={13} /> Pricing & Tax</SectionLabel>
                </div>
                <div>
                  <label className="label"><span className="label-text">Reference MRP (₹)</span></label>
                  <input className="input input-field input-sm w-full" type="number" step="0.01" placeholder="e.g. 150.00" value={form.referenceMrp} onChange={set("referenceMrp")} />
                  <FieldNote>Manufacturer suggested MRP. Actual selling MRP set per-store in Inventory.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">PTR — Price to Retailer (₹)</span></label>
                  <input className="input input-field input-sm w-full" type="number" step="0.01" placeholder="e.g. 120.00" value={form.ptr} onChange={set("ptr")} />
                  <FieldNote>Catalogue reference: price distributor charges retailers.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">PTS — Price to Stockist (₹)</span></label>
                  <input className="input input-field input-sm w-full" type="number" step="0.01" placeholder="e.g. 110.00" value={form.pts} onChange={set("pts")} />
                  <FieldNote>Price manufacturer charges stockists.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">GST %</span></label>
                  <select className="select input-field select-sm w-full" value={form.gstPercentage} onChange={set("gstPercentage")}>
                    {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
                  </select>
                  <FieldNote>0% life-saving · 5% most pharma · 12% patent drugs · 18% OTC cosmetics.</FieldNote>
                </div>
                <div>
                  <label className="label"><span className="label-text">HSN Code</span></label>
                  <select className="select input-field select-sm w-full" value={form.hsnCode} onChange={set("hsnCode")}>
                    <option value="">— Select HSN (optional) —</option>
                    {hsnCodes.map((h) => (
                      <option key={h._id} value={h._id}>{h.hsnCode} — {h.description?.slice(0, 40)}</option>
                    ))}
                  </select>
                  <FieldNote>Harmonised System code. Drives CGST/SGST/IGST computation on invoices.</FieldNote>
                </div>
                {form.gstPercentage > 0 && (
                  <div className="sm:col-span-2 p-3 bg-base-200 rounded-xl">
                    <p className="text-xs text-base-content/60 font-semibold mb-1">Auto-computed GST breakdown</p>
                    <div className="flex gap-4 text-xs">
                      <span>CGST: <strong>{form.gstPercentage / 2}%</strong></span>
                      <span>SGST: <strong>{form.gstPercentage / 2}%</strong></span>
                      <span>IGST: <strong>{form.gstPercentage}%</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STORAGE ───────────────────────────────────────────────────── */}
            {activeSection === "storage" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SectionLabel><Thermometer size={13} /> Storage Conditions</SectionLabel>
                </div>
                <div>
                  <label className="label"><span className="label-text">Min Temp (°C)</span></label>
                  <input className="input input-field input-sm w-full" type="number" placeholder="e.g. 2" value={form.storageConditions.temperature.min} onChange={setDeepNested("storageConditions", "temperature", "min")} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Max Temp (°C)</span></label>
                  <input className="input input-field input-sm w-full" type="number" placeholder="e.g. 25" value={form.storageConditions.temperature.max} onChange={setDeepNested("storageConditions", "temperature", "max")} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label"><span className="label-text">Storage Label</span></label>
                  <input className="input input-field input-sm w-full" placeholder='e.g. "Store below 25°C" or "Refrigerate (2–8°C)"' value={form.storageConditions.temperature.label} onChange={setDeepNested("storageConditions", "temperature", "label")} />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-3">
                  {[
                    ["lightSensitive", "Light Sensitive — protect from light"],
                    ["moistureSensitive", "Moisture Sensitive — keep dry"],
                    ["requiresColdChain", "Requires Cold Chain — must refrigerate during transport"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        id={key}
                        checked={form.storageConditions[key]}
                        onChange={setNested("storageConditions", key)}
                      />
                      <label htmlFor={key} className="label-text cursor-pointer">{label}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── REGULATORY ────────────────────────────────────────────────── */}
            {activeSection === "regulatory" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <SectionLabel><Shield size={13} /> Regulatory Licence IDs</SectionLabel>
                </div>
                {[
                  ["cdscoDrugLicenceNo", "CDSCO Drug Licence No.", "DL/2024/XXXXX"],
                  ["stateLicenceNo", "State Licence No.", "MH-DL-2024-XXXXX"],
                  ["importLicenceNo", "Import Licence No. (if applicable)", ""],
                  ["fdaApprovalNo", "FDA Approval No. (if applicable)", ""],
                ].map(([key, label, ph]) => (
                  <div key={key}>
                    <label className="label"><span className="label-text">{label}</span></label>
                    <input
                      className="input input-field input-sm w-full"
                      placeholder={ph}
                      value={form.regulatoryInfo[key]}
                      onChange={setNested("regulatoryInfo", key)}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <FieldNote>These IDs are stored for compliance audit. Not required to create a catalogue entry.</FieldNote>
                </div>
              </div>
            )}

            {/* ── IMAGES ────────────────────────────────────────────────────── */}
            {activeSection === "media" && (
              <div>
                <SectionLabel><Camera size={13} /> Product Images</SectionLabel>
                <ImageUploadSection
                  images={form.images}
                  onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Section nav buttons */}
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-base-300">
          <div className="flex gap-2">
            {SECTIONS.findIndex((s) => s.id === activeSection) > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => {
                  const idx = SECTIONS.findIndex((s) => s.id === activeSection);
                  setActiveSection(SECTIONS[idx - 1].id);
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {SECTIONS.findIndex((s) => s.id === activeSection) < SECTIONS.length - 1 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => {
                  const idx = SECTIONS.findIndex((s) => s.id === activeSection);
                  setActiveSection(SECTIONS[idx + 1].id);
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            ) : null}
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § MEDICINE DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function MedicineDetailModal({ open, onClose, medicine }) {
  const dispatch = useDispatch();
  const actionLoading = useSelector(selectActionLoading);
  const [mode, setMode] = useState("view");
  const [confirmDisc, setConfirmDisc] = useState(false);
  const [discReason, setDiscReason] = useState("");

  useEffect(() => {
    if (!open) { setMode("view"); setConfirmDisc(false); setDiscReason(""); }
  }, [open]);

  if (!medicine) return null;

  const handleEdit = async (form) => {
    // Build FormData if images present
    const payload = buildPayload(form);
    await dispatch(updateMedicine({ id: medicine._id, updates: payload }));
    setMode("view");
    onClose();
  };

  const handleDisc = async () => {
    await dispatch(discontinueMedicine(medicine._id));
    onClose();
  };

  const handleSync = () => dispatch(syncOneMedicineInventory(medicine._id));

  const editInitial = {
    name: medicine.name ?? "",
    brandName: medicine.brandName ?? "",
    genericName: medicine.genericName ?? "",
    slug: medicine.slug ?? "",
    description: medicine.description ?? "",
    drugForm: medicine.drugForm ?? "",
    category: medicine.category ?? "Tablet",
    schedule: medicine.schedule ?? "None",
    therapeuticClass: medicine.therapeuticClass ?? "",
    pharmacologicalClass: medicine.pharmacologicalClass ?? "",
    atcCode: medicine.atcCode ?? "",
    dosage: medicine.dosage ?? "",
    routeOfAdministration: medicine.routeOfAdministration ?? "Oral",
    packaging: medicine.packaging ?? "",
    packSize: medicine.packSize ?? "",
    packUnit: medicine.packUnit ?? "",
    manufacturer: medicine.manufacturer ?? "",
    manufacturerAddress: medicine.manufacturerAddress ?? "",
    countryOfOrigin: medicine.countryOfOrigin ?? "India",
    isPrescriptionRequired: medicine.isPrescriptionRequired ?? true,
    narcoticLicenceRequired: medicine.narcoticLicenceRequired ?? false,
    gstPercentage: medicine.gstPercentage ?? 5,
    hsnCode: medicine.hsnCode?._id ?? medicine.hsnCode ?? "",
    referenceMrp: medicine.referenceMrp ?? "",
    ptr: medicine.ptr ?? "",
    pts: medicine.pts ?? "",
    indications: medicine.indications ?? [],
    contraindications: medicine.contraindications ?? [],
    sideEffects: medicine.sideEffects ?? [],
    interactions: medicine.interactions ?? [],
    warnings: medicine.warnings ?? [],
    saltComposition: medicine.saltComposition ?? [],
    storageConditions: medicine.storageConditions ?? BLANK_FORM.storageConditions,
    regulatoryInfo: medicine.regulatoryInfo ?? BLANK_FORM.regulatoryInfo,
    searchKeywords: medicine.searchKeywords ?? [],
    images: (medicine.images ?? []).map((img) => ({ ...img, previewUrl: img.url, uploaded: true })),
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === "edit" ? `Edit — ${medicine.brandName}` : medicine.brandName} wide>
      {mode === "view" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-5">
            {[
              ["Generic Name", medicine.genericName],
              ["Category", medicine.category],
              ["Dosage", medicine.dosage],
              ["Packaging", medicine.packaging],
              ["Manufacturer", medicine.manufacturer],
              ["Schedule", medicine.schedule],
              ["GST", `${medicine.gstPercentage ?? 5}%`],
              ["Ref. MRP", medicine.referenceMrp ? `₹${medicine.referenceMrp}` : "—"],
              ["PTR", medicine.ptr ? `₹${medicine.ptr}` : "—"],
              ["PTS", medicine.pts ? `₹${medicine.pts}` : "—"],
              ["HSN Code", medicine.hsnCode?.hsnCode ?? "—"],
              ["Rx Required", medicine.isPrescriptionRequired ? "Yes" : "No"],
              ["Narcotic Lic.", medicine.narcoticLicenceRequired ? "Yes" : "No"],
              ["Therapeutic", medicine.therapeuticClass ?? "—"],
              ["Pharmacological", medicine.pharmacologicalClass ?? "—"],
              ["ATC Code", medicine.atcCode ?? "—"],
              ["Route", medicine.routeOfAdministration ?? "—"],
              ["Status", medicine.isDiscontinued ? "Discontinued" : "Active"],
            ].map(([label, val]) => (
              <div key={label} className="bg-base-200 rounded-xl p-3">
                <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide mb-0.5">{label}</p>
                <p className="font-semibold text-base-content truncate text-sm">{val ?? "—"}</p>
              </div>
            ))}
          </div>

          {/* Images */}
          {medicine.images?.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Images</p>
              <div className="flex gap-2 flex-wrap">
                {medicine.images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.url} alt={img.altText || `Image ${i + 1}`} className="w-20 h-20 rounded-xl object-cover border border-base-300" />
                    {img.isPrimary && <span className="absolute top-1 left-1 badge badge-warning badge-xs">Primary</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Salt composition */}
          {medicine.saltComposition?.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Salt Composition</p>
              <div className="flex flex-wrap gap-2">
                {medicine.saltComposition.map((s, i) => (
                  <span key={i} className="badge badge-outline badge-sm py-2.5">
                    {s.ingredient} {s.strength}{s.unit ? ` ${s.unit}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Clinical arrays */}
          {["indications", "contraindications", "sideEffects", "warnings"].map((key) =>
            medicine[key]?.length > 0 ? (
              <div key={key} className="mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-1">
                  {key.replace(/([A-Z])/g, " $1")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {medicine[key].map((v, i) => (
                    <span key={i} className="badge badge-ghost badge-sm">{v}</span>
                  ))}
                </div>
              </div>
            ) : null
          )}

          {medicine.description && (
            <p className="text-sm text-base-content/60 mb-5 leading-relaxed border-l-2 border-primary/30 pl-3">
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
              title="Creates zero-stock inventory placeholders for stores missing this medicine."
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Sync Inventory
            </button>
            {!medicine.isDiscontinued && (
              <button onClick={() => setConfirmDisc(true)} className="btn btn-error btn-sm gap-2 ml-auto">
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
                    This marks <strong>{medicine.brandName}</strong> as discontinued, soft-deletes all store inventory records,
                    and sends compliance emails to all pharmacies. Irreversible from pharmacy portal.
                  </p>
                  <textarea
                    className="textarea textarea-bordered w-full text-sm mb-2"
                    rows={2}
                    placeholder="Reason for discontinuation…"
                    value={discReason}
                    onChange={(e) => setDiscReason(e.target.value)}
                  />
                  <FieldNote>Reason stored in audit log and sent in compliance emails.</FieldNote>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setConfirmDisc(false)} className="btn btn-ghost btn-sm">Cancel</button>
                    <button onClick={handleDisc} className="btn btn-error btn-sm" disabled={actionLoading}>
                      {actionLoading && <Loader2 size={14} className="animate-spin" />}
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
// § PAYLOAD BUILDER (handles images as base64 or file objects)
// ─────────────────────────────────────────────────────────────────────────────
function buildPayload(form) {
  // Strip previewUrl / file from images — send only url, altText, isPrimary for existing
  // For new (file) images, the parent route should handle FormData upload
  // Here we send clean catalogue data as JSON
  const images = (form.images || [])
    .filter((img) => img.uploaded || img.url) // only uploaded/existing
    .map(({ url, altText, isPrimary }) => ({ url, altText, isPrimary }));

  return {
    ...form,
    images,
    referenceMrp: form.referenceMrp ? Number(form.referenceMrp) : undefined,
    ptr: form.ptr ? Number(form.ptr) : undefined,
    pts: form.pts ? Number(form.pts) : undefined,
    packSize: form.packSize ? Number(form.packSize) : undefined,
    gstPercentage: Number(form.gstPercentage),
    hsnCode: form.hsnCode || undefined,
    slug: form.slug || undefined,
  };
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

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <SectionHeader icon={Layers} title="Medicine Catalogue" subtitle="Browse, view, edit or discontinue medicines." />

      <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            className="input input-field input-sm w-full pl-9"
            placeholder="Search brand or generic name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select input-field select-sm max-w-[160px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn btn-primary btn-sm gap-2"><Search size={14} /> Search</button>
        <button type="button" onClick={() => { setSearch(""); setCategory(""); load(1); }} className="btn btn-ghost btn-sm">
          <RefreshCw size={14} />
        </button>
      </form>

      <div className="bg-base-100 rounded-2xl border border-base-300 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : medicines.length === 0 ? (
          <EmptyState icon={Package} title="No medicines found" sub="Try a different search term or category filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
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
                  <motion.tr key={med._id} variants={fadeUp} custom={i} initial="hidden" animate="visible">
                    <td>
                      <div className="flex items-center gap-3">
                        {med.images?.find((img) => img.isPrimary)?.url || med.images?.[0]?.url ? (
                          <img
                            src={med.images.find((img) => img.isPrimary)?.url || med.images[0].url}
                            alt={med.brandName}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-base-300"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center flex-shrink-0 border border-base-300">
                            <Pill size={16} className="text-base-content/30" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate max-w-[150px]">{med.brandName}</p>
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
                        : <span className="badge badge-success badge-sm">Active</span>}
                    </td>
                    <td>
                      <button onClick={() => setSelected(med)} className="btn btn-ghost btn-xs gap-1">
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => load(page - 1)} className="btn btn-ghost btn-sm" disabled={page <= 1 || loading}>← Prev</button>
          <span className="text-sm text-base-content/60">Page {page} of {pagination.totalPages}</span>
          <button onClick={() => load(page + 1)} className="btn btn-ghost btn-sm" disabled={page >= pagination.totalPages || loading}>Next →</button>
        </div>
      )}

      <MedicineDetailModal open={!!selected} onClose={() => setSelected(null)} medicine={selected} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § ADD MEDICINE TAB
// ─────────────────────────────────────────────────────────────────────────────
function AddMedicineTab({ onSwitchToCatalogue }) {
  const dispatch = useDispatch();
  const actionLoading = useSelector(selectActionLoading);
  const [done, setDone] = useState(false);

  const handleCreate = async (form) => {
    // Build payload — strip local image file objects, keep only uploaded ones
    const payload = buildPayload(form);
    const res = await dispatch(createMedicine(payload));
    if (!res.error) {
      setDone(true);
      setTimeout(() => { setDone(false); onSwitchToCatalogue(); }, 2200);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <SectionHeader icon={Plus} title="Add New Medicine" subtitle="Create a catalogue entry. Stock details added separately via Inventory." />

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-success mb-5">
            <CheckCircle2 size={16} />
            <span className="text-sm">Medicine created! Redirecting to catalogue…</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-base-100 rounded-2xl border border-base-300 p-5">
        <div className="alert alert-info mb-5">
          <Info size={15} />
          <span className="text-xs">
            Creates a <strong>catalogue entry only</strong>. After creating, go to <strong>Inventory → Add Stock</strong> to add batches.
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
    icon: Layers, title: "Catalogue — What It Is",
    content: `Global product database containing:
• Name, brand, generic, dosage, packaging, route
• Schedule (H/H1/X = prescription; None = OTC)
• GST % and HSN code for tax computation
• Reference MRP — suggested; actual MRP set per-store in Inventory
• Salt composition, clinical info, storage conditions, regulatory IDs
• Product images with primary flag

Pharmacy: view all, edit metadata, add new, discontinue medicines.
Stock lives in Inventory section — not here.`,
  },
  {
    icon: Plus, title: "Adding a New Medicine",
    content: `Fill required fields (*) across 8 sections:

Identity: Name*, Brand*, Generic*, Manufacturer* — plus Description, Drug Form, Slug
Classification: Category*, Schedule, Therapeutic/Pharmacological Class, ATC Code, Salt Composition
Dosage & Route: Dosage*, Route, Packaging*, Pack Size/Unit
Clinical Info: Indications, Contraindications, Side Effects, Interactions, Warnings
Pricing & Tax: Ref MRP, PTR, PTS, GST %, HSN Code
Storage: Temperature range, Light/Moisture/Cold-chain flags
Regulatory IDs: CDSCO, State Licence, Import, FDA numbers
Images: Drag-drop product photos, set primary, add alt text

Click Create Medicine — system auto-creates zero-stock inventory placeholders for all stores.`,
  },
  {
    icon: Edit3, title: "Editing a Medicine",
    content: `Click View on any row → Edit Medicine.
• Only catalogue metadata editable here
• Stock quantity and batch changes → Inventory → Add/Deduct Stock
• Update Medicine to save
• Changes propagate immediately to all store inventory records`,
  },
  {
    icon: RotateCcw, title: "Sync Inventory",
    content: `Sync Inventory in the View modal:
• Creates zero-stock MedicineInventory placeholders for any store missing one
• Useful when a new store was added after this medicine was created
• Does NOT add physical stock — just the record`,
  },
  {
    icon: Trash2, title: "Discontinuing a Medicine",
    content: `Irreversible from pharmacy portal:
• Marks medicine isDiscontinued = true
• Soft-deletes all MedicineInventory records across all stores
• Sends compliance emails to all pharmacy accounts

Use ONLY for: recalls, regulatory withdrawal, replaced formulation.
Out of stock? Use Restock Request — not Discontinue.`,
  },
  {
    icon: Tag, title: "GST & HSN Codes",
    content: `Indian pharma GST rates:
  0%  — Life-saving drugs (insulin, etc.)
  5%  — Most medicines, APIs, Ayurvedic
  12% — Patent-protected drugs
  18% — Cosmetic OTC products
  28% — Rarely applicable to pharma

HSN: 4-8 digit code under Harmonised System.
Upload via Admin → HSN Upload before they appear in dropdown.
Selecting HSN auto-fills CGST/SGST/IGST on invoices.`,
  },
];

function HelpTab() {
  const [open, setOpen] = useState(null);
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <SectionHeader icon={BookOpen} title="Help & Guide" subtitle="Learn how to manage the medicine catalogue effectively." />
      <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
        <Zap size={18} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">Quick Start</p>
          <p className="text-xs text-base-content/60 mt-1">
            Browse in <strong>Catalogue</strong>. Click <strong>Add Medicine</strong> to create. Click <strong>View</strong> to edit or discontinue.
            URL <code>/new</code> opens Add tab directly.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {HELP_SECTIONS.map((section, i) => {
          const Icon = section.icon;
          const isOpen = open === i;
          return (
            <div key={i} className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex items-center justify-between w-full p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0"><Icon size={16} /></div>
                  <span className="font-semibold text-sm">{section.title}</span>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-base-content/40 flex-shrink-0" /> : <ChevronDown size={16} className="text-base-content/40 flex-shrink-0" />}
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 border-t border-base-300">
                      <pre className="text-xs text-base-content/70 leading-relaxed whitespace-pre-wrap mt-3" style={{ fontFamily: "inherit" }}>
                        {section.content}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
  const router = useRouter();
  const pathname = usePathname();
  // params.tab comes from catch-all route: app/pharmacy-store/medicines-management/[[...tab]]/page.jsx
  // e.g. /medicines-management/new  →  params.tab = ["new"]
  const params = useParams();

  const error = useSelector(selectMedicineError);
  const actionError = useSelector(selectActionError);
  const successMessage = useSelector(selectSuccessMessage);

  // Map URL segment to internal tab id
  const urlToTab = { new: "add", add: "add", help: "help", catalogue: "catalogue" };
  const segFromParams = Array.isArray(params?.tab) ? params.tab[0] : (params?.tab ?? "");
  const [activeTab, setActiveTab] = useState(urlToTab[segFromParams] ?? "catalogue");

  const switchTab = (id) => {
    setActiveTab(id);
    const segMap = { add: "new", catalogue: "catalogue", help: "help" };
    router.replace(`/pharmacy-store/medicines-management/${segMap[id]}`);
  };

  useEffect(() => {
    // Sync tab when URL changes (browser back/forward)
    const seg = pathname.split("/").pop();
    const mapped = urlToTab[seg] ?? "catalogue";
    if (mapped !== activeTab) setActiveTab(mapped);
  }, [pathname]);

  useEffect(() => {
    dispatch(fetchHsnCodes({ isActive: "true", limit: 200 }));
  }, [dispatch]);

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

      {/* Toasts */}
      <AnimatePresence>
        {successMessage && <Toast key="s" message={successMessage} type="success" onClose={() => dispatch(clearSuccessMessage())} />}
        {(actionError || error) && <Toast key="e" message={actionError ?? error} type="error" onClose={() => dispatch(clearMedicineError())} />}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Page header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6">
          <div className="flex items-center gap-2 text-xs text-base-content/40 mb-2">
            <span>Pharmacy</span>
            <ChevronRight size={12} />
            <span className="text-base-content/60">Medicines</span>
          </div>
          <h1 className="text-2xl font-extrabold text-base-content">Medicine Management</h1>
          <p className="text-sm text-base-content/50 mt-1">Add, edit, and manage the medicine catalogue for your pharmacy.</p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                  active ? "bg-primary text-primary-content shadow-md" : "text-base-content/60 hover:bg-base-200"
                }`}
              >
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} variants={slideIn} initial="hidden" animate="visible" exit={{ opacity: 0, x: 12 }}>
            {activeTab === "catalogue" && <CatalogueTab />}
            {activeTab === "add" && <AddMedicineTab onSwitchToCatalogue={() => switchTab("catalogue")} />}
            {activeTab === "help" && <HelpTab />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}