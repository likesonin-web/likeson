'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Percent, DollarSign, Layers, Info, CheckCircle,
  ArrowRight, Sparkles, Shield, Clock, Building2,
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

/* ─── animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
};

/* ─── fee card ─── */
const FeeCard = ({ label, value, type, isCustom, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="relative overflow-hidden p-5 rounded-2xl border border-base-300/60 bg-base-200 group"
  >
    {isCustom && (
      <div className="absolute top-3 right-3">
        <span className="badge badge-secondary text-[10px] gap-1">
          <Sparkles className="w-2.5 h-2.5" /> Custom
        </span>
      </div>
    )}
    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10">
      <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-3">{label}</p>
      {value !== null && value !== undefined ? (
        <div className="flex items-end gap-2 flex-wrap">
          <span className="text-3xl font-black text-base-content font-mono">
            {type === 'percentage' ? `${value}%` : `₹${value}`}
          </span>
          <span className={`mb-1 badge ${type === 'percentage' ? 'badge-primary' : 'badge-success'}`}>
            {type === 'percentage' ? 'of transaction' : 'flat fee'}
          </span>
        </div>
      ) : (
        <span className="text-2xl font-black text-base-content/30">Global Default</span>
      )}
    </div>
  </motion.div>
);

/* ─── info row ─── */
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 py-3 border-b border-base-300/60 last:border-0">
    <Icon className="w-4 h-4 text-primary flex-shrink-0" />
    <span className="text-sm text-base-content/50 flex-1">{label}</span>
    <span className="text-sm font-semibold text-base-content text-right">{value}</span>
  </div>
);

/* ─── explainer step ─── */
const ExplainerStep = ({ step, title, desc, delay }) => (
  <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show" className="flex gap-4">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
      <span className="text-xs font-bold text-primary">{step}</span>
    </div>
    <div className="pt-0.5">
      <p className="text-sm font-semibold text-base-content">{title}</p>
      <p className="text-xs text-base-content/40 mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

/* ─── section card ─── */
const SectionCard = ({ children, delay, className = '' }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-6 rounded-2xl border border-base-300/60 bg-base-200 ${className}`}
  >
    {children}
  </motion.div>
);

const SectionTitle = ({ children, icon: Icon }) => (
  <h2 className="text-xs font-bold text-base-content/50 uppercase tracking-widest flex items-center gap-2 mb-4">
    <Icon className="w-3.5 h-3.5 text-primary" />
    {children}
  </h2>
);

/* ─── main page ─── */
export default function PlatformFeeInfo() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const loading  = useSelector(selectHospitalLoading);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  const isLoading        = loading.fetchMyDoctorProfile;
  const pf               = profile?.platformFee;
  const hasCustom        = profile?.hasCustomPlatformFee;
  const consultationTypes = profile?.consultationTypes || {};
  const fees             = profile?.fees || {};

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-primary">
              <Percent className="w-5 h-5 text-primary-content" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-base-content">Platform Fee</h1>
          </div>
          <p className="text-sm text-base-content/50 ml-[3.25rem]">
            Your current platform fee structure and consultation pricing
          </p>
        </motion.div>

        {/* ── Status banner ── */}
        <motion.div
          variants={fadeUp} custom={1} initial="hidden" animate="show"
          className={`mb-6 flex items-start gap-3 p-4 rounded-xl border ${
            hasCustom
              ? 'border-secondary/30 bg-secondary/5'
              : 'border-primary/20 bg-primary/5'
          }`}
        >
          {hasCustom
            ? <Sparkles className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            : <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-semibold ${hasCustom ? 'text-secondary' : 'text-primary'}`}>
              {hasCustom ? 'Custom Platform Fee Applied' : 'Global Default Fee Active'}
            </p>
            <p className="text-xs text-base-content/50 mt-0.5">
              {hasCustom
                ? 'Your account has a custom platform fee set by the admin, overriding the global default.'
                : 'You are on the standard platform fee. Contact admin for custom pricing arrangements.'
              }
            </p>
          </div>
        </motion.div>

        {/* ── Fee cards ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {[0, 1].map((i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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

        {/* ── Settlement cycle ── */}
        {!isLoading && (
          <motion.div
            variants={fadeUp} custom={3} initial="hidden" animate="show"
            className="mb-6 p-5 rounded-2xl border border-base-300/60 bg-base-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-accent flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-base-content capitalize">
                    {profile?.settlementCycle || 'Monthly'} Settlement
                  </p>
                  <p className="text-xs text-base-content/40 mt-0.5">
                    Earnings are transferred on a {profile?.settlementCycle || 'monthly'} basis
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-base-content/20" />
            </div>
          </motion.div>
        )}

        {/* ── Consultation fees ── */}
        <SectionCard delay={4} className="mb-6">
          <SectionTitle icon={DollarSign}>Your Consultation Fees</SectionTitle>
          <div className="space-y-0">
            {consultationTypes.inPerson && (
              <InfoRow icon={Building2} label="In-Person Consultation" value={fees.inPersonFee ? `₹${fees.inPersonFee}` : '—'} />
            )}
            {consultationTypes.video && (
              <InfoRow icon={Layers} label="Video Consultation" value={fees.videoFee ? `₹${fees.videoFee}` : '—'} />
            )}
            {consultationTypes.homeVisit && (
              <InfoRow icon={Building2} label="Home Visit" value={fees.homeVisitFee ? `₹${fees.homeVisitFee}` : '—'} />
            )}
            <InfoRow icon={CheckCircle} label="Follow-Up Fee" value={fees.followUpFee ? `₹${fees.followUpFee}` : '—'} />
          </div>
        </SectionCard>

        {/* ── How it works ── */}
        <SectionCard delay={5}>
          <SectionTitle icon={Info}>How Platform Fees Work</SectionTitle>
          <div className="space-y-5">
            <ExplainerStep
              step="1" delay={6}
              title="Patient pays consultation fee"
              desc="Patient is charged your listed consultation fee when booking an appointment."
            />
            <ExplainerStep
              step="2" delay={7}
              title="Platform fee is deducted"
              desc={`${hasCustom && pf
                ? `Your custom ${pf.type === 'fixed' ? `₹${pf.value} flat` : `${pf.value}%`} fee`
                : 'A platform fee based on the global pricing config'
              } is deducted from the transaction.`}
            />
            <ExplainerStep
              step="3" delay={8}
              title="Net amount settled to you"
              desc={`Remaining earnings are settled to your registered bank account on a ${profile?.settlementCycle || 'monthly'} basis.`}
            />
          </div>
        </SectionCard>

        {/* ── Contact note ── */}
        <motion.div variants={fadeUp} custom={9} initial="hidden" animate="show" className="mt-6 text-center">
          <p className="text-xs text-base-content/30">
            To negotiate custom platform fee rates, contact your account manager or admin portal.
          </p>
        </motion.div>

      </div>
    </div>
  );
}