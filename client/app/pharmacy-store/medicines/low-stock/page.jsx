'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown, AlertTriangle, Package, Send, Loader2,
  RefreshCw, Search, MailCheck, Zap, ShoppingCart,
  BarChart3, Settings, ChevronRight, AlertCircle
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { fetchLowStock, requestStock } from '@/store/slices/pharmacy/pharmacyStoreSlice';
import Link from 'next/link';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.42, ease: [0.22, 1, 0.36, 1] } }),
};

function LevelIndicator({ qty, threshold = 5 }) {
  const pct = Math.min(100, (qty / threshold) * 100);
  const color = qty === 0 ? 'var(--error)' : qty <= 2 ? 'var(--error)' : qty <= threshold ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="flex-1 h-2 rounded-full bg-base-300 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
          className="h-full rounded-full" style={{ background: color }} />
      </div>
      <span className="text-xs font-black w-5 text-right" style={{ color }}>{qty}</span>
    </div>
  );
}

function StockCard({ item, i, onRequestRestock }) {
  const qty = item.stockQuantity;
  const urgency = qty === 0 ? 'error' : qty <= 2 ? 'error' : 'warning';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className={`card p-4 hover:shadow-lg transition-all group`}
      style={{ borderLeft: `3px solid var(--${urgency})` }}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, var(--${urgency}), transparent 87%)` }}>
          {qty === 0
            ? <Package size={18} style={{ color: `var(--error)` }} />
            : <TrendingDown size={18} style={{ color: `var(--${urgency})` }} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-base-content text-sm truncate">{item.brandName || item.name}</p>
              <p className="text-xs text-base-content/45 truncate">{item.category} · {item.batchNumber ? `Batch: ${item.batchNumber}` : 'All batches'}</p>
            </div>
            <div>
              {qty === 0
                ? <span className="badge badge-error whitespace-nowrap">Out of Stock</span>
                : <span className="badge badge-warning whitespace-nowrap">{qty} left</span>}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <LevelIndicator qty={qty} />
            <div className="flex items-center gap-2 text-xs text-base-content/45">
              {item.expiryDate && (
                <span>Exp: {new Date(item.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>
              )}
              {item.pricePerUnit && <span>₹{item.pricePerUnit}/u</span>}
            </div>
            <button onClick={() => onRequestRestock(item)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg border border-primary/30 hover:bg-primary/5 whitespace-nowrap">
              <ShoppingCart size={11} /> Restock
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LowStockPage() {
  const dispatch = useDispatch();
  const { lowStockItems, lowStockMeta, loading } = useSelector(s => s.pharmacyStore);

  const [threshold, setThreshold] = useState(5);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [search, setSearch] = useState('');
  const [restockModal, setRestockModal] = useState(null); // {item}
  const [urgency, setUrgency] = useState('Medium');
  const [quantity, setQuantity] = useState(50);

  useEffect(() => {
    dispatch(fetchLowStock({ threshold }));
  }, [threshold, dispatch]);

  const handleSendEmail = async () => {
    setSendingEmail(true);
    await dispatch(fetchLowStock({ threshold, sendEmail: true }));
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  const handleRequestRestock = async () => {
    if (!restockModal) return;
    await dispatch(requestStock({
      medicineId: restockModal.medicineId,
      requiredQuantity: quantity,
      urgency,
    }));
    setRestockModal(null);
  };

  const filtered = lowStockItems.filter(item =>
    !search ||
    (item.brandName || item.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const outOfStock = lowStockItems.filter(i => i.stockQuantity === 0).length;
  const critical = lowStockItems.filter(i => i.stockQuantity > 0 && i.stockQuantity <= 2).length;
  const low = lowStockItems.filter(i => i.stockQuantity > 2 && i.stockQuantity <= threshold).length;

  // Chart data
  const chartData = lowStockItems.slice(0, 8).map(i => ({
    name: (i.brandName || i.name || '').slice(0, 8),
    qty: i.stockQuantity,
  }));

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight font-montserrat flex items-center gap-2">
              <TrendingDown size={26} className="text-error" />
              <span className="text-base-content">Low </span><span className="text-error">Stock</span>
            </h1>
            <p className="text-sm text-base-content/55 mt-1">
              {lowStockMeta.count} medicine{lowStockMeta.count !== 1 ? 's' : ''} at or below threshold of {lowStockMeta.threshold} units
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-base-100 border border-base-300 rounded-xl px-3 py-2">
              <Settings size={13} className="text-base-content/40" />
              <span className="text-xs text-base-content/50">Threshold:</span>
              <input type="number" min="1" max="50" value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-12 bg-transparent text-xs font-bold text-base-content text-right outline-none" />
            </div>

            <AnimatePresence mode="wait">
              {emailSent ? (
                <motion.div key="sent" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-bold">
                  <MailCheck size={14} /> Alert Sent!
                </motion.div>
              ) : (
                <motion.button key="send" onClick={handleSendEmail}
                  disabled={sendingEmail || lowStockItems.length === 0}
                  className="btn-secondary px-4 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50">
                  {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Email Alert
                </motion.button>
              )}
            </AnimatePresence>

            <button onClick={() => dispatch(fetchLowStock({ threshold }))} disabled={loading.lowStock}
              className="p-2.5 rounded-xl bg-base-100 border border-base-300 hover:border-error hover:text-error transition-all">
              <RefreshCw size={16} className={loading.lowStock ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Urgent banner */}
      {outOfStock > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="alert alert-error mb-5 rounded-xl">
          <Zap size={16} className="text-error flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">{outOfStock} medicine{outOfStock !== 1 ? 's' : ''} completely out of stock!</p>
            <p className="text-xs opacity-80 mt-0.5">These items cannot be dispensed. Request restock immediately.</p>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Out of Stock', value: outOfStock, color: 'error' },
          { label: 'Critical (1–2)', value: critical, color: 'error' },
          { label: `Low (3–${threshold})`, value: low, color: 'warning' },
        ].map((s, i) => (
          <motion.div key={i} variants={fadeUp} initial="hidden" animate="visible" custom={i + 2} className="stat-card">
            <div className="stat-card-value" style={{ color: `var(--${s.color})` }}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Mini chart */}
      {chartData.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="card p-5 mb-6">
          <h3 className="font-bold text-base-content text-sm mb-4 flex items-center gap-2">
            <BarChart3 size={15} className="text-error" /> Stock Levels
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: '10px', fontSize: 11 }}
                cursor={{ fill: 'var(--base-300)', opacity: 0.4 }}
              />
              <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                {chartData.map((e, i) => (
                  <Cell key={i} fill={e.qty === 0 ? 'var(--error)' : e.qty <= 2 ? 'var(--error)' : 'var(--warning)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Search */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6} className="card p-4 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name or category..."
            className="input-field w-full pl-10 text-sm py-2.5" />
        </div>
      </motion.div>

      {/* List */}
      {loading.lowStock ? (
        <div className="flex items-center justify-center py-20 gap-3 text-error">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm">Scanning inventory...</span>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card p-14 text-center">
          <Package size={48} className="text-success mx-auto mb-3" />
          <h3 className="font-black text-base-content text-lg">All Stocked Up!</h3>
          <p className="text-sm text-base-content/50 mt-1">No medicines below the threshold of {threshold} units.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => (
            <StockCard key={`${item.medicineId}-${item.batchNumber}-${i}`} item={item} i={i} onRequestRestock={setRestockModal} />
          ))}
        </div>
      )}

      {/* Restock modal */}
      <AnimatePresence>
        {restockModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setRestockModal(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="card p-6 w-full max-w-md" data-theme="pharmacy">
              <h3 className="font-black text-base-content text-lg mb-1">Request Restock</h3>
              <p className="text-sm text-base-content/55 mb-5">{restockModal.brandName || restockModal.name}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Quantity Needed</label>
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Urgency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['Low', 'Medium', 'High', 'Critical'].map(u => (
                      <button key={u} onClick={() => setUrgency(u)} type="button"
                        className={`py-2 rounded-xl text-xs font-bold border transition-all
                          ${urgency === u
                            ? u === 'Critical' || u === 'High' ? 'bg-error text-error-content border-error'
                              : u === 'Medium' ? 'bg-warning text-warning-content border-warning'
                              : 'bg-success text-success-content border-success'
                            : 'bg-base-200 border-base-300 text-base-content/55'}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setRestockModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
                  <button onClick={handleRequestRestock} className="btn-primary-cta flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                    <ShoppingCart size={14} /> Submit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}