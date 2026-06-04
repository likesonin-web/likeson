"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Search, Filter, LayoutGrid, List, Star, ArrowUpRight,
  ShieldCheck, Bed, Stethoscope, Zap, Phone, MapPin, X,
  Info, Navigation, Loader2, Building2
} from "lucide-react";

import {
  fetchAllHospitals, fetchNearbyHospitals,
  selectHospitals, selectNearbyHospitals,
  selectIsLoadingHospitals, selectIsLoadingNearbyHospitals,
} from "@/store/slices/hospitalSlice";
import Container from "../../components/ui/Container";
import Banner from "../../components/Banner";
import BackButton from "../../components/BackButton";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const MotionImage = motion(Image);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
  } catch { /* silent */ }
  return null;
}

async function fetchPlaceSuggestions(input) {
  if (!GOOGLE_MAPS_KEY || input.trim().length < 2) return [];
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_KEY}&components=country:in&types=(regions)`);
    const data = await res.json();
    if (data.status === "OK" && data.predictions?.length) {
      return data.predictions.map((p) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || "",
      }));
    }
  } catch { /* silent */ }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL CARD
// ─────────────────────────────────────────────────────────────────────────────
const HospitalCard = ({ hospital, viewMode }) => {
  const [hovered, setHovered] = useState(false);
  const isListMode = viewMode === "list";

  return (
    <motion.div
      layout
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative overflow-hidden card hover-glow-primary ${
        isListMode ? "flex-row min-h-[220px]" : "flex-col"
      } flex`}
      whileHover={{ y: -3 }}
    >
     
      {/* ── IMAGE ─────────────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden flex-shrink-0 ${isListMode ? "w-60 h-full min-h-[220px]" : "w-full h-52"}`}>
        <MotionImage
          animate={{ scale: hovered ? 1.06 : 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          src={hospital.logo || hospital.images?.[0] || "/api/placeholder/800/600"}
          alt={hospital.name || "Hospital"}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden="true" />

        {/* Verified badge */}
        {hospital.isVerified && (
          <div className="absolute top-3 left-3 flex items-center justify-center w-8 h-8 rounded-xl shadow-lg bg-success text-success-content" aria-label="Verified hospital">
            <ShieldCheck size={16} />
          </div>
        )}

        {/* Rating + distance — float top right */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-strong bg-base-100/90 border border-base-300 text-[10px] font-black text-base-content">
            <Star size={12} className="fill-warning text-warning" aria-hidden="true" />
            {hospital.rating?.averageRating?.toFixed(1) || "0.0"}
          </div>
          {hospital.distance && (
            <div className="badge badge-primary shadow-sm text-[10px]">
              <MapPin size={10} aria-hidden="true" className="mr-1" /> {hospital.distance}
            </div>
          )}
        </div>

        {/* ER badge — bottom of image */}
        {hospital.isEmergencyReady && (
          <div className="absolute bottom-3 left-3 badge badge-error shadow-sm text-[10px]" aria-label="Emergency ready 24/7">
            <span className="status-dot status-dot-error bg-error-content animate-pulse mr-1" aria-hidden="true" />
            ER 24/7
          </div>
        )}
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5">
        {/* Location tag */}
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin size={12} className="text-primary text-opacity-70" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-widest text-base-content/50">
            {hospital.address?.city || "Vijayawada"}
          </span>
          {hospital.hospitalType && (
            <>
              <span className="text-base-content/20 text-[10px]">·</span>
              <span className="badge badge-accent badge-xs border-none">
                {hospital.hospitalType}
              </span>
            </>
          )}
        </div>

        {/* Name */}
        <h3 className=" text-xs font-extrabold uppercase leading-tight mb-3 tracking-tight group-hover:text-primary transition-colors text-base-content">
          {hospital.name}
        </h3>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden mb-4 bg-primary/5 border border-primary/20">
          {[
            { Icon: Bed, value: hospital.bedCount?.total || 0, label: 'Beds' },
            { Icon: Stethoscope, value: hospital.specialties?.length || 0, label: 'Depts' },
            { Icon: Zap, value: hospital.isEmergencyReady ? '24/7' : '–', label: 'ER', filled: hospital.isEmergencyReady },
          ].map(({ Icon, value, label, filled }, i) => (
            <div
              key={label}
              className={`flex flex-col items-center py-3 ${i < 2 ? 'border-r border-primary/20' : ''}`}
            >
              <Icon
                size={14}
                className={`mb-1 ${filled ? 'text-error fill-error/20' : 'text-primary'} ${filled === false ? 'opacity-30' : ''}`}
                aria-hidden="true"
              />
              <span className="text-xs font-black leading-none text-primary">{value}</span>
              <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-primary/50">{label}</span>
            </div>
          ))}
        </div>

        {/* Accreditations */}
        {hospital.accreditations?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hospital.accreditations.slice(0, 3).map(acc => (
              <span key={acc} className="badge badge-primary badge-sm bg-transparent border-primary/30">
                {acc}
              </span>
            ))}
          </div>
        )}

        {/* CTA footer */}
        <div className="flex items-center gap-2 mt-auto">
          <Link
            href={`/hospitals/${hospital.slug}`}
            className="btn btn-primary-cta flex-1 h-10 px-0 flex items-center justify-center gap-1.5"
            aria-label={`Visit ${hospital.name} portal`}
          >
            View Hospital <ArrowUpRight size={14} aria-hidden="true" />
          </Link>

          {hospital.contact?.phone && (
            <a
              href={`tel:${hospital.contact.phone}`}
              aria-label={`Call ${hospital.name}`}
              className="btn btn-circle btn-outline border-base-300 text-base-content hover:bg-base-200"
            >
              <Phone size={16} aria-hidden="true" />
            </a>
          )}

          <Link
            href={`/hospitals/${hospital.slug}`}
            aria-label={`More info about ${hospital.name}`}
            className="btn btn-circle bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <Info size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonCard = ({ viewMode }) => (
  <div className={`card flex ${viewMode === 'list' ? 'flex-row min-h-[220px]' : 'flex-col'}`}>
    <div className={`skeleton flex-shrink-0 rounded-none ${viewMode === 'list' ? 'w-60 h-full' : 'w-full h-52'}`} />
    <div className="p-5 flex flex-col gap-3 flex-1">
      <div className="h-3 w-1/3 rounded-lg skeleton" />
      <div className="h-5 w-3/4 rounded-lg skeleton" />
      <div className="h-16 rounded-xl skeleton" />
      <div className="h-10 rounded-xl skeleton mt-auto" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// FILTER SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
const FilterSidebar = ({ activeFilter, setActiveFilter, erOnly, setErOnly, onClose }) => {
  const categories = ["All", "Multi-Specialty", "Super-Specialty", "Clinic", "Nursing Home", "Government"];

  return (
    <div className="space-y-6 w-full lg:w-56">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 mb-4 flex items-center gap-2">
          <Filter size={12} aria-hidden="true" /> Hospital Type
        </p>
        <div className="flex flex-col gap-1.5">
          {categories.map((cat) => {
            const active = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => { setActiveFilter(cat); onClose?.(); }}
                className={`text-left px-4 py-2.5 rounded-xl text-[10px] font-bold transition-all duration-200 ${
                  active 
                    ? "bg-primary text-primary-content shadow-primary scale-[1.02]" 
                    : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                }`}
                aria-pressed={active}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Emergency filter */}
      <div className="p-4 rounded-xl border border-base-300 bg-base-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3">Priority</p>
        <label className="flex items-center gap-3 cursor-pointer group label p-0">
          <input 
            type="checkbox" 
            className="checkbox checkbox-error checkbox-sm"
            checked={erOnly}
            onChange={() => setErOnly(p => !p)}
          />
          <span className={`text-[10px] font-bold transition-colors ${erOnly ? 'text-error' : 'text-base-content/70 group-hover:text-base-content'}`}>
            Emergency Ready Only
          </span>
        </label>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION INPUT WITH AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────
const LocationInput = ({ onSelect, onClear, hasValue }) => {
  const [inputVal, setInputVal] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowDrop(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchPlaceSuggestions(val);
      setSuggestions(results);
      setShowDrop(results.length > 0);
      setLoading(false);
    }, 300);
  };

  const handleSelect = (s) => {
    setInputVal(s.mainText);
    setSuggestions([]);
    setShowDrop(false);
    onSelect(s.description);
  };

  const handleKeyDown = (e) => {
    if (!showDrop) {
      if (e.key === "Enter" && inputVal.trim().length > 2) onSelect(inputVal.trim());
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) handleSelect(suggestions[activeIdx]);
      else if (inputVal.trim().length > 2) { setShowDrop(false); onSelect(inputVal.trim()); }
    } else if (e.key === "Escape") setShowDrop(false);
  };

  useEffect(() => {
    const h = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-[200px] max-w-sm">
      <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-base-300 bg-base-100 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <MapPin size={14} className="text-primary text-opacity-60 flex-shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={inputVal}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          placeholder="City, area or landmark…"
          aria-label="Search by location"
          autoComplete="off"
          className="flex-1 bg-transparent text-xs font-semibold outline-none text-base-content placeholder-base-content/40 w-full"
        />
        {loading && <Loader2 size={14} className="animate-spin flex-shrink-0 text-primary" aria-hidden="true" />}
        {(inputVal || hasValue) && !loading && (
          <button
            onClick={() => { setInputVal(""); setSuggestions([]); setShowDrop(false); onClear(); }}
            aria-label="Clear location"
            className="flex-shrink-0 text-base-content/40 hover:text-base-content transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDrop && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            role="listbox"
            aria-label="Location suggestions"
            className="absolute top-[calc(100%+8px)] left-0 right-0 z-[200] rounded-2xl shadow-lg bg-base-100 border border-base-300 overflow-hidden"
          >
            {suggestions.map((s, idx) => (
              <button
                key={s.placeId}
                role="option"
                aria-selected={activeIdx === idx}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-base-300 last:border-0 ${
                  activeIdx === idx ? 'bg-primary/10' : 'hover:bg-base-200'
                }`}
              >
                <MapPin size={14} className="text-primary mt-1 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-base-content truncate">{s.mainText}</p>
                  {s.secondaryText && (
                    <p className="text-[10px] text-base-content/50 truncate mt-0.5">{s.secondaryText}</p>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION BAR
// ─────────────────────────────────────────────────────────────────────────────
const LocationBar = ({ mode, manualAddress, locationLabel, onUseGPS, onManualSearch, onClear, gpsLoading, gpsError }) => {
  const isActive = mode === "user" || mode === "nearby";
  return (
    <div className="flex flex-wrap items-center gap-3 py-4 mb-6 border-b border-base-300">
      {/* GPS button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onUseGPS}
        disabled={gpsLoading || mode === "user"}
        aria-label={isActive ? "Location active" : "Use my current location"}
        className={`btn h-11 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-60 ${
          isActive ? 'btn-primary shadow-primary' : 'bg-base-200 border-base-300 text-base-content hover:bg-base-300'
        }`}
      >
        {gpsLoading
          ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          : <Navigation size={16} aria-hidden="true" />
        }
        {mode === "user" ? "Location Active ✓" : mode === "nearby" ? "Near Me ✓" : "Use My Location"}
      </motion.button>

      {/* Location search */}
      <LocationInput onSelect={onManualSearch} onClear={onClear} hasValue={mode === "manual" || mode === "manual-near"} />

      {/* Status */}
      <span className="text-[10px] font-bold text-base-content/50 ml-auto" aria-live="polite">
        {mode === "user" ? `📍 ${locationLabel || "Saved location"} · 100 km`
        : mode === "nearby" ? "📍 Current location · 100 km"
        : mode === "manual-near" ? `🔍 Near "${manualAddress}" · 100 km`
        : mode === "manual" ? `🔍 "${manualAddress}"`
        : "All hospitals"}
      </span>

      {gpsError && (
        <span className="text-[10px] font-bold text-error w-full mt-2" role="alert">
          {gpsError}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TRUST STATS BAR
// ─────────────────────────────────────────────────────────────────────────────
const TrustBar = memo(function TrustBar() {
  const stats = [
    { label: 'Verified Hospitals', value: '200+', icon: ShieldCheck },
    { label: 'Cities Covered', value: '15+', icon: MapPin },
    { label: 'Total Beds', value: '5000+', icon: Bed },
    { label: 'Avg Rating', value: '4.7★', icon: Star },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border-y border-base-300 mb-8 bg-base-100">
      {stats.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className={`flex flex-col items-center justify-center py-6 gap-1 text-center ${
            i < stats.length - 1 ? 'border-r border-base-300' : ''
          }`}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-primary/10 text-primary" aria-hidden="true">
            <Icon size={18} />
          </div>
          <span className="text-2xl font-black leading-none text-primary">{value}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50 mt-1">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const HospitalsPage = () => {
  const dispatch = useDispatch();

  const user = useSelector((s) => s.user?.user) ?? null;
  const allHospitals = useSelector(selectHospitals);
  const nearbyHospitals = useSelector(selectNearbyHospitals);
  const loadingAll = useSelector(selectIsLoadingHospitals);
  const loadingNearby = useSelector(selectIsLoadingNearbyHospitals);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const [erOnly, setErOnly] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mode, setMode] = useState("all");
  const [manualAddress, setManualAddress] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const isNearbyMode = mode === "user" || mode === "nearby" || mode === "manual-near";
  const hospitals = isNearbyMode ? nearbyHospitals : allHospitals;
  const loading = isNearbyMode ? loadingNearby : loadingAll;

  useEffect(() => {
    if (user?.location?.coordinates) {
      const [lng, lat] = user.location.coordinates;
      if (lng !== 0 || lat !== 0) {
        dispatch(fetchNearbyHospitals({ lat, lng, limit: 20 }));
        setMode("user");
        setLocationLabel(user.lastKnownAddress || "Your location");
        return;
      }
    }
    if (!allHospitals?.length) dispatch(fetchAllHospitals({ limit: 20 }));
    setMode("all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const handleUseGPS = useCallback(() => {
    if (mode === "user") return;
    if (!navigator.geolocation) { setGpsError("Geolocation not supported. Enter your area below."); return; }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        dispatch(fetchNearbyHospitals({ lat: coords.latitude, lng: coords.longitude, limit: 20 }));
        setMode("nearby");
        setManualAddress("");
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError("Permission denied. Enter your area manually.");
        else if (err.code === 2) setGpsError("Device can't determine location. Enter manually.");
        else setGpsError("Location timed out. Enter your area manually.");
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }, [dispatch, mode]);

  const handleManualSearch = useCallback(async (address) => {
    setGpsError("");
    const coords = await geocodeAddress(address);
    if (coords) {
      dispatch(fetchNearbyHospitals({ lat: coords.lat, lng: coords.lng, limit: 20 }));
      setMode("manual-near");
    } else {
      dispatch(fetchAllHospitals({ city: address, limit: 20 }));
      setMode("manual");
    }
    setManualAddress(address);
  }, [dispatch]);

  const handleClear = useCallback(() => {
    setGpsError("");
    setManualAddress("");
    if (user?.location?.coordinates) {
      const [lng, lat] = user.location.coordinates;
      if (lng !== 0 || lat !== 0) {
        dispatch(fetchNearbyHospitals({ lat, lng, limit: 20 }));
        setMode("user");
        return;
      }
    }
    if (!allHospitals?.length) dispatch(fetchAllHospitals({ limit: 20 }));
    setMode("all");
  }, [dispatch, user, allHospitals]);

  const filteredHospitals = useMemo(() => {
    if (!hospitals?.length) return [];
    return hospitals.filter((h) => {
      const matchesSearch = h.name?.toLowerCase().includes(searchTerm.toLowerCase()) || h.address?.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeFilter === "All" || h.hospitalType === activeFilter;
      const matchesER = erOnly ? h.isEmergencyReady === true : true;
      return matchesSearch && matchesCategory && matchesER;
    });
  }, [hospitals, searchTerm, activeFilter, erOnly]);

  return (
    <Container className="mt-4">
      <Banner position="Home_Top" />
      <main className="min-h-screen bg-base-100">
        <BackButton className="my-4" />

        {/* ── MOBILE SIDEBAR OVERLAY ────────────────────────────────── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-[100] lg:hidden bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                className="fixed left-0 top-0 bottom-0 w-[280px] z-[101] p-6 shadow-2xl bg-base-100 border-r border-base-300 lg:hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40">
                    Filters
                  </span>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label="Close filter sidebar"
                    className="btn btn-circle btn-sm bg-base-200 text-base-content hover:bg-base-300 border-none"
                  >
                    <X size={16} />
                  </button>
                </div>
                <FilterSidebar
                  activeFilter={activeFilter} setActiveFilter={setActiveFilter}
                  erOnly={erOnly} setErOnly={setErOnly}
                  onClose={() => setIsSidebarOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-12 md:py-16 bg-gradient-to-b from-primary/10 to-base-100 rounded-3xl mb-8">
          {/* Decorative blob */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none bg-secondary/10 blur-[48px]" aria-hidden="true" />

          <Container className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-end gap-8 md:gap-12">
              {/* Left: heading */}
              <div className="flex-1 max-w-xl">
                <div className="badge badge-primary bg-primary/10 border-primary/30 mb-6 gap-1.5 px-4 py-2 font-black uppercase tracking-widest text-[10px]" aria-hidden="true">
                  <Building2 size={12} /> Hospital Registry
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-5 text-base-content">
                  Find a <span className="text-gradient-primary">Hospital</span>
                </h1>

                <p className="text-base leading-relaxed max-w-md text-base-content/60 font-medium">
                  Verified healthcare facilities, surgical centers, and diagnostic hubs across the network. Find emergency-ready hospitals near you.
                </p>
              </div>

              <div className="w-full max-w-lg group mx-auto">
  <div className="relative flex items-center p-1.5 bg-base-100 rounded-full border border-base-300 shadow-sm hover:shadow-md focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-md transition-all duration-300">
    
    {/* ── Search Icon (Left) ── */}
    <div className="pl-4 pr-2 pointer-events-none flex-shrink-0">
      <Search 
        className="text-primary/50 group-focus-within:text-primary transition-colors duration-300" 
        size={18} 
        aria-hidden="true" 
      />
    </div>
    
    {/* ── Input Field ── */}
    <input
      type="text"
      placeholder="Search hospital name or city…"
      aria-label="Search hospitals"
      className="flex-1 min-w-0 py-2.5 px-2 bg-transparent text-xs font-semibold text-base-content outline-none placeholder-base-content/40 truncate"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />

    {/* ── Action Buttons Container ── */}
    <div className="flex items-center flex-shrink-0">
      
      {/* Clear Button (Smooth fade in/out) */}
      <button
        onClick={() => setSearchTerm("")}
        aria-label="Clear search"
        className={`p-1.5 mr-1 rounded-full text-base-content/40 hover:text-base-content hover:bg-base-200 transition-all duration-200 flex items-center justify-center ${
          searchTerm ? "opacity-100 scale-100 visible pointer-events-auto w-7 h-7" : "opacity-0 scale-75 invisible pointer-events-none w-0 h-7 overflow-hidden m-0"
        }`}
      >
        <X size={15} strokeWidth={2.5} />
      </button>

      {/* Embedded Search Button */}
      <button
        className="h-10 px-5 md:px-7 rounded-full bg-primary text-primary-content text-xs font-bold tracking-wide shadow-sm hover:brightness-110 active:scale-[0.97] transition-all flex items-center gap-2"
      >
        <span className="hidden md:inline">Search</span>
        <Search size={14} className="md:hidden stroke-[2.5]" aria-hidden="true" />
      </button>

    </div>
  </div>
</div>
            </div>
          </Container>
        </section>

        {/* ── TRUST BAR ─────────────────────────────────────────────── */}
        <TrustBar />

        {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
        <Container className="py-6">
          {/* Mobile filter button */}
          <div className="flex lg:hidden mb-6">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsSidebarOpen(true)}
              className="btn btn-primary-cta w-full"
              aria-label="Open filter sidebar"
            >
              <Filter size={16} aria-hidden="true" /> Browse Categories
            </motion.button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block flex-shrink-0 w-56 sticky top-28 self-start" aria-label="Hospital filters">
              <FilterSidebar
                activeFilter={activeFilter} setActiveFilter={setActiveFilter}
                erOnly={erOnly} setErOnly={setErOnly}
              />
            </aside>

            {/* Main section */}
            <section className="flex-1 min-w-0">
              <LocationBar
                mode={mode} manualAddress={manualAddress} locationLabel={locationLabel}
                onUseGPS={handleUseGPS} onManualSearch={handleManualSearch} onClear={handleClear}
                gpsLoading={gpsLoading} gpsError={gpsError}
              />

              {/* Results header */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-base-300">
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot-info bg-primary animate-pulse" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50" aria-live="polite">
                    <span className="text-primary text-opacity-100">{filteredHospitals.length}</span>
                    {' '}Hospital{filteredHospitals.length !== 1 ? "s" : ""} found
                  </p>
                </div>

                {/* View toggle */}
                <div className="flex p-1 rounded-xl bg-base-200 border border-base-300" role="group" aria-label="View mode">
                  {[
                    { mode: "grid", Icon: LayoutGrid, label: "Grid view" },
                    { mode: "list", Icon: List, label: "List view" },
                  ].map(({ mode: m, Icon, label }) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      aria-label={label}
                      aria-pressed={viewMode === m}
                      className={`p-2 rounded-lg transition-all ${
                        viewMode === m 
                          ? "bg-primary text-primary-content shadow-sm" 
                          : "text-base-content/40 hover:text-base-content"
                      }`}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid / List */}
              {loading ? (
                <div className={`grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} viewMode={viewMode} />)}
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <motion.div
                    layout
                    className={`grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}
                  >
                    {filteredHospitals.map((hospital) => (
                      <motion.div
                        key={hospital._id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.3 }}
                      >
                        <HospitalCard hospital={hospital} viewMode={viewMode} />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Empty state */}
              {!loading && filteredHospitals.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border-2 border-dashed border-base-300 bg-base-200/50"
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-primary/10 text-primary/60 mx-auto" aria-hidden="true">
                    <Building2 size={36} />
                  </div>
                  <h3 className="font-black text-xl mb-3 text-base-content">
                    No Hospitals Found
                  </h3>
                  <p className="text-base mb-8 max-w-sm text-base-content/50">
                    {isNearbyMode
                      ? "No hospitals found within 100 km of your location."
                      : "No facilities match your current filters. Try adjusting your search."}
                  </p>
                  <button
                    onClick={() => { setSearchTerm(""); setActiveFilter("All"); setErOnly(false); handleClear(); }}
                    className="btn btn-primary-cta"
                  >
                    Reset All Filters
                  </button>
                </motion.div>
              )}
            </section>
          </div>
        </Container>
      </main>
    </Container>
  );
};

export default HospitalsPage;