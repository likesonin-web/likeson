'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope, Star, TrendingUp, Users, Award,
  CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Search, ChevronDown, ChevronUp, Activity,
  BarChart2, Layers, ShieldCheck, Clock, ArrowUpRight,
  ArrowDownRight, Minus, Info, Filter
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, Treemap,
} from 'recharts';

import {
  fetchSpecialties,
  resetSpecialties,
  selectSpecialtiesLoading,
  selectSpecialtiesError,
  selectSpecialtiesList,
  selectRatingDistribution,
} from '@/store/slices/adminAnalyticsSlice';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt  = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtC = (n)        => n == null ? '—' : `₹${fmt(n, 0)}`;
const pct  = (a, b)     => b ? ((a / b) * 100).toFixed(1) : '0.0';

const SPECIALTY_COLORS = [
  'var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--success)',
  'var(--warning)', 'var(--info)',
  'oklch(55% 0.24 285)', 'oklch(48% 0.24 18)',
  'oklch(54% 0.20 192)', 'oklch(50% 0.22 158)',
];

const KYC_STATUS_COLOR = {
  approved:        'success',
  pending:         'warning',
  'under-review':  'info',
  rejected:        'error',
};

// ─── sub-components ──────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon: Icon, color = 'primary', delay = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="stat-card group relative overflow-hidden">
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{ background: `radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--${color}), transparent 90%), transparent 70%)` }} />
    <div className="relative z-10 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="stat-card-label truncate">{label}</p>
        <p className="stat-card-value mt-1" style={{ color: `var(--${color})` }}>{value}</p>
        {sub && <p className="text-xs mt-1 text-base-content/40">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, var(--${color}), transparent 87%)` }}>
        <Icon size={18} style={{ color: `var(--${color})` }} />
      </div>
    </div>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-xl border border-primary/20">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, 1) : p.value}
        </p>
      ))}
    </div>
  );
};

// KYC Breakdown mini bars
const KycMini = ({ breakdown }) => {
  if (!breakdown?.length) return <span className="text-xs text-base-content/30">—</span>;
  const total = breakdown.reduce((s, k) => s + k.count, 0);
  return (
    <div className="flex gap-0.5 items-center h-4 w-28">
      {breakdown.map((k, i) => (
        <div key={i}
          title={`${k.status}: ${k.count}`}
          style={{
            width: `${pct(k.count, total)}%`,
            minWidth: 4,
            background: `var(--${KYC_STATUS_COLOR[k.status] ?? 'neutral'})`,
          }}
          className="h-full rounded-sm transition-all duration-500"
        />
      ))}
    </div>
  );
};

// Stars display
const Stars = ({ rating }) => {
  const r = rating ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={10}
          fill={s <= Math.round(r) ? 'var(--warning)' : 'none'}
          stroke={s <= Math.round(r) ? 'var(--warning)' : 'color-mix(in oklch, var(--base-content) 25%, transparent)'}
        />
      ))}
      <span className="text-xs font-bold ml-1">{r.toFixed(1)}</span>
    </div>
  );
};

// Specialty Row (expandable)
const SpecialtyRow = ({ spec, index, colorIdx }) => {
  const [expanded, setExpanded] = useState(false);
  const verifyPct = spec.doctorCount ? pct(spec.verifiedCount, spec.doctorCount) : 0;
  const activePct = spec.doctorCount ? pct(spec.activeCount,   spec.doctorCount) : 0;
  const color     = SPECIALTY_COLORS[colorIdx % SPECIALTY_COLORS.length];

  return (
    <>
      <motion.tr
        key={spec._id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.04 }}
        onClick={() => setExpanded(e => !e)}
        className="cursor-pointer hover:bg-primary/5 transition-colors"
      >
        {/* Specialty */}
        <td>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
            <div>
              <p className="text-xs font-bold leading-tight">{spec._id || 'Unassigned'}</p>
              <p className="text-xs text-base-content/40">{fmt(spec.totalConsultations)} consultations</p>
            </div>
          </div>
        </td>
        {/* Doctors */}
        <td>
          <div>
            <p className="text-xs font-bold">{fmt(spec.doctorCount)}</p>
            <div className="flex gap-2 mt-0.5">
              <span className="text-xs text-success font-medium">{fmt(spec.verifiedCount)} verified</span>
            </div>
          </div>
        </td>
        {/* Verification progress */}
        <td>
          <div className="w-28">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-base-content/40">Verified</span>
              <span className="font-bold">{verifyPct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${verifyPct}%`, background: color }} />
            </div>
          </div>
        </td>
        {/* KYC breakdown */}
        <td><KycMini breakdown={spec.kycBreakdown} /></td>
        {/* Rating */}
        <td><Stars rating={spec.avgRating} /></td>
        {/* Experience */}
        <td>
          <span className="text-xs font-bold">{fmt(spec.avgExperience, 1)} yrs</span>
        </td>
        {/* Period bookings */}
        <td>
          <p className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{fmt(spec.periodBookings)}</p>
          <p className="text-xs text-success font-semibold">{fmtC(spec.periodRevenue)}</p>
        </td>
        {/* Expand toggle */}
        <td>
          <button className="btn btn-ghost btn-xs btn-circle">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </td>
      </motion.tr>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <tr key={`${spec._id}-expanded`}>
            <td colSpan={8} className="p-0 border-b border-base-300">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--base-200), transparent 30%)' }}
              >
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-base-content/40 uppercase tracking-wider font-bold mb-2">Doctors</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span>Total</span>
                        <span className="font-bold">{fmt(spec.doctorCount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Verified</span>
                        <span className="font-bold text-success">{fmt(spec.verifiedCount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Active</span>
                        <span className="font-bold text-info">{fmt(spec.activeCount)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/40 uppercase tracking-wider font-bold mb-2">Performance</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span>Avg Rating</span>
                        <span className="font-bold text-warning">{fmt(spec.avgRating, 2)} ★</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Avg Experience</span>
                        <span className="font-bold">{fmt(spec.avgExperience, 1)} yrs</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Total Consults</span>
                        <span className="font-bold">{fmt(spec.totalConsultations)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/40 uppercase tracking-wider font-bold mb-2">Period Stats</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span>Bookings</span>
                        <span className="font-bold text-primary">{fmt(spec.periodBookings)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Revenue</span>
                        <span className="font-bold text-success">{fmtC(spec.periodRevenue)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/40 uppercase tracking-wider font-bold mb-2">KYC Status</p>
                    <div className="space-y-1.5">
                      {(spec.kycBreakdown ?? []).map((k, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full"
                              style={{ background: `var(--${KYC_STATUS_COLOR[k.status] ?? 'neutral'})` }} />
                            <span className="capitalize">{k.status}</span>
                          </div>
                          <span className="font-bold">{k.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};

// Treemap content
const TreemapContent = ({ root, depth, x, y, width, height, index, name, doctorCount }) => {
  const color = SPECIALTY_COLORS[index % SPECIALTY_COLORS.length];
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
        style={{ fill: color, fillOpacity: 0.85, stroke: 'var(--base-100)', strokeWidth: 2 }} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={11} fontWeight={700}
            className="select-none" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {name?.length > 12 ? name.slice(0, 11) + '…' : name}
          </text>
          {height > 44 && (
            <text x={x + 8} y={y + 32} fill="rgba(255,255,255,0.8)" fontSize={10}
              className="select-none">
              {doctorCount} doctors
            </text>
          )}
        </>
      )}
    </g>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SpecialtiesPage() {
  const dispatch = useDispatch();
  const loading  = useSelector(selectSpecialtiesLoading);
  const error    = useSelector(selectSpecialtiesError);
  const list     = useSelector(selectSpecialtiesList);
  const ratingDist = useSelector(selectRatingDistribution);

  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('doctorCount');
  const [sortDir, setSortDir]   = useState('desc');
  const [activeTab, setActiveTab] = useState('table'); // table | charts

  const [filters, setFilters]   = useState({ from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to)   params.to   = filters.to;
    dispatch(fetchSpecialties(params));
  }, [filters, dispatch]);

  useEffect(() => { load(); return () => dispatch(resetSpecialties()); }, [load]);

  const specs = list ?? [];

  const filtered = specs
    .filter(s => !search || (s._id ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Aggregated stats
  const totalDoctors       = specs.reduce((s, sp) => s + (sp.doctorCount ?? 0), 0);
  const totalVerified      = specs.reduce((s, sp) => s + (sp.verifiedCount ?? 0), 0);
  const totalConsultations = specs.reduce((s, sp) => s + (sp.totalConsultations ?? 0), 0);
  const totalRevenue       = specs.reduce((s, sp) => s + (sp.periodRevenue ?? 0), 0);
  const avgRating          = specs.length ? (specs.reduce((s, sp) => s + (sp.avgRating ?? 0), 0) / specs.length) : 0;

  // Chart data
  const topByDoctors  = [...specs].sort((a, b) => (b.doctorCount ?? 0) - (a.doctorCount ?? 0)).slice(0, 8);
  const topByBookings = [...specs].sort((a, b) => (b.periodBookings ?? 0) - (a.periodBookings ?? 0)).slice(0, 8);
  const topByRevenue  = [...specs].sort((a, b) => (b.periodRevenue ?? 0) - (a.periodRevenue ?? 0)).slice(0, 6);

  const radarData = topByDoctors.slice(0, 6).map(s => ({
    subject:      (s._id ?? 'N/A').slice(0, 12),
    doctors:      s.doctorCount ?? 0,
    verified:     s.verifiedCount ?? 0,
    consultations: Math.round((s.totalConsultations ?? 0) / 100),
    rating:       Math.round((s.avgRating ?? 0) * 20),
  }));

  const treemapData = specs.map((s, i) => ({
    name:        s._id ?? 'Unassigned',
    size:        s.doctorCount ?? 0,
    doctorCount: s.doctorCount ?? 0,
    index:       i,
  })).filter(s => s.size > 0);

  const ratingChartData = (ratingDist ?? []).map(r => ({
    name: r._id === 'unrated' ? 'Unrated' : `${r._id}–${Number(r._id) + 1} ★`,
    count: r.count,
  }));

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ChevronDown size={11} className="opacity-20" />;
    return sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />;
  };

  const ThSortable = ({ k, children }) => (
    <th className="cursor-pointer select-none hover:text-primary transition-colors"
      onClick={() => toggleSort(k)}>
      <div className="flex items-center gap-1">{children}<SortIcon k={k} /></div>
    </th>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-200)' }}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-heading !mb-1">Specialties</h1>
            <p className="section-subheading !mb-0">Doctor analytics grouped by medical specialization</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-base-300 overflow-hidden" style={{ background: 'var(--base-100)' }}>
              {(['table', 'charts']).map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                    activeTab === tab
                      ? 'text-primary-content'
                      : 'text-base-content/50 hover:text-base-content'
                  }`}
                  style={activeTab === tab ? { background: 'var(--primary)' } : {}}>
                  {tab === 'table' ? <><BarChart2 className="inline mr-1" size={12} />Table</> : <><Activity className="inline mr-1" size={12} />Charts</>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowFilters(s => !s)}
              className={`btn btn-sm gap-1 ${showFilters ? 'btn-primary' : 'btn-outline'}`}>
              <Filter size={13} />Filters
            </button>
            <button onClick={load} className="btn btn-sm btn-ghost" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </motion.div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-error"><AlertCircle size={16} /><p className="text-sm font-medium">{error}</p></div>
        )}

        {/* ── Filters ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="card p-4 flex flex-col sm:flex-row gap-3">
                <div>
                  <label className="label-text text-xs mb-1 block">From</label>
                  <input type="date" className="input-field text-xs py-1.5"
                    value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
                </div>
                <div>
                  <label className="label-text text-xs mb-1 block">To</label>
                  <input type="date" className="input-field text-xs py-1.5"
                    value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Specialties"     value={fmt(specs.length)}        icon={Layers}      color="primary"   delay={0} />
          <StatCard label="Total Doctors"   value={fmt(totalDoctors)}        icon={Users}       color="secondary" delay={0.04} />
          <StatCard label="Verified Doctors" value={fmt(totalVerified)}      icon={ShieldCheck} color="success"   delay={0.08}
            sub={`${pct(totalVerified, totalDoctors)}% of total`} />
          <StatCard label="Consultations"   value={fmt(totalConsultations)}  icon={Stethoscope} color="info"      delay={0.12} />
          <StatCard label="Period Revenue"  value={fmtC(totalRevenue)}       icon={TrendingUp}  color="accent"    delay={0.16} />
        </div>

        {/* ── TABLE TAB ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'table' && (
            <motion.div key="table"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card overflow-hidden">

              {/* Table header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Stethoscope size={14} style={{ color: 'var(--primary)' }} />
                  Specialty Breakdown
                  <span className="badge badge-primary badge-xs">{filtered.length}</span>
                </h3>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input className="input-field pl-8 text-xs py-1.5 w-52"
                    placeholder="Search specialty…"
                    value={search}
                    onChange={e => setSearch(e.target.value)} />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="loading loading-lg" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
                    <Stethoscope size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">No specialties found</p>
                  </div>
                ) : (
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <ThSortable k="doctorCount">Specialty</ThSortable>
                        <ThSortable k="doctorCount">Doctors</ThSortable>
                        <th>Verification</th>
                        <th>KYC Split</th>
                        <ThSortable k="avgRating">Rating</ThSortable>
                        <ThSortable k="avgExperience">Experience</ThSortable>
                        <ThSortable k="periodBookings">Period</ThSortable>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((spec, i) => (
                        <SpecialtyRow key={spec._id ?? i} spec={spec} index={i} colorIdx={i} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer summary */}
              {!loading && filtered.length > 0 && (
                <div className="px-5 py-3 border-t border-base-300 flex flex-wrap gap-4 text-xs text-base-content/50">
                  <span>Avg rating across all: <strong className="text-warning">{avgRating.toFixed(2)} ★</strong></span>
                  <span>Verified ratio: <strong className="text-success">{pct(totalVerified, totalDoctors)}%</strong></span>
                  <span className="ml-auto flex items-center gap-1">
                    <Info size={11} /> Click row to expand details
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* ── CHARTS TAB ── */}
          {activeTab === 'charts' && (
            <motion.div key="charts"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-4">

              {loading ? (
                <div className="card flex items-center justify-center py-24">
                  <div className="loading loading-lg" />
                </div>
              ) : (
                <>
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Top specialties by doctor count */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Users size={14} style={{ color: 'var(--primary)' }} />
                        Top Specialties by Doctor Count
                      </h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={topByDoctors} layout="vertical" barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                          <YAxis dataKey="_id" type="category" width={90} tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}
                            tickFormatter={v => v?.slice(0, 12) ?? '—'} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="doctorCount" name="Doctors" radius={[0, 4, 4, 0]}>
                            {topByDoctors.map((_, i) => (
                              <Cell key={i} fill={SPECIALTY_COLORS[i % SPECIALTY_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Booking & revenue by specialty */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                        Period Bookings by Specialty
                      </h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={topByBookings} layout="vertical" barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                          <YAxis dataKey="_id" type="category" width={90} tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}
                            tickFormatter={v => v?.slice(0, 12) ?? '—'} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="periodBookings" name="Bookings" radius={[0, 4, 4, 0]}>
                            {topByBookings.map((_, i) => (
                              <Cell key={i} fill={SPECIALTY_COLORS[i % SPECIALTY_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Radar */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Activity size={14} style={{ color: 'var(--secondary)' }} />
                        Specialty Radar (Top 6)
                      </h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart cx="50%" cy="50%" outerRadius={90} data={radarData}>
                          <PolarGrid stroke="var(--base-300)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }} />
                          <PolarRadiusAxis tick={{ fontSize: 8 }} />
                          <Radar name="Doctors" dataKey="doctors" stroke="var(--primary)"
                            fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
                          <Radar name="Verified" dataKey="verified" stroke="var(--success)"
                            fill="var(--success)" fillOpacity={0.20} strokeWidth={2} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Rating distribution */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Star size={14} style={{ color: 'var(--warning)' }} />
                        Doctor Rating Distribution
                      </h3>
                      {ratingChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={ratingChartData} barSize={28}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Doctors" radius={[4, 4, 0, 0]}>
                              {ratingChartData.map((_, i) => (
                                <Cell key={i} fill={`oklch(${62 + i * 6}% 0.18 72)`} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">No data</div>
                      )}
                    </div>

                    {/* Revenue by specialty pie */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Award size={14} style={{ color: 'var(--success)' }} />
                        Revenue Share (Top 6)
                      </h3>
                      {topByRevenue.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie data={topByRevenue} cx="50%" cy="50%"
                              innerRadius={55} outerRadius={85}
                              dataKey="periodRevenue" nameKey="_id"
                              paddingAngle={3}>
                              {topByRevenue.map((_, i) => (
                                <Cell key={i} fill={SPECIALTY_COLORS[i % SPECIALTY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => fmtC(v)} content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10 }}
                              formatter={(v) => v?.slice(0, 14) ?? v} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">No data</div>
                      )}
                    </div>
                  </div>

                  {/* Treemap */}
                  {treemapData.length > 0 && (
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Layers size={14} style={{ color: 'var(--primary)' }} />
                        Specialty Treemap — Doctor Volume
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <Treemap
                          data={treemapData}
                          dataKey="size"
                          nameKey="name"
                          aspectRatio={4 / 3}
                          content={<TreemapContent />}
                        />
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}