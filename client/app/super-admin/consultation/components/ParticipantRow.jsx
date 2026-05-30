'use client';

import React from 'react';

const fmtTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const connectionDot = (status) => {
  switch (status) {
    case 'connected':    return 'status-dot status-dot-success';
    case 'reconnecting': return 'status-dot status-dot-warning';
    case 'disconnected': return 'status-dot status-dot-error';
    default:             return 'status-dot';
  }
};

const deviceIcon = (deviceType) => {
  if (deviceType === 'mobile')  return '📱';
  if (deviceType === 'tablet')  return '📲';
  if (deviceType === 'desktop') return '🖥️';
  return '❓';
};

const nqLabel = (nq) => {
  if (!nq) return null;
  const up = nq.uplinkNetworkQuality ?? 0;
  if (up <= 1) return { label: 'Good',  cls: 'badge-success' };
  if (up <= 3) return { label: 'Fair',  cls: 'badge-warning' };
  return           { label: 'Poor',  cls: 'badge-error'   };
};

export default function ParticipantRow({ participant, networkQuality, handRaised }) {
  const nq = nqLabel(networkQuality);

  return (
    <tr>
      <td>
        <div className="flex items-center gap-1.5">
          <div className="avatar placeholder">
            <div className="w-6 h-6 rounded-full text-[10px]">
              <span>{(participant.displayName || 'U')[0].toUpperCase()}</span>
            </div>
          </div>
          <span className="font-medium truncate max-w-[80px]">
            {participant.displayName || '—'}
          </span>
          {handRaised && <span title="Hand raised" className="text-[10px]">✋</span>}
        </div>
      </td>
      <td>
        <span className="role-badge text-[10px] !px-1.5 !py-0.5">{participant.role}</span>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <span className={connectionDot(participant.connectionStatus)} />
          <span className="text-xs capitalize">{participant.connectionStatus || '—'}</span>
        </div>
      </td>
      <td>
        <span title={participant.deviceType}>{deviceIcon(participant.deviceType)}</span>
      </td>
      <td className="text-xs">{fmtTime(participant.joinedAt)}</td>
      <td className="text-xs">{participant.totalDurationMinutes ?? 0}m</td>
      <td>
        {nq ? (
          <span className={`badge badge-xs ${nq.cls}`}>{nq.label}</span>
        ) : (
          <span className="text-base-content/30 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}