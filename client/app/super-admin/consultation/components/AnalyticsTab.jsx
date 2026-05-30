'use client';

import React from 'react';

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

// Simple quality bar
const QualityBar = ({ quality }) => {
  const color = quality <= 1 ? 'bg-success' : quality <= 3 ? 'bg-warning' : 'bg-error';
  const h = Math.max(4, (6 - quality) * 8);
  return <div className={`w-2 rounded-sm ${color}`} style={{ height: h }} />;
};

export default function AnalyticsTab({ networkAnalytics, sdkErrors, reconnectLogs, consultationAnalytics, rt }) {
  // Group analytics by role
  const doctorAnalytics  = networkAnalytics.filter((a) => a.role === 'doctor').slice(-20);
  const patientAnalytics = networkAnalytics.filter((a) => a.role === 'patient').slice(-20);

  // Latest per-participant from rt
  const nqEntries = Object.entries(rt.networkQualities);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-3 space-y-4 text-xs">

      {/* Live Network per Participant */}
      {nqEntries.length > 0 && (
        <section>
          <h4 className="font-montserrat font-bold uppercase tracking-widest text-[10px] text-base-content/40 mb-2">
            Live Network
          </h4>
          <div className="space-y-2">
            {nqEntries.map(([uid, nq]) => (
              <div key={uid} className="stat-card !p-2 !rounded space-y-1">
                <p className="text-[10px] font-bold text-base-content/50 truncate">UID {uid}</p>
                <div className="grid grid-cols-2 gap-1">
                  <MiniStat label="Uplink"   value={nq.uplinkNetworkQuality ?? '—'} />
                  <MiniStat label="Downlink" value={nq.downlinkNetworkQuality ?? '—'} />
                  <MiniStat label="Latency"  value={nq.latency != null ? `${nq.latency}ms` : '—'} />
                  <MiniStat label="Loss"     value={nq.packetLoss != null ? `${nq.packetLoss}%` : '—'} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consultation Stats */}
      {consultationAnalytics && (
        <section>
          <h4 className="font-montserrat font-bold uppercase tracking-widest text-[10px] text-base-content/40 mb-2">
            Session Stats
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Peak Participants" value={consultationAnalytics.peakParticipants ?? 0} />
            <StatCard label="Total Participants" value={consultationAnalytics.totalParticipants ?? 0} />
            <StatCard label="Call Drops" value={consultationAnalytics.callDropCount ?? 0} />
            <StatCard label="Wait Time" value={`${consultationAnalytics.waitingRoomTime ?? 0}m`} />
            <StatCard label="Dr. Response" value={`${consultationAnalytics.doctorResponseTime ?? 0}m`} />
          </div>
        </section>
      )}

      {/* Quality Timeline */}
      {(doctorAnalytics.length > 0 || patientAnalytics.length > 0) && (
        <section>
          <h4 className="font-montserrat font-bold uppercase tracking-widest text-[10px] text-base-content/40 mb-2">
            Quality Timeline
          </h4>
          <div className="space-y-2">
            {doctorAnalytics.length > 0 && (
              <div>
                <p className="text-[10px] text-base-content/40 mb-1">Doctor</p>
                <div className="flex items-end gap-0.5 h-10">
                  {doctorAnalytics.map((a, i) => (
                    <QualityBar key={i} quality={a.packetLoss > 10 ? 5 : a.latency > 300 ? 4 : 1} />
                  ))}
                </div>
              </div>
            )}
            {patientAnalytics.length > 0 && (
              <div>
                <p className="text-[10px] text-base-content/40 mb-1">Patient</p>
                <div className="flex items-end gap-0.5 h-10">
                  {patientAnalytics.map((a, i) => (
                    <QualityBar key={i} quality={a.packetLoss > 10 ? 5 : a.latency > 300 ? 4 : 1} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SDK Errors */}
      <section>
        <h4 className="font-montserrat font-bold uppercase tracking-widest text-[10px] text-base-content/40 mb-2 flex items-center gap-1">
          SDK Errors
          {sdkErrors.length > 0 && (
            <span className="badge badge-error badge-xs">{sdkErrors.length}</span>
          )}
        </h4>
        {sdkErrors.length > 0 ? (
          <div className="space-y-1.5">
            {sdkErrors.map((e) => (
              <div key={e._id} className="stat-card !p-2 !rounded border-l-2 border-error">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-error">[{e.code}]</span>{' '}
                    <span className="text-base-content/70">{e.message}</span>
                  </div>
                  <span className={`badge badge-xs ${e.resolved ? 'badge-success' : 'badge-error'}`}>
                    {e.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
                <p className="text-[10px] text-base-content/40 mt-0.5">{fmtTime(e.timestamp)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-base-content/30 text-center py-2">No SDK errors</p>
        )}
      </section>

      {/* Reconnect Logs */}
      <section>
        <h4 className="font-montserrat font-bold uppercase tracking-widest text-[10px] text-base-content/40 mb-2">
          Reconnect Logs
        </h4>
        {reconnectLogs.length > 0 ? (
          <div className="space-y-1.5">
            {reconnectLogs.map((r) => (
              <div key={r._id} className="flex items-center justify-between text-[11px] py-1 border-b border-base-300 last:border-0">
                <div>
                  <span className="font-medium capitalize">{r.role || '—'}</span>
                  <span className="text-base-content/40 ml-1">{fmtTime(r.attemptAt)}</span>
                  {r.reason && <span className="text-base-content/40 ml-1">· {r.reason}</span>}
                </div>
                <span className={`badge badge-xs ${r.success ? 'badge-success' : 'badge-error'}`}>
                  {r.success ? 'OK' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-base-content/30 text-center py-2">No reconnect events</p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card !p-2">
      <div className="stat-card-value !text-lg">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-base-content/40">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}