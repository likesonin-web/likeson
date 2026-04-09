'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, FileBadge, Bell, Clock, Lock,
  CheckCircle2, XCircle, Upload, Link2, Camera,
  Eye, EyeOff, Smartphone, Globe, Monitor,
  Trash2, ShieldCheck, AlertTriangle, Save,
  ChevronRight, Loader2, Check, X, Plus,
  MapPin, Phone, Mail, User, Calendar,
  RefreshCw, LogOut, Key, Fingerprint,
  ToggleLeft, ToggleRight, Info, ExternalLink,
  FileText, Image as ImageIcon, Download,
} from 'lucide-react';
import {
  fetchTPProfile, updateTPProfile,
  submitTPKyc, fetchTPKycStatus,
  updateTPNotifications, updateTPAvailability,
  updateTPSettlementCycle,
  fetchTPSessions, revokeTPSession, revokeAllTPSessions,
  removeTPDeviceToken,
} from '@/store/slices/transportPartnerSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'profile',       path: '/transport-partner/settings/profile',       label: 'Agency Profile',    icon: Building2 },
  { key: 'kyc',           path: '/transport-partner/settings/kyc',           label: 'KYC / Documents',   icon: FileBadge },
  { key: 'notifications', path: '/transport-partner/settings/notifications', label: 'Notifications',     icon: Bell },
  { key: 'availability',  path: '/transport-partner/settings/availability',  label: 'Availability',      icon: Clock },
  { key: 'security',      path: '/transport-partner/settings/security',      label: 'Security',          icon: Lock },
];

const KYC_STATUS_CONFIG = {
  'not-submitted': { color: 'text-gray-400',   bg: 'bg-gray-400/10',  border: 'border-gray-400/30',  label: 'Not Submitted' },
  pending:         { color: 'text-yellow-400', bg: 'bg-yellow-400/10',border: 'border-yellow-400/30',label: 'Pending Review' },
  'under-review':  { color: 'text-blue-400',   bg: 'bg-blue-400/10',  border: 'border-blue-400/30',  label: 'Under Review' },
  verified:        { color: 'text-green-400',  bg: 'bg-green-400/10', border: 'border-green-400/30', label: 'Verified' },
  rejected:        { color: 'text-red-400',    bg: 'bg-red-400/10',   border: 'border-red-400/30',   label: 'Rejected' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated pill tab */
const Tab = ({ section, isActive, onClick }) => {
  const Icon = section.icon;
  return (
    <button
      onClick={() => onClick(section)}
      className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap
        ${isActive
          ? 'text-white'
          : 'text-[oklch(var(--bc)/0.55)] hover:text-[oklch(var(--bc)/0.85)]'
        }`}
    >
      {isActive && (
        <motion.span
          layoutId="activeTab"
          className="absolute inset-0 rounded-xl bg-[var(--primary)] shadow-lg"
          style={{ boxShadow: '0 4px 20px oklch(var(--p)/.35)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
      <Icon size={16} className="relative z-10 flex-shrink-0" />
      <span className="relative z-10">{section.label}</span>
    </button>
  );
};

/** Field wrapper */
const Field = ({ label, hint, children, required }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold uppercase tracking-widest text-[oklch(var(--bc)/0.55)]">
      {label}{required && <span className="text-[var(--error)] ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-[oklch(var(--bc)/0.4)]">{hint}</p>}
  </div>
);

/** Input */
const Input = ({ className = '', ...props }) => (
  <input
    className={`input-field w-full text-sm ${className}`}
    {...props}
  />
);

/** Toggle switch */
const Toggle = ({ checked, onChange, label, desc }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--base-300)] last:border-0">
    <div>
      <p className="text-sm font-semibold text-[oklch(var(--bc)/0.9)]">{label}</p>
      {desc && <p className="text-xs text-[oklch(var(--bc)/0.45)] mt-0.5">{desc}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full  transition-colors duration-300 flex-shrink-0
        ${checked ? 'bg-[var(--primary)] ' : 'bg-[var(--base-300)] '}`}
    >
      <motion.span
        animate={{ x: checked ? 2 : -18 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  </div>
);

/** Doc upload field — supports file upload or paste URL */
const DocField = ({ label, value, onChange, folder, dispatch, isUploading }) => {
  const [mode, setMode] = useState('url'); // 'url' | 'upload'
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadSingleFile({ file, folder })).unwrap();
    if (res?.url) onChange(res.url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode('url')}
          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all
            ${mode === 'url' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--base-200)] text-[oklch(var(--bc)/0.55)]'}`}
        >
          <Link2 size={11} className="inline mr-1" />Paste URL
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all
            ${mode === 'upload' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--base-200)] text-[oklch(var(--bc)/0.55)]'}`}
        >
          <Upload size={11} className="inline mr-1" />Upload File
        </button>
      </div>

      {mode === 'url' ? (
        <div className="relative">
          <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(var(--bc)/0.4)]" />
          <Input
            placeholder="https://..."
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="pl-8"
          />
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[var(--base-300)] hover:border-[var(--primary)] rounded-xl p-4 text-center cursor-pointer transition-colors"
        >
          {isUploading ? (
            <Loader2 size={20} className="mx-auto text-[var(--primary)] animate-spin" />
          ) : value ? (
            <div className="flex items-center justify-center gap-2 text-xs text-green-400">
              <CheckCircle2 size={14} /> File uploaded
            </div>
          ) : (
            <div className="text-xs text-[oklch(var(--bc)/0.45)]">
              <Upload size={16} className="mx-auto mb-1 opacity-50" />
              Click to upload PDF / Image
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} />
        </div>
      )}

      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">
          <ExternalLink size={11} />View document
        </a>
      )}
    </div>
  );
};

/** Save button */
const SaveBtn = ({ onClick, loading, label = 'Save Changes' }) => (
  <motion.button
    onClick={onClick}
    disabled={loading}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    className="btn-primary-cta flex items-center gap-2 text-xs px-5 py-2.5"
  >
    {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
    {label}
  </motion.button>
);

/** Section card */
const Card = ({ children, className = '' }) => (
  <div className={`card p-6 space-y-5 ${className}`}>{children}</div>
);

/** Section heading */
const SectionHead = ({ icon: Icon, title, desc }) => (
  <div className="flex items-start gap-3 pb-4 border-b border-[var(--base-300)]">
    <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
      <Icon size={18} className="text-[var(--primary)]" />
    </div>
    <div>
      <h2 className="text-base font-black font-display text-[oklch(var(--bc)/0.95)]">{title}</h2>
      {desc && <p className="text-xs text-[oklch(var(--bc)/0.5)] mt-0.5">{desc}</p>}
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// SECTION: Profile
// ═════════════════════════════════════════════════════════════════════════════
const ProfileSection = () => {
  const dispatch = useDispatch();
  const { profile, loading } = useSelector(s => s.transportPartner);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!profile) dispatch(fetchTPProfile());
  }, []);

  useEffect(() => {
    if (profile) setForm({
      businessName:      profile.businessName      || '',
      ownerName:         profile.ownerName         || '',
      ownerPhone:        profile.ownerPhone        || '',
      ownerEmail:        profile.ownerEmail        || '',
      businessType:      profile.businessType      || 'proprietorship',
      gstNumber:         profile.gstNumber         || '',
      msmeUdyamNumber:   profile.msmeUdyamNumber   || '',
      street:  profile.registeredAddress?.street   || '',
      city:    profile.registeredAddress?.city     || '',
      state:   profile.registeredAddress?.state    || '',
      pinCode: profile.registeredAddress?.pinCode  || '',
    });
  }, [profile]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    dispatch(updateTPProfile({
      businessName:    form.businessName,
      ownerName:       form.ownerName,
      ownerPhone:      form.ownerPhone,
      ownerEmail:      form.ownerEmail,
      businessType:    form.businessType,
      gstNumber:       form.gstNumber,
      msmeUdyamNumber: form.msmeUdyamNumber,
      registeredAddress: {
        street: form.street, city: form.city,
        state:  form.state,  pinCode: form.pinCode,
      },
    }));
  };

  const BUSINESS_TYPES = ['individual','proprietorship','partnership','pvt-ltd','ltd','llp'];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHead icon={Building2} title="Agency Information" desc="Your transport business details shown to customers and admins" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name" required>
            <Input value={form.businessName || ''} onChange={e => set('businessName', e.target.value)} placeholder="Likeson Transport Co." />
          </Field>
          <Field label="Business Type">
            <select value={form.businessType || ''} onChange={e => set('businessType', e.target.value)}
              className="input-field w-full text-sm capitalize">
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="GST Number">
            <Input value={form.gstNumber || ''} onChange={e => set('gstNumber', e.target.value.toUpperCase())} placeholder="27AAAAA0000A1Z5" />
          </Field>
          <Field label="MSME / Udyam Number">
            <Input value={form.msmeUdyamNumber || ''} onChange={e => set('msmeUdyamNumber', e.target.value)} placeholder="UDYAM-AP-00-0000000" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHead icon={User} title="Owner Details" desc="Primary contact for this transport partner account" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Owner Name" required>
            <Input value={form.ownerName || ''} onChange={e => set('ownerName', e.target.value)} placeholder="Ravi Kumar" />
          </Field>
          <Field label="Owner Phone" required>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(var(--bc)/0.4)]" />
              <Input value={form.ownerPhone || ''} onChange={e => set('ownerPhone', e.target.value)} placeholder="+91 9876543210" className="pl-8" />
            </div>
          </Field>
          <Field label="Owner Email" className="sm:col-span-2">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(var(--bc)/0.4)]" />
              <Input value={form.ownerEmail || ''} onChange={e => set('ownerEmail', e.target.value)} placeholder="owner@company.com" className="pl-8" />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHead icon={MapPin} title="Registered Address" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Street" className="sm:col-span-2">
            <Input value={form.street || ''} onChange={e => set('street', e.target.value)} placeholder="123 MG Road" />
          </Field>
          <Field label="City">
            <Input value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="Vijayawada" />
          </Field>
          <Field label="State">
            <Input value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="Andhra Pradesh" />
          </Field>
          <Field label="PIN Code">
            <Input value={form.pinCode || ''} onChange={e => set('pinCode', e.target.value)} placeholder="520001" maxLength={6} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveBtn onClick={handleSave} loading={loading} />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTION: KYC
// ═════════════════════════════════════════════════════════════════════════════
const KycSection = () => {
  const dispatch = useDispatch();
  const { profile, kycStatus, loading } = useSelector(s => s.transportPartner);
  const { isUploading } = useSelector(s => s.upload);
  const [form, setForm] = useState({});

  useEffect(() => {
    dispatch(fetchTPKycStatus());
    if (!profile) dispatch(fetchTPProfile());
  }, []);

  useEffect(() => {
    const kyc = profile?.ownerKyc || {};
    setForm({
      fullName:            kyc.fullName            || '',
      dateOfBirth:         kyc.dateOfBirth         ? kyc.dateOfBirth.slice(0,10) : '',
      gender:              kyc.gender              || '',
      aadhaarFrontUrl:     kyc.aadhaarFrontUrl     || '',
      aadhaarBackUrl:      kyc.aadhaarBackUrl      || '',
      panCardUrl:          kyc.panCardUrl          || '',
      drivingLicenseNumber:kyc.drivingLicenseNumber|| '',
      drivingLicenseUrl:   kyc.drivingLicenseUrl   || '',
      drivingLicenseExpiry:kyc.drivingLicenseExpiry? kyc.drivingLicenseExpiry.slice(0,10) : '',
      bio:                 kyc.bio                 || '',
    });
  }, [profile]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const statusInfo = KYC_STATUS_CONFIG[kycStatus?.kycStatus || 'not-submitted'];

  const handleSave = () => {
    dispatch(submitTPKyc({
      fullName:            form.fullName,
      dateOfBirth:         form.dateOfBirth,
      gender:              form.gender,
      aadhaarFrontUrl:     form.aadhaarFrontUrl,
      aadhaarBackUrl:      form.aadhaarBackUrl,
      panCardUrl:          form.panCardUrl,
      drivingLicenseNumber:form.drivingLicenseNumber,
      drivingLicenseUrl:   form.drivingLicenseUrl,
      drivingLicenseExpiry:form.drivingLicenseExpiry,
      bio:                 form.bio,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${statusInfo.bg} ${statusInfo.border}`}>
        <div className={`w-2 h-2 rounded-full ${statusInfo.color.replace('text-','bg-')} animate-pulse`} />
        <span className={`text-sm font-semibold ${statusInfo.color}`}>KYC Status: {statusInfo.label}</span>
        {kycStatus?.kycVerifiedAt && (
          <span className="ml-auto text-xs text-[oklch(var(--bc)/0.4)]">
            Verified {new Date(kycStatus.kycVerifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <Card>
        <SectionHead icon={User} title="Personal Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Legal Name" required>
            <Input value={form.fullName || ''} onChange={e => set('fullName', e.target.value)} />
          </Field>
          <Field label="Date of Birth">
            <Input type="date" value={form.dateOfBirth || ''} onChange={e => set('dateOfBirth', e.target.value)} />
          </Field>
          <Field label="Gender">
            <select value={form.gender || ''} onChange={e => set('gender', e.target.value)} className="input-field w-full text-sm">
              <option value="">Select</option>
              {['male','female','other','prefer-not-to-say'].map(g => <option key={g} value={g} className="capitalize">{g}</option>)}
            </select>
          </Field>
          <Field label="Bio / About" className="sm:col-span-2">
            <textarea value={form.bio || ''} onChange={e => set('bio', e.target.value)}
              rows={3} maxLength={500}
              className="input-field w-full text-sm resize-none"
              placeholder="Brief description about your transport business..." />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHead icon={FileBadge} title="Identity Documents" desc="Upload or paste document URLs" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="Aadhaar Front" required>
            <DocField
              value={form.aadhaarFrontUrl}
              onChange={v => set('aadhaarFrontUrl', v)}
              folder="kyc/aadhaar"
              dispatch={dispatch}
              isUploading={isUploading}
            />
            {kycStatus?.aadhaarVerified && (
              <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-1">
                <CheckCircle2 size={11} /> Aadhaar Verified
              </span>
            )}
          </Field>
          <Field label="Aadhaar Back">
            <DocField value={form.aadhaarBackUrl} onChange={v => set('aadhaarBackUrl', v)} folder="kyc/aadhaar" dispatch={dispatch} isUploading={isUploading} />
          </Field>
          <Field label="PAN Card" required>
            <DocField value={form.panCardUrl} onChange={v => set('panCardUrl', v)} folder="kyc/pan" dispatch={dispatch} isUploading={isUploading} />
            {kycStatus?.panVerified && (
              <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-1">
                <CheckCircle2 size={11} /> PAN Verified
              </span>
            )}
          </Field>
          <div className="space-y-3">
            <Field label="Driving License Number">
              <Input value={form.drivingLicenseNumber || ''} onChange={e => set('drivingLicenseNumber', e.target.value.toUpperCase())} placeholder="AP09 2020 0012345" />
            </Field>
            <Field label="License Expiry">
              <Input type="date" value={form.drivingLicenseExpiry || ''} onChange={e => set('drivingLicenseExpiry', e.target.value)} />
            </Field>
          </div>
          <Field label="Driving License Document" className="sm:col-span-2">
            <DocField value={form.drivingLicenseUrl} onChange={v => set('drivingLicenseUrl', v)} folder="kyc/license" dispatch={dispatch} isUploading={isUploading} />
          </Field>
        </div>
      </Card>

      {kycStatus?.kycRejectionReason && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Rejection Reason</p>
            <p className="text-xs text-red-300/70 mt-0.5">{kycStatus.kycRejectionReason}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <SaveBtn onClick={handleSave} loading={loading} label="Submit KYC" />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTION: Notifications
// ═════════════════════════════════════════════════════════════════════════════
const NotificationsSection = () => {
  const dispatch = useDispatch();
  const { profile, loading } = useSelector(s => s.transportPartner);
  const [notif, setNotif] = useState({ sms: true, email: true, push: true, whatsapp: true });

  useEffect(() => {
    if (!profile) dispatch(fetchTPProfile());
  }, []);

  useEffect(() => {
    if (profile?.notifications) setNotif({ ...profile.notifications });
  }, [profile]);

  const set = (k, v) => setNotif(p => ({ ...p, [k]: v }));

  const handleSave = () => dispatch(updateTPNotifications(notif));

  const CHANNELS = [
    { key: 'push',     label: 'Push Notifications', desc: 'Ride requests, status updates on your device' },
    { key: 'email',    label: 'Email Alerts',        desc: 'Account activity, settlement confirmations' },
    { key: 'sms',      label: 'SMS Alerts',          desc: 'Critical alerts via text message' },
    { key: 'whatsapp', label: 'WhatsApp Messages',   desc: 'Instant updates via WhatsApp' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHead icon={Bell} title="Notification Channels" desc="Control how Likeson contacts you" />
        <div>
          {CHANNELS.map(ch => (
            <Toggle
              key={ch.key}
              checked={notif[ch.key] ?? true}
              onChange={v => set(ch.key, v)}
              label={ch.label}
              desc={ch.desc}
            />
          ))}
        </div>
      </Card>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--info)]/10 border border-[var(--info)]/20">
        <Info size={15} className="text-[var(--info)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[oklch(var(--bc)/0.6)]">
          Some critical security and payment notifications cannot be disabled and will always be sent.
        </p>
      </div>

      <div className="flex justify-end">
        <SaveBtn onClick={handleSave} loading={loading} />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTION: Availability
// ═════════════════════════════════════════════════════════════════════════════
const AvailabilitySection = () => {
  const dispatch = useDispatch();
  const { profile, loading } = useSelector(s => s.transportPartner);
  const [isAvailable, setIsAvailable] = useState(true);
  const [hours, setHours] = useState({ start: '06:00', end: '22:00' });
  const [cycle, setCycle] = useState('Weekly');

  useEffect(() => {
    if (!profile) dispatch(fetchTPProfile());
  }, []);

  useEffect(() => {
    if (profile) {
      setIsAvailable(profile.isAvailable ?? true);
      if (profile.availabilityHours) setHours(profile.availabilityHours);
      if (profile.settlementCycle)   setCycle(profile.settlementCycle);
    }
  }, [profile]);

  const handleSaveAvailability = () => dispatch(updateTPAvailability({ isAvailable, availabilityHours: hours }));
  const handleSaveCycle = () => dispatch(updateTPSettlementCycle({ settlementCycle: cycle }));

  const CYCLES = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHead icon={Clock} title="Fleet Availability" desc="Toggle your agency on / off for new ride requests" />

        <div className={`relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300
          ${isAvailable ? 'border-green-500/40 bg-green-500/5' : 'border-[var(--base-300)] bg-[var(--base-200)]'}`}>
          <div>
            <p className="font-bold text-sm text-[oklch(var(--bc)/0.9)]">
              {isAvailable ? '✅ Accepting Requests' : '⏸️ Not Accepting Requests'}
            </p>
            <p className="text-xs text-[oklch(var(--bc)/0.5)] mt-0.5">
              {isAvailable ? 'Your fleet is visible and can receive bookings' : 'Rides will not be routed to your fleet'}
            </p>
          </div>
          <button
            onClick={() => setIsAvailable(v => !v)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300
              ${isAvailable ? 'bg-green-500' : 'bg-[var(--base-300)]'}`}
          >
            <motion.span
              animate={{ x: isAvailable ? 4 : -22 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Open From">
            <Input type="time" value={hours.start} onChange={e => setHours(h => ({ ...h, start: e.target.value }))} />
          </Field>
          <Field label="Close At">
            <Input type="time" value={hours.end} onChange={e => setHours(h => ({ ...h, end: e.target.value }))} />
          </Field>
        </div>

        <div className="flex justify-end">
          <SaveBtn onClick={handleSaveAvailability} loading={loading} label="Save Availability" />
        </div>
      </Card>

      <Card>
        <SectionHead icon={Calendar} title="Settlement Cycle" desc="How often you receive payout settlements" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CYCLES.map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`py-3 rounded-xl text-sm font-bold border-2 transition-all
                ${cycle === c
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-[var(--base-300)] text-[oklch(var(--bc)/0.55)] hover:border-[var(--primary)]/40'
                }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <SaveBtn onClick={handleSaveCycle} loading={loading} label="Save Cycle" />
        </div>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTION: Security
// ═════════════════════════════════════════════════════════════════════════════
const SecuritySection = () => {
  const dispatch = useDispatch();
  const { sessions, loading } = useSelector(s => s.transportPartner);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  useEffect(() => { dispatch(fetchTPSessions()); }, []);

  const PLATFORM_ICONS = { android: Smartphone, ios: Smartphone, web: Globe, desktop: Monitor };
  const formatDate = d => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';

  return (
    <div className="space-y-4">
      {/* Active Sessions */}
      <Card>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--base-300)]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
              <Fingerprint size={18} className="text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-base font-black font-display">Active Sessions</h2>
              <p className="text-xs text-[oklch(var(--bc)/0.5)] mt-0.5">
                {sessions?.auditSessions?.length || 0} active session(s)
              </p>
            </div>
          </div>
          {(sessions?.auditSessions?.length > 0) && (
            confirmRevokeAll ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Revoke all?</span>
                <button onClick={() => { dispatch(revokeAllTPSessions()); setConfirmRevokeAll(false); }}
                  className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 font-bold">Yes</button>
                <button onClick={() => setConfirmRevokeAll(false)}
                  className="text-xs px-2 py-1 rounded bg-[var(--base-200)] text-[oklch(var(--bc)/0.5)] font-bold">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmRevokeAll(true)}
                className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                <LogOut size={12} /> Revoke All
              </button>
            )
          )}
        </div>

        <div className="space-y-2">
          {loading && !sessions ? (
            Array(2).fill(0).map((_, i) => (
              <div key={i} className="h-16 rounded-xl skeleton" />
            ))
          ) : sessions?.auditSessions?.length === 0 ? (
            <p className="text-sm text-center text-[oklch(var(--bc)/0.4)] py-6">No active sessions</p>
          ) : (
            sessions?.auditSessions?.map(s => {
              const PIcon = PLATFORM_ICONS[s.platform] || Globe;
              return (
                <motion.div
                  key={s._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--base-300)] flex items-center justify-center flex-shrink-0">
                    <PIcon size={15} className="text-[oklch(var(--bc)/0.6)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[oklch(var(--bc)/0.85)] truncate">{s.deviceName || 'Unknown Device'}</p>
                    <p className="text-[10px] text-[oklch(var(--bc)/0.4)] truncate">{s.ipAddress} · {formatDate(s.lastActiveAt)}</p>
                  </div>
                  <button
                    onClick={() => dispatch(revokeTPSession(s._id))}
                    className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* Device Tokens */}
      <Card>
        <SectionHead icon={Smartphone} title="Registered Devices" desc="Push notification devices linked to your account" />
        <div className="space-y-2">
          {sessions?.deviceTokens?.length === 0 || !sessions?.deviceTokens ? (
            <p className="text-sm text-center text-[oklch(var(--bc)/0.4)] py-4">No devices registered</p>
          ) : (
            sessions.deviceTokens.map(d => {
              const PIcon = PLATFORM_ICONS[d.platform] || Smartphone;
              return (
                <motion.div
                  key={d._id}
                  layout
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--base-300)] flex items-center justify-center flex-shrink-0">
                    <PIcon size={15} className="text-[oklch(var(--bc)/0.6)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[oklch(var(--bc)/0.85)] truncate capitalize">{d.platform} · {d.deviceName || 'Unknown'}</p>
                    <p className="text-[10px] text-[oklch(var(--bc)/0.4)]">Last used {formatDate(d.lastUsedAt)}</p>
                  </div>
                  <button
                    onClick={() => dispatch(removeTPDeviceToken(d._id))}
                    className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* Login Stats */}
      <Card>
        <SectionHead icon={ShieldCheck} title="Account Activity" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Logins',     value: sessions?.loginCount || 0 },
            { label: 'Last Login',       value: sessions?.lastLoginAt ? new Date(sessions.lastLoginAt).toLocaleDateString('en-IN') : 'N/A' },
            { label: 'Last Login IP',    value: sessions?.lastLoginIp || 'N/A' },
          ].map(stat => (
            <div key={stat.label} className="p-3 rounded-xl bg-[var(--base-200)] border border-[var(--base-300)]">
              <p className="text-[10px] uppercase tracking-widest text-[oklch(var(--bc)/0.4)] font-semibold">{stat.label}</p>
              <p className="text-sm font-bold text-[oklch(var(--bc)/0.85)] mt-1 truncate">{stat.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
const SECTION_COMPONENTS = {
  profile:       ProfileSection,
  kyc:           KycSection,
  notifications: NotificationsSection,
  availability:  AvailabilitySection,
  security:      SecuritySection,
};

export default function SettingsManagement() {
  const pathname = usePathname();
  const router = useRouter();

  // Derive active section from URL
  const activeSection = SECTIONS.find(s => pathname?.includes(s.key)) || SECTIONS[0];
  const ActiveComp = SECTION_COMPONENTS[activeSection.key];

  return (
    <div className="min-h-screen bg-[var(--base-100)]">
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <h1 className="text-2xl font-black font-display text-[oklch(var(--bc)/0.95)] tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[oklch(var(--bc)/0.5)] mt-1">
          Manage your agency profile, KYC, notifications, and security
        </p>
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="px-4 sm:px-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none
          bg-[var(--base-200)] p-1.5 rounded-2xl border border-[var(--base-300)] w-fit max-w-full">
          {SECTIONS.map(s => (
            <Tab
              key={s.key}
              section={s}
              isActive={activeSection.key === s.key}
              onClick={sec => router.push(sec.path)}
            />
          ))}
        </div>
      </div>

      {/* Section content */}
      <div className="px-4 sm:px-6 pt-5 pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <ActiveComp />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}