'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

// ── Slice imports ──────────────────────────────────────────────────────────────
import {
  getProfile,
  getPerformance,
  getKycStatus,
  getBankDetails,
  getSettings,
  updateAvailability,
  setOnlineOptimistic,
  selectProfile,
  selectPerformance,
  selectEarnings,
  selectKycStatus,
  selectBankDetails,
  selectSettings,
  selectIsOnline,
  selectCurrentStatus,
  selectProfileCompletion,
  selectLoadingKey,
} from '@/store/slices/careAssistantSlice';
import Logo from '@/public/Logo.ico';

// ── Icons ──────────────────────────────────────────────────────────────────────
import {
  LayoutDashboard, Heart, Star, TrendingUp, Activity,
  UserRound, UserCog, MapPin, Phone, Camera,
  ToggleRight, Clock, CalendarCheck,
  Briefcase, Stethoscope, FileText,
  Landmark, CreditCard, Wallet, ReceiptIndianRupee,
  ShieldCheck, ScanLine,
  HeartPulse, Settings2, Bell, Smartphone,
  KeyRound, History, AlertCircle, LogOut,
  LifeBuoy, MessageSquare,
  ChevronRight, Menu, X, Zap,
  CheckCircle2, XCircle, ArrowUpRight,
  Award, Sparkles, CircleAlert, Timer,
  Users, ClipboardCheck, BadgeCheck,
  Wifi, WifiOff, Sun, Moon,
} from 'lucide-react';

// ── Nav from constants ─────────────────────────────────────────────────────────
import { CARE_ASSISTANT_DASHBOARD_LINKS } from '@/constants/careassistant';

// ── Selectors ──────────────────────────────────────────────────────────────────
const selectUser = (s) => s.user?.user ?? null;

// ── Variants ───────────────────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 20 },      show: { opacity: 1, y: 0,    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
const stagger  = { hidden: {},                         show: { transition: { staggerChildren: 0.08 } } };
const popIn    = { hidden: { opacity: 0, scale: 0.88 },show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] } } };

// ── KYC status map ─────────────────────────────────────────────────────────────
const KYC_CFG = {
  Verified:       { cls: 'bg-success/10 text-success border-success/30', label: 'Verified',     icon: CheckCircle2 },
  'Under-Review': { cls: 'bg-warning/10 text-warning border-warning/30', label: 'Under Review', icon: Timer },
  Pending:        { cls: 'bg-info/10 text-info border-info/30',          label: 'Pending',      icon: CircleAlert },
  Rejected:       { cls: 'bg-error/10 text-error border-error/30',       label: 'Rejected',     icon: XCircle },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

function Sidebar({ activePath, collapsed, onClose }) {
  const [openGroup, setOpenGroup] = useState('Overview');

  return (
    <aside
      className={`flex flex-col h-screen bg-base-200 border-r border-base-300 flex-shrink-0 z-[100] ${
        onClose ? 'w-72 shadow-2xl' : 'hidden lg:flex w-64'
      }`}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-base-300 bg-base-200/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl   overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center p-0.5 shadow-sm">
              <img 
                src={Logo?.src || Logo || '/Logo.ico'} 
                className="w-full h-full object-contain rounded-full drop-shadow-sm" 
                alt="Likeson Logo" 
              />
            </div>
            <div>
              <p className="font-black text-base leading-none text-base-content tracking-tight">Likeson</p>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-primary mt-1">Care Assistant</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 bg-base-300 rounded-lg text-base-content opacity-70 hover:opacity-100 hover:bg-base-300/80 transition-all">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {CARE_ASSISTANT_DASHBOARD_LINKS.map((group) => {
          const isOpen = openGroup === group.title;
          return (
            <div key={group.title} className="mb-2">
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.title)}
                className="w-full flex items-center gap-3   py-2.5 rounded-xl hover:bg-base-300/50 transition-all cursor-pointer group"
              >
                <span className="text-primary opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all">
                  {group.icons}
                </span>
                <span className="flex-1 text-left text-[11px] font-bold text-base-content uppercase tracking-widest">
                  {group.title}
                </span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 pl-2 mt-1 mb-2 border-l-2 border-base-300 space-y-1">
                      {group.links.map((link) => {
                        const active = activePath === link.href;
                        return (
                          <Link key={link.href} href={link.href}>
                            <motion.div
                              whileHover={{ x: 4 }}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                                active
                                  ? 'bg-primary/10 text-primary shadow-sm'
                                  : 'text-base-content/60 hover:text-base-content hover:bg-base-300/50'
                              }`}
                            >
                              <span className={active ? 'text-primary' : 'opacity-70'}>{link.icon}</span> 
                              <span className='text-[10px] uppercase'>{link.name}</span>
                            </motion.div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Bottom quick link */}
      <div className="p-4 border-t border-base-300 bg-base-200/50 backdrop-blur-sm">
        <Link href="/care-assistant/support">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold text-base-content/60 hover:text-base-content hover:bg-base-300 hover:shadow-sm transition-all cursor-pointer group">
            <LifeBuoy size={16} className="group-hover:text-primary transition-colors" /> Help &amp; Support
          </div>
        </Link>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONLINE PILL TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════

function OnlinePill({ isOnline, loading, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onToggle}
      disabled={loading}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full font-black text-xs transition-all duration-300 cursor-pointer select-none disabled:opacity-50 shadow-sm ${
        isOnline
          ? 'bg-success text-success-content shadow-success/30 hover:shadow-success/50'
          : 'bg-base-300 text-base-content hover:bg-base-300/80'
      }`}
    >
      <motion.span
        animate={{ scale: isOnline ? [1, 1.4, 1] : 1 }}
        transition={{ repeat: isOnline ? Infinity : 0, duration: 1.6 }}
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white' : 'bg-current opacity-40'}`}
      />
      {loading ? 'Updating…' : isOnline ? 'Online' : 'Offline'}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO BANNER — greeting + status
// ═══════════════════════════════════════════════════════════════════════════════

function HeroBanner({ user, profile, isOnline, status, completion }) {
  const firstName = profile?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Care Assistant';
  const hour = new Date().getHours();
  const timeIcon = hour < 12 ? <Sun size={16} /> : hour < 17 ? <Sun size={16} /> : <Moon size={16} />;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statusMap = {
    Available: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30' },
    'On-Task': { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30' },
    'On-Break': { bg: 'bg-info/15',    text: 'text-info',    border: 'border-info/30' },
    Offline:   { bg: 'bg-neutral/15', text: 'text-neutral', border: 'border-neutral/30' },
    Suspended: { bg: 'bg-error/15',   text: 'text-error',   border: 'border-error/30' },
  };
  const st = statusMap[status] || statusMap.Offline;

  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-primary/10 via-base-100 to-secondary/10 border border-primary/20 shadow-sm group"
    >
      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 bg-primary blur-3xl pointer-events-none transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-20 bg-secondary blur-3xl pointer-events-none transition-transform duration-700 group-hover:scale-110" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-primary drop-shadow-sm">{timeIcon}</span>
            <span className="text-sm font-bold text-base-content/60 uppercase tracking-widest">{greeting}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-base-content leading-tight tracking-tight">
            {firstName} <span className="text-primary drop-shadow-sm">✦</span>
          </h1>
          <p className="text-sm text-base-content/60 mt-1.5 font-medium">
            {profile?.specializations?.length
              ? profile.specializations.slice(0, 2).join(' · ')
              : 'Certified Care Assistant'}
          </p>

          {/* Status row */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border backdrop-blur-sm ${st.bg} ${st.text} ${st.border}`}>
              <span className={`w-2 h-2 rounded-full bg-current`} />
              {statusMap[status] ? status.replace('-', ' ') : 'Offline'}
            </span>
            {profile?.availability?.currentCity && (
              <span className="flex items-center gap-1.5 text-xs text-base-content/60 font-bold bg-base-200/50 px-3 py-1.5 rounded-full border border-base-300 backdrop-blur-sm">
                <MapPin size={12} className="text-primary" /> {profile.availability.currentCity}
              </span>
            )}
            {profile?.workType && (
              <span className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 backdrop-blur-sm">
                {profile.workType}
              </span>
            )}
          </div>
        </div>

        {/* Right — profile completion arc */}
        <div className="flex items-center gap-6">
          {/* Radial progress */}
          <div className="relative w-24 h-24 flex items-center justify-center text-primary drop-shadow-sm">
            <svg width="96" height="96" className="-rotate-90">
              <circle cx="48" cy="48" r="42" fill="none" className="stroke-primary/10" strokeWidth="8" />
              <motion.circle
                cx="48" cy="48" r="42" fill="none" stroke="currentColor"
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - completion / 100) }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
              />
            </svg>
            <div className="absolute text-center flex flex-col items-center">
              <p className="text-lg font-black text-primary leading-none tracking-tight">{completion}%</p>
              <p className="text-[0.55rem] font-black text-base-content/50 uppercase tracking-widest leading-none mt-1">Profile</p>
            </div>
          </div>

          {/* Avatar */}
          <div className="relative group/avatar cursor-pointer">
            <img
              src={user?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=careassistant'}
              alt="avatar"
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-base-100 shadow-lg group-hover/avatar:scale-105 transition-transform duration-300"
            />
            <span
              className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-base-100 shadow-sm transition-colors duration-300 ${isOnline ? 'bg-success' : 'bg-base-300'}`}
            >
              {isOnline ? <Wifi size={12} className="text-white" /> : <WifiOff size={12} className="text-base-content/50" />}
            </span>
          </div>
        </div>
      </div>

      {/* Completion bar */}
      <div className="relative z-10 mt-8 bg-base-100/40 p-4 rounded-2xl border border-base-300/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-widest text-base-content/50">Profile Completion</span>
          <Link href="/care-assistant/profile">
            <span className="text-xs font-black text-primary hover:text-secondary transition-colors cursor-pointer flex items-center gap-1">
              Complete now <ChevronRight size={12} />
            </span>
          </Link>
        </div>
        <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARDS ROW
// ═══════════════════════════════════════════════════════════════════════════════

function StatCards({ performance, earnings }) {
  const stats = [
    {
      key: 'tasks',
      label: 'Tasks Done',
      value: performance?.totalTasksCompleted?.toLocaleString('en-IN') ?? '—',
      sub: performance?.monthlyTasks != null ? `${performance.monthlyTasks} this month` : null,
      icon: ClipboardCheck,
      textClass: 'text-primary',
      bgClass: 'bg-primary/15',
    },
    {
      key: 'rating',
      label: 'Avg Rating',
      value: performance?.averageRating != null ? Number(performance.averageRating).toFixed(1) : '—',
      sub: performance?.totalRatings != null ? `${performance.totalRatings} reviews` : null,
      icon: Star,
      textClass: 'text-warning',
      bgClass: 'bg-warning/15',
    },
    {
      key: 'earnings',
      label: 'Total Earned',
      value: earnings?.totalPaid != null ? `₹${Number(earnings.totalPaid).toLocaleString('en-IN')}` : '—',
      sub: earnings?.pendingPayout != null ? `₹${Number(earnings.pendingPayout).toLocaleString('en-IN')} pending` : null,
      icon: Wallet,
      textClass: 'text-success',
      bgClass: 'bg-success/15',
    },
    {
      key: 'ontime',
      label: 'On-Time Rate',
      value: performance?.onTimeArrivalRate != null ? `${performance.onTimeArrivalRate}%` : '—',
      sub: performance?.repeatClientRate != null ? `${performance.repeatClientRate}% repeat clients` : null,
      icon: Timer,
      textClass: 'text-secondary',
      bgClass: 'bg-secondary/15',
    },
  ];

  return (
    <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <motion.div 
            key={s.key} 
            variants={popIn} 
            className="p-5 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-300 ${s.bgClass} ${s.textClass}`}>
                <Icon size={18} />
              </div>
              {s.sub && (
                <span className="text-[0.65rem] font-bold text-base-content/40 text-right leading-tight max-w-[80px]">
                  {s.sub}
                </span>
              )}
            </div>
            <p className={`text-3xl font-black leading-none tracking-tight ${s.textClass}`}>
              {s.value}
            </p>
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mt-2">
              {s.label}
            </p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KYC & VERIFICATION CARD
// ═══════════════════════════════════════════════════════════════════════════════

function KycCard({ kycStatus }) {
  const status = kycStatus?.kyc?.verificationStatus ?? 'Pending';
  const cfg = KYC_CFG[status] || KYC_CFG.Pending;
  const Icon = cfg.icon;

  const docs = [
    { label: 'Aadhaar', done: !!kycStatus?.kyc?.aadhaarFrontUrl, verified: kycStatus?.kyc?.aadhaarVerified },
    { label: 'PAN Card', done: !!kycStatus?.kyc?.panCardUrl, verified: kycStatus?.kyc?.panVerified },
    { label: 'Police Verification', done: kycStatus?.verification?.policeVerificationStatus === 'Completed', verified: kycStatus?.verification?.policeVerificationStatus === 'Completed' },
  ];

  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">KYC Status</h3>
        <Link href="/care-assistant/kyc/status">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">View</span>
        </Link>
      </div>

      {/* Big status pill */}
      <div className={`flex items-center gap-4 p-4 rounded-2xl mb-5 border ${cfg.cls}`}>
        <Icon size={24} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider">{cfg.label}</p>
          {kycStatus?.kyc?.rejectionReason && (
            <p className="text-xs font-bold mt-1 opacity-80">{kycStatus.kyc.rejectionReason}</p>
          )}
        </div>
      </div>

      {/* Doc checklist */}
      <div className="space-y-3 p-4 bg-base-200/50 rounded-2xl border border-base-300">
        {docs.map((d) => (
          <div key={d.label} className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/70">{d.label}</span>
            <div className="flex items-center gap-2">
              {d.done
                ? <CheckCircle2 size={16} className={d.verified ? 'text-success' : 'text-warning'} />
                : <XCircle size={16} className="text-error" />
              }
              <span className="text-[0.65rem] font-bold text-base-content/50 uppercase tracking-wider">
                {d.done ? (d.verified ? 'Verified' : 'Uploaded') : 'Missing'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {status !== 'Verified' && (
        <Link href="/care-assistant/kyc/submit">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-5 w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer bg-primary text-primary-content shadow-sm hover:shadow-primary/30 transition-all"
          >
            <ScanLine size={16} /> Submit KYC
          </motion.button>
        </Link>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY AVAILABILITY HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════

function AvailabilityHeatmap({ profile }) {
  const schedule = profile?.weeklySchedule;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay(); // 0=Sun
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">Weekly Schedule</h3>
        <Link href="/care-assistant/schedule">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">Edit</span>
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-5">
        {days.map((day, i) => {
          const avail = schedule?.[day]?.isAvailable;
          const isToday = i === todayIdx;
          return (
            <motion.div
              key={day}
              whileHover={{ y: -2 }}
              className="flex flex-col items-center gap-2 cursor-default group"
            >
              <span className={`text-[0.65rem] font-black uppercase tracking-widest ${isToday ? 'text-primary' : 'text-base-content/40'}`}>
                {labels[i]}
              </span>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${
                  isToday ? 'border-primary shadow-sm' : 'border-transparent'
                } ${avail ? (isToday ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary/60 group-hover:bg-primary/20') : 'bg-base-200'}`}
              >
                {avail ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-base-content/10" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-base-200/50 rounded-xl p-3 border border-base-300 text-center">
        <p className="text-xs text-base-content/60 font-bold uppercase tracking-widest">
          Work type: <strong className="text-primary">{profile?.workType || '—'}</strong>
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE RING CHART
// ═══════════════════════════════════════════════════════════════════════════════

function PerformanceRings({ performance }) {
  const rings = [
    { label: 'Completion', value: (() => {
        const p = performance;
        if (!p) return 0;
        const total = (p.totalTasksCompleted ?? 0) + (p.totalTasksCancelled ?? 0);
        return total ? Math.round((p.totalTasksCompleted / total) * 100) : 0;
      })(), textClass: 'text-primary',   bgClass: 'bg-primary',   r: 58 },
    { label: 'On-Time',   value: performance?.onTimeArrivalRate ?? 0, textClass: 'text-success',   bgClass: 'bg-success',   r: 42 },
    { label: 'Repeat',    value: performance?.repeatClientRate  ?? 0, textClass: 'text-secondary', bgClass: 'bg-secondary', r: 26 },
  ];

  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">Performance</h3>
        <Link href="/care-assistant/performance">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">Details</span>
        </Link>
      </div>

      <div className="flex items-center gap-6">
        {/* Concentric rings */}
        <div className="relative w-[140px] h-[140px] flex-shrink-0 flex items-center justify-center drop-shadow-sm">
          <svg width="140" height="140" className="-rotate-90">
            {rings.map((ring) => {
              const circ = 2 * Math.PI * ring.r;
              return (
                <g key={ring.label}>
                  <circle cx="70" cy="70" r={ring.r} fill="none" className="stroke-base-200" strokeWidth="8" />
                  <motion.circle
                    cx="70" cy="70" r={ring.r} fill="none"
                    className={ring.textClass}
                    stroke="currentColor"
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ * (1 - ring.value / 100) }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="absolute text-center flex flex-col items-center">
            <p className="text-2xl font-black text-base-content leading-none">
              {performance?.averageRating ? Number(performance.averageRating).toFixed(1) : '—'}
            </p>
            <div className="flex justify-center mt-1 gap-0.5">
              {[1,2,3,4,5].map((s) => {
                const isActive = s <= Math.round(performance?.averageRating ?? 0);
                return (
                  <Star key={s} size={10} className={isActive ? 'fill-warning text-warning drop-shadow-sm' : 'fill-base-200 text-base-200'} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-4">
          {rings.map((ring) => (
            <div key={ring.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-base-content/60">{ring.label}</span>
                <span className={`text-sm font-black ${ring.textClass}`}>{ring.value}%</span>
              </div>
              <div className="h-2 bg-base-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${ring.bgClass}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${ring.value}%` }}
                  transition={{ duration: 1.1, delay: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
          <div className="flex gap-4 pt-2 border-t border-base-200">
            <div className="flex-1 bg-error/5 rounded-xl p-2 border border-error/10 text-center">
              <p className="text-sm font-black text-error">{performance?.complaintsCount ?? 0}</p>
              <p className="text-[0.6rem] font-bold text-error/60 uppercase tracking-widest mt-0.5">Complaints</p>
            </div>
            <div className="flex-1 bg-success/5 rounded-xl p-2 border border-success/10 text-center">
              <p className="text-sm font-black text-success">{performance?.complimentsCount ?? 0}</p>
              <p className="text-[0.6rem] font-bold text-success/60 uppercase tracking-widest mt-0.5">Compliments</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARNINGS CARD
// ═══════════════════════════════════════════════════════════════════════════════

function EarningsCard({ earnings, performance }) {
  const items = [
    { label: 'Total Paid',    value: earnings?.totalPaid        != null ? `₹${Number(earnings.totalPaid).toLocaleString('en-IN')}` : '—', textClass: 'text-success' },
    { label: 'Pending',       value: earnings?.pendingPayout    != null ? `₹${Number(earnings.pendingPayout).toLocaleString('en-IN')}` : '—', textClass: 'text-warning' },
    { label: 'Total Tasks',   value: earnings?.lifetimeBookings != null ? earnings.lifetimeBookings.toLocaleString('en-IN') : '—', textClass: 'text-primary' },
    { label: 'Last Payout',   value: earnings?.lastPayoutAt     ? new Date(earnings.lastPayoutAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—', textClass: 'text-secondary' },
  ];

  // Sparkline bars (placeholder visual rhythm)
  const bars = [30, 55, 42, 70, 60, 85, 72, 90, 65, 80, 55, 75];

  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">Earnings Overview</h3>
        <Link href="/care-assistant/performance">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">Details</span>
        </Link>
      </div>

      {/* Sparkline */}
      <div className="flex items-end gap-1.5 h-14 mb-5 p-2 bg-base-200/50 rounded-xl border border-base-300">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className={`flex-1 rounded-t-sm self-end ${i === bars.length - 1 ? 'bg-primary shadow-sm' : 'bg-primary/30 hover:bg-primary/50 transition-colors cursor-pointer'}`}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="p-4 rounded-2xl bg-base-200/60 border border-base-300">
            <p className="text-[0.65rem] font-bold text-base-content/50 uppercase tracking-widest">{item.label}</p>
            <p className={`text-lg font-black mt-1 ${item.textClass}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK ACTIONS GRID
// ═══════════════════════════════════════════════════════════════════════════════

const QUICK_ACTIONS = [
  { label: 'Go Online',    href: '/care-assistant/availability',  icon: ToggleRight,        wrapperClass: 'bg-success/10 text-success hover:bg-success/20 border-success/20' },
  { label: 'My Schedule',  href: '/care-assistant/schedule',       icon: CalendarCheck,      wrapperClass: 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20' },
  { label: 'Submit KYC',   href: '/care-assistant/kyc/submit',     icon: ShieldCheck,        wrapperClass: 'bg-info/10 text-info hover:bg-info/20 border-info/20' },
  { label: 'Earnings',     href: '/care-assistant/performance',    icon: ReceiptIndianRupee, wrapperClass: 'bg-warning/10 text-warning hover:bg-warning/20 border-warning/20' },
  { label: 'My Location',  href: '/care-assistant/location',       icon: MapPin,             wrapperClass: 'bg-secondary/10 text-secondary hover:bg-secondary/20 border-secondary/20' },
  { label: 'Health Decl.', href: '/care-assistant/health-declaration', icon: HeartPulse,   wrapperClass: 'bg-error/10 text-error hover:bg-error/20 border-error/20' },
];

function QuickActions() {
  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70 mb-5">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href}>
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${a.wrapperClass}`}
              >
                <Icon size={20} />
                <span className="text-[0.65rem] font-bold text-center uppercase tracking-wider leading-tight opacity-90">
                  {a.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRAINING & CERTS CARD
// ═══════════════════════════════════════════════════════════════════════════════

function TrainingCard({ profile }) {
  const t = profile?.training;
  const flags = [
    { label: 'First Aid',          done: t?.isFirstAidCertified },
    { label: 'Patient Etiquette',  done: t?.patientEtiquetteTrained },
    { label: 'Mobility Support',   done: t?.mobilitySupportTrained },
    { label: 'Medication Mgmt',    done: t?.medicationManagement },
    { label: 'Wound Care',         done: t?.woundCare },
  ];
  const certCount = t?.certificates?.length ?? 0;
  const doneCount = flags.filter((f) => f.done).length;

  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">Training</h3>
        <Link href="/care-assistant/training">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">Manage</span>
        </Link>
      </div>

      {/* Badge count */}
      <div className="flex items-center gap-4 mb-5 p-4 rounded-2xl bg-base-200/50 border border-base-300">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary border border-primary/20 shadow-sm">
          <Award size={24} />
        </div>
        <div>
          <p className="text-2xl font-black text-primary leading-none">{certCount}</p>
          <p className="text-[0.65rem] font-black text-base-content/50 uppercase tracking-widest mt-1">Certificates</p>
          <p className="text-[0.65rem] font-bold text-base-content/40 mt-0.5">{doneCount}/{flags.length} competencies</p>
        </div>
      </div>

      {/* Competencies */}
      <div className="space-y-2 mb-5">
        {flags.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-base-content/70">{f.label}</span>
            {f.done
              ? <CheckCircle2 size={16} className="text-success" />
              : <XCircle size={16} className="text-base-300" />
            }
          </div>
        ))}
      </div>

      {/* Recent certs */}
      {t?.certificates?.length > 0 && (
        <div className="pt-4 border-t border-base-200">
          <p className="text-[0.65rem] font-black uppercase tracking-widest text-base-content/40 mb-3">Recent Uploads</p>
          <div className="space-y-2">
            {t.certificates.slice(0, 2).map((c) => (
              <div key={c._id} className="flex items-center justify-between p-2.5 rounded-xl bg-base-200/50 border border-base-300">
                <span className="text-xs font-bold text-base-content truncate max-w-[150px]">{c.name}</span>
                <span className={`text-[0.6rem] font-black px-2 py-1 rounded-md uppercase tracking-wider ${c.isVerified ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'}`}>
                  {c.isVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANK CARD
// ═══════════════════════════════════════════════════════════════════════════════

function BankCard({ bankDetails }) {
  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">Payout Bank</h3>
        <Link href="/care-assistant/bank">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">Edit</span>
        </Link>
      </div>

      {bankDetails?.bankName ? (
        <>
          <div className="p-5 rounded-2xl mb-4 bg-gradient-to-br from-primary/10 to-base-200 border border-primary/20 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Landmark size={16} />
              </div>
              <span className={`text-[0.6rem] font-black px-2.5 py-1 rounded-md uppercase tracking-wider border ${bankDetails.isBankVerified ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30'}`}>
                {bankDetails.isBankVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="text-base font-black text-base-content">{bankDetails.bankName}</p>
            <p className="text-xs font-bold text-base-content/50 mt-1 font-mono tracking-widest">
              •••• •••• {bankDetails.accountLast4 || '——'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-base-200/50 rounded-xl border border-base-300">
               <p className="text-[0.65rem] font-bold uppercase tracking-widest text-base-content/40">IFSC</p>
               <p className="text-xs font-bold font-mono mt-1">{bankDetails.ifscCode || '—'}</p>
            </div>
            {bankDetails.upiId && (
              <div className="p-3 bg-base-200/50 rounded-xl border border-base-300 truncate">
                 <p className="text-[0.65rem] font-bold uppercase tracking-widest text-base-content/40">UPI ID</p>
                 <p className="text-xs font-bold mt-1 truncate">{bankDetails.upiId}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-3 bg-base-200/50 rounded-2xl border border-dashed border-base-300">
          <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center text-base-content/30">
             <CreditCard size={24} />
          </div>
          <p className="text-xs font-bold text-base-content/50 text-center">No bank account added</p>
          <Link href="/care-assistant/bank">
            <button className="px-5 py-2.5 rounded-xl bg-primary text-primary-content text-xs font-black uppercase tracking-wider shadow-sm hover:shadow-md hover:bg-primary/90 transition-all mt-2">
               Add Bank
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFS CARD
// ═══════════════════════════════════════════════════════════════════════════════

function NotifCard({ settings }) {
  const prefs = settings?.notifPrefs;
  const items = [
    { label: 'SMS',       key: 'sms',      icon: '📱' },
    { label: 'Email',     key: 'email',    icon: '✉️' },
    { label: 'Push',      key: 'push',     icon: '🔔' },
    { label: 'WhatsApp',  key: 'whatsapp', icon: '💬' },
  ];

  return (
    <motion.div variants={fadeUp} className="p-6 rounded-3xl bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-xs uppercase tracking-widest text-base-content/70">Notifications</h3>
        <Link href="/care-assistant/settings/notifications">
          <span className="text-xs font-bold text-primary cursor-pointer hover:text-secondary transition-colors">Edit</span>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const on = prefs?.[item.key] ?? true;
          return (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-base-200 border border-base-300">
              <div className="flex items-center gap-2">
                <span className="text-lg drop-shadow-sm">{item.icon}</span>
                <span className="text-xs font-bold text-base-content/70">{item.label}</span>
              </div>
              <span className={`w-3 h-3 rounded-full shadow-inner ${on ? 'bg-success shadow-success/50' : 'bg-base-300'}`} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH DECLARATION BANNER
// ═══════════════════════════════════════════════════════════════════════════════

function HealthBanner({ profile }) {
  const fit = profile?.healthDeclaration?.isMedicallyFit;
  const declared = profile?.healthDeclaration?.declaredAt;

  if (fit === undefined || fit === null) {
    return (
      <motion.div variants={fadeUp} className="p-5 rounded-3xl bg-base-100 border-l-4 border-l-warning border-y-base-300 border-r-base-300 border-y border-r shadow-sm flex items-center gap-5">
        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
          <HeartPulse size={24} className="text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-base-content">Health Declaration Needed</p>
          <p className="text-xs font-medium text-base-content/60 mt-0.5">Submit fitness declaration to go online</p>
        </div>
        <Link href="/care-assistant/health-declaration">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer flex-shrink-0 bg-warning text-warning-content shadow-sm hover:shadow-md transition-all"
          >
            Declare
          </motion.button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} className={`p-5 rounded-3xl bg-base-100 border-l-4 border-y border-r border-y-base-300 border-r-base-300 shadow-sm flex items-center gap-5 ${fit ? 'border-l-success' : 'border-l-error'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${fit ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
         <HeartPulse size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-base-content">
          {fit ? 'Medically Fit ✓' : 'Not Declared Fit'}
        </p>
        {declared && (
          <p className="text-xs font-bold text-base-content/50 mt-1">
            Declared on {new Date(declared).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      <Link href="/care-assistant/health-declaration">
        <span className="text-xs font-black uppercase tracking-wider text-primary cursor-pointer hover:text-secondary transition-colors flex-shrink-0 bg-primary/10 px-4 py-2 rounded-xl">Update</span>
      </Link>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CareAssistantDashboard() {
  const dispatch = useDispatch();

  const user        = useSelector(selectUser);
  const profile     = useSelector(selectProfile);
  const performance = useSelector(selectPerformance);
  const earnings    = useSelector(selectEarnings);
  const kycStatus   = useSelector(selectKycStatus);
  const bankDetails = useSelector(selectBankDetails);
  const settings    = useSelector(selectSettings);
  const isOnline    = useSelector(selectIsOnline);
  const status      = useSelector(selectCurrentStatus);
  const completion  = useSelector(selectProfileCompletion);
  const availLoading = useSelector(selectLoadingKey('availability'));

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    dispatch(getProfile());
    dispatch(getPerformance());
    dispatch(getKycStatus());
    dispatch(getBankDetails());
    dispatch(getSettings());
  }, [dispatch]);

  const handleToggle = () => {
    const next = !isOnline;
    dispatch(setOnlineOptimistic(next));
    dispatch(updateAvailability({ isOnline: next }));
  };

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100 flex selection:bg-primary/20">

      {/* Desktop Sidebar */}
      <Sidebar activePath="/care-assistant/dashboard" />

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-[201] lg:hidden shadow-2xl"
            >
              <Sidebar activePath="/care-assistant/dashboard" onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-[90] bg-base-100/70 backdrop-blur-xl border-b border-base-300 px-5 lg:px-8 py-4 flex items-center justify-between gap-4 shadow-sm">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="lg:hidden w-10 h-10 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center cursor-pointer hover:bg-base-300 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} className="text-base-content" />
          </motion.button>

          <div className="flex-1 hidden lg:block">
            <h1 className="text-lg font-black text-base-content tracking-tight">
              Dashboard <span className="text-primary font-bold opacity-80">— Care Assistant</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <OnlinePill isOnline={isOnline} loading={availLoading} onToggle={handleToggle} />

            <Link href="/care-assistant/settings/notifications">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-10 h-10 rounded-full bg-base-200 border border-base-300 flex items-center justify-center cursor-pointer hover:bg-base-300 transition-colors shadow-sm"
              >
                <Bell size={18} className="text-base-content/70" />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-error rounded-full border-2 border-base-100" />
              </motion.button>
            </Link>

            <Link href="/care-assistant/profile">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="cursor-pointer shadow-sm rounded-full bg-gradient-to-tr from-primary to-secondary p-[2px]">
                <img
                  src={user?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=ca'}
                  alt="avatar"
                  className="w-9 h-9 lg:w-10 lg:h-10 rounded-full object-cover bg-base-100 border-2 border-base-100"
                />
              </motion.div>
            </Link>
          </div>
        </header>

        {/* ── Page body ──────────────────────────────────────────── */}
        <main className="flex-1 p-5 lg:p-8 pb-28 lg:pb-10 overflow-x-hidden max-w-[1600px] mx-auto w-full">

          {/* MOBILE LAYOUT */}
          <motion.div className="lg:hidden space-y-5" initial="hidden" animate="show" variants={stagger}>
            <HeroBanner user={user} profile={profile} isOnline={isOnline} status={status} completion={completion} />
            <StatCards performance={performance} earnings={earnings} />
            <HealthBanner profile={profile} />
            <QuickActions />
            <PerformanceRings performance={performance} />
            <AvailabilityHeatmap profile={profile} />
            <EarningsCard earnings={earnings} performance={performance} />
            <KycCard kycStatus={kycStatus} />
            <TrainingCard profile={profile} />
            <BankCard bankDetails={bankDetails} />
            <NotifCard settings={settings} />
          </motion.div>

          {/* DESKTOP LAYOUT */}
          <motion.div className="hidden lg:block space-y-6" initial="hidden" animate="show" variants={stagger}>

            {/* Row 1 — Hero full width */}
            <HeroBanner user={user} profile={profile} isOnline={isOnline} status={status} completion={completion} />

            {/* Row 2 — 4 stat cards */}
            <StatCards performance={performance} earnings={earnings} />

            {/* Row 3 — health banner */}
            <HealthBanner profile={profile} />

            {/* Row 4 — 3-col grid */}
            <div className="grid grid-cols-12 gap-6">

              {/* Col 1: left (4) */}
              <div className="col-span-4 space-y-6">
                <QuickActions />
                <KycCard kycStatus={kycStatus} />
                <NotifCard settings={settings} />
              </div>

              {/* Col 2: center (4) */}
              <div className="col-span-4 space-y-6">
                <PerformanceRings performance={performance} />
                <AvailabilityHeatmap profile={profile} />
                <BankCard bankDetails={bankDetails} />
              </div>

              {/* Col 3: right (4) */}
              <div className="col-span-4 space-y-6">
                <EarningsCard earnings={earnings} performance={performance} />
                <TrainingCard profile={profile} />
              </div>
            </div>

          </motion.div>
        </main>
      </div>
    </div>
  );
}