'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, FileCheck2, HeartPulse, ShieldCheck,
  Upload, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronRight, Eye, Trash2, FileText, Camera, RefreshCw,
  BadgeCheck, Shield, Stethoscope, Car, Loader2, X,
  ArrowRight, CalendarDays, Hash, BookOpen, Award
} from 'lucide-react';

import {
  fetchKycStatus,
  submitKyc,
  submitMedicalFitness,
  submitPsvBadge,
  selectKyc,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';

import {
  uploadSingleFile,
  resetUploadState,
} from '@/store/slices/uploadSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'status',  label: 'KYC Status',       icon: ScanLine,    route: '/partner/solo/kyc'         },
  { id: 'submit',  label: 'Submit Documents',  icon: FileCheck2,  route: '/partner/solo/kyc/submit'  },
  { id: 'medical', label: 'Medical Fitness',   icon: HeartPulse,  route: '/partner/solo/kyc/medical' },
  { id: 'psv',     label: 'PSV Badge',         icon: ShieldCheck, route: '/partner/solo/kyc/psv'     },
];

const STATUS_CONFIG = {
  'not-submitted': { label: 'Not Submitted', color: 'text-base-content/50', bg: 'bg-base-300/40',       icon: Clock,         border: 'border-base-300' },
  pending:         { label: 'Pending',       color: 'text-warning',         bg: 'bg-warning/10',         icon: Clock,         border: 'border-warning/40' },
  'under-review':  { label: 'Under Review',  color: 'text-info',            bg: 'bg-info/10',            icon: RefreshCw,     border: 'border-info/40' },
  verified:        { label: 'Verified',      color: 'text-success',         bg: 'bg-success/10',         icon: CheckCircle2,  border: 'border-success/40' },
  rejected:        { label: 'Rejected',      color: 'text-error',           bg: 'bg-error/10',           icon: XCircle,       border: 'border-error/40' },
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: File Uploader Component
// ─────────────────────────────────────────────────────────────────────────────

function FileUploader({ label, value, onChange, folder, accept = 'image/*,.pdf', hint }) {
  const dispatch = useDispatch();
  const isUploading = useSelector((s) => s.upload.isUploading);
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
      const result = await dispatch(uploadSingleFile({ file, folder }));
      if (uploadSingleFile.fulfilled.match(result)) {
        onChange(result.payload.url);
      }
    },
    [dispatch, folder, onChange]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const isImage = value && (value.match(/\.(jpg|jpeg|png|webp|gif)$/i) || preview);
  const isPdf   = value && value.match(/\.pdf$/i);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-base-content/80">{label}</label>

      {/* Drop Zone */}
      <div
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
          ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : value ? 'border-success/50 bg-success/5' : 'border-base-300 hover:border-primary/50 hover:bg-primary/3'}
        `}
        style={{ minHeight: 120 }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3">
            <Loader2 className="animate-spin text-primary" size={28} />
            <span className="text-sm text-base-content/60 font-medium">Uploading…</span>
          </div>
        ) : value ? (
          <div className="relative group">
            {isImage || preview ? (
              <img src={preview || value} alt="Preview" className="w-full h-36 object-cover" />
            ) : isPdf ? (
              <div className="flex items-center gap-3 p-4">
                <FileText size={32} className="text-error/70" />
                <div>
                  <p className="text-sm font-semibold text-base-content">PDF Document</p>
                  <p className="text-xs text-base-content/50 truncate max-w-[180px]">{value.split('/').pop()}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <FileText size={32} className="text-primary/70" />
                <p className="text-xs text-base-content/50 truncate max-w-[200px]">{value.split('/').pop()}</p>
              </div>
            )}
            {/* Overlay actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); window.open(value, '_blank'); }}
                className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              >
                <Eye size={16} className="text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(''); setPreview(null); }}
                className="p-2 rounded-full bg-error/60 hover:bg-error/80 transition-colors"
              >
                <Trash2 size={16} className="text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              >
                <RefreshCw size={16} className="text-white" />
              </button>
            </div>
            <div className="absolute top-2 right-2 bg-success rounded-full p-0.5">
              <CheckCircle2 size={14} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload size={18} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-base-content/70">Drop file or click to upload</p>
            {hint && <p className="text-xs text-base-content/40">{hint}</p>}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: KYC STATUS
// ─────────────────────────────────────────────────────────────────────────────

function KycStatusTab({ kyc }) {
  const kycData = kyc?.kyc || {};
  const medical = kyc?.medicalFitness || {};

  const docs = [
    {
      label: 'Driving Licence',
      icon: Car,
      status: kycData.drivingLicenceNumber ? (kycData.verificationStatus || 'pending') : 'not-submitted',
      detail: kycData.drivingLicenceNumber
        ? `${kycData.drivingLicenceNumber} · Exp: ${kycData.drivingLicenceExpiry ? new Date(kycData.drivingLicenceExpiry).toLocaleDateString('en-IN') : '—'}`
        : 'Not submitted yet',
    },
    {
      label: 'Aadhaar Card',
      icon: ScanLine,
      status: kycData.aadhaarVerified ? 'verified' : kycData.aadhaarFrontUrl ? 'pending' : 'not-submitted',
      detail: kycData.aadhaarLast4 ? `XXXX XXXX ${kycData.aadhaarLast4}` : 'Not submitted yet',
    },
    {
      label: 'PAN Card',
      icon: FileText,
      status: kycData.panVerified ? 'verified' : kycData.panCardUrl ? 'pending' : 'not-submitted',
      detail: kycData.panNumber || 'Not submitted yet',
    },
    {
      label: 'PSV Badge',
      icon: ShieldCheck,
      status: kycData.psvBadgeNumber ? 'pending' : 'not-submitted',
      detail: kycData.psvBadgeNumber
        ? `${kycData.psvBadgeNumber} · Exp: ${kycData.psvBadgeExpiry ? new Date(kycData.psvBadgeExpiry).toLocaleDateString('en-IN') : '—'}`
        : 'Not submitted yet',
    },
    {
      label: 'Medical Fitness',
      icon: HeartPulse,
      status: medical.isValid ? 'verified' : medical.certificateNumber ? 'pending' : 'not-submitted',
      detail: medical.certificateNumber
        ? `Cert: ${medical.certificateNumber} · Blood: ${medical.bloodGroup || '—'}`
        : 'Not submitted yet',
    },
  ];

  const overallStatus = kycData.verificationStatus || 'not-submitted';
  const cfg = STATUS_CONFIG[overallStatus] || STATUS_CONFIG['not-submitted'];
  const OverallIcon = cfg.icon;

  const completedCount = docs.filter((d) => d.status === 'verified').length;
  const progress = Math.round((completedCount / docs.length) * 100);

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-5 flex items-center gap-4 ${cfg.bg} ${cfg.border}`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <OverallIcon size={22} className={cfg.color} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-0.5">Overall KYC Status</p>
          <p className={`text-lg font-black ${cfg.color}`}>{cfg.label}</p>
          {kycData.submittedAt && (
            <p className="text-xs text-base-content/40 mt-0.5">
              Submitted {new Date(kycData.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>{progress}%</p>
          <p className="text-xs text-base-content/40">{completedCount}/{docs.length} verified</p>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-base-content/50 font-semibold">
          <span>Verification Progress</span>
          <span>{completedCount} of {docs.length} complete</span>
        </div>
        <div className="h-2 rounded-full bg-base-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
          />
        </div>
      </div>

      {/* Document Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {docs.map((doc, i) => {
          const sc = STATUS_CONFIG[doc.status] || STATUS_CONFIG['not-submitted'];
          const DocIcon = doc.icon;
          const StatusIcon = sc.icon;
          return (
            <motion.div
              key={doc.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`rounded-xl border p-4 flex items-start gap-3 ${sc.bg} ${sc.border} transition-all`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${sc.bg} border ${sc.border}`}>
                <DocIcon size={18} className={sc.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content">{doc.label}</p>
                <p className="text-xs text-base-content/50 mt-0.5 truncate">{doc.detail}</p>
              </div>
              <StatusIcon size={16} className={`${sc.color} shrink-0 mt-0.5`} />
            </motion.div>
          );
        })}
      </div>

      {/* Rejection reason */}
      {kycData.rejectionReason && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-error/8 border border-error/30 p-4 flex gap-3"
        >
          <AlertTriangle size={18} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-error">Rejection Reason</p>
            <p className="text-xs text-base-content/60 mt-1">{kycData.rejectionReason}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SUBMIT KYC DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

function SubmitKycTab({ kyc, onSuccess }) {
  const dispatch = useDispatch();
  const isSubmitting = useSelector(selectLoading('submitKyc'));

  const kd = kyc?.kyc || {};
  const [form, setForm] = useState({
    aadhaarNumber:        '',
    aadhaarFrontUrl:      kd.aadhaarFrontUrl || '',
    aadhaarBackUrl:       kd.aadhaarBackUrl  || '',
    drivingLicenceNumber: kd.drivingLicenceNumber || '',
    drivingLicenceExpiry: kd.drivingLicenceExpiry ? kd.drivingLicenceExpiry.split('T')[0] : '',
    drivingLicenceDocUrl: kd.drivingLicenceDocUrl || '',
    licenceClass:         kd.licenceClass?.join(', ') || '',
    panNumber:            '',
    panCardUrl:           kd.panCardUrl || '',
  });

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setInput = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      licenceClass: form.licenceClass.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const result = await dispatch(submitKyc(payload));
    if (submitKyc.fulfilled.match(result)) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Driving Licence Section */}
      <Section icon={Car} title="Driving Licence" subtitle="Required for commercial operation" color="primary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="DL Number *">
            <input
              className="input-field w-full font-mono uppercase"
              placeholder="e.g. AP1520210012345"
              value={form.drivingLicenceNumber}
              onChange={setInput('drivingLicenceNumber')}
              required
            />
          </Field>
          <Field label="DL Expiry Date *">
            <input
              type="date"
              className="input-field w-full"
              value={form.drivingLicenceExpiry}
              onChange={setInput('drivingLicenceExpiry')}
              required
            />
          </Field>
          <Field label="Licence Class (comma separated)">
            <input
              className="input-field w-full"
              placeholder="e.g. LMV, Transport"
              value={form.licenceClass}
              onChange={setInput('licenceClass')}
            />
          </Field>
        </div>
        <FileUploader
          label="Driving Licence Document *"
          value={form.drivingLicenceDocUrl}
          onChange={set('drivingLicenceDocUrl')}
          folder="kyc/dl"
          accept="image/*,.pdf"
          hint="Front side · JPG, PNG or PDF · max 5 MB"
        />
      </Section>

      {/* Aadhaar Section */}
      <Section icon={ScanLine} title="Aadhaar Card" subtitle="12-digit government-issued ID" color="info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Aadhaar Number">
            <input
              className="input-field w-full font-mono tracking-widest"
              placeholder="XXXX XXXX XXXX"
              maxLength={12}
              value={form.aadhaarNumber}
              onChange={setInput('aadhaarNumber')}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FileUploader
            label="Aadhaar Front"
            value={form.aadhaarFrontUrl}
            onChange={set('aadhaarFrontUrl')}
            folder="kyc/aadhaar"
            hint="Front side of Aadhaar"
          />
          <FileUploader
            label="Aadhaar Back"
            value={form.aadhaarBackUrl}
            onChange={set('aadhaarBackUrl')}
            folder="kyc/aadhaar"
            hint="Back side of Aadhaar"
          />
        </div>
      </Section>

      {/* PAN Section */}
      <Section icon={BookOpen} title="PAN Card" subtitle="Permanent Account Number" color="accent">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="PAN Number">
            <input
              className="input-field w-full font-mono uppercase tracking-widest"
              placeholder="ABCDE1234F"
              maxLength={10}
              value={form.panNumber}
              onChange={setInput('panNumber')}
            />
          </Field>
        </div>
        <FileUploader
          label="PAN Card Document"
          value={form.panCardUrl}
          onChange={set('panCardUrl')}
          folder="kyc/pan"
          hint="Clear photo or scan of your PAN card"
        />
      </Section>

      <SubmitButton loading={isSubmitting} label="Submit KYC Documents" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MEDICAL FITNESS
// ─────────────────────────────────────────────────────────────────────────────

function MedicalTab({ kyc, onSuccess }) {
  const dispatch = useDispatch();
  const isSubmitting = useSelector(selectLoading('submitMedical'));
  const med = kyc?.medicalFitness || {};

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

  const [form, setForm] = useState({
    certificateNumber: med.certificateNumber || '',
    issuedBy:          med.issuedBy || '',
    issuedAt:          med.issuedAt ? med.issuedAt.split('T')[0] : '',
    expiryDate:        med.expiryDate ? med.expiryDate.split('T')[0] : '',
    documentUrl:       med.documentUrl || '',
    bloodGroup:        med.bloodGroup || 'Unknown',
  });

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setInput = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(submitMedicalFitness(form));
    if (submitMedicalFitness.fulfilled.match(result)) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section icon={Stethoscope} title="Medical Fitness Certificate" subtitle="Required for commercial driving — must be valid and unexpired" color="success">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Certificate Number">
            <input
              className="input-field w-full font-mono"
              placeholder="e.g. MFC/2024/001234"
              value={form.certificateNumber}
              onChange={setInput('certificateNumber')}
            />
          </Field>
          <Field label="Issued By">
            <input
              className="input-field w-full"
              placeholder="Hospital / Doctor name"
              value={form.issuedBy}
              onChange={setInput('issuedBy')}
            />
          </Field>
          <Field label="Issue Date">
            <input
              type="date"
              className="input-field w-full"
              value={form.issuedAt}
              onChange={setInput('issuedAt')}
            />
          </Field>
          <Field label="Expiry Date *">
            <input
              type="date"
              className="input-field w-full"
              value={form.expiryDate}
              onChange={setInput('expiryDate')}
              required
            />
          </Field>
        </div>

        {/* Blood Group Picker */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-base-content/80">Blood Group</label>
          <div className="flex flex-wrap gap-2">
            {BLOOD_GROUPS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setForm((p) => ({ ...p, bloodGroup: bg }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all duration-200
                  ${form.bloodGroup === bg
                    ? 'border-success bg-success/15 text-success scale-105'
                    : 'border-base-300 bg-base-200 text-base-content/60 hover:border-success/50'
                  }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        <FileUploader
          label="Medical Fitness Certificate *"
          value={form.documentUrl}
          onChange={set('documentUrl')}
          folder="kyc/medical"
          accept="image/*,.pdf"
          hint="Signed & stamped certificate · JPG, PNG or PDF"
        />
      </Section>

      <SubmitButton loading={isSubmitting} label="Submit Medical Certificate" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PSV BADGE
// ─────────────────────────────────────────────────────────────────────────────

function PsvTab({ kyc, onSuccess }) {
  const dispatch = useDispatch();
  const isSubmitting = useSelector(selectLoading('submitPsv'));
  const kd = kyc?.kyc || {};

  const [form, setForm] = useState({
    psvBadgeNumber: kd.psvBadgeNumber || '',
    psvBadgeExpiry: kd.psvBadgeExpiry ? kd.psvBadgeExpiry.split('T')[0] : '',
    psvBadgeDocUrl: kd.psvBadgeDocUrl || '',
  });

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setInput = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(submitPsvBadge(form));
    if (submitPsvBadge.fulfilled.match(result)) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section icon={Award} title="PSV Badge" subtitle="Public Service Vehicle badge — mandatory for commercial passenger transport" color="warning">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="PSV Badge Number *">
            <input
              className="input-field w-full font-mono uppercase tracking-widest"
              placeholder="e.g. PSV/AP/2024/001"
              value={form.psvBadgeNumber}
              onChange={setInput('psvBadgeNumber')}
              required
            />
          </Field>
          <Field label="Expiry Date *">
            <input
              type="date"
              className="input-field w-full"
              value={form.psvBadgeExpiry}
              onChange={setInput('psvBadgeExpiry')}
              required
            />
          </Field>
        </div>

        <FileUploader
          label="PSV Badge Document *"
          value={form.psvBadgeDocUrl}
          onChange={set('psvBadgeDocUrl')}
          folder="kyc/psv"
          accept="image/*,.pdf"
          hint="Clear scan / photo of your PSV badge"
        />

        <div className="rounded-xl bg-warning/8 border border-warning/30 p-4 flex gap-3">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-base-content/60 leading-relaxed">
            The PSV badge must be issued by the Regional Transport Authority (RTA) and be currently valid.
            An expired badge will be rejected and may affect your partner status.
          </p>
        </div>
      </Section>

      <SubmitButton loading={isSubmitting} label="Submit PSV Badge Details" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, color = 'primary', children }) {
  const colorMap = {
    primary: { ring: 'ring-primary/20',  bg: 'bg-primary/8',  text: 'text-primary',  border: 'border-primary/20'  },
    info:    { ring: 'ring-info/20',     bg: 'bg-info/8',     text: 'text-info',     border: 'border-info/20'     },
    accent:  { ring: 'ring-accent/20',   bg: 'bg-accent/8',   text: 'text-accent',   border: 'border-accent/20'   },
    success: { ring: 'ring-success/20',  bg: 'bg-success/8',  text: 'text-success',  border: 'border-success/20'  },
    warning: { ring: 'ring-warning/20',  bg: 'bg-warning/8',  text: 'text-warning',  border: 'border-warning/20'  },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-2xl border ${c.border} ${c.ring} ring-1 p-6 space-y-5`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={20} className={c.text} />
        </div>
        <div>
          <p className="font-bold text-base-content">{title}</p>
          <p className="text-xs text-base-content/50">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-base-content/70">{label}</label>
      {children}
    </div>
  );
}

function SubmitButton({ loading, label }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: 0.97 }}
      className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Submitting…</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight size={16} />
        </>
      )}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS TOAST OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function SuccessOverlay({ message, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.96 }}
        className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-success text-success-content rounded-2xl px-5 py-4 shadow-2xl"
        style={{ maxWidth: 340 }}
      >
        <CheckCircle2 size={22} />
        <p className="text-sm font-bold">{message}</p>
        <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function KycVerificationPage({ defaultTab = 'status', onTabChange }) {
  const dispatch = useDispatch();
  const kyc = useSelector(selectKyc);
  const isLoading = useSelector(selectLoading('kyc'));

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    dispatch(fetchKycStatus());
  }, [dispatch]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    onTabChange?.(id);
  };

  const handleSuccess = (msg) => {
    setSuccessMsg(msg);
    dispatch(fetchKycStatus());
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const kycStatus = kyc?.kyc?.verificationStatus || 'not-submitted';
  const sc = STATUS_CONFIG[kycStatus] || STATUS_CONFIG['not-submitted'];
  const StatusIcon = sc.icon;

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      {successMsg && (
        <SuccessOverlay message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      {/* Page Header */}
      <div className="px-4 sm:px-6 pt-6 pb-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <BadgeCheck size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-base-content tracking-tight">KYC &amp; Verification</h1>
              <p className="text-xs text-base-content/50">Upload and track your compliance documents</p>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${sc.bg} ${sc.border} self-start sm:self-auto`}>
            <StatusIcon size={14} className={sc.color} />
            <span className={`text-xs font-bold ${sc.color}`}>{sc.label}</span>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                whileTap={{ scale: 0.96 }}
                className={`relative flex items-center gap-2 px-4 py-3 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${isActive
                    ? 'text-primary bg-base-100 border border-b-0 border-base-300'
                    : 'text-base-content/50 hover:text-base-content hover:bg-base-200/60 border border-transparent'
                  }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Divider between tabs and content */}
      <div className="border-t border-base-300" />

      {/* Tab Content */}
      <div className="px-4 sm:px-6 py-6">
        {isLoading && !kyc ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-base-content/50">Loading KYC status…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'status'  && <KycStatusTab kyc={kyc} />}
              {activeTab === 'submit'  && <SubmitKycTab kyc={kyc} onSuccess={() => handleSuccess('KYC documents submitted successfully!')} />}
              {activeTab === 'medical' && <MedicalTab   kyc={kyc} onSuccess={() => handleSuccess('Medical certificate submitted!')} />}
              {activeTab === 'psv'     && <PsvTab       kyc={kyc} onSuccess={() => handleSuccess('PSV badge details submitted!')} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE with Next.js App Router (create one of these for each subroute)
// ─────────────────────────────────────────────────────────────────────────────
//
//  app/partner/solo/kyc/page.jsx          → <KycVerificationPage defaultTab="status"  />
//  app/partner/solo/kyc/submit/page.jsx   → <KycVerificationPage defaultTab="submit"  />
//  app/partner/solo/kyc/medical/page.jsx  → <KycVerificationPage defaultTab="medical" />
//  app/partner/solo/kyc/psv/page.jsx      → <KycVerificationPage defaultTab="psv"     />
//
// Or use with router-based tab switching:
//
//  'use client';
//  import { usePathname, useRouter } from 'next/navigation';
//  const pathname = usePathname();
//  const tab = pathname.split('/').pop(); // 'kyc' | 'submit' | 'medical' | 'psv'
//  <KycVerificationPage defaultTab={tab === 'kyc' ? 'status' : tab} onTabChange={(t) => router.push(`/partner/solo/kyc/${t === 'status' ? '' : t}`)} />