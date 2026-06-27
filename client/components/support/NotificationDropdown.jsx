'use client';

/**
 * components/support/NotificationDropdown.jsx
 * Reuses the EXISTING notificationSlice end-to-end — no parallel store.
 */
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
// Changed from useOnClickOutside to useClickAway
import { useClickAway } from 'react-use'; 
import { formatDistanceToNow } from 'date-fns';

import useNotifications from '../../hooks/useNotifications';
import { cn, truncate } from '../../lib/supportutils';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  
  // Implemented useClickAway
  useClickAway(ref, () => setOpen(false));

  const { items, unreadCount, loading, markRead, markAllRead, remove } = useNotifications();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-circle relative"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="badge badge-error badge-xs absolute -top-1 -right-1 px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-hidden card glass-card z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
              <h6 className="font-bold">Notifications</h6>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-semibold text-primary flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading && <div className="p-4 text-sm text-base-content/50">Loading…</div>}
              {!loading && items.length === 0 && (
                <div className="p-6 text-center text-sm text-base-content/50">You're all caught up.</div>
              )}
              {items.map((n) => (
                <div
                  key={n._id}
                  className={cn(
                    'px-4 py-3 border-b border-base-300/60 flex items-start gap-2 hover:bg-base-200/60 transition-colors',
                    !n.isRead && 'bg-primary/5'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-base-content/60 mt-0.5">{truncate(n.body, 90)}</p>}
                    <p className="text-[11px] text-base-content/40 mt-1">
                      {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.isRead && (
                      <button onClick={() => markRead(n._id)} className="btn btn-ghost btn-circle btn-xs" aria-label="Mark read">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => remove(n._id)} className="btn btn-ghost btn-circle btn-xs" aria-label="Dismiss">
                      <Trash2 className="w-3.5 h-3.5 text-error" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}