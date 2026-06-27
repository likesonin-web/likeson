'use client';

/**
 * PricingZonesManagement.jsx — Likeson.in
 * Transport Partner — Pricing & Service Zones
 * - Per KM Rate is READ-ONLY for TP (admin-only field)
 * - Google Maps used for zone location preview
 * - Aligned to transportPartnerSlice.js state shape
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Trash2, Edit3, Save, X,
  Loader2, Info, Lock, IndianRupee, Clock,
  Zap, Map, ChevronRight, Settings,
  RefreshCw, CheckCircle2, AlertTriangle,
  Navigation, Globe, Building2, Hash,
  Accessibility, Moon, TrendingUp,
} from 'lucide-react';
import {
  fetchTPZones, addTPZone, updateTPZone, removeTPZone,
  fetchTPPricing, updateTPPricing,
} from '@/store/slices/transportPartnerSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyBkwZzM-ZJCCHUg5hG5vbT9OSIeUPVi_qw';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const DEFAULT_ZONE = {
  city: '', state: '', pinCodes: [], radiusKm: 15, isActive: true,
};

const DEFAULT_PRICING = {
  baseFare: 0,
  baseFarePerKm: 0,       // admin-only — read only for TP
  minimumFare: 500,
  waitingChargePerMin: 2,
  freeWaitingMinutes: 10,
  nightSurchargePercent: 20,
  wheelchairSurcharge: 100,
  currency: 'INR',
};

// ─────────────────────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Field = ({ label, note, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1">
      {label}{required && <span className="text-red-400">*</span>}
    </label>
    {children}
    {note && (
      <p className="text-[10px] text-slate-400 leading-snug mt-0.5 pl-0.5 flex items-start gap-1">
        <Info size={9} className="flex-shrink-0 mt-0.5" /> {note}
      </p>
    )}
  </div>
);

const Input = ({ mono, className = '', ...props }) => (
  <input
    {...props}
    className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm
      bg-white text-slate-800 placeholder-slate-300
      focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400
      transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
      ${mono ? 'font-mono tracking-wide' : ''} ${className}`}
  />
);

const LockedField = ({ label, value, note }) => (
  <Field label={label} note={note}>
    <div className="relative">
      <div className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm
        bg-slate-50 text-slate-400 flex items-center justify-between">
        <span className="font-mono">₹ {value ?? '—'}</span>
        <div className="flex items-center gap-1.5 text-amber-500">
          <Lock size={11} />
          <span className="text-[10px] font-bold tracking-wide">ADMIN ONLY</span>
        </div>
      </div>
    </div>
  </Field>
);

const Toggle = ({ label, note, value, onChange, Icon: Ico, color = '#14b8a6' }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
    <div className="flex items-start gap-2.5">
      {Ico && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Ico size={13} style={{ color }} />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {note && <p className="text-[10px] text-slate-400 mt-0.5 flex items-start gap-1"><Info size={8} className="mt-0.5 flex-shrink-0" />{note}</p>}
      </div>
    </div>
    <button
      type="button" onClick={() => onChange(!value)} role="switch" aria-checked={value}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-300 ${value ? 'bg-teal-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${value ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE MAPS ZONE PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

const ZoneMapPreview = ({ city, state, radiusKm }) => {
  const query = [city, state, 'India'].filter(Boolean).join(', ');
  if (!city && !state) return (
    <div className="w-full h-44 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
      <div className="text-center">
        <Map size={22} className="mx-auto text-slate-300 mb-2" />
        <p className="text-xs text-slate-400">Enter city & state to preview map</p>
      </div>
    </div>
  );

  const encodedQuery = encodeURIComponent(query);
  const zoom = radiusKm <= 5 ? 13 : radiusKm <= 15 ? 12 : radiusKm <= 30 ? 11 : 10;
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodedQuery}&zoom=${zoom}`;

  return (
    <div className="w-full h-44 rounded-2xl overflow-hidden border border-slate-200 relative">
      <iframe
        title={`Map of ${query}`}
        width="100%" height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
        aria-label={`Map showing ${query}`}
      />
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-teal-700 shadow-sm">
        <Navigation size={9} /> Radius: {radiusKm} km
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ZONE FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const ZoneForm = ({ zone, onSave, onClose, loading }) => {
  const [form, setForm] = useState({ ...DEFAULT_ZONE, ...(zone ?? {}) });
  const [pinInput, setPinInput] = useState('');

  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);

  const addPin = () => {
    const pin = pinInput.trim().replace(/\D/g, '');
    if (pin.length === 6 && !form.pinCodes.includes(pin)) {
      set('pinCodes', [...form.pinCodes, pin]);
    }
    setPinInput('');
  };

  const removePin = (pin) => set('pinCodes', form.pinCodes.filter(p => p !== pin));

  const isValid = form.city.trim() && form.state.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93 }}
        className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-slate-200"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
              <MapPin size={17} className="text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                {zone?._id ? 'Edit Service Zone' : 'Add Service Zone'}
              </h3>
              <p className="text-[10px] text-slate-400">Define where you operate</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" required note="District/city name as commonly known.">
              <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Vijayawada" />
            </Field>
            <Field label="State" required>
              <select
                value={form.state}
                onChange={e => set('state', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm
                  bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400/30
                  focus:border-teal-400 transition-all"
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Coverage Radius"
            note="Approximate radius in km from the city centre your fleet covers. Does not restrict GPS dispatch.">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Input
                  type="number" value={form.radiusKm} min={1} max={200}
                  onChange={e => set('radiusKm', Number(e.target.value))}
                  className="w-28" mono
                />
                <span className="text-sm text-slate-400">km</span>
                <div className="flex gap-1.5 flex-wrap">
                  {[5, 10, 15, 25, 50].map(r => (
                    <button key={r} type="button" onClick={() => set('radiusKm', r)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all
                        ${form.radiusKm === r ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {r} km
                    </button>
                  ))}
                </div>
              </div>
              <input type="range" min={1} max={100} value={form.radiusKm}
                onChange={e => set('radiusKm', Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-teal-600" />
            </div>
          </Field>

          {/* Pin Codes */}
          <Field label="Pin Codes"
            note="Optional — add specific pin codes to target more precise areas within this zone.">
            <div className="flex gap-2">
              <Input
                type="text" value={pinInput} maxLength={6}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && addPin()}
                placeholder="6-digit PIN…" mono className="flex-1"
              />
              <button type="button" onClick={addPin}
                className="px-3 py-2 rounded-xl bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors border border-teal-200">
                <Plus size={14} />
              </button>
            </div>
            {form.pinCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.pinCodes.map(pin => (
                  <span key={pin} className="inline-flex items-center gap-1 text-[10px] font-mono font-bold
                    bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-lg">
                    {pin}
                    <button type="button" onClick={() => removePin(pin)}
                      className="text-teal-400 hover:text-red-500 transition-colors ml-0.5">
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Toggle label="Zone Active" Icon={CheckCircle2} color="#14b8a6"
            note="Inactive zones won't accept new dispatches but existing rides complete normally."
            value={form.isActive} onChange={v => set('isActive', v)} />

          {/* Map Preview */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Map Preview</p>
            <ZoneMapPreview city={form.city} state={form.state} radiusKm={form.radiusKm} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          {!isValid && <p className="text-[10px] text-red-400 font-semibold">City and State are required.</p>}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <motion.button
              onClick={() => isValid && onSave(form)}
              disabled={loading || !isValid}
              whileHover={{ scale: isValid ? 1.02 : 1 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500
                text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {zone?._id ? 'Update Zone' : 'Add Zone'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ZONE CARD
// ─────────────────────────────────────────────────────────────────────────────

const ZoneCard = ({ zone, onEdit, onDelete, onToggleActive, loading }) => {
  const [showMap, setShowMap] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all
        ${zone.isActive ? 'border-teal-100' : 'border-slate-200 opacity-75'}`}
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      {/* Top accent */}
      <div className={`h-1 ${zone.isActive ? 'bg-gradient-to-r from-teal-500 to-teal-400' : 'bg-slate-300'}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${zone.isActive ? 'bg-teal-50 border border-teal-200' : 'bg-slate-100 border border-slate-200'}`}>
              <MapPin size={17} className={zone.isActive ? 'text-teal-600' : 'text-slate-400'} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">{zone.city}</p>
              <p className="text-xs text-slate-500">{zone.state}</p>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0
            ${zone.isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'}`}>
            {zone.isActive ? '● ACTIVE' : '○ INACTIVE'}
          </span>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
            <Navigation size={9} /> {zone.radiusKm} km radius
          </span>
          {zone.pinCodes?.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">
              <Hash size={9} /> {zone.pinCodes.length} PIN code{zone.pinCodes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Pin codes */}
        {zone.pinCodes?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {zone.pinCodes.slice(0, 6).map(pin => (
              <span key={pin} className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                {pin}
              </span>
            ))}
            {zone.pinCodes.length > 6 && (
              <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5">+{zone.pinCodes.length - 6} more</span>
            )}
          </div>
        )}

        {/* Map toggle */}
        <button
          onClick={() => setShowMap(p => !p)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200
            text-[10px] font-bold text-slate-500 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all mb-3">
          <Map size={10} /> {showMap ? 'Hide Map' : 'Show Map Preview'}
        </button>

        <AnimatePresence>
          {showMap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
              <ZoneMapPreview city={zone.city} state={zone.state} radiusKm={zone.radiusKm} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => onEdit(zone)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
              bg-teal-50 text-teal-600 hover:bg-teal-100 text-[10px] font-bold transition-colors">
            <Edit3 size={10} /> Edit
          </button>
          <button
            onClick={() => onToggleActive(zone)}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50
              ${zone.isActive
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
          >
            {zone.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => onDelete(zone._id)}
            className="py-1.5 px-2.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING PANEL
// ─────────────────────────────────────────────────────────────────────────────

const PricingPanel = ({ pricing, loading, onSave }) => {
  const [form, setForm] = useState({ ...DEFAULT_PRICING, ...(pricing?.pricing ?? pricing ?? {}) });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const src = pricing?.pricing ?? pricing ?? {};
    setForm({ ...DEFAULT_PRICING, ...src });
    setDirty(false);
  }, [pricing]);

  const set = useCallback((k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setDirty(true);
  }, []);

  const handleSave = () => onSave(form);

  return (
    <div className="space-y-5" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* Admin note banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
        <Lock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-700">Some fields are managed by Likeson Admin</p>
          <p className="text-[11px] text-amber-600 mt-0.5">
            The <strong>Per KM Rate</strong> is set by the Likeson platform team based on your partner agreement.
            Contact support to request a rate adjustment.
          </p>
        </div>
      </div>

      {/* Fare Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <IndianRupee size={14} className="text-teal-600" />
          <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Fare Structure</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Field label="Base Fare (₹)"
            note="Fixed charge applied at the start of every ride, before per-km calculation.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <Input type="number" value={form.baseFare} min={0}
                onChange={e => set('baseFare', Number(e.target.value))}
                className="pl-7" mono />
            </div>
          </Field>

          {/* LOCKED — admin only */}
          <LockedField
            label="Per KM Rate (₹)"
            value={form.baseFarePerKm}
            note="Set by Likeson admin per your partner agreement. Not editable here — contact support."
          />

          <Field label="Minimum Fare (₹)"
            note="No ride will be billed below this amount, even for very short distances.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <Input type="number" value={form.minimumFare} min={0}
                onChange={e => set('minimumFare', Number(e.target.value))}
                className="pl-7" mono />
            </div>
          </Field>
        </div>
      </div>

      {/* Waiting */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <Clock size={14} className="text-teal-600" />
          <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Waiting Charges</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Waiting Charge per Minute (₹)"
            note="Charged after the free waiting window passes. Helps compensate drivers during delays.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <Input type="number" value={form.waitingChargePerMin} min={0} step={0.5}
                onChange={e => set('waitingChargePerMin', Number(e.target.value))}
                className="pl-7" mono />
            </div>
          </Field>
          <Field label="Free Waiting Window (minutes)"
            note="Grace period before waiting charges begin. Recommended: 5–15 mins for medical transport.">
            <Input type="number" value={form.freeWaitingMinutes} min={0} max={60}
              onChange={e => set('freeWaitingMinutes', Number(e.target.value))}
              mono />
          </Field>
        </div>
      </div>

      {/* Surcharges */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp size={14} className="text-teal-600" />
          <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Surcharges</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Night Surcharge (%)"
            note="Applied to rides between 10 PM – 6 AM. Helps incentivise night-shift drivers.">
            <div className="relative">
              <Input type="number" value={form.nightSurchargePercent} min={0} max={100}
                onChange={e => set('nightSurchargePercent', Number(e.target.value))}
                className="pr-8" mono />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
          </Field>
          <Field label="Wheelchair Accessible Surcharge (₹)"
            note="Extra charge for wheelchair-configured vehicles to cover specialised equipment costs.">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <Input type="number" value={form.wheelchairSurcharge} min={0}
                onChange={e => set('wheelchairSurcharge', Number(e.target.value))}
                className="pl-7" mono />
            </div>
          </Field>
        </div>
      </div>

      {/* Preview card */}
      <div className="bg-gradient-to-br from-teal-50 to-slate-50 rounded-2xl border border-teal-100 p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-3">Sample Fare Preview</p>
        <p className="text-[11px] text-slate-500 mb-3">
          Estimated fare for a 12 km daytime ride (no waiting):
        </p>
        <div className="space-y-1.5">
          {[
            ['Base Fare',          `₹ ${form.baseFare}`],
            ['Distance (12 km)',   `₹ ${(form.baseFarePerKm * 12).toFixed(0)} (rate set by admin)`],
            ['Total',              `₹ ${Math.max(form.minimumFare, form.baseFare + form.baseFarePerKm * 12).toFixed(0)}`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-slate-500">{label}</span>
              <span className="font-bold text-slate-700">{val}</span>
            </div>
          ))}
          <div className="border-t border-teal-200 pt-1.5 flex justify-between text-xs">
            <span className="text-slate-400 text-[10px]">Min fare applied if total is lower</span>
            <span className="text-[10px] font-bold text-teal-600">Min ₹ {form.minimumFare}</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {dirty && (
          <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
            <AlertTriangle size={10} /> Unsaved changes
          </p>
        )}
        <motion.button
          onClick={handleSave}
          disabled={loading || !dirty}
          whileHover={{ scale: dirty ? 1.02 : 1 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500
            text-white text-xs font-bold ml-auto disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save Pricing
        </motion.button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM
// ─────────────────────────────────────────────────────────────────────────────

const DeleteConfirm = ({ onConfirm, onClose, loading }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    role="dialog" aria-modal="true"
  >
    <motion.div
      initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
      className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-slate-200"
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={21} className="text-red-400" />
      </div>
      <h2 className="text-base font-black text-slate-800">Remove Zone?</h2>
      <p className="text-xs text-slate-400 mt-2 mb-6">
        This zone will be permanently removed. Active rides in this zone will complete normally.
      </p>
      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={13} className="mx-auto animate-spin" /> : 'Remove Zone'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'zones',   label: 'Service Zones', Icon: MapPin   },
  { id: 'pricing', label: 'Pricing',       Icon: IndianRupee },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PricingZonesManagement() {
  const dispatch = useDispatch();
  const { zones = [], pricing = null, loading } = useSelector(s => s.transportPartner);

  const [tab,           setTab]           = useState('zones');
  const [showZoneForm,  setShowZoneForm]  = useState(false);
  const [editingZone,   setEditingZone]   = useState(null);
  const [deleteZoneId,  setDeleteZoneId]  = useState(null);

  // Load on mount
  useEffect(() => {
    dispatch(fetchTPZones());
    dispatch(fetchTPPricing());
  }, [dispatch]);

  const refresh = useCallback(() => {
    dispatch(fetchTPZones());
    dispatch(fetchTPPricing());
  }, [dispatch]);

  // Zone handlers
  const handleSaveZone = useCallback(async (form) => {
    if (editingZone?._id) {
      const res = await dispatch(updateTPZone({ zoneId: editingZone._id, data: form }));
      if (updateTPZone.fulfilled.match(res)) { setShowZoneForm(false); setEditingZone(null); }
    } else {
      const res = await dispatch(addTPZone(form));
      if (addTPZone.fulfilled.match(res)) { setShowZoneForm(false); }
    }
  }, [dispatch, editingZone]);

  const handleDeleteZone = useCallback(async () => {
    if (!deleteZoneId) return;
    await dispatch(removeTPZone(deleteZoneId));
    setDeleteZoneId(null);
  }, [dispatch, deleteZoneId]);

  const handleToggleActive = useCallback(async (zone) => {
    await dispatch(updateTPZone({ zoneId: zone._id, data: { ...zone, isActive: !zone.isActive } }));
  }, [dispatch]);

  // Pricing handler
  const handleSavePricing = useCallback(async (form) => {
    await dispatch(updateTPPricing(form));
  }, [dispatch]);

  const activeZones   = zones.filter(z => z.isActive).length;
  const inactiveZones = zones.length - activeZones;

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* ── Page Header ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1" aria-label="Breadcrumb">
              <span>Fleet</span>
              <ChevronRight size={11} />
              <span className="text-slate-600 font-semibold">Pricing & Zones</span>
            </nav>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">Pricing & Service Zones</h1>
            <p className="text-sm text-slate-400 mt-0.5">Configure your fare structure and coverage areas</p>
          </div>
          <button onClick={refresh} aria-label="Refresh"
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: 'Total Zones',   value: zones.length,   cls: 'text-slate-700 bg-slate-50 border-slate-200'     },
            { label: 'Active',        value: activeZones,    cls: 'text-teal-700 bg-teal-50 border-teal-200'         },
            { label: 'Inactive',      value: inactiveZones,  cls: 'text-amber-700 bg-amber-50 border-amber-200'      },
            { label: 'Pricing Set',   value: pricing ? '✓' : '—', cls: pricing ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-50 border-slate-200' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`${cls} border rounded-xl px-3 py-2 text-center min-w-[80px]`}>
              <p className={`text-lg font-black ${cls.split(' ')[0]}`}>{value}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${cls.split(' ')[0]} opacity-70`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id} role="tab" aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all
                ${tab === id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ── ZONES TAB ── */}
          {tab === 'zones' && (
            <motion.div key="zones" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>

              {/* Toolbar */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-slate-400">
                  {zones.length} zone{zones.length !== 1 ? 's' : ''} configured
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setEditingZone(null); setShowZoneForm(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors"
                >
                  <Plus size={14} /> Add Zone
                </motion.button>
              </div>

              {/* Empty state */}
              {zones.length === 0 && !loading && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Globe size={26} className="text-slate-300" />
                  </div>
                  <h2 className="text-base font-black text-slate-600 mb-1">No service zones yet</h2>
                  <p className="text-sm text-slate-400 mb-6">Add the cities you operate in to start accepting rides.</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setEditingZone(null); setShowZoneForm(true); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors"
                  >
                    <Plus size={14} /> Add Your First Zone
                  </motion.button>
                </div>
              )}

              {/* Loading skeletons */}
              {loading && zones.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-52 rounded-2xl bg-slate-200 animate-pulse" />)}
                </div>
              )}

              {/* Zone grid */}
              {zones.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {zones.map(zone => (
                      <ZoneCard
                        key={zone._id}
                        zone={zone}
                        loading={loading}
                        onEdit={z => { setEditingZone(z); setShowZoneForm(true); }}
                        onDelete={id => setDeleteZoneId(id)}
                        onToggleActive={handleToggleActive}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PRICING TAB ── */}
          {tab === 'pricing' && (
            <motion.div key="pricing" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="max-w-2xl">
              {loading && !pricing ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-slate-200 animate-pulse" />)}
                </div>
              ) : (
                <PricingPanel pricing={pricing} loading={loading} onSave={handleSavePricing} />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Zone Form Modal ── */}
      <AnimatePresence>
        {showZoneForm && (
          <ZoneForm
            zone={editingZone}
            onSave={handleSaveZone}
            onClose={() => { setShowZoneForm(false); setEditingZone(null); }}
            loading={loading}
          />
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteZoneId && (
          <DeleteConfirm
            onConfirm={handleDeleteZone}
            onClose={() => setDeleteZoneId(null)}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}