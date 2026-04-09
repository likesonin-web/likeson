'use client';

/**
 * MedicinesManagement.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full admin / superadmin Medicines & HSN Management page.
 *
 * Covers ALL thunks from medicineSlice:
 *   Medicine : fetchMedicines, fetchInventoryStats, sendRestockRequest,
 *              fetchMedicineBySlug, createMedicine, updateMedicine,
 *              updateStock, discontinueMedicine
 *   HSN      : fetchHsnCodes, fetchHsnStats, fetchHsnByCode,
 *              createHsnCode, uploadHsnFile, bulkDeleteHsnCodes,
 *              updateHsnCode, deleteHsnCode
 *
 * Stack: Next.js · Tailwind CSS · Lucide · Framer Motion · Recharts
 * Theme: data-theme="pharmacy" CSS variables from globals.css
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  Pill, Tag, UploadCloud, Plus, Search, Filter, Grid3X3, List,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, Pencil,
  Trash2, PackageSearch, AlertTriangle, CheckCircle2, XCircle,
  BarChart2, RefreshCw, Download, FileSpreadsheet, X, Info,
  Layers, ShieldCheck, TrendingUp, Package, AlertOctagon,
  Clock, ToggleLeft, ToggleRight, Loader2, Building2, Stethoscope,
} from 'lucide-react';

// ── Redux thunks ──────────────────────────────────────────────────────────────
import {
  fetchMedicines, fetchInventoryStats, sendRestockRequest,
  fetchMedicineBySlug, createMedicine, updateMedicine,
  updateStock, discontinueMedicine,
  fetchHsnCodes, fetchHsnStats, fetchHsnByCode,
  createHsnCode, uploadHsnFile, bulkDeleteHsnCodes,
  updateHsnCode, deleteHsnCode,
  resetCurrentMedicine, resetCurrentHsnCode, clearHsnUploadResult,
  clearMedicineError,
} from '@/store/slices/medicineSlice';

// ── Selectors ─────────────────────────────────────────────────────────────────
import {
  selectAllMedicines, selectCurrentMedicine, selectMedicineStats,
  selectMedicineLoading, selectMedicineDetailLoading, selectMedicineActionLoading,
  selectMedicinePagination, selectMedicineError,
  selectAllHsnCodes, selectCurrentHsnCode, selectHsnStats,
  selectHsnPagination, selectHsnUploadResult, selectHsnLoading,
} from '@/store/slices/medicineSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const GST_SLABS      = [0, 5, 12, 18, 28];
const SCHEDULES      = ['H', 'H1', 'X', 'G', 'J', 'C', 'C1', 'None'];
const CATEGORIES     = [
  'Tablet','Capsule','Syrup','Suspension','Solution','Injection','Infusion',
  'Ointment','Cream','Gel','Lotion','Drops','Inhaler','Nasal Spray','Patch',
  'Suppository','Powder','Granules','Lozenge','Implant','Others',
];
const SORT_OPTIONS   = [
  { value: 'newest',     label: 'Newest first'  },
  { value: 'price_low',  label: 'Price: Low → High' },
  { value: 'price_high', label: 'Price: High → Low' },
  { value: 'name_asc',   label: 'Name A → Z'    },
];
const HSN_SORT_OPTIONS = [
  { value: 'hsnCode',      label: 'Code ↑' },
  { value: 'hsnCode_desc', label: 'Code ↓' },
  { value: 'gst_asc',      label: 'GST ↑'  },
  { value: 'gst_desc',     label: 'GST ↓'  },
  { value: 'newest',       label: 'Newest' },
];

// Chart palette — uses pharmacy theme colours
const CHART_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };
const fadeIn  = { hidden: { opacity: 0 },         visible: { opacity: 1 }       };
const stagger = { visible: { transition: { staggerChildren: 0.07 } }            };
const scaleIn = { hidden: { opacity: 0, scale: 0.93 }, visible: { opacity: 1, scale: 1 } };

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const FieldNote = ({ children }) => (
  <p className="mt-1 text-[11px] text-base-content/50 leading-tight">{children}</p>
);

const FormField = ({ label, note, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-xs font-semibold text-base-content/80 uppercase tracking-wider">
      {label}{required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

const Input = ({ className = '', ...props }) => (
  <input
    className={`input-field w-full text-sm ${className}`}
    {...props}
  />
);

const Select = ({ className = '', children, ...props }) => (
  <select className={`input-field w-full text-sm ${className}`} {...props}>
    {children}
  </select>
);

const Textarea = ({ className = '', ...props }) => (
  <textarea
    rows={3}
    className={`input-field w-full text-sm resize-none ${className}`}
    {...props}
  />
);

const Btn = ({ variant = 'primary', size = 'md', className = '', loading, children, ...props }) => {
  const base   = 'inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes  = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const vars   = {
    primary:  'bg-primary text-primary-content hover:brightness-110 shadow-sm hover:shadow-md',
    secondary:'border-2 border-primary text-primary hover:bg-primary hover:text-primary-content',
    danger:   'bg-error text-error-content hover:brightness-110',
    ghost:    'text-base-content/70 hover:bg-base-200',
    success:  'bg-success text-success-content hover:brightness-110',
  };
  return (
    <button className={`${base} ${sizes[size]} ${vars[variant]} ${className}`} disabled={loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Badge = ({ color = 'primary', children }) => {
  const colors = {
    primary: 'bg-primary/10 text-primary border border-primary/20',
    success: 'bg-success/10 text-success border border-success/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
    error:   'bg-error/10   text-error   border border-error/20',
    info:    'bg-info/10    text-info     border border-info/20',
    neutral: 'bg-base-300   text-base-content/70',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[color]}`}>
      {children}
    </span>
  );
};

const Modal = ({ open, onClose, title, children, wide }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className={`relative bg-base-100 rounded-2xl shadow-2xl border border-base-300 w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto`}
          variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <div className="flex items-center justify-between p-5 border-b border-base-300">
            <h3 className="text-base font-extrabold text-base-content tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/50 hover:text-base-content transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 bg-base-200 p-1 rounded-xl w-fit">
    {tabs.map(t => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
          active === t.value
            ? 'bg-base-100 text-primary shadow-sm'
            : 'text-base-content/60 hover:text-base-content'
        }`}
      >
        {t.icon && <t.icon className="w-3.5 h-3.5" />}
        {t.label}
      </button>
    ))}
  </div>
);

const Pagination = ({ page, totalPages, onChange }) => (
  <div className="flex items-center gap-2">
    <Btn variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
      <ChevronLeft className="w-4 h-4" />
    </Btn>
    <span className="text-xs font-semibold text-base-content/60 px-2">
      Page {page} / {totalPages}
    </span>
    <Btn variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
      <ChevronRight className="w-4 h-4" />
    </Btn>
  </div>
);

const StatCard = ({ icon: Icon, label, value, color = 'primary', sublabel }) => (
  <motion.div variants={fadeUp} className="card p-5 flex items-start gap-4">
    <div className={`p-3 rounded-xl bg-${color}/10`}>
      <Icon className={`w-5 h-5 text-${color}`} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">{label}</p>
      <p className="text-2xl font-extrabold text-base-content mt-0.5">{value ?? '—'}</p>
      {sublabel && <p className="text-[10px] text-base-content/40 mt-0.5">{sublabel}</p>}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE FORM (Create / Edit)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MED = {
  name: '', brandName: '', genericName: '', description: '',
  category: 'Tablet', dosage: '', schedule: 'None', mrp: '',
  packaging: '', manufacturer: '', isPrescriptionRequired: true,
  hsnCodeStr: '', gstPercentage: 5, storeId: '',
  initialStock: '', batchNumber: '', expiryDate: '', pricePerUnit: '',
};

const MedicineForm = ({ initial, onSubmit, loading, onHsnLookup, hsnData, hsnLookupLoading }) => {
  const [form, setForm] = useState({ ...DEFAULT_MED, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setV = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // When HSN data arrives, auto-fill gstPercentage
  useEffect(() => {
    if (hsnData) setV('gstPercentage', hsnData.gstPercentage);
  }, [hsnData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name, brandName: form.brandName, genericName: form.genericName,
      description: form.description, category: form.category, dosage: form.dosage,
      schedule: form.schedule, mrp: Number(form.mrp), packaging: form.packaging,
      manufacturer: form.manufacturer,
      isPrescriptionRequired: form.isPrescriptionRequired,
      gstPercentage: Number(form.gstPercentage),
    };
    if (form.storeId) {
      payload.storeId      = form.storeId;
      payload.initialStock = Number(form.initialStock) || 0;
      payload.batchNumber  = form.batchNumber || 'INIT-BATCH';
      payload.expiryDate   = form.expiryDate  || undefined;
      payload.pricePerUnit = Number(form.pricePerUnit) || Number(form.mrp);
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic info */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70 border-b border-base-200 pb-1">
        Basic Information
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Medicine Name" required note="Full product name as on label (e.g. Dolo 650)">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Dolo 650" required />
        </FormField>
        <FormField label="Brand Name" required note="Manufacturer's commercial brand name">
          <Input value={form.brandName} onChange={set('brandName')} placeholder="e.g. Dolo" required />
        </FormField>
        <FormField label="Generic Name" required note="INN / active pharmaceutical ingredient name">
          <Input value={form.genericName} onChange={set('genericName')} placeholder="e.g. Paracetamol" required />
        </FormField>
        <FormField label="Dosage" required note="Strength per unit (e.g. 500mg, 5mg/ml)">
          <Input value={form.dosage} onChange={set('dosage')} placeholder="e.g. 500mg" required />
        </FormField>
        <FormField label="Category" required note="Dosage form / product type">
          <Select value={form.category} onChange={set('category')} required>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Schedule" note="India Drugs & Cosmetics Act schedule (H, H1, X, etc.)">
          <Select value={form.schedule} onChange={set('schedule')}>
            {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </FormField>
        <FormField label="Manufacturer" required note="Name of the manufacturing company">
          <Input value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Cipla Ltd." required />
        </FormField>
        <FormField label="Packaging" required note="Pack description (e.g. Strip of 10 Tablets)">
          <Input value={form.packaging} onChange={set('packaging')} placeholder="Strip of 10 Tablets" required />
        </FormField>
        <FormField label="MRP (₹)" required note="Maximum Retail Price inclusive of GST">
          <Input type="number" min={0} step={0.01} value={form.mrp} onChange={set('mrp')} placeholder="0.00" required />
        </FormField>
        <FormField label="Prescription Required" note="Toggle if medicine requires a valid Rx">
          <div className="flex items-center gap-3 mt-1">
            <button type="button" onClick={() => setV('isPrescriptionRequired', !form.isPrescriptionRequired)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                form.isPrescriptionRequired
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-base-300 bg-base-200 text-base-content/50'
              }`}>
              {form.isPrescriptionRequired ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {form.isPrescriptionRequired ? 'Yes — Rx Required' : 'No — OTC'}
            </button>
          </div>
        </FormField>
      </div>

      <FormField label="Description" note="Brief clinical summary or usage notes (optional)">
        <Textarea value={form.description} onChange={set('description')} placeholder="Short description…" />
      </FormField>

      {/* HSN / GST */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70 border-b border-base-200 pb-1 mt-2">
        HSN / GST (Auto-fill)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <FormField label="HSN Code" note="Enter 4–8 digit code; GST auto-fills on lookup" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input value={form.hsnCodeStr} onChange={set('hsnCodeStr')} placeholder="e.g. 3004" maxLength={8} />
            <Btn type="button" variant="secondary" size="sm" loading={hsnLookupLoading}
              onClick={() => form.hsnCodeStr && onHsnLookup(form.hsnCodeStr)}>
              <Search className="w-3.5 h-3.5" /> Lookup
            </Btn>
          </div>
        </FormField>
        <FormField label="GST %" note="Auto-filled from HSN lookup; editable if needed">
          <Select value={form.gstPercentage} onChange={set('gstPercentage')}>
            {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
          </Select>
        </FormField>
      </div>
      {hsnData && (
        <div className="flex items-center gap-2 text-[11px] text-success bg-success/5 border border-success/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span><strong>{hsnData.hsnCode}</strong> — {hsnData.description} · GST: <strong>{hsnData.gstPercentage}%</strong></span>
        </div>
      )}

      {/* Inventory Bootstrap */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70 border-b border-base-200 pb-1 mt-2">
        Initial Inventory (Optional)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Store ID" note="MongoDB ObjectId of target PharmacyStore; leave blank for catalogue-only">
          <Input value={form.storeId} onChange={set('storeId')} placeholder="64f1a2b3c4d5e6f7a8b9c0d1" />
        </FormField>
        <FormField label="Initial Stock" note="Opening quantity for this store (units)">
          <Input type="number" min={0} value={form.initialStock} onChange={set('initialStock')} placeholder="0" />
        </FormField>
        <FormField label="Batch Number" note="Manufacturer batch / lot number on packaging">
          <Input value={form.batchNumber} onChange={set('batchNumber')} placeholder="BATCH-001" />
        </FormField>
        <FormField label="Expiry Date" note="Expiry date printed on the batch packaging">
          <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} />
        </FormField>
        <FormField label="Price per Unit (₹)" note="Store-specific selling price; defaults to MRP if blank">
          <Input type="number" min={0} step={0.01} value={form.pricePerUnit} onChange={set('pricePerUnit')} placeholder="0.00" />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Btn type="submit" variant="primary" loading={loading}>
          <Plus className="w-4 h-4" /> {initial ? 'Save Changes' : 'Create Medicine'}
        </Btn>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STOCK FORM
// ─────────────────────────────────────────────────────────────────────────────
const UpdateStockForm = ({ medicineId, onSubmit, loading }) => {
  const [form, setForm] = useState({ storeId: '', quantity: '', expiryDate: '', batchNumber: '', pricePerUnit: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(medicineId, {
      storeId:     form.storeId,
      quantity:    Number(form.quantity),
      expiryDate:  form.expiryDate || undefined,
      batchNumber: form.batchNumber || undefined,
      pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : undefined,
    });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Store ID" required note="Target PharmacyStore ObjectId to update stock for">
          <Input value={form.storeId} onChange={set('storeId')} placeholder="64f1a2b3c4d5e6f7a8b9c0d1" required />
        </FormField>
        <FormField label="New Quantity" required note="Absolute stock level after adjustment (not a delta)">
          <Input type="number" min={0} value={form.quantity} onChange={set('quantity')} placeholder="100" required />
        </FormField>
        <FormField label="Batch Number" note="Update batch if receiving new stock shipment">
          <Input value={form.batchNumber} onChange={set('batchNumber')} placeholder="BATCH-002" />
        </FormField>
        <FormField label="Expiry Date" note="New expiry date for this batch (overwrites previous)">
          <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} />
        </FormField>
        <FormField label="Price per Unit (₹)" note="Override store-level price for this restock">
          <Input type="number" min={0} step={0.01} value={form.pricePerUnit} onChange={set('pricePerUnit')} placeholder="0.00" />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Btn type="submit" variant="success" loading={loading}>
          <Package className="w-4 h-4" /> Update Stock
        </Btn>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HSN FORM (Create / Edit)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_HSN = { hsnCode: '', description: '', chapterHeading: '', gstPercentage: 5 };

const HsnForm = ({ initial, onSubmit, loading }) => {
  const [form, setForm] = useState({ ...DEFAULT_HSN, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, gstPercentage: Number(form.gstPercentage) });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="HSN Code" required note="4–8 digit numeric code from Indian Customs Tariff; uppercase, no spaces">
          <Input value={form.hsnCode} onChange={set('hsnCode')} placeholder="e.g. 3004" maxLength={8} required disabled={!!initial} />
        </FormField>
        <FormField label="GST %" required note="Valid Indian GST slab: 0, 5, 12, 18 or 28 only">
          <Select value={form.gstPercentage} onChange={set('gstPercentage')} required>
            {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
          </Select>
        </FormField>
        <FormField label="Chapter Heading" note="Optional: e.g. Chapter 30 – Pharmaceutical Products" className="sm:col-span-2">
          <Input value={form.chapterHeading} onChange={set('chapterHeading')} placeholder="Chapter 30 – Pharmaceutical Products" />
        </FormField>
        <FormField label="Description" required note="Product description matching the HSN schedule; be precise for audit compliance" className="sm:col-span-2">
          <Textarea value={form.description} onChange={set('description')} placeholder="Medicaments for retail sale…" required />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Btn type="submit" variant="primary" loading={loading}>
          <Plus className="w-4 h-4" /> {initial ? 'Update HSN' : 'Create HSN'}
        </Btn>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HSN UPLOAD PANEL
// ─────────────────────────────────────────────────────────────────────────────
const HsnUploadPanel = ({ onUpload, loading, uploadResult, onClearResult }) => {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f) setFile(f);
  };
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };
  const handleSubmit = () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    onUpload(fd);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50 hover:bg-base-200/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-primary' : 'text-base-content/30'}`} />
        <p className="text-sm font-semibold text-base-content/70">
          {file ? file.name : 'Drop your Excel / PDF here, or click to browse'}
        </p>
        <p className="text-[11px] text-base-content/40 mt-1">
          Supported: .xlsx, .xls, .csv, .pdf · Max 20 MB
        </p>
        <p className="text-[11px] text-base-content/40 mt-0.5">
          File is archived to ImageKit for permanent audit trail before any DB write.
        </p>
        <input ref={inputRef} type="file" className="hidden"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      {file && (
        <div className="flex items-center gap-3 p-3 bg-base-200 rounded-xl">
          <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{file.name}</p>
            <p className="text-[10px] text-base-content/40">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
            <X className="w-3.5 h-3.5" />
          </Btn>
        </div>
      )}

      <Btn variant="primary" loading={loading} disabled={!file || loading} onClick={handleSubmit} className="w-full">
        <UploadCloud className="w-4 h-4" /> Upload & Bulk-Upsert HSN Codes
      </Btn>

      {uploadResult && (
        <motion.div className="bg-base-200 rounded-xl p-4 space-y-3" variants={fadeIn} initial="hidden" animate="visible">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-base-content">Upload Result</p>
            <button onClick={onClearResult} className="text-base-content/40 hover:text-base-content"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Rows', value: uploadResult.result?.totalRows, color: 'info'    },
              { label: 'Inserted',   value: uploadResult.result?.inserted,   color: 'success' },
              { label: 'Updated',    value: uploadResult.result?.updated,    color: 'warning' },
              { label: 'Skipped',    value: uploadResult.result?.skipped,    color: 'error'   },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-base-100 rounded-lg p-2">
                <p className={`text-lg font-extrabold text-${color}`}>{value ?? 0}</p>
                <p className="text-[10px] text-base-content/50 font-semibold uppercase">{label}</p>
              </div>
            ))}
          </div>
          {uploadResult.upload?.imagekitUrl && (
            <a href={uploadResult.upload.imagekitUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-primary hover:underline">
              <Download className="w-3 h-3" /> View archived file on ImageKit
            </a>
          )}
          {uploadResult.result?.errors?.length > 0 && (
            <details className="text-[11px] text-error">
              <summary className="cursor-pointer font-semibold">
                {uploadResult.result.errorCount} row-level errors — expand to view
              </summary>
              <ul className="mt-2 space-y-0.5 list-disc list-inside text-error/80">
                {uploadResult.result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </motion.div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE CARD (Grid view)
// ─────────────────────────────────────────────────────────────────────────────
const MedicineCard = ({ med, onEdit, onStock, onDiscontinue, onView, actionLoading }) => (
  <motion.div variants={fadeUp} className="card p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-extrabold truncate text-base-content">{med.brandName}</p>
        <p className="text-[11px] text-base-content/50 truncate">{med.genericName} · {med.dosage}</p>
      </div>
      <Badge color={med.isDiscontinued ? 'error' : 'success'}>
        {med.isDiscontinued ? 'Discontinued' : 'Active'}
      </Badge>
    </div>
    <div className="flex flex-wrap gap-1.5">
      <Badge color="info">{med.category}</Badge>
      <Badge color="neutral">{med.schedule}</Badge>
      {med.isPrescriptionRequired && <Badge color="warning">Rx</Badge>}
    </div>
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <div className="bg-base-200 rounded-lg p-2">
        <p className="text-base-content/40 font-semibold uppercase">MRP</p>
        <p className="font-bold text-base-content">₹{med.mrp}</p>
      </div>
      <div className="bg-base-200 rounded-lg p-2">
        <p className="text-base-content/40 font-semibold uppercase">GST</p>
        <p className="font-bold text-base-content">{med.gstPercentage ?? '—'}%</p>
      </div>
    </div>
    <div className="flex gap-2 mt-auto flex-wrap">
      <Btn variant="ghost" size="sm" onClick={() => onView(med.slug)} className="flex-1"><Eye className="w-3.5 h-3.5" /> View</Btn>
      <Btn variant="ghost" size="sm" onClick={() => onEdit(med)} className="flex-1"><Pencil className="w-3.5 h-3.5" /> Edit</Btn>
      <Btn variant="ghost" size="sm" onClick={() => onStock(med._id)}><Package className="w-3.5 h-3.5" /></Btn>
      {!med.isDiscontinued && (
        <Btn variant="ghost" size="sm" onClick={() => onDiscontinue(med._id)} loading={actionLoading}>
          <Trash2 className="w-3.5 h-3.5 text-error" />
        </Btn>
      )}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE ROW (List view)
// ─────────────────────────────────────────────────────────────────────────────
const MedicineRow = ({ med, onEdit, onStock, onDiscontinue, actionLoading }) => (
  <motion.tr variants={fadeIn} className="border-b border-base-200 hover:bg-base-200/50 transition-colors text-sm">
    <td className="py-3 px-4">
      <div>
        <p className="font-bold text-base-content">{med.brandName}</p>
        <p className="text-[11px] text-base-content/50">{med.genericName}</p>
      </div>
    </td>
    <td className="py-3 px-4 text-base-content/70">{med.category}</td>
    <td className="py-3 px-4 text-base-content/70">{med.dosage}</td>
    <td className="py-3 px-4 font-semibold">₹{med.mrp}</td>
    <td className="py-3 px-4">
      <Badge color={med.isDiscontinued ? 'error' : 'success'}>
        {med.isDiscontinued ? 'Disc.' : 'Active'}
      </Badge>
    </td>
    <td className="py-3 px-4">
      <div className="flex items-center gap-1.5">
        <Btn variant="ghost" size="sm" onClick={() => onEdit(med)}><Pencil className="w-3.5 h-3.5" /></Btn>
        <Btn variant="ghost" size="sm" onClick={() => onStock(med._id)}><Package className="w-3.5 h-3.5" /></Btn>
        {!med.isDiscontinued && (
          <Btn variant="ghost" size="sm" onClick={() => onDiscontinue(med._id)} loading={actionLoading}>
            <Trash2 className="w-3.5 h-3.5 text-error" />
          </Btn>
        )}
      </div>
    </td>
  </motion.tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// HSN ROW
// ─────────────────────────────────────────────────────────────────────────────
const HsnRow = ({ hsn, onEdit, onDelete, actionLoading, selected, onSelect }) => (
  <motion.tr variants={fadeIn} className="border-b border-base-200 hover:bg-base-200/50 transition-colors text-sm">
    <td className="py-3 px-4">
      <input type="checkbox" checked={selected} onChange={onSelect}
        className="rounded border-base-300 text-primary focus:ring-primary" />
    </td>
    <td className="py-3 px-4 font-mono font-bold text-primary">{hsn.hsnCode}</td>
    <td className="py-3 px-4 text-base-content/80 max-w-[280px] truncate">{hsn.description}</td>
    <td className="py-3 px-4">
      <Badge color={hsn.gstPercentage === 0 ? 'success' : hsn.gstPercentage <= 5 ? 'info' : 'warning'}>
        {hsn.gstPercentage}%
      </Badge>
    </td>
    <td className="py-3 px-4">
      <Badge color={hsn.isActive ? 'success' : 'error'}>{hsn.isActive ? 'Active' : 'Inactive'}</Badge>
    </td>
    <td className="py-3 px-4 text-base-content/50 text-xs">{hsn.uploadSource}</td>
    <td className="py-3 px-4">
      <div className="flex items-center gap-1.5">
        <Btn variant="ghost" size="sm" onClick={() => onEdit(hsn)} disabled={!hsn.isActive}><Pencil className="w-3.5 h-3.5" /></Btn>
        {hsn.isActive && (
          <Btn variant="ghost" size="sm" onClick={() => onDelete(hsn.hsnCode)} loading={actionLoading}>
            <Trash2 className="w-3.5 h-3.5 text-error" />
          </Btn>
        )}
      </div>
    </td>
  </motion.tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS TAB
// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsTab = ({ stats, hsnStats }) => {
  const categoryData = (stats.categoryDistribution || []).map(c => ({
    name: c._id || 'Unknown',
    count: c.count,
    avgPrice: Math.round(c.avgPrice || 0),
  }));
  const gstData = (hsnStats.gstDistribution || []).map(g => ({
    name: `${g._id}%`,
    value: g.count,
  }));
  const sourceData = (hsnStats.sourceBreakdown || []).map(s => ({
    name: s._id || 'Unknown',
    value: s.count,
  }));

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="visible">
      {/* Stat Strip */}
      <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" variants={stagger}>
        <StatCard icon={Package}       label="Total Stock"       value={stats.totalStock?.toLocaleString()} color="primary" sublabel="Units across all stores" />
        <StatCard icon={AlertTriangle} label="Low Stock Alerts"  value={stats.lowStockAlerts}  color="warning" sublabel="Items below reorder level" />
        <StatCard icon={Clock}         label="Expiry Alerts"     value={stats.expiryAlerts}    color="error"   sublabel="Expiring within 30 days" />
        <StatCard icon={XCircle}       label="Discontinued"      value={stats.discontinuedCount} color="neutral" sublabel="Products withdrawn" />
        <StatCard icon={Tag}           label="HSN Codes"         value={hsnStats.total}        color="info"    sublabel="Active in registry" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category distribution */}
        <motion.div className="card p-5" variants={fadeUp}>
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-4">
            Medicine Category Distribution
          </p>
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData.slice(0, 8)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-base-content/30 text-sm">No data yet</div>
          )}
        </motion.div>

        {/* GST Distribution */}
        <motion.div className="card p-5" variants={fadeUp}>
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-4">
            HSN GST Slab Distribution
          </p>
          {gstData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={gstData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="value" nameKey="name" paddingAngle={3}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}>
                  {gstData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 11 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-base-content/30 text-sm">No HSN data yet</div>
          )}
        </motion.div>

        {/* Source Breakdown */}
        <motion.div className="card p-5" variants={fadeUp}>
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-4">
            HSN Upload Source Breakdown
          </p>
          {sourceData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)' }} width={60} />
                <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill="var(--secondary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-base-content/30 text-sm">No source data yet</div>
          )}
        </motion.div>

        {/* Active vs Inactive */}
        <motion.div className="card p-5" variants={fadeUp}>
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-4">
            HSN Active vs Inactive
          </p>
          {hsnStats.activeVsInactive?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={hsnStats.activeVsInactive.map(a => ({ name: a._id ? 'Active' : 'Inactive', value: a.count }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                  <Cell fill="var(--success)" />
                  <Cell fill="var(--error)" />
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 11 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-base-content/30 text-sm">No HSN data yet</div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function MedicinesManagement() {
  const dispatch = useDispatch();

  // ── Selectors ────────────────────────────────────────────────────────────
  const medicines       = useSelector(selectAllMedicines);
  const currentMedicine = useSelector(selectCurrentMedicine);
  const stats           = useSelector(selectMedicineStats);
  const loading         = useSelector(selectMedicineLoading);
  const detailLoading   = useSelector(selectMedicineDetailLoading);
  const actionLoading   = useSelector(selectMedicineActionLoading);
  const medPagination   = useSelector(selectMedicinePagination);
  const error           = useSelector(selectMedicineError);

  const hsnCodes       = useSelector(selectAllHsnCodes);
  const currentHsn     = useSelector(selectCurrentHsnCode);
  const hsnStats       = useSelector(selectHsnStats);
  const hsnPagination  = useSelector(selectHsnPagination);
  const uploadResult   = useSelector(selectHsnUploadResult);
  const hsnLoading     = useSelector(selectHsnLoading);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState('medicines');
  const [viewMode,   setViewMode]   = useState('grid');   // 'grid' | 'list'

  // Medicine filters
  const [medSearch,   setMedSearch]   = useState('');
  const [medCategory, setMedCategory] = useState('');
  const [medSchedule, setMedSchedule] = useState('');
  const [medSort,     setMedSort]     = useState('newest');
  const [medPage,     setMedPage]     = useState(1);

  // HSN filters
  const [hsnSearch,  setHsnSearch]  = useState('');
  const [hsnGst,     setHsnGst]     = useState('');
  const [hsnSort,    setHsnSort]    = useState('hsnCode');
  const [hsnActive,  setHsnActive]  = useState('true');
  const [hsnPage,    setHsnPage]    = useState(1);

  // Modals
  const [showCreateMed,  setShowCreateMed]  = useState(false);
  const [showEditMed,    setShowEditMed]    = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCreateHsn,  setShowCreateHsn]  = useState(false);
  const [showEditHsn,    setShowEditHsn]    = useState(false);
  const [showUploadHsn,  setShowUploadHsn]  = useState(false);
  const [showDetailMed,  setShowDetailMed]  = useState(false);
  const [showRestockModal,setShowRestockModal] = useState(false);

  const [editMedData,    setEditMedData]    = useState(null);
  const [editHsnData,    setEditHsnData]    = useState(null);
  const [stockMedId,     setStockMedId]     = useState(null);
  const [restockMedId,   setRestockMedId]   = useState(null);
  const [selectedHsnCodes, setSelectedHsnCodes] = useState([]);

  // Restock
  const [restockQty, setRestockQty] = useState('');

  // ── Initial loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchInventoryStats());
    dispatch(fetchHsnStats());
  }, [dispatch]);

  // ── Medicine search/page effect ───────────────────────────────────────────
  useEffect(() => {
    const params = { page: medPage, limit: 12, sort: medSort };
    if (medSearch)   params.search   = medSearch;
    if (medCategory) params.category = medCategory;
    if (medSchedule) params.schedule = medSchedule;
    dispatch(fetchMedicines(params));
  }, [dispatch, medPage, medSort, medSearch, medCategory, medSchedule]);

  // ── HSN search/page effect ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'hsn' && activeTab !== 'analytics') return;
    const params = { page: hsnPage, limit: 20, sort: hsnSort, isActive: hsnActive };
    if (hsnSearch) params.search = hsnSearch;
    if (hsnGst)    params.gst    = hsnGst;
    dispatch(fetchHsnCodes(params));
  }, [dispatch, activeTab, hsnPage, hsnSort, hsnSearch, hsnGst, hsnActive]);

  // ── Handlers — Medicine ───────────────────────────────────────────────────
  const handleCreateMed = (data) => {
    dispatch(createMedicine(data)).unwrap()
      .then(() => setShowCreateMed(false))
      .catch(() => {});
  };

  const handleEditMed = (data) => {
    dispatch(updateMedicine({ id: editMedData._id, updateData: data })).unwrap()
      .then(() => { setShowEditMed(false); setEditMedData(null); })
      .catch(() => {});
  };

  const handleViewMed = (slug) => {
    dispatch(fetchMedicineBySlug(slug));
    setShowDetailMed(true);
  };

  const handleUpdateStock = (id, stockData) => {
    dispatch(updateStock({ id, stockData })).unwrap()
      .then(() => { setShowStockModal(false); setStockMedId(null); })
      .catch(() => {});
  };

  const handleDiscontinue = (id) => {
    if (!confirm('Discontinue this medicine? All pharmacies will be notified by email.')) return;
    dispatch(discontinueMedicine(id));
  };

  const handleRestock = (e) => {
    e.preventDefault();
    if (!restockMedId || !restockQty) return;
    dispatch(sendRestockRequest({ medicineId: restockMedId, quantityRequired: Number(restockQty) })).unwrap()
      .then(() => { setShowRestockModal(false); setRestockQty(''); });
  };

  const handleHsnLookup = (code) => {
    dispatch(fetchHsnByCode(code));
  };

  // ── Handlers — HSN ───────────────────────────────────────────────────────
  const handleCreateHsn = (data) => {
    dispatch(createHsnCode(data)).unwrap()
      .then(() => { setShowCreateHsn(false); dispatch(fetchHsnCodes({ page: hsnPage })); })
      .catch(() => {});
  };

  const handleEditHsn = (data) => {
    dispatch(updateHsnCode({ code: editHsnData.hsnCode, updateData: data })).unwrap()
      .then(() => { setShowEditHsn(false); setEditHsnData(null); })
      .catch(() => {});
  };

  const handleDeleteHsn = (code) => {
    if (!confirm(`Deactivate HSN code ${code}?`)) return;
    dispatch(deleteHsnCode(code));
  };

  const handleBulkDelete = () => {
    if (selectedHsnCodes.length === 0) return;
    if (!confirm(`Deactivate ${selectedHsnCodes.length} HSN code(s)?`)) return;
    dispatch(bulkDeleteHsnCodes(selectedHsnCodes)).unwrap()
      .then(() => setSelectedHsnCodes([]));
  };

  const handleUploadHsn = (formData) => {
    dispatch(uploadHsnFile(formData)).unwrap()
      .then(() => dispatch(fetchHsnCodes({ page: 1 })));
  };

  const toggleHsnSelect = (code) => {
    setSelectedHsnCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const selectAllHsn = () => {
    if (selectedHsnCodes.length === hsnCodes.length) {
      setSelectedHsnCodes([]);
    } else {
      setSelectedHsnCodes(hsnCodes.map(h => h.hsnCode));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8" data-theme="pharmacy">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <motion.div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        variants={fadeUp} initial="hidden" animate="visible">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-base-content tracking-tight">
              Medicines Management
            </h1>
          </div>
          <p className="text-sm text-base-content/50 ml-12">
            Full catalogue, HSN registry, inventory analytics
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Btn variant="ghost" size="sm" onClick={() => { dispatch(fetchInventoryStats()); dispatch(fetchHsnStats()); }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Btn>
          <Btn variant="secondary" size="sm" onClick={() => { setShowUploadHsn(true); }}>
            <UploadCloud className="w-3.5 h-3.5" /> Upload HSN
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => { dispatch(resetCurrentHsnCode()); setShowCreateMed(true); }}>
            <Plus className="w-3.5 h-3.5" /> New Medicine
          </Btn>
        </div>
      </motion.div>

      {/* ── ERROR BANNER ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div className="alert alert-error mb-6 flex items-center justify-between"
            variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={() => dispatch(clearMedicineError())}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: 'medicines',  label: 'Medicines',   icon: Pill        },
            { value: 'hsn',        label: 'HSN Codes',   icon: Tag         },
            { value: 'analytics',  label: 'Analytics',   icon: BarChart2   },
          ]}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB: MEDICINES
         ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {activeTab === 'medicines' && (
          <motion.div key="medicines" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
                <Input className="pl-9" placeholder="Search by name, brand, generic…"
                  value={medSearch} onChange={e => { setMedSearch(e.target.value); setMedPage(1); }} />
              </div>
              <Select className="w-full sm:w-44" value={medCategory} onChange={e => { setMedCategory(e.target.value); setMedPage(1); }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select className="w-full sm:w-36" value={medSchedule} onChange={e => { setMedSchedule(e.target.value); setMedPage(1); }}>
                <option value="">All Schedules</option>
                {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select className="w-full sm:w-44" value={medSort} onChange={e => setMedSort(e.target.value)}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {/* Grid / List toggle */}
              <div className="flex bg-base-200 rounded-lg p-1 gap-1">
                <button onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-base-100 shadow text-primary' : 'text-base-content/40'}`}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-base-100 shadow text-primary' : 'text-base-content/40'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-base-content/50 font-semibold">
                {medPagination.totalItems} medicine{medPagination.totalItems !== 1 ? 's' : ''} found
              </p>
              <Btn variant="ghost" size="sm" onClick={() => { setRestockMedId(null); setShowRestockModal(true); }}>
                <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Restock Request
              </Btn>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-48 rounded-xl" />
                ))}
              </div>
            )}

            {/* Grid view */}
            {!loading && viewMode === 'grid' && (
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                variants={stagger} initial="hidden" animate="visible">
                {medicines.map(med => (
                  <MedicineCard key={med._id} med={med}
                    onView={handleViewMed}
                    onEdit={(m) => { setEditMedData(m); setShowEditMed(true); }}
                    onStock={(id) => { setStockMedId(id); setShowStockModal(true); }}
                    onDiscontinue={handleDiscontinue}
                    actionLoading={actionLoading}
                  />
                ))}
                {medicines.length === 0 && !loading && (
                  <div className="col-span-full text-center py-20 text-base-content/30">
                    <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No medicines found</p>
                    <p className="text-xs mt-1">Try adjusting the filters or add a new medicine</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* List view */}
            {!loading && viewMode === 'list' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base-300 bg-base-200/50">
                        <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">Medicine</th>
                        <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">Category</th>
                        <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">Dosage</th>
                        <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">MRP</th>
                        <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">Status</th>
                        <th className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">Actions</th>
                      </tr>
                    </thead>
                    <motion.tbody variants={stagger} initial="hidden" animate="visible">
                      {medicines.map(med => (
                        <MedicineRow key={med._id} med={med}
                          onEdit={(m) => { setEditMedData(m); setShowEditMed(true); }}
                          onStock={(id) => { setStockMedId(id); setShowStockModal(true); }}
                          onDiscontinue={handleDiscontinue}
                          actionLoading={actionLoading}
                        />
                      ))}
                    </motion.tbody>
                  </table>
                  {medicines.length === 0 && (
                    <div className="text-center py-16 text-base-content/30">
                      <PackageSearch className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No medicines found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pagination */}
            {medPagination.totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination page={medPagination.currentPage} totalPages={medPagination.totalPages}
                  onChange={(p) => setMedPage(p)} />
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: HSN
           ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'hsn' && (
          <motion.div key="hsn" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">

            {/* HSN Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
                <Input className="pl-9" placeholder="Search HSN code or description…"
                  value={hsnSearch} onChange={e => { setHsnSearch(e.target.value); setHsnPage(1); }} />
              </div>
              <Select className="w-full sm:w-36" value={hsnGst} onChange={e => { setHsnGst(e.target.value); setHsnPage(1); }}>
                <option value="">All GST Slabs</option>
                {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
              </Select>
              <Select className="w-full sm:w-36" value={hsnActive} onChange={e => { setHsnActive(e.target.value); setHsnPage(1); }}>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
                <option value="all">All</option>
              </Select>
              <Select className="w-full sm:w-36" value={hsnSort} onChange={e => setHsnSort(e.target.value)}>
                {HSN_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>

            {/* HSN Action Bar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-base-content/50 font-semibold">
                  {hsnPagination.total} HSN code{hsnPagination.total !== 1 ? 's' : ''}
                </p>
                {selectedHsnCodes.length > 0 && (
                  <Btn variant="danger" size="sm" onClick={handleBulkDelete} loading={actionLoading}>
                    <Trash2 className="w-3.5 h-3.5" /> Bulk Deactivate ({selectedHsnCodes.length})
                  </Btn>
                )}
              </div>
              <div className="flex gap-2">
                <Btn variant="ghost" size="sm" onClick={() => setShowUploadHsn(true)}>
                  <UploadCloud className="w-3.5 h-3.5" /> Upload File
                </Btn>
                <Btn variant="primary" size="sm" onClick={() => setShowCreateHsn(true)}>
                  <Plus className="w-3.5 h-3.5" /> New HSN Code
                </Btn>
              </div>
            </div>

            {/* HSN Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base-300 bg-base-200/50">
                      <th className="py-3 px-4">
                        <input type="checkbox"
                          checked={selectedHsnCodes.length === hsnCodes.length && hsnCodes.length > 0}
                          onChange={selectAllHsn}
                          className="rounded border-base-300 text-primary focus:ring-primary" />
                      </th>
                      {['HSN Code', 'Description', 'GST', 'Status', 'Source', 'Actions'].map(h => (
                        <th key={h} className="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-base-content/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <motion.tbody variants={stagger} initial="hidden" animate="visible">
                    {hsnLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="px-4 py-2">
                            <div className="skeleton h-8 rounded" />
                          </td>
                        </tr>
                      ))
                    ) : hsnCodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-base-content/30">
                          <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No HSN codes found</p>
                        </td>
                      </tr>
                    ) : (
                      hsnCodes.map(hsn => (
                        <HsnRow key={hsn._id || hsn.hsnCode} hsn={hsn}
                          selected={selectedHsnCodes.includes(hsn.hsnCode)}
                          onSelect={() => toggleHsnSelect(hsn.hsnCode)}
                          onEdit={(h) => { setEditHsnData(h); setShowEditHsn(true); }}
                          onDelete={handleDeleteHsn}
                          actionLoading={actionLoading}
                        />
                      ))
                    )}
                  </motion.tbody>
                </table>
              </div>
            </div>

            {/* HSN Pagination */}
            {hsnPagination.totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination page={hsnPagination.currentPage} totalPages={hsnPagination.totalPages}
                  onChange={(p) => setHsnPage(p)} />
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: ANALYTICS
           ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <motion.div key="analytics" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
            {(loading || hsnLoading) ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
              </div>
            ) : (
              <AnalyticsTab stats={stats} hsnStats={hsnStats} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
         ════════════════════════════════════════════════════════════════════ */}

      {/* Create Medicine */}
      <Modal open={showCreateMed} onClose={() => setShowCreateMed(false)} title="Add New Medicine" wide>
        <MedicineForm
          onSubmit={handleCreateMed}
          loading={actionLoading}
          onHsnLookup={handleHsnLookup}
          hsnData={currentHsn}
          hsnLookupLoading={detailLoading}
        />
      </Modal>

      {/* Edit Medicine */}
      <Modal open={showEditMed} onClose={() => { setShowEditMed(false); setEditMedData(null); dispatch(resetCurrentHsnCode()); }}
        title="Edit Medicine" wide>
        {editMedData && (
          <MedicineForm
            initial={editMedData}
            onSubmit={handleEditMed}
            loading={actionLoading}
            onHsnLookup={handleHsnLookup}
            hsnData={currentHsn}
            hsnLookupLoading={detailLoading}
          />
        )}
      </Modal>

      {/* Medicine Detail */}
      <Modal open={showDetailMed} onClose={() => { setShowDetailMed(false); dispatch(resetCurrentMedicine()); }} title="Medicine Detail" wide>
        {detailLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-8 rounded-lg" />)}
          </div>
        ) : currentMedicine ? (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Brand Name',   value: currentMedicine.brandName   },
                { label: 'Generic Name', value: currentMedicine.genericName },
                { label: 'Category',     value: currentMedicine.category    },
                { label: 'Dosage',       value: currentMedicine.dosage      },
                { label: 'Schedule',     value: currentMedicine.schedule    },
                { label: 'MRP',          value: `₹${currentMedicine.mrp}`  },
                { label: 'GST',          value: `${currentMedicine.gstPercentage}%` },
                { label: 'Manufacturer', value: currentMedicine.manufacturer },
                { label: 'Packaging',    value: currentMedicine.packaging   },
              ].map(({ label, value }) => (
                <div key={label} className="bg-base-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase text-base-content/40 mb-0.5">{label}</p>
                  <p className="font-semibold text-base-content">{value || '—'}</p>
                </div>
              ))}
            </div>

            {/* Inventory */}
            {currentMedicine.inventory?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary/70 mb-2">Inventory by Store</p>
                <div className="space-y-2">
                  {currentMedicine.inventory.map((inv, i) => (
                    <div key={i} className="bg-base-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><p className="text-base-content/40 font-semibold uppercase text-[10px]">Stock</p><p className="font-bold">{inv.stockQuantity}</p></div>
                      <div><p className="text-base-content/40 font-semibold uppercase text-[10px]">Batch</p><p className="font-bold">{inv.batchNumber || '—'}</p></div>
                      <div><p className="text-base-content/40 font-semibold uppercase text-[10px]">Expiry</p><p className="font-bold">{inv.expiryDate ? new Date(inv.expiryDate).toLocaleDateString('en-IN') : '—'}</p></div>
                      <div><p className="text-base-content/40 font-semibold uppercase text-[10px]">Low Stock</p>
                        <Badge color={inv.isLowStock ? 'error' : 'success'}>{inv.isLowStock ? 'Yes' : 'No'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Update Stock */}
      <Modal open={showStockModal} onClose={() => { setShowStockModal(false); setStockMedId(null); }} title="Update Stock">
        {stockMedId && (
          <UpdateStockForm medicineId={stockMedId} onSubmit={handleUpdateStock} loading={actionLoading} />
        )}
      </Modal>

      {/* Restock Request */}
      <Modal open={showRestockModal} onClose={() => setShowRestockModal(false)} title="Send Restock Request">
        <form onSubmit={handleRestock} className="space-y-4">
          <FormField label="Medicine ID" required note="ObjectId of the medicine requiring restock">
            <Input value={restockMedId || ''} onChange={e => setRestockMedId(e.target.value)}
              placeholder="64f1a2b3c4d5e6f7a8b9c0d1" required />
          </FormField>
          <FormField label="Quantity Required" required note="Estimated units needed; notified to all admins/superadmins via in-app notification">
            <Input type="number" min={1} value={restockQty} onChange={e => setRestockQty(e.target.value)}
              placeholder="500" required />
          </FormField>
          <div className="flex items-center gap-2 text-[11px] text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>This sends a high-priority notification to all admins and superadmins.</span>
          </div>
          <div className="flex justify-end">
            <Btn type="submit" variant="primary" loading={actionLoading}>
              <AlertTriangle className="w-4 h-4" /> Send Request
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Create HSN */}
      <Modal open={showCreateHsn} onClose={() => setShowCreateHsn(false)} title="Create HSN Code">
        <HsnForm onSubmit={handleCreateHsn} loading={actionLoading} />
      </Modal>

      {/* Edit HSN */}
      <Modal open={showEditHsn} onClose={() => { setShowEditHsn(false); setEditHsnData(null); }} title="Edit HSN Code">
        {editHsnData && <HsnForm initial={editHsnData} onSubmit={handleEditHsn} loading={actionLoading} />}
      </Modal>

      {/* Upload HSN */}
      <Modal open={showUploadHsn} onClose={() => { setShowUploadHsn(false); dispatch(clearHsnUploadResult()); }}
        title="Bulk Upload HSN Codes">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-[11px] text-info bg-info/5 border border-info/20 rounded-lg px-3 py-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Expected Excel Columns (case-insensitive)</p>
              <p className="text-base-content/60">HSN Code · Description · Chapter Heading (optional) · GST % (0/5/12/18/28)</p>
              <p className="text-base-content/40 mt-0.5">File is permanently archived to ImageKit before any DB write for compliance.</p>
            </div>
          </div>
          <HsnUploadPanel
            onUpload={handleUploadHsn}
            loading={actionLoading}
            uploadResult={uploadResult}
            onClearResult={() => dispatch(clearHsnUploadResult())}
          />
        </div>
      </Modal>
    </div>
  );
}