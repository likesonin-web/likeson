"use client";

import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hospital,
  MapPin,
  Clock,
  ImageIcon,
  FileText,
  ChevronRight,
  Save,
  Upload,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Globe,
  Phone,
  Mail,
  Building2,
  Star,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Camera,
  Download,
  ExternalLink,
  Hash,
  Calendar,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  fetchHospitalProfile,
  updateBasicProfile,
  updateLocation,
  uploadLogo,
  uploadGalleryImages,
  deleteGalleryImage,
  uploadLicenseDocument,
  fetchOperatingHours,
  updateOperatingHours,
  updateRegistration,
  selectHospital,
  selectOperatingHours,
  isLoading,
  getError,
} from "@/store/slices/hospitalManagerSlice";

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: "profile",    label: "Hospital Profile", icon: Hospital,   href: "/hospital-manager/profile"        },
  { id: "location",   label: "Location & GPS",   icon: MapPin,     href: "/hospital-manager/location"       },
  { id: "hours",      label: "Operating Hours",  icon: Clock,      href: "/hospital-manager/operating-hours"},
  { id: "gallery",    label: "Gallery & Logo",   icon: ImageIcon,  href: "/hospital-manager/gallery"        },
  { id: "legal",      label: "Legal & Licenses", icon: FileText,   href: "/hospital-manager/registration"   },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const SPECIALTIES_OPTIONS = [
  "Cardiology","Neurology","Orthopedics","Oncology","Pediatrics",
  "Gynecology","Dermatology","General Medicine","Emergency Medicine",
  "Radiology","Gastroenterology","Urology","Psychiatry","Ophthalmology",
];

const ACCREDITATION_OPTIONS = ["NABH","NABL","JCI","ISO","AHPI","Other"];

const FACILITY_FLAGS = [
  { key: "isEmergencyReady",    label: "Emergency Ready",     icon: "🚑" },
  { key: "hasICU",              label: "ICU Available",       icon: "🏥" },
  { key: "hasBloodBank",        label: "Blood Bank",          icon: "🩸" },
  { key: "hasPharmacy",         label: "In-house Pharmacy",   icon: "💊" },
  { key: "hasDiagnostics",      label: "Diagnostics Lab",     icon: "🔬" },
  { key: "hasAmbulance",        label: "Ambulance Service",   icon: "🚑" },
  { key: "hasWheelchairAccess", label: "Wheelchair Access",   icon: "♿" },
  { key: "is24x7",              label: "24×7 Open",           icon: "⏰" },
];

// ─── Utility Components ───────────────────────────────────────────────────────

const FieldNote = ({ children }) => (
  <p className="mt-1.5 text-xs text-base-content/50 flex items-start gap-1">
    <Info size={11} className="mt-0.5 shrink-0 text-primary/60" />
    <span>{children}</span>
  </p>
);

const SectionHeader = ({ title, subtitle, icon: Icon }) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon size={20} className="text-primary" />
      </div>
      <h2 className="text-xl font-bold text-base-content font-montserrat tracking-tight">{title}</h2>
    </div>
    {subtitle && <p className="text-sm text-base-content/55 ml-13 pl-13">{subtitle}</p>}
  </div>
);

const Label = ({ children, required }) => (
  <label className="block text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-1.5">
    {children} {required && <span className="text-error">*</span>}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 text-base-content text-sm
      placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
      transition-all duration-200 hover:border-primary/40 ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`w-full px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 text-base-content text-sm
      placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
      transition-all duration-200 hover:border-primary/40 resize-none ${className}`}
    {...props}
  />
);

const Select = ({ className = "", children, ...props }) => (
  <select
    className={`w-full px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 text-base-content text-sm
      focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60
      transition-all duration-200 hover:border-primary/40 ${className}`}
    {...props}
  >
    {children}
  </select>
);

const SaveButton = ({ loading, onClick, label = "Save Changes" }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-content text-sm font-semibold
      shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
  >
    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
    {loading ? "Saving…" : label}
  </motion.button>
);

const Toast = ({ message, type = "success", onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -10, scale: 0.95 }}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl ${
      type === "success"
        ? "bg-success/10 border-success/30 text-success"
        : "bg-error/10 border-error/30 text-error"
    }`}
  >
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {message}
    <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
  </motion.div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-base-100 border border-base-300 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

// ─── Section: Hospital Profile ────────────────────────────────────────────────

const ProfileSection = ({ hospital, dispatch }) => {
  const loading = useSelector(isLoading(updateBasicProfile));
  const [form, setForm] = useState({
    name: "", description: "", contact: {}, specialties: [],
    accreditations: [], bedCount: { total: 0, icu: 0 },
    nabledLabAvailable: false,
    isEmergencyReady: false, hasICU: false, hasBloodBank: false,
    hasPharmacy: false, hasDiagnostics: false, hasAmbulance: false,
    hasWheelchairAccess: false, is24x7: false,
    facilities: [], acceptedSchemes: [],
  });
  const [toast, setToast] = useState(null);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newFacility, setNewFacility] = useState("");
  const [newScheme, setNewScheme] = useState("");

  useEffect(() => {
    if (hospital) {
      setForm({
        name:               hospital.name || "",
        description:        hospital.description || "",
        contact:            hospital.contact || {},
        specialties:        hospital.specialties || [],
        accreditations:     hospital.accreditations || [],
        bedCount:           hospital.bedCount || { total: 0, icu: 0 },
        nabledLabAvailable: hospital.nabledLabAvailable || false,
        isEmergencyReady:   hospital.isEmergencyReady || false,
        hasICU:             hospital.hasICU || false,
        hasBloodBank:       hospital.hasBloodBank || false,
        hasPharmacy:        hospital.hasPharmacy || false,
        hasDiagnostics:     hospital.hasDiagnostics || false,
        hasAmbulance:       hospital.hasAmbulance || false,
        hasWheelchairAccess:hospital.hasWheelchairAccess || false,
        is24x7:             hospital.is24x7 || false,
        facilities:         hospital.facilities || [],
        acceptedSchemes:    hospital.acceptedSchemes || [],
      });
    }
  }, [hospital]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setContact = (key, val) => setForm(f => ({ ...f, contact: { ...f.contact, [key]: val } }));

  const addTag = (key, val, setter) => {
    if (!val.trim()) return;
    setForm(f => ({ ...f, [key]: [...(f[key] || []), val.trim()] }));
    setter("");
  };
  const removeTag = (key, idx) => setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));

  const toggleAccreditation = (acc) => {
    setForm(f => ({
      ...f,
      accreditations: f.accreditations.includes(acc)
        ? f.accreditations.filter(a => a !== acc)
        : [...f.accreditations, acc],
    }));
  };

  const handleSave = async () => {
    const result = await dispatch(updateBasicProfile(form));
    if (!result.error) setToast({ msg: "Hospital profile updated successfully.", type: "success" });
    else setToast({ msg: result.payload || "Failed to update.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Hospital Profile" subtitle="Core details visible to patients and staff on the platform." icon={Hospital} />

      {/* Basic Info */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Basic Information</h3>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <Label required>Hospital Name</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Apollo Multispecialty Hospital" />
            <FieldNote>This is the public-facing name shown on patient-facing pages and search results.</FieldNote>
          </div>
          <div>
            <Label>About / Description</Label>
            <Textarea rows={4} value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Describe your hospital's mission, key services, and what sets you apart…" />
            <FieldNote>Keep this under 1000 characters. Patients read this to understand your hospital's strengths.</FieldNote>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Total Beds</Label>
              <Input type="number" min={0} value={form.bedCount.total}
                onChange={e => set("bedCount", { ...form.bedCount, total: Number(e.target.value) })} />
              <FieldNote>Total inpatient bed capacity of the hospital.</FieldNote>
            </div>
            <div>
              <Label>ICU Beds</Label>
              <Input type="number" min={0} value={form.bedCount.icu}
                onChange={e => set("bedCount", { ...form.bedCount, icu: Number(e.target.value) })} />
              <FieldNote>Setting this &gt; 0 automatically marks "Has ICU" as enabled.</FieldNote>
            </div>
          </div>
        </div>
      </Card>

      {/* Contact */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Contact Details</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { key: "phone",          label: "Primary Phone",     ph: "+91 9XXXXXXXXX",  note: "Main reception number. Shown to patients for appointment inquiries.", icon: Phone },
            { key: "emergencyPhone", label: "Emergency Phone",   ph: "+91 9XXXXXXXXX",  note: "Direct emergency contact. Listed separately on emergency cards.", icon: Phone },
            { key: "alternatePhone", label: "Alternate Phone",   ph: "+91 9XXXXXXXXX",  note: "Backup number if primary is unreachable.", icon: Phone },
            { key: "email",          label: "Official Email",    ph: "info@hospital.com", note: "Used for official correspondence and patient queries.", icon: Mail },
            { key: "website",        label: "Website URL",       ph: "https://hospital.com", note: "Your official website. Opens in a new tab on your profile.", icon: Globe },
            { key: "whatsapp",       label: "WhatsApp Number",   ph: "+91 9XXXXXXXXX",  note: "Patients can message this for quick non-emergency queries.", icon: Phone },
          ].map(({ key, label, ph, note, icon: Ico }) => (
            <div key={key}>
              <Label>{label}</Label>
              <div className="relative">
                <Ico size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <Input className="pl-9" value={form.contact[key] || ""} onChange={e => setContact(key, e.target.value)} placeholder={ph} />
              </div>
              <FieldNote>{note}</FieldNote>
            </div>
          ))}
        </div>
      </Card>

      {/* Accreditations */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Accreditations & Certifications</h3>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            {ACCREDITATION_OPTIONS.map(acc => (
              <button key={acc} onClick={() => toggleAccreditation(acc)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${
                  form.accreditations.includes(acc)
                    ? "bg-primary text-primary-content border-primary shadow-lg shadow-primary/20"
                    : "bg-base-200 text-base-content/60 border-base-300 hover:border-primary/40"
                }`}
              >{acc}</button>
            ))}
          </div>
          <FieldNote>Select all certifications your hospital holds. These appear as trust badges on your patient-facing profile.</FieldNote>
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button onClick={() => set("nabledLabAvailable", !form.nabledLabAvailable)}
                className={`w-10 h-5.5 rounded-full relative transition-colors duration-300 ${form.nabledLabAvailable ? "bg-primary" : "bg-base-300"}`}>
                <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-300 ${form.nabledLabAvailable ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm font-medium text-base-content">NABL Lab Available</span>
            </label>
          </div>
          <FieldNote>Enable if your hospital has a NABL-accredited in-house diagnostic laboratory.</FieldNote>
        </div>
      </Card>

      {/* Specialties */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Medical Specialties</h3>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-3">
            <Select value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} className="flex-1">
              <option value="">Select a specialty to add…</option>
              {SPECIALTIES_OPTIONS.filter(s => !form.specialties.includes(s)).map(s => <option key={s}>{s}</option>)}
            </Select>
            <button onClick={() => addTag("specialties", newSpecialty, setNewSpecialty)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-content text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.specialties.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                {s}
                <button onClick={() => removeTag("specialties", i)} className="hover:text-error transition-colors"><X size={11} /></button>
              </span>
            ))}
          </div>
          <FieldNote>Specialties help patients find the right care. Listed prominently on your hospital page and used in search filters.</FieldNote>
        </div>
      </Card>

      {/* Facility Flags */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Facility Features</h3>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FACILITY_FLAGS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => set(key, !form[key])}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all duration-200 ${
                form[key]
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-base-200 border-base-300 text-base-content/50 hover:border-primary/30"
              }`}>
              <span className="text-lg">{icon}</span>
              <span className="text-xs font-semibold leading-tight">{label}</span>
              {form[key] && <CheckCircle2 size={12} className="ml-auto shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-6 pb-5">
          <FieldNote>These features appear as icons on your profile. Only enable features that are currently active and accessible to patients.</FieldNote>
        </div>
      </Card>

      {/* Accepted Schemes */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Accepted Insurance & Govt. Schemes</h3>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-3">
            <Input value={newScheme} onChange={e => setNewScheme(e.target.value)} placeholder="e.g. PMJAY, ESI, CGHS, Arogyasri…"
              onKeyDown={e => e.key === "Enter" && addTag("acceptedSchemes", newScheme, setNewScheme)} />
            <button onClick={() => addTag("acceptedSchemes", newScheme, setNewScheme)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-content text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.acceptedSchemes.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-xs font-semibold">
                {s}<button onClick={() => removeTag("acceptedSchemes", i)} className="hover:text-error transition-colors"><X size={11} /></button>
              </span>
            ))}
          </div>
          <FieldNote>Listing accepted schemes helps eligible patients choose your hospital with confidence. Press Enter or click + to add.</FieldNote>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Location & GPS ──────────────────────────────────────────────────

const LocationSection = ({ hospital, dispatch }) => {
  const loading = useSelector(isLoading(updateLocation));
  const [form, setForm] = useState({ lat: "", lng: "", address: {} });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (hospital) {
      setForm({
        lat: hospital.location?.coordinates?.[1] || "",
        lng: hospital.location?.coordinates?.[0] || "",
        address: hospital.address || {},
      });
    }
  }, [hospital]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setAddr = (key, val) => setForm(f => ({ ...f, address: { ...f.address, [key]: val } }));

  const handleGps = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(p => {
      setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }));
    });
  };

  const handleSave = async () => {
    const result = await dispatch(updateLocation({ lat: parseFloat(form.lat), lng: parseFloat(form.lng), address: form.address }));
    if (!result.error) setToast({ msg: "Location updated successfully.", type: "success" });
    else setToast({ msg: result.payload || "Failed to update location.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Location & GPS" subtitle="Accurate location data ensures patients can navigate to your hospital." icon={MapPin} />

      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">GPS Coordinates</h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label required>Latitude</Label>
              <Input type="number" step="0.000001" value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="e.g. 16.506145" />
              <FieldNote>Decimal degrees. Range: −90 to 90. Use a GPS app or auto-detect below.</FieldNote>
            </div>
            <div>
              <Label required>Longitude</Label>
              <Input type="number" step="0.000001" value={form.lng} onChange={e => set("lng", e.target.value)} placeholder="e.g. 80.648018" />
              <FieldNote>Decimal degrees. Range: −180 to 180. Defaults to Vijayawada if unset.</FieldNote>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleGps}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-semibold
              hover:bg-primary/5 transition-all duration-200">
            <MapPin size={15} /> Auto-detect My Location
          </motion.button>
          <FieldNote>Auto-detect uses your browser's GPS. Ensure location permissions are granted. Verify the pin on the map after detecting.</FieldNote>

          {/* Map Preview Placeholder */}
          <div className="h-48 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center overflow-hidden relative">
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-primary to-secondary" />
            <div className="text-center z-10">
              <MapPin size={32} className="text-primary mx-auto mb-2 opacity-60" />
              <p className="text-sm text-base-content/50">Map preview will appear here</p>
              <p className="text-xs text-base-content/35 mt-1">Lat: {form.lat || "—"} · Lng: {form.lng || "—"}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Physical Address</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "line1",    label: "Address Line 1", ph: "Building / Street name",    note: "Primary address line. Include building name and street.",    required: true },
            { key: "line2",    label: "Address Line 2", ph: "Area / Colony",              note: "Secondary address details like area or colony name." },
            { key: "landmark", label: "Landmark",       ph: "Near…",                     note: "Nearby landmark helps patients locate you easily." },
            { key: "city",     label: "City",           ph: "Vijayawada",                note: "City of operation. Defaults to Vijayawada." },
            { key: "state",    label: "State",          ph: "Andhra Pradesh",            note: "State of registration and operation." },
            { key: "pincode",  label: "PIN Code",       ph: "520001",                    note: "6-digit Indian PIN code. Must start with a non-zero digit.", required: true },
          ].map(({ key, label, ph, note, required }) => (
            <div key={key}>
              <Label required={required}>{label}</Label>
              <Input value={form.address[key] || ""} onChange={e => setAddr(key, e.target.value)} placeholder={ph} />
              <FieldNote>{note}</FieldNote>
            </div>
          ))}
          <div>
            <Label>Google Maps URL</Label>
            <div className="relative">
              <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <Input className="pl-9" value={form.address.googleMapsUrl || ""} onChange={e => setAddr("googleMapsUrl", e.target.value)} placeholder="https://maps.google.com/…" />
            </div>
            <FieldNote>Paste a direct link from Google Maps. Shown as a "Get Directions" button on your profile page.</FieldNote>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Operating Hours ─────────────────────────────────────────────────

const HoursSection = ({ dispatch }) => {
  const loading = useSelector(isLoading(updateOperatingHours));
  const [hours, setHours] = useState(
    DAYS.map(day => ({ day, openTime: "08:00", closeTime: "20:00", is24Hours: false, isClosed: false }))
  );
  const [is24x7, setIs24x7] = useState(false);
  const [toast, setToast] = useState(null);

  const updateDay = (dayName, key, val) => {
    setHours(h => h.map(d => d.day === dayName ? { ...d, [key]: val } : d));
  };

  const applyAllWeekdays = (src) => {
    setHours(h => h.map(d =>
      ["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(d.day)
        ? { ...d, openTime: src.openTime, closeTime: src.closeTime, is24Hours: src.is24Hours, isClosed: src.isClosed }
        : d
    ));
  };

  const handleSave = async () => {
    const result = await dispatch(updateOperatingHours({ operatingHours: hours, is24x7 }));
    if (!result.error) setToast({ msg: "Operating hours saved.", type: "success" });
    else setToast({ msg: result.payload || "Failed to save.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Operating Hours" subtitle="Define when your hospital is open. Patients see these before booking." icon={Clock} />

      <Card>
        <div className="p-6 border-b border-base-300 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Weekly Schedule</h3>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-semibold text-base-content/60">24×7 Hospital</span>
            <button onClick={() => setIs24x7(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${is24x7 ? "bg-primary" : "bg-base-300"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${is24x7 ? "translate-x-5" : ""}`} />
            </button>
          </label>
        </div>
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => applyAllWeekdays(hours.find(d => d.day === "Monday"))}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              <RefreshCw size={11} /> Apply Mon–Fri hours to all weekdays
            </button>
          </div>
          <FieldNote>Set the opening and closing time for each day. Mark days as "24 hrs" or "Closed" using the toggles.</FieldNote>
          <div className="mt-5 space-y-3">
            {hours.map((d, i) => (
              <motion.div key={d.day} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  d.isClosed ? "bg-base-200/50 border-base-300 opacity-60" : "bg-base-100 border-base-300 hover:border-primary/30"
                }`}>
                <span className="w-24 text-xs font-bold text-base-content/70">{d.day}</span>
                <div className="flex items-center gap-2 flex-1">
                  <Input type="time" className="w-32" disabled={d.isClosed || d.is24Hours}
                    value={d.openTime} onChange={e => updateDay(d.day, "openTime", e.target.value)} />
                  <span className="text-base-content/30 text-xs">to</span>
                  <Input type="time" className="w-32" disabled={d.isClosed || d.is24Hours}
                    value={d.closeTime} onChange={e => updateDay(d.day, "closeTime", e.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <button onClick={() => { updateDay(d.day, "is24Hours", !d.is24Hours); if (!d.is24Hours) updateDay(d.day, "isClosed", false); }}
                      className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${d.is24Hours ? "bg-success" : "bg-base-300"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${d.is24Hours ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-xs font-medium text-base-content/60">24hr</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <button onClick={() => { updateDay(d.day, "isClosed", !d.isClosed); if (!d.isClosed) updateDay(d.day, "is24Hours", false); }}
                      className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${d.isClosed ? "bg-error" : "bg-base-300"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${d.isClosed ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-xs font-medium text-base-content/60">Closed</span>
                  </label>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4">
            <FieldNote>Closed days won't show any booking slots. 24hr days override open/close times. The "24×7 Hospital" toggle overrides all individual day settings.</FieldNote>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Gallery & Logo ──────────────────────────────────────────────────

const GallerySection = ({ hospital, dispatch }) => {
  const logoLoading    = useSelector(isLoading(uploadLogo));
  const galleryLoading = useSelector(isLoading(uploadGalleryImages));
  const logoRef  = useRef(null);
  const galRef   = useRef(null);
  const [toast, setToast] = useState(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    const result = await dispatch(uploadLogo(fd));
    if (!result.error) setToast({ msg: "Logo uploaded successfully.", type: "success" });
    else setToast({ msg: result.payload || "Upload failed.", type: "error" });
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append("images", f));
    const result = await dispatch(uploadGalleryImages(fd));
    if (!result.error) setToast({ msg: `${result.payload?.uploaded?.length || 0} image(s) uploaded.`, type: "success" });
    else setToast({ msg: result.payload || "Upload failed.", type: "error" });
  };

  const handleDelete = async (url) => {
    if (!confirm("Remove this image from the gallery?")) return;
    const result = await dispatch(deleteGalleryImage(url));
    if (!result.error) setToast({ msg: "Image removed.", type: "success" });
    else setToast({ msg: result.payload || "Delete failed.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Gallery & Logo" subtitle="Upload visual assets that represent your hospital to patients." icon={ImageIcon} />

      {/* Logo */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Hospital Logo</h3>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-start gap-6">
          <div className="w-28 h-28 rounded-2xl bg-base-200 border-2 border-dashed border-base-300 flex items-center justify-center overflow-hidden shrink-0">
            {hospital?.logo
              ? <img src={hospital.logo} alt="logo" className="w-full h-full object-contain p-2" />
              : <Hospital size={40} className="text-base-content/20" />
            }
          </div>
          <div className="flex-1 space-y-3">
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => logoRef.current?.click()} disabled={logoLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-content text-sm font-semibold
                shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 disabled:opacity-60">
              {logoLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {logoLoading ? "Uploading…" : "Upload Logo"}
            </motion.button>
            <div className="space-y-1">
              <FieldNote>Recommended: Square PNG with transparent background, at least 512×512 px.</FieldNote>
              <FieldNote>Accepted formats: JPEG, PNG, WebP, GIF. Maximum file size: 10 MB.</FieldNote>
              <FieldNote>Your logo appears on patient-facing pages, invoices, and appointment emails.</FieldNote>
            </div>
          </div>
        </div>
      </Card>

      {/* Gallery */}
      <Card>
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Photo Gallery</h3>
            <p className="text-xs text-base-content/40 mt-1">{hospital?.images?.length || 0} / 20 images used</p>
          </div>
          <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => galRef.current?.click()} disabled={galleryLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 text-primary text-sm font-semibold
              hover:bg-primary/5 transition-all duration-200 disabled:opacity-60">
            {galleryLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {galleryLoading ? "Uploading…" : "Add Photos"}
          </motion.button>
        </div>
        <div className="p-6">
          {!hospital?.images?.length ? (
            <div className="h-40 flex flex-col items-center justify-center rounded-xl bg-base-200 border-2 border-dashed border-base-300 text-base-content/30">
              <ImageIcon size={32} className="mb-2" />
              <p className="text-sm font-medium">No gallery images yet</p>
              <p className="text-xs mt-1">Click "Add Photos" to upload up to 5 at a time</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {hospital.images.map((url, i) => (
                <motion.div key={url} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="relative group aspect-square rounded-xl overflow-hidden bg-base-200 border border-base-300">
                  <img src={url} alt={`gallery-${i}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <button onClick={() => handleDelete(url)} className="p-2 rounded-full bg-error/90 text-white hover:bg-error transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded-md">{i + 1}</span>
                </motion.div>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-1">
            <FieldNote>Upload up to 5 images at a time. Maximum 20 images total in your gallery.</FieldNote>
            <FieldNote>High-quality photos of wards, OPD, equipment, and exterior improve patient trust and booking rates.</FieldNote>
            <FieldNote>Accepted formats: JPEG, PNG, WebP. Max 10 MB per image. Hover over an image to delete it.</FieldNote>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section: Legal & Licenses ────────────────────────────────────────────────

const LegalSection = ({ hospital, dispatch }) => {
  const regLoading = useSelector(isLoading(updateRegistration));
  const docLoading = useSelector(isLoading(uploadLicenseDocument));
  const docRef = useRef(null);
  const [form, setForm] = useState({ licenseNumber: "", gstNumber: "", panNumber: "", licenseExpiry: "" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (hospital?.registrationDetails) {
      const r = hospital.registrationDetails;
      setForm({
        licenseNumber: r.licenseNumber || "",
        gstNumber:     r.gstNumber     || "",
        panNumber:     r.panNumber     || "",
        licenseExpiry: r.licenseExpiry ? new Date(r.licenseExpiry).toISOString().split("T")[0] : "",
      });
    }
  }, [hospital]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    const result = await dispatch(updateRegistration({ ...form, licenseExpiry: form.licenseExpiry || undefined }));
    if (!result.error) setToast({ msg: "Registration details updated.", type: "success" });
    else setToast({ msg: result.payload || "Update failed.", type: "error" });
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("document", file);
    const result = await dispatch(uploadLicenseDocument(fd));
    if (!result.error) setToast({ msg: "License document uploaded.", type: "success" });
    else setToast({ msg: result.payload || "Upload failed.", type: "error" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Legal & Licenses" subtitle="Regulatory documents required for platform verification." icon={FileText} />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/8 border border-warning/25">
        <AlertCircle size={16} className="text-warning mt-0.5 shrink-0" />
        <p className="text-xs text-base-content/70 leading-relaxed">
          <span className="font-bold text-warning">Important:</span> Accurate legal information is required for platform verification.
          Incorrect or expired details may result in your hospital being suspended from the platform.
          All documents are reviewed by the Likeson compliance team.
        </p>
      </div>

      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">Registration Details</h3>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <Label required>License Number</Label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <Input className="pl-9" value={form.licenseNumber} onChange={e => set("licenseNumber", e.target.value)}
                placeholder="e.g. AP/HOS/2024/001234" />
            </div>
            <FieldNote>State medical/hospital registration authority license number. This must be unique across the platform.</FieldNote>
          </div>
          <div>
            <Label>GST Number</Label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <Input className="pl-9" value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)}
                placeholder="e.g. 37AABCU9603R1Z2" />
            </div>
            <FieldNote>15-character GST Identification Number. Required for generating GST-compliant invoices for patients.</FieldNote>
          </div>
          <div>
            <Label>PAN Number</Label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <Input className="pl-9 uppercase" value={form.panNumber} onChange={e => set("panNumber", e.target.value.toUpperCase())}
                placeholder="e.g. AABCU9603R" maxLength={10} />
            </div>
            <FieldNote>10-character PAN in format: AAAAA9999A. Used for TDS, settlements, and financial reporting.</FieldNote>
          </div>
          <div>
            <Label>License Expiry Date</Label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <Input type="date" className="pl-9" value={form.licenseExpiry} onChange={e => set("licenseExpiry", e.target.value)} />
            </div>
            <FieldNote>Platform sends automatic renewal reminders 60 and 30 days before expiry. Expired licenses trigger account review.</FieldNote>
          </div>
        </div>
      </Card>

      {/* Document Upload */}
      <Card>
        <div className="p-6 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-widest">License Document</h3>
        </div>
        <div className="p-6">
          <input ref={docRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleDocUpload} />

          {hospital?.registrationDetails?.documentUrl ? (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-success/8 border border-success/25">
              <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
                <FileText size={22} className="text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-base-content">Document Uploaded</p>
                <p className="text-xs text-base-content/50 truncate mt-0.5">{hospital.registrationDetails.documentUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={hospital.registrationDetails.documentUrl} target="_blank" rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-base-200 transition-colors text-primary">
                  <Eye size={16} />
                </a>
                <button onClick={() => docRef.current?.click()} className="p-2 rounded-lg hover:bg-base-200 transition-colors text-base-content/60">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center rounded-xl bg-base-200 border-2 border-dashed border-base-300">
              <Upload size={24} className="text-base-content/30 mb-2" />
              <p className="text-sm text-base-content/50">No document uploaded yet</p>
            </div>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} disabled={docLoading}
            onClick={() => docRef.current?.click()}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-semibold
              hover:bg-primary/5 transition-all duration-200 disabled:opacity-60">
            {docLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {docLoading ? "Uploading…" : hospital?.registrationDetails?.documentUrl ? "Replace Document" : "Upload Document"}
          </motion.button>

          <div className="mt-3 space-y-1">
            <FieldNote>Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10 MB.</FieldNote>
            <FieldNote>Upload a scanned copy or digital certificate of your hospital registration license.</FieldNote>
            <FieldNote>Document is reviewed by the Likeson compliance team during verification. Keep it up to date on renewal.</FieldNote>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton loading={regLoading} onClick={handleSave} label="Save Registration Details" />
      </div>

      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FacilityManagement() {
  const dispatch = useDispatch();
  const hospital = useSelector(selectHospital);
  const [active, setActive] = useState("profile");

  useEffect(() => {
    dispatch(fetchHospitalProfile());
  }, [dispatch]);

  const SECTIONS = {
    profile:  <ProfileSection  hospital={hospital} dispatch={dispatch} />,
    location: <LocationSection hospital={hospital} dispatch={dispatch} />,
    hours:    <HoursSection    dispatch={dispatch} />,
    gallery:  <GallerySection  hospital={hospital} dispatch={dispatch} />,
    legal:    <LegalSection    hospital={hospital} dispatch={dispatch} />,
  };

  return (
    <div className="min-h-screen bg-base-200/50" data-theme="hospital">
      {/* Page Header */}
      <div className="bg-base-100 border-b border-base-300 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-base-content font-montserrat leading-tight">Facility Management</h1>
              <p className="text-xs text-base-content/45">{hospital?.name || "Loading…"}</p>
            </div>
          </div>
          {hospital?.isVerified ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/25 text-success text-xs font-bold">
              <Shield size={11} /> Verified
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/25 text-warning text-xs font-bold">
              <AlertCircle size={11} /> Pending Verification
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar Nav */}
          <aside className="lg:w-60 shrink-0">
            <div className="sticky top-24">
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b border-base-300">
                  <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Sections</p>
                </div>
                <nav className="p-2 space-y-0.5">
                  {NAV_SECTIONS.map(({ id, label, icon: Ico }) => {
                    const isActive = active === id;
                    return (
                      <motion.button
                        key={id}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActive(id)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-content shadow-md shadow-primary/25"
                            : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Ico size={15} className={isActive ? "text-primary-content/80" : "text-base-content/40"} />
                          {label}
                        </span>
                        <ChevronRight size={13} className={`transition-transform duration-200 ${isActive ? "opacity-80" : "opacity-30"}`} />
                      </motion.button>
                    );
                  })}
                </nav>

                {/* Mini Progress */}
                <div className="px-4 py-4 border-t border-base-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-base-content/50">Profile Complete</span>
                    <span className="text-xs font-bold text-primary">{hospital?.onboarding?.isComplete ? "100%" : "—"}</span>
                  </div>
                  <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                      initial={{ width: 0 }} animate={{ width: hospital?.onboarding?.isComplete ? "100%" : "40%" }}
                      transition={{ duration: 0.8, ease: "easeOut" }} />
                  </div>
                </div>
              </Card>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {SECTIONS[active]}
              </motion.div>
            </AnimatePresence>
          </main>

        </div>
      </div>
    </div>
  );
}