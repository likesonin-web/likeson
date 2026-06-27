'use client';

/**
 * components/support/modals/AssignAdminModal.jsx
 * POST /support/admin/tickets/:id/assign — multi-select agent assignment.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserCheck } from 'lucide-react';

import { assignAdmins, fetchAgents, selectAgents } from '../../../store/slices/supportSlice';
import { ROLE_LABELS } from '../../../lib/supportconstants';
import { initials } from '../../../lib/supportutils';
import ModalShell from './ModalShell';

export default function AssignAdminModal({ open, onClose, ticketId, currentlyAssigned = [] }) {
  const dispatch = useDispatch();
  const { items: agents, loading } = useSelector(selectAgents);
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      dispatch(fetchAgents());
      setSelected(currentlyAssigned.map((a) => a._id || a));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!selected.length) return;
    await dispatch(assignAdmins({ ticketId, adminIds: selected, reason }));
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Assign Ticket"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!selected.length} className="btn btn-primary btn-sm">
            <UserCheck className="w-3.5 h-3.5" /> Assign ({selected.length})
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-1.5">
          {loading && <p className="text-sm text-base-content/50">Loading agents…</p>}
          {agents.map((agent) => (
            <label
              key={agent._id}
              className="flex items-center gap-3 rounded-field px-2.5 py-2 hover:bg-base-200 cursor-pointer"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selected.includes(agent._id)}
                onChange={() => toggle(agent._id)}
              />
              <div className="avatar">
                <div className="w-8 h-8 placeholder text-xs">
                  {agent.avatar ? <img src={agent.avatar} alt={agent.name} /> : <span>{initials(agent.name)}</span>}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{agent.name}</p>
                <p className="text-xs text-base-content/50">
                  {ROLE_LABELS[agent.role]} · {agent.openTickets ?? 0} open
                </p>
              </div>
            </label>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="input-field text-sm"
          rows={2}
        />
      </div>
    </ModalShell>
  );
}
