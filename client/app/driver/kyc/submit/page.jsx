"use client";
 

import { useState, useCallback, useMemo, memo, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Upload,
  Link2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  FileText,
  CreditCard,
  Car,
  BadgeCheck,
  Info,
  ChevronRight,
  Loader2,
  X,
  ExternalLink,
  Lock,
} from "lucide-react";

import { submitDriverKyc, fetchDriverMe } from "@/store/slices/transportPartnerSlice";

// ─── Animation Variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: "easeOut" } },
};

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  "not-submitted": {
    icon: ShieldAlert,
    label: "Not Submitted",
    desc: "Submit your KYC documents to start receiving trip assignments.",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    badge: "bg-warning/15 text-warning border-warning/40",
  },
  pending: {
    icon: Clock,
    label: "Pending Review",
    desc: "Your documents are queued for admin verification. This usually takes 24–48 hours.",
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/30",
    badge: "bg-info/15 text-info border-info/30",
  },
  "under-review": {
    icon: ShieldCheck,
    label: "Under Review",
    desc: "Our team is actively verifying your documents. You'll be notified once complete.",
    color: "text-secondary",
    bg: "bg-secondary\/20",
    border: "border-primary/20",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  verified: {
    icon: CheckCircle2,
    label: "KYC Verified",
    desc: "Your identity has been successfully verified. You're cleared for dispatch.",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/40",
    badge: "bg-success/15 text-success border-success/40",
  },
  rejected: {
    icon: ShieldX,
    label: "KYC Rejected",
    desc: "Your documents were rejected. Please re-upload clear, valid documents.",
    color: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
    badge: "bg-error/15 text-error border-error/30",
  },
};

// ─── Field Definitions ─────────────────────────────────────────────────────────

const FIELDS = [
  {
    group: "Identity",
    icon: CreditCard,
    title: "Aadhaar Card",
    required: true,
    fields: [
      {
        id: "aadhaarNumber",
        label: "Aadhaar Number",
        type: "password",
        placeholder: "XXXX XXXX XXXX",
        pattern: /^\d{12}$/,
        note: "12-digit number printed on your Aadhaar card. Stored encrypted.",
        sensitive: true,
      },
      {
        id: "aadhaarDocUrl",
        label: "Aadhaar Document",
        type: "file-or-link",
        accept: "image/*,application/pdf",
        note: "Upload front side (JPG/PNG/PDF). File must be under 5MB. Or paste a direct cloud link.",
        triggerSubmit: true,
      },
    ],
  },
  {
    group: "Licence",
    icon: Car,
    title: "Driving Licence",
    required: true,
    fields: [
      {
        id: "drivingLicenceNumber",
        label: "Licence Number",
        type: "text",
        placeholder: "e.g. AP09 20190012345",
        note: "Enter exactly as printed on your licence. Uppercase letters + digits.",
      },
      {
        id: "drivingLicenceExpiry",
        label: "Expiry Date",
        type: "date",
        placeholder: "",
        note: "Must be a future date. Expired licences will be rejected.",
      },
      {
        id: "drivingLicenceDocUrl",
        label: "Licence Document",
        type: "file-or-link",
        accept: "image/*,application/pdf",
        note: "Upload both sides as a single PDF or image. Max 5MB. Or paste a direct URL.",
        triggerSubmit: true,
      },
      {
        id: "licenceClass",
        label: "Licence Class(es)",
        type: "tags",
        placeholder: "e.g. LMV, TRANS",
        note: "Press Enter or comma after each class. E.g. LMV, MCWG, TRANS.",
      },
    ],
  },
  {
    group: "PSV Badge",
    icon: BadgeCheck,
    title: "PSV Badge",
    required: false,
    fields: [
      {
        id: "psvBadgeNumber",
        label: "PSV Badge Number",
        type: "text",
        placeholder: "e.g. AP2019/PSV/1234",
        note: "Required only for commercial passenger transport. Leave blank if not applicable.",
      },
      {
        id: "psvBadgeExpiry",
        label: "PSV Badge Expiry",
        type: "date",
        placeholder: "",
        note: "The date printed on your PSV badge. Must be a future date.",
      },
      {
        id: "psvBadgeDocUrl",
        label: "PSV Badge Document",
        type: "file-or-link",
        accept: "image/*,application/pdf",
        note: "Upload a clear photo or scan of your PSV badge. Max 5MB.",
      },
    ],
  },
  {
    group: "PAN Card",
    icon: FileText,
    title: "PAN Card",
    required: false,
    fields: [
      {
        id: "panNumber",
        label: "PAN Number",
        type: "text",
        placeholder: "ABCDE1234F",
        note: "10-character alphanumeric PAN. Required for earnings above ₹1L/year.",
        pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      },
      {
        id: "panDocUrl",
        label: "PAN Card Document",
        type: "file-or-link",
        accept: "image/*,application/pdf",
        note: "Upload a clear scan of the front of your PAN card. Max 5MB.",
      },
    ],
  },
];

// ─── Status Banner ─────────────────────────────────────────────────────────────

const StatusBanner = memo(({ kyc }) => {
  const status = kyc?.verificationStatus?.toLowerCase?.() ?? "not-submitted";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["not-submitted"];
  const Icon = cfg.icon;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={0}
      className={`relative rounded-2xl border p-5 ${cfg.bg} ${cfg.border} overflow-hidden`}
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: "var(--primary)" }}
      />

      <div className="flex items-start gap-4">
        <div className={`mt-0.5 flex-shrink-0 rounded-xl p-2.5 ${cfg.bg} ${cfg.border} border`}>
          <Icon className={`h-5 w-5 ${cfg.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-montserrat text-base font-bold text-base-content">
              KYC Status
            </h2>
            <span className={`badge badge-sm border font-semibold uppercase tracking-wide ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-base-content/60 leading-relaxed">{cfg.desc}</p>

          {/* KYC meta */}
          {kyc?.verifiedAt && (
            <p className="mt-2 text-xs text-success font-medium">
              ✓ Verified on {new Date(kyc.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
          {kyc?.rejectionReason && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-error/10 border border-error/20 p-2.5">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-error" />
              <p className="text-xs text-error leading-relaxed">{kyc.rejectionReason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Individual doc verification */}
      {(kyc?.aadhaarLast4 || kyc?.isVerified) && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Aadhaar", ok: kyc?.isVerified },
            { label: "Licence", ok: !!kyc?.drivingLicenceNumber },
            { label: "PSV Badge", ok: !!kyc?.psvBadgeNumber },
            { label: "PAN", ok: !!kyc?.panNumber },
          ].map(({ label, ok }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${
                ok
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-base-300/60 text-base-content/40 border-base-300"
              }`}
            >
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              {label}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
});
StatusBanner.displayName = "StatusBanner";

// ─── File or Link Input ────────────────────────────────────────────────────────

const FileOrLinkInput = memo(({ field, value, onChange, disabled }) => {
  const [mode, setMode] = useState(value && !value.startsWith("blob:") ? "link" : "upload");
  const [preview, setPreview] = useState(value || "");
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("File must be under 5MB");
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      setFileName(file.name);
      onChange(field.id, url); // In production: upload to S3/GCS and use returned URL
    },
    [field.id, onChange]
  );

  const handleLink = useCallback(
    (e) => {
      setPreview(e.target.value);
      onChange(field.id, e.target.value);
    },
    [field.id, onChange]
  );

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex rounded-xl border border-base-300 bg-base-200 p-1 w-fit">
        {["upload", "link"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={disabled}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              mode === m
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/50 hover:text-base-content"
            }`}
          >
            {m === "upload" ? <Upload className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {m === "upload" ? "Upload File" : "Paste Link"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <label
          className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
            disabled
              ? "opacity-50 cursor-not-allowed border-base-300"
              : "border-base-300 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <input
            type="file"
            accept={field.accept}
            className="sr-only"
            onChange={handleFile}
            disabled={disabled}
          />
          {fileName ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold truncate max-w-[200px]">{fileName}</span>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-base-300/60 p-3 group-hover:bg-primary/10 transition-colors">
                <Upload className="h-5 w-5 text-base-content/40 group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-base-content/70">
                  Click to upload
                </p>
                <p className="text-xs text-base-content/40 mt-0.5">
                  {field.accept?.replace(/,/g, " / ").replace(/application\//g, "")} · max 5 MB
                </p>
              </div>
            </>
          )}
        </label>
      ) : (
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/30" />
          <input
            type="url"
            placeholder="https://drive.google.com/... or any direct URL"
            value={preview.startsWith("blob:") ? "" : preview}
            onChange={handleLink}
            disabled={disabled}
            className="input-field w-full pl-10 pr-10 disabled:opacity-50"
          />
          {preview && !preview.startsWith("blob:") && (
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary hover:text-primary/70 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}

      {/* Preview thumbnail */}
      {preview && preview.startsWith("blob:") && (
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="relative h-20 w-20 overflow-hidden rounded-xl border border-success/40"
        >
          <img src={preview} alt="preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => { setPreview(""); setFileName(""); onChange(field.id, ""); }}
            className="absolute right-1 top-1 rounded-full bg-error/80 p-0.5 text-white hover:bg-error transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </motion.div>
      )}
    </div>
  );
});
FileOrLinkInput.displayName = "FileOrLinkInput";

// ─── Tags Input ────────────────────────────────────────────────────────────────

const TagsInput = memo(({ value = [], onChange, placeholder, disabled }) => {
  const [input, setInput] = useState("");

  const addTag = useCallback(() => {
    const trimmed = input.trim().toUpperCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }, [input, value, onChange]);

  const removeTag = useCallback(
    (tag) => onChange(value.filter((t) => t !== tag)),
    [value, onChange]
  );

  return (
    <div className={`input-field flex flex-wrap gap-1.5 min-h-[42px] items-center ${disabled ? "opacity-50" : ""}`}>
      <AnimatePresence>
        {value.map((tag) => (
          <motion.span
            key={tag}
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-bold text-primary"
          >
            {tag}
            {!disabled && (
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-error transition-colors">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addTag())}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={disabled}
        className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-base-content/30"
      />
    </div>
  );
});
TagsInput.displayName = "TagsInput";

// ─── Document Section ──────────────────────────────────────────────────────────

const DocumentSection = memo(({ group, formData, onChange, disabled, index }) => {
  const [expanded, setExpanded] = useState(true);
  const [showSensitive, setShowSensitive] = useState({});
  const Icon = group.icon;

  const toggleSensitive = useCallback((id) => {
    setShowSensitive((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleChange = useCallback(
    (id, val) => onChange(id, val),
    [onChange]
  );

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={index}
      className="rounded-2xl border border-base-300 bg-base-100 overflow-hidden shadow-sm hover:border-primary/30 transition-colors duration-300"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-3 p-5 text-left hover:bg-base-200/50 transition-colors"
      >
        <div className="flex-shrink-0 rounded-xl bg-primary/10 border border-primary/20 p-2.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-montserrat text-sm font-bold text-base-content">{group.title}</h3>
            {group.required ? (
              <span className="badge badge-xs border bg-error/10 text-error border-error/30">Required</span>
            ) : (
              <span className="badge badge-xs border bg-base-300/60 text-base-content/40 border-base-300">Optional</span>
            )}
          </div>
          <p className="text-xs text-base-content/50 mt-0.5">
            {group.fields.length} field{group.fields.length !== 1 ? "s" : ""}
            {group.fields.some((f) => formData[f.id]) && (
              <span className="ml-2 text-success font-semibold">· Filled</span>
            )}
          </p>
        </div>
        <ChevronRight
          className={`h-4 w-4 flex-shrink-0 text-base-content/30 transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Fields */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-5 border-t border-base-300 p-5 sm:grid-cols-2">
              {group.fields.map((field) => (
                <div
                  key={field.id}
                  className={field.type === "file-or-link" ? "sm:col-span-2" : ""}
                >
                  <label className="label mb-1.5" htmlFor={field.id}>
                    <span className="label-text">
                      {field.label}
                      {field.sensitive && (
                        <Lock className="inline ml-1 h-3 w-3 text-base-content/40" aria-label="Encrypted" />
                      )}
                    </span>
                  </label>

                  {field.type === "file-or-link" ? (
                    <FileOrLinkInput
                      field={field}
                      value={formData[field.id] || ""}
                      onChange={handleChange}
                      disabled={disabled}
                    />
                  ) : field.type === "tags" ? (
                    <TagsInput
                      value={formData[field.id] || []}
                      onChange={(val) => handleChange(field.id, val)}
                      placeholder={field.placeholder}
                      disabled={disabled}
                    />
                  ) : field.type === "password" ? (
                    <div className="relative">
                      <input
                        id={field.id}
                        type={showSensitive[field.id] ? "text" : "password"}
                        placeholder={field.placeholder}
                        value={formData[field.id] || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        disabled={disabled}
                        maxLength={field.id === "aadhaarNumber" ? 12 : undefined}
                        className="input-field w-full pr-10 disabled:opacity-50"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSensitive(field.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
                        aria-label={showSensitive[field.id] ? "Hide" : "Show"}
                      >
                        {showSensitive[field.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <input
                      id={field.id}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.id] || ""}
                      onChange={(e) =>
                        handleChange(
                          field.id,
                          field.id === "panNumber"
                            ? e.target.value.toUpperCase()
                            : e.target.value
                        )
                      }
                      disabled={disabled}
                      className="input-field w-full disabled:opacity-50"
                      min={field.type === "date" ? new Date().toISOString().split("T")[0] : undefined}
                    />
                  )}

                  {/* Field note */}
                  <p className="mt-1.5 flex items-start gap-1 text-xs text-base-content/50 leading-relaxed">
                    <Info className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    {field.note}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
DocumentSection.displayName = "DocumentSection";

// ─── Skeleton Loader ───────────────────────────────────────────────────────────

const KycSkeleton = () => (
  <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading KYC page">
    <div className="h-36 rounded-2xl skeleton" />
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-24 rounded-2xl skeleton" />
    ))}
    <div className="h-12 rounded-xl skeleton" />
  </div>
);

// ─── Validation ────────────────────────────────────────────────────────────────

function validateForm(formData) {
  const errors = {};

  if (!formData.aadhaarNumber || !/^\d{12}$/.test(formData.aadhaarNumber)) {
    errors.aadhaarNumber = "Aadhaar must be exactly 12 digits.";
  }
  if (!formData.aadhaarDocUrl) {
    errors.aadhaarDocUrl = "Aadhaar document is required.";
  }
  if (!formData.drivingLicenceNumber) {
    errors.drivingLicenceNumber = "Driving licence number is required.";
  }
  if (!formData.drivingLicenceExpiry) {
    errors.drivingLicenceExpiry = "Driving licence expiry is required.";
  }
  if (!formData.drivingLicenceDocUrl) {
    errors.drivingLicenceDocUrl = "Driving licence document is required.";
  }
  if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
    errors.panNumber = "Invalid PAN format. Expected: ABCDE1234F";
  }

  return errors;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function KycDocuments() {
  const dispatch = useDispatch();
  const router = useRouter();

  const driverMe = useSelector((s) => s.transportPartner.driverMe);
  const loading = useSelector((s) => s.transportPartner.loading);

  const kyc = driverMe?.kyc;
  const isVerified = kyc?.verificationStatus === "Verified";
  const isLocked = ["under-review", "pending"].includes(
    kyc?.verificationStatus?.toLowerCase?.() ?? ""
  );

  const [formData, setFormData] = useState(() => ({
    aadhaarNumber: "",
    aadhaarDocUrl: kyc?.aadhaarDocUrl || "",
    drivingLicenceNumber: kyc?.drivingLicenceNumber || "",
    drivingLicenceExpiry: kyc?.drivingLicenceExpiry
      ? kyc.drivingLicenceExpiry.split("T")[0]
      : "",
    drivingLicenceDocUrl: kyc?.drivingLicenceDocUrl || "",
    licenceClass: kyc?.licenceClass || [],
    psvBadgeNumber: kyc?.psvBadgeNumber || "",
    psvBadgeExpiry: kyc?.psvBadgeExpiry
      ? kyc.psvBadgeExpiry.split("T")[0]
      : "",
    psvBadgeDocUrl: kyc?.psvBadgeDocUrl || "",
    panNumber: kyc?.panNumber || "",
    panDocUrl: kyc?.panDocUrl || "",
  }));

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = useCallback((id, val) => {
    setFormData((prev) => ({ ...prev, [id]: val }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const errs = validateForm(formData);
      if (Object.keys(errs).length) {
        setErrors(errs);
        // Scroll to first error
        const firstErrId = Object.keys(errs)[0];
        document.getElementById(firstErrId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      setSubmitting(true);
      try {
        const payload = {
          aadhaarNumber: formData.aadhaarNumber,
          aadhaarDocUrl: formData.aadhaarDocUrl,
          drivingLicenceNumber: formData.drivingLicenceNumber.toUpperCase(),
          drivingLicenceExpiry: formData.drivingLicenceExpiry,
          drivingLicenceDocUrl: formData.drivingLicenceDocUrl,
          licenceClass: formData.licenceClass,
          ...(formData.psvBadgeNumber && { psvBadgeNumber: formData.psvBadgeNumber }),
          ...(formData.psvBadgeExpiry && { psvBadgeExpiry: formData.psvBadgeExpiry }),
          ...(formData.psvBadgeDocUrl && { psvBadgeDocUrl: formData.psvBadgeDocUrl }),
          ...(formData.panNumber && { panNumber: formData.panNumber }),
          ...(formData.panDocUrl && { panDocUrl: formData.panDocUrl }),
        };

        const result = await dispatch(submitDriverKyc(payload));

        if (submitDriverKyc.fulfilled.match(result)) {
          setSubmitted(true);
          await dispatch(fetchDriverMe());
          // Clear sensitive field from memory
          setFormData((p) => ({ ...p, aadhaarNumber: "" }));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [dispatch, formData]
  );

  const isDisabled = submitting || isLocked || isVerified;

  // Memoised field groups to prevent child re-renders
  const fieldGroups = useMemo(() => FIELDS, []);

  if (loading && !driverMe) return <KycSkeleton />;

  return (
    <div
      className="min-h-screen bg-base-100"
      data-theme="driver"
    >
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/80 backdrop-blur-strong">
        <div className="container-custom flex h-14 items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-montserrat text-sm font-bold text-base-content truncate">
              KYC &amp; Documents
            </h1>
            <p className="text-xs text-base-content/50">Driver identity verification</p>
          </div>
          {/* Lock badge */}
          {isLocked && (
            <motion.div
              variants={slideIn}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-1.5 rounded-lg bg-info/10 border border-info/30 px-2.5 py-1 text-xs font-semibold text-info"
            >
              <Lock className="h-3 w-3" />
              Under Review
            </motion.div>
          )}
        </div>
      </header>

      {/* Success overlay */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-base-100/80 backdrop-blur-strong p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-3xl border border-success/40 bg-base-100 p-8 text-center shadow-success"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 border border-success/30">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="font-montserrat text-xl font-black text-base-content">
                Documents Submitted!
              </h2>
              <p className="mt-2 text-sm text-base-content/60 leading-relaxed">
                Your KYC documents are now under review. We'll notify you within 24–48 hours.
              </p>
              <button
                type="button"
                onClick={() => { setSubmitted(false); router.back(); }}
                className="btn btn-success mt-6 w-full"
              >
                Back to Profile
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="container-custom py-6">
        <form onSubmit={handleSubmit} noValidate aria-label="KYC submission form">
          <div className="mx-auto max-w-2xl space-y-4">

            {/* Locked notice */}
            <AnimatePresence>
              {isLocked && (
                <motion.div
                  variants={slideIn}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/10 p-4"
                  role="alert"
                >
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
                  <p className="text-sm text-base-content/70 leading-relaxed">
                    Your documents are currently <strong>under review</strong>. Editing is disabled
                    until the review is complete. Contact support if changes are needed urgently.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Banner */}
            <StatusBanner kyc={kyc} />

            {/* Validation errors summary */}
            <AnimatePresence>
              {Object.keys(errors).length > 0 && (
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl border border-error/30 bg-error/10 p-4"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-error" />
                    <h4 className="text-sm font-bold text-error">
                      Please fix {Object.keys(errors).length} error{Object.keys(errors).length !== 1 ? "s" : ""} before submitting
                    </h4>
                  </div>
                  <ul className="space-y-1">
                    {Object.values(errors).map((err, i) => (
                      <li key={i} className="text-xs text-error/80 flex items-start gap-1.5">
                        <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-error" />
                        {err}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Document sections */}
            {fieldGroups.map((group, i) => (
              <DocumentSection
                key={group.group}
                group={group}
                formData={formData}
                onChange={handleChange}
                disabled={isDisabled}
                index={i + 1}
              />
            ))}

            {/* Privacy notice */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={fieldGroups.length + 1}
              className="flex items-start gap-3 rounded-2xl border border-base-300 bg-base-200/60 p-4"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
              <div className="text-xs text-base-content/50 leading-relaxed">
                <strong className="text-base-content/70">Your data is secure.</strong>{" "}
                All sensitive information (Aadhaar, PAN) is encrypted at rest using AES-256.
                We never share your documents with third parties without explicit consent.
                Documents are stored on certified cloud infrastructure.
              </div>
            </motion.div>

            {/* Submit */}
            {!isVerified && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={fieldGroups.length + 2}
                className="pb-8"
              >
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="btn btn-primary w-full py-3.5 text-sm font-bold tracking-wide shadow-primary hover-glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-busy={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting Documents…
                    </span>
                  ) : isLocked ? (
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Submission Locked — Under Review
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Submit KYC for Verification
                    </span>
                  )}
                </button>

                {!isLocked && (
                  <p className="mt-2 text-center text-xs text-base-content/40">
                    By submitting, you confirm the documents provided are genuine and belong to you.
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}