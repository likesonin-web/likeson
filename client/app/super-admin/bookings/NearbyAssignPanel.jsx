'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Car, Truck, Heart, Building2, Plus, RotateCcw, MapPin, Phone, CheckCircle, XCircle, Star } from 'lucide-react';
import {
  fetchNearbySoloDrivers, fetchNearbyTransportPartners,
  fetchNearbyCareAssistants, fetchNearbyHospitals,
  adminAssignSoloDriver, adminAssignTransportPartner,
  adminAssignCareAssistant, adminAssignHospital,
  adminReassignDriver, adminReassignCareAssistant,
  clearNearbyResults,
  selectNearbyDrivers, selectNearbyCareAssistants,
  selectNearbyTPs, selectNearbyHospitals,
  selectNearbyLoading, selectAdminAssignLoading,
} from '@/store/slices/operationsSlice';
import {
  TYPE_ASSIGN_TABS, getDriverAssignmentState,
  PartnerStatusBanner, CallButton, Spinner, EmptyState, FieldNote,
} from './shared';

/* ─── NEARBY ASSIGN PANEL ──────────────────────────────────────────────────── */
export function NearbyAssignPanel({ booking, dispatch }) {
  const bookingId      = booking._id;
  const bookingType    = booking.bookingType;
  const allowedTabs    = TYPE_ASSIGN_TABS[bookingType] ?? ['driver', 'tp', 'care', 'hospital'];

  const [tab,    setTab]    = useState(allowedTabs[0] ?? 'driver');
  const [reason, setReason] = useState('');

  const nearbyDrivers   = useSelector(selectNearbyDrivers);
  const nearbyCAs       = useSelector(selectNearbyCareAssistants);
  const nearbyTPs       = useSelector(selectNearbyTPs);
  const nearbyHospitals = useSelector(selectNearbyHospitals);
  const nearbyLoading   = useSelector(selectNearbyLoading);
  const assignLoading   = useSelector(selectAdminAssignLoading);

  const driverState = getDriverAssignmentState(booking);
  const caAssigned  = !!booking?.careAssistant;
  const tpAssigned  = !!booking?.transportPartner;
  const hospAssigned = !!booking?.hospital;

  const load = useCallback((t) => {
    setTab(t);
    if (t === 'driver')   dispatch(fetchNearbySoloDrivers({ bookingId }));
    if (t === 'care')     dispatch(fetchNearbyCareAssistants({ bookingId }));
    if (t === 'tp')       dispatch(fetchNearbyTransportPartners({ bookingId }));
    if (t === 'hospital') dispatch(fetchNearbyHospitals({ bookingId }));
  }, [bookingId, dispatch]);

  useEffect(() => {
    if (allowedTabs.length) load(allowedTabs[0]);
    return () => dispatch(clearNearbyResults());
  }, [load, dispatch]); // eslint-disable-line

  if (!allowedTabs.length) {
    return (
      <EmptyState icon={MapPin} text="No partner assignment needed" sub={`${bookingType?.replace(/_/g,' ')} does not require partner assignment`} />
    );
  }

  const ALL_TABS = [
    { id: 'driver',   label: 'Solo Drivers',  icon: Car,       note: 'Independent drivers onboarded on Likeson. Direct assignment, no agency.' },
    { id: 'tp',       label: 'Transport',      icon: Truck,     note: 'Fleet agencies. After assigning, TP must pick their own driver.' },
    { id: 'care',     label: 'Care Asst.',     icon: Heart,     note: 'Trained care assistants for patient accompaniment & care tasks.' },
    { id: 'hospital', label: 'Hospitals',      icon: Building2, note: 'Link a hospital for the appointment. Hospital confirms the slot.' },
  ].filter(t => allowedTabs.includes(t.id));

  const actionInfo = (t) => {
    if (t === 'driver') {
      if (driverState.state === 'rejected') return { label: 'Reassign (Rejected)', mode: 'reassign', danger: true };
      if (driverState.state === 'assigned') return { label: 'Reassign Driver',     mode: 'reassign', danger: false };
      return { label: 'Assign Driver', mode: 'assign', danger: false };
    }
    if (t === 'care')     return caAssigned   ? { label: 'Reassign CA',       mode: 'reassign', danger: false } : { label: 'Assign CA', mode: 'assign', danger: false };
    if (t === 'tp')       return tpAssigned   ? { label: 'Reassign Fleet',    mode: 'reassign', danger: false } : { label: 'Assign TP', mode: 'assign', danger: false };
    if (t === 'hospital') return hospAssigned ? { label: 'Relink Hospital',   mode: 'reassign', danger: false } : { label: 'Link Hospital', mode: 'assign', danger: false };
    return { label: 'Assign', mode: 'assign', danger: false };
  };

  const handleAction = (type, id, soloPartnerId) => {
    const info = actionInfo(type);
    if (info.mode === 'reassign') {
      if (type === 'driver') dispatch(adminReassignDriver({ bookingId, newDriverId: id, reason: reason || 'Admin reassignment' }));
      if (type === 'care')   dispatch(adminReassignCareAssistant({ bookingId, newCareAssistantId: id }));
      if (type === 'tp')     dispatch(adminAssignTransportPartner({ bookingId, transportPartnerId: id }));
      if (type === 'hospital') dispatch(adminAssignHospital({ bookingId, hospitalId: id }));
    } else {
      if (type === 'driver')   dispatch(adminAssignSoloDriver({ bookingId, soloDriverPartnerId: soloPartnerId ?? id }));
      if (type === 'care')     dispatch(adminAssignCareAssistant({ bookingId, careAssistantId: id }));
      if (type === 'tp')       dispatch(adminAssignTransportPartner({ bookingId, transportPartnerId: id }));
      if (type === 'hospital') dispatch(adminAssignHospital({ bookingId, hospitalId: id }));
    }
  };

  const currentInfo = actionInfo(tab);

  /* ── Driver cards ── */
  const DriverCard = ({ d, i }) => (
    <div key={d.driverId ?? i} className="rounded-xl border border-base-300 bg-base-200/40 hover:border-primary/30 transition-colors p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-base-content m-0 truncate">{d.name ?? '—'}</p>
            {d.phone && <CallButton phone={d.phone} label="" size="xs" />}
            {(d.rating > 0) && (
              <span className="flex items-center gap-0.5 text-[10px] text-warning font-bold">
                <Star size={8} fill="currentColor" /> {d.rating?.toFixed(1)}
              </span>
            )}
          </div>
          {d.phone && <p className="text-[10px] text-base-content/50 m-0 mt-0.5">{d.phone}</p>}
          {d.distanceKm != null && <p className="text-[10px] text-primary font-semibold m-0">{d.distanceKm} km away</p>}
          {d.vehicle && (
            <p className="text-[10px] text-base-content/35 mt-0.5 m-0">
              {[d.vehicle.make, d.vehicle.model, d.vehicle.registrationNumber].filter(Boolean).join(' · ')}
              {d.vehicle.isWheelchairAccessible && ' · ♿'}
              {d.vehicle.hasStretcherSupport && ' · 🛏'}
            </p>
          )}
          {d.matchedZone && <p className="text-[10px] text-base-content/30 m-0">Zone: {d.matchedZone.city}, {d.matchedZone.state}</p>}
        </div>
        <button
          disabled={assignLoading}
          onClick={() => handleAction('driver', d.driverId, d.soloPartnerId)}
          className={`btn btn-xs gap-1 shrink-0 ${currentInfo.danger ? 'btn-error' : 'btn-primary'}`}
        >
          {assignLoading ? <Spinner size={9} /> : currentInfo.mode === 'reassign' ? <RotateCcw size={9} /> : <Plus size={9} />}
          {currentInfo.label}
        </button>
      </div>
    </div>
  );

  /* ── TP cards ── */
  const TpCard = ({ tp, i }) => (
    <div key={tp.tpId ?? i} className="rounded-xl border border-base-300 bg-base-200/40 hover:border-primary/30 transition-colors p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-base-content m-0 truncate">{tp.businessName ?? '—'}</p>
            {tp.ownerPhone && <CallButton phone={tp.ownerPhone} label="" size="xs" />}
            {(tp.averageRating > 0) && (
              <span className="flex items-center gap-0.5 text-[10px] text-warning font-bold">
                <Star size={8} fill="currentColor" /> {tp.averageRating?.toFixed(1)}
              </span>
            )}
          </div>
          {tp.ownerPhone && <p className="text-[10px] text-base-content/50 m-0 mt-0.5">Owner: {tp.ownerPhone}</p>}
          <p className="text-[10px] text-base-content/35 m-0">
            {tp.availableDriversNearby ?? tp.activeDrivers ?? 0} drivers avail · {tp.totalVehicles ?? 0} vehicles
            {tp.isDispatchReady ? ' · ✅ Ready' : ' · ⚠️ Not ready'}
          </p>
          {tp.matchedZone && <p className="text-[10px] text-base-content/30 m-0">Zone: {tp.matchedZone.city}</p>}
        </div>
        <button
          disabled={assignLoading || !tp.isDispatchReady}
          onClick={() => handleAction('tp', tp.tpId)}
          className="btn btn-xs gap-1 btn-primary shrink-0"
        >
          {assignLoading ? <Spinner size={9} /> : <Plus size={9} />}
          {actionInfo('tp').label}
        </button>
      </div>
    </div>
  );

  /* ── CA cards ── */
  const CaCard = ({ ca, i }) => (
    <div key={ca.careAssistantId ?? i} className="rounded-xl border border-base-300 bg-base-200/40 hover:border-primary/30 transition-colors p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-base-content m-0 truncate">{ca.name ?? '—'}</p>
            {ca.phone && <CallButton phone={ca.phone} label="" size="xs" />}
            {(ca.rating > 0) && (
              <span className="flex items-center gap-0.5 text-[10px] text-warning font-bold">
                <Star size={8} fill="currentColor" /> {ca.rating?.toFixed(1)}
              </span>
            )}
          </div>
          {ca.phone && <p className="text-[10px] text-base-content/50 m-0 mt-0.5">{ca.phone}</p>}
          {ca.distanceKm != null && <p className="text-[10px] text-primary font-semibold m-0">{ca.distanceKm} km away</p>}
          {ca.specializations?.length > 0 && (
            <p className="text-[10px] text-base-content/35 mt-0.5 m-0">{ca.specializations.slice(0, 3).join(', ')}</p>
          )}
          {ca.workType && <p className="text-[10px] text-base-content/30 m-0">Type: {ca.workType}</p>}
        </div>
        <button
          disabled={assignLoading}
          onClick={() => handleAction('care', ca.careAssistantId)}
          className="btn btn-xs gap-1 btn-primary shrink-0"
        >
          {assignLoading ? <Spinner size={9} /> : caAssigned ? <RotateCcw size={9} /> : <Plus size={9} />}
          {actionInfo('care').label}
        </button>
      </div>
    </div>
  );

  /* ── Hospital cards ── */
  const HospCard = ({ h, i }) => (
    <div key={h.hospitalId ?? i} className="rounded-xl border border-base-300 bg-base-200/40 hover:border-primary/30 transition-colors p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-base-content m-0 truncate">{h.name ?? '—'}</p>
            {h.phone && <CallButton phone={h.phone} label="" size="xs" />}
            {(h.averageRating > 0) && (
              <span className="flex items-center gap-0.5 text-[10px] text-warning font-bold">
                <Star size={8} fill="currentColor" /> {h.averageRating?.toFixed(1)}
              </span>
            )}
          </div>
          {h.phone && <p className="text-[10px] text-base-content/50 m-0 mt-0.5">{h.phone}</p>}
          {h.address && <p className="text-[10px] text-base-content/35 m-0">{h.address}</p>}
          <p className="text-[10px] text-base-content/35 m-0">
            {h.distanceKm != null ? `${h.distanceKm} km` : ''}
            {h.is24x7 ? ' · 24×7' : ''}
            {h.isEmergencyReady ? ' · Emergency' : ''}
            {h.linkedDoctors ? ` · ${h.linkedDoctors} doctors` : ''}
          </p>
          {h.specialties?.length > 0 && (
            <p className="text-[10px] text-base-content/30 m-0">{h.specialties.slice(0, 3).join(', ')}</p>
          )}
        </div>
        <button
          disabled={assignLoading}
          onClick={() => handleAction('hospital', h.hospitalId)}
          className="btn btn-xs gap-1 btn-primary shrink-0"
        >
          {assignLoading ? <Spinner size={9} /> : hospAssigned ? <RotateCcw size={9} /> : <Plus size={9} />}
          {actionInfo('hospital').label}
        </button>
      </div>
    </div>
  );

  const lists = {
    driver:   (nearbyDrivers   ?? []).map((d, i) => <DriverCard key={d.driverId ?? i} d={d} i={i} />),
    tp:       (nearbyTPs       ?? []).map((tp, i) => <TpCard    key={tp.tpId ?? i}    tp={tp} i={i} />),
    care:     (nearbyCAs       ?? []).map((ca, i) => <CaCard    key={ca.careAssistantId ?? i} ca={ca} i={i} />),
    hospital: (nearbyHospitals ?? []).map((h, i)  => <HospCard  key={h.hospitalId ?? i}  h={h} i={i} />),
  };

  const currentTabMeta = ALL_TABS.find(t => t.id === tab);

  return (
    <div className="flex flex-col gap-3">
      <PartnerStatusBanner booking={booking} />

      {/* Reassign reason */}
      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Reassign Reason</label>
        <FieldNote text="Required for reassignment audit. Optional for first-time assignments." />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reassign reason (optional for new assign)…"
          className="input-field text-xs mt-1"
        />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1.5 flex-wrap">
        {ALL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => load(id)}
            className={`btn btn-xs gap-1.5 ${tab === id ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
          >
            <Icon size={9} /> {label}
          </button>
        ))}
      </div>

      {/* Tab note */}
      {currentTabMeta?.note && (
        <div className="rounded-lg bg-base-300/40 px-3 py-2 text-[10px] text-base-content/50">
          {currentTabMeta.note}
        </div>
      )}

      {/* Results */}
      {nearbyLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-base-content/40">
          <Spinner size={14} /> Searching nearby…
        </div>
      ) : (lists[tab]?.length ?? 0) > 0 ? (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
          {lists[tab]}
        </div>
      ) : (
        <EmptyState icon={MapPin} text="No nearby results" sub="Check location data or partner availability" />
      )}
    </div>
  );
}
