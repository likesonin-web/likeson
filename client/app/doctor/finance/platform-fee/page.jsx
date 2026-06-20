'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Percent,
  Wallet,
  Building2,
  Stethoscope,
  Info,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  Video,
  Home,
  UserRound,
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

/* ─── ANIMATION VARIANTS ─── */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/* ─── REUSABLE COMPONENTS ─── */
const StatCard = ({ icon: Icon, label, value, subtext, badgeText, isCustom }) => (
  <motion.div variants={fadeUp} className="stat-card relative overflow-hidden group">
    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative z-10 flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-base-100 border border-base-300 shadow-sm">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <span className="stat-card-label m-0">{label}</span>
      </div>
      {isCustom && (
        <span className="badge badge-secondary badge-sm shadow-sm gap-1">
          <Sparkles className="w-3 h-3" /> Custom
        </span>
      )}
      {badgeText && !isCustom && (
        <span className="badge badge-primary badge-sm shadow-sm">
          {badgeText}
        </span>
      )}
    </div>

    <div className="relative z-10">
      <div className="stat-card-value">{value}</div>
      {subtext && <div className="text-sm font-medium text-base-content/50 mt-1">{subtext}</div>}
    </div>
  </motion.div>
);

const PricingRow = ({ icon: Icon, label, fee, isAvailable }) => {
  if (!isAvailable) return null;
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-base-100 border border-base-300 transition-colors hover:border-primary/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold text-sm md:text-base text-base-content">{label}</span>
      </div>
      <div className="text-right">
        <span className="font-montserrat font-bold text-lg text-primary">
          {fee != null ? `₹${fee}` : '—'}
        </span>
      </div>
    </div>
  );
};

const ExplainerStep = ({ step, title, desc }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
      <span className="font-bold text-sm text-primary">{step}</span>
    </div>
    <div className="pt-1 pb-4 border-b border-base-300 last:border-0 last:pb-0 flex-1">
      <p className="text-base font-bold text-base-content">{title}</p>
      <p className="text-sm text-base-content/60 mt-1 leading-relaxed max-w-2xl">{desc}</p>
    </div>
  </div>
);

/* ─── MAIN PAGE COMPONENT ─── */
export default function PlatformFeeInfo() {
  const dispatch = useDispatch();
  const profile = useSelector(selectMyDoctorProfile);
  const loading = useSelector(selectHospitalLoading);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  const isLoading = loading.fetchMyDoctorProfile;

  // Data Extraction
  const pf = profile?.platformFee;
  const hasCustom = profile?.hasCustomPlatformFee;
  const consultationTypes = profile?.consultationTypes || {};
  const fees = profile?.fees || {};
  const primaryHospital = profile?.primaryHospital;
  const isManagedByHospital = primaryHospital?.managementModel === 'hospital-manager';

  return (
    <div className="min-h-screen bg-base-100 pb-16">
      <motion.div 
        variants={staggerContainer} 
        initial="hidden" 
        animate="show" 
        className="container-custom max-w-5xl py-8 md:py-12"
      >
        
        {/* ── Page Header ── */}
        <motion.div variants={fadeUp} className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-2xl bg-primary text-primary-content shadow-primary">
              <Wallet className="w-7 h-7" />
            </div>
            <h1 className="section-heading m-0">Earnings & Fees</h1>
          </div>
          <p className="section-subheading ml-[4.25rem] m-0">
            Transparent breakdown of your platform fees, settlement cycles, and consultation pricing.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="h-36 skeleton rounded-box" />
            <div className="h-36 skeleton rounded-box" />
          </div>
        ) : (
          <>
            {/* ── Understanding Note (Pricing Control Logic) ── */}
            <motion.div variants={fadeUp} className={`alert ${isManagedByHospital ? 'alert-info' : 'alert-success'} mb-8 shadow-sm`}>
              {isManagedByHospital ? <Building2 className="w-6 h-6 flex-shrink-0" /> : <Stethoscope className="w-6 h-6 flex-shrink-0" />}
              <div>
                <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
                  Pricing Control & Management
                </h4>
                <p className="text-sm opacity-90 leading-relaxed">
                  {isManagedByHospital 
                    ? `You are registered under a Managed Hospital (${primaryHospital?.name || 'Admin'}). Your consultation fees are strictly determined and updated by the hospital administration.`
                    : `You are registered as a Doctor-Owner. You have complete administrative control over your consultation pricing and structure.`}
                </p>
              </div>
            </motion.div>

            {/* ── Financial Stats Grid ── */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-10">
              <StatCard
                icon={Percent}
                label="Platform Fee Deduction"
                value={pf ? (pf.type === 'percentage' ? `${pf.value}%` : `₹${pf.value}`) : 'Default'}
                subtext={pf ? (pf.type === 'percentage' ? 'Deducted from each transaction' : 'Flat rate per transaction') : 'Standard global rates apply'}
                badgeText={!hasCustom ? "Global Default" : ""}
                isCustom={hasCustom}
              />
              <StatCard
                icon={Clock}
                label="Payout Settlement"
                value={profile?.settlementCycle ? profile.settlementCycle.charAt(0).toUpperCase() + profile.settlementCycle.slice(1) : 'Monthly'}
                subtext="Cycle for transferring your earnings"
                badgeText="Standard"
                isCustom={false}
              />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              
              {/* ── Left Column: Pricing Details ── */}
              <motion.div variants={fadeUp} className="lg:col-span-3 flex flex-col gap-6">
                <div className="glass-card p-6 md:p-8 h-full">
                  <h2 className="font-montserrat font-bold text-lg md:text-xl flex items-center gap-3 mb-6">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    Consultation Rate Card
                  </h2>
                  
                  <div className="flex flex-col gap-3">
                    <PricingRow 
                      icon={UserRound} 
                      label="In-Person Consultation" 
                      fee={fees.inPersonFee ?? fees.consultationFee} 
                      isAvailable={consultationTypes.inPerson} 
                    />
                    <PricingRow 
                      icon={Video} 
                      label="Video Consultation" 
                      fee={fees.videoFee ?? fees.consultationFee} 
                      isAvailable={consultationTypes.video} 
                    />
                    <PricingRow 
                      icon={Home} 
                      label="Home Visit" 
                      fee={fees.homeVisitFee ?? fees.consultationFee} 
                      isAvailable={consultationTypes.homeVisit} 
                    />
                    
                    <div className="divider my-2" />
                    
                    <PricingRow 
                      icon={CheckCircle2} 
                      label={`Follow-Up (Valid ${fees.followUpValidDays || 7} Days)`} 
                      fee={fees.followUpFee || 0} 
                      isAvailable={true} 
                    />
                  </div>
                </div>
              </motion.div>

              {/* ── Right Column: Explainer ── */}
              <motion.div variants={fadeUp} className="lg:col-span-2 flex flex-col gap-6">
                <div className="card p-6 md:p-8 bg-base-200/50 h-full">
                  <h2 className="font-montserrat font-bold text-lg md:text-xl flex items-center gap-3 mb-6">
                    <Info className="w-5 h-5 text-primary" />
                    How Earnings Work
                  </h2>
                  
                  <div className="flex flex-col gap-5">
                    <ExplainerStep 
                      step="1" 
                      title="Patient Booking" 
                      desc="Patient is charged your exact listed consultation fee at the time of booking confirmation." 
                    />
                    <ExplainerStep 
                      step="2" 
                      title="Fee Deduction" 
                      desc={hasCustom && pf
                        ? `Your negotiated ${pf.type === 'fixed' ? `₹${pf.value} flat` : `${pf.value}%`} platform fee is automatically deducted.`
                        : 'The standard platform infrastructure fee is automatically calculated and deducted.'} 
                    />
                    <ExplainerStep 
                      step="3" 
                      title="Bank Settlement" 
                      desc={`Net earnings are processed and transferred directly to your verified bank account on a ${profile?.settlementCycle || 'monthly'} schedule.`} 
                    />
                  </div>

                  <div className="mt-8 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                    <p className="text-xs text-base-content/70 font-medium">
                      All financial transactions are securely processed and protected. Need to change fees? {isManagedByHospital ? 'Contact your hospital admin.' : 'Update via profile settings.'}
                    </p>
                  </div>
                </div>
              </motion.div>

            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}