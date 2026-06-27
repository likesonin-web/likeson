'use client';

/**
 * components/support/modals/ChangePriorityModal.jsx
 * PATCH /support/tickets/:id/priority
 */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Flag } from 'lucide-react';

import { updateTicketPriority } from '../../../store/slices/supportSlice';
import { TICKET_PRIORITIES, PRIORITY_LABELS, PRIORITY_BADGE, SLA_HOURS } from '../../../lib/supportconstants';
import { cn } from '../../../lib/supportutils';
import ModalShell from './ModalShell';

export default function ChangePriorityModal({ open, onClose, ticketId, currentPriority }) {
  const dispatch = useDispatch();
  const [priority, setPriority] = useState(currentPriority);

  const handleSubmit = async () => {
    await dispatch(updateTicketPriority({ id: ticketId, priority }));
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Change Priority"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={priority === currentPriority} className="btn btn-primary btn-sm">
            <Flag className="w-3.5 h-3.5" /> Update Priority
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {TICKET_PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={cn(
              'w-full flex items-center justify-between rounded-field px-3 py-2.5 border transition-colors',
              priority === p ? 'border-primary bg-primary/5' : 'border-base-300 hover:bg-base-200'
            )}
          >
            <span className={cn('badge badge-sm', PRIORITY_BADGE[p])}>{PRIORITY_LABELS[p]}</span>
            <span className="text-xs text-base-content/50">SLA: {SLA_HOURS[p]}h response</span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
