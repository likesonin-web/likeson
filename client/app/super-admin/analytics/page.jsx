'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, TrendingUp, TrendingDown, Stethoscope, Car, Truck,
  FlaskConical, Pill, Building2, Crown, Medal, Award,
  RefreshCw, Calendar, ChevronDown, IndianRupee, Users,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';

import {
  fetchTopEarners,
  selectTopEarnersUnified,
  selectTopEarnersByCategory,
  selectTopEarnersLifetime,
  selectTopEarnersLoading,
  selectTopEarnersError,
} from '@/store/slices/adminAnalyticsSlice'; // adjust path to your slice location

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — category metadata (icon, label, color token)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_META = {
  doctor:            { label: 'Doctors',           icon: Stethoscope, color: 'var(--chart-1)' },
  agency_driver:     { label: 'Agency Drivers',    icon: Car,         color: 'var(--chart-2)' },
  transport_agency:  { label: 'Transport Agencies',icon: Truck,       color: 'var(--chart-3)' },
  solo_driver:       { label: 'Solo Drivers',      icon: Car,         color: 'var(--chart-4)' },
  lab_partner:       { label: 'Lab Partners',      icon: FlaskConical,color: 'var(--chart-5)' },
  pharmacy_store:    { label: 'Pharmacy Stores',   icon: Pill,        color: 'var(--chart-6)' },
};

const CATEGORY_TABS = [
  { key: 'all',              label: 'All Categories' },
  { key: 'doctor',           label: 'Doctors' },
  { key: 'agency_driver',    label: 'Agency Drivers' },
  { key: 'transport_agency', label: 'Transport Agencies' },
  { key: 'solo_driver',      label: 'Solo Drivers' },
  { key: 'lab_partner',      label: 'Lab Partners' },
  { key: 'pharmacy_store',   label: 'Pharmacy Stores' },
];

const formatCurrency = (val = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);

const formatPaise = (paise = 0) => formatCurrency((paise || 0) / 100);

const rankIcon = (rank) => {
  if (rank === 1) return <Crown className="w-4 h-4" />;
  if (rank === 2) return <Medal className="w-4 h-4" />;
  if (rank === 3) return <Award className="w-4 h-4" />;
  return null;
};

const rankBadgeClass = (rank) => {
  if (rank === 1) return 'badge-warning';
  if (rank === 2) return 'badge-secondary';
  if (rank === 3) return 'badge-accent';
  return 'badge-primary';
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function TopEarnersPage() {
  const dispatch = useDispatch();

  const unified  = useSelector(selectTopEarnersUnified)  ?? [];
  const byCat    = useSelector(selectTopEarnersByCategory) ?? {};
  const lifetime = useSelector(selectTopEarnersLifetime) ?? {};
  const loading  = useSelector(selectTopEarnersLoading);
  const error    = useSelector(selectTopEarnersError);

  const [activeTab, setActiveTab] = useState('all');
  const [showLifetime, setShowLifetime] = useState(false);

  useEffect(() => {
    dispatch(fetchTopEarners({ limit: 10 }));
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchTopEarners({ limit: 10 }));
  };

  // ── Chart data: top 8 from unified list, by name + revenue ─────────────────
  const chartData = useMemo(() => {
    return unified.slice(0, 8).map((entry) => ({
      name: entry.name?.length > 14 ? `${entry.name.slice(0, 14)}…` : entry.name || 'Unknown',
      revenue: entry.revenue ?? 0,
      category: entry.category,
    }));
  }, [unified]);

  // ── Pie data: revenue share by category ─────────────────────────────────────
  const pieData = useMemo(() => {
    const totals = {};
    unified.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + (e.revenue ?? 0);
    });
    return Object.entries(totals).map(([key, value]) => ({
      name: CATEGORY_META[key]?.label ?? key,
      value,
      color: CATEGORY_META[key]?.color ?? 'var(--chart-1)',
    }));
  }, [unified]);

  const filteredList = useMemo(() => {
    if (activeTab === 'all') return unified;
    return unified.filter((e) => e.category === activeTab);
  }, [unified, activeTab]);

  const totalRevenueThisWeek = useMemo(
    () => unified.reduce((sum, e) => sum + (e.revenue ?? 0), 0),
    [unified]
  );

  return (
    <div className="container-custom py-6 md:py-10 space-y-8">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-box bg-primary/10">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl">Top Earners This Week</h1>
            <p className="section-subheading mb-0">
              Cross-platform leaderboard — doctors, drivers, agencies, labs &amp; pharmacy stores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="badge badge-primary">
            <Calendar className="w-3.5 h-3.5" />
            This Week
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-outline btn-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Error State ─────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error">
          <span className="font-semibold">Failed to load top earners:</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading State ───────────────────────────────────────────────── */}
      {loading && !unified.length && (
        <div className="grid-responsive">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-4 w-24 mb-3" />
              <div className="skeleton h-8 w-32 mb-2" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {!loading && unified.length > 0 && (
        <>
          {/* ── Summary Stat Cards ────────────────────────────────────────── */}
          <div className="grid-responsive">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="stat-card-label">Total Weekly Revenue</span>
                <IndianRupee className="w-4 h-4 text-primary" />
              </div>
              <div className="stat-card-value">{formatCurrency(totalRevenueThisWeek)}</div>
              <div className="flex items-center gap-1 text-xs text-success mt-2">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Across {unified.length} top earners</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="stat-card-label">Top Performer</span>
                {(() => {
                  const Icon = CATEGORY_META[unified[0]?.category]?.icon ?? Trophy;
                  return <Icon className="w-4 h-4 text-primary" />;
                })()}
              </div>
              <div className="stat-card-value truncate">{unified[0]?.name ?? '—'}</div>
              <div className="flex items-center gap-1 text-xs mt-2 text-base-content/60">
                <span>{formatCurrency(unified[0]?.revenue ?? 0)}</span>
                <span className="badge badge-sm badge-primary ml-1">
                  {CATEGORY_META[unified[0]?.category]?.label ?? '—'}
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="stat-card-label">Active Categories</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="stat-card-value">{pieData.length}</div>
              <div className="flex items-center gap-1 text-xs text-base-content/60 mt-2">
                <span>Out of {Object.keys(CATEGORY_META).length} possible</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="stat-card-label">Avg Per Earner</span>
                <IndianRupee className="w-4 h-4 text-primary" />
              </div>
              <div className="stat-card-value">
                {formatCurrency(unified.length ? totalRevenueThisWeek / unified.length : 0)}
              </div>
              <div className="flex items-center gap-1 text-xs text-base-content/60 mt-2">
                <span>Top {unified.length} entries</span>
              </div>
            </motion.div>
          </div>

          {/* ── Charts Row ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Bar chart — top earners by revenue */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="card lg:col-span-2 p-5"
            >
              <h3 className="mb-1">Top 8 Earners — This Week</h3>
              <p className="text-xs text-base-content/60 mb-4">
                Revenue generated, ranked across all categories
              </p>
              <div className="h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--base-content)' }}
                      angle={-25}
                      textAnchor="end"
                      height={70}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--base-content)' }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{
                        backgroundColor: 'var(--base-100)',
                        border: '1px solid var(--base-300)',
                        borderRadius: 'var(--r-field)',
                        fontSize: '0.8rem',
                      }}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={CATEGORY_META[entry.category]?.color ?? 'var(--primary)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Pie chart — revenue share by category */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="card p-5"
            >
              <h3 className="mb-1">Revenue Mix</h3>
              <p className="text-xs text-base-content/60 mb-4">By category, this week</p>
              <div className="h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend
                      wrapperStyle={{ fontSize: '0.75rem' }}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* ── Category Tabs ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const meta = CATEGORY_META[tab.key];
              const Icon = meta?.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Leaderboard Table ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="card overflow-hidden"
          >
            <div className="p-5 pb-0">
              <h3 className="mb-1">Leaderboard</h3>
              <p className="text-xs text-base-content/60 mb-4">
                {activeTab === 'all'
                  ? 'All categories, ranked by weekly revenue'
                  : `Filtered: ${CATEGORY_TABS.find((t) => t.key === activeTab)?.label}`}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-16">Rank</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th className="text-right">This Week</th>
                    <th className="text-right hide-mobile">Volume</th>
                    <th className="text-right hide-mobile">Lifetime Earned</th>
                    <th className="text-right hide-mobile">Pending Payout</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredList.map((entry, idx) => {
                      const meta = CATEGORY_META[entry.category];
                      const Icon = meta?.icon ?? Building2;
                      const volume = entry.bookings ?? entry.rides ?? entry.orders ?? entry.driverCount ?? '—';
                      return (
                        <motion.tr
                          key={`${entry.category}-${entry._id ?? idx}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.03 }}
                        >
                          <td>
                            <span className={`badge ${rankBadgeClass(entry.rank ?? idx + 1)}`}>
                              {rankIcon(entry.rank ?? idx + 1)}
                              #{entry.rank ?? idx + 1}
                            </span>
                          </td>
                          <td className="font-semibold">{entry.name ?? '—'}</td>
                          <td>
                            <span className="badge badge-sm badge-secondary">
                              <Icon className="w-3 h-3" />
                              {meta?.label ?? entry.category}
                            </span>
                          </td>
                          <td className="text-right font-bold text-primary">
                            {formatCurrency(entry.revenue ?? 0)}
                          </td>
                          <td className="text-right hide-mobile text-base-content/70">
                            {volume}
                          </td>
                          <td className="text-right hide-mobile text-base-content/70">
                            {entry.lifetimeEarned != null ? formatPaise(entry.lifetimeEarned) : '—'}
                          </td>
                          <td className="text-right hide-mobile">
                            {entry.lifetimePending != null ? (
                              <span className="badge badge-sm badge-warning">
                                {formatPaise(entry.lifetimePending)}
                              </span>
                            ) : '—'}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>

              {filteredList.length === 0 && (
                <div className="p-8 text-center text-base-content/50">
                  No earners found for this category this week.
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Lifetime Leaderboards (collapsible) ──────────────────────────── */}
          <div className="card p-5">
            <button
              type="button"
              onClick={() => setShowLifetime((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h3 className="mb-1">Lifetime Leaderboards</h3>
                <p className="text-xs text-base-content/60 mb-0">
                  All-time top earners by category, independent of this week's activity
                </p>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-base-content/50 transition-transform ${
                  showLifetime ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {showLifetime && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">

                    {/* Doctors */}
                    <LifetimePanel
                      title="Doctors"
                      icon={Stethoscope}
                      items={(lifetime.doctors ?? []).map((d) => ({
                        name: d.user?.name ?? 'Unknown',
                        sub: d.specialization,
                        value: d.earnings?.lifetimeEarningsPaise,
                        pending: d.earnings?.pendingPayoutPaise,
                      }))}
                    />

                    {/* Agency drivers */}
                    <LifetimePanel
                      title="Agency Drivers"
                      icon={Car}
                      items={(lifetime.agencyDrivers ?? []).map((d) => ({
                        name: d.legalName ?? d.driverCode,
                        sub: d.driverCode,
                        value: d.earnings?.lifetimeEarningsPaise,
                        pending: d.earnings?.pendingPayoutPaise,
                      }))}
                    />

                    {/* Transport agencies */}
                    <LifetimePanel
                      title="Transport Agencies"
                      icon={Truck}
                      items={(lifetime.transportAgencies ?? []).map((t) => ({
                        name: t.businessName,
                        sub: t.partnershipStatus,
                        value: t.earnings?.lifetimeEarningsPaise,
                        pending: t.earnings?.pendingPayoutPaise,
                      }))}
                    />

                    {/* Solo drivers */}
                    <LifetimePanel
                      title="Solo Drivers"
                      icon={Car}
                      items={(lifetime.soloDrivers ?? []).map((d) => ({
                        name: d.legalName,
                        sub: d.partnerCode,
                        value: d.earnings?.lifetimeEarningsPaise,
                        pending: d.earnings?.pendingPayoutPaise,
                      }))}
                    />

                    {/* Lab partners */}
                    <LifetimePanel
                      title="Lab Partners"
                      icon={FlaskConical}
                      items={(lifetime.labPartners ?? []).map((l) => ({
                        name: l.labName,
                        sub: l.labType,
                        value: l.earnings?.lifetimeEarningsPaise,
                        pending: l.earnings?.pendingPayoutPaise,
                      }))}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {!loading && unified.length === 0 && !error && (
        <div className="card p-12 text-center">
          <Trophy className="w-12 h-12 mx-auto text-base-content/30 mb-4" />
          <h3 className="mb-2">No earnings data yet</h3>
          <p className="text-base-content/60">
            Once bookings and orders are completed this week, top earners will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Lifetime leaderboard mini-panel
// ─────────────────────────────────────────────────────────────────────────────

function LifetimePanel({ title, icon: Icon, items = [] }) {
  const top5 = items.slice(0, 5);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-selector bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h4 className="text-sm font-bold mb-0">{title}</h4>
      </div>

      {top5.length === 0 && (
        <p className="text-xs text-base-content/50">No data yet.</p>
      )}

      <ul className="space-y-2">
        {top5.map((item, idx) => (
          <li key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`badge badge-xs ${rankBadgeClass(idx + 1)}`}>
                #{idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate mb-0">{item.name ?? '—'}</p>
                {item.sub && (
                  <p className="text-xs text-base-content/50 truncate mb-0">{item.sub}</p>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-primary mb-0">
                {formatPaise(item.value)}
              </p>
              {item.pending > 0 && (
                <p className="text-xs text-warning mb-0">
                  {formatPaise(item.pending)} pending
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}