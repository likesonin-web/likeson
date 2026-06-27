'use client';

/**
 * BUG FIX: All inline styles replaced with Tailwind CSS classes.
 * ConnectionBadge had `display: 'none'` inline + `sm:!flex` fighting each other — fixed.
 */
import { motion } from 'framer-motion';
import { Search, Wifi, Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';

import { selectSocketConnected } from '../../store/slices/supportSlice';
import useRolePermissions from '../../hooks/useRolePermissions';
import NotificationDropdown from './NotificationDropdown';
import { initials } from '../../lib/supportutils';

function ConnectionBadge() {
  const connected = useSelector(selectSocketConnected);

  return (
    <div
      className={`
        hidden sm:flex items-center gap-1.5 text-xs font-bold tracking-wide
        rounded-selector px-3 py-1 border
        ${connected
          ? 'bg-success/10 text-success border-success/30'
          : 'bg-warning/10 text-warning border-warning/30'
        }
      `}
    >
      {connected
        ? <Wifi className="w-3.5 h-3.5" />
        : <Loader2 className="w-3.5 h-3.5 animate-spin" />
      }
      {connected ? 'Live' : 'Reconnecting…'}
    </div>
  );
}

export default function SupportHeader({ onSearch, searchValue = '' }) {
  const { user } = useRolePermissions();

  return (
    <header className="h-16 shrink-0 border-b border-base-300 bg-base-100/85 backdrop-blur-soft flex items-center gap-3 px-4 lg:px-6">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
        <input
          value={searchValue}
          onChange={(e) => onSearch?.(e.target.value)}
          placeholder="Search tickets, #ID, subject…"
          className="input-field pl-9"
        />
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3 ml-auto">
        <ConnectionBadge />
        <NotificationDropdown />

        {/* Avatar */}
        <div className="avatar">
          <div
            className={`w-9 h-9 ${!user?.avatar ? 'placeholder' : ''}`}
          >
            {user?.avatar
              ? <img src={user.avatar} alt={user.name ?? 'User'} />
              : <span className="text-sm">{initials(user?.name)}</span>
            }
          </div>
        </div>
      </div>
    </header>
  );
}
