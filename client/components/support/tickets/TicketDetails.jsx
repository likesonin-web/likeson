'use client';

/**
 * components/support/tickets/TicketDetails.jsx
 * Column 4 of the workspace grid. Metadata, SLA countdown, participants,
 * tags, attachments, rating, audit summary + admin action buttons that
 * open the 4 admin modals.
 */
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  UserCheck, ArrowUpCircle, Building2, Flag, Trash2, Star, Tag, Clock,
} from 'lucide-react';

import {
  updateTicketStatus,
  rateTicket,
  fetchAttachments,
  selectAttachmentsFor,
} from '../../../store/slices/supportSlice';
import { useSelector } from 'react-redux';
import RoleGuard from '../RoleGuard';
import TicketTimeline from './TicketTimeline';
import AttachmentGallery from '../chat/AttachmentGallery';
import AssignAdminModal from '../modals/AssignAdminModal';
import EscalateModal from '../modals/EscalateModal';
import ChangeDepartmentModal from '../modals/ChangeDepartmentModal';
import ChangePriorityModal from '../modals/ChangePriorityModal';
import {
  STATUS_LABELS, STATUS_BADGE, PRIORITY_LABELS, PRIORITY_BADGE,
  DEPARTMENT_LABELS, slaMinutesRemaining, isSlaBreached,
} from '../../../lib/supportconstants';
import { cn, displayName } from '../../../lib/supportutils';
import useRolePermissions from '../../../hooks/useRolePermissions';

function SlaCountdown({ ticket }) {
  const breached = isSlaBreached(ticket);
  const mins = slaMinutesRemaining(ticket);
  if (mins === null) return null;
  const hrs = Math.floor(Math.abs(mins) / 60);
  const rem = Math.abs(mins) % 60;

  return (
    <div className={cn('rounded-field px-3 py-2.5 flex items-center gap-2 text-sm font-semibold',
      breached ? 'bg-error/10 text-error' : 'bg-success/10 text-success')}
    >
      <Clock className="w-4 h-4" />
      {breached ? `SLA breached ${hrs}h ${rem}m ago` : `${hrs}h ${rem}m until SLA deadline`}
    </div>
  );
}

function RatingStars({ ticketId, existingRating }) {
  const dispatch = useDispatch();
  const [hover, setHover] = useState(0);
  const [rated, setRated] = useState(!!existingRating);

  const submit = (value) => {
    dispatch(rateTicket({ id: ticketId, rating: value }));
    setRated(true);
  };

  if (rated) return <p className="text-xs text-success font-semibold">Thanks for rating this ticket!</p>;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} onMouseEnter={() => setHover(v)} onMouseLeave={() => setHover(0)} onClick={() => submit(v)}>
          <Star className={cn('w-5 h-5', (hover || 0) >= v ? 'fill-warning text-warning' : 'text-base-content/30')} />
        </button>
      ))}
    </div>
  );
}

export default function TicketDetails({ ticket }) {
  const dispatch = useDispatch();
  const { permissions } = useRolePermissions();
  const attachments = useSelector(selectAttachmentsFor(ticket?._id));
  const [modal, setModal] = useState(null); // 'assign' | 'escalate' | 'department' | 'priority' | null

  useEffect(() => {
    if (ticket?._id) dispatch(fetchAttachments(ticket._id));
  }, [ticket?._id, dispatch]);

  if (!ticket) return null;

  const canRate = permissions.rateTicket && ['RESOLVED', 'CLOSED'].includes(ticket.status);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full overflow-y-auto scrollbar-thin border-l border-base-300 bg-base-100 p-4 space-y-5"
    >
      {/* Header */}
      <div>
        <p className="text-xs font-bold text-base-content/40">{ticket.ticketNumber}</p>
        <h5 className="font-bold leading-snug mt-1">{ticket.subject}</h5>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={cn('badge badge-sm', STATUS_BADGE[ticket.status])}>{STATUS_LABELS[ticket.status]}</span>
          <span className={cn('badge badge-sm', PRIORITY_BADGE[ticket.priority])}>{PRIORITY_LABELS[ticket.priority]}</span>
          <span className="badge badge-secondary badge-sm">{DEPARTMENT_LABELS[ticket.department]}</span>
        </div>
      </div>

      <SlaCountdown ticket={ticket} />

      {/* Admin actions */}
      <RoleGuard anyOf={['assignTicket', 'escalateTicket', 'changeDepartment', 'changePriority']}>
        <div className="grid grid-cols-2 gap-2">
          <RoleGuard permission="assignTicket">
            <button onClick={() => setModal('assign')} className="btn btn-outline btn-sm justify-start">
              <UserCheck className="w-3.5 h-3.5" /> Assign
            </button>
          </RoleGuard>
          <RoleGuard permission="changePriority">
            <button onClick={() => setModal('priority')} className="btn btn-outline btn-sm justify-start">
              <Flag className="w-3.5 h-3.5" /> Priority
            </button>
          </RoleGuard>
          <RoleGuard permission="changeDepartment">
            <button onClick={() => setModal('department')} className="btn btn-outline btn-sm justify-start">
              <Building2 className="w-3.5 h-3.5" /> Department
            </button>
          </RoleGuard>
          <RoleGuard permission="escalateTicket">
            <button onClick={() => setModal('escalate')} className="btn btn-outline btn-error btn-sm justify-start">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Escalate
            </button>
          </RoleGuard>
        </div>
      </RoleGuard>

      {/* Participants */}
      <div>
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wide mb-2">Participants</p>
        <div className="space-y-1.5">
          {[ticket.customer, ticket.partner].filter(Boolean).map((p) => (
            <div key={p._id || p} className="flex items-center gap-2 text-sm">
              <span className="status-dot status-dot-info" /> {displayName(p)}
            </div>
          ))}
          {(ticket.assignedAdmins || []).map((a) => (
            <div key={a._id || a} className="flex items-center gap-2 text-sm">
              <span className="status-dot status-dot-success" /> {displayName(a)} <span className="text-base-content/40 text-xs">(agent)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      {!!ticket.tags?.length && (
        <div>
          <p className="text-xs font-bold text-base-content/40 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ticket.tags.map((tag) => (
              <span key={tag} className="badge badge-primary badge-xs">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      <div>
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wide mb-2">Attachments</p>
        <AttachmentGallery attachments={attachments} ticketId={ticket._id} compact />
      </div>

      {/* Rating */}
      {canRate && (
        <div>
          <p className="text-xs font-bold text-base-content/40 uppercase tracking-wide mb-2">Rate this resolution</p>
          <RatingStars ticketId={ticket._id} existingRating={ticket.rating} />
        </div>
      )}

      {/* Audit summary */}
      <div className="text-xs text-base-content/40 space-y-0.5">
        <p>Created {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</p>
        {ticket.resolvedAt && <p>Resolved {format(new Date(ticket.resolvedAt), 'MMM d, yyyy h:mm a')}</p>}
        {ticket.reopenedCount > 0 && <p>Reopened {ticket.reopenedCount}×</p>}
      </div>

      {/* Activity timeline */}
      <div>
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wide mb-2">Activity</p>
        <TicketTimeline ticketId={ticket._id} />
      </div>

      {/* Modals */}
      <AssignAdminModal open={modal === 'assign'} onClose={() => setModal(null)} ticketId={ticket._id} currentlyAssigned={ticket.assignedAdmins} />
      <EscalateModal open={modal === 'escalate'} onClose={() => setModal(null)} ticketId={ticket._id} ticketNumber={ticket.ticketNumber} />
      <ChangeDepartmentModal open={modal === 'department'} onClose={() => setModal(null)} ticketId={ticket._id} currentDepartment={ticket.department} />
      <ChangePriorityModal open={modal === 'priority'} onClose={() => setModal(null)} ticketId={ticket._id} currentPriority={ticket.priority} />
    </motion.aside>
  );
}
