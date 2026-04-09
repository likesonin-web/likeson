'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Area
} from 'recharts';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Filter, Search,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  IndianRupee, RefreshCw, Download, Activity, CreditCard,
  Gift, RotateCcw, Receipt, User, X, ArrowUpRight, ReceiptText, Loader2
} from 'lucide-react';
import {
  fetchFinancialLedger, selectFinancialLedger
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────
const TX_TYPES    = ['Credit', 'Debit'];
const TX_PURPOSES = ['Add_Money','Booking_Payment','Medicine_Purchase','Refund','Referral_Bonus','Subscription_Fee'];
const TX_STATUSES = ['Success', 'Pending', 'Failed'];

const PURPOSE_META = {
  Add_Money:         { icon: Wallet,       color: 'var(--success)', label: 'Add Money' },
  Booking_Payment:   { icon: CreditCard,   color: 'var(--primary)', label: 'Booking' },
  Medicine_Purchase: { icon: Receipt,      color: 'var(--chart-4)', label: 'Medicine' },
  Refund:            { icon: RotateCcw,    color: 'var(--chart-5)', label: 'Refund' },
  Referral_Bonus:    { icon: Gift,         color: 'var(--chart-3)', label: 'Referral' },
  Subscription_Fee:  { icon: Activity,     color: 'var(--chart-6)', label: 'Subscription' },
};

const STATUS_CLS = { Success:'badge-success', Pending:'badge-warning', Failed:'badge-error' };
const CHART_COLORS = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)','var(--chart-6)'];

const fadeUp  = { hidden:{ opacity:0, y:18 }, show:{ opacity:1, y:0 } };
const stagger = { show:{ transition:{ staggerChildren:0.06 } } };

// ─── Receipt Download ─────────────────────────────────────────────────────────
const downloadReceipt = (item) => {
  const tx = item.transaction ?? {};
  const user = item.user ?? {};
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Receipt – ${tx.transactionId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',sans-serif;color:#1a1a2e;padding:40px;background:#fff;max-width:480px;margin:0 auto;}
    .hdr{text-align:center;padding-bottom:28px;border-bottom:2px dashed #e5e7eb;margin-bottom:28px;}
    .brand{font-size:22px;font-weight:900;color:#2563eb;margin-bottom:4px;}.brand span{color:#0ea5e9;}
    .hdr p{font-size:12px;color:#9ca3af;}
    .amount{text-align:center;margin:24px 0;}
    .amount .val{font-size:42px;font-weight:900;color:${tx.type==='Credit'?'#16a34a':'#dc2626'};}
    .amount .type{font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;}
    .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:14px;}
    .row span{color:#6b7280;}
    .row strong{color:#1a1a2e;font-weight:700;}
    .divider{border-top:1px solid #e5e7eb;margin:18px 0;}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;}
    .success{background:#dcfce7;color:#166534;}.pending{background:#fef9c3;color:#713f12;}.failed{background:#fee2e2;color:#991b1b;}
    .foot{text-align:center;margin-top:28px;font-size:11px;color:#9ca3af;padding-top:18px;border-top:1px dashed #e5e7eb;}
  </style></head><body>
  <div class="hdr">
    <div class="brand">Likeson<span>Health</span></div>
    <p>Wallet Transaction Receipt</p>
    <p style="margin-top:6px;font-size:11px;">${new Date(tx.timestamp).toLocaleString('en-IN',{dateStyle:'long',timeStyle:'short'})}</p>
  </div>
  <div class="amount">
    <div class="type">${tx.type === 'Credit' ? '▲ Money In' : '▼ Money Out'}</div>
    <div class="val">${tx.type === 'Credit' ? '+' : '-'}₹${tx.amount?.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
  </div>
  <div class="divider"/>
  <div class="row"><span>Transaction ID</span><strong style="font-size:11px;font-family:monospace">${tx.transactionId}</strong></div>
  <div class="row"><span>Purpose</span><strong>${(tx.purpose ?? '').replace(/_/g,' ')}</strong></div>
  <div class="row"><span>Account</span><strong>${user.name ?? '—'} (${user.email ?? '—'})</strong></div>
  <div class="row"><span>Role</span><strong style="text-transform:capitalize">${user.role ?? '—'}</strong></div>
  <div class="row"><span>Balance Before</span><strong>₹${tx.balanceBefore?.toLocaleString('en-IN',{minimumFractionDigits:2}) ?? '—'}</strong></div>
  <div class="row"><span>Balance After</span><strong>₹${tx.balanceAfter?.toLocaleString('en-IN',{minimumFractionDigits:2}) ?? '—'}</strong></div>
  <div class="row"><span>Status</span><strong><span class="badge ${(tx.status??'').toLowerCase()}">${tx.status}</span></strong></div>
  ${tx.description ? `<div class="row"><span>Note</span><strong>${tx.description}</strong></div>` : ''}
  <div class="foot"><p>This is a system-generated receipt · LikesonHealth Platform</p><p>support@likesonhealth.com</p></div>
  </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
const CustomTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs shadow-xl">
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}}>
          {p.name}: <strong>₹{Number(p.value).toLocaleString('en-IN')}</strong>
        </p>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

const StatCard = memo(({ title, value, sub, icon: Icon, colorVar, trend }) => (
  <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
    <div className="flex items-start justify-between">
      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">{title}</p>
      <div className="p-2.5 rounded-xl" style={{background:`color-mix(in srgb, ${colorVar} 15%, transparent)`}}>
        <Icon size={17} style={{color:colorVar}}/>
      </div>
    </div>
    <p className="text-2xl font-black text-base-content">{value}</p>
    {sub && <p className="text-xs text-base-content/40">{sub}</p>}
    {trend != null && (
      <div className={`flex items-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-success' : 'text-error'}`}>
        {trend >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
        {Math.abs(trend)}% vs last period
      </div>
    )}
  </motion.div>
));
StatCard.displayName = 'StatCard';

const TxRow = memo(({ item, index }) => {
  const tx   = item.transaction ?? {};
  const user = item.user ?? {};
  const meta = PURPOSE_META[tx.purpose] ?? { icon: Wallet, color: 'var(--primary)', label: tx.purpose };
  const Icon = meta.icon;
  const isCredit = tx.type === 'Credit';

  return (
    <motion.tr
      initial={{opacity:0, x:-8}} animate={{opacity:1, x:0}} transition={{delay:index*0.025}}
      className="border-b border-base-300/40 hover:bg-base-200/40 transition-colors group">
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background:`color-mix(in srgb, ${meta.color} 15%, transparent)`}}>
            <Icon size={15} style={{color: meta.color}}/>
          </div>
          <div>
            <p className="font-semibold text-xs text-base-content">{meta.label}</p>
            <p className="text-xs text-base-content/40 font-mono">{tx.transactionId}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <User size={12} className="text-primary"/>
          </div>
          <div>
            <p className="font-semibold text-xs text-base-content">{user.name ?? '—'}</p>
            <p className="text-xs text-base-content/40 capitalize">{user.role ?? ''}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className={`flex items-center gap-1.5 font-black text-sm ${isCredit ? 'text-success' : 'text-error'}`}>
          {isCredit ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
          {isCredit ? '+' : '-'}₹{tx.amount?.toLocaleString('en-IN')}
        </div>
      </td>
      <td className="py-3.5 px-4 text-xs text-base-content/50">
        ₹{tx.balanceBefore?.toLocaleString('en-IN') ?? '—'}
        <span className="mx-1 text-base-content/20">→</span>
        ₹{tx.balanceAfter?.toLocaleString('en-IN') ?? '—'}
      </td>
      <td className="py-3.5 px-4">
        <span className={`badge ${STATUS_CLS[tx.status] ?? 'badge-info'}`}>{tx.status}</span>
      </td>
      <td className="py-3.5 px-4 text-xs text-base-content/40">
        {new Date(tx.timestamp).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
      </td>
      <td className="py-3.5 px-4">
        <button
          onClick={() => downloadReceipt(item)}
          className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary transition-colors opacity-0 group-hover:opacity-100"
          title="Download Receipt">
          <ReceiptText size={14}/>
        </button>
      </td>
    </motion.tr>
  );
});
TxRow.displayName = 'TxRow';

const SkeletonRow = () => (
  <tr className="border-b border-base-300">
    {Array(7).fill(0).map((_,i) => <td key={i} className="py-4 px-4"><div className="skeleton h-4 rounded w-full"/></td>)}
  </tr>
);

const EmptyState = () => (
  <tr><td colSpan={7}>
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-base-content/30">
      <Wallet size={64} strokeWidth={0.8}/>
      <p className="text-lg font-bold">No transactions found</p>
      <p className="text-sm">Adjust filters to see transactions</p>
    </div>
  </td></tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const dispatch = useDispatch();
  const { data, pagination, loading, error } = useSelector(selectFinancialLedger);

  const [filters, setFilters] = useState({ page:1, limit:20, type:'', purpose:'', status:'' });
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== ''));
    dispatch(fetchFinancialLedger(clean));
  }, [dispatch, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilter = useCallback((key, val) => {
    setFilters(p => ({...p, [key]: val, ...(key !== 'page' ? {page:1} : {})}));
  }, []);

  // ── Derived Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalCredits = 0, totalDebits = 0, successCount = 0;
    data.forEach(item => {
      const tx = item.transaction ?? {};
      if (tx.type === 'Credit') totalCredits += tx.amount ?? 0;
      else totalDebits += tx.amount ?? 0;
      if (tx.status === 'Success') successCount++;
    });
    return { totalCredits, totalDebits, net: totalCredits - totalDebits, successCount };
  }, [data]);

  // ── Chart: Volume by purpose ───────────────────────────────────────────────
  const purposeChartData = useMemo(() => {
    const m = {};
    data.forEach(item => {
      const tx = item.transaction ?? {};
      const label = PURPOSE_META[tx.purpose]?.label ?? tx.purpose;
      if (!m[label]) m[label] = { name: label, credit:0, debit:0 };
      if (tx.type === 'Credit') m[label].credit += tx.amount ?? 0;
      else m[label].debit += tx.amount ?? 0;
    });
    return Object.values(m);
  }, [data]);

  // ── Chart: Timeline ────────────────────────────────────────────────────────
  const timelineData = useMemo(() => {
    const m = {};
    [...data].sort((a,b) => new Date(a.transaction?.timestamp)-new Date(b.transaction?.timestamp))
      .forEach(item => {
        const tx = item.transaction ?? {};
        const d = new Date(tx.timestamp).toLocaleDateString('en-IN',{month:'short',day:'numeric'});
        if (!m[d]) m[d] = { date:d, credit:0, debit:0 };
        if (tx.type === 'Credit') m[d].credit += tx.amount ?? 0;
        else m[d].debit += tx.amount ?? 0;
      });
    return Object.values(m).slice(-14);
  }, [data]);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const rows = ['Tx ID,User,Type,Amount,Purpose,Status,Date',
      ...data.map(item => {
        const tx = item.transaction ?? {};
        const u  = item.user ?? {};
        return `"${tx.transactionId}","${u.name??''}","${tx.type}",${tx.amount??0},"${tx.purpose??''}","${tx.status??''}","${new Date(tx.timestamp).toLocaleDateString('en-IN')}"`;
      })
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows],{type:'text/csv'}));
    a.download = `transactions-${Date.now()}.csv`;
    a.click();
  }, [data]);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-responsive-xl font-black text-base-content flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-secondary/10"><Wallet size={26} className="text-secondary"/></div>
            Financial Ledger
          </h1>
          <p className="text-base-content/40 text-sm mt-1 ml-1">Consolidated wallet transaction history</p>
        </motion.div>
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2 !py-2 !px-4">
            <RefreshCw size={14}/> Refresh
          </button>
          <button onClick={exportCSV} className="btn-primary-cta flex items-center gap-2 !py-2 !px-4">
            <Download size={14}/> Export CSV
          </button>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Credits"   value={`₹${stats.totalCredits.toLocaleString('en-IN',{maximumFractionDigits:0})}`} icon={ArrowUpCircle}   colorVar="var(--success)" trend={5.2}/>
        <StatCard title="Total Debits"    value={`₹${stats.totalDebits.toLocaleString('en-IN',{maximumFractionDigits:0})}`}  icon={ArrowDownCircle} colorVar="var(--error)"   trend={-2.1}/>
        <StatCard title="Net Flow"        value={`₹${stats.net.toLocaleString('en-IN',{maximumFractionDigits:0})}`}          icon={Activity}        colorVar={stats.net>=0?'var(--success)':'var(--error)'} sub="Credits minus Debits"/>
        <StatCard title="Success Rate"    value={data.length ? `${((stats.successCount/data.length)*100).toFixed(1)}%` : '—'} icon={TrendingUp}     colorVar="var(--primary)" sub={`${stats.successCount} of ${data.length}`}/>
      </motion.div>

      {/* Charts */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.18}}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={16} className="text-primary"/>
            <h3 className="font-bold text-base-content text-sm">Credit vs Debit Timeline</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={timelineData} margin={{top:4,right:4,bottom:0,left:4}}>
              <defs>
                <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="dG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--error)" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="var(--error)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="credit" fill="url(#cG)" stroke="var(--success)" strokeWidth={2} name="Credits ₹"/>
              <Area type="monotone" dataKey="debit"  fill="url(#dG)" stroke="var(--error)"   strokeWidth={2} name="Debits ₹"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* By Purpose */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <CreditCard size={16} className="text-secondary"/>
            <h3 className="font-bold text-base-content text-sm">Volume by Purpose</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={purposeChartData} margin={{top:4,right:4,bottom:0,left:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
              <XAxis dataKey="name" tick={{fontSize:9,fill:'var(--base-content)',opacity:0.4}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:'var(--base-content)',opacity:0.4}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="credit" fill="var(--success)" name="Credits ₹" radius={[4,4,0,0]}/>
              <Bar dataKey="debit"  fill="var(--error)"   name="Debits ₹"  radius={[4,4,0,0]}/>
              <Legend wrapperStyle={{fontSize:10}} iconType="circle"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.25}}>
        <div className="glass-card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="input-field flex-1" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
              <option value="">All Types</option>
              {TX_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="input-field flex-1" value={filters.purpose} onChange={e => setFilter('purpose', e.target.value)}>
              <option value="">All Purposes</option>
              {TX_PURPOSES.map(p => <option key={p} value={p}>{PURPOSE_META[p]?.label ?? p}</option>)}
            </select>
            <select className="input-field flex-1" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {TX_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => { setFilter('type',''); setFilter('purpose',''); setFilter('status',''); }}
              className="btn-secondary !py-2 !px-4 whitespace-nowrap">
              Clear Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-300 bg-base-200/50">
                {['Transaction','User','Amount','Balance Change','Status','Date','Receipt'].map(h => (
                  <th key={h} className="text-left py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-base-content/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array(12).fill(0).map((_,i) => <SkeletonRow key={i}/>)
               : data.length === 0 ? <EmptyState/>
               : data.map((item, idx) => <TxRow key={idx} item={item} index={idx}/>)}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200/30">
            <p className="text-xs text-base-content/40">Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} total</p>
            <div className="flex gap-2">
              <button disabled={pagination.page<=1} onClick={() => setFilter('page', filters.page-1)}
                className="btn-secondary !py-1.5 !px-3 disabled:opacity-30"><ChevronLeft size={14}/></button>
              <button disabled={pagination.page>=pagination.pages} onClick={() => setFilter('page', filters.page+1)}
                className="btn-secondary !py-1.5 !px-3 disabled:opacity-30"><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}