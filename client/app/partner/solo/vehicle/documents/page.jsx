"use client";

import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Link, Camera, Loader2, CheckCircle2,
  AlertTriangle, Calendar, Shield, Car, X, ExternalLink,
  RefreshCw, ChevronLeft, Info
} from "lucide-react";
import {
  fetchVehicle, updateVehicleDocuments,
  selectVehicle, selectLoading, selectError
} from "@/store/slices/soloDriverSlice";
import { uploadSingleFile } from "@/store/slices/uploadSlice";
import Container from "@/components/ui/Container";

// ── animation helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

const PERMIT_TYPES = ["Commercial", "Tourist", "Private", "Contract Carriage"];

// ── FieldNote ─────────────────────────────────────────────────────────────────
function FieldNote({ children }) {
  return (
    <p className="flex items-start gap-1 text-xs text-base-content/40 mt-1 leading-relaxed">
      <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
      {children}
    </p>
  );
}

// ── days diff helper ──────────────────────────────────────────────────────────
function daysDiff(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86_400_000);
}

// ── Expiry badge ──────────────────────────────────────────────────────────────
function ExpiryBadge({ date }) {
  const days = daysDiff(date);
  if (!date || days === null) return null;
  if (days < 0)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20 font-semibold">
        Expired {Math.abs(days)}d ago
      </span>
    );
  if (days <= 30)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-semibold">
        Expires in {days}d
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-semibold">
      Valid · {days}d left
    </span>
  );
}

// ── DocUploadField ────────────────────────────────────────────────────────────
function DocUploadField({
  label, urlKey, dateKey, values, onChange,
  folder, accept, hint, showDate = true, fieldNote,
}) {
  const dispatch  = useDispatch();
  const uploading = useSelector(s => s.upload?.isUploading);
  const [mode, setMode] = useState("url");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await dispatch(uploadSingleFile({ file, folder: folder || "vehicle-docs" }));
    if (result.payload?.url) onChange(urlKey, result.payload.url);
  };

  const currentUrl  = values[urlKey]  || "";
  const currentDate = values[dateKey] || "";

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-base-content">{label}</p>
            {showDate && currentDate && <ExpiryBadge date={currentDate} />}
          </div>
        </div>
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-primary hover:text-primary/70 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* URL / File toggle */}
      <div className="flex rounded-lg border border-base-300 overflow-hidden text-xs w-fit">
        {[{ k: "url", icon: Link }, { k: "file", icon: Upload }].map(({ k, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold transition-all capitalize
              ${mode === k ? "bg-primary text-primary-content" : "bg-base-100 text-base-content/50 hover:bg-base-200"}`}
          >
            <Icon className="w-3 h-3" />
            {k === "url" ? "Paste URL" : "Upload File"}
          </button>
        ))}
      </div>

      {/* Input */}
      {mode === "url" ? (
        <div>
          <input
            value={currentUrl}
            onChange={e => onChange(urlKey, e.target.value)}
            placeholder="Paste document URL…"
            className="w-full px-3 py-2 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                       text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                       focus:ring-primary/20 transition-all"
          />
          <FieldNote>Paste the publicly accessible URL of the uploaded document. Use the Upload tab to upload directly.</FieldNote>
        </div>
      ) : (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-dashed border-primary/30
                       flex items-center gap-2 cursor-pointer hover:bg-primary/5 transition-all"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
              : <Camera className="w-4 h-4 text-primary/50" />}
            <span className="text-sm text-base-content/50">
              {uploading ? "Uploading…" : "Choose file to upload"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={accept || "image/*,.pdf"}
              className="hidden"
              onChange={handleFile}
            />
          </div>
          <FieldNote>Accepted formats: JPG, PNG, PDF. Max 5 MB per file.</FieldNote>
        </div>
      )}

      {/* URL status */}
      {currentUrl && (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[240px]">{currentUrl}</span>
          <button
            onClick={() => onChange(urlKey, "")}
            className="ml-auto text-base-content/30 hover:text-error transition-colors flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Expiry date */}
      {showDate && dateKey && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/60 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Expiry Date
          </label>
          <input
            type="date"
            value={currentDate ? new Date(currentDate).toISOString().split("T")[0] : ""}
            onChange={e => onChange(dateKey, e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                       text-base-content text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <FieldNote>Enter the exact expiry date printed on this document. You will be alerted 30 days before expiry.</FieldNote>
        </div>
      )}

      {/* per-field hint */}
      {hint && <p className="text-xs text-base-content/40">{hint}</p>}

      {/* extra fieldNote prop */}
      {fieldNote && <FieldNote>{fieldNote}</FieldNote>}
    </motion.div>
  );
}

// ── PhotosField ───────────────────────────────────────────────────────────────
function PhotosField({ values, onChange }) {
  const dispatch  = useDispatch();
  const uploading = useSelector(s => s.upload?.isUploading);
  const fileRef   = useRef(null);
  const photos    = values.photos || [];

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const result = await dispatch(uploadSingleFile({ file, folder: "vehicle-photos" }));
      if (result.payload?.url) {
        onChange("photos", [...photos, result.payload.url]);
      }
    }
  };

  const removePhoto = (idx) => onChange("photos", photos.filter((_, i) => i !== idx));

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center">
          <Camera className="w-3.5 h-3.5 text-secondary" />
        </div>
        <div>
          <p className="text-sm font-bold text-base-content">Vehicle Photos</p>
          <p className="text-xs text-base-content/40">
            {photos.length} photo{photos.length !== 1 ? "s" : ""} added
          </p>
        </div>
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-base-300">
              <img src={url} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity
                           flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={() => fileRef.current?.click()}
        className="w-full py-3 rounded-xl bg-base-200 border border-dashed border-secondary/30
                   flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary/5 transition-all"
      >
        {uploading
          ? <Loader2 className="w-4 h-4 animate-spin text-secondary" />
          : <Upload className="w-4 h-4 text-secondary/50" />}
        <span className="text-sm text-base-content/50">{uploading ? "Uploading…" : "Add photos"}</span>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </div>

      <FieldNote>
        Upload clear photos of all 4 sides of the vehicle plus the interior. Good photos improve customer trust and booking rates.
      </FieldNote>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VehicleDocuments() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const vehicle  = useSelector(selectVehicle);
  const updating = useSelector(selectLoading("updateVehicleDocs"));
  const error    = useSelector(selectError("updateVehicleDocs"));

  const [docs, setDocs]   = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { dispatch(fetchVehicle()); }, [dispatch]);

  useEffect(() => {
    if (vehicle) {
      setDocs({
        rcBookUrl:           vehicle.rcBookUrl           || "",
        insurancePolicyUrl:  vehicle.insurancePolicyUrl  || "",
        insuranceExpiry:     vehicle.insuranceExpiry     || "",
        pollutionCertUrl:    vehicle.pollutionCertUrl    || "",
        pollutionCertExpiry: vehicle.pollutionCertExpiry || "",
        fitnessCertUrl:      vehicle.fitnessCertUrl      || "",
        fitnessCertExpiry:   vehicle.fitnessCertExpiry   || "",
        permitType:          vehicle.permitType          || "",
        permitExpiry:        vehicle.permitExpiry        || "",
        photos:              vehicle.photos              || [],
      });
    }
  }, [vehicle]);

  const handleChange = (key, value) => setDocs(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaved(false);
    const result = await dispatch(updateVehicleDocuments(docs));
    if (!result.error) setSaved(true);
  };

  // Completion progress
  const docKeys  = ["rcBookUrl", "insurancePolicyUrl", "pollutionCertUrl", "fitnessCertUrl"];
  const uploaded = docKeys.filter(k => docs[k]).length;
  const pct      = Math.round((uploaded / docKeys.length) * 100);

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">
      
      {/* Background decoration */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(2,132,199,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(2,132,199,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Container>
        <div className="relative py-6 lg:py-8 space-y-6">

          {/* ── Back button ─────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-base-content/50
                         hover:text-base-content/80 hover:bg-base-200 transition-all font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </motion.div>

          {/* ── Header card ──────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp}
            className="rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden"
          >
            <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-base-content font-[family-name:var(--font-family-montserrat)]">
                    Vehicle Documents
                  </h2>
                  <p className="text-xs text-base-content/50">{uploaded}/{docKeys.length} documents uploaded</p>
                </div>
              </div>

              {/* Progress */}
              <div className="flex-1 max-w-40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-base-content/50">Completion</span>
                  <span className="text-xs font-bold text-primary">{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-base-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Alerts ───────────────────────────────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-3.5 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-semibold"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
              </motion.div>
            )}
            {saved && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-3.5 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />Documents saved successfully!
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Info banner ──────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }}
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info/10 border border-info/20"
          >
            <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
            <p className="text-xs text-info leading-relaxed">
              All documents are mandatory for vehicle verification and going online. Ensure expiry dates are accurate — you will be alerted 30 days before any document expires.
            </p>
          </motion.div>

          {/* ── Documents grid ────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            <DocUploadField
              label="RC Book (Registration Certificate)"
              urlKey="rcBookUrl"
              dateKey={null}
              showDate={false}
              values={docs}
              onChange={handleChange}
              folder="vehicle-rc"
              hint="Upload front + back pages of the RC book."
              fieldNote="The RC book proves legal ownership and registration of the vehicle. Mandatory for all vehicle types."
            />
            <DocUploadField
              label="Insurance Policy"
              urlKey="insurancePolicyUrl"
              dateKey="insuranceExpiry"
              values={docs}
              onChange={handleChange}
              folder="vehicle-insurance"
              hint="Comprehensive or third-party insurance accepted."
              fieldNote="Active vehicle insurance is legally required to operate commercially. Ensure policy covers commercial/taxi use."
            />
            <DocUploadField
              label="Pollution Certificate (PUC)"
              urlKey="pollutionCertUrl"
              dateKey="pollutionCertExpiry"
              values={docs}
              onChange={handleChange}
              folder="vehicle-puc"
              fieldNote="Pollution Under Control certificate issued by an authorised test centre. Valid for 6–12 months typically."
            />
            <DocUploadField
              label="Fitness Certificate"
              urlKey="fitnessCertUrl"
              dateKey="fitnessCertExpiry"
              values={docs}
              onChange={handleChange}
              folder="vehicle-fitness"
              fieldNote="Certificate of fitness issued by RTO confirming the vehicle is roadworthy. Required for commercial vehicles older than 2 years."
            />

            {/* Permit section */}
            <motion.div
              variants={fadeUp}
              className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-4 space-y-3 sm:col-span-1"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Car className="w-3.5 h-3.5 text-accent" />
                </div>
                <p className="text-sm font-bold text-base-content">Permit Details</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-base-content/60">Permit Type</label>
                <div className="relative">
                  <select
                    value={docs.permitType || ""}
                    onChange={e => handleChange("permitType", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-base-300 text-base-content text-sm
                               outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all appearance-none pr-8"
                  >
                    <option value="">Select permit type…</option>
                    {PERMIT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <FieldNote>Select the type of RTO permit held for this vehicle. Commercial / Tourist permits are required for ride-hailing operations.</FieldNote>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-base-content/60 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Permit Expiry
                </label>
                <input
                  type="date"
                  value={docs.permitExpiry ? new Date(docs.permitExpiry).toISOString().split("T")[0] : ""}
                  onChange={e => handleChange("permitExpiry", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-base-200 border border-base-300 text-base-content text-sm
                             outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all"
                />
                {docs.permitExpiry && <ExpiryBadge date={docs.permitExpiry} />}
                <FieldNote>Enter the permit validity end date. Expired permits will suspend your ability to go online.</FieldNote>
              </div>
            </motion.div>

            {/* Photos */}
            <PhotosField values={docs} onChange={handleChange} />
          </motion.div>

          {/* ── Save button ───────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.4 } }}
            className="flex justify-end"
          >
            <button
              onClick={handleSave}
              disabled={updating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-content
                         text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {updating ? "Saving Documents…" : "Save All Documents"}
            </button>
          </motion.div>

        </div>
      </Container>
    </div>
  );
}