"use client";

import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Edit3, Save, X, ChevronDown, CheckCircle2, Clock,
  AlertTriangle, Camera, Upload, Link, Loader2, RefreshCw,
  Shield, Zap, Award, Info, XCircle, ChevronLeft
} from "lucide-react";
import {
  fetchVehicle, updateVehicle,
  selectVehicle, selectLoading, selectError
} from "@/store/slices/soloDriverSlice";
import { uploadSingleFile } from "@/store/slices/uploadSlice";
import Container from "@/components/ui/Container";

// ── animation helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

const VEHICLE_TYPES = [
  "Sedan", "SUV", "Van", "Minivan", "Wheelchair-Van",
  "Tempo-Traveller", "Hatchback", "Auto",
];

// ── FieldNote ─────────────────────────────────────────────────────────────────
function FieldNote({ children }) {
  return (
    <p className="flex items-start gap-1 text-xs text-base-content/40 mt-1 leading-relaxed">
      <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
      {children}
    </p>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    verified:      { label: "Verified",      cls: "bg-success/10 text-success border-success/25", icon: CheckCircle2 },
    pending:       { label: "Pending",       cls: "bg-warning/10 text-warning border-warning/25", icon: Clock        },
    "under-review":{ label: "Under Review",  cls: "bg-info/10    text-info    border-info/25",    icon: Info         },
    rejected:      { label: "Rejected",      cls: "bg-error/10   text-error   border-error/25",   icon: XCircle      },
  };
  const s    = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${s.cls}`}>
      <Icon className="w-3 h-3" />{s.label}
    </span>
  );
};

// ── UploadField (URL or file) ─────────────────────────────────────────────────
function UploadField({ label, value, onChange, folder, accept = "image/*,.pdf", hint }) {
  const dispatch    = useDispatch();
  const isUploading = useSelector(s => s.upload?.isUploading);
  const [mode, setMode] = useState("url");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await dispatch(uploadSingleFile({ file, folder: folder || "vehicle-docs" }));
    if (result.payload?.url) onChange(result.payload.url);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-base-content">{label}</label>
        <div className="flex rounded-lg overflow-hidden border border-base-300 text-xs">
          {["url", "file"].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 font-semibold transition-all
                ${mode === m ? "bg-primary text-primary-content" : "bg-base-100 text-base-content/50 hover:bg-base-200"}`}
            >
              {m === "url" ? <Link className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {mode === "url" ? (
        <input
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste URL here…"
          className="w-full px-3 py-2 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                     text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                     focus:ring-primary/20 transition-all"
        />
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-dashed border-primary/30
                     flex items-center gap-2 cursor-pointer hover:bg-primary/5 transition-all"
        >
          {isUploading
            ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
            : <Camera className="w-4 h-4 text-primary/60" />}
          <span className="text-sm text-base-content/50">
            {isUploading ? "Uploading…" : "Click to upload"}
          </span>
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
        </div>
      )}

      {value && (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="w-3 h-3" />
          <span className="truncate max-w-[260px]">{value}</span>
        </div>
      )}
      {hint && <FieldNote>{hint}</FieldNote>}
    </div>
  );
}

// ── SelectField ───────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options, required, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-base-content">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                     text-base-content text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none pr-8"
        >
          <option value="">Select…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
      </div>
      {hint && <FieldNote>{hint}</FieldNote>}
    </div>
  );
}

// ── InputField ────────────────────────────────────────────────────────────────
function InputField({ label, value, onChange, placeholder, required, type = "text", disabled, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-base-content">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                   text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                   focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {hint && <FieldNote>{hint}</FieldNote>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VehicleDetails() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const vehicle  = useSelector(selectVehicle);
  const loading  = useSelector(selectLoading("vehicle"));
  const updating = useSelector(selectLoading("updateVehicle"));
  const error    = useSelector(selectError("updateVehicle"));

  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({});

  useEffect(() => { dispatch(fetchVehicle()); }, [dispatch]);

  useEffect(() => {
    if (vehicle) {
      setForm({
        registrationNumber: vehicle.registrationNumber || "",
        make:               vehicle.make               || "",
        model:              vehicle.model              || "",
        year:               vehicle.year               || "",
        color:              vehicle.color              || "",
        vehicleType:        vehicle.vehicleType        || "",
        seatingCapacity:    vehicle.seatingCapacity    || 4,
        gpsDeviceId:        vehicle.gpsDeviceId        || "",
      });
    }
  }, [vehicle]);

  const set = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const result = await dispatch(updateVehicle(form));
    if (!result.error) setEditing(false);
  };

  const infoRows = [
    { label: "Registration No.", value: vehicle?.registrationNumber, highlight: true },
    { label: "Make",             value: vehicle?.make },
    { label: "Model",            value: vehicle?.model },
    { label: "Year",             value: vehicle?.year },
    { label: "Color",            value: vehicle?.color },
    { label: "Type",             value: vehicle?.vehicleType },
    { label: "Seats",            value: vehicle?.seatingCapacity },
    { label: "GPS Device ID",    value: vehicle?.gpsDeviceId || "—" },
    { label: "Vehicle Code",     value: vehicle?.vehicleCode || "—" },
  ];

  if (loading && !vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

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
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Car className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-base-content font-[family-name:var(--font-family-montserrat)]">
                      {vehicle?.make || "Your"} {vehicle?.model || "Vehicle"}
                    </h2>
                    <p className="text-sm text-base-content/50 mt-0.5">
                      {vehicle?.registrationNumber || "Registration pending"} · {vehicle?.vehicleType || "Type unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={vehicle?.verificationStatus || "pending"} />
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/25
                                 text-primary text-sm font-bold hover:bg-primary/20 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-base-300
                                   text-base-content/60 text-sm font-semibold hover:bg-base-200 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={updating}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-content
                                   text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                      >
                        {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {updating ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {vehicle?.rejectionReason && (
                <div className="mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-error/10 border border-error/20">
                  <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-error">{vehicle.rejectionReason}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Content: view or edit ─────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {!editing ? (
              /* ── View mode ──────────────────────────────────────────────── */
              <motion.div
                key="view"
                initial="hidden" animate="visible" variants={stagger}
                className="grid grid-cols-1 lg:grid-cols-3 gap-5"
              >
                {/* Info grid */}
                <motion.div
                  variants={fadeUp}
                  className="lg:col-span-2 rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5"
                >
                  <h3 className="text-sm font-bold text-base-content mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Vehicle Information
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {infoRows.map(row => (
                      <div key={row.label} className="p-3 rounded-xl bg-base-200/60 border border-base-300/50">
                        <p className="text-xs text-base-content/50 mb-0.5">{row.label}</p>
                        <p className={`text-sm font-bold break-all ${row.highlight ? "text-primary" : "text-base-content"}`}>
                          {row.value || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Quick feature flags */}
                <motion.div variants={fadeUp} className="space-y-4">
                  {[
                    { icon: Award,  label: "AC Available",      val: vehicle?.hasAC                    ? "Yes" : "No", ok: !!vehicle?.hasAC },
                    { icon: Shield, label: "Wheelchair Access",  val: vehicle?.isWheelchairAccessible    ? "Yes" : "No", ok: !!vehicle?.isWheelchairAccessible },
                    { icon: Zap,    label: "Medical Kit",        val: vehicle?.hasMedicalKit             ? "Yes" : "No", ok: !!vehicle?.hasMedicalKit },
                  ].map(s => (
                    <div
                      key={s.label}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-base-300 bg-base-100 shadow-sm"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border
                        ${s.ok ? "bg-success/10 border-success/25 text-success" : "bg-base-200 border-base-300 text-base-content/30"}`}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-base-content/50">{s.label}</p>
                        <p className={`text-sm font-bold ${s.ok ? "text-success" : "text-base-content/40"}`}>{s.val}</p>
                      </div>
                    </div>
                  ))}
                  <p className="flex items-start gap-1 text-xs text-base-content/35 mt-1 leading-relaxed">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
                    Manage AC, wheelchair, and medical kit flags under the Features & Extras section.
                  </p>
                </motion.div>
              </motion.div>
            ) : (
              /* ── Edit mode ──────────────────────────────────────────────── */
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-6"
              >
                <h3 className="text-sm font-bold text-base-content mb-5 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-primary" />
                  Update Vehicle Details
                </h3>

                {error && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <InputField
                    label="Registration Number"
                    value={form.registrationNumber}
                    onChange={set("registrationNumber")}
                    placeholder="AP39CX1234"
                    required
                    hint="Exact number as printed on the RC book. No spaces — e.g. AP39CX1234."
                  />
                  <InputField
                    label="Make (Manufacturer)"
                    value={form.make}
                    onChange={set("make")}
                    placeholder="Toyota"
                    required
                    hint="The vehicle manufacturer's brand name e.g. Toyota, Maruti, Mahindra."
                  />
                  <InputField
                    label="Model"
                    value={form.model}
                    onChange={set("model")}
                    placeholder="Innova Crysta"
                    required
                    hint="Specific model name e.g. Innova Crysta, Swift Dzire, Bolero."
                  />
                  <InputField
                    label="Year of Manufacture"
                    value={form.year}
                    onChange={set("year")}
                    placeholder="2022"
                    type="number"
                    hint="4-digit year the vehicle was manufactured. Found on RC book under 'Year of Mfg'."
                  />
                  <InputField
                    label="Color"
                    value={form.color}
                    onChange={set("color")}
                    placeholder="White"
                    hint="Primary exterior color of the vehicle as it appears to customers."
                  />
                  <InputField
                    label="Seating Capacity"
                    value={form.seatingCapacity}
                    onChange={set("seatingCapacity")}
                    placeholder="7"
                    type="number"
                    hint="Total passenger seats excluding the driver. Used to match ride requirements."
                  />
                  <SelectField
                    label="Vehicle Type"
                    value={form.vehicleType}
                    onChange={set("vehicleType")}
                    options={VEHICLE_TYPES}
                    required
                    hint="Choose the type that best describes your vehicle. Affects ride category matching."
                  />
                  <InputField
                    label="GPS Device ID"
                    value={form.gpsDeviceId}
                    onChange={set("gpsDeviceId")}
                    placeholder="GPS-XXXXXX"
                    hint="Optional. The serial ID of the GPS tracker installed in the vehicle, if any."
                  />
                </div>

                {/* Verification reset warning */}
                <div className="mt-5 p-3.5 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    Updating vehicle details will reset verification status to <strong>Pending</strong>. An admin will re-verify within 24–48 hours. You will not be able to go online until re-verified.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </Container>
    </div>
  );
}