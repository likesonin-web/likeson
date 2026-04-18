'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Search, Filter, ChevronDown, ChevronUp,
  Star, CheckCircle2, XCircle, Clock, Wifi, WifiOff, Eye,
  Trash2, Link2, Link2Off, Upload, ExternalLink, BarChart3,
  Calendar, Stethoscope, Award, AlertCircle, X, ArrowLeft,
  MoreVertical, RefreshCw, Building2, Phone, Mail, ImageIcon,
  FileText, Loader2, TrendingUp, Activity, Shield, ChevronRight,
  UserCheck, Clipboard, BookOpen
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

import {
  fetchLinkedDoctors,
  fetchLinkedDoctorById,
  searchUnlinkedDoctors,
  createAndOnboardDoctor,
  unlinkDoctor,
  fetchDoctorAvailability,
  fetchDoctorStats,
  selectLinkedDoctors,
  selectDoctorsPagination,
  selectSelectedDoctor,
  selectSearchResults,
  selectDoctorStats,
  selectDoctorAvailability,
  isLoading,
  getError,
} from '@/store/slices/hospitalManagerSlice';

// ─── Constants ───────────────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
  'Oncologist', 'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist',
  'Dermatologist', 'Urologist', 'Psychiatry', 'Physiotherapist',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const slideIn = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.25 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.2 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (name = '') =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const statusColor = (verified, active) => {
  if (!active) return 'text-error border-error bg-error/10';
  if (verified) return 'text-success border-success bg-success/10';
  return 'text-warning border-warning bg-warning/10';
};

const statusLabel = (verified, active) => {
  if (!active) return 'Inactive';
  if (verified) return 'Verified';
  return 'Pending';
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** Reusable field note */
const FieldNote = ({ children }) => (
  <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
    {children}
  </p>
);

/** Input with label + note */
const FormField = ({ label, note, required, error, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-sm font-semibold" style={{ color: 'var(--color-base-content)' }}>
      {label} {required && <span className="text-error">*</span>}
    </label>
    {children}
    {note && <FieldNote>{note}</FieldNote>}
    {error && <p className="text-xs text-error mt-0.5">{error}</p>}
  </div>
);

/** Dual-mode image/doc input: upload file OR paste URL */
const DualMediaInput = ({ label, note, required, value, onChange, accept = 'image/*', fieldName }) => {
  const [mode, setMode] = useState('url'); // 'url' | 'upload'
  const fileRef = useRef();

  return (
    <FormField label={label} note={note} required={required}>
      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-base-300)' }}>
        {['url', 'upload'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all duration-200"
            style={{
              background: mode === m ? 'var(--color-primary)' : 'var(--color-base-200)',
              color: mode === m ? 'var(--color-primary-content)' : 'color-mix(in oklch, var(--color-base-content) 70%, transparent)',
            }}
          >
            {m === 'url' ? <><Link2 size={13} /> Paste URL</> : <><Upload size={13} /> Upload File</>}
          </button>
        ))}
      </div>

      {mode === 'url' ? (
        <input
          type="url"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="input-field w-full mt-2 text-sm"
        />
      ) : (
        <div
          className="mt-2 border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200"
          style={{ borderColor: 'var(--color-primary)', background: 'color-mix(in oklch, var(--color-primary) 6%, transparent)' }}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon size={22} style={{ color: 'var(--color-primary)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
            Click to browse or drag & drop
          </p>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}>
            Supported: JPG, PNG, WebP, PDF (max 10 MB)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onChange(file);
            }}
          />
          {value instanceof File && (
            <span className="text-xs font-semibold text-success">{value.name}</span>
          )}
        </div>
      )}
    </FormField>
  );
};

/** Stat card */
const StatTile = ({ icon: Icon, label, value, color, index }) => (
  <motion.div
    variants={fadeUp}
    custom={index}
    initial="hidden"
    animate="visible"
    className="stat-card flex items-center gap-4"
    style={{ borderLeft: `4px solid ${color}` }}
  >
    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}>
      <Icon size={22} style={{ color }} />
    </div>
    <div>
      <p className="stat-card-value" style={{ color, fontSize: '1.6rem' }}>{value}</p>
      <p className="stat-card-label">{label}</p>
    </div>
  </motion.div>
);

/** Doctor avatar */
const DoctorAvatar = ({ doctor, size = 44 }) => {
  const name = doctor?.user?.name || doctor?.name || '';
  const photo = doctor?.profilePhotoUrl || doctor?.user?.avatar;
  return photo ? (
    <img src={photo} alt={name} className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm"
      style={{ width: size, height: size, background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}>
      {getInitials(name)}
    </div>
  );
};

/** Day pill for availability */
const DayPill = ({ day, available, slots }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs font-bold uppercase" style={{
      color: available ? 'var(--color-success)' : 'color-mix(in oklch, var(--color-base-content) 40%, transparent)'
    }}>
      {day.slice(0, 3)}
    </span>
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
      style={{
        background: available ? 'color-mix(in oklch, var(--color-success) 15%, transparent)' : 'var(--color-base-300)',
        color: available ? 'var(--color-success)' : 'color-mix(in oklch, var(--color-base-content) 40%, transparent)',
        border: `2px solid ${available ? 'var(--color-success)' : 'var(--color-base-300)'}`,
      }}>
      {available ? slots : '—'}
    </div>
  </div>
);

// ─── Onboard Doctor Modal ────────────────────────────────────────────────────

const OnboardModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const loading = useSelector(isLoading(createAndOnboardDoctor));
  const [form, setForm] = useState({
    name: '', email: '', phone: '', specialization: '',
    experienceYears: '', registrationNumber: '',
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address';
    if (!form.specialization) e.specialization = 'Select a specialization';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const result = await dispatch(createAndOnboardDoctor({
      ...form,
      experienceYears: Number(form.experienceYears) || 0,
    }));
    if (!result.error) {
      dispatch(fetchLinkedDoctors());
      dispatch(fetchDoctorStats());
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose} />
      <motion.div
        variants={scaleIn} initial="hidden" animate="visible" exit="exit"
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--color-base-100)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{ background: 'var(--color-base-100)', borderColor: 'var(--color-base-300)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-display)' }}>
                Onboard New Doctor
              </h2>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                Create account & link to your hospital
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-base-200)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Alert info */}
          <div className="col-span-full alert alert-info rounded-xl">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-info)' }} />
            <div>
              <p className="text-sm font-semibold">Managed Hospital Pricing</p>
              <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)' }}>
                This doctor will be linked to your hospital. Consultation fees are governed by your hospital's pricing policy — the doctor cannot set their own fees.
              </p>
            </div>
          </div>

          {/* Name */}
          <FormField label="Full Name" required note="Doctor's full name as per medical council registration" error={errors.name} className="col-span-full sm:col-span-1">
            <input
              className="input-field w-full"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Dr. Ravi Kumar"
            />
          </FormField>

          {/* Email */}
          <FormField label="Email Address" required note="Login credentials will be sent to this email" error={errors.email} className="col-span-full sm:col-span-1">
            <input
              type="email"
              className="input-field w-full"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="doctor@hospital.com"
            />
          </FormField>

          {/* Phone */}
          <FormField label="Phone Number" note="Indian mobile number (10 digits). Will be auto-formatted to E.164 (+91XXXXXXXXXX)" className="col-span-full sm:col-span-1">
            <input
              type="tel"
              className="input-field w-full"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="9876543210"
            />
          </FormField>

          {/* Specialization */}
          <FormField label="Specialization" required note="Medical specialty per MCI classification" error={errors.specialization} className="col-span-full sm:col-span-1">
            <select className="input-field w-full" value={form.specialization}
              onChange={e => set('specialization', e.target.value)}>
              <option value="">Select specialization…</option>
              {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>

          {/* Experience */}
          <FormField label="Years of Experience" note="Enter 0 for freshers / interns. Range: 0–70 years" className="col-span-full sm:col-span-1">
            <input
              type="number"
              min={0} max={70}
              className="input-field w-full"
              value={form.experienceYears}
              onChange={e => set('experienceYears', e.target.value)}
              placeholder="5"
            />
          </FormField>

          {/* Registration Number */}
          <FormField label="MCI / State Council Registration No." note="MCI or State Medical Council registration number. Leave blank if pending — doctor can add later." className="col-span-full sm:col-span-1">
            <input
              className="input-field w-full"
              value={form.registrationNumber}
              onChange={e => set('registrationNumber', e.target.value)}
              placeholder="MH12345/2020"
            />
          </FormField>

          {/* Security note */}
          <div className="col-span-full rounded-xl p-4 flex gap-3"
            style={{ background: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }}>
            <Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 80%, transparent)' }}>
              A <strong>secure temporary password</strong> will be auto-generated and sent via email. The doctor must change it on first login. All sessions are audited.
            </p>
          </div>

          {/* Actions */}
          <div className="col-span-full flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2.5 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary-cta px-6 py-2.5 text-sm flex items-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading ? 'Creating Account…' : 'Onboard Doctor'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Link Existing Doctor Modal ──────────────────────────────────────────────

const SearchLinkModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const searchResults = useSelector(selectSearchResults);
  const searchLoading = useSelector(isLoading(searchUnlinkedDoctors));
  const [query, setQuery] = useState('');
  const [spec, setSpec] = useState('');
  const [linking, setLinking] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(searchUnlinkedDoctors({ q: query, specialization: spec }));
    }, 400);
    return () => clearTimeout(t);
  }, [query, spec, dispatch]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose} />
      <motion.div
        variants={scaleIn} initial="hidden" animate="visible" exit="exit"
        className="relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-base-100)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-base-300)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-secondary)', color: 'var(--color-secondary-content)' }}>
              <Link2 size={17} />
            </div>
            <h2 className="text-base font-black" style={{ fontFamily: 'var(--font-display)' }}>
              Link Existing Doctor
            </h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-base-200)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b" style={{ borderColor: 'var(--color-base-300)' }}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }} />
            <input
              className="input-field w-full pl-9"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or email…"
            />
          </div>
          <select className="input-field w-full text-sm" value={spec} onChange={e => setSpec(e.target.value)}>
            <option value="">All Specializations</option>
            {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <FieldNote>Only verified, active doctors not yet linked to your hospital appear here.</FieldNote>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {searchLoading && (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--color-primary)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Searching…</span>
            </div>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-center py-10">
              <Users size={32} className="mx-auto mb-3" style={{ color: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
              <p className="text-sm font-semibold">No doctors found</p>
              <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}>
                Try a different name or use "Onboard" to create a new account
              </p>
            </div>
          )}
          {searchResults.map(doc => (
            <div key={doc._id}
              className="flex items-center gap-3 p-3 rounded-xl border transition-all"
              style={{ borderColor: 'var(--color-base-300)', background: 'var(--color-base-200)' }}>
              <DoctorAvatar doctor={doc} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{doc.user?.name}</p>
                <p className="text-xs truncate" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                  {doc.specialization} · {doc.experienceYears}y exp
                </p>
                <p className="text-xs truncate" style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }}>
                  {doc.user?.email}
                </p>
              </div>
              {doc.isVerified && (
                <CheckCircle2 size={15} className="flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              )}
              <button
                disabled={linking === doc._id}
                onClick={() => {
                  setLinking(doc._id);
                  /* TODO: dispatch linkDoctor thunk if added */
                  setTimeout(() => { setLinking(null); onClose(); }, 800);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}
              >
                {linking === doc._id ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Link
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Doctor Detail Panel ─────────────────────────────────────────────────────

const DoctorDetailPanel = ({ doctorId, onBack }) => {
  const dispatch = useDispatch();
  const doctor = useSelector(selectSelectedDoctor);
  const availability = useSelector(selectDoctorAvailability);
  const detailLoading = useSelector(isLoading(fetchLinkedDoctorById));
  const availLoading = useSelector(isLoading(fetchDoctorAvailability));
  const [unlinking, setUnlinking] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    dispatch(fetchLinkedDoctorById(doctorId));
    dispatch(fetchDoctorAvailability(doctorId));
  }, [doctorId, dispatch]);

  const handleUnlink = async () => {
    if (!confirm(`Unlink Dr. ${doctor?.user?.name} from your hospital? This will notify them.`)) return;
    setUnlinking(true);
    await dispatch(unlinkDoctor(doctorId));
    setUnlinking(false);
    onBack();
  };

  if (detailLoading || !doctor) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm font-medium">Loading doctor profile…</p>
        </div>
      </div>
    );
  }

  const d = doctor;
  const name = d.user?.name || 'Doctor';
  const avail = availability?.availability || [];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Stethoscope },
    { id: 'availability', label: 'Availability', icon: Calendar },
    { id: 'credentials', label: 'Credentials', icon: Award },
  ];

  return (
    <motion.div variants={slideIn} initial="hidden" animate="visible" exit="exit"
      className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b mb-5"
        style={{ borderColor: 'var(--color-base-300)' }}>
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'var(--color-base-200)' }}>
          <ArrowLeft size={17} />
        </button>
        <DoctorAvatar doctor={d} size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-black truncate" style={{ fontFamily: 'var(--font-display)' }}>
              Dr. {name}
            </h2>
            <span className={`badge text-xs ${statusColor(d.isVerified, d.isActive)}`}>
              {statusLabel(d.isVerified, d.isActive)}
            </span>
          </div>
          <p className="text-sm truncate" style={{ color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)' }}>
            {d.specialization} · {d.experienceYears}y experience
          </p>
        </div>
        <button
          onClick={handleUnlink}
          disabled={unlinking}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          style={{ background: 'color-mix(in oklch, var(--color-error) 12%, transparent)', color: 'var(--color-error)', border: '1px solid color-mix(in oklch, var(--color-error) 30%, transparent)' }}
        >
          {unlinking ? <Loader2 size={13} className="animate-spin" /> : <Link2Off size={13} />}
          Unlink
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--color-base-200)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all"
            style={{
              background: tab === t.id ? 'var(--color-base-100)' : 'transparent',
              color: tab === t.id ? 'var(--color-primary)' : 'color-mix(in oklch, var(--color-base-content) 55%, transparent)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.div key="overview" variants={fadeUp} initial="hidden" animate="visible" className="space-y-4">
              {/* Contact info */}
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-black" style={{ fontFamily: 'var(--font-display)' }}>Contact Information</h3>
                {[
                  { icon: Mail, val: d.user?.email, label: 'Email' },
                  { icon: Phone, val: d.user?.phone, label: 'Phone' },
                ].map(({ icon: Icon, val, label }) => val && (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <Icon size={14} style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <span className="font-medium">{val}</span>
                      <span className="text-xs ml-2" style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }}>({label})</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Consultation types */}
              <div className="card p-4">
                <h3 className="text-sm font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Consultation Types</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'inPerson', label: 'In-Person' },
                    { key: 'video', label: 'Video' },
                    { key: 'homeVisit', label: 'Home Visit' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex flex-col items-center gap-1 p-3 rounded-xl"
                      style={{
                        background: d.consultationTypes?.[key]
                          ? 'color-mix(in oklch, var(--color-success) 10%, transparent)'
                          : 'var(--color-base-200)',
                        border: `1px solid ${d.consultationTypes?.[key] ? 'color-mix(in oklch, var(--color-success) 30%, transparent)' : 'var(--color-base-300)'}`,
                      }}>
                      {d.consultationTypes?.[key]
                        ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                        : <XCircle size={16} style={{ color: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />}
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rating */}
              {d.rating && (
                <div className="card p-4">
                  <h3 className="text-sm font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Rating</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center"
                      style={{ background: 'var(--color-accent)', color: 'var(--color-accent-content)' }}>
                      <span className="text-xl font-black">{(d.rating.averageRating || 0).toFixed(1)}</span>
                    </div>
                    <div>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={14} fill={i <= Math.round(d.rating.averageRating || 0) ? 'var(--color-accent)' : 'none'}
                            style={{ color: 'var(--color-accent)' }} />
                        ))}
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                        {d.rating.totalRatings || 0} ratings · {d.rating.totalReviews || 0} reviews
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing note */}
              <div className="rounded-xl p-4 flex gap-3"
                style={{ background: 'color-mix(in oklch, var(--color-info) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-info) 25%, transparent)' }}>
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-info)' }} />
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 75%, transparent)' }}>
                  <strong>Pricing Note:</strong> This doctor's consultation fees are governed by your hospital's pricing policy. The doctor cannot independently set or override their fees.
                </p>
              </div>
            </motion.div>
          )}

          {tab === 'availability' && (
            <motion.div key="availability" variants={fadeUp} initial="hidden" animate="visible" className="space-y-4">
              {availLoading ? (
                <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--color-primary)' }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Loading schedule…</span>
                </div>
              ) : (
                <>
                  <div className="card p-4">
                    <h3 className="text-sm font-black mb-4" style={{ fontFamily: 'var(--font-display)' }}>Weekly Schedule</h3>
                    <div className="flex justify-between">
                      {DAYS.map(day => {
                        const entry = avail.find(a => a.day === day);
                        return (
                          <DayPill
                            key={day}
                            day={day}
                            available={entry?.isAvailable ?? false}
                            slots={entry?.slots?.filter(s => s.isActive).length || 0}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {avail.filter(a => a.isAvailable).map(dayEntry => (
                    <div key={dayEntry.day} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold">{dayEntry.day}</h4>
                        <span className="badge badge-success text-xs">{dayEntry.slots?.filter(s => s.isActive).length || 0} slots</span>
                      </div>
                      <div className="space-y-2">
                        {dayEntry.slots?.filter(s => s.isActive).map((slot, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                            style={{ background: 'var(--color-base-200)' }}>
                            <div className="flex items-center gap-2">
                              <Clock size={13} style={{ color: 'var(--color-primary)' }} />
                              <span className="text-xs font-semibold">{slot.startTime} – {slot.endTime}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                                Max {slot.maxPatients} patients
                              </span>
                              <span className="badge badge-info text-xs">{slot.consultationType}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {avail.length === 0 && (
                    <div className="text-center py-10">
                      <Calendar size={32} className="mx-auto mb-3" style={{ color: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
                      <p className="text-sm font-semibold">No availability set</p>
                      <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}>
                        The doctor hasn't configured their weekly schedule yet
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl p-3 flex gap-2"
                    style={{ background: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)' }}>
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 70%, transparent)' }}>
                      Availability is <strong>doctor-controlled</strong>. Hospital managers can view but cannot modify slot timings.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {tab === 'credentials' && (
            <motion.div key="credentials" variants={fadeUp} initial="hidden" animate="visible" className="space-y-4">
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-black" style={{ fontFamily: 'var(--font-display)' }}>Professional Credentials</h3>
                {[
                  { label: 'Registration Number', val: d.registrationNumber },
                  { label: 'Registration Council', val: d.registrationCouncil },
                  { label: 'Partnership Status', val: d.partnershipStatus },
                  { label: 'KYC Status', val: d.kycStatus },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                      {label}
                    </span>
                    <span className="text-xs font-bold text-right">{val || '—'}</span>
                  </div>
                ))}
              </div>

              {d.qualifications?.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Qualifications</h3>
                  <div className="space-y-2">
                    {d.qualifications.map((q, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                        style={{ background: 'var(--color-base-200)' }}>
                        <BookOpen size={13} style={{ color: 'var(--color-primary)' }} />
                        <div>
                          <span className="text-xs font-bold">{q.degree}</span>
                          {q.college && <span className="text-xs ml-2" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>— {q.college}</span>}
                          {q.year && <span className="text-xs ml-1" style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }}>({q.year})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {d.languagesSpoken?.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-black mb-3" style={{ fontFamily: 'var(--font-display)' }}>Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {d.languagesSpoken.map(lang => (
                      <span key={lang} className="badge badge-primary text-xs">{lang}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─── Doctor Card ─────────────────────────────────────────────────────────────

const DoctorCard = ({ doctor, index, onView, onUnlink }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const d = doctor;
  const name = d.user?.name || 'Doctor';

  return (
    <motion.div
      variants={fadeUp} custom={index} initial="hidden" animate="visible"
      className="card group relative overflow-hidden"
    >
      {/* Online indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {d.isOnline
          ? <><div className="w-2 h-2 rounded-full bg-success animate-pulse" /><span className="text-xs font-semibold text-success">Online</span></>
          : <><div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-base-300)' }} /><span className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }}>Offline</span></>
        }
      </div>

      <div className="p-4">
        {/* Top */}
        <div className="flex items-start gap-3 mb-4">
          <DoctorAvatar doctor={d} size={52} />
          <div className="flex-1 min-w-0 pr-16">
            <h3 className="font-black text-sm leading-tight truncate" style={{ fontFamily: 'var(--font-display)' }}>
              Dr. {name}
            </h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)' }}>
              {d.specialization}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`badge text-xs px-2 py-0.5 ${statusColor(d.isVerified, d.isActive)}`}>
                {statusLabel(d.isVerified, d.isActive)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { val: `${d.experienceYears || 0}y`, label: 'Exp.' },
            { val: (d.rating?.averageRating || 0).toFixed(1), label: 'Rating', icon: Star },
            { val: d.consultationTypes ? Object.values(d.consultationTypes).filter(Boolean).length : 0, label: 'Types' },
          ].map(({ val, label, icon: Icon }) => (
            <div key={label} className="text-center py-2 rounded-lg" style={{ background: 'var(--color-base-200)' }}>
              <div className="flex items-center justify-center gap-1">
                {Icon && <Icon size={10} style={{ color: 'var(--color-accent)' }} fill="var(--color-accent)" />}
                <span className="text-sm font-black" style={{ color: 'var(--color-primary)' }}>{val}</span>
              </div>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onView(d._id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}
          >
            <Eye size={13} /> View Profile
          </button>
          <button
            onClick={() => onUnlink(d._id, name)}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
            style={{ background: 'color-mix(in oklch, var(--color-error) 10%, transparent)', color: 'var(--color-error)' }}
          >
            <Link2Off size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Analytics Panel ─────────────────────────────────────────────────────────

const AnalyticsPanel = ({ stats }) => {
  if (!stats) return null;

  const pieData = stats.bySpecialization?.slice(0, 6).map(({ _id, count }) => ({
    name: _id || 'Other', value: count,
  })) || [];

  const barData = [
    { name: 'Total', value: stats.total || 0, fill: 'var(--color-chart-1)' },
    { name: 'Verified', value: stats.verified || 0, fill: 'var(--color-chart-2)' },
    { name: 'Active', value: stats.active || 0, fill: 'var(--color-chart-3)' },
    { name: 'Online', value: stats.online || 0, fill: 'var(--color-chart-4)' },
    { name: 'Unverified', value: stats.unverified || 0, fill: 'var(--color-chart-6)' },
  ];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      {/* Bar chart */}
      <div className="card p-5">
        <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
          Doctor Status Overview
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} barSize={28}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-base-content)', fontFamily: 'var(--font-sans)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-base-content)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)', borderRadius: '10px', fontSize: 12 }}
              cursor={{ fill: 'color-mix(in oklch, var(--color-primary) 8%, transparent)' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart */}
      <div className="card p-5">
        <h3 className="text-sm font-black mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <Activity size={16} style={{ color: 'var(--color-secondary)' }} />
          By Specialization
        </h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={70} innerRadius={35} paddingAngle={2}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)', borderRadius: '10px', fontSize: 12 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-sans)' }}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }}>No specialization data available</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MedicalStaffManagement() {
  const dispatch = useDispatch();

  // Selectors
  const doctors = useSelector(selectLinkedDoctors);
  const pagination = useSelector(selectDoctorsPagination);
  const stats = useSelector(selectDoctorStats);
  const listLoading = useSelector(isLoading(fetchLinkedDoctors));
  const statsLoading = useSelector(isLoading(fetchDoctorStats));

  // Local UI state
  const [viewId, setViewId] = useState(null);        // detail panel
  const [showOnboard, setShowOnboard] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Initial load
  useEffect(() => {
    dispatch(fetchLinkedDoctors({ page, limit: 12, search, specialization: specFilter, isVerified: verifiedFilter }));
    dispatch(fetchDoctorStats());
  }, [dispatch, page, search, specFilter, verifiedFilter]);

  const handleUnlink = useCallback(async (id, name) => {
    if (!confirm(`Unlink Dr. ${name}? They will be notified and their hospital affiliation removed.`)) return;
    await dispatch(unlinkDoctor(id));
    dispatch(fetchDoctorStats());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchLinkedDoctors({ page, limit: 12, search, specialization: specFilter, isVerified: verifiedFilter }));
    dispatch(fetchDoctorStats());
  };

  const statTiles = [
    { icon: Users, label: 'Total Doctors', value: stats?.total ?? '—', color: 'var(--color-chart-1)' },
    { icon: CheckCircle2, label: 'Verified', value: stats?.verified ?? '—', color: 'var(--color-chart-2)' },
    { icon: Activity, label: 'Active', value: stats?.active ?? '—', color: 'var(--color-chart-3)' },
    { icon: Wifi, label: 'Online Now', value: stats?.online ?? '—', color: 'var(--color-chart-4)' },
    { icon: AlertCircle, label: 'Unverified', value: stats?.unverified ?? '—', color: 'var(--color-chart-6)' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-base-100)' }}>
      {/* ─── Page Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b"
        style={{ background: 'var(--color-base-100)', borderColor: 'var(--color-base-300)', backdropFilter: 'blur(12px)' }}>
        <div className="container-custom py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}>
              <Stethoscope size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-base-content)' }}>
                Medical Staff
              </h1>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                Manage linked doctors & schedules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRefresh}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-base-200)' }}>
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowAnalytics(p => !p)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: showAnalytics ? 'var(--color-secondary)' : 'var(--color-base-200)',
                color: showAnalytics ? 'var(--color-secondary-content)' : 'var(--color-base-content)',
              }}
            >
              <BarChart3 size={14} />
              Analytics
            </button>
            <button
              onClick={() => setShowLink(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'var(--color-base-200)', color: 'var(--color-base-content)' }}
            >
              <Link2 size={14} />
              Link Existing
            </button>
            <button
              onClick={() => setShowOnboard(true)}
              className="btn-primary-cta flex items-center gap-2 px-5 py-2.5 text-xs"
            >
              <UserPlus size={14} />
              Onboard Doctor
            </button>
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        {/* ─── Two-column layout: main list + detail panel ─── */}
        <div className="flex gap-6">

          {/* ─── Left: main content ─── */}
          <div className="flex-1 min-w-0">

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {statTiles.map((t, i) => (
                <StatTile key={t.label} {...t} index={i} />
              ))}
            </div>

            {/* Analytics panel (collapsible) */}
            <AnimatePresence>
              {showAnalytics && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <AnalyticsPanel stats={stats} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search & Filter bar */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
              className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }} />
                <input
                  className="input-field w-full pl-9"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search doctor by name or email…"
                />
              </div>
              <button
                onClick={() => setFiltersOpen(p => !p)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
                style={{
                  background: filtersOpen ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'var(--color-base-200)',
                  borderColor: filtersOpen ? 'var(--color-primary)' : 'var(--color-base-300)',
                  color: filtersOpen ? 'var(--color-primary)' : 'var(--color-base-content)',
                }}
              >
                <Filter size={14} />
                Filters
                {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </motion.div>

            {/* Filter options */}
            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border"
                  style={{ background: 'var(--color-base-200)', borderColor: 'var(--color-base-300)', overflow: 'hidden' }}
                >
                  <FormField label="Specialization" note="Filter by doctor's specialty field">
                    <select className="input-field w-full text-sm" value={specFilter}
                      onChange={e => { setSpecFilter(e.target.value); setPage(1); }}>
                      <option value="">All Specializations</option>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Verification Status" note="KYC-verified doctors can accept digital bookings">
                    <select className="input-field w-full text-sm" value={verifiedFilter}
                      onChange={e => { setVerifiedFilter(e.target.value); setPage(1); }}>
                      <option value="">All Statuses</option>
                      <option value="true">Verified Only</option>
                      <option value="false">Unverified Only</option>
                    </select>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Doctor grid / list */}
            {listLoading ? (
              <div className="flex items-center justify-center py-16 gap-3"
                style={{ color: 'var(--color-primary)' }}>
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm font-medium">Loading doctors…</span>
              </div>
            ) : doctors.length === 0 ? (
              <motion.div variants={fadeUp} initial="hidden" animate="visible"
                className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--color-base-200)' }}>
                  <Users size={36} style={{ color: 'color-mix(in oklch, var(--color-base-content) 35%, transparent)' }} />
                </div>
                <h3 className="text-lg font-black mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  No Doctors Found
                </h3>
                <p className="text-sm max-w-xs mb-6" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                  {search || specFilter
                    ? 'No results match your current filters. Try adjusting your search.'
                    : 'Start building your medical team by onboarding or linking verified doctors.'}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLink(true)} className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
                    <Link2 size={15} /> Link Existing
                  </button>
                  <button onClick={() => setShowOnboard(true)} className="btn-primary-cta px-5 py-2.5 text-sm flex items-center gap-2">
                    <UserPlus size={15} /> Onboard Doctor
                  </button>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                  {doctors.map((doc, i) => (
                    <DoctorCard
                      key={doc._id}
                      doctor={doc}
                      index={i}
                      onView={id => setViewId(id)}
                      onUnlink={(id, name) => handleUnlink(id, name)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pagination?.pages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'var(--color-base-200)' }}
                    >
                      ← Prev
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className="w-8 h-8 rounded-lg text-sm font-bold transition-all"
                          style={{
                            background: page === p ? 'var(--color-primary)' : 'var(--color-base-200)',
                            color: page === p ? 'var(--color-primary-content)' : 'var(--color-base-content)',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={page >= pagination.pages}
                      onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'var(--color-base-200)' }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Right: detail panel ─── */}
          <AnimatePresence>
            {viewId && (
              <motion.aside
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 380 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex-shrink-0 hidden lg:flex flex-col border-l pl-6 overflow-hidden"
                style={{ borderColor: 'var(--color-base-300)', maxHeight: 'calc(100vh - 90px)', position: 'sticky', top: 90 }}
              >
                <DoctorDetailPanel
                  doctorId={viewId}
                  onBack={() => setViewId(null)}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Mobile doctor detail: full-screen overlay ─── */}
      <AnimatePresence>
        {viewId && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col lg:hidden"
            style={{ background: 'var(--color-base-100)' }}
          >
            <div className="container-custom py-4 flex-1 overflow-y-auto">
              <DoctorDetailPanel
                doctorId={viewId}
                onBack={() => setViewId(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Modals ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showOnboard && <OnboardModal onClose={() => setShowOnboard(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showLink && <SearchLinkModal onClose={() => setShowLink(false)} />}
      </AnimatePresence>
    </div>
  );
}