"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, ScanLine, FileText, ChevronRight, Upload,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Eye,
  Link2, Image as ImageIcon, X, ExternalLink, Clock,
  RefreshCcw, Info, Shield, Camera
} from "lucide-react";

import {
  fetchMyDoctorProfile,
  updateDoctorKyc,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from "@/store/slices/hospitalSlice";

import {
  uploadSingleFile,
  resetUploadState,
} from "@/store/slices/uploadSlice";

// ═══════════════════════════════════════════════════════════════════════════════
// NAV LINKS
// ═══════════════════════════════════════════════════════════════════════════════
const links = [
  { name: "KYC Status",           section: "",        icon: ShieldCheck },
  { name: "Aadhaar Verification", section: "aadhaar", icon: ScanLine    },
  { name: "PAN Verification",     section: "pan",     icon: FileText    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE: STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════
function StatusBadge({ status, size = "md" }) {
  const map = {
    verified:        { label: "Verified",      cls: "badge badge-success" },
    pending:         { label: "Pending",        cls: "badge badge-warning" },
    rejected:        { label: "Rejected",       cls: "badge badge-error" },
    "not-submitted": { label: "Not Submitted",  cls: "badge badge-info" },
    "under-review":  { label: "Under Review",   cls: "badge badge-warning" },
  };
  const cfg = map[status] || { label: status || "Unknown", cls: "badge" };
  return (
    <span className={`${cfg.cls} ${size === "lg" ? "text-sm px-4 py-1.5" : ""}`}>
      {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE: FILE/URL UPLOAD FIELD
// Supports: drag-drop file, file picker, or paste URL
// ═══════════════════════════════════════════════════════════════════════════════
function DocUploadField({ label, currentUrl, onUpload, folder, accept = "image/*,.pdf", required = false }) {
  const dispatch        = useDispatch();
  const upload          = useSelector((s) => s.upload);
  const fileRef         = useRef(null);
  const [mode, setMode] = useState("file"); // "file" | "url"
  const [urlInput, setUrlInput]   = useState("");
  const [dragging, setDragging]   = useState(false);
  const [preview, setPreview]     = useState(currentUrl || "");
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => { setPreview(currentUrl || ""); }, [currentUrl]);

  const handleFile = async (file) => {
    if (!file) return;
    setLocalLoading(true);
    dispatch(resetUploadState());
    const result = await dispatch(uploadSingleFile({ file, folder }));
    if (uploadSingleFile.fulfilled.match(result)) {
      const url = result.payload?.url || result.payload?.data?.url;
      setPreview(url);
      onUpload(url);
    }
    setLocalLoading(false);
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    setPreview(urlInput.trim());
    onUpload(urlInput.trim());
    setUrlInput("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isLoading = localLoading || upload.isUploading;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-base-content">
          {label} {required && <span className="text-error">*</span>}
        </label>
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-base-300 text-xs">
          {[["file", Camera], ["url", Link2]].map(([m, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-center gap-1 px-3 py-1.5 font-semibold transition-colors ${
                mode === m ? "bg-primary text-primary-content" : "text-base-content/60 hover:bg-base-200"
              }`}
            >
              <Icon size={12} />
              {m === "file" ? "Upload" : "URL"}
            </button>
          ))}
        </div>
      </div>

      {/* File mode */}
      {mode === "file" && (
        <div
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-base-300 bg-base-200/30 hover:border-primary/50 hover:bg-primary/3"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-xs text-base-content/60">Uploading…</p>
            </div>
          ) : (
            <>
              <div className="p-2 rounded-full bg-base-300">
                <Upload size={18} className="text-base-content/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-base-content">Drop file or click to browse</p>
                <p className="text-xs text-base-content/40 mt-0.5">JPG, PNG, PDF — max 10 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* URL mode */}
      {mode === "url" && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            placeholder="Paste document URL…"
            className="input-field flex-1 text-sm"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            className="btn-primary-cta text-xs px-4 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      {/* Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/20">
              <CheckCircle2 size={16} className="text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-success">Document set</p>
                <p className="text-xs text-base-content/50 truncate">{preview}</p>
              </div>
              <a href={preview} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/70">
                <ExternalLink size={14} />
              </a>
              <button
                type="button"
                onClick={() => { setPreview(""); onUpload(""); }}
                className="text-base-content/30 hover:text-error"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: KYC STATUS (index)
// ═══════════════════════════════════════════════════════════════════════════════
function KycStatus({ profile, router }) {
  const kycStatus    = profile?.kycStatus || "not-submitted";
  const kyc          = profile?.kyc || {};
  const isComplete   = kycStatus === "verified";
  const isPending    = kycStatus === "pending" || kycStatus === "under-review";
  const isRejected   = kycStatus === "rejected";

  const statusIcon = {
    verified:       <CheckCircle2 size={40} className="text-success" />,
    pending:        <Clock size={40} className="text-warning" />,
    "under-review": <RefreshCcw size={40} className="text-info" />,
    rejected:       <XCircle size={40} className="text-error" />,
    "not-submitted":<Shield size={40} className="text-base-content/30" />,
  };

  const statusMsg = {
    verified:       "Your KYC is fully verified. Your account is active.",
    pending:        "Your documents are submitted and awaiting admin review.",
    "under-review": "Your documents are currently under review.",
    rejected:       profile?.kycRejectionReason || "KYC was rejected. Please re-submit.",
    "not-submitted":"You haven't submitted KYC yet. Complete it to activate your account.",
  };

  const docs = [
    { label: "Aadhaar (Front)", url: kyc.aadhaarFrontUrl, verified: kyc.aadhaarVerified },
    { label: "Aadhaar (Back)",  url: kyc.aadhaarBackUrl,  verified: kyc.aadhaarVerified },
    { label: "PAN Card",        url: kyc.panCardUrl,       verified: kyc.panVerified     },
  ];

  return (
    <div className="space-y-6">
      {/* Status hero card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`card p-8 text-center ${
          isComplete  ? "border-success/40 bg-success/3" :
          isRejected  ? "border-error/40 bg-error/3" :
          isPending   ? "border-warning/40 bg-warning/3" :
                        ""
        }`}
      >
        <div className="flex justify-center mb-4">
          {statusIcon[kycStatus]}
        </div>
        <StatusBadge status={kycStatus} size="lg" />
        <p className="text-sm text-base-content/70 mt-3 max-w-sm mx-auto">
          {statusMsg[kycStatus]}
        </p>
        {isRejected && (
          <div className="mt-4 p-3 rounded-xl bg-error/5 border border-error/20 text-left">
            <p className="text-xs font-semibold text-error flex items-center gap-1.5">
              <AlertTriangle size={12} /> Rejection Reason
            </p>
            <p className="text-xs text-base-content/70 mt-1">{profile?.kycRejectionReason}</p>
          </div>
        )}
        {!isComplete && (
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => router.push("/doctor/kyc/aadhaar")}
              className="btn-primary-cta text-xs px-5 py-2.5"
            >
              {kycStatus === "not-submitted" ? "Start KYC" : "Update KYC"}
            </button>
          </div>
        )}
      </motion.div>

      {/* Document checklist */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-primary" />
          <h3 className="font-semibold text-base-content">Document Checklist</h3>
        </div>
        <div className="space-y-3">
          {docs.map(({ label, url, verified }) => (
            <div key={label} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-base-200/40">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${url ? (verified ? "bg-success" : "bg-warning") : "bg-base-300"}`} />
                <span className="text-sm font-medium text-base-content">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                {url ? (
                  <>
                    {verified
                      ? <CheckCircle2 size={14} className="text-success" />
                      : <Clock size={14} className="text-warning" />
                    }
                    <a href={url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex items-center gap-1">
                      View <ExternalLink size={10} />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-base-content/40">Not uploaded</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Info note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-info/5 border border-info/20"
      >
        <Info size={16} className="text-info shrink-0 mt-0.5" />
        <div className="text-xs text-base-content/70 space-y-1">
          <p className="font-semibold text-info">Why is KYC required?</p>
          <p>KYC (Know Your Customer) verification ensures platform integrity and enables secure payment settlements to your bank account.</p>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: AADHAAR VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
function AadhaarVerification({ profile, doctorId }) {
  const dispatch   = useDispatch();
  const loading    = useSelector(selectHospitalLoading);
  const kyc        = profile?.kyc || {};

  const [form, setForm] = useState({
    aadhaarNumber:   kyc.aadhaarNumber   || "",
    aadhaarFrontUrl: kyc.aadhaarFrontUrl || "",
    aadhaarBackUrl:  kyc.aadhaarBackUrl  || "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm({
      aadhaarNumber:   kyc.aadhaarNumber   || "",
      aadhaarFrontUrl: kyc.aadhaarFrontUrl || "",
      aadhaarBackUrl:  kyc.aadhaarBackUrl  || "",
    });
  }, [profile]);

  const validate = () => {
    const e = {};
    const raw = form.aadhaarNumber.replace(/\s/g, "");
    if (!raw || raw.length !== 12 || !/^\d{12}$/.test(raw)) {
      e.aadhaarNumber = "Enter a valid 12-digit Aadhaar number";
    }
    if (!form.aadhaarFrontUrl) e.aadhaarFrontUrl = "Front side is required";
    if (!form.aadhaarBackUrl)  e.aadhaarBackUrl  = "Back side is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await dispatch(updateDoctorKyc({
      id:              doctorId,
      aadhaarNumber:   form.aadhaarNumber.replace(/\s/g, ""),
      aadhaarFrontUrl: form.aadhaarFrontUrl,
      aadhaarBackUrl:  form.aadhaarBackUrl,
    }));
    dispatch(fetchMyDoctorProfile());
  };

  const formatAadhaar = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10">
            <ScanLine size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base-content text-lg">Aadhaar Card Verification</h3>
            <p className="text-sm text-base-content/60 mt-0.5">
              Upload both sides of your Aadhaar card
            </p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={kyc.aadhaarVerified ? "verified" : (profile?.kycStatus || "not-submitted")} />
          </div>
        </div>

        <div className="space-y-5">
          {/* Aadhaar number */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Aadhaar Number <span className="text-error">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatAadhaar(form.aadhaarNumber)}
              onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
              placeholder="XXXX XXXX XXXX"
              maxLength={14}
              className={`input-field w-full font-mono tracking-widest text-base ${errors.aadhaarNumber ? "border-error focus:border-error" : ""}`}
            />
            {errors.aadhaarNumber && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <XCircle size={12} /> {errors.aadhaarNumber}
              </p>
            )}
          </div>

          {/* Front */}
          <div className={errors.aadhaarFrontUrl ? "p-3 rounded-xl border border-error/30 bg-error/3" : ""}>
            <DocUploadField
              label="Aadhaar Card — Front Side"
              currentUrl={form.aadhaarFrontUrl}
              onUpload={(url) => { setForm((f) => ({ ...f, aadhaarFrontUrl: url })); setErrors((e) => ({ ...e, aadhaarFrontUrl: undefined })); }}
              folder="Likeson/kyc/aadhaar"
              required
            />
            {errors.aadhaarFrontUrl && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <XCircle size={12} /> {errors.aadhaarFrontUrl}
              </p>
            )}
          </div>

          {/* Back */}
          <div className={errors.aadhaarBackUrl ? "p-3 rounded-xl border border-error/30 bg-error/3" : ""}>
            <DocUploadField
              label="Aadhaar Card — Back Side"
              currentUrl={form.aadhaarBackUrl}
              onUpload={(url) => { setForm((f) => ({ ...f, aadhaarBackUrl: url })); setErrors((e) => ({ ...e, aadhaarBackUrl: undefined })); }}
              folder="Likeson/kyc/aadhaar"
              required
            />
            {errors.aadhaarBackUrl && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <XCircle size={12} /> {errors.aadhaarBackUrl}
              </p>
            )}
          </div>

          {/* Guidelines */}
          <div className="p-3 rounded-xl bg-base-200/50 space-y-1.5">
            <p className="text-xs font-semibold text-base-content flex items-center gap-1.5">
              <Info size={12} className="text-info" /> Upload Guidelines
            </p>
            {[
              "Ensure the card is clearly visible with no blurs",
              "All 12 digits of the Aadhaar number must be readable",
              "Accepted formats: JPG, PNG, PDF (max 10MB each)",
              "Do not mask or hide any part of the document",
            ].map((tip) => (
              <p key={tip} className="text-xs text-base-content/50 flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span> {tip}
              </p>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading.updateDoctorKyc}
              className="btn-primary-cta flex items-center gap-2 disabled:opacity-60"
            >
              {loading.updateDoctorKyc
                ? <Loader2 size={16} className="animate-spin" />
                : <CheckCircle2 size={16} />
              }
              {loading.updateDoctorKyc ? "Submitting…" : "Submit Aadhaar KYC"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: PAN VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
function PanVerification({ profile, doctorId }) {
  const dispatch = useDispatch();
  const loading  = useSelector(selectHospitalLoading);
  const kyc      = profile?.kyc || {};

  const [form, setForm] = useState({
    panNumber:  kyc.panNumber  || "",
    panCardUrl: kyc.panCardUrl || "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm({ panNumber: kyc.panNumber || "", panCardUrl: kyc.panCardUrl || "" });
  }, [profile]);

  const validate = () => {
    const e = {};
    if (!form.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.toUpperCase())) {
      e.panNumber = "Enter a valid PAN (e.g., ABCDE1234F)";
    }
    if (!form.panCardUrl) e.panCardUrl = "PAN card image is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await dispatch(updateDoctorKyc({
      id:         doctorId,
      panNumber:  form.panNumber.toUpperCase(),
      panCardUrl: form.panCardUrl,
    }));
    dispatch(fetchMyDoctorProfile());
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10">
            <FileText size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base-content text-lg">PAN Card Verification</h3>
            <p className="text-sm text-base-content/60 mt-0.5">Required for payment settlement and tax compliance</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={kyc.panVerified ? "verified" : (profile?.kycStatus || "not-submitted")} />
          </div>
        </div>

        {/* PAN visual preview */}
        <div className="relative h-36 rounded-2xl bg-gradient-to-br from-primary/80 to-secondary/80 overflow-hidden mb-6 flex items-center justify-center select-none">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,.1) 20px, rgba(255,255,255,.1) 21px)" }}
          />
          <div className="text-center">
            <p className="text-white/60 text-xs font-semibold tracking-widest uppercase">Income Tax Department</p>
            <p className="text-white font-extrabold text-2xl mt-1 tracking-[0.3em] font-montserrat">
              {form.panNumber ? form.panNumber.toUpperCase() : "XXXXX0000X"}
            </p>
            <p className="text-white/60 text-xs mt-1">Permanent Account Number</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* PAN number */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              PAN Number <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.panNumber}
              onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              maxLength={10}
              className={`input-field w-full font-mono tracking-[0.25em] uppercase text-base ${errors.panNumber ? "border-error" : ""}`}
            />
            {errors.panNumber && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <XCircle size={12} /> {errors.panNumber}
              </p>
            )}
            <p className="text-xs text-base-content/40 mt-1">Format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)</p>
          </div>

          {/* PAN image */}
          <div className={errors.panCardUrl ? "p-3 rounded-xl border border-error/30 bg-error/3" : ""}>
            <DocUploadField
              label="PAN Card Image"
              currentUrl={form.panCardUrl}
              onUpload={(url) => { setForm((f) => ({ ...f, panCardUrl: url })); setErrors((e) => ({ ...e, panCardUrl: undefined })); }}
              folder="Likeson/kyc/pan"
              required
            />
            {errors.panCardUrl && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <XCircle size={12} /> {errors.panCardUrl}
              </p>
            )}
          </div>

          {/* GST note */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-base-content/70">
              Your PAN is used for TDS deduction on platform fee settlements.
              Ensure the name matches your bank account exactly.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading.updateDoctorKyc}
              className="btn-primary-cta flex items-center gap-2 disabled:opacity-60"
            >
              {loading.updateDoctorKyc
                ? <Loader2 size={16} className="animate-spin" />
                : <CheckCircle2 size={16} />
              }
              {loading.updateDoctorKyc ? "Submitting…" : "Submit PAN KYC"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function KycVerification() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const profile = useSelector(selectMyDoctorProfile);
  const loading = useSelector(selectHospitalLoading);

  const section  = params?.section || "";
  const doctorId = profile?._id;

  useEffect(() => { dispatch(fetchMyDoctorProfile()); }, [dispatch]);

  const sectionMap = {
    "":       <KycStatus           profile={profile} router={router} />,
    aadhaar:  <AadhaarVerification profile={profile} doctorId={doctorId} />,
    pan:      <PanVerification     profile={profile} doctorId={doctorId} />,
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-30">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <ShieldCheck size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold font-montserrat text-base-content tracking-tight">
                  KYC & Verification
                </h1>
                <p className="text-xs text-base-content/50">
                  Identity and document verification
                </p>
              </div>
            </div>
            <StatusBadge status={profile?.kycStatus || "not-submitted"} />
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        <div className="flex gap-6">
          {/* ── Sidebar ─────────────────────────────────────── */}
          <aside className="hidden md:flex flex-col gap-1 w-56 shrink-0">
            {links.map(({ name, section: sec, icon: Icon }) => {
              const isActive = sec === section;
              return (
                <button
                  key={sec}
                  onClick={() => router.push(`/doctor/kyc${sec ? `/${sec}` : ""}`)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${
                    isActive
                      ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                      : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{name}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto shrink-0" />}
                </button>
              );
            })}

            {/* KYC progress mini card */}
            <div className="mt-4 p-3 rounded-xl bg-base-200/50 border border-base-300">
              <p className="text-xs font-semibold text-base-content/60 mb-2">Document Status</p>
              {[
                { label: "Aadhaar", done: !!profile?.kyc?.aadhaarFrontUrl },
                { label: "PAN",     done: !!profile?.kyc?.panCardUrl },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 py-1">
                  {done
                    ? <CheckCircle2 size={12} className="text-success" />
                    : <div className="w-3 h-3 rounded-full border-2 border-base-300" />
                  }
                  <span className={`text-xs font-medium ${done ? "text-success" : "text-base-content/40"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </aside>

          {/* ── Mobile tab bar ──────────────────────────────── */}
          <div className="md:hidden mb-4 w-full -mt-2">
            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
              {links.map(({ name, section: sec, icon: Icon }) => {
                const isActive = sec === section;
                return (
                  <button
                    key={sec}
                    onClick={() => router.push(`/doctor/kyc${sec ? `/${sec}` : ""}`)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
                    }`}
                  >
                    <Icon size={14} />
                    {name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Main content ─────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {loading.fetchMyDoctorProfile && !profile ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="spinner w-8 h-8" />
                  <p className="text-sm text-base-content/50">Loading KYC data…</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={section}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  {sectionMap[section] ?? (
                    <div className="card p-8 text-center">
                      <p className="text-base-content/50">Section not found.</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}