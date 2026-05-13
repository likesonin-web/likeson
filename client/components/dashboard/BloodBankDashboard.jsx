'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Droplets,
  FlaskConical,
  ClipboardList,
  ChartBar,
  Settings,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  PackageSearch,
  BadgeCheck,
  Banknote,
  ShieldCheck,
  History,
  Users,
  Truck,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { fetchMyBank, fetchMyStats } from '@/store/slices/bloodbankSlice'; // adjust path

/* ─────────────────────────────────────────────────
   NAV STRUCTURE
───────────────────────────────────────────────── */
const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard',    icon: LayoutDashboard, href: '/blood-bank/dashboard' },
      { label: 'Stats',        icon: ChartBar,        href: '/blood-bank/stats'     },
    ],
  },
  {
    group: 'Blood Management',
    items: [
      { label: 'Inventory',    icon: Droplets,        href: '/blood-bank/inventory'  },
      { label: 'Blood Units',  icon: FlaskConical,    href: '/blood-bank/units'      },
      { label: 'Expiry Check', icon: PackageSearch,   href: '/blood-bank/expiry'     },
    ],
  },
  {
    group: 'Requests',
    items: [
      { label: 'Requests',     icon: ClipboardList,   href: '/blood-bank/requests'   },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { label: 'Pricing',      icon: Banknote,        href: '/blood-bank/pricing'    },
      { label: 'Stock Alerts', icon: AlertTriangle,   href: '/blood-bank/stock-alerts' },
      { label: 'Linked Hospitals', icon: Building2,   href: '/blood-bank/hospitals'  },
    ],
  },
  {
    group: 'Profile & Docs',
    items: [
      { label: 'Profile',      icon: Settings,        href: '/blood-bank/profile'    }
    ],
  },
];

/* ─────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────── */
const SIDEBAR_W_OPEN   = 256;
const SIDEBAR_W_CLOSED = 68;

/* ─────────────────────────────────────────────────
   LOGO MARK
───────────────────────────────────────────────── */
function LogoMark({ collapsed }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-primary">
        <Droplets className="w-5 h-5 text-primary-content" strokeWidth={2.5} />
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100 animate-pulse" />
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="font-montserrat font-black text-base text-base-content leading-none tracking-tight whitespace-nowrap">
              Likeson
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary whitespace-nowrap mt-0.5">
              Blood Bank
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   NAV ITEM
───────────────────────────────────────────────── */
function NavItem({ item, collapsed, active, onClick }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick}>
      <motion.div
        whileHover={{ x: collapsed ? 0 : 3 }}
        whileTap={{ scale: 0.97 }}
        className={`
          relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
          transition-colors duration-150 group
          ${active
            ? 'bg-primary text-primary-content shadow-primary'
            : 'text-base-content/70 hover:bg-primary/10 hover:text-primary'
          }
          ${collapsed ? 'justify-center' : ''}
        `}
      >
        <Icon className={`flex-shrink-0 ${active ? 'w-[18px] h-[18px]' : 'w-[18px] h-[18px]'}`} strokeWidth={active ? 2.5 : 2} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm font-semibold whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* tooltip on collapsed */}
        {collapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-neutral text-neutral-content text-xs font-semibold rounded-lg
            opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-depth">
            {item.label}
          </div>
        )}
      </motion.div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────
   NAV GROUP
───────────────────────────────────────────────── */
function NavGroup({ group, items, collapsed, pathname, onNav }) {
  return (
    <div className="mb-1">
      <AnimatePresence>
        {!collapsed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-base-content/30 whitespace-nowrap"
          >
            {group}
          </motion.p>
        )}
      </AnimatePresence>
      {collapsed && <div className="h-px bg-base-300/60 mx-2 mb-2 mt-1" />}
      <div className="flex flex-col gap-0.5">
        {items.map(item => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname?.startsWith(item.href + '/')}
            onClick={onNav}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   SIDEBAR CONTENT (shared desktop + mobile)
───────────────────────────────────────────────── */
function SidebarContent({ collapsed, pathname, onNav, onToggle, isMobile }) {
  const { myBank, myStats } = useSelector(s => s.bloodBank);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className={`flex items-center py-5 px-3 ${collapsed && !isMobile ? 'justify-center' : 'justify-between'}`}>
        <LogoMark collapsed={collapsed && !isMobile} />
        {!isMobile && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onToggle}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-base-300/60 hover:bg-primary/15 flex items-center justify-center text-base-content/60 hover:text-primary transition-colors"
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft  className="w-3.5 h-3.5" />
            }
          </motion.button>
        )}
        {isMobile && (
          <button onClick={onNav} className="p-1.5 rounded-lg hover:bg-base-300/60">
            <X className="w-5 h-5 text-base-content/70" />
          </button>
        )}
      </div>

      {/* Bank info card */}
      <AnimatePresence>
        {(!collapsed || isMobile) && myBank && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-4 overflow-hidden"
          >
            <div className="p-3 rounded-xl bg-primary/8 border border-primary/20">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${myBank.status === 'active' ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                <p className="text-xs font-bold text-base-content truncate">{myBank.name}</p>
              </div>
              <p className="text-[10px] font-mono text-base-content/50">{myBank.bankCode}</p>
              {myStats?.inventory && (
                <div className="mt-2 flex gap-3">
                  <div>
                    <p className="text-[10px] text-base-content/40 uppercase tracking-wide">Available</p>
                    <p className="text-sm font-black text-success">{myStats.inventory.totalAvailable ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-base-content/40 uppercase tracking-wide">Critical</p>
                    <p className="text-sm font-black text-error">{myStats.inventory.criticalCount ?? '—'}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 scrollbar-thin space-y-3 pb-4">
        {NAV.map(({ group, items }) => (
          <NavGroup
            key={group}
            group={group}
            items={items}
            collapsed={collapsed && !isMobile}
            pathname={pathname}
            onNav={isMobile ? onNav : undefined}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className={`px-2 pb-4 pt-2 border-t border-base-300/60 flex flex-col gap-1`}>
        <Link href="/blood-bank/notifications">
          <motion.div
            whileHover={{ x: collapsed && !isMobile ? 0 : 3 }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
              text-base-content/60 hover:bg-primary/10 hover:text-primary transition-colors group
              ${collapsed && !isMobile ? 'justify-center' : ''}`}
          >
            <Bell className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
            <AnimatePresence>
              {(!collapsed || isMobile) && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm font-semibold whitespace-nowrap overflow-hidden"
                >
                  Notifications
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && !isMobile && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-neutral text-neutral-content text-xs font-semibold rounded-lg
                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-depth">
                Notifications
              </div>
            )}
          </motion.div>
        </Link>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => { /* dispatch logout */ }}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer w-full
            text-error/70 hover:bg-error/10 hover:text-error transition-colors group
            ${collapsed && !isMobile ? 'justify-center' : ''}`}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-semibold whitespace-nowrap overflow-hidden"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
          {collapsed && !isMobile && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-neutral text-neutral-content text-xs font-semibold rounded-lg
              opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-depth">
              Sign Out
            </div>
          )}
        </motion.button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   TOP BAR (mobile + desktop)
───────────────────────────────────────────────── */
function TopBar({ onMenuOpen, collapsed, currentLabel }) {
  const { myBank } = useSelector(s => s.bloodBank);

  return (
    <header className="h-14 bg-base-100/80 backdrop-blur-strong border-b border-base-300/60 flex items-center px-4 gap-3 sticky top-0 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 rounded-xl hover:bg-base-300/60 text-base-content/70 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-base-content/40 text-sm hidden sm:inline">Blood Bank</span>
        <span className="text-base-content/30 hidden sm:inline">/</span>
        <span className="text-sm font-semibold text-base-content truncate">{currentLabel}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Status pill */}
        {myBank && (
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
            ${myBank.status === 'active'
              ? 'bg-success/10 text-success border-success/30'
              : myBank.status === 'pending'
              ? 'bg-warning/10 text-warning border-warning/30'
              : 'bg-error/10 text-error border-error/30'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${myBank.status === 'active' ? 'bg-success' : myBank.status === 'pending' ? 'bg-warning' : 'bg-error'}`} />
            {myBank.status?.replace('_', ' ').toUpperCase()}
          </div>
        )}

        {/* Notification icon */}
        <Link href="/blood-bank/notifications">
          <button className="relative p-2 rounded-xl hover:bg-base-300/60 text-base-content/70 transition-colors">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full border border-base-100" />
          </button>
        </Link>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
          <Droplets className="w-4 h-4 text-primary" />
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────
   MAIN LAYOUT
───────────────────────────────────────────────── */
export default function BloodBankDashboard({ children }) {
  const dispatch = useDispatch();
  const pathname = usePathname();

  const [sidebarOpen,      setSidebarOpen]      = useState(false);   // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);   // desktop collapse
  const overlayRef = useRef(null);

  /* fetch on mount */
  useEffect(() => {
    dispatch(fetchMyBank());
    dispatch(fetchMyStats());
  }, [dispatch]);

  /* close mobile sidebar on route change */
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  /* close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (sidebarOpen && overlayRef.current === e.target) setSidebarOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sidebarOpen]);

  /* lock body scroll when mobile sidebar open */
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  /* current route label */
  const currentLabel = NAV.flatMap(g => g.items)
    .find(i => pathname === i.href || pathname?.startsWith(i.href + '/'))?.label ?? 'Dashboard';

  return (
    <div data-theme="blood_bank" className="flex h-screen bg-base-200 overflow-hidden font-sans">

      {/* ── DESKTOP SIDEBAR ───────────────────────────────── */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? SIDEBAR_W_CLOSED : SIDEBAR_W_OPEN }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex flex-col bg-base-100 border-r border-base-300/60 overflow-hidden flex-shrink-0 relative"
        style={{ minWidth: sidebarCollapsed ? SIDEBAR_W_CLOSED : SIDEBAR_W_OPEN }}
      >
        <SidebarContent
          collapsed={sidebarCollapsed}
          pathname={pathname}
          onToggle={() => setSidebarCollapsed(v => !v)}
          isMobile={false}
        />
      </motion.aside>

      {/* ── MOBILE DRAWER OVERLAY ────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* backdrop */}
            <motion.div
              ref={overlayRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-neutral/50 backdrop-blur-sm z-40"
            />

            {/* drawer */}
            <motion.aside
              initial={{ x: -SIDEBAR_W_OPEN }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_W_OPEN }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="lg:hidden fixed left-0 top-0 h-full z-50 bg-base-100 border-r border-base-300/60 overflow-hidden flex flex-col"
              style={{ width: SIDEBAR_W_OPEN }}
            >
              <SidebarContent
                collapsed={false}
                pathname={pathname}
                onNav={() => setSidebarOpen(false)}
                isMobile={true}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN AREA ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onMenuOpen={() => setSidebarOpen(true)}
          collapsed={sidebarCollapsed}
          currentLabel={currentLabel}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="p-4 sm:p-6 min-h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}