"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, MapPin, Clock, ShieldAlert, Star,
  Wallet, CheckCircle, Power, ChevronRight,
  AlertTriangle, Calendar, Award, BookOpen, Navigation, Activity,
  LayoutDashboard, UserCog, HelpCircle // Added new icons for quick links
} from 'lucide-react';

import {
  getProfile,
  selectProfile, selectIsOnline, selectCurrentStatus,
  selectProfileCompletion, selectPerformance, selectEarnings, selectLoadingKey, selectErrorKey,
  updateAvailability, updateStatus
} from '@/store/slices/careAssistantSlice';

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER (10/10 UI avoids spinners for main layouts)
// ─────────────────────────────────────────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="min-h-screen bg-base-100/50 p-4 space-y-8 animate-pulse">
    <div className="flex gap-6 items-center border-b border-base-300/50 pb-6">
      <div className="w-24 h-24 rounded-full bg-base-300"></div>
      <div className="space-y-3 flex-1">
        <div className="h-8 w-48 bg-base-300 rounded"></div>
        <div className="h-4 w-32 bg-base-300 rounded"></div>
      </div>
      <div className="w-64 h-16 bg-base-300 rounded-2xl"></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-2 h-64 bg-base-300 rounded-3xl"></div>
      <div className="col-span-1 h-64 bg-base-300 rounded-3xl"></div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-base-300 rounded-2xl"></div>)}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CareHome() {
  const dispatch = useDispatch();
  const router = useRouter(); // Initialize router for button navigation

  const profile = useSelector(selectProfile);
  const isOnline = useSelector(selectIsOnline);
  const currentStatus = useSelector(selectCurrentStatus);
  const completion = useSelector(selectProfileCompletion);
  const performance = useSelector(selectPerformance);
  const earnings = useSelector(selectEarnings);
  
  const isProfileLoading = useSelector(selectLoadingKey('profile'));
  const profileError = useSelector(selectErrorKey('profile'));
  const isAvailabilityLoading = useSelector(selectLoadingKey('availability'));
  const isStatusLoading = useSelector(selectLoadingKey('status'));

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  const handleToggleOnline = () => {
    dispatch(updateAvailability({ 
      isOnline: !isOnline,
      currentCity: profile?.availability?.currentCity || 'Unknown' 
    }));
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === currentStatus) return;
    dispatch(updateStatus({ status: newStatus }));
  };

  // ── ERROR / LOADING HANDLERS ────────────────────────────────────────────────
  if (isProfileLoading || (!profile && !profileError)) return <DashboardSkeleton />;
  
  if (profileError && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-6" data-theme="care-assistant">
        <div className="card max-w-md w-full p-8 text-center border-error/30 bg-error/5 backdrop-blur-strong shadow-lg">
          <ShieldAlert size={48} className="text-error mx-auto mb-4" />
          <h3 className="font-montserrat text-xl font-bold text-base-content mb-2">Connection Failed</h3>
          <p className="text-base-content/60 text-sm mb-6">{profileError}</p>
          <button onClick={() => dispatch(getProfile())} className="btn btn-primary-cta w-full">Retry Connection</button>
        </div>
      </div>
    );
  }

  // ── DERIVED STATE FROM SCHEMAS ──────────────────────────────────────────────
  const kycStatus = profile?.kyc?.verificationStatus || 'Pending';
  const isDispatchable = profile?.isDispatchable;
  const isMedicallyFit = profile?.healthDeclaration?.isMedicallyFit;
  
  // Extract training credentials for badges
  const credentials = [];
  if (profile?.training?.isFirstAidCertified) credentials.push('First Aid Certified');
  if (profile?.training?.woundCare) credentials.push('Wound Care');
  if (profile?.training?.medicationManagement) credentials.push('Medication Mgmt');

  return (
    <div className="min-h-screen bg-base-100/40 pb-24 pt-6 md:pt-10 px-4 sm:px-6 lg:px-8 safe-bottom safe-top" data-theme="care-assistant">
      
      {/* Ambient Glow matching role theme */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] bg-primary/10 rounded-[100%] blur-[120px] pointer-events-none -z-10 mix-blend-multiply dark:mix-blend-screen"></div>

      <motion.div 
        className="max-w-7xl mx-auto space-y-6 md:space-y-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        
        {/* ══════════════════════════════════════════════════════════════════════
            1. PREMIUM HEADER (Identity & Trust Metrics)
            ══════════════════════════════════════════════════════════════════════ */}
        <motion.header variants={fadeUpVariants} className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-6 border-b border-base-300/60">
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-base-200 border-4 border-base-100 shadow-md overflow-hidden flex items-center justify-center relative z-10">
                {profile.photoUrl || profile.user?.avatar ? (
                  <img src={profile.photoUrl || profile.user.avatar} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  <User size={40} className="text-base-content/20" />
                )}
              </div>
              <div className={`absolute bottom-1 right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-4 border-base-100 z-20 ${isOnline ? 'bg-success shadow-[0_0_12px_var(--success)]' : 'bg-base-300'}`}></div>
            </div>
            
            <div className="pt-1">
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-2xl sm:text-4xl font-montserrat font-black text-base-content tracking-tight">
                  {profile.fullName}
                </h1>
                {kycStatus === 'Verified' && (
                  <div className="bg-success/10 text-success p-1.5 rounded-full" title="Verified KYC">
                    <CheckCircle size={16} strokeWidth={3} />
                  </div>
                )}
                {isMedicallyFit && (
                  <div className="bg-info/10 text-info p-1.5 rounded-full hidden sm:block" title="Medically Fit">
                    <Activity size={16} strokeWidth={3} />
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                <span className="badge badge-primary badge-sm sm:badge-md font-bold">{profile.workType || 'Part-Time'}</span>
                <span className="flex items-center gap-1 text-base-content/60 font-medium">
                  <MapPin size={14} /> {profile?.availability?.currentCity || 'Location Pending'}
                </span>
              </div>

              {/* Surface Training Credentials */}
              {credentials.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {credentials.map(cert => (
                    <span key={cert} className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-base-200 text-base-content/60 px-2 py-1 rounded-md border border-base-300">
                      {cert}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile Completion Widget */}
          <div className="w-full xl:w-80 bg-base-100 rounded-2xl p-5 shadow-sm border border-base-200">
            <div className="flex justify-between items-end mb-3">
              <span className="font-poppins text-xs font-bold uppercase tracking-widest text-base-content/50">Onboarding Score</span>
              <span className={`text-xl font-montserrat font-black ${completion === 100 ? 'text-success' : 'text-primary'}`}>{completion}%</span>
            </div>
            <div className="h-2.5 w-full bg-base-200 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                className={`h-full rounded-full ${completion === 100 ? 'bg-success' : 'bg-gradient-to-r from-primary to-secondary'}`}
              />
            </div>
            {completion < 100 && (
              <p className="text-xs text-base-content/50 mt-3 font-medium flex items-center justify-between">
                Complete profile for dispatch <ChevronRight size={14}/>
              </p>
            )}
          </div>
        </motion.header>

        {/* ══════════════════════════════════════════════════════════════════════
            NEW: QUICK ACTIONS BAR (Dashboard, Account, Support)
            ══════════════════════════════════════════════════════════════════════ */}
        <motion.div variants={fadeUpVariants} className="flex flex-wrap items-center gap-3 py-1">
          <button 
            onClick={() => router.push('/care-assistant/dashboard')} 
            className="btn btn-primary btn-sm md:btn-md rounded-xl shadow-sm"
          >
            <LayoutDashboard size={18} /> View Dashboard
          </button>
          
          <button 
            onClick={() => router.push('/care-assistant/profile')} 
            className="btn btn-outline btn-sm md:btn-md rounded-xl bg-base-100 shadow-sm"
          >
            <UserCog size={18} /> Manage Account
          </button>
          
          <button 
            onClick={() => router.push('/care-assistant/support')} 
            className="btn btn-ghost btn-sm md:btn-md rounded-xl bg-base-200/60"
          >
            <HelpCircle size={18} /> Help & Support
          </button>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════════
            2. ALERTS (Strict Conditional Rendering)
            ══════════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {!profile.isActive && kycStatus === 'Verified' ? (
            <motion.div variants={fadeUpVariants} className="alert alert-error shadow-sm border border-error/20 rounded-2xl">
              <AlertTriangle className="flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="font-montserrat font-bold text-sm">Account Suspended</h3>
                <p className="text-sm mt-0.5 opacity-90 font-poppins">Dispatch is offline. {profile.blockReason || 'Please contact support.'}</p>
              </div>
            </motion.div>
          ) : kycStatus !== 'Verified' ? (
            <motion.div variants={fadeUpVariants} className="alert alert-warning shadow-sm border border-warning/20 rounded-2xl">
              <ShieldAlert className="flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="font-montserrat font-bold text-sm">Action Required: {kycStatus}</h3>
                <p className="text-sm mt-0.5 opacity-90 font-poppins">
                  {kycStatus === 'Pending' ? 'Submit mandatory KYC documents to activate.' : 'Documents under review.'}
                </p>
              </div>
              {kycStatus === 'Pending' && <button className="btn btn-sm btn-ghost text-warning-content">Start KYC</button>}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════════════
            3. BENTO GRID: COMMAND CENTER & QUICK STATS
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Dispatch Controller (Takes up more space) */}
          <motion.div variants={fadeUpVariants} className="lg:col-span-8 glass-card p-1 shadow-sm border border-base-200/50 rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-base-100/80 to-base-200/80 -z-10"></div>
            
            <div className="bg-base-100 rounded-[22px] p-4 h-full flex flex-col md:flex-row gap-4 border border-base-100/50 shadow-inner">
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                {/* Custom Tactile Toggle */}
                <button
                  onClick={handleToggleOnline}
                  disabled={isAvailabilityLoading || !profile.isActive}
                  className={`relative flex items-center justify-center w-17 h-17 rounded-full transition-all duration-300 shadow-xl flex-shrink-0 ${
                    isOnline ? 'bg-success text-success-content border-b-4 border-success/50' : 'bg-base-200 text-base-content/40 border-b-4 border-base-300 hover:bg-base-300/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ width: '68px', height: '68px' }} // w-17 h-17 custom workaround
                >
                  {isAvailabilityLoading ? (
                    <div className="loading loading-spinner loading-lg"></div>
                  ) : (
                    <Power size={30} strokeWidth={isOnline ? 3 : 2} className={isOnline ? 'drop-shadow-md' : ''} />
                  )}
                </button>
                
                <div>
                  <h2 className={`text-2xl font-montserrat font-black tracking-tight ${isOnline ? 'text-success' : 'text-base-content/40'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </h2>
                  <p className="text-xs font-medium text-base-content/60 mt-1">
                    {isOnline ? 'Receiving dispatch requests' : 'System is currently paused'}
                  </p>
                  {isOnline && isDispatchable && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold uppercase tracking-wider">
                      <Navigation size={12} className="animate-pulse" /> Dispatch Active
                    </div>
                  )}
                </div>
              </div>

              {/* Status Segmented Control */}
              <div className="w-full md:w-auto flex-1 max-w-sm bg-base-200 p-1 rounded-2xl flex relative">
                {[
                  { label: 'Available', value: 'Available', color: 'success' },
                  { label: 'On Task', value: 'On-Task', color: 'info' },
                  { label: 'Break', value: 'On-Break', color: 'warning' },
                ].map((status) => {
                  const isActive = currentStatus === status.value;
                  return (
                    <button
                      key={status.value}
                      onClick={() => handleStatusChange(status.value)}
                      disabled={isStatusLoading || !isOnline}
                      className={`relative flex-1 py-2 text-sm font-bold font-poppins rounded-xl z-10 transition-colors ${
                        !isOnline ? 'text-base-content/30 cursor-not-allowed' : isActive ? `text-${status.color}-content` : 'text-base-content/60 hover:text-base-content'
                      }`}
                    >
                      {isActive && isOnline && (
                        <motion.div layoutId="active-pill" className={`absolute inset-0 bg-${status.color} shadow-md rounded-xl -z-10`} />
                      )}
                      {status.label}
                    </button>
                  );
                })}
              </div>

            </div>
          </motion.div>

          {/* Earnings Mini-Bento */}
          <motion.div variants={fadeUpVariants} className="lg:col-span-4 stat-card bg-primary text-primary-content rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-primary-content/10 rotate-12">
              <Wallet size={160} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <p className="font-poppins text-xs font-bold uppercase tracking-widest text-primary-content/70">Wallet Balance</p>
              <h3 className="font-montserrat text-4xl md:text-5xl font-black mt-2">₹{earnings?.totalPaid?.toLocaleString('en-IN') || '0'}</h3>
            </div>
            <div className="relative z-10 mt-8 flex items-center justify-between bg-primary-content/10 rounded-2xl p-4 backdrop-blur-sm border border-primary-content/10">
              <div>
                <p className="text-xs font-medium text-primary-content/70">Pending Payout</p>
                <p className="font-bold text-lg">₹{earnings?.pendingPayout || '0'}</p>
              </div>
              <ChevronRight className="text-primary-content/50" />
            </div>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            4. PERFORMANCE METRICS (Data from schema)
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <motion.div variants={fadeUpVariants} className="stat-card rounded-2xl">
            <p className="stat-card-label">Client Rating</p>
            <div className="flex items-center gap-2 mt-2">
              <h3 className="stat-card-value">{performance?.averageRating?.toFixed(1) || '0.0'}</h3>
              <Star size={24} className="text-warning fill-warning" />
            </div>
            <p className="text-xs text-base-content/50 mt-2 font-medium">{performance?.totalRatings || 0} lifetime reviews</p>
          </motion.div>

          <motion.div variants={fadeUpVariants} className="stat-card rounded-2xl">
            <p className="stat-card-label">Tasks Completed</p>
            <h3 className="stat-card-value mt-2 text-success">{performance?.totalTasksCompleted || '0'}</h3>
            <p className="text-xs text-base-content/50 mt-2 font-medium">Monthly: {performance?.monthlyTasks || 0}</p>
          </motion.div>

          <motion.div variants={fadeUpVariants} className="stat-card rounded-2xl">
            <p className="stat-card-label">Cancel Rate</p>
            <h3 className={`stat-card-value mt-2 ${performance?.cancellationRate > 10 ? 'text-error' : 'text-base-content'}`}>
              {performance?.cancellationRate || 0}%
            </h3>
            <p className="text-xs text-base-content/50 mt-2 font-medium">Keep below 5% for bonuses</p>
          </motion.div>

          <motion.div variants={fadeUpVariants} className="stat-card rounded-2xl">
            <p className="stat-card-label">Service Radius</p>
            <h3 className="stat-card-value mt-2 text-info">{profile?.maxServiceRadiusKm || 10}<span className="text-lg text-base-content/40 ml-1 font-bold">km</span></h3>
            <p className="text-xs text-base-content/50 mt-2 font-medium">Notice SLA: {profile?.availability?.minNoticeMinutes || 60}m</p>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            5. BOTTOM SPLIT (Schedule & Ops)
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          <motion.div variants={fadeUpVariants} className="lg:col-span-2 flex flex-col gap-5">
            <h3 className="font-montserrat text-lg font-bold text-base-content ml-1">Today's Itinerary</h3>
            <div className="card bg-base-100 p-8 text-center border border-base-200 border-dashed shadow-sm flex flex-col items-center justify-center min-h-[280px] rounded-3xl">
              <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-4">
                <Calendar size={28} className="text-base-content/40" />
              </div>
              <h4 className="font-montserrat text-lg font-bold text-base-content mb-2">Schedule Clear</h4>
              <p className="text-base-content/50 font-poppins text-sm max-w-sm mx-auto">
                No active or upcoming tasks. Ensure your status is set to 'Online' to receive nearby dispatch requests.
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUpVariants} className="lg:col-span-1 flex flex-col gap-5">
            <h3 className="font-montserrat text-lg font-bold text-base-content ml-1">Operations</h3>
            <div className="card bg-base-100 p-2 shadow-sm border border-base-200 rounded-3xl">
              <ul className="flex flex-col">
                {[
                  { label: 'Weekly Schedule', icon: Clock, color: 'text-primary', bg: 'bg-primary/10', route: '/schedule' },
                  { label: 'Bank Details', icon: Wallet, color: 'text-success', bg: 'bg-success/10', badge: profile?.bankDetails?.isBankVerified ? 'Verified' : 'Pending', route: '/banking' },
                  { label: 'Certificates', icon: Award, color: 'text-warning', bg: 'bg-warning/10', route: '/certificates' },
                  { label: 'Support & SOPs', icon: BookOpen, color: 'text-info', bg: 'bg-info/10', route: '/support' },
                ].map((item, idx) => (
                  <li key={idx}>
                    <button 
                      onClick={() => router.push(item.route)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-base-200/50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} transition-transform group-hover:scale-110`}>
                          <item.icon size={18} strokeWidth={2.5} />
                        </div>
                        <span className="font-poppins text-sm font-semibold text-base-content">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${item.badge === 'Verified' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight size={18} className="text-base-content/30 group-hover:text-base-content/70 transition-transform transform group-hover:translate-x-1" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}