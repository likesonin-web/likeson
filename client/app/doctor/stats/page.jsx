'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  Activity, DollarSign, TrendingUp, Users, Clock,
  Stethoscope, Video, Home, Star, Calendar,
  Banknote, ChevronUp, ChevronDown, Minus
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
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' } }),
};

const Trend = ({ value }) => {
  if (!value || value === 0) return <Minus className="w-3 h-3 text-slate-500" />;
  return value > 0
    ? <ChevronUp className="w-3 h-3 text-emerald-400" />
    : <ChevronDown className="w-3 h-3 text-red-400" />;
};

const StatCard = ({ icon: Icon, label, value, sub, color, border, trendVal, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-5 rounded-2xl border ${border} bg-slate-900/60 relative overflow-hidden group`}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color.replace('opacity-0', 'opacity-100')}`} style={{ background: undefined }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-0.5 text-xs">
          <Trend value={trendVal} />
        </div>
      </div>
      <p className="text-2xl font-black text-white font-mono tracking-tight">{value ?? '—'}</p>
      <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

const InfoRow = ({ label, value, color = 'text-white' }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`text-sm font-semibold ${color}`}>{value || '—'}</span>
  </div>
);

// Tiny inline sparkline data
const buildSparkline = (val, count = 8) =>
  Array.from({ length: count }, (_, i) => ({
    i, v: Math.round((val / count) * (0.5 + Math.random() * 1.2))
  }));

const Sparkline = ({ data, color }) => (
  <ResponsiveContainer width="100%" height={40}>
    <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl">
      <p className="text-xs font-bold text-white">₹{(payload[0]?.value || 0).toLocaleString('en-IN')}</p>
    </div>
  );
};

export default function MyStats() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const stats    = useSelector(selectDoctorStats);
  const loading  = useSelector(selectHospitalLoading);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?._id) dispatch(fetchDoctorStats(profile._id));
  }, [dispatch, profile?._id]);

  const s        = stats?.stats    || {};
  const rating   = stats?.rating   || {};
  const isLoading = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;

  const earningsLine = buildSparkline(s.totalEarnings || 0, 10).map((d, i) => ({
    month: i, earnings: d.v,
  }));

  const primaryStat = [
    {
      icon: Stethoscope, label: 'Total Consultations',       value: s.totalConsultations ?? 0,
      sub: `Last: ${s.lastConsultationAt ? new Date(s.lastConsultationAt).toLocaleDateString('en-IN') : 'N/A'}`,
      color: 'from-blue-600/20 to-blue-500/5', border: 'border-blue-500/10', delay: 1,
    },
    {
      icon: Video, label: 'Video Consultations',             value: s.totalVideoConsultations ?? 0,
      sub: null, color: 'from-violet-600/20 to-violet-500/5', border: 'border-violet-500/10', delay: 2,
    },
    {
      icon: Home, label: 'Home Visits',                      value: s.totalHomeVisits ?? 0,
      sub: null, color: 'from-teal-600/20 to-teal-500/5', border: 'border-teal-500/10', delay: 3,
    },
    {
      icon: Users, label: 'Total Referrals',                 value: s.totalReferrals ?? 0,
      sub: `This month: ${s.monthlyReferrals ?? 0}`,
      color: 'from-amber-600/20 to-amber-500/5', border: 'border-amber-500/10', delay: 4,
    },
    {
      icon: DollarSign, label: 'Total Earnings',
      value: `₹${(s.totalEarnings ?? 0).toLocaleString('en-IN')}`,
      sub: `Commission: ₹${(s.totalCommissionEarned ?? 0).toLocaleString('en-IN')}`,
      color: 'from-emerald-600/20 to-emerald-500/5', border: 'border-emerald-500/10', delay: 5,
    },
    {
      icon: Banknote, label: 'Pending Settlement',
      value: `₹${(s.pendingSettlement ?? 0).toLocaleString('en-IN')}`,
      sub: `Settled: ₹${(s.totalSettled ?? 0).toLocaleString('en-IN')}`,
      color: 'from-orange-600/20 to-orange-500/5', border: 'border-orange-500/10', delay: 6,
    },
    {
      icon: Star, label: 'Avg Rating',
      value: rating.averageRating ? rating.averageRating.toFixed(1) : '—',
      sub: `${rating.totalRatings ?? 0} ratings · ${rating.totalReviews ?? 0} reviews`,
      color: 'from-yellow-600/20 to-yellow-500/5', border: 'border-yellow-500/10', delay: 7,
    },
    {
      icon: TrendingUp, label: 'Monthly Referrals',          value: s.monthlyReferrals ?? 0,
      sub: `Last ref: ${s.lastReferralAt ? new Date(s.lastReferralAt).toLocaleDateString('en-IN') : 'N/A'}`,
      color: 'from-rose-600/20 to-rose-500/5', border: 'border-rose-500/10', delay: 8,
    },
  ];

  const sparklineConsults = buildSparkline(s.totalConsultations || 0);
  const sparklineReferrals = buildSparkline(s.totalReferrals || 0);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-[family-name:var(--font-family-poppins)]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-80 h-80 bg-teal-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-blue-600/6 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-600 to-blue-500 shadow-lg shadow-teal-600/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">My Stats</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Complete lifetime statistics for your practice</p>
        </motion.div>

        {/* Main stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {isLoading
            ? Array(8).fill(0).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-900 animate-pulse" />)
            : primaryStat.map(c => <StatCard key={c.label} {...c} />)
          }
        </div>

        {/* Earnings trend + mini sparklines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Earnings trend */}
          <motion.div variants={fadeUp} custom={9} initial="hidden" animate="show"
            className="lg:col-span-2 p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-300">Earnings Trend</h2>
              <span className="text-xs text-slate-500">Approximated from lifetime data</span>
            </div>
            {isLoading ? (
              <div className="h-44 bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={earningsLine} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" hide />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={Math.round((s.totalEarnings || 0) / 10)}
                    stroke="rgba(59,130,246,0.2)" strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone" dataKey="earnings"
                    stroke="#14b8a6" strokeWidth={2} dot={false}
                    activeDot={{ r: 4, fill: '#14b8a6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Mini sparkline cards */}
          <motion.div variants={fadeUp} custom={10} initial="hidden" animate="show"
            className="space-y-3">
            <div className="p-4 rounded-2xl border border-white/[0.06] bg-slate-900/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-400">Consultations</span>
                <span className="text-sm font-black text-white font-mono">{s.totalConsultations ?? 0}</span>
              </div>
              <Sparkline data={sparklineConsults.map((d) => ({ ...d }))} color="#3b82f6" />
            </div>
            <div className="p-4 rounded-2xl border border-white/[0.06] bg-slate-900/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-400">Referrals</span>
                <span className="text-sm font-black text-white font-mono">{s.totalReferrals ?? 0}</span>
              </div>
              <Sparkline data={sparklineReferrals.map((d) => ({ ...d }))} color="#f59e0b" />
            </div>
            <div className="p-4 rounded-2xl border border-white/[0.06] bg-slate-900/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-400">Last Active</span>
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <p className="text-xs font-bold text-teal-400 mt-1">
                {s.lastConsultationAt
                  ? new Date(s.lastConsultationAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'No activity yet'
                }
              </p>
            </div>
          </motion.div>
        </div>

        {/* Detailed info table */}
        <motion.div variants={fadeUp} custom={11} initial="hidden" animate="show"
          className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-400" /> Detailed Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label="Total Consultations"    value={s.totalConsultations?.toLocaleString('en-IN')} />
              <InfoRow label="Video Consultations"    value={s.totalVideoConsultations?.toLocaleString('en-IN')} />
              <InfoRow label="Home Visits"            value={s.totalHomeVisits?.toLocaleString('en-IN')} />
              <InfoRow label="Last Consultation"      value={s.lastConsultationAt ? new Date(s.lastConsultationAt).toLocaleDateString('en-IN') : '—'} />
              <InfoRow label="Total Referrals"        value={s.totalReferrals?.toLocaleString('en-IN')} />
              <InfoRow label="Monthly Referrals"      value={s.monthlyReferrals?.toLocaleString('en-IN')} />
            </div>
            <div>
              <InfoRow label="Total Earnings"         value={`₹${(s.totalEarnings || 0).toLocaleString('en-IN')}`}         color="text-emerald-400" />
              <InfoRow label="Commission Earned"      value={`₹${(s.totalCommissionEarned || 0).toLocaleString('en-IN')}`} color="text-violet-400" />
              <InfoRow label="Pending Settlement"     value={`₹${(s.pendingSettlement || 0).toLocaleString('en-IN')}`}     color="text-amber-400" />
              <InfoRow label="Total Settled"          value={`₹${(s.totalSettled || 0).toLocaleString('en-IN')}`}          color="text-teal-400" />
              <InfoRow label="Last Settlement"        value={s.lastSettledAt ? new Date(s.lastSettledAt).toLocaleDateString('en-IN') : '—'} />
              <InfoRow label="Average Rating"         value={rating.averageRating ? `⭐ ${rating.averageRating.toFixed(2)} / 5` : '—'} color="text-amber-400" />
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}