'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Upload, CheckCircle2, XCircle, AlertTriangle,
  FileText, Car, Fingerprint, ChevronRight, ChevronLeft,
  RefreshCw, Eye, EyeOff, Info, BadgeCheck, Lock, Loader2, Heart,
  Stethoscope, ListChecks, Paperclip,
} from 'lucide-react';
import {
  fetchDriverMe,
  submitDriverKyc,
  reuploadDriverKycDocument,
  updateDriverLicenceNumbers,
  updateDriverMedicalFitness,
  fetchDriverCompliance,
} from '@/store/slices/transportPartnerSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Pending:        { label: 'Pending',      icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  'Under-Review': { label: 'Under Review', icon: RefreshCw,     color: 'text-info',    bg: 'bg-info/10',    border: 'border-info/30'    },
  Verified:       { label: 'Verified',     icon: CheckCircle2,  color: 'text-success', bg: 'bg-success/10', border: 'border-success/40' },
  Rejected:       { label: 'Rejected',     icon: XCircle,       color: 'text-error',   bg: 'bg-error/10',   border: 'border-error/40'   },
};

// ─── SMALL REUSABLE COMPONENTS ─────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function FieldNote({ children }) {
  return (
    <p className="flex items-start gap-1 mt-1 text-xs text-base-content/50 leading-relaxed">
      <Info size={10} className="mt-0.5 shrink-0 text-primary/40" />
      {children}
    </p>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, status }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="font-display font-bold text-base text-base-content">{title}</h3>
          {subtitle && <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {status && <StatusBadge status={status} />}
    </div>
  );
}

function InputField({ label, name, value, onChange, placeholder, type = 'text', note, disabled, required, maxLength }) {
  return (
    <div>
      <label className="label">
        <span className="label-text">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </span>
      </label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} disabled={disabled} maxLength={maxLength}
        className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

function DateField({ label, name, value, onChange, note, disabled }) {
  return (
    <div>
      <label className="label"><span className="label-text">{label}</span></label>
      <input
        type="date" name={name}
        value={value ? value.slice(0, 10) : ''}
        onChange={onChange} disabled={disabled}
        className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

/**
 * FileUploadField
 * ───────────────
 * Uses the uploadSingleFile Redux thunk (from uploadSlice) to upload files.
 * Calls onUploaded(url) with the CDN URL returned by the thunk.
 * Shows existing URL as a "View uploaded document" link.
 *
 * Props:
 *  - label        : field label string
 *  - existingUrl  : pre-existing CDN URL (from Redux / API hydration)
 *  - onUploaded   : callback(url) — caller stores the URL in form state
 *  - folder       : ImageKit/CDN folder name (e.g. 'kyc-documents')
 *  - note         : helper text
 *  - disabled     : disables file picker
 *  - accept       : MIME types string
 */
function FileUploadField({
  label,
  existingUrl,
  onUploaded,
  folder = 'kyc-documents',
  note,
  disabled,
  accept = 'image/*,application/pdf',
}) {
  const dispatch  = useDispatch();
  const inputRef  = useRef(null);

  // Pull uploading state from the upload slice
  const isUploading = useSelector((s) => s.upload.isUploading);

  const [localFile,  setLocalFile]  = useState(null);
  const [uploadErr,  setUploadErr]  = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalFile(file);
    setUploadErr(null);

    const result = await dispatch(uploadSingleFile({ file, folder }));

    if (uploadSingleFile.fulfilled.match(result)) {
      // uploadSlice stores the url at result.payload.url
      const url = result.payload?.url;
      if (url) {
        onUploaded(url);
      } else {
        setUploadErr('Upload succeeded but no URL was returned.');
      }
    } else {
      // The thunk already shows a toast; surface inline error too
      setUploadErr(result.payload?.message || 'Upload failed. Please try again.');
      setLocalFile(null);
    }
  };

  return (
    <div>
      <label className="label"><span className="label-text">{label}</span></label>

      {/* Existing doc link */}
      {existingUrl && !localFile && (
        <div className="flex items-center gap-2 mb-2 p-2.5 rounded-lg bg-success/10 border border-success/30">
          <Paperclip size={12} className="text-success shrink-0" />
          <a
            href={existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-success underline underline-offset-2 truncate max-w-xs"
          >
            View uploaded document
          </a>
          <CheckCircle2 size={12} className="text-success ml-auto shrink-0" />
        </div>
      )}

      {/* Local file name shown during / after selection */}
      {localFile && (
        <div className="flex items-center gap-2 mb-2 p-2.5 rounded-lg bg-base-200 border border-base-300">
          <Paperclip size={12} className="text-primary shrink-0" />
          <span className="text-xs text-base-content/70 truncate max-w-xs">{localFile.name}</span>
          {isUploading
            ? <Loader2 size={12} className="animate-spin text-primary ml-auto shrink-0" />
            : <CheckCircle2 size={12} className="text-success ml-auto shrink-0" />
          }
        </div>
      )}

      {/* Upload error */}
      {uploadErr && (
        <p className="text-xs text-error mb-1.5 flex items-center gap-1">
          <XCircle size={10} /> {uploadErr}
        </p>
      )}

      {/* Trigger button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          className="btn btn-outline btn-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading
            ? <Loader2 size={13} className="animate-spin" />
            : <Upload size={13} />
          }
          {isUploading ? 'Uploading…' : existingUrl ? 'Replace File' : 'Choose File'}
        </button>
        <span className="text-xs text-base-content/40">JPG, PNG or PDF · max 5 MB</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || isUploading}
        onChange={handleFileChange}
      />

      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`card p-6 mb-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function ComplianceFlag({ data, label }) {
  if (!data) return null;
  const color =
    data.status === 'valid'         ? 'text-success' :
    data.status === 'expiring_soon' ? 'text-warning' :
    data.status === 'expired'       ? 'text-error'   : 'text-base-content/40';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-base-300 last:border-0">
      <span className="text-xs text-base-content/60">{label}</span>
      <div className="flex items-center gap-2">
        {data.expiresAt && (
          <span className="text-xs text-base-content/40">
            {new Date(data.expiresAt).toLocaleDateString()}
          </span>
        )}
        <span className={`text-xs font-bold capitalize ${color}`}>
          {data.status === 'missing' ? 'Not uploaded' : (data.status || '').replace('_', ' ')}
        </span>
        {data.daysLeft > 0 && data.status !== 'valid' && (
          <span className="text-xs text-base-content/40">({data.daysLeft}d left)</span>
        )}
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'identity',   label: 'Identity',   icon: Fingerprint },
  { id: 'licence',    label: 'Licence',    icon: Car         },
  { id: 'psv',        label: 'PSV Badge',  icon: BadgeCheck  },
  { id: 'medical',    label: 'Medical',    icon: Stethoscope },
  { id: 'compliance', label: 'Compliance', icon: ListChecks  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function KycDocuments() {
  const dispatch = useDispatch();
  const router   = useRouter();

  // ── Redux selectors ───────────────────────────────────────────────────────
  const { driverMe, driverCompliance, loading } = useSelector((s) => s.transportPartner);

  const [activeTab,   setActiveTab]   = useState('identity');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showPan,     setShowPan]     = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // identity
    aadhaarNumber:        '',
    aadhaarDocUrl:        '',
    panNumber:            '',
    panDocUrl:            '',
    // licence
    drivingLicenceNumber: '',
    drivingLicenceExpiry: '',
    drivingLicenceDocUrl: '',
    licenceClass:         '',
    // PSV badge
    psvBadgeNumber: '',
    psvBadgeExpiry: '',
    psvBadgeDocUrl: '',
    // medical fitness
    certificateNumber: '',
    issuedBy:          '',
    issuedAt:          '',
    expiryDate:        '',
    documentUrl:       '',
    bloodGroup:        'Unknown',
  });

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverCompliance());
  }, [dispatch]);

  // ── Hydrate form from driverMe ────────────────────────────────────────────
  useEffect(() => {
    if (!driverMe) return;
    const k = driverMe.kyc            || {};
    const m = driverMe.medicalFitness || {};

    setForm({
      aadhaarNumber:        '',
      aadhaarDocUrl:        k.aadhaarDocUrl        || '',
      panNumber:            k.panNumber            || '',
      panDocUrl:            k.panDocUrl            || '',
      drivingLicenceNumber: k.drivingLicenceNumber || '',
      drivingLicenceExpiry: k.drivingLicenceExpiry || '',
      drivingLicenceDocUrl: k.drivingLicenceDocUrl || '',
      licenceClass:         Array.isArray(k.licenceClass)
                              ? k.licenceClass.join(', ')
                              : (k.licenceClass   || ''),
      psvBadgeNumber:       k.psvBadgeNumber       || '',
      psvBadgeExpiry:       k.psvBadgeExpiry       || '',
      psvBadgeDocUrl:       k.psvBadgeDocUrl       || '',
      certificateNumber:    m.certificateNumber     || '',
      issuedBy:             m.issuedBy              || '',
      issuedAt:             m.issuedAt              || '',
      expiryDate:           m.expiryDate            || '',
      documentUrl:          m.documentUrl           || '',
      bloodGroup:           m.bloodGroup            || 'Unknown',
    });
  }, [driverMe]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Helper: set a doc URL field after CDN upload succeeds
  const setDocUrl = (field) => (url) =>
    setForm((f) => ({ ...f, [field]: url }));

  // ── Derived values ────────────────────────────────────────────────────────
  const kycStatus    = driverMe?.kyc?.verificationStatus || 'Pending';
  const isVerified   = kycStatus === 'Verified';
  const isRejected   = kycStatus === 'Rejected';
  const rejReason    = driverMe?.kyc?.rejectionReason || null;
  const aadhaarLast4 = driverMe?.kyc?.aadhaarLast4    || null;
  const existingPan  = driverMe?.kyc?.panNumber        || null;
  const compliance   = driverCompliance || null;

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleSubmitIdentity = () => {
    const payload = {
      ...(form.aadhaarNumber && { aadhaarNumber: form.aadhaarNumber }),
      ...(form.aadhaarDocUrl && { aadhaarDocUrl: form.aadhaarDocUrl }),
      ...(form.panNumber     && { panNumber:     form.panNumber     }),
      ...(form.panDocUrl     && { panDocUrl:     form.panDocUrl     }),
    };
    if (isRejected && (form.aadhaarDocUrl || form.panDocUrl)) {
      dispatch(reuploadDriverKycDocument(payload));
    } else {
      dispatch(submitDriverKyc(payload));
    }
  };

  const handleSubmitLicenceNumbers = () => {
    dispatch(updateDriverLicenceNumbers({
      drivingLicenceNumber: form.drivingLicenceNumber,
      drivingLicenceExpiry: form.drivingLicenceExpiry,
      licenceClass: form.licenceClass
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));
  };

  const handleSubmitPsvNumbers = () => {
    dispatch(updateDriverLicenceNumbers({
      psvBadgeNumber: form.psvBadgeNumber,
      psvBadgeExpiry: form.psvBadgeExpiry,
    }));
  };

  const handleSubmitMedical = (e) => {
    e.preventDefault();
    dispatch(updateDriverMedicalFitness({
      certificateNumber: form.certificateNumber,
      issuedBy:          form.issuedBy,
      issuedAt:          form.issuedAt,
      expiryDate:        form.expiryDate,
      documentUrl:       form.documentUrl,
      bloodGroup:        form.bloodGroup,
    }));
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div data-theme="driver" className="min-h-screen bg-base-100">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Page header ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm gap-1.5 mb-4 -ml-2 text-base-content/60 hover:text-base-content"
          >
            <ChevronLeft size={16} />
            Go Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl md:text-3xl text-base-content tracking-tight">
                KYC &amp; Documents
              </h1>
              <p className="text-sm text-base-content/50 mt-0.5">
                Submit your identity and licence documents to get verified and start receiving trips.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── KYC status banner ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className={`flex items-start gap-4 p-4 rounded-2xl border mb-6
            ${STATUS_CFG[kycStatus]?.bg     || 'bg-warning/10'}
            ${STATUS_CFG[kycStatus]?.border || 'border-warning/30'}`}
        >
          {(() => {
            const Icon = STATUS_CFG[kycStatus]?.icon || AlertTriangle;
            return (
              <Icon
                size={20}
                className={`mt-0.5 shrink-0 ${STATUS_CFG[kycStatus]?.color || 'text-warning'}`}
              />
            );
          })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold text-sm ${STATUS_CFG[kycStatus]?.color || 'text-warning'}`}>
                KYC Status: {STATUS_CFG[kycStatus]?.label || 'Pending'}
              </span>
              {driverMe?.kyc?.verifiedAt && (
                <span className="text-xs text-base-content/40">
                  · Verified {new Date(driverMe.kyc.verifiedAt).toLocaleDateString()}
                </span>
              )}
              {aadhaarLast4 && (
                <span className="text-xs text-base-content/40">· Aadhaar ••••{aadhaarLast4}</span>
              )}
              {existingPan && (
                <span className="text-xs text-base-content/40">· PAN {existingPan}</span>
              )}
            </div>
            {rejReason && (
              <p className="text-xs text-error mt-1 font-medium">Rejection reason: {rejReason}</p>
            )}
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="text-xs text-base-content/50">
                Profile:{' '}
                <strong className="text-base-content">
                  {driverMe?.profileCompletionPercent ?? 0}%
                </strong>{' '}
                complete
              </span>
              {driverMe?.isVerified && (
                <span className="flex items-center gap-1 text-xs text-success font-semibold">
                  <BadgeCheck size={12} /> Account verified
                </span>
              )}
              {driverMe?.isBlocked && (
                <span className="text-xs text-error font-semibold">⛔ Account blocked</span>
              )}
              {driverMe?.isPaused && (
                <span className="text-xs text-warning font-semibold">⏸ Account paused</span>
              )}
            </div>
          </div>
          {isVerified && <BadgeCheck size={28} className="text-success shrink-0" />}
        </motion.div>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-base-200 rounded-xl mb-6 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const Icon   = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                  whitespace-nowrap transition-all duration-200 flex-1 justify-center min-w-fit
                  ${active
                    ? 'bg-base-100 text-primary shadow-sm border border-base-300'
                    : 'text-base-content/50 hover:text-base-content'}`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab panels ───────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* ══ IDENTITY — Aadhaar + PAN ════════════════════ */}
          {activeTab === 'identity' && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <SectionHeader
                  icon={Fingerprint}
                  title="Aadhaar &amp; PAN"
                  subtitle="Government-issued identity documents"
                  status={kycStatus}
                />

                {isRejected && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-error/10 border border-error/30 mb-4">
                    <XCircle size={14} className="text-error mt-0.5 shrink-0" />
                    <div className="text-xs text-error leading-relaxed">
                      KYC was rejected. Correct your documents and re-submit.
                      {rejReason && <p className="font-semibold mt-0.5">{rejReason}</p>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                  {/* ── Aadhaar number ─────────────────────── */}
                  <div>
                    <label className="label">
                      <span className="label-text">
                        Aadhaar Number
                        {isVerified && <BadgeCheck size={12} className="text-success inline ml-1" />}
                        <span className="text-error ml-0.5">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAadhaar((v) => !v)}
                        className="ml-auto text-base-content/30 hover:text-primary transition-colors"
                      >
                        {showAadhaar ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </label>
                    <input
                      type={showAadhaar ? 'text' : 'password'}
                      name="aadhaarNumber"
                      value={form.aadhaarNumber}
                      onChange={handleChange}
                      placeholder={aadhaarLast4 ? `XXXX XXXX ${aadhaarLast4}` : '1234 5678 9012'}
                      maxLength={12}
                      disabled={isVerified}
                      className="input-field w-full disabled:opacity-50"
                    />
                    {aadhaarLast4 && (
                      <p className="text-xs text-success mt-1 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Aadhaar on file — ending ••••{aadhaarLast4}
                      </p>
                    )}
                    <FieldNote>
                      12-digit number — no spaces. Stored encrypted; only last 4 digits visible after save.
                    </FieldNote>
                  </div>

                  {/* ── PAN number ─────────────────────────── */}
                  <div>
                    <label className="label">
                      <span className="label-text">
                        PAN Number
                        {isVerified && <BadgeCheck size={12} className="text-success inline ml-1" />}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPan((v) => !v)}
                        className="ml-auto text-base-content/30 hover:text-primary transition-colors"
                      >
                        {showPan ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </label>
                    <input
                      type={showPan ? 'text' : 'password'}
                      name="panNumber"
                      value={form.panNumber}
                      onChange={handleChange}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      disabled={isVerified}
                      className="input-field w-full disabled:opacity-50"
                    />
                    {existingPan && (
                      <p className="text-xs text-success mt-1 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        PAN on file:{' '}
                        {showPan
                          ? existingPan
                          : `${existingPan.slice(0, 2)}•••${existingPan.slice(-2)}`}
                      </p>
                    )}
                    <FieldNote>
                      10-character PAN — format AAAAA9999A. Required for settlements above ₹5,000.
                    </FieldNote>
                  </div>

                  {/* ── Aadhaar document upload ─────────────── */}
                  <FileUploadField
                    label="Aadhaar Document (Front side)"
                    existingUrl={form.aadhaarDocUrl}
                    onUploaded={setDocUrl('aadhaarDocUrl')}
                    folder="kyc-aadhaar"
                    disabled={isVerified}
                    note="Front side showing name, DOB, gender and photo. Min 300 DPI. JPG, PNG or PDF · max 5 MB."
                  />

                  {/* ── PAN document upload ─────────────────── */}
                  <FileUploadField
                    label="PAN Card Image"
                    existingUrl={form.panDocUrl}
                    onUploaded={setDocUrl('panDocUrl')}
                    folder="kyc-pan"
                    disabled={isVerified}
                    note="Clear scan or photo of PAN card. Name must match Aadhaar exactly or verification fails."
                  />
                </div>

                <div className="flex items-center justify-between gap-4 mt-6 flex-wrap">
                  <p className="text-xs text-base-content/40 flex items-center gap-1">
                    <Lock size={10} />
                    All ID numbers encrypted at rest (AES-256). Never shared externally.
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmitIdentity}
                    disabled={loading || isVerified}
                    className="btn btn-primary gap-2"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {isRejected ? 'Re-submit for Review' : 'Submit for Verification'}
                  </button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══ DRIVING LICENCE ════════════════════════════ */}
          {activeTab === 'licence' && (
            <motion.div
              key="licence"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {/* Numbers + class */}
              <Card>
                <SectionHeader
                  icon={Car}
                  title="Driving Licence — Details"
                  subtitle="Licence number, expiry and vehicle classes"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Licence Number" required
                    name="drivingLicenceNumber" value={form.drivingLicenceNumber}
                    onChange={handleChange} placeholder="AP09 20240001234"
                    note="Exactly as printed on DL — state code + RTO code + year + serial. No spaces or dashes."
                  />
                  <DateField
                    label="Licence Expiry Date"
                    name="drivingLicenceExpiry" value={form.drivingLicenceExpiry}
                    onChange={handleChange}
                    note="Must be valid for at least 6 months. Expired DL blocks all trip assignments immediately."
                  />
                  <div className="sm:col-span-2">
                    <InputField
                      label="Licence Class(es)"
                      name="licenceClass" value={form.licenceClass}
                      onChange={handleChange}
                      placeholder="LMV, Transport, HMV"
                      note="Comma-separated. E.g. LMV, Transport, HMV, MCWOG. Must cover the vehicle category you drive."
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={handleSubmitLicenceNumbers}
                    disabled={loading}
                    className="btn btn-primary gap-2"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                    Save Licence Details
                  </button>
                </div>
              </Card>

              {/* DL document upload — auto-dispatches reupload on CDN completion */}
              <Card>
                <SectionHeader
                  icon={Upload}
                  title="Driving Licence — Document"
                  subtitle="Upload scan or photo of your DL"
                />
                <FileUploadField
                  label="DL Scan / Photo"
                  existingUrl={form.drivingLicenceDocUrl}
                  folder="kyc-driving-licence"
                  onUploaded={(url) => {
                    setDocUrl('drivingLicenceDocUrl')(url);
                    dispatch(reuploadDriverKycDocument({ drivingLicenceDocUrl: url }));
                  }}
                  note="Both sides in a single PDF or JPEG. Smart card (chip) DL format preferred. Under 5 MB."
                />
              </Card>

              {/* Compliance notes */}
              <Card className="bg-base-200 border-base-300">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-primary" />
                  <span className="text-sm font-bold text-base-content">Compliance Notes</span>
                </div>
                <ul className="space-y-2">
                  {[
                    'Licence class must match the vehicle category you are assigned to drive.',
                    'If your DL is expired, renew at the nearest RTO before resubmitting.',
                    'Likeson alerts you 30 days before DL expiry — keep push notifications on.',
                    'DL suspension or revocation triggers an immediate account hold and trip cancellation.',
                    'International licences are not accepted. Must be issued by an Indian RTO.',
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-base-content/60">
                      <ChevronRight size={11} className="text-primary mt-0.5 shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {/* ══ PSV BADGE ══════════════════════════════════ */}
          {activeTab === 'psv' && (
            <motion.div
              key="psv"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <SectionHeader
                  icon={BadgeCheck}
                  title="PSV Badge"
                  subtitle="Public Service Vehicle badge — required for passenger transport"
                />
                <div className="p-3 rounded-xl bg-info/10 border border-info/30 mb-5 flex items-start gap-2">
                  <Info size={14} className="text-info mt-0.5 shrink-0" />
                  <p className="text-xs text-base-content/70 leading-relaxed">
                    PSV badge is mandatory for drivers carrying fare-paying passengers. Issued by your
                    Regional Transport Office after a background check and driving test.
                    Without a valid PSV badge you cannot be assigned passenger trips.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="PSV Badge Number"
                    name="psvBadgeNumber" value={form.psvBadgeNumber}
                    onChange={handleChange} placeholder="AP09 PSV 12345"
                    note="Badge number printed on the PSV badge card issued by your RTO. Include prefix exactly."
                  />
                  <DateField
                    label="PSV Badge Expiry"
                    name="psvBadgeExpiry" value={form.psvBadgeExpiry}
                    onChange={handleChange}
                    note="PSV badges are typically valid for 3 years. Renew before expiry to avoid trip suspension."
                  />
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={handleSubmitPsvNumbers}
                    disabled={loading}
                    className="btn btn-primary gap-2"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                    Save PSV Details
                  </button>
                </div>
              </Card>

              {/* PSV doc upload — auto-dispatches reupload on CDN completion */}
              <Card>
                <SectionHeader
                  icon={Upload}
                  title="PSV Badge — Document"
                  subtitle="Photo or scan of the badge card"
                />
                <FileUploadField
                  label="PSV Badge Document"
                  existingUrl={form.psvBadgeDocUrl}
                  folder="kyc-psv-badge"
                  onUploaded={(url) => {
                    setDocUrl('psvBadgeDocUrl')(url);
                    dispatch(reuploadDriverKycDocument({ psvBadgeDocUrl: url }));
                  }}
                  note="Clear photo of front and back of PSV badge card. JPEG or PDF. Under 5 MB. No glare or shadows."
                />
              </Card>
            </motion.div>
          )}

          {/* ══ MEDICAL FITNESS ════════════════════════════ */}
          {activeTab === 'medical' && (
            <motion.form
              key="medical"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmitMedical}
            >
              <Card>
                <SectionHeader
                  icon={Stethoscope}
                  title="Medical Fitness Certificate"
                  subtitle="Issued by a registered medical practitioner or government hospital"
                />
                <div className="p-3 rounded-xl bg-info/10 border border-info/30 mb-5 flex items-start gap-2">
                  <Heart size={14} className="text-info mt-0.5 shrink-0" />
                  <p className="text-xs text-base-content/70 leading-relaxed">
                    Required for drivers handling patient transport (ambulance, wheelchair, stretcher trips).
                    Certificate must be from a recognised government hospital or NABH-accredited clinic.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Certificate Number"
                    name="certificateNumber" value={form.certificateNumber}
                    onChange={handleChange} placeholder="MFC/AP/2024/00123"
                    note="Unique ID printed on the fitness certificate. Must match the uploaded document."
                  />
                  <InputField
                    label="Issued By"
                    name="issuedBy" value={form.issuedBy}
                    onChange={handleChange} placeholder="Govt. General Hospital, Vijayawada"
                    note="Full name of the hospital or registered medical practitioner who issued the certificate."
                  />
                  <DateField
                    label="Issue Date"
                    name="issuedAt" value={form.issuedAt}
                    onChange={handleChange}
                    note="Date the certificate was signed and issued by the medical authority."
                  />
                  <DateField
                    label="Expiry Date"
                    name="expiryDate" value={form.expiryDate}
                    onChange={handleChange}
                    note="Most certificates valid for 1 year. Likeson alerts 30 days before expiry."
                  />
                  <div>
                    <label className="label"><span className="label-text">Blood Group</span></label>
                    <select
                      name="bloodGroup" value={form.bloodGroup} onChange={handleChange}
                      className="input-field w-full"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                    <FieldNote>
                      Stored for emergency use only. Shared with hospital partner on medical trips.
                    </FieldNote>
                  </div>
                  <FileUploadField
                    label="Certificate Document"
                    existingUrl={form.documentUrl}
                    onUploaded={setDocUrl('documentUrl')}
                    folder="kyc-medical"
                    note="Scanned copy or clear photo. PDF preferred. Under 5 MB. All text must be legible."
                  />
                </div>
                <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
                  <p className="text-xs text-base-content/40 flex items-center gap-1">
                    <Lock size={10} />
                    Medical data stored securely, never shared without your consent.
                  </p>
                  <button type="submit" disabled={loading} className="btn btn-primary gap-2">
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Save Medical Details
                  </button>
                </div>
              </Card>
            </motion.form>
          )}

          {/* ══ COMPLIANCE DASHBOARD ═══════════════════════ */}
          {activeTab === 'compliance' && (
            <motion.div
              key="compliance"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <SectionHeader
                  icon={ListChecks}
                  title="Compliance Summary"
                  subtitle="Live overview of all document statuses and expiry dates"
                />

                {!compliance ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-base-content/40">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Loading compliance data…</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      {[
                        {
                          label: 'KYC Status',
                          value: compliance.kycStatus || 'Pending',
                          color: compliance.kycStatus === 'Verified' ? 'text-success' : 'text-warning',
                        },
                        {
                          label: 'Account Verified',
                          value: compliance.isVerified ? 'Yes' : 'No',
                          color: compliance.isVerified ? 'text-success' : 'text-error',
                        },
                        {
                          label: 'Blocked',
                          value: compliance.isBlocked ? 'Yes' : 'No',
                          color: compliance.isBlocked ? 'text-error' : 'text-success',
                        },
                        {
                          label: 'Profile',
                          value: `${compliance.profileCompletion ?? 0}%`,
                          color: (compliance.profileCompletion ?? 0) >= 70 ? 'text-success' : 'text-warning',
                        },
                      ].map((item) => (
                        <div key={item.label} className="stat-card text-center">
                          <div className={`stat-card-value text-xl ${item.color}`}>{item.value}</div>
                          <div className="stat-card-label">{item.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Expiry table */}
                    <div className="rounded-xl border border-base-300 overflow-hidden mb-4">
                      <div className="px-4 py-3 bg-base-200 border-b border-base-300">
                        <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">
                          Document Expiry Status
                        </span>
                      </div>
                      <div className="px-4 py-1">
                        <ComplianceFlag data={compliance.drivingLicence} label="Driving Licence" />
                        <ComplianceFlag data={compliance.psvBadge}       label="PSV Badge" />
                        <ComplianceFlag data={compliance.medicalFitness} label="Medical Fitness Certificate" />
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      {[
                        { color: 'text-success', label: 'Valid' },
                        { color: 'text-warning', label: 'Expiring ≤ 30 days' },
                        { color: 'text-error',   label: 'Expired / Missing' },
                      ].map((l) => (
                        <span key={l.label} className={`flex items-center gap-1 text-xs ${l.color}`}>
                          <span className="w-2 h-2 rounded-full bg-current inline-block" />
                          {l.label}
                        </span>
                      ))}
                    </div>

                    {/* Quick-fix actions */}
                    <div className="flex flex-wrap gap-2">
                      {compliance.kycStatus !== 'Verified' && (
                        <button onClick={() => setActiveTab('identity')} className="btn btn-sm btn-primary gap-1">
                          <Shield size={12} /> Complete KYC
                        </button>
                      )}
                      {compliance.drivingLicence?.status !== 'valid' && (
                        <button onClick={() => setActiveTab('licence')} className="btn btn-sm btn-outline gap-1">
                          <Car size={12} /> Update Licence
                        </button>
                      )}
                      {compliance.psvBadge?.status !== 'valid' && (
                        <button onClick={() => setActiveTab('psv')} className="btn btn-sm btn-outline gap-1">
                          <BadgeCheck size={12} /> Update PSV Badge
                        </button>
                      )}
                      {compliance.medicalFitness?.status !== 'valid' && (
                        <button onClick={() => setActiveTab('medical')} className="btn btn-sm btn-outline gap-1">
                          <Stethoscope size={12} /> Update Medical
                        </button>
                      )}
                      {compliance.drivingLicence?.status === 'valid' &&
                       compliance.psvBadge?.status       === 'valid' &&
                       compliance.medicalFitness?.status === 'valid' && (
                        <div className="flex items-center gap-2 text-success text-xs font-semibold">
                          <CheckCircle2 size={14} />
                          All documents are valid and up to date.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}