'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, AlertTriangle, Clock, Send, Loader2,
  RefreshCw, Package, ChevronRight, Zap, Filter,
  CheckCircle2, XCircle, Info, MailCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchExpiryAlerts } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

function UrgencyBadge({ days }) {
  if (days < 0) return <span className="badge badge-error">Expired</span>;
  if (days <= 7) return <span className="badge badge-error">Critical · {days}d</span>;
  if (days <= 14) return <span className="badge badge-warning">Urgent · {days}d</span>;
  if (days <= 30) return <span className="badge badge-warning">{days}d left</span>;
  return <span className="badge badge-info">{days}d left</span>;
}

function ExpiryCard({ item, i }) {
  const days = item.daysLeft || 0;
  const urgency = days <= 7 ? 'error' : days <= 14 ? 'warning' : 'info';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.4 }}
      className={`card p-4 border-l-4 hover:shadow-md transition-all`}
      style={{ borderLeftColor: `var(--${urgency})` }}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}
          style={{ background: `color-mix(in srgb, var(--${urgency}), transparent 85%)` }}>
          <Calendar size={20} style={{ color: `var(--${urgency})` }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-base-content text-sm">{item.brandName || item.name}</p>
              <p className="text-xs text-base-content/50 mt-0.5">{item.category} · Batch: <span className="font-mono">{item.batchNumber || 'N/A'}</span></p>
            </div>
            <UrgencyBadge days={days} />
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="text-xs text-base-content/50 flex items-center gap-1">
              <Package size={11} />
              <span>{item.stockQuantity} units</span>
            </div>
            <div className="text-xs text-base-content/50 flex items-center gap-1">
              <Calendar size={11} />
              <span>Expires: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
            </div>
          </div>

          {/* Countdown bar */}
          <div className="mt-3">
            <div className="progress-bar">
              <motion.div className="progress-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(5, Math.min(100, (days / 30) * 100))}%` }}
                transition={{ delay: i * 0.04 + 0.3, duration: 0.6 }}
                style={{ background: `var(--${urgency})` }} />
            </div>
            <p className="text-[10px] text-base-content/35 mt-1">
              {days <= 0 ? 'Already expired' : `${days} day${days !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ExpiryAlertsPage() {
  const dispatch = useDispatch();
  const { expiryAlerts, expiryAlertsMeta, loading } = useSelector(s => s.pharmacyStore);

  const [days, setDays] = useState(30);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [filterGroup, setFilterGroup] = useState('all'); // all | critical | urgent | normal

  useEffect(() => {
    dispatch(fetchExpiryAlerts({ days }));
  }, [days, dispatch]);

  const handleSendEmail = async () => {
    setSendingEmail(true);
    await dispatch(fetchExpiryAlerts({ days, sendEmail: true }));
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  const filtered = expiryAlerts.filter(item => {
    const d = item.daysLeft || 0;
    if (filterGroup === 'critical') return d <= 7;
    if (filterGroup === 'urgent') return d > 7 && d <= 14;
    if (filterGroup === 'normal') return d > 14;
    return true;
  });

  const critical = expiryAlerts.filter(i => (i.daysLeft || 0) <= 7).length;
  const urgent = expiryAlerts.filter(i => (i.daysLeft || 0) > 7 && (i.daysLeft || 0) <= 14).length;
  const normal = expiryAlerts.filter(i => (i.daysLeft || 0) > 14).length;

  // Timeline chart: group by week
  const timelineData = (() => {
    const weeks = {};
    expiryAlerts.forEach(item => {
      const d = item.daysLeft || 0;
      const week = d <= 7 ? 'Week 1' : d <= 14 ? 'Week 2' : d <= 21 ? 'Week 3' : 'Week 4+';
      weeks[week] = (weeks[week] || 0) + 1;
    });
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4+'].map(w => ({ name: w, items: weeks[w] || 0 }));
  })();

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 p-4 md:p-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight font-montserrat flex items-center gap-2">
              <Clock size={26} className="text-warning" />
              <span className="text-base-content">Expiry </span>
              <span className="text-warning">Alerts</span>
            </h1>
            <p className="text-sm text-base-content/55 mt-1">
              {expiryAlertsMeta.count} medicine{expiryAlertsMeta.count !== 1 ? 's' : ''} expiring within {expiryAlertsMeta.alertDays} days
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Days picker */}
            <div className="flex items-center gap-1 bg-base-100 border border-base-300 rounded-xl p-1">
              {[7, 14, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? 'bg-warning text-warning-content shadow' : 'text-base-content/55 hover:text-base-content'}`}>
                  {d}d
                </button>
              ))}
            </div>

            {/* Send email */}
            <AnimatePresence mode="wait">
              {emailSent ? (
                <motion.div key="sent" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-bold">
                  <MailCheck size={14} /> Alert Sent!
                </motion.div>
              ) : (
                <motion.button key="send" onClick={handleSendEmail} disabled={sendingEmail || expiryAlerts.length === 0}
                  className="btn-secondary px-4 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50">
                  {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Email Alert
                </motion.button>
              )}
            </AnimatePresence>

            <button onClick={() => dispatch(fetchExpiryAlerts({ days }))} disabled={loading.expiryAlerts}
              className="p-2.5 rounded-xl bg-base-100 border border-base-300 hover:border-warning hover:text-warning transition-all">
              <RefreshCw size={16} className={loading.expiryAlerts ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Warning banner */}
      {critical > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="alert alert-error mb-5 rounded-xl">
          <Zap size={16} className="text-error flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">{critical} medicine{critical !== 1 ? 's' : ''} expiring within 7 days!</p>
            <p className="text-xs opacity-80 mt-0.5">Immediate action required. Consider returning to supplier or disposing safely.</p>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Critical (≤7d)', value: critical, color: 'error', icon: XCircle },
          { label: 'Urgent (8–14d)', value: urgent, color: 'warning', icon: AlertTriangle },
          { label: 'Normal (15–30d)', value: normal, color: 'info', icon: Info },
        ].map((s, i) => (
          <button key={i} onClick={() => setFilterGroup(filterGroup === ['critical','urgent','normal'][i] ? 'all' : ['critical','urgent','normal'][i])}
            className={`stat-card text-left transition-all border border-transparent ${filterGroup === ['critical','urgent','normal'][i] ? 'border-primary shadow-md' : ''}`}>
            <s.icon size={18} style={{ color: `var(--${s.color})` }} className="mb-2" />
            <div className="stat-card-value" style={{ color: `var(--${s.color})` }}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </button>
        ))}
      </motion.div>

      {/* Timeline chart */}
      {expiryAlerts.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="card p-5 mb-6">
          <h3 className="font-bold text-base-content text-sm mb-4 flex items-center gap-2">
            <Calendar size={15} className="text-warning" /> Expiry Timeline
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: '10px', fontSize: 12 }}
                cursor={{ stroke: 'var(--warning)', strokeWidth: 1, strokeDasharray: '4' }}
              />
              <Area type="monotone" dataKey="items" stroke="var(--warning)" fill="url(#expGradient)" strokeWidth={2} dot={{ fill: 'var(--warning)', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* List */}
      {loading.expiryAlerts ? (
        <div className="flex items-center justify-center py-20 gap-3 text-warning">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm">Scanning inventory...</span>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="card p-14 text-center">
          <CheckCircle2 size={48} className="text-success mx-auto mb-3" />
          <h3 className="font-black text-base-content text-lg">All Clear!</h3>
          <p className="text-sm text-base-content/50 mt-1">
            {filterGroup !== 'all' ? 'No items in this urgency group.' : `No medicines expiring within ${days} days.`}
          </p>
          {filterGroup !== 'all' && (
            <button onClick={() => setFilterGroup('all')} className="mt-3 text-primary text-xs underline">View all</button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => (
            <ExpiryCard key={`${item.medicineId}-${item.batchNumber}-${i}`} item={item} i={i} />
          ))}
        </div>
      )}
    </div>
  );
}