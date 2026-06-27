'use client';

/**
 * components/support/tickets/TicketFilters.jsx
 * Status / priority / department / date / assigned filters for the ticket
 * list. Controlled by supportSlice.ticketFilters so list + URL stay in sync.
 */
import { motion } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_DEPARTMENTS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  DEPARTMENT_LABELS,
} from '../../../lib/supportconstants';
 

function Select({ label, value, onChange, options, labels }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="label-text-alt font-semibold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field py-1.5 text-sm">
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function TicketFilters({ filters, onChange, onReset }) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = ['status', 'priority', 'department', 'startDate', 'endDate'].filter((k) => filters[k]).length;

  return (
    <div className="border-b border-base-300">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-base-content/60"
      >
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          {activeCount > 0 && <span className="badge badge-primary badge-xs">{activeCount}</span>}
        </span>
        {activeCount > 0 && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="flex items-center gap-1 text-error hover:underline"
          >
            <X className="w-3 h-3" /> Clear
          </span>
        )}
      </button>

      <motion.div
        initial={false}
        animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => onChange({ status: v })}
            options={TICKET_STATUSES}
            labels={STATUS_LABELS}
          />
          <Select
            label="Priority"
            value={filters.priority}
            onChange={(v) => onChange({ priority: v })}
            options={TICKET_PRIORITIES}
            labels={PRIORITY_LABELS}
          />
          <Select
            label="Department"
            value={filters.department}
            onChange={(v) => onChange({ department: v })}
            options={TICKET_DEPARTMENTS}
            labels={DEPARTMENT_LABELS}
          />
          <label className="flex flex-col gap-1 text-xs">
            <span className="label-text-alt font-semibold">Created after</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="input-field py-1.5 text-sm"
            />
          </label>
        </div>
      </motion.div>
    </div>
  );
}
