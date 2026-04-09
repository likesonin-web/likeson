'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';
import {
  Star, TrendingUp, Award, CheckCircle, Clock,
  Zap, Target, Activity, ShieldCheck, UserCheck, BarChart3
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
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: 'easeOut' } }),
};

const ProgressBar = ({ label, value, max, color, icon: Icon, delay }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show" className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs font-semibold text-slate-400">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white font-mono">{value.toLocaleString('en-IN')}</span>
          <span className="text-xs text-slate-600">/ {max.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: delay * 0.08 + 0.3, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `var(--tw-gradient-stops, ${color})` }}
        />
      </div>
    </motion.div>
  );
};

const ScoreRing = ({ value, label, color, delay, size = 100 }) => {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show"
      className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={7} fill="none" />
          <motion.circle
            cx={size/2} cy={size/2} r={r}
            stroke={color} strokeWidth={7} fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, delay: delay * 0.08, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-white font-mono">{value}%</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 text-center leading-tight">{label}</p>
    </motion.div>
  );
};

const BadgeCard = ({ icon: Icon, title, desc, color, achieved, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-4 rounded-xl border transition-all
      ${achieved
        ? 'border-white/10 bg-slate-900/60'
        : 'border-white/[0.04] bg-slate-900/30 opacity-50'}`}
  >
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${achieved ? `bg-gradient-to-br ${color}` : 'bg-slate-800'} shadow`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className={`text-sm font-bold ${achieved ? 'text-white' : 'text-slate-600'}`}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        {achieved && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Achieved
          </span>
        )}
      </div>
    </div>
  </motion.div>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-xs font-bold text-white">{payload[0]?.payload?.subject}</p>
      <p className="text-xs text-blue-400">{payload[0]?.value} pts</p>
    </div>
  );
};

export default function Performance() {
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

  const s = stats?.stats || {};
  const rating = stats?.rating || {};
  const isLoading = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;
  const completion = profile?.profileCompletionPercent ?? 0;

  // Compute a simple overall performance score
  const ratingScore = Math.round((rating.averageRating || 0) / 5 * 100);
  const consultScore = Math.min(100, Math.round(((s.totalConsultations || 0) / 50) * 100));
  const settleScore  = s.totalEarnings > 0
    ? Math.round(((s.totalSettled || 0) / s.totalEarnings) * 100)
    : 0;
  const overallScore = Math.round((ratingScore + consultScore + completion + settleScore) / 4);

  const radarData = [
    { subject: 'Rating',      A: ratingScore,  fullMark: 100 },
    { subject: 'Consults',    A: consultScore,  fullMark: 100 },
    { subject: 'Profile',     A: completion,    fullMark: 100 },
    { subject: 'Settlement',  A: settleScore,   fullMark: 100 },
    { subject: 'Referrals',   A: Math.min(100, ((s.totalReferrals || 0) / 20) * 100), fullMark: 100 },
  ];

  const badges = [
    { icon: Star,       title: 'Top Rated',      desc: 'Rating ≥ 4.5',               color: 'from-amber-600 to-amber-500',    achieved: (rating.averageRating || 0) >= 4.5 },
    { icon: Zap,        title: 'Active Partner',  desc: 'Partnership Active & KYC OK', color: 'from-blue-600 to-blue-500',     achieved: profile?.partnershipStatus === 'Active' && profile?.kycStatus === 'verified' },
    { icon: Target,     title: 'High Volume',     desc: '50+ consultations',           color: 'from-violet-600 to-violet-500', achieved: (s.totalConsultations || 0) >= 50 },
    { icon: UserCheck,  title: 'KYC Verified',    desc: 'Identity confirmed',          color: 'from-teal-600 to-teal-500',     achieved: profile?.kycStatus === 'verified' },
    { icon: ShieldCheck,'title': 'Bank Verified', desc: 'Payout enabled',             color: 'from-emerald-600 to-emerald-500', achieved: profile?.bankDetails?.isBankVerified },
    { icon: Award,      title: 'Profile Pro',     desc: '80%+ profile completion',     color: 'from-rose-600 to-rose-500',     achieved: completion >= 80 },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-[family-name:var(--font-family-poppins)]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-72 h-72 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 shadow-lg shadow-amber-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Performance</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Track your quality metrics and achievements</p>
        </motion.div>

        {/* Overall + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Score rings */}
          <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">Score Overview</h2>
            {isLoading ? (
              <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <>
                <div className="flex items-center justify-center mb-6">
                  <ScoreRing value={overallScore} label="Overall Score" color="#3b82f6" delay={2} size={120} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <ScoreRing value={ratingScore}  label="Rating"     color="#f59e0b" delay={3} />
                  <ScoreRing value={consultScore} label="Volume"     color="#8b5cf6" delay={4} />
                  <ScoreRing value={completion}   label="Profile"    color="#14b8a6" delay={5} />
                  <ScoreRing value={settleScore}  label="Settlement" color="#10b981" delay={6} />
                </div>
              </>
            )}
          </motion.div>

          {/* Radar */}
          <motion.div variants={fadeUp} custom={7} initial="hidden" animate="show"
            className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Performance Radar</h2>
            {isLoading ? (
              <div className="h-60 bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
                  <Radar
                    name="Score" dataKey="A"
                    stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Progress bars */}
        <motion.div variants={fadeUp} custom={8} initial="hidden" animate="show"
          className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50 mb-8">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-5">Progress Metrics</h2>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-8 bg-slate-800 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <ProgressBar label="Profile Completion"   value={completion}                     max={100}  color="text-blue-400"   icon={UserCheck}  delay={9} />
              <ProgressBar label="Consultations"        value={s.totalConsultations || 0}      max={Math.max(50, s.totalConsultations || 0)} color="text-violet-400" icon={Activity} delay={10} />
              <ProgressBar label="Referrals"            value={s.totalReferrals || 0}          max={Math.max(20, s.totalReferrals || 0)}      color="text-amber-400"  icon={TrendingUp} delay={11} />
              <ProgressBar label="Home Visits"          value={s.totalHomeVisits || 0}         max={Math.max(20, s.totalHomeVisits || 0)}     color="text-teal-400"   icon={Clock}     delay={12} />
              <ProgressBar label="Total Ratings"        value={rating.totalRatings || 0}       max={Math.max(50, rating.totalRatings || 0)}   color="text-amber-400"  icon={Star}      delay={13} />
              <ProgressBar label="Monthly Referrals"    value={s.monthlyReferrals || 0}        max={Math.max(10, s.monthlyReferrals || 0)}    color="text-rose-400"   icon={Target}    delay={14} />
            </div>
          )}
        </motion.div>

        {/* Badges */}
        <div>
          <motion.h2 variants={fadeUp} custom={15} initial="hidden" animate="show"
            className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-amber-400" /> Achievements
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoading
              ? Array(6).fill(0).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-900 animate-pulse" />)
              : badges.map((b, i) => <BadgeCard key={b.title} {...b} delay={16 + i} />)
            }
          </div>
        </div>

      </div>
    </div>
  );
}