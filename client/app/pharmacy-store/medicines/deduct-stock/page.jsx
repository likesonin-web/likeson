'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus, Search, AlertTriangle, CheckCircle2, Loader2,
  Pill, ArrowLeft, ChevronRight, Hash, FileText, Package,
  TrendingDown, AlertCircle, ShieldAlert
} from 'lucide-react';
import { deductStock, fetchMedicines, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const REASONS = [
  'Dispensed to Patient',
  'Expired - Disposed',
  'Damaged / Broken',
  'Quality Check Failure',
  'Stock Adjustment',
  'Internal Use',
  'Other',
];

export default function DeductStockPage() {
  const dispatch = useDispatch();
  const { medicines, loading, errors, success } = useSelector(s => s.pharmacyStore);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ quantity: '', batchNumber: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dispatch(fetchMedicines({ search, limit: 10 }));
  }, [search, dispatch]);

  useEffect(() => {
    if (success.deductStock) {
      setSubmitted(true);
      dispatch(clearSuccess('deductStock'));
      setTimeout(() => {
        setSubmitted(false);
        setSelected(null);
        setStep(1);
        setForm({ quantity: '', batchNumber: '', reason: '' });
      }, 2800);
    }
  }, [success.deductStock, dispatch]);

  const handleSelect = (med) => { setSelected(med); setStep(2); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return;
    dispatch(deductStock({
      medicineId: selected._id,
      quantity: Number(form.quantity),
      batchNumber: form.batchNumber || undefined,
      reason: form.reason,
    }));
  };

  const totalStock = selected
    ? (selected.storeInventory || []).reduce((s, i) => s + (i.stockQuantity || 0), 0)
    : 0;

  const remainingAfter = form.quantity ? totalStock - Number(form.quantity) : totalStock;
  const isOverDeducting = Number(form.quantity) > totalStock;
  const willBeLowStock = remainingAfter <= 5 && remainingAfter >= 0;

  const batches = selected?.storeInventory || [];

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          {step === 2 && (
            <button onClick={() => { setStep(1); setSelected(null); }}
              className="p-2 rounded-xl bg-base-100 border border-base-300 text-base-content/60 hover:text-error hover:border-error transition-all">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight font-montserrat flex items-center gap-2">
              <span className="text-base-content">Deduct</span>
              <span className="text-error"> Stock</span>
              <TrendingDown size={22} className="text-error" />
            </h1>
            <p className="text-sm text-base-content/55 mt-0.5">
              {step === 1 ? 'Select a medicine to reduce inventory' : `Deducting from ${selected?.brandName}`}
            </p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mt-4">
          {['Select Medicine', 'Deduct Details'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 
                ${step === i + 1 ? 'bg-error text-error-content shadow-md' : step > i + 1 ? 'bg-success text-success-content' : 'bg-base-300 text-base-content/50'}`}>
                {step > i + 1 ? <CheckCircle2 size={13} /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < 1 && <ChevronRight size={14} className="text-base-content/30" />}
            </div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* STEP 1 */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="card p-4 mb-5">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search medicines..."
                  className="input-field w-full pl-10" />
              </div>
            </motion.div>

            <div className="grid gap-3">
              {loading.medicines ? (
                <div className="flex items-center justify-center py-16 gap-3 text-primary">
                  <Loader2 className="animate-spin" size={22} />
                  <span className="text-sm font-medium">Loading medicines...</span>
                </div>
              ) : medicines.map((med, i) => {
                const inv = (med.storeInventory || []).reduce((s, x) => s + (x.stockQuantity || 0), 0);
                return (
                  <motion.button key={med._id} variants={fadeUp} initial="hidden" animate="visible" custom={i * 0.5 + 2}
                    onClick={() => handleSelect(med)}
                    disabled={inv === 0}
                    className="card p-4 text-left w-full flex items-center gap-4 hover:border-error group transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${inv === 0 ? 'bg-base-300' : inv <= 5 ? 'bg-warning/20' : 'bg-error/10'}`}>
                      <Pill size={20} className={inv === 0 ? 'text-base-content/30' : inv <= 5 ? 'text-warning' : 'text-error'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base-content text-sm">{med.brandName}</span>
                        {inv === 0 && <span className="badge badge-error text-[10px]">Out of Stock</span>}
                        {inv > 0 && inv <= 5 && <span className="badge badge-warning text-[10px]">Low Stock</span>}
                      </div>
                      <p className="text-xs text-base-content/55 mt-0.5 truncate">{med.genericName} · {med.dosage}</p>
                      <p className="text-xs mt-0.5">
                        Available: <span className={`font-bold ${inv === 0 ? 'text-error' : inv <= 5 ? 'text-warning' : 'text-success'}`}>{inv} units</span>
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-base-content/30 group-hover:text-error transition-colors flex-shrink-0" />
                  </motion.button>
                );
              })}
              {medicines.length === 0 && !loading.medicines && (
                <div className="text-center py-16 text-base-content/40">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No medicines found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}>
            {/* Medicine info card */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="glass-card p-5 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-error/80 to-warning flex items-center justify-center">
                  <Pill size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-base-content text-lg">{selected?.brandName}</h3>
                  <p className="text-sm text-base-content/55">{selected?.genericName} · {selected?.dosage}</p>
                  <p className="text-xs mt-1 font-semibold text-base-content/70">
                    Total available: <span className={`${totalStock <= 5 ? 'text-warning' : 'text-success'}`}>{totalStock} units</span>
                  </p>
                </div>
              </div>

              {/* Stock preview */}
              {form.quantity && !isOverDeducting && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 pt-4 border-t border-base-300">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-base-content/55">After deduction:</span>
                    <span className={`font-black text-lg ${willBeLowStock ? 'text-warning' : 'text-success'}`}>
                      {remainingAfter} units
                    </span>
                  </div>
                  <div className="progress-bar mt-2">
                    <div className="progress-bar-fill" style={{ width: `${Math.max(0, (remainingAfter / Math.max(totalStock, 1)) * 100)}%`, background: willBeLowStock ? 'var(--warning)' : undefined }} />
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Success */}
            <AnimatePresence>
              {submitted && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="card p-8 text-center mb-6 border-success/40 bg-success/5">
                  <CheckCircle2 size={52} className="text-success mx-auto mb-3" />
                  <h3 className="text-xl font-black text-base-content">Stock Deducted!</h3>
                  <p className="text-sm text-base-content/55 mt-1">Inventory updated successfully</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!submitted && (
              <motion.form onSubmit={handleSubmit} variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                <div className="card p-6 space-y-5">
                  <h3 className="font-bold text-error text-sm uppercase tracking-wider flex items-center gap-2">
                    <Minus size={15} /> Deduction Details
                  </h3>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                      Quantity to Deduct <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                      <input type="number" min="1" max={totalStock} required value={form.quantity}
                        onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                        placeholder={`Max: ${totalStock}`}
                        className={`input-field w-full pl-9 ${isOverDeducting ? 'border-error focus:border-error' : ''}`} />
                    </div>
                    {isOverDeducting && (
                      <p className="text-xs text-error mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> Exceeds available stock ({totalStock} units)
                      </p>
                    )}
                  </div>

                  {/* Batch (optional) */}
                  <div>
                    <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                      Batch Number <span className="text-base-content/40 font-normal normal-case">(optional — deducts from any batch if blank)</span>
                    </label>
                    {batches.length > 0 ? (
                      <select value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
                        className="input-field w-full">
                        <option value="">Any batch</option>
                        {batches.map((b, i) => (
                          <option key={i} value={b.batchNumber}>
                            {b.batchNumber} — {b.stockQuantity} units (exp: {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : 'N/A'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative">
                        <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                        <input type="text" value={form.batchNumber}
                          onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
                          placeholder="e.g. BATCH-001"
                          className="input-field w-full pl-9" />
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                      Reason <span className="text-base-content/40 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                      {REASONS.map(r => (
                        <button type="button" key={r}
                          onClick={() => setForm(f => ({ ...f, reason: r }))}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${form.reason === r ? 'bg-error/10 border-error text-error' : 'bg-base-200 border-base-300 text-base-content/60 hover:border-error/40'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warnings */}
                  {willBeLowStock && !isOverDeducting && form.quantity && (
                    <div className="alert alert-warning text-xs">
                      <AlertTriangle size={14} className="text-warning flex-shrink-0" />
                      <span>This will bring stock to {remainingAfter} units — a low-stock alert will be triggered.</span>
                    </div>
                  )}

                  {errors.deductStock && (
                    <div className="alert alert-error text-xs">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{errors.deductStock?.message || 'Failed to deduct stock'}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading.deductStock || isOverDeducting || !form.quantity}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider
                      bg-error text-error-content shadow-md hover:brightness-110 active:scale-95 transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading.deductStock ? <Loader2 size={16} className="animate-spin" /> : <Minus size={16} />}
                    {loading.deductStock ? 'Processing...' : 'Deduct Stock'}
                  </button>
                </div>
              </motion.form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}