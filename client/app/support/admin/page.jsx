'use client';

/**
 * app/support/admin/page.jsx — Admin / SuperAdmin only.
 * Agents directory + bulk ticket actions + (superadmin) global audit log.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ShieldCheck, Users, ListChecks } from 'lucide-react';

import { fetchAgents, fetchTickets, bulkTicketAction, selectAgents, selectTicketsState } from '../../../store/slices/supportSlice';
import RoleGuard from '../../../components/support/RoleGuard';
import EmptyState from '../../../components/support/EmptyState';
import { ROLE_LABELS } from '../../../lib/supportconstants';
import { initials, displayName } from '../../../lib/supportutils';
import useRolePermissions from '../../../hooks/useRolePermissions';
import * as supportApi from '../../../services/support.service';

function AgentCard({ agent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4 flex items-center gap-3">
      <div className="avatar">
        <div className="w-11 h-11 placeholder">
          {agent.avatar ? <img src={agent.avatar} alt={agent.name} /> : <span>{initials(agent.name)}</span>}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{agent.name}</p>
        <p className="text-xs text-base-content/50">{ROLE_LABELS[agent.role]}</p>
      </div>
      <div className="text-right">
        <p className="font-extrabold text-primary">{agent.openTickets}</p>
        <p className="text-[10px] text-base-content/40 uppercase">Open</p>
      </div>
    </motion.div>
  );
}

function BulkActionsPanel() {
  const dispatch = useDispatch();
  const { items } = useSelector(selectTicketsState);
  const [selected, setSelected] = useState([]);
  const [action, setAction] = useState('RESOLVE');

  useEffect(() => {
    dispatch(fetchTickets({ page: 1, limit: 25 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleApply = () => {
    if (!selected.length) return;
    dispatch(bulkTicketAction({ ticketIds: selected, action, payload: {} }));
    setSelected([]);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h6 className="font-bold flex items-center gap-2"><ListChecks className="w-4 h-4" /> Bulk Ticket Actions</h6>
        <div className="flex items-center gap-2">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="input-field w-auto py-1.5 text-sm">
            <option value="RESOLVE">Mark Resolved</option>
            <option value="CLOSE">Close</option>
          </select>
          <button onClick={handleApply} disabled={!selected.length} className="btn btn-primary btn-sm">
            Apply to {selected.length}
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-1">
        {items.map((t) => (
          <label key={t._id} className="flex items-center gap-3 rounded-field px-2.5 py-2 hover:bg-base-200 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm" checked={selected.includes(t._id)} onChange={() => toggle(t._id)} />
            <span className="text-xs font-bold text-base-content/40 w-24 shrink-0">{t.ticketNumber}</span>
            <span className="text-sm truncate flex-1">{t.subject}</span>
            <span className="badge badge-xs badge-secondary">{t.status}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function GlobalAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supportApi
      .getGlobalAuditLogs({ limit: 20 })
      .then((res) => setLogs(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-5 overflow-x-auto">
      <h6 className="font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Global Audit Log</h6>
      {loading && <p className="text-xs text-base-content/40">Loading…</p>}
      {!loading && logs.length === 0 && <EmptyState title="No audit entries" description="System actions will appear here." />}
      {logs.length > 0 && (
        <table className="table">
          <thead>
            <tr><th>Actor</th><th>Action</th><th>When</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id}>
                <td>{displayName(l.actor)} <span className="text-base-content/40">({l.actorRole})</span></td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="text-xs">{format(new Date(l.createdAt), 'MMM d, h:mm a')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminManagementPage() {
  const dispatch = useDispatch();
  const { isSuperAdmin } = useRolePermissions();
  const { items: agents, loading } = useSelector(selectAgents);

  useEffect(() => {
    dispatch(fetchAgents());
  }, [dispatch]);

  return (
    <RoleGuard permission="assignTicket" fallback={<EmptyState title="Restricted" description="Admin Management is for Admin and SuperAdmin only." />}>
      <div className="h-full overflow-y-auto scrollbar-thin p-5 lg:p-8 space-y-8">
        <div>
          <h2 className="font-extrabold">Admin Management</h2>
          <p className="section-subheading mb-0">Agent workload, bulk actions, and platform-wide audit trail.</p>
        </div>

        <div>
          <h6 className="font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Agent Directory</h6>
          {loading && <p className="text-xs text-base-content/40">Loading agents…</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => <AgentCard key={a._id} agent={a} />)}
          </div>
        </div>

        <BulkActionsPanel />

        <RoleGuard permission="viewAuditLogs">
          <GlobalAuditLog />
        </RoleGuard>
      </div>
    </RoleGuard>
  );
}
