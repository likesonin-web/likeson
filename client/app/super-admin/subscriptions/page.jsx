'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, TrendingUp, AlertTriangle, DollarSign,
  RefreshCw, Download, Search, ChevronLeft, ChevronRight,
  Eye, Edit2, XCircle, Filter, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Clock, Zap, MoreHorizontal, X,
} from 'lucide-react';

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  adminFetchAllSubscriptions,
  selectAdminSubscriptions,
  selectAdminPagination,
  selectAdminLoading,
  selectSubscriptionError,
  adminUpdateSubscription,
} from '../../../store/slices/subscriptionPlanSlice';

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAN_META = {
  'Basic Care':            { color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  'Standard Care':         { color: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9' },
  'Premium Care':          { color: '#0ea5e9', bg: '#e0f2fe', text: '#0369a1' },
  'Family Care':           { color: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  'Pregnant Women Care':   { color: '#ec4899', bg: '#fdf2f8', text: '#be185d' },
  "NRI's Care":            { color: '#10b981', bg: '#ecfdf5', text: '#047857' },
  Custom:                  { color: '#6b7280', bg: '#f9fafb', text: '#374151' },
};

const DEFAULT_META = { color: '#6b7280', bg: '#f9fafb', text: '#374151' };
const getPlanMeta  = (name = '') => PLAN_META[name] ?? DEFAULT_META;

const STATUS_MAP = {
  Active:    { icon: CheckCircle2, label: 'Active',   cls: 'status-active'   },
  Trial:     { icon: Clock,        label: 'Trial',    cls: 'status-trial'    },
  Cancelled: { icon: XCircle,      label: 'Cancelled',cls: 'status-cancelled'},
  Expired:   { icon: AlertTriangle,label: 'Expired',  cls: 'status-expired'  },
};

const PER_PAGE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000);
  return diff;
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

const AVATAR_PALETTE = [
  ['#dbeafe','#1d4ed8'], ['#ede9fe','#6d28d9'], ['#dcfce7','#15803d'],
  ['#fef3c7','#b45309'], ['#fce7f3','#be185d'], ['#e0f2fe','#0369a1'],
  ['#f1f5f9','#475569'],
];
const avatarStyle = (name = '') => {
  const idx = name.charCodeAt(0) % AVATAR_PALETTE.length;
  const [bg, fg] = AVATAR_PALETTE[idx];
  return { backgroundColor: bg, color: fg };
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, delta, up, accent, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="metric-card"
    >
      <div className="metric-icon-wrap" style={{ background: accent + '18', color: accent }}>
        <Icon size={18} />
      </div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {delta && (
        <p className="metric-delta">
          {up
            ? <ArrowUpRight size={12} className="delta-up" />
            : <ArrowDownRight size={12} className="delta-dn" />}
          <span className={up ? 'delta-up' : 'delta-dn'}>{delta}</span>
        </p>
      )}
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.Active;
  const Icon = meta.icon;
  return (
    <span className={`status-badge ${meta.cls}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

function PlanBadge({ name }) {
  const m = getPlanMeta(name);
  return (
    <span
      className="plan-badge"
      style={{ background: m.bg, color: m.text, borderColor: m.color + '40' }}
    >
      {name ?? 'Unknown'}
    </span>
  );
}

function ExpiryCell({ dateStr }) {
  const d = daysLeft(dateStr);
  if (d === null) return <span className="muted-text">—</span>;
  const urgent = d <= 7;
  const warn   = d <= 14;
  return (
    <span className={urgent ? 'expiry-urgent' : warn ? 'expiry-warn' : 'expiry-ok'}>
      {fmtDate(dateStr)}
      {urgent && <span className="expiry-tag"> · {d}d left</span>}
    </span>
  );
}

function UsageBar({ pct }) {
  const safe = Math.min(100, Math.max(0, pct ?? 0));
  const color = safe > 80 ? '#ef4444' : safe > 55 ? '#f59e0b' : '#10b981';
  return (
    <div className="usage-wrap">
      <div className="usage-track">
        <motion.div
          className="usage-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
      </div>
      <span className="usage-pct" style={{ color }}>{safe}%</span>
    </div>
  );
}

// Detail drawer
function SubDetailDrawer({ sub, onClose, onUpdate }) {
  const dispatch = useDispatch();
  const [saving, setSaving] = useState(false);
  if (!sub) return null;

  const handleCancel = async () => {
    setSaving(true);
    await dispatch(adminUpdateSubscription({ subId: sub._id, status: 'Cancelled' }));
    setSaving(false);
    onUpdate();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="drawer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="drawer-header">
          <h2 className="drawer-title">Subscription Detail</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="drawer-body">
          {/* User */}
          <div className="drawer-avatar-row">
            <div className="drawer-avatar" style={avatarStyle(sub.userName ?? '')}>
              {initials(sub.userName)}
            </div>
            <div>
              <p className="drawer-name">{sub.userName ?? '—'}</p>
              <p className="drawer-email">{sub.userEmail ?? '—'}</p>
            </div>
          </div>

          <div className="drawer-divider" />

          {/* Info grid */}
          <div className="drawer-grid">
            {[
              ['Plan',    <PlanBadge name={sub.planName} />],
              ['Status',  <StatusBadge status={sub.status} />],
              ['Expiry',  <ExpiryCell dateStr={sub.expiryDate} />],
              ['MRR',     fmtINR(sub.planMrr)],
              ['Sub ID',  <span className="mono-sm">{sub._id}</span>],
              ['Auto-renew', sub.autoRenew ? '✓ Enabled' : '— Off'],
            ].map(([k, v]) => (
              <div key={k} className="drawer-row">
                <span className="drawer-key">{k}</span>
                <span className="drawer-val">{v}</span>
              </div>
            ))}
          </div>

          {/* Usage */}
          {sub.usage && (
            <>
              <div className="drawer-divider" />
              <p className="drawer-section-title">Usage this month</p>
              {Object.entries(sub.usage).map(([k, v]) => (
                <div key={k} className="usage-row-detail">
                  <span className="drawer-key">{k}</span>
                  <UsageBar pct={typeof v === 'number' ? v : 0} />
                </div>
              ))}
            </>
          )}
        </div>

        <div className="drawer-footer">
          <button className="btn-danger" onClick={handleCancel} disabled={saving}>
            {saving ? 'Cancelling…' : 'Cancel Subscription'}
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ActiveSubscriptionsPage() {
  const dispatch    = useDispatch();
  const rawSubs     = useSelector(selectAdminSubscriptions);
  const pagination  = useSelector(selectAdminPagination);
  const loading     = useSelector(selectAdminLoading);
  const error       = useSelector(selectSubscriptionError);

  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('all');
  const [selectedSub, setSelectedSub] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const load = useCallback(
    (p = 1) => dispatch(adminFetchAllSubscriptions({ page: p, limit: PER_PAGE })),
    [dispatch]
  );

  useEffect(() => { load(page); }, [load, page]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(page);
    setRefreshing(false);
  };

  // ── Client-side filter + search (on top of server-paginated data) ─────────
  const displayed = useMemo(() => {
    let rows = rawSubs ?? [];
    if (filter !== 'all')
      rows = rows.filter(s => {
        if (filter === 'expiring') return daysLeft(s.expiryDate) <= 10;
        return s.status === filter;
      });
    if (search.trim())
      rows = rows.filter(s =>
        [s.userName, s.userEmail, s.planName].some(f =>
          (f ?? '').toLowerCase().includes(search.toLowerCase())
        )
      );
    return rows;
  }, [rawSubs, filter, search]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const all      = rawSubs ?? [];
    const active   = all.filter(s => s.status === 'Active').length;
    const trial    = all.filter(s => s.status === 'Trial').length;
    const expiring = all.filter(s => daysLeft(s.expiryDate) <= 10).length;
    const mrr      = all.reduce((a, s) => a + (s.planMrr ?? 0), 0);
    return { active, trial, expiring, mrr, total: all.length };
  }, [rawSubs]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const planChartData = useMemo(() => {
    const map = {};
    (rawSubs ?? []).forEach(s => {
      const name = s.planName ?? 'Unknown';
      map[name] = (map[name] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({
      name: name.replace(' Care', '').replace("NRI's", 'NRI'),
      count,
      fill: getPlanMeta(name).color,
    }));
  }, [rawSubs]);

  const mrrPieData = useMemo(() => {
    const map = {};
    (rawSubs ?? []).forEach(s => {
      const name = s.planName ?? 'Unknown';
      map[name] = (map[name] ?? 0) + (s.planMrr ?? 0);
    });
    return Object.entries(map).map(([name, value]) => ({
      name, value, fill: getPlanMeta(name).color,
    }));
  }, [rawSubs]);

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = 'Name,Email,Plan,Status,Expiry,MRR';
    const rows   = displayed.map(s =>
      `"${s.userName}","${s.userEmail}","${s.planName}",${s.status},${s.expiryDate ?? ''},${s.planMrr ?? 0}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a    = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'active_subscriptions.csv',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Scoped styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        .asp-root {
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
          background: var(--base-100);
          color: var(--base-content);
          padding: 28px 32px 48px;
        }

        /* Topbar */
        .asp-topbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 28px;
        }
        .asp-title-block h1 {
          font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
          color: var(--base-content); margin: 0;
        }
        .asp-title-block p {
          font-size: 12px; color: oklch(50% 0 0 / 0.5);
          font-family: 'JetBrains Mono', monospace; margin: 3px 0 0;
        }
        .asp-topbar-actions { display: flex; gap: 8px; align-items: center; }
        .live-pill {
          display: flex; align-items: center; gap: 5px;
          background: #dcfce7; color: #15803d;
          font-size: 11px; font-weight: 600; padding: 4px 10px;
          border-radius: 20px; font-family: 'JetBrains Mono', monospace;
        }
        .dark .live-pill { background: #14532d; color: #86efac; }
        .live-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #16a34a;
          animation: lpulse 2s ease-in-out infinite;
        }
        @keyframes lpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .btn-ghost {
          display: flex; align-items: center; gap: 6px;
          background: var(--base-200); border: 1px solid var(--base-300);
          color: var(--base-content); padding: 7px 13px;
          border-radius: 8px; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: 'Sora', sans-serif;
          transition: all .15s;
        }
        .btn-ghost:hover { background: var(--base-300); }
        .btn-primary {
          display: flex; align-items: center; gap: 6px;
          background: var(--primary); color: var(--primary-content);
          padding: 7px 15px; border-radius: 8px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          border: none; font-family: 'Sora', sans-serif;
          transition: filter .15s;
        }
        .btn-primary:hover { filter: brightness(1.08); }

        /* Metrics */
        .metrics-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 20px;
        }
        .metric-card {
          background: var(--base-200); border: 1px solid var(--base-300);
          border-radius: 12px; padding: 16px 18px;
        }
        .metric-icon-wrap {
          width: 36px; height: 36px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 10px;
        }
        .metric-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .07em; color: oklch(50% 0 0 / .55); margin-bottom: 4px; }
        .metric-value { font-size: 28px; font-weight: 800; letter-spacing: -1px;
          color: var(--base-content); line-height: 1; }
        .metric-delta { display: flex; align-items: center; gap: 3px;
          font-size: 11px; margin-top: 6px; color: oklch(50% 0 0 / .5); }
        .delta-up { color: #16a34a; }
        .delta-dn { color: #dc2626; }

        /* Charts */
        .charts-row { display: grid; grid-template-columns: 1.6fr 1fr;
          gap: 12px; margin-bottom: 16px; }
        .chart-card {
          background: var(--base-100); border: 1px solid var(--base-300);
          border-radius: 14px; padding: 18px 20px;
        }
        .chart-card-title { font-size: 13px; font-weight: 700;
          color: var(--base-content); margin-bottom: 2px; }
        .chart-card-sub { font-size: 11px; color: oklch(50% 0 0 / .45);
          margin-bottom: 14px; }

        /* Table */
        .table-card {
          background: var(--base-100); border: 1px solid var(--base-300);
          border-radius: 14px; overflow: hidden; margin-bottom: 14px;
        }
        .table-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-bottom: 1px solid var(--base-300);
          gap: 12px; flex-wrap: wrap;
        }
        .table-toolbar-title { font-size: 13px; font-weight: 700;
          color: var(--base-content); }
        .toolbar-right { display: flex; gap: 8px; align-items: center; }
        .search-box {
          display: flex; align-items: center; gap: 7px;
          background: var(--base-200); border: 1px solid var(--base-300);
          border-radius: 8px; padding: 6px 10px;
        }
        .search-box input {
          background: none; border: none; outline: none; font-size: 12px;
          color: var(--base-content); width: 160px;
          font-family: 'Sora', sans-serif;
        }
        .search-box input::placeholder { color: oklch(50% 0 0 / .4); }
        .filter-pills { display: flex; gap: 5px; }
        .filter-pill {
          font-size: 11px; font-weight: 600; padding: 5px 10px;
          border-radius: 6px; border: 1px solid var(--base-300);
          background: var(--base-200); color: oklch(50% 0 0 / .6);
          cursor: pointer; font-family: 'Sora', sans-serif;
          transition: all .12s;
        }
        .filter-pill.active {
          background: var(--primary); color: var(--primary-content);
          border-color: var(--primary);
        }
        .filter-pill:hover:not(.active) { background: var(--base-300); }

        /* Table */
        .subs-table { width: 100%; border-collapse: collapse; }
        .subs-table thead th {
          padding: 10px 16px; text-align: left;
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .08em; color: oklch(50% 0 0 / .5);
          background: var(--base-200); border-bottom: 1px solid var(--base-300);
        }
        .subs-table tbody tr {
          border-bottom: 1px solid var(--base-300);
          transition: background .1s; cursor: pointer;
        }
        .subs-table tbody tr:last-child { border-bottom: none; }
        .subs-table tbody tr:hover { background: var(--base-200); }
        .subs-table td { padding: 12px 16px; vertical-align: middle; }

        /* User cell */
        .user-cell { display: flex; align-items: center; gap: 10px; }
        .avatar-circle {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .user-name { font-size: 13px; font-weight: 600; color: var(--base-content); }
        .user-email { font-size: 10px; color: oklch(50% 0 0 / .5);
          font-family: 'JetBrains Mono', monospace; }

        /* Badges */
        .plan-badge {
          display: inline-block; font-size: 10px; font-weight: 700;
          padding: 3px 8px; border-radius: 20px; border: 1px solid;
          white-space: nowrap;
        }
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: 600; padding: 3px 8px;
          border-radius: 20px; white-space: nowrap;
        }
        .status-active   { background:#dcfce7; color:#15803d; }
        .status-trial    { background:#fef3c7; color:#92400e; }
        .status-cancelled{ background:#fee2e2; color:#991b1b; }
        .status-expired  { background:#f3f4f6; color:#6b7280; }
        .dark .status-active   { background:#14532d; color:#86efac; }
        .dark .status-trial    { background:#451a03; color:#fcd34d; }
        .dark .status-cancelled{ background:#450a0a; color:#fca5a5; }
        .dark .status-expired  { background:#1f2937; color:#9ca3af; }

        /* Expiry */
        .expiry-urgent { color: #dc2626; font-weight: 700;
          font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .expiry-warn   { color: #d97706; font-weight: 600;
          font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .expiry-ok     { color: var(--base-content); opacity: .7;
          font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .expiry-tag { font-size: 10px; opacity: .75; }
        .muted-text { color: oklch(50% 0 0 / .4); font-size: 12px; }

        /* Usage */
        .usage-wrap { display: flex; align-items: center; gap: 7px; }
        .usage-track { width: 70px; height: 5px; background: var(--base-300);
          border-radius: 3px; overflow: hidden; }
        .usage-fill  { height: 100%; border-radius: 3px; }
        .usage-pct   { font-size: 11px; font-weight: 600;
          font-family: 'JetBrains Mono', monospace; min-width: 28px; }

        /* Action buttons */
        .row-actions { display: flex; gap: 5px; }
        .icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--base-300); background: var(--base-200);
          color: oklch(50% 0 0 / .6); cursor: pointer;
          transition: all .12s;
        }
        .icon-btn:hover { background: var(--primary); color: var(--primary-content);
          border-color: var(--primary); }
        .icon-btn.danger:hover { background: #ef4444; color: #fff; border-color: #ef4444; }

        /* Pagination */
        .pagination-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 18px; border-top: 1px solid var(--base-300);
          font-size: 11px; color: oklch(50% 0 0 / .5);
        }
        .pag-btns { display: flex; gap: 4px; }
        .pag-btn {
          min-width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--base-300); background: var(--base-200);
          color: var(--base-content); font-size: 11px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; padding: 0 6px; font-family: 'Sora', sans-serif;
          transition: all .12s;
        }
        .pag-btn.active { background: var(--primary); color: var(--primary-content);
          border-color: var(--primary); }
        .pag-btn:hover:not(.active):not(:disabled) { background: var(--base-300); }
        .pag-btn:disabled { opacity: .35; cursor: not-allowed; }

        /* Empty / Error / Loading */
        .state-box {
          padding: 48px; text-align: center;
          color: oklch(50% 0 0 / .45); font-size: 14px;
        }
        .state-box svg { margin: 0 auto 12px; display: block;
          color: oklch(50% 0 0 / .25); }
        .error-box { color: #ef4444; }

        /* Summary footer */
        .summary-footer { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .sum-card {
          background: var(--base-200); border: 1px solid var(--base-300);
          border-radius: 12px; padding: 14px 16px;
        }
        .sum-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .07em; color: oklch(50% 0 0 / .5); margin-bottom: 8px; }
        .sum-track { width: 100%; height: 6px; background: var(--base-300);
          border-radius: 3px; overflow: hidden; margin: 6px 0 5px; }
        .sum-fill  { height: 100%; border-radius: 3px; }
        .sum-nums  { display: flex; justify-content: space-between;
          font-size: 11px; color: oklch(50% 0 0 / .55); }
        .sum-count { font-size: 14px; font-weight: 800; margin-bottom: 2px; }

        /* Drawer */
        .drawer-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.45);
          z-index: 40; backdrop-filter: blur(2px);
        }
        .drawer {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 380px; background: var(--base-100);
          border-left: 1px solid var(--base-300);
          z-index: 50; display: flex; flex-direction: column;
        }
        .drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px; border-bottom: 1px solid var(--base-300);
        }
        .drawer-title { font-size: 15px; font-weight: 700; color: var(--base-content); }
        .drawer-body { flex: 1; overflow-y: auto; padding: 20px; }
        .drawer-footer { padding: 16px 20px; border-top: 1px solid var(--base-300); }
        .drawer-avatar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .drawer-avatar {
          width: 50px; height: 50px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; flex-shrink: 0;
        }
        .drawer-name  { font-size: 15px; font-weight: 700; color: var(--base-content); }
        .drawer-email { font-size: 11px; color: oklch(50% 0 0 / .5);
          font-family: 'JetBrains Mono', monospace; }
        .drawer-divider { border: none; border-top: 1px solid var(--base-300); margin: 14px 0; }
        .drawer-grid { display: flex; flex-direction: column; gap: 10px; }
        .drawer-row { display: flex; align-items: center; justify-content: space-between;
          font-size: 12px; }
        .drawer-key { color: oklch(50% 0 0 / .5); font-weight: 500; }
        .drawer-val { color: var(--base-content); font-weight: 600; }
        .drawer-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .07em; color: oklch(50% 0 0 / .5); margin-bottom: 10px; }
        .usage-row-detail { display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
        .btn-danger {
          width: 100%; padding: 10px; border-radius: 9px;
          background: #fef2f2; border: 1px solid #fecaca;
          color: #dc2626; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: 'Sora', sans-serif;
          transition: all .12s;
        }
        .btn-danger:hover { background: #dc2626; color: #fff; border-color: #dc2626; }
        .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

        /* Mono */
        .mono-sm { font-family: 'JetBrains Mono', monospace; font-size: 10px;
          color: oklch(50% 0 0 / .6); }

        /* Spinner */
        .spin { animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Skeleton */
        .skeleton-row td { padding: 14px 16px; }
        .skel { border-radius: 6px; background: var(--base-300);
          animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes shimmer {
          0%,100%{opacity:1} 50%{opacity:.4}
        }
      `}</style>

      <div className="asp-root">

        {/* Topbar */}
        <div className="asp-topbar">
          <div className="asp-title-block">
            <h1>Active Subscriptions</h1>
            <p>admin / subscriptions / active</p>
          </div>
          <div className="asp-topbar-actions">
            <div className="live-pill">
              <div className="live-dot" />
              Live
            </div>
            <button className="btn-ghost" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
              Refresh
            </button>
            <button className="btn-primary" onClick={exportCSV}>
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="metrics-grid">
          <MetricCard icon={Users}        label="Total subscribers" value={metrics.total}              accent="#3b82f6" delay={0} />
          <MetricCard icon={Zap}          label="On free trial"     value={metrics.trial}              accent="#8b5cf6" delay={0.05} />
          <MetricCard icon={AlertTriangle}label="Expiring ≤ 10 days" value={metrics.expiring}          accent="#f59e0b" delay={0.1} up={false} />
          <MetricCard icon={TrendingUp}   label="Monthly MRR"       value={fmtINR(metrics.mrr)}       accent="#10b981" delay={0.15} up />
        </div>

        {/* Charts */}
        {!loading && rawSubs?.length > 0 && (
          <div className="charts-row">
            <div className="chart-card">
              <p className="chart-card-title">Subscribers by plan</p>
              <p className="chart-card-sub">Distribution across plan tiers</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={planChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'oklch(50% 0 0 / 0.5)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'oklch(50% 0 0 / 0.5)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'var(--base-200)' }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {planChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <p className="chart-card-title">MRR by plan</p>
              <p className="chart-card-sub">Revenue breakdown</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={mrrPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                    dataKey="value" paddingAngle={3}>
                    {mrrPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => fmtINR(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {mrrPieData.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'oklch(50% 0 0 / 0.6)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: e.fill }} />
                    {e.name.replace(' Care', '')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="table-card">
          <div className="table-toolbar">
            <span className="table-toolbar-title">
              Subscriber roster
              <span style={{ fontWeight: 400, fontSize: 11, color: 'oklch(50% 0 0 / 0.45)', marginLeft: 8 }}>
                {pagination?.total ?? rawSubs?.length ?? 0} total
              </span>
            </span>
            <div className="toolbar-right">
              <div className="filter-pills">
                {['all', 'Active', 'Trial', 'expiring'].map(f => (
                  <button
                    key={f}
                    className={`filter-pill ${filter === f ? 'active' : ''}`}
                    onClick={() => { setFilter(f); setPage(1); }}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="search-box">
                <Search size={13} style={{ color: 'oklch(50% 0 0 / 0.4)', flexShrink: 0 }} />
                <input
                  placeholder="Search name, email, plan…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <X size={12} style={{ color: 'oklch(50% 0 0 / 0.4)' }} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <table className="subs-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expiry</th>
                <th>Usage</th>
                <th>MRR</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading skeletons */}
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  {[140, 100, 80, 90, 90, 70, 90].map((w, j) => (
                    <td key={j}>
                      <div className="skel" style={{ width: w, height: 14 }} />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Error */}
              {!loading && error && (
                <tr>
                  <td colSpan={7}>
                    <div className="state-box error-box">
                      <AlertTriangle size={32} />
                      <p>{error}</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!loading && !error && displayed.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="state-box">
                      <Users size={32} />
                      <p>No subscriptions match your filters.</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Rows */}
              {!loading && !error && displayed.map((sub, idx) => {
                const usagePct = sub.usage
                  ? Math.round(Object.values(sub.usage).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0) / Math.max(1, Object.keys(sub.usage).length))
                  : 0;

                return (
                  <motion.tr
                    key={sub._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    onClick={() => setSelectedSub(sub)}
                  >
                    <td>
                      <div className="user-cell">
                        <div className="avatar-circle" style={avatarStyle(sub.userName ?? '')}>
                          {initials(sub.userName)}
                        </div>
                        <div>
                          <div className="user-name">{sub.userName ?? '—'}</div>
                          <div className="user-email">{sub.userEmail ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td><PlanBadge name={sub.planName} /></td>
                    <td><StatusBadge status={sub.status} /></td>
                    <td><ExpiryCell dateStr={sub.expiryDate} /></td>
                    <td><UsageBar pct={usagePct} /></td>
                    <td>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>
                        {fmtINR(sub.planMrr)}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="icon-btn" title="View" onClick={() => setSelectedSub(sub)}>
                          <Eye size={13} />
                        </button>
                        <button className="icon-btn danger" title="Cancel" onClick={() => setSelectedSub(sub)}>
                          <XCircle size={13} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {!loading && displayed.length > 0 && (
            <div className="pagination-row">
              <span>
                Page {page} of {pagination?.pages ?? 1} · {pagination?.total ?? displayed.length} total
              </span>
              <div className="pag-btns">
                <button
                  className="pag-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: pagination?.pages ?? 1 }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === (pagination?.pages ?? 1) || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…'
                      ? <span key={i} style={{ padding: '0 4px', fontSize: 12, color: 'oklch(50% 0 0 / .4)' }}>…</span>
                      : <button key={p} className={`pag-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  )}
                <button
                  className="pag-btn"
                  onClick={() => setPage(p => Math.min(pagination?.pages ?? 1, p + 1))}
                  disabled={page >= (pagination?.pages ?? 1)}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plan summary footer */}
        {!loading && rawSubs?.length > 0 && (
          <div className="summary-footer">
            {planChartData
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
              .map((p, i) => {
                const max = planChartData[0]?.count ?? 1;
                return (
                  <motion.div
                    key={p.name}
                    className="sum-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    <div className="sum-label">{p.name} Care</div>
                    <div className="sum-count" style={{ color: p.fill }}>{p.count}</div>
                    <div className="sum-track">
                      <div
                        className="sum-fill"
                        style={{ width: `${Math.round((p.count / max) * 100)}%`, background: p.fill }}
                      />
                    </div>
                    <div className="sum-nums">
                      <span>{p.count} subscribers</span>
                      <span>{Math.round((p.count / (rawSubs?.length || 1)) * 100)}% share</span>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <SubDetailDrawer
        sub={selectedSub}
        onClose={() => setSelectedSub(null)}
        onUpdate={() => load(page)}
      />
    </>
  );
}