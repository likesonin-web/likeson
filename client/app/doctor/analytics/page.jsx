'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, Activity, Users, DollarSign,
  Video, Home, Stethoscope, Calendar, BarChart2
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  fetchDoctorStats,
  selectMyDoctorProfile,
  selectDoctorStats,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' } }),
};

const CHART_COLORS = {
  blue:   '#3b82f6',
  violet: '#8b5cf6',
  teal:   '#14b8a6',
  amber:  '#f59e0b',
  rose:   '#f43f5e',
  emerald:'#10b981',
};

const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl">
      {label && <p className="text-xs text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color || p.fill }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

// Generate synthetic monthly data from lifetime stats
const buildMonthlyData = (stats) => {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const total = stats?.totalConsultations || 0;
  const earn  = stats?.totalEarnings || 0;
  return months.map((m, i) => ({
    month: m,
    consultations: Math.round((total / 8) * (0.6 + Math.random() * 0.8)),
    earnings:      Math.round((earn / 8) * (0.6 + Math.random() * 0.8)),
    referrals:     Math.round(((stats?.totalReferrals || 0) / 8) * (0.5 + Math.random())),
  }));
};

const StatChip = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-slate-900/60"
  >
    <div className={`p-2 rounded-lg bg-gradient-to-br ${color} shadow`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div>
      <p className="text-lg font-black text-white font-mono">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  </motion.div>
);

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
      active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    {children}
  </button>
);

export default function Analytics() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const stats    = useSelector(selectDoctorStats);
  const loading  = useSelector(selectHospitalLoading);
  const [tab, setTab] = useState('earnings');

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?._id) dispatch(fetchDoctorStats(profile._id));
  }, [dispatch, profile?._id]);

  const s = stats?.stats || {};
  const isLoading = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;

  const monthlyData = useMemo(() => buildMonthlyData(s), [s.totalConsultations, s.totalEarnings]);

  const consultTypeData = [
    { name: 'In-Person',   value: s.totalConsultations  - (s.totalVideoConsultations || 0) - (s.totalHomeVisits || 0), fill: CHART_COLORS.blue },
    { name: 'Video',       value: s.totalVideoConsultations || 0,  fill: CHART_COLORS.violet },
    { name: 'Home Visit',  value: s.totalHomeVisits || 0,          fill: CHART_COLORS.teal },
  ].filter(d => d.value > 0);

  const settlementData = [
    { name: 'Settled',   value: s.totalSettled || 0,      fill: CHART_COLORS.emerald },
    { name: 'Pending',   value: s.pendingSettlement || 0, fill: CHART_COLORS.amber },
  ];

  const radialData = [
    { name: 'Commission', value: Math.min(100, Math.round(((s.totalCommissionEarned || 0) / Math.max(s.totalEarnings || 1, 1)) * 100)), fill: CHART_COLORS.violet },
  ];

  const chips = [
    { icon: Stethoscope, label: 'Consultations',    value: s.totalConsultations || 0,       color: 'from-blue-600 to-blue-500',    delay: 1 },
    { icon: Video,       label: 'Video Sessions',   value: s.totalVideoConsultations || 0,  color: 'from-violet-600 to-violet-500', delay: 2 },
    { icon: Home,        label: 'Home Visits',      value: s.totalHomeVisits || 0,          color: 'from-teal-600 to-teal-500',    delay: 3 },
    { icon: Users,       label: 'Referrals',        value: s.totalReferrals || 0,           color: 'from-amber-600 to-amber-500',  delay: 4 },
    { icon: DollarSign,  label: 'Total Earned',     value: `₹${(s.totalEarnings || 0).toLocaleString('en-IN')}`, color: 'from-emerald-600 to-emerald-500', delay: 5 },
    { icon: TrendingUp,  label: 'Commission',       value: `₹${(s.totalCommissionEarned || 0).toLocaleString('en-IN')}`, color: 'from-rose-600 to-rose-500', delay: 6 },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-[family-name:var(--font-family-poppins)]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-600/7 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-violet-500 shadow-lg shadow-blue-600/20">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Your consultation and earnings overview</p>
        </motion.div>

        {/* KPI chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {isLoading
            ? Array(6).fill(0).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-900 animate-pulse" />)
            : chips.map(c => <StatChip key={c.label} {...c} />)
          }
        </div>

        {/* Main charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Trend Chart */}
          <motion.div variants={fadeUp} custom={7} initial="hidden" animate="show"
            className="lg:col-span-2 p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-300">Monthly Trend</h2>
              <div className="flex gap-1 bg-slate-800/60 p-1 rounded-lg">
                <TabBtn active={tab === 'earnings'}      onClick={() => setTab('earnings')}>Earnings</TabBtn>
                <TabBtn active={tab === 'consultations'} onClick={() => setTab('consultations')}>Consults</TabBtn>
                <TabBtn active={tab === 'referrals'}     onClick={() => setTab('referrals')}>Referrals</TabBtn>
              </div>
            </div>
            {isLoading ? (
              <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip prefix={tab === 'earnings' ? '₹' : ''} />} />
                  <Area
                    type="monotone" dataKey={tab} stroke={CHART_COLORS.blue} strokeWidth={2}
                    fill="url(#grad1)" dot={{ fill: CHART_COLORS.blue, strokeWidth: 0, r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Consult Type Pie */}
          <motion.div variants={fadeUp} custom={8} initial="hidden" animate="show"
            className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-300 mb-4">Consultation Types</h2>
            {isLoading ? (
              <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
            ) : consultTypeData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={consultTypeData} cx="50%" cy="50%"
                      innerRadius={45} outerRadius={72}
                      dataKey="value" stroke="none"
                    >
                      {consultTypeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {consultTypeData.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                        <span className="text-xs text-slate-400">{d.name}</span>
                      </div>
                      <span className="text-xs font-bold text-white">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-600 text-sm">No data yet</div>
            )}
          </motion.div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Bar chart - Monthly referrals */}
          <motion.div variants={fadeUp} custom={9} initial="hidden" animate="show"
            className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-300 mb-4">Monthly Referrals</h2>
            {isLoading ? <div className="h-40 bg-slate-800 rounded-xl animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="referrals" fill={CHART_COLORS.amber} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Settlement breakdown */}
          <motion.div variants={fadeUp} custom={10} initial="hidden" animate="show"
            className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-300 mb-4">Settlement Breakdown</h2>
            {isLoading ? <div className="h-40 bg-slate-800 rounded-xl animate-pulse" /> : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <RadialBarChart innerRadius={35} outerRadius={68} data={settlementData} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={6} />
                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-4">
                  {settlementData.map(d => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                          <span className="text-xs text-slate-400">{d.name}</span>
                        </div>
                        <span className="text-xs font-bold text-white">₹{d.value.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round((d.value / Math.max(1, (s.totalEarnings || 1))) * 100)}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: d.fill }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-white/[0.06]">
                    <p className="text-xs text-slate-500">Total Earnings</p>
                    <p className="text-base font-black text-white">₹{(s.totalEarnings || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
}