'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts';
import {
  Star, Users, TrendingUp, TrendingDown, RefreshCw, Download,
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  IndianRupee, ArrowUpRight, ChevronRight, Zap,
  Activity, ReceiptText, Mail, User, CreditCard, Tag
} from 'lucide-react';
import {
  fetchBillingSummary, selectBillingAnalytics
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Active:    { cls:'badge-success', icon: CheckCircle2, color:'var(--success)' },
  Expired:   { cls:'badge-error',   icon: XCircle,      color:'var(--error)'   },
  Cancelled: { cls:'badge-error',   icon: XCircle,      color:'var(--chart-6)' },
  Pending:   { cls:'badge-warning', icon: Clock,        color:'var(--warning)' },
};

const CHART_COLORS = ['var(--success)','var(--error)','var(--warning)','var(--chart-5)'];
const fadeUp  = { hidden:{ opacity:0, y:18 }, show:{ opacity:1, y:0 } };
const stagger = { show:{ transition:{ staggerChildren:0.07 } } };

// ─── Subscription Invoice ─────────────────────────────────────────────────────
const downloadSubscriptionInvoice = (sub) => {
  const user = sub.user ?? {};
  const plan = sub.plan ?? {};
  const payments = sub.paymentHistory ?? [];
  const totalPaid = payments.reduce((a,p) => a + (p.amount ?? 0), 0);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Subscription Invoice</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',sans-serif;color:#1a1a2e;padding:40px;background:#fff;max-width:560px;margin:0 auto;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #2563eb;margin-bottom:32px;}
    .brand{font-size:24px;font-weight:900;color:#2563eb;}.brand span{color:#0ea5e9;}
    .imeta{text-align:right;}
    .imeta h2{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:6px;}
    .imeta p{font-size:12px;color:#6b7280;}
    .hero{background:linear-gradient(135deg,#eff6ff,#ecfdf5);border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;border:1px solid #dbeafe;}
    .hero .plan{font-size:28px;font-weight:900;color:#1a1a2e;margin-bottom:4px;}
    .hero .price{font-size:42px;font-weight:900;color:#2563eb;}
    .hero .cycle{font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:1px;}
    .section{background:#f8faff;border-radius:10px;padding:20px;border:1px solid #e0e7ff;margin-bottom:20px;}
    .section h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:14px;}
    .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px;}
    .row span{color:#6b7280;}.row strong{color:#1a1a2e;font-weight:700;}
    table{width:100%;border-collapse:collapse;margin-top:8px;}
    thead th{font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;padding:8px 0;text-align:left;border-bottom:1px solid #e5e7eb;}
    tbody td{font-size:12px;color:#374151;padding:8px 0;border-bottom:1px solid #f3f4f6;}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;}
    .active{background:#dcfce7;color:#166534;}.expired{background:#fee2e2;color:#991b1b;}.pending{background:#fef9c3;color:#713f12;}
    .foot{text-align:center;margin-top:28px;font-size:11px;color:#9ca3af;padding-top:18px;border-top:1px dashed #e5e7eb;}
  </style></head><body>
  <div class="hdr">
    <div><div class="brand">Likeson<span>Health</span></div><p style="font-size:11px;color:#9ca3af;margin-top:4px;">Subscription Management</p></div>
    <div class="imeta"><h2>SUBSCRIPTION</h2><p>Generated: ${new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}</p><p>Status: <span class="badge ${(sub.status??'').toLowerCase()}">${sub.status}</span></p></div>
  </div>
  <div class="hero">
    <div class="plan">${typeof plan === 'object' ? plan.name ?? 'Premium Plan' : 'Subscription Plan'}</div>
    <div class="cycle">Billing Cycle</div>
    <div class="price">₹${totalPaid.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
    <div class="cycle">Total Paid</div>
  </div>
  <div class="section">
    <h4>Subscriber Details</h4>
    <div class="row"><span>Name</span><strong>${user.name ?? '—'}</strong></div>
    <div class="row"><span>Email</span><strong>${user.email ?? '—'}</strong></div>
    <div class="row"><span>Auto Renew</span><strong>${sub.autoRenew ? 'Yes' : 'No'}</strong></div>
    ${sub.appliedCoupon ? `<div class="row"><span>Coupon Applied</span><strong>${sub.appliedCoupon}</strong></div>` : ''}
  </div>
  <div class="section">
    <h4>Billing Cycle</h4>
    <div class="row"><span>Start Date</span><strong>${new Date(sub.startDate).toLocaleDateString('en-IN',{dateStyle:'long'})}</strong></div>
    <div class="row"><span>Expiry Date</span><strong>${new Date(sub.expiryDate).toLocaleDateString('en-IN',{dateStyle:'long'})}</strong></div>
  </div>
  ${payments.length > 0 ? `
  <div class="section">
    <h4>Payment History (${payments.length} payments)</h4>
    <table><thead><tr><th>Transaction ID</th><th>Amount</th><th>Date</th></tr></thead>
    <tbody>${payments.map(p => `<tr><td style="font-family:monospace;font-size:11px">${p.transactionId}</td><td>₹${(p.amount??0).toLocaleString('en-IN',{minimumFractionDigits:2})}</td><td>${p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}</td></tr>`).join('')}</tbody>
    </table>
    <div class="row" style="margin-top:12px;font-size:14px;font-weight:900;border-top:2px solid #e0e7ff;padding-top:10px;"><span>Total Paid</span><span style="color:#2563eb">₹${totalPaid.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
  </div>` : ''}
  <div class="foot"><p>LikesonHealth Subscription Receipt · System Generated</p><p>support@likesonhealth.com</p></div>
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
          {p.name}: <strong>{typeof p.value === 'number' && p.name.includes('₹')
            ? `₹${p.value.toLocaleString('en-IN')}` : p.value}</strong>
        </p>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

const StatCard = memo(({ title, value, sub, icon: Icon, color, trend }) => (
  <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
    <div className="flex items-start justify-between">
      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">{title}</p>
      <div className="p-2.5 rounded-xl" style={{background:`color-mix(in srgb, ${color} 15%, transparent)`}}>
        <Icon size={17} style={{color}}/>
      </div>
    </div>
    <p className="text-2xl font-black text-base-content">{value}</p>
    {sub && <p className="text-xs text-base-content/40">{sub}</p>}
    {trend != null && (
      <div className={`flex items-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-success' : 'text-error'}`}>
        {trend >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
        {Math.abs(trend)}% vs last
      </div>
    )}
  </motion.div>
));
StatCard.displayName = 'StatCard';

const StatusBadge = memo(({ status }) => {
  const { cls, icon: Icon } = STATUS_CFG[status] ?? { cls:'badge-info', icon: Clock };
  return <span className={`badge ${cls} gap-1`}><Icon size={11}/>{status}</span>;
});
StatusBadge.displayName = 'StatusBadge';

const SkeletonCard = () => (
  <div className="glass-card p-5 space-y-3">
    <div className="skeleton h-4 w-2/3 rounded"/>
    <div className="skeleton h-6 w-1/2 rounded"/>
    <div className="skeleton h-4 w-full rounded"/>
  </div>
);

// ─── Renewal Card ─────────────────────────────────────────────────────────────
const RenewalCard = memo(({ sub, index }) => {
  const daysLeft = Math.ceil((new Date(sub.expiryDate) - new Date()) / (1000*60*60*24));
  const isUrgent = daysLeft <= 3;

  return (
    <motion.div
      variants={fadeUp}
      className={`glass-card p-4 space-y-3 ${isUrgent ? 'border-error/40' : ''}`}
      style={isUrgent ? {borderColor:'var(--error)',boxShadow:'0 0 20px color-mix(in srgb, var(--error), transparent 80%)'} : {}}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-primary"/>
          </div>
          <div>
            <p className="font-black text-sm text-base-content">{sub.user?.name ?? '—'}</p>
            <p className="text-xs text-base-content/40 flex items-center gap-1">
              <Mail size={10}/> {sub.user?.email ?? '—'}
            </p>
          </div>
        </div>
        <StatusBadge status={sub.status}/>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-base-content/50">
          <Calendar size={12}/> Expires: <span className={`font-bold ${isUrgent ? 'text-error' : 'text-base-content'}`}>
            {new Date(sub.expiryDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
          </span>
        </div>
        <div className={`flex items-center gap-1 font-black text-xs px-2 py-1 rounded-lg ${
          isUrgent ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
        }`}>
          <Clock size={11}/> {daysLeft}d left
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{background: isUrgent ? 'var(--error)' : 'var(--warning)'}}
            initial={{width:0}}
            animate={{width:`${Math.max(5, Math.min(100, (7-daysLeft)/7*100))}%`}}
            transition={{delay: index*0.05 + 0.3, duration:0.8, ease:'easeOut'}}
          />
        </div>
        <p className="text-xs text-base-content/40">{daysLeft} of 7 days warning period</p>
      </div>

      {/* Usage This Month */}
      {sub.usageThisMonth && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-base-300">
          {[
            ['Consults', sub.usageThisMonth.doctorConsultationsUsed],
            ['Rides',    sub.usageThisMonth.transportRidesUsed],
            ['Labs',     sub.usageThisMonth.labTestsUsed],
          ].map(([label, val]) => (
            <div key={label} className="text-center">
              <p className="text-base font-black text-base-content">{val ?? 0}</p>
              <p className="text-xs text-base-content/40">{label}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => downloadSubscriptionInvoice(sub)}
        className="w-full btn-secondary flex items-center justify-center gap-2 !py-2 !text-xs">
        <ReceiptText size={13}/> Download Invoice
      </button>
    </motion.div>
  );
});
RenewalCard.displayName = 'RenewalCard';

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubscriptionBillingPage() {
  const dispatch = useDispatch();
  const { summary, upcomingRenewals, loading, error } = useSelector(selectBillingAnalytics);

  const fetchData = useCallback(() => {
    dispatch(fetchBillingSummary());
  }, [dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byStatus = {};
    let totalRevenue = 0;
    summary.forEach(s => {
      byStatus[s._id] = { count: s.count, revenue: s.totalRevenue };
      totalRevenue += s.totalRevenue ?? 0;
    });
    return {
      byStatus,
      totalRevenue,
      totalSubs:   summary.reduce((a,s) => a + s.count, 0),
      activeCount: byStatus.Active?.count ?? 0,
      expiredCount:byStatus.Expired?.count ?? 0,
    };
  }, [summary]);

  // ── Charts ─────────────────────────────────────────────────────────────────
  const pieData = useMemo(() =>
    summary.filter(s => s.count > 0).map(s => ({ name: s._id, value: s.count }))
  , [summary]);

  const revenueBarData = useMemo(() =>
    summary.filter(s => s.totalRevenue > 0).map(s => ({
      name: s._id,
      revenue: s.totalRevenue ?? 0,
      count: s.count,
    }))
  , [summary]);

  const radialData = useMemo(() => [
    { name: 'Active',    value: stats.activeCount,  fill:'var(--success)' },
    { name: 'Expired',   value: stats.expiredCount, fill:'var(--error)'   },
    { name: 'Cancelled', value: stats.byStatus.Cancelled?.count ?? 0, fill:'var(--chart-6)' },
    { name: 'Pending',   value: stats.byStatus.Pending?.count  ?? 0,  fill:'var(--warning)' },
  ].filter(d => d.value > 0), [stats]);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportRenewalsCSV = useCallback(() => {
    const rows = ['Name,Email,Status,Expiry,AutoRenew,Consults,Rides,Labs',
      ...upcomingRenewals.map(s => {
        const u = s.user ?? {};
        return `"${u.name??''}","${u.email??''}","${s.status}","${new Date(s.expiryDate).toLocaleDateString('en-IN')}","${s.autoRenew}",${s.usageThisMonth?.doctorConsultationsUsed??0},${s.usageThisMonth?.transportRidesUsed??0},${s.usageThisMonth?.labTestsUsed??0}`;
      })
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows],{type:'text/csv'}));
    a.download = `upcoming-renewals-${Date.now()}.csv`;
    a.click();
  }, [upcomingRenewals]);

  const CustomTooltipR = memo(({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card px-4 py-3 text-xs shadow-xl">
        <p className="font-bold text-base-content mb-2">{label}</p>
        <p style={{color:payload[0]?.color}}>Revenue: <strong>₹{Number(payload[0]?.value).toLocaleString('en-IN')}</strong></p>
        <p className="text-base-content/60">Subscribers: <strong>{payload[1]?.value}</strong></p>
      </div>
    );
  });

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-responsive-xl font-black text-base-content flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-accent/10"><Star size={26} className="text-accent"/></div>
            Subscription Billing
          </h1>
          <p className="text-base-content/40 text-sm mt-1 ml-1">Plan analytics, revenue &amp; upcoming renewals</p>
        </motion.div>
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2 !py-2 !px-4">
            <RefreshCw size={14}/> Refresh
          </button>
          <button onClick={exportRenewalsCSV} className="btn-primary-cta flex items-center gap-2 !py-2 !px-4">
            <Download size={14}/> Export Renewals
          </button>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array(4).fill(0).map((_,i) => <SkeletonCard key={i}/>)
          : <>
          <StatCard title="Total Revenue"   value={`₹${stats.totalRevenue.toLocaleString('en-IN',{maximumFractionDigits:0})}`} icon={IndianRupee} color="var(--success)" trend={11.4}/>
          <StatCard title="Total Subs"      value={stats.totalSubs.toLocaleString()} icon={Users}        color="var(--primary)" trend={6.2}/>
          <StatCard title="Active Now"      value={stats.activeCount}               icon={CheckCircle2} color="var(--success)" sub={`${stats.expiredCount} expired`}/>
          <StatCard title="Upcoming (7d)"   value={upcomingRenewals.length}         icon={Calendar}     color="var(--warning)" sub="Renewals due soon"/>
        </>}
      </motion.div>

      {/* Charts Row */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue by Status */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-primary"/>
            <h3 className="font-bold text-base-content text-sm">Revenue by Subscription Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={revenueBarData} margin={{top:4,right:4,bottom:0,left:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--base-content)',opacity:0.5}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltipR/>}/>
              <Bar dataKey="revenue" radius={[6,6,0,0]} name="Revenue ₹">
                {revenueBarData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
              </Bar>
              <Bar dataKey="count" fill="var(--base-300)" radius={[6,6,0,0]} name="Count" opacity={0.5}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={16} className="text-secondary"/>
            <h3 className="font-bold text-base-content text-sm">Subscriber Status Mix</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-[210px]">
              <div className="spinner"/>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={72} innerRadius={38} paddingAngle={4}>
                  {pieData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{fontSize:10}} iconType="circle"/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Radial Usage Overview */}
      {radialData.length > 0 && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.28}}
          className="glass-card p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-accent"/>
                <h3 className="font-bold text-base-content text-sm">Subscription Status Overview</h3>
              </div>
              <p className="text-xs text-base-content/40 mb-4">Breakdown across all plan statuses</p>
              <div className="space-y-3">
                {radialData.map((d,i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-semibold text-base-content/60">{d.name}</div>
                    <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{background: d.fill}}
                        initial={{width:0}}
                        animate={{width:`${(d.value/stats.totalSubs)*100}%`}}
                        transition={{delay: i*0.1+0.4, duration:0.8, ease:'easeOut'}}
                      />
                    </div>
                    <div className="w-12 text-xs font-black text-right text-base-content">{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-56">
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart innerRadius={30} outerRadius={80} data={radialData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" background cornerRadius={6}>
                    {radialData.map((d,i) => <Cell key={i} fill={d.fill}/>)}
                  </RadialBar>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:10}} iconType="circle"/>
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upcoming Renewals */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.32}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-base-content flex items-center gap-2">
              <Calendar size={20} className="text-warning"/> Upcoming Renewals
              {upcomingRenewals.length > 0 && (
                <span className="badge badge-warning ml-1">{upcomingRenewals.length}</span>
              )}
            </h2>
            <p className="text-xs text-base-content/40 mt-0.5">Subscriptions expiring within 7 days</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_,i) => <SkeletonCard key={i}/>)}
          </div>
        ) : upcomingRenewals.length === 0 ? (
          <div className="glass-card p-16 flex flex-col items-center justify-center gap-4 text-base-content/30">
            <CheckCircle2 size={56} strokeWidth={0.8}/>
            <p className="text-lg font-bold">No renewals due soon</p>
            <p className="text-sm">All subscriptions have ample time left</p>
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingRenewals.map((sub, i) => (
              <RenewalCard key={sub._id ?? i} sub={sub} index={i}/>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Summary Table */}
      {summary.length > 0 && (
        <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.38}}
          className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between">
            <h3 className="font-bold text-base-content flex items-center gap-2">
              <CreditCard size={16} className="text-primary"/> Plan Revenue Summary
            </h3>
            <button onClick={exportRenewalsCSV} className="text-xs text-primary font-bold flex items-center gap-1">
              <Download size={12}/> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300 bg-base-200/50">
                  {['Status','Subscribers','Total Revenue','Avg Revenue'].map(h => (
                    <th key={h} className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wider text-base-content/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((row, idx) => {
                  const avg = row.count > 0 ? (row.totalRevenue ?? 0) / row.count : 0;
                  const { cls } = STATUS_CFG[row._id] ?? { cls:'badge-info' };
                  return (
                    <motion.tr key={row._id}
                      initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:idx*0.05}}
                      className="border-b border-base-300/40 hover:bg-base-200/30 transition-colors">
                      <td className="py-3.5 px-5"><StatusBadge status={row._id}/></td>
                      <td className="py-3.5 px-5 font-black text-base-content">{row.count.toLocaleString()}</td>
                      <td className="py-3.5 px-5 font-black text-base-content">₹{(row.totalRevenue ?? 0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                      <td className="py-3.5 px-5 text-base-content/60">₹{avg.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                    </motion.tr>
                  );
                })}
                <tr className="bg-primary/5">
                  <td className="py-3.5 px-5 font-black text-base-content">TOTAL</td>
                  <td className="py-3.5 px-5 font-black text-base-content">{stats.totalSubs.toLocaleString()}</td>
                  <td className="py-3.5 px-5 font-black text-success">₹{stats.totalRevenue.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                  <td className="py-3.5 px-5 text-base-content/60">
                    ₹{stats.totalSubs > 0 ? (stats.totalRevenue/stats.totalSubs).toLocaleString('en-IN',{maximumFractionDigits:0}) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="alert alert-error text-sm">
          <AlertCircle size={15}/> Failed to load. <button onClick={fetchData} className="underline ml-2">Retry</button>
        </div>
      )}
    </div>
  );
}