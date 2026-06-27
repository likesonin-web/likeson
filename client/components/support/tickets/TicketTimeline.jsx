'use client';

/**
 * components/support/tickets/TicketTimeline.jsx
 * Activity feed for the Ticket Details panel. Grouped by day, animated
 * entry per event. Backed by GET /support/tickets/:ticketId/activity.
 */
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import {
  PlusCircle, UserPlus, ArrowRightLeft, Building2, ArrowUpCircle,
  CheckCircle2, RotateCcw, Paperclip, AtSign, AlertTriangle, MessageSquare,
} from 'lucide-react';

import { fetchActivity, selectActivityFor } from '../../../store/slices/supportSlice';
import { displayName } from '../../../lib/supportutils';
import EmptyState from '../EmptyState';

const ACTION_META = {
  TICKET_CREATED:        { icon: PlusCircle,     color: 'text-info' },
  TICKET_ASSIGNED:       { icon: UserPlus,       color: 'text-primary' },
  ADMIN_UNASSIGNED:      { icon: UserPlus,       color: 'text-base-content/50' },
  DEPARTMENT_CHANGED:    { icon: Building2,      color: 'text-secondary' },
  PRIORITY_CHANGED:      { icon: ArrowRightLeft, color: 'text-warning' },
  TICKET_ESCALATED:      { icon: ArrowUpCircle,  color: 'text-error' },
  STATUS_CHANGED_TO_RESOLVED: { icon: CheckCircle2, color: 'text-success' },
  STATUS_CHANGED_TO_CLOSED:   { icon: CheckCircle2, color: 'text-base-content/50' },
  STATUS_CHANGED_TO_REOPENED: { icon: RotateCcw,    color: 'text-warning' },
  MESSAGE_SENT:           { icon: MessageSquare,  color: 'text-base-content/40' },
  ATTACHMENT_UPLOADED:    { icon: Paperclip,      color: 'text-info' },
  MENTION_ADDED:          { icon: AtSign,         color: 'text-primary' },
  INTERNAL_NOTE_ADDED:    { icon: MessageSquare,  color: 'text-accent' },
  TICKET_RATED:           { icon: CheckCircle2,   color: 'text-success' },
  TICKET_MERGED:          { icon: ArrowRightLeft, color: 'text-secondary' },
  WATCHER_ADDED:          { icon: UserPlus,       color: 'text-base-content/50' },
};

function describeActivity(activity) {
  const actorName = displayName(activity.actor);
  switch (activity.action) {
    case 'TICKET_CREATED': return `${actorName} created this ticket`;
    case 'TICKET_ASSIGNED': return `${actorName} assigned the ticket`;
    case 'ADMIN_UNASSIGNED': return `${actorName} removed an assignee`;
    case 'DEPARTMENT_CHANGED': return `${actorName} moved this to ${activity.metadata?.to?.replace(/_/g, ' ')}`;
    case 'PRIORITY_CHANGED': return `${actorName} changed priority to ${activity.metadata?.to}`;
    case 'TICKET_ESCALATED': return `${actorName} escalated this ticket`;
    case 'STATUS_CHANGED_TO_RESOLVED': return `${actorName} marked this resolved`;
    case 'STATUS_CHANGED_TO_CLOSED': return `${actorName} closed this ticket`;
    case 'STATUS_CHANGED_TO_REOPENED': return `${actorName} reopened this ticket`;
    case 'MESSAGE_SENT': return `${actorName} sent a message`;
    case 'ATTACHMENT_UPLOADED': return `${actorName} uploaded ${activity.metadata?.fileName || 'a file'}`;
    case 'MENTION_ADDED': return `${actorName} mentioned a teammate`;
    case 'INTERNAL_NOTE_ADDED': return `${actorName} added an internal note`;
    case 'TICKET_RATED': return `${actorName} rated this ${activity.metadata?.rating}/5`;
    case 'TICKET_MERGED': return `${actorName} merged ticket ${activity.metadata?.sourceTicketNumber}`;
    case 'WATCHER_ADDED': return `${actorName} added a watcher`;
    default: return `${actorName} ${activity.action.replace(/_/g, ' ').toLowerCase()}`;
  }
}

function dayLabel(date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export default function TicketTimeline({ ticketId }) {
  const dispatch = useDispatch();
  const { items, loading } = useSelector(selectActivityFor(ticketId));

  useEffect(() => {
    if (ticketId) dispatch(fetchActivity({ ticketId }));
  }, [ticketId, dispatch]);

  const grouped = useMemo(() => {
    const groups = {};
    items
      .slice()
      .reverse()
      .forEach((a) => {
        const key = dayLabel(new Date(a.createdAt));
        groups[key] = groups[key] || [];
        groups[key].push(a);
      });
    return groups;
  }, [items]);

  if (!loading && items.length === 0) {
    return <EmptyState title="No activity yet" description="Timeline events appear as this ticket progresses." />;
  }

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([day, events]) => (
        <div key={day}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/40 mb-2">{day}</p>
          <ul className="space-y-3 border-l border-base-300 pl-4">
            {events.map((activity, i) => {
              const meta = ACTION_META[activity.action] || { icon: MessageSquare, color: 'text-base-content/40' };
              const Icon = meta.icon;
              return (
                <motion.li
                  key={activity._id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="relative flex items-start gap-2.5"
                >
                  <span className={`absolute -left-[21px] top-0.5 rounded-full bg-base-100 ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-xs text-base-content/80">{describeActivity(activity)}</p>
                    <p className="text-[10px] text-base-content/40">{format(new Date(activity.createdAt), 'h:mm a')}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
