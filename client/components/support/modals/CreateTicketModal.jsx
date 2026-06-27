'use client';

/**
 * components/support/modals/CreateTicketModal.jsx
 * POST /support/tickets — available to customer, partner, and admin roles.
 */
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { PlusCircle } from 'lucide-react';

import { createTicket } from '../../../store/slices/supportSlice';
import { TICKET_DEPARTMENTS, DEPARTMENT_LABELS, TICKET_PRIORITIES, PRIORITY_LABELS } from '../../../lib/supportconstants';
import ModalShell from './ModalShell';

export default function CreateTicketModal({ open, onClose }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { subject: '', description: '', department: 'GENERAL_SUPPORT', priority: 'MEDIUM' },
  });

  const onSubmit = async (values) => {
    const result = await dispatch(createTicket(values));
    if (result.payload?.data?._id) {
      reset();
      onClose();
      router.push(`/support/tickets/${result.payload.data._id}`);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="New Support Ticket"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost btn-sm" type="button">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="btn btn-primary btn-sm">
            <PlusCircle className="w-3.5 h-3.5" /> {isSubmitting ? 'Creating…' : 'Create Ticket'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <input
            {...register('subject', { required: true, maxLength: 500 })}
            placeholder="Subject"
            className="input-field"
          />
          {errors.subject && <p className="text-xs text-error mt-1">Subject is required.</p>}
        </div>

        <div>
          <textarea
            {...register('description', { required: true, maxLength: 5000 })}
            placeholder="Describe the issue in detail…"
            rows={4}
            className="input-field"
          />
          {errors.description && <p className="text-xs text-error mt-1">Description is required.</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select {...register('department')} className="input-field">
            {TICKET_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
            ))}
          </select>
          <select {...register('priority')} className="input-field">
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </form>
    </ModalShell>
  );
}
