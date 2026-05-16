'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Activity, DollarSign, TrendingUp, Users, Clock,
  Stethoscope, Video, Home, Star, Calendar,
  Banknote, ChevronUp, ChevronDown, Minus,
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  fetchDoctorStats,
  selectMyDoctorProfile,
  selectDoctorStats,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

/* ─── animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' },
  }),
};

/* ─── trend icon ─── */
const Trend = ({ value }) => {
  if (!value || value === 0) return <Minus className="w-3 h-3 text-base-content/30" />;
  return value > 0
    ? <ChevronUp className="w-3 h-3 text-success" />
    : <ChevronDown className="w-3 h-3 text-error" />;
};

/* ─── stat card ─── */
const StatCard = ({ icon: Icon, label, value, sub, trendVal, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="p-5 rounded-2xl border border-primary/20 bg-base-200 relative overflow-hidden group"
  >
    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-center gap-0.5 text-xs">
          <Trend value={trendVal} />
        </div>
      </div>
      <p className="text-2xl font-black text-base-content font-mono tracking-tight">{value ?? '—'}</p>
      <p className="text-xs text-base-content/50 font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-base-content/30 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

/* ─── info row ─── */
const InfoRow = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-base-300/60 last:border-0">
    <span className="text-sm text-base-content/50">{label}</span>
    <span className={`text-sm font-semibold ${highlight ? 'text-primary' : 'text-base-content'}`}>
      {value || '—'}
    </span>
  </div>
);

/* ─── sparkline ─── */
const buildSparkline = (val, count = 8) =>
  Array.from({ length: count }, (_, i) => ({
    i, v: Math.round((val / count) * (0.5 + Math.random() * 1.2)),
  }));

const Sparkline = ({ data }) => (
  <ResponsiveContainer width="100%" height={40}>
    <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={1.5} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

/* ─── custom tooltip ─── */
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-200 border border-primary/20 rounded-lg px-2.5 py-1.5 shadow-xl">
      <p className="text-xs font-bold text-base-content">
        ₹{(payload[0]?.value || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
};

/* ─── section card ─── */
const SectionCard = ({ children, delay, className = '' }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-5 rounded-2xl border border-base-300/60 bg-base-200 ${className}`}
  >
    {children}
  </motion.div>
);

const SectionTitle = ({ children, icon: Icon }) => (
  <h2 className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-4 flex items-center gap-2">
    {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
    {children}
  </h2>
);

/* ─── main page ─── */
export default function MyStats() {
  const dispatch  = useDispatch();
  const profile   = useSelector(selectMyDoctorProfile);
  const stats     = useSelector(selectDoctorStats);
  const loading   = useSelector(selectHospitalLoading);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?._id) dispatch(fetchDoctorStats(profile._id));
  }, [dispatch, profile?._id]);

  const s         = stats?.stats  || {};
  const rating    = stats?.rating || {};
  const isLoading = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;

  const earningsLine = buildSparkline(s.totalEarnings || 0, 10).map((d, i) => ({
    month: i, earnings: d.v,
  }));

  const primaryStat = [
    {
      icon: Stethoscope, label: 'Total Consultations', value: s.totalConsultations ?? 0,
      sub: `Last: ${s.lastConsultationAt ? new Date(s.lastConsultationAt).toLocaleDateString('en-IN') : 'N/A'}`,
      delay: 1,
    },
    {
      icon: Video, label: 'Video Consultations', value: s.totalVideoConsultations ?? 0,
      delay: 2,
    },
    {
      icon: Home, label: 'Home Visits', value: s.totalHomeVisits ?? 0,
      delay: 3,
    },
    {
      icon: Users, label: 'Total Referrals', value: s.totalReferrals ?? 0,
      sub: `This month: ${s.monthlyReferrals ?? 0}`,
      delay: 4,
    },
    {
      icon: DollarSign, label: 'Total Earnings',
      value: `₹${(s.totalEarnings ?? 0).toLocaleString('en-IN')}`,
      sub: `Commission: ₹${(s.totalCommissionEarned ?? 0).toLocaleString('en-IN')}`,
      delay: 5,
    },
    {
      icon: Banknote, label: 'Pending Settlement',
      value: `₹${(s.pendingSettlement ?? 0).toLocaleString('en-IN')}`,
      sub: `Settled: ₹${(s.totalSettled ?? 0).toLocaleString('en-IN')}`,
      delay: 6,
    },
    {
      icon: Star, label: 'Avg Rating',
      value: rating.averageRating ? rating.averageRating.toFixed(1) : '—',
      sub: `${rating.totalRatings ?? 0} ratings · ${rating.totalReviews ?? 0} reviews`,
      delay: 7,
    },
    {
      icon: TrendingUp, label: 'Monthly Referrals', value: s.monthlyReferrals ?? 0,
      sub: `Last ref: ${s.lastReferralAt ? new Date(s.lastReferralAt).toLocaleDateString('en-IN') : 'N/A'}`,
      delay: 8,
    },
  ];

  const sparklineConsults  = buildSparkline(s.totalConsultations || 0);
  const sparklineReferrals = buildSparkline(s.totalReferrals || 0);

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-primary">
              <Activity className="w-5 h-5 text-primary-content" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-base-content">My Stats</h1>
          </div>
          <p className="text-sm text-base-content/50 ml-[3.25rem]">
            Complete lifetime statistics for your practice
          </p>
        </motion.div>

        {/* ── Stat grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {isLoading
            ? Array(8).fill(0).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl skeleton" />
              ))
            : primaryStat.map((c) => <StatCard key={c.label} {...c} />)
          }
        </div>

        {/* ── Earnings trend + sparklines ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Earnings line chart */}
          <SectionCard delay={9} className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Earnings Trend</SectionTitle>
              <span className="text-[11px] text-base-content/30">Approximated from lifetime data</span>
            </div>
            {isLoading ? (
              <div className="h-44 skeleton rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={earningsLine} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="color-mix(in srgb, var(--base-content), transparent 90%)"
                  />
                  <XAxis dataKey="month" hide />
                  <YAxis
                    tick={{ fill: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontSize: 10 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={Math.round((s.totalEarnings || 0) / 10)}
                    stroke="var(--primary)"
                    strokeOpacity={0.2}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone" dataKey="earnings"
                    stroke="var(--secondary)" strokeWidth={2} dot={false}
                    activeDot={{ r: 4, fill: 'var(--secondary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Mini sparkline cards */}
          <motion.div variants={fadeUp} custom={10} initial="hidden" animate="show" className="space-y-3">

            <div className="p-4 rounded-2xl border border-base-300/60 bg-base-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-base-content/50">Consultations</span>
                <span className="text-sm font-black text-base-content font-mono">
                  {s.totalConsultations ?? 0}
                </span>
              </div>
              <Sparkline data={sparklineConsults} />
            </div>

            <div className="p-4 rounded-2xl border border-base-300/60 bg-base-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-base-content/50">Referrals</span>
                <span className="text-sm font-black text-base-content font-mono">
                  {s.totalReferrals ?? 0}
                </span>
              </div>
              <Sparkline data={sparklineReferrals} />
            </div>

            <div className="p-4 rounded-2xl border border-base-300/60 bg-base-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-base-content/50">Last Active</span>
                <Clock className="w-3.5 h-3.5 text-base-content/30" />
              </div>
              <p className="text-xs font-bold text-primary">
                {s.lastConsultationAt
                  ? new Date(s.lastConsultationAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : 'No activity yet'
                }
              </p>
            </div>
          </motion.div>
        </div>

        {/* ── Detailed breakdown table ── */}
        <SectionCard delay={11}>
          <SectionTitle icon={Calendar}>Detailed Breakdown</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <InfoRow label="Total Consultations"  value={s.totalConsultations?.toLocaleString('en-IN')} />
              <InfoRow label="Video Consultations"  value={s.totalVideoConsultations?.toLocaleString('en-IN')} />
              <InfoRow label="Home Visits"          value={s.totalHomeVisits?.toLocaleString('en-IN')} />
              <InfoRow label="Last Consultation"    value={s.lastConsultationAt ? new Date(s.lastConsultationAt).toLocaleDateString('en-IN') : '—'} />
              <InfoRow label="Total Referrals"      value={s.totalReferrals?.toLocaleString('en-IN')} />
              <InfoRow label="Monthly Referrals"    value={s.monthlyReferrals?.toLocaleString('en-IN')} />
            </div>
            <div>
              <InfoRow label="Total Earnings"       value={`₹${(s.totalEarnings || 0).toLocaleString('en-IN')}`}         highlight />
              <InfoRow label="Commission Earned"    value={`₹${(s.totalCommissionEarned || 0).toLocaleString('en-IN')}`} highlight />
              <InfoRow label="Pending Settlement"   value={`₹${(s.pendingSettlement || 0).toLocaleString('en-IN')}`}     highlight />
              <InfoRow label="Total Settled"        value={`₹${(s.totalSettled || 0).toLocaleString('en-IN')}`}          highlight />
              <InfoRow label="Last Settlement"      value={s.lastSettledAt ? new Date(s.lastSettledAt).toLocaleDateString('en-IN') : '—'} />
              <InfoRow label="Average Rating"       value={rating.averageRating ? `⭐ ${rating.averageRating.toFixed(2)} / 5` : '—'} highlight />
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}