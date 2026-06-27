'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Radio, Video, Zap, Plus, AlertTriangle, RefreshCw, Car, Heart } from 'lucide-react';
import {
  createConsultation, fetchAgoraTokens, provisionAgoraTokens,
  selectAgora, selectLoading as selectConsultLoading,
} from '@/store/slices/consultationSlice';
import {
  fetchCareTrackingSnapshot, selectCareTrackingSnapshot,
  selectCareAssistantLocation, selectLiveLocation, selectSocketConnected,
  selectLoading,
} from '@/store/slices/operationsSlice';
import LiveTrackingPanel from './LiveTrackingPanel';
import {
  resolveConsultId, fmt, fmtDate, Spinner, EmptyState, SectionHeader,
  InfoRow, CA_STATUS_LABELS, CA_STATUS_COLORS, CallButton, FieldNote,
} from './shared';

/* ─── CONSULTATION PANEL ───────────────────────────────────────────────────── */
export function ConsultationPanel({ booking, dispatch }) {
  const router = useRouter();
  const [form, setForm] = useState({ consultationType: 'video', scheduledAt: '', slotDurationMin: 30, urgency: 'routine' });
  const agoraState    = useSelector(selectAgora);
  const tokenLoading  = useSelector(selectConsultLoading('agora'));
  const createLoading = useSelector(selectConsultLoading('create'));
  const [localErr, setLocalErr] = useState(null);

  const consultationId = resolveConsultId(booking?.consultationSessionId);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.scheduledAt) { setLocalErr('Scheduled date/time is required'); return; }
    setLocalErr(null);
    try {
      await dispatch(createConsultation({
        bookingId: booking._id, consultationType: form.consultationType,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        slotDurationMin: Number(form.slotDurationMin), urgency: form.urgency,
      })).unwrap();
    } catch (e) { setLocalErr(String(e?.message ?? e)); }
  };

  const handleFetchToken = async () => {
    if (!consultationId) return;
    setLocalErr(null);
    try {
      const res = await dispatch(fetchAgoraTokens(consultationId)).unwrap();
      if (!res?.tokens) await dispatch(provisionAgoraTokens(consultationId)).unwrap();
    } catch {
      try { await dispatch(provisionAgoraTokens(consultationId)).unwrap(); }
      catch (e2) { setLocalErr(String(e2?.message ?? e2)); }
    }
  };

  const tokens    = agoraState?.myTokens ?? agoraState?.doctorTokens;
  const hasTokens = !!tokens?.rtcToken;

  if (consultationId) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-violet-300/30 bg-violet-50/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-violet-400/15 flex items-center justify-center">
              <Radio size={10} className="text-violet-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Session Linked</span>
          </div>
          <p className="text-[11px] font-mono text-base-content/60 m-0 break-all">{consultationId}</p>
          <p className="text-[10px] text-base-content/40 mt-1 m-0">Type: {booking.consultationType ?? form.consultationType} · {booking.bookingType?.replace(/_/g, ' ')}</p>
          <FieldNote text="Agora-based telemedicine room. Doctor and patient connect here." />
        </div>

        {hasTokens && (
          <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 m-0">Agora Session</p>
            <InfoRow label="Channel"   value={tokens.channelName} mono />
            <InfoRow label="App ID"    value={agoraState.appId}  mono />
            <InfoRow label="UID"       value={String(tokens.uid ?? '—')} mono />
            <InfoRow label="Expires"   value={agoraState.expiresAt ? new Date(agoraState.expiresAt).toLocaleTimeString('en-IN') : '—'} />
            <div className="rounded-lg border border-base-300 bg-base-100 p-2 mt-1">
              <p className="text-[9px] text-base-content/40 m-0 mb-1">RTC Token (SDK use only)</p>
              <p className="text-[10px] font-mono text-base-content/50 break-all m-0 select-all line-clamp-3">{tokens.rtcToken}</p>
            </div>
          </div>
        )}

        {localErr && <p className="text-[10px] text-error m-0">{localErr}</p>}

        <div className="flex gap-2">
          <button disabled={tokenLoading} onClick={handleFetchToken} className="btn btn-primary btn-sm flex-1 gap-1.5">
            {tokenLoading ? <Spinner size={10} /> : <Zap size={10} />}
            {hasTokens ? 'Refresh Token' : 'Get Agora Token'}
          </button>
          <button onClick={() => router.push(`/doctor/consultation/${consultationId}`)} className="btn btn-success btn-sm flex-1 gap-1.5">
            <Video size={10} /> Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-[10px] text-warning-content/70">
        No consultation session linked. Create one below to enable telemedicine for this booking. A Razorpay Agora room will be provisioned.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-[10px] uppercase tracking-widest mb-1 block">Type</label>
          <select value={form.consultationType} onChange={(e) => upd('consultationType', e.target.value)} className="input-field text-xs">
            {['video','audio','chat','in_person','home_visit'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-[10px] uppercase tracking-widest mb-1 block">Urgency</label>
          <select value={form.urgency} onChange={(e) => upd('urgency', e.target.value)} className="input-field text-xs">
            {['routine','urgent','emergency'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Scheduled At <span className="text-error">*</span></label>
        <FieldNote text="Must match the booking's scheduled time or an agreed teleconsult slot." />
        <input type="datetime-local" value={form.scheduledAt} onChange={(e) => upd('scheduledAt', e.target.value)} className="input-field text-xs mt-1" />
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Slot Duration (min)</label>
        <input type="number" value={form.slotDurationMin} min={5} max={180} onChange={(e) => upd('slotDurationMin', e.target.value)} className="input-field text-xs" />
      </div>

      {localErr && <p className="text-[10px] text-error m-0">{localErr}</p>}

      <button disabled={createLoading || !form.scheduledAt} onClick={handleCreate} className="btn btn-primary w-full gap-2">
        {createLoading ? <Spinner size={12} /> : <Plus size={12} />}
        {createLoading ? 'Creating session…' : 'Create Consultation Room'}
      </button>
    </div>
  );
}

/* ─── CARE TRACKING PANEL ──────────────────────────────────────────────────── */
export function CareTrackingPanel({ booking, dispatch }) {
  const snapshot        = useSelector(selectCareTrackingSnapshot);
  const caLocation      = useSelector(selectCareAssistantLocation);
  const liveLocation    = useSelector(selectLiveLocation);
  const socketConnected = useSelector(selectSocketConnected);
  const loading         = useSelector(selectLoading('fetchCareTrackingSnapshot'));

  useEffect(() => {
    if (booking?._id) dispatch(fetchCareTrackingSnapshot({ bookingId: booking._id }));
  }, [booking?._id, dispatch]);

  const ca        = snapshot?.careAssistant;
  const caLoc     = ca?.liveLocation ?? caLocation;
  const driverLoc = snapshot?.driver?.liveLocation ?? liveLocation;
  const route     = snapshot?.route;

  return (
    <div className="flex flex-col gap-3">
      {/* Map */}
      <div className="rounded-xl border border-base-300 overflow-hidden" style={{ height: 200 }}>
        <LiveTrackingPanel
          booking={booking}
          mapRoute={route ? {
            polyline:         route.expectedPolyline,
            estimatedDistKm:  route.estimatedDistanceKm,
            estimatedMinutes: route.estimatedDurationMin,
            pickupCoords:     route.pickup?.coordinates,
            dropoffCoords:    route.dropoff?.coordinates,
          } : null}
          liveLocation={driverLoc}
          socketConnected={socketConnected}
        />
      </div>

      {/* Driver + CA cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center"><Car size={12} className="text-primary" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">Driver</span>
          </div>
          {snapshot?.driver?.snapshot ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-base-content m-0 truncate">{snapshot.driver.snapshot.legalName ?? 'Assigned'}</p>
                <CallButton phone={snapshot.driver.snapshot.phone} label="" size="xs" />
              </div>
              <p className="text-[10px] text-base-content/50 m-0">{snapshot.driver.snapshot.phone ?? '—'}</p>
              {snapshot.driver.vehicleSnapshot && (
                <p className="text-[10px] text-base-content/35 m-0 mt-0.5">
                  {snapshot.driver.vehicleSnapshot.make} {snapshot.driver.vehicleSnapshot.model} · {snapshot.driver.vehicleSnapshot.registrationNumber}
                </p>
              )}
            </>
          ) : <p className="text-[10px] text-base-content/35 m-0">Not yet assigned</p>}
          {driverLoc && (
            <div className="flex items-center gap-1 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-success font-medium">Live</span>
              <span className="text-[10px] text-base-content/40">{driverLoc.speedKmh ?? 0} km/h</span>
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-3 ${ca?.isLinkedToRide ? 'border-rose-300/40 bg-rose-50/20' : 'border-base-300 bg-base-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-rose-400/15 flex items-center justify-center"><Heart size={12} className="text-rose-400" /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">Care Asst.</span>
          </div>
          {ca ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-base-content m-0 truncate">{ca.name ?? 'Assigned'}</p>
                <CallButton phone={ca.phone} label="" size="xs" />
              </div>
              <p className="text-[10px] text-base-content/50 m-0">{ca.phone ?? '—'}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {ca.isLinkedToRide ? (
                  <>
                    <div className={`w-1.5 h-1.5 rounded-full ${ca.status === 'in_ride' ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                    <span className={`text-[10px] font-medium ${CA_STATUS_COLORS[ca.status] ?? 'text-base-content/40'}`}>{CA_STATUS_LABELS[ca.status] ?? ca.status}</span>
                  </>
                ) : <span className="text-[10px] text-base-content/35">Not joined ride</span>}
              </div>
            </>
          ) : <p className="text-[10px] text-base-content/35 m-0">Not assigned</p>}
        </div>
      </div>

      {/* Route summary */}
      {route && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <SectionHeader title="Route Summary" />
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Distance', v: route.estimatedDistanceKm ? `${route.estimatedDistanceKm} km` : '—' },
              { l: 'ETA', v: snapshot?.route?.currentEtaMinutes ? `${snapshot.route.currentEtaMinutes} min` : '—' },
              { l: 'SOS Active', v: snapshot?.hasActiveSos ? 'YES' : 'No' },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">{l}</p>
                <p className={`text-xs font-bold m-0 mt-0.5 ${l === 'SOS Active' && snapshot?.hasActiveSos ? 'text-error' : 'text-base-content'}`}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {(snapshot?.milestones?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <SectionHeader title="Milestones" sub={`${snapshot.milestones.length} recorded`} />
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollbar-thin">
            {[...snapshot.milestones].reverse().slice(0, 8).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-base-300/40 last:border-0">
                <span className="font-medium text-base-content/70">{m.name?.replace(/_/g, ' ')}</span>
                <span className="text-base-content/40">{fmt(m.occurredAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {snapshot?.hasActiveSos && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 flex items-center gap-2 text-error text-xs font-bold">
          <AlertTriangle size={14} /> Active SOS on this booking — escalate immediately
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-base-content/40">
          <Spinner size={12} /> Loading tracking data…
        </div>
      )}

      <button onClick={() => dispatch(fetchCareTrackingSnapshot({ bookingId: booking._id }))} className="btn btn-sm gap-1.5 bg-base-300 text-base-content w-full">
        <RefreshCw size={10} /> Refresh Snapshot
      </button>
    </div>
  );
}
