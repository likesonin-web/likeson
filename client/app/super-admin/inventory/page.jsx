'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Clock, Package, RefreshCw, Search, Filter, BarChart2,
  Layers, ChevronDown, X, Loader2, Building2, Edit2, Trash2, Plus,
  TrendingDown, CheckCircle, Info, Boxes, ShieldAlert, Activity,
  Store, ArrowUpDown, MoreVertical, Eye, Zap, Database, Bell,
  ArrowUp, ArrowDown, ChevronRight, SlidersHorizontal, Download,
  RotateCcw, Wifi, WifiOff, Pill, FlaskConical, Shield
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar, Legend,
  LineChart, Line
} from 'recharts';

import {
  fetchMedicineInventory,
  fetchLowStockReport,
  fetchExpiryAlerts,
  addInventoryEntry,
  updateInventoryEntry,
  deleteInventoryEntry,
  fetchStores,
  fetchInventoryStats,
  syncAllInventory,
  syncMedicineInventory,
  fetchMedicines,
  selectCurrentInventory,
  selectInventoryLoading,
  selectMedicineActionLoading,
  selectLowStockReport,
  selectExpiryAlerts,
  selectAllStores,
  selectStoreLoading,
  selectMedicineStats,
  selectAllMedicines,
  selectMedicineLoading,
  selectMedicineSyncLoading,
  selectSyncResult,
  resetInventory,
  clearSyncResult,
} from '@/store/slices/medicineSlice';

// ── Selectors ──────────────────────────────────────────────────────────────
const CHART_PALETTE = [
  'var(--primary)', 'var(--secondary)', 'var(--success)',
  'var(--warning)', 'var(--error)', 'var(--info)',
  '#8B5CF6', '#EC4899',
];

// ── Motion variants ────────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const slideRight = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 20, transition: { duration: 0.22 } },
};

const modalVariant = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.2 } },
};

// ── Tiny helpers ───────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysLeft = (d) => d ? Math.ceil((new Date(d) - Date.now()) / 86_400_000) : null;

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color, trend, i }) {
  return (
    <motion.div variants={fadeUp} custom={i}
      className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden">
      {/* Decorative blob */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10"
        style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon size={20} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-xl"
            style={{
              color: trend >= 0 ? 'var(--error)' : 'var(--success)',
              background: trend >= 0 ? 'var(--error)15' : 'var(--success)15',
            }}>
            {trend >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-montserrat)', color }}>
          {fmt(value)}
        </div>
        <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--base-content)' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5 opacity-50">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── Stock Level Pill ───────────────────────────────────────────────────────
function StockPill({ qty, reorder }) {
  const level = qty === 0 ? 'out' : qty <= reorder ? 'low' : 'ok';
  const cfg = {
    out: { label: 'Out of Stock', c: 'var(--error)',   bg: 'var(--error)15'   },
    low: { label: 'Low Stock',    c: 'var(--warning)', bg: 'var(--warning)15' },
    ok:  { label: 'In Stock',     c: 'var(--success)', bg: 'var(--success)15' },
  }[level];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
      style={{ color: cfg.c, background: cfg.bg }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.c }} />
      {fmt(qty)} · {cfg.label}
    </span>
  );
}

// ── Expiry Chip ────────────────────────────────────────────────────────────
function ExpiryChip({ date }) {
  const days = daysLeft(date);
  if (days === null) return <span className="text-xs opacity-40">—</span>;
  const urgent = days <= 7;
  const warn   = days <= 30;
  const c = urgent ? 'var(--error)' : warn ? 'var(--warning)' : 'var(--success)';
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color: c, background: `${c}18` }}>
      {urgent && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c }} />}
      {fmtDate(date)} · {days}d
    </span>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, color = 'var(--primary)', action }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b"
      style={{ borderColor: 'var(--base-300)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <div className="font-black text-sm tracking-wide" style={{ fontFamily: 'var(--font-montserrat)', color }}>
            {title}
          </div>
          {subtitle && <div className="text-xs opacity-50 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message, color = 'var(--primary)' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
      <Icon size={32} style={{ color }} />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ── Loading Rows ───────────────────────────────────────────────────────────
function LoadingRows({ cols = 5, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="border-b" style={{ borderColor: 'var(--base-300)' }}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="px-4 py-3.5">
          <div className="skeleton-shimmer h-3.5 rounded-lg" style={{ width: `${50 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  ));
}

// ── Table ──────────────────────────────────────────────────────────────────
function DataTable({ headers, children, loading, cols }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ background: 'var(--base-200)', borderBottom: '2px solid var(--base-300)' }}>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] opacity-50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRows cols={cols || headers.length} rows={5} /> : children}
        </tbody>
      </table>
    </div>
  );
}

// ── Inventory Entry Modal ──────────────────────────────────────────────────
function InventoryModal({ open, onClose, onSubmit, initial, stores, loading, mode }) {
  const [form, setForm] = useState({
    storeId: '', stockQuantity: 0, reservedQuantity: 0, reorderLevel: 10,
    pricePerUnit: '', batchNumber: '', location: '',
    expiryDate: '', manufacturingDate: '', isActive: true,
  });

  useEffect(() => {
    if (initial) {
      setForm(f => ({
        ...f,
        ...initial,
        expiryDate:       initial.expiryDate?.split?.('T')[0] || '',
        manufacturingDate: initial.manufacturingDate?.split?.('T')[0] || '',
      }));
    } else {
      setForm({
        storeId: '', stockQuantity: 0, reservedQuantity: 0, reorderLevel: 10,
        pricePerUnit: '', batchNumber: '', location: '',
        expiryDate: '', manufacturingDate: '', isActive: true,
      });
    }
  }, [initial, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fields = [
    { label: 'Stock Qty',         key: 'stockQuantity',    type: 'number', req: true },
    { label: 'Reserved Qty',      key: 'reservedQuantity', type: 'number' },
    { label: 'Reorder Level',     key: 'reorderLevel',     type: 'number' },
    { label: 'Price / Unit (₹)',  key: 'pricePerUnit',     type: 'number' },
    { label: 'Batch Number',      key: 'batchNumber',      type: 'text'   },
    { label: 'Location (Rack)',   key: 'location',         type: 'text'   },
    { label: 'Expiry Date',       key: 'expiryDate',       type: 'date',  req: true },
    { label: 'Mfg Date',          key: 'manufacturingDate',type: 'date'   },
  ];

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose} />
        <motion.div variants={modalVariant} initial="hidden" animate="visible" exit="exit"
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl"
          style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)' }}>

          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b"
            style={{ borderColor: 'var(--base-300)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--primary)20' }}>
                {mode === 'edit' ? <Edit2 size={18} style={{ color: 'var(--primary)' }} />
                  : <Plus size={18} style={{ color: 'var(--primary)' }} />}
              </div>
              <div>
                <h3 className="text-lg font-black" style={{ fontFamily: 'var(--font-montserrat)', color: 'var(--base-content)' }}>
                  {mode === 'edit' ? 'Update Inventory' : 'Add Inventory Entry'}
                </h3>
                <p className="text-xs opacity-50">Store-specific stock record</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-base-200 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-4">
            {mode === 'add' && (
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider opacity-60">
                  Store <span className="text-error">*</span>
                </label>
                <select value={form.storeId} onChange={e => set('storeId', e.target.value)}
                  className="input-field w-full text-sm">
                  <option value="">Select store…</option>
                  {stores.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.storeName}{s.address?.city ? ` — ${s.address.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {fields.map(({ label, key, type, req }) => (
                <div key={key}>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider opacity-60">
                    {label}{req && <span className="text-error ml-1">*</span>}
                  </label>
                  <input type={type} value={form[key] ?? ''}
                    onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
              ))}
            </div>

            {mode === 'edit' && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" id="active" checked={form.isActive}
                    onChange={e => set('isActive', e.target.checked)} className="sr-only" />
                  <div className="w-9 h-5  flex items-center   rounded-full transition-colors"
                    style={{ background: form.isActive ? 'var(--success)' : 'var(--base-300)' }}>
                    <div className="w-3.5 h-3.5  bg-white  -translate-y-[1px] rounded-full shadow transition-transform mt-[3px]"
                      style={{ transform: `translateX(${form.isActive ? '18px' : '4px'})` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold">Entry Active</span>
              </label>
            )}
          </div>

          <div className="flex gap-3 px-6 pb-6">
            <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            <button onClick={() => onSubmit(form)} disabled={loading}
              className="btn-primary-cta flex-1 py-2.5 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {mode === 'edit' ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Low Stock Table ────────────────────────────────────────────────────────
function LowStockTable({ data, loading, page, setPage }) {
  const { data: rows = [], total = 0, metadata = {} } = data;
  const totalPages = metadata.totalPages ?? 1;

  return (
    <div className="glass-card overflow-hidden">
      <SectionHeader
        icon={TrendingDown}
        title="Low Stock Report"
        subtitle={`${fmt(total)} items require attention`}
        color="var(--warning)"
        action={
          <span className="badge badge-warning">{fmt(total)} items</span>
        }
      />
      <DataTable
        loading={loading}
        headers={['Medicine', 'Store', 'Stock Level', 'Reorder At', 'Expiry', 'Price']}
      >
        {rows.map((item, i) => (
          <motion.tr key={`low-${item._id}-${i}`}
            variants={fadeUp} initial="hidden" animate="visible" custom={i}
            className="border-b group hover:bg-base-200/40 transition-colors"
            style={{ borderColor: 'var(--base-300)' }}>
            <td className="px-4 py-3.5">
              <div className="font-semibold text-sm">{item.brandName || item.name}</div>
              <div className="text-xs opacity-45 mt-0.5">{item.genericName}</div>
            </td>
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-1.5">
                <Building2 size={12} style={{ color: 'var(--secondary)' }} />
                <span className="text-sm">{item.inventory?.storeId?.storeName || '—'}</span>
              </div>
            </td>
            <td className="px-4 py-3.5">
              <StockPill qty={item.inventory?.stockQuantity ?? 0} reorder={item.inventory?.reorderLevel ?? 10} />
            </td>
            <td className="px-4 py-3.5">
              <span className="font-mono text-sm">{item.inventory?.reorderLevel ?? 10}</span>
            </td>
            <td className="px-4 py-3.5">
              <ExpiryChip date={item.inventory?.expiryDate} />
            </td>
            <td className="px-4 py-3.5 text-sm font-mono">
              ₹{item.inventory?.pricePerUnit ?? '—'}
            </td>
          </motion.tr>
        ))}
        {!loading && rows.length === 0 && (
          <tr><td colSpan={6}>
            <EmptyState icon={CheckCircle} message="No low stock items — all good!" color="var(--success)" />
          </td></tr>
        )}
      </DataTable>
      <Pagination page={page} total={totalPages} onChange={setPage} />
    </div>
  );
}

// ── Expiry Table ───────────────────────────────────────────────────────────
function ExpiryTable({ data, loading, page, setPage }) {
  const { data: rows = [], total = 0, withinDays = 30, metadata = {} } = data;
  const totalPages = metadata.totalPages ?? 1;

  return (
    <div className="glass-card overflow-hidden">
      <SectionHeader
        icon={Clock}
        title="Expiry Alerts"
        subtitle={`${fmt(total)} items expiring within ${withinDays} days`}
        color="var(--error)"
        action={<span className="badge badge-error">{fmt(total)} items</span>}
      />
      <DataTable loading={loading} headers={['Medicine', 'Store', 'Batch', 'Expires', 'Days Left', 'Qty']}>
        {rows.map((item, i) => {
          const days = daysLeft(item.inventory?.expiryDate);
          return (
            <motion.tr key={`exp-${item._id}-${i}`}
              variants={fadeUp} initial="hidden" animate="visible" custom={i}
              className="border-b hover:bg-base-200/40 transition-colors"
              style={{ borderColor: 'var(--base-300)' }}>
              <td className="px-4 py-3.5">
                <div className="font-semibold text-sm">{item.brandName || item.name}</div>
              </td>
              <td className="px-4 py-3.5 text-sm">{item.inventory?.storeId?.storeName || '—'}</td>
              <td className="px-4 py-3.5 text-xs font-mono opacity-60">{item.inventory?.batchNumber || '—'}</td>
              <td className="px-4 py-3.5 text-sm">{fmtDate(item.inventory?.expiryDate)}</td>
              <td className="px-4 py-3.5"><ExpiryChip date={item.inventory?.expiryDate} /></td>
              <td className="px-4 py-3.5 text-sm font-mono">{fmt(item.inventory?.stockQuantity)}</td>
            </motion.tr>
          );
        })}
        {!loading && rows.length === 0 && (
          <tr><td colSpan={6}>
            <EmptyState icon={CheckCircle} message="No expiry alerts" color="var(--success)" />
          </td></tr>
        )}
      </DataTable>
      <Pagination page={page} total={totalPages} onChange={setPage} />
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────
function Pagination({ page, total, onChange }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t"
      style={{ borderColor: 'var(--base-300)' }}>
      <span className="text-xs opacity-40 font-medium">Page {page} of {total}</span>
      <div className="flex gap-1.5">
        <button disabled={page <= 1} onClick={() => onChange(p => p - 1)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30 hover:bg-base-200 transition-colors">
          ← Prev
        </button>
        <button disabled={page >= total} onClick={() => onChange(p => p + 1)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30 hover:bg-base-200 transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Per-Medicine Inventory Panel ───────────────────────────────────────────
function MedicineInventoryPanel({ medicines, stores, dispatch }) {
  const inventory     = useSelector(selectCurrentInventory);
  const invLoading    = useSelector(selectInventoryLoading);
  const actionLoading = useSelector(selectMedicineActionLoading);

  const [selectedMed, setSelectedMed] = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [modalMode, setModalMode]     = useState('add');
  const [editEntry, setEditEntry]     = useState(null);
  const [medSearch, setMedSearch]     = useState('');

  const filtered = medicines.filter(m =>
    !medSearch || m.brandName?.toLowerCase().includes(medSearch.toLowerCase()) ||
    m.genericName?.toLowerCase().includes(medSearch.toLowerCase())
  );

  const loadInventory = (id) => {
    setSelectedMed(id);
    dispatch(resetInventory());
    dispatch(fetchMedicineInventory(id));
  };

  const handleAdd = async (form) => {
    if (!selectedMed) return;
    const res = await dispatch(addInventoryEntry({ medicineId: selectedMed, entryData: form }));
    if (!res.error) setShowModal(false);
  };

  const handleUpdate = async (form) => {
    if (!selectedMed || !editEntry) return;
    const sid = editEntry.storeId?._id || editEntry.storeId;
    const res = await dispatch(updateInventoryEntry({ medicineId: selectedMed, storeId: sid, updateData: form }));
    if (!res.error) { setShowModal(false); setEditEntry(null); }
  };

  const handleDelete = async (entry, hard = false) => {
    if (!selectedMed) return;
    const sid = entry.storeId?._id || entry.storeId;
    if (!confirm(`${hard ? 'Permanently delete' : 'Deactivate'} this inventory entry?`)) return;
    dispatch(deleteInventoryEntry({ medicineId: selectedMed, storeId: sid, hard }));
  };

  const currentMed = medicines.find(m => m._id === selectedMed);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
      {/* Medicine Selector */}
      <div className="glass-card overflow-hidden flex flex-col max-h-[680px]">
        <SectionHeader icon={Pill} title="Select Medicine" subtitle={`${filtered.length} medicines`} />
        <div className="p-4 border-b" style={{ borderColor: 'var(--base-300)' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
            <input placeholder="Search medicine…" value={medSearch}
              onChange={e => setMedSearch(e.target.value)}
              className="input-field w-full pl-9 text-sm py-2.5" />
          </div>
        </div>
        <div className="overflow-y-auto flex flex-col divide-y" style={{ divideColor: 'var(--base-300)' }}>
          {filtered.slice(0, 60).map(med => (
            <button key={med._id} onClick={() => loadInventory(med._id)}
              className="flex items-center gap-3 px-4 py-3 text-left transition-all group"
              style={{
                background: selectedMed === med._id
                  ? 'linear-gradient(90deg, var(--primary)12, transparent)'
                  : 'transparent',
                borderLeft: selectedMed === med._id ? '3px solid var(--primary)' : '3px solid transparent',
              }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: selectedMed === med._id ? 'var(--primary)20' : 'var(--base-200)' }}>
                <Pill size={13} style={{ color: selectedMed === med._id ? 'var(--primary)' : 'var(--base-content)' }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: selectedMed === med._id ? 'var(--primary)' : 'var(--base-content)' }}>
                  {med.brandName}
                </div>
                <div className="text-xs opacity-45 truncate">{med.category} · ₹{med.mrp}</div>
              </div>
              {selectedMed === med._id && <ChevronRight size={14} style={{ color: 'var(--primary)' }} className="ml-auto flex-shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && <EmptyState icon={Search} message="No medicines found" />}
        </div>
      </div>

      {/* Inventory Table */}
      <AnimatePresence mode="wait">
        {selectedMed ? (
          <motion.div key={selectedMed} variants={slideRight} initial="hidden" animate="visible" exit="exit"
            className="glass-card overflow-hidden flex flex-col">
            <SectionHeader
              icon={Database}
              title={`${currentMed?.brandName} — Store Inventory`}
              subtitle={`${inventory.length} store entries`}
              color="var(--secondary)"
              action={
                <button onClick={() => { setModalMode('add'); setEditEntry(null); setShowModal(true); }}
                  className="btn-primary-cta text-xs py-2 px-4 flex items-center gap-1.5">
                  <Plus size={13} /> Add Entry
                </button>
              }
            />

            {invLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  <span className="text-xs opacity-40 font-medium">Loading inventory…</span>
                </div>
              </div>
            ) : (
              <DataTable headers={['Store', 'Stock', 'Reserved', 'Reorder', 'Expiry', 'Price/Unit', 'Status', '']}>
                {inventory.map((inv, i) => {
                  const storeName = inv.storeId?.storeName
                    || stores.find(s => s._id === inv.storeId)?.storeName || 'Unknown Store';
                  return (
                    <motion.tr key={`inv-${inv.storeId}-${i}`}
                      variants={fadeUp} initial="hidden" animate="visible" custom={i}
                      className="border-b group hover:bg-base-200/40 transition-colors"
                      style={{ borderColor: 'var(--base-300)' }}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Building2 size={13} style={{ color: 'var(--secondary)' }} />
                          <span className="text-sm font-medium">{storeName}</span>
                        </div>
                        {inv.location && <div className="text-xs opacity-40 mt-0.5 pl-5">{inv.location}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <StockPill qty={inv.stockQuantity} reorder={inv.reorderLevel} />
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono opacity-60">{fmt(inv.reservedQuantity)}</td>
                      <td className="px-4 py-3.5 text-sm font-mono opacity-60">{inv.reorderLevel ?? 10}</td>
                      <td className="px-4 py-3.5"><ExpiryChip date={inv.expiryDate} /></td>
                      <td className="px-4 py-3.5 text-sm font-mono">₹{inv.pricePerUnit ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        {inv.isActive
                          ? <span className="badge badge-success text-[10px] py-0.5">Active</span>
                          : <span className="badge badge-error text-[10px] py-0.5">Inactive</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button title="Edit"
                            onClick={() => { setEditEntry(inv); setModalMode('edit'); setShowModal(true); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-primary/15 transition-colors">
                            <Edit2 size={12} style={{ color: 'var(--primary)' }} />
                          </button>
                          <button title="Deactivate"
                            onClick={() => handleDelete(inv, false)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-error/15 transition-colors">
                            <Trash2 size={12} style={{ color: 'var(--error)' }} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {inventory.length === 0 && (
                  <tr><td colSpan={8}>
                    <EmptyState icon={Database} message="No inventory entries — click Add Entry to create one" />
                  </td></tr>
                )}
              </DataTable>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" variants={fadeUp} initial="hidden" animate="visible"
            className="glass-card flex items-center justify-center min-h-[400px]">
            <div className="text-center opacity-30">
              <Boxes size={48} className="mx-auto mb-3" />
              <p className="text-sm font-semibold">Select a medicine to view its inventory</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InventoryModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditEntry(null); }}
        onSubmit={modalMode === 'edit' ? handleUpdate : handleAdd}
        initial={editEntry}
        stores={stores}
        loading={actionLoading}
        mode={modalMode}
      />
    </div>
  );
}

// ── Sync Panel ─────────────────────────────────────────────────────────────
function SyncPanel({ dispatch, syncLoading, syncResult }) {
  const medicines = useSelector(selectAllMedicines);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { return () => dispatch(clearSyncResult()); }, [dispatch]);

  const handleSyncAll = () => {
    if (confirm('This will sync inventory for ALL medicines across ALL stores. Continue?')) {
      dispatch(syncAllInventory());
    }
  };

  const handleSyncSingle = () => {
    if (!selectedId) return;
    dispatch(syncMedicineInventory(selectedId));
  };

  const filtered = medicines.filter(m =>
    !search || m.brandName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Bulk Sync */}
      <div className="glass-card overflow-hidden">
        <SectionHeader
          icon={Zap}
          title="Bulk Inventory Sync"
          subtitle="Add zero-stock entries across all medicines for all active stores"
          color="var(--warning)"
        />
        <div className="p-6">
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'var(--warning)10', border: '1px solid var(--warning)30' }}>
            <p className="text-sm opacity-80 leading-relaxed">
              <strong>When to use:</strong> Run this once after adding a new PharmacyStore. It will add a zero-stock entry
              for every existing medicine in the new store. Existing stock data is never overwritten.
            </p>
          </div>
          <button onClick={handleSyncAll} disabled={syncLoading}
            className="btn-primary-cta flex items-center gap-2 py-3">
            {syncLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            Sync All Medicines × All Stores
          </button>
        </div>
      </div>

      {/* Single Medicine Sync */}
      <div className="glass-card overflow-hidden">
        <SectionHeader
          icon={Activity}
          title="Single Medicine Sync"
          subtitle="Sync inventory for one specific medicine"
          color="var(--info)"
        />
        <div className="p-6 flex flex-col gap-4">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
            <input placeholder="Search medicine…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field w-full pl-9 text-sm" />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-2xl border" style={{ borderColor: 'var(--base-300)' }}>
            {filtered.slice(0, 30).map(m => (
              <button key={m._id} onClick={() => setSelectedId(m._id)}
                className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-base-200 transition-colors border-b text-sm"
                style={{
                  borderColor: 'var(--base-300)',
                  background: selectedId === m._id ? 'var(--info)12' : undefined,
                  color: selectedId === m._id ? 'var(--info)' : undefined,
                }}>
                <Pill size={13} />
                <span className="font-medium">{m.brandName}</span>
                <span className="opacity-40 ml-auto">{m.category}</span>
              </button>
            ))}
          </div>
          <button onClick={handleSyncSingle} disabled={!selectedId || syncLoading}
            className="btn-secondary flex items-center gap-2 py-2.5 disabled:opacity-40">
            {syncLoading ? <Loader2 size={15} className="animate-spin" /> : <Activity size={15} />}
            Sync Selected Medicine
          </button>
        </div>
      </div>

      {/* Sync Result */}
      <AnimatePresence>
        {syncResult && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}
            className="glass-card p-5"
            style={{ border: '1px solid var(--success)40', background: 'var(--success)08' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              <span className="font-bold text-sm" style={{ color: 'var(--success)' }}>Sync Complete</span>
              <button onClick={() => dispatch(clearSyncResult())} className="ml-auto opacity-40 hover:opacity-70">
                <X size={14} />
              </button>
            </div>
            {syncResult.type === 'bulk' ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Medicines', v: syncResult.totalMedicines },
                  { l: 'Synced',    v: syncResult.medicinesSynced },
                  { l: 'New Entries', v: syncResult.totalEntriesAdded },
                ].map(({ l, v }) => (
                  <div key={l} className="text-center">
                    <div className="text-2xl font-black" style={{ color: 'var(--success)' }}>{fmt(v)}</div>
                    <div className="text-xs opacity-50">{l}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm">
                Added <strong>{fmt(syncResult.addedCount)}</strong> new store entries.
                Total entries: <strong>{fmt(syncResult.totalInventoryEntries)}</strong>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Analytics Charts ───────────────────────────────────────────────────────
function AnalyticsTab({ stores, stats }) {
  const categoryData = (stats?.categoryDistribution || []).map(c => ({
    name: c._id || 'Other',
    count: c.count,
    avgPrice: Math.round(c.avgPrice || 0),
  }));

  const storeStatusData = [
    { name: 'Open',        value: stores.filter(s => s.status === 'Open').length },
    { name: 'Closed',      value: stores.filter(s => s.status === 'Closed').length },
    { name: 'Maintenance', value: stores.filter(s => s.status === 'Under-Maintenance').length },
    { name: 'Inactive',    value: stores.filter(s => s.status === 'Inactive').length },
  ].filter(d => d.value > 0);

  const mockTrend = Array.from({ length: 14 }, (_, i) => ({
    day: `D-${14 - i}`,
    lowStock: Math.floor(Math.random() * 25 + 5),
    expiring: Math.floor(Math.random() * 12 + 2),
    synced:   Math.floor(Math.random() * 8),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-2xl border px-3 py-2.5 shadow-xl text-xs"
        style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)' }}>
        <div className="font-bold mb-1.5 opacity-60">{label}</div>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}: <strong>{p.value}</strong></span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Category Distribution */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="glass-card p-5">
        <SectionHeader icon={BarChart2} title="Medicines by Category" color="var(--primary)" />
        <div className="pt-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData.slice(0, 8)} margin={{ top: 4, right: 8, left: -10, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="name" angle={-35} textAnchor="end"
                tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {categoryData.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Store Status */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="glass-card p-5">
        <SectionHeader icon={Store} title="Store Status Distribution" color="var(--secondary)" />
        <div className="pt-4">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={storeStatusData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}>
                {storeStatusData.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Alert Trend */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
        className="glass-card p-5 col-span-full">
        <SectionHeader icon={Activity} title="14-Day Alert Trend" subtitle="Low stock & expiry signals" color="var(--warning)" />
        <div className="pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockTrend}>
              <defs>
                {[
                  { id: 'low', c: 'var(--warning)' },
                  { id: 'exp', c: 'var(--error)' },
                ].map(({ id, c }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="lowStock" name="Low Stock" stroke="var(--warning)"
                strokeWidth={2.5} fill="url(#low)" dot={false} />
              <Area type="monotone" dataKey="expiring"  name="Expiring"  stroke="var(--error)"
                strokeWidth={2.5} fill="url(#exp)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Stats Summary */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
        className="glass-card p-5 col-span-full">
        <SectionHeader icon={Database} title="Inventory Health Summary" color="var(--info)" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          {[
            { label: 'Total Stock Units', value: fmt(stats?.totalStock ?? 0),         color: 'var(--primary)' },
            { label: 'Low Stock Alerts',  value: fmt(stats?.lowStockAlerts ?? 0),      color: 'var(--warning)' },
            { label: 'Expiry Alerts',     value: fmt(stats?.expiryAlerts ?? 0),        color: 'var(--error)'   },
            { label: 'Discontinued',      value: fmt(stats?.discontinuedCount ?? 0),   color: 'var(--neutral)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-4 rounded-2xl"
              style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
              <div className="text-2xl font-black" style={{ color, fontFamily: 'var(--font-montserrat)' }}>
                {value}
              </div>
              <div className="text-xs font-semibold mt-1 opacity-60">{label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Tab Button ─────────────────────────────────────────────────────────────
function TabBtn({ active, icon: Icon, label, badge, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all relative"
      style={{
        background: active ? 'var(--primary)' : 'transparent',
        color:      active ? 'var(--primary-content)' : 'var(--base-content)',
        border:     active ? 'none' : '1.5px solid var(--base-300)',
        boxShadow:  active ? '0 4px 14px var(--primary)40' : 'none',
      }}>
      <Icon size={15} />
      {label}
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-black flex items-center justify-center px-1"
          style={{ background: 'var(--error)', color: 'var(--error-content)' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function InventoryManagement() {
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.user?.user) ?? null;

  const lowStockReport = useSelector(selectLowStockReport);
  const expiryAlerts   = useSelector(selectExpiryAlerts);
  const stores         = useSelector(selectAllStores);
  const medicines      = useSelector(selectAllMedicines);
  const invLoading     = useSelector(selectInventoryLoading);
  const medLoading     = useSelector(selectMedicineLoading);
  const syncLoading    = useSelector(selectMedicineSyncLoading);
  const syncResult     = useSelector(selectSyncResult);
  const stats          = useSelector(selectMedicineStats);

  const [tab,         setTab]         = useState('alerts');
  const [expiryDays,  setExpiryDays]  = useState(30);
  const [storeFilter, setStoreFilter] = useState('');
  const [lowPage,     setLowPage]     = useState(1);
  const [expPage,     setExpPage]     = useState(1);
  const [refreshKey,  setRefreshKey]  = useState(0);

  // Initial data load
  useEffect(() => {
    dispatch(fetchStores({}));
    dispatch(fetchMedicines({ limit: 200 }));
    dispatch(fetchInventoryStats());
  }, [dispatch]);

  // Reload reports when filters change
  const loadLow = useCallback(() => {
    dispatch(fetchLowStockReport({
      storeId: storeFilter || undefined,
      page:    lowPage,
      limit:   20,
    }));
  }, [dispatch, storeFilter, lowPage]);

  const loadExpiry = useCallback(() => {
    dispatch(fetchExpiryAlerts({
      days:    expiryDays,
      storeId: storeFilter || undefined,
      page:    expPage,
      limit:   20,
    }));
  }, [dispatch, storeFilter, expiryDays, expPage]);

  useEffect(() => { loadLow(); }, [loadLow]);
  useEffect(() => { loadExpiry(); }, [loadExpiry]);

  const refresh = () => {
    setRefreshKey(k => k + 1);
    loadLow();
    loadExpiry();
    dispatch(fetchInventoryStats());
  };

  const tabs = [
    { id: 'alerts',    icon: ShieldAlert, label: 'Alerts',   badge: (lowStockReport.total || 0) + (expiryAlerts.total || 0) },
    { id: 'browse',    icon: Boxes,       label: 'Browse',   badge: 0 },
    { id: 'analytics', icon: BarChart2,   label: 'Analytics',badge: 0 },
    { id: 'sync',      icon: RotateCcw,   label: 'Sync',     badge: 0 },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Top Header ─────────────────────────────────────── */}
      <motion.div className="sticky top-0 z-30 border-b px-6 py-4"
        style={{
          background: 'color-mix(in srgb, var(--base-100) 92%, transparent)',
          backdropFilter: 'blur(16px)',
          borderColor: 'var(--base-300)',
        }}
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-gradient-primary)', boxShadow: '0 4px 14px var(--primary)50' }}>
              <FlaskConical size={20} style={{ color: 'var(--primary-content)' }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-montserrat)', color: 'var(--base-content)' }}>
                Inventory <span className="text-gradient-primary">Management</span>
              </h1>
              <p className="text-xs opacity-50 mt-0.5">
                Multi-store stock control · {user?.name && `${user.name} · `}
                <span style={{ color: 'var(--primary)' }}>{user?.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Store filter */}
            <select value={storeFilter}
              onChange={e => { setStoreFilter(e.target.value); setLowPage(1); setExpPage(1); }}
              className="input-field text-sm py-2 min-w-[160px]">
              <option value="">All Stores</option>
              {stores.map(s => <option key={s._id} value={s._id}>{s.storeName}</option>)}
            </select>

            {/* Expiry days */}
            <select value={expiryDays}
              onChange={e => { setExpiryDays(Number(e.target.value)); setExpPage(1); }}
              className="input-field text-sm py-2">
              {[7, 15, 30, 60, 90].map(d => <option key={d} value={d}>Expiry ≤ {d}d</option>)}
            </select>

            <button onClick={refresh}
              className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
              <RefreshCw size={14} className={invLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      <div className="px-6 py-6 max-w-[1600px] mx-auto flex flex-col gap-6">

        {/* ── KPI Row ──────────────────────────────────────── */}
        <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          variants={stagger} initial="hidden" animate="visible">
          <KpiCard i={0} icon={TrendingDown} label="Low / Out of Stock" value={lowStockReport.total}
            color="var(--warning)" trend={12} />
          <KpiCard i={1} icon={Clock} label={`Expiring ≤ ${expiryDays}d`} value={expiryAlerts.total}
            color="var(--error)" trend={-5} />
          <KpiCard i={2} icon={Store} label="Active Stores" value={stores.filter(s => s.status !== 'Inactive').length}
            color="var(--info)" sub={`${stores.length} total`} />
          <KpiCard i={3} icon={Pill} label="Medicine Catalog" value={medicines.length}
            color="var(--primary)" sub={`${stats?.discontinuedCount ?? 0} discontinued`} />
        </motion.div>

        {/* ── Stats Bar ────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="glass-card px-5 py-4 flex flex-wrap gap-6">
          {[
            { l: 'Total Stock Units', v: fmt(stats?.totalStock ?? 0), c: 'var(--primary)'  },
            { l: 'Low Stock Alerts',  v: fmt(stats?.lowStockAlerts ?? 0), c: 'var(--warning)' },
            { l: 'Expiry Alerts (30d)', v: fmt(stats?.expiryAlerts ?? 0), c: 'var(--error)'   },
            { l: 'Discontinued',      v: fmt(stats?.discontinuedCount ?? 0), c: 'var(--neutral)' },
          ].map(({ l, v, c }) => (
            <div key={l} className="flex items-center gap-3">
              <div className="w-2 h-8 rounded-full" style={{ background: c }} />
              <div>
                <div className="text-lg font-black" style={{ color: c, fontFamily: 'var(--font-montserrat)' }}>{v}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50">{l}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <TabBtn key={t.id} active={tab === t.id} icon={t.icon}
              label={t.label} badge={t.badge} onClick={() => setTab(t.id)} />
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {tab === 'alerts' && (
            <motion.div key="alerts"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
              className="flex flex-col gap-5">
              <LowStockTable data={lowStockReport} loading={invLoading}
                page={lowPage} setPage={setLowPage} />
              <ExpiryTable data={expiryAlerts} loading={invLoading}
                page={expPage} setPage={setExpPage} />
            </motion.div>
          )}

          {tab === 'browse' && (
            <motion.div key="browse"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              <MedicineInventoryPanel medicines={medicines} stores={stores} dispatch={dispatch} />
            </motion.div>
          )}

          {tab === 'analytics' && (
            <motion.div key="analytics"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              <AnalyticsTab stores={stores} stats={stats} />
            </motion.div>
          )}

          {tab === 'sync' && (
            <motion.div key="sync"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              <SyncPanel dispatch={dispatch} syncLoading={syncLoading} syncResult={syncResult} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}