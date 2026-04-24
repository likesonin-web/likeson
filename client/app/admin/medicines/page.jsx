'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import {
  Pill, Tag, UploadCloud, Plus, Search, Filter, Grid3X3, List,
  ChevronLeft, ChevronRight, Eye, Pencil, Trash2, PackageSearch,
  AlertTriangle, CheckCircle2, XCircle, BarChart2, RefreshCw,
  Download, FileSpreadsheet, X, Info, Layers, ShieldCheck,
  TrendingUp, Package, AlertOctagon, Clock, ToggleLeft,
  ToggleRight, Loader2, Building2, Stethoscope, Image,
  Link, FlaskConical, Thermometer, Globe, Hash, ChevronDown,
  ChevronUp, Clipboard, BadgeAlert, Activity, BookOpen,
  Microscope, MapPin, CalendarDays, DollarSign, Barcode,
  ArrowRight, Boxes, Star, Sparkles,
  Zap, Heart, Shield, Globe2, FileText, Settings, Bell,
  TrendingDown, Minus, DatabaseZap, RefreshCcw,
  Store, Pause, Play, Siren, ShieldAlert,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SLICE IMPORTS — all thunks & selectors pulled from medicineSlice
// ─────────────────────────────────────────────────────────────────────────────
import {
  // Medicine thunks [M1–M10]
  fetchMedicines,
  fetchInventoryStats,
  sendRestockRequest,
  fetchMedicineBySlug,
  createMedicine,
  updateMedicine,
  updateStock,
  discontinueMedicine,
  syncAllInventory,          // [M9] POST /medicines/sync-inventory/all
  syncMedicineInventory,     // [M10] POST /medicines/:id/sync-inventory

  // HSN thunks [H1–H8]
  fetchHsnCodes,
  fetchHsnStats,
  fetchHsnByCode,
  createHsnCode,
  uploadHsnFile,
  bulkDeleteHsnCodes,
  updateHsnCode,
  deleteHsnCode,

  // Inventory thunks [INV1–INV7]
  fetchMedicineInventory,
  fetchStoreInventoryEntry,
  addInventoryEntry,
  updateInventoryEntry,
  deleteInventoryEntry,
  fetchLowStockReport,
  fetchExpiryAlerts,

  // Store thunks [S1–S5]
  fetchStores,
  fetchNearbyStores,
  fetchStoreById,
  fetchStoreBySlug,
  fetchMyStore,

  // Store lifecycle thunks [SL1–SL4]
  deleteStore,
  suspendStore,
  unsuspendStore,
  triggerLowStockAlerts,

  // Action creators
  resetMedicineState,
  clearMedicineError,
  resetCurrentMedicine,
  resetCurrentHsnCode,
  clearHsnUploadResult,
  resetCurrentStore,
  clearSyncResult,
  clearStoreLifecycleResult,
  resetInventory,

  // Selectors — Medicine
  selectAllMedicines,
  selectCurrentMedicine,
  selectMedicineStats,
  selectMedicineLoading,
  selectMedicineDetailLoading,
  selectMedicineActionLoading,
  selectMedicineSyncLoading,
  selectMedicinePagination,
  selectMedicineError,
  selectSyncResult,

  // Selectors — Inventory
  selectCurrentInventory,
  selectCurrentInventoryEntry,
  selectInventoryMedicineId,
  selectInventoryLoading,
  selectLowStockReport,
  selectExpiryAlerts,

  // Selectors — HSN
  selectAllHsnCodes,
  selectCurrentHsnCode,
  selectHsnStats,
  selectHsnPagination,
  selectHsnUploadResult,
  selectHsnLoading,

  // Selectors — Stores
  selectAllStores,
  selectCurrentStore,
  selectMyStore,
  selectNearbyStores,
  selectStorePagination,
  selectStoreLoading,
  selectStoreDetailLoading,
  selectStoreActionLoading,
  selectStoreLifecycleResult,
} from '@/store/slices/medicineSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const GST_SLABS  = [0, 5, 12, 18, 28];
const SCHEDULES  = ['H', 'H1', 'X', 'G', 'J', 'C', 'C1', 'None'];
const CATEGORIES = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Solution', 'Injection', 'Infusion',
  'Ointment', 'Cream', 'Gel', 'Lotion', 'Drops', 'Inhaler', 'Nasal Spray', 'Patch',
  'Suppository', 'Powder', 'Granules', 'Lozenge', 'Implant', 'Others',
];
const ROUTES = [
  'Oral', 'Intravenous', 'Intramuscular', 'Subcutaneous', 'Topical',
  'Inhalation', 'Rectal', 'Vaginal', 'Ophthalmic', 'Otic', 'Nasal',
  'Sublingual', 'Transdermal', 'Others',
];
const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'price_low',  label: 'Price: Low → High' },
  { value: 'price_high', label: 'Price: High → Low' },
  { value: 'name_asc',   label: 'Name A → Z' },
];
const HSN_SORT_OPTIONS = [
  { value: 'hsnCode',      label: 'Code ↑' },
  { value: 'hsnCode_desc', label: 'Code ↓' },
  { value: 'gst_asc',      label: 'GST ↑' },
  { value: 'gst_desc',     label: 'GST ↓' },
  { value: 'newest',       label: 'Newest' },
];
const STORE_STATUSES = ['Open', 'Under-Maintenance', 'Inactive'];
const STORE_TYPES    = ['Retail', 'Hospital', 'Wholesale', 'Online'];
const CHART_COLORS   = [
  'var(--primary)', 'var(--secondary)', 'var(--accent)',
  'var(--info)', 'var(--warning)', 'var(--error)',
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
};
const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
};
const stagger    = { visible: { transition: { staggerChildren: 0.05 } } };
const slideRight = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: 24, transition: { duration: 0.2 } },
};
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const extractHsnString = (hsnField) => {
  if (!hsnField) return '';
  if (typeof hsnField === 'object' && hsnField.hsnCode) return hsnField.hsnCode;
  if (typeof hsnField === 'string' && hsnField.length === 24) return '';
  return '';
};

const extractHsnObj = (hsnField) => {
  if (!hsnField || typeof hsnField !== 'object') return null;
  return hsnField;
};

const storeStatusColor = (status) => {
  if (status === 'Open')             return 'success';
  if (status === 'Under-Maintenance') return 'warning';
  if (status === 'Inactive')         return 'error';
  return 'neutral';
};

// ─────────────────────────────────────────────────────────────────────────────
// BASE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const FieldNote = ({ children }) => (
  <p className="mt-0.5 text-[10px] text-base-content/50 leading-tight font-medium">{children}</p>
);

const FormField = ({ label, note, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">
      {label}{required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

const inputBase = `w-full input-field focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200 text-sm`;

const Input    = ({ className = '', ...props }) => <input    className={`${inputBase} ${className}`} {...props} />;
const Textarea = ({ className = '', ...props }) => <textarea rows={3} className={`${inputBase} resize-none ${className}`} {...props} />;
const SelectEl = ({ className = '', children, ...props }) => <select className={`${inputBase} ${className}`} {...props}>{children}</select>;

const Btn = ({ variant = 'primary', size = 'md', className = '', loading, children, ...props }) => {
  const base  = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-[var(--r-field)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { xs: 'px-2 py-1 text-[10px]', sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-2.5 text-sm' };
  const vars  = {
    primary:   'bg-primary text-primary-content hover:opacity-90 shadow-sm',
    secondary: 'btn-secondary',
    danger:    'bg-error text-error-content hover:opacity-90 shadow-sm',
    ghost:     'text-base-content/60 hover:bg-base-200 hover:text-base-content',
    success:   'bg-success text-success-content hover:opacity-90 shadow-sm',
    warning:   'bg-warning text-warning-content hover:opacity-90',
    outline:   'border border-base-300 text-base-content hover:bg-base-200',
    info:      'bg-info text-info-content hover:opacity-90 shadow-sm',
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${vars[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
};

const Badge = ({ color = 'primary', children, size = 'sm' }) => {
  const colors = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error:   'badge-error',
    info:    'badge-info',
    neutral: 'bg-base-300 text-base-content/70 border border-base-300',
  };
  const sz = size === 'xs' ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-2 py-0.5';
  return <span className={`badge ${colors[color]} ${sz} rounded-[var(--r-selector)]`}>{children}</span>;
};

const Modal = ({ open, onClose, title, children, wide }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-base-content/20 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className={`relative bg-base-100 border border-base-300 rounded-[var(--r-box)] shadow-[var(--shadow-depth)] w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} max-h-[92vh] overflow-y-auto`}
          variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-100/95 backdrop-blur">
            <h3 className="text-sm font-bold text-base-content tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-[var(--r-field)] hover:bg-base-200 text-base-content/40 hover:text-base-content transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const SectionDivider = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 pt-2 pb-1">
    <div className="p-1 bg-primary/10 rounded-md"><Icon className="w-3 h-3 text-primary" /></div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{label}</span>
    <div className="flex-1 h-px bg-base-300" />
  </div>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 bg-base-200 border border-base-300 p-1 rounded-[var(--r-box)] w-fit">
    {tabs.map(t => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-field)] text-xs font-bold transition-all duration-200 ${
          active === t.value
            ? 'bg-base-100 text-primary shadow-sm border border-base-300'
            : 'text-base-content/50 hover:text-base-content hover:bg-base-200/60'
        }`}
      >
        {t.icon && <t.icon className="w-3.5 h-3.5" />}
        {t.label}
      </button>
    ))}
  </div>
);

const Pagination = ({ page, totalPages, onChange }) => (
  <div className="flex items-center gap-1">
    <Btn variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
      <ChevronLeft className="w-3.5 h-3.5" />
    </Btn>
    <span className="text-xs font-semibold text-base-content/50 px-2 tabular-nums">{page} / {totalPages}</span>
    <Btn variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
      <ChevronRight className="w-3.5 h-3.5" />
    </Btn>
  </div>
);

const StatCard = ({ icon: Icon, label, value, color = 'primary', sublabel, trend }) => {
  const iconColors = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error:   'bg-error/10 text-error',
    info:    'bg-info/10 text-info',
    accent:  'bg-accent/10 text-accent',
  };
  return (
    <motion.div variants={fadeUp} className="card bg-base-100 p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-[var(--r-box)] ${iconColors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-0.5">{label}</p>
        <p className="text-2xl font-black text-base-content leading-none">{value ?? '—'}</p>
        {sublabel && <p className="text-[10px] text-base-content/40 mt-1">{sublabel}</p>}
      </div>
      {trend !== undefined && (
        <div className={`text-[10px] font-bold flex items-center gap-0.5 ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SYNC RESULT BANNER
// ─────────────────────────────────────────────────────────────────────────────
const SyncResultBanner = ({ result, onDismiss }) => {
  if (!result) return null;
  const hasErrors = result.errors?.length > 0;
  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      className={`flex items-start gap-3 rounded-[var(--r-box)] border px-4 py-3 text-sm ${
        hasErrors
          ? 'bg-warning/10 border-warning/30 text-warning'
          : 'bg-success/10 border-success/30 text-success'
      }`}
    >
      <DatabaseZap className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {result.totalMedicines !== undefined ? (
          <p className="font-bold">
            Bulk sync complete — {result.medicinesSynced} medicine(s) updated,&nbsp;
            {result.totalEntriesAdded} inventory entries added
          </p>
        ) : result.addedCount !== undefined ? (
          <p className="font-bold">
            {result.addedCount > 0
              ? `Synced ${result.addedCount} new store(s) with zero stock`
              : 'All stores already have inventory entries — nothing to sync'}
          </p>
        ) : result.error ? (
          <p className="font-bold text-error">{result.error}</p>
        ) : null}
        {hasErrors && (
          <p className="text-[11px] mt-0.5 text-warning/80">
            {result.errors.length} error(s) — check console for details
          </p>
        )}
      </div>
      <button onClick={onDismiss} className="text-current opacity-50 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE LIFECYCLE RESULT BANNER
// ─────────────────────────────────────────────────────────────────────────────
const StoreLifecycleBanner = ({ result, onDismiss }) => {
  if (!result) return null;
  const typeMap = {
    deleted:          { color: 'error',   label: 'Store deleted successfully' },
    suspended:        { color: 'warning', label: 'Store suspended — inventory paused' },
    unsuspended:      { color: 'success', label: 'Store reopened — inventory restored' },
    lowStockTriggered:{ color: 'info',    label: 'Low-stock alerts triggered' },
  };
  const cfg = typeMap[result.type] || { color: 'neutral', label: result.message || 'Operation complete' };
  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      className={`flex items-center gap-3 rounded-[var(--r-box)] border px-4 py-3 text-sm bg-${cfg.color}/10 border-${cfg.color}/30 text-${cfg.color}`}
    >
      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-bold">{cfg.label}</p>
        {result.medicinesUpdated !== undefined && (
          <p className="text-[11px] opacity-70">{result.medicinesUpdated} medicine inventory entries affected</p>
        )}
      </div>
      <button onClick={onDismiss} className="text-current opacity-50 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COLLAPSIBLE
// ─────────────────────────────────────────────────────────────────────────────
const Collapsible = ({ title, icon: Icon, children, defaultOpen = false, accent }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border border-base-300 rounded-[var(--r-box)] overflow-hidden ${accent ? 'border-l-2 border-l-primary' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-base-200/40 hover:bg-base-200/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-base-content/70">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
          {title}
        </div>
        <div className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-3.5 h-3.5 text-base-content/40" />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.22 }} className="overflow-hidden"
          >
            <div className="p-4 space-y-4 bg-base-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAG INPUT
// ─────────────────────────────────────────────────────────────────────────────
const TagInput = ({ value = [], onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  };
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder || 'Type and press Enter'}
          className={`${inputBase} flex-1`}
        />
        <Btn type="button" variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3" /></Btn>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-base-200 border border-base-300 text-base-content/80 text-[11px] px-2 py-1 rounded-[var(--r-selector)] font-medium">
              {tag}
              <button type="button" onClick={() => remove(i)} className="text-base-content/30 hover:text-error transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SALT COMPOSITION EDITOR
// ─────────────────────────────────────────────────────────────────────────────
const SaltCompositionEditor = ({ value = [], onChange }) => {
  const [row, setRow] = useState({ ingredient: '', strength: '', unit: '' });
  const add = () => {
    if (!row.ingredient || !row.strength) return;
    onChange([...value, { ...row }]);
    setRow({ ingredient: '', strength: '', unit: '' });
  };
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input placeholder="Ingredient *" value={row.ingredient} onChange={e => setRow(r => ({ ...r, ingredient: e.target.value }))} />
        <Input placeholder="Strength *"   value={row.strength}   onChange={e => setRow(r => ({ ...r, strength:   e.target.value }))} />
        <div className="flex gap-2">
          <Input placeholder="Unit" value={row.unit} onChange={e => setRow(r => ({ ...r, unit: e.target.value }))} className="w-20" />
          <Btn type="button" variant="primary" size="sm" onClick={add}><Plus className="w-3 h-3" /></Btn>
        </div>
      </div>
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-base-200/60 border border-base-300 rounded-[var(--r-field)] px-3 py-2 text-xs">
              <FlaskConical className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="text-base-content font-semibold">{s.ingredient}</span>
              <span className="text-base-content/40">·</span>
              <span className="text-base-content/60">{s.strength} {s.unit}</span>
              <button type="button" onClick={() => remove(i)} className="ml-auto text-base-content/30 hover:text-error transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE MANAGER
// ─────────────────────────────────────────────────────────────────────────────
const ImageManager = ({ value = [], onChange }) => {
  const [urlInput, setUrlInput] = useState('');
  const [altText,  setAltText]  = useState('');
  const fileRef = useRef();

  const addUrl = () => {
    if (!urlInput.trim()) return;
    onChange([...value, { url: urlInput.trim(), altText: altText.trim(), isPrimary: value.length === 0 }]);
    setUrlInput(''); setAltText('');
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange([...value, { url: reader.result, altText: file.name, isPrimary: value.length === 0, _localFile: file }]);
    };
    reader.readAsDataURL(file);
  };

  const setPrimary = (i) => onChange(value.map((img, idx) => ({ ...img, isPrimary: idx === i })));
  const remove     = (i) => {
    const next = value.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some(img => img.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col w-full gap-2 items-center">
        <div className="relative w-full flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30 pointer-events-none" />
          <Input className="pl-8" placeholder="Paste image URL…" value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        </div>
        <div className="flex w-full gap-2">
          <Input placeholder="Alt text" value={altText} onChange={e => setAltText(e.target.value)} className="flex-shrink-0 max-w-xl" />
          <Btn type="button" variant="outline" size="sm" onClick={addUrl} className="flex-shrink-0">Add URL</Btn>
        </div>
      </div>

      <div
        className="border border-dashed border-base-300 hover:border-primary/50 rounded-[var(--r-box)] px-4 py-4 flex items-center gap-3 cursor-pointer hover:bg-primary/5 transition-all"
        onClick={() => fileRef.current?.click()}
      >
        <div className="p-2 bg-primary/10 rounded-[var(--r-field)]">
          <Image className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-base-content/60">Upload image from device</p>
          <p className="text-[10px] text-base-content/30">JPG, PNG, WEBP supported</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((img, i) => (
            <div key={i} className={`relative group aspect-square rounded-[var(--r-field)] overflow-hidden border-2 transition-colors ${img.isPrimary ? 'border-primary' : 'border-base-300'}`}>
              <img src={img.url} alt={img.altText || 'Medicine image'} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-base-content/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                <button type="button" onClick={() => setPrimary(i)}
                  className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors ${img.isPrimary ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content hover:bg-primary hover:text-primary-content'}`}>
                  {img.isPrimary ? '★ Primary' : 'Set Primary'}
                </button>
                <button type="button" onClick={() => remove(i)}
                  className="text-[9px] px-2 py-0.5 rounded font-bold bg-error text-error-content">Remove</button>
              </div>
              {img.isPrimary && (
                <div className="absolute top-1 left-1 bg-primary text-primary-content text-[7px] font-black px-1.5 py-0.5 rounded-full">PRIMARY</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE FORM
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MED = {
  name: '', brandName: '', genericName: '', slug: '', description: '', drugForm: '',
  category: 'Tablet',
  dosage: '', routeOfAdministration: 'Oral',
  therapeuticClass: '', pharmacologicalClass: '', atcCode: '',
  indications: [], contraindications: [], sideEffects: [], interactions: [], warnings: [],
  isPrescriptionRequired: true, schedule: 'None', narcoticLicenceRequired: false,
  saltComposition: [],
  storageConditions: {
    temperature: { min: '', max: '', label: '' },
    lightSensitive: false, moistureSensitive: false, requiresColdChain: false,
  },
  hsnCodeStr: '', gstPercentage: 5,
  packaging: '', packSize: '', packUnit: '', mrp: '', ptr: '', pts: '', pricePerUnit: '',
  regulatoryInfo: { cdscoDrugLicenceNo: '', stateLicenceNo: '', importLicenceNo: '', fdaApprovalNo: '' },
  images: [], searchKeywords: [],
  manufacturer: '', manufacturerAddress: '', countryOfOrigin: 'India',
  storeId: '', initialStock: '', batchNumber: '', expiryDate: '',
  isApproved: false, isDiscontinued: false, discontinuedReason: '',
};

const FORM_STEPS = [
  { id: 'basic',          label: 'Basic Info',    icon: Pill,         required: true },
  { id: 'medical',        label: 'Medical',       icon: Stethoscope },
  { id: 'regulatory',     label: 'Regulatory',    icon: ShieldCheck },
  { id: 'storage',        label: 'Storage',       icon: Thermometer },
  { id: 'hsn',            label: 'HSN / GST',     icon: Hash },
  { id: 'pricing',        label: 'Pricing',       icon: DollarSign },
  { id: 'regulatory-ids', label: 'Reg. IDs',      icon: Clipboard },
  { id: 'manufacturer',   label: 'Manufacturer',  icon: Building2 },
  { id: 'media',          label: 'Media',         icon: Image },
  { id: 'inventory',      label: 'Inventory',     icon: Layers },
];

const buildFormInitial = (initial) => {
  if (!initial) return { ...DEFAULT_MED };
  return {
    ...DEFAULT_MED,
    ...initial,
    hsnCodeStr: extractHsnString(initial.hsnCode),
    gstPercentage: initial.gstPercentage ?? 5,
    storageConditions: {
      temperature: {
        min:   initial.storageConditions?.temperature?.min   ?? '',
        max:   initial.storageConditions?.temperature?.max   ?? '',
        label: initial.storageConditions?.temperature?.label ?? '',
      },
      lightSensitive:    initial.storageConditions?.lightSensitive    ?? false,
      moistureSensitive: initial.storageConditions?.moistureSensitive ?? false,
      requiresColdChain: initial.storageConditions?.requiresColdChain ?? false,
    },
    regulatoryInfo: {
      cdscoDrugLicenceNo: initial.regulatoryInfo?.cdscoDrugLicenceNo || '',
      stateLicenceNo:     initial.regulatoryInfo?.stateLicenceNo     || '',
      importLicenceNo:    initial.regulatoryInfo?.importLicenceNo    || '',
      fdaApprovalNo:      initial.regulatoryInfo?.fdaApprovalNo      || '',
    },
    indications:       initial.indications       || [],
    contraindications: initial.contraindications || [],
    sideEffects:       initial.sideEffects       || [],
    interactions:      initial.interactions      || [],
    warnings:          initial.warnings          || [],
    saltComposition:   initial.saltComposition   || [],
    images:            initial.images            || [],
    searchKeywords:    initial.searchKeywords    || [],
    storeId: '', initialStock: '', batchNumber: '', expiryDate: '', pricePerUnit: '',
  };
};

const MedicineForm = ({ initial, onSubmit, loading, onHsnLookup, hsnData, hsnLookupLoading, stores = [], isAdmin }) => {
  const [form, setForm]             = useState(() => buildFormInitial(initial));
  const [activeStep, setActiveStep] = useState('basic');

  const set  = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setV = (k, v)     => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (hsnData) setV('gstPercentage', hsnData.gstPercentage);
  }, [hsnData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name, brandName: form.brandName, genericName: form.genericName,
      description: form.description, drugForm: form.drugForm, category: form.category,
      dosage: form.dosage, routeOfAdministration: form.routeOfAdministration,
      therapeuticClass: form.therapeuticClass, pharmacologicalClass: form.pharmacologicalClass,
      atcCode: form.atcCode,
      indications: form.indications, contraindications: form.contraindications,
      sideEffects: form.sideEffects, interactions: form.interactions, warnings: form.warnings,
      isPrescriptionRequired: form.isPrescriptionRequired, schedule: form.schedule,
      narcoticLicenceRequired: form.narcoticLicenceRequired,
      saltComposition: form.saltComposition,
      storageConditions: {
        temperature: {
          min:   form.storageConditions.temperature.min !== '' ? Number(form.storageConditions.temperature.min) : undefined,
          max:   form.storageConditions.temperature.max !== '' ? Number(form.storageConditions.temperature.max) : undefined,
          label: form.storageConditions.temperature.label,
        },
        lightSensitive:    form.storageConditions.lightSensitive,
        moistureSensitive: form.storageConditions.moistureSensitive,
        requiresColdChain: form.storageConditions.requiresColdChain,
      },
      hsnCode:       form.hsnCodeStr || undefined,
      gstPercentage: Number(form.gstPercentage),
      packaging: form.packaging,
      packSize:  form.packSize  ? Number(form.packSize) : undefined,
      packUnit:  form.packUnit,
      mrp: Number(form.mrp),
      ptr: form.ptr ? Number(form.ptr) : undefined,
      pts: form.pts ? Number(form.pts) : undefined,
      regulatoryInfo: form.regulatoryInfo,
      images: form.images.map(img => ({ url: img.url, altText: img.altText, isPrimary: img.isPrimary })),
      searchKeywords: form.searchKeywords,
      manufacturer: form.manufacturer, manufacturerAddress: form.manufacturerAddress,
      countryOfOrigin: form.countryOfOrigin,
    };

    if (form.storeId) {
      payload.storeId      = form.storeId;
      payload.initialStock = Number(form.initialStock) || 0;
      payload.batchNumber  = form.batchNumber || 'INIT-BATCH';
      payload.expiryDate   = form.expiryDate || undefined;
      payload.pricePerUnit = form.pricePerUnit ? Number(form.pricePerUnit) : Number(form.mrp);
    }

    if (initial?._id) {
      payload.isApproved         = form.isApproved;
      payload.isDiscontinued     = form.isDiscontinued;
      payload.discontinuedReason = form.discontinuedReason;
    }

    onSubmit(payload);
  };

  const ToggleBtn = ({ value, onToggle, trueLabel, falseLabel, trueIcon: TIcon, falseIcon: FIcon, danger }) => (
    <button type="button" onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-[var(--r-field)] border text-xs font-bold transition-all ${
        value
          ? danger ? 'border-error/40 bg-error/10 text-error' : 'border-primary/40 bg-primary/10 text-primary'
          : 'border-base-300 bg-base-200/50 text-base-content/40'
      }`}>
      {value
        ? TIcon ? <TIcon className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />
        : FIcon ? <FIcon className="w-4 h-4" /> : <ToggleLeft  className="w-4 h-4" />
      }
      {value ? trueLabel : falseLabel}
    </button>
  );

  const setTemp    = (field) => (e) =>
    setForm(f => ({ ...f, storageConditions: { ...f.storageConditions, temperature: { ...f.storageConditions.temperature, [field]: e.target.value } } }));
  const setStorage = (field) => (val) =>
    setForm(f => ({ ...f, storageConditions: { ...f.storageConditions, [field]: val } }));
  const setRegInfo = (field) => (e) =>
    setForm(f => ({ ...f, regulatoryInfo: { ...f.regulatoryInfo, [field]: e.target.value } }));

  return (
    <div className="flex gap-0 h-full">
      {/* Step Navigator */}
      <div className="hidden lg:flex flex-col gap-0.5 w-44 flex-shrink-0 pr-4 border-r border-base-300 mr-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-base-content/30 mb-2 px-2">Sections</p>
        {FORM_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <button key={step.id} type="button" onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-2 px-2 py-2 rounded-[var(--r-field)] text-[11px] font-bold text-left transition-all ${
                activeStep === step.id ? 'bg-primary/10 text-primary' : 'text-base-content/50 hover:bg-base-200 hover:text-base-content'
              }`}>
              <Icon className="w-3 h-3 flex-shrink-0" />
              {step.label}
              {step.required && <span className="ml-auto text-error text-[8px]">*</span>}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-4">

        {/* BASIC INFO */}
        <div style={{ display: activeStep === 'basic' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Pill className="w-4 h-4 text-primary" /> Basic Information</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Core identification details for this medicine</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Medicine Name" required note="Full name as on label (e.g. Dolo 650)">
                <Input value={form.name} onChange={set('name')} placeholder="Dolo 650" required />
              </FormField>
              <FormField label="Brand Name" required note="Commercial brand name">
                <Input value={form.brandName} onChange={set('brandName')} placeholder="Dolo" required />
              </FormField>
              <FormField label="Generic / INN Name" required note="Active pharmaceutical ingredient">
                <Input value={form.genericName} onChange={set('genericName')} placeholder="Paracetamol" required />
              </FormField>
              <FormField label="Drug Form" note="e.g. Dispersible, Chewable Tablet">
                <Input value={form.drugForm} onChange={set('drugForm')} placeholder="Dispersible Tablet" />
              </FormField>
              <FormField label="Dosage / Strength" required note="e.g. 500mg, 5mg/ml">
                <Input value={form.dosage} onChange={set('dosage')} placeholder="500mg" required />
              </FormField>
              <FormField label="Category / Dosage Form" required>
                <SelectEl value={form.category} onChange={set('category')} required>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </SelectEl>
              </FormField>
            </div>
            <FormField label="Description" note="Clinical summary or usage notes">
              <Textarea value={form.description} onChange={set('description')} placeholder="Brief clinical description…" />
            </FormField>
          </div>
        </div>

        {/* MEDICAL CLASSIFICATION */}
        <div style={{ display: activeStep === 'medical' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Medical Classification</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Pharmacological and therapeutic categorisation</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Route of Administration">
                <SelectEl value={form.routeOfAdministration} onChange={set('routeOfAdministration')}>
                  {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                </SelectEl>
              </FormField>
              <FormField label="Therapeutic Class" note="e.g. Antibiotics, NSAIDs">
                <Input value={form.therapeuticClass} onChange={set('therapeuticClass')} placeholder="e.g. NSAIDs" />
              </FormField>
              <FormField label="Pharmacological Class" note="e.g. Beta-lactam, PPI">
                <Input value={form.pharmacologicalClass} onChange={set('pharmacologicalClass')} placeholder="e.g. COX inhibitor" />
              </FormField>
              <FormField label="ATC Code" note="WHO Anatomical Therapeutic Chemical code">
                <Input value={form.atcCode} onChange={set('atcCode')} placeholder="e.g. N02BE01" />
              </FormField>
            </div>
            <SectionDivider icon={FlaskConical} label="Salt Composition" />
            <FormField label="Active Ingredients" note="List all active ingredients with strengths">
              <SaltCompositionEditor value={form.saltComposition} onChange={v => setV('saltComposition', v)} />
            </FormField>
          </div>
        </div>

        {/* REGULATORY & SAFETY */}
        <div style={{ display: activeStep === 'regulatory' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Regulatory & Safety</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">India D&C Act schedule, indications, and clinical safety data</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Schedule" note="India D&C Act schedule">
                <SelectEl value={form.schedule} onChange={set('schedule')}>
                  {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                </SelectEl>
              </FormField>
              <FormField label="Prescription Required">
                <ToggleBtn value={form.isPrescriptionRequired} onToggle={() => setV('isPrescriptionRequired', !form.isPrescriptionRequired)} trueLabel="Rx Required" falseLabel="OTC — No Rx" />
              </FormField>
              <FormField label="Narcotic / Controlled">
                <ToggleBtn value={form.narcoticLicenceRequired} onToggle={() => setV('narcoticLicenceRequired', !form.narcoticLicenceRequired)} trueLabel="Controlled" falseLabel="Not Controlled" danger trueIcon={BadgeAlert} falseIcon={ShieldCheck} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Indications" note="Press Enter to add each indication">
                <TagInput value={form.indications} onChange={v => setV('indications', v)} placeholder="e.g. Fever" />
              </FormField>
              <FormField label="Contraindications">
                <TagInput value={form.contraindications} onChange={v => setV('contraindications', v)} placeholder="e.g. Hepatic impairment" />
              </FormField>
              <FormField label="Side Effects">
                <TagInput value={form.sideEffects} onChange={v => setV('sideEffects', v)} placeholder="e.g. Nausea" />
              </FormField>
              <FormField label="Drug Interactions">
                <TagInput value={form.interactions} onChange={v => setV('interactions', v)} placeholder="e.g. Warfarin" />
              </FormField>
              <FormField label="Warnings / Black-box" className="sm:col-span-2">
                <TagInput value={form.warnings} onChange={v => setV('warnings', v)} placeholder="e.g. Do not use in pregnancy" />
              </FormField>
            </div>
          </div>
        </div>

        {/* STORAGE */}
        <div style={{ display: activeStep === 'storage' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Thermometer className="w-4 h-4 text-primary" /> Storage Conditions</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Temperature range and environmental sensitivity requirements</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Min Temp (°C)">
                <Input type="number" value={form.storageConditions.temperature.min} onChange={setTemp('min')} placeholder="2" />
              </FormField>
              <FormField label="Max Temp (°C)">
                <Input type="number" value={form.storageConditions.temperature.max} onChange={setTemp('max')} placeholder="25" />
              </FormField>
              <FormField label="Temperature Label" note="e.g. Store below 25°C">
                <Input value={form.storageConditions.temperature.label} onChange={setTemp('label')} placeholder="Store below 25°C" />
              </FormField>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'lightSensitive',    label: 'Light Sensitive' },
                { key: 'moistureSensitive', label: 'Moisture Sensitive' },
                { key: 'requiresColdChain', label: 'Cold Chain Required' },
              ].map(({ key, label }) => (
                <button key={key} type="button"
                  onClick={() => setStorage(key)(!form.storageConditions[key])}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-field)] border text-xs font-bold transition-all ${
                    form.storageConditions[key] ? 'border-warning/40 bg-warning/10 text-warning' : 'border-base-300 bg-base-200/50 text-base-content/40'
                  }`}>
                  {form.storageConditions[key] ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* HSN / GST */}
        <div style={{ display: activeStep === 'hsn' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Hash className="w-4 h-4 text-primary" /> HSN / GST Classification</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Harmonised System Nomenclature code and GST applicability</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <FormField label="HSN Code" note="4–8 digit code; GST auto-fills on lookup" className="sm:col-span-2">
                <div className="flex gap-2">
                  <Input value={form.hsnCodeStr} onChange={set('hsnCodeStr')} placeholder="e.g. 3004" maxLength={8} />
                  <Btn type="button" variant="outline" size="sm" loading={hsnLookupLoading}
                    onClick={() => form.hsnCodeStr && onHsnLookup(form.hsnCodeStr)}>
                    <Search className="w-3 h-3" /> Lookup
                  </Btn>
                </div>
              </FormField>
              <FormField label="GST %" note="Auto-filled from HSN">
                <SelectEl value={form.gstPercentage} onChange={set('gstPercentage')}>
                  {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
                </SelectEl>
              </FormField>
            </div>
            {hsnData && (
              <div className="flex items-center gap-2 text-[11px] text-success bg-success/10 border border-success/20 rounded-[var(--r-field)] px-3 py-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span><strong>{hsnData.hsnCode}</strong> — {hsnData.description} · GST: <strong>{hsnData.gstPercentage}%</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* PRICING */}
        <div style={{ display: activeStep === 'pricing' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Packaging & Pricing</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">MRP, trade prices, and packaging configuration</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Packaging" required note="e.g. Strip of 10 Tablets">
              <Input value={form.packaging} onChange={set('packaging')} placeholder="Strip of 10 Tablets" required />
            </FormField>
            <FormField label="Pack Size" note="Numeric (e.g. 10, 200)">
              <Input type="number" min={0} value={form.packSize} onChange={set('packSize')} placeholder="10" />
            </FormField>
            <FormField label="Pack Unit" note="e.g. Tablets, ml, g">
              <Input value={form.packUnit} onChange={set('packUnit')} placeholder="Tablets" />
            </FormField>
            <FormField label="MRP (₹)" required note="Inclusive of GST">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 font-bold text-sm">₹</span>
                <Input type="number" min={0} step={0.01} value={form.mrp} onChange={set('mrp')} placeholder="0.00" required className="pl-6" />
              </div>
            </FormField>
            <FormField label="PTR — Price to Retailer (₹)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 font-bold text-sm">₹</span>
                <Input type="number" min={0} step={0.01} value={form.ptr} onChange={set('ptr')} placeholder="0.00" className="pl-6" />
              </div>
            </FormField>
            <FormField label="PTS — Price to Stockist (₹)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 font-bold text-sm">₹</span>
                <Input type="number" min={0} step={0.01} value={form.pts} onChange={set('pts')} placeholder="0.00" className="pl-6" />
              </div>
            </FormField>
          </div>
        </div>

        {/* REGULATORY IDs */}
        <div style={{ display: activeStep === 'regulatory-ids' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Clipboard className="w-4 h-4 text-primary" /> Regulatory Identifiers</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Government and regulatory authority licence numbers</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="CDSCO Drug Licence No.">
              <Input value={form.regulatoryInfo.cdscoDrugLicenceNo} onChange={setRegInfo('cdscoDrugLicenceNo')} placeholder="DL-XXXXXXXXXX" />
            </FormField>
            <FormField label="State Licence No.">
              <Input value={form.regulatoryInfo.stateLicenceNo} onChange={setRegInfo('stateLicenceNo')} placeholder="SL-XXXXXXXXXX" />
            </FormField>
            <FormField label="Import Licence No." note="For imported drugs">
              <Input value={form.regulatoryInfo.importLicenceNo} onChange={setRegInfo('importLicenceNo')} placeholder="IL-XXXXXXXXXX" />
            </FormField>
            <FormField label="FDA Approval No." note="If US-origin drug">
              <Input value={form.regulatoryInfo.fdaApprovalNo} onChange={setRegInfo('fdaApprovalNo')} placeholder="NDA-XXXXXXX" />
            </FormField>
          </div>
        </div>

        {/* MANUFACTURER */}
        <div style={{ display: activeStep === 'manufacturer' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Manufacturer & Origin</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Manufacturing details and country of origin</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Manufacturer" required>
              <Input value={form.manufacturer} onChange={set('manufacturer')} placeholder="Cipla Ltd." required />
            </FormField>
            <FormField label="Country of Origin">
              <Input value={form.countryOfOrigin} onChange={set('countryOfOrigin')} placeholder="India" />
            </FormField>
            <FormField label="Manufacturer Address" className="sm:col-span-2">
              <Textarea value={form.manufacturerAddress} onChange={set('manufacturerAddress')} placeholder="Full registered address…" rows={2} />
            </FormField>
          </div>
        </div>

        {/* MEDIA */}
        <div style={{ display: activeStep === 'media' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Image className="w-4 h-4 text-primary" /> Product Images & Keywords</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Upload product images and searchable keywords</p>
          </div>
          <div className="space-y-4">
            <FormField label="Images" note="Upload files or paste URLs. First image auto-set as primary.">
              <ImageManager value={form.images} onChange={v => setV('images', v)} />
            </FormField>
            <FormField label="Search Keywords" note="Press Enter to add; used for full-text search">
              <TagInput value={form.searchKeywords} onChange={v => setV('searchKeywords', v)} placeholder="e.g. painkiller, antipyretic" />
            </FormField>
          </div>
        </div>

        {/* INVENTORY BOOTSTRAP */}
        <div style={{ display: activeStep === 'inventory' ? 'block' : 'none' }}>
          <div className="mb-4">
            <h4 className="text-sm font-bold text-base-content flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Initial Inventory</h4>
            <p className="text-[11px] text-base-content/40 mt-0.5">Optionally seed stock at a pharmacy store on creation</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Store" note="Select a pharmacy store">
              <SelectEl value={form.storeId} onChange={set('storeId')}>
                <option value="">— Catalogue-only (no store) —</option>
                {stores.map(s => <option key={s._id} value={s._id}>{s.storeName}</option>)}
              </SelectEl>
            </FormField>
            <FormField label="Initial Stock (units)">
              <Input type="number" min={0} value={form.initialStock} onChange={set('initialStock')} placeholder="0" />
            </FormField>
            <FormField label="Batch Number">
              <Input value={form.batchNumber} onChange={set('batchNumber')} placeholder="BATCH-001" />
            </FormField>
            <FormField label="Expiry Date">
              <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} />
            </FormField>
            <FormField label="Store Price per Unit (₹)" note="Defaults to MRP if blank">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 font-bold text-sm">₹</span>
                <Input type="number" min={0} step={0.01} value={form.pricePerUnit} onChange={set('pricePerUnit')} placeholder="0.00" className="pl-6" />
              </div>
            </FormField>
          </div>

          {isAdmin && initial?._id && (
            <div className="mt-4 pt-4 border-t border-base-300 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">Status & Approval</p>
              <div className="flex gap-3 flex-wrap">
                <FormField label="Approved for Listing">
                  <button type="button" onClick={() => setV('isApproved', !form.isApproved)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-[var(--r-field)] border text-xs font-bold transition-all ${
                      form.isApproved ? 'border-success/40 bg-success/10 text-success' : 'border-base-300 bg-base-200/50 text-base-content/40'
                    }`}>
                    {form.isApproved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {form.isApproved ? 'Approved' : 'Pending'}
                  </button>
                </FormField>
                <FormField label="Discontinued">
                  <button type="button" onClick={() => setV('isDiscontinued', !form.isDiscontinued)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-[var(--r-field)] border text-xs font-bold transition-all ${
                      form.isDiscontinued ? 'border-error/40 bg-error/10 text-error' : 'border-base-300 bg-base-200/50 text-base-content/40'
                    }`}>
                    {form.isDiscontinued ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {form.isDiscontinued ? 'Discontinued' : 'Active'}
                  </button>
                </FormField>
              </div>
              {form.isDiscontinued && (
                <FormField label="Discontinuation Reason">
                  <Input value={form.discontinuedReason} onChange={set('discontinuedReason')} placeholder="Reason for discontinuation…" />
                </FormField>
              )}
            </div>
          )}
        </div>

        {/* STEP NAVIGATION */}
        <div className="flex items-center justify-between pt-4 border-t border-base-300">
          <div className="flex gap-2">
            {FORM_STEPS.findIndex(s => s.id === activeStep) > 0 && (
              <Btn type="button" variant="ghost" size="sm"
                onClick={() => { const idx = FORM_STEPS.findIndex(s => s.id === activeStep); setActiveStep(FORM_STEPS[idx - 1].id); }}>
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Btn>
            )}
            {FORM_STEPS.findIndex(s => s.id === activeStep) < FORM_STEPS.length - 1 && (
              <Btn type="button" variant="outline" size="sm"
                onClick={() => { const idx = FORM_STEPS.findIndex(s => s.id === activeStep); setActiveStep(FORM_STEPS[idx + 1].id); }}>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Btn>
            )}
          </div>
          <div className="flex items-center gap-1">
            {FORM_STEPS.map((step) => (
              <button key={step.id} type="button" onClick={() => setActiveStep(step.id)}
                className={`transition-all rounded-full ${activeStep === step.id ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-base-300 hover:bg-primary/50'}`} />
            ))}
          </div>
          <Btn type="submit" variant="primary" size="md" loading={loading}>
            <Plus className="w-3.5 h-3.5" />
            {initial?._id ? 'Save Changes' : 'Create Medicine'}
          </Btn>
        </div>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STOCK FORM
// ─────────────────────────────────────────────────────────────────────────────
const UpdateStockForm = ({ medicineId, onSubmit, loading, stores = [], isPharmacy = false }) => {
  const [form, setForm] = useState({ storeId: '', quantity: '', expiryDate: '', batchNumber: '', pricePerUnit: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const stockData = {
      quantity:     Number(form.quantity),
      expiryDate:   form.expiryDate   || undefined,
      batchNumber:  form.batchNumber  || undefined,
      pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : undefined,
    };
    if (!isPharmacy && form.storeId) stockData.storeId = form.storeId;
    onSubmit(medicineId, stockData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isPharmacy ? (
          <FormField label="Store" note="Auto-resolved from your assigned pharmacy store" className="sm:col-span-2">
            <div className={`${inputBase} bg-base-200/50 text-base-content/40 cursor-not-allowed`}>
              Your assigned store (auto-detected)
            </div>
          </FormField>
        ) : (
          <FormField label="Store" required note="Target store to adjust stock">
            <SelectEl value={form.storeId} onChange={set('storeId')} required>
              <option value="">— Select store —</option>
              {stores.map(s => <option key={s._id} value={s._id}>{s.storeName}</option>)}
            </SelectEl>
          </FormField>
        )}
        <FormField label="New Quantity" required note="Absolute level, not a delta">
          <Input type="number" min={0} value={form.quantity} onChange={set('quantity')} placeholder="100" required />
        </FormField>
        <FormField label="Batch Number">
          <Input value={form.batchNumber} onChange={set('batchNumber')} placeholder="BATCH-002" />
        </FormField>
        <FormField label="Expiry Date">
          <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} />
        </FormField>
        <FormField label="Price per Unit (₹)">
          <Input type="number" min={0} step={0.01} value={form.pricePerUnit} onChange={set('pricePerUnit')} placeholder="0.00" />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Btn type="submit" variant="success" loading={loading}>
          <Package className="w-3.5 h-3.5" /> Update Stock
        </Btn>
      </div>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HSN FORM
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_HSN = { hsnCode: '', description: '', chapterHeading: '', gstPercentage: 5 };

const HsnForm = ({ initial, onSubmit, loading }) => {
  const [form, setForm] = useState({ ...DEFAULT_HSN, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSubmit = (e) => { e.preventDefault(); onSubmit({ ...form, gstPercentage: Number(form.gstPercentage) }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="HSN Code" required note="4–8 digit numeric code">
          <Input value={form.hsnCode} onChange={set('hsnCode')} placeholder="3004" maxLength={8} required disabled={!!initial?.hsnCode} />
        </FormField>
        <FormField label="GST %" required note="Valid slabs: 0, 5, 12, 18, 28">
          <SelectEl value={form.gstPercentage} onChange={set('gstPercentage')} required>
            {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
          </SelectEl>
        </FormField>
        <FormField label="Chapter Heading" className="sm:col-span-2">
          <Input value={form.chapterHeading} onChange={set('chapterHeading')} placeholder="Chapter 30 – Pharmaceutical Products" />
        </FormField>
        <FormField label="Description" required className="sm:col-span-2">
          <Textarea value={form.description} onChange={set('description')} placeholder="Medicaments for retail sale…" required />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Btn type="submit" variant="primary" loading={loading}>
          <Plus className="w-3.5 h-3.5" /> {initial?.hsnCode ? 'Update HSN' : 'Create HSN'}
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
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleDrop   = (e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]); };
  const handleSubmit = () => { if (!file) return; const fd = new FormData(); fd.append('file', file); onUpload(fd); };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-[var(--r-box)] p-8 text-center transition-all cursor-pointer ${drag ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50 hover:bg-base-200/40'}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className={`w-12 h-12 rounded-[var(--r-box)] mx-auto mb-3 flex items-center justify-center ${drag ? 'bg-primary/20' : 'bg-base-200'}`}>
          <UploadCloud className={`w-6 h-6 ${drag ? 'text-primary' : 'text-base-content/30'}`} />
        </div>
        <p className="text-sm font-semibold text-base-content/60">{file ? file.name : 'Drop Excel / CSV or click to browse'}</p>
        <p className="text-[11px] text-base-content/30 mt-1">.xlsx · .xls · .csv · .pdf · Max 20 MB</p>
        <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv,.pdf" onChange={e => setFile(e.target.files[0])} />
      </div>

      {file && (
        <div className="flex items-center gap-3 p-3 bg-base-200 border border-base-300 rounded-[var(--r-field)]">
          <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-base-content truncate">{file.name}</p>
            <p className="text-[10px] text-base-content/40">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Btn variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setFile(null); }}><X className="w-3.5 h-3.5" /></Btn>
        </div>
      )}

      <Btn variant="primary" loading={loading} disabled={!file || loading} onClick={handleSubmit} className="w-full">
        <UploadCloud className="w-4 h-4" /> Upload & Bulk-Upsert HSN Codes
      </Btn>

      {uploadResult && (
        <motion.div className="bg-base-200 border border-base-300 rounded-[var(--r-box)] p-4 space-y-3" variants={fadeIn} initial="hidden" animate="visible">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-base-content">Upload Result</p>
            <button onClick={onClearResult} className="text-base-content/30 hover:text-base-content"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Rows', value: uploadResult.result?.totalRows, color: 'text-info' },
              { label: 'Inserted',   value: uploadResult.result?.inserted,  color: 'text-success' },
              { label: 'Updated',    value: uploadResult.result?.updated,   color: 'text-warning' },
              { label: 'Skipped',    value: uploadResult.result?.skipped,   color: 'text-error' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center bg-base-100 border border-base-300 rounded-[var(--r-field)] p-2">
                <p className={`text-xl font-black ${color}`}>{value ?? 0}</p>
                <p className="text-[9px] text-base-content/40 font-bold uppercase mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {uploadResult.result?.errors?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold text-error uppercase tracking-widest mb-1">Row Errors</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {uploadResult.result.errors.map((err, i) => (
                  <p key={i} className="text-[10px] text-error/80 bg-error/10 border border-error/20 rounded px-2 py-1">{err}</p>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE LIST ITEM
// ─────────────────────────────────────────────────────────────────────────────
const MedicineListItem = ({ med, isSelected, onSelect }) => {
  const primaryImg = med.images?.find(i => i.isPrimary) || med.images?.[0];
  return (
    <motion.button variants={fadeUp} onClick={() => onSelect(med)}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-[var(--r-field)] transition-all duration-150 border ${
        isSelected ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-transparent border-transparent hover:bg-base-200 hover:border-base-300'
      }`}>
      <div className="w-10 h-10 rounded-[var(--r-field)] overflow-hidden flex-shrink-0 bg-base-200 border border-base-300 flex items-center justify-center">
        {primaryImg ? <img src={primaryImg.url} alt={med.brandName} className="w-full h-full object-cover" /> : <Pill className="w-4 h-4 text-base-content/20" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className={`text-xs font-bold truncate ${isSelected ? 'text-primary' : 'text-base-content'}`}>{med.brandName}</p>
          {med.isPrescriptionRequired && <span className="text-[7px] font-black bg-warning/20 text-warning border border-warning/30 px-1 py-0.5 rounded-full flex-shrink-0">Rx</span>}
        </div>
        <p className="text-[10px] text-base-content/40 truncate">{med.genericName} · {med.dosage}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[9px] font-black text-base-content/60">₹{med.mrp}</span>
          <span className="w-1 h-1 rounded-full bg-base-content/20" />
          <span className={`text-[9px] font-bold ${med.isDiscontinued ? 'text-error' : 'text-success'}`}>
            {med.isDiscontinued ? 'Discontinued' : 'Active'}
          </span>
        </div>
      </div>
      {isSelected && <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />}
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINE DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
const MedicineDetailPanel = ({
  med, onEdit, onStock, onDiscontinue, onRestock, onSyncSingle,
  actionLoading, syncLoading, canAdmin,
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!med) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-base-content/20">
        <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center">
          <PackageSearch className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-base-content/30">No medicine selected</p>
          <p className="text-xs text-base-content/20 mt-0.5">Click any medicine from the list</p>
        </div>
      </div>
    );
  }

  const primaryImg     = med.images?.find(i => i.isPrimary) || med.images?.[0];
  const hsnObj         = extractHsnObj(med.hsnCode);
  const hsnCodeStr     = extractHsnString(med.hsnCode);
  const hsnDescription = hsnObj?.description || '—';
  const hsnChapter     = hsnObj?.chapterHeading || '—';
  const hsnGst         = hsnObj?.gstPercentage ?? med.gstPercentage ?? 0;

  const detailTabs = [
    { value: 'overview',  label: 'Overview',  icon: Eye },
    { value: 'clinical',  label: 'Clinical',  icon: Stethoscope },
    { value: 'inventory', label: 'Inventory', icon: Layers },
    { value: 'pricing',   label: 'Pricing',   icon: DollarSign },
  ];

  const InfoRow = ({ label, value, highlight }) => (
    <div className="flex items-start gap-2 py-2 border-b border-base-300/40 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/35 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs font-semibold flex-1 ${highlight ? 'text-primary' : 'text-base-content/80'}`}>{value || '—'}</span>
    </div>
  );

  const TagList = ({ items, color = 'neutral' }) => {
    if (!items?.length) return <span className="text-xs text-base-content/30">None recorded</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => <Badge key={i} color={color}>{item}</Badge>)}
      </div>
    );
  };

  return (
    <motion.div key={med._id} variants={slideRight} initial="hidden" animate="visible" exit="exit" className="h-full flex flex-col">
      {/* Hero */}
      <div className="relative flex-shrink-0">
        <div className="h-28 bg-gradient-to-br from-primary/15 via-primary/5 to-base-200 rounded-t-[var(--r-box)] overflow-hidden relative">
          {primaryImg && <img src={primaryImg.url} alt="" className="w-full h-full object-cover opacity-10" />}
          <div className="absolute inset-0 bg-gradient-to-r from-base-100/30 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 px-5 flex items-end gap-3">
          <div className="w-16 h-16 rounded-[var(--r-box)] border-2 border-base-100 bg-base-200 overflow-hidden flex items-center justify-center shadow-[var(--shadow-depth)] flex-shrink-0">
            {primaryImg ? <img src={primaryImg.url} alt={med.brandName} className="w-full h-full object-cover" /> : <Pill className="w-7 h-7 text-primary/40" />}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="pt-12 px-5 pb-4 flex-shrink-0 border-b border-base-300">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-black text-base-content">{med.brandName}</h2>
              <Badge color={med.isDiscontinued ? 'error' : 'success'} size="xs">{med.isDiscontinued ? 'Discontinued' : 'Active'}</Badge>
            </div>
            <p className="text-xs text-base-content/50">{med.genericName} · {med.dosage} · {med.category}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge color="neutral">{med.schedule}</Badge>
              {med.isPrescriptionRequired  && <Badge color="warning">Prescription Required</Badge>}
              {med.narcoticLicenceRequired && <Badge color="error">Narcotic</Badge>}
              {med.therapeuticClass        && <Badge color="info">{med.therapeuticClass}</Badge>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black text-base-content">₹{med.mrp}</p>
            <p className="text-[10px] text-base-content/40 font-medium">MRP incl. {med.gstPercentage ?? 0}% GST</p>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-base-300 flex-shrink-0 bg-base-200/30 flex-wrap">
        <Btn variant="primary" size="sm" onClick={() => onEdit(med)} className="flex-1">
          <Pencil className="w-3 h-3" /> Edit
        </Btn>
        <Btn variant="outline" size="sm" onClick={() => onStock(med._id)} className="flex-1">
          <Package className="w-3 h-3" /> Update Stock
        </Btn>
        {/* [M10] Single medicine inventory sync — admin / superadmin only */}
        {canAdmin && (
          <Btn variant="outline" size="sm" onClick={() => onSyncSingle(med._id)} loading={syncLoading}
            title="Sync inventory entries for all stores (adds zero-stock for missing stores)">
            <RefreshCcw className="w-3 h-3 text-info" />
          </Btn>
        )}
        <Btn variant="outline" size="sm" onClick={() => onRestock(med._id)}>
          <AlertTriangle className="w-3 h-3 text-warning" />
        </Btn>
        {canAdmin && !med.isDiscontinued && (
          <Btn variant="danger" size="sm" onClick={() => onDiscontinue(med._id)} loading={actionLoading}>
            <Trash2 className="w-3 h-3" />
          </Btn>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-base-300 flex-shrink-0 px-2">
        {detailTabs.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold border-b-2 transition-all ${
              activeTab === tab.value ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content'
            }`}>
            <tab.icon className="w-3 h-3" />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {activeTab === 'overview' && (
            <motion.div key="overview" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              {med.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {med.images.map((img, i) => (
                    <div key={i} className={`relative flex-shrink-0 w-24 h-24 rounded-[var(--r-field)] overflow-hidden border-2 ${img.isPrimary ? 'border-primary' : 'border-base-300'}`}>
                      <img src={img.url} alt={img.altText} className="w-full h-full object-cover" />
                      {img.isPrimary && <div className="absolute bottom-0 inset-x-0 bg-primary text-primary-content text-[7px] font-black text-center py-0.5">PRIMARY</div>}
                    </div>
                  ))}
                </div>
              )}
              {med.description && (
                <div className="bg-base-200/50 border border-base-300 rounded-[var(--r-field)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mb-1">Description</p>
                  <p className="text-xs text-base-content/70 leading-relaxed">{med.description}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mb-2">Core Details</p>
                <div className="bg-base-100 border border-base-300 rounded-[var(--r-field)] px-3">
                  <InfoRow label="Manufacturer" value={med.manufacturer} />
                  <InfoRow label="Country"      value={med.countryOfOrigin} />
                  <InfoRow label="Drug Form"    value={med.drugForm} />
                  <InfoRow label="Packaging"    value={med.packaging} />
                  <InfoRow label="Pack Size"    value={med.packSize ? `${med.packSize} ${med.packUnit || ''}` : undefined} />
                  <InfoRow label="ATC Code"     value={med.atcCode} highlight />
                </div>
              </div>
              {med.saltComposition?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mb-2">Salt Composition</p>
                  <div className="flex flex-wrap gap-1.5">
                    {med.saltComposition.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-base-200 border border-base-300 rounded-[var(--r-field)] px-2.5 py-1.5 text-[11px] font-semibold text-base-content/70">
                        <FlaskConical className="w-2.5 h-2.5 text-primary" />
                        {s.ingredient} · {s.strength} {s.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'clinical' && (
            <motion.div key="clinical" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              <div className="space-y-3">
                {[
                  { label: 'Indications',       items: med.indications,       color: 'success' },
                  { label: 'Contraindications',  items: med.contraindications, color: 'error' },
                  { label: 'Side Effects',       items: med.sideEffects,       color: 'warning' },
                  { label: 'Drug Interactions',  items: med.interactions,      color: 'info' },
                  { label: 'Warnings',           items: med.warnings,          color: 'error' },
                ].map(({ label, items, color }) => (
                  <div key={label}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest text-${color}/70 mb-1.5`}>{label}</p>
                    <TagList items={items} color={color} />
                  </div>
                ))}
              </div>
              {med.storageConditions && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mb-2">Storage</p>
                  <div className="bg-base-100 border border-base-300 rounded-[var(--r-field)] px-3">
                    <InfoRow label="Temperature" value={med.storageConditions.temperature?.label || (med.storageConditions.temperature?.min != null && med.storageConditions.temperature?.max != null ? `${med.storageConditions.temperature.min}°C – ${med.storageConditions.temperature.max}°C` : undefined)} />
                    <InfoRow label="Light Sensitive"    value={med.storageConditions.lightSensitive    ? 'Yes' : 'No'} />
                    <InfoRow label="Moisture Sensitive" value={med.storageConditions.moistureSensitive ? 'Yes' : 'No'} />
                    <InfoRow label="Cold Chain"         value={med.storageConditions.requiresColdChain ? 'Required' : 'Not Required'} />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div key="inventory" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-3">
              {med.inventory?.length > 0 ? (
                med.inventory.map((inv, i) => (
                  <div key={i} className="bg-base-100 border border-base-300 rounded-[var(--r-box)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-base-content">{inv.storeId?.storeName || inv.storeName || `Store ${i + 1}`}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge color={inv.isActive ? 'success' : 'error'} size="xs">{inv.isActive ? 'Active' : 'Paused'}</Badge>
                        <Badge color={inv.isLowStock ? 'warning' : 'success'}>{inv.isLowStock ? 'Low Stock' : 'Adequate'}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Stock Qty',  value: inv.stockQuantity, large: true },
                        { label: 'Batch',      value: inv.batchNumber || '—' },
                        { label: 'Expiry',     value: inv.expiryDate ? new Date(inv.expiryDate).toLocaleDateString('en-IN') : '—' },
                        { label: 'Price/Unit', value: inv.pricePerUnit ? `₹${inv.pricePerUnit}` : '—' },
                      ].map(({ label, value, large }) => (
                        <div key={label} className="bg-base-200/50 rounded-[var(--r-field)] p-2.5">
                          <p className="text-[9px] font-bold uppercase text-base-content/30 mb-0.5">{label}</p>
                          <p className={`font-bold text-base-content ${large ? 'text-xl' : 'text-sm'}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-base-content/20">
                  <Boxes className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">No inventory data</p>
                  <p className="text-xs mt-1 text-base-content/15">Assign this medicine to a store to track stock</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'pricing' && (
            <motion.div key="pricing" variants={fadeIn} initial="hidden" animate="visible" className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'MRP',      value: `₹${med.mrp}`,               note: 'Max Retail Price',  large: true, color: 'text-base-content' },
                  { label: 'GST Rate', value: `${hsnGst}%`,                note: 'Applied GST',       color: 'text-primary' },
                  { label: 'PTR',      value: med.ptr ? `₹${med.ptr}` : '—', note: 'Price to Retailer' },
                  { label: 'PTS',      value: med.pts ? `₹${med.pts}` : '—', note: 'Price to Stockist' },
                ].map(({ label, value, note, large, color }) => (
                  <div key={label} className="bg-base-100 border border-base-300 rounded-[var(--r-box)] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-base-content/30 mb-0.5">{label}</p>
                    <p className={`font-black ${large ? 'text-2xl' : 'text-base'} ${color || 'text-base-content'}`}>{value}</p>
                    <p className="text-[9px] text-base-content/30 mt-0.5">{note}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mb-2">HSN Details</p>
                <div className="bg-base-100 border border-base-300 rounded-[var(--r-field)] px-3">
                  <InfoRow label="HSN Code"    value={hsnCodeStr || '—'} highlight />
                  <InfoRow label="Chapter"     value={hsnChapter} />
                  <InfoRow label="Description" value={hsnDescription} />
                  <InfoRow label="GST"         value={`${hsnGst}%`} />
                  {hsnObj && (
                    <>
                      <InfoRow label="CGST" value={`${hsnObj.cgstPercentage ?? hsnGst / 2}%`} />
                      <InfoRow label="SGST" value={`${hsnObj.sgstPercentage ?? hsnGst / 2}%`} />
                      <InfoRow label="IGST" value={`${hsnObj.igstPercentage ?? hsnGst}%`} />
                    </>
                  )}
                </div>
              </div>
              {med.regulatoryInfo && Object.values(med.regulatoryInfo).some(Boolean) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mb-2">Regulatory IDs</p>
                  <div className="bg-base-100 border border-base-300 rounded-[var(--r-field)] px-3">
                    {med.regulatoryInfo.cdscoDrugLicenceNo && <InfoRow label="CDSCO"          value={med.regulatoryInfo.cdscoDrugLicenceNo} />}
                    {med.regulatoryInfo.stateLicenceNo     && <InfoRow label="State Licence"  value={med.regulatoryInfo.stateLicenceNo} />}
                    {med.regulatoryInfo.importLicenceNo    && <InfoRow label="Import Licence" value={med.regulatoryInfo.importLicenceNo} />}
                    {med.regulatoryInfo.fdaApprovalNo      && <InfoRow label="FDA Approval"   value={med.regulatoryInfo.fdaApprovalNo} />}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE CARD
// ─────────────────────────────────────────────────────────────────────────────
const StoreCard = ({ store, onSuspend, onUnsuspend, onDelete, onTriggerLowStock, actionLoading, isSuperAdmin, isAdmin }) => {
  const statusColor = storeStatusColor(store.status);
  return (
    <motion.div variants={fadeUp} className="card bg-base-100 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[var(--r-field)] bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate">{store.storeName}</p>
            <p className="text-[10px] text-base-content/40 truncate">{store.address?.city || '—'} · {store.storeType || '—'}</p>
          </div>
        </div>
        <Badge color={statusColor}>{store.status}</Badge>
      </div>

      {store.contact?.email && (
        <p className="text-[10px] text-base-content/50 truncate">{store.contact.email}</p>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-base-300">
        {/* [SL4] Trigger low-stock alerts */}
        {(isAdmin || isSuperAdmin) && (
          <Btn variant="ghost" size="xs" onClick={() => onTriggerLowStock(store._id)}
            loading={actionLoading} title="Trigger low-stock alerts for this store">
            <Bell className="w-3 h-3 text-warning" /> Alerts
          </Btn>
        )}
        {/* [SL2] Suspend */}
        {(isAdmin || isSuperAdmin) && store.status === 'Open' && (
          <Btn variant="warning" size="xs" onClick={() => onSuspend(store._id)}
            loading={actionLoading}>
            <Pause className="w-3 h-3" /> Suspend
          </Btn>
        )}
        {/* [SL3] Unsuspend */}
        {(isAdmin || isSuperAdmin) && store.status === 'Under-Maintenance' && (
          <Btn variant="success" size="xs" onClick={() => onUnsuspend(store._id)}
            loading={actionLoading}>
            <Play className="w-3 h-3" /> Reopen
          </Btn>
        )}
        {/* [SL1] Delete — superadmin only */}
        {isSuperAdmin && (
          <Btn variant="danger" size="xs" onClick={() => onDelete(store._id)}
            loading={actionLoading}>
            <Trash2 className="w-3 h-3" /> Delete
          </Btn>
        )}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS TAB
// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsTab = ({ stats, hsnStats }) => {
  const categoryData = (stats.categoryDistribution || []).slice(0, 8).map(c => ({ name: c._id || 'Unknown', count: c.count, avg: Math.round(c.avgPrice || 0) }));
  const gstData      = (hsnStats.gstDistribution   || []).map(g => ({ name: `${g._id}%`, value: g.count }));
  const sourceData   = (hsnStats.sourceBreakdown   || []).map(s => ({ name: s._id || 'Unknown', value: s.count }));
  const avData       = (hsnStats.activeVsInactive  || []).map(a => ({ name: a._id ? 'Active' : 'Inactive', value: a.count }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-base-100 border border-base-300 rounded-[var(--r-field)] px-3 py-2 text-xs shadow-[var(--shadow-depth)]">
        <p className="text-base-content/50 mb-1 font-semibold">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}</p>)}
      </div>
    );
  };
  const ChartCard = ({ title, children }) => (
    <motion.div variants={fadeUp} className="card bg-base-100 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-4">{title}</p>
      {children}
    </motion.div>
  );
  const Empty = ({ label }) => (
    <div className="h-[180px] flex items-center justify-center text-base-content/20 text-xs font-semibold">{label}</div>
  );

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="visible">
      <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" variants={stagger}>
        <StatCard icon={Package}       label="Total Stock"    value={stats.totalStock?.toLocaleString()} color="primary" sublabel="All stores" />
        <StatCard icon={AlertTriangle} label="Low Stock"      value={stats.lowStockAlerts}               color="warning" sublabel="Below reorder" />
        <StatCard icon={Clock}         label="Expiring Soon"  value={stats.expiryAlerts}                 color="error"   sublabel="Within 30 days" />
        <StatCard icon={XCircle}       label="Discontinued"   value={stats.discontinuedCount}            color="info"    sublabel="Withdrawn" />
        <StatCard icon={Tag}           label="HSN Codes"      value={hsnStats.total != null ? hsnStats.total : '—'} color="success" sublabel="Active" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Medicine Category Distribution">
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={categoryData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300, #e5e7eb)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--base-content)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty label="No data yet" />}
        </ChartCard>

        <ChartCard title="HSN GST Slab Distribution">
          {gstData.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={gstData} cx="50%" cy="50%" innerRadius={52} outerRadius={88}
                  dataKey="value" nameKey="name" paddingAngle={3}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                  {gstData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty label="No HSN data yet" />}
        </ChartCard>

        <ChartCard title="HSN Upload Sources">
          {sourceData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300, #e5e7eb)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Count" fill="var(--secondary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty label="No source data" />}
        </ChartCard>

        <ChartCard title="HSN Active vs Inactive">
          {avData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={avData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={4}>
                  <Cell fill="var(--success)" />
                  <Cell fill="var(--error)" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty label="No HSN data yet" />}
        </ChartCard>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HSN TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────
const HsnRow = ({ hsn, onEdit, onDelete, actionLoading, selected, onSelect, canAdmin }) => (
  <motion.tr variants={fadeIn} className="border-b border-base-300/50 hover:bg-base-200/30 transition-colors text-sm">
    <td className="py-3 px-4">
      <input type="checkbox" checked={selected} onChange={onSelect} className="rounded border-base-300 bg-base-200 text-primary focus:ring-primary/30" />
    </td>
    <td className="py-3 px-4 font-mono font-bold text-primary">{hsn.hsnCode}</td>
    <td className="py-3 px-4 text-base-content/60 text-xs max-w-[260px] truncate">{hsn.description}</td>
    <td className="py-3 px-4">
      <Badge color={hsn.gstPercentage === 0 ? 'success' : hsn.gstPercentage <= 5 ? 'info' : 'warning'}>{hsn.gstPercentage}%</Badge>
    </td>
    <td className="py-3 px-4"><Badge color={hsn.isActive ? 'success' : 'error'}>{hsn.isActive ? 'Active' : 'Inactive'}</Badge></td>
    <td className="py-3 px-4 text-base-content/40 text-xs">{hsn.uploadSource}</td>
    <td className="py-3 px-4">
      <div className="flex items-center gap-1.5">
        <Btn variant="ghost" size="sm" onClick={() => onEdit(hsn)} disabled={!hsn.isActive}><Pencil className="w-3 h-3" /></Btn>
        {canAdmin && hsn.isActive && (
          <Btn variant="ghost" size="sm" onClick={() => onDelete(hsn.hsnCode)} loading={actionLoading}><Trash2 className="w-3 h-3 text-error" /></Btn>
        )}
      </div>
    </td>
  </motion.tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// SUSPEND STORE MODAL FORM
// ─────────────────────────────────────────────────────────────────────────────
const SuspendStoreForm = ({ store, onSubmit, onCancel, loading }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-[var(--r-box)]">
        <Pause className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm text-base-content/70">
          <p className="font-bold text-base-content mb-1">Suspend "{store?.storeName}"?</p>
          <p>This will set the store status to <strong>Under-Maintenance</strong> and pause all inventory entries. Customers cannot order from this store until unsuspended.</p>
        </div>
      </div>
      <FormField label="Suspension Reason (optional)">
        <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Scheduled maintenance, health inspection…" rows={2} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="warning" loading={loading} onClick={() => onSubmit(store._id, reason)}>
          <Pause className="w-3.5 h-3.5" /> Suspend Store
        </Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MedicinesManagement() {
  const dispatch = useDispatch();

  // ── Auth ─────────────────────────────────────────────────────────────────
  const user         = useSelector((s) => s.user?.user) ?? null;
  const userRole     = user?.role || '';
  const isAdmin      = ['admin', 'superadmin'].includes(userRole);
  const isSuperAdmin = userRole === 'superadmin';
  const isPharmacy   = userRole === 'pharmacy';

  // ── Redux state — Medicine ────────────────────────────────────────────────
  const medicines     = useSelector(selectAllMedicines);
  const currentMed    = useSelector(selectCurrentMedicine);
  const stats         = useSelector(selectMedicineStats);
  const loading       = useSelector(selectMedicineLoading);
  const detailLoading = useSelector(selectMedicineDetailLoading);
  const actionLoading = useSelector(selectMedicineActionLoading);
  const syncLoading   = useSelector(selectMedicineSyncLoading);  // [M9, M10]
  const medPagination = useSelector(selectMedicinePagination);
  const error         = useSelector(selectMedicineError);
  const syncResult    = useSelector(selectSyncResult);           // last sync op result from slice

  // ── Redux state — Inventory ────────────────────────────────────────────────
  const inventoryLoading = useSelector(selectInventoryLoading);
  const lowStockReport   = useSelector(selectLowStockReport);
  const expiryAlerts     = useSelector(selectExpiryAlerts);

  // ── Redux state — HSN ─────────────────────────────────────────────────────
  const hsnCodes      = useSelector(selectAllHsnCodes);
  const currentHsn    = useSelector(selectCurrentHsnCode);
  const hsnStats      = useSelector(selectHsnStats);
  const hsnPagination = useSelector(selectHsnPagination);
  const uploadResult  = useSelector(selectHsnUploadResult);
  const hsnLoading    = useSelector(selectHsnLoading);

  // ── Redux state — Stores ──────────────────────────────────────────────────
  const stores              = useSelector(selectAllStores);
  const storePagination     = useSelector(selectStorePagination);
  const storeLoading        = useSelector(selectStoreLoading);
  const storeActionLoading  = useSelector(selectStoreActionLoading);
  const storeLifecycleResult = useSelector(selectStoreLifecycleResult);

  // ── Local UI ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('analytics');

  // Medicine filters
  const [medSearch,   setMedSearch]   = useState('');
  const [medCategory, setMedCategory] = useState('');
  const [medSchedule, setMedSchedule] = useState('');
  const [medSort,     setMedSort]     = useState('newest');
  const [medPage,     setMedPage]     = useState(1);

  const [selectedMed, setSelectedMed] = useState(null);

  // HSN filters
  const [hsnSearch, setHsnSearch] = useState('');
  const [hsnGst,    setHsnGst]    = useState('');
  const [hsnSort,   setHsnSort]   = useState('hsnCode');
  const [hsnActive, setHsnActive] = useState('true');
  const [hsnPage,   setHsnPage]   = useState(1);

  // Store filters
  const [storeSearch,   setStoreSearch]   = useState('');
  const [storeStatus,   setStoreStatus]   = useState('');
  const [storeType,     setStoreType]     = useState('');
  const [storePage,     setStorePage]     = useState(1);

  // Sync modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  // local sync result banner (for single sync, since slice's syncResult is also used)
  const [localSyncResult, setLocalSyncResult] = useState(null);

  // Modals
  const [showCreateMed,    setShowCreateMed]    = useState(false);
  const [showEditMed,      setShowEditMed]       = useState(false);
  const [showStockModal,   setShowStockModal]    = useState(false);
  const [showCreateHsn,    setShowCreateHsn]     = useState(false);
  const [showEditHsn,      setShowEditHsn]       = useState(false);
  const [showUploadHsn,    setShowUploadHsn]     = useState(false);
  const [showRestockModal, setShowRestockModal]  = useState(false);
  const [showSuspendModal, setShowSuspendModal]  = useState(false);
  const [suspendTarget,    setSuspendTarget]     = useState(null);

  const [editHsnData,      setEditHsnData]       = useState(null);
  const [stockMedId,       setStockMedId]        = useState(null);
  const [restockMedId,     setRestockMedId]      = useState('');
  const [restockQty,       setRestockQty]        = useState('');
  const [selectedHsnCodes, setSelectedHsnCodes]  = useState([]);

  // ── Initial data ──────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchInventoryStats());
    dispatch(fetchHsnStats());
  }, [dispatch]);

  // ── Medicine list effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'medicines') return;
    const params = { page: medPage, limit: 20, sort: medSort };
    if (medSearch)   params.search   = medSearch;
    if (medCategory) params.category = medCategory;
    if (medSchedule) params.schedule = medSchedule;
    dispatch(fetchMedicines(params));
  }, [dispatch, activeTab, medPage, medSort, medSearch, medCategory, medSchedule]);

  // ── HSN list effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'hsn') return;
    const params = { page: hsnPage, limit: 20, sort: hsnSort, isActive: hsnActive };
    if (hsnSearch) params.search = hsnSearch;
    if (hsnGst)    params.gst    = hsnGst;
    dispatch(fetchHsnCodes(params));
  }, [dispatch, activeTab, hsnPage, hsnSort, hsnSearch, hsnGst, hsnActive]);

  // ── Stores list effect — [S1] ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'stores') return;
    const params = { page: storePage, limit: 12 };
    if (storeSearch) params.search    = storeSearch;
    if (storeStatus) params.status    = storeStatus;
    if (storeType)   params.storeType = storeType;
    dispatch(fetchStores(params));
  }, [dispatch, activeTab, storePage, storeSearch, storeStatus, storeType]);

  // ── Sync currentMed → selectedMed ────────────────────────────────────────
  useEffect(() => {
    if (currentMed) setSelectedMed(currentMed);
  }, [currentMed]);

  // ── Clear lifecycle result after 5s ──────────────────────────────────────
  useEffect(() => {
    if (!storeLifecycleResult) return;
    const t = setTimeout(() => dispatch(clearStoreLifecycleResult()), 5000);
    return () => clearTimeout(t);
  }, [storeLifecycleResult, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // MEDICINE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleSelectMed = useCallback((med) => {
    setSelectedMed(med);
    if (med?.slug) dispatch(fetchMedicineBySlug(med.slug));
  }, [dispatch]);

  const handleCreateMed = (data) =>
    dispatch(createMedicine(data)).unwrap()
      .then(() => { setShowCreateMed(false); dispatch(resetCurrentHsnCode()); })
      .catch(() => {});

  const handleEditMed = (data) =>
    dispatch(updateMedicine({ id: selectedMed._id, updateData: data })).unwrap()
      .then(() => { setShowEditMed(false); if (selectedMed?.slug) dispatch(fetchMedicineBySlug(selectedMed.slug)); })
      .catch(() => {});

  const handleUpdateStock = (id, stockData) =>
    dispatch(updateStock({ id, stockData })).unwrap()
      .then(() => { setShowStockModal(false); setStockMedId(null); if (selectedMed?.slug) dispatch(fetchMedicineBySlug(selectedMed.slug)); })
      .catch(() => {});

  const handleDiscontinue = (id) => {
    if (!confirm('Discontinue this medicine? All pharmacies will be notified.')) return;
    dispatch(discontinueMedicine(id)).then(() => { setSelectedMed(null); dispatch(resetCurrentMedicine()); });
  };

  const handleRestock = (e) => {
    e.preventDefault();
    if (!restockMedId || !restockQty) return;
    dispatch(sendRestockRequest({ medicineId: restockMedId, quantityRequired: Number(restockQty) })).unwrap()
      .then(() => { setShowRestockModal(false); setRestockQty(''); setRestockMedId(''); });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * [M10] handleSyncSingle
   * POST /api/v1/medicines/:id/sync-inventory
   * Adds zero-stock entries for stores missing from this medicine's inventory.
   * Uses the correct thunk name: syncMedicineInventory (from the slice).
   */
  const handleSyncSingle = useCallback(async (medicineId) => {
    setLocalSyncResult(null);
    try {
      const action = await dispatch(syncMedicineInventory(medicineId));
      setLocalSyncResult(action?.payload ?? null);
      // Refresh the detail view so new inventory entries appear
      if (selectedMed?.slug) dispatch(fetchMedicineBySlug(selectedMed.slug));
    } catch (err) {
      setLocalSyncResult({ error: err?.message || 'Sync failed' });
    }
  }, [dispatch, selectedMed]);

  /**
   * [M9] handleSyncAll
   * POST /api/v1/medicines/sync-inventory/all
   * Iterates every non-discontinued medicine and fills missing store entries.
   * Uses the correct thunk name: syncAllInventory (from the slice).
   */
  const handleSyncAll = useCallback(async () => {
    setShowSyncModal(false);
    setLocalSyncResult(null);
    try {
      const action = await dispatch(syncAllInventory());
      setLocalSyncResult(action?.payload ?? null);
      dispatch(fetchInventoryStats());
    } catch (err) {
      setLocalSyncResult({ error: err?.message || 'Bulk sync failed' });
    }
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // HSN HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateHsn = (data) =>
    dispatch(createHsnCode(data)).unwrap()
      .then(() => { setShowCreateHsn(false); dispatch(fetchHsnCodes({ page: 1 })); })
      .catch(() => {});

  const handleEditHsn = (data) =>
    dispatch(updateHsnCode({ code: editHsnData.hsnCode, updateData: data })).unwrap()
      .then(() => { setShowEditHsn(false); setEditHsnData(null); })
      .catch(() => {});

  const handleDeleteHsn  = (code) => { if (!confirm(`Deactivate HSN code ${code}?`)) return; dispatch(deleteHsnCode(code)); };
  const handleBulkDelete = () => { if (!selectedHsnCodes.length) return; if (!confirm(`Deactivate ${selectedHsnCodes.length} HSN code(s)?`)) return; dispatch(bulkDeleteHsnCodes(selectedHsnCodes)).unwrap().then(() => setSelectedHsnCodes([])); };
  const handleUploadHsn  = (formData) => dispatch(uploadHsnFile(formData)).unwrap().then(() => dispatch(fetchHsnCodes({ page: 1 })));
  const toggleHsnSelect  = (code) => setSelectedHsnCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  const selectAllHsn     = () => setSelectedHsnCodes(selectedHsnCodes.length === hsnCodes.length ? [] : hsnCodes.map(h => h.hsnCode));

  // ─────────────────────────────────────────────────────────────────────────
  // STORE LIFECYCLE HANDLERS [SL1–SL4]
  // ─────────────────────────────────────────────────────────────────────────

  /** [SL1] DELETE — superadmin only */
  const handleDeleteStore = useCallback((storeId) => {
    if (!confirm('Permanently delete this store? All medicine inventory entries for this store will be purged. This cannot be undone.')) return;
    dispatch(deleteStore(storeId)).then(() => dispatch(fetchStores({ page: storePage, limit: 12 })));
  }, [dispatch, storePage]);

  /** [SL2] PATCH suspend */
  const handleSuspendStore = useCallback((storeId, reason) => {
    dispatch(suspendStore({ storeId, reason })).unwrap()
      .then(() => { setShowSuspendModal(false); setSuspendTarget(null); dispatch(fetchStores({ page: storePage, limit: 12 })); })
      .catch(() => {});
  }, [dispatch, storePage]);

  /** [SL3] PATCH unsuspend */
  const handleUnsuspendStore = useCallback((storeId) => {
    if (!confirm('Reopen this store? Inventory will be restored and low-stock alerts will fire immediately.')) return;
    dispatch(unsuspendStore(storeId)).then(() => dispatch(fetchStores({ page: storePage, limit: 12 })));
  }, [dispatch, storePage]);

  /** [SL4] POST trigger low-stock alerts */
  const handleTriggerLowStock = useCallback((storeId) => {
    dispatch(triggerLowStockAlerts({ storeId }));
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const topTabs = [
    { value: 'analytics', label: 'Analytics', icon: BarChart2 },
    { value: 'medicines', label: 'Medicines',  icon: Pill },
    { value: 'hsn',       label: 'HSN Codes',  icon: Tag },
  ];
  // Stores tab visible only to admin/superadmin
  if (isAdmin) topTabs.push({ value: 'stores', label: 'Stores', icon: Store });

  return (
    <div className="min-h-screen bg-base-200/50">

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div className="bg-base-100 border-b border-base-300 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[var(--r-field)] bg-primary flex items-center justify-center">
              <Pill className="w-4 h-4 text-primary-content" />
            </div>
            <div>
              <p className="text-sm font-black text-base-content leading-none">Medicines</p>
              <p className="text-[9px] text-base-content/40 font-medium">Catalogue · HSN · Analytics{isAdmin ? ' · Stores' : ''}</p>
            </div>
          </div>

          <Tabs active={activeTab} onChange={setActiveTab} tabs={topTabs} />

          <div className="flex items-center gap-2">
            <Btn variant="ghost" size="sm"
              onClick={() => { dispatch(fetchInventoryStats()); dispatch(fetchHsnStats()); }}
              title="Refresh stats">
              <RefreshCw className="w-3.5 h-3.5" />
            </Btn>

            {/* [M9] Bulk Sync Inventory — superadmin only */}
            {isSuperAdmin && (
              <Btn variant="outline" size="sm" onClick={() => setShowSyncModal(true)} loading={syncLoading}
                title="Sync inventory entries across all stores for all medicines">
                <DatabaseZap className="w-3.5 h-3.5 text-info" /> Sync All
              </Btn>
            )}

            {isAdmin && (
              <Btn variant="outline" size="sm" onClick={() => setShowUploadHsn(true)}>
                <UploadCloud className="w-3.5 h-3.5" /> Upload HSN
              </Btn>
            )}
            <Btn variant="primary" size="sm" onClick={() => { dispatch(resetCurrentHsnCode()); setShowCreateMed(true); }}>
              <Plus className="w-3.5 h-3.5" /> New Medicine
            </Btn>
          </div>
        </div>
      </div>

      {/* ── ERROR BANNER ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-4" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
            <div className="alert alert-error flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
              <button onClick={() => dispatch(clearMedicineError())} className="text-error hover:opacity-70"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SYNC RESULT BANNER ───────────────────────────────────────────── */}
      <AnimatePresence>
        {localSyncResult && (
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <SyncResultBanner result={localSyncResult} onDismiss={() => setLocalSyncResult(null)} />
          </div>
        )}
      </AnimatePresence>

      {/* ── STORE LIFECYCLE RESULT BANNER ────────────────────────────────── */}
      <AnimatePresence>
        {storeLifecycleResult && (
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <StoreLifecycleBanner result={storeLifecycleResult} onDismiss={() => dispatch(clearStoreLifecycleResult())} />
          </div>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="mx-auto px-4 sm:px-3 lg:px-3 py-5">
        <AnimatePresence mode="wait">

          {/* ════════ ANALYTICS ════════ */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
              {loading || hsnLoading
                ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-[var(--r-box)] bg-base-200 animate-pulse" />)}
                  </div>
                )
                : <AnalyticsTab stats={stats} hsnStats={hsnStats} />
              }
            </motion.div>
          )}

          {/* ════════ MEDICINES ════════ */}
          {activeTab === 'medicines' && (
            <motion.div key="medicines" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
              <div className="flex gap-5 h-[calc(100vh-8rem)]">

                {/* LEFT: Medicine List */}
                <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col bg-base-100 border border-base-300 rounded-[var(--r-box)] overflow-hidden">
                  <div className="p-4 border-b border-base-300 space-y-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-base-content">
                        Medicines
                        <span className="ml-2 text-[10px] font-normal text-base-content/40 tabular-nums">{medPagination.totalItems ?? 0} total</span>
                      </p>
                      <Btn variant="ghost" size="xs" onClick={() => { setSelectedMed(null); dispatch(resetCurrentMedicine()); }}>
                        <X className="w-3 h-3" />
                      </Btn>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
                      <Input className="pl-8 py-1.5 text-xs" placeholder="Search medicines…" value={medSearch}
                        onChange={e => { setMedSearch(e.target.value); setMedPage(1); }} />
                    </div>
                    <div className="flex gap-1.5">
                      <SelectEl className="flex-1 py-1.5 text-[11px]" value={medCategory}
                        onChange={e => { setMedCategory(e.target.value); setMedPage(1); }}>
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </SelectEl>
                      <SelectEl className="w-20 py-1.5 text-[11px]" value={medSchedule}
                        onChange={e => { setMedSchedule(e.target.value); setMedPage(1); }}>
                        <option value="">Sched.</option>
                        {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                      </SelectEl>
                      <SelectEl className="w-28 py-1.5 text-[11px]" value={medSort} onChange={e => setMedSort(e.target.value)}>
                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </SelectEl>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-[var(--r-field)]">
                          <div className="w-10 h-10 rounded-[var(--r-field)] bg-base-200 animate-pulse flex-shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 rounded bg-base-200 animate-pulse w-3/4" />
                            <div className="h-2.5 rounded bg-base-200 animate-pulse w-1/2" />
                            <div className="h-2 rounded bg-base-200 animate-pulse w-1/3" />
                          </div>
                        </div>
                      ))
                      : medicines.length === 0
                        ? (
                          <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/20 py-16">
                            <PackageSearch className="w-12 h-12" />
                            <div className="text-center">
                              <p className="text-sm font-bold">No medicines</p>
                              <p className="text-xs mt-0.5">Try different filters</p>
                            </div>
                            <Btn variant="outline" size="sm" onClick={() => setShowCreateMed(true)}>
                              <Plus className="w-3 h-3" /> Add First Medicine
                            </Btn>
                          </div>
                        )
                        : (
                          <motion.div variants={stagger} initial="hidden" animate="visible">
                            {medicines.map(med => (
                              <MedicineListItem key={med._id} med={med}
                                isSelected={selectedMed?._id === med._id} onSelect={handleSelectMed} />
                            ))}
                          </motion.div>
                        )
                    }
                  </div>

                  <div className="flex items-center justify-between p-3 border-t border-base-300 flex-shrink-0 bg-base-200/30">
                    <Btn variant="ghost" size="xs" onClick={() => setShowRestockModal(true)}>
                      <AlertTriangle className="w-3 h-3 text-warning" />
                      <span className="text-[10px]">Restock Request</span>
                    </Btn>
                    {medPagination.totalPages > 1 && (
                      <Pagination page={medPagination.currentPage} totalPages={medPagination.totalPages} onChange={setMedPage} />
                    )}
                  </div>
                </div>

                {/* RIGHT: Detail Panel */}
                <div className="flex-1 min-w-0 bg-base-100 border border-base-300 rounded-[var(--r-box)] overflow-hidden">
                  <AnimatePresence mode="wait">
                    {detailLoading && !selectedMed
                      ? (
                        <div className="p-8 space-y-4">
                          <div className="h-28 rounded-[var(--r-box)] bg-base-200 animate-pulse" />
                          <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-[var(--r-field)] bg-base-200 animate-pulse" />)}
                          </div>
                        </div>
                      )
                      : (
                        <MedicineDetailPanel
                          key={selectedMed?._id || 'empty'}
                          med={selectedMed}
                          onEdit={()       => setShowEditMed(true)}
                          onStock={(id)    => { setStockMedId(id); setShowStockModal(true); }}
                          onDiscontinue={handleDiscontinue}
                          onRestock={(id)  => { setRestockMedId(id); setShowRestockModal(true); }}
                          onSyncSingle={handleSyncSingle}  // [M10]
                          actionLoading={actionLoading}
                          syncLoading={syncLoading}
                          canAdmin={isAdmin}
                        />
                      )
                    }
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ HSN CODES ════════ */}
          {activeTab === 'hsn' && (
            <motion.div key="hsn" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
              <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
                  <Input className="pl-9" placeholder="Search HSN code or description…" value={hsnSearch}
                    onChange={e => { setHsnSearch(e.target.value); setHsnPage(1); }} />
                </div>
                <SelectEl className="w-full sm:w-36" value={hsnGst} onChange={e => { setHsnGst(e.target.value); setHsnPage(1); }}>
                  <option value="">All GST Slabs</option>
                  {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
                </SelectEl>
                <SelectEl className="w-full sm:w-36" value={hsnActive} onChange={e => { setHsnActive(e.target.value); setHsnPage(1); }}>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                  <option value="all">All Status</option>
                </SelectEl>
                <SelectEl className="w-full sm:w-36" value={hsnSort} onChange={e => setHsnSort(e.target.value)}>
                  {HSN_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectEl>
              </div>

              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-base-content/50 font-semibold">{hsnPagination.total} code{hsnPagination.total !== 1 ? 's' : ''}</p>
                  {isAdmin && selectedHsnCodes.length > 0 && (
                    <Btn variant="danger" size="sm" onClick={handleBulkDelete} loading={actionLoading}>
                      <Trash2 className="w-3.5 h-3.5" /> Deactivate ({selectedHsnCodes.length})
                    </Btn>
                  )}
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <>
                      <Btn variant="ghost" size="sm" onClick={() => setShowUploadHsn(true)}>
                        <UploadCloud className="w-3.5 h-3.5" /> Upload File
                      </Btn>
                      <Btn variant="primary" size="sm" onClick={() => setShowCreateHsn(true)}>
                        <Plus className="w-3.5 h-3.5" /> New HSN Code
                      </Btn>
                    </>
                  )}
                </div>
              </div>

              <div className="card bg-base-100 overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-base-300 bg-base-200/50">
                        <th className="py-3 px-4 w-10">
                          {isAdmin && (
                            <input type="checkbox"
                              checked={selectedHsnCodes.length === hsnCodes.length && hsnCodes.length > 0}
                              onChange={selectAllHsn}
                              className="rounded border-base-300 bg-base-200 text-primary focus:ring-primary/30" />
                          )}
                        </th>
                        {['HSN Code', 'Description', 'GST', 'Status', 'Source', 'Actions'].map(h => (
                          <th key={h} className="py-3 px-4 text-left text-[10px] font-bold uppercase tracking-widest text-base-content/40">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <motion.tbody variants={stagger} initial="hidden" animate="visible">
                      {hsnLoading
                        ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i}><td colSpan={7} className="px-4 py-2"><div className="h-8 rounded bg-base-200 animate-pulse" /></td></tr>
                        ))
                        : hsnCodes.length === 0
                          ? (
                            <tr><td colSpan={7} className="py-16 text-center text-base-content/20">
                              <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">No HSN codes found</p>
                            </td></tr>
                          )
                          : hsnCodes.map(hsn => (
                            <HsnRow key={hsn._id || hsn.hsnCode} hsn={hsn}
                              selected={selectedHsnCodes.includes(hsn.hsnCode)}
                              onSelect={() => toggleHsnSelect(hsn.hsnCode)}
                              onEdit={(h) => { setEditHsnData(h); setShowEditHsn(true); }}
                              onDelete={handleDeleteHsn}
                              actionLoading={actionLoading}
                              canAdmin={isAdmin}
                            />
                          ))
                      }
                    </motion.tbody>
                  </table>
                </div>
              </div>

              {hsnPagination.totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <Pagination page={hsnPagination.currentPage} totalPages={hsnPagination.totalPages} onChange={setHsnPage} />
                </div>
              )}
            </motion.div>
          )}

          {/* ════════ STORES (admin / superadmin) ════════ */}
          {activeTab === 'stores' && isAdmin && (
            <motion.div key="stores" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
                  <Input className="pl-9" placeholder="Search stores…" value={storeSearch}
                    onChange={e => { setStoreSearch(e.target.value); setStorePage(1); }} />
                </div>
                <SelectEl className="w-full sm:w-44" value={storeStatus} onChange={e => { setStoreStatus(e.target.value); setStorePage(1); }}>
                  <option value="">All Statuses</option>
                  {STORE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </SelectEl>
                <SelectEl className="w-full sm:w-40" value={storeType} onChange={e => { setStoreType(e.target.value); setStorePage(1); }}>
                  <option value="">All Types</option>
                  {STORE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </SelectEl>
                {/* [SL4] Trigger all stores low-stock — superadmin */}
                {isSuperAdmin && (
                  <Btn variant="outline" size="sm" onClick={() => handleTriggerLowStock(undefined)}
                    loading={storeActionLoading} title="Trigger low-stock alerts for ALL open stores">
                    <Bell className="w-3.5 h-3.5 text-warning" /> Trigger All Alerts
                  </Btn>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-base-content/50 font-semibold">
                  {storePagination.total} store{storePagination.total !== 1 ? 's' : ''}
                </p>
              </div>

              {storeLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-[var(--r-box)] bg-base-200 animate-pulse" />
                  ))}
                </div>
              ) : stores.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-base-content/20 gap-3">
                  <Store className="w-12 h-12" />
                  <p className="text-sm font-bold">No stores found</p>
                  <p className="text-xs">Adjust your filters or add a store</p>
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  variants={stagger} initial="hidden" animate="visible"
                >
                  {stores.map(store => (
                    <StoreCard
                      key={store._id}
                      store={store}
                      onSuspend={(id) => { setSuspendTarget(store); setShowSuspendModal(true); }}
                      onUnsuspend={handleUnsuspendStore}
                      onDelete={handleDeleteStore}
                      onTriggerLowStock={handleTriggerLowStock}
                      actionLoading={storeActionLoading}
                      isSuperAdmin={isSuperAdmin}
                      isAdmin={isAdmin}
                    />
                  ))}
                </motion.div>
              )}

              {storePagination.totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <Pagination page={storePagination.currentPage} totalPages={storePagination.totalPages} onChange={setStorePage} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* Create Medicine */}
      <Modal open={showCreateMed} onClose={() => { setShowCreateMed(false); dispatch(resetCurrentHsnCode()); }} title="Add New Medicine" wide>
        <MedicineForm onSubmit={handleCreateMed} loading={actionLoading}
          onHsnLookup={(code) => dispatch(fetchHsnByCode(code))}
          hsnData={currentHsn} hsnLookupLoading={detailLoading}
          stores={stores} isAdmin={isAdmin} />
      </Modal>

      {/* Edit Medicine */}
      <Modal open={showEditMed} onClose={() => { setShowEditMed(false); dispatch(resetCurrentHsnCode()); }} title="Edit Medicine" wide>
        {selectedMed && (
          <MedicineForm initial={selectedMed} onSubmit={handleEditMed} loading={actionLoading}
            onHsnLookup={(code) => dispatch(fetchHsnByCode(code))}
            hsnData={currentHsn} hsnLookupLoading={detailLoading}
            stores={stores} isAdmin={isAdmin} />
        )}
      </Modal>

      {/* Update Stock */}
      <Modal open={showStockModal} onClose={() => { setShowStockModal(false); setStockMedId(null); }} title="Update Store Stock">
        {stockMedId && (
          <UpdateStockForm medicineId={stockMedId} onSubmit={handleUpdateStock}
            loading={actionLoading} stores={stores} isPharmacy={isPharmacy} />
        )}
      </Modal>

      {/* Restock Request */}
      <Modal open={showRestockModal} onClose={() => setShowRestockModal(false)} title="Send Restock Request">
        <form onSubmit={handleRestock} className="space-y-4">
          <FormField label="Medicine" required note="Select the medicine that needs restocking">
            <SelectEl value={restockMedId} onChange={e => setRestockMedId(e.target.value)} required>
              <option value="">— Select medicine —</option>
              {medicines.map(m => (
                <option key={m._id} value={m._id}>
                  {m.brandName} — {m.genericName} {m.dosage && `(${m.dosage})`}
                </option>
              ))}
            </SelectEl>
          </FormField>
          <FormField label="Quantity Required" required note="Number of units needed">
            <Input type="number" min={1} value={restockQty} onChange={e => setRestockQty(e.target.value)} placeholder="500" required />
          </FormField>
          <div className="alert alert-warning flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">This sends a high-priority notification to all admins and superadmins.</span>
          </div>
          <div className="flex justify-end">
            <Btn type="submit" variant="warning" loading={actionLoading}>
              <AlertTriangle className="w-3.5 h-3.5" /> Send Request
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
      <Modal open={showUploadHsn} onClose={() => { setShowUploadHsn(false); dispatch(clearHsnUploadResult()); }} title="Bulk Upload HSN Codes">
        <div className="space-y-4">
          <div className="alert alert-info flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold mb-0.5">Expected Excel Columns</p>
              <p className="text-base-content/60">HSN Code · Description · Chapter Heading (optional) · GST % (0/5/12/18/28)</p>
            </div>
          </div>
          <HsnUploadPanel onUpload={handleUploadHsn} loading={actionLoading}
            uploadResult={uploadResult} onClearResult={() => dispatch(clearHsnUploadResult())} />
        </div>
      </Modal>

      {/* [SL2] Suspend Store Modal */}
      <Modal open={showSuspendModal} onClose={() => { setShowSuspendModal(false); setSuspendTarget(null); }} title="Suspend Store">
        {suspendTarget && (
          <SuspendStoreForm
            store={suspendTarget}
            onSubmit={handleSuspendStore}
            onCancel={() => { setShowSuspendModal(false); setSuspendTarget(null); }}
            loading={storeActionLoading}
          />
        )}
      </Modal>

      {/* [M9] Bulk Sync All Confirmation */}
      <Modal open={showSyncModal} onClose={() => setShowSyncModal(false)} title="Sync All Inventory Entries">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-info/10 border border-info/20 rounded-[var(--r-box)]">
            <DatabaseZap className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
            <div className="text-sm text-base-content/70 space-y-1">
              <p className="font-bold text-base-content">What this does</p>
              <p>For every non-discontinued medicine, this operation adds a zero-stock inventory entry for any pharmacy store that is missing one.</p>
              <p>Existing stock levels are <strong>never modified</strong> — only missing entries are inserted.</p>
              <p className="text-warning font-semibold">⚠ This may be slow on large catalogs. Run it after adding new stores.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setShowSyncModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSyncAll} loading={syncLoading}>
              <DatabaseZap className="w-3.5 h-3.5" /> Run Bulk Sync
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}