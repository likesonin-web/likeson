'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Percent, DollarSign, Layers, Info, CheckCircle,
  ArrowRight, Sparkles, Shield, Clock, Building2
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' } }),
};

const FeeCard = ({ label, value, type, isCustom, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="relative overflow-hidden p-5 rounded-2xl border border-white/[0.06] bg-slate-900/60 group"
  >
    {isCustom && (
      <div className="absolute top-3 right-3">
        <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" /> Custom
        </span>
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-violet-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
      {value !== null && value !== undefined ? (
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white font-mono">
            {type === 'percentage' ? `${value}%` : `₹${value}`}
          </span>
          <span className={`mb-1 text-xs font-semibold px-2 py-0.5 rounded-full
            ${type === 'percentage'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            {type === 'percentage' ? 'of transaction' : 'flat fee'}
          </span>
        </div>
      ) : (
        <span className="text-2xl font-black text-slate-600">Global Default</span>
      )}
    </div>
  </motion.div>
);

const InfoRow = ({ icon: Icon, label, value, color = 'text-blue-400' }) => (
  <div className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0">
    <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
    <span className="text-sm text-slate-400 flex-1">{label}</span>
    <span className="text-sm font-semibold text-white text-right">{value}</span>
  </div>
);

const ExplainerStep = ({ step, title, desc, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="flex gap-4"
  >
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
      <span className="text-xs font-bold text-blue-400">{step}</span>
    </div>
    <div className="pt-0.5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

export default function PlatformFeeInfo() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const loading  = useSelector(selectHospitalLoading);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  const isLoading = loading.fetchMyDoctorProfile;
  const pf = profile?.platformFee;
  const hasCustom = profile?.hasCustomPlatformFee;

  const consultationTypes = profile?.consultationTypes || {};
  const fees = profile?.fees || {};

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-[family-name:var(--font-family-poppins)]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-violet-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-lg shadow-violet-600/20">
              <Percent className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Platform Fee</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Your current platform fee structure and consultation pricing</p>
        </motion.div>

        {/* Status banner */}
        <motion.div
          variants={fadeUp} custom={1} initial="hidden" animate="show"
          className={`mb-6 flex items-start gap-3 p-4 rounded-xl border
            ${hasCustom
              ? 'border-violet-500/20 bg-violet-500/5'
              : 'border-blue-500/20 bg-blue-500/5'}`}
        >
          {hasCustom
            ? <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
            : <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-semibold ${hasCustom ? 'text-violet-300' : 'text-blue-300'}`}>
              {hasCustom ? 'Custom Platform Fee Applied' : 'Global Default Fee Active'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasCustom
                ? 'Your account has a custom platform fee set by the admin, overriding the global default.'
                : 'You are on the standard platform fee. Contact admin for custom pricing arrangements.'}
            </p>
          </div>
        </motion.div>

        {/* Fee Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {[0, 1].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-900 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <FeeCard
              label="Current Platform Fee"
              value={pf?.value}
              type={pf?.type}
              isCustom={hasCustom}
              delay={2}
            />
            <FeeCard
              label="Settlement Cycle"
              value={null}
              type={null}
              isCustom={false}
              delay={3}
            />
          </div>
        )}

        {/* Settlement cycle special card */}
        {!isLoading && (
          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show"
            className="mb-8 p-5 rounded-2xl border border-white/[0.06] bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-teal-400" />
                <div>
                  <p className="text-sm font-semibold text-white capitalize">{profile?.settlementCycle || 'Monthly'} Settlement</p>
                  <p className="text-xs text-slate-500 mt-0.5">Earnings are transferred on a {profile?.settlementCycle || 'monthly'} basis</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600" />
            </div>
          </motion.div>
        )}

        {/* Consultation Fees */}
        <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show"
          className="mb-6 p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Your Consultation Fees
          </h2>
          <div className="space-y-0">
            {consultationTypes.inPerson && (
              <InfoRow icon={Building2} label="In-Person Consultation" value={fees.inPersonFee ? `₹${fees.inPersonFee}` : '—'} color="text-blue-400" />
            )}
            {consultationTypes.video && (
              <InfoRow icon={Layers} label="Video Consultation" value={fees.videoFee ? `₹${fees.videoFee}` : '—'} color="text-violet-400" />
            )}
            {consultationTypes.homeVisit && (
              <InfoRow icon={Building2} label="Home Visit" value={fees.homeVisitFee ? `₹${fees.homeVisitFee}` : '—'} color="text-teal-400" />
            )}
            <InfoRow icon={CheckCircle} label="Follow-Up Fee" value={fees.followUpFee ? `₹${fees.followUpFee}` : '—'} color="text-emerald-400" />
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div variants={fadeUp} custom={5} initial="hidden" animate="show"
          className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-5">
            <Info className="w-3.5 h-3.5 text-blue-400" /> How Platform Fees Work
          </h2>
          <div className="space-y-5">
            <ExplainerStep step="1" delay={6}
              title="Patient pays consultation fee"
              desc="Patient is charged your listed consultation fee when booking an appointment."
            />
            <ExplainerStep step="2" delay={7}
              title="Platform fee is deducted"
              desc={`${hasCustom && pf ? `Your custom ${pf.type === 'fixed' ? `₹${pf.value} flat` : `${pf.value}%`} fee` : 'A platform fee based on the global pricing config'} is deducted from the transaction.`}
            />
            <ExplainerStep step="3" delay={8}
              title="Net amount settled to you"
              desc={`Remaining earnings are settled to your registered bank account on a ${profile?.settlementCycle || 'monthly'} basis.`}
            />
          </div>
        </motion.div>

        {/* Contact note */}
        <motion.div variants={fadeUp} custom={9} initial="hidden" animate="show"
          className="mt-6 text-center">
          <p className="text-xs text-slate-600">
            To negotiate custom platform fee rates, contact your account manager or admin portal.
          </p>
        </motion.div>

      </div>
    </div>
  );
}