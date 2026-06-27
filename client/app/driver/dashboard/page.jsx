'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

// ── Lucide ────────────────────────────────────────────────────────────────────
import {
  Menu, X, ChevronRight,
  MapPin, AlertCircle, TrendingUp, Star,
  Activity, Navigation, Zap, Clock,
  Shield, Wifi, LogOut, Bell, Settings,
  Award, BarChart2, Car, FileText,
  User, CreditCard, CheckCircle2,
  ChevronDown, Radio,
} from 'lucide-react';

// ── Recharts ──────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';

// ── Redux slice thunks ────────────────────────────────────────────────────────
import {
  fetchDriverMe,
  fetchDriverRewards,
  fetchDriverLogs,
  updateDriverStatus,
  resetTPState,
} from '@/store/slices/transportPartnerSlice';

// ── Navigation Constants ──────────────────────────────────────────────────────
// Update this path to match exactly where you saved the constants file
import { 
  DRIVER_DASHBOARD_LINKS, 
  DRIVER_TOP_RIGHT_LINKS 
} from '../../../constants/driverlinks'; 

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Available', 'On-Break', 'Offline'];

const STATUS_META = {
  Available: {
    label: 'Available',
    color: 'var(--success)',
    bg: 'color-mix(in srgb, var(--success), transparent 88%)',
    border: 'color-mix(in srgb, var(--success), transparent 55%)',
    textClass: 'text-success',
  },
  'On-Trip': {
    label: 'On Trip',
    color: 'var(--warning)',
    bg: 'color-mix(in srgb, var(--warning), transparent 88%)',
    border: 'color-mix(in srgb, var(--warning), transparent 55%)',
    textClass: 'text-warning',
  },
  'On-Break': {
    label: 'On Break',
    color: 'var(--info)',
    bg: 'color-mix(in srgb, var(--info), transparent 88%)',
    border: 'color-mix(in srgb, var(--info), transparent 55%)',
    textClass: 'text-info',
  },
  Offline: {
    label: 'Offline',
    color: 'var(--error)',
    bg: 'color-mix(in srgb, var(--error), transparent 88%)',
    border: 'color-mix(in srgb, var(--error), transparent 55%)',
    textClass: 'text-error',
  },
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
  hidden: { opacity: 0 },
  visible:{ opacity: 1 },
};

const CARD_V = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, type: 'spring', stiffness: 280, damping: 24 },
  }),
};

const ITEM_V = {
  hidden:  { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.05, type: 'spring', stiffness: 320, damping: 28 },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusDot = ({ status, size = 'md' }) => {
  const m = STATUS_META[status] || STATUS_META.Offline;
  const sizeMap = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3.5 h-3.5' };
  return (
    <span className="relative flex shrink-0" style={{ width: sizeMap[size]?.split(' ')[0]?.replace('w-','')+'*0.25rem' }}>
      <span
        className={`${sizeMap[size]} rounded-full animate-ping absolute opacity-60`}
        style={{ backgroundColor: m.color }}
      />
      <span
        className={`${sizeMap[size]} rounded-full`}
        style={{ backgroundColor: m.color }}
      />
    </span>
  );
};

/** Real toggle status pill — optimized for mobile size */
const StatusToggle = ({ currentStatus, onSelect, disabled }) => {
  const options = STATUS_OPTIONS;
  const currentIdx = options.indexOf(currentStatus);
  const activeIdx = currentIdx === -1 ? 2 : currentIdx;

  return (
    <div
      className="flex items-center rounded-full p-0.5 gap-0.5"
      style={{
        background: 'var(--base-200)',
        border: '1px solid var(--base-300)',
      }}
    >
      {options.map((s, i) => {
        const m = STATUS_META[s];
        const isActive = i === activeIdx;
        return (
          <button
            key={s}
            onClick={() => !disabled && onSelect(s)}
            disabled={disabled}
            style={{
              background: isActive ? m.bg : 'transparent',
              border: isActive ? `1px solid ${m.border}` : '1px solid transparent',
              color: isActive ? m.color : 'color-mix(in oklch, var(--base-content) 50%, transparent)',
            }}
            // Made padding and text smaller on mobile to fit the right icons
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-bold tracking-wide uppercase transition-all duration-200 cursor-pointer outline-none disabled:cursor-not-allowed"
          >
            <span
              className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0"
              style={{ background: isActive ? m.color : 'currentColor', opacity: isActive ? 1 : 0.4 }}
            />
            {/* Show full label on sm+ screens */}
            <span className="hidden sm:inline">{m.label}</span>
            {/* Show truncated label (first 3 letters) on mobile */}
            <span className="sm:hidden">{m.label.substring(0, 3)}</span>
          </button>
        );
      })}
    </div>
  );
};

const EarningsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl text-[11px] shadow-xl"
      style={{
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        color: 'var(--base-content)',
      }}
    >
      <p className="font-bold mb-0.5 m-0">{label}</p>
      <p className="m-0" style={{ color: 'var(--primary)', fontWeight: 700 }}>
        ₹ {payload[0]?.value?.toLocaleString('en-IN')}
      </p>
    </div>
  );
};

const NavGroup = ({ group, index, onLinkClick }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div custom={index} variants={ITEM_V} initial="hidden" animate="visible" className="mb-0.5">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-none cursor-pointer text-[10px] uppercase tracking-wider font-bold transition-all duration-200 group outline-none"
        style={{
          background: open ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
          color: open ? 'var(--primary)' : 'var(--base-content)',
        }}
      >
        <span className="flex items-center gap-2.5">
          <span style={{ opacity: open ? 1 : 0.55 }}>{group.icon}</span>
          {group.title}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} style={{ opacity: 0.5 }}>
          <ChevronRight size={13} strokeWidth={2.5} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }, opacity: { duration: 0.3 }, staggerChildren: 0.05, delayChildren: 0.04 } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div
              className="ml-5 pl-4 py-1.5 mt-1 mb-1 flex flex-col gap-0.5"
              style={{ borderLeft: '1px solid var(--base-300)' }}
            >
              {group.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onLinkClick}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[10px] uppercase font-semibold no-underline transition-all duration-200"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--primary), transparent 92%)'; e.currentTarget.style.color = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'color-mix(in oklch, var(--base-content) 70%, transparent)'; }}
                >
                  <span style={{ opacity: 0.6 }}>{link.icon}</span>
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const MetricCard = ({ icon: Icon, label, value, sub, colorVar = 'var(--primary)', index }) => (
  <motion.div
    custom={index} variants={CARD_V} initial="hidden" animate="visible"
    className="rounded-2xl p-4 flex flex-col gap-2"
    style={{
      background: 'var(--base-200)',
      border: `1px solid var(--base-300)`,
      borderTop: `2.5px solid ${colorVar}`,
    }}
  >
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center"
      style={{ background: `color-mix(in srgb, ${colorVar}, transparent 86%)` }}
    >
      <Icon size={16} color={colorVar} strokeWidth={2.2} />
    </div>
    <div>
      <p
        className="font-montserrat font-extrabold text-xl leading-none m-0"
        style={{ color: colorVar }}
      >
        {value}
      </p>
      <p className="text-[0.62rem] font-bold uppercase tracking-wider m-0 mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
        {label}
      </p>
      {sub && (
        <p className="text-[0.6rem] m-0 mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 38%, transparent)' }}>
          {sub}
        </p>
      )}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const { driverMe, driverRewards, loading } = useSelector(s => s.transportPartner);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast,       setToast]       = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverRewards());
    dispatch(fetchDriverLogs({ page: 1, limit: 5 }));
  }, [dispatch]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleStatus = useCallback(async (status) => {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await dispatch(updateDriverStatus({ status })).unwrap();
      showToast(`Status → ${status}`);
    } catch (e) {
      showToast(e || 'Update failed', 'error');
    } finally {
      setStatusLoading(false);
    }
  }, [dispatch, statusLoading, showToast]);

  const handleLogout = useCallback(() => {
    dispatch(resetTPState());
    router.push('/login');
  }, [dispatch, router]);

  // Derived values
  const driver  = driverMe;
  const rewards = driverRewards || driver?.rewards;
  const status  = driver?.status || 'Offline';
  const sm      = STATUS_META[status] || STATUS_META.Offline;
  const perf    = driver?.performance || {};
  const kycOk   = driver?.kyc?.verificationStatus === 'Verified';
  const onTrip  = status === 'On-Trip';

  const radialData = [{
    name: 'Rating',
    value: Math.round(((perf.rating || 0) / 5) * 100),
    fill: 'var(--primary)',
  }];
  const weekTotal = MOCK_WEEKLY.reduce((a, b) => a + b.amt, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      data-theme="driver"
      className="min-h-dvh bg-base-100 font-poppins relative overflow-x-hidden"
    >

      {/* ─── Sidebar Overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            variants={OVERLAY_V} initial="hidden" animate="visible" exit="hidden"
            transition={{ duration: 0.18 }}
            onClick={closeSidebar}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            variants={SIDEBAR_V} initial="closed" animate="open" exit="closed"
            className="fixed top-0 left-0 bottom-0 z-50 flex flex-col overflow-y-auto"
            style={{
              width: 'min(82vw, 288px)',
              background: 'var(--base-200)',
              borderRight: '1px solid var(--base-300)',
            }}
          >
            {/* Sidebar header */}
            <div
              className="p-4 flex items-center justify-between gap-3 border-b"
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 70%, var(--secondary)) 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 0.75rem))',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden font-extrabold text-lg"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)', color: 'white' }}
                >
                  {driver?.user?.avatar
                    ? <img src={driver.user.avatar} alt="" className="w-full h-full object-cover" />
                    : (driver?.legalName || 'D')[0].toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-xs text-white m-0 leading-tight truncate">
                    {driver?.legalName || 'Driver'}
                  </p>
                  <p className="text-[0.67rem] m-0 mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {driver?.driverCode || 'ID pending'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: sm.color }} />
                    <span className="text-[0.65rem] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {sm.label}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeSidebar}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border-none cursor-pointer text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.12)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* KYC warning banner */}
            {!kycOk && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mx-3 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
                style={{ background: 'color-mix(in srgb, var(--warning), transparent 86%)', border: '1px solid color-mix(in srgb, var(--warning), transparent 55%)' }}
              >
                <AlertCircle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <Link
                  href="/driver/kyc/submit" onClick={closeSidebar}
                  className="text-[11px] font-bold no-underline"
                  style={{ color: 'color-mix(in oklch, var(--warning) 80%, oklch(20% 0.04 72))' }}
                >
                  KYC pending — complete now →
                </Link>
              </motion.div>
            )}

            {/* Status toggle in sidebar */}
            <div className="px-3 pt-4 pb-2">
              <p className="text-[0.58rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                My Status
              </p>
              <div
                className="flex rounded-xl p-1 gap-1"
                style={{ background: 'var(--base-300)' }}
              >
                {STATUS_OPTIONS.map(s => {
                  const m = STATUS_META[s];
                  const isActive = s === status;
                  return (
                    <button
                      key={s}
                      onClick={() => !onTrip && handleStatus(s)}
                      disabled={onTrip || statusLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-none text-[10px] font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        background: isActive ? m.bg : 'transparent',
                        color: isActive ? m.color : 'color-mix(in oklch, var(--base-content) 50%, transparent)',
                        border: isActive ? `1px solid ${m.border}` : '1px solid transparent',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isActive ? m.color : 'currentColor', opacity: isActive ? 1 : 0.4 }} />
                      {m.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nav groups mapped via imported constant */}
            <nav className="flex-1 px-3 py-2 flex flex-col gap-0">
              {DRIVER_DASHBOARD_LINKS.map((group, i) => (
                <NavGroup key={group.title} group={group} index={i} onLinkClick={closeSidebar} />
              ))}
            </nav>

            {/* Bottom: logout */}
            <div className="p-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]" style={{ borderTop: '1px solid var(--base-300)' }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold font-poppins cursor-pointer transition-all duration-200 border-none"
                style={{
                  background: 'color-mix(in srgb, var(--error), transparent 90%)',
                  color: 'var(--error)',
                  border: '1px solid color-mix(in srgb, var(--error), transparent 65%)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--error)'; e.currentTarget.style.color = 'var(--error-content)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--error), transparent 90%)'; e.currentTarget.style.color = 'var(--error)'; }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Sticky Top Bar ──────────────────────────────────────────────── */}
      <header
        // Updated paddings & gaps to be smaller on mobile (px-2, gap-1)
        className="sticky top-0 z-30 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-1 sm:gap-3"
        style={{
          background: 'color-mix(in srgb, var(--base-100) 90%, transparent)',
          backdropFilter: 'blur(16px) saturate(160%)',
          borderBottom: '1px solid var(--base-300)',
          paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))',
        }}
      >
        {/* Hamburger - Shrunk on mobile */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
          style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--base-300)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--base-200)'}
          aria-label="Open menu"
        >
          <Menu size={16} className="sm:w-5 sm:h-5" />
        </button>

        {/* Center — Status Toggle */}
        <div className="flex-1 flex justify-center min-w-0 overflow-x-auto no-scrollbar">
          {onTrip ? (
            <div
              className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-4 sm:py-2 rounded-full text-[9px] sm:text-[11px] font-bold truncate"
              style={{
                background: STATUS_META['On-Trip'].bg,
                border: `1px solid ${STATUS_META['On-Trip'].border}`,
                color: STATUS_META['On-Trip'].color,
              }}
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-ping shrink-0" style={{ background: 'var(--warning)' }} />
              On Trip
            </div>
          ) : (
            <StatusToggle
              currentStatus={status}
              onSelect={handleStatus}
              disabled={statusLoading}
            />
          )}
        </div>

        {/* Right — icon links (Using imported constant) */}
        <div className="flex gap-1 sm:gap-2 shrink-0">
          {DRIVER_TOP_RIGHT_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              title={l.name}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center no-underline transition-colors"
              style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--base-300)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--base-200)'; }}
            >
              {l.icon}
            </Link>
          ))}
        </div>
      </header>

      {/* ─── Page Content ─────────────────────────────────────────────────── */}
      <main
        className="mx-auto pb-10"
        style={{
          maxWidth: '768px',
          paddingBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom) + 2rem))',
        }}
      >
        {/* ── Hero Card ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, type: 'spring', stiffness: 260, damping: 28 }}
          className="mx-4 mt-4 rounded-2xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 60%, var(--secondary)) 100%)',
            boxShadow: '0 10px 36px color-mix(in srgb, var(--primary), transparent 62%)',
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'white' }}
          />
          <div
            className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full opacity-[0.07] pointer-events-none"
            style={{ background: 'white' }}
          />

          <div className="relative z-10 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="m-0 text-[0.62rem] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Welcome Back
                </p>
                <h2 className="font-montserrat font-extrabold text-xl text-white m-0 mt-0.5">
                  {driver?.legalName || 'Driver'} 👋
                </h2>
              </div>
              {/* KYC chip */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
                style={{
                  background: kycOk ? 'rgba(255,255,255,0.15)' : 'rgba(255,180,0,0.25)',
                  border: kycOk ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,180,0,0.45)',
                }}
              >
                {kycOk
                  ? <CheckCircle2 size={13} className="text-white" />
                  : <AlertCircle size={13} style={{ color: 'var(--warning)' }} />
                }
                <span className="text-[10px] font-bold text-white">
                  {kycOk ? 'KYC Verified' : 'KYC Pending'}
                </span>
              </div>
            </div>

            {/* 3 quick stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'STATUS',
                  content: (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: sm.color }} />
                      <span className="text-white font-extrabold text-xs">{sm.label}</span>
                    </div>
                  ),
                },
                {
                  label: 'TODAY EST.',
                  content: (
                    <p className="text-white font-extrabold text-xs m-0 mt-0.5">
                      ₹ {(perf.totalEarnings ? Math.round(perf.totalEarnings / 30) : 0).toLocaleString('en-IN')}
                    </p>
                  ),
                },
                {
                  label: 'RIDES',
                  content: (
                    <p className="text-white font-extrabold text-xs m-0 mt-0.5">
                      {(perf.monthlyRides || 0)} this mo.
                    </p>
                  ),
                },
              ].map(({ label, content }) => (
                <div
                  key={label}
                  className="rounded-xl p-2.5"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
                >
                  <p className="m-0 text-[0.58rem] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {label}
                  </p>
                  {content}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Metrics 2×2 grid ───────────────────────────────────────────── */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <MetricCard
            index={0} icon={Activity} label="Total Rides"
            value={(perf.totalRidesCompleted || 0).toLocaleString('en-IN')}
            sub="All time"
            colorVar="var(--primary)"
          />
          <MetricCard
            index={1} icon={Star} label="Rating"
            value={perf.rating ? perf.rating.toFixed(1) : '—'}
            sub={`${perf.ratingCount || 0} reviews`}
            colorVar="var(--accent)"
          />
          <MetricCard
            index={2} icon={TrendingUp} label="Earned"
            value={`₹${((perf.totalEarnings || 0) / 1000).toFixed(1)}k`}
            sub="Lifetime"
            colorVar="var(--success)"
          />
          <MetricCard
            index={3} icon={Zap} label="Coins"
            value={(rewards?.coinBalance || 0).toLocaleString('en-IN')}
            sub={rewards?.tier || 'Bronze'}
            colorVar="var(--warning)"
          />
        </div>

        {/* ── Rating ring + profile % ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 p-4 rounded-2xl flex items-center gap-4"
          style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
        >
          <div className="w-[76px] h-[76px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="68%" outerRadius="100%"
                startAngle={90} endAngle={-270}
                data={radialData}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={6}
                  background={{ fill: 'var(--base-300)' }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-montserrat font-extrabold text-2xl m-0 flex items-baseline gap-1" style={{ color: 'var(--primary)' }}>
              {perf.rating ? perf.rating.toFixed(1) : '—'}
              <span className="text-[11px] font-medium" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>/5</span>
            </p>
            <p className="text-[11px] m-0 mt-0.5 mb-3" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              Tier: <strong style={{ color: 'var(--accent)' }}>{perf.performanceTier || 'Bronze'}</strong>
            </p>
            {/* Profile completion bar */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--base-300)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${driver?.profileCompletionPercent || 0}%`,
                    background: 'linear-gradient(90deg, var(--primary), color-mix(in oklch, var(--primary) 70%, var(--secondary)))',
                  }}
                />
              </div>
              <span className="text-[0.67rem] font-bold shrink-0" style={{ color: 'var(--primary)' }}>
                {driver?.profileCompletionPercent || 0}%
              </span>
            </div>
            <p className="text-[0.58rem] m-0 mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
              Profile complete
            </p>
          </div>
        </motion.div>

        {/* ── Weekly earnings chart ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 p-4 rounded-2xl"
          style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-montserrat font-extrabold text-sm m-0" style={{ color: 'var(--base-content)' }}>
                Weekly Earnings
              </h3>
              <p className="text-[11px] m-0 mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                This week breakdown
              </p>
            </div>
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
              style={{
                background: 'color-mix(in srgb, var(--primary), transparent 88%)',
                border: '1px solid color-mix(in srgb, var(--primary), transparent 65%)',
                color: 'var(--primary)',
              }}
            >
              ₹ {weekTotal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="h-[110px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_WEEKLY} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="drvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.45 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={<EarningsTooltip />}
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 3' }}
                />
                <Area
                  type="monotone" dataKey="amt"
                  stroke="var(--primary)" strokeWidth={2}
                  fill="url(#drvGrad)"
                  dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--base-100)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Live stats row (3-col) ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.47, type: 'spring', stiffness: 240, damping: 26 }}
          className="px-4 mt-4 grid grid-cols-3 gap-2.5"
        >
          {[
            {
              label: 'Avg Pickup',
              value: `${perf.avgPickupTimeMinutes || 0}m`,
              icon: Clock,
              color: 'var(--info)',
            },
            {
              label: 'KM Driven',
              value: (perf.totalDistanceKm || 0).toLocaleString('en-IN'),
              icon: Navigation,
              color: 'var(--success)',
            },
            {
              label: 'Cancel %',
              value: `${Math.round(perf.cancellationRate || 0)}%`,
              icon: AlertCircle,
              color: 'var(--error)',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl p-3 text-center"
              style={{
                background: 'var(--base-200)',
                border: '1px solid var(--base-300)',
                borderTop: `2.5px solid ${color}`,
              }}
            >
              <Icon size={17} className="mx-auto mb-1.5" style={{ color, opacity: 0.85 }} />
              <p className="font-montserrat font-extrabold text-base m-0" style={{ color }}>
                {value}
              </p>
              <p className="text-[0.58rem] uppercase tracking-wide m-0 mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                {label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* ── Quick access chips (Now re-using Top Right Links mapping) ───── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54, type: 'spring', stiffness: 240, damping: 26 }}
          className="px-4 mt-5"
        >
          <p
            className="text-[0.6rem] font-bold tracking-widest uppercase m-0 mb-3"
            style={{ color: 'color-mix(in oklch, var(--base-content) 38%, transparent)' }}
          >
            Quick Access
          </p>
          <div className="flex flex-wrap gap-2">
            {DRIVER_TOP_RIGHT_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold no-underline transition-all duration-200"
                style={{
                  background: 'var(--base-200)',
                  border: '1px solid var(--base-300)',
                  color: 'var(--base-content)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--primary), transparent 90%)';
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary), transparent 55%)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--base-200)';
                  e.currentTarget.style.borderColor = 'var(--base-300)';
                  e.currentTarget.style.color = 'var(--base-content)';
                }}
              >
                <span style={{ opacity: 0.65 }}>{link.icon}</span>
                {link.name}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ── Connectivity strip ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.62 }}
          className="mx-4 mt-5 p-3.5 rounded-2xl flex items-center gap-3"
          style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
        >
          <Wifi size={17} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold m-0" style={{ color: 'var(--base-content)' }}>
              Live Tracking Active
            </p>
            <p className="text-[0.63rem] m-0 mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
              Location syncing every 15s
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold shrink-0"
            style={{
              background: 'color-mix(in srgb, var(--success), transparent 88%)',
              border: '1px solid color-mix(in srgb, var(--success), transparent 60%)',
              color: 'var(--success)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
            Online
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex justify-center py-6">
            <div
              className="w-7 h-7 rounded-full border-[3px] animate-spin"
              style={{
                borderColor: 'color-mix(in srgb, var(--primary), transparent 70%)',
                borderTopColor: 'var(--primary)',
              }}
            />
          </div>
        )}
      </main>

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 32, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 18,  scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed z-[999] text-xs font-bold px-5 py-3 rounded-2xl shadow-xl"
            style={{
              bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom) + 5rem))',
              left: '50%',
              transform: 'translateX(-50%)',
              background: toast.type === 'error' ? 'var(--error)' : 'var(--success)',
              color: toast.type === 'error' ? 'var(--error-content)' : 'var(--success-content)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}