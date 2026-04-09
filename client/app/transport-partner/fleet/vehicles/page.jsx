'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car, Plus, Trash2, Edit3, Save, X, ChevronDown,
  Loader2, Check, AlertTriangle, Search, Upload,
  Camera, FileText, Shield, Zap, Settings,
  CheckCircle2, Clock, XCircle, Eye, EyeOff,
  Link2, Image, Paperclip, RefreshCw, Filter,
  SlidersHorizontal, BarChart3, TrendingUp,
  Users, ArrowUpRight, ChevronRight, MoreVertical,
  Truck, Bike, Bus, Accessibility, Star,
  MapPin, Activity, Calendar, Hash, Gauge,
  UserCheck, UserX, Package, ToggleLeft,
  ToggleRight, Info, AlertCircle, ExternalLink,
  Download, Copy, ZoomIn, Maximize2, Grid3X3,
  List, ArrowLeft, CheckSquare, Square,
} from 'lucide-react';
import {
  fetchTPVehicles,
  fetchTPVehicleById,
  addTPVehicle,
  updateTPVehicle,
  deleteTPVehicle,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
  addTPVehiclePhotos,
  fetchTPDrivers,
} from '@/store/slices/transportPartnerSlice';
import { uploadSingleFile, uploadMultipleFiles } from '@/store/slices/uploadSlice';

// ─── Constants ───────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { value: 'Bike',           label: 'Bike',            icon: '🏍️', category: 'Two-Wheeler' },
  { value: 'Scooter',        label: 'Scooter',          icon: '🛵', category: 'Two-Wheeler' },
  { value: 'Auto',           label: 'Auto',             icon: '🛺', category: 'Three-Wheeler' },
  { value: 'E-Rickshaw',     label: 'E-Rickshaw',       icon: '🛺', category: 'Three-Wheeler' },
  { value: 'Hatchback',      label: 'Hatchback',        icon: '🚗', category: 'Four-Wheeler' },
  { value: 'Sedan',          label: 'Sedan',            icon: '🚙', category: 'Four-Wheeler' },
  { value: 'SUV',            label: 'SUV',              icon: '🚙', category: 'Four-Wheeler' },
  { value: 'MUV',            label: 'MUV',              icon: '🚙', category: 'Four-Wheeler' },
  { value: 'Crossover',      label: 'Crossover',        icon: '🚙', category: 'Four-Wheeler' },
  { value: 'Van',            label: 'Van',              icon: '🚐', category: 'Van/Minibus' },
  { value: 'Minivan',        label: 'Minivan',          icon: '🚐', category: 'Van/Minibus' },
  { value: 'Tempo-Traveller',label: 'Tempo Traveller',  icon: '🚌', category: 'Van/Minibus' },
  { value: 'Minibus',        label: 'Minibus',          icon: '🚌', category: 'Van/Minibus' },
  { value: 'Wheelchair-Van', label: 'Wheelchair Van',   icon: '♿', category: 'Specialised' },
  { value: 'Mortuary-Van',   label: 'Mortuary Van',     icon: '🚑', category: 'Specialised' },
  { value: 'Bus',            label: 'Bus',              icon: '🚌', category: 'Heavy' },
  { value: 'Truck',          label: 'Truck',            icon: '🚚', category: 'Heavy' },
  { value: 'Pickup',         label: 'Pickup',           icon: '🛻', category: 'Heavy' },
];

const PERMIT_TYPES = ['Commercial', 'Tourist', 'Private', 'Contract Carriage'];

const STATUS_CONFIG = {
  pending:      { label: 'Pending',      color: '#f59e0b', bg: '#fef3c7', border: '#fde68a', icon: Clock },
  'under-review':{ label: 'Under Review', color: '#3b82f6', bg: '#dbeafe', border: '#bfdbfe', icon: Eye },
  verified:     { label: 'Verified',     color: '#10b981', bg: '#d1fae5', border: '#a7f3d0', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     color: '#ef4444', bg: '#fee2e2', border: '#fecaca', icon: XCircle },
};

const VEHICLE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
];

const DEFAULT_VEHICLE = {
  registrationNumber: '', make: '', model: '', year: new Date().getFullYear(),
  color: '', vehicleType: 'Sedan', seatingCapacity: 4,
  isWheelchairAccessible: false, hasStretcherSupport: false,
  hasOxygenSupport: false, hasMedicalKit: false, hasAC: true,
  rcBookUrl: '', insurancePolicyUrl: '', insuranceExpiry: '',
  pollutionCertUrl: '', pollutionCertExpiry: '', fitnessCertUrl: '',
  fitnessCertExpiry: '', permitType: 'Commercial', permitExpiry: '',
  gpsDeviceId: '', photos: [], isActive: true,
};

// ─── Tiny Helpers ─────────────────────────────────────────────────────────────

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isExpired = (d) => d && new Date(d) < new Date();
const isExpiringSoon = (d) => d && !isExpired(d) && new Date(d) < new Date(Date.now() + 30 * 864e5);

// ─── Upload Input Component ───────────────────────────────────────────────────

const UploadOrLink = ({ label, value, onChange, folder, hint, accept = '*/*' }) => {
  const dispatch = useDispatch();
  const { isUploading } = useSelector(s => s.upload);
  const [mode, setMode] = useState('link'); // 'link' | 'upload'
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadSingleFile({ file, folder: folder || 'vehicles' }));
    if (uploadSingleFile.fulfilled.match(res)) {
      onChange(res.payload.url || res.payload.data?.url || '');
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <div className="flex gap-1 mb-1.5">
        {['link', 'upload'].map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all
              ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {m === 'link' ? <Link2 size={10} className="inline mr-1" /> : <Upload size={10} className="inline mr-1" />}
            {m === 'link' ? 'Paste URL' : 'Upload File'}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <div className="relative">
          <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="url"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder="https://..."
            className="input-field w-full text-sm pl-8"
          />
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-500" />
              <span className="text-xs text-blue-500 font-semibold">Uploading…</span>
            </div>
          ) : value ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs text-emerald-600 font-semibold truncate max-w-[200px]">{value.split('/').pop()}</span>
            </div>
          ) : (
            <>
              <Upload size={20} className="mx-auto text-slate-300 mb-1" />
              <p className="text-xs text-slate-400">Click to browse or drag & drop</p>
            </>
          )}
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
        </div>
      )}

      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-1">
          <ExternalLink size={10} /> Preview
        </a>
      )}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
};

// ─── Photo Upload Strip ────────────────────────────────────────────────────────

const PhotoStrip = ({ photos = [], onAdd, onRemove, vehicleId }) => {
  const dispatch = useDispatch();
  const { isUploading } = useSelector(s => s.upload);
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const res = await dispatch(uploadMultipleFiles({ files, folder: 'vehicle-photos' }));
    if (uploadMultipleFiles.fulfilled.match(res)) {
      const urls = res.payload.data?.map(f => f.url) || [];
      urls.forEach(url => onAdd(url));
    }
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) { onAdd(urlInput.trim()); setUrlInput(''); }
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle Photos</label>

      <div className="flex gap-2">
        <input
          type="url" value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
          placeholder="Paste image URL…"
          className="input-field flex-1 text-sm"
        />
        <button type="button" onClick={handleAddUrl}
          className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          Upload
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition-colors">
                  <ExternalLink size={12} />
                </a>
                <button type="button" onClick={() => onRemove(i)}
                  className="w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Field & Toggle ────────────────────────────────────────────────────────────

const Field = ({ label, hint, children, required, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const Toggle = ({ label, sublabel, value, onChange, icon: Icon, color = '#3b82f6' }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
    <div className="flex items-center gap-2.5">
      {Icon && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={13} style={{ color }} />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-400">{sublabel}</p>}
      </div>
    </div>
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${value ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <motion.span
        animate={{ x: value ? 0 : -16 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  </div>
);

// ─── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
};

// ─── Vehicle Type Picker ──────────────────────────────────────────────────────

const VehicleTypePicker = ({ value, onChange }) => {
  const categories = [...new Set(VEHICLE_TYPES.map(v => v.category))];
  return (
    <div className="space-y-2">
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 mb-1.5">{cat}</p>
          <div className="flex flex-wrap gap-1.5">
            {VEHICLE_TYPES.filter(v => v.category === cat).map(vt => (
              <button key={vt.value} type="button" onClick={() => onChange(vt.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${value === vt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
                <span className="text-sm">{vt.icon}</span>
                {vt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Vehicle Form (Add/Edit) ──────────────────────────────────────────────────

const FORM_SECTIONS = [
  { id: 'basics',    label: 'Basic Info',    icon: Car },
  { id: 'features',  label: 'Features',      icon: Settings },
  { id: 'docs',      label: 'Documents',     icon: FileText },
  { id: 'photos',    label: 'Photos',        icon: Camera },
];

const VehicleForm = ({ vehicle, onSave, onClose, loading, openTab }) => {
  const [form, setForm] = useState({ ...DEFAULT_VEHICLE, ...(vehicle || {}) });
  const [section, setSection] = useState('basics');

  useEffect(() => {
    if (openTab) setSection(openTab);
  }, [openTab]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setNested = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addPhoto = (url) => set('photos', [...(form.photos || []), url]);
  const removePhoto = (i) => set('photos', (form.photos || []).filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!form.registrationNumber?.trim()) return;
    if (!form.make?.trim()) return;
    if (!form.model?.trim()) return;
    onSave(form);
  };

  const isValid = form.registrationNumber?.trim() && form.make?.trim() && form.model?.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 10 }}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Car size={18} className="text-blue-600" />
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
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-0.5 px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          {FORM_SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${isActive ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}>
                <Icon size={13} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ── BASICS ── */}
          {section === 'basics' && (
            <motion.div key="basics" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Field label="Registration Number" required>
                <input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. AP09AB1234" className="input-field w-full text-sm font-mono tracking-wider" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Make / Brand" required>
                  <input value={form.make} onChange={e => set('make', e.target.value)}
                    placeholder="e.g. Toyota" className="input-field w-full text-sm" />
                </Field>
                <Field label="Model" required>
                  <input value={form.model} onChange={e => set('model', e.target.value)}
                    placeholder="e.g. Innova" className="input-field w-full text-sm" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Year">
                  <input type="number" value={form.year} min="1990" max={new Date().getFullYear() + 1}
                    onChange={e => set('year', Number(e.target.value))}
                    className="input-field w-full text-sm font-mono" />
                </Field>
                <Field label="Color">
                  <input value={form.color} onChange={e => set('color', e.target.value)}
                    placeholder="e.g. White" className="input-field w-full text-sm" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Seating Capacity">
                  <input type="number" min="1" max="60" value={form.seatingCapacity}
                    onChange={e => set('seatingCapacity', Number(e.target.value))}
                    className="input-field w-full text-sm font-mono" />
                </Field>
                <Field label="GPS Device ID" hint="Optional tracker device">
                  <input value={form.gpsDeviceId} onChange={e => set('gpsDeviceId', e.target.value)}
                    placeholder="e.g. GPS-12345" className="input-field w-full text-sm font-mono" />
                </Field>
              </div>

              <Field label="Vehicle Type" required>
                <VehicleTypePicker value={form.vehicleType} onChange={v => set('vehicleType', v)} />
              </Field>

              <Toggle label="Active Vehicle" sublabel="Available for dispatch"
                value={form.isActive} onChange={v => set('isActive', v)} icon={Activity} color="#10b981" />
            </motion.div>
          )}

          {/* ── FEATURES ── */}
          {section === 'features' && (
            <motion.div key="features" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amenities & Equipment</p>
              <div className="space-y-2">
                <Toggle label="Air Conditioning" sublabel="Vehicle has working AC"
                  value={form.hasAC} onChange={v => set('hasAC', v)} icon={Zap} color="#3b82f6" />
                <Toggle label="Wheelchair Accessible" sublabel="Has ramp or lift modification"
                  value={form.isWheelchairAccessible} onChange={v => set('isWheelchairAccessible', v)} icon={Accessibility} color="#8b5cf6" />
                <Toggle label="Stretcher Support" sublabel="Can accommodate stretcher"
                  value={form.hasStretcherSupport} onChange={v => set('hasStretcherSupport', v)} icon={Activity} color="#ef4444" />
                <Toggle label="Oxygen Support" sublabel="Oxygen cylinder & flow meter"
                  value={form.hasOxygenSupport} onChange={v => set('hasOxygenSupport', v)} icon={Package} color="#10b981" />
                <Toggle label="Medical Kit" sublabel="First-aid & medical kit onboard"
                  value={form.hasMedicalKit} onChange={v => set('hasMedicalKit', v)} icon={Shield} color="#f59e0b" />
              </div>

              <div className="pt-2 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Permit</p>
                <Field label="Permit Type">
                  <div className="flex flex-wrap gap-1.5">
                    {PERMIT_TYPES.map(pt => (
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
                <Field label="Permit Expiry">
                  <input type="date" value={form.permitExpiry ? form.permitExpiry.slice(0, 10) : ''}
                    onChange={e => set('permitExpiry', e.target.value)}
                    className={`input-field w-full text-sm ${isExpired(form.permitExpiry) ? 'border-red-300 bg-red-50' : isExpiringSoon(form.permitExpiry) ? 'border-amber-300 bg-amber-50' : ''}`} />
                  {isExpired(form.permitExpiry) && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ Permit has expired!</p>}
                  {isExpiringSoon(form.permitExpiry) && !isExpired(form.permitExpiry) && <p className="text-[10px] text-amber-500 font-semibold mt-1">⚠️ Expiring within 30 days</p>}
                </Field>
              </div>
            </motion.div>
          )}

          {/* ── DOCUMENTS ── */}
          {section === 'docs' && (
            <motion.div key="docs" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <UploadOrLink label="RC Book" value={form.rcBookUrl} onChange={v => set('rcBookUrl', v)}
                folder="vehicle-docs" accept=".pdf,.jpg,.jpeg,.png" hint="Registration Certificate" />

              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-100">
                <UploadOrLink label="Insurance Policy" value={form.insurancePolicyUrl}
                  onChange={v => set('insurancePolicyUrl', v)} folder="vehicle-docs" accept=".pdf,.jpg,.jpeg,.png" />
                <Field label="Insurance Expiry">
                  <input type="date" value={form.insuranceExpiry ? form.insuranceExpiry.slice(0, 10) : ''}
                    onChange={e => set('insuranceExpiry', e.target.value)}
                    className={`input-field w-full text-sm ${isExpired(form.insuranceExpiry) ? 'border-red-300 bg-red-50' : ''}`} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-100">
                <UploadOrLink label="Pollution Certificate (PUC)" value={form.pollutionCertUrl}
                  onChange={v => set('pollutionCertUrl', v)} folder="vehicle-docs" />
                <Field label="PUC Expiry">
                  <input type="date" value={form.pollutionCertExpiry ? form.pollutionCertExpiry.slice(0, 10) : ''}
                    onChange={e => set('pollutionCertExpiry', e.target.value)}
                    className={`input-field w-full text-sm ${isExpired(form.pollutionCertExpiry) ? 'border-red-300 bg-red-50' : ''}`} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-100">
                <UploadOrLink label="Fitness Certificate" value={form.fitnessCertUrl}
                  onChange={v => set('fitnessCertUrl', v)} folder="vehicle-docs" />
                <Field label="Fitness Cert Expiry">
                  <input type="date" value={form.fitnessCertExpiry ? form.fitnessCertExpiry.slice(0, 10) : ''}
                    onChange={e => set('fitnessCertExpiry', e.target.value)}
                    className={`input-field w-full text-sm ${isExpired(form.fitnessCertExpiry) ? 'border-red-300 bg-red-50' : ''}`} />
                </Field>
              </div>
            </motion.div>
          )}

          {/* ── PHOTOS ── */}
          {section === 'photos' && (
            <motion.div key="photos" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <PhotoStrip
                photos={form.photos || []}
                onAdd={addPhoto}
                onRemove={removePhoto}
                vehicleId={vehicle?._id}
              />
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            {!isValid && <span className="text-red-400 font-semibold">* Reg No, Make & Model required</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 transition-colors">
              Cancel
            </button>
            <motion.button
              onClick={handleSave}
              disabled={loading || !isValid}
              whileHover={{ scale: isValid ? 1.02 : 1 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary-cta flex items-center gap-2 text-[11px] px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
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

// ─── Assign Driver Modal ───────────────────────────────────────────────────────

const AssignDriverModal = ({ vehicle, drivers, onAssign, onUnassign, onClose, loading }) => {
  const [search, setSearch] = useState('');
  const filtered = drivers.filter(d =>
    d.legalName?.toLowerCase().includes(search.toLowerCase()) ||
    d.driverCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <UserCheck size={16} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Assign Driver</h3>
              <p className="text-[10px] text-slate-400 font-mono">{vehicle.registrationNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700">
            <X size={15} />
          </button>
        </div>

        {vehicle.assignedDriver && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={14} className="text-amber-600" />
              <p className="text-xs font-semibold text-amber-700">Driver currently assigned</p>
            </div>
            <button onClick={onUnassign} disabled={loading}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center gap-1">
              <UserX size={11} /> Unassign
            </button>
          </div>
        )}

        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="input-field w-full text-sm pl-8" />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <Users size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">No available drivers found</p>
              </div>
            ) : filtered.map(driver => (
              <motion.div key={driver._id}
                whileHover={{ x: 3 }}
                onClick={() => !loading && onAssign(driver._id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                  ${vehicle.assignedDriver === driver._id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-200'}`}>
                <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-black">
                  {driver.legalName?.charAt(0) || '?'}
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
                {vehicle.assignedDriver === driver._id && (
                  <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Vehicle Card ──────────────────────────────────────────────────────────────

const VehicleCard = ({ vehicle, index, onEdit, onDelete, onAssignDriver, onViewDetail, isSelected, onSelect }) => {
  const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];
  const vt = VEHICLE_TYPES.find(v => v.value === vehicle.vehicleType);
  const cfg = STATUS_CONFIG[vehicle.verificationStatus] || STATUS_CONFIG.pending;

  const hasExpiredDoc = [vehicle.insuranceExpiry, vehicle.pollutionCertExpiry, vehicle.fitnessCertExpiry, vehicle.permitExpiry]
    .some(isExpired);
  const hasExpiringSoon = [vehicle.insuranceExpiry, vehicle.pollutionCertExpiry, vehicle.fitnessCertExpiry, vehicle.permitExpiry]
    .some(isExpiringSoon);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-white rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{ borderColor: isSelected ? color : '#e2e8f0' }}
      onClick={onViewDetail}
    >
      {/* Color strip */}
      <div className="h-1" style={{ background: color }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5">
            {/* Checkbox */}
            <button
              onClick={e => { e.stopPropagation(); onSelect(); }}
              className="mt-0.5 w-4 h-4 rounded flex items-center justify-center border-2 transition-all flex-shrink-0"
              style={{ borderColor: isSelected ? color : '#d1d5db', background: isSelected ? color : 'transparent' }}>
              {isSelected && <Check size={10} className="text-white" />}
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: `${color}12`, border: `1.5px solid ${color}25` }}>
              {vt?.icon || '🚗'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800 font-mono tracking-wide truncate">
                {vehicle.registrationNumber}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={vehicle.verificationStatus} />
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
              ${vehicle.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {vehicle.isActive ? '● ACTIVE' : '○ OFF'}
            </span>
          </div>
        </div>

        {/* Info chips */}
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
          {hasExpiredDoc && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
              <AlertTriangle size={9} /> Doc Expired
            </span>
          )}
          {!hasExpiredDoc && hasExpiringSoon && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">
              <Clock size={9} /> Expiring Soon
            </span>
          )}
        </div>

        {/* Driver assigned */}
        {vehicle.assignedDriver ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100 mb-3">
            <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center">
              <UserCheck size={10} className="text-blue-600" />
            </div>
            <p className="text-[10px] font-semibold text-blue-600">Driver Assigned</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 mb-3">
            <UserX size={12} className="text-slate-300" />
            <p className="text-[10px] text-slate-400">No driver assigned</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onEdit('basics'); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold transition-colors">
            <Edit3 size={11} /> Edit
          </button>
          <button onClick={e => { e.stopPropagation(); onAssignDriver(); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 text-[10px] font-bold transition-colors">
            <UserCheck size={11} /> Driver
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit('photos'); }}
            className="py-1.5 px-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors">
            <Camera size={12} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="py-1.5 px-2 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Vehicle Detail Panel ─────────────────────────────────────────────────────

const VehicleDetail = ({ vehicle, onClose, onEdit, drivers }) => {
  const vt = VEHICLE_TYPES.find(v => v.value === vehicle.vehicleType);
  const assignedDriver = drivers.find(d => d._id === vehicle.assignedDriver);

  const DOC_ROWS = [
    { label: 'RC Book',      url: vehicle.rcBookUrl,         expiry: null },
    { label: 'Insurance',    url: vehicle.insurancePolicyUrl, expiry: vehicle.insuranceExpiry },
    { label: 'PUC',          url: vehicle.pollutionCertUrl,  expiry: vehicle.pollutionCertExpiry },
    { label: 'Fitness Cert', url: vehicle.fitnessCertUrl,    expiry: vehicle.fitnessCertExpiry },
    { label: 'Permit',       url: null,                      expiry: vehicle.permitExpiry, type: vehicle.permitType },
  ];

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className="fixed right-0 top-0 bottom-0 w-[400px] bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{vt?.icon || '🚗'}</span>
          <div>
            <p className="text-sm font-black text-slate-800 font-mono">{vehicle.registrationNumber}</p>
            <p className="text-[10px] text-slate-400">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onEdit('basics')}
            className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <Edit3 size={14} />
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={vehicle.verificationStatus} />
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full
            ${vehicle.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {vehicle.isActive ? '● Active' : '○ Inactive'}
          </span>
          <span className="text-[10px] font-mono text-slate-400">{vehicle.vehicleCode || '—'}</span>
        </div>

        {/* Photos */}
        {vehicle.photos?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Photos ({vehicle.photos.length})</p>
            <div className="grid grid-cols-3 gap-1.5">
              {vehicle.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Specs */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Specifications</p>
          {[
            { label: 'Type', value: `${vt?.icon} ${vehicle.vehicleType}` },
            { label: 'Seats', value: `${vehicle.seatingCapacity}` },
            { label: 'Color', value: vehicle.color || '—' },
            { label: 'GPS ID', value: vehicle.gpsDeviceId || '—' },
            { label: 'Permit', value: vehicle.permitType || '—' },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center text-xs">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-semibold text-slate-700">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Features */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Features</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'AC', value: vehicle.hasAC, icon: Zap, color: '#3b82f6' },
              { label: 'Wheelchair', value: vehicle.isWheelchairAccessible, icon: Accessibility, color: '#8b5cf6' },
              { label: 'Stretcher', value: vehicle.hasStretcherSupport, icon: Activity, color: '#ef4444' },
              { label: 'O₂ Support', value: vehicle.hasOxygenSupport, icon: Package, color: '#10b981' },
              { label: 'Medical Kit', value: vehicle.hasMedicalKit, icon: Shield, color: '#f59e0b' },
            ].map(feat => {
              const Icon = feat.icon;
              return (
                <div key={feat.label} className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold
                  ${feat.value ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                  <Icon size={12} style={{ color: feat.value ? feat.color : '#94a3b8' }} />
                  {feat.label}
                  {feat.value ? <CheckCircle2 size={10} className="ml-auto text-green-500" /> : <X size={10} className="ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Assigned Driver */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Assigned Driver</p>
          {assignedDriver ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="w-9 h-9 rounded-xl bg-blue-200 flex items-center justify-center text-blue-700 font-black text-sm">
                {assignedDriver.legalName?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-blue-800">{assignedDriver.legalName}</p>
                <p className="text-[10px] text-blue-500 font-mono">{assignedDriver.driverCode}</p>
              </div>
              <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full
                ${assignedDriver.status === 'Available' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {assignedDriver.status}
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center">
              <UserX size={20} className="mx-auto text-slate-300 mb-1" />
              <p className="text-xs text-slate-400">No driver assigned</p>
            </div>
          )}
        </div>

        {/* Documents */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Documents</p>
          <div className="space-y-2">
            {DOC_ROWS.map(doc => (
              <div key={doc.label} className={`flex items-center justify-between p-2.5 rounded-xl text-xs border
                ${isExpired(doc.expiry) ? 'bg-red-50 border-red-200' : isExpiringSoon(doc.expiry) ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <p className="font-semibold text-slate-700">{doc.label}{doc.type ? ` (${doc.type})` : ''}</p>
                  {doc.expiry && (
                    <p className={`text-[10px] mt-0.5 font-semibold
                      ${isExpired(doc.expiry) ? 'text-red-500' : isExpiringSoon(doc.expiry) ? 'text-amber-500' : 'text-slate-400'}`}>
                      {isExpired(doc.expiry) ? '⚠️ Expired' : isExpiringSoon(doc.expiry) ? '⏰ ' : '✓ '}
                      {fmt(doc.expiry)}
                    </p>
                  )}
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline">
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

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

const StatsBar = ({ vehicles }) => {
  const total = vehicles.length;
  const active = vehicles.filter(v => v.isActive).length;
  const verified = vehicles.filter(v => v.verificationStatus === 'verified').length;
  const pending = vehicles.filter(v => v.verificationStatus === 'pending').length;
  const expiredDocs = vehicles.filter(v =>
    [v.insuranceExpiry, v.pollutionCertExpiry, v.fitnessCertExpiry].some(isExpired)
  ).length;

  const stats = [
    { label: 'Total Fleet',   value: total,      color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
    { label: 'Active',        value: active,     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Verified',      value: verified,   color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
    { label: 'Pending',       value: pending,    color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
    { label: 'Expired Docs',  value: expiredDocs,color: expiredDocs > 0 ? 'text-red-700' : 'text-slate-500', bg: expiredDocs > 0 ? 'bg-red-50' : 'bg-slate-50', border: expiredDocs > 0 ? 'border-red-200' : 'border-slate-200' },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stats.map(s => (
        <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl px-3 py-2 text-center min-w-[80px]`}>
          <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${s.color} opacity-70`}>{s.label}</p>
        </div>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function VehiclesManagement() {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const { vehicles = [], drivers = [], loading } = useSelector(s => s.transportPartner);

  // State
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editOpenTab, setEditOpenTab] = useState('basics');
  const [detailVehicle, setDetailVehicle] = useState(null);
  const [assignVehicle, setAssignVehicle] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    dispatch(fetchTPVehicles());
    dispatch(fetchTPDrivers());
  }, [dispatch]);

  // Auto-open add form if route is /new
  useEffect(() => {
    if (pathname?.endsWith('/new') || pathname?.includes('/vehicles/new')) {
      setEditingVehicle(null);
      setEditOpenTab('basics');
      setShowForm(true);
    }
  }, [pathname]);

  // Filtered vehicles
  const filtered = vehicles.filter(v => {
    const matchSearch = !search ||
      v.registrationNumber?.toLowerCase().includes(search.toLowerCase()) ||
      v.make?.toLowerCase().includes(search.toLowerCase()) ||
      v.model?.toLowerCase().includes(search.toLowerCase()) ||
      v.vehicleType?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || v.verificationStatus === filterStatus;
    const matchType = filterType === 'all' || v.vehicleType === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const uniqueTypes = [...new Set(vehicles.map(v => v.vehicleType))];

  // Handlers
  const openAdd = () => {
    setEditingVehicle(null);
    setEditOpenTab('basics');
    setShowForm(true);
    router.push('/transport-partner/fleet/vehicles/new', { scroll: false });
  };

  const openEdit = (vehicle, tab = 'basics') => {
    setEditingVehicle(vehicle);
    setEditOpenTab(tab);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingVehicle(null);
    // pop /new from URL if present
    if (pathname?.endsWith('/new')) {
      router.push('/transport-partner/fleet/vehicles', { scroll: false });
    }
  };

  const handleSave = async (form) => {
    let res;
    if (editingVehicle?._id) {
      res = await dispatch(updateTPVehicle({ vehicleId: editingVehicle._id, data: form }));
    } else {
      res = await dispatch(addTPVehicle(form));
    }
    if (addTPVehicle.fulfilled.match(res) || updateTPVehicle.fulfilled.match(res)) {
      closeForm();
      dispatch(fetchTPVehicles());
    }
  };

  const handleDelete = async (vehicleId, hard = false) => {
    await dispatch(deleteTPVehicle({ vehicleId, hard }));
    setDeleteConfirm(null);
    if (detailVehicle?._id === vehicleId) setDetailVehicle(null);
    dispatch(fetchTPVehicles());
  };

  const handleAssign = async (vehicleId, driverId) => {
    await dispatch(assignDriverToVehicle({ vehicleId, driverId }));
    dispatch(fetchTPVehicles());
    setAssignVehicle(null);
  };

  const handleUnassign = async (vehicleId) => {
    await dispatch(unassignDriverFromVehicle(vehicleId));
    dispatch(fetchTPVehicles());
    setAssignVehicle(null);
  };

  const handleAddPhotos = async (vehicleId, photoUrls) => {
    await dispatch(addTPVehiclePhotos({ vehicleId, photoUrls }));
    dispatch(fetchTPVehicles());
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(v => v._id)));
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selected) {
      await dispatch(deleteTPVehicle({ vehicleId: id }));
    }
    setSelected(new Set());
    dispatch(fetchTPVehicles());
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 shadow-sm px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span>Fleet</span>
              <ChevronRight size={12} />
              <span className="text-slate-600 font-semibold">Vehicles</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">Vehicle Management</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your entire fleet — add, verify and assign drivers</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => dispatch(fetchTPVehicles())}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={openAdd}
              className="btn-primary-cta flex items-center gap-2 text-xs px-4 py-2.5"
            >
              <Plus size={15} /> Add Vehicle
            </motion.button>
          </div>
        </div>

        <StatsBar vehicles={vehicles} />
      </div>

      {/* ── Toolbar ── */}
      <div className="px-4 sm:px-6 py-4 flex items-center gap-3 flex-wrap border-b border-slate-100 bg-white">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by reg. no., make, model, type…"
            className="input-field w-full text-sm pl-8 py-2.5" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {[['all', 'All'], ['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterStatus === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        {uniqueTypes.length > 1 && (
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="input-field text-xs py-2.5 pr-8 min-w-[130px]">
            <option value="all">All Types</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl">
          {[['grid', Grid3X3], ['list', List]].map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                ${viewMode === mode ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk Actions ── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-4 sm:px-6 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700">{selected.size} vehicle{selected.size > 1 ? 's' : ''} selected</span>
                <button onClick={() => setSelected(new Set())} className="text-[10px] text-blue-500 hover:underline">Clear</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold transition-colors">
                  <Trash2 size={12} /> Delete Selected
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className={`px-4 sm:px-6 py-6 ${detailVehicle ? 'pr-[416px]' : ''} transition-all duration-300`}>

        {/* Select all row */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <button onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold transition-colors">
              {selected.size === filtered.length ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
              Select all ({filtered.length})
            </button>
            <p className="text-xs text-slate-400">{filtered.length} of {vehicles.length} vehicles</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && vehicles.length === 0 && (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Car size={28} className="text-slate-300" />
            </div>
            <h3 className="text-base font-black text-slate-600 mb-1">
              {search || filterStatus !== 'all' || filterType !== 'all' ? 'No vehicles match' : 'No vehicles yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {search || filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first vehicle to get started'}
            </p>
            {!search && filterStatus === 'all' && filterType === 'all' && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={openAdd} className="btn-primary-cta flex items-center gap-2 text-xs px-5 py-2.5 mx-auto">
                <Plus size={15} /> Add Your First Vehicle
              </motion.button>
            )}
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map((vehicle, idx) => (
                <VehicleCard
                  key={vehicle._id}
                  vehicle={vehicle}
                  index={idx}
                  isSelected={selected.has(vehicle._id)}
                  onSelect={() => toggleSelect(vehicle._id)}
                  onViewDetail={() => setDetailVehicle(v => v?._id === vehicle._id ? null : vehicle)}
                  onEdit={(tab) => openEdit(vehicle, tab)}
                  onDelete={() => setDeleteConfirm(vehicle._id)}
                  onAssignDriver={() => setAssignVehicle(vehicle)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleSelectAll}>
                      {selected.size === filtered.length ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-slate-400" />}
                    </button>
                  </th>
                  {['Vehicle', 'Type', 'Status', 'Driver', 'Documents', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((vehicle, idx) => {
                    const vt = VEHICLE_TYPES.find(v => v.value === vehicle.vehicleType);
                    const hasDoc = [vehicle.insuranceExpiry, vehicle.pollutionCertExpiry].some(isExpired);
                    return (
                      <motion.tr key={vehicle._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors
                          ${detailVehicle?._id === vehicle._id ? 'bg-blue-50' : ''}`}
                        onClick={() => setDetailVehicle(v => v?._id === vehicle._id ? null : vehicle)}
                      >
                        <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(vehicle._id); }}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                            ${selected.has(vehicle._id) ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                            {selected.has(vehicle._id) && <Check size={10} className="text-white" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-black text-slate-800 font-mono">{vehicle.registrationNumber}</p>
                            <p className="text-[10px] text-slate-400">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">{vt?.icon} {vehicle.vehicleType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={vehicle.verificationStatus} />
                        </td>
                        <td className="px-4 py-3">
                          {vehicle.assignedDriver ? (
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                              <UserCheck size={12} /> Assigned
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {hasDoc ? (
                            <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                              <AlertTriangle size={10} /> Expired
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                              <CheckCircle2 size={10} /> OK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(vehicle, 'basics')}
                              className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors">
                              <Edit3 size={12} />
                            </button>
                            <button onClick={() => setAssignVehicle(vehicle)}
                              className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 hover:bg-purple-100 transition-colors">
                              <UserCheck size={12} />
                            </button>
                            <button onClick={() => setDeleteConfirm(vehicle._id)}
                              className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors">
                              <Trash2 size={12} />
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
      </div>

      {/* ── Detail Panel ── */}
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

      {/* ── Vehicle Form Modal ── */}
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

      {/* ── Assign Driver Modal ── */}
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

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl border border-slate-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <h3 className="text-base font-black text-slate-800">Remove Vehicle?</h3>
              <p className="text-xs text-slate-400 mt-2 mb-6">
                This vehicle will be deactivated. Unverified vehicles without assigned drivers can be permanently deleted.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirm)} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                  {loading ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Deactivate'}
                </button>
                <button onClick={() => handleDelete(deleteConfirm, true)} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
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