'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Trash2, Edit3, Save, X,
  Loader2, Search, ZoomIn, ZoomOut,
  DollarSign, Clock, TrendingUp,
  SlidersHorizontal, Target, Radio, Compass,
  IndianRupee, Timer, RefreshCw,
  Info,
} from 'lucide-react';
import {
  fetchTPZones, addTPZone, updateTPZone, removeTPZone,
  fetchTPPricing, updateTPPricing,
} from '@/store/slices/transportPartnerSlice';

// ─── Constants ──────────────────────────────────────────────────────────────

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

const VALID_TABS = ['zones', 'pricing'];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu and Kashmir','Ladakh','Puducherry',
];

const ZONE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
];

const DEFAULT_PRICING = {
  baseFare: 0,
  baseFarePerKm: 0,
  minimumFare: 500,
  waitingChargePerMin: 2,
  freeWaitingMinutes: 10,
  nightSurchargePercent: 20,
  wheelchairSurcharge: 100,
  currency: 'INR',
};

const DEFAULT_ZONE = {
  city: '',
  state: 'Andhra Pradesh',
  pinCodes: [],
  radiusKm: 15,
  isActive: true,
};

// ─── Google Maps Loader ──────────────────────────────────────────────────────

let mapsLoaded = false;
let mapsLoading = false;
const mapsCallbacks = [];

function loadGoogleMaps(cb) {
  if (mapsLoaded) return cb();
  mapsCallbacks.push(cb);
  if (mapsLoading) return;
  mapsLoading = true;
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places,geometry`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    mapsLoaded = true;
    mapsLoading = false;
    mapsCallbacks.forEach(fn => fn());
    mapsCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

// ─── Micro-components ────────────────────────────────────────────────────────

const Field = ({ label, hint, children, required, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const PricingInput = ({ label, value, onChange, prefix = '₹', suffix, hint }) => (
  <Field label={label} hint={hint}>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`input-field w-full text-sm font-mono ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  </Field>
);

const SaveBtn = ({ onClick, loading, label = 'Save Changes', small = false }) => (
  <motion.button
    onClick={onClick}
    disabled={loading}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    className={`btn-primary-cta flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${small ? 'text-[11px] px-4 py-2' : 'text-xs px-5 py-2.5'}`}
  >
    {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
    {label}
  </motion.button>
);

// ─── Zone Badge ───────────────────────────────────────────────────────────────

const ZoneBadge = ({ zone, index, isSelected, onClick, onEdit, onDelete }) => {
  const color = ZONE_COLORS[index % ZONE_COLORS.length];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 bg-white hover:shadow-md"
      style={isSelected ? {
        borderColor: color,
        background: `linear-gradient(135deg, ${color}10, ${color}05)`,
        boxShadow: `0 8px 24px ${color}20`,
      } : { borderColor: '#e2e8f0' }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${color}15`, border: `1.5px solid ${color}30` }}>
            <MapPin size={14} style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-black truncate" style={{ color }}>
                {zone.city || 'Unnamed Zone'}
              </p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                ${zone.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {zone.isActive ? '● ACTIVE' : '○ OFF'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{zone.state}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                <Target size={10} /> {zone.radiusKm} km radius
              </span>
              {zone.pinCodes?.length > 0 && (
                <span className="text-[10px] font-semibold text-slate-500">
                  · {zone.pinCodes.length} PIN{zone.pinCodes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Zone Form Modal ──────────────────────────────────────────────────────────

const ZoneFormModal = ({ zone, onSave, onClose, loading }) => {
  const [form, setForm] = useState(zone || DEFAULT_ZONE);
  const [pinInput, setPinInput] = useState('');
  const [citySearch, setCitySearch] = useState(form.city || '');
  const inputRef = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    loadGoogleMaps(() => {
      if (!inputRef.current || !window.google) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['(cities)'],
        componentRestrictions: { country: 'in' },
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        const cityComp = place.address_components?.find(c => c.types.includes('locality'));
        const stateComp = place.address_components?.find(c => c.types.includes('administrative_area_level_1'));
        if (cityComp) set('city', cityComp.long_name);
        if (stateComp) set('state', stateComp.long_name);
        setCitySearch(cityComp?.long_name || place.name);
      });
    });
  }, []);

  const addPin = () => {
    const pin = pinInput.trim();
    if (pin.length === 6 && /^\d+$/.test(pin) && !form.pinCodes.includes(pin)) {
      set('pinCodes', [...(form.pinCodes || []), pin]);
      setPinInput('');
    }
  };

  const removePin = (p) => set('pinCodes', form.pinCodes.filter(x => x !== p));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 10 }}
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <h3 className="text-base font-black text-slate-800">
              {zone?._id ? 'Edit Zone' : 'Add Service Zone'}
            </h3>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="City" required hint="Start typing — Google Places will suggest cities">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={citySearch}
                onChange={e => { setCitySearch(e.target.value); set('city', e.target.value); }}
                placeholder="Search city in India..."
                className="input-field w-full text-sm pl-8"
              />
            </div>
          </Field>

          <Field label="State" required>
            <select value={form.state} onChange={e => set('state', e.target.value)}
              className="input-field w-full text-sm">
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Service Radius" hint="How far from city center you operate">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600">{form.radiusKm} km</span>
                <span className="text-[10px] text-slate-400">Max 100 km</span>
              </div>
              <input
                type="range" min="1" max="100"
                value={form.radiusKm}
                onChange={e => set('radiusKm', Number(e.target.value))}
                className="w-full accent-blue-600 h-1.5 rounded-full"
              />
            </div>
          </Field>

          <Field label="PIN Codes" hint="Add specific PIN codes you serve (optional)">
            <div className="flex gap-2">
              <input
                type="text" maxLength={6}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && addPin()}
                placeholder="e.g. 520001"
                className="input-field flex-1 text-sm font-mono"
              />
              <button onClick={addPin}
                className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            {form.pinCodes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.pinCodes.map(p => (
                  <span key={p}
                    className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                    {p}
                    <button onClick={() => removePin(p)} className="hover:text-red-400 transition-colors">
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-700">Zone Active</p>
              <p className="text-[10px] text-slate-400">Enable to receive rides from this zone</p>
            </div>
            <button
              onClick={() => set('isActive', !form.isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-300
                ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <motion.span
                animate={{ x: form.isActive ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              />
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-white">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 transition-colors">
            Cancel
          </button>
          <SaveBtn
            onClick={() => onSave(form)}
            loading={loading}
            label={zone?._id ? 'Update Zone' : 'Add Zone'}
            small
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Google Map Component ────────────────────────────────────────────────────

const ZoneMap = ({ zones, selectedZoneId }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circlesRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    loadGoogleMaps(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 16.5062, lng: 80.6480 },
        zoom: 7,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
          { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#93c5fd' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
          { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
        ],
      });
      setMapReady(true);
    });
  }, []);

  useEffect(() => {
    if (!mapReady || !window.google || !mapInstanceRef.current) return;

    circlesRef.current.forEach(c => { if (c.setMap) c.setMap(null); });
    circlesRef.current = [];

    const geocoder = new window.google.maps.Geocoder();
    const bounds = new window.google.maps.LatLngBounds();
    let hasAny = false;

    zones.forEach((zone, idx) => {
      if (!zone.city) return;
      const color = ZONE_COLORS[idx % ZONE_COLORS.length];
      const isSelected = zone._id === selectedZoneId;

      geocoder.geocode({ address: `${zone.city}, ${zone.state}, India` }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) return;
        const loc = results[0].geometry.location;

        const circle = new window.google.maps.Circle({
          map: mapInstanceRef.current,
          center: loc,
          radius: zone.radiusKm * 1000,
          fillColor: color,
          fillOpacity: isSelected ? 0.15 : 0.06,
          strokeColor: color,
          strokeOpacity: isSelected ? 0.9 : 0.5,
          strokeWeight: isSelected ? 2.5 : 1.5,
          zIndex: isSelected ? 10 : 1,
        });

        const dot = new window.google.maps.Circle({
          map: mapInstanceRef.current,
          center: loc,
          radius: zone.radiusKm * 80,
          fillColor: color,
          fillOpacity: 0.8,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: 0,
          zIndex: isSelected ? 11 : 2,
        });

        circlesRef.current.push(circle, dot);
        bounds.extend(loc);
        hasAny = true;

        setTimeout(() => {
          if (hasAny && !bounds.isEmpty()) {
            mapInstanceRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
            const zoom = mapInstanceRef.current.getZoom();
            if (zoom > 13) mapInstanceRef.current.setZoom(13);
          }
        }, 300);
      });
    });

    if (selectedZoneId) {
      const sel = zones.find(z => z._id === selectedZoneId);
      if (sel?.city) {
        geocoder.geocode({ address: `${sel.city}, ${sel.state}, India` }, (results, status) => {
          if (status !== 'OK' || !results?.[0]) return;
          mapInstanceRef.current.panTo(results[0].geometry.location);
          mapInstanceRef.current.setZoom(11);
        });
      }
    }
  }, [zones, selectedZoneId, mapReady]);

  const handleZoom = (dir) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + dir);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 mt-3">Loading map…</p>
          </div>
        </div>
      )}

      {mapReady && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          {[
            { icon: ZoomIn,  action: () => handleZoom(1) },
            { icon: ZoomOut, action: () => handleZoom(-1) },
            { icon: Compass, action: () => { mapInstanceRef.current?.panTo({ lat: 16.5062, lng: 80.6480 }); mapInstanceRef.current?.setZoom(7); } },
          ].map(({ icon: Icon, action }, i) => (
            <button key={i} onClick={action}
              className="w-8 h-8 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-slate-500 hover:text-slate-800 border border-slate-200 shadow-sm transition-all hover:scale-110">
              <Icon size={14} />
            </button>
          ))}
        </div>
      )}

      {mapReady && zones.length > 0 && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/90 backdrop-blur border border-slate-200 shadow-sm text-slate-600">
          <Radio size={11} className="text-emerald-500" />
          {zones.filter(z => z.isActive).length} Active · {zones.length} Total
        </div>
      )}

      {mapReady && zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center px-6">
            <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Add service zones to see them on the map</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Platform Fee Info Banner ─────────────────────────────────────────────────

const PlatformFeeInfo = ({ effectivePlatformFee, platformFeeOverride }) => {
  if (!effectivePlatformFee) return null;
  const isOverridden = platformFeeOverride !== null && platformFeeOverride !== undefined;
  const feeLabel = effectivePlatformFee.type === 'percentage'
    ? `${effectivePlatformFee.value}%`
    : `₹${effectivePlatformFee.value}`;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
      <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-blue-800">
          Platform Fee: <span className="text-blue-600">{feeLabel}</span>
          {isOverridden && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">Custom</span>}
        </p>
        <p className="text-[10px] text-blue-600 mt-0.5">
          {isOverridden
            ? 'A custom platform fee override is applied to your account.'
            : `Default platform fee applies (${effectivePlatformFee.type}).`}
        </p>
      </div>
    </div>
  );
};

// ─── Pricing Panel ────────────────────────────────────────────────────────────

const PricingPanel = ({ pricingData, onSave, loading }) => {
  // pricingData shape from API: { pricing: {...}, platformFeeOverride, effectivePlatformFee }
  const pricing = pricingData?.pricing || {};
  const [form, setForm] = useState({ ...DEFAULT_PRICING, ...pricing });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (pricing) setForm({ ...DEFAULT_PRICING, ...pricing });
  }, [JSON.stringify(pricing)]);

  const previewFare = () => {
    const dist = 8;
    const base = (form.baseFare || 0) + dist * (form.baseFarePerKm || 0);
    return Math.max(form.minimumFare || 0, base).toFixed(0);
  };

  const PRICING_GROUPS = [
    {
      group: 'Base Fares',
      icon: IndianRupee,
      color: '#3b82f6',
      bg: '#eff6ff',
      border: '#bfdbfe',
      fields: [
        { key: 'minimumFare',   label: 'Minimum Fare',  prefix: '₹', hint: 'Lowest amount charged per ride' },
        { key: 'baseFare',      label: 'Base Fare',     prefix: '₹', hint: 'Fixed amount added to every ride' },
        { key: 'baseFarePerKm', label: 'Per KM Rate',   prefix: '₹', suffix: '/km' },
      ],
    },
    {
      group: 'Waiting Charges',
      icon: Timer,
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
      fields: [
        { key: 'freeWaitingMinutes',  label: 'Free Waiting', prefix: '', suffix: 'min', hint: 'Minutes before charging begins' },
        { key: 'waitingChargePerMin', label: 'Waiting Rate',  prefix: '₹', suffix: '/min' },
      ],
    },
    {
      group: 'Surcharges',
      icon: TrendingUp,
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fecaca',
      fields: [
        { key: 'nightSurchargePercent', label: 'Night Surcharge',   prefix: '', suffix: '%', hint: '10 PM – 6 AM premium' },
        { key: 'wheelchairSurcharge',   label: 'Wheelchair Add-on', prefix: '₹', hint: 'Extra for accessible vehicles' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Platform Fee Info */}
      {pricingData && (
        <PlatformFeeInfo
          effectivePlatformFee={pricingData.effectivePlatformFee}
          platformFeeOverride={pricingData.platformFeeOverride}
        />
      )}

      {/* Fare preview */}
      <div className="relative overflow-hidden rounded-2xl p-5 border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-100 opacity-40"
          style={{ transform: 'translate(30%, -30%)' }} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Sample Fare Preview</p>
            <p className="text-[10px] text-blue-400">8 km trip · no waiting</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-blue-700">₹{previewFare()}</p>
            <p className="text-[10px] text-blue-400 mt-0.5">estimated</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-blue-100 flex flex-wrap gap-x-4 gap-y-1">
          {[
            { label: 'Base',  value: `₹${form.baseFare || 0}` },
            { label: '8 km', value: `₹${(8 * (form.baseFarePerKm || 0)).toFixed(0)}` },
            { label: 'Min',  value: `₹${form.minimumFare || 0}` },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <span className="text-[9px] text-blue-400 font-semibold">{item.label}</span>
              <span className="text-[10px] font-bold font-mono text-blue-600">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing groups */}
      {PRICING_GROUPS.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.group} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b"
              style={{ background: group.bg, borderColor: group.border }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${group.color}20`, border: `1px solid ${group.color}30` }}>
                <GroupIcon size={14} style={{ color: group.color }} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: group.color }}>
                {group.group}
              </h4>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.fields.map(f => (
                <PricingInput
                  key={f.key}
                  label={f.label}
                  value={form[f.key] ?? 0}
                  onChange={v => set(f.key, v)}
                  prefix={f.prefix}
                  suffix={f.suffix}
                  hint={f.hint}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end">
        <SaveBtn onClick={() => onSave(form)} loading={loading} label="Save Pricing" />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE  — /transport-partner/[tab]
// ═════════════════════════════════════════════════════════════════════════════

export default function ServiceZonesPricing() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useParams();

  // Derive active tab from URL param; default to 'zones'
  const rawTab = params?.tab;
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : 'zones';

  const { zones = [], pricing, loading } = useSelector(s => s.transportPartner);

  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    dispatch(fetchTPZones());
    dispatch(fetchTPPricing());
  }, [dispatch]);

  // Navigate to tab
  const gotoTab = (tab) => {
    router.push(`/transport-partner/${tab}`);
  };

  // Zone operations
  const handleSaveZone = async (form) => {
    if (editingZone?._id) {
      await dispatch(updateTPZone({ zoneId: editingZone._id, data: form }));
    } else {
      await dispatch(addTPZone(form));
    }
    setShowModal(false);
    setEditingZone(null);
  };

  const handleDeleteZone = async (zoneId) => {
    await dispatch(removeTPZone(zoneId));
    setDeleteConfirm(null);
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
  };

  // pricing from API: { pricing: {...}, platformFeeOverride, effectivePlatformFee }
  const handleSavePricing = (form) => dispatch(updateTPPricing(form));

  const activeZones = zones.filter(z => z.isActive);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <div className="px-4 sm:px-6 pt-6 pb-4 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              Zones & Pricing
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Define where you operate and how you charge
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            {[
              { label: 'Active Zones', value: activeZones.length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Total Zones',  value: zones.length,       color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} ${stat.border} border rounded-xl px-3 py-2 text-center`}>
                <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${stat.color} opacity-70`}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mt-4 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          {[
            { key: 'zones',   label: 'Service Zones',  icon: MapPin           },
            { key: 'pricing', label: 'Pricing Config',  icon: SlidersHorizontal },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => gotoTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200
                  ${isActive
                    ? 'text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="tabBg"
                    className="absolute inset-0 rounded-lg bg-blue-600"
                    style={{ boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon size={15} className="relative z-10 flex-shrink-0" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ── ZONES TAB ── */}
          {activeTab === 'zones' && (
            <motion.div
              key="zones"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4"
            >
              {/* Left: Zone list */}
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setEditingZone(null); setShowModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200
                    text-sm font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all"
                >
                  <Plus size={16} />
                  Add Service Zone
                </motion.button>

                {loading && zones.length === 0 ? (
                  Array(2).fill(0).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-slate-200 animate-pulse" />
                  ))
                ) : zones.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
                    <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No zones yet</p>
                    <p className="text-xs text-slate-300 mt-1">Add your first service zone above</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {zones.map((zone, idx) => (
                      <ZoneBadge
                        key={zone._id}
                        zone={zone}
                        index={idx}
                        isSelected={selectedZoneId === zone._id}
                        onClick={() => setSelectedZoneId(id => id === zone._id ? null : zone._id)}
                        onEdit={() => { setEditingZone(zone); setShowModal(true); }}
                        onDelete={() => setDeleteConfirm(zone._id)}
                      />
                    ))}
                  </AnimatePresence>
                )}

                {/* PIN summary */}
                {zones.some(z => z.pinCodes?.length > 0) && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PIN Code Coverage</p>
                    <div className="flex flex-wrap gap-1">
                      {zones.flatMap(z => z.pinCodes || []).map((pin, i) => (
                        <span key={i} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {pin}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Map */}
              <div className="relative h-[500px] lg:h-auto lg:min-h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                <ZoneMap zones={zones} selectedZoneId={selectedZoneId} />

                {zones.length > 0 && (
                  <div className="absolute top-3 left-3 space-y-1 max-w-[180px]">
                    {zones.slice(0, 6).map((zone, idx) => (
                      <div key={zone._id}
                        onClick={() => setSelectedZoneId(id => id === zone._id ? null : zone._id)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-105 bg-white/90 backdrop-blur"
                        style={{
                          border: `1px solid ${selectedZoneId === zone._id ? ZONE_COLORS[idx % ZONE_COLORS.length] : '#e2e8f0'}`,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: ZONE_COLORS[idx % ZONE_COLORS.length] }} />
                        <span className="text-[10px] font-bold text-slate-600 truncate">{zone.city}</span>
                        <span className="text-[9px] text-slate-400 ml-auto">{zone.radiusKm}km</span>
                      </div>
                    ))}
                    {zones.length > 6 && (
                      <div className="px-2.5 py-1 text-[9px] text-slate-400 bg-white/80 rounded-md border border-slate-200">
                        +{zones.length - 6} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── PRICING TAB ── */}
          {activeTab === 'pricing' && (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {loading && !pricing ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-40 rounded-2xl bg-slate-200 animate-pulse" />
                  ))}
                </div>
              ) : (
                <PricingPanel
                  pricingData={pricing}
                  onSave={handleSavePricing}
                  loading={loading}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Zone Form Modal ── */}
      <AnimatePresence>
        {showModal && (
          <ZoneFormModal
            zone={editingZone}
            onSave={handleSaveZone}
            onClose={() => { setShowModal(false); setEditingZone(null); }}
            loading={loading}
          />
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-slate-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <h3 className="text-base font-black text-slate-800">Remove Zone?</h3>
              <p className="text-xs text-slate-400 mt-2 mb-5">
                This zone will be permanently removed and no longer appear on the map or accept rides.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteZone(deleteConfirm)}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-60"
                >
                  {loading ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}