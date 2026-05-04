'use client';

/**
 * MyProfile.jsx — Likeson.in Driver Profile Page
 *
 * Fully corrected & extended for the driver role.
 * Wires ALL relevant thunks from transportPartnerSlice:
 *
 *  fetchDriverMe            updateDriverMe
 *  updateDriverPhoto        removeDriverPhoto
 *  updateDriverStatus       updateDriverShift
 *  updateDriverEmergencyContact
 *  updateDriverNotifPrefs
 *  fetchDriverOwnPerformance
 *  fetchDriverCoinHistory
 *  fetchDriverCompliance
 *  submitDriverKyc          reuploadDriverKycDocument  updateDriverLicenceNumbers
 *  updateDriverMedicalFitness
 *  updateDriverBank
 *  updateDriverOnboarding   completeDriverOnboarding
 *
 * Tabs: Overview · Performance · KYC & Docs · Rewards · Bank · Shift · Compliance · Coins
 *
 * Stack: Next.js 14 · Redux Toolkit · Tailwind + global.css · Lucide · Framer Motion
 */

import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  useEffect, useState, useCallback, useMemo, memo, Suspense,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  User, Phone, Mail, MapPin, Shield, Car, Star, Award, Clock,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, BadgeCheck,
  Activity, Wallet, TrendingUp, Calendar, Hash, Eye, EyeOff,
  Edit3, Save, X, FileText, CreditCard, Zap, Lock, Camera,
  Trash2, Upload, RefreshCw, AlertTriangle, ArrowUpCircle,
  Coins, BarChart3, CheckSquare,
} from 'lucide-react';

import {
  fetchDriverMe,
  updateDriverMe,
  updateDriverPhoto,
  removeDriverPhoto,
  updateDriverStatus,
  updateDriverShift,
  updateDriverEmergencyContact,
  updateDriverNotifPrefs,
  fetchDriverOwnPerformance,
  fetchDriverCoinHistory,
  fetchDriverCompliance,
  submitDriverKyc,
  reuploadDriverKycDocument,
  updateDriverLicenceNumbers,
  updateDriverMedicalFitness,
  updateDriverBank,
  updateDriverOnboarding,
  completeDriverOnboarding,
} from '@/store/slices/transportPartnerSlice';

// ─── Dynamic Framer Motion ────────────────────────────────────────────────────
const MotionDiv = dynamic(
  () => import('framer-motion').then((m) => m.motion.div),
  { ssr: false }
);

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Available', 'Offline', 'On-Break'];

const KYC_STATUS_CONFIG = {
  Verified:      { color: 'text-success',   bg: 'bg-success/10',  border: 'border-success\/40',  icon: CheckCircle2,  label: 'Verified' },
  'Under-Review':{ color: 'text-warning',   bg: 'bg-warning/10',  border: 'border-warning\/40',  icon: AlertCircle,   label: 'Under Review' },
  Pending:       { color: 'text-info',      bg: 'bg-info/10',     border: 'border-info\/30',     icon: Clock,         label: 'Pending' },
  Rejected:      { color: 'text-error',     bg: 'bg-error/10',    border: 'border-error\/40',    icon: XCircle,       label: 'Rejected' },
};

const DRIVER_STATUS_CONFIG = {
  Available:  { dot: 'bg-success', label: 'Available', badge: 'badge-success', pulse: true },
  'On-Trip':  { dot: 'bg-warning', label: 'On Trip',   badge: 'badge-warning', pulse: false },
  Offline:    { dot: 'bg-error',   label: 'Offline',   badge: 'badge-error',   pulse: false },
  'On-Break': { dot: 'bg-info',    label: 'On Break',  badge: 'badge-info',    pulse: false },
  Suspended:  { dot: 'bg-error',   label: 'Suspended', badge: 'badge-error',   pulse: false },
};

const TIER_CONFIG = {
  Diamond:  { color: 'text-info',      bg: 'bg-info/10',     label: '💎 Diamond',  rides: 1000 },
  Platinum: { color: 'text-primary',   bg: 'bg-primary/10',  label: '🏆 Platinum', rides: 1000 },
  Gold:     { color: 'text-accent',    bg: 'bg-accent/5',    label: '🥇 Gold',     rides: 500 },
  Silver:   { color: 'text-secondary', bg: 'bg-secondary/20',label: '🥈 Silver',   rides: 200 },
  Bronze:   { color: 'text-warning',   bg: 'bg-warning/5',   label: '🥉 Bronze',   rides: 50 },
};

const COMPLIANCE_STATUS = {
  valid:          { color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2, label: 'Valid' },
  expiring_soon:  { color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle, label: 'Expiring Soon' },
  expired:        { color: 'text-error',   bg: 'bg-error/10',   icon: XCircle,       label: 'Expired' },
  missing:        { color: 'text-error',   bg: 'bg-error/10',   icon: AlertCircle,   label: 'Missing' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v) => v != null ? v : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN') : '—';
const fmtINR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';

// ─── SkeletonBox ─────────────────────────────────────────────────────────────
const SkeletonBox = memo(({ className = '' }) => (
  <div className={`skeleton animate-pulse rounded ${className}`} />
));
SkeletonBox.displayName = 'SkeletonBox';

// ─── ProfileSkeleton ─────────────────────────────────────────────────────────
const ProfileSkeleton = memo(() => (
  <div className="min-h-screen bg-base-200 p-4 md:p-8" data-theme="driver">
    <div className="card p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <SkeletonBox className="w-28 h-28 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-3 w-full">
          <SkeletonBox className="h-7 w-48 rounded-lg" />
          <SkeletonBox className="h-4 w-32 rounded" />
          <div className="flex gap-2 mt-2">
            <SkeletonBox className="h-6 w-20 rounded-full" />
            <SkeletonBox className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <SkeletonBox className="h-8 w-16 rounded" />
          <SkeletonBox className="h-3 w-24 rounded" />
        </div>
      ))}
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-6 space-y-4">
          <SkeletonBox className="h-5 w-36 rounded" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="space-y-1">
              <SkeletonBox className="h-3 w-20 rounded" />
              <SkeletonBox className="h-4 w-full rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
));
ProfileSkeleton.displayName = 'ProfileSkeleton';

// ─── FieldRow ─────────────────────────────────────────────────────────────────
const FieldRow = memo(({ label, value, note, icon: Icon, sensitive }) => {
  const [show, setShow] = useState(false);
  const empty = value == null || value === '';
  return (
    <div className="group py-3 border-b border-base-300/60 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0 opacity-70" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-0.5">
              {label}
            </p>
            <p className={`text-sm font-medium text-base-content break-words ${empty ? 'opacity-40 italic' : ''}`}>
              {sensitive && !show ? '••••••••' : (empty ? '—' : value)}
            </p>
            {note && <p className="text-xs text-base-content/40 mt-0.5 italic">{note}</p>}
          </div>
        </div>
        {sensitive && (
          <button
            onClick={() => setShow(p => !p)}
            aria-label={show ? 'Hide' : 'Show'}
            className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
});
FieldRow.displayName = 'FieldRow';

// ─── SectionCard ─────────────────────────────────────────────────────────────
const SectionCard = memo(({ title, icon: Icon, children, action, className = '' }) => (
  <div className={`card overflow-hidden ${className}`}>
    <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/60 bg-base-200/50">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </span>
        )}
        <h3 className="text-sm font-bold uppercase tracking-wide text-base-content/80">{title}</h3>
      </div>
      {action}
    </div>
    <div className="px-5">{children}</div>
  </div>
));
SectionCard.displayName = 'SectionCard';

// ─── KycBadge ─────────────────────────────────────────────────────────────────
const KycBadge = memo(({ status }) => {
  const cfg = KYC_STATUS_CONFIG[status] || KYC_STATUS_CONFIG.Pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
});
KycBadge.displayName = 'KycBadge';

// ─── ProfileProgress ─────────────────────────────────────────────────────────
const ProfileProgress = memo(({ percent }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs font-semibold">
      <span className="text-base-content/60 uppercase tracking-wider">Profile Completion</span>
      <span className={percent >= 80 ? 'text-success' : percent >= 50 ? 'text-warning' : 'text-error'}>
        {percent}%
      </span>
    </div>
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
    <p className="text-xs text-base-content/40 italic">
      {percent < 50
        ? 'Add KYC docs to activate dispatch.'
        : percent < 80
        ? 'Almost there — complete bank & medical details.'
        : 'Profile ready for dispatch.'}
    </p>
  </div>
));
ProfileProgress.displayName = 'ProfileProgress';

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = memo(({ label, value, note, icon: Icon, colorClass = 'text-primary' }) => (
  <div className="stat-card flex flex-col gap-1">
    <div className="flex items-center justify-between mb-1">
      {Icon && <Icon className={`w-4 h-4 ${colorClass} opacity-80`} />}
    </div>
    <div className={`stat-card-value ${colorClass}`}>{value ?? '—'}</div>
    <div className="stat-card-label">{label}</div>
    {note && <div className="text-xs text-base-content/40 italic mt-0.5">{note}</div>}
  </div>
));
StatCard.displayName = 'StatCard';

// ─── BadgeList ────────────────────────────────────────────────────────────────
const BadgeList = memo(({ badges }) => {
  if (!badges?.length) return (
    <div className="py-6 text-center text-sm text-base-content/40 italic">No badges earned yet.</div>
  );
  return (
    <div className="flex flex-wrap gap-2 py-4">
      {badges.map((b) => (
        <span
          key={b._id || b.badgeId}
          title={b.description || b.name}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/5 border border-accent/30 text-xs font-bold text-accent"
        >
          {b.iconUrl
            ? <Image src={b.iconUrl} alt="" width={14} height={14} className="rounded-full" />
            : <Award className="w-3 h-3" />
          }
          {b.name}
        </span>
      ))}
    </div>
  );
});
BadgeList.displayName = 'BadgeList';

// ─── StatusSwitcher ───────────────────────────────────────────────────────────
const StatusSwitcher = memo(({ current, onChange, updating }) => {
  const cfg = DRIVER_STATUS_CONFIG[current] || DRIVER_STATUS_CONFIG.Offline;
  const canSwitch = STATUS_OPTIONS.includes(current);

  if (!canSwitch) return (
    <span className={`badge ${cfg.badge}`}>
      <span className={`status-dot ${cfg.dot} mr-1.5`} />
      {cfg.label}
    </span>
  );

  return (
    <div className="relative flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={updating}
        aria-label="Change driver status"
        className="input-field py-1.5 pr-8 text-xs font-bold cursor-pointer"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {updating && <span className="loading loading-xs loading-spinner absolute right-2" />}
    </div>
  );
});
StatusSwitcher.displayName = 'StatusSwitcher';

// ─── ErrorState ───────────────────────────────────────────────────────────────
const ErrorState = memo(({ message, onRetry }) => (
  <div className="min-h-screen bg-base-200 flex items-center justify-center p-6" data-theme="driver">
    <div className="card p-8 text-center max-w-sm w-full">
      <XCircle className="w-12 h-12 text-error mx-auto mb-4" />
      <h2 className="text-lg font-bold text-base-content mb-2">Failed to load profile</h2>
      <p className="text-sm text-base-content/60 mb-6">{message || 'An unexpected error occurred.'}</p>
      <button onClick={onRetry} className="btn btn-primary w-full">Try Again</button>
    </div>
  </div>
));
ErrorState.displayName = 'ErrorState';

// ─── ComplianceRow ────────────────────────────────────────────────────────────
const ComplianceRow = memo(({ label, status, daysLeft, expiresAt }) => {
  const cfg = COMPLIANCE_STATUS[status] || COMPLIANCE_STATUS.missing;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl mb-2 ${cfg.bg} border border-transparent`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
        <div>
          <p className="text-sm font-semibold text-base-content">{label}</p>
          {expiresAt && (
            <p className="text-xs text-base-content/50">
              Expires: {fmtDate(expiresAt)}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
        {daysLeft > 0 && status !== 'valid' && (
          <p className="text-xs text-base-content/40">{daysLeft}d left</p>
        )}
      </div>
    </div>
  );
});
ComplianceRow.displayName = 'ComplianceRow';

// ─── PhotoUploadModal ─────────────────────────────────────────────────────────
const PhotoUploadModal = memo(({ onUpload, onRemove, onClose, uploading }) => {
  const [url, setUrl] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base-content">Update Photo</h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-base-content/50 italic">
          Paste a public image URL (CDN, ImageKit, Cloudinary, etc.)
        </p>
        <input
          className="input-field w-full"
          placeholder="https://cdn.example.com/photo.jpg"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="btn btn-primary btn-sm flex-1"
            disabled={!url.trim() || uploading}
            onClick={() => onUpload(url.trim())}
          >
            {uploading ? <span className="loading loading-xs loading-spinner" /> : <Upload className="w-3.5 h-3.5" />}
            Save Photo
          </button>
          <button
            className="btn btn-error btn-sm"
            disabled={uploading}
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
});
PhotoUploadModal.displayName = 'PhotoUploadModal';

// ─── EditProfileForm ──────────────────────────────────────────────────────────
const EditProfileForm = memo(({ driver, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    legalName:             driver?.legalName             || '',
    phone:                 driver?.phone                 || '',
    altPhone:              driver?.altPhone              || '',
    whatsappNumber:        driver?.whatsappNumber        || '',
    email:                 driver?.email                 || '',
    yearsOfExperience:     driver?.yearsOfExperience     ?? 0,
    hasMedicalTransportExp:driver?.hasMedicalTransportExp ?? false,
    hasAmbulanceExp:       driver?.hasAmbulanceExp       ?? false,
    bio:                   driver?.bio                   || '',
    currentCity:           driver?.currentCity           || '',
  });

  const onChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4 py-4" noValidate>
      <div>
        <label className="label"><span className="label-text">Legal Name</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">Full name as on government ID</p>
        <input className="input-field w-full" name="legalName" value={form.legalName} onChange={onChange} maxLength={100} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Primary Phone</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">10-digit mobile number</p>
          <input className="input-field w-full" name="phone" value={form.phone} onChange={onChange} maxLength={10} inputMode="tel" />
        </div>
        <div>
          <label className="label"><span className="label-text">Alt Phone</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Optional backup number</p>
          <input className="input-field w-full" name="altPhone" value={form.altPhone} onChange={onChange} maxLength={10} inputMode="tel" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">WhatsApp</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">For trip updates & OTPs</p>
          <input className="input-field w-full" name="whatsappNumber" value={form.whatsappNumber} onChange={onChange} inputMode="tel" />
        </div>
        <div>
          <label className="label"><span className="label-text">Email</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Receives trip receipts</p>
          <input className="input-field w-full" name="email" value={form.email} onChange={onChange} type="email" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Current City</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">City you operate from</p>
          <input className="input-field w-full" name="currentCity" value={form.currentCity} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">Years of Experience</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Total driving experience</p>
          <input className="input-field w-full" name="yearsOfExperience" type="number" min={0} max={60} value={form.yearsOfExperience} onChange={onChange} />
        </div>
      </div>

      <div>
        <label className="label"><span className="label-text">Bio</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">Short intro shown to passengers</p>
        <textarea className="input-field w-full min-h-[72px] resize-none" name="bio" value={form.bio} onChange={onChange} maxLength={300} rows={3} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <label className="label cursor-pointer gap-3 flex-1 bg-base-200 rounded-xl px-4 py-3">
          <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" name="hasMedicalTransportExp" checked={form.hasMedicalTransportExp} onChange={onChange} />
          <span>
            <span className="label-text block">Medical Transport Exp.</span>
            <span className="text-xs text-base-content/40 italic">Patient transport vehicle experience</span>
          </span>
        </label>
        <label className="label cursor-pointer gap-3 flex-1 bg-base-200 rounded-xl px-4 py-3">
          <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" name="hasAmbulanceExp" checked={form.hasAmbulanceExp} onChange={onChange} />
          <span>
            <span className="label-text block">Ambulance Experience</span>
            <span className="text-xs text-base-content/40 italic">Certified ambulance driving history</span>
          </span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </form>
  );
});
EditProfileForm.displayName = 'EditProfileForm';

// ─── EmergencyContactForm ─────────────────────────────────────────────────────
const EmergencyContactForm = memo(({ current, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    name:         current?.name         || '',
    relationship: current?.relationship || '',
    phone:        current?.phone        || '',
  });
  const onChange = useCallback((e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 py-4" noValidate>
      <div>
        <label className="label"><span className="label-text">Contact Name</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">Trusted person in case of emergency</p>
        <input className="input-field w-full" name="name" value={form.name} onChange={onChange} required />
      </div>
      <div>
        <label className="label"><span className="label-text">Relationship</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">e.g. Spouse, Parent, Sibling</p>
        <input className="input-field w-full" name="relationship" value={form.relationship} onChange={onChange} />
      </div>
      <div>
        <label className="label"><span className="label-text">Phone Number</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">Reachable 24/7 contact</p>
        <input className="input-field w-full" name="phone" value={form.phone} onChange={onChange} inputMode="tel" required />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>
    </form>
  );
});
EmergencyContactForm.displayName = 'EmergencyContactForm';

// ─── NotifPrefsForm ───────────────────────────────────────────────────────────
const NotifPrefsForm = memo(({ current, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    smsAlerts:        current?.smsAlerts        ?? true,
    whatsappAlerts:   current?.whatsappAlerts   ?? true,
    pushNotifications:current?.pushNotifications ?? true,
  });
  const onChange = useCallback((e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.checked }));
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 py-4" noValidate>
      {[
        { name: 'smsAlerts',         label: 'SMS Alerts',           note: 'Trip updates via SMS' },
        { name: 'whatsappAlerts',    label: 'WhatsApp Alerts',      note: 'Ride info on WhatsApp' },
        { name: 'pushNotifications', label: 'Push Notifications',   note: 'App push notifications' },
      ].map(({ name, label, note }) => (
        <label key={name} className="label cursor-pointer gap-3 bg-base-200 rounded-xl px-4 py-3">
          <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" name={name} checked={form[name]} onChange={onChange} />
          <span>
            <span className="label-text block">{label}</span>
            <span className="text-xs text-base-content/40 italic">{note}</span>
          </span>
        </label>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>
    </form>
  );
});
NotifPrefsForm.displayName = 'NotifPrefsForm';

// ─── BankForm ─────────────────────────────────────────────────────────────────
const BankForm = memo(({ current, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    accountHolderName: current?.accountHolderName || '',
    accountNumber:     '',
    ifscCode:          current?.ifscCode          || '',
    bankName:          current?.bankName          || '',
    upiId:             current?.upiId             || '',
  });
  const onChange = useCallback((e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 py-4" noValidate>
      <div>
        <label className="label"><span className="label-text">Account Holder Name</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">As printed on passbook</p>
        <input className="input-field w-full" name="accountHolderName" value={form.accountHolderName} onChange={onChange} />
      </div>
      <div>
        <label className="label"><span className="label-text">Account Number</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">Enter full account number</p>
        <input className="input-field w-full" name="accountNumber" value={form.accountNumber} onChange={onChange} type="password" autoComplete="off" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label"><span className="label-text">IFSC Code</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">11-character branch code</p>
          <input className="input-field w-full" name="ifscCode" value={form.ifscCode} onChange={onChange} maxLength={11} />
        </div>
        <div>
          <label className="label"><span className="label-text">Bank Name</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Your bank's full name</p>
          <input className="input-field w-full" name="bankName" value={form.bankName} onChange={onChange} />
        </div>
      </div>
      <div>
        <label className="label"><span className="label-text">UPI ID</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">e.g. 9XXXXXXXXX@upi</p>
        <input className="input-field w-full" name="upiId" value={form.upiId} onChange={onChange} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-4 h-4" />}
          Save Bank Details
        </button>
      </div>
    </form>
  );
});
BankForm.displayName = 'BankForm';

// ─── KycDocReuploadForm ───────────────────────────────────────────────────────
const KycDocReuploadForm = memo(({ onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    aadhaarDocUrl:          '',
    drivingLicenceDocUrl:   '',
    psvBadgeDocUrl:         '',
    panDocUrl:              '',
  });
  const onChange = useCallback((e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }, []);
  const hasAny = Object.values(form).some(v => v.trim());
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 py-4" noValidate>
      {[
        { name: 'aadhaarDocUrl',        label: 'Aadhaar Doc URL',         note: 'URL to Aadhaar scan (front + back)' },
        { name: 'drivingLicenceDocUrl', label: 'Driving Licence Doc URL', note: 'URL to DL scan' },
        { name: 'psvBadgeDocUrl',       label: 'PSV Badge Doc URL',       note: 'URL to PSV badge scan' },
        { name: 'panDocUrl',            label: 'PAN Card Doc URL',        note: 'URL to PAN card scan' },
      ].map(({ name, label, note }) => (
        <div key={name}>
          <label className="label"><span className="label-text">{label}</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">{note}</p>
          <input className="input-field w-full" name={name} value={form[name]} onChange={onChange} placeholder="https://cdn.example.com/doc.jpg" />
        </div>
      ))}
      <p className="text-xs text-warning italic">
        ⚠ Re-uploading documents resets KYC status to Under-Review.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!hasAny || saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Upload className="w-4 h-4" />}
          Submit for Review
        </button>
      </div>
    </form>
  );
});
KycDocReuploadForm.displayName = 'KycDocReuploadForm';

// ─── LicenceNumbersForm ───────────────────────────────────────────────────────
const LicenceNumbersForm = memo(({ kyc, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    drivingLicenceNumber: kyc?.drivingLicenceNumber || '',
    drivingLicenceExpiry: kyc?.drivingLicenceExpiry ? new Date(kyc.drivingLicenceExpiry).toISOString().split('T')[0] : '',
    psvBadgeNumber:       kyc?.psvBadgeNumber       || '',
    psvBadgeExpiry:       kyc?.psvBadgeExpiry ? new Date(kyc.psvBadgeExpiry).toISOString().split('T')[0] : '',
    panNumber:            kyc?.panNumber             || '',
  });
  const onChange = useCallback((e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 py-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label"><span className="label-text">DL Number</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Driving licence number</p>
          <input className="input-field w-full" name="drivingLicenceNumber" value={form.drivingLicenceNumber} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">DL Expiry</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">DL validity date</p>
          <input className="input-field w-full" name="drivingLicenceExpiry" type="date" value={form.drivingLicenceExpiry} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">PSV Badge No.</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">PSV badge number</p>
          <input className="input-field w-full" name="psvBadgeNumber" value={form.psvBadgeNumber} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">PSV Expiry</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">PSV badge validity date</p>
          <input className="input-field w-full" name="psvBadgeExpiry" type="date" value={form.psvBadgeExpiry} onChange={onChange} />
        </div>
      </div>
      <div>
        <label className="label"><span className="label-text">PAN Number</span></label>
        <p className="text-xs text-base-content/40 italic mb-1">10-character PAN number</p>
        <input className="input-field w-full" name="panNumber" value={form.panNumber} onChange={onChange} maxLength={10} />
      </div>
      <p className="text-xs text-warning italic">
        ⚠ Updating numbers resets KYC to Under-Review for admin re-validation.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-4 h-4" />}
          Update Numbers
        </button>
      </div>
    </form>
  );
});
LicenceNumbersForm.displayName = 'LicenceNumbersForm';

// ─── MedicalFitnessForm ───────────────────────────────────────────────────────
const MedicalFitnessForm = memo(({ current, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({
    certificateNumber: current?.certificateNumber || '',
    issuedBy:          current?.issuedBy          || '',
    issuedAt:          current?.issuedAt ? new Date(current.issuedAt).toISOString().split('T')[0] : '',
    expiryDate:        current?.expiryDate ? new Date(current.expiryDate).toISOString().split('T')[0] : '',
    bloodGroup:        current?.bloodGroup        || '',
    documentUrl:       current?.documentUrl       || '',
  });
  const onChange = useCallback((e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 py-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label"><span className="label-text">Certificate No.</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Medical fitness cert number</p>
          <input className="input-field w-full" name="certificateNumber" value={form.certificateNumber} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">Issued By</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Hospital or issuing authority</p>
          <input className="input-field w-full" name="issuedBy" value={form.issuedBy} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">Issue Date</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Date of certificate issue</p>
          <input className="input-field w-full" name="issuedAt" type="date" value={form.issuedAt} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">Expiry Date</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">Certificate validity date</p>
          <input className="input-field w-full" name="expiryDate" type="date" value={form.expiryDate} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">Blood Group</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">e.g. O+, A-, B+</p>
          <input className="input-field w-full" name="bloodGroup" value={form.bloodGroup} onChange={onChange} />
        </div>
        <div>
          <label className="label"><span className="label-text">Document URL</span></label>
          <p className="text-xs text-base-content/40 italic mb-1">URL to uploaded certificate scan</p>
          <input className="input-field w-full" name="documentUrl" value={form.documentUrl} onChange={onChange} placeholder="https://cdn.example.com/cert.pdf" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" disabled={saving}>
          <X className="w-4 h-4" /> Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-4 h-4" />}
          Save Medical Info
        </button>
      </div>
    </form>
  );
});
MedicalFitnessForm.displayName = 'MedicalFitnessForm';

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function MyProfile() {
  const dispatch = useDispatch();

  const {
    driverMe: driver,
    driverOwnPerformance,
    driverCoinHistory,
    driverCompliance,
    loading,
    error,
  } = useSelector((s) => s.transportPartner);

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [activeTab,        setActiveTab]        = useState('overview');
  const [editing,          setEditing]          = useState(false);
  const [editEmergency,    setEditEmergency]    = useState(false);
  const [editNotifs,       setEditNotifs]       = useState(false);
  const [editBank,         setEditBank]         = useState(false);
  const [editKycDocs,      setEditKycDocs]      = useState(false);
  const [editLicence,      setEditLicence]      = useState(false);
  const [editMedical,      setEditMedical]      = useState(false);
  const [showPhotoModal,   setShowPhotoModal]   = useState(false);

  const [saving,           setSaving]           = useState(false);
  const [updatingStatus,   setUpdatingStatus]   = useState(false);
  const [uploadingPhoto,   setUploadingPhoto]   = useState(false);

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverOwnPerformance());
    dispatch(fetchDriverCoinHistory());
    dispatch(fetchDriverCompliance());
  }, [dispatch]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const performance = useMemo(() => driverOwnPerformance || driver?.performance || {}, [driverOwnPerformance, driver]);
  const rewards     = useMemo(() => driver?.rewards   || {}, [driver]);
  const kyc         = useMemo(() => driver?.kyc       || {}, [driver]);
  const bankDetails = useMemo(() => driver?.bankDetails || {}, [driver]);
  const shift       = useMemo(() => driver?.shift     || {}, [driver]);
  const tierCfg     = useMemo(() => TIER_CONFIG[rewards.tier] || TIER_CONFIG.Bronze, [rewards.tier]);
  const agencyName  = useMemo(() => driver?.ownerAgency?.businessName || 'Independent', [driver]);

  const compliance  = useMemo(() => driverCompliance || {}, [driverCompliance]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const withSaving = useCallback(async (fn) => {
    setSaving(true);
    try { await fn(); }
    finally { setSaving(false); }
  }, []);

  const handleSaveProfile = useCallback((formData) => {
    withSaving(async () => {
      await dispatch(updateDriverMe(formData)).unwrap();
      setEditing(false);
    });
  }, [dispatch, withSaving]);

  const handleSaveEmergency = useCallback((data) => {
    withSaving(async () => {
      await dispatch(updateDriverEmergencyContact(data)).unwrap();
      setEditEmergency(false);
      dispatch(fetchDriverMe());
    });
  }, [dispatch, withSaving]);

  const handleSaveNotifs = useCallback((data) => {
    withSaving(async () => {
      await dispatch(updateDriverNotifPrefs(data)).unwrap();
      setEditNotifs(false);
      dispatch(fetchDriverMe());
    });
  }, [dispatch, withSaving]);

  const handleSaveBank = useCallback((data) => {
    withSaving(async () => {
      await dispatch(updateDriverBank(data)).unwrap();
      setEditBank(false);
      dispatch(fetchDriverMe());
    });
  }, [dispatch, withSaving]);

  const handleReuploadKycDocs = useCallback((data) => {
    // Strip empty fields before sending
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v.trim()));
    withSaving(async () => {
      await dispatch(reuploadDriverKycDocument(clean)).unwrap();
      setEditKycDocs(false);
      dispatch(fetchDriverMe());
    });
  }, [dispatch, withSaving]);

  const handleSaveLicenceNumbers = useCallback((data) => {
    withSaving(async () => {
      await dispatch(updateDriverLicenceNumbers(data)).unwrap();
      setEditLicence(false);
      dispatch(fetchDriverMe());
    });
  }, [dispatch, withSaving]);

  const handleSaveMedical = useCallback((data) => {
    withSaving(async () => {
      await dispatch(updateDriverMedicalFitness(data)).unwrap();
      setEditMedical(false);
      dispatch(fetchDriverMe());
      dispatch(fetchDriverCompliance());
    });
  }, [dispatch, withSaving]);

  const handleStatusChange = useCallback(async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await dispatch(updateDriverStatus({ status: newStatus })).unwrap();
    } finally {
      setUpdatingStatus(false);
    }
  }, [dispatch]);

  const handleUploadPhoto = useCallback(async (photoUrl) => {
    setUploadingPhoto(true);
    try {
      await dispatch(updateDriverPhoto({ photoUrl })).unwrap();
      setShowPhotoModal(false);
      dispatch(fetchDriverMe());
    } finally {
      setUploadingPhoto(false);
    }
  }, [dispatch]);

  const handleRemovePhoto = useCallback(async () => {
    setUploadingPhoto(true);
    try {
      await dispatch(removeDriverPhoto()).unwrap();
      setShowPhotoModal(false);
      dispatch(fetchDriverMe());
    } finally {
      setUploadingPhoto(false);
    }
  }, [dispatch]);

  const handleCompleteOnboarding = useCallback(async () => {
    await dispatch(completeDriverOnboarding()).unwrap();
    dispatch(fetchDriverMe());
  }, [dispatch]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading && !driver) return <ProfileSkeleton />;
  if (error && !driver)  return <ErrorState message={error} onRetry={() => dispatch(fetchDriverMe())} />;
  if (!driver)           return <ProfileSkeleton />;

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: User },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'kyc',         label: 'KYC & Docs',  icon: Shield },
    { id: 'rewards',     label: 'Rewards',     icon: Award },
    { id: 'coins',       label: 'Coins',       icon: Coins },
    { id: 'bank',        label: 'Bank',        icon: CreditCard },
    { id: 'shift',       label: 'Shift',       icon: Clock },
    { id: 'compliance',  label: 'Compliance',  icon: CheckSquare },
  ];

  // ── Compliance warning count ───────────────────────────────────────────────
  const complianceAlerts = useMemo(() => {
    if (!compliance) return 0;
    return [compliance.drivingLicence, compliance.psvBadge, compliance.medicalFitness]
      .filter(c => c && (c.status === 'expired' || c.status === 'expiring_soon' || c.status === 'missing'))
      .length;
  }, [compliance]);

  return (
    <div className="min-h-screen bg-base-200" data-theme="driver">

      {/* Photo modal */}
      {showPhotoModal && (
        <PhotoUploadModal
          onUpload={handleUploadPhoto}
          onRemove={handleRemovePhoto}
          onClose={() => setShowPhotoModal(false)}
          uploading={uploadingPhoto}
        />
      )}

      {/* ── Hero Card ──────────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <MotionDiv
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="card m-4 md:m-6 lg:m-8 overflow-hidden"
        >
          <div className="p-5 md:p-8">
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">

              {/* Avatar + photo edit */}
              <div className="relative flex-shrink-0 group">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-2 border-primary/30">
                  {driver?.user?.avatar ? (
                    <Image
                      src={driver.user.avatar}
                      alt={driver.legalName || 'Driver'}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <User className="w-10 h-10 text-primary opacity-60" />
                    </div>
                  )}
                </div>
                {/* Online dot */}
                <span
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-base-100 ${driver?.user?.isOnline ? 'bg-success' : 'bg-base-300'}`}
                  title={driver?.user?.isOnline ? 'Online' : 'Offline'}
                />
                {/* Camera overlay */}
                <button
                  onClick={() => setShowPhotoModal(true)}
                  aria-label="Change profile photo"
                  className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-base-content tracking-tight">
                      {driver?.legalName || driver?.user?.name || 'Driver'}
                    </h1>
                    <p className="text-sm text-base-content/50 mt-0.5 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      {driver?.driverCode || 'Generating…'}
                      <span className="mx-1.5 opacity-30">·</span>
                      <Car className="w-3.5 h-3.5" />
                      {agencyName}
                      {driver?.currentCity && (
                        <>
                          <span className="mx-1.5 opacity-30">·</span>
                          <MapPin className="w-3.5 h-3.5" />
                          {driver.currentCity}
                        </>
                      )}
                    </p>
                  </div>
                  <StatusSwitcher current={driver?.status} onChange={handleStatusChange} updating={updatingStatus} />
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <KycBadge status={kyc.verificationStatus} />
                  {rewards.tier && (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs  border ${tierCfg.color} ${tierCfg.bg} border-base-300/60`}>
                      {tierCfg.label}
                    </span>
                  )}
                  {driver?.isBlocked && (
                    <span className="badge badge-error">
                      <Lock className="w-3 h-3 mr-1" /> Blocked
                    </span>
                  )}
                  {driver?.isPaused && (
                    <span className="badge badge-warning">Paused</span>
                  )}
                  {driver?.isVerified && (
                    <span className="badge badge-success">
                      <BadgeCheck className="w-3 h-3 mr-1" /> Verified
                    </span>
                  )}
                  {complianceAlerts > 0 && (
                    <span className="badge badge-error">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {complianceAlerts} Compliance Issue{complianceAlerts > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="mt-4 max-w-md">
                  <ProfileProgress percent={driver?.profileCompletionPercent || 0} />
                </div>

                {/* Onboarding complete CTA */}
                {!driver?.onboarding?.isComplete && (driver?.profileCompletionPercent || 0) >= 70 && (
                  <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/30">
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-success">Profile Ready!</p>
                      <p className="text-xs text-base-content/50">Complete onboarding to start receiving trips.</p>
                    </div>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={handleCompleteOnboarding}
                    >
                      Finish Onboarding
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </MotionDiv>
      </Suspense>

      {/* ── Quick Stats ────────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mx-4 md:mx-6 lg:mx-8 mb-5"
        >
          <StatCard
            label="Total Rides"
            value={performance.totalRidesCompleted ?? 0}
            icon={Activity}
            colorClass="text-primary"
            note="Lifetime completed"
          />
          <StatCard
            label="Rating"
            value={performance.rating ? `${Number(performance.rating).toFixed(1)} ★` : '—'}
            icon={Star}
            colorClass="text-accent"
            note={`${performance.ratingCount || 0} ratings`}
          />
          <StatCard
            label="Coins"
            value={rewards.coinBalance ?? 0}
            icon={Wallet}
            colorClass="text-success"
            note="Redeemable balance"
          />
          <StatCard
            label="Earnings"
            value={fmtINR(performance.totalEarnings)}
            icon={TrendingUp}
            colorClass="text-info"
            note="Total lifetime"
          />
        </MotionDiv>
      </Suspense>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="mx-4 md:mx-6 lg:mx-8 mb-4 overflow-x-auto scrollbar-thin">
        <div className="flex gap-1 min-w-max border-b border-base-300/60">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-selected={activeTab === id}
              role="tab"
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-150 whitespace-nowrap ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/50 hover:text-base-content hover:border-base-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {id === 'compliance' && complianceAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-error text-error-content text-[10px]  font-poppins flex items-center justify-center">
                  {complianceAlerts}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="mx-4 md:mx-6 lg:mx-8 pb-12">

        {/* ═══ OVERVIEW ═══════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              {/* Personal Details */}
              <SectionCard
                title="Personal Details"
                icon={User}
                action={
                  !editing ? (
                    <button onClick={() => setEditing(true)} className="btn btn-ghost btn-xs gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : null
                }
              >
                {editing ? (
                  <EditProfileForm driver={driver} onSave={handleSaveProfile} onCancel={() => setEditing(false)} saving={saving} />
                ) : (
                  <div>
                    <FieldRow label="Legal Name"        value={driver?.legalName}       icon={User}     note="Name on government ID" />
                    <FieldRow label="Primary Phone"     value={driver?.phone}           icon={Phone}    note="Used for OTP & trip calls" />
                    <FieldRow label="Alt Phone"         value={driver?.altPhone}        icon={Phone}    note="Backup contact number" />
                    <FieldRow label="WhatsApp"          value={driver?.whatsappNumber}  icon={Phone}    note="For push notifications" />
                    <FieldRow label="Email"             value={driver?.email}           icon={Mail}     note="Receives trip invoices" />
                    <FieldRow label="Current City"      value={driver?.currentCity}     icon={MapPin}   note="City you operate from" />
                    <FieldRow label="Date of Birth"     value={fmtDate(driver?.dateOfBirth)} icon={Calendar} />
                    <FieldRow label="Gender"            value={driver?.gender}          icon={User} />
                    <FieldRow label="Bio"               value={driver?.bio}             icon={FileText} note="Short passenger-visible intro" />
                    <FieldRow label="Driver Code"       value={driver?.driverCode}      icon={Hash}     note="Unique platform ID" />
                    <FieldRow label="Onboarding"        value={driver?.onboarding?.isComplete ? 'Complete ✓' : `Step ${driver?.onboarding?.step || 1}`} icon={ChevronRight} note="Onboarding progress" />
                    <FieldRow label="Driver Type"       value={driver?.soloPartner ? 'Solo Partner' : 'Agency Driver'} icon={User} />
                  </div>
                )}
              </SectionCard>

              {/* Professional */}
              <SectionCard title="Professional Info" icon={Car}>
                <FieldRow label="Years of Experience"     value={driver?.yearsOfExperience != null ? `${driver.yearsOfExperience} yrs` : null} icon={Calendar} note="Total active driving experience" />
                <FieldRow label="Languages Spoken"        value={driver?.languagesSpoken?.join(', ')}                                          icon={Activity} note="Languages you communicate in" />
                <FieldRow label="Medical Transport Exp."  value={driver?.hasMedicalTransportExp ? 'Yes' : 'No'}                                icon={Shield}   note="Experience in patient transport" />
                <FieldRow label="Ambulance Experience"    value={driver?.hasAmbulanceExp ? 'Yes' : 'No'}                                       icon={Zap}      note="Trained ambulance driving" />
                <FieldRow label="Performance Tier"        value={rewards.tier || '—'}                                                          icon={TrendingUp} note="Based on ride count & ratings" />
                <FieldRow label="Agency"                  value={agencyName}                                                                   icon={Car}      note="Current employing agency" />
              </SectionCard>

              {/* Emergency Contact */}
              <SectionCard
                title="Emergency Contact"
                icon={Phone}
                action={
                  !editEmergency ? (
                    <button onClick={() => setEditEmergency(true)} className="btn btn-ghost btn-xs gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : null
                }
              >
                {editEmergency ? (
                  <EmergencyContactForm
                    current={driver?.emergencyContact}
                    onSave={handleSaveEmergency}
                    onCancel={() => setEditEmergency(false)}
                    saving={saving}
                  />
                ) : (
                  <div>
                    <FieldRow label="Name"         value={driver?.emergencyContact?.name}         icon={User}  note="Trusted contact for emergencies" />
                    <FieldRow label="Relationship" value={driver?.emergencyContact?.relationship} icon={User}  note="e.g. Spouse, Parent, Sibling" />
                    <FieldRow label="Phone"        value={driver?.emergencyContact?.phone}        icon={Phone} note="Reachable 24/7 contact" />
                  </div>
                )}
              </SectionCard>

              {/* Assigned Vehicle */}
              <SectionCard title="Assigned Vehicle" icon={Car}>
                {driver?.assignedVehicleSnapshot?.registrationNumber ? (
                  <>
                    <FieldRow label="Registration No." value={driver.assignedVehicleSnapshot.registrationNumber}                                           icon={FileText} note="Vehicle plate" />
                    <FieldRow label="Make & Model"     value={`${driver.assignedVehicleSnapshot.make || ''} ${driver.assignedVehicleSnapshot.model || ''}`.trim() || null} icon={Car} />
                    <FieldRow label="Vehicle Type"     value={driver.assignedVehicleSnapshot.vehicleType}                                                  icon={Car}      note="Category" />
                    <FieldRow label="Color"            value={driver.assignedVehicleSnapshot.color}                                                        icon={Activity} />
                    <FieldRow label="Vehicle Code"     value={driver.assignedVehicleSnapshot.vehicleCode}                                                  icon={Hash}     note="Internal platform ID" />
                  </>
                ) : (
                  <div className="py-6 text-center text-sm text-base-content/40 italic">No vehicle assigned yet.</div>
                )}
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ PERFORMANCE ════════════════════════════════════════════════════ */}
        {activeTab === 'performance' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="performance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              <SectionCard title="Ride Stats" icon={Activity} className="md:col-span-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4">
                  <StatCard label="Completed"   value={fmt(performance.totalRidesCompleted)}  icon={CheckCircle2} colorClass="text-success" note="All-time finished" />
                  <StatCard label="Cancelled"   value={fmt(performance.totalRidesCancelled)}  icon={XCircle}      colorClass="text-error"   note="Rides cancelled" />
                  <StatCard label="Cancel Rate" value={performance.cancellationRate != null ? `${performance.cancellationRate}%` : '—'} icon={AlertCircle} colorClass="text-warning" note="% rides cancelled" />
                  <StatCard label="Monthly"     value={fmt(performance.monthlyRides)}          icon={Calendar}     colorClass="text-info"    note="Rides this month" />
                  <StatCard label="Avg Pickup"  value={performance.avgPickupTimeMinutes != null ? `${performance.avgPickupTimeMinutes} min` : '—'} icon={Clock} colorClass="text-primary" note="Time to pickup" />
                  <StatCard label="Distance"    value={performance.totalDistanceKm ? `${performance.totalDistanceKm} km` : '—'} icon={MapPin} colorClass="text-accent" note="Total km driven" />
                  <StatCard label="Complaints"  value={fmt(performance.complaintsCount)}       icon={XCircle}      colorClass="text-error"   note="Formal complaints" />
                  <StatCard label="Compliments" value={fmt(performance.complimentsCount)}      icon={Star}         colorClass="text-success" note="Positive feedback" />
                </div>
              </SectionCard>

              <SectionCard title="Ratings & Tier" icon={Star}>
                <FieldRow label="Rating"           value={performance.rating ? `${Number(performance.rating).toFixed(2)} / 5.00` : '—'} icon={Star}        note="Weighted passenger rating" />
                <FieldRow label="Rating Count"     value={fmt(performance.ratingCount)}                                                   icon={Hash}        note="Total rating submissions" />
                <FieldRow label="Performance Tier" value={performance.performanceTier}                                                    icon={TrendingUp}  note="Internal performance tier" />
                <FieldRow label="Warnings"         value={fmt(performance.warningCount)}                                                  icon={AlertCircle} note="Admin-issued warnings" />
                <FieldRow label="Last Ride"        value={fmtDate(performance.lastRideAt)}                                                icon={Calendar}    note="Most recent trip date" />
              </SectionCard>

              <SectionCard title="Earnings" icon={Wallet}>
                <FieldRow label="Total Earnings"  value={fmtINR(performance.totalEarnings)}  icon={TrendingUp} note="Lifetime gross earnings" />
                <FieldRow label="Coins Earned"    value={fmt(rewards.totalCoinsEarned)}       icon={Award}      note="All-time coins credited" />
                <FieldRow label="Coins Redeemed"  value={fmt(rewards.totalCoinsRedeem)}       icon={Wallet}     note="Coins used for rewards" />
                <FieldRow label="Coin Balance"    value={fmt(rewards.coinBalance)}            icon={Wallet}     note="Spendable coin balance" />
                <FieldRow label="Coins / Ride"    value={fmt(rewards.coinsPerRide)}           icon={Zap}        note="Reward per completed trip" />
                <FieldRow label="Monthly Bonus"   value={fmt(rewards.bonusCoinsThisMonth)}    icon={TrendingUp} note="Bonus coins this month" />
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ KYC & DOCS ═════════════════════════════════════════════════════ */}
        {activeTab === 'kyc' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="kyc"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              {/* KYC Status Banner */}
              <SectionCard title="KYC Status" icon={Shield} className="md:col-span-2">
                <div className="flex flex-wrap items-center gap-4 py-4">
                  <KycBadge status={kyc.verificationStatus} />
                  {kyc.submittedAt && (
                    <span className="text-xs text-base-content/50">Submitted: {fmtDate(kyc.submittedAt)}</span>
                  )}
                  {kyc.verifiedAt && (
                    <span className="text-xs text-success">✓ Verified: {fmtDate(kyc.verifiedAt)}</span>
                  )}
                  {kyc.rejectionReason && (
                    <span className="text-xs text-error">Rejected: {kyc.rejectionReason}</span>
                  )}
                </div>
              </SectionCard>

              {/* Aadhaar */}
              <SectionCard title="Aadhaar" icon={FileText}>
                <FieldRow label="Aadhaar (Last 4)" value={kyc.aadhaarLast4 ? `XXXX XXXX ${kyc.aadhaarLast4}` : '—'} icon={Lock}     note="Masked — last 4 digits visible" />
                <FieldRow label="Aadhaar Doc"       value={kyc.aadhaarDocUrl ? 'Uploaded ✓' : 'Not uploaded'}        icon={FileText} note="Aadhaar scan" />
              </SectionCard>

              {/* Driving Licence */}
              <SectionCard
                title="Driving Licence"
                icon={Car}
                action={
                  !editLicence ? (
                    <button onClick={() => setEditLicence(true)} className="btn btn-ghost btn-xs gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : null
                }
              >
                {editLicence ? (
                  <LicenceNumbersForm kyc={kyc} onSave={handleSaveLicenceNumbers} onCancel={() => setEditLicence(false)} saving={saving} />
                ) : (
                  <div>
                    <FieldRow label="Licence No."   value={kyc.drivingLicenceNumber}         icon={FileText} />
                    <FieldRow label="Expiry Date"   value={fmtDate(kyc.drivingLicenceExpiry)} icon={Calendar} note="DL validity expiry" />
                    <FieldRow label="Licence Class" value={kyc.licenceClass?.join(', ')}     icon={Car}      note="Vehicle categories" />
                    <FieldRow label="DL Doc"        value={kyc.drivingLicenceDocUrl ? 'Uploaded ✓' : 'Not uploaded'} icon={FileText} />
                  </div>
                )}
              </SectionCard>

              {/* PSV Badge */}
              <SectionCard title="PSV Badge" icon={BadgeCheck}>
                <FieldRow label="PSV Badge No." value={kyc.psvBadgeNumber}               icon={Hash}     note="Public Service Vehicle badge" />
                <FieldRow label="PSV Expiry"    value={fmtDate(kyc.psvBadgeExpiry)}       icon={Calendar} note="PSV badge validity" />
                <FieldRow label="PSV Doc"       value={kyc.psvBadgeDocUrl ? 'Uploaded ✓' : 'Not uploaded'} icon={FileText} />
              </SectionCard>

              {/* PAN */}
              <SectionCard title="PAN" icon={CreditCard}>
                <FieldRow label="PAN Number" value={kyc.panNumber}                              icon={CreditCard} sensitive note="Tap eye to reveal" />
                <FieldRow label="PAN Doc"    value={kyc.panDocUrl ? 'Uploaded ✓' : 'Not uploaded'} icon={FileText} />
              </SectionCard>

              {/* Medical Fitness */}
              <SectionCard
                title="Medical Fitness"
                icon={Activity}
                className="md:col-span-2"
                action={
                  !editMedical ? (
                    <button onClick={() => setEditMedical(true)} className="btn btn-ghost btn-xs gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : null
                }
              >
                {editMedical ? (
                  <MedicalFitnessForm current={driver?.medicalFitness} onSave={handleSaveMedical} onCancel={() => setEditMedical(false)} saving={saving} />
                ) : (
                  <div className="grid md:grid-cols-2">
                    <FieldRow label="Certificate No." value={driver?.medicalFitness?.certificateNumber}           icon={FileText}     note="Medical cert number" />
                    <FieldRow label="Issued By"        value={driver?.medicalFitness?.issuedBy}                   icon={User}         note="Issuing hospital/authority" />
                    <FieldRow label="Issued On"        value={fmtDate(driver?.medicalFitness?.issuedAt)}          icon={Calendar}     note="Date of issue" />
                    <FieldRow label="Expiry"           value={fmtDate(driver?.medicalFitness?.expiryDate)}        icon={Calendar}     note="Validity date" />
                    <FieldRow label="Blood Group"      value={driver?.medicalFitness?.bloodGroup}                 icon={Activity}     note="Your blood type" />
                    <FieldRow label="Valid"            value={driver?.medicalFitness?.isValid ? 'Yes ✓' : 'No'}  icon={CheckCircle2} note="Currently valid?" />
                  </div>
                )}
              </SectionCard>

              {/* Re-upload Documents */}
              <SectionCard
                title="Re-upload Documents"
                icon={Upload}
                className="md:col-span-2"
                action={
                  !editKycDocs ? (
                    <button onClick={() => setEditKycDocs(true)} className="btn btn-ghost btn-xs gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Re-upload
                    </button>
                  ) : null
                }
              >
                {editKycDocs ? (
                  <KycDocReuploadForm onSave={handleReuploadKycDocs} onCancel={() => setEditKycDocs(false)} saving={saving} />
                ) : (
                  <div className="py-4 text-sm text-base-content/50 italic">
                    Use the Re-upload button to replace any KYC document. Documents are reviewed within 24–48 hours.
                  </div>
                )}
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ REWARDS ════════════════════════════════════════════════════════ */}
        {activeTab === 'rewards' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="rewards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              <SectionCard title="Coin Wallet" icon={Wallet}>
                <FieldRow label="Current Balance" value={fmt(rewards.coinBalance)}          icon={Wallet}     note="Available for redemption" />
                <FieldRow label="Total Earned"    value={fmt(rewards.totalCoinsEarned)}     icon={TrendingUp} note="Cumulative coins earned" />
                <FieldRow label="Total Redeemed"  value={fmt(rewards.totalCoinsRedeem)}     icon={Zap}        note="Coins used for rewards" />
                <FieldRow label="Coins / Ride"    value={fmt(rewards.coinsPerRide)}         icon={Activity}   note="Coins per successful trip" />
                <FieldRow label="Monthly Bonus"   value={fmt(rewards.bonusCoinsThisMonth)}  icon={Star}       note="Bonus coins this month" />
              </SectionCard>

              <SectionCard title="Tier Status" icon={TrendingUp}>
                <div className="py-4 text-center">
                  <div className={`text-3xl  font-poppins mb-2 ${tierCfg.color}`}>{tierCfg.label}</div>
                  <p className="text-xs text-base-content/50 mb-4">Your current reward tier</p>
                  <div className="text-xs text-base-content/40 space-y-1">
                    <p>🥉 Bronze → 50 rides</p>
                    <p>🥈 Silver → 200 rides</p>
                    <p>🥇 Gold → 500 rides</p>
                    <p>🏆 Platinum → 1,000 rides</p>
                    <p>💎 Diamond → 1,000+ rides + rating 4.8+</p>
                  </div>
                  {rewards.tierUpdatedAt && (
                    <p className="text-xs text-base-content/30 mt-4 italic">Updated {fmtDate(rewards.tierUpdatedAt)}</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Badges Earned" icon={Award} className="md:col-span-2">
                <BadgeList badges={rewards.badges} />
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ COINS ══════════════════════════════════════════════════════════ */}
        {activeTab === 'coins' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="coins"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Balance"     value={driverCoinHistory?.coinBalance     ?? rewards.coinBalance}     icon={Wallet}     colorClass="text-success" note="Current coins" />
                <StatCard label="Total Earned"value={driverCoinHistory?.totalCoinsEarned ?? rewards.totalCoinsEarned} icon={TrendingUp} colorClass="text-primary" note="All time" />
                <StatCard label="Redeemed"    value={driverCoinHistory?.totalCoinsRedeem ?? rewards.totalCoinsRedeem} icon={Zap}        colorClass="text-warning" note="Used so far" />
                <StatCard label="Tier"        value={driverCoinHistory?.tier ?? rewards.tier ?? '—'}                   icon={Award}      colorClass="text-accent"  note="Reward tier" />
              </div>

              {/* Transaction History */}
              <SectionCard title="Transaction History" icon={Coins}>
                {(() => {
                  const txns = driverCoinHistory?.transactions?.data || [];
                  if (!txns.length) return (
                    <div className="py-8 text-center text-sm text-base-content/40 italic">No coin transactions yet.</div>
                  );
                  return (
                    <div className="divide-y divide-base-300/60">
                      {txns.map((t, i) => {
                        const isCredit = t.type?.includes('EARN') || t.type?.includes('CREDIT') || t.type?.includes('BONUS') || t.amount > 0;
                        return (
                          <div key={t._id || i} className="flex items-center justify-between py-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-success/10' : 'bg-error/10'}`}>
                                {isCredit
                                  ? <ArrowUpCircle className="w-4 h-4 text-success" />
                                  : <Zap className="w-4 h-4 text-error" />
                                }
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-base-content truncate">{t.description || t.type || 'Transaction'}</p>
                                <p className="text-xs text-base-content/40">{fmtDateTime(t.createdAt)}</p>
                              </div>
                            </div>
                            <span className={`text-sm font-bold flex-shrink-0 ml-4 ${isCredit ? 'text-success' : 'text-error'}`}>
                              {isCredit ? '+' : '-'}{Math.abs(t.amount)} 🪙
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ BANK ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'bank' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="bank"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              <SectionCard
                title="Bank Account"
                icon={CreditCard}
                action={
                  !editBank ? (
                    <button onClick={() => setEditBank(true)} className="btn btn-ghost btn-xs gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : null
                }
              >
                {editBank ? (
                  <BankForm current={bankDetails} onSave={handleSaveBank} onCancel={() => setEditBank(false)} saving={saving} />
                ) : (
                  <div>
                    <FieldRow label="Account Holder" value={bankDetails.accountHolderName}                                                 icon={User}       note="Name on the bank account" />
                    <FieldRow label="Account No."    value={bankDetails.accountLast4 ? `XXXX XXXX ${bankDetails.accountLast4}` : '—'}     icon={Lock}       note="Masked — last 4 digits" />
                    <FieldRow label="IFSC Code"      value={bankDetails.ifscCode}                                                          icon={FileText}   note="Bank branch IFSC" />
                    <FieldRow label="Bank Name"      value={bankDetails.bankName}                                                          icon={CreditCard} note="Your bank name" />
                    <FieldRow label="Verified"       value={bankDetails.isBankVerified ? 'Yes ✓' : 'Pending'}                             icon={CheckCircle2} note="Verification status" />
                  </div>
                )}
              </SectionCard>

              <SectionCard title="UPI" icon={Zap}>
                <FieldRow label="UPI ID" value={bankDetails.upiId} icon={Zap} note="UPI handle for instant settlements" />
                {!bankDetails.upiId && (
                  <div className="py-4 text-center text-sm text-base-content/40 italic">
                    No UPI ID linked. Edit bank details to add one.
                  </div>
                )}
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ SHIFT ══════════════════════════════════════════════════════════ */}
        {activeTab === 'shift' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="shift"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              <SectionCard title="Shift Details" icon={Clock}>
                <FieldRow label="Shift Type"     value={shift.shiftType}               icon={Clock}    note="Assigned shift category" />
                <FieldRow label="Start Time"     value={shift.startTime}               icon={Clock}    note="Shift start (HH:MM)" />
                <FieldRow label="End Time"       value={shift.endTime}                 icon={Clock}    note="Shift end (HH:MM)" />
                <FieldRow label="Days Available" value={shift.daysAvailable?.join(', ')} icon={Calendar} note="Days of the week you work" />
                <FieldRow label="Available Now"  value={shift.isAvailableNow ? 'Yes ✓' : 'No'} icon={Zap}   note="Current real-time availability" />
                <FieldRow label="Next Available" value={fmtDateTime(shift.nextAvailableAt)} icon={Calendar} note="Next available date/time" />
              </SectionCard>

              <SectionCard title="Current Status" icon={Activity}>
                <div className="py-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${DRIVER_STATUS_CONFIG[driver?.status]?.dot || 'bg-base-300'} ${DRIVER_STATUS_CONFIG[driver?.status]?.pulse ? 'animate-pulse' : ''}`} />
                    <div>
                      <p className="text-sm font-bold text-base-content">{DRIVER_STATUS_CONFIG[driver?.status]?.label || driver?.status}</p>
                      <p className="text-xs text-base-content/40 italic">Current dispatch status</p>
                    </div>
                  </div>
                  <div className="border-t border-base-300/60 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-3">Change Status</p>
                    <StatusSwitcher current={driver?.status} onChange={handleStatusChange} updating={updatingStatus} />
                  </div>
                  {driver?.isBlocked && (
                    <div className="alert alert-error mt-3">
                      <Lock className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold">Account Blocked</p>
                        <p className="text-xs">{driver.blockReason || 'Contact admin for details.'}</p>
                      </div>
                    </div>
                  )}
                  {driver?.isPaused && (
                    <div className="alert alert-warning mt-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold">Temporarily Paused</p>
                        <p className="text-xs">{driver.pauseReason || 'Paused by agency.'}</p>
                        {driver.pausedUntil && (
                          <p className="text-xs">Until: {fmtDateTime(driver.pausedUntil)}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Notification Preferences */}
              <SectionCard
                title="Notification Preferences"
                icon={Activity}
                action={
                  !editNotifs ? (
                    <button onClick={() => setEditNotifs(true)} className="btn btn-ghost btn-xs gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  ) : null
                }
              >
                {editNotifs ? (
                  <NotifPrefsForm current={driver?.notifPrefs} onSave={handleSaveNotifs} onCancel={() => setEditNotifs(false)} saving={saving} />
                ) : (
                  <div>
                    <FieldRow label="SMS Alerts"         value={driver?.notifPrefs?.smsAlerts         ? 'Enabled' : 'Disabled'} icon={Phone}    note="Trip updates via SMS" />
                    <FieldRow label="WhatsApp Alerts"    value={driver?.notifPrefs?.whatsappAlerts    ? 'Enabled' : 'Disabled'} icon={Phone}    note="WhatsApp trip notifications" />
                    <FieldRow label="Push Notifications" value={driver?.notifPrefs?.pushNotifications ? 'Enabled' : 'Disabled'} icon={Activity} note="App push notification toggle" />
                  </div>
                )}
              </SectionCard>
            </MotionDiv>
          </Suspense>
        )}

        {/* ═══ COMPLIANCE ═════════════════════════════════════════════════════ */}
        {activeTab === 'compliance' && (
          <Suspense fallback={null}>
            <MotionDiv
              key="compliance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-5"
            >
              {/* Compliance Summary */}
              <SectionCard title="Compliance Overview" icon={CheckSquare} className="md:col-span-2">
                <div className="py-4 space-y-1">
                  {compliance.kycStatus && (
                    <div className={`flex items-center justify-between p-3 rounded-xl mb-2 ${KYC_STATUS_CONFIG[compliance.kycStatus]?.bg || 'bg-base-200'}`}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-base-content">KYC Verification</p>
                          <p className="text-xs text-base-content/50">Overall KYC status</p>
                        </div>
                      </div>
                      <KycBadge status={compliance.kycStatus} />
                    </div>
                  )}

                  {compliance.drivingLicence && (
                    <ComplianceRow
                      label="Driving Licence"
                      status={compliance.drivingLicence.status}
                      daysLeft={compliance.drivingLicence.daysLeft}
                      expiresAt={compliance.drivingLicence.expiresAt}
                    />
                  )}
                  {compliance.psvBadge && (
                    <ComplianceRow
                      label="PSV Badge"
                      status={compliance.psvBadge.status}
                      daysLeft={compliance.psvBadge.daysLeft}
                      expiresAt={compliance.psvBadge.expiresAt}
                    />
                  )}
                  {compliance.medicalFitness && (
                    <ComplianceRow
                      label="Medical Fitness"
                      status={compliance.medicalFitness.status}
                      daysLeft={compliance.medicalFitness.daysLeft}
                      expiresAt={compliance.medicalFitness.expiresAt}
                    />
                  )}
                </div>

                {!compliance.drivingLicence && !compliance.psvBadge && !compliance.medicalFitness && (
                  <div className="py-6 text-center text-sm text-base-content/40 italic">
                    Compliance data not loaded yet. Submit your KYC documents first.
                  </div>
                )}
              </SectionCard>

              {/* Account Health */}
              <SectionCard title="Account Health" icon={Shield}>
                <FieldRow label="KYC Verified"       value={compliance.isVerified ? 'Yes ✓' : 'No'}      icon={BadgeCheck}  note="Platform verification status" />
                <FieldRow label="Account Blocked"    value={compliance.isBlocked  ? 'Yes ⛔' : 'No'}     icon={Lock}        note="Blocked = no dispatch" />
                <FieldRow label="Account Paused"     value={compliance.isPaused   ? 'Yes ⚠' : 'No'}     icon={AlertCircle} note="Paused by agency" />
                <FieldRow label="Profile Completion" value={compliance.profileCompletion != null ? `${compliance.profileCompletion}%` : '—'} icon={Activity} note="Overall profile score" />
              </SectionCard>

              {/* Quick Fix Links */}
              {complianceAlerts > 0 && (
                <SectionCard title="Quick Actions" icon={Zap}>
                  <div className="py-4 space-y-2">
                    <p className="text-xs text-base-content/50 italic mb-3">
                      Tap below to navigate and fix compliance issues.
                    </p>
                    {[
                      compliance.drivingLicence?.status !== 'valid' && { label: 'Update Driving Licence', tab: 'kyc' },
                      compliance.psvBadge?.status !== 'valid'       && { label: 'Update PSV Badge',       tab: 'kyc' },
                      compliance.medicalFitness?.status !== 'valid' && { label: 'Update Medical Fitness', tab: 'kyc' },
                    ]
                      .filter(Boolean)
                      .map((item, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveTab(item.tab)}
                          className="btn btn-outline btn-sm w-full justify-between"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ))
                    }
                  </div>
                </SectionCard>
              )}
            </MotionDiv>
          </Suspense>
        )}
      </div>
    </div>
  );
}