'use client';

import React from 'react';

const severityBadge = (severity) => {
  switch (severity) {
    case 'warning':  return 'badge-warning';
    case 'error':    return 'badge-error';
    case 'critical': return 'badge-error';
    default:         return 'badge-info';
  }
};

export default function EventLogItem({ event }) {
  return (
    <tr>
      <td className="font-medium">{event.eventType?.replace(/_/g, ' ') || '—'}</td>
      <td className="text-base-content/60">{event.actorType || '—'}</td>
      <td className="text-base-content/50">
        {event.timestamp
          ? new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '—'}
      </td>
      <td>
        <span className={`badge badge-xs ${severityBadge(event.severity)}`}>
          {event.severity || 'info'}
        </span>
      </td>
    </tr>
  );
}