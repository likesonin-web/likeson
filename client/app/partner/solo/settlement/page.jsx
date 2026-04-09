'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle,
  ArrowDownRight, ArrowUpRight, CalendarDays, IndianRupee,
  BarChart3, RefreshCw, Filter, ChevronDown
} from 'lucide-react';
import {
  fetchSettlementSummary,
  selectSettlementSummary,
  selectLoading,
} from '@/store/slices/soloDriverSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

// Mock chart data (replace with real API data)
const mockChartData = [
  { month: 'Oct', earnings: 12400, settled: 11000, fee: 1400 },
  { month: 'Nov', earnings: 15800, settled: 14200, fee: 1600 },
  { month: 'Dec', earnings: 18200, settled: 16500, fee: 1700 },
  { month: 'Jan', earnings: 14100, settled: 12800, fee: 1300 },
  { month: 'Feb', earnings: 20500, settled: 18800, fee: 1700 },
  { month: 'Mar', earnings: 17300, settled: 15900, fee: 1400 },
];

// Mock transactions (replace with real API)
const mockTransactions = [
  { id: 1, type: 'credit', amount: 4850, date: '2026-03-20', method: 'Bank Transfer', ref: 'SET20260320A1', status: 'completed', rides: 12 },
  { id: 2, type: 'credit', amount: 3200, date: '2026-03-13', method: 'Bank Transfer', ref: 'SET20260313B2', status: 'completed', rides: 8 },
  { id: 3, type: 'credit', amount: 5100, date: '2026-03-06', method: 'UPI', ref: 'SET20260306C3', status: 'completed', rides: 14 },
  { id: 4, type: 'credit', amount: 2800, date: '2026-02-27', method: 'Bank Transfer', ref: 'SET20260227D4', status: 'processing', rides: 7 },
  { id: 5, type: 'debit', amount: 450, date: '2026-02-20', method: 'Platform Fee', ref: 'FEE20260220E5', status: 'completed', rides: 0 },
  { id: 6, type: 'credit', amount: 6200, date: '2026-02-13', method: 'Bank Transfer', ref: 'SET20260213F6', status: 'completed', rides: 18 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-xl p-3 shadow-xl border text-xs"
        style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)', fontFamily: 'var(--font-sans)' }}>
        <p className="font-bold mb-2" style={{ color: 'var(--base-content)' }}>{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span style={{ color: p.color }}>● {p.name}</span>
            <span className="font-semibold" style={{ color: 'var(--base-content)' }}>₹{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, sub, icon: Icon, color, change, custom }) {
  return (
    <motion.div variants={fadeUp} custom={custom} initial="hidden" animate="show"
      className="card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold ${change >= 0 ? 'text-success' : 'text-error'}`}>
            {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{label}</p>
        <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
          {value}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

function TxnRow({ txn, i }) {
  const statusConfig = {
    completed: { color: 'var(--success)', bg: 'color-mix(in srgb, var(--success), transparent 88%)', label: 'Paid', Icon: CheckCircle2 },
    processing: { color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning), transparent 88%)', label: 'Processing', Icon: Clock },
    failed: { color: 'var(--error)', bg: 'color-mix(in srgb, var(--error), transparent 88%)', label: 'Failed', Icon: XCircle },
  };
  const s = statusConfig[txn.status] || statusConfig.processing;

  return (
    <motion.div
      variants={fadeUp} custom={i * 0.05} initial="hidden" animate="show"
      className="flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-base-200 cursor-pointer"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: txn.type === 'credit'
            ? 'color-mix(in srgb, var(--success), transparent 88%)'
            : 'color-mix(in srgb, var(--error), transparent 88%)',
        }}>
        {txn.type === 'credit'
          ? <ArrowDownRight size={16} style={{ color: 'var(--success)' }} />
          : <ArrowUpRight size={16} style={{ color: 'var(--error)' }} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--base-content)' }}>
            {txn.method}
          </p>
          {txn.rides > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--base-300)', color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
              {txn.rides} rides
            </span>
          )}
        </div>
        <p className="text-xs font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
          {txn.ref}
        </p>
      </div>

      {/* Date */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-success' : 'text-error'}`}>
          {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
          {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
          style={{ background: s.bg, color: s.color }}>
          <s.Icon size={10} /> {s.label}
        </span>
      </div>
    </motion.div>
  );
}

export default function SettlementHistory() {
  const dispatch = useDispatch();
  const settlement = useSelector(selectSettlementSummary);
  const loading = useSelector(selectLoading('settlement'));
  const [filter, setFilter] = useState('all');

  useEffect(() => { dispatch(fetchSettlementSummary()); }, [dispatch]);

  const summary = settlement?.summary;
  const pending = summary?.pendingAmount || 0;
  const totalSettled = summary?.totalSettled || 0;
  const totalEarnings = summary?.totalEarnings || 0;
  const platformFee = summary?.commissionPaid || 0;

  const filtered = filter === 'all' ? mockTransactions
    : filter === 'credit' ? mockTransactions.filter(t => t.type === 'credit')
    : mockTransactions.filter(t => t.type === 'debit');

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--success), transparent 85%)' }}>
              <BarChart3 size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Settlement History
              </h1>
              <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Earnings & payout records
              </p>
            </div>
          </div>
          <button onClick={() => dispatch(fetchSettlementSummary())}
            className="p-2.5 rounded-xl transition-all hover:bg-base-200"
            style={{ border: '1px solid var(--base-300)' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--base-content)' }} />
          </button>
        </motion.div>

        {/* Pending Payout Banner */}
        {pending > 0 && (
          <motion.div variants={fadeUp} custom={0.5} initial="hidden" animate="show"
            className="rounded-2xl p-5 mb-6 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, var(--success) 0%, var(--secondary) 100%)',
              boxShadow: '0 12px 40px color-mix(in srgb, var(--success), transparent 65%)',
            }}>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Pending Payout</p>
              <p className="text-white text-3xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
                ₹{pending.toLocaleString()}
              </p>
              <p className="text-white/70 text-xs mt-1">Expected by {summary?.lastSettledAt
                ? new Date(summary.lastSettledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : 'next cycle'}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Clock size={26} className="text-white" />
            </div>
          </motion.div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Earnings" value={`₹${(totalEarnings / 1000).toFixed(1)}k`}
            sub="All time" icon={IndianRupee} color="var(--primary)" change={12} custom={1} />
          <StatCard label="Total Settled" value={`₹${(totalSettled / 1000).toFixed(1)}k`}
            sub="All time" icon={CheckCircle2} color="var(--success)" change={8} custom={1.5} />
          <StatCard label="Platform Fee" value={`₹${(platformFee / 1000).toFixed(1)}k`}
            sub="Deducted" icon={TrendingDown} color="var(--warning)" custom={2} />
          <StatCard label="Settlement Cycle" value={summary?.settlementCycle || 'Weekly'}
            sub={summary?.preferredMethod || 'Bank Transfer'} icon={CalendarDays} color="var(--info)" custom={2.5} />
        </div>

        {/* Area Chart */}
        <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" className="card p-5 mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Earnings Overview
              </h2>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                Last 6 months
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-semibold"
                style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} /> Earnings
              </span>
              <span className="flex items-center gap-1.5 font-semibold"
                style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} /> Settled
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="settledGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="earnings" name="Earnings" stroke="var(--primary)"
                strokeWidth={2} fill="url(#earningsGrad)" dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="settled" name="Settled" stroke="var(--success)"
                strokeWidth={2} fill="url(#settledGrad)" dot={{ fill: 'var(--success)', r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Transactions */}
        <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show" className="card overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--base-300)' }}>
            <h2 className="font-black text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
              Transactions
            </h2>
            <div className="flex gap-2">
              {['all', 'credit', 'debit'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all capitalize"
                  style={{
                    background: filter === f ? 'var(--primary)' : 'var(--base-200)',
                    color: filter === f ? 'var(--primary-content)' : 'color-mix(in oklch, var(--base-content) 60%, transparent)',
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3">
            {filtered.map((txn, i) => <TxnRow key={txn.id} txn={txn} i={i} />)}
          </div>
        </motion.div>
      </div>
    </div>
  );
}