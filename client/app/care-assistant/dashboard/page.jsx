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
const fadeIn   = { hidden: { opacity: 0 },             show: { opacity: 1,           transition: { duration: 0.4 } } };
const stagger  = { hidden: {},                         show: { transition: { staggerChildren: 0.08 } } };
const slideR   = { hidden: { opacity: 0, x: 20 },      show: { opacity: 1, x: 0,    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };
const popIn    = { hidden: { opacity: 0, scale: 0.88 },show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] } } };

// ── KYC status map ─────────────────────────────────────────────────────────────
const KYC_CFG = {
  Verified:     { cls: 'badge-success', label: 'Verified',     icon: CheckCircle2 },
  'Under-Review':{ cls: 'badge-warning', label: 'Under Review', icon: Timer },
  Pending:      { cls: 'badge-info',    label: 'Pending',      icon: CircleAlert },
  Rejected:     { cls: 'badge-error',   label: 'Rejected',     icon: XCircle },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

function Sidebar({ activePath, collapsed, onClose }) {
  const [openGroup, setOpenGroup] = useState('Overview');

  return (
    <aside
      className={[
        'flex flex-col h-screen bg-[var(--base-200)] border-r border-[var(--base-300)]',
        'overflow-y-auto flex-shrink-0',
        onClose
          ? 'w-72' // mobile drawer
          : 'hidden lg:flex w-64',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--base-300)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--r-box)] bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center shadow-[0_4px_14px_color-mix(in_srgb,var(--primary),transparent_55%)]">
              <Heart size={16} className="text-white fill-white" />
            </div>
            <div>
              <p className="font-black text-sm leading-none text-[var(--base-content)]">Likeson</p>
              <p className="text-[0.58rem] font-bold uppercase tracking-widest text-[var(--primary)] mt-0.5">Care Assistant</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="cursor-pointer text-[var(--base-content)] opacity-50 hover:opacity-100">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {CARE_ASSISTANT_DASHBOARD_LINKS.map((group) => {
          const isOpen = openGroup === group.title;
          return (
            <div key={group.title}>
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.title)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--base-300)] transition-colors cursor-pointer group"
              >
                <span className="text-[var(--primary)] mr-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  {group.icons}
                </span>
                <span className="flex-1 text-left text-[13px] font-bold text-[var(--base-content)] uppercase tracking-wider">
                  {group.title}
                </span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={11} className="opacity-30" />
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
                    <div className="ml-4 pl-3  mt-0.5 mb-1 space-y-0.5">
                      {group.links.map((link) => {
                        const active = activePath === link.href;
                        return (
                          <Link key={link.href} href={link.href}>
                            <motion.div
                              whileHover={{ x: 3 }}
                              className={[
                                'flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors',
                                active
                                  ? 'bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]'
                                  : 'text-[var(--base-content)] opacity-55 hover:opacity-100 hover:bg-[var(--base-300)]',
                              ].join(' ')}
                            >
                              {link.icon} {link.name}
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
      <div className="p-3 border-t border-[var(--base-300)]">
        <Link href="/care-assistant/support">
          <div className="flex items-center gap-2 px-2 py-2 rounded-md text-[0.65rem] font-semibold text-[var(--base-content)] opacity-45 hover:opacity-100 hover:bg-[var(--base-300)] transition-all cursor-pointer">
            <LifeBuoy size={12} /> Help &amp; Support
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
      className={[
        'relative flex items-center gap-2 px-4 py-2 rounded-full',
        'font-bold text-xs transition-all duration-300 cursor-pointer select-none disabled:opacity-50',
        isOnline
          ? 'bg-[var(--success)] text-[var(--success-content)] shadow-[0_0_18px_color-mix(in_srgb,var(--success),transparent_45%)]'
          : 'bg-[var(--base-300)] text-[var(--base-content)]',
      ].join(' ')}
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
  const timeIcon = hour < 12 ? <Sun size={14} /> : hour < 17 ? <Sun size={14} /> : <Moon size={14} />;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statusMap = {
    Available: { color: 'var(--success)', label: 'Available' },
    'On-Task': { color: 'var(--warning)', label: 'On Task' },
    'On-Break': { color: 'var(--info)',    label: 'On Break' },
    Offline:   { color: 'var(--neutral)', label: 'Offline' },
    Suspended: { color: 'var(--error)',   label: 'Suspended' },
  };
  const st = statusMap[status] || statusMap.Offline;

  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[var(--r-box)] p-6 md:p-8"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--base-200)), color-mix(in srgb, var(--secondary) 12%, var(--base-100)))',
        border: '1px solid color-mix(in srgb, var(--primary), transparent 75%)',
      }}
    >
      {/* Decorative blob */}
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }} />
      <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-8"
        style={{ background: 'radial-gradient(circle, var(--secondary), transparent 70%)' }} />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--primary)] opacity-75">{timeIcon}</span>
            <span className="text-xs font-semibold text-[var(--base-content)] opacity-55">{greeting}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--base-content)] leading-tight">
            {firstName} <span className="text-[var(--primary)]">✦</span>
          </h1>
          <p className="text-xs text-[var(--base-content)] opacity-50 mt-1 font-medium">
            {profile?.specializations?.length
              ? profile.specializations.slice(0, 2).join(' · ')
              : 'Care Assistant'}
          </p>

          {/* Status row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.65rem] font-bold"
              style={{
                background: `color-mix(in srgb, ${st.color}, transparent 85%)`,
                color: st.color,
                border: `1px solid color-mix(in srgb, ${st.color}, transparent 65%)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
              {st.label}
            </span>
            {profile?.availability?.currentCity && (
              <span className="flex items-center gap-1 text-[0.62rem] text-[var(--base-content)] opacity-45 font-medium">
                <MapPin size={10} /> {profile.availability.currentCity}
              </span>
            )}
            {profile?.workType && (
              <span className="badge badge-primary text-[0.58rem] py-0.5">{profile.workType}</span>
            )}
          </div>
        </div>

        {/* Right — profile completion arc */}
        <div className="flex items-center gap-5">
          {/* Radial progress */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg width="80" height="80" className="-rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--base-300)" strokeWidth="6" />
              <motion.circle
                cx="40" cy="40" r="34" fill="none" stroke="var(--primary)"
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - completion / 100) }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-sm font-black text-[var(--primary)] leading-none">{completion}%</p>
              <p className="text-[0.5rem] font-semibold text-[var(--base-content)] opacity-50 uppercase tracking-wide leading-none mt-0.5">Profile</p>
            </div>
          </div>

          {/* Avatar */}
          <div className="relative">
            <img
              src={user?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=careassistant'}
              alt="avatar"
              className="w-16 h-16 rounded-[var(--r-box)] object-cover ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--base-200)]"
            />
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[var(--base-200)]"
              style={{ background: isOnline ? 'var(--success)' : 'var(--base-300)' }}
            >
              {isOnline ? <Wifi size={8} className="text-white" /> : <WifiOff size={8} className="text-[var(--base-content)] opacity-50" />}
            </span>
          </div>
        </div>
      </div>

      {/* Completion bar */}
      <div className="relative z-10 mt-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--base-content)] opacity-45">Profile Completion</span>
          <Link href="/care-assistant/profile">
            <span className="text-[0.62rem] font-bold text-[var(--primary)] hover:underline cursor-pointer">Complete now →</span>
          </Link>
        </div>
        <div className="progress-bar h-1.5">
          <motion.div
            className="progress-bar-fill"
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
      color: 'var(--primary)',
    },
    {
      key: 'rating',
      label: 'Avg Rating',
      value: performance?.averageRating != null ? Number(performance.averageRating).toFixed(1) : '—',
      sub: performance?.totalRatings != null ? `${performance.totalRatings} reviews` : null,
      icon: Star,
      color: 'var(--warning)',
    },
    {
      key: 'earnings',
      label: 'Total Earned',
      value: earnings?.totalPaid != null ? `₹${Number(earnings.totalPaid).toLocaleString('en-IN')}` : '—',
      sub: earnings?.pendingPayout != null ? `₹${Number(earnings.pendingPayout).toLocaleString('en-IN')} pending` : null,
      icon: Wallet,
      color: 'var(--success)',
    },
    {
      key: 'ontime',
      label: 'On-Time Rate',
      value: performance?.onTimeArrivalRate != null ? `${performance.onTimeArrivalRate}%` : '—',
      sub: performance?.repeatClientRate != null ? `${performance.repeatClientRate}% repeat clients` : null,
      icon: Timer,
      color: 'var(--secondary)',
    },
  ];

  return (
    <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.key}
            variants={popIn}
            className="glass-card p-4 cursor-default"
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-9 h-9 rounded-[var(--r-selector)] flex items-center justify-center flex-shrink-0"
                style={{
                  background: `color-mix(in srgb, ${s.color}, transparent 86%)`,
                  color: s.color,
                }}
              >
                <Icon size={15} />
              </div>
              {s.sub && (
                <span className="text-[0.58rem] font-semibold text-[var(--base-content)] opacity-40 text-right leading-tight max-w-[70px]">
                  {s.sub}
                </span>
              )}
            </div>
            <p className="text-2xl font-black text-[var(--base-content)] leading-none" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-[var(--base-content)] opacity-45 mt-1">
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
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">KYC Status</h3>
        <Link href="/care-assistant/kyc/status">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">View</span>
        </Link>
      </div>

      {/* Big status pill */}
      <div className="flex items-center gap-3 p-3 rounded-md mb-4"
        style={{ background: `color-mix(in srgb, ${status === 'Verified' ? 'var(--success)' : status === 'Rejected' ? 'var(--error)' : 'var(--warning)'}, transparent 90%)` }}
      >
        <Icon size={18} style={{ color: status === 'Verified' ? 'var(--success)' : status === 'Rejected' ? 'var(--error)' : 'var(--warning)' }} />
        <div>
          <p className="text-xs font-black text-[var(--base-content)]">{cfg.label}</p>
          {kycStatus?.kyc?.rejectionReason && (
            <p className="text-[0.6rem] text-[var(--error)] mt-0.5">{kycStatus.kyc.rejectionReason}</p>
          )}
        </div>
      </div>

      {/* Doc checklist */}
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.label} className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--base-content)] opacity-65">{d.label}</span>
            <div className="flex items-center gap-1.5">
              {d.done
                ? <CheckCircle2 size={13} style={{ color: d.verified ? 'var(--success)' : 'var(--warning)' }} />
                : <XCircle size={13} style={{ color: 'var(--error)' }} />
              }
              <span className="text-[0.58rem] text-[var(--base-content)] opacity-40">
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
            whileTap={{ scale: 0.97 }}
            className="mt-4 w-full py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
          >
            <ScanLine size={13} /> Submit KYC
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
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Weekly Schedule</h3>
        <Link href="/care-assistant/schedule">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Edit</span>
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {days.map((day, i) => {
          const avail = schedule?.[day]?.isAvailable;
          const isToday = i === todayIdx;
          return (
            <motion.div
              key={day}
              whileHover={{ scale: 1.12 }}
              className="flex flex-col items-center gap-1.5 cursor-default"
            >
              <span className={`text-[0.58rem] font-bold uppercase ${isToday ? 'text-[var(--primary)]' : 'text-[var(--base-content)] opacity-40'}`}>
                {labels[i]}
              </span>
              <div
                className="w-8 h-8 rounded-[var(--r-selector)] flex items-center justify-center transition-all"
                style={{
                  background: avail
                    ? `color-mix(in srgb, var(--primary), transparent ${isToday ? '40%' : '70%'})`
                    : 'var(--base-300)',
                  border: isToday ? '2px solid var(--primary)' : '2px solid transparent',
                }}
              >
                {avail ? (
                  <CheckCircle2 size={12} style={{ color: 'var(--primary)' }} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--base-content)] opacity-20" />
                )}
              </div>
              {schedule?.[day]?.startTime && (
                <span className="text-[0.48rem] text-[var(--base-content)] opacity-30 font-medium">
                  {schedule[day].startTime}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-[0.6rem] text-[var(--base-content)] opacity-40 text-center font-medium">
        Work type: <strong className="text-[var(--primary)] opacity-100">{profile?.workType || '—'}</strong>
      </p>
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
      })(), color: 'var(--primary)', r: 52 },
    { label: 'On-Time',   value: performance?.onTimeArrivalRate ?? 0, color: 'var(--success)', r: 38 },
    { label: 'Repeat',    value: performance?.repeatClientRate  ?? 0, color: 'var(--secondary)', r: 24 },
  ];

  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Performance</h3>
        <Link href="/care-assistant/performance">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Details</span>
        </Link>
      </div>

      <div className="flex items-center gap-5">
        {/* Concentric rings */}
        <div className="relative w-[130px] h-[130px] flex-shrink-0 flex items-center justify-center">
          <svg width="130" height="130" className="-rotate-90">
            {rings.map((ring) => {
              const circ = 2 * Math.PI * ring.r;
              return (
                <g key={ring.label}>
                  <circle cx="65" cy="65" r={ring.r} fill="none" stroke="var(--base-300)" strokeWidth="6" />
                  <motion.circle
                    cx="65" cy="65" r={ring.r} fill="none"
                    stroke={ring.color}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ * (1 - ring.value / 100) }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="absolute text-center">
            <p className="text-lg font-black text-[var(--primary)] leading-none">
              {performance?.averageRating ? Number(performance.averageRating).toFixed(1) : '—'}
            </p>
            <div className="flex justify-center mt-0.5">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} size={7} fill={s <= Math.round(performance?.averageRating ?? 0) ? 'var(--warning)' : 'none'}
                  style={{ color: s <= Math.round(performance?.averageRating ?? 0) ? 'var(--warning)' : 'var(--base-300)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          {rings.map((ring) => (
            <div key={ring.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[0.62rem] font-semibold text-[var(--base-content)] opacity-60">{ring.label}</span>
                <span className="text-xs font-black" style={{ color: ring.color }}>{ring.value}%</span>
              </div>
              <div className="h-1.5 bg-[var(--base-300)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: ring.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${ring.value}%` }}
                  transition={{ duration: 1.1, delay: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <div className="text-center">
              <p className="text-xs font-black text-[var(--error)]">{performance?.complaintsCount ?? 0}</p>
              <p className="text-[0.52rem] opacity-40 text-[var(--base-content)] uppercase tracking-wide">Complaints</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-[var(--success)]">{performance?.complimentsCount ?? 0}</p>
              <p className="text-[0.52rem] opacity-40 text-[var(--base-content)] uppercase tracking-wide">Compliments</p>
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
    { label: 'Total Paid',    value: earnings?.totalPaid        != null ? `₹${Number(earnings.totalPaid).toLocaleString('en-IN')}` : '—', color: 'var(--success)' },
    { label: 'Pending',       value: earnings?.pendingPayout    != null ? `₹${Number(earnings.pendingPayout).toLocaleString('en-IN')}` : '—', color: 'var(--warning)' },
    { label: 'Total Tasks',   value: earnings?.lifetimeBookings != null ? earnings.lifetimeBookings.toLocaleString('en-IN') : '—', color: 'var(--primary)' },
    { label: 'Last Payout',   value: earnings?.lastPayoutAt     ? new Date(earnings.lastPayoutAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—', color: 'var(--secondary)' },
  ];

  // Sparkline bars (placeholder visual rhythm)
  const bars = [30, 55, 42, 70, 60, 85, 72, 90, 65, 80, 55, 75];

  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Earnings Overview</h3>
        <Link href="/care-assistant/performance">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Details</span>
        </Link>
      </div>

      {/* Sparkline */}
      <div className="flex items-end gap-1 h-10 mb-3">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              background: i === bars.length - 1
                ? 'var(--primary)'
                : `color-mix(in srgb, var(--primary), transparent ${70 - i * 2}%)`,
              alignSelf: 'flex-end',
            }}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="p-2.5 rounded-md bg-[var(--base-200)]">
            <p className="text-[0.58rem] opacity-45 font-semibold text-[var(--base-content)] uppercase tracking-wide">{item.label}</p>
            <p className="text-sm font-black mt-0.5" style={{ color: item.color }}>{item.value}</p>
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
  { label: 'Go Online',    href: '/care-assistant/availability',  icon: ToggleRight,        color: 'var(--success)' },
  { label: 'My Schedule',  href: '/care-assistant/schedule',       icon: CalendarCheck,      color: 'var(--primary)' },
  { label: 'Submit KYC',   href: '/care-assistant/kyc/submit',     icon: ShieldCheck,        color: 'var(--info)' },
  { label: 'Earnings',     href: '/care-assistant/performance',    icon: ReceiptIndianRupee, color: 'var(--warning)' },
  { label: 'My Location',  href: '/care-assistant/location',       icon: MapPin,             color: 'var(--secondary)' },
  { label: 'Health Decl.', href: '/care-assistant/health-declaration', icon: HeartPulse,   color: 'var(--error)' },
];

function QuickActions() {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)] mb-4">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href}>
              <motion.div
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.93 }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-md cursor-pointer transition-all"
                style={{ background: `color-mix(in srgb, ${a.color}, transparent 88%)` }}
              >
                <Icon size={16} style={{ color: a.color }} />
                <span className="text-[0.58rem] font-bold text-center leading-tight" style={{ color: a.color }}>
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
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Training</h3>
        <Link href="/care-assistant/training">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Manage</span>
        </Link>
      </div>

      {/* Badge count */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-[var(--r-box)] flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}
        >
          <Award size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <p className="text-lg font-black text-[var(--primary)] leading-none">{certCount}</p>
          <p className="text-[0.6rem] font-semibold text-[var(--base-content)] opacity-50 uppercase tracking-wide">Certificates</p>
          <p className="text-[0.6rem] text-[var(--base-content)] opacity-35">{doneCount}/{flags.length} competencies</p>
        </div>
      </div>

      {/* Competencies */}
      <div className="space-y-1.5">
        {flags.map((f) => (
          <div key={f.label} className="flex items-center justify-between">
            <span className="text-[0.65rem] font-semibold text-[var(--base-content)] opacity-60">{f.label}</span>
            {f.done
              ? <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
              : <XCircle size={13} style={{ color: 'var(--base-300)' }} />
            }
          </div>
        ))}
      </div>

      {/* Recent certs */}
      {t?.certificates?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--base-300)]">
          <p className="text-[0.58rem] uppercase tracking-widest text-[var(--base-content)] opacity-35 font-bold mb-2">Recent</p>
          {t.certificates.slice(0, 2).map((c) => (
            <div key={c._id} className="flex items-center justify-between py-1">
              <span className="text-[0.65rem] font-semibold text-[var(--base-content)] truncate max-w-[130px]">{c.name}</span>
              <span className={`text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full ${c.isVerified ? 'badge-success' : 'badge-warning'}`}>
                {c.isVerified ? 'Verified' : 'Pending'}
              </span>
            </div>
          ))}
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
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Payout Bank</h3>
        <Link href="/care-assistant/bank">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Edit</span>
        </Link>
      </div>

      {bankDetails?.bankName ? (
        <>
          <div className="p-3 rounded-md mb-3"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--base-200)), var(--base-200))' }}
          >
            <div className="flex items-center justify-between mb-2">
              <Landmark size={16} style={{ color: 'var(--primary)' }} />
              <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full ${bankDetails.isBankVerified ? 'badge-success' : 'badge-warning'}`}>
                {bankDetails.isBankVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="text-xs font-black text-[var(--base-content)]">{bankDetails.bankName}</p>
            <p className="text-[0.65rem] text-[var(--base-content)] opacity-50 mt-0.5 font-mono">
              •••• •••• {bankDetails.accountLast4 || '——'}
            </p>
          </div>
          <p className="text-[0.6rem] text-[var(--base-content)] opacity-40">
            IFSC: <span className="font-mono font-semibold">{bankDetails.ifscCode || '—'}</span>
          </p>
          {bankDetails.upiId && (
            <p className="text-[0.6rem] text-[var(--base-content)] opacity-40 mt-0.5">
              UPI: {bankDetails.upiId}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <CreditCard size={28} style={{ color: 'color-mix(in srgb, var(--base-content) 20%, transparent)' }} />
          <p className="text-xs text-[var(--base-content)] opacity-35 text-center">No bank account added</p>
          <Link href="/care-assistant/bank">
            <button className="btn-secondary px-4 py-2 text-xs">Add Bank</button>
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
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Notifications</h3>
        <Link href="/care-assistant/settings/notifications">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Edit</span>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const on = prefs?.[item.key] ?? true;
          return (
            <div key={item.key} className="flex items-center justify-between p-2.5 rounded-md bg-[var(--base-200)]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{item.icon}</span>
                <span className="text-[0.62rem] font-semibold text-[var(--base-content)] opacity-65">{item.label}</span>
              </div>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: on ? 'var(--success)' : 'var(--base-300)' }}
              />
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
      <motion.div variants={fadeUp}
        className="glass-card p-4 flex items-center gap-4"
        style={{ borderLeft: '3px solid var(--warning)' }}
      >
        <HeartPulse size={20} style={{ color: 'var(--warning)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-[var(--base-content)]">Health Declaration Needed</p>
          <p className="text-[0.6rem] text-[var(--base-content)] opacity-45">Submit fitness declaration to go online</p>
        </div>
        <Link href="/care-assistant/health-declaration">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="px-3 py-2 rounded-md text-xs font-bold cursor-pointer flex-shrink-0"
            style={{ background: 'var(--warning)', color: 'var(--warning-content)' }}
          >
            Declare
          </motion.button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp}
      className="glass-card p-4 flex items-center gap-4"
      style={{ borderLeft: `3px solid ${fit ? 'var(--success)' : 'var(--error)'}` }}
    >
      <HeartPulse size={20} style={{ color: fit ? 'var(--success)' : 'var(--error)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-[var(--base-content)]">
          {fit ? 'Medically Fit ✓' : 'Not Declared Fit'}
        </p>
        {declared && (
          <p className="text-[0.6rem] text-[var(--base-content)] opacity-40">
            Declared on {new Date(declared).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      <Link href="/care-assistant/health-declaration">
        <span className="text-[0.65rem] font-bold text-[var(--primary)] cursor-pointer hover:underline flex-shrink-0">Update</span>
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
    <div data-theme="care-assistant" className="min-h-screen bg-[var(--base-100)] flex">

      {/* Desktop Sidebar */}
      <Sidebar activePath="/care-assistant/dashboard" />

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm lg:hidden"
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
        <header className="sticky top-0 z-[90] bg-[color-mix(in_srgb,var(--base-100)_82%,transparent)] backdrop-blur-strong border-b border-[var(--base-300)] px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="lg:hidden w-8 h-8 rounded-md bg-[var(--base-300)] flex items-center justify-center cursor-pointer"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={15} className="text-[var(--base-content)]" />
          </motion.button>

          <div className="flex-1 hidden lg:block">
            <h1 className="text-sm font-black text-[var(--base-content)]">
              Dashboard <span className="text-[var(--primary)]">— Care Assistant</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <OnlinePill isOnline={isOnline} loading={availLoading} onToggle={handleToggle} />

            <Link href="/care-assistant/settings/notifications">
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="relative w-8 h-8 rounded-md bg-[var(--base-200)] flex items-center justify-center cursor-pointer hover:bg-[var(--base-300)] transition-colors"
              >
                <Bell size={15} className="text-[var(--base-content)]" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[var(--error)] rounded-full" />
              </motion.button>
            </Link>

            <Link href="/care-assistant/profile">
              <motion.img
                whileTap={{ scale: 0.9 }}
                src={user?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=ca'}
                alt="avatar"
                className="w-8 h-8 lg:w-9 lg:h-9 rounded-md object-cover ring-2 ring-[var(--primary)] cursor-pointer"
              />
            </Link>
          </div>
        </header>

        {/* ── Page body ──────────────────────────────────────────── */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-8 overflow-x-hidden">

          {/* MOBILE LAYOUT */}
          <motion.div className="lg:hidden space-y-4" initial="hidden" animate="show" variants={stagger}>
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
          <motion.div className="hidden lg:block space-y-5" initial="hidden" animate="show" variants={stagger}>

            {/* Row 1 — Hero full width */}
            <HeroBanner user={user} profile={profile} isOnline={isOnline} status={status} completion={completion} />

            {/* Row 2 — 4 stat cards */}
            <StatCards performance={performance} earnings={earnings} />

            {/* Row 3 — health banner */}
            <HealthBanner profile={profile} />

            {/* Row 4 — 3-col grid */}
            <div className="grid grid-cols-12 gap-5">

              {/* Col 1: left (4) */}
              <div className="col-span-4 space-y-5">
                <QuickActions />
                <KycCard kycStatus={kycStatus} />
                <NotifCard settings={settings} />
              </div>

              {/* Col 2: center (4) */}
              <div className="col-span-4 space-y-5">
                <PerformanceRings performance={performance} />
                <AvailabilityHeatmap profile={profile} />
                <BankCard bankDetails={bankDetails} />
              </div>

              {/* Col 3: right (4) */}
              <div className="col-span-4 space-y-5">
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