'use client';

/**
 * components/support/modals/EscalateModal.jsx
 * POST /support/tickets/:id/escalate — irreversible-feeling action, confirm explicitly.
 */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { ArrowUpCircle, AlertTriangle } from 'lucide-react';

import { escalateTicket } from '../../../store/slices/supportSlice';
import ModalShell from './ModalShell';

export default function EscalateModal({ open, onClose, ticketId, ticketNumber }) {
  const dispatch = useDispatch();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    await dispatch(escalateTicket(ticketId));
    setSubmitting(false);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Escalate Ticket"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleConfirm} disabled={submitting} className="btn btn-error btn-sm">
            <ArrowUpCircle className="w-3.5 h-3.5" /> {submitting ? 'Escalating…' : 'Escalate'}
          </button>
        </>
      }
    >
      <div className="alert alert-warning items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="text-sm">
          Escalating <strong>{ticketNumber}</strong> sets priority to <strong>CRITICAL</strong> and notifies all
          watchers immediately. This cannot be silently undone.
        </p>
      </div>
    </ModalShell>
  );
}
