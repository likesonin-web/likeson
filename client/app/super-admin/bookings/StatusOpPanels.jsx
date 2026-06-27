'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { CheckCircle, Edit2, Stethoscope } from 'lucide-react';
import {
  updateAdminBookingStatus, updateAdminOpStatus,
  selectLoading, selectAdminOpsLoading, selectAdminOpRecord,
} from '@/store/slices/operationsSlice';
import {
  BOOKING_STATUSES, OP_STATUSES, STATUS_NOTE_OPTIONS, OP_NOTE_OPTIONS,
  statusBadge, Spinner, EmptyState, FieldNote,
} from './shared';

/* ─── STATUS PANEL ─────────────────────────────────────────────────────────── */
export function StatusPanel({ booking, dispatch }) {
  const [newStatus,   setNewStatus]   = useState('');
  const [statusNote,  setStatusNote]  = useState('');
  const [customNote,  setCustomNote]  = useState('');
  const loading = useSelector(selectLoading('updateAdminBookingStatus'));

  const submit = () => {
    if (!newStatus) return;
    dispatch(updateAdminBookingStatus({
      bookingId: booking._id,
      status:    newStatus,
      note:      customNote || statusNote,
    }));
  };

  const predefined = STATUS_NOTE_OPTIONS[newStatus] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-center justify-between">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-base-content/45 block mb-1">Current Status</span>
          {statusBadge(booking.status)}
        </div>
        <div className="text-right">
          <span className="text-[9px] uppercase tracking-widest text-base-content/45 block mb-1">Payment</span>
          {statusBadge(booking.paymentStatus ?? 'unpaid')}
        </div>
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">
          New Status
        </label>
        <FieldNote text="Select the lifecycle status to transition this booking to. Admin override — use carefully." />
        <select
          value={newStatus}
          onChange={(e) => { setNewStatus(e.target.value); setStatusNote(''); setCustomNote(''); }}
          className="input-field text-xs mt-1"
        >
          <option value="">Select new status…</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {newStatus && predefined.length > 0 && (
        <div>
          <label className="label text-[10px] uppercase tracking-widest mb-1 block">Admin Reason</label>
          <FieldNote text="Predefined reasons for audit trail. Pick one or type custom below." />
          <select value={statusNote} onChange={(e) => setStatusNote(e.target.value)} className="input-field text-xs mt-1">
            <option value="">Select reason…</option>
            {predefined.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Custom Note</label>
        <FieldNote text="Overrides dropdown selection. Stored in status log." />
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          rows={2}
          placeholder="Custom note (overrides dropdown)…"
          className="input-field text-xs resize-none mt-1"
        />
      </div>

      <button disabled={loading || !newStatus} onClick={submit} className="btn btn-primary w-full gap-2">
        {loading ? <Spinner size={12} /> : <CheckCircle size={12} />}
        {loading ? 'Updating…' : 'Update Status'}
      </button>
    </div>
  );
}

/* ─── OP PANEL ─────────────────────────────────────────────────────────────── */
export function OpPanel({ booking, dispatch }) {
  const opRecord   = useSelector(selectAdminOpRecord);
  const opsLoading = useSelector(selectAdminOpsLoading);
  const [opStatus, setOpStatus] = useState('');
  const [opNotes,  setOpNotes]  = useState('');

  const updateOp = () => {
    if (!opRecord?._id || !opStatus) return;
    dispatch(updateAdminOpStatus({ opId: opRecord._id, status: opStatus, doctorNotes: opNotes }));
  };

  if (!opRecord) {
    return <EmptyState icon={Stethoscope} text="No OP record" sub="OP linked once doctor booking is confirmed" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 bg-base-200 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-base-content font-mono">{opRecord.opNumber}</span>
          {statusBadge(opRecord.status)}
        </div>
        <p className="text-[11px] text-base-content/50 m-0">
          {opRecord.consultationType ?? '—'} · {opRecord.scheduledAt ? new Date(opRecord.scheduledAt).toLocaleString('en-IN') : '—'}
        </p>
        {opRecord.doctor?.user?.name && (
          <p className="text-[11px] text-base-content/40 mt-1 m-0 flex items-center gap-1.5">
            <Stethoscope size={10} /> Dr. {opRecord.doctor.user.name}
          </p>
        )}
        {opRecord.doctorNotes && (
          <p className="text-[11px] text-base-content/40 italic mt-1 m-0">"{opRecord.doctorNotes}"</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="label text-[10px] uppercase tracking-widest">Update OP Status</label>
        <FieldNote text="Updates the OutPatient record status. Notifies doctor and hospital." />
        <select value={opStatus} onChange={(e) => { setOpStatus(e.target.value); setOpNotes(''); }} className="input-field text-xs">
          <option value="">Select status…</option>
          {OP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>

        {opStatus && (OP_NOTE_OPTIONS[opStatus] ?? []).length > 0 && (
          <>
            <FieldNote text="Choose a predefined note or type custom below." />
            <select value={opNotes} onChange={(e) => setOpNotes(e.target.value)} className="input-field text-xs">
              <option value="">Select admin note…</option>
              {(OP_NOTE_OPTIONS[opStatus] ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </>
        )}

        <textarea
          value={opNotes}
          onChange={(e) => setOpNotes(e.target.value)}
          rows={2}
          placeholder="Or type custom doctor notes…"
          className="input-field text-xs resize-none"
        />
      </div>

      <button disabled={opsLoading || !opStatus} onClick={updateOp} className="btn btn-primary w-full gap-2">
        {opsLoading ? <Spinner size={12} /> : <Edit2 size={12} />}
        Update OP Status
      </button>
    </div>
  );
}
