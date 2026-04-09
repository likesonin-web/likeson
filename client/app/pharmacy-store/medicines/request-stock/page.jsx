'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, ChevronRight, Loader2, Package,
  Pill, ArrowLeft, CheckCircle2, AlertCircle, Zap,
  TrendingUp, Hash, Info, Star, Clock, BarChart3
} from 'lucide-react';
import { requestStock, fetchMedicines, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const URGENCY_CONFIG = {
  Low: {
    label: 'Low',
    desc: 'Replenish within the week',
    color: 'success',
    icon: Clock,
    gradient: 'from-success/20 to-success/5',
  },
  Medium: {
    label: 'Medium',
    desc: 'Restock within 2–3 days',
    color: 'warning',
    icon: TrendingUp,
    gradient: 'from-warning/20 to-warning/5',
  },
  High: {
    label: 'High',
    desc: 'Needed today or tomorrow',
    color: 'error',
    icon: Zap,
    gradient: 'from-error/20 to-error/5',
  },
  Critical: {
    label: 'Critical',
    desc: 'Out of stock — urgent!',
    color: 'error',
    icon: AlertCircle,
    gradient: 'from-error/30 to-error/10',
  },
};

function UrgencyCard({ value, selected, onSelect }) {
  const cfg = URGENCY_CONFIG[value];
  const Icon = cfg.icon;
  return (
    <button type="button" onClick={() => onSelect(value)}
      className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 bg-gradient-to-br ${cfg.gradient}
        ${selected ? `border-${cfg.color} shadow-lg scale-[1.02]` : 'border-base-300 hover:border-base-content/30'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2`}
        style={{ background: `color-mix(in srgb, var(--${cfg.color}), transparent 75%)` }}>
        <Icon size={17} style={{ color: `var(--${cfg.color})` }} />
      </div>
      <p className="font-black text-base-content text-sm">{cfg.label}</p>
      <p className="text-xs text-base-content/50 mt-0.5 leading-tight">{cfg.desc}</p>
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: `var(--${cfg.color})` }}>
          <CheckCircle2 size={12} className="text-white" />
        </div>
      )}
    </button>
  );
}

function QuantityPreset({ value, current, onClick }) {
  return (
    <button type="button" onClick={() => onClick(value)}
      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all
        ${current === value ? 'bg-primary text-primary-content border-primary shadow' : 'bg-base-200 border-base-300 text-base-content/60 hover:border-primary'}`}>
      {value}
    </button>
  );
}

export default function RequestRestockPage() {
  const dispatch = useDispatch();
  const { medicines, loading, errors, success } = useSelector(s => s.pharmacyStore);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1);
  const [urgency, setUrgency] = useState('Medium');
  const [quantity, setQuantity] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState([]); // local submission history

  useEffect(() => {
    dispatch(fetchMedicines({ search, limit: 10 }));
  }, [search, dispatch]);

  useEffect(() => {
    if (success.requestStock) {
      setSubmitted(true);
      if (selected) {
        setHistory(h => [{ name: selected.brandName || selected.name, quantity, urgency, time: new Date() }, ...h.slice(0, 4)]);
      }
      dispatch(clearSuccess('requestStock'));
      setTimeout(() => {
        setSubmitted(false);
        setSelected(null);
        setStep(1);
        setQuantity('');
        setUrgency('Medium');
      }, 2800);
    }
  }, [success.requestStock, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected || !quantity) return;
    dispatch(requestStock({
      medicineId: selected._id,
      requiredQuantity: Number(quantity),
      urgency,
    }));
  };

  const currStock = selected
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
            <h1 className="text-3xl font-black tracking-tight font-montserrat flex items-center gap-2">
              <ShoppingCart size={26} className="text-primary" />
              <span className="text-gradient-primary">Request Restock</span>
            </h1>
            <p className="text-sm text-base-content/55 mt-0.5">
              {step === 1 ? 'Select a medicine to request replenishment' : `Restock request for ${selected?.brandName}`}
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mt-4">
          {['Select Medicine', 'Request Details'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 
                ${step === i + 1 ? 'bg-primary text-primary-content shadow-md' : step > i + 1 ? 'bg-success text-success-content' : 'bg-base-300 text-base-content/50'}`}>
                {step > i + 1 ? <CheckCircle2 size={13} /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < 1 && <ChevronRight size={14} className="text-base-content/30" />}
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* STEP 1 */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="card p-4 mb-5">
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search medicines..."
                      className="input-field w-full pl-10" />
                  </div>
                </motion.div>

                <div className="space-y-3">
                  {loading.medicines ? (
                    <div className="flex items-center justify-center py-16 gap-3 text-primary">
                      <Loader2 className="animate-spin" size={22} />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : medicines.map((med, i) => {
                    const inv = (med.storeInventory || []).reduce((s, x) => s + (x.stockQuantity || 0), 0);
                    const isLow = inv <= 5;
                    return (
                      <motion.button key={med._id} variants={fadeUp} initial="hidden" animate="visible" custom={i * 0.4 + 2}
                        onClick={() => { setSelected(med); setStep(2); }}
                        className="card p-4 text-left w-full flex items-center gap-4 hover:border-primary group transition-all">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? 'bg-warning/15' : 'bg-primary/10'}`}>
                          <Pill size={20} className={isLow ? 'text-warning' : 'text-primary'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-base-content">{med.brandName}</span>
                            {isLow && inv > 0 && <span className="badge badge-warning text-[10px]">Low Stock</span>}
                            {inv === 0 && <span className="badge badge-error text-[10px]">Out of Stock</span>}
                          </div>
                          <p className="text-xs text-base-content/50 truncate">{med.genericName} · {med.dosage}</p>
                          <p className="text-xs mt-0.5 text-base-content/40">
                            Current stock: <span className={`font-bold ${inv === 0 ? 'text-error' : isLow ? 'text-warning' : 'text-success'}`}>{inv} units</span>
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-base-content/30 group-hover:text-primary transition-colors flex-shrink-0" />
                      </motion.button>
                    );
                  })}
                  {medicines.length === 0 && !loading.medicines && (
                    <div className="text-center py-16 text-base-content/40">
                      <Package size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No medicines found</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {/* Medicine card */}
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="glass-card p-5 mb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <Pill size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-base-content">{selected?.brandName}</h3>
                      <p className="text-sm text-base-content/55">{selected?.genericName} · {selected?.dosage}</p>
                      <p className="text-xs mt-1 text-base-content/45">
                        Current stock: <span className={`font-bold ${currStock === 0 ? 'text-error' : currStock <= 5 ? 'text-warning' : 'text-success'}`}>{currStock} units</span>
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Success */}
                <AnimatePresence>
                  {submitted && (
                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                      className="card p-10 text-center mb-5 border-success/40 bg-success/5">
                      <CheckCircle2 size={52} className="text-success mx-auto mb-3" />
                      <h3 className="text-xl font-black text-base-content">Request Submitted!</h3>
                      <p className="text-sm text-base-content/55 mt-1">The restock request has been logged and forwarded.</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!submitted && (
                  <motion.form onSubmit={handleSubmit} variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                    <div className="card p-6 space-y-6">
                      {/* Urgency */}
                      <div>
                        <label className="block text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">
                          Urgency Level <span className="text-error">*</span>
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.keys(URGENCY_CONFIG).map(u => (
                            <UrgencyCard key={u} value={u} selected={urgency === u} onSelect={setUrgency} />
                          ))}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-xs font-bold text-base-content/60 mb-2 uppercase tracking-wider">
                          Required Quantity <span className="text-error">*</span>
                        </label>
                        {/* Presets */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-xs text-base-content/40">Quick:</span>
                          {[25, 50, 100, 200, 500].map(v => (
                            <QuantityPreset key={v} value={v} current={Number(quantity)} onClick={v => setQuantity(String(v))} />
                          ))}
                        </div>
                        <div className="relative">
                          <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
                          <input type="number" min="1" required value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            placeholder="Enter quantity..."
                            className="input-field w-full pl-9" />
                        </div>
                      </div>

                      <div className="alert alert-info text-xs rounded-xl">
                        <Info size={14} className="text-info flex-shrink-0" />
                        <span>This request will be logged and the procurement team will be notified. No inventory changes are made until stock is physically received.</span>
                      </div>

                      {errors.requestStock && (
                        <div className="alert alert-error text-xs">
                          <AlertCircle size={14} className="flex-shrink-0" />
                          <span>{errors.requestStock?.message || 'Failed to submit request'}</span>
                        </div>
                      )}

                      <button type="submit" disabled={loading.requestStock || !quantity}
                        className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading.requestStock ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                        {loading.requestStock ? 'Submitting...' : 'Submit Restock Request'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: Recent requests */}
        <div className="space-y-4">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="card p-5">
            <h3 className="font-bold text-base-content text-sm mb-4 flex items-center gap-2">
              <BarChart3 size={15} className="text-primary" /> Recent Requests
            </h3>
            {history.length === 0 ? (
              <div className="text-center py-8 text-base-content/35">
                <ShoppingCart size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">No requests yet this session</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => {
                  const cfg = URGENCY_CONFIG[h.urgency];
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-base-200">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `color-mix(in srgb, var(--${cfg.color}), transparent 80%)` }}>
                        <Icon size={14} style={{ color: `var(--${cfg.color})` }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-base-content truncate">{h.name}</p>
                        <p className="text-[10px] text-base-content/45">{h.quantity} units · {h.urgency}</p>
                      </div>
                      <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="card p-5">
            <h3 className="font-bold text-base-content text-sm mb-3 flex items-center gap-2">
              <Info size={14} className="text-info" /> Urgency Guide
            </h3>
            <div className="space-y-2">
              {Object.entries(URGENCY_CONFIG).map(([k, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={k} className="flex items-start gap-2">
                    <Icon size={13} style={{ color: `var(--${cfg.color})` }} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-base-content">{cfg.label}:</span>
                      <span className="text-xs text-base-content/50 ml-1">{cfg.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}