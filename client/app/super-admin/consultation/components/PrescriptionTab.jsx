'use client';

import React, { useState } from 'react';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusBadge = (status) => {
  switch (status) {
    case 'issued':     return 'badge-success';
    case 'dispensed':  return 'badge-primary';
    case 'expired':    return 'badge-error';
    case 'cancelled':  return 'badge-error';
    default:           return 'badge-secondary';
  }
};

export default function PrescriptionTab({ prescriptions }) {
  const [expanded, setExpanded] = useState(null);

  if (!prescriptions?.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-base-content/30">No prescriptions issued yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 px-3 py-3 space-y-3 text-xs">
      {prescriptions.map((rx) => (
        <div key={rx._id} className="card overflow-hidden">
          {/* Header */}
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-base-200 text-left"
            onClick={() => setExpanded(expanded === rx._id ? null : rx._id)}
          >
            <div>
              <span className="font-bold font-mono text-primary">#{rx.rxNumber}</span>
              <span className="text-base-content/50 ml-2">{fmtDate(rx.issuedAt)}</span>
            </div>
            <span className={`badge badge-xs ${statusBadge(rx.status)}`}>{rx.status}</span>
          </button>

          {expanded === rx._id && (
            <div className="px-3 py-3 space-y-3">
              {/* Doctor / Patient snapshots */}
              <div className="grid grid-cols-2 gap-2">
                <SnapSection title="Doctor" data={{
                  Name: rx.doctor?.name,
                  'Reg #': rx.doctor?.registrationNumber,
                  Specialty: rx.doctor?.specialization,
                }} />
                <SnapSection title="Patient" data={{
                  Name: rx.patient?.name,
                  Age: rx.patient?.age,
                  Gender: rx.patient?.gender,
                  Blood: rx.patient?.bloodGroup,
                }} />
              </div>

              {/* Clinical */}
              {rx.diagnosis && (
                <div>
                  <p className="label-text text-[10px] uppercase tracking-widest text-base-content/40">Diagnosis</p>
                  <p className="mt-0.5">{rx.diagnosis}</p>
                </div>
              )}

              {/* Vitals */}
              {rx.vitals && Object.values(rx.vitals).some(Boolean) && (
                <div>
                  <p className="label-text text-[10px] uppercase tracking-widest text-base-content/40 mb-1">Vitals</p>
                  <div className="grid grid-cols-3 gap-1">
                    {rx.vitals.bloodPressure && <VitalChip label="BP" value={rx.vitals.bloodPressure} />}
                    {rx.vitals.pulseRate     && <VitalChip label="Pulse" value={`${rx.vitals.pulseRate} bpm`} />}
                    {rx.vitals.temperature   && <VitalChip label="Temp" value={`${rx.vitals.temperature}°F`} />}
                    {rx.vitals.spO2          && <VitalChip label="SpO2" value={`${rx.vitals.spO2}%`} />}
                    {rx.vitals.weightKg      && <VitalChip label="Wt" value={`${rx.vitals.weightKg}kg`} />}
                  </div>
                </div>
              )}

              {/* Medicines */}
              {rx.medicines?.length > 0 && (
                <div>
                  <p className="label-text text-[10px] uppercase tracking-widest text-base-content/40 mb-1">
                    Medicines ({rx.medicines.length})
                  </p>
                  <div className="space-y-1.5">
                    {rx.medicines.map((m, i) => (
                      <div key={i} className="stat-card !p-2 !rounded">
                        <p className="font-bold">{m.medicineName}</p>
                        <p className="text-base-content/60">
                          {m.dosage} · {m.frequency} · {m.timing} · {m.durationDays ? `${m.durationDays}d` : 'Ongoing'}
                        </p>
                        {m.instructions && <p className="text-base-content/40 italic mt-0.5">{m.instructions}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Tests */}
              {rx.labTests?.length > 0 && (
                <div>
                  <p className="label-text text-[10px] uppercase tracking-widest text-base-content/40 mb-1">
                    Lab Tests ({rx.labTests.length})
                  </p>
                  <div className="space-y-1">
                    {rx.labTests.map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-base-300 last:border-0">
                        <span>{t.testName}</span>
                        <span className={`badge badge-xs ${t.urgency === 'stat' ? 'badge-error' : t.urgency === 'urgent' ? 'badge-warning' : 'badge-info'}`}>
                          {t.urgency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up */}
              {rx.followUpDate && (
                <p className="text-base-content/60">
                  Follow-up: <span className="font-medium">{fmtDate(rx.followUpDate)}</span>
                  {rx.followUpInstructions && ` — ${rx.followUpInstructions}`}
                </p>
              )}

              {/* Expires */}
              <p className="text-base-content/40">
                Expires: {fmtDate(rx.expiresAt)}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SnapSection({ title, data }) {
  return (
    <div>
      <p className="label-text text-[10px] uppercase tracking-widest text-base-content/40 mb-1">{title}</p>
      {Object.entries(data).filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-1">
          <span className="text-base-content/40">{k}</span>
          <span className="font-medium truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}

function VitalChip({ label, value }) {
  return (
    <div className="stat-card !p-1 !rounded text-center">
      <div className="text-[9px] text-base-content/40 uppercase">{label}</div>
      <div className="font-mono font-bold text-[11px]">{value}</div>
    </div>
  );
}