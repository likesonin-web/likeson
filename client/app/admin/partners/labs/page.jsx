'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Plus, Search, Filter, MapPin, Phone, Mail, Globe,
  Shield, CheckCircle2, XCircle, ToggleLeft, ToggleRight, Trash2,
  Edit3, Eye, Upload, Image, Link2, Star, Bed, AlertCircle,
  Building2, Clock, ChevronDown, ChevronUp, X, Save, RefreshCw,
  TrendingUp, Activity, Users, Award, Microscope, Stethoscope,
  Hospital, Loader2, Camera, FileText, Hash, Calendar, CreditCard,
  Wifi, WifiOff, BadgeCheck, Ban, BarChart3, PieChart, Info, MoreVertical,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

import {
  fetchAllHospitals,
  createHospital,
  updateHospitalProfile,
  updateHospitalSettings,
  updateHospitalSecurity,
  updateHospitalLocation,
  verifyHospital,
  toggleHospitalActive,
  deleteHospital,
  updateHospitalPlatformFee,
  selectHospitals,
  selectHospitalTotal,
  selectHospitalLoading,
  selectHospitalError,
  clearError,
} from '@/store/slices/hospitalSlice';

import {
  uploadSingleFile,
  uploadMultipleFiles,
  resetUploadState,
  selectIsUploading,
} from '@/store/slices/uploadSlice';

// ── Constants ──────────────────────────────────────────────────────────────────

const LAB_TYPES = ['Clinic', 'Diagnostic Center', 'Nursing Home'];

const ACCREDITATIONS = ['NABH', 'NABL', 'JCI', 'ISO', 'AHPI', 'Other'];

const SPECIALTIES = [
  'Pathology', 'Radiology', 'Microbiology', 'Biochemistry',
  'Hematology', 'Immunology', 'Cytology', 'Histopathology',
  'Genetics', 'Toxicology', 'MRI & CT Scan', 'Ultrasound',
  'X-Ray', 'ECG & EEG', 'Endoscopy', 'Dental',
];

const FACILITIES = [
  'Home Sample Collection', 'Online Reports', 'NABL Certified Tests',
  'Emergency Testing', 'Pediatric Lab', 'Phlebotomy Services',
  'Tele-consultation', 'Health Packages', 'Corporate Health Checks',
  'Pre-surgical Screening', 'Pregnancy Packages', 'Vaccination',
];

const SCHEMES = [
  'Ayushman Bharat', 'CGHS', 'ESI', 'YSR Aarogyasri',
  'NTR Vaidya Seva', 'Private Insurance', 'Mediclaim',
];

const SETTLEMENT_CYCLES = ['weekly', 'biweekly', 'monthly'];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CHART_COLORS = ['#6366f1', '#22d3ee', '#a3e635', '#f59e0b', '#ec4899', '#8b5cf6'];

// ── Utility ────────────────────────────────────────────────────────────────────

const fieldNote = (text) => (
  <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
    {text}
  </p>
);

const Label = ({ required, children }) => (
  <label className="label text-sm font-semibold mb-1 flex items-center gap-1">
    {children}
    {required && <span className="text-error">*</span>}
  </label>
);

// ── Image/URL Field ────────────────────────────────────────────────────────────

function ImageOrUrlField({ label, note, placeholder, value, onChange, folder, multiple = false, accept = 'image/*' }) {
  const dispatch = useDispatch();
  const isUploading = useSelector((s) => s.upload?.isUploading);
  const fileRef = useRef();
  const [mode, setMode] = useState('url'); // 'url' | 'upload'

  const handleFile = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (multiple) {
      const result = await dispatch(uploadMultipleFiles({ files, folder })).unwrap();
      const urls = result.data?.map((f) => f.url) || [];
      onChange(urls);
    } else {
      const result = await dispatch(uploadSingleFile({ file: files[0], folder })).unwrap();
      onChange(result.url);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2 mb-2">
        {['url', 'upload'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === m
                ? 'bg-primary text-primary-content shadow'
                : 'bg-base-200 text-base-content hover:bg-base-300'
            }`}
          >
            {m === 'url' ? <Link2 size={12} /> : <Upload size={12} />}
            {m === 'url' ? 'Paste URL' : 'Upload File'}
          </button>
        ))}
      </div>
      {mode === 'url' ? (
        <input
          type="url"
          className="input-field w-full"
          placeholder={placeholder || 'https://example.com/image.jpg'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-primary"
          style={{ borderColor: 'var(--base-300)' }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={handleFile} />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 size={22} className="animate-spin text-primary" />
              <span className="text-xs text-base-content/60">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <Camera size={22} className="text-primary/60" />
              <span className="text-xs text-base-content/60">Click to browse {multiple ? 'images' : 'an image'}</span>
            </div>
          )}
        </div>
      )}
      {/* Preview */}
      {value && typeof value === 'string' && (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-base-300">
          <img src={value} alt="preview" className="w-full h-full object-cover" onError={(e) => (e.target.style.display = 'none')} />
        </div>
      )}
      {Array.isArray(value) && value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {value.map((url, i) => (
            <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-base-300">
              <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
              <button
                type="button"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      {note && fieldNote(note)}
    </div>
  );
}

// ── Multi-Select Chips ─────────────────────────────────────────────────────────

function ChipSelect({ label, note, options, value = [], onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(selected ? value.filter((v) => v !== opt) : [...value, opt])}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                selected
                  ? 'bg-primary text-primary-content border-primary shadow-sm'
                  : 'bg-base-200 text-base-content border-base-300 hover:border-primary'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {note && fieldNote(note)}
    </div>
  );
}

// ── Operating Hours Row ────────────────────────────────────────────────────────

function OperatingHoursEditor({ value = [], onChange }) {
  const defaults = DAYS.map((day) => {
    const existing = value.find((d) => d.day === day);
    return existing || { day, openTime: '08:00', closeTime: '20:00', is24Hours: false, isClosed: false };
  });

  const update = (idx, patch) => {
    const next = defaults.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label>Operating Hours</Label>
      {fieldNote('Set opening/closing times per day. Toggle 24 hrs or mark as closed.')}
      <div className="space-y-2 mt-2">
        {defaults.map((row, i) => (
          <div key={row.day} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-base-200">
            <span className="text-xs font-bold w-20 text-base-content">{row.day.slice(0, 3)}</span>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={row.is24Hours} onChange={(e) => update(i, { is24Hours: e.target.checked })} />
              24h
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" className="accent-error" checked={row.isClosed} onChange={(e) => update(i, { isClosed: e.target.checked })} />
              Closed
            </label>
            {!row.is24Hours && !row.isClosed && (
              <>
                <input type="time" className="input-field py-1 px-2 text-xs w-28" value={row.openTime} onChange={(e) => update(i, { openTime: e.target.value })} />
                <span className="text-xs text-base-content/40">to</span>
                <input type="time" className="input-field py-1 px-2 text-xs w-28" value={row.closeTime} onChange={(e) => update(i, { closeTime: e.target.value })} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section Wrapper ────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card mb-4 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-base-200 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 font-bold text-sm">
          <Icon size={16} className="text-primary" />
          {title}
        </div>
        {open ? <ChevronUp size={16} className="text-base-content/40" /> : <ChevronDown size={16} className="text-base-content/40" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Default Form State ─────────────────────────────────────────────────────────

const defaultForm = () => ({
  name: '', hospitalType: 'Diagnostic Center', description: '',
  logo: '', images: [],
  contact: { email: '', phone: '', emergencyPhone: '', alternatePhone: '', website: '', whatsapp: '' },
  address: { line1: '', line2: '', landmark: '', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '' },
  location: { type: 'Point', coordinates: [80.648, 16.506] },
  googleMapsUrl: '',
  specialties: [], facilities: [], acceptedSchemes: [], accreditations: [],
  nabledLabAvailable: false,
  bedCount: { total: 0, icu: 0 },
  isEmergencyReady: false, hasICU: false, hasBloodBank: false,
  hasPharmacy: false, hasDiagnostics: true, hasAmbulance: false,
  hasWheelchairAccess: false, is24x7: false,
  operatingHours: [],
  registrationDetails: { licenseNumber: '', gstNumber: '', panNumber: '', documentUrl: '', licenseExpiry: '' },
  platformFee: null,
  settlementCycle: null,
});

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LabsManagement() {
  const dispatch = useDispatch();
  const hospitals = useSelector(selectHospitals);
  const total = useSelector(selectHospitalTotal);
  const loading = useSelector(selectHospitalLoading);
  const error = useSelector(selectHospitalError);

  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit' | 'detail' | 'analytics'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [platformFeeForm, setPlatformFeeForm] = useState({ type: 'percentage', value: '' });
  const [showPlatformFeeModal, setShowPlatformFeeModal] = useState(false);
  const [activePlatformTarget, setActivePlatformTarget] = useState(null);

  // Filtered list: only clinic, diagnostic center, nursing home
  const labs = hospitals.filter((h) => LAB_TYPES.includes(h.hospitalType));

  const filtered = labs.filter((h) => {
    const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.address?.city?.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || h.hospitalType === filterType;
    const matchStatus = !filterStatus ||
      (filterStatus === 'active' && h.isActive) ||
      (filterStatus === 'inactive' && !h.isActive) ||
      (filterStatus === 'verified' && h.isVerified) ||
      (filterStatus === 'unverified' && !h.isVerified);
    return matchSearch && matchType && matchStatus;
  });

  useEffect(() => {
    dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' }));
  }, [dispatch, page]);

  // Analytics data
  const typeData = LAB_TYPES.map((t) => ({ name: t.replace(' ', '\n'), count: labs.filter((h) => h.hospitalType === t).length }));
  const statusData = [
    { name: 'Verified', value: labs.filter((h) => h.isVerified).length },
    { name: 'Unverified', value: labs.filter((h) => !h.isVerified).length },
    { name: 'Active', value: labs.filter((h) => h.isActive).length },
    { name: 'Inactive', value: labs.filter((h) => !h.isActive).length },
  ];
  const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r}★`,
    count: labs.filter((h) => Math.floor(h.rating?.averageRating || 0) === r).length,
  }));

  // Form helpers
  const setField = (path, val) => {
    setForm((f) => {
      const keys = path.split('.');
      if (keys.length === 1) return { ...f, [keys[0]]: val };
      if (keys.length === 2) return { ...f, [keys[0]]: { ...f[keys[0]], [keys[1]]: val } };
      return f;
    });
  };

  const handleEdit = (hospital) => {
    setSelected(hospital);
    setForm({
      ...defaultForm(),
      ...hospital,
      contact: hospital.contact || {},
      address: hospital.address || {},
      registrationDetails: hospital.registrationDetails || {},
      platformFee: hospital.platformFee || null,
    });
    setView('edit');
  };

  const handleCreate = () => {
    setSelected(null);
    setForm(defaultForm());
    setView('create');
  };

  const handleSave = async () => {
    if (view === 'create') {
      await dispatch(createHospital(form)).unwrap();
    } else {
      const id = selected._id;
      await dispatch(updateHospitalProfile({ id, ...form })).unwrap();
      await dispatch(updateHospitalSettings({ id, ...form })).unwrap();
      await dispatch(updateHospitalSecurity({ id, ...form.registrationDetails })).unwrap();
      if (form.location?.coordinates) {
        const [lng, lat] = form.location.coordinates;
        await dispatch(updateHospitalLocation({ id, lat, lng, googleMapsUrl: form.googleMapsUrl })).unwrap();
      }
    }
    setView('list');
    dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' }));
  };

  const handlePlatformFee = async () => {
    const id = activePlatformTarget;
    await dispatch(updateHospitalPlatformFee({
      id,
      platformFee: platformFeeForm.value !== '' ? { type: platformFeeForm.type, value: Number(platformFeeForm.value) } : null,
    })).unwrap();
    setShowPlatformFeeModal(false);
    dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' }));
  };

  const handleDelete = async (id) => {
    await dispatch(deleteHospital(id)).unwrap();
    setDeleteConfirm(null);
    dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b" style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)' }}>
        <div className="container-custom py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Microscope size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold  font-family-poppins text-base-content">Labs & Diagnostics</h1>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Clinics · Diagnostic Centers · Nursing Homes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['list', 'analytics'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  view === v ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content hover:bg-base-300'
                }`}
              >
                {v === 'list' ? <Building2 size={13} /> : <BarChart3 size={13} />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
            <button onClick={handleCreate} className="btn-primary-cta py-2 px-4 flex items-center gap-2 text-xs">
              <Plus size={14} /> Add Lab
            </button>
          </div>
        </div>
      </div>

      <div className="container-custom py-6">

        {/* ── Analytics View ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {view === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6"
            >
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Labs', value: labs.length, icon: FlaskConical, color: 'primary' },
                  { label: 'Verified', value: labs.filter((h) => h.isVerified).length, icon: BadgeCheck, color: 'success' },
                  { label: 'Active', value: labs.filter((h) => h.isActive).length, icon: Activity, color: 'info' },
                  { label: 'Avg Rating', value: labs.length ? (labs.reduce((s, h) => s + (h.rating?.averageRating || 0), 0) / labs.length).toFixed(1) : '—', icon: Star, color: 'warning' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{label}</p>
                        <p className={`text-2xl font-extrabold text-${color}`}>{value}</p>
                      </div>
                      <div className={`p-3 rounded-xl bg-${color}/10`}>
                        <Icon size={20} className={`text-${color}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Type */}
                <div className="card p-5">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-primary" /> Labs by Type</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)' }} />
                      <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Status Pie */}
                <div className="card p-5">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><PieChart size={15} className="text-secondary" /> Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                        {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>

                {/* Rating Distribution */}
                <div className="card p-5 md:col-span-2">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Star size={15} className="text-warning" /> Rating Distribution</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={ratingDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                      <XAxis dataKey="rating" tick={{ fontSize: 11, fill: 'var(--base-content)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)' }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── List View ───────────────────────────────────────────────── */}
          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input
                    className="input-field w-full pl-9 py-2"
                    placeholder="Search labs by name or city…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select className="input-field py-2 pr-8 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  {LAB_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select className="input-field py-2 pr-8 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="verified">Verified</option>
                  <option value="unverified">Unverified</option>
                </select>
                <button onClick={() => dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' }))} className="p-2 rounded-lg bg-base-200 hover:bg-base-300 transition-colors">
                  <RefreshCw size={15} className={loading.fetchAllHospitals ? 'animate-spin text-primary' : 'text-base-content'} />
                </button>
              </div>

              {loading.fetchAllHospitals ? (
                <div className="flex justify-center py-20">
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                  <FlaskConical size={48} className="mx-auto text-base-content/20 mb-3" />
                  <p className="font-semibold text-base-content/50">No labs found</p>
                  <p className="text-sm text-base-content/30">Try adjusting filters or add a new lab</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((lab) => (
                    <LabCard
                      key={lab._id}
                      lab={lab}
                      onEdit={() => handleEdit(lab)}
                      onDetail={() => { setSelected(lab); setView('detail'); }}
                      onVerify={(val) => dispatch(verifyHospital({ id: lab._id, isVerified: val })).then(() => dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' })))}
                      onToggle={() => dispatch(toggleHospitalActive(lab._id)).then(() => dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' })))}
                      onDelete={() => setDeleteConfirm(lab._id)}
                      onPlatformFee={() => {
                        setActivePlatformTarget(lab._id);
                        setPlatformFeeForm({ type: lab.platformFee?.type || 'percentage', value: lab.platformFee?.value ?? '' });
                        setShowPlatformFeeModal(true);
                      }}
                      loading={loading}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Create / Edit Form ──────────────────────────────────────── */}
          {(view === 'create' || view === 'edit') && (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setView('list')} className="p-2 rounded-lg bg-base-200 hover:bg-base-300">
                  <X size={15} />
                </button>
                <h2 className="text-lg font-extrabold font-family-montserrat">
                  {view === 'create' ? 'Add New Lab / Clinic' : `Edit — ${selected?.name}`}
                </h2>
              </div>

              <div className="max-w-4xl">
                {/* Identity */}
                <Section icon={FlaskConical} title="Identity & Branding" defaultOpen>
                  <div>
                    <Label required>Lab / Clinic Name</Label>
                    <input className="input-field w-full" placeholder="e.g., Apollo Diagnostics Vijayawada" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                    {fieldNote('Official registered name of the facility. Used for slug generation and search.')}
                  </div>
                  <div>
                    <Label required>Type</Label>
                    <select className="input-field w-full" value={form.hospitalType} onChange={(e) => setField('hospitalType', e.target.value)}>
                      {LAB_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    {fieldNote('Select Clinic for outpatient care, Diagnostic Center for lab/imaging, Nursing Home for overnight stays.')}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <textarea rows={3} className="input-field w-full resize-none" placeholder="Briefly describe services, specialties, or unique aspects of this facility…" value={form.description} onChange={(e) => setField('description', e.target.value)} />
                    {fieldNote('Max 1,000 characters. Shown on the public listing page.')}
                  </div>
                  <ImageOrUrlField label="Logo" note="Square image recommended (min 200×200px). Appears on cards and search." placeholder="https://cdn.example.com/logo.png" value={form.logo} onChange={(url) => setField('logo', url)} folder="labs/logos" />
                  <ImageOrUrlField label="Gallery Images (up to 20)" note="Add multiple photos of your facility. Accepted: JPG, PNG, WebP." value={form.images} onChange={(urls) => setField('images', Array.isArray(urls) ? urls : [urls])} folder="labs/gallery" multiple />
                </Section>

                {/* Contact */}
                <Section icon={Phone} title="Contact Details">
                  <div>
                    <Label required>Primary Phone</Label>
                    <input className="input-field w-full" placeholder="+91 98765 43210" value={form.contact.phone} onChange={(e) => setField('contact.phone', e.target.value)} />
                    {fieldNote('Main phone number displayed on the public listing. Include country code.')}
                  </div>
                  <div>
                    <Label>Email</Label>
                    <input type="email" className="input-field w-full" placeholder="info@apollodiagnostics.in" value={form.contact.email} onChange={(e) => setField('contact.email', e.target.value)} />
                    {fieldNote('Used for appointment confirmations and platform notifications.')}
                  </div>
                  <div>
                    <Label>Emergency Phone</Label>
                    <input className="input-field w-full" placeholder="+91 90000 12345" value={form.contact.emergencyPhone} onChange={(e) => setField('contact.emergencyPhone', e.target.value)} />
                    {fieldNote('24/7 emergency line. Leave blank if not applicable.')}
                  </div>
                  <div>
                    <Label>WhatsApp</Label>
                    <input className="input-field w-full" placeholder="+91 98765 43210" value={form.contact.whatsapp} onChange={(e) => setField('contact.whatsapp', e.target.value)} />
                    {fieldNote('WhatsApp number for appointment bookings and reports.')}
                  </div>
                  <div>
                    <Label>Website</Label>
                    <input className="input-field w-full" placeholder="https://www.yourlabwebsite.com" value={form.contact.website} onChange={(e) => setField('contact.website', e.target.value)} />
                    {fieldNote('Full URL including https://')}
                  </div>
                  <div>
                    <Label>Alternate Phone</Label>
                    <input className="input-field w-full" placeholder="+91 90000 55555" value={form.contact.alternatePhone} onChange={(e) => setField('contact.alternatePhone', e.target.value)} />
                    {fieldNote('Secondary number shown when primary is unreachable.')}
                  </div>
                </Section>

                {/* Address & Location */}
                <Section icon={MapPin} title="Address & Location">
                  <div>
                    <Label required>Address Line 1</Label>
                    <input className="input-field w-full" placeholder="Door No., Street Name, Area" value={form.address.line1} onChange={(e) => setField('address.line1', e.target.value)} />
                    {fieldNote('Include building/door number and street name for accurate navigation.')}
                  </div>
                  <div>
                    <Label>Address Line 2</Label>
                    <input className="input-field w-full" placeholder="Colony, Road, Area" value={form.address.line2} onChange={(e) => setField('address.line2', e.target.value)} />
                    {fieldNote('Apartment number, colony, or additional address details.')}
                  </div>
                  <div>
                    <Label>Landmark</Label>
                    <input className="input-field w-full" placeholder="Near Old Bus Stand" value={form.address.landmark} onChange={(e) => setField('address.landmark', e.target.value)} />
                    {fieldNote('Nearby prominent landmark to help patients locate the facility.')}
                  </div>
                  <div>
                    <Label>City</Label>
                    <input className="input-field w-full" placeholder="Vijayawada" value={form.address.city} onChange={(e) => setField('address.city', e.target.value)} />
                    {fieldNote('Defaults to Vijayawada. Change for other cities.')}
                  </div>
                  <div>
                    <Label>State</Label>
                    <input className="input-field w-full" value={form.address.state} onChange={(e) => setField('address.state', e.target.value)} />
                  </div>
                  <div>
                    <Label required>PIN Code</Label>
                    <input className="input-field w-full" placeholder="520001" maxLength={6} value={form.address.pincode} onChange={(e) => setField('address.pincode', e.target.value)} />
                    {fieldNote('6-digit Indian PIN code. Used for location-based search.')}
                  </div>
                  <div>
                    <Label>Latitude</Label>
                    <input type="number" step="any" className="input-field w-full" placeholder="16.5062" value={form.location.coordinates[1]} onChange={(e) => setField('location', { type: 'Point', coordinates: [form.location.coordinates[0], parseFloat(e.target.value) || 16.506] })} />
                    {fieldNote('Decimal latitude for geo-search. Get from Google Maps.')}
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <input type="number" step="any" className="input-field w-full" placeholder="80.6480" value={form.location.coordinates[0]} onChange={(e) => setField('location', { type: 'Point', coordinates: [parseFloat(e.target.value) || 80.648, form.location.coordinates[1]] })} />
                    {fieldNote('Decimal longitude for geo-search.')}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Google Maps URL</Label>
                    <input className="input-field w-full" placeholder="https://maps.google.com/?q=..." value={form.googleMapsUrl} onChange={(e) => setField('googleMapsUrl', e.target.value)} />
                    {fieldNote('Paste the "Share" link from Google Maps for the Get Directions button.')}
                  </div>
                </Section>

                {/* Specialties & Accreditation */}
                <Section icon={Stethoscope} title="Specialties & Accreditation">
                  <div className="md:col-span-2">
                    <ChipSelect label="Lab Specialties / Tests" note="Select all applicable test categories offered by this facility." options={SPECIALTIES} value={form.specialties} onChange={(v) => setField('specialties', v)} />
                  </div>
                  <div className="md:col-span-2">
                    <ChipSelect label="Facilities Available" note="Check all patient services and amenities available on-site." options={FACILITIES} value={form.facilities} onChange={(v) => setField('facilities', v)} />
                  </div>
                  <div className="md:col-span-2">
                    <ChipSelect label="Accepted Schemes / Insurance" note="Select all government schemes and insurance panels accepted." options={SCHEMES} value={form.acceptedSchemes} onChange={(v) => setField('acceptedSchemes', v)} />
                  </div>
                  <div className="md:col-span-2">
                    <ChipSelect label="Accreditations" note="Select certifications held by this facility." options={ACCREDITATIONS} value={form.accreditations} onChange={(v) => setField('accreditations', v)} />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <input type="checkbox" id="nabl" className="accent-primary w-4 h-4" checked={form.nabledLabAvailable} onChange={(e) => setField('nabledLabAvailable', e.target.checked)} />
                    <label htmlFor="nabl" className="text-sm font-semibold cursor-pointer">NABL-accredited Lab Available</label>
                    {fieldNote('Check if at least one lab section holds current NABL certification.')}
                  </div>
                </Section>

                {/* Facility Flags */}
                <Section icon={Shield} title="Facility Flags & Bed Count">
                  <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'isEmergencyReady', label: 'Emergency Ready' },
                      { key: 'hasICU', label: 'ICU' },
                      { key: 'hasBloodBank', label: 'Blood Bank' },
                      { key: 'hasPharmacy', label: 'Pharmacy' },
                      { key: 'hasDiagnostics', label: 'Diagnostics' },
                      { key: 'hasAmbulance', label: 'Ambulance' },
                      { key: 'hasWheelchairAccess', label: 'Wheelchair Access' },
                      { key: 'is24x7', label: '24×7 Open' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-base-200 hover:bg-base-300 transition-colors">
                        <input type="checkbox" className="accent-primary w-4 h-4" checked={!!form[key]} onChange={(e) => setField(key, e.target.checked)} />
                        <span className="text-xs font-semibold">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <Label>Total Beds</Label>
                    <input type="number" min={0} className="input-field w-full" placeholder="0" value={form.bedCount.total} onChange={(e) => setField('bedCount', { ...form.bedCount, total: parseInt(e.target.value) || 0 })} />
                    {fieldNote('Total inpatient bed capacity. Set 0 for pure diagnostic centers.')}
                  </div>
                  <div>
                    <Label>ICU Beds</Label>
                    <input type="number" min={0} className="input-field w-full" placeholder="0" value={form.bedCount.icu} onChange={(e) => setField('bedCount', { ...form.bedCount, icu: parseInt(e.target.value) || 0 })} />
                    {fieldNote('Number of ICU/CCU beds. Setting this &gt; 0 auto-enables the ICU flag.')}
                  </div>
                </Section>

                {/* Operating Hours */}
                <Section icon={Clock} title="Operating Hours">
                  <div className="md:col-span-2">
                    <OperatingHoursEditor value={form.operatingHours} onChange={(v) => setField('operatingHours', v)} />
                  </div>
                </Section>

                {/* Registration / Legal */}
                <Section icon={FileText} title="Registration & Legal Details">
                  <div>
                    <Label required>License Number</Label>
                    <input className="input-field w-full" placeholder="AP/DMHO/2024/0001" value={form.registrationDetails.licenseNumber} onChange={(e) => setField('registrationDetails', { ...form.registrationDetails, licenseNumber: e.target.value })} />
                    {fieldNote('State health department / DMHO registration number. Must be unique.')}
                  </div>
                  <div>
                    <Label>License Expiry Date</Label>
                    <input type="date" className="input-field w-full" value={form.registrationDetails.licenseExpiry ? form.registrationDetails.licenseExpiry.split('T')[0] : ''} onChange={(e) => setField('registrationDetails', { ...form.registrationDetails, licenseExpiry: e.target.value })} />
                    {fieldNote('Registration renewal deadline. Alerts will be sent 30 days before expiry.')}
                  </div>
                  <div>
                    <Label>GST Number</Label>
                    <input className="input-field w-full" placeholder="29ABCDE1234F1Z5" value={form.registrationDetails.gstNumber} onChange={(e) => setField('registrationDetails', { ...form.registrationDetails, gstNumber: e.target.value })} />
                    {fieldNote('15-character GST number for tax invoicing.')}
                  </div>
                  <div>
                    <Label>PAN Number</Label>
                    <input className="input-field w-full" placeholder="ABCDE1234F" maxLength={10} value={form.registrationDetails.panNumber} onChange={(e) => setField('registrationDetails', { ...form.registrationDetails, panNumber: e.target.value.toUpperCase() })} />
                    {fieldNote('10-character PAN in AAAAA9999A format. Required for settlements.')}
                  </div>
                  <div className="md:col-span-2">
                    <ImageOrUrlField label="License Document URL" note="Upload a scanned copy of the registration certificate (PDF or image)." placeholder="https://cdn.example.com/license.pdf" value={form.registrationDetails.documentUrl} onChange={(url) => setField('registrationDetails', { ...form.registrationDetails, documentUrl: url })} folder="labs/documents" />
                  </div>
                </Section>

                {/* Platform Fee */}
                <Section icon={CreditCard} title="Platform Fee & Settlement">
                  <div>
                    <Label>Platform Fee Type</Label>
                    <select className="input-field w-full" value={form.platformFee?.type || ''} onChange={(e) => setField('platformFee', form.platformFee ? { ...form.platformFee, type: e.target.value } : { type: e.target.value, value: 0 })}>
                      <option value="">Use Global Default</option>
                      <option value="fixed">Fixed (₹ per transaction)</option>
                      <option value="percentage">Percentage (% of transaction)</option>
                    </select>
                    {fieldNote('Leave blank to use the global PlatformPricingConfig. Override only for special cases.')}
                  </div>
                  <div>
                    <Label>Platform Fee Value</Label>
                    <input type="number" min={0} step="0.01" className="input-field w-full" placeholder={form.platformFee?.type === 'fixed' ? '₹200' : '8%'} value={form.platformFee?.value ?? ''} onChange={(e) => setField('platformFee', form.platformFee ? { ...form.platformFee, value: parseFloat(e.target.value) } : null)} disabled={!form.platformFee?.type} />
                    {fieldNote('Enter ₹ amount for fixed or % for percentage. Max 100% for percentage type.')}
                  </div>
                  <div>
                    <Label>Settlement Cycle</Label>
                    <select className="input-field w-full" value={form.settlementCycle || ''} onChange={(e) => setField('settlementCycle', e.target.value || null)}>
                      <option value="">Use Global Default</option>
                      {SETTLEMENT_CYCLES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                    {fieldNote('How often settlements are paid out to this lab. Defaults to global config.')}
                  </div>
                </Section>

                {/* Save */}
                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setView('list')} className="btn-secondary py-3 px-6">Cancel</button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading.createHospital || loading.updateHospitalProfile}
                    className="btn-primary-cta py-3 px-8 flex items-center gap-2"
                  >
                    {(loading.createHospital || loading.updateHospitalProfile) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {view === 'create' ? 'Create Lab' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Detail View ─────────────────────────────────────────────── */}
          {view === 'detail' && selected && (
            <motion.div key="detail" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setView('list')} className="p-2 rounded-lg bg-base-200 hover:bg-base-300">
                  <X size={15} />
                </button>
                <h2 className="text-lg font-extrabold font-family-montserrat truncate">{selected.name}</h2>
                <span className="badge badge-primary text-xs">{selected.hospitalType}</span>
              </div>
              <LabDetail lab={selected} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Platform Fee Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showPlatformFeeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowPlatformFeeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-bold text-md flex items-center gap-2"><CreditCard size={20} className="text-primary mr-4" /> Platform Fee Override</h5>
                <button onClick={() => setShowPlatformFeeModal(false)}><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Fee Type</Label>
                  <select className="input-field w-full" value={platformFeeForm.type} onChange={(e) => setPlatformFeeForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="fixed">Fixed (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <Label>Value</Label>
                  <input type="number" min={0} step="0.01" className="input-field w-full" placeholder={platformFeeForm.type === 'fixed' ? 'e.g. 200' : 'e.g. 8'} value={platformFeeForm.value} onChange={(e) => setPlatformFeeForm((f) => ({ ...f, value: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPlatformFeeModal(false)} className="btn-secondary flex-1 py-2">Cancel</button>
                  <button onClick={handlePlatformFee} className="btn-primary-cta flex-1 py-2" disabled={loading.updateHospitalPlatformFee}>
                    {loading.updateHospitalPlatformFee ? <Loader2 size={14} className="animate-spin" /> : 'Save Override'}
                  </button>
                </div>
                <button
                  className="w-full text-xs text-error hover:underline text-center"
                  onClick={() => {
                    setPlatformFeeForm({ type: 'percentage', value: '' });
                    dispatch(updateHospitalPlatformFee({ id: activePlatformTarget, platformFee: null })).then(() => {
                      setShowPlatformFeeModal(false);
                      dispatch(fetchAllHospitals({ page, limit: 50, verified: 'false' }));
                    });
                  }}
                >
                  Clear override → use global default
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="card p-6 w-full max-w-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-error/10"><Trash2 size={18} className="text-error" /></div>
                <h3 className="font-bold">Delete Lab?</h3>
              </div>
              <p className="text-sm text-base-content/60 mb-4">This action is permanent and cannot be undone. The lab and all linked data will be removed.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 py-2">Cancel</button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 rounded-lg bg-error text-error-content font-bold text-sm hover:opacity-90 transition-opacity"
                  disabled={loading.deleteHospital}
                >
                  {loading.deleteHospital ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Lab Card ──────────────────────────────────────────────────────────────────

function LabCard({ lab, onEdit, onDetail, onVerify, onToggle, onDelete, onPlatformFee, loading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeIcon = { Clinic: Stethoscope, 'Diagnostic Center': Microscope, 'Nursing Home': Hospital };
  const Icon = typeIcon[lab.hospitalType] || FlaskConical;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="card   group"
    >
      {/* Cover / Logo */}
      <div className="relative h-32 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-t-xl  overflow-hidden">
        {lab.images?.[0] ? (
          <img src={lab.images[0]} alt={lab.name} className="w-full h-full rounded-t-xl overflow-hidden object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon size={40} className="text-primary/30" />
          </div>
        )}
        {lab.logo && (
          <div className="absolute bottom-2 left-3 w-10 h-10 rounded-lg border-2 border-base-100 overflow-hidden bg-base-100">
            <img src={lab.logo} alt="logo" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          {lab.isVerified ? <span className="badge badge-success py-0.5 px-2 text-xs">✓ Verified</span> : <span className="badge badge-warning py-0.5 px-2 text-xs">Pending</span>}
          {!lab.isActive && <span className="badge badge-error py-0.5 px-2 text-xs">Inactive</span>}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-sm truncate text-base-content">{lab.name}</h3>
            <p className="text-xs text-base-content/50 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {lab.address?.city || '—'}
            </p>
          </div>
          <div ref={menuRef} className="relative flex-shrink-0">
            <button onClick={() => setMenuOpen((o) => !o)} className="p-1.5 rounded-lg hover:bg-base-200 transition-colors">
              <MoreVertical size={14} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 top-8 z-30 card py-1 w-44 shadow-lg"
                >
                  {[
                    { label: 'View Details', icon: Eye, action: onDetail },
                    { label: 'Edit', icon: Edit3, action: onEdit },
                    { label: lab.isVerified ? 'Unverify' : 'Verify', icon: lab.isVerified ? XCircle : CheckCircle2, action: () => onVerify(!lab.isVerified) },
                    { label: lab.isActive ? 'Deactivate' : 'Activate', icon: lab.isActive ? ToggleLeft : ToggleRight, action: onToggle },
                    { label: 'Platform Fee', icon: CreditCard, action: onPlatformFee },
                    { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
                  ].map(({ label, icon: MenuIcon, action, danger }) => (
                    <button
                      key={label}
                      onClick={() => { action(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-base-200 transition-colors ${danger ? 'text-error' : 'text-base-content'}`}
                    >
                      <MenuIcon size={13} /> {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Badge row */}
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="badge badge-primary text-xs py-0.5">{lab.hospitalType}</span>
          {lab.nabledLabAvailable && <span className="badge badge-success text-xs py-0.5">NABL</span>}
          {lab.is24x7 && <span className="badge badge-info text-xs py-0.5">24×7</span>}
          {lab.isEmergencyReady && <span className="badge badge-error text-xs py-0.5">Emergency</span>}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-base-content/50">
          <span className="flex items-center gap-1"><Star size={10} className="text-warning" />{(lab.rating?.averageRating || 0).toFixed(1)}</span>
          <span className="flex items-center gap-1"><Users size={10} />{lab.rating?.totalRatings || 0} reviews</span>
          <span className="flex items-center gap-1"><Bed size={10} />{lab.bedCount?.total || 0} beds</span>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-base-300">
          <button onClick={onDetail} className="flex-1 py-1.5 rounded-lg bg-base-200 hover:bg-base-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1">
            <Eye size={12} /> View
          </button>
          <button onClick={onEdit} className="flex-1 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1">
            <Edit3 size={12} /> Edit
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Lab Detail ─────────────────────────────────────────────────────────────────

function LabDetail({ lab }) {
  const sections = [
    { title: 'Contact', items: [
      { label: 'Phone', value: lab.contact?.phone },
      { label: 'Email', value: lab.contact?.email },
      { label: 'WhatsApp', value: lab.contact?.whatsapp },
      { label: 'Website', value: lab.contact?.website },
      { label: 'Emergency', value: lab.contact?.emergencyPhone },
    ]},
    { title: 'Address', items: [
      { label: 'Line 1', value: lab.address?.line1 },
      { label: 'Line 2', value: lab.address?.line2 },
      { label: 'City', value: lab.address?.city },
      { label: 'State', value: lab.address?.state },
      { label: 'PIN', value: lab.address?.pincode },
      { label: 'Landmark', value: lab.address?.landmark },
    ]},
    { title: 'Registration', items: [
      { label: 'License No.', value: lab.registrationDetails?.licenseNumber },
      { label: 'GST', value: lab.registrationDetails?.gstNumber },
      { label: 'PAN', value: lab.registrationDetails?.panNumber },
      { label: 'Expiry', value: lab.registrationDetails?.licenseExpiry ? new Date(lab.registrationDetails.licenseExpiry).toLocaleDateString('en-IN') : '—' },
    ]},
    { title: 'Platform', items: [
      { label: 'Platform Fee', value: lab.platformFee ? `${lab.platformFee.type === 'fixed' ? '₹' : ''}${lab.platformFee.value}${lab.platformFee.type === 'percentage' ? '%' : ''}` : 'Global Default' },
      { label: 'Settlement', value: lab.settlementCycle || 'Global Default' },
      { label: 'Avg Rating', value: `${(lab.rating?.averageRating || 0).toFixed(1)} / 5` },
      { label: 'Total Ratings', value: lab.rating?.totalRatings || 0 },
    ]},
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="h-48 relative bg-gradient-to-br from-primary/10 to-secondary/10">
          {lab.images?.[0] && <img src={lab.images[0]} alt={lab.name} className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            {lab.logo && <div className="w-14 h-14 rounded-xl border-2 border-white overflow-hidden"><img src={lab.logo} alt="logo" className="w-full h-full object-cover" /></div>}
            <div>
              <h2 className="text-white font-extrabold text-xl">{lab.name}</h2>
              <div className="flex gap-2 mt-1">
                <span className="badge badge-primary text-xs py-0.5">{lab.hospitalType}</span>
                {lab.isVerified && <span className="badge badge-success text-xs py-0.5">Verified</span>}
                {lab.nabledLabAvailable && <span className="badge badge-info text-xs py-0.5">NABL</span>}
              </div>
            </div>
          </div>
        </div>
        {lab.description && <p className="px-5 py-4 text-sm text-base-content/70 leading-relaxed">{lab.description}</p>}
      </div>

      {/* Gallery */}
      {lab.images?.length > 1 && (
        <div className="card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Image size={14} className="text-primary" /> Gallery</h3>
          <div className="flex flex-wrap gap-2">
            {lab.images.map((url, i) => (
              <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-base-300">
                <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(({ title, items }) => (
          <div key={title} className="card p-5">
            <h3 className="font-bold text-sm mb-3 text-primary">{title}</h3>
            <dl className="space-y-2">
              {items.filter((i) => i.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-base-content/50 font-medium">{label}</dt>
                  <dd className="font-semibold text-right max-w-[60%] truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Chips */}
      {[
        { title: 'Specialties', items: lab.specialties },
        { title: 'Facilities', items: lab.facilities },
        { title: 'Accepted Schemes', items: lab.acceptedSchemes },
        { title: 'Accreditations', items: lab.accreditations },
      ].filter((s) => s.items?.length).map(({ title, items }) => (
        <div key={title} className="card p-5">
          <h3 className="font-bold text-sm mb-3">{title}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => <span key={item} className="badge badge-primary text-xs">{item}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}