"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Power, PowerOff, Clock, Plus, Trash2,
  Globe, AlertTriangle, CheckCircle2, Loader2, Shield,
  Navigation, Wifi, WifiOff, TrendingUp, ChevronRight,
  X, Info, ArrowLeft, Map, Layers, Star,
  Activity, Zap, ChevronLeft,
} from "lucide-react";

 
import {
  fetchDispatchStatus,
  updateDispatchStatus,
  setDispatchStatusOptimistic,
  fetchServiceZones,
  addServiceZone,
  removeServiceZone,
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

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

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

// ── Field note label helper ───────────────────────────────────────────────────
function FieldNote({ children }) {
  return (
    <p className="flex items-start gap-1 text-xs text-base-content/45 mt-1 leading-relaxed">
      <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
      {children}
    </p>
  );
}

// ── Google Maps component ─────────────────────────────────────────────────────
function ServiceZoneMap({ zones }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const circles     = useRef([]);
  const markers     = useRef([]);
  const [loaded, setLoaded] = useState(false);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center:    { lat: 20.5937, lng: 78.9629 },
      zoom:      5,
      mapTypeId: "roadmap",
      styles: [
        { featureType: "all",  elementType: "geometry",          stylers: [{ color: "#f1f5f9" }] },
        { featureType: "all",  elementType: "labels.text.fill",  stylers: [{ color: "#475569" }] },
        { featureType: "all",  elementType: "labels.text.stroke",stylers: [{ color: "#f8fafc" }] },
        { featureType: "road", elementType: "geometry",          stylers: [{ color: "#e2e8f0" }] },
        { featureType: "road.highway", elementType: "geometry",  stylers: [{ color: "#cbd5e1" }] },
        { featureType: "water",        elementType: "geometry",  stylers: [{ color: "#bae6fd" }] },
        { featureType: "poi",          elementType: "all",       stylers: [{ visibility: "off" }] },
        { featureType: "transit",      elementType: "all",       stylers: [{ visibility: "off" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#0284c7" }] },
        { featureType: "landscape",    elementType: "geometry",  stylers: [{ color: "#f8fafc" }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
    });
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (window.google) { initMap(); return; }
    const id = "gmaps-sdk";
    if (!document.getElementById(id)) {
      const script = document.createElement("script");
      script.id    = id;
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.google) { clearInterval(check); initMap(); }
      }, 200);
    }
  }, [initMap]);

  useEffect(() => {
    if (!loaded || !mapInstance.current || !window.google) return;
    circles.current.forEach(c => c.setMap(null));
    markers.current.forEach(m => m.setMap(null));
    circles.current = [];
    markers.current = [];
    if (!zones?.length) return;

    const geocoder    = new window.google.maps.Geocoder();
    const bounds      = new window.google.maps.LatLngBounds();
    const colors      = ["#0284c7","#059669","#d97706","#9333ea","#ea580c","#2563eb"];
    const activeZones = zones.filter(z => z.isActive);

    activeZones.forEach((zone, i) => {
      const query = `${zone.city}, ${zone.state}, India`;
      geocoder.geocode({ address: query }, (results, status) => {
        if (status !== "OK" || !results?.[0]) return;
        const pos   = results[0].geometry.location;
        const color = colors[i % colors.length];
        const circle = new window.google.maps.Circle({
          strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2,
          fillColor: color, fillOpacity: 0.1,
          map: mapInstance.current, center: pos, radius: (zone.radiusKm || 15) * 1000,
        });
        circles.current.push(circle);
        bounds.extend(pos);
        const marker = new window.google.maps.Marker({
          position: pos, map: mapInstance.current, title: `${zone.city}, ${zone.state}`,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });
        markers.current.push(marker);
        const info = new window.google.maps.InfoWindow({
          content: `
            <div style="background:#fff;color:#1e293b;padding:10px 14px;border-radius:8px;
                        font-family:system-ui;font-size:13px;border:1px solid ${color}40;min-width:140px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
              <div style="font-weight:700;color:${color};margin-bottom:4px">${zone.city}</div>
              <div style="color:#64748b">${zone.state}</div>
              <div style="margin-top:6px;color:#0284c7">📍 ${zone.radiusKm || 15} km radius</div>
              ${zone.pinCodes?.length ? `<div style="margin-top:4px;color:#64748b">📮 ${zone.pinCodes.join(", ")}</div>` : ""}
            </div>`,
        });
        marker.addListener("click", () => info.open(mapInstance.current, marker));
        if (activeZones.length > 0) mapInstance.current.fitBounds(bounds, { padding: 60 });
      });
    });
  }, [zones, loaded]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-base-content/60 font-medium">Loading map…</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────
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

// ── Zone card ─────────────────────────────────────────────────────────────────
function ZoneCard({ zone, onRemove, removing }) {
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
      className="relative group rounded-2xl border border-success/20 bg-success/10 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl bg-success/20 border ${col.border} flex items-center justify-center shadow-sm`}>
            <MapPin className={`w-4 h-4 ${col.text}`} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base-content text-sm truncate">{zone.city}</p>
            <p className="text-xs text-base-content/60 mt-0.5">{zone.state}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full bg-success/10 ${col.text} border ${col.border}`}>
                {zone.radiusKm || 15} km radius
              </span>
              {zone.pinCodes?.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full text-base-content/60 border border-base-300">
                  {zone.pinCodes.length} pin{zone.pinCodes.length > 1 ? "s" : ""}
                </span>
              )}
              {zone.isActive ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-emerald-600 border border-emerald-200">Active</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-base-200 text-base-content/40 border border-base-300">Inactive</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(zone._id)}
          disabled={removing}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-red-50 border border-red-200
                     text-red-500 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40"
        >
          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.div>
  );
}

// ── Add Zone Modal ────────────────────────────────────────────────────────────
function AddZoneModal({ onClose, onAdd, loading }) {
  const [form, setForm] = useState({ city: "", state: "", radiusKm: "15", pinCodes: "" });
  const [errors, setErrors] = useState({});

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
    const pinCodes = form.pinCodes
      .split(/[\s,]+/).map(p => p.trim()).filter(p => /^\d{6}$/.test(p));
    onAdd({ city: form.city.trim(), state: form.state, radiusKm: Number(form.radiusKm), pinCodes });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.95 }}
        animate={{ y: 0,  opacity: 1, scale: 1    }}
        exit=   {{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-base-content">Add Service Zone</h3>
            <p className="text-xs text-base-content/60 mt-0.5">Define a city/area where you accept rides</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/60 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* City */}
          <div>
            <label className="text-xs font-semibold text-base-content mb-1.5 block">City *</label>
            <input
              value={form.city}
              onChange={e => { setForm(p => ({ ...p, city: e.target.value })); setErrors(p => ({ ...p, city: "" })); }}
              placeholder="e.g. Vijayawada"
              className={`w-full px-4 py-2.5 rounded-xl bg-base-200 border text-base-content text-sm placeholder:text-base-content/30
                         outline-none focus:ring-2 focus:ring-primary/30 transition-all
                         ${errors.city ? "border-error/60" : "border-base-300 focus:border-primary/60"}`}
            />
            {errors.city
              ? <p className="text-xs text-error mt-1">{errors.city}</p>
              : <FieldNote>Enter the city name where you want to accept ride requests.</FieldNote>
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
            {errors.state
              ? <p className="text-xs text-error mt-1">{errors.state}</p>
              : <FieldNote>Select the Indian state this city belongs to.</FieldNote>
            }
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
            {errors.radiusKm
              ? <p className="text-xs text-error mt-1">{errors.radiusKm}</p>
              : <FieldNote>How far from the city center you are willing to pick up passengers. Larger radius = more ride chances.</FieldNote>
            }
          </div>

          {/* Pin Codes */}
          <div>
            <label className="text-xs font-semibold text-base-content mb-1.5 block">
              Pin Codes <span className="text-base-content/40 font-normal">(optional)</span>
            </label>
            <input
              value={form.pinCodes}
              onChange={e => setForm(p => ({ ...p, pinCodes: e.target.value }))}
              placeholder="520001, 520002, 520003"
              className="w-full px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                         text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                         focus:ring-primary/30 transition-all"
            />
            <FieldNote>Comma-separated 6-digit pin codes to restrict pickups to specific localities. Leave blank for full city coverage.</FieldNote>
          </div>
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? "Adding…" : "Add Zone"}
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

  // ── Correct selectors aligned with soloDriverSlice ──────────────────────────
  // dispatch object: { status, isDispatchable, isBlocked, isPaused, pausedUntil,
  //                    partnershipStatus, onboardingComplete, kycVerified,
  //                    vehicleVerified, currentRide, shift, lastLocationUpdate }
  const dispatch_data   = useSelector(selectDispatch);          // full GET /dispatch/status payload
  const serviceZones    = useSelector(selectServiceZones);       // Array<zone> from GET /service-zones
  const currentStatus   = useSelector(selectDispatchStatus);     // dispatch.status || profile.status
  const isOnline        = useSelector(selectIsOnline);           // status === 'Available'
  const isDispatchReady = useSelector(selectIsDispatchReady);    // dispatch.isDispatchable
  const partnerStatus   = useSelector(selectPartnershipStatus);  // dispatch.partnershipStatus

  const loadingDispatch      = useSelector(selectLoading("dispatch"));
  const loadingToggle        = useSelector(selectLoading("updateDispatchStatus"));
  const loadingZones         = useSelector(selectLoading("serviceZones"));
  const loadingAddZone       = useSelector(selectLoading("addZone"));
  const loadingRemoveZone    = useSelector(selectLoading("removeZone"));
  const errorToggle          = useSelector(selectError("updateDispatchStatus"));

  const [removingId,   setRemovingId]   = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Initial data fetch
  useEffect(() => {
    dispatch(fetchDispatchStatus());
    dispatch(fetchServiceZones());
  }, [dispatch]);

  useEffect(() => {
    if (section === "add") setShowAddModal(true);
    else setShowAddModal(false);
  }, [section]);

  // ── Toggle handler ───────────────────────────────────────────────────────────
  // Router accepts: 'Available' | 'Offline' | 'On-Break'
  const handleToggle = async (val) => {
    const newStatus = val ? "Available" : "Offline";
    // Optimistic update: setDispatchStatusOptimistic(status) updates state.dispatch.status
    dispatch(setDispatchStatusOptimistic(newStatus));
    const result = await dispatch(updateDispatchStatus(newStatus));
    // Re-sync on any result to stay in truth
    dispatch(fetchDispatchStatus());
  };

  const handleAddZone = async (payload) => {
    const result = await dispatch(addServiceZone(payload));
    if (!result.error) {
      setShowAddModal(false);
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
    setShowAddModal(false);
    if (pathname?.includes("/add")) router.back();
  };

  const navTo = (path) => router.push(path);

  // Derived
  const activeZones = Array.isArray(serviceZones) ? serviceZones.filter(z => z.isActive).length : 0;
  const totalKm     = Array.isArray(serviceZones) ? serviceZones.reduce((a, z) => a + (z.radiusKm || 15), 0) : 0;

  // dispatch.status: "Available" | "Offline" | "On-Break" | "On-Trip"
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

                          {/* Dispatch readiness flags
                              dispatch_data fields from GET /dispatch/status:
                                onboardingComplete → dispatch_data.onboardingComplete
                                kycVerified        → dispatch_data.kycVerified
                                vehicleVerified    → dispatch_data.vehicleVerified
                                status             → dispatch_data.status
                                isDispatchable     → dispatch_data.isDispatchable
                          */}
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

                {/* Stats row
                    All fields sourced from dispatch_data (GET /dispatch/status response):
                      shift.startTime / shift.endTime → dispatch_data.shift
                      status                          → dispatch_data.status
                      partnershipStatus               → dispatch_data.partnershipStatus
                */}
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
                        <p className="text-xs text-base-content/35 mt-0.5">Add or remove cities where you accept ride requests</p>
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
                className="space-y-6"
              >
                {/* Stats bar */}
                <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total Zones",     value: Array.isArray(serviceZones) ? serviceZones.length : 0, icon: Layers,       color: "text-primary bg-primary/5 border-primary/20", note: "All zones added" },
                    { label: "Active Zones",    value: activeZones,                                           icon: CheckCircle2, color: "text-success bg-success/5 border-success/20", note: "Receiving requests" },
                    { label: "Total Coverage",  value: `${totalKm} km`,                                       icon: TrendingUp,   color: "text-info    bg-info/5    border-info/20",    note: "Combined radius" },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center mb-2 ${s.color}`}>
                        <s.icon className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xl font-black text-base-content">{s.value}</p>
                      <p className="text-xs text-base-content/50">{s.label}</p>
                      <p className="text-xs text-base-content/35 mt-0.5">{s.note}</p>
                    </div>
                  ))}
                </motion.div>

                {/* Map + Zone list */}
                <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                  {/* Map */}
                  <div className="lg:col-span-3 rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden" style={{ minHeight: 420 }}>
                    <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-100">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-base-content">Coverage Map</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PulseDot color="#0284c7" size={8} />
                        <span className="text-xs text-base-content/50">{activeZones} zone{activeZones !== 1 ? "s" : ""} visible</span>
                      </div>
                    </div>
                    {/* Field note below map header */}
                    <div className="px-4 py-2 border-b border-base-200 bg-base-50">
                      <p className="flex items-start gap-1 text-xs text-base-content/40 leading-relaxed">
                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
                        Circles show your service radius for each active zone. Click a marker for zone details.
                      </p>
                    </div>
                    <div style={{ height: 360 }}>
                      <ServiceZoneMap zones={Array.isArray(serviceZones) ? serviceZones : []} />
                    </div>
                  </div>

                  {/* Zone list */}
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-base-content">Your Zones</h3>
                        <p className="text-xs text-base-content/40 mt-0.5">Max 10 zones allowed</p>
                      </div>
                      <button
                        onClick={() => { setShowAddModal(true); navTo("/partner/solo/service-zones/add"); }}
                        disabled={Array.isArray(serviceZones) && serviceZones.length >= 10}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25
                                   text-primary text-xs font-bold hover:bg-primary/20 disabled:opacity-40 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Zone
                      </button>
                    </div>

                    {loadingZones ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : !Array.isArray(serviceZones) || serviceZones.length === 0 ? (
                      <motion.div
                        variants={scaleIn}
                        className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-dashed border-base-300 bg-base-200/50"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center">
                          <Globe className="w-6 h-6 text-base-content/30" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-base-content/60">No service zones yet</p>
                          <p className="text-xs text-base-content/40 mt-1">Add cities where you accept rides</p>
                        </div>
                        <button
                          onClick={() => { setShowAddModal(true); navTo("/partner/solo/service-zones/add"); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-content text-xs font-bold hover:brightness-110 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add First Zone
                        </button>
                      </motion.div>
                    ) : (
                      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-base-200 scrollbar-thumb-base-300">
                        <AnimatePresence mode="popLayout">
                          {serviceZones.map(zone => (
                            <ZoneCard
                              key={zone._id}
                              zone={zone}
                              onRemove={handleRemoveZone}
                              removing={removingId === zone._id && loadingRemoveZone}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    {Array.isArray(serviceZones) && serviceZones.length >= 10 && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
                        <Info className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                        <p className="text-xs text-warning">Maximum 10 service zones reached. Remove a zone to add another.</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Back to availability */}
                <motion.div variants={fadeUp}>
                  <button
                    onClick={() => navTo("/partner/solo/availability")}
                    className="flex items-center gap-2 text-sm text-base-content/40 hover:text-base-content/70 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Availability
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Container>

      {/* ── Add Zone Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <AddZoneModal
            onClose={handleCloseModal}
            onAdd={handleAddZone}
            loading={loadingAddZone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}