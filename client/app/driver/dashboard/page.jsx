'use client';

/**
 * DriverDashboard.jsx — Likeson.in
 *
 * Mobile / Tablet-only driver dashboard.
 * - Sidebar drawer (closed by default, Framer Motion)
 * - Cockpit-style instrument panel aesthetic
 * - data-theme="driver" → primary: amber/orange, secondary: asphalt
 * - Imports: driverLinks, transportPartnerSlice, Driver + User model shape
 * - No header — parent layout renders it
 */

import { useState, useEffect, useCallback } from 'react';
import Link                                  from 'next/link';
import { useRouter }                         from 'next/navigation';
import { useDispatch, useSelector }          from 'react-redux';
import { motion, AnimatePresence }           from 'framer-motion';

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
  Available: { color: 'var(--success)', label: 'Available', glow: '0 0 12px var(--success)' },
  'On-Trip': { color: 'var(--warning)', label: 'On Trip',   glow: '0 0 12px var(--warning)' },
  'On-Break':{ color: 'var(--info)',    label: 'On Break',  glow: '0 0 10px var(--info)'    },
  Offline:   { color: 'var(--error)',   label: 'Offline',   glow: '0 0 8px var(--error)'    },
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

const StatusDot = ({ status, size = 10 }) => {
  const m = STATUS_META[status] || STATUS_META.Offline;
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', backgroundColor: m.color,
      boxShadow: m.glow, flexShrink: 0,
    }} />
  );
};

const EarningsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--base-100)', border: '1px solid var(--base-300)',
      borderRadius: 8, padding: '7px 12px',
      fontSize: '0.74rem', color: 'var(--base-content)',
      boxShadow: 'var(--shadow-depth)',
    }}>
      <p style={{ fontWeight: 700, margin: '0 0 2px' }}>{label}</p>
      <p style={{ color: 'var(--primary)', margin: 0 }}>₹ {payload[0]?.value?.toLocaleString('en-IN')}</p>
    </div>
  );
};

/** Expandable nav group inside sidebar */
const NavGroup = ({ group, index, onLinkClick }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div custom={index} variants={ITEM_V} initial="hidden" animate="visible">
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 14px', borderRadius: 'var(--r-field)',
          background: open ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: open ? 'var(--primary)' : 'var(--base-content)',
          fontFamily: 'var(--font-family-poppins)', fontSize: '0.81rem', fontWeight: 700,
          letterSpacing: '0.02em', transition: 'background 0.18s, color 0.18s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ opacity: 0.7, display: 'flex', flexShrink: 0 }}>{group.icon}</span>
          {group.title}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronRight size={13} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingLeft: 12, paddingBottom: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {group.links.map(link => (
                <Link
                  key={link.href} href={link.href} onClick={onLinkClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 'calc(var(--r-field) * 0.7)',
                    color: 'var(--base-content)', fontSize: '0.78rem',
                    fontFamily: 'var(--font-family-poppins)', fontWeight: 500,
                    textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
                  }}
                  className="driver-sidebar-link"
                >
                  <span style={{ opacity: 0.6, display: 'flex', flexShrink: 0 }}>{link.icon}</span>
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

/** Stat metric card */
const MetricCard = ({ icon: Icon, label, value, sub, accent = 'var(--primary)', index }) => (
  <motion.div
    custom={index} variants={CARD_V} initial="hidden" animate="visible"
    style={{
      background: `linear-gradient(135deg,
        color-mix(in srgb, var(--base-200) 90%, ${accent} 10%),
        var(--base-200))`,
      border: `1px solid color-mix(in srgb, ${accent}, transparent 78%)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 'var(--r-field)',
      padding: '14px 12px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', opacity: 0.5, margin: 0,
          fontFamily: 'var(--font-family-poppins)', color: 'var(--base-content)',
        }}>{label}</p>
        <p style={{
          fontFamily: 'var(--font-family-montserrat)', fontWeight: 800,
          fontSize: '1.5rem', color: accent, margin: '4px 0 0', lineHeight: 1,
        }}>{value}</p>
        {sub && (
          <p style={{ fontSize: '0.65rem', opacity: 0.45, margin: '3px 0 0', color: 'var(--base-content)' }}>
            {sub}
          </p>
        )}
      </div>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        backgroundColor: `color-mix(in srgb, ${accent}, transparent 82%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={accent} strokeWidth={2.2} />
      </div>
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

  const [sidebarOpen, setSidebarOpen] = useState(false);   // sidebar closed by default ✓
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

  const radialData = [{ name: 'Rating', value: Math.round(((perf.rating || 0) / 5) * 100), fill: 'var(--primary)' }];
  const weekTotal  = MOCK_WEEKLY.reduce((a, b) => a + b.amt, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme="driver" style={{ minHeight: '100dvh', background: 'var(--base-100)', overflowX: 'hidden' }}>

      {/* ─── Sidebar overlay backdrop ────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            variants={OVERLAY_V} initial="closed" animate="open" exit="closed"
            transition={{ duration: 0.18 }}
            onClick={closeSidebar}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.54)', backdropFilter: 'blur(3px)', zIndex: 40,
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            className=' mt-17 pb-10'
            variants={SIDEBAR_V} initial="closed" animate="open" exit="closed"
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: '78vw', maxWidth: 310, zIndex: 50,
              display: 'flex', flexDirection: 'column',
              background: 'var(--base-200)',
              borderRight: '1px solid var(--base-300)',
              overflowY: 'auto',
            }}
          >
            {/* Sidebar top: driver identity */}
            <div style={{
              padding: '18px 16px 15px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {driver?.user?.avatar
                    ? <img src={driver.user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                        {(driver?.legalName || 'D')[0].toUpperCase()}
                      </span>
                  }
                </div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff', margin: 0, lineHeight: 1.2 }}>
                    {driver?.legalName || 'Driver'}
                  </p>
                  <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.68)', margin: '2px 0 0' }}>
                    {driver?.driverCode || 'ID pending'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <StatusDot status={status} size={8} />
                    <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{sm.label}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeSidebar}
                style={{
                  background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 8,
                  width: 32, height: 32, cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </div>

            {/* KYC warning */}
            {!kycOk && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  margin: '12px 12px 0', padding: '10px 12px', borderRadius: 'var(--r-field)',
                  background: 'color-mix(in srgb, var(--warning), transparent 85%)',
                  border: '1px solid color-mix(in srgb, var(--warning), transparent 58%)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <AlertCircle size={14} color="var(--warning)" />
                <Link
                  href="/driver/kyc/submit" onClick={closeSidebar}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--warning)', textDecoration: 'none' }}
                >
                  KYC pending — tap to verify →
                </Link>
              </motion.div>
            )}

            {/* Nav groups */}
            <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {DRIVER_DASHBOARD_LINKS.map((group, i) => (
                <NavGroup key={group.title} group={group} index={i} onLinkClick={closeSidebar} />
              ))}
            </nav>

            {/* Logout */}
            <div style={{ padding: '10px 12px 24px', borderTop: '1px solid var(--base-300)' }} >
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 'var(--r-field)',
                  background: 'color-mix(in srgb, var(--error), transparent 88%)',
                  border: '1px solid color-mix(in srgb, var(--error), transparent 68%)',
                  color: 'var(--error)', fontSize: '0.81rem', fontWeight: 700,
                  fontFamily: 'var(--font-family-poppins)', cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Sticky Top Bar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--base-300)',
        background: 'var(--base-100)', position: 'sticky', top: 0, zIndex: 30,
      }}>
        {/* Hamburger — opens sidebar */}
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            background: 'var(--base-200)', border: '1px solid var(--base-300)',
            borderRadius: 10, width: 40, height: 40, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--base-content)',
          }}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Status pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => !onTrip && setStatusMenu(p => !p)}
            disabled={onTrip}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderRadius: 'var(--r-selector)',
              background: `color-mix(in srgb, ${sm.color}, transparent 84%)`,
              border: `1.5px solid color-mix(in srgb, ${sm.color}, transparent 52%)`,
              
              color: sm.color, fontSize: '0.77rem', fontWeight: 700,
              fontFamily: 'var(--font-family-poppins)', letterSpacing: '0.03em',
              cursor: onTrip ? 'not-allowed' : 'pointer', border: 'none',
            }}
          >
            <StatusDot status={status} size={9} />
            {sm.label}
            {!onTrip && <ChevronDown size={12} />}
          </button>

          <AnimatePresence>
            {statusMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.94 }}
                transition={{ duration: 0.14 }}
                style={{
                  position: 'absolute', top: '115%', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--base-200)', border: '1px solid var(--base-300)',
                  borderRadius: 'var(--r-box)', boxShadow: 'var(--shadow-depth)',
                  overflow: 'hidden', zIndex: 60, minWidth: 160,
                }}
              >
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s} onClick={() => handleStatus(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '11px 16px',
                      background: s === status ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      fontSize: '0.8rem', fontWeight: s === status ? 700 : 500,
                      fontFamily: 'var(--font-family-poppins)',
                      color: s === status ? 'var(--primary)' : 'var(--base-content)',
                      textAlign: 'left',
                    }}
                  >
                    <StatusDot status={s} size={9} /> {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick-access icons */}
        <div style={{ display: 'flex', gap: 7 }}>
          {DRIVER_TOP_RIGHT_LINKS.map(l => (
            <Link key={l.href} href={l.href} title={l.name} style={{
              background: 'var(--base-200)', border: '1px solid var(--base-300)',
              borderRadius: 10, width: 36, height: 36, color: 'var(--base-content)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
            }}>
              {l.icon}
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Page Content ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 768, margin: '0 auto', paddingBottom: 84 }}>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className='bg-orange-500'
          transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 26 }}
          style={{
            margin: '14px 14px 0', borderRadius: 'var(--r-box)', overflow: 'hidden',
        
       
            padding: '20px 18px', position: 'relative',
          }}
        >
 

          <div style={{ position: 'relative' }}>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
              WELCOME BACK
            </p>
            <h2 style={{
              fontFamily: 'var(--font-family-montserrat)', fontWeight: 800,
              fontSize: '1.32rem', color: '#fff', margin: '4px 0 16px',
            }}>
              {driver?.legalName || 'Driver'} 👋
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'STATUS', content: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <StatusDot status={status} size={9} />
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.84rem' }}>{sm.label}</span>
                  </div>
                )},
                { label: 'TODAY', content: (
                  <p style={{ color: '#fff', fontWeight: 800, fontSize: '0.88rem', margin: '4px 0 0' }}>
                    ₹ {(perf.totalEarnings ? Math.round(perf.totalEarnings / 30) : 0).toLocaleString('en-IN')}
                  </p>
                )},
                { label: 'KYC', content: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <Shield size={13} color={kycOk ? 'var(--success)' : 'var(--warning)'} />
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>
                      {kycOk ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                )},
              ].map(({ label, content }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(8px)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                    {label}
                  </p>
                  {content}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Metrics grid */}
        <div style={{ padding: '14px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          <MetricCard index={0} icon={Activity}    label="Total Rides"  value={(perf.totalRidesCompleted || 0).toLocaleString('en-IN')} sub="All time"                  accent="var(--primary)" />
          <MetricCard index={1} icon={Star}         label="Rating"       value={perf.rating ? perf.rating.toFixed(1) : '—'}               sub={`${perf.ratingCount || 0} reviews`} accent="var(--accent)"  />
          <MetricCard index={2} icon={TrendingUp}   label="Earned"       value={`₹${((perf.totalEarnings || 0) / 1000).toFixed(1)}k`}     sub="Lifetime"                 accent="var(--success)" />
          <MetricCard index={3} icon={Zap}           label="Coins"        value={(rewards?.coinBalance || 0).toLocaleString('en-IN')}      sub={rewards?.tier || 'Bronze'} accent="var(--warning)" />
        </div>

        {/* Rating ring + profile completion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, type: 'spring', stiffness: 240, damping: 26 }}
          style={{
            margin: '12px 14px 0', padding: '16px 14px', borderRadius: 'var(--r-box)',
            background: 'var(--base-200)', border: '1px solid var(--base-300)',
            display: 'flex', alignItems: 'center', gap: 16,
          }}
        >
          <div style={{ width: 76, height: 76, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="62%" outerRadius="100%"
                startAngle={90} endAngle={-270} data={radialData}>
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'var(--base-300)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'var(--font-family-montserrat)', fontWeight: 800,
              fontSize: '1.55rem', color: 'var(--primary)', margin: 0,
            }}>
              {perf.rating ? perf.rating.toFixed(1) : '—'}
              <span style={{ fontSize: '0.7rem', opacity: 0.45, fontWeight: 500, marginLeft: 4 }}>/5</span>
            </p>
            <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: '2px 0 9px', color: 'var(--base-content)' }}>
              Tier: <strong style={{ color: 'var(--accent)', opacity: 1 }}>{perf.performanceTier || 'Bronze'}</strong>
            </p>
            {/* Profile % bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="progress-bar" style={{ flex: 1, height: 5 }}>
                <div className="progress-bar-fill" style={{ width: `${driver?.profileCompletionPercent || 0}%` }} />
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                {driver?.profileCompletionPercent || 0}%
              </span>
            </div>
            <p style={{ fontSize: '0.6rem', opacity: 0.38, margin: '3px 0 0', color: 'var(--base-content)' }}>Profile complete</p>
          </div>
        </motion.div>

        {/* Weekly earnings chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.41, type: 'spring', stiffness: 240, damping: 26 }}
          style={{
            margin: '12px 14px 0', padding: '16px 14px', borderRadius: 'var(--r-box)',
            background: 'var(--base-200)', border: '1px solid var(--base-300)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-family-montserrat)', fontWeight: 800, fontSize: '0.86rem', margin: 0 }}>
                Weekly Earnings
              </h3>
              <p style={{ fontSize: '0.65rem', opacity: 0.4, margin: '2px 0 0' }}>This week's breakdown</p>
            </div>
            <span className="badge badge-primary" style={{ fontSize: '0.64rem' }}>
              ₹ {weekTotal.toLocaleString('en-IN')}
            </span>
          </div>

          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={MOCK_WEEKLY} margin={{ top: 4, right: 2, left: -26, bottom: 0 }}>
              <defs>
                <linearGradient id="drvEarnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<EarningsTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 3' }} />
              <Area type="monotone" dataKey="amt" stroke="var(--primary)" strokeWidth={2}
                fill="url(#drvEarnGrad)"
                dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--base-100)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Live stats row */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, type: 'spring', stiffness: 240, damping: 26 }}
          style={{ margin: '12px 14px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
        >
          {[
            { label: 'Avg Pickup', value: `${perf.avgPickupTimeMinutes || 0}m`,                     icon: Clock,      color: 'var(--info)'    },
            { label: 'KM Driven',  value: (perf.totalDistanceKm || 0).toLocaleString('en-IN'),      icon: Navigation, color: 'var(--success)' },
            { label: 'Cancel %',   value: `${Math.round(perf.cancellationRate || 0)}%`,             icon: AlertCircle,color: 'var(--error)'   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{
              background: 'var(--base-200)',
              border: `1px solid color-mix(in srgb, ${color}, transparent 70%)`,
              borderTop: `2px solid ${color}`,
              borderRadius: 'var(--r-field)', padding: '12px 8px', textAlign: 'center',
            }}>
              <Icon size={17} color={color} style={{ marginBottom: 5 }} />
              <p style={{ fontFamily: 'var(--font-family-montserrat)', fontWeight: 800, fontSize: '1rem', color, margin: 0 }}>
                {value}
              </p>
              <p style={{ fontSize: '0.6rem', opacity: 0.45, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Quick nav chips */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 240, damping: 26 }}
          style={{ padding: '14px 14px 0' }}
        >
          <p style={{
            fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', opacity: 0.4, margin: '0 0 10px',
          }}>
            Quick Access
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DRIVER_PROFILE_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 13px', borderRadius: 'var(--r-selector)',
                background: 'var(--base-200)', border: '1px solid var(--base-300)',
                color: 'var(--base-content)', fontSize: '0.77rem', fontWeight: 600,
                fontFamily: 'var(--font-family-poppins)', textDecoration: 'none', whiteSpace: 'nowrap',
              }} className="driver-chip">
                <span style={{ opacity: 0.65, display: 'flex' }}>{link.icon}</span>
                {link.name}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Connectivity strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.62 }}
          style={{
            margin: '12px 14px 0', padding: '12px 14px', borderRadius: 'var(--r-field)',
            background: 'var(--base-200)', border: '1px solid var(--base-300)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <Wifi size={15} color="var(--success)" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.77rem', fontWeight: 700, margin: 0 }}>Live Tracking Active</p>
            <p style={{ fontSize: '0.64rem', opacity: 0.4, margin: '1px 0 0' }}>Location syncing every 15 s</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: 'var(--success)' }}>
            <span className="pulse-dot" />
            Online
          </div>
        </motion.div>

        {loading && (
          <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
            <div className="loading loading-spinner loading-md" />
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
            style={{
              position: 'fixed', bottom: 82, left: '50%', transform: 'translateX(-50%)',
              background: toast.type === 'error' ? 'var(--error)' : 'var(--success)',
              color: '#fff', padding: '10px 22px',
              borderRadius: 'var(--r-selector)', fontSize: '0.79rem', fontWeight: 700,
              fontFamily: 'var(--font-family-poppins)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.28)', zIndex: 999, whiteSpace: 'nowrap',
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Global styles ────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes pulse-dot-anim {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(0.7); }
        }
        .pulse-dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--success);
          animation: pulse-dot-anim 2s ease-in-out infinite;
        }
        .driver-sidebar-link:hover {
          background: color-mix(in srgb, var(--primary), transparent 90%) !important;
          color: var(--primary) !important;
        }
        .driver-chip:hover {
          background: color-mix(in srgb, var(--primary), transparent 88%) !important;
          border-color: color-mix(in srgb, var(--primary), transparent 60%) !important;
          color: var(--primary) !important;
        }
        .bottom-nav-item:hover {
          opacity: 1 !important;
          color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
}