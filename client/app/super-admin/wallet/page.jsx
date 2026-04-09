'use client';

/**
 * WalletManagement.jsx — Admin / Superadmin / Finance Dashboard
 *
 * Covers every admin route in walletRouter.js:
 *  ✅ GET  /admin/withdrawals            — paginated queue with status filter
 *  ✅ POST /admin/withdrawals/:id/approve
 *  ✅ POST /admin/withdrawals/:id/complete  ← server initiates Razorpay X payout internally
 *  ✅ POST /admin/withdrawals/:id/reject
 *  ✅ POST /admin/withdrawals/:id/fail
 *  ✅ PATCH /admin/bank-accounts/:wId/:bId/verify
 *
 * FIXES over previous version:
 *  1. CompleteModal — removed razorpayPayoutId input; server handles payout internally.
 *     completeWithdrawal thunk only needs { requestId, walletId }.
 *  2. isAdmin guard — now includes 'finance' role (matches router authorize()).
 *  3. Footer note — corrected to say server initiates the payout, no ID required from admin.
 *  4. Analytics fetch — uses a local axios/API call instead of Redux dispatch to avoid
 *     clobbering the live queue state while the user is reviewing it.
 *  5. Approve button — now asks for confirmation before dispatching.
 */

import {
  useState, useEffect, useCallback, useMemo, memo, useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShieldCheck, BanknoteIcon, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw,
  ChevronDown, Search, X, CheckCheck,
  Loader2, BadgeCheck, Ban, RotateCcw,
  BarChart3, Layers, Crown, CircleDot,
  Activity,
} from 'lucide-react';

import API from '@/store/api';

import {
  fetchAdminWithdrawals,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  failWithdrawal,
  adminVerifyBankAccount,
  selectAdminWithdrawals,
  selectAdminWithdrawalsTotal,
  selectAdminWithdrawalsLoading,
  selectWithdrawalActing,
  selectBankAccountActing,
  clearWalletErrors,
  selectWalletError,
} from '@/store/slices/walletSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0,
  }).format(n ?? 0);

const fmtFull = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(n ?? 0);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtShort = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const fmtCompact = (n) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return fmt(n);
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  Pending:   { color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30',   dot: 'bg-amber-400',   label: 'Pending',   Icon: Clock        },
  Approved:  { color: 'text-sky-400',     bg: 'bg-sky-400/10',     border: 'border-sky-400/30',     dot: 'bg-sky-400',     label: 'Approved',  Icon: CheckCircle2 },
  Completed: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', dot: 'bg-emerald-400', label: 'Completed', Icon: CheckCheck   },
  Failed:    { color: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-400/30',    dot: 'bg-rose-400',    label: 'Failed',    Icon: XCircle      },
  Rejected:  { color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/30',     dot: 'bg-red-400',     label: 'Rejected',  Icon: Ban          },
};

const PIE_COLORS = {
  Pending:   '#fbbf24',
  Approved:  '#38bdf8',
  Completed: '#34d399',
  Failed:    '#fb7185',
  Rejected:  '#f87171',
};

const CHART_AREA_COLOR = 'oklch(55% 0.18 240)';
const CHART_BAR_COLOR  = 'oklch(65% 0.14 180)';

// ─────────────────────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.13 } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 310, damping: 24 } },
  exit:    { opacity: 0, scale: 0.92, transition: { duration: 0.12 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = memo(({ status }) => {
  const m = STATUS_META[status] ?? STATUS_META.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${m.color} ${m.bg} ${m.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${status === 'Pending' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

const Spinner = ({ size = 4 }) => <Loader2 className={`h-${size} w-${size} animate-spin`} />;

const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-base-200">
      <Icon className="h-6 w-6 text-base-content/20" />
    </div>
    <p className="font-bold text-base-content/40 text-sm">{title}</p>
    {sub && <p className="text-[11px] uppercase tracking-widest text-base-content/25">{sub}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Analytics builder (from allRequests fetched independently via API)
// ─────────────────────────────────────────────────────────────────────────────

function useAnalytics(allRequests) {
  return useMemo(() => {
    const statusCount = { Pending: 0, Approved: 0, Completed: 0, Failed: 0, Rejected: 0 };
    let totalVolume = 0, pendingVolume = 0, completedVolume = 0;

    allRequests.forEach(({ request: r }) => {
      if (!r) return;
      statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
      totalVolume   += r.amount ?? 0;
      if (r.status === 'Pending')   pendingVolume   += r.amount ?? 0;
      if (r.status === 'Completed') completedVolume += r.amount ?? 0;
    });

    const pieData = Object.entries(statusCount)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));

    const dayMap = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      dayMap[fmtShort(d)] = { date: fmtShort(d), requests: 0, volume: 0, completed: 0 };
    }

    allRequests.forEach(({ request: r }) => {
      if (!r?.requestedAt) return;
      const k = fmtShort(r.requestedAt);
      if (dayMap[k]) {
        dayMap[k].requests  += 1;
        dayMap[k].volume    += r.amount ?? 0;
        if (r.status === 'Completed') dayMap[k].completed += r.amount ?? 0;
      }
    });

    const dailyData = Object.values(dayMap);

    return {
      statusCount,
      pieData,
      dailyData,
      totalVolume,
      pendingVolume,
      completedVolume,
      totalRequests: allRequests.length,
      successRate: allRequests.length > 0
        ? Math.round((statusCount.Completed / allRequests.length) * 100)
        : 0,
    };
  }, [allRequests]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip for recharts
// ─────────────────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 shadow-xl text-[12px]">
      <p className="font-black text-base-content mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-base-content/60 capitalize">{p.name}:</span>
          <span className="font-bold text-base-content">
            {p.name === 'volume' || p.name === 'completed' ? fmtCompact(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// KPI Stat Cards
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = memo(({ label, value, sub, Icon, color, bg, trend }) => (
  <motion.div variants={fadeUp}
    className="card p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform cursor-default"
  >
    <div className="flex items-start justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-4.5 w-4.5 ${color}`} />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-[11px] font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <p className="text-2xl font-black text-base-content leading-none">{value}</p>
      <p className="text-[11px] text-base-content/40 mt-1 uppercase tracking-wider">{sub}</p>
    </div>
    <p className="text-[12px] font-semibold text-base-content/55">{label}</p>
  </motion.div>
));
KpiCard.displayName = 'KpiCard';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Section
// ─────────────────────────────────────────────────────────────────────────────

const AnalyticsSection = memo(({ analytics }) => {
  const {
    pieData, dailyData, totalVolume, pendingVolume, completedVolume,
    totalRequests, successRate, statusCount,
  } = analytics;

  const kpis = [
    { label: 'Total Withdrawal Volume', value: fmtCompact(totalVolume),    sub: 'All time',     Icon: BanknoteIcon, color: 'text-blue-400',    bg: 'bg-blue-400/10',    trend: 12 },
    { label: 'Pending Requests',         value: statusCount.Pending ?? 0,   sub: `${fmtCompact(pendingVolume)} locked`, Icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', trend: undefined },
    { label: 'Successfully Completed',  value: fmtCompact(completedVolume), sub: `${statusCount.Completed ?? 0} requests`, Icon: CheckCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10', trend: 8 },
    { label: 'Success Rate',            value: `${successRate}%`,           sub: `${totalRequests} total requests`, Icon: Activity, color: 'text-violet-400', bg: 'bg-violet-400/10', trend: successRate > 70 ? 5 : -3 },
  ];

  return (
    <div className="space-y-5">
      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </motion.div>

      <motion.div variants={stagger} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart — 14-day volume */}
        <motion.div variants={fadeUp} className="card col-span-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">14-Day Volume</h3>
            </div>
            <span className="text-[10px] text-base-content/35 uppercase tracking-wider">Last 14 days</span>
          </div>
          <div className="p-4 h-52">
            {dailyData.some(d => d.volume > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CHART_AREA_COLOR} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_AREA_COLOR} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} tickFormatter={v => fmtCompact(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="volume"    name="volume"    stroke={CHART_AREA_COLOR} strokeWidth={2} fill="url(#volGrad)"  dot={false} />
                  <Area type="monotone" dataKey="completed" name="completed" stroke="#34d399"          strokeWidth={2} fill="url(#compGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={BarChart3} title="No data yet" sub="Withdrawal activity will appear here" />
            )}
          </div>
        </motion.div>

        {/* Pie chart — status distribution */}
        <motion.div variants={fadeUp} className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-base-300 px-5 py-4">
            <CircleDot className="h-4 w-4 text-violet-400" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">Status Split</h3>
          </div>
          <div className="p-4 h-52 flex flex-col">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="70%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                      paddingAngle={3} dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#94a3b8'} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length
                        ? <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-[12px] shadow-xl">
                            <p className="font-black text-base-content">{payload[0].name}: <span style={{ color: PIE_COLORS[payload[0].name] }}>{payload[0].value}</span></p>
                          </div>
                        : null
                    } />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 justify-center">
                  {pieData.map(({ name, value }) => (
                    <div key={name} className="flex items-center gap-1 text-[10px]">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[name] }} />
                      <span className="text-base-content/50">{name} ({value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={CircleDot} title="No requests yet" />
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Bar chart — daily request count */}
      <motion.div variants={fadeUp} className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-400" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">Daily Request Count</h3>
          </div>
        </div>
        <div className="p-4 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="requests" name="requests" fill={CHART_BAR_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
});
AnalyticsSection.displayName = 'AnalyticsSection';

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 — CompleteModal: no razorpayPayoutId input.
// The server calls Razorpay X Payout internally and returns the payout ID.
// The admin just needs to confirm the action.
// ─────────────────────────────────────────────────────────────────────────────

const CompleteModal = memo(({ request, walletId, onClose }) => {
  const dispatch = useDispatch();
  const acting   = useSelector(selectWithdrawalActing);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    setErr('');
    try {
      // FIX: only pass requestId + walletId. Server handles Razorpay payout.
      await dispatch(completeWithdrawal({
        requestId: request.requestId,
        walletId,
      })).unwrap();
      onClose();
    } catch (e) {
      setErr(typeof e === 'string' ? e : e?.message || 'Failed to complete withdrawal');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-400/20 bg-base-100 shadow-2xl"
      >
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
        <div className="flex items-center justify-between px-6 py-5 pb-3">
          <div>
            <h2 className="font-black text-lg text-base-content">Complete Withdrawal</h2>
            {/* FIX: accurate description — server initiates payout automatically */}
            <p className="text-[11px] text-base-content/45 mt-0.5">
              The server will initiate the Razorpay X payout automatically.
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Request summary */}
          <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-base-content/45">Amount</span>
              <span className="font-black text-emerald-400">{fmtFull(request.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-base-content/45">Bank Account</span>
              <span className="font-bold text-base-content">
                XXXX{request.accountNumber} · {request.bankName || request.ifscCode}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-base-content/45">Request ID</span>
              <span className="font-mono text-[10px] text-base-content/40">{request.requestId}</span>
            </div>
          </div>

          {/* FIX: informational note instead of payout ID input field */}
          <div className="flex items-start gap-2 rounded-xl bg-sky-400/8 border border-sky-400/15 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-sky-400" />
            <p className="text-[12px] text-sky-400 leading-relaxed">
              Confirming will trigger an IMPS payout via Razorpay X to the user's verified bank account.
              The payout ID will be stored automatically on success.
            </p>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-400/10 border border-rose-400/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <p className="text-[12px] text-rose-400">{err}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-base-300 bg-base-200 py-3 text-[12px] font-bold text-base-content hover:bg-base-300 transition-colors"
            >
              Cancel
            </button>
            <motion.button onClick={handleSubmit} disabled={acting}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-400 py-3 text-[13px] font-black text-emerald-900 hover:bg-emerald-300 transition-all disabled:opacity-50"
            >
              {acting
                ? <><Spinner /> Processing…</>
                : <><CheckCheck className="h-4 w-4" /> Confirm &amp; Pay Out</>
              }
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
CompleteModal.displayName = 'CompleteModal';

// ─────────────────────────────────────────────────────────────────────────────
// Reject / Fail Modal
// ─────────────────────────────────────────────────────────────────────────────

const RejectFailModal = memo(({ request, walletId, mode, onClose }) => {
  const dispatch = useDispatch();
  const acting   = useSelector(selectWithdrawalActing);
  const [reason, setReason] = useState('');
  const [err, setErr]       = useState('');

  const isReject = mode === 'reject';

  const handleSubmit = async () => {
    setErr('');
    try {
      if (isReject) {
        await dispatch(rejectWithdrawal({
          requestId: request.requestId,
          walletId,
          adminNote: reason || undefined,
        })).unwrap();
      } else {
        await dispatch(failWithdrawal({
          requestId:     request.requestId,
          walletId,
          failureReason: reason || 'Payout failed',
        })).unwrap();
      }
      onClose();
    } catch (e) {
      setErr(typeof e === 'string' ? e : e?.message || `Failed to ${mode} withdrawal`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-400/20 bg-base-100 shadow-2xl"
      >
        <div className={`h-1 bg-gradient-to-r ${isReject ? 'from-rose-400 to-red-400' : 'from-orange-400 to-rose-400'}`} />
        <div className="flex items-center justify-between px-6 py-5 pb-3">
          <div>
            <h2 className="font-black text-lg text-base-content">
              {isReject ? 'Reject Withdrawal' : 'Mark as Failed'}
            </h2>
            <p className="text-[11px] text-base-content/45 mt-0.5">
              {isReject
                ? 'Funds will be unlocked and returned to the user\'s available balance.'
                : 'Amount will be reversed to the user\'s wallet with a Withdrawal_Reversal credit.'}
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 flex items-center justify-between text-[12px]">
            <span className="text-base-content/45">Amount to {isReject ? 'unlock' : 'reverse'}</span>
            <span className="font-black text-rose-400">{fmtFull(request.amount)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-base-content/45">
              {isReject ? 'Admin Note' : 'Failure Reason'} (optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-base-300 bg-base-200 px-4 py-3 text-sm text-base-content focus:outline-none focus:border-rose-400 resize-none"
              placeholder={isReject ? 'Reason for rejection…' : 'What caused the payout to fail?'}
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-400/10 border border-rose-400/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <p className="text-[12px] text-rose-400">{err}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-base-300 bg-base-200 py-3 text-[12px] font-bold text-base-content hover:bg-base-300 transition-colors"
            >
              Cancel
            </button>
            <motion.button onClick={handleSubmit} disabled={acting}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-400 py-3 text-[13px] font-black text-white hover:bg-rose-300 transition-all disabled:opacity-50"
            >
              {acting
                ? <><Spinner /> Processing…</>
                : isReject
                  ? <><Ban className="h-4 w-4" /> Reject</>
                  : <><XCircle className="h-4 w-4" /> Mark Failed</>
              }
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
RejectFailModal.displayName = 'RejectFailModal';

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5 — ApproveConfirmModal: guard against accidental approve clicks
// ─────────────────────────────────────────────────────────────────────────────

const ApproveConfirmModal = memo(({ request, walletId, onClose }) => {
  const dispatch = useDispatch();
  const acting   = useSelector(selectWithdrawalActing);
  const [err, setErr] = useState('');

  const handleApprove = async () => {
    setErr('');
    try {
      await dispatch(approveWithdrawal({ requestId: request.requestId, walletId })).unwrap();
      onClose();
    } catch (e) {
      setErr(typeof e === 'string' ? e : e?.message || 'Failed to approve withdrawal');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-sky-400/20 bg-base-100 shadow-2xl"
      >
        <div className="h-1 bg-gradient-to-r from-sky-400 to-blue-400" />
        <div className="flex items-center justify-between px-6 py-5 pb-3">
          <div>
            <h2 className="font-black text-lg text-base-content">Approve Withdrawal</h2>
            <p className="text-[11px] text-base-content/45 mt-0.5">
              Status will change to Approved. Payout is triggered separately via Complete.
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-base-content/45">Amount</span>
              <span className="font-black text-sky-400">{fmtFull(request.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-base-content/45">Account Holder</span>
              <span className="font-bold text-base-content">{request.accountHolderName}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-base-content/45">Request ID</span>
              <span className="font-mono text-[10px] text-base-content/40">{request.requestId}</span>
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-400/10 border border-rose-400/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <p className="text-[12px] text-rose-400">{err}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-base-300 bg-base-200 py-3 text-[12px] font-bold text-base-content hover:bg-base-300 transition-colors"
            >
              Cancel
            </button>
            <motion.button onClick={handleApprove} disabled={acting}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-400 py-3 text-[13px] font-black text-sky-900 hover:bg-sky-300 transition-all disabled:opacity-50"
            >
              {acting
                ? <><Spinner /> Approving…</>
                : <><CheckCircle2 className="h-4 w-4" /> Approve</>
              }
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
ApproveConfirmModal.displayName = 'ApproveConfirmModal';

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Row
// ─────────────────────────────────────────────────────────────────────────────

const WithdrawalRow = memo(({ item, onApprove, onComplete, onReject, onFail }) => {
  const acting = useSelector(selectWithdrawalActing);
  const [expanded, setExpanded] = useState(false);
  const { walletId, request: r } = item;
  if (!r) return null;

  const m = STATUS_META[r.status] ?? STATUS_META.Pending;

  return (
    <motion.div layout variants={fadeUp}
      className={`rounded-2xl border transition-all ${expanded ? 'border-primary/30 shadow-md' : 'border-base-300'} bg-base-100 overflow-hidden`}
    >
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.bg}`}>
          <m.Icon className={`h-4 w-4 ${m.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-black text-base-content">{fmtFull(r.amount)}</span>
            <StatusBadge status={r.status} />
          </div>
          <p className="text-[11px] text-base-content/40 mt-0.5 truncate">
            XXXX{r.accountNumber} · {r.bankName || r.ifscCode} · {fmtDate(r.requestedAt)}
          </p>
        </div>

        {/* FIX 5: Pending actions now open confirm modals */}
        {r.status === 'Pending' && (
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <motion.button
              onClick={() => onApprove(item)}
              disabled={acting}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              title="Approve"
              className="flex items-center gap-1 rounded-lg bg-sky-400/15 px-3 py-1.5 text-[11px] font-bold text-sky-400 hover:bg-sky-400/25 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-3 w-3" /> Approve
            </motion.button>
            <button
              onClick={() => onReject(item)}
              disabled={acting}
              className="flex items-center gap-1 rounded-lg bg-rose-400/15 px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-400/25 transition-colors disabled:opacity-50"
            >
              <Ban className="h-3 w-3" /> Reject
            </button>
          </div>
        )}

        {r.status === 'Approved' && (
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onComplete(item)}
              disabled={acting}
              className="flex items-center gap-1 rounded-lg bg-emerald-400/15 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-400/25 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3 w-3" /> Complete
            </button>
            <button
              onClick={() => onFail(item)}
              disabled={acting}
              className="flex items-center gap-1 rounded-lg bg-orange-400/15 px-3 py-1.5 text-[11px] font-bold text-orange-400 hover:bg-orange-400/25 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" /> Fail
            </button>
          </div>
        )}

        <ChevronDown className={`h-4 w-4 text-base-content/30 transition-transform shrink-0 ml-1 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-base-300 px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {[
                { label: 'Request ID',       value: r.requestId,                                    mono: true },
                { label: 'Account Holder',   value: r.accountHolderName                                        },
                { label: 'IFSC Code',        value: r.ifscCode,                                     mono: true },
                { label: 'Wallet ID',        value: walletId,                                       mono: true },
                { label: 'Requested At',     value: fmtDate(r.requestedAt)                                     },
                ...(r.completedAt   ? [{ label: 'Completed At',   value: fmtDate(r.completedAt)               }] : []),
                ...(r.reviewedBy    ? [{ label: 'Reviewed By',    value: String(r.reviewedBy),      mono: true }] : []),
                ...(r.adminNote     ? [{ label: 'Admin Note',     value: r.adminNote                           }] : []),
                ...(r.failureReason ? [{ label: 'Failure Reason', value: r.failureReason                        }] : []),
                ...(r.razorpayPayoutId   ? [{ label: 'Payout ID',        value: r.razorpayPayoutId,   mono: true }] : []),
                ...(r.razorpayPayoutStatus ? [{ label: 'Payout Status',  value: r.razorpayPayoutStatus           }] : []),
                ...(r.retryCount > 0      ? [{ label: 'Retry Count',     value: String(r.retryCount)             }] : []),
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="text-[10px] text-base-content/35 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className={`text-[12px] font-semibold text-base-content break-all ${mono ? 'font-mono' : ''}`}>
                    {value ?? '—'}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
WithdrawalRow.displayName = 'WithdrawalRow';

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawals Queue Panel
// ─────────────────────────────────────────────────────────────────────────────

const WithdrawalsQueue = memo(() => {
  const dispatch = useDispatch();
  const requests = useSelector(selectAdminWithdrawals);
  const total    = useSelector(selectAdminWithdrawalsTotal);
  const loading  = useSelector(selectAdminWithdrawalsLoading);
  const error    = useSelector(selectWalletError);

  const [status,         setStatus]         = useState('Pending');
  const [page,           setPage]           = useState(1);
  const [search,         setSearch]         = useState('');

  // FIX 5: separate modal state for approve (was firing directly before)
  const [approveTarget,  setApproveTarget]  = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [rejectTarget,   setRejectTarget]   = useState(null);
  const [failTarget,     setFailTarget]     = useState(null);

  useEffect(() => {
    dispatch(fetchAdminWithdrawals({ status, page, limit: 15 }));
  }, [dispatch, status, page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(({ request: r }) =>
      r?.requestId?.toLowerCase().includes(q) ||
      r?.accountHolderName?.toLowerCase().includes(q) ||
      r?.accountNumber?.includes(q) ||
      r?.bankName?.toLowerCase().includes(q)
    );
  }, [requests, search]);

  const handleStatusChange = (s) => { setStatus(s); setPage(1); };

  return (
    <motion.div variants={fadeUp} className="card overflow-hidden">
      {/* Panel header */}
      <div className="border-b border-base-300 bg-base-100/60 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BanknoteIcon className="h-4 w-4 text-amber-400" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">Withdrawal Queue</h3>
            {total > 0 && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-400">{total}</span>
            )}
          </div>
          <button
            onClick={() => dispatch(fetchAdminWithdrawals({ status, page, limit: 15 }))}
            className="rounded-xl p-2 text-base-content/30 hover:text-base-content hover:bg-base-200 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-base-200 p-1 no-scrollbar">
          {['Pending', 'Approved', 'Completed', 'Failed', 'Rejected'].map(s => {
            const m = STATUS_META[s];
            return (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={`flex shrink-0 items-center gap-1.5 rounded-[calc(0.75rem-3px)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all ${
                  status === s ? `bg-base-100 ${m.color} shadow-sm` : 'text-base-content/40 hover:text-base-content'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                {s}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-content/30" />
          <input
            className="w-full rounded-xl border border-base-300 bg-base-200 pl-9 pr-4 py-2.5 text-[12px] text-base-content focus:outline-none focus:border-primary placeholder:text-base-content/30"
            placeholder="Search by ID, name, account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 border-b border-rose-400/20 bg-rose-400/8 px-5 py-3"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <p className="flex-1 text-[12px] text-rose-400">{error}</p>
            <button onClick={() => dispatch(clearWalletErrors())} className="text-rose-400/50 hover:text-rose-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="p-4 space-y-2.5 min-h-[300px]">
        {loading && filtered.length === 0 ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-base-300" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={BanknoteIcon} title={`No ${status.toLowerCase()} requests`} sub="Queue is empty" />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
            {filtered.map((item) => (
              <WithdrawalRow
                key={item.request?.requestId ?? Math.random()}
                item={item}
                onApprove={setApproveTarget}
                onComplete={setCompleteTarget}
                onReject={setRejectTarget}
                onFail={setFailTarget}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length < total && (
        <div className="border-t border-base-300 p-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-base-content/40">
            Showing {filtered.length} of {total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
              className="rounded-xl border border-base-300 bg-base-200 px-4 py-2 text-[11px] font-bold text-base-content disabled:opacity-40 hover:bg-base-300 transition-colors"
            >Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={loading}
              className="rounded-xl border border-base-300 bg-base-200 px-4 py-2 text-[11px] font-bold text-base-content disabled:opacity-40 hover:bg-base-300 transition-colors"
            >Next · {total - filtered.length} more</button>
          </div>
        </div>
      )}

      {/* Action modals */}
      <AnimatePresence>
        {approveTarget && (
          <ApproveConfirmModal
            request={approveTarget.request}
            walletId={approveTarget.walletId}
            onClose={() => setApproveTarget(null)}
          />
        )}
        {completeTarget && (
          <CompleteModal
            request={completeTarget.request}
            walletId={completeTarget.walletId}
            onClose={() => setCompleteTarget(null)}
          />
        )}
        {rejectTarget && (
          <RejectFailModal
            request={rejectTarget.request}
            walletId={rejectTarget.walletId}
            mode="reject"
            onClose={() => setRejectTarget(null)}
          />
        )}
        {failTarget && (
          <RejectFailModal
            request={failTarget.request}
            walletId={failTarget.walletId}
            mode="fail"
            onClose={() => setFailTarget(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});
WithdrawalsQueue.displayName = 'WithdrawalsQueue';

// ─────────────────────────────────────────────────────────────────────────────
// Bank Verification Panel
// ─────────────────────────────────────────────────────────────────────────────

const BankVerifyPanel = memo(() => {
  const dispatch = useDispatch();
  const acting   = useSelector(selectBankAccountActing);

  const [walletId,  setWalletId]  = useState('');
  const [bankAccId, setBankAccId] = useState('');
  const [fundAccId, setFundAccId] = useState('');
  const [contactId, setContactId] = useState('');
  const [success,   setSuccess]   = useState(false);
  const [err,       setErr]       = useState('');

  const handleVerify = async () => {
    if (!walletId.trim() || !bankAccId.trim()) {
      setErr('Wallet ID and Bank Account ID are required');
      return;
    }
    setErr(''); setSuccess(false);
    try {
      await dispatch(adminVerifyBankAccount({
        walletId:              walletId.trim(),
        bankAccountId:         bankAccId.trim(),
        razorpayFundAccountId: fundAccId.trim() || undefined,
        razorpayContactId:     contactId.trim() || undefined,
      })).unwrap();
      setSuccess(true);
      setWalletId(''); setBankAccId(''); setFundAccId(''); setContactId('');
    } catch (e) {
      setErr(typeof e === 'string' ? e : e?.message || 'Verification failed');
    }
  };

  return (
    <motion.div variants={fadeUp} className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-base-300 bg-base-100/60 px-5 py-4">
        <BadgeCheck className="h-4 w-4 text-emerald-400" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">Bank Account Verification</h3>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[12px] text-base-content/45 leading-relaxed">
          After penny-drop or manual verification, mark a user's bank account as verified and optionally
          store the Razorpay Fund Account ID (required before a payout can be processed via Complete).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Wallet ID *',          key: 'walletId',  val: walletId,  set: setWalletId,  placeholder: 'MongoDB ObjectId' },
            { label: 'Bank Account ID *',    key: 'bankAccId', val: bankAccId, set: setBankAccId, placeholder: 'MongoDB ObjectId' },
            { label: 'Razorpay Fund Acc ID', key: 'fundAccId', val: fundAccId, set: setFundAccId, placeholder: 'fa_... (required for payouts)' },
            { label: 'Razorpay Contact ID',  key: 'contactId', val: contactId, set: setContactId, placeholder: 'cont_... (optional)' },
          ].map(({ label, key, val, set, placeholder }) => (
            <div key={key}>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-base-content/40">{label}</label>
              <input
                className="w-full rounded-xl border border-base-300 bg-base-200 px-4 py-2.5 text-[12px] font-mono text-base-content focus:outline-none focus:border-emerald-400 placeholder:text-base-content/25"
                placeholder={placeholder}
                value={val}
                onChange={e => set(e.target.value)}
              />
            </div>
          ))}
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-400/10 border border-rose-400/20 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <p className="text-[12px] text-rose-400">{err}</p>
          </div>
        )}

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 px-3 py-2.5"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-[12px] text-emerald-400 font-semibold">Bank account verified successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button onClick={handleVerify} disabled={acting}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-400 py-3 text-[13px] font-black text-emerald-900 hover:bg-emerald-300 transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(52,211,153,0.3)]"
        >
          {acting ? <><Spinner /> Verifying…</> : <><BadgeCheck className="h-4 w-4" /> Verify Bank Account</>}
        </motion.button>
      </div>
    </motion.div>
  );
});
BankVerifyPanel.displayName = 'BankVerifyPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Tab Bar
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'queue',  label: 'Withdrawal Queue', Icon: BanknoteIcon },
  { key: 'verify', label: 'Bank Verify',       Icon: BadgeCheck  },
];

const TabBar = memo(({ active, onChange }) => (
  <div className="flex gap-1 rounded-xl bg-base-200 p-1" role="tablist">
    {TABS.map(({ key, label, Icon }) => (
      <button key={key} role="tab" aria-selected={active === key} onClick={() => onChange(key)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-[calc(0.75rem-3px)] py-2.5 text-[11px] font-bold uppercase tracking-wide transition-all ${
          active === key ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/40 hover:text-base-content'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    ))}
  </div>
));
TabBar.displayName = 'TabBar';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function WalletManagement() {
  const dispatch  = useDispatch();
  const user      = useSelector((s) => s.user?.user) ?? null;
  const requests  = useSelector(selectAdminWithdrawals);
  const loading   = useSelector(selectAdminWithdrawalsLoading);

  const [activeTab,     setActiveTab]     = useState('queue');
  const [showAnalytics, setShowAnalytics] = useState(true);

  // FIX 4: fetch analytics data via API directly to avoid clobbering Redux
  // queue state while the admin is actively reviewing it.
  const [allRequests,    setAllRequests]    = useState([]);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAnalytics = async () => {
      const results = [];
      for (const s of ['Pending', 'Approved', 'Completed', 'Failed', 'Rejected']) {
        try {
          const { data } = await API.get('/wallet/admin/withdrawals', {
            params: { status: s, page: 1, limit: 100 },
          });
          if (!cancelled) results.push(...(data.withdrawals ?? []));
        } catch {
          // silent — analytics are best-effort
        }
      }
      if (!cancelled) {
        setAllRequests(results);
        setAnalyticsReady(true);
      }
    };

    fetchAnalytics();
    return () => { cancelled = true; };
  }, []);

  // Merge live queue updates into analytics without re-fetching all statuses
  useEffect(() => {
    if (!analyticsReady) return;
    setAllRequests(prev => {
      const map = new Map(prev.map(r => [r.request?.requestId, r]));
      requests.forEach(r => { if (r.request?.requestId) map.set(r.request.requestId, r); });
      return Array.from(map.values());
    });
  }, [requests, analyticsReady]);

  const analytics = useAnalytics(allRequests);

  // FIX 2: include 'finance' role — matches router authorize('admin','superadmin','finance')
  const hasAccess = ['admin', 'superadmin', 'finance'].includes(user?.role);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-400/10 mx-auto">
            <ShieldCheck className="h-7 w-7 text-rose-400" />
          </div>
          <p className="font-black text-xl text-base-content">Access Denied</p>
          <p className="text-sm text-base-content/45">
            This page is restricted to Admin, Superadmin, and Finance roles.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 py-8">
      <div className="mx-auto w-full max-w-[72rem] px-4 sm:px-6">
        <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-6">

          {/* ── Page Header ── */}
          <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-[0_4px_16px_rgba(59,130,246,0.4)]">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                {user?.role === 'superadmin' && (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/25 px-3 py-1">
                    <Crown className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Superadmin</span>
                  </div>
                )}
                {user?.role === 'finance' && (
                  <div className="flex items-center gap-1.5 rounded-full bg-teal-400/15 border border-teal-400/25 px-3 py-1">
                    <BanknoteIcon className="h-3 w-3 text-teal-400" />
                    <span className="text-[10px] font-black text-teal-400 uppercase tracking-wider">Finance</span>
                  </div>
                )}
              </div>
              <h1
                className="font-black text-base-content tracking-tighter leading-none"
                style={{ fontSize: 'clamp(1.6rem,5vw,2.5rem)', fontFamily: 'var(--font-family-montserrat, sans-serif)' }}
              >
                Wallet Management
              </h1>
              <p className="mt-1.5 text-sm text-base-content/45">
                Likeson Healthcare · Platform Finance Dashboard ·
                <span className="ml-1 font-semibold text-base-content/60">{user?.name}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAnalytics(v => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-all ${
                  showAnalytics
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-base-300 bg-base-200 text-base-content/50'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
              <button
                onClick={() => dispatch(fetchAdminWithdrawals({ status: 'Pending', page: 1, limit: 15 }))}
                className="flex items-center gap-1.5 rounded-xl border border-base-300 bg-base-200 px-3 py-2 text-[11px] font-bold text-base-content/60 hover:text-base-content transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </motion.div>

          {/* ── Analytics ── */}
          <AnimatePresence>
            {showAnalytics && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <AnalyticsSection analytics={analytics} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tabs + Content ── */}
          <motion.div variants={fadeUp} className="space-y-4">
            <TabBar active={activeTab} onChange={setActiveTab} />

            <AnimatePresence mode="wait">
              {activeTab === 'queue' && (
                <motion.div key="queue"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.15 }}
                >
                  <WithdrawalsQueue />
                </motion.div>
              )}
              {activeTab === 'verify' && (
                <motion.div key="verify"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.15 }}
                >
                  <BankVerifyPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Footer note ── */}
          {/* FIX 3: corrected description — server initiates payout, no ID required from admin */}
          <motion.div variants={fadeUp}
            className="flex items-start gap-3 rounded-xl border border-blue-400/15 bg-blue-400/5 p-4"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
            <p className="text-[12px] leading-relaxed text-base-content/50">
              All withdrawal actions are audit-logged.{' '}
              <strong className="text-base-content/65">Approve</strong> moves status to Approved.{' '}
              <strong className="text-base-content/65">Complete</strong> triggers the Razorpay X payout
              automatically on the server — no manual payout ID is needed.{' '}
              <strong className="text-base-content/65">Reject</strong> or{' '}
              <strong className="text-base-content/65">Fail</strong> releases the locked funds back
              to the user's available balance.
            </p>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}