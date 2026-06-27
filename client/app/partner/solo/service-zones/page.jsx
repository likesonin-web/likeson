"use client";

import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Clock, Plus, Trash2, Globe, AlertTriangle, 
  CheckCircle2, Loader2, Shield, Navigation, Wifi, WifiOff, 
  TrendingUp, ChevronRight, X, Info, ArrowLeft, Map, 
  Layers, Activity, Zap, ChevronLeft, Edit2
} from "lucide-react";

import {
  fetchDispatchStatus,
  updateDispatchStatus,
  setDispatchStatusOptimistic,
  fetchServiceZones,
  addServiceZone,
  removeServiceZone,
  updateServiceZone, // NEW: Imported update action
  selectDispatch,
  selectServiceZones,
  selectLoading,
  selectError,
  selectIsOnline,
  selectIsDispatchReady,
  selectPartnershipStatus,
  selectDispatchStatus,
} from "@/store/slices/soloDriverSlice";

import Container from "@/components/ui/Container";

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

// ── Indian states list ────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh",
];

// ── Google Maps Key ───────────────────────────────────────────────────────────
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "AIzaSyBkwZzM-ZJCCHUg5hG5vbT9OSIeUPVi_qw";

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = "#16a34a", size = 10 }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="absolute inline-flex rounded-full animate-ping opacity-75"
        style={{ width: size, height: size, backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  );
}

function FieldNote({ children }) {
  return (
    <p className="flex items-start gap-1 text-xs text-base-content/45 mt-1 leading-relaxed">
      <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
      {children}
    </p>
  );
}

function StatusChip({ status }) {
  const map = {
    active:         { label: "Active",       cls: "bg-success/15 text-success border-success/30" },
    pending:        { label: "Pending",      cls: "bg-warning/15 text-warning border-warning/30" },
    suspended:      { label: "Suspended",    cls: "bg-error/15   text-error   border-error/30"   },
    "under-review": { label: "Under Review", cls: "bg-info/15    text-info    border-info/30"    },
    rejected:       { label: "Rejected",     cls: "bg-error/15   text-error   border-error/30"   },
  };
  const s = map[status] || { label: status || "—", cls: "bg-base-300 text-base-content/60 border-base-300" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Zone card (Updated with Edit Button) ──────────────────────────────────────
function ZoneCard({ zone, onEdit, onRemove, removing }) {
  const colors  = ["sky","emerald","amber","purple","orange","blue"];
  const idx     = zone._id?.slice(-1).charCodeAt(0) % colors.length || 0;
  const c       = colors[idx];
  const colorMap = {
    sky:     { border: "border-sky-200",     bg: "bg-sky-50",     text: "text-sky-600"     },
    emerald: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
    amber:   { border: "border-amber-200",   bg: "bg-amber-50",   text: "text-amber-600"   },
    purple:  { border: "border-purple-200",  bg: "bg-purple-50",  text: "text-purple-600"  },
    orange:  { border: "border-orange-200",  bg: "bg-orange-50",  text: "text-orange-600"  },
    blue:    { border: "border-blue-200",    bg: "bg-blue-50",    text: "text-blue-600"    },
  };
  const col = colorMap[c];

  return (
    <motion.div
      layout variants={scaleIn} initial="hidden" animate="visible" exit="exit"
      className="relative group rounded-2xl border border-success/20 bg-success/10 p-5 w-full shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-success/20 border ${col.border} flex items-center justify-center shadow-sm`}>
            <MapPin className={`w-5 h-5 ${col.text}`} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base-content text-base truncate">{zone.city}</p>
            <p className="text-xs text-base-content/60 mt-0.5">{zone.state}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs px-2.5 py-1 rounded-full bg-success/10 ${col.text} border ${col.border} font-medium`}>
                {zone.radiusKm || 15} km radius
              </span>
              {zone.pinCodes?.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full text-base-content/60 border border-base-300 font-medium truncate max-w-[120px]" title={zone.pinCodes.join(", ")}>
                  {zone.pinCodes.length} pin{zone.pinCodes.length > 1 ? "s" : ""}
                </span>
              )}
              {zone.isActive ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-emerald-600 border border-emerald-200 font-medium">Active</span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-base-200 text-base-content/40 border border-base-300 font-medium">Inactive</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(zone)}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-base-200 border border-base-300
                       text-base-content/70 hover:bg-base-300 transition-all"
            title="Edit Zone"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemove(zone._id)}
            disabled={removing}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 border border-red-200
                       text-red-500 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40"
            title="Remove Zone"
          >
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Combined Add/Edit Zone Modal with Google Autocomplete ─────────────────────
function ZoneModal({ initialData, onClose, onSave, loading }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({
    city: initialData?.city || "",
    state: initialData?.state || "",
    radiusKm: initialData?.radiusKm?.toString() || "15",
    pinCodes: initialData?.pinCodes?.join(", ") || "",
    isActive: initialData?.isActive ?? true,
  });
  const [errors, setErrors] = useState({});
  const cityInputRef = useRef(null);

  // Load Google Maps Script & Initialize Autocomplete
  useEffect(() => {
    const initAutocomplete = () => {
      if (!window.google || !cityInputRef.current) return;
      const autocomplete = new window.google.maps.places.Autocomplete(cityInputRef.current, {
        types: ["(regions)"],
        componentRestrictions: { country: "in" },
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        let selectedCity = "";
        let selectedState = "";
        let selectedPincode = "";

        place.address_components.forEach((comp) => {
          const types = comp.types;
          if (types.includes("locality")) selectedCity = comp.long_name;
          if (types.includes("administrative_area_level_1")) selectedState = comp.long_name;
          if (types.includes("postal_code")) selectedPincode = comp.long_name;
        });

        // Fallbacks if locality isn't present
        if (!selectedCity) {
          const fallback = place.address_components.find(c => c.types.includes("administrative_area_level_2") || c.types.includes("sublocality"));
          if (fallback) selectedCity = fallback.long_name;
        }

        setForm(prev => {
          // If we found a new pincode, append it if it doesn't already exist in the input
          let newPins = prev.pinCodes;
          if (selectedPincode && !newPins.includes(selectedPincode)) {
            newPins = newPins ? `${newPins}, ${selectedPincode}` : selectedPincode;
          }

          return {
            ...prev,
            city: selectedCity || place.name || prev.city,
            state: INDIAN_STATES.includes(selectedState) ? selectedState : prev.state,
            pinCodes: newPins
          };
        });
        setErrors(p => ({ ...p, city: "", state: "" }));
      });
    };

    if (!window.google) {
      const existingScript = document.getElementById("google-maps-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initAutocomplete;
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", initAutocomplete);
      }
    } else {
      initAutocomplete();
    }
  }, []);

  const validate = () => {
    const e = {};
    if (!form.city.trim())  e.city  = "City is required";
    if (!form.state.trim()) e.state = "State is required";
    const r = Number(form.radiusKm);
    if (isNaN(r) || r < 1 || r > 200) e.radiusKm = "Radius must be 1–200 km";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    
    // Clean up pincodes array
    const pinCodesArray = form.pinCodes
      .split(/[\s,]+/)
      .map(p => p.trim())
      .filter(p => /^\d{6}$/.test(p));

    const payload = {
      city: form.city.trim(),
      state: form.state,
      radiusKm: Number(form.radiusKm),
      pinCodes: [...new Set(pinCodesArray)], // Remove duplicates
      isActive: form.isActive
    };

    if (isEdit) {
      onSave({ zoneId: initialData._id, ...payload });
    } else {
      onSave(payload);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.95 }}
        animate={{ y: 0,  opacity: 1, scale: 1    }}
        exit=   {{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-base-content">
              {isEdit ? "Edit Service Zone" : "Add Service Zone"}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">Define a city/area where you accept rides</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/60 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* City (Autocomplete) */}
          <div>
            <label className="text-xs font-semibold text-base-content mb-1.5 block">Search Area / City *</label>
            <input
              ref={cityInputRef}
              value={form.city}
              onChange={e => { setForm(p => ({ ...p, city: e.target.value })); setErrors(p => ({ ...p, city: "" })); }}
              placeholder="Search for a place (e.g. Proddatur)"
              className={`w-full px-4 py-2.5 rounded-xl bg-base-200 border text-base-content text-sm placeholder:text-base-content/30
                         outline-none focus:ring-2 focus:ring-primary/30 transition-all
                         ${errors.city ? "border-error/60" : "border-base-300 focus:border-primary/60"}`}
            />
            {errors.city
              ? <p className="text-xs text-error mt-1">{errors.city}</p>
              : <FieldNote>Type an area name. State and primary pincode will auto-fill.</FieldNote>
            }
          </div>

          {/* State */}
          <div>
            <label className="text-xs font-semibold text-base-content mb-1.5 block">State *</label>
            <select
              value={form.state}
              onChange={e => { setForm(p => ({ ...p, state: e.target.value })); setErrors(p => ({ ...p, state: "" })); }}
              className={`w-full px-4 py-2.5 rounded-xl bg-base-200 border text-base-content text-sm
                         outline-none focus:ring-2 focus:ring-primary/30 transition-all
                         ${errors.state ? "border-error/60" : "border-base-300 focus:border-primary/60"}`}
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <p className="text-xs text-error mt-1">{errors.state}</p>}
          </div>

          {/* Radius */}
          <div>
            <label className="text-xs font-semibold text-base-content mb-1.5 block">
              Service Radius — <span className="text-primary">{form.radiusKm} km</span>
            </label>
            <input
              type="range" min="1" max="100" value={form.radiusKm}
              onChange={e => setForm(p => ({ ...p, radiusKm: e.target.value }))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-base-content/40 mt-1">
              <span>1 km</span><span>100 km</span>
            </div>
          </div>

          {/* Pin Codes */}
          <div>
            <label className="text-xs font-semibold text-base-content mb-1.5 block">
              Coverage Pin Codes
            </label>
            <textarea
              value={form.pinCodes}
              rows={2}
              onChange={e => setForm(p => ({ ...p, pinCodes: e.target.value }))}
              placeholder="e.g. 520001, 520002"
              className="w-full px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                         text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                         focus:ring-primary/30 transition-all resize-none"
            />
            <FieldNote>
              The primary pincode is added automatically based on search. Finding all surrounding pincodes based on a radius requires manual entry or a specialized spatial database.
            </FieldNote>
          </div>

          {/* Active Toggle (Edit Only) */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-base-200 border border-base-300">
              <div>
                <p className="text-sm font-semibold text-base-content">Zone Status</p>
                <p className="text-xs text-base-content/50">Temporarily disable this zone without deleting it</p>
              </div>
              <ToggleSwitch
                checked={form.isActive}
                onChange={(val) => setForm(p => ({ ...p, isActive: val }))}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-base-300 text-base-content/60 text-sm font-semibold hover:bg-base-200 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-content text-sm font-bold flex items-center justify-center gap-2
                       hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <MapPin className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {loading ? "Saving…" : isEdit ? "Update Zone" : "Add Zone"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-checked={checked}
      role="switch"
      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none
                  ${checked ? "bg-success" : "bg-base-300"} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="inline-block h-5 w-5 rounded-full shadow-lg bg-white"
        style={{ x: checked ? 30 : 4 }}
      />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AvailabilityServiceZones() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const router   = useRouter();

  const getSection = () => {
    if (pathname?.includes("service-zones/add")) return "add";
    if (pathname?.includes("service-zones"))     return "zones";
    return "availability";
  };
  const section = getSection();

  const dispatch_data   = useSelector(selectDispatch);          
  const serviceZones    = useSelector(selectServiceZones);       
  const currentStatus   = useSelector(selectDispatchStatus);     
  const isOnline        = useSelector(selectIsOnline);           
  const isDispatchReady = useSelector(selectIsDispatchReady);    
  const partnerStatus   = useSelector(selectPartnershipStatus);  

  const loadingDispatch      = useSelector(selectLoading("dispatch"));
  const loadingToggle        = useSelector(selectLoading("updateDispatchStatus"));
  const loadingZones         = useSelector(selectLoading("serviceZones"));
  const loadingAddZone       = useSelector(selectLoading("addZone"));
  const loadingUpdateZone    = useSelector(selectLoading("updateZone"));
  const loadingRemoveZone    = useSelector(selectLoading("removeZone"));
  const errorToggle          = useSelector(selectError("updateDispatchStatus"));

  const [removingId,     setRemovingId]     = useState(null);
  const [modalState,     setModalState]     = useState({ show: false, data: null });

  // Initial data fetch
  useEffect(() => {
    dispatch(fetchDispatchStatus());
    dispatch(fetchServiceZones());
  }, [dispatch]);

  useEffect(() => {
    if (section === "add") setModalState({ show: true, data: null });
    else setModalState({ show: false, data: null });
  }, [section]);

  // ── Toggle handler ───────────────────────────────────────────────────────────
  const handleToggle = async (val) => {
    const newStatus = val ? "Available" : "Offline";
    dispatch(setDispatchStatusOptimistic(newStatus));
    await dispatch(updateDispatchStatus(newStatus));
    dispatch(fetchDispatchStatus());
  };

  const handleSaveZone = async (payload) => {
    let result;
    if (payload.zoneId) {
      result = await dispatch(updateServiceZone(payload));
    } else {
      result = await dispatch(addServiceZone(payload));
    }

    if (!result.error) {
      setModalState({ show: false, data: null });
      if (pathname?.includes("/add")) router.push(pathname.replace("/add", ""));
      dispatch(fetchServiceZones());
    }
  };

  const handleRemoveZone = async (zoneId) => {
    setRemovingId(zoneId);
    await dispatch(removeServiceZone(zoneId));
    setRemovingId(null);
    dispatch(fetchServiceZones());
  };

  const handleCloseModal = () => {
    setModalState({ show: false, data: null });
    if (pathname?.includes("/add")) router.back();
  };

  const navTo = (path) => router.push(path);

  // Derived
  const activeZones = Array.isArray(serviceZones) ? serviceZones.filter(z => z.isActive).length : 0;
  const totalKm     = Array.isArray(serviceZones) ? serviceZones.reduce((a, z) => a + (z.radiusKm || 15), 0) : 0;
  const dispatchStatusLabel = currentStatus || "—";

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
      <div className="fixed bottom-1/3 right-1/4 w-80 h-80 bg-success/5 rounded-full blur-3xl pointer-events-none" />

      <Container>
        <div className="relative py-6 lg:py-8">

          {/* ── TOP BACK BUTTON ────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="mb-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-base-content/50
                         hover:text-base-content/80 hover:bg-base-200 transition-all font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </motion.div>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mb-8">
            <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => navTo("/partner/solo/availability")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all
                    ${section === "availability"
                      ? "bg-primary/10 text-primary border border-primary/25"
                      : "text-base-content/40 hover:text-base-content/70"}`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Availability
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
                <button
                  onClick={() => navTo("/partner/solo/service-zones")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all
                    ${(section === "zones" || section === "add")
                      ? "bg-primary/10 text-primary border border-primary/25"
                      : "text-base-content/40 hover:text-base-content/70"}`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Service Zones
                </button>
                {section === "add" && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold bg-success/10 text-success border border-success/25">
                      <Plus className="w-3.5 h-3.5" />
                      Add Zone
                    </span>
                  </>
                )}
              </div>

              <div className="md:ml-auto flex items-center gap-3">
                <StatusChip status={partnerStatus} />
                {isOnline
                  ? <span className="flex items-center gap-1.5 text-xs font-bold text-success"><PulseDot color="#16a34a" />ONLINE</span>
                  : <span className="flex items-center gap-1.5 text-xs font-semibold text-base-content/40"><span className="w-2 h-2 rounded-full bg-base-300 inline-block" />OFFLINE</span>
                }
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-base-content font-[family-name:var(--font-family-montserrat)]">
                {section === "availability" ? (
                  <>Availability <span className="text-primary">Control</span></>
                ) : (
                  <>Service <span className="text-primary">Zones</span></>
                )}
              </h1>
              <p className="text-base-content/60 mt-1 text-sm">
                {section === "availability"
                  ? "Control your online status and dispatch readiness"
                  : "Manage the areas where you accept ride requests"}
              </p>
            </motion.div>
          </motion.div>

          {/* ── AVAILABILITY SECTION ──────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {section === "availability" && (
              <motion.div
                key="availability"
                initial="hidden" animate="visible" exit={{ opacity: 0, y: -16 }}
                variants={stagger}
                className="space-y-6"
              >
                {/* Main toggle card */}
                <motion.div variants={fadeUp}>
                  <div className="relative rounded-3xl border border-base-300 bg-base-100 shadow-sm overflow-hidden">
                    <AnimatePresence>
                      {isOnline && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(22,163,74,0.07), transparent)" }}
                        />
                      )}
                    </AnimatePresence>

                    <div className="relative p-6 lg:p-8">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">

                        {/* Icon */}
                        <div className="relative flex-shrink-0">
                          <motion.div
                            animate={isOnline ? { boxShadow: ["0 0 0 0px rgba(22,163,74,0.3)", "0 0 0 20px rgba(22,163,74,0)"] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                            className={`w-24 h-24 rounded-3xl flex items-center justify-center border-2 transition-all duration-500
                              ${isOnline ? "bg-success/10 border-success/40" : "bg-base-200 border-base-300"}`}
                          >
                            {isOnline
                              ? <Wifi className="w-10 h-10 text-success" />
                              : <WifiOff className="w-10 h-10 text-base-content/30" />
                            }
                          </motion.div>
                          {isOnline && (
                            <span className="absolute -top-1 -right-1"><PulseDot color="#16a34a" size={12} /></span>
                          )}
                        </div>

                        {/* Text + flags */}
                        <div className="flex-1">
                          <h2 className="text-2xl font-black font-[family-name:var(--font-family-montserrat)] text-base-content mb-2">
                            {isOnline ? "You're Online" : "You're Offline"}
                          </h2>
                          <p className="text-base-content/60 text-sm leading-relaxed max-w-md">
                            {isOnline
                              ? "Visible to customers. Eligible for ride assignments in your service zones."
                              : "Not receiving ride requests. Go online to start earning."}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-4">
                            <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold
                              ${dispatch_data?.onboardingComplete
                                ? "bg-success/10 text-success border-success/25"
                                : "bg-base-200 text-base-content/40 border-base-300"}`}>
                              <CheckCircle2 className="w-3 h-3" />
                              Onboarding {dispatch_data?.onboardingComplete ? "Complete" : "Pending"}
                            </span>
                            <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold
                              ${dispatch_data?.kycVerified
                                ? "bg-success/10 text-success border-success/25"
                                : "bg-warning/10 text-warning border-warning/25"}`}>
                              <Shield className="w-3 h-3" />
                              KYC {dispatch_data?.kycVerified ? "Verified" : "Pending"}
                            </span>
                            <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold
                              ${dispatch_data?.vehicleVerified
                                ? "bg-success/10 text-success border-success/25"
                                : "bg-warning/10 text-warning border-warning/25"}`}>
                              <Navigation className="w-3 h-3" />
                              Vehicle {dispatch_data?.vehicleVerified ? "Verified" : "Pending"}
                            </span>
                            <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold
                              ${isDispatchReady
                                ? "bg-success/10 text-success border-success/25"
                                : "bg-warning/10 text-warning border-warning/25"}`}>
                              <Zap className="w-3 h-3" />
                              {isDispatchReady ? "Dispatch Ready" : "Not Dispatch Ready"}
                            </span>
                          </div>

                          {/* Field note for toggle */}
                          <p className="flex items-start gap-1 text-xs text-base-content/40 mt-3 leading-relaxed">
                            <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
                            Toggle switches between <strong>Available</strong> (receiving rides) and <strong>Offline</strong>. Account must be active with verified KYC and vehicle to go online.
                          </p>
                        </div>

                        {/* Toggle — only for active partners */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-3">
                          <div className="text-xs text-base-content/40 font-medium text-center mb-1">
                            {isOnline ? "Currently Online" : "Currently Offline"}
                          </div>
                          {loadingToggle || loadingDispatch ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          ) : (
                            <ToggleSwitch
                              checked={isOnline}
                              onChange={handleToggle}
                              disabled={partnerStatus !== "active"}
                            />
                          )}
                          <span className="text-xs text-base-content/40 font-medium">
                            {isOnline ? "Tap to go offline" : "Tap to go online"}
                          </span>
                          {errorToggle && (
                            <p className="text-xs text-error text-center max-w-[140px]">{errorToggle}</p>
                          )}
                        </div>
                      </div>

                      {/* Partner not active warning */}
                      {partnerStatus !== "active" && (
                        <motion.div
                          variants={fadeUp}
                          className="mt-5 flex items-start gap-3 p-3.5 rounded-xl bg-warning/10 border border-warning/20"
                        >
                          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-warning-content">
                            Account status is <strong className="capitalize">{partnerStatus || "unknown"}</strong>. Only active partners can go online. Complete KYC, vehicle, and bank verification to activate.
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Stats row */}
                <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Shift Hours",
                      value: dispatch_data?.shift
                        ? `${dispatch_data.shift.startTime || "—"} – ${dispatch_data.shift.endTime || "—"}`
                        : "Not set",
                      icon: Clock,
                      color: "primary",
                      note: "Your configured working shift window",
                    },
                    {
                      label: "Active Service Zones",
                      value: `${activeZones} zone${activeZones !== 1 ? "s" : ""}`,
                      icon: Globe,
                      color: "success",
                      note: "Cities where you currently accept rides",
                    },
                    {
                      label: "Dispatch Status",
                      value: dispatchStatusLabel,
                      icon: Navigation,
                      color: "info",
                      note: "Available · Offline · On-Break · On-Trip",
                    },
                    {
                      label: "Partnership",
                      value: partnerStatus || "—",
                      icon: Shield,
                      color: "warning",
                      note: "Your account activation status",
                    },
                  ].map((stat) => {
                    const colMap = {
                      primary: "border-primary/20 bg-primary/5 text-primary",
                      success: "border-success/20 bg-success/5 text-success",
                      info:    "border-info/20    bg-info/5    text-info",
                      warning: "border-warning/20 bg-warning/5 text-warning",
                    };
                    return (
                      <motion.div key={stat.label} variants={fadeUp}
                        className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"
                      >
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${colMap[stat.color]}`}>
                          <stat.icon className="w-4 h-4" />
                        </div>
                        <p className="text-lg font-bold text-base-content capitalize leading-tight">{stat.value}</p>
                        <p className="text-xs text-base-content/50 mt-0.5">{stat.label}</p>
                        <p className="text-xs text-base-content/35 mt-1 leading-tight">{stat.note}</p>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Navigate to zones CTA */}
                <motion.div variants={fadeUp}>
                  <button
                    onClick={() => navTo("/partner/solo/service-zones")}
                    className="w-full flex items-center justify-between p-5 rounded-2xl border border-base-300
                               bg-base-100 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Map className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-base-content text-sm">Manage Service Zones</p>
                        <p className="text-xs text-base-content/50 mt-0.5">{activeZones} active zone{activeZones !== 1 ? "s" : ""} · {totalKm} km total coverage</p>
                        <p className="text-xs text-base-content/35 mt-0.5">Add, Edit or remove cities where you accept ride requests</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </button>
                </motion.div>
              </motion.div>
            )}

            {/* ── SERVICE ZONES SECTION ──────────────────────────────────── */}
            {(section === "zones" || section === "add") && (
              <motion.div
                key="zones"
                initial="hidden" animate="visible" exit={{ opacity: 0, y: -16 }}
                variants={stagger}
                className="space-y-8"
              >
                {/* Stats bar */}
                <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Total Zones",     value: Array.isArray(serviceZones) ? serviceZones.length : 0, icon: Layers,       color: "text-primary bg-primary/5 border-primary/20", note: "All zones added" },
                    { label: "Active Zones",    value: activeZones,                                           icon: CheckCircle2, color: "text-success bg-success/5 border-success/20", note: "Receiving requests" },
                    { label: "Total Coverage",  value: `${totalKm} km`,                                       icon: TrendingUp,   color: "text-info    bg-info/5    border-info/20",    note: "Combined radius" },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${s.color}`}>
                        <s.icon className="w-5 h-5" />
                      </div>
                      <p className="text-2xl font-black text-base-content">{s.value}</p>
                      <p className="text-sm text-base-content/50">{s.label}</p>
                      <p className="text-xs text-base-content/35 mt-1">{s.note}</p>
                    </div>
                  ))}
                </motion.div>

                {/* Zone list grid */}
                <motion.div variants={fadeUp} className="flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-base-content">Your Active Service Zones</h3>
                      <p className="text-sm text-base-content/50 mt-1">Manage the locations where you provide rides. Max 10 zones allowed.</p>
                    </div>
                    <button
                      onClick={() => { setModalState({ show: true, data: null }); navTo("/partner/solo/service-zones/add"); }}
                      disabled={Array.isArray(serviceZones) && serviceZones.length >= 10}
                      className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-content text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add Zone
                    </button>
                  </div>

                  {Array.isArray(serviceZones) && serviceZones.length >= 10 && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
                      <Info className="w-5 h-5 text-warning flex-shrink-0" />
                      <p className="text-sm text-warning font-medium">Maximum limit of 10 service zones reached. Please remove an existing zone before adding a new one.</p>
                    </div>
                  )}

                  {loadingZones ? (
                    <div className="flex items-center justify-center h-48 border border-base-300 rounded-2xl bg-base-100/50">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-sm text-base-content/60 font-medium">Loading zones...</span>
                      </div>
                    </div>
                  ) : !Array.isArray(serviceZones) || serviceZones.length === 0 ? (
                    <motion.div
                      variants={scaleIn}
                      className="flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border border-dashed border-base-300 bg-base-100"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center">
                        <Globe className="w-8 h-8 text-base-content/30" />
                      </div>
                      <div className="text-center max-w-sm">
                        <p className="text-lg font-bold text-base-content">No service zones set</p>
                        <p className="text-sm text-base-content/50 mt-1">You won't receive any ride requests until you add at least one service zone.</p>
                      </div>
                      <button
                        onClick={() => { setModalState({ show: true, data: null }); navTo("/partner/solo/service-zones/add"); }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-content text-sm font-bold hover:brightness-110 transition-all mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Zone
                      </button>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence mode="popLayout">
                        {serviceZones.map(zone => (
                          <ZoneCard
                            key={zone._id}
                            zone={zone}
                            onEdit={(z) => setModalState({ show: true, data: z })}
                            onRemove={handleRemoveZone}
                            removing={removingId === zone._id && loadingRemoveZone}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>

                {/* Back to availability */}
                <motion.div variants={fadeUp} className="pt-4">
                  <button
                    onClick={() => navTo("/partner/solo/availability")}
                    className="flex items-center gap-2 text-sm text-base-content/50 font-medium hover:text-base-content/80 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Availability Settings
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Container>

      {/* ── Dynamic Zone Modal (Add / Edit) ─────────────────────────────────── */}
      <AnimatePresence>
        {modalState.show && (
          <ZoneModal
            initialData={modalState.data}
            onClose={handleCloseModal}
            onSave={handleSaveZone}
            loading={loadingAddZone || loadingUpdateZone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}