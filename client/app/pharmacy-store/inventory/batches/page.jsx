'use client';

/**
 * BatchesPage.jsx — Pharmacy Inventory Batches
 *
 * Design Direction: "Analytical Command Center"
 * Clean, high-density data table with clear visual indicators for stock and expiry.
 * Non-intrusive sticky header, polished edit modal with field notes.
 */

import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  Edit2,
  Loader2,
  X,
  TrendingDown,
  ArrowLeft,
  Info,
  ShieldAlert,
  Layers,
  Building2,
  PackageSearch,
  Save,
  HelpCircle,
} from 'lucide-react';
import {
  fetchInventoryBatches,
  updateBatch,
  clearSuccess,
  clearError,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ─── Animation Variants ──────────────────────────────────────────────────────

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.04, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const MODAL_OVERLAY = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const MODAL_CONTENT = {
  hidden: { scale: 0.95, opacity: 0, y: 10 },
  visible: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { scale: 0.95, opacity: 0, y: 10, transition: { duration: 0.15 } },
};

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STATUS_STYLES = {
  Active:     'bg-success/15 text-success border-success/30',
  Exhausted:  'bg-base-300 text-base-content/60 border-base-300',
  Expired:    'bg-error/15 text-error border-error/30',
  Recalled:   'bg-error/15 text-error border-error/30',
  Quarantine: 'bg-warning/15 text-warning border-warning/30',
  Damaged:    'bg-warning/15 text-warning border-warning/30',
};

const STATUS_ICONS = {
  Active:     <CheckCircle2 size={12} />,
  Exhausted:  <TrendingDown size={12} />,
  Expired:    <XCircle size={12} />,
  Recalled:   <ShieldAlert size={12} />,
  Quarantine: <AlertTriangle size={12} />,
  Damaged:    <AlertTriangle size={12} />,
};

const FieldNote = ({ children }) => (
  <p className="text-base-content/50 text-[10px] mt-1.5 flex items-start gap-1.5 leading-snug">
    <Info size={12} className="shrink-0 mt-0.5" />
    <span>{children}</span>
  </p>
);

const getDaysLeft = (expDate) => {
  if (!expDate) return null;
  return Math.ceil((new Date(expDate) - new Date()) / 86400000);
};

// ─── Components ───────────────────────────────────────────────────────────────

function EditBatchModal({ batch, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : '',
    status: batch.status,
    damagedQuantity: batch.damagedQuantity || 0,
    returnedQuantity: batch.returnedQuantity || 0,
  });

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      batchId: batch._id,
      ...form,
      damagedQuantity: Number(form.damagedQuantity),
      returnedQuantity: Number(form.returnedQuantity),
    });
  };

  const isDestructiveStatus = ['Expired', 'Recalled', 'Damaged'].includes(form.status);

  return (
    <motion.div
      variants={MODAL_OVERLAY} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        variants={MODAL_CONTENT}
        className="bg-base-100 rounded-3xl shadow-2xl border border-base-300 w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-base-300 flex items-center justify-between bg-base-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Edit2 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-base-content leading-tight">Edit Batch Record</h3>
              <p className="text-xs text-base-content/50 font-mono mt-0.5">{batch.batchNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-error">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Context Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-base-200 border border-base-300 mb-6">
            <div>
              <p className="text-xs font-bold text-base-content">{batch.medicineId?.brandName}</p>
              <p className="text-[10px] text-base-content/50">{batch.medicineId?.genericName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-base-content">{batch.remainingQuantity} units</p>
              <p className="text-[10px] text-base-content/50">Available Stock</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Expiry Date */}
            <div>
              <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
                Expiry Date
              </label>
              <input
                name="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={handleChange}
                className="input-field w-full text-sm"
              />
              <FieldNote>Update only if recorded incorrectly during purchase.</FieldNote>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
                Operational Status
              </label>
              <div className="relative">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={`input-field w-full appearance-none pr-8 text-sm ${isDestructiveStatus ? 'border-error/50 bg-error/5' : ''}`}
                >
                  {['Active', 'Exhausted', 'Expired', 'Recalled', 'Quarantine', 'Damaged'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
              </div>
              <FieldNote>
                {isDestructiveStatus 
                  ? <span className="text-error font-medium">Warning: This prevents further dispensing.</span>
                  : 'Controls if batch is available for FEFO.'}
              </FieldNote>
            </div>

            {/* Damaged Quantity */}
            <div>
              <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
                Damaged Units
              </label>
              <input
                name="damagedQuantity"
                type="number"
                min="0"
                max={batch.quantityPurchased}
                value={form.damagedQuantity}
                onChange={handleChange}
                className="input-field w-full text-sm font-mono"
              />
              <FieldNote>Found broken/unusable? This permanently reduces available stock.</FieldNote>
            </div>

            {/* Returned Quantity */}
            <div>
              <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
                Returned Units
              </label>
              <input
                name="returnedQuantity"
                type="number"
                min="0"
                value={form.returnedQuantity}
                onChange={handleChange}
                className="input-field w-full text-sm font-mono"
              />
              <FieldNote>Units returned by patients. Held separately from active stock.</FieldNote>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-base-300">
            <button type="button" onClick={onClose} className="btn btn-ghost px-6">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary px-8 gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BatchesPage() {
  const dispatch = useDispatch();
  const { inventoryBatches, batchesPagination, loading, success } = useSelector((s) => s.pharmacyStore);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nearExpiry, setNearExpiry] = useState(false);
  const [page, setPage] = useState(1);
  const [editBatch, setEditBatch] = useState(null);

  const fetch = () => {
    dispatch(
      fetchInventoryBatches({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        nearExpiry: nearExpiry ? 'true' : undefined,
      })
    );
  };

  useEffect(() => { fetch(); }, [page, statusFilter, nearExpiry]);
  
  useEffect(() => {
    const t = setTimeout(() => { if(page === 1) fetch(); else setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (success.updateBatch) {
      setEditBatch(null);
      fetch();
      setTimeout(() => dispatch(clearSuccess('updateBatch')), 2500);
    }
  }, [success.updateBatch]);

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 pb-16">
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-base-100 border-b border-base-300 px-6 py-5 sticky top-0 z-20 shadow-sm"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full border border-base-300 flex items-center justify-center text-base-content/60 hover:bg-base-200 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black font-montserrat tracking-tight text-base-content">
                  Batch <span className="text-primary">Registry</span>
                </h1>
                <span className="badge badge-sm badge-primary badge-outline font-mono">
                  {batchesPagination?.totalItems || 0} Records
                </span>
              </div>
              <p className="text-xs text-base-content/50 mt-0.5">
                Manage physical lots, monitor expiries, and adjust statuses.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* ── Success Toast ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {success.updateBatch && (
            <motion.div
              initial={{ opacity: 0, height: 0, mb: 0 }} animate={{ opacity: 1, height: 'auto', mb: 16 }} exit={{ opacity: 0, height: 0, mb: 0 }}
              className="overflow-hidden"
            >
              <div className="alert alert-success shadow-sm rounded-xl py-3 flex items-center gap-3 border border-success/20">
                <CheckCircle2 size={18} className="text-success shrink-0" />
                <span className="text-sm font-semibold text-success-content">Batch configuration updated successfully.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Control Panel ─────────────────────────────────────────────── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={0} className="card p-3 flex flex-col md:flex-row gap-3 shadow-sm border border-base-300">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              className="input-field pl-10 w-full text-sm bg-base-200/50 focus:bg-base-100"
              placeholder="Search by brand, generic name, or exact batch number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-44">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field w-full appearance-none pr-8 text-sm bg-base-200/50 cursor-pointer"
              >
                <option value="">All Statuses</option>
                {['Active', 'Exhausted', 'Expired', 'Recalled', 'Quarantine', 'Damaged'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
            </div>

            <button
              onClick={() => setNearExpiry(!nearExpiry)}
              className={`btn btn-sm h-[42px] px-4 gap-2 rounded-xl border ${nearExpiry ? 'bg-warning/20 text-warning border-warning/50 hover:bg-warning/30 hover:border-warning' : 'bg-base-200/50 text-base-content/60 border-base-300 hover:bg-base-200 hover:text-base-content'}`}
            >
              <Clock size={16} className={nearExpiry ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">Near Expiry</span>
            </button>
          </div>
        </motion.div>

        {/* ── Main Data Table ───────────────────────────────────────────── */}
        {loading.inventoryBatches ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 size={36} className="animate-spin text-primary/40 mb-4" />
            <p className="text-sm font-semibold text-base-content/50 uppercase tracking-widest">Scanning Registry...</p>
          </div>
        ) : inventoryBatches?.length === 0 ? (
          <motion.div variants={FADE_UP} initial="hidden" animate="visible" className="card p-16 flex flex-col items-center text-center border border-base-300 border-dashed bg-base-100/50">
            <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
              <PackageSearch size={28} className="text-base-content/30" />
            </div>
            <h3 className="font-bold text-lg text-base-content">No batches found</h3>
            <p className="text-sm text-base-content/50 mt-1 max-w-sm">
              {search || statusFilter || nearExpiry 
                ? "Try adjusting your filters or clearing the search query to see more results."
                : "Your inventory registry is currently empty. Batches will appear here once you receive stock via Purchase Orders."}
            </p>
          </motion.div>
        ) : (
          <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={1} className="card shadow-sm border border-base-300 overflow-hidden">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="table w-full">
                <thead className="bg-base-200/50 text-base-content/60 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="pl-6 py-4 font-bold">Product & Supplier</th>
                    <th className="py-4 font-bold">Batch ID</th>
                    <th className="py-4 font-bold">Expiry Timeline</th>
                    <th className="py-4 font-bold">Stock Utilization</th>
                    <th className="py-4 font-bold">Status</th>
                    <th className="pr-6 py-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                  {inventoryBatches.map((b, i) => {
                    const days = getDaysLeft(b.expiryDate);
                    const isExp = days !== null && days <= 0;
                    const isWarn = days !== null && days <= 90 && days > 0;
                    
                    const pct = b.quantityPurchased ? Math.round((b.remainingQuantity / b.quantityPurchased) * 100) : 0;
                    const barColor = pct > 50 ? 'bg-success' : pct > 20 ? 'bg-warning' : 'bg-error';

                    return (
                      <motion.tr 
                        key={b._id} variants={FADE_UP} custom={i} 
                        className="hover:bg-base-200/30 transition-colors group"
                      >
                        {/* 1. Product & Supplier */}
                        <td className="pl-6 py-4 max-w-[250px]">
                          <div className="font-bold text-sm text-base-content truncate">
                            {b.medicineId?.brandName || 'Unknown Product'}
                          </div>
                          <div className="text-[11px] text-base-content/50 truncate mb-1.5">
                            {b.medicineId?.genericName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-base-content/40 bg-base-200 w-fit px-2 py-0.5 rounded">
                            <Building2 size={10} />
                            <span className="truncate max-w-[150px]">{b.supplierId?.name || 'Unknown Supplier'}</span>
                          </div>
                        </td>

                        {/* 2. Batch Number */}
                        <td className="py-4 align-top pt-5">
                          <code className="text-xs bg-base-200 border border-base-300 px-2 py-1 rounded-md font-mono text-base-content/70">
                            {b.batchNumber}
                          </code>
                        </td>

                        {/* 3. Expiry */}
                        <td className="py-4 align-top pt-5">
                          <div className={`text-sm font-bold ${isExp ? 'text-error' : isWarn ? 'text-warning' : 'text-base-content'}`}>
                            {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </div>
                          {days !== null && (
                            <div className={`text-[10px] font-semibold mt-1 flex items-center gap-1 uppercase tracking-wide ${isExp ? 'text-error/70' : isWarn ? 'text-warning/80' : 'text-base-content/40'}`}>
                              <Clock size={10} />
                              {isExp ? `Expired ${Math.abs(days)}d ago` : `${days} Days Left`}
                            </div>
                          )}
                        </td>

                        {/* 4. Stock */}
                        <td className="py-4 align-top pt-5 min-w-[140px]">
                          <div className="flex items-end justify-between mb-1.5">
                            <span className="font-black text-sm text-base-content leading-none">
                              {b.remainingQuantity} <span className="text-[10px] font-medium text-base-content/40 uppercase tracking-wide">rem</span>
                            </span>
                            <span className="text-xs text-base-content/40 font-mono">
                              / {b.quantityPurchased}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden flex">
                            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td className="py-4 align-top pt-5">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={`badge badge-sm border font-semibold gap-1.5 px-2.5 py-1h ${STATUS_STYLES[b.status] || STATUS_STYLES.Exhausted}`}>
                              {STATUS_ICONS[b.status] || STATUS_ICONS.Exhausted}
                              {b.status}
                            </span>
                            {b.isNearExpiry && b.status === 'Active' && !isExp && (
                              <span className="text-[10px] font-bold text-warning flex items-center gap-1 uppercase tracking-wider">
                                <AlertTriangle size={10} /> Expedite
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Actions */}
                        <td className="pr-6 py-4 align-top pt-5 text-right">
                          <button
                            onClick={() => setEditBatch(b)}
                            className="btn btn-sm btn-ghost border border-base-300 text-base-content/60 hover:border-primary hover:text-primary hover:bg-primary/5"
                            aria-label="Edit Batch"
                          >
                            <Edit2 size={14} />
                            <span className="hidden xl:inline">Modify</span>
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {batchesPagination?.totalPages > 1 && (
              <div className="bg-base-200/30 border-t border-base-300 px-6 py-4 flex items-center justify-between">
                <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                  Page {batchesPagination.currentPage} of {batchesPagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="btn btn-sm btn-outline border-base-300 text-base-content/70 hover:bg-base-300"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= batchesPagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn btn-sm btn-outline border-base-300 text-base-content/70 hover:bg-base-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editBatch && (
          <EditBatchModal
            batch={editBatch}
            onClose={() => setEditBatch(null)}
            onSave={(payload) => dispatch(updateBatch(payload))}
            saving={loading.updateBatch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}