'use client';

/**
 * components/support/tickets/TicketCard.jsx
 * BUG FIX: import was `../../../lib/supportconstant` (missing trailing 's')
 */
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle } from 'lucide-react';

import {
  STATUS_LABELS, STATUS_BADGE, PRIORITY_LABELS, PRIORITY_BADGE,
  DEPARTMENT_LABELS, isSlaBreached,
} from '../../../lib/supportconstants';
import { cn, truncate, displayName, initials } from '../../../lib/supportutils';

export default function TicketCard({ ticket, active, unreadCount = 0, onClick }) {
  const breached = isSlaBreached(ticket);
  const requester = ticket.customer || ticket.partner;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      layout
      className={cn(
        'w-full text-left card p-3.5 flex flex-col gap-2 transition-colors',
        active && 'border-primary/60 bg-primary/5'
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-base-content/50 tracking-wide">{ticket.ticketNumber}</span>
        <div className="flex items-center gap-1.5">
          {breached && <AlertCircle className="w-3.5 h-3.5 text-error" />}
          <span className={cn('badge badge-xs', PRIORITY_BADGE[ticket.priority])}>
            {PRIORITY_LABELS[ticket.priority]}
          </span>
        </div>
      </div>

      {/* Subject */}
      <h6 className="text-sm font-bold text-base-content leading-snug line-clamp-1">
        {ticket.subject}
      </h6>

      {/* Preview */}
      <p className="text-xs text-base-content/55 line-clamp-1">
        {truncate(ticket.lastMessagePreview || ticket.description, 70)}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="avatar">
            <div className="w-5 h-5 placeholder text-[10px]">
              <span>{initials(displayName(requester))}</span>
            </div>
          </div>
          <span className="text-[11px] text-base-content/50 truncate">{displayName(requester)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('badge badge-xs', STATUS_BADGE[ticket.status])}>
            {STATUS_LABELS[ticket.status]}
          </span>
          {unreadCount > 0 && (
            <span className="badge badge-error badge-xs px-1">{unreadCount}</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-base-content/40">
        <span>{DEPARTMENT_LABELS[ticket.department]}</span>
        <span>
          {(ticket.lastMessageAt || ticket.createdAt)
            ? formatDistanceToNow(
                new Date(ticket.lastMessageAt || ticket.createdAt),
                { addSuffix: true }
              )
            : ''}
        </span>
      </div>
    </motion.button>
  );
}
