'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Search, Calendar, Hash, DollarSign,
  ChevronRight, CheckCircle2, AlertCircle, Loader2,
  Pill, ArrowLeft, Info, Sparkles, TrendingUp
} from 'lucide-react';
import { addStock, fetchMedicines, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const shimmer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export default function AddStockPage() {
  const dispatch = useDispatch();
  const { medicines, loading, errors, success } = useSelector(s => s.pharmacyStore);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1); // 1: select medicine, 2: fill form
  const [form, setForm] = useState({
    stockQuantity: '',
    batchNumber: '',
    expiryDate: '',
    pricePerUnit: '',
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dispatch(fetchMedicines({ search, limit: 10 }));
  }, [search, dispatch]);

  useEffect(() => {
    if (success.addStock) {
      setSubmitted(true);
      dispatch(clearSuccess('addStock'));
      setTimeout(() => {
        setSubmitted(false);
        setSelected(null);
        setStep(1);
        setForm({ stockQuantity: '', batchNumber: '', expiryDate: '', pricePerUnit: '' });
      }, 2800);
    }
  }, [success.addStock, dispatch]);

  const handleSelect = (med) => {
    setSelected(med);
    setForm(f => ({ ...f, pricePerUnit: med.mrp || '' }));
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return;
    dispatch(addStock({
      medicineId: selected._id,
      stockQuantity: Number(form.stockQuantity),
      batchNumber: form.batchNumber,
      expiryDate: form.expiryDate,
      pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : undefined,
    }));
  };

  const storeInv = selected
    ? (selected.storeInventory || []).reduce((s, i) => s + (i.stockQuantity || 0), 0)
    : 0;

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          {step === 2 && (
            <button onClick={() => { setStep(1); setSelected(null); }}
              className="p-2 rounded-xl bg-base-100 border border-base-300 text-base-content/60 hover:text-primary hover:border-primary transition-all">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight text-base-content font-montserrat flex items-center gap-2">
              <span className="text-gradient-primary">Add Stock</span>
              <Sparkles size={22} className="text-primary" />
            </h1>
            <p className="text-sm text-base-content/55 mt-0.5">
              {step === 1 ? 'Search and select a medicine to restock' : `Adding stock for ${selected?.brandName || selected?.name}`}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mt-4">
          {['Select Medicine', 'Stock Details'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 ${step === i + 1 ? 'bg-primary text-primary-content shadow-md' : step > i + 1 ? 'bg-success text-success-content' : 'bg-base-300 text-base-content/50'}`}>
                {step > i + 1 ? <CheckCircle2 size={13} /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < 1 && <ChevronRight size={14} className="text-base-content/30" />}
            </div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Select Medicine */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35 }}>
            {/* Search */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="card p-4 mb-5">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search medicines by name, brand, or generic..."
                  className="input-field w-full pl-10 pr-4"
                />
              </div>
            </motion.div>

            {/* Medicine List */}
            {loading.medicines ? (
              <div className="flex items-center justify-center py-16 gap-3 text-primary">
                <Loader2 className="animate-spin" size={22} />
                <span className="text-sm font-medium">Loading medicines...</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {medicines.map((med, i) => {
                  const inv = (med.storeInventory || []).reduce((s, x) => s + (x.stockQuantity || 0), 0);
                  return (
                    <motion.button
                      key={med._id}
                      variants={fadeUp} initial="hidden" animate="visible" custom={i * 0.5 + 2}
                      onClick={() => handleSelect(med)}
                      className="card p-4 text-left w-full flex items-center gap-4 hover:border-primary group transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                        <Pill size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base-content text-sm">{med.brandName}</span>
                          <span className="badge badge-primary text-[10px] py-0">{med.category}</span>
                          {inv <= 5 && inv > 0 && <span className="badge badge-warning text-[10px] py-0">Low Stock</span>}
                          {inv === 0 && <span className="badge badge-error text-[10px] py-0">Out of Stock</span>}
                        </div>
                        <p className="text-xs text-base-content/55 mt-0.5 truncate">{med.genericName} · {med.dosage} · {med.manufacturer}</p>
                        <p className="text-xs text-base-content/40 mt-0.5">MRP ₹{med.mrp} · Current stock: <span className={`font-semibold ${inv <= 5 ? 'text-warning' : 'text-success'}`}>{inv} units</span></p>
                      </div>
                      <ChevronRight size={18} className="text-base-content/30 group-hover:text-primary transition-colors flex-shrink-0" />
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
            )}
          </motion.div>
        )}

        {/* STEP 2: Form */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.35 }}>
            {/* Selected Medicine Card */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="glass-card p-5 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Pill size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base-content text-lg">{selected?.brandName}</h3>
                  <p className="text-sm text-base-content/55">{selected?.genericName} · {selected?.dosage}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-semibold text-success flex items-center gap-1">
                      <TrendingUp size={11} /> Current: {storeInv} units
                    </span>
                    <span className="text-xs text-base-content/40">MRP ₹{selected?.mrp}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Success State */}
            <AnimatePresence>
              {submitted && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="card p-8 text-center mb-6 border-success/40 bg-success/5">
                  <CheckCircle2 size={52} className="text-success mx-auto mb-3" />
                  <h3 className="text-xl font-black text-base-content">Stock Added!</h3>
                  <p className="text-sm text-base-content/55 mt-1">Inventory updated successfully</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!submitted && (
              <motion.form onSubmit={handleSubmit} variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                <div className="card p-6 space-y-5">
                  <h3 className="font-bold text-base-content flex items-center gap-2 text-sm uppercase tracking-wider text-primary/80">
                    <Package size={15} /> Stock Information
                  </h3>

                  {/* Quantity + Batch */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                        Stock Quantity <span className="text-error">*</span>
                      </label>
                      <div className="relative">
                        <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                        <input type="number" min="1" required value={form.stockQuantity}
                          onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))}
                          placeholder="e.g. 100"
                          className="input-field w-full pl-9" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                        Batch Number <span className="text-error">*</span>
                      </label>
                      <div className="relative">
                        <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                        <input type="text" required value={form.batchNumber}
                          onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
                          placeholder="e.g. BATCH-2024-001"
                          className="input-field w-full pl-9" />
                      </div>
                    </div>
                  </div>

                  {/* Expiry + Price */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                        Expiry Date <span className="text-error">*</span>
                      </label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                        <input type="date" required value={form.expiryDate}
                          onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                          className="input-field w-full pl-9" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-base-content/70 mb-1.5 uppercase tracking-wider">
                        Price Per Unit (₹)
                      </label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                        <input type="number" min="0" step="0.01" value={form.pricePerUnit}
                          onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))}
                          placeholder={`Default: ₹${selected?.mrp}`}
                          className="input-field w-full pl-9" />
                      </div>
                      <p className="text-xs text-base-content/40 mt-1 flex items-center gap-1">
                        <Info size={10} /> Defaults to MRP if left empty
                      </p>
                    </div>
                  </div>

                  {/* Alert: Low stock threshold */}
                  <div className="alert alert-info text-xs">
                    <Info size={14} className="text-info flex-shrink-0 mt-0.5" />
                    <span>If stock quantity is ≤ 5 units after this update, a low-stock alert will be automatically dispatched.</span>
                  </div>

                  {errors.addStock && (
                    <div className="alert alert-error text-xs">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{errors.addStock?.message || 'Failed to add stock'}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading.addStock}
                    className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading.addStock ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {loading.addStock ? 'Adding Stock...' : 'Add Stock'}
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