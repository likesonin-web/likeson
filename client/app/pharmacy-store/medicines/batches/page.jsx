'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Layers, Search, ChevronLeft, ChevronRight, Loader2,
  AlertTriangle, CheckCircle2, Calendar, Hash, DollarSign,
  Package, RefreshCw, Filter, Clock, ArrowUpDown
} from 'lucide-react';
import { fetchInventoryBatches } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

function ExpiryStatus({ date }) {
  if (!date) return <span className="badge badge-info text-[10px]">N/A</span>;
  const days = Math.ceil((new Date(date) - new Date()) / 86400000);
  if (days < 0) return <div className="flex items-center gap-1"><span className="status-dot status-dot-error" /><span className="text-error text-xs font-bold">Expired</span></div>;
  if (days <= 7) return <div className="flex items-center gap-1"><span className="status-dot status-dot-error" /><span className="text-error text-xs font-bold">{days}d</span></div>;
  if (days <= 30) return <div className="flex items-center gap-1"><span className="status-dot status-dot-warning" /><span className="text-warning text-xs font-semibold">{days}d</span></div>;
  if (days <= 90) return <div className="flex items-center gap-1"><span className="status-dot status-dot-info" /><span className="text-info text-xs">{new Date(date).toLocaleDateString('en-IN')}</span></div>;
  return <div className="flex items-center gap-1"><span className="status-dot status-dot-success" /><span className="text-success text-xs">{new Date(date).toLocaleDateString('en-IN')}</span></div>;
}

function StockBar({ qty, max = 100 }) {
  const pct = Math.min(100, (qty / max) * 100);
  const color = qty <= 0 ? 'var(--error)' : qty <= 5 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-black w-8 text-right" style={{ color }}>{qty}</span>
      <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AllBatchesPage() {
  const dispatch = useDispatch();
  const { inventoryBatches, batchesPagination, loading, errors } = useSelector(s => s.pharmacyStore);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | expiring | low | expired
  const [sort, setSort] = useState('expiry'); // expiry | name | qty

  useEffect(() => {
    dispatch(fetchInventoryBatches({ page, limit }));
  }, [page, limit, dispatch]);

  const maxQty = Math.max(...(inventoryBatches.map(b => b.stockQuantity || 0)), 1);

  // Client-side filter + search
  const filtered = inventoryBatches.filter(b => {
    const days = b.expiryDate ? Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000) : null;
    const matchSearch = !search ||
      (b.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.brandName || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.batchNumber || '').toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (filter === 'expiring') return days !== null && days >= 0 && days <= 30;
    if (filter === 'low') return b.stockQuantity <= 5;
    if (filter === 'expired') return days !== null && days < 0;
    return true;
  }).sort((a, b) => {
    if (sort === 'expiry') return new Date(a.expiryDate) - new Date(b.expiryDate);
    if (sort === 'qty') return a.stockQuantity - b.stockQuantity;
    if (sort === 'name') return (a.brandName || a.name || '').localeCompare(b.brandName || b.name || '');
    return 0;
  });

  const { currentPage, totalPages, totalItems } = batchesPagination;

  const countByStatus = {
    expiring: inventoryBatches.filter(b => { const d = b.expiryDate ? Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000) : null; return d !== null && d >= 0 && d <= 30; }).length,
    low: inventoryBatches.filter(b => b.stockQuantity <= 5).length,
    expired: inventoryBatches.filter(b => b.expiryDate && new Date(b.expiryDate) < new Date()).length,
  };

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight font-montserrat flex items-center gap-2">
              <Layers size={26} className="text-primary" />
              <span className="text-gradient-primary">All Batches</span>
            </h1>
            <p className="text-sm text-base-content/55 mt-1">
              {totalItems} batches across your store inventory
            </p>
          </div>
          <button onClick={() => dispatch(fetchInventoryBatches({ page, limit }))}
            disabled={loading.inventoryBatches}
            className="btn-secondary px-4 py-2 text-xs flex items-center gap-2">
            <RefreshCw size={14} className={loading.inventoryBatches ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Summary chips */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="flex flex-wrap gap-3 mb-6">
        {[
          { key: 'all', label: 'All Batches', count: totalItems, color: 'primary' },
          { key: 'expiring', label: 'Expiring Soon', count: countByStatus.expiring, color: 'warning' },
          { key: 'low', label: 'Low Stock', count: countByStatus.low, color: 'error' },
          { key: 'expired', label: 'Expired', count: countByStatus.expired, color: 'error' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all
              ${filter === f.key ? `bg-${f.color} text-${f.color}-content border-${f.color} shadow-md` : 'bg-base-100 border-base-300 text-base-content/60 hover:border-primary'}`}>
            {f.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === f.key ? 'bg-white/20' : 'bg-base-300'}`}>{f.count}</span>
          </button>
        ))}
      </motion.div>

      {/* Controls */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by medicine or batch..."
            className="input-field w-full pl-10 py-2.5 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-base-content/40" />
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="input-field py-2.5 text-sm pr-8">
            <option value="expiry">Sort: Expiry Date</option>
            <option value="qty">Sort: Quantity</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="card overflow-hidden">
        {loading.inventoryBatches ? (
          <div className="flex items-center justify-center py-20 gap-3 text-primary">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-sm">Loading batches...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-base-content/40">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No batches found</p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="mt-3 text-primary text-xs underline">Clear filter</button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-base-200 text-xs uppercase tracking-wider text-base-content/50 border-b border-base-300">
                    <th className="text-left px-5 py-3.5 font-bold">Medicine</th>
                    <th className="text-left px-5 py-3.5 font-bold">Batch #</th>
                    <th className="text-right px-5 py-3.5 font-bold">Stock</th>
                    <th className="text-left px-5 py-3.5 font-bold">Expiry</th>
                    <th className="text-right px-5 py-3.5 font-bold">Price/Unit</th>
                    <th className="text-left px-5 py-3.5 font-bold">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => {
                    const days = b.expiryDate ? Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000) : null;
                    const isExpired = days !== null && days < 0;
                    return (
                      <motion.tr key={i}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                        className={`border-b border-base-200 last:border-0 hover:bg-base-200/40 transition-colors
                          ${isExpired ? 'opacity-55 bg-error/5' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-base-content">{b.brandName || b.name}</div>
                          <div className="text-xs text-base-content/45 mt-0.5">{b.category}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs bg-base-200 border border-base-300 px-2 py-1 rounded-lg text-base-content/70">
                            {b.batchNumber || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <StockBar qty={b.stockQuantity} max={maxQty} />
                        </td>
                        <td className="px-5 py-4">
                          <ExpiryStatus date={b.expiryDate} />
                        </td>
                        <td className="px-5 py-4 text-right text-base-content/65 font-medium">
                          {b.pricePerUnit ? `₹${b.pricePerUnit}` : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className="badge badge-primary text-[10px]">{b.category || '—'}</span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-base-200">
              {filtered.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-base-content text-sm">{b.brandName || b.name}</p>
                      <p className="text-xs text-base-content/45">{b.category}</p>
                    </div>
                    <ExpiryStatus date={b.expiryDate} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">{b.batchNumber || '—'}</span>
                    <StockBar qty={b.stockQuantity} max={maxQty} />
                  </div>
                  {b.pricePerUnit && <p className="text-xs text-base-content/45 mt-1.5">₹{b.pricePerUnit}/unit</p>}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="flex items-center justify-between mt-5 px-1">
          <p className="text-xs text-base-content/50">
            Page {currentPage} of {totalPages} · {totalItems} total
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="p-2 rounded-xl bg-base-100 border border-base-300 hover:border-primary hover:text-primary disabled:opacity-40 transition-all">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all border
                    ${page === p ? 'bg-primary text-primary-content border-primary' : 'bg-base-100 border-base-300 hover:border-primary text-base-content/60'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="p-2 rounded-xl bg-base-100 border border-base-300 hover:border-primary hover:text-primary disabled:opacity-40 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}