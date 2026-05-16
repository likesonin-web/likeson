'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Users, Gift, TrendingUp, Coins, Crown, ArrowUpRight,
  ArrowDownRight, Minus, Calendar, RefreshCw, ChevronLeft,
  ChevronRight, Search, Star, Award, Sparkles,
} from 'lucide-react';

import {
  fetchReferrals,
  selectReferralsLoading,
  selectReferralsError,
  selectReferralsSummary,
  selectTopReferrers,
  selectDailyReferrals,
  selectReferralsList,
} from '@/store/slices/adminAnalyticsSlice';

// ─── helpers ───────────────────────────────────────────────────────────────

const fmt  = (n = 0) => Number(n).toLocaleString('en-IN');
const fmtK = (n = 0) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n);

const RANGE_OPTIONS = [
  { label: '7D',  days: 7  },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const ROLE_COLOR = {
  customer:          'badge-primary',
  doctor:            'badge-secondary',
  driver:            'badge-accent',
  'care-assistant':  'badge-info',
  admin:             'badge-warning',
};

const CHART_GRADIENT_ID = 'referralGrad';

// ─── sub-components ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: 'easeOut' } }),
};

/** Animated KPI card */
function KpiCard({ icon: Icon, label, value, sub, trend, delay = 0, accent = false }) {
  return (
    <motion.div
      variants={fadeUp} initial="hidden" animate="visible" custom={delay}
      className={`stat-card relative overflow-hidden ${accent ? 'border-primary/30' : ''}`}
    >
      {/* tint strip */}
      <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-70 rounded-l" />

      <div className="flex items-start justify-between pl-3">
        <div>
          <p className="stat-card-label">{label}</p>
          <p className="stat-card-value mt-1">{value}</p>
          {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
        </div>
        <span className="p-2.5 rounded-xl bg-primary/10">
          <Icon size={20} className="text-primary" />
        </span>
      </div>

      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-semibold pl-3 ${
          trend > 0 ? 'text-success' : trend < 0 ? 'text-error' : 'text-base-content/50'
        }`}>
          {trend > 0 ? <ArrowUpRight size={14} /> : trend < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
          {Math.abs(trend)}% vs prev period
        </div>
      )}
    </motion.div>
  );
}

/** Custom tooltip for recharts */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs shadow-depth">
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

/** Rank badge */
function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-warning"><Crown size={16} /></span>;
  if (rank === 2) return <span className="text-base-content/60"><Award size={15} /></span>;
  if (rank === 3) return <span className="text-accent"><Star size={15} /></span>;
  return <span className="text-xs font-bold text-base-content/40">#{rank}</span>;
}

// ─── main component ────────────────────────────────────────────────────────

export default function ReferralOverview() {
  const dispatch = useDispatch();

  const loading      = useSelector(selectReferralsLoading);
  const error        = useSelector(selectReferralsError);
  const summary      = useSelector(selectReferralsSummary);
  const topReferrers = useSelector(selectTopReferrers);
  const daily        = useSelector(selectDailyReferrals);
  const listData     = useSelector(selectReferralsList);

  // local state
  const [rangeIdx, setRangeIdx]   = useState(1); // default 30D
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDB]  = useState('');

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDB(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // fetch on range / page / search change
  useEffect(() => {
    const days = RANGE_OPTIONS[rangeIdx].days;
    const to   = new Date();
    const from = new Date(Date.now() - days * 86_400_000);
    dispatch(fetchReferrals({
      from: from.toISOString(),
      to:   to.toISOString(),
      page,
      limit: 10,
      ...(debouncedSearch && { search: debouncedSearch }),
    }));
  }, [dispatch, rangeIdx, page, debouncedSearch]);

  const pagination = listData?.pagination ?? {};
  const list       = listData?.data       ?? [];

  // ── derived chart data ──────────────────────────────────────────────────
  const chartData = (daily ?? []).map(d => ({
    date:  d._id?.slice(5) ?? d._id, // MM-DD
    count: d.count ?? 0,
  }));

  // ── top referrers table ──────────────────────────────────────────────────
  const leaderboard = (topReferrers ?? []).slice(0, 10);
  const maxCount    = leaderboard[0]?.referralCount ?? 1;

  return (
    <div className="container-custom py-6 space-y-6 max-w-7xl">

      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-primary/10">
              <Sparkles size={18} className="text-primary" />
            </span>
            <h1 className="section-heading !mb-0 !text-2xl md:!text-3xl">Referral Overview</h1>
          </div>
          <p className="section-subheading !mb-0 text-sm">
            Track referral growth, top ambassadors, and conversion metrics
          </p>
        </div>

        {/* range selector */}
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-base-content/50" />
          <div className="flex rounded-lg border border-base-300 overflow-hidden bg-base-200">
            {RANGE_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => { setRangeIdx(i); setPage(1); }}
                className={`px-4 py-1.5 text-xs font-bold transition-colors duration-200 ${
                  rangeIdx === i
                    ? 'bg-primary text-primary-content'
                    : 'text-base-content/60 hover:text-base-content hover:bg-base-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => dispatch(fetchReferrals({}))}
            className="btn btn-ghost btn-sm btn-circle"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* ── ERROR ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="alert alert-error"
          >
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI CARDS ───────────────────────────────────────────── */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Users} label="Users With Code" delay={0}
            value={fmtK(summary?.totalWithCode)}
            sub="Have referral code"
          />
          <KpiCard
            icon={Gift} label="Total Referred" delay={1}
            value={fmtK(summary?.totalReferred)}
            sub="Joined via referral"
          />
          <KpiCard
            icon={Coins} label="Coins Awarded" delay={2} accent
            value={fmtK(summary?.totalCoinsAwarded)}
            sub="Lifetime coins given"
          />
          <KpiCard
            icon={TrendingUp} label="Coins Redeemed" delay={3}
            value={fmtK(summary?.totalRedeemed)}
            sub="Lifetime redeemed"
          />
        </div>
      )}

      {/* ── CHART + LEADERBOARD ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Area Chart — daily referrals */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="lg:col-span-3 card p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-montserrat font-extrabold text-base text-base-content">
                Daily Referral Trend
              </h3>
              <p className="text-xs text-base-content/50 mt-0.5">New users joined via referral code</p>
            </div>
            <span className="badge badge-primary badge-sm">
              {RANGE_OPTIONS[rangeIdx].label}
            </span>
          </div>

          {loading ? (
            <div className="skeleton h-48 rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-base-content/30">
              <Gift size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis
                  dataKey="date" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }}
                  tickLine={false} axisLine={false}
                  interval={Math.floor(chartData.length / 6)}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area
                  type="monotone" dataKey="count" name="Referrals"
                  stroke="var(--primary)" strokeWidth={2.5}
                  fill={`url(#${CHART_GRADIENT_ID})`}
                  dot={false} activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--base-100)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Leaderboard — top referrers */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="lg:col-span-2 card p-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <Crown size={16} className="text-warning" />
            <h3 className="font-montserrat font-extrabold text-base text-base-content">
              Top Referrers
            </h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-base-content/30 text-sm">
              No referrer data yet
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((r, i) => {
                const pct = Math.round((r.referralCount / maxCount) * 100);
                return (
                  <motion.div
                    key={r._id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.04 }}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-6 flex justify-center flex-shrink-0">
                      <RankBadge rank={i + 1} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-base-content truncate max-w-[120px]">
                          {r.name ?? '—'}
                        </p>
                        <span className="text-xs font-bold text-primary ml-1">
                          {fmt(r.referralCount)}
                        </span>
                      </div>
                      <div className="progress-bar h-1.5">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${pct}%`, transition: 'width 0.7s ease' }}
                        />
                      </div>
                    </div>

                    <span className={`badge ${ROLE_COLOR[r.role] ?? 'badge-secondary'} badge-xs hidden sm:inline-flex`}>
                      {r.role}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── REFERRED USERS TABLE ─────────────────────────────────── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={4}
        className="card overflow-hidden"
      >
        {/* table header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
          <h3 className="font-montserrat font-extrabold text-base text-base-content">
            Referred Users
          </h3>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                placeholder="Search name / email…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-field pl-9 !py-1.5 text-xs w-52"
              />
            </div>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
              <Users size={36} className="mb-2 opacity-40" />
              <p className="text-sm">No referred users found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Referred By</th>
                  <th>Referral Code</th>
                  <th>Coins</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {list.map((u, i) => (
                    <motion.tr
                      key={u._id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td className="text-base-content/40 text-xs font-mono">
                        {((page - 1) * 10) + i + 1}
                      </td>
                      <td>
                        <div>
                          <p className="text-sm font-semibold text-base-content">{u.name ?? '—'}</p>
                          <p className="text-xs text-base-content/50">{u.email}</p>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${ROLE_COLOR[u.role] ?? 'badge-secondary'} badge-sm`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs font-semibold text-base-content">
                          {u.referredBy?.name ?? '—'}
                        </p>
                        <p className="text-xs text-base-content/50">{u.referredBy?.email}</p>
                      </td>
                      <td>
                        {u.referredBy?.referralCode ? (
                          <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {u.referredBy.referralCode}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Coins size={13} className="text-warning" />
                          <span className="text-xs font-bold">{fmt(u.coins)}</span>
                        </div>
                        <p className="text-xs text-base-content/40">Earned: {fmt(u.coinsEarned)}</p>
                      </td>
                      <td>
                        <p className="text-xs text-base-content/70">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          }) : '—'}
                        </p>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>

        {/* pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/50">
              Page {pagination.page} of {pagination.pages} &bull; {fmt(pagination.total)} total
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-ghost btn-circle"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="btn btn-sm btn-ghost btn-circle"
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}