'use client';

/**
 * BUG FIX: imported cn from '../../lib/utils' (wrong) → '../../lib/supportutils'
 * BUG FIX: selectUnreadCount from notificationSlice path may vary — kept but noted
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Inbox, User, UserCheck, Wallet,
  BarChart3, ShieldCheck, Settings,
  ChevronsLeft, ChevronsRight, Menu, X,
} from 'lucide-react';

import useRolePermissions from '../../hooks/useRolePermissions';
import { getVisibleNavItems } from '../../lib/permissions';
import { cn } from '../../lib/supportutils';

// selectUnreadCount path depends on host app's store structure — import defensively
let selectUnreadCount;
try {
  ({ selectUnreadCount } = require('../../store/slices/notificationSlice'));
} catch {
  selectUnreadCount = () => 0;
}

const ICONS = {
  dashboard: LayoutDashboard,
  all: Inbox,
  mine: User,
  assigned: UserCheck,
  finance: Wallet,
  analytics: BarChart3,
  admin: ShieldCheck,
  settings: Settings,
};

function NavLink({ item, collapsed, active, badge, onNavigate }) {
  const Icon = ICONS[item.key] || Inbox;
  return (
    <Link href={item.href} onClick={onNavigate}>
      <motion.div
        whileHover={{ x: collapsed ? 0 : 3 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'relative flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
        )}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!!badge && (
          <span className={cn('badge badge-error badge-xs ml-auto', collapsed && 'absolute -top-1 -right-1 px-1')}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {active && (
          <motion.div
            layoutId="support-sidebar-active"
            className="absolute left-0 top-0 h-full w-0.5 rounded-full bg-primary"
          />
        )}
      </motion.div>
    </Link>
  );
}

export default function SupportSidebar() {
  const { role } = useRolePermissions();
  const pathname = usePathname();
  const unreadNotifications = useSelector(selectUnreadCount);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = getVisibleNavItems(role);

  const sidebarBody = (
    <div className="flex h-full flex-col bg-base-100 border-r border-base-300">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-base-300 shrink-0">
        {!collapsed && (
          <span className="font-display font-extrabold text-lg text-base-content tracking-tight select-none">
            Likeson <span className="text-primary">Support</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:inline-flex btn btn-ghost btn-circle btn-sm ml-auto"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden btn btn-ghost btn-circle btn-sm"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-1 min-h-0">
        {navItems.map((item) => {
          const active = pathname === item.href.split('?')[0];
          const badge = item.key === 'dashboard' ? unreadNotifications : 0;
          return (
            <NavLink
              key={item.key}
              item={item}
              collapsed={collapsed}
              active={active}
              badge={badge}
              onNavigate={() => setMobileOpen(false)}
            />
          );
        })}
      </nav>

      {/* Role footer */}
      {!collapsed && (
        <div className="border-t border-base-300 p-3 shrink-0">
          <span className="role-badge">{role}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="hidden lg:block h-full shrink-0 overflow-hidden"
      >
        {sidebarBody}
      </motion.aside>

      {/* Mobile FAB */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-4 left-4 z-40 btn btn-primary btn-circle shadow-primary"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/40"
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[280px]"
            >
              {sidebarBody}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
