"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, User, ShieldCheck, Settings,
  Stethoscope, Pill, Truck, FlaskConical,
  Wallet, HeartHandshake, Users, ClipboardList,
  History, Bell, CreditCard, UserCircle, ArrowRight,
  SquareUserRound, Shield, KeyRound, ChevronRight,
  Sparkles, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FcInvite } from "react-icons/fc";

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const NAVIGATION_MAP = {
  superadmin: [
    { name: 'Overview',   href: '/superadmin-dashboard', icon: LayoutDashboard },
    { name: 'Users',      href: '/admin/users',          icon: Users           },
    { name: 'Roles',      href: '/admin/roles',          icon: ShieldCheck     },
    { name: 'Logs',       href: '/admin/logs',           icon: ClipboardList   },
    { name: 'Finance',    href: '/admin/finance',        icon: Wallet          },
    { name: 'Settings',   href: '/settings',             icon: Settings        },
    { name: 'My Account', href: '/settings/account',     icon: SquareUserRound },
    { name: 'Security',   href: '/settings/security',    icon: Shield          },
  ],
  admin: [
    { name: 'Dashboard',  href: '/admin',               icon: LayoutDashboard },
    { name: 'Staff',      href: '/admin/staff',         icon: Users           },
    { name: 'Services',   href: '/admin/services',      icon: Settings        },
    { name: 'Settings',   href: '/settings',            icon: Settings        },
    { name: 'My Account', href: '/settings/account',    icon: SquareUserRound },
    { name: 'Security',   href: '/settings/security',   icon: Shield          },
  ],
  doctor: [
    { name: 'Schedule',    href: '/doctor/appointments', icon: ClipboardList },
    { name: 'Patients',    href: '/doctor/patients',     icon: Users         },
    { name: 'Prescribe',   href: '/doctor/prescribe',    icon: Pill          },
    { name: 'My Referral', href: '/my-referral',         icon: FcInvite      },
    { name: 'Earnings',    href: '/doctor/wallet',       icon: Wallet        },
    { name: 'Settings',    href: '/settings',            icon: Settings      },
    { name: 'My Account',  href: '/settings/account',   icon: SquareUserRound },
    { name: 'Security',    href: '/settings/security',  icon: Shield        },
  ],
  customer: [
    { name: 'Profile',         href: '/profile',          icon: UserCircle   },
    { name: 'Bookings',        href: '/my-bookings',      icon: ClipboardList },
    { name: 'Medicine Orders', href: '/pharmacy/orders',  icon: Pill         },
    { name: 'Reports',         href: '/my-reports',       icon: FlaskConical },
    { name: 'My Subscription', href: '/my-subscription',  icon: SquareUserRound },
    { name: 'My Referral',     href: '/my-referral',      icon: FcInvite     },
    { name: 'Wallet',          href: '/wallet',           icon: CreditCard   },
    { name: 'Settings',        href: '/settings',         icon: Settings     },
    { name: 'My Account',      href: '/settings/account', icon: SquareUserRound },
    { name: 'Security',        href: '/settings/security', icon: Shield      },
  ],
  transportpartner: [
    { name: 'Fleet',       href: '/logistics/fleet',   icon: Truck         },
    { name: 'Orders',      href: '/logistics/orders',  icon: ClipboardList },
    { name: 'Drivers',     href: '/logistics/drivers', icon: Users         },
    { name: 'My Referral', href: '/my-referral',       icon: FcInvite      },
    { name: 'Settings',    href: '/settings',          icon: Settings      },
    { name: 'My Account',  href: '/settings/account',  icon: SquareUserRound },
    { name: 'Security',    href: '/settings/security', icon: Shield        },
  ],
  driver: [
    { name: 'Rides',       href: '/driver/rides',      icon: Truck         },
    { name: 'Wallet',      href: '/driver/wallet',     icon: Wallet        },
    { name: 'Stats',       href: '/driver/stats',      icon: LayoutDashboard },
    { name: 'My Referral', href: '/my-referral',       icon: FcInvite      },
    { name: 'Settings',    href: '/settings',          icon: Settings      },
    { name: 'My Account',  href: '/settings/account',  icon: SquareUserRound },
    { name: 'Security',    href: '/settings/security', icon: Shield        },
  ],
  "lab partner": [
    { name: 'Requests',   href: '/lab/requests',        icon: FlaskConical  },
    { name: 'Uploads',    href: '/lab/uploads',         icon: ClipboardList },
    { name: 'Tracking',   href: '/lab/tracking',        icon: History       },
    { name: 'Settings',   href: '/settings',            icon: Settings      },
    { name: 'My Account', href: '/settings/account',    icon: SquareUserRound },
    { name: 'Security',   href: '/settings/security',   icon: Shield        },
  ],
  pharmacy: [
    { name: 'Stock',      href: '/pharmacy/stock',      icon: Pill          },
    { name: 'Orders',     href: '/pharmacy/orders',     icon: ClipboardList },
    { name: 'Sales',      href: '/pharmacy/sales',      icon: Wallet        },
    { name: 'Settings',   href: '/settings',            icon: Settings      },
    { name: 'My Account', href: '/settings/account',    icon: SquareUserRound },
    { name: 'Security',   href: '/settings/security',   icon: Shield        },
  ],
  finance: [
    { name: 'Ledger',     href: '/finance/ledger',      icon: Wallet        },
    { name: 'Refunds',    href: '/finance/refunds',     icon: History       },
    { name: 'Audit',      href: '/finance/audit',       icon: ShieldCheck   },
    { name: 'Settings',   href: '/settings',            icon: Settings      },
    { name: 'My Account', href: '/settings/account',    icon: SquareUserRound },
    { name: 'Security',   href: '/settings/security',   icon: Shield        },
  ],
  "care assistant": [
    { name: 'Care',       href: '/care/patients',       icon: HeartHandshake },
    { name: 'History',    href: '/care/history',        icon: History        },
    { name: 'Schedule',   href: '/care/schedule',       icon: ClipboardList  },
    { name: 'Settings',   href: '/settings',            icon: Settings       },
    { name: 'My Account', href: '/settings/account',    icon: SquareUserRound },
    { name: 'Security',   href: '/settings/security',   icon: Shield         },
  ],
};

const SETTINGS_GROUP_LABEL = 'Account & Security';

// Settings sublabels: left-panel descriptions
const SETTINGS_SUBLABEL = {
  '/settings':          { title: 'Settings',    desc: 'Overview & preferences'      },
  '/settings/account':  { title: 'My Account',  desc: 'Profile, password, email'    },
  '/settings/security': { title: 'Security',    desc: 'Sessions, devices, OAuth'    },
};

// Main nav sublabels keyed by href (optional enrichment)
const NAV_SUBLABEL = {
  '/profile':             'Your personal profile',
  '/my-bookings':         'Appointments & visits',
  '/pharmacy/orders':     'Track your orders',
  '/my-reports':          'Lab & diagnostics',
  '/my-subscription':     'Plans & benefits',
  '/my-referral':         'Earn by sharing',
  '/wallet':              'Balance & transactions',
  '/doctor/appointments': 'Your daily schedule',
  '/doctor/patients':     'Manage patient list',
  '/doctor/prescribe':    'Write prescriptions',
  '/doctor/wallet':       'Earnings & payouts',
  '/superadmin-dashboard':'Platform overview',
  '/admin/users':         'Manage all users',
  '/admin/roles':         'Permissions & access',
  '/admin/logs':          'Activity audit trail',
  '/admin/finance':       'Revenue & reports',
  '/admin':               'Admin overview',
  '/admin/staff':         'Staff management',
  '/admin/services':      'Service configuration',
  '/logistics/fleet':     'Vehicle management',
  '/logistics/orders':    'Delivery tracking',
  '/logistics/drivers':   'Driver roster',
  '/driver/rides':        'Ride assignments',
  '/driver/wallet':       'Your earnings',
  '/driver/stats':        'Performance metrics',
  '/lab/requests':        'Incoming test requests',
  '/lab/uploads':         'Upload results',
  '/lab/tracking':        'Sample tracking',
  '/pharmacy/stock':      'Inventory levels',
  '/pharmacy/sales':      'Sales analytics',
  '/finance/ledger':      'Transaction records',
  '/finance/refunds':     'Refund management',
  '/finance/audit':       'Compliance checks',
  '/care/patients':       'Active care cases',
  '/care/history':        'Past care records',
  '/care/schedule':       'Care scheduling',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getSettingsStartIdx = (links) =>
  links.findIndex((l) => l.href === '/settings');

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const rowVariants = {
  hidden:  { opacity: 0, y: 8, filter: 'blur(3px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 340, damping: 26 },
  },
};

const dividerVariants = {
  hidden:  { scaleX: 0, opacity: 0 },
  visible: { scaleX: 1, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP ROW — flex-row: left = sublabel description, right = nav link
// ─────────────────────────────────────────────────────────────────────────────

const DesktopNavRow = ({ link, isSettings = false, isActive, onLinkClick }) => {
  const Icon = link.icon;
  const active = isActive(link.href);

  // Left panel content
  const sublabel = isSettings
    ? SETTINGS_SUBLABEL[link.href]?.desc
    : NAV_SUBLABEL[link.href];

  return (
    <motion.div
      variants={rowVariants}
      className="group flex items-stretch gap-0 rounded-field overflow-hidden"
      style={{ minHeight: 0 }}
    >
      {/* ── LEFT: description pill ─────────────────────────────────────────── */}
      <div
        className={cn(
          "hidden xl:flex items-center w-[130px] shrink-0 px-2.5 py-1.5",
          "transition-all duration-300",
          active
            ? "bg-primary/10"
            : isSettings
              ? "bg-warning/5"
              : "bg-base-200/50 group-hover:bg-base-200",
        )}
      >
        <span className={cn(
          "text-[8.5px] font-semibold leading-tight line-clamp-2 tracking-wide transition-colors duration-200",
          active
            ? "text-primary/80"
            : isSettings
              ? "text-warning/60 group-hover:text-warning/80"
              : "text-base-content/35 group-hover:text-base-content/55",
        )}>
          {sublabel || '—'}
        </span>
      </div>

      {/* ── Vertical divider ──────────────────────────────────────────────── */}
      <div className={cn(
        "hidden xl:block w-px self-stretch shrink-0 transition-colors duration-300",
        active
          ? "bg-primary/20"
          : isSettings
            ? "bg-warning/15 group-hover:bg-warning/30"
            : "bg-base-300 group-hover:bg-primary/20",
      )} />

      {/* ── RIGHT: nav link ───────────────────────────────────────────────── */}
      <Link
        href={link.href}
        onClick={onLinkClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          "relative flex flex-1 items-center gap-2.5 px-2.5 py-1.5 overflow-hidden",
          "transition-all duration-200 select-none outline-none",
          active
            ? "bg-primary text-primary-content"
            : isSettings
              ? "hover:bg-warning/8 text-base-content/65 hover:text-base-content"
              : "hover:bg-base-200 text-base-content/75 hover:text-base-content",
        )}
      >
        {/* Active left bar */}
        {active && (
          <motion.span
            layoutId="active-bar"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-white/50"
            aria-hidden="true"
          />
        )}

        {/* Shimmer on hover */}
        <span
          className={cn(
            "absolute inset-0 -translate-x-full group-hover:translate-x-full",
            "transition-transform duration-700 ease-in-out pointer-events-none",
            "bg-gradient-to-r from-transparent via-white/5 to-transparent",
          )}
          aria-hidden="true"
        />

        {/* Icon */}
        <span className={cn(
          "relative flex items-center justify-center w-6 h-6 rounded-selector shrink-0",
          "transition-all duration-200 group-hover:scale-110",
          active
            ? "bg-white/15"
            : isSettings
              ? "bg-warning/10 text-warning"
              : "bg-primary/8 text-primary",
        )}>
          <Icon size={12} strokeWidth={2.5} />
        </span>

        {/* Label */}
        <span className={cn(
          "flex-1 text-[10px] font-black uppercase tracking-[0.16em] leading-none truncate",
          active ? "text-primary-content" : "",
        )}>
          {link.name}
        </span>

        {/* Chevron */}
        <ChevronRight
          size={10}
          strokeWidth={3}
          className={cn(
            "shrink-0 transition-all duration-200 group-hover:translate-x-0.5",
            active
              ? "text-white/50"
              : isSettings
                ? "text-warning/40"
                : "text-primary/30 group-hover:text-primary/60",
          )}
        />
      </Link>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE BENTO CARD
// ─────────────────────────────────────────────────────────────────────────────

const MobileBentoItem = ({ link, isSettings = false, isActive, onLinkClick }) => {
  const active = isActive(link.href);
  const Icon = link.icon;
  const sub = isSettings
    ? SETTINGS_SUBLABEL[link.href]?.desc
    : NAV_SUBLABEL[link.href];

  return (
    <Link
      href={link.href}
      onClick={onLinkClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        "group relative flex flex-col gap-1.5 p-3 rounded-box overflow-hidden",
        "transition-all duration-200 active:scale-95",
        active
          ? "bg-primary text-primary-content shadow-primary"
          : isSettings
            ? "bg-base-200/70 border border-warning/20 hover:border-warning/50"
            : "bg-base-200 border border-base-300 hover:border-primary/40",
      )}
    >
      {/* Ghost bg icon */}
      <span
        className="absolute -right-2 -bottom-2 opacity-[0.06] pointer-events-none"
        aria-hidden="true"
      >
        <Icon size={48} strokeWidth={0.7} />
      </span>

      {/* Icon chip */}
      <span className={cn(
        "w-7 h-7 flex items-center justify-center rounded-selector",
        active
          ? "bg-white/20"
          : isSettings
            ? "bg-warning/12 text-warning"
            : "bg-white text-primary shadow-sm",
      )}>
        <Icon size={13} strokeWidth={2.5} />
      </span>

      <span className="text-[9px] font-black uppercase tracking-[0.18em] leading-tight z-10 truncate">
        {link.name}
      </span>

      {sub && !active && (
        <span className="text-[8px] opacity-40 font-normal normal-case tracking-normal leading-tight z-10 line-clamp-1">
          {sub}
        </span>
      )}

      {active && (
        <span
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white/70 animate-ping"
          aria-hidden="true"
        />
      )}
    </Link>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────────────────

const SectionDivider = ({ label, className = '' }) => (
  <motion.div
    variants={dividerVariants}
    className={cn("flex items-center gap-2 origin-left", className)}
    role="separator"
    aria-hidden="true"
  >
    <div className="flex-1 h-px bg-base-300" />
    <span className="text-[7px] font-black uppercase tracking-[0.45em] text-base-content/25 whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-base-300" />
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const RoleNavLinks = ({ user, currentPathname, onLinkClick }) => {
  const role  = user?.role?.toLowerCase() || 'customer';
  const links = NAVIGATION_MAP[role] || NAVIGATION_MAP.customer;
  const settingsStartIdx = getSettingsStartIdx(links);

  const mainLinks     = links.slice(0, settingsStartIdx);
  const settingsLinks = links.slice(settingsStartIdx);

  const isActive = (href) =>
    currentPathname === href || currentPathname.startsWith(href + '/');

  return (
    <div className="w-full">

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE — bento grid
      ══════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden p-1 space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          {mainLinks.map((link) => (
            <MobileBentoItem
              key={link.href}
              link={link}
              isActive={isActive}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-px bg-base-300" />
          <span className="text-[7.5px] font-black uppercase tracking-[0.4em] text-base-content/30">
            {SETTINGS_GROUP_LABEL}
          </span>
          <div className="flex-1 h-px bg-base-300" />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {settingsLinks.map((link) => (
            <MobileBentoItem
              key={link.href}
              link={link}
              isSettings
              isActive={isActive}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP — flex-row layout: sublabel LEFT, nav link RIGHT
          Staggered entrance animations, shimmer hover, spring motion
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        className="hidden lg:block px-1.5 py-1"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Main nav rows */}
        <div className="space-y-[2px]">
          {mainLinks.map((link) => (
            <DesktopNavRow
              key={link.href}
              link={link}
              isActive={isActive}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>

        {/* Divider */}
        <SectionDivider label={SETTINGS_GROUP_LABEL} className="my-2.5 px-1" />

        {/* Settings rows */}
        <div className="space-y-[2px]">
          {settingsLinks.map((link) => (
            <DesktopNavRow
              key={link.href}
              link={link}
              isSettings
              isActive={isActive}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default RoleNavLinks;