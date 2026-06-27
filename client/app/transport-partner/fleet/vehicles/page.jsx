'use client';

/**
 * VehiclesManagement.jsx — Likeson.in
 * Transport Partner Fleet Management
 * Font: Poppins (via next/font or global CSS import)
 * All bugs fixed. Aligned to transportPartnerSlice.js.
 * v2: Fixed assignedDriver object vs string ID bug.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car, Plus, Trash2, Edit3, Save, X,
  Loader2, Check, AlertTriangle, Search, Upload,
  Camera, FileText, Shield, Zap, Settings,
  CheckCircle2, Clock, XCircle, Eye,
  Link2, RefreshCw,
  Users, ChevronRight,
  Accessibility, Activity,
  UserCheck, UserX, Package, ExternalLink,
  Grid3X3, List, CheckSquare, Square,
} from 'lucide-react';
import {
  fetchTPVehicles,
  addTPVehicle,
  updateTPVehicle,
  deleteTPVehicle,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
  addTPVehiclePhotos,
  fetchTPDrivers,
} from '@/store/slices/transportPartnerSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { value: 'Bike',            label: 'Bike',           icon: '🏍️', category: 'Two-Wheeler'   },
  { value: 'Scooter',         label: 'Scooter',        icon: '🛵',  category: 'Two-Wheeler'   },
  { value: 'Auto',            label: 'Auto',           icon: '🛺',  category: 'Three-Wheeler' },
  { value: 'E-Rickshaw',      label: 'E-Rickshaw',     icon: '🛺',  category: 'Three-Wheeler' },
  { value: 'Hatchback',       label: 'Hatchback',      icon: '🚗',  category: 'Four-Wheeler'  },
  { value: 'Sedan',           label: 'Sedan',          icon: '🚙',  category: 'Four-Wheeler'  },
  { value: 'SUV',             label: 'SUV',            icon: '🚙',  category: 'Four-Wheeler'  },
  { value: 'MUV',             label: 'MUV',            icon: '🚙',  category: 'Four-Wheeler'  },
  { value: 'Crossover',       label: 'Crossover',      icon: '🚙',  category: 'Four-Wheeler'  },
  { value: 'Van',             label: 'Van',            icon: '🚐',  category: 'Van/Minibus'   },
  { value: 'Minivan',         label: 'Minivan',        icon: '🚐',  category: 'Van/Minibus'   },
  { value: 'Tempo-Traveller', label: 'Tempo Traveller',icon: '🚌',  category: 'Van/Minibus'   },
  { value: 'Minibus',         label: 'Minibus',        icon: '🚌',  category: 'Van/Minibus'   },
  { value: 'Wheelchair-Van',  label: 'Wheelchair Van', icon: '♿',  category: 'Specialised'   },
  { value: 'Mortuary-Van',    label: 'Mortuary Van',   icon: '🚑',  category: 'Specialised'   },
  { value: 'Bus',             label: 'Bus',            icon: '🚌',  category: 'Heavy'         },
  { value: 'Truck',           label: 'Truck',          icon: '🚚',  category: 'Heavy'         },
  { value: 'Pickup',          label: 'Pickup',         icon: '🛻',  category: 'Heavy'         },
];

const VT_CATEGORIES = [...new Set(VEHICLE_TYPES.map((v) => v.category))];

const PERMIT_TYPES = ['Commercial', 'Tourist', 'Private', 'Contract Carriage'];

const STATUS_CONFIG = {
  pending:        { label: 'Pending',      color: '#d97706', bg: '#fef3c7', border: '#fde68a', Icon: Clock        },
  'under-review': { label: 'Under Review', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', Icon: Eye          },
  verified:       { label: 'Verified',     color: '#059669', bg: '#d1fae5', border: '#a7f3d0', Icon: CheckCircle2 },
  rejected:       { label: 'Rejected',     color: '#dc2626', bg: '#fee2e2', border: '#fecaca', Icon: XCircle      },
};

const VEHICLE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
];

const DEFAULT_VEHICLE = {
  registrationNumber: '', make: '', model: '',
  year: new Date().getFullYear(), color: '',
  vehicleType: 'Sedan', seatingCapacity: 4,
  isWheelchairAccessible: false, hasStretcherSupport: false,
  hasOxygenSupport: false, hasMedicalKit: false, hasAC: true,
  rcBookUrl: '', insurancePolicyUrl: '', insuranceExpiry: '',
  pollutionCertUrl: '', pollutionCertExpiry: '', fitnessCertUrl: '',
  fitnessCertExpiry: '', permitType: 'Commercial', permitExpiry: '',
  gpsDeviceId: '', photos: [], isActive: true,
};

const FORM_SECTIONS = [
  { id: 'basics',   label: 'Basic Info',  Icon: Car      },
  { id: 'features', label: 'Features',    Icon: Settings },
  { id: 'docs',     label: 'Documents',   Icon: FileText },
  { id: 'photos',   label: 'Photos',      Icon: Camera   },
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isExpired = (d) => !!d && new Date(d) < new Date();
const isSoon    = (d) => !!d && !isExpired(d) && new Date(d) < new Date(Date.now() + 30 * 864e5);

const vtOf  = (type) => VEHICLE_TYPES.find((v) => v.value === type);
const cfgOf = (status) => STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

// FIX: assignedDriver is an object {_id, legalName, driverCode, ...} from API.
// Use this helper everywhere instead of direct comparison.
const assignedDriverId = (vehicle) => vehicle.assignedDriver?._id ?? vehicle.assignedDriver ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Labelled form field with optional note */
const Field = ({ label, note, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {note && (
      <p className="text-[10px] text-slate-400 leading-snug mt-0.5 pl-0.5">
        💡 {note}
      </p>
    )}
  </div>
);

/** Styled text / number / url input */
const Input = ({ mono, className = '', ...props }) => (
  <input
    {...props}
    className={`w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm
      bg-white text-slate-800 placeholder-slate-300
      focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400
      transition-all ${mono ? 'font-mono tracking-wide' : ''} ${className}`}
  />
);

/** Status badge */
const StatusBadge = ({ status }) => {
  const { Icon, label, color, bg, border } = cfgOf(status);
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      <Icon size={9} />{label}
    </span>
  );
};

/** Feature toggle pill */
const Toggle = ({ label, note, value, onChange, Icon: Ico, color = '#3b82f6' }) => (
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
        {note && <p className="text-[10px] text-slate-400 mt-0.5">💡 {note}</p>}
      </div>
    </div>
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-300 ${value ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${value ? 'left-6' : 'left-1'}`}
      />
    </button>
  </div>
);

/** Date input with expiry warning */
const DateInput = ({ value, onChange, className = '' }) => {
  const expired = isExpired(value);
  const soon    = isSoon(value);
  return (
    <div>
      <Input
        type="date"
        value={value ? value.slice(0, 10) : ''}
        onChange={onChange}
        className={`${expired ? 'border-red-300 bg-red-50' : soon ? 'border-amber-300 bg-amber-50' : ''} ${className}`}
      />
      {expired && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ This document has expired!</p>}
      {soon    && <p className="text-[10px] text-amber-500 font-semibold mt-1">⏰ Expiring within 30 days</p>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD OR LINK
// ─────────────────────────────────────────────────────────────────────────────

const UploadOrLink = ({ label, note, value, onChange, folder, accept = '*/*' }) => {
  const dispatch   = useDispatch();
  const uploading  = useSelector((s) => s.upload?.isUploading ?? false);
  const [mode, setMode] = useState('link');
  const fileRef    = useRef(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { uploadSingleFile } = await import('@/store/slices/uploadSlice');
      const res = await dispatch(uploadSingleFile({ file, folder: folder || 'vehicles' }));
      if (uploadSingleFile.fulfilled.match(res)) {
        onChange(res.payload?.url || res.payload?.data?.url || '');
      }
    } catch {
      // uploadSlice may not exist — silently no-op
    }
  }, [dispatch, folder, onChange]);

  return (
    <Field label={label} note={note}>
      <div className="flex gap-1 mb-1.5">
        {['link', 'upload'].map((m) => (
          <button
            key={m} type="button" onClick={() => setMode(m)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all inline-flex items-center gap-1
              ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {m === 'link' ? <Link2 size={10} /> : <Upload size={10} />}
            {m === 'link' ? 'Paste URL' : 'Upload File'}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <div className="relative">
          <Link2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input type="url" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className="pl-8" />
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2 text-xs text-blue-500 font-semibold">
              <Loader2 size={14} className="animate-spin" /> Uploading…
            </span>
          ) : value ? (
            <span className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-semibold">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="truncate max-w-[200px]">{value.split('/').pop()}</span>
            </span>
          ) : (
            <>
              <Upload size={18} className="mx-auto text-slate-300 mb-1" />
              <p className="text-xs text-slate-400">Click to browse or drag & drop</p>
            </>
          )}
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
        </div>
      )}

      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-1">
          <ExternalLink size={10} /> Preview document
        </a>
      )}
    </Field>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO STRIP
// ─────────────────────────────────────────────────────────────────────────────

const PhotoStrip = ({ photos, onAdd, onRemove }) => {
  const dispatch   = useDispatch();
  const uploading  = useSelector((s) => s.upload?.isUploading ?? false);
  const [urlInput, setUrlInput] = useState('');
  const fileRef    = useRef(null);

  const handleAddUrl = () => {
    const u = urlInput.trim();
    if (u) { onAdd(u); setUrlInput(''); }
  };

  const handleFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const { uploadMultipleFiles } = await import('@/store/slices/uploadSlice');
      const res = await dispatch(uploadMultipleFiles({ files, folder: 'vehicle-photos' }));
      if (uploadMultipleFiles.fulfilled.match(res)) {
        (res.payload?.data || []).forEach((f) => onAdd(f.url));
      }
    } catch { /* uploadSlice optional */ }
  }, [dispatch, onAdd]);

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Vehicle Photos
        <span className="ml-1 text-slate-300 normal-case tracking-normal font-normal">
          — high-quality exterior & interior shots help with customer trust
        </span>
      </p>

      <div className="flex gap-2">
        <Input
          type="url" value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
          placeholder="Paste image URL and press Enter…"
          className="flex-1"
        />
        <button type="button" onClick={handleAddUrl}
          className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          Upload
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} />
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/40">
                  <ExternalLink size={11} />
                </a>
                <button type="button" onClick={() => onRemove(i)}
                  className="w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500">
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs">
          No photos yet — add at least 2 photos for better visibility
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE TYPE PICKER
// ─────────────────────────────────────────────────────────────────────────────

const VehicleTypePicker = ({ value, onChange }) => (
  <div className="space-y-2.5">
    {VT_CATEGORIES.map((cat) => (
      <div key={cat}>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 mb-1.5">{cat}</p>
        <div className="flex flex-wrap gap-1.5">
          {VEHICLE_TYPES.filter((v) => v.category === cat).map((vt) => (
            <button
              key={vt.value} type="button" onClick={() => onChange(vt.value)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${value === vt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}
            >
              <span>{vt.icon}</span>{vt.label}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const VehicleForm = ({ vehicle, onSave, onClose, loading, openTab }) => {
  const [form, setForm] = useState({ ...DEFAULT_VEHICLE, ...(vehicle ?? {}) });
  const [section, setSection] = useState(openTab ?? 'basics');

  useEffect(() => { if (openTab) setSection(openTab); }, [openTab]);

  const set = useCallback((k, v) => setForm((p) => ({ ...p, [k]: v })), []);

  const addPhoto    = useCallback((url) => set('photos', [...(form.photos ?? []), url]), [form.photos, set]);
  const removePhoto = useCallback((i) => set('photos', (form.photos ?? []).filter((_, idx) => idx !== i)), [form.photos, set]);

  const isValid = form.registrationNumber?.trim() && form.make?.trim() && form.model?.trim();

  const handleSave = () => { if (isValid) onSave(form); };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 10 }}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Car size={17} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                {vehicle?._id ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h3>
              {vehicle?.registrationNumber && (
                <p className="text-[10px] text-slate-400 font-mono">{vehicle.registrationNumber}</p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          {FORM_SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id} onClick={() => setSection(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${section === id ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {section === 'basics' && (
            <motion.div key="basics" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">

              <Field label="Registration Number" required
                note="Enter as shown on the RC Book (e.g. AP09AB1234). Will be auto-uppercased.">
                <Input
                  value={form.registrationNumber}
                  onChange={(e) => set('registrationNumber', e.target.value.toUpperCase())}
                  placeholder="AP09AB1234" mono
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Make / Brand" required note="Vehicle manufacturer (e.g. Toyota, Maruti).">
                  <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Toyota" />
                </Field>
                <Field label="Model" required note="Specific model name (e.g. Innova Crysta).">
                  <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Innova Crysta" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Year of Manufacture" note="Year printed on RC. Used for age verification.">
                  <Input
                    type="number" value={form.year}
                    min="1990" max={new Date().getFullYear() + 1}
                    onChange={(e) => set('year', Number(e.target.value))}
                    mono
                  />
                </Field>
                <Field label="Colour" note="Primary body colour as on RC (e.g. Pearl White).">
                  <Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Pearl White" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Seating Capacity" note="Total seats including driver. Used for trip matching.">
                  <Input
                    type="number" value={form.seatingCapacity}
                    min="1" max="60"
                    onChange={(e) => set('seatingCapacity', Number(e.target.value))}
                    mono
                  />
                </Field>
                <Field label="GPS Device ID" note="Optional — tracker unit serial no. for live tracking.">
                  <Input
                    value={form.gpsDeviceId}
                    onChange={(e) => set('gpsDeviceId', e.target.value)}
                    placeholder="GPS-12345" mono
                  />
                </Field>
              </div>

              <Field label="Vehicle Type" required note="Select the closest category. Affects ride matching & pricing.">
                <VehicleTypePicker value={form.vehicleType} onChange={(v) => set('vehicleType', v)} />
              </Field>

              <Toggle
                label="Mark as Active" Icon={Activity} color="#10b981"
                note="Active vehicles appear in dispatch. Deactivate if vehicle is in service or unavailable."
                value={form.isActive} onChange={(v) => set('isActive', v)}
              />
            </motion.div>
          )}

          {section === 'features' && (
            <motion.div key="features" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amenities & Equipment</p>
              <p className="text-[11px] text-slate-400">
                💡 These are shown to customers during booking. Enable only features that are genuinely available.
              </p>

              <div className="space-y-2">
                <Toggle label="Air Conditioning" Icon={Zap} color="#3b82f6"
                  note="Vehicle has working factory or aftermarket AC."
                  value={form.hasAC} onChange={(v) => set('hasAC', v)} />
                <Toggle label="Wheelchair Accessible" Icon={Accessibility} color="#8b5cf6"
                  note="Has ramp, lift, or wide-door modification for wheelchair users."
                  value={form.isWheelchairAccessible} onChange={(v) => set('isWheelchairAccessible', v)} />
                <Toggle label="Stretcher Support" Icon={Activity} color="#ef4444"
                  note="Interior configured to accommodate a standard medical stretcher."
                  value={form.hasStretcherSupport} onChange={(v) => set('hasStretcherSupport', v)} />
                <Toggle label="Oxygen Support" Icon={Package} color="#10b981"
                  note="Oxygen cylinder and flow meter permanently installed."
                  value={form.hasOxygenSupport} onChange={(v) => set('hasOxygenSupport', v)} />
                <Toggle label="Medical Kit" Icon={Shield} color="#f59e0b"
                  note="Certified first-aid and emergency medical kit onboard."
                  value={form.hasMedicalKit} onChange={(v) => set('hasMedicalKit', v)} />
              </div>

              <div className="pt-3 space-y-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Permit</p>

                <Field label="Permit Type" note="Select the permit category as issued by the RTO.">
                  <div className="flex flex-wrap gap-1.5">
                    {PERMIT_TYPES.map((pt) => (
                      <button key={pt} type="button" onClick={() => set('permitType', pt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                          ${form.permitType === pt
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                        {pt}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Permit Expiry Date" note="Date printed on the permit certificate. Alerts shown 30 days before expiry.">
                  <DateInput value={form.permitExpiry} onChange={(e) => set('permitExpiry', e.target.value)} />
                </Field>
              </div>
            </motion.div>
          )}

          {section === 'docs' && (
            <motion.div key="docs" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-600">
                💡 Upload clear scans or photos. All documents are required for admin verification before the vehicle goes live.
              </div>

              <UploadOrLink label="RC Book" value={form.rcBookUrl} onChange={(v) => set('rcBookUrl', v)}
                folder="vehicle-docs" accept=".pdf,.jpg,.jpeg,.png"
                note="Registration Certificate — front page clearly showing reg. number, owner, and class of vehicle." />

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <UploadOrLink label="Insurance Policy Document" value={form.insurancePolicyUrl}
                  onChange={(v) => set('insurancePolicyUrl', v)} folder="vehicle-docs" accept=".pdf,.jpg,.jpeg,.png"
                  note="Commercial vehicle insurance certificate. Third-party minimum required." />
                <Field label="Insurance Expiry Date" note="Date of expiry as printed on the insurance document.">
                  <DateInput value={form.insuranceExpiry} onChange={(e) => set('insuranceExpiry', e.target.value)} />
                </Field>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <UploadOrLink label="Pollution Under Control (PUC) Certificate" value={form.pollutionCertUrl}
                  onChange={(v) => set('pollutionCertUrl', v)} folder="vehicle-docs"
                  note="Valid PUC certificate from authorised emission testing centre." />
                <Field label="PUC Expiry Date" note="Usually valid for 3–12 months. Renew before expiry to avoid suspension.">
                  <DateInput value={form.pollutionCertExpiry} onChange={(e) => set('pollutionCertExpiry', e.target.value)} />
                </Field>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <UploadOrLink label="Fitness Certificate" value={form.fitnessCertUrl}
                  onChange={(v) => set('fitnessCertUrl', v)} folder="vehicle-docs"
                  note="Issued by RTO after vehicle inspection. Required for commercial vehicles." />
                <Field label="Fitness Certificate Expiry" note="Valid for 1–2 years depending on vehicle age.">
                  <DateInput value={form.fitnessCertExpiry} onChange={(e) => set('fitnessCertExpiry', e.target.value)} />
                </Field>
              </div>
            </motion.div>
          )}

          {section === 'photos' && (
            <motion.div key="photos" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <PhotoStrip
                photos={form.photos ?? []}
                onAdd={addPhoto}
                onRemove={removePhoto}
              />
            </motion.div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          {!isValid && (
            <p className="text-[10px] text-red-400 font-semibold">Reg. No., Make and Model are required.</p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 transition-colors">
              Cancel
            </button>
            <motion.button
              onClick={handleSave}
              disabled={loading || !isValid}
              whileHover={{ scale: isValid ? 1.02 : 1 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {vehicle?._id ? 'Update Vehicle' : 'Add Vehicle'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN DRIVER MODAL
// ─────────────────────────────────────────────────────────────────────────────

const AssignDriverModal = ({ vehicle, drivers, onAssign, onUnassign, onClose, loading }) => {
  const [search, setSearch] = useState('');

  // FIX: assignedDriver is object — extract _id for comparison
  const currentDriverId = assignedDriverId(vehicle);

  const filtered = useMemo(() => drivers.filter((d) =>
    d.legalName?.toLowerCase().includes(search.toLowerCase()) ||
    d.driverCode?.toLowerCase().includes(search.toLowerCase())
  ), [drivers, search]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200"
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <UserCheck size={15} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Assign Driver</h3>
              <p className="text-[10px] text-slate-400 font-mono">{vehicle.registrationNumber}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        </div>

        {/* FIX: check currentDriverId (not raw object) for banner */}
        {currentDriverId && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={13} className="text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Driver currently assigned</p>
                {/* Show name from object if available */}
                {vehicle.assignedDriver?.legalName && (
                  <p className="text-[10px] text-amber-500">{vehicle.assignedDriver.legalName}</p>
                )}
              </div>
            </div>
            <button onClick={onUnassign} disabled={loading}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50">
              <UserX size={10} /> Unassign
            </button>
          </div>
        )}

        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or driver code…" className="pl-8" />
          </div>

          <p className="text-[10px] text-slate-400">
            💡 Only drivers belonging to your agency are listed. Assign one driver per vehicle.
          </p>

          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <Users size={22} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">No drivers found</p>
              </div>
            ) : filtered.map((driver) => (
              <motion.div
                key={driver._id}
                whileHover={{ x: 2 }}
                onClick={() => !loading && onAssign(driver._id)}
                // FIX: compare driver._id against extracted currentDriverId (string), not raw object
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                  ${currentDriverId === driver._id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-200'}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && !loading && onAssign(driver._id)}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-black flex-shrink-0">
                  {driver.legalName?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{driver.legalName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-mono text-slate-400">{driver.driverCode}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                      ${driver.status === 'Available' ? 'bg-emerald-100 text-emerald-600'
                        : driver.status === 'On-Trip' ? 'bg-blue-100 text-blue-600'
                        : 'bg-slate-100 text-slate-400'}`}>
                      {driver.status}
                    </span>
                  </div>
                </div>
                {/* FIX: use currentDriverId for checkmark */}
                {currentDriverId === driver._id && (
                  <CheckCircle2 size={15} className="text-blue-500 flex-shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE CARD
// ─────────────────────────────────────────────────────────────────────────────

const VehicleCard = ({
  vehicle, index, onEdit, onDelete, onAssignDriver, onViewDetail, isSelected, onSelect,
}) => {
  const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];
  const vt    = vtOf(vehicle.vehicleType);

  const hasExpired = [
    vehicle.insuranceExpiry, vehicle.pollutionCertExpiry,
    vehicle.fitnessCertExpiry, vehicle.permitExpiry,
  ].some(isExpired);

  const expiringSoon = !hasExpired && [
    vehicle.insuranceExpiry, vehicle.pollutionCertExpiry,
    vehicle.fitnessCertExpiry, vehicle.permitExpiry,
  ].some(isSoon);

  // FIX: assignedDriver is object — truthy check works but show name from object
  const driverName = vehicle.assignedDriver?.legalName ?? null;
  const hasDriver  = !!assignedDriverId(vehicle);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-white rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{ borderColor: isSelected ? color : '#e2e8f0', fontFamily: 'Poppins, sans-serif' }}
      onClick={onViewDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewDetail()}
      aria-label={`Vehicle ${vehicle.registrationNumber}`}
    >
      <div className="h-1" style={{ background: color }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              aria-label="Select vehicle"
              className="mt-1 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
              style={{ borderColor: isSelected ? color : '#d1d5db', background: isSelected ? color : 'transparent' }}
            >
              {isSelected && <Check size={9} className="text-white" />}
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: `${color}14`, border: `1.5px solid ${color}28` }}>
              {vt?.icon ?? '🚗'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800 font-mono tracking-wide truncate">
                {vehicle.registrationNumber}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {vehicle.make} {vehicle.model} · {vehicle.year}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <StatusBadge status={vehicle.verificationStatus} />
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
              ${vehicle.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {vehicle.isActive ? '● ACTIVE' : '○ OFF'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
            {vt?.icon} {vehicle.vehicleType}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
            <Users size={9} /> {vehicle.seatingCapacity} seats
          </span>
          {vehicle.hasAC && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">
              <Zap size={9} /> AC
            </span>
          )}
          {vehicle.isWheelchairAccessible && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-500 bg-purple-50 px-2 py-1 rounded-lg">
              <Accessibility size={9} /> Accessible
            </span>
          )}
          {hasExpired && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
              <AlertTriangle size={9} /> Doc Expired
            </span>
          )}
          {expiringSoon && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">
              <Clock size={9} /> Expiring Soon
            </span>
          )}
        </div>

        {/* FIX: show driver name from object */}
        {hasDriver ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100 mb-3">
            <UserCheck size={11} className="text-blue-500 flex-shrink-0" />
            <p className="text-[10px] font-semibold text-blue-600 truncate">
              {driverName ?? 'Driver Assigned'}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 mb-3">
            <UserX size={11} className="text-slate-300 flex-shrink-0" />
            <p className="text-[10px] text-slate-400">No driver assigned</p>
          </div>
        )}

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onEdit('basics'); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold transition-colors">
            <Edit3 size={10} /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); onAssignDriver(); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 text-[10px] font-bold transition-colors">
            <UserCheck size={10} /> Driver
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit('photos'); }}
            className="py-1.5 px-2.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors">
            <Camera size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="py-1.5 px-2.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </motion.article>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────

const VehicleDetail = ({ vehicle, drivers, onClose, onEdit }) => {
  const vt             = vtOf(vehicle.vehicleType);

  // FIX: assignedDriver is object — use _id to find from drivers list,
  // or fall back to the object itself if already populated
  const assignedDriver = useMemo(() => {
    const drvId = assignedDriverId(vehicle);
    if (!drvId) return null;
    // prefer full driver record from drivers list
    return drivers.find((d) => d._id === drvId) ?? vehicle.assignedDriver ?? null;
  }, [drivers, vehicle]);

  const DOC_ROWS = [
    { label: 'RC Book',       url: vehicle.rcBookUrl,          expiry: null                    },
    { label: 'Insurance',     url: vehicle.insurancePolicyUrl, expiry: vehicle.insuranceExpiry  },
    { label: 'PUC',           url: vehicle.pollutionCertUrl,   expiry: vehicle.pollutionCertExpiry },
    { label: 'Fitness Cert',  url: vehicle.fitnessCertUrl,     expiry: vehicle.fitnessCertExpiry   },
    { label: 'Permit',        url: null,                       expiry: vehicle.permitExpiry, type: vehicle.permitType },
  ];

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="fixed right-0 top-0 bottom-0 w-[400px] bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col overflow-hidden"
      style={{ fontFamily: 'Poppins, sans-serif' }}
      role="complementary"
      aria-label="Vehicle details"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden="true">{vt?.icon ?? '🚗'}</span>
          <div>
            <p className="text-sm font-black text-slate-800 font-mono">{vehicle.registrationNumber}</p>
            <p className="text-[10px] text-slate-400">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onEdit('basics')} aria-label="Edit vehicle"
            className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <Edit3 size={13} />
          </button>
          <button onClick={onClose} aria-label="Close details panel"
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={vehicle.verificationStatus} />
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full
            ${vehicle.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {vehicle.isActive ? '● Active' : '○ Inactive'}
          </span>
          {vehicle.vehicleCode && (
            <span className="text-[10px] font-mono text-slate-400">{vehicle.vehicleCode}</span>
          )}
        </div>

        {vehicle.photos?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Photos ({vehicle.photos.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {vehicle.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Specifications</p>
          {[
            { label: 'Type',    value: `${vt?.icon ?? ''} ${vehicle.vehicleType}` },
            { label: 'Seats',   value: `${vehicle.seatingCapacity}`              },
            { label: 'Colour',  value: vehicle.color    || '—'                   },
            { label: 'GPS ID',  value: vehicle.gpsDeviceId || '—'                },
            { label: 'Permit',  value: vehicle.permitType  || '—'                },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Features</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'AC',         value: vehicle.hasAC,                  Icon: Zap,          color: '#3b82f6' },
              { label: 'Wheelchair', value: vehicle.isWheelchairAccessible, Icon: Accessibility,color: '#8b5cf6' },
              { label: 'Stretcher',  value: vehicle.hasStretcherSupport,    Icon: Activity,     color: '#ef4444' },
              { label: 'O₂ Support', value: vehicle.hasOxygenSupport,       Icon: Package,      color: '#10b981' },
              { label: 'Medical Kit',value: vehicle.hasMedicalKit,          Icon: Shield,       color: '#f59e0b' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold
                  ${value ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                <Icon size={11} style={{ color: value ? color : '#94a3b8' }} aria-hidden="true" />
                {label}
                {value
                  ? <CheckCircle2 size={10} className="ml-auto text-green-500" />
                  : <X size={10} className="ml-auto" />}
              </div>
            ))}
          </div>
        </div>

        {/* FIX: assignedDriver now resolved from object or drivers list */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Assigned Driver</p>
          {assignedDriver ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="w-9 h-9 rounded-xl bg-blue-200 flex items-center justify-center text-blue-700 font-black text-sm flex-shrink-0">
                {assignedDriver.legalName?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-800 truncate">{assignedDriver.legalName}</p>
                <p className="text-[10px] text-blue-500 font-mono">{assignedDriver.driverCode}</p>
              </div>
              <span className={`ml-auto flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                ${assignedDriver.status === 'Available' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {assignedDriver.status}
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center">
              <UserX size={18} className="mx-auto text-slate-300 mb-1" aria-hidden="true" />
              <p className="text-xs text-slate-400">No driver assigned</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Documents</p>
          <div className="space-y-2">
            {DOC_ROWS.map((doc) => (
              <div key={doc.label}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs border
                  ${isExpired(doc.expiry) ? 'bg-red-50 border-red-200'
                    : isSoon(doc.expiry)   ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <p className="font-semibold text-slate-700">
                    {doc.label}{doc.type ? ` (${doc.type})` : ''}
                  </p>
                  {doc.expiry && (
                    <p className={`text-[10px] mt-0.5 font-semibold
                      ${isExpired(doc.expiry) ? 'text-red-500' : isSoon(doc.expiry) ? 'text-amber-500' : 'text-slate-400'}`}>
                      {isExpired(doc.expiry) ? '⚠️ Expired — ' : isSoon(doc.expiry) ? '⏰ Expiring — ' : '✓ '}
                      {fmtDate(doc.expiry)}
                    </p>
                  )}
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline flex-shrink-0">
                    <ExternalLink size={10} /> View
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-300">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────────────────

const StatsBar = ({ vehicles }) => {
  const stats = useMemo(() => {
    const total       = vehicles.length;
    const active      = vehicles.filter((v) => v.isActive).length;
    const verified    = vehicles.filter((v) => v.verificationStatus === 'verified').length;
    const pending     = vehicles.filter((v) => v.verificationStatus === 'pending').length;
    const expiredDocs = vehicles.filter((v) =>
      [v.insuranceExpiry, v.pollutionCertExpiry, v.fitnessCertExpiry].some(isExpired)
    ).length;
    return [
      { label: 'Total Fleet',  value: total,       cls: 'text-slate-700  bg-slate-50  border-slate-200'  },
      { label: 'Active',       value: active,      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { label: 'Verified',     value: verified,    cls: 'text-blue-700  bg-blue-50  border-blue-200'    },
      { label: 'Pending',      value: pending,     cls: 'text-amber-700 bg-amber-50 border-amber-200'   },
      {
        label: 'Expired Docs', value: expiredDocs,
        cls: expiredDocs > 0
          ? 'text-red-700 bg-red-50 border-red-200'
          : 'text-slate-500 bg-slate-50 border-slate-200',
      },
    ];
  }, [vehicles]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stats.map(({ label, value, cls }) => (
        <div key={label} className={`${cls} border rounded-xl px-3 py-2 text-center min-w-[80px]`}>
          <p className={`text-lg font-black ${cls.split(' ')[0]}`}>{value}</p>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${cls.split(' ')[0]} opacity-70`}>{label}</p>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function VehiclesManagement() {
  const dispatch  = useDispatch();
  const router    = useRouter();
  const pathname  = usePathname();

  const { vehicles = [], drivers = [], loading } = useSelector((s) => s.transportPartner);

  const [showForm,       setShowForm]       = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editOpenTab,    setEditOpenTab]    = useState('basics');
  const [detailVehicle,  setDetailVehicle]  = useState(null);
  const [assignVehicle,  setAssignVehicle]  = useState(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState(null);
  const [selected,       setSelected]       = useState(new Set());
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterType,     setFilterType]     = useState('all');
  const [viewMode,       setViewMode]       = useState('grid');

  useEffect(() => {
    dispatch(fetchTPVehicles());
    dispatch(fetchTPDrivers());
  }, [dispatch]);

  useEffect(() => {
    if (pathname?.endsWith('/new')) {
      setEditingVehicle(null);
      setEditOpenTab('basics');
      setShowForm(true);
    }
  }, [pathname]);

  const uniqueTypes = useMemo(() => [...new Set(vehicles.map((v) => v.vehicleType))], [vehicles]);

  const filtered = useMemo(() => vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      v.registrationNumber?.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.vehicleType?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || v.verificationStatus === filterStatus;
    const matchType   = filterType   === 'all' || v.vehicleType === filterType;
    return matchSearch && matchStatus && matchType;
  }), [vehicles, search, filterStatus, filterType]);

  const openAdd = useCallback(() => {
    setEditingVehicle(null);
    setEditOpenTab('basics');
    setShowForm(true);
    router.push('/transport-partner/fleet/vehicles/new', { scroll: false });
  }, [router]);

  const openEdit = useCallback((vehicle, tab = 'basics') => {
    setEditingVehicle(vehicle);
    setEditOpenTab(tab);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingVehicle(null);
    if (pathname?.endsWith('/new')) {
      router.push('/transport-partner/fleet/vehicles', { scroll: false });
    }
  }, [pathname, router]);

  const handleSave = useCallback(async (form) => {
    if (editingVehicle?._id) {
      const res = await dispatch(updateTPVehicle({ vehicleId: editingVehicle._id, data: form }));
      if (updateTPVehicle.fulfilled.match(res)) closeForm();
    } else {
      const res = await dispatch(addTPVehicle(form));
      if (addTPVehicle.fulfilled.match(res)) closeForm();
    }
  }, [dispatch, editingVehicle, closeForm]);

  const handleDelete = useCallback(async (vehicleId, hard = false) => {
    await dispatch(deleteTPVehicle({ vehicleId, hard }));
    setDeleteConfirm(null);
    setDetailVehicle((prev) => prev?._id === vehicleId ? null : prev);
  }, [dispatch]);

  const handleAssign = useCallback(async (vehicleId, driverId) => {
    await dispatch(assignDriverToVehicle({ vehicleId, driverId }));
    setAssignVehicle(null);
  }, [dispatch]);

  const handleUnassign = useCallback(async (vehicleId) => {
    await dispatch(unassignDriverFromVehicle(vehicleId));
    setAssignVehicle(null);
  }, [dispatch]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((v) => v._id))
    );
  }, [filtered]);

  const handleBulkDelete = useCallback(async () => {
    for (const id of selected) {
      await dispatch(deleteTPVehicle({ vehicleId: id }));
    }
    setSelected(new Set());
  }, [dispatch, selected]);

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Poppins, sans-serif' }}>

      <header className="bg-white border-b border-slate-100 shadow-sm px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1" aria-label="Breadcrumb">
              <span>Fleet</span>
              <ChevronRight size={11} aria-hidden="true" />
              <span className="text-slate-600 font-semibold">Vehicles</span>
            </nav>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">Vehicle Management</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your entire fleet — add, verify and assign drivers</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { dispatch(fetchTPVehicles()); dispatch(fetchTPDrivers()); }}
              aria-label="Refresh"
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
            >
              <Plus size={14} aria-hidden="true" /> Add Vehicle
            </motion.button>
          </div>
        </div>

        <StatsBar vehicles={vehicles} />
      </header>

      <div className="px-4 sm:px-6 py-4 flex items-center gap-3 flex-wrap border-b border-slate-100 bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reg. no., make, model, type…"
            className="pl-8 py-2.5"
            aria-label="Search vehicles"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl" role="group" aria-label="Filter by status">
          {[['all', 'All'], ['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              aria-pressed={filterStatus === val}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterStatus === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {uniqueTypes.length > 1 && (
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by vehicle type"
            className="border border-slate-200 rounded-xl text-xs py-2.5 px-3 pr-8 min-w-[130px] bg-white text-slate-700
              focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl" role="group" aria-label="View mode">
          {([['grid', Grid3X3, 'Grid view'], ['list', List, 'List view']] ).map(([mode, Icon, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} aria-label={label} aria-pressed={viewMode === mode}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                ${viewMode === mode ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700" role="status">
                  {selected.size} vehicle{selected.size > 1 ? 's' : ''} selected
                </span>
                <button onClick={() => setSelected(new Set())}
                  className="text-[10px] text-blue-500 hover:underline">Clear</button>
              </div>
              <button onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold transition-colors">
                <Trash2 size={11} /> Delete Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`px-4 sm:px-6 py-6 transition-all duration-300 ${detailVehicle ? 'pr-[416px]' : ''}`}>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <button onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold transition-colors">
              {selected.size === filtered.length
                ? <CheckSquare size={13} className="text-blue-600" aria-hidden="true" />
                : <Square size={13} aria-hidden="true" />}
              Select all ({filtered.length})
            </button>
            <p className="text-xs text-slate-400" aria-live="polite">
              {filtered.length} of {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {loading && vehicles.length === 0 && (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}
            aria-busy="true" aria-label="Loading vehicles">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20" role="status">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <Car size={26} className="text-slate-300" />
            </div>
            <h2 className="text-base font-black text-slate-600 mb-1">
              {search || filterStatus !== 'all' || filterType !== 'all' ? 'No vehicles match' : 'No vehicles yet'}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {search || filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters or search term.'
                : 'Add your first vehicle to start accepting trips.'}
            </p>
            {!search && filterStatus === 'all' && filterType === 'all' && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                <Plus size={14} /> Add Your First Vehicle
              </motion.button>
            )}
          </div>
        )}

        {viewMode === 'grid' && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((vehicle, idx) => (
                <VehicleCard
                  key={vehicle._id}
                  vehicle={vehicle}
                  index={idx}
                  isSelected={selected.has(vehicle._id)}
                  onSelect={() => toggleSelect(vehicle._id)}
                  onViewDetail={() => setDetailVehicle((v) => v?._id === vehicle._id ? null : vehicle)}
                  onEdit={(tab) => openEdit(vehicle, tab)}
                  onDelete={() => setDeleteConfirm(vehicle._id)}
                  onAssignDriver={() => setAssignVehicle(vehicle)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {viewMode === 'list' && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full" role="table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleSelectAll} aria-label="Select all vehicles">
                      {selected.size === filtered.length
                        ? <CheckSquare size={13} className="text-blue-600" />
                        : <Square size={13} className="text-slate-400" />}
                    </button>
                  </th>
                  {['Vehicle', 'Type', 'Status', 'Driver', 'Docs', ''].map((h) => (
                    <th key={h} scope="col"
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((vehicle) => {
                    const vt     = vtOf(vehicle.vehicleType);
                    const hasDoc = [vehicle.insuranceExpiry, vehicle.pollutionCertExpiry].some(isExpired);
                    // FIX: use helper for driver check in list view
                    const hasDriver = !!assignedDriverId(vehicle);
                    const driverName = vehicle.assignedDriver?.legalName ?? null;
                    return (
                      <motion.tr
                        key={vehicle._id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors
                          ${detailVehicle?._id === vehicle._id ? 'bg-blue-50/60' : ''}`}
                        onClick={() => setDetailVehicle((v) => v?._id === vehicle._id ? null : vehicle)}
                        role="row"
                      >
                        <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(vehicle._id); }}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                            ${selected.has(vehicle._id) ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                            {selected.has(vehicle._id) && <Check size={9} className="text-white" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-slate-800 font-mono">{vehicle.registrationNumber}</p>
                          <p className="text-[10px] text-slate-400">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">{vt?.icon} {vehicle.vehicleType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={vehicle.verificationStatus} />
                        </td>
                        <td className="px-4 py-3">
                          {/* FIX: show driver name from object */}
                          {hasDriver
                            ? <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                                <UserCheck size={11} />{driverName ?? 'Assigned'}
                              </span>
                            : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {hasDoc
                            ? <span className="text-[10px] font-bold text-red-500 flex items-center gap-1"><AlertTriangle size={10} />Expired</span>
                            : <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><CheckCircle2 size={10} />OK</span>}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(vehicle, 'basics')} aria-label="Edit vehicle"
                              className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors">
                              <Edit3 size={11} />
                            </button>
                            <button onClick={() => setAssignVehicle(vehicle)} aria-label="Assign driver"
                              className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 hover:bg-purple-100 transition-colors">
                              <UserCheck size={11} />
                            </button>
                            <button onClick={() => setDeleteConfirm(vehicle._id)} aria-label="Delete vehicle"
                              className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </main>

      <AnimatePresence>
        {detailVehicle && (
          <VehicleDetail
            vehicle={detailVehicle}
            drivers={drivers}
            onClose={() => setDetailVehicle(null)}
            onEdit={(tab) => openEdit(detailVehicle, tab)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <VehicleForm
            vehicle={editingVehicle}
            onSave={handleSave}
            onClose={closeForm}
            loading={loading}
            openTab={editOpenTab}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assignVehicle && (
          <AssignDriverModal
            vehicle={assignVehicle}
            drivers={drivers}
            onAssign={(driverId) => handleAssign(assignVehicle._id, driverId)}
            onUnassign={() => handleUnassign(assignVehicle._id)}
            onClose={() => setAssignVehicle(null)}
            loading={loading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog" aria-modal="true" aria-labelledby="del-title"
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-slate-200"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <Trash2 size={21} className="text-red-400" />
              </div>
              <h2 id="del-title" className="text-base font-black text-slate-800">Remove Vehicle?</h2>
              <p className="text-xs text-slate-400 mt-2 mb-1">
                <strong>Deactivate</strong> — vehicle hidden from dispatch but data preserved.
              </p>
              <p className="text-xs text-slate-400 mb-6">
                <strong>Delete permanently</strong> — only allowed for unverified vehicles without an assigned driver.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirm)} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-50">
                  {loading ? <Loader2 size={13} className="mx-auto animate-spin" /> : 'Deactivate'}
                </button>
                <button onClick={() => handleDelete(deleteConfirm, true)} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50">
                  {loading ? <Loader2 size={13} className="mx-auto animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}