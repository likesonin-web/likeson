'use client';

import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BarChart3, Star, TrendingUp,
  Car, BadgeCheck, ClipboardList, AlertTriangle,
  Landmark, WalletCards, ToggleRight, Map,
  Bell, Settings2, Lock, ChevronRight,
  Navigation, MapPin, Phone, Shield,
  Zap, Award, Clock, IndianRupee,
  Activity, CheckCircle2, XCircle, Timer,
  ArrowUpRight, ArrowDownRight, Flame,
  Battery, Wifi, Signal, Menu, X,
  UserRound, FileCheck2, HeartPulse,
  FileText, Wrench, ReceiptIndianRupee,
  Tag, CircleDollarSign,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Redux selectors ────────────────────────────────────────────────────────────
export const selectUser    = (s) => s.user.user;
export const selectProfile = (s) => s.user.profile;

// ── Animation variants ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

const slideIn = {
  hidden: { opacity: 0, x: -20 },
  show:   { opacity: 1, x: 0,   transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1,   transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

// ── Static demo data ───────────────────────────────────────────────────────────
const DEMO_STATS = [
  { label: 'Total Rides',     value: '1,284',   delta: '+12%',  up: true,  icon: Car,          color: 'primary' },
  { label: 'Total Earnings',  value: '₹84,200', delta: '+8.4%', up: true,  icon: IndianRupee,  color: 'success' },
  { label: 'Avg. Rating',     value: '4.82',    delta: '+0.1',  up: true,  icon: Star,         color: 'warning' },
  { label: 'Completion Rate', value: '96.3%',   delta: '-0.5%', up: false, icon: CheckCircle2, color: 'info'    },
];

const RECENT_RIDES = [
  { id: 'RD-0012', from: 'Labbipet',    to: 'Vijayawada Jn.', fare: '₹420', status: 'completed', time: '2h ago' },
  { id: 'RD-0011', from: 'Benz Circle', to: 'MG Road',        fare: '₹180', status: 'completed', time: '5h ago' },
  { id: 'RD-0010', from: 'Auto Nagar',  to: 'Governorpet',    fare: '₹310', status: 'cancelled', time: '8h ago' },
  { id: 'RD-0009', from: 'Patamata',    to: 'One Town',       fare: '₹260', status: 'completed', time: '1d ago' },
];

const COMPLIANCE_ITEMS = [
  { label: 'Driving Licence', expiry: '12 Jun 2025', status: 'expiring', daysLeft: 59  },
  { label: 'Insurance Policy',expiry: '30 Sep 2025', status: 'ok',       daysLeft: 169 },
  { label: 'PSV Badge',       expiry: '01 May 2025', status: 'critical', daysLeft: 17  },
  { label: 'Pollution Cert',  expiry: '15 Aug 2025', status: 'ok',       daysLeft: 123 },
];

const QUICK_ACTIONS = [
  { label: 'Go Online',       href: '/partner/solo/availability',       icon: ToggleRight,      color: 'success' },
  { label: 'Location',        href: '/partner/solo/vehicle/location',   icon: Navigation,       color: 'primary' },
  { label: 'Submit KYC',      href: '/partner/solo/kyc/submit',         icon: FileCheck2,       color: 'info'    },
  { label: 'Zones',           href: '/partner/solo/service-zones',      icon: Map,              color: 'warning' },
  { label: 'Medical',         href: '/partner/solo/kyc/medical',        icon: HeartPulse,       color: 'error'   },
  { label: 'Earnings',        href: '/partner/solo/settlement',         icon: ReceiptIndianRupee,color: 'accent'  },
];

// ── Nav links (inline, avoids the 'use client' import problem) ──────────────
const SIDEBAR_GROUPS = [
  {
    title: 'Dashboard',
    icon: <LayoutDashboard size={16} />,
    links: [
      { name: 'Overview',    href: '/partner/solo/dashboard',   icon: <LayoutDashboard size={14} /> },
      { name: 'Stats',       href: '/partner/solo/stats',       icon: <BarChart3 size={14} />       },
      { name: 'My Rating',   href: '/partner/solo/rating',      icon: <Star size={14} />            },
      { name: 'Performance', href: '/partner/solo/performance', icon: <TrendingUp size={14} />      },
    ],
  },
  {
    title: 'My Profile',
    icon: <UserRound size={16} />,
    links: [
      { name: 'Personal Details',  href: '/partner/solo/profile',                icon: <UserRound size={14} />  },
      { name: 'Contact Info',      href: '/partner/solo/profile/contact',        icon: <Phone size={14} />      },
      { name: 'Address',           href: '/partner/solo/profile/address',        icon: <MapPin size={14} />     },
      { name: 'Professional Info', href: '/partner/solo/profile/professional',   icon: <Award size={14} />      },
      { name: 'Emergency Contact', href: '/partner/solo/profile/emergency',      icon: <Shield size={14} />     },
    ],
  },
  {
    title: 'KYC & Verification',
    icon: <BadgeCheck size={16} />,
    links: [
      { name: 'KYC Status',       href: '/partner/solo/kyc',         icon: <BadgeCheck size={14} />  },
      { name: 'Submit Documents', href: '/partner/solo/kyc/submit',  icon: <FileCheck2 size={14} />  },
      { name: 'Medical Fitness',  href: '/partner/solo/kyc/medical', icon: <HeartPulse size={14} />  },
      { name: 'PSV Badge',        href: '/partner/solo/kyc/psv',     icon: <Shield size={14} />      },
    ],
  },
  {
    title: 'Vehicle',
    icon: <Car size={16} />,
    links: [
      { name: 'Vehicle Details',   href: '/partner/solo/vehicle',             icon: <Car size={14} />       },
      { name: 'Vehicle Documents', href: '/partner/solo/vehicle/documents',   icon: <FileText size={14} />  },
      { name: 'Features & Extras', href: '/partner/solo/vehicle/features',    icon: <Wrench size={14} />    },
      { name: 'Update Location',   href: '/partner/solo/vehicle/location',    icon: <Navigation size={14} />},
    ],
  },
  {
    title: 'Bank & Earnings',
    icon: <Landmark size={16} />,
    links: [
      { name: 'Bank Details',       href: '/partner/solo/bank',        icon: <Landmark size={14} />          },
      { name: 'Settlement History', href: '/partner/solo/settlement',  icon: <ReceiptIndianRupee size={14} /> },
      { name: 'Wallet',             href: '/partner/solo/wallet',      icon: <WalletCards size={14} />       },
      { name: 'Payouts',            href: '/partner/solo/payouts',     icon: <IndianRupee size={14} />       },
    ],
  },
  {
    title: 'Availability & Zones',
    icon: <ToggleRight size={16} />,
    links: [
      { name: 'Go Online / Offline', href: '/partner/solo/availability',        icon: <ToggleRight size={14} /> },
      { name: 'Service Zones',       href: '/partner/solo/service-zones',       icon: <Map size={14} />         },
    ],
  },
  {
    title: 'Pricing',
    icon: <CircleDollarSign size={16} />,
    links: [
      { name: 'My Pricing Config', href: '/partner/solo/pricing',          icon: <Tag size={14} />              },
      { name: 'Platform Fee Info', href: '/partner/solo/pricing/platform', icon: <CircleDollarSign size={14} /> },
    ],
  },
  {
    title: 'Compliance',
    icon: <ClipboardList size={16} />,
    links: [
      { name: 'Document Expiry', href: '/partner/solo/compliance',        icon: <ClipboardList size={14} /> },
      { name: 'Expiry Alerts',   href: '/partner/solo/compliance/alerts', icon: <AlertTriangle size={14} /> },
    ],
  },
  {
    title: 'Security',
    icon: <Lock size={16} />,
    links: [
      { name: 'Active Sessions',    href: '/partner/solo/security/sessions',        icon: <Activity size={14} />  },
      { name: 'Change Password',    href: '/partner/solo/security/change-password', icon: <Lock size={14} />      },
    ],
  },
];

 

// ── Color helpers ──────────────────────────────────────────────────────────────
const colorMap = {
  primary: { bg: 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]', text: 'text-[var(--primary)]' },
  success: { bg: 'bg-[color-mix(in_srgb,var(--success)_12%,transparent)]', text: 'text-[var(--success)]' },
  warning: { bg: 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]', text: 'text-[var(--warning)]' },
  info:    { bg: 'bg-[color-mix(in_srgb,var(--info)_12%,transparent)]',    text: 'text-[var(--info)]'    },
  error:   { bg: 'bg-[color-mix(in_srgb,var(--error)_12%,transparent)]',   text: 'text-[var(--error)]'   },
  accent:  { bg: 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]',  text: 'text-[var(--accent)]'  },
};

const statusColor = {
  completed: 'text-[var(--success)]',
  cancelled:  'text-[var(--error)]',
  pending:    'text-[var(--warning)]',
};

const complianceInfo = {
  ok:       { dot: 'bg-[var(--success)]', cls: 'badge-success', label: 'OK'       },
  expiring: { dot: 'bg-[var(--warning)]', cls: 'badge-warning', label: 'Expiring' },
  critical: { dot: 'bg-[var(--error)]',   cls: 'badge-error',   label: 'Critical' },
};

// ── Small reusable pieces ──────────────────────────────────────────────────────

function OnlineToggle({ isOnline, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onToggle}
      className={[
        'relative flex items-center gap-2 px-3.5 py-2 rounded-[var(--r-field)]',
        'font-bold text-xs transition-all duration-300 cursor-pointer select-none',
        isOnline
          ? 'bg-[var(--success)] text-[var(--success-content)] shadow-[0_0_20px_color-mix(in_srgb,var(--success),transparent_50%)]'
          : 'bg-[var(--base-300)] text-[var(--base-content)]',
      ].join(' ')}
    >
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-current opacity-40'}`} />
      {isOnline ? 'Online' : 'Offline'}
    </motion.button>
  );
}

function StatCard({ item }) {
  const Icon = item.icon;
  const c    = colorMap[item.color];
  return (
    <motion.div variants={scaleIn} className="glass-card p-4 flex flex-col gap-3 group">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-[var(--r-selector)] flex items-center justify-center ${c.bg} ${c.text}`}>
          <Icon size={16} />
        </div>
        <span className={`flex items-center gap-0.5 text-xs font-bold ${item.up ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          {item.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {item.delta}
        </span>
      </div>
      <div>
        <p className="font-black text-xl text-[var(--base-content)] leading-none">{item.value}</p>
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-50 text-[var(--base-content)] mt-1">{item.label}</p>
      </div>
    </motion.div>
  );
}

function CompletionRing({ percent }) {
  const r    = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--base-300)" strokeWidth="5" />
        <motion.circle
          cx="28" cy="28" r={r}
          fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (percent / 100) * circ }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
        />
      </svg>
      <span className="absolute text-[0.6rem] font-black text-[var(--primary)]">{percent}%</span>
    </div>
  );
}

function ProfileCard({ user, profile }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center gap-3.5">
        <div className="relative flex-shrink-0">
          <img
            src={user?.avatar || 'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_59%20AM.png?updatedAt=1770615249818'}
            alt={user?.name}
            className="w-14 h-14 rounded-[var(--r-box)] object-cover ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--base-100)]"
          />
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[var(--success)] rounded-full ring-2 ring-[var(--base-100)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-[var(--base-content)] truncate">
            {profile?.legalName || user?.name || 'Partner Name'}
          </h3>
          <p className="text-[0.65rem] text-[var(--base-content)] opacity-55 truncate">{user?.email || 'partner@email.com'}</p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="badge badge-primary text-[0.6rem] py-0.5">Solo Driver</span>
            <span className="badge badge-success text-[0.6rem] py-0.5">Active</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-widest opacity-50 text-[var(--base-content)]">Profile Completion</p>
          <p className="text-sm font-black text-[var(--primary)] mt-0.5">{profile?.profileCompletionPercent ?? 64}% done</p>
        </div>
        <CompletionRing percent={profile?.profileCompletionPercent ?? 64} />
      </div>

      <div className="mt-3 progress-bar">
        <motion.div
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${profile?.profileCompletionPercent ?? 64}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
        />
      </div>

      <Link href="/partner/solo/profile">
        <motion.div whileHover={{ x: 3 }} className="mt-3.5 flex items-center justify-between text-xs font-bold text-[var(--primary)] cursor-pointer">
          Complete profile <ChevronRight size={13} />
        </motion.div>
      </Link>
    </motion.div>
  );
}

function QuickActions() {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)] mb-4">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const c    = colorMap[action.color];
          return (
            <Link key={action.label} href={action.href}>
              <motion.div
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.93 }}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-[var(--r-field)] ${c.bg} cursor-pointer transition-all`}
              >
                <Icon size={16} className={c.text} />
                <span className={`text-[0.58rem] font-bold text-center leading-tight ${c.text}`}>{action.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

function EarningsSummary() {
  const bars = [40, 65, 52, 80, 70, 90, 75];
  const days  = ['M','T','W','T','F','S','S'];
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Weekly Earnings</h3>
        <Link href="/partner/solo/settlement">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">Details</span>
        </Link>
      </div>

      <div className="flex items-end gap-1.5 h-14 mb-2">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              background: i === 5
                ? 'var(--primary)'
                : 'color-mix(in srgb,var(--primary),transparent 60%)',
              alignSelf: 'flex-end',
            }}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.6, delay: i * 0.07, ease: 'easeOut' }}
          />
        ))}
      </div>
      <div className="flex items-center justify-around text-[0.58rem] opacity-40 text-[var(--base-content)] mb-4">
        {days.map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'This Week', value: '₹6,840', color: 'text-[var(--primary)]'  },
          { label: 'Pending',   value: '₹1,200', color: 'text-[var(--warning)]' },
          { label: 'Total',     value: '₹84,200',color: 'text-[var(--success)]' },
          { label: 'Platform',  value: '₹8,420', color: 'text-[var(--error)]'   },
        ].map((item) => (
          <div key={item.label} className="p-3 rounded-[var(--r-field)] bg-[var(--base-200)]">
            <p className="text-[0.6rem] opacity-50 font-semibold text-[var(--base-content)]">{item.label}</p>
            <p className={`text-sm font-black mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RecentRides() {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Recent Rides</h3>
        <Link href="/partner/solo/stats">
          <span className="text-xs font-bold text-[var(--primary)] cursor-pointer hover:underline">View all</span>
        </Link>
      </div>
      <div className="space-y-2.5">
        {RECENT_RIDES.map((r, i) => (
          <motion.div
            key={r.id}
            variants={slideIn}
            className="flex items-center gap-2.5 p-2.5 rounded-[var(--r-field)] bg-[var(--base-200)] hover:bg-[var(--base-300)] transition-colors"
          >
            <div className="w-7 h-7 rounded-[var(--r-selector)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] flex items-center justify-center flex-shrink-0">
              <Car size={13} className="text-[var(--primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--base-content)] truncate">{r.from} → {r.to}</p>
              <p className="text-[0.58rem] opacity-45 text-[var(--base-content)]">{r.id} · {r.time}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-black text-[var(--base-content)]">{r.fare}</p>
              <p className={`text-[0.58rem] font-bold capitalize ${statusColor[r.status]}`}>{r.status}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ComplianceWidget() {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)]">Compliance</h3>
        <Link href="/partner/solo/compliance/alerts">
          <span className="text-xs font-bold text-[var(--warning)] cursor-pointer hover:underline flex items-center gap-1">
            <AlertTriangle size={11} /> Alerts
          </span>
        </Link>
      </div>
      <div className="space-y-2.5">
        {COMPLIANCE_ITEMS.map((item) => {
          const c = complianceInfo[item.status];
          return (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className="text-xs font-semibold text-[var(--base-content)] truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[0.58rem] opacity-45 text-[var(--base-content)]">{item.daysLeft}d</span>
                <span className={`badge ${c.cls} text-[0.55rem] py-0.5 px-1.5`}>{c.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function VehicleCard({ profile }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)] mb-4">Vehicle Status</h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[var(--r-field)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] flex items-center justify-center">
          <Car size={18} className="text-[var(--primary)]" />
        </div>
        <div>
          <p className="text-sm font-black text-[var(--base-content)]">
            {profile?.vehicle?.make || 'Toyota'} {profile?.vehicle?.model || 'Innova'}
          </p>
          <p className="text-xs opacity-50 text-[var(--base-content)]">
            {profile?.vehicle?.registrationNumber || 'AP 16 AB 1234'}
          </p>
        </div>
        <span className="ml-auto badge badge-success text-[0.6rem]">Verified</span>
      </div>
      <div className="space-y-1.5">
        {[
          { label: 'Insurance',    ok: true  },
          { label: 'RC Book',      ok: true  },
          { label: 'Fitness Cert', ok: false },
          { label: 'Permit',       ok: true  },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--base-content)] opacity-65">{item.label}</span>
            {item.ok
              ? <CheckCircle2 size={13} className="text-[var(--success)]" />
              : <XCircle      size={13} className="text-[var(--error)]"   />
            }
          </div>
        ))}
      </div>
      <Link href="/partner/solo/vehicle/documents">
        <motion.div whileHover={{ x: 3 }} className="mt-3.5 flex items-center justify-between text-xs font-bold text-[var(--primary)] cursor-pointer">
          Manage documents <ChevronRight size={13} />
        </motion.div>
      </Link>
    </motion.div>
  );
}

function RatingCard() {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5">
      <h3 className="font-black text-xs uppercase tracking-widest text-[var(--base-content)] mb-4">Rating Breakdown</h3>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="text-4xl font-black text-[var(--primary)] leading-none">4.82</p>
          <div className="flex items-center gap-0.5 mt-1">
            {[1,2,3,4,5].map((s) => (
              <Star key={s} size={10} className={s <= 5 ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--base-300)]'} />
            ))}
          </div>
          <p className="text-[0.6rem] opacity-40 text-[var(--base-content)] mt-1">1,284 rides</p>
        </div>
        <div className="flex-1 space-y-1">
          {[5,4,3,2,1].map((star, i) => (
            <div key={star} className="flex items-center gap-1.5">
              <span className="text-[0.58rem] opacity-45 text-[var(--base-content)] w-2">{star}</span>
              <div className="flex-1 h-1.5 bg-[var(--base-300)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--warning)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${[76,15,6,2,1][i]}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                />
              </div>
              <span className="text-[0.55rem] opacity-35 text-[var(--base-content)] w-5 text-right">{[76,15,6,2,1][i]}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Desktop Sidebar ────────────────────────────────────────────────────────────
function DesktopSidebar({ activePath }) {
  const [openGroup, setOpenGroup] = useState('Dashboard');

  return (
    <aside className="hidden lg:flex flex-col w-60 xl:w-64 h-screen sticky top-0 bg-[var(--base-200)] border-r border-[var(--base-300)] overflow-y-auto flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[var(--base-300)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[var(--r-field)] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shadow-[0_4px_12px_color-mix(in_srgb,var(--primary),transparent_60%)]">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <p className="font-black text-sm text-[var(--base-content)] leading-none">Likeson</p>
            <p className="text-[0.55rem] text-[var(--primary)] font-bold uppercase tracking-widest">Partner Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {SIDEBAR_GROUPS.map((group) => {
          const isOpen = openGroup === group.title;
          return (
            <div key={group.title}>
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.title)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[var(--r-field)] hover:bg-[var(--base-300)] transition-colors cursor-pointer"
              >
                <span className="text-[var(--primary)] opacity-75">{group.icon}</span>
                <span className="flex-1 text-left text-[0.65rem] font-bold text-[var(--base-content)] uppercase tracking-wider">{group.title}</span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={12} className="opacity-35" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3.5 pl-2.5 border-l border-[var(--base-300)] mt-0.5 mb-1 space-y-0.5">
                      {group.links.map((link) => {
                        const isActive = activePath === link.href;
                        return (
                          <Link key={link.href} href={link.href}>
                            <motion.div
                              whileHover={{ x: 2 }}
                              className={[
                                'flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--r-field)] text-[0.65rem] font-semibold cursor-pointer transition-colors',
                                isActive
                                  ? 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]'
                                  : 'text-[var(--base-content)] opacity-60 hover:opacity-100 hover:bg-[var(--base-300)]',
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

      {/* Footer */}
      <div className="p-3 border-t border-[var(--base-300)]">
        <Link href="/partner/solo/security/sessions">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--r-field)] text-[0.65rem] font-semibold text-[var(--base-content)] opacity-50 hover:opacity-100 hover:bg-[var(--base-300)] transition-all cursor-pointer">
            <Lock size={12} /> Security & Sessions
          </div>
        </Link>
      </div>
    </aside>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SoloPartnerDashboard() {
  const user    = useSelector(selectUser);
  const profile = useSelector(selectProfile);

  const [isOnline,   setIsOnline]   = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [greeting,   setGreeting]   = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  const firstName = profile?.displayName?.split(' ')[0]
    || user?.name?.split(' ')[0]
    || 'Partner';

  return (
    <div data-theme="solodriverpartner" className="min-h-screen bg-[var(--base-100)] flex">

      {/* Desktop sidebar */}
      <DesktopSidebar activePath="/partner/solo/dashboard" />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-[90] bg-[color-mix(in_srgb,var(--base-100)_85%,transparent)] backdrop-blur-strong border-b border-[var(--base-300)] px-4 lg:px-6 py-3 flex items-center justify-between gap-3">

          {/* Mobile hamburger */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="lg:hidden w-8 h-8 rounded-[var(--r-field)] bg-[var(--base-300)] flex items-center justify-center cursor-pointer"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={15} className="text-[var(--base-content)]" />
          </motion.button>

          {/* Title */}
          <div className="flex-1">
            <h1 className="text-sm lg:text-base font-black text-[var(--base-content)] leading-tight">
              {greeting}, <span className="text-[var(--primary)]">{firstName}</span> 👋
            </h1>
            <p className="text-[0.6rem] opacity-45 text-[var(--base-content)] hidden lg:block mt-0.5">
              {profile?.partnerCode || 'LKS-SDP-XXXXX'} · Solo Driver Partner
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <OnlineToggle isOnline={isOnline} onToggle={() => setIsOnline(!isOnline)} />
            <Link href="/partner/solo/notifications">
              <motion.button whileTap={{ scale: 0.9 }} className="relative w-8 h-8 rounded-[var(--r-field)] bg-[var(--base-200)] flex items-center justify-center cursor-pointer hover:bg-[var(--base-300)] transition-colors">
                <Bell size={15} className="text-[var(--base-content)]" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[var(--error)] rounded-full" />
              </motion.button>
            </Link>
            <Link href="/partner/solo/profile">
              <motion.img
                whileTap={{ scale: 0.9 }}
                src={user?.avatar || 'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_59%20AM.png?updatedAt=1770615249818'}
                alt="avatar"
                className="w-8 h-8 lg:w-9 lg:h-9 rounded-[var(--r-field)] object-cover ring-2 ring-[var(--primary)] cursor-pointer"
              />
            </Link>
          </div>
        </header>

        {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileMenu(false)}
              />
              <motion.div
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 250 }}
                className="fixed inset-y-0 left-0 z-[201] w-72 bg-[var(--base-200)] shadow-2xl overflow-y-auto lg:hidden"
              >
                {/* Drawer header */}
                <div className="px-4 py-4 border-b border-[var(--base-300)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[var(--r-field)] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center">
                      <Zap size={15} className="text-white" />
                    </div>
                    <p className="font-black text-sm text-[var(--base-content)]">Likeson Partner</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMobileMenu(false)} className="cursor-pointer">
                    <X size={17} className="text-[var(--base-content)] opacity-55" />
                  </motion.button>
                </div>

                {/* Drawer nav */}
                <nav className="px-3 py-3">
                  {SIDEBAR_GROUPS.map((group) => (
                    <div key={group.title} className="mb-3">
                      <p className="px-2 mb-1 text-[0.55rem] font-black uppercase tracking-widest text-[var(--primary)] opacity-80">{group.title}</p>
                      {group.links.map((link) => (
                        <Link key={link.href} href={link.href} onClick={() => setMobileMenu(false)}>
                          <div className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--r-field)] text-xs font-semibold text-[var(--base-content)] opacity-75 hover:opacity-100 hover:bg-[var(--base-300)] transition-all cursor-pointer">
                            {link.icon} {link.name}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Page body ─────────────────────────────────────────────────────── */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-8 overflow-x-hidden">

          {/* ─── MOBILE layout ─── */}
          <motion.div
            className="lg:hidden space-y-4"
            initial="hidden"
            animate="show"
            variants={stagger}
          >
            {/* 2-col stat grid */}
            <motion.div variants={stagger} className="grid grid-cols-2 gap-3">
              {DEMO_STATS.map((s) => <StatCard key={s.label} item={s} />)}
            </motion.div>

            <ProfileCard user={user} profile={profile} />
            <QuickActions />
            <EarningsSummary />
            <RecentRides />
            <ComplianceWidget />
          </motion.div>

          {/* ─── DESKTOP layout ─── */}
          <motion.div
            className="hidden lg:block"
            initial="hidden"
            animate="show"
            variants={stagger}
          >
            {/* Row 1 — 4 stat cards */}
            <motion.div variants={stagger} className="grid grid-cols-4 gap-4 mb-6">
              {DEMO_STATS.map((s) => <StatCard key={s.label} item={s} />)}
            </motion.div>

            {/* Row 2 — 3-column grid */}
            <div className="grid grid-cols-12 gap-5">

              {/* Col A (3 cols) — Profile + Quick Actions */}
              <div className="col-span-3 space-y-5">
                <ProfileCard user={user} profile={profile} />
                <QuickActions />
              </div>

              {/* Col B (5 cols) — Earnings + Recent Rides */}
              <div className="col-span-5 space-y-5">
                <EarningsSummary />
                <RecentRides />
              </div>

              {/* Col C (4 cols) — Compliance + Vehicle + Rating */}
              <div className="col-span-4 space-y-5">
                <ComplianceWidget />
                <VehicleCard profile={profile} />
                <RatingCard />
              </div>
            </div>
          </motion.div>
        </main>
      </div>

     
    </div>
  );
}