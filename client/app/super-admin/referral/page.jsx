'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Gift, Users, TrendingUp, Trophy, Coins, Search,
  ChevronLeft, ChevronRight, Eye, X, Award, Zap,
  RefreshCw, AlertCircle, CheckCircle2, Clock, Crown,
  Wallet, ArrowUpRight, ArrowDownRight, Star, Filter,
  BarChart2, PieChart as PieIcon, Activity, User,
  Send, Loader2, Shield, BadgeCheck,
} from 'lucide-react';

import {
  adminGetReferralOverview,
  adminGetLeaderboard,
  adminGetUserReferralDetail,
  adminGetReferralTransactions,
  adminManualAward,
  clearAdminUserDetail,
  clearReferralError,
} from '@/store/slices/referralSlice';

// ─── Framer variants ──────────────────────────────────────────────────────────

const pageVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

const slideVariants = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x:   0, transition: { type: 'spring', stiffness: 300, damping: 28 } },
};

const fadeVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden:  { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1,    y:  0, transition: { type: 'spring', stiffness: 340, damping: 26 } },
  exit:    { opacity: 0, scale: 0.94, y: 10, transition: { duration: 0.18 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = {
  coins:   (n) => Number(n || 0).toLocaleString('en-IN'),
  rupees:  (n) => `₹${Number(n || 0).toFixed(2)}`,
  percent: (n) => `${Number(n || 0).toFixed(1)}%`,
  date:    (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  time:    (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—',
};

const ROLES_COLOR = {
  customer:         'bg-info/10 text-info border-info/25',
  doctor:           'bg-success/10 text-success border-success/25',
  pharmacy:         'bg-warning/10 text-warning border-warning/25',
  driver:           'bg-accent/10 text-accent border-accent/25',
  'care assistant': 'bg-secondary/10 text-secondary border-secondary/25',
  admin:            'bg-error/10 text-error border-error/25',
  superadmin:       'bg-primary/10 text-primary border-primary/25',
  default:          'bg-neutral/10 text-neutral-content border-neutral/25',
};

const getRoleBadge = (role) =>
  ROLES_COLOR[role] || ROLES_COLOR.default;

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color = 'primary', trend }) => (
  <motion.div variants={cardVariants} className="card p-5 relative overflow-hidden group">
    <div className={`absolute inset-0 bg-${color}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black text-${color} font-montserrat`}>{value}</p>
        {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl bg-${color}/10 flex items-center justify-center ring-1 ring-${color}/20`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
    </div>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-3 text-xs font-bold ${trend >= 0 ? 'text-success' : 'text-error'}`}>
        {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        {Math.abs(trend)}% vs last 30d
      </div>
    )}
  </motion.div>
);

// ─── Pulsing Loader ───────────────────────────────────────────────────────────

const PulseLoader = ({ label = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="relative w-14 h-14">
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/30"
        animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/50"
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, delay: 0.3 }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    </div>
    <p className="text-sm text-base-content/50 font-medium">{label}</p>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ icon: Icon = AlertCircle, message = 'No data found.' }) => (
  <motion.div variants={fadeVariants} initial="hidden" animate="visible"
    className="flex flex-col items-center justify-center py-16 gap-3 text-base-content/40">
    <Icon className="w-10 h-10" />
    <p className="text-sm font-medium">{message}</p>
  </motion.div>
);

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination = ({ page, pages, onPage }) => (
  <div className="flex items-center justify-between mt-5 px-1">
    <p className="text-xs text-base-content/40 font-medium">Page {page} of {pages}</p>
    <div className="flex gap-2">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-base-300 text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-base-300 text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-200 border border-base-300 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-base-content mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-base-content/70">{p.name}:</span>
          <span className="font-bold text-base-content">{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
};

// ─── User Detail Modal ────────────────────────────────────────────────────────

const UserDetailModal = ({ detail, onClose, isSuperadmin }) => {
  const dispatch = useDispatch();
  const [awardCoins, setAwardCoins]   = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awarding, setAwarding]       = useState(false);

  const handleAward = async () => {
    const coins = parseInt(awardCoins, 10);
    if (!coins || coins < 1 || !awardReason.trim()) return;
    setAwarding(true);
    await dispatch(adminManualAward({ userId: detail.user._id, coins, reason: awardReason.trim() }));
    setAwarding(false);
    setAwardCoins('');
    setAwardReason('');
  };

  if (!detail) return null;
  const { user, referralSummary, walletSummary, referredBy, referrals } = detail;

  return (
    <AnimatePresence>
      <motion.div key="backdrop"
        className="fixed inset-0 z-50 bg-base-100/70 backdrop-blur-md flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}>
        <motion.div
          variants={modalVariants} initial="hidden" animate="visible" exit="exit"
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-base-100 border border-base-300 rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="sticky top-0 z-10 bg-base-100/95 backdrop-blur border-b border-base-300 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-primary/30">
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`; }} />
              </div>
              <div>
                <p className="font-black text-base-content text-sm font-montserrat">{user.name}</p>
                <p className="text-xs text-base-content/50">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge text-xs border ${getRoleBadge(user.role)}`}>{user.role}</span>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-base-300 text-base-content/50 hover:text-base-content transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Coins',    value: fmt.coins(referralSummary?.currentCoins),        icon: Coins,      color: 'warning' },
                { label: 'Wallet Balance', value: fmt.rupees(walletSummary?.balance),               icon: Wallet,     color: 'success' },
                { label: 'Completed',      value: referralSummary?.completedReferrals ?? 0,         icon: CheckCircle2, color: 'primary' },
                { label: 'Pending',        value: referralSummary?.pendingReferrals ?? 0,           icon: Clock,      color: 'warning' },
              ].map((s) => (
                <div key={s.label} className="bg-base-200 rounded-xl p-3 text-center">
                  <s.icon className={`w-4 h-4 text-${s.color} mx-auto mb-1`} />
                  <p className={`text-lg font-black text-${s.color} font-montserrat`}>{s.value}</p>
                  <p className="text-xs text-base-content/50">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Referral info */}
            <div className="bg-base-200 rounded-xl p-4 space-y-2 text-sm">
              <p className="font-bold text-base-content/70 text-xs uppercase tracking-widest mb-2">Referral Info</p>
              <div className="flex justify-between">
                <span className="text-base-content/50">Referral Code</span>
                <span className="font-mono font-bold text-primary">{user.referralCode || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">Referred By</span>
                <span className="font-semibold text-base-content">{referredBy ? `${referredBy.name} (${referredBy.referralCode})` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">Member Since</span>
                <span className="font-semibold text-base-content">{fmt.date(user.createdAt)}</span>
              </div>
            </div>

            {/* Referral list */}
            {(referrals?.completed?.length > 0 || referrals?.pending?.length > 0) && (
              <div>
                <p className="font-bold text-base-content/70 text-xs uppercase tracking-widest mb-3">Referrals</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {[...(referrals.completed || []), ...(referrals.pending || [])].map((r) => (
                    <div key={r._id} className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${r.status === 'completed' ? 'bg-success' : 'bg-warning'}`} />
                        <div>
                          <p className="text-xs font-semibold text-base-content">{r.referredUserName}</p>
                          <p className="text-xs text-base-content/40">{r.referredUserEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-warning">{fmt.coins(r.pointsAwarded)} coins</p>
                        <p className={`text-xs ${r.status === 'completed' ? 'text-success' : 'text-warning'}`}>{r.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Award — superadmin only */}
            {isSuperadmin && (
              <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <p className="font-bold text-sm text-primary">Manual Coin Award</p>
                  <span className="badge text-xs border bg-primary/10 text-primary border-primary/25 ml-auto">Superadmin</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="1" placeholder="Coins to award"
                    value={awardCoins} onChange={(e) => setAwardCoins(e.target.value)}
                    className="input-field text-sm w-full" />
                  <input type="text" placeholder="Reason (required)"
                    value={awardReason} onChange={(e) => setAwardReason(e.target.value)}
                    className="input-field text-sm w-full" />
                </div>
                <button onClick={handleAward}
                  disabled={awarding || !awardCoins || !awardReason.trim()}
                  className="btn-primary-cta w-full flex items-center justify-center gap-2 text-xs py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  {awarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {awarding ? 'Awarding…' : 'Award Coins + Credit Wallet'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AdminReferralManagement() {
  const dispatch    = useDispatch();
  const user        = useSelector((state) => state.user?.user) ?? null;
  const isSuperadmin = user?.role === 'superadmin';

  const {
    adminOverview,
    adminLeaderboard,
    adminUserDetail,
    adminTransactions,
    loaders,
    error,
  } = useSelector((state) => state.referral);

  // ── Local state ────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState('overview');
  const [lbPage,          setLbPage]          = useState(1);
  const [txPage,          setTxPage]          = useState(1);
  const [searchUser,      setSearchUser]      = useState('');
  const [selectedUserId,  setSelectedUserId]  = useState(null);
  const [chartType,       setChartType]       = useState('area'); // 'area' | 'bar'

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(adminGetReferralOverview());
    dispatch(adminGetLeaderboard({ page: 1, limit: 20 }));
    if (isSuperadmin) dispatch(adminGetReferralTransactions({ page: 1, limit: 20 }));
  }, [dispatch, isSuperadmin]);

  // ── Leaderboard pagination ─────────────────────────────────────────────────
  const handleLbPage = useCallback((p) => {
    const pages = adminLeaderboard?.pagination?.pages ?? 1;
    if (p < 1 || p > pages) return;
    setLbPage(p);
    dispatch(adminGetLeaderboard({ page: p, limit: 20 }));
  }, [dispatch, adminLeaderboard?.pagination?.pages]);

  // ── Transaction pagination ─────────────────────────────────────────────────
  const handleTxPage = useCallback((p) => {
    const pages = adminTransactions?.pagination?.pages ?? 1;
    if (p < 1 || p > pages) return;
    setTxPage(p);
    dispatch(adminGetReferralTransactions({ page: p, limit: 20 }));
  }, [dispatch, adminTransactions?.pagination?.pages]);

  // ── Open user detail ───────────────────────────────────────────────────────
  const openUserDetail = useCallback((userId) => {
    setSelectedUserId(userId);
    dispatch(adminGetUserReferralDetail(userId));
  }, [dispatch]);

  // ── Close modal ────────────────────────────────────────────────────────────
  const closeModal = useCallback(() => {
    setSelectedUserId(null);
    dispatch(clearAdminUserDetail());
  }, [dispatch]);

  // ── Chart data from leaderboard (top 8 referrers) ─────────────────────────
  const chartData = (adminLeaderboard?.data ?? [])
    .slice(0, 8)
    .map((u) => ({
      name:       u.name?.split(' ')[0] ?? 'User',
      referrals:  u.successfulReferrals ?? 0,
      coins:      u.totalCoinsEarned ?? 0,
    }));

  // ── Pie data ───────────────────────────────────────────────────────────────
  const ov = adminOverview;
  const pieData = ov ? [
    { name: 'Completed', value: ov.completedReferrals ?? 0,  fill: 'var(--success)' },
    { name: 'Pending',   value: ov.pendingReferrals   ?? 0,  fill: 'var(--warning)' },
  ] : [];

  // ── Filtered leaderboard by search ────────────────────────────────────────
  const filteredLeaderboard = (adminLeaderboard?.data ?? []).filter((u) => {
    const q = searchUser.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  // ── Tabs config ────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'overview',     label: 'Overview',     icon: Activity },
    { key: 'leaderboard',  label: 'Leaderboard',  icon: Trophy },
    { key: 'analytics',    label: 'Analytics',    icon: BarChart2 },
    ...(isSuperadmin ? [{ key: 'transactions', label: 'Transactions', icon: Wallet }] : []),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 font-poppins">

      {/* ── Background mesh ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-secondary/5 blur-3xl"
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page header ── */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible"
          className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Platform Management</p>
                <h1 className="text-2xl font-black text-base-content font-montserrat leading-none">
                  Referral & Coins
                </h1>
              </div>
              {isSuperadmin && (
                <span className="badge text-xs border bg-primary/10 text-primary border-primary/25 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Superadmin
                </span>
              )}
            </div>
            <p className="text-sm text-base-content/50">
              Monitor invites, coin economy, leaderboard, and referral transactions.
            </p>
          </div>
          <button
            onClick={() => {
              dispatch(adminGetReferralOverview());
              dispatch(adminGetLeaderboard({ page: lbPage, limit: 20 }));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-base-300 text-sm font-semibold text-base-content/70 hover:border-primary hover:text-primary transition-all">
            <RefreshCw className={`w-4 h-4 ${loaders.adminOverview ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </motion.div>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit"
              className="alert alert-error mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error" />
                <span className="text-sm text-base-content">{error}</span>
              </div>
              <button onClick={() => dispatch(clearReferralError())} className="hover:text-error transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-8 bg-base-200 rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                ${activeTab === tab.key
                  ? 'bg-base-100 text-primary shadow-sm ring-1 ring-base-300'
                  : 'text-base-content/50 hover:text-base-content'}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════
            TAB: OVERVIEW
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" variants={pageVariants} initial="hidden" animate="visible" exit="exit">

              {loaders.adminOverview && !ov ? (
                <PulseLoader label="Loading platform overview…" />
              ) : ov ? (
                <>
                  {/* Stat grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard icon={Users}      label="Total Invites"        value={fmt.coins(ov.totalInvites)}            color="primary"   />
                    <StatCard icon={CheckCircle2} label="Completed"           value={fmt.coins(ov.completedReferrals)}      color="success"   />
                    <StatCard icon={Clock}       label="Pending"              value={fmt.coins(ov.pendingReferrals)}        color="warning"   />
                    <StatCard icon={Activity}    label="Conversion Rate"      value={fmt.percent(ov.conversionRate)}        color="info"      />
                    <StatCard icon={Coins}       label="Total Coins Awarded"  value={fmt.coins(ov.totalCoinsAwarded)}       color="warning"   />
                    <StatCard icon={Wallet}      label="Rupees Distributed"   value={fmt.rupees(ov.totalRupeesDistributed)} color="success"   />
                    <StatCard icon={TrendingUp}  label="New (Last 30d)"       value={fmt.coins(ov.recentCompleted30d)}      color="primary"   />
                    <StatCard icon={Star}        label="Active Referrers"     value={fmt.coins(ov.activeReferrers)}         color="secondary" />
                  </div>

                  {/* Reward config card */}
                  <motion.div variants={cardVariants}
                    className="card p-5 mb-6 bg-gradient-to-r from-primary/5 via-base-100 to-secondary/5 border-primary/20">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-4">
                      Platform Reward Configuration
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Coins per Referral',   value: fmt.coins(ov.coinsPerReferral),  icon: Gift,   color: 'primary' },
                        { label: 'Referee Bonus',         value: fmt.coins(ov.refereeBonus),      icon: Award,  color: 'success' },
                        { label: 'Coins → ₹1',           value: '100 coins',                      icon: Coins,  color: 'warning' },
                        { label: 'Min Redeem',            value: '500 coins',                      icon: Zap,    color: 'info'    },
                      ].map((c) => (
                        <div key={c.label}
                          className={`flex items-center gap-3 p-3 rounded-xl bg-${c.color}/8 border border-${c.color}/20`}>
                          <c.icon className={`w-5 h-5 text-${c.color} shrink-0`} />
                          <div>
                            <p className={`text-base font-black text-${c.color} font-montserrat leading-none`}>{c.value}</p>
                            <p className="text-xs text-base-content/50 mt-0.5">{c.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Pie chart + conversion info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <motion.div variants={cardVariants} className="card p-5">
                      <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-4">
                        Invite Status Distribution
                      </p>
                      {pieData.every((d) => d.value === 0) ? (
                        <EmptyState message="No referral data yet." />
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                              dataKey="value" nameKey="name" paddingAngle={4}>
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                            <Legend iconType="circle" iconSize={8}
                              formatter={(v) => <span className="text-xs text-base-content/70 font-medium">{v}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </motion.div>

                    <motion.div variants={cardVariants} className="card p-5 flex flex-col justify-between">
                      <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-4">
                        Platform Health
                      </p>
                      <div className="space-y-4">
                        {[
                          { label: 'Conversion Rate',     value: ov.conversionRate ?? 0,   max: 100,  color: 'primary', unit: '%' },
                          { label: 'Completion Rate (30d)', value: Math.min((ov.recentCompleted30d / Math.max(ov.totalInvites, 1)) * 100, 100), max: 100, color: 'success', unit: '%' },
                          { label: 'Active Referrers',    value: Math.min((ov.activeReferrers / Math.max(ov.totalInvites, 1)) * 100, 100), max: 100, color: 'secondary', unit: '%' },
                        ].map((m) => (
                          <div key={m.label}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-semibold text-base-content/70">{m.label}</span>
                              <span className={`font-bold text-${m.color}`}>{m.value.toFixed(1)}{m.unit}</span>
                            </div>
                            <div className="h-2 bg-base-300 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full bg-${m.color}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(m.value, 100)}%` }}
                                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${
                        (ov.conversionRate ?? 0) >= 50
                          ? 'bg-success/10 text-success border border-success/20'
                          : (ov.conversionRate ?? 0) >= 25
                          ? 'bg-warning/10 text-warning border border-warning/20'
                          : 'bg-error/10 text-error border border-error/20'
                      }`}>
                        <BadgeCheck className="w-4 h-4 shrink-0" />
                        <p className="text-xs font-semibold">
                          {(ov.conversionRate ?? 0) >= 50
                            ? 'Excellent conversion — referral program is thriving.'
                            : (ov.conversionRate ?? 0) >= 25
                            ? 'Moderate conversion — consider boosting referral rewards.'
                            : 'Low conversion — review referral incentive structure.'}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                </>
              ) : (
                <EmptyState message="Overview data unavailable." />
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB: LEADERBOARD
          ════════════════════════════════════════════════════════ */}
          {activeTab === 'leaderboard' && (
            <motion.div key="leaderboard" variants={pageVariants} initial="hidden" animate="visible" exit="exit">

              {/* Search */}
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                  <input type="text" placeholder="Search name or email…"
                    value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
                    className="input-field pl-9 w-full text-sm" />
                </div>
                <span className="text-xs text-base-content/40 font-medium">
                  {adminLeaderboard?.pagination?.total ?? 0} referrers
                </span>
              </div>

              {loaders.adminLeaderboard ? (
                <PulseLoader label="Loading leaderboard…" />
              ) : filteredLeaderboard.length === 0 ? (
                <EmptyState icon={Trophy} message="No referrers found." />
              ) : (
                <>
                  {/* Top 3 podium */}
                  {!searchUser && filteredLeaderboard.length >= 3 && (
                    <motion.div variants={cardVariants}
                      className="grid grid-cols-3 gap-3 mb-6">
                      {[filteredLeaderboard[1], filteredLeaderboard[0], filteredLeaderboard[2]].map((u, idx) => {
                        if (!u) return null;
                        const podiumRank = [2, 1, 3][idx];
                        const heights   = ['h-24', 'h-32', 'h-20'];
                        const colors    = ['text-base-content/50', 'text-warning', 'text-orange-600'];
                        return (
                          <motion.div key={u._id}
                            whileHover={{ scale: 1.03 }}
                            className={`card p-4 flex flex-col items-center justify-end cursor-pointer
                              ${podiumRank === 1 ? 'border-warning/40 bg-warning/5' : 'bg-base-200'} ${heights[idx]}`}
                            onClick={() => openUserDetail(u._id)}>
                            <img src={u.avatar} alt={u.name}
                              className={`w-10 h-10 rounded-full object-cover border-2 mb-2
                                ${podiumRank === 1 ? 'border-warning' : 'border-base-300'}`}
                              onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`; }} />
                            <p className="text-xs font-bold text-base-content truncate max-w-full">{u.name?.split(' ')[0]}</p>
                            <p className={`text-lg font-black font-montserrat ${colors[idx]}`}>#{podiumRank}</p>
                            <p className="text-xs text-base-content/50">{u.successfulReferrals} refs</p>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Full table */}
                  <motion.div variants={cardVariants} className="card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-base-200 border-b border-base-300">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider w-12">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider">User</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden sm:table-cell">Role</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-base-content/50 uppercase tracking-wider">Referrals</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-base-content/50 uppercase tracking-wider hidden md:table-cell">Coins Earned</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-base-content/50 uppercase tracking-wider hidden lg:table-cell">₹ Value</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-base-content/50 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-200">
                          {filteredLeaderboard.map((u, i) => {
                            const globalRank = (lbPage - 1) * 20 + i + 1;
                            return (
                              <motion.tr key={u._id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="hover:bg-base-200/50 transition-colors group">
                                <td className="px-4 py-3">
                                  {globalRank <= 3 ? (
                                    <span className={`text-base font-black font-montserrat
                                      ${globalRank === 1 ? 'text-warning' : globalRank === 2 ? 'text-base-content/50' : 'text-orange-600'}`}>
                                      #{globalRank}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-base-content/40 font-mono">#{globalRank}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <img src={u.avatar} alt={u.name}
                                      className="w-8 h-8 rounded-full object-cover border border-base-300 shrink-0"
                                      onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`; }} />
                                    <div className="min-w-0">
                                      <p className="font-semibold text-base-content text-xs truncate">{u.name}</p>
                                      <p className="text-xs text-base-content/40 truncate">{u.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 hidden sm:table-cell">
                                  <span className={`badge text-xs border ${getRoleBadge(u.role)}`}>{u.role}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-sm font-bold text-primary">{u.successfulReferrals ?? 0}</span>
                                </td>
                                <td className="px-4 py-3 text-right hidden md:table-cell">
                                  <span className="text-sm font-bold text-warning">{fmt.coins(u.totalCoinsEarned)}</span>
                                </td>
                                <td className="px-4 py-3 text-right hidden lg:table-cell">
                                  <span className="text-xs font-semibold text-success">{u.totalRupeesEarned ?? '₹0.00'}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button onClick={() => openUserDetail(u._id)}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-base-300 hover:border-primary hover:text-primary text-base-content/40 transition-all">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {adminLeaderboard?.pagination?.pages > 1 && (
                      <div className="px-4 py-3 border-t border-base-200">
                        <Pagination
                          page={lbPage}
                          pages={adminLeaderboard.pagination.pages}
                          onPage={handleLbPage}
                        />
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB: ANALYTICS
          ════════════════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" variants={pageVariants} initial="hidden" animate="visible" exit="exit"
              className="space-y-5">

              {/* Chart toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50 font-semibold uppercase tracking-widest">Chart Type:</span>
                {[['area', 'Area'], ['bar', 'Bar']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setChartType(val)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all
                      ${chartType === val ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Referrals by top users */}
              <motion.div variants={cardVariants} className="card p-5">
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-5">
                  Successful Referrals — Top 8 Referrers
                </p>
                {chartData.length === 0 ? (
                  <EmptyState message="No referral data to chart." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="referrals" name="Referrals" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="referrals" name="Referrals"
                          stroke="var(--primary)" strokeWidth={2.5} fill="url(#refGrad)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                )}
              </motion.div>

              {/* Coins earned */}
              <motion.div variants={cardVariants} className="card p-5">
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-5">
                  Coins Earned — Top 8 Referrers
                </p>
                {chartData.length === 0 ? (
                  <EmptyState message="No coins data to chart." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} barSize={28}>
                      <defs>
                        <linearGradient id="coinsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--warning)" stopOpacity={0.9} />
                          <stop offset="95%" stopColor="var(--warning)" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="coins" name="Coins Earned" fill="url(#coinsGrad)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </motion.div>

              {/* Animated coin economy summary */}
              {ov && (
                <motion.div variants={cardVariants}
                  className="card p-5 bg-gradient-to-br from-warning/8 via-base-100 to-success/8 border-warning/20">
                  <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-4">Coin Economy Summary</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Total Coins Issued',    value: ov.totalCoinsAwarded ?? 0,       color: 'warning', prefix: '' },
                      { label: 'Total ₹ Distributed',   value: ov.totalRupeesDistributed ?? 0,  color: 'success', prefix: '₹' },
                      { label: 'Avg Coins per Referrer', value: ov.activeReferrers
                          ? Math.round((ov.totalCoinsAwarded ?? 0) / ov.activeReferrers)
                          : 0, color: 'primary', prefix: '' },
                    ].map((s, i) => (
                      <div key={s.label} className={`p-4 rounded-xl bg-${s.color}/8 border border-${s.color}/20 text-center`}>
                        <motion.p
                          className={`text-3xl font-black text-${s.color} font-montserrat`}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.15 + 0.3, type: 'spring', stiffness: 260 }}>
                          {s.prefix}{Number(s.value).toLocaleString('en-IN')}
                        </motion.p>
                        <p className="text-xs text-base-content/50 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB: TRANSACTIONS (superadmin only)
          ════════════════════════════════════════════════════════ */}
          {activeTab === 'transactions' && isSuperadmin && (
            <motion.div key="transactions" variants={pageVariants} initial="hidden" animate="visible" exit="exit">

              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Finance Audit — Referral Bonus Wallet Credits</p>
              </div>

              {loaders.adminTransactions ? (
                <PulseLoader label="Loading transactions…" />
              ) : adminTransactions?.data?.length === 0 ? (
                <EmptyState icon={Wallet} message="No referral transactions found." />
              ) : (
                <motion.div variants={cardVariants} className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-base-200 border-b border-base-300">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-base-content/50 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden md:table-cell">Purpose</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden lg:table-cell">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden md:table-cell">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-base-content/50 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-200">
                        {adminTransactions.data.map((tx, i) => (
                          <motion.tr key={tx._id ?? i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.025 }}
                            className="hover:bg-base-200/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-base-content truncate">
                                    {tx.userName ?? tx.user ?? '—'}
                                  </p>
                                  <p className="text-xs text-base-content/40 truncate">{tx.userEmail ?? ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-black text-success">
                                +₹{Number(tx.amount || 0).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="badge text-xs border bg-primary/10 text-primary border-primary/25">
                                {tx.purpose ?? 'Referral_Bonus'}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <p className="text-xs text-base-content/60 truncate max-w-xs">{tx.description ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className={`badge text-xs border ${
                                tx.status === 'Success'
                                  ? 'bg-success/10 text-success border-success/25'
                                  : 'bg-error/10 text-error border-error/25'}`}>
                                {tx.status ?? 'Success'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-xs text-base-content/50">{fmt.time(tx.timestamp ?? tx.createdAt)}</p>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {adminTransactions?.pagination?.pages > 1 && (
                    <div className="px-4 py-3 border-t border-base-200">
                      <Pagination
                        page={txPage}
                        pages={adminTransactions.pagination.pages}
                        onPage={handleTxPage}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── User Detail Modal ── */}
      <AnimatePresence>
        {selectedUserId && adminUserDetail && (
          <UserDetailModal
            key="user-detail-modal"
            detail={adminUserDetail}
            onClose={closeModal}
            isSuperadmin={isSuperadmin}
          />
        )}
        {selectedUserId && loaders.adminUserDetail && !adminUserDetail && (
          <motion.div key="modal-loader"
            className="fixed inset-0 z-50 bg-base-100/70 backdrop-blur-md flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PulseLoader label="Loading user details…" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}