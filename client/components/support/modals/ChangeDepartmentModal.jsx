'use client';

/**
 * components/support/modals/ChangeDepartmentModal.jsx
 * PATCH /support/tickets/:id/department
 */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Building2 } from 'lucide-react';

import { updateTicketDepartment } from '../../../store/slices/supportSlice';
import { TICKET_DEPARTMENTS, DEPARTMENT_LABELS } from '../../../lib/supportconstants';
import ModalShell from './ModalShell';

export default function ChangeDepartmentModal({ open, onClose, ticketId, currentDepartment }) {
  const dispatch = useDispatch();
  const [department, setDepartment] = useState(currentDepartment);

  const handleSubmit = async () => {
    await dispatch(updateTicketDepartment({ id: ticketId, department }));
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Change Department"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={department === currentDepartment} className="btn btn-primary btn-sm">
            <Building2 className="w-3.5 h-3.5" /> Move Ticket
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {TICKET_DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            onClick={() => setDepartment(dept)}
            className={`btn btn-sm justify-start ${department === dept ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
          >
            {DEPARTMENT_LABELS[dept]}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
