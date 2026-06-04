'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

// ── Lucide ────────────────────────────────────────────────────────────────────
import {
  Menu, X, ChevronRight, ChevronDown,
  MapPin, AlertCircle, TrendingUp, Star,
  Activity, Navigation, Zap, Clock,
  Shield, Wifi, LogOut,
} from 'lucide-react';

// ── Recharts ──────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';

// ── Driver nav links ──────────────────────────────────────────────────────────
import {
  DRIVER_DASHBOARD_LINKS,
  DRIVER_TOP_RIGHT_LINKS,
  DRIVER_PROFILE_LINKS,
} from '@/constants/driverlinks';

// ── Redux slice thunks ────────────────────────────────────────────────────────
import {
  fetchDriverMe,
  fetchDriverRewards,
  fetchDriverLogs,
  updateDriverStatus,
  resetTPState,
} from '@/store/slices/transportPartnerSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Available', 'On-Break', 'Offline'];

const STATUS_META = {
  Available: { colorClass: 'text-success bg-success', label: 'Available', shadow: 'shadow-success' },
  'On-Trip': { colorClass: 'text-warning bg-warning', label: 'On Trip', shadow: 'shadow-warning' },
  'On-Break':{ colorClass: 'text-info bg-info',       label: 'On Break',  shadow: 'shadow-info' },
  Offline:   { colorClass: 'text-error bg-error',     label: 'Offline',   shadow: 'shadow-error' },
};

const MOCK_WEEKLY = [
  { day: 'Mon', amt: 820  },
  { day: 'Tue', amt: 1240 },
  { day: 'Wed', amt: 960  },
  { day: 'Thu', amt: 1580 },
  { day: 'Fri', amt: 2100 },
  { day: 'Sat', amt: 1750 },
  { day: 'Sun', amt: 630  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const SIDEBAR_V = {
  closed: { x: '-100%', transition: { type: 'spring', stiffness: 400, damping: 42 } },
  open:   { x: 0,       transition: { type: 'spring', stiffness: 360, damping: 36 } },
};

const OVERLAY_V = {
  closed: { opacity: 0, pointerEvents: 'none' },
  open:   { opacity: 1, pointerEvents: 'auto'  },
};

const CARD_V = {
  hidden:  { opacity: 0, y: 24, scale: 0.95 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, type: 'spring', stiffness: 280, damping: 24 },
  }),
};

const ITEM_V = {
  hidden:  { opacity: 0, x: -18 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.055, type: 'spring', stiffness: 320, damping: 28 },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS / MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusDot = ({ status, className = "w-2.5 h-2.5" }) => {
  const m = STATUS_META[status] || STATUS_META.Offline;
  // Extract just the background color class from the colorClass string
  const bgClass = m.colorClass.split(' ').find(c => c.startsWith('bg-'));
  
  return (
    <span className={`inline-block rounded-full shrink-0 ${bgClass} ${m.shadow} ${className}`} />
  );
};

const EarningsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-lg px-3 py-2 text-[11px] text-base-content shadow-depth">
      <p className="font-bold mb-0.5">{label}</p>
      <p className="text-primary font-semibold m-0">₹ {payload[0]?.value?.toLocaleString('en-IN')}</p>
    </div>
  );
};

/** Expandable nav group inside sidebar */
const NavGroup = ({ group, index, onLinkClick }) => {
  const [open, setOpen] = useState(false);

  // ─── Professional Animation Variants ───────────────────────────────
  const dropdownVariants = {
    hidden: { 
      height: 0, 
      opacity: 0,
      transition: { 
        height: { duration: 0.25, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        // Reverse stagger when closing
        staggerChildren: 0.03, 
        staggerDirection: -1 
      }
    },
    visible: { 
      height: 'auto', 
      opacity: 1,
      transition: { 
        height: { duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }, // Smooth bezier curve
        opacity: { duration: 0.4 },
        // Cascade children in after the container starts opening
        staggerChildren: 0.06, 
        delayChildren: 0.05 
      }
    }
  };

  const linkVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } }
  };

  // ───────────────────────────────────────────────────────────────────
  return (
    <motion.div custom={index} variants={ITEM_V} initial="hidden" animate="visible" className="mb-1">
      <button
        onClick={() => setOpen(p => !p)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-field border-none cursor-pointer font-poppins text-[11px] uppercase tracking-tighter font-bold tracking-wide transition-all duration-200 group outline-none focus-visible:ring-2 focus-visible:ring-primary/50
          ${open 
            ? 'bg-primary/10 text-primary shadow-sm' 
            : 'bg-transparent text-base-content hover:bg-base-300/40'
          }`}
      >
        <span className="flex items-center gap-3">
          <span className={`flex shrink-0  transition-colors duration-200 ${open ? 'opacity-100 text-primary' : 'opacity-60 group-hover:opacity-100 group-hover:text-primary'}`}>
            {group.icon}
          </span>
          {group.title}
        </span>
        <motion.span 
          animate={{ rotate: open ? 90 : 0 }} 
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className={`flex shrink-0 ${open ? 'opacity-100' : 'opacity-50'}`}
        >
          <ChevronRight size={14} strokeWidth={2.5} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden"
          >
            {/* Visual guide line for sub-items */}
            <div className="relative ml-[22px] pl-4 py-1.5 mt-1 border-l border-base-300 flex flex-col gap-1">
              {group.links.map(link => (
                <motion.div key={link.href} variants={linkVariants}>
                  <Link
                    href={link.href} 
                    onClick={onLinkClick}
                    className="group relative flex items-center gap-3 px-3 py-2 rounded-md text-base-content/80 text-[10px] uppercase font-medium font-poppins no-underline transition-all duration-200 hover:bg-primary/5 hover:text-primary"
                  >
                    {/* Tiny connecting dot that appears on hover */}
                    <span className="absolute -left-[19px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-base-300 scale-0 group-hover:scale-100 group-hover:bg-primary transition-all duration-300" />
                    
                    <span className="flex shrink-0 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200">
                      {link.icon}
                    </span>
                    {link.name}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/** Stat metric card */
const MetricCard = ({ icon: Icon, label, value, sub, colorTheme = 'primary', index }) => {
  // Map standard tailwind colors based on the passed prop
  const colors = {
    primary: { border: 'border-l-primary', text: 'text-primary', bg: 'bg-primary/10', iconColor: 'var(--color-primary)' },
    accent: { border: 'border-l-accent', text: 'text-accent', bg: 'bg-accent/10', iconColor: 'var(--color-accent)' },
    success: { border: 'border-l-success', text: 'text-success', bg: 'bg-success/10', iconColor: 'var(--color-success)' },
    warning: { border: 'border-l-warning', text: 'text-warning', bg: 'bg-warning/10', iconColor: 'var(--color-warning)' },
  };
  
  const theme = colors[colorTheme] || colors.primary;

  return (
    <motion.div
      custom={index} variants={CARD_V} initial="hidden" animate="visible"
      className={`bg-base-200 border border-base-300 border-l-[3px] ${theme.border} rounded-field p-3.5 flex items-start justify-between shadow-sm hover:-translate-y-0.5 hover:shadow-depth transition-all duration-200`}
    >
      <div className="flex-1">
        <p className="font-poppins text-[0.62rem] font-bold tracking-wider uppercase text-base-content/50 m-0">
          {label}
        </p>
        <p className={`font-montserrat font-extrabold text-2xl m-0 mt-1 leading-none ${theme.text}`}>
          {value}
        </p>
        {sub && (
          <p className="text-[0.65rem] text-base-content/50 mt-1 m-0">
            {sub}
          </p>
        )}
      </div>
      <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${theme.bg}`}>
        <Icon size={20} color={theme.iconColor} strokeWidth={2.2} />
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const { driverMe, driverRewards, loading } = useSelector(s => s.transportPartner);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusMenu,  setStatusMenu]  = useState(false);
  const [toast,       setToast]       = useState(null);

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverRewards());
    dispatch(fetchDriverLogs({ page: 1, limit: 5 }));
  }, [dispatch]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleStatus = async (status) => {
    setStatusMenu(false);
    try {
      await dispatch(updateDriverStatus({ status })).unwrap();
      showToast(`Status → ${status}`);
    } catch (e) {
      showToast(e || 'Update failed', 'error');
    }
  };

  const handleLogout = () => {
    dispatch(resetTPState());
    router.push('/login');
  };

  // Derived values from Driver model shape
  const driver  = driverMe;
  const rewards = driverRewards || driver?.rewards;
  const status  = driver?.status || 'Offline';
  const sm      = STATUS_META[status] || STATUS_META.Offline;
  const perf    = driver?.performance || {};
  const kycOk   = driver?.kyc?.verificationStatus === 'Verified';
  const onTrip  = status === 'On-Trip';

  const radialData = [{ name: 'Rating', value: Math.round(((perf.rating || 0) / 5) * 100), fill: 'var(--color-primary)' }];
  const weekTotal  = MOCK_WEEKLY.reduce((a, b) => a + b.amt, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme="driver" className="min-h-dvh my-4 bg-base-100 overflow-x-hidden font-poppins relative">

      {/* ─── Sidebar overlay backdrop ────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            variants={OVERLAY_V} initial="closed" animate="open" exit="closed"
            transition={{ duration: 0.18 }}
            onClick={closeSidebar}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            variants={SIDEBAR_V} initial="closed" animate="open" exit="closed"
            className="fixed top-0 left-0 bottom-0 w-[78vw] max-w-[280px] z-[100] flex flex-col bg-base-200 border-r border-base-300 overflow-y-auto"
          >
            {/* Sidebar top: driver identity */}
            <div className="p-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] bg-gradient-to-br from-primary to-secondary border-b border-white/10 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full shrink-0 bg-white/20 border-2 border-white/40 flex items-center justify-center overflow-hidden">
                  {driver?.user?.avatar
                    ? <img src={driver.user.avatar} alt="Profile" className="w-full h-full object-cover" />
                    : <span className="font-extrabold text-lg text-white">
                        {(driver?.legalName || 'D')[0].toUpperCase()}
                      </span>
                  }
                </div>
                <div>
                  <p className="font-extrabold text-xs text-white m-0 leading-tight">
                    {driver?.legalName || 'Driver'}
                  </p>
                  <p className="text-[0.68rem] text-white/70 m-0 mt-0.5">
                    {driver?.driverCode || 'ID pending'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusDot status={status} className="w-2 h-2" />
                    <span className="text-[0.66rem] text-white/80 font-semibold">{sm.label}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeSidebar}
                className="bg-white/10 hover:bg-white/20 border-none rounded-lg w-8 h-8 cursor-pointer text-white flex items-center justify-center shrink-0 transition-colors"
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </div>

            {/* KYC warning */}
            {!kycOk && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="mx-3 mt-3 px-3 py-2.5 rounded-field bg-warning/15 border border-warning/50 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-warning shrink-0" />
                <Link
                  href="/driver/kyc/submit" onClick={closeSidebar}
                  className="text-[11px] font-bold text-warning no-underline hover:underline"
                >
                  KYC pending — tap to verify &rarr;
                </Link>
              </motion.div>
            )}

            {/* Nav groups */}
            <nav className="flex-1 p-3 flex flex-col gap-0.5">
              {DRIVER_DASHBOARD_LINKS.map((group, i) => (
                <NavGroup key={group.title} group={group} index={i} onLinkClick={closeSidebar} />
              ))}
            </nav>

            {/* Logout */}
            <div className="p-3 pb-6 border-t border-base-300">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2.5 p-3 rounded-field bg-error/10 border border-error/30 text-error text-xs font-bold font-poppins cursor-pointer tracking-wide hover:bg-error hover:text-error-content transition-colors"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Sticky Top Bar ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 flex items-center justify-between p-3 border-b border-base-300 bg-base-100/90 backdrop-blur-md safe-top">
        {/* Hamburger — opens sidebar */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="bg-base-200 hover:bg-base-300 border border-base-300 rounded-lg w-10 h-10 cursor-pointer flex items-center justify-center text-base-content transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Status pill */}
        <div className="relative">
          <button
            onClick={() => !onTrip && setStatusMenu(p => !p)}
            disabled={onTrip}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-selector border-[1.5px] font-poppins text-[11px] font-bold tracking-wide transition-all
              ${onTrip ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:brightness-95'}
              ${status === 'Available' ? 'bg-success/15 border-success/50 text-success' : ''}
              ${status === 'On-Trip' ? 'bg-warning/15 border-warning/50 text-warning' : ''}
              ${status === 'On-Break' ? 'bg-info/15 border-info/50 text-info' : ''}
              ${status === 'Offline' ? 'bg-error/15 border-error/50 text-error' : ''}
            `}
          >
            <StatusDot status={status} />
            {sm.label}
            {!onTrip && <ChevronDown size={14} className="ml-1 opacity-70" />}
          </button>

          <AnimatePresence>
            {statusMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.94 }}
                transition={{ duration: 0.14 }}
                className="absolute top-[115%] left-1/2 -translate-x-1/2 bg-base-200 border border-base-300 rounded-box shadow-depth overflow-hidden z-50 min-w-[160px]"
              >
                {STATUS_OPTIONS.map(s => {
                   const isActive = s === status;
                   const optMeta = STATUS_META[s] || STATUS_META.Offline;
                   const optTextClass = optMeta.colorClass.split(' ').find(c => c.startsWith('text-'));

                   return (
                    <button
                      key={s} onClick={() => handleStatus(s)}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 border-none cursor-pointer text-xs font-poppins text-left transition-colors
                        ${isActive ? 'bg-primary/10 font-bold ' + optTextClass : 'bg-transparent font-medium text-base-content hover:bg-base-300'}`}
                    >
                      <StatusDot status={s} /> {s}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick-access icons */}
        <div className="flex gap-2">
          {DRIVER_TOP_RIGHT_LINKS.map(l => (
            <Link key={l.href} href={l.href} title={l.name} className="bg-base-200 hover:bg-base-300 border border-base-300 rounded-lg w-10 h-10 text-base-content flex items-center justify-center no-underline transition-colors">
              {l.icon}
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Page Content ─────────────────────────────────────────────────── */}
      <main className="max-w-screen-md mx-auto pb-24 safe-bottom">

        {/* Hero card - Refactored away from bright orange to theme gradient */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 26 }}
          className="mx-4 mt-4 rounded-box overflow-hidden p-5 relative bg-gradient-to-br from-primary to-secondary text-primary-content shadow-primary"
        >
          <div className="relative z-10">
            <p className="text-white/70 text-[0.68rem] font-bold tracking-widest uppercase m-0">
              WELCOME BACK
            </p>
            <h2 className="font-montserrat font-extrabold text-2xl text-white mt-1 mb-4">
              {driver?.legalName || 'Driver'} 👋
            </h2>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'STATUS', content: (
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusDot status={status} />
                    <span className="text-white font-extrabold text-xs">{sm.label}</span>
                  </div>
                )},
                { label: 'TODAY', content: (
                  <p className="text-white font-extrabold text-xs m-0 mt-1">
                    ₹ {(perf.totalEarnings ? Math.round(perf.totalEarnings / 30) : 0).toLocaleString('en-IN')}
                  </p>
                )},
                { label: 'KYC', content: (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Shield size={14} className={kycOk ? 'text-green-400' : 'text-amber-400'} />
                    <span className="text-white font-extrabold text-[11px]">
                      {kycOk ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                )},
              ].map(({ label, content }) => (
                <div key={label} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 shadow-sm">
                  <p className="text-white/60 text-[0.6rem] font-bold tracking-wider uppercase m-0">
                    {label}
                  </p>
                  {content}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Metrics grid */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <MetricCard index={0} icon={Activity}    label="Total Rides"  value={(perf.totalRidesCompleted || 0).toLocaleString('en-IN')} sub="All time"         colorTheme="primary" />
          <MetricCard index={1} icon={Star}        label="Rating"       value={perf.rating ? perf.rating.toFixed(1) : '—'}                sub={`${perf.ratingCount || 0} reviews`} colorTheme="accent" />
          <MetricCard index={2} icon={TrendingUp}   label="Earned"       value={`₹${((perf.totalEarnings || 0) / 1000).toFixed(1)}k`}      sub="Lifetime"         colorTheme="success" />
          <MetricCard index={3} icon={Zap}          label="Coins"        value={(rewards?.coinBalance || 0).toLocaleString('en-IN')}       sub={rewards?.tier || 'Bronze'} colorTheme="warning" />
        </div>

        {/* Rating ring + profile completion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 p-4 rounded-box bg-base-200 border border-base-300 flex items-center gap-4 shadow-sm"
        >
          <div className="w-20 h-20 shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%"
                startAngle={90} endAngle={-270} data={radialData}>
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'var(--color-base-300)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1">
            <p className="font-montserrat font-extrabold text-2xl text-primary m-0 flex items-baseline gap-1">
              {perf.rating ? perf.rating.toFixed(1) : '—'}
              <span className="text-[11px] opacity-50 font-medium text-base-content">/5</span>
            </p>
            <p className="text-[11px] text-base-content/60 mt-0.5 mb-2.5 m-0">
              Tier: <strong className="text-accent opacity-100">{perf.performanceTier || 'Bronze'}</strong>
            </p>
            {/* Profile % bar */}
            <div className="flex items-center gap-2">
              <div className="progress-bar flex-1 h-1.5">
                <div className="progress-bar-fill" style={{ width: `${driver?.profileCompletionPercent || 0}%` }} />
              </div>
              <span className="text-[0.68rem] font-bold text-primary whitespace-nowrap">
                {driver?.profileCompletionPercent || 0}%
              </span>
            </div>
            <p className="text-[0.6rem] text-base-content/40 mt-1 m-0">Profile complete</p>
          </div>
        </motion.div>

        {/* Weekly earnings chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.41, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 p-4 rounded-box bg-base-200 border border-base-300 shadow-sm"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-montserrat font-extrabold text-xs m-0 text-base-content">
                Weekly Earnings
              </h3>
              <p className="text-[11px] text-base-content/50 mt-1 m-0">This week's breakdown</p>
            </div>
            <span className="badge badge-primary text-[0.64rem]">
              ₹ {weekTotal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="w-full h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_WEEKLY} margin={{ top: 4, right: 2, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="drvEarnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<EarningsTooltip />} cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 3' }} />
                <Area type="monotone" dataKey="amt" stroke="var(--color-primary)" strokeWidth={2}
                  fill="url(#drvEarnGrad)"
                  dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--color-primary)', strokeWidth: 2, stroke: 'var(--color-base-100)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Live stats row */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 grid grid-cols-3 gap-2.5"
        >
          {[
            { label: 'Avg Pickup', value: `${perf.avgPickupTimeMinutes || 0}m`,      icon: Clock,      theme: 'text-info border-t-info' },
            { label: 'KM Driven',  value: (perf.totalDistanceKm || 0).toLocaleString('en-IN'), icon: Navigation, theme: 'text-success border-t-success' },
            { label: 'Cancel %',   value: `${Math.round(perf.cancellationRate || 0)}%`,      icon: AlertCircle,theme: 'text-error border-t-error' },
          ].map(({ label, value, icon: Icon, theme }) => (
            <div key={label} className={`bg-base-200 border border-base-300 border-t-2 ${theme} rounded-field p-3 text-center shadow-sm`}>
              <Icon size={18} className="mx-auto mb-1.5 opacity-80" />
              <p className="font-montserrat font-extrabold text-base m-0">
                {value}
              </p>
              <p className="text-[0.6rem] text-base-content/50 mt-1 m-0 uppercase tracking-wide">
                {label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Quick nav chips */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 240, damping: 26 }}
          className="px-4 mt-5"
        >
          <p className="text-[0.62rem] font-bold tracking-wider uppercase text-base-content/40 mb-3 m-0">
            Quick Access
          </p>
          <div className="flex flex-wrap gap-2">
            {DRIVER_PROFILE_LINKS.map(link => (
              <Link 
                key={link.href} 
                href={link.href} 
                className="flex items-center gap-2 px-3.5 py-2 rounded-selector bg-base-200 border border-base-300 text-base-content text-[11px] font-semibold font-poppins no-underline whitespace-nowrap hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <span className="flex opacity-60">{link.icon}</span>
                {link.name}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Connectivity strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.62 }}
          className="mx-4 mt-5 p-3 rounded-field bg-base-200 border border-base-300 flex items-center gap-3 shadow-sm"
        >
          <Wifi size={18} className="text-success shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] font-bold text-base-content m-0">Live Tracking Active</p>
            <p className="text-[0.65rem] text-base-content/50 mt-0.5 m-0">Location syncing every 15s</p>
          </div>
          <div className="flex items-center gap-1.5 text-[0.68rem] font-bold text-success bg-success/10 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Online
          </div>
        </motion.div>

        {loading && (
          <div className="p-5 flex justify-center">
            <div className="loading loading-spinner loading-md text-primary" />
          </div>
        )}

      </main>

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 36, scale: 0.88 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 20,  scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`fixed bottom-[82px] left-1/2 -translate-x-1/2 text-white px-5 py-2.5 rounded-selector text-xs font-bold font-poppins shadow-lg z-[999] whitespace-nowrap ${toast.type === 'error' ? 'bg-error' : 'bg-success'}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}