'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Activity, Users, Calendar, TrendingUp, Star, Clock,
  CheckCircle, AlertCircle, Wallet, Stethoscope, ArrowUpRight,
  Building2, Video, Home, UserCheck
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  fetchDoctorStats,
  selectMyDoctorProfile,
  selectDoctorStats,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' } }),
};

const pulse = {
  animate: { scale: [1, 1.04, 1], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
};

const StatusBadge = ({ status }) => {
  const map = {
    Active:    { bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-400', label: 'Active' },
    Pending:   { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',       dot: 'bg-amber-400',   label: 'Pending' },
    Inactive:  { bg: 'bg-slate-500/15 border-slate-500/30 text-slate-400',       dot: 'bg-slate-400',   label: 'Inactive' },
    Suspended: { bg: 'bg-red-500/15 border-red-500/30 text-red-400',             dot: 'bg-red-400',     label: 'Suspended' },
  };
  const cfg = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      {cfg.label}
    </span>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, color, delay, trend }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-slate-900 to-slate-800/60 p-5 group"
  >
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${color} pointer-events-none`} />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" /> {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-white font-mono tracking-tight">{value ?? '—'}</p>
      <p className="text-xs text-slate-400 mt-1 font-medium">{label}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

const QuickAction = ({ icon: Icon, label, href, color, delay }) => (
  <motion.a
    href={href}
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/[0.06] bg-slate-900/60 hover:bg-slate-800/80 transition-all cursor-pointer group"
  >
    <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg group-hover:shadow-xl transition-shadow`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <span className="text-[11px] text-slate-400 font-medium text-center leading-tight">{label}</span>
  </motion.a>
);

export default function DoctorDashboard() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const stats    = useSelector(selectDoctorStats);
  const loading  = useSelector(selectHospitalLoading);

  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile?._id) dispatch(fetchDoctorStats(profile._id));
  }, [dispatch, profile?._id]);

  const s = stats?.stats || {};
  const kpiCards = [
    { icon: Stethoscope, label: 'Total Consultations', value: s.totalConsultations ?? 0, color: 'from-blue-600/20 to-blue-500/10', trend: null, delay: 1 },
    { icon: Video,       label: 'Video Consultations', value: s.totalVideoConsultations ?? 0, color: 'from-violet-600/20 to-violet-500/10', trend: null, delay: 2 },
    { icon: Home,        label: 'Home Visits',          value: s.totalHomeVisits ?? 0, color: 'from-teal-600/20 to-teal-500/10', trend: null, delay: 3 },
    { icon: Users,       label: 'Total Referrals',      value: s.totalReferrals ?? 0, color: 'from-amber-600/20 to-amber-500/10', trend: null, delay: 4 },
    { icon: TrendingUp,  label: 'Total Earnings',       value: s.totalEarnings ? `₹${s.totalEarnings.toLocaleString('en-IN')}` : '₹0', color: 'from-emerald-600/20 to-emerald-500/10', trend: null, delay: 5 },
    { icon: Wallet,      label: 'Pending Settlement',   value: s.pendingSettlement ? `₹${s.pendingSettlement.toLocaleString('en-IN')}` : '₹0', color: 'from-orange-600/20 to-orange-500/10', trend: null, delay: 6 },
  ];

  const quickActions = [
    { icon: Calendar,    label: 'Availability',   href: '/doctor/availability',    color: 'from-blue-600 to-blue-500',    delay: 1 },
    { icon: UserCheck,   label: 'KYC Status',     href: '/doctor/kyc',             color: 'from-violet-600 to-violet-500', delay: 2 },
    { icon: Building2,   label: 'My Hospitals',   href: '/doctor/hospitals',       color: 'from-teal-600 to-teal-500',    delay: 3 },
    { icon: Wallet,      label: 'Bank Details',   href: '/doctor/bank',            color: 'from-emerald-600 to-emerald-500', delay: 4 },
    { icon: Activity,    label: 'Analytics',      href: '/doctor/analytics',       color: 'from-amber-600 to-amber-500',  delay: 5 },
    { icon: Star,        label: 'Performance',    href: '/doctor/performance',     color: 'from-pink-600 to-pink-500',    delay: 6 },
  ];

  const isLoading = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-[family-name:var(--font-family-poppins)]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-violet-600/6 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-teal-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {isLoading ? (
                <div className="w-16 h-16 rounded-2xl bg-slate-800 animate-pulse" />
              ) : (
                <motion.div {...pulse} className="relative">
                  <img
                    src={profile?.profilePhotoUrl || profile?.user?.avatar || '/placeholder-doctor.png'}
                    alt="Doctor"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500/30"
                  />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#080c14] ${profile?.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                </motion.div>
              )}
              <div>
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-black tracking-tight">
                      Dr. {profile?.user?.name || 'Doctor'}
                    </h1>
                    <p className="text-slate-400 text-sm">{profile?.specialization} · {profile?.experienceYears}y exp</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!isLoading && profile && (
                <>
                  <StatusBadge status={profile.partnershipStatus} />
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold
                    ${profile.kycStatus === 'verified'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                    KYC: {profile.kycStatus?.replace('-', ' ').toUpperCase()}
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Profile completion */}
        {!isLoading && profile && (
          <motion.div variants={fadeUp} custom={0.5} initial="hidden" animate="show"
            className="mb-6 p-4 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-300">Profile Completion</span>
              <span className="text-sm font-bold text-blue-400">{profile.profileCompletionPercent ?? 0}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${profile.profileCompletionPercent ?? 0}%` }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-blue-600 to-violet-500 rounded-full"
              />
            </div>
            {profile.profileCompletionPercent < 100 && (
              <p className="text-[11px] text-slate-500 mt-1.5">Complete your profile to unlock all features</p>
            )}
          </motion.div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
          {isLoading
            ? Array(6).fill(0).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-slate-900 animate-pulse" />)
            : kpiCards.map((c) => <KpiCard key={c.label} {...c} />)
          }
        </div>

        {/* Quick Actions + Info row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Quick Actions */}
          <motion.div variants={fadeUp} custom={7} initial="hidden" animate="show"
            className="lg:col-span-2 p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {quickActions.map(a => <QuickAction key={a.label} {...a} />)}
            </div>
          </motion.div>

          {/* Rating & Settlement */}
          <motion.div variants={fadeUp} custom={8} initial="hidden" animate="show"
            className="space-y-3">
            {/* Rating */}
            <div className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-slate-300">Rating</span>
              </div>
              {isLoading ? <div className="h-8 bg-slate-800 rounded animate-pulse" /> : (
                <>
                  <p className="text-3xl font-black text-amber-400">
                    {stats?.rating?.averageRating?.toFixed(1) ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{stats?.rating?.totalRatings ?? 0} ratings</p>
                </>
              )}
            </div>
            {/* Settlement */}
            <div className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-bold text-slate-300">Settlement</span>
              </div>
              {isLoading ? <div className="h-8 bg-slate-800 rounded animate-pulse" /> : (
                <>
                  <p className="text-lg font-bold text-teal-400 capitalize">{profile?.settlementCycle ?? 'Monthly'}</p>
                  <p className="text-xs text-slate-500 mt-1">₹{(s.totalSettled ?? 0).toLocaleString('en-IN')} total settled</p>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          {!isLoading && profile?.kycStatus !== 'verified' && (
            <motion.div variants={fadeUp} custom={9} initial="hidden" animate="show"
              className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">KYC Incomplete</p>
                <p className="text-xs text-slate-400 mt-0.5">Complete KYC verification to receive settlements and activate your account.</p>
              </div>
            </motion.div>
          )}
          {!isLoading && !profile?.bankDetails?.isBankVerified && (
            <motion.div variants={fadeUp} custom={10} initial="hidden" animate="show"
              className="flex items-start gap-3 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
              <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-300">Bank Unverified</p>
                <p className="text-xs text-slate-400 mt-0.5">Add and verify bank details to receive earnings settlements.</p>
              </div>
            </motion.div>
          )}
          {!isLoading && profile?.partnershipStatus === 'Active' && profile?.kycStatus === 'verified' && profile?.bankDetails?.isBankVerified && (
            <motion.div variants={fadeUp} custom={9} initial="hidden" animate="show"
              className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">All Systems Active</p>
                <p className="text-xs text-slate-400 mt-0.5">Your account is fully verified and ready to receive patients.</p>
              </div>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}