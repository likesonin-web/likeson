'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package, AlertTriangle, CheckCircle2, Loader2, Pill,
  Calendar, Hash, DollarSign, TrendingUp, TrendingDown,
  ArrowLeft, RefreshCw, Clock, ShieldCheck, Info, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchMedicineStock } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

function StatCard({ label, value, icon: Icon, color = 'primary', sub }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="stat-card">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl bg-${color}/15 flex items-center justify-center`}>
          <Icon size={18} className={`text-${color}`} />
        </div>
      </div>
      <div className="stat-card-value" style={{ color: `var(--${color})` }}>{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
    </motion.div>
  );
}

function ExpiryBadge({ date }) {
  if (!date) return <span className="badge badge-info">N/A</span>;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d - now) / 86400000);
  if (days < 0) return <span className="badge badge-error">Expired</span>;
  if (days <= 30) return <span className="badge badge-warning">{days}d left</span>;
  if (days <= 90) return <span className="badge badge-info">{days}d left</span>;
  return <span className="badge badge-success">{d.toLocaleDateString('en-IN')}</span>;
}

export default function StockDetailsPage() {
  const { medicineId } = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const { medicineStockDetail, loading, errors } = useSelector(s => s.pharmacyStore);

  useEffect(() => {
    if (medicineId) dispatch(fetchMedicineStock(medicineId));
  }, [medicineId, dispatch]);

  const med = medicineStockDetail;
  const batches = med?.storeInventory || [];
  const totalStock = med?.totalStock || 0;
  const isLow = med?.isLowStock;

  // Chart data
  const chartData = batches.map((b, i) => ({
    name: b.batchNumber?.slice(-6) || `B${i + 1}`,
    stock: b.stockQuantity,
    expiry: new Date(b.expiryDate),
  }));

  const expiringSoon = batches.filter(b => {
    const days = Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;

  const expired = batches.filter(b => new Date(b.expiryDate) < new Date()).length;

  if (loading.medicineStock) {
    return (
      <div data-theme="pharmacy" className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-base-content/55">Loading stock details...</p>
        </div>
      </div>
    );
  }

  if (errors.medicineStock || !med) {
    return (
      <div data-theme="pharmacy" className="min-h-screen bg-base-200 flex items-center justify-center p-8">
        <div className="card p-8 text-center max-w-sm">
          <AlertTriangle size={40} className="text-error mx-auto mb-3" />
          <h3 className="font-black text-base-content text-lg">Not Found</h3>
          <p className="text-sm text-base-content/55 mt-1">{errors.medicineStock?.message || 'Medicine stock not found'}</p>
          <button onClick={() => router.back()} className="btn-secondary mt-4 text-sm px-4 py-2">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2 rounded-xl bg-base-100 border border-base-300 text-base-content/60 hover:text-primary hover:border-primary transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight font-montserrat text-base-content">
              Stock Details
            </h1>
            <p className="text-sm text-base-content/55 mt-0.5">Per-batch inventory breakdown</p>
          </div>
          <button onClick={() => dispatch(fetchMedicineStock(medicineId))}
            className="p-2 rounded-xl bg-base-100 border border-base-300 text-base-content/60 hover:text-primary hover:border-primary transition-all">
            <RefreshCw size={17} />
          </button>
        </div>
      </motion.div>

      {/* Medicine Info */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="glass-card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
            <Pill size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="font-black text-xl text-base-content">{med.brandName}</h2>
              {isLow && (
                <span className="badge badge-warning flex items-center gap-1">
                  <AlertTriangle size={10} /> Low Stock
                </span>
              )}
              {!isLow && totalStock > 0 && <span className="badge badge-success flex items-center gap-1"><CheckCircle2 size={10} /> In Stock</span>}
              {totalStock === 0 && <span className="badge badge-error">Out of Stock</span>}
            </div>
            <p className="text-sm text-base-content/55">{med.name}</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="text-xs bg-base-200 text-base-content/60 px-3 py-1 rounded-full border border-base-300">MRP ₹{med.mrp}</span>
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
              {expiringSoon > 0 && <span className="text-xs bg-warning/10 text-warning px-3 py-1 rounded-full border border-warning/20">{expiringSoon} expiring soon</span>}
              {expired > 0 && <span className="text-xs bg-error/10 text-error px-3 py-1 rounded-full border border-error/20">{expired} expired</span>}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Units" value={totalStock} icon={Package} color="primary" />
        <StatCard label="Batches" value={batches.length} icon={Hash} color="secondary" />
        <StatCard label="Expiring Soon" value={expiringSoon} icon={Clock} color="warning" sub="Within 30 days" />
        <StatCard label="Expired" value={expired} icon={AlertTriangle} color="error" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="card p-5 mb-6">
          <h3 className="font-bold text-base-content mb-4 flex items-center gap-2 text-sm">
            <BarChart3 size={16} className="text-primary" /> Stock by Batch
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 12 }}
                cursor={{ fill: 'var(--primary)', opacity: 0.05 }}
              />
              <Bar dataKey="stock" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => {
                  const days = Math.ceil((entry.expiry - new Date()) / 86400000);
                  const color = days < 0 ? 'var(--error)' : days <= 30 ? 'var(--warning)' : 'var(--primary)';
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Batch Table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="card overflow-hidden">
        <div className="p-5 border-b border-base-300">
          <h3 className="font-bold text-base-content flex items-center gap-2 text-sm">
            <Package size={15} className="text-primary" /> Batch Details
          </h3>
        </div>

        {batches.length === 0 ? (
          <div className="p-12 text-center text-base-content/40">
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No inventory batches for this store</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-base-200 text-xs uppercase tracking-wider text-base-content/50">
                  <th className="text-left px-5 py-3 font-bold">Batch #</th>
                  <th className="text-right px-5 py-3 font-bold">Qty</th>
                  <th className="text-left px-5 py-3 font-bold">Expiry</th>
                  <th className="text-right px-5 py-3 font-bold">Price/Unit</th>
                  <th className="text-left px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b, i) => {
                  const days = b.expiryDate ? Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000) : null;
                  const isExpired = days !== null && days < 0;
                  return (
                    <motion.tr key={i}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`border-b border-base-200 last:border-0 hover:bg-base-200/50 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4">
                        <span className="font-mono font-semibold text-base-content/80 text-xs">{b.batchNumber || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`font-black text-base ${b.stockQuantity <= 5 ? 'text-warning' : 'text-base-content'}`}>
                          {b.stockQuantity}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <ExpiryBadge date={b.expiryDate} />
                      </td>
                      <td className="px-5 py-4 text-right text-base-content/70">
                        {b.pricePerUnit ? `₹${b.pricePerUnit}` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {isExpired
                          ? <span className="flex items-center gap-1 text-error text-xs font-semibold"><AlertTriangle size={11} /> Expired</span>
                          : b.isLowStock
                          ? <span className="flex items-center gap-1 text-warning text-xs font-semibold"><AlertTriangle size={11} /> Low</span>
                          : <span className="flex items-center gap-1 text-success text-xs font-semibold"><CheckCircle2 size={11} /> Good</span>}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}