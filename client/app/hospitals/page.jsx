"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  Star,
  ArrowUpRight,
  ShieldCheck,
  Bed,
  Stethoscope,
  Zap,
  Phone,
  MapPin,
  X,
  Info,
  Activity,
  Navigation,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  fetchAllHospitals,
  fetchNearbyHospitals,
  selectHospitals,
  selectNearbyHospitals,
  selectIsLoadingHospitals,
  selectIsLoadingNearbyHospitals,
} from "@/store/slices/hospitalSlice";
import Container from "../../components/ui/Container";
import Banner from "../../components/Banner";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const MotionImage = motion(Image);

// ─── Geocode: address string → { lat, lng } ───────────────────────────────────
async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
    );
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
  } catch { /* silent */ }
  return null;
}

// ─── Places Autocomplete: input string → suggestion list ─────────────────────
// Uses the Places Autocomplete API to get location suggestions as the user types.
// Biased to India (components=country:in).
async function fetchPlaceSuggestions(input) {
  if (!GOOGLE_MAPS_KEY || input.trim().length < 2) return [];
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_KEY}&components=country:in&types=(regions)`
    );
    const data = await res.json();
    if (data.status === "OK" && data.predictions?.length) {
      return data.predictions.map((p) => ({
        placeId:     p.place_id,
        description: p.description,
        mainText:    p.structured_formatting?.main_text    || p.description,
        secondaryText: p.structured_formatting?.secondary_text || "",
      }));
    }
  } catch { /* silent */ }
  return [];
}

// ─── Hospital Card ────────────────────────────────────────────────────────────
const HospitalCard = ({ hospital, viewMode }) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardHeight = viewMode === "grid" ? "h-[540px]" : "md:h-[320px] h-auto";

  return (
    <motion.div
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative w-full ${cardHeight} rounded-md overflow-hidden bg-base-100 border border-base-300 transition-all duration-500 hover:border-error shadow-sm hover:shadow-xl flex ${viewMode === "list" ? "flex-col md:flex-row" : "flex-col"}`}
    >
      <div className={`relative ${viewMode === "list" ? "md:w-1/3 w-full h-48 md:h-full" : "h-56"} overflow-hidden z-0`}>
        <MotionImage
          animate={{ scale: isHovered ? 1.05 : 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          src={hospital.logo || hospital.images?.[0] || "/api/placeholder/800/600"}
          alt={hospital.name || "Hospital Image"}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
        />
        <div className={`absolute inset-0 bg-gradient-to-t from-base-100 ${viewMode === "list" ? "via-transparent" : "via-base-100/60"} to-transparent opacity-40`} />
      </div>

      <div className="absolute top-4 inset-x-4 flex justify-between items-start z-20">
        <div className="flex flex-col gap-2">
          {hospital.isVerified && (
            <div className="w-8 h-8 rounded-md bg-success text-success-content flex items-center justify-center shadow-lg border border-success/20">
              <ShieldCheck size={18} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="bg-base-100/95 border border-base-300 px-3 py-1.5 rounded-md flex items-center gap-2 shadow-sm">
            <Star size={12} className="text-accent fill-accent" />
            <span className="text-xs font-bold text-base-content">
              {hospital.rating?.averageRating?.toFixed(1) || "0.0"}
            </span>
          </div>
          {hospital.distance && (
            <div className="bg-error/10 border border-error/20 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <MapPin size={10} className="text-error" />
              <span className="text-[10px] font-bold text-error">{hospital.distance}</span>
            </div>
          )}
        </div>
      </div>

      <div className={`relative z-10 p-5 flex flex-col justify-end flex-grow transition-all duration-500 ${viewMode === "grid" ? "transform translate-y-[30px] group-hover:translate-y-0 bg-base-100 border-t border-base-300" : "bg-base-100"}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-error/10 text-error text-[10px] font-bold uppercase border border-error/20">
            <span className="h-1.5 w-1.5 rounded-full bg-error animate-pulse" />
            Active Registry
          </div>
          <span className="text-base-content/50 text-[11px] font-bold uppercase tracking-tight flex items-center gap-1">
            <MapPin size={12} className="text-error" /> {hospital.address?.city || "Vijayawada"}
          </span>
        </div>

        <h3 className="text-xl font-bold text-base-content leading-tight mb-4 group-hover:text-error transition-colors tracking-tight">
          {hospital.name}
        </h3>

        <div className="grid grid-cols-3 gap-0 border border-base-300 mb-4 bg-base-200/30 rounded-md overflow-hidden">
          <div className="flex flex-col items-center p-2 border-r border-base-300">
            <Bed size={14} className="text-error mb-1" />
            <span className="text-base-content font-bold text-xs">{hospital.bedCount?.total || 0}</span>
            <span className="text-[8px] font-bold uppercase text-base-content/40 tracking-widest">Beds</span>
          </div>
          <div className="flex flex-col items-center p-2 border-r border-base-300">
            <Stethoscope size={14} className="text-error mb-1" />
            <span className="text-base-content font-bold text-xs">{hospital.specialties?.length || 0}</span>
            <span className="text-[8px] font-bold uppercase text-base-content/40 tracking-widest">Depts</span>
          </div>
          <div className="flex flex-col items-center p-2">
            <Zap
              size={14}
              className={hospital.isEmergencyReady ? "text-error mb-1" : "text-base-content/20 mb-1"}
              fill={hospital.isEmergencyReady ? "currentColor" : "none"}
            />
            <span className="text-base-content font-bold text-xs">{hospital.isEmergencyReady ? "24/7" : "N/A"}</span>
            <span className="text-[8px] font-bold uppercase text-base-content/40 tracking-widest">ER</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/hospitals/${hospital.slug}`}
              className="flex-grow h-11 rounded-md bg-neutral text-neutral-content font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-error transition-all duration-300"
            >
              Visit Portal <ArrowUpRight size={14} />
            </Link>
            <a
              href={`tel:${hospital.contact?.phone}`}
              className="w-11 h-11 rounded-md border border-base-300 flex items-center justify-center text-base-content hover:bg-error hover:text-white transition-colors"
            >
              <Phone size={18} />
            </a>
          </div>
          <Link
            href={`/hospitals/${hospital.slug}`}
            className="w-full h-10 border border-dashed border-base-300 text-base-content/60 font-bold text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:border-error hover:text-error transition-all rounded-md"
          >
            <Info size={14} /> Dispatch Details
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
const FilterSidebar = ({ activeFilter, setActiveFilter, erOnly, setErOnly, onClose }) => {
  const categories = ["All", "Multi-Specialty", "Super-Specialty", "Clinic", "Diagnostic Center", "Government"];
  return (
    <div className="space-y-8 w-64">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-base-content/30 mb-5 flex items-center gap-2">
          <Filter size={14} /> Filter Registry
        </h3>
        <div className="flex flex-col gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveFilter(cat); onClose?.(); }}
              className={`text-left px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                activeFilter === cat
                  ? "bg-error text-white shadow-lg shadow-error/20"
                  : "hover:bg-base-200 text-base-content/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 border border-base-300 rounded-md bg-base-200/50">
        <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 opacity-40">Priority Status</h4>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={erOnly}
            onChange={(e) => setErOnly(e.target.checked)}
            className="w-4 h-4 rounded-md border-base-300 text-error focus:ring-error transition-all"
          />
          <span className="text-[11px] font-bold uppercase tracking-wide text-base-content/80 group-hover:text-error transition-colors">
            Emergency Ready
          </span>
        </label>
      </div>
    </div>
  );
};

// ─── Location Input with Autocomplete ────────────────────────────────────────
const LocationInputWithSuggestions = ({ onSelect, onClear, hasValue }) => {
  const [inputVal,    setInputVal]    = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sugLoading,  setSugLoading]  = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  // Debounced fetch suggestions as user types
  const handleChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    setActiveIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setSugLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchPlaceSuggestions(val);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setSugLoading(false);
    }, 300);
  };

  // Select a suggestion
  const handleSelect = (suggestion) => {
    setInputVal(suggestion.mainText);
    setSuggestions([]);
    setShowDropdown(false);
    onSelect(suggestion.description); // pass full description to geocode
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === "Enter" && inputVal.trim().length > 2) {
        onSelect(inputVal.trim());
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        handleSelect(suggestions[activeIdx]);
      } else if (inputVal.trim().length > 2) {
        setShowDropdown(false);
        onSelect(inputVal.trim());
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClearClick = () => {
    setInputVal("");
    setSuggestions([]);
    setShowDropdown(false);
    onClear();
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-[220px] max-w-sm">
      {/* Input */}
      <div className="flex items-center gap-2 h-10 px-4 rounded-md border border-base-300 bg-base-100 focus-within:border-error transition-colors">
        <MapPin size={14} className="text-base-content/40 shrink-0" />
        <input
          type="text"
          value={inputVal}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Enter city, area or place…"
          className="flex-1 bg-transparent text-xs text-base-content placeholder:text-base-content/30 outline-none font-bold"
          autoComplete="off"
        />
        {sugLoading && <Loader2 size={12} className="animate-spin text-error shrink-0" />}
        {(inputVal || hasValue) && !sugLoading && (
          <button onClick={handleClearClick} className="text-base-content/30 hover:text-error transition-colors shrink-0">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showDropdown && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-[200] bg-base-100 border border-base-300 rounded-md shadow-xl overflow-hidden"
          >
            {suggestions.map((s, idx) => (
              <button
                key={s.placeId}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-base-300 last:border-0
                  ${activeIdx === idx ? "bg-error/10" : "hover:bg-base-200"}`}
              >
                <MapPin size={14} className="text-error mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-base-content truncate">{s.mainText}</p>
                  {s.secondaryText && (
                    <p className="text-[10px] text-base-content/40 truncate mt-0.5">{s.secondaryText}</p>
                  )}
                </div>
              </button>
            ))}
            <div className="px-4 py-2 bg-base-200/50 flex items-center justify-end gap-1">
              <span className="text-[9px] text-base-content/30 uppercase tracking-widest font-bold">Powered by</span>
              <span className="text-[9px] font-bold text-base-content/40">Google</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Location Bar ─────────────────────────────────────────────────────────────
const LocationBar = ({ mode, manualAddress, locationLabel, onUseGPS, onManualSearch, onClear, gpsLoading, gpsError }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 py-4 border-b border-base-300 mb-8">
      {/* GPS button */}
      <button
        onClick={onUseGPS}
        disabled={gpsLoading || mode === "user"}
        className={`flex items-center gap-2 h-10 px-4 rounded-md border text-[11px] font-bold uppercase tracking-wider transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed
          ${mode === "nearby" || mode === "user"
            ? "bg-error text-white border-error shadow-lg shadow-error/20"
            : "bg-base-100 text-base-content border-base-300 hover:border-error hover:text-error"
          }`}
      >
        {gpsLoading
          ? <Loader2 size={14} className="animate-spin" />
          : <Navigation size={14} />
        }
        {mode === "user"   ? "Location Active ✓"
        : mode === "nearby" ? "Near Me ✓"
        : "Use My Location"}
      </button>

      {/* Address input with autocomplete */}
      <LocationInputWithSuggestions
        onSelect={onManualSearch}
        onClear={onClear}
        hasValue={mode === "manual" || mode === "manual-near"}
      />

      {/* Search button */}
      <button
        onClick={() => {}} // search fires on suggestion select or Enter in input
        className="flex items-center gap-2 h-10 px-4 rounded-md border border-base-300 bg-base-100 text-[11px] font-bold uppercase tracking-wider hover:border-error hover:text-error transition-colors outline-none"
      >
        <Search size={14} /> Search
      </button>

      {/* Status label */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/30">
        {mode === "user"
          ? `📍 ${locationLabel || "Your saved location"} · 100 km radius`
          : mode === "nearby"
          ? "📍 Current location · 100 km radius"
          : mode === "manual" || mode === "manual-near"
          ? `🔍 Near "${manualAddress}" · 100 km radius`
          : "All hospitals"}
      </span>

      {gpsError && (
        <span className="text-[10px] text-error font-bold">{gpsError}</span>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const HospitalsPage = () => {
  const dispatch = useDispatch();

  const user            = useSelector((s) => s.user?.user) ?? null;
  const allHospitals    = useSelector(selectHospitals);
  const nearbyHospitals = useSelector(selectNearbyHospitals);
  const loadingAll      = useSelector(selectIsLoadingHospitals);
  const loadingNearby   = useSelector(selectIsLoadingNearbyHospitals);

  const [searchTerm,    setSearchTerm]    = useState("");
  const [activeFilter,  setActiveFilter]  = useState("All");
  const [viewMode,      setViewMode]      = useState("grid");
  const [erOnly,        setErOnly]        = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [mode,          setMode]          = useState("all");
  const [manualAddress, setManualAddress] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [gpsError,      setGpsError]      = useState("");

  const isNearbyMode = mode === "user" || mode === "nearby" || mode === "manual-near";
  const hospitals    = isNearbyMode ? nearbyHospitals : allHospitals;
  const loading      = isNearbyMode ? loadingNearby   : loadingAll;

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.location?.coordinates) {
      const [lng, lat] = user.location.coordinates; // GeoJSON: [lng, lat]
      if (lng !== 0 || lat !== 0) {
        dispatch(fetchNearbyHospitals({ lat, lng, limit: 20 }));
        setMode("user");
        setLocationLabel(user.lastKnownAddress || "your saved location");
        return;
      }
    }
    if (!allHospitals?.length) dispatch(fetchAllHospitals({ limit: 20 }));
    setMode("all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  // CoreLocation kCLErrorLocationUnknown:
  //   This is a transient error — the device temporarily can't determine location.
  //   We handle it by showing a clear message and letting the user enter manually.
  //   We do NOT retry automatically to avoid spamming the GPS stack.
  const handleUseGPS = useCallback(() => {
    if (mode === "user") return; // already have saved coords
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported. Enter your area below.");
      return;
    }
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
        // err.code 1 = PERMISSION_DENIED
        // err.code 2 = POSITION_UNAVAILABLE (kCLErrorLocationUnknown maps to this)
        // err.code 3 = TIMEOUT
        if (err.code === 1) {
          setGpsError("Location permission denied. Enter your area manually.");
        } else if (err.code === 2) {
          // kCLErrorLocationUnknown — device can't determine location right now
          // Silently fallback; don't crash, just prompt manual entry
          setGpsError("Device couldn't determine location. Enter your area manually.");
        } else {
          setGpsError("Location request timed out. Enter your area manually.");
        }
      },
      {
        timeout:            8000,
        maximumAge:         60000,
        enableHighAccuracy: false, // false avoids GPS chip on mobile = fewer errors
      }
    );
  }, [dispatch, mode]);

  // ── Manual / Autocomplete search ──────────────────────────────────────────
  const handleManualSearch = useCallback(async (address) => {
    setGpsError("");
    const coords = await geocodeAddress(address);
    if (coords) {
      dispatch(fetchNearbyHospitals({ lat: coords.lat, lng: coords.lng, limit: 20 }));
      setMode("manual-near");
    } else {
      // Geocoding failed → fall back to city text filter on all-hospitals
      dispatch(fetchAllHospitals({ city: address, limit: 20 }));
      setMode("manual");
    }
    setManualAddress(address);
  }, [dispatch]);

  // ── Clear ─────────────────────────────────────────────────────────────────
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

  // ── Client-side filter ────────────────────────────────────────────────────
  const filteredHospitals = useMemo(() => {
    if (!hospitals?.length) return [];
    return hospitals.filter((h) => {
      const matchesSearch =
        h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.address?.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeFilter === "All" || h.hospitalType === activeFilter;
      const matchesER = erOnly ? h.isEmergencyReady === true : true;
      return matchesSearch && matchesCategory && matchesER;
    });
  }, [hospitals, searchTerm, activeFilter, erOnly]);

  return (
    <Container className="mt-4">
      <Banner position="Home_Top" />
      <main className="min-h-screen bg-base-100">

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-base-content/60 backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.div
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                className="fixed left-0 top-0 bottom-0 w-[300px] bg-base-100 z-[101] p-6 lg:hidden shadow-2xl border-r border-base-300"
              >
                <div className="flex justify-between items-center mb-8">
                  <span className="font-bold text-xs uppercase tracking-[0.3em] opacity-40">Navigation</span>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-base-200 rounded-md text-error">
                    <X size={20} />
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

        {/* Page header */}
        <header className="py-6 border-b border-base-300 bg-base-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-error/5 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none" />
          <div className="container-custom relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-md bg-error/10 flex items-center justify-center text-error">
                    <Activity size={18} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-error">Hospitals Registry</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-base-content mb-4 leading-none uppercase">
                  Find a <span className="text-error">Hospital</span>
                </h1>
                <p className="text-base-content/50 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
                  Connect with verified healthcare facilities, specialized surgical centers, and diagnostic nodes across the network.
                </p>
              </div>

              <div className="w-full max-w-lg relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-error transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search facility name or city..."
                  className="w-full pl-14 pr-6 py-5 bg-base-200 border border-base-300 rounded-md focus:bg-base-100 focus:border-error outline-none text-sm font-bold transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="container-custom py-10">
          <div className="flex lg:hidden mb-6">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-neutral text-neutral-content rounded-md font-bold text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-error transition-all"
            >
              <Filter size={18} /> Browse Categories
            </button>
          </div>

          <div className="flex flex-col w-full lg:flex-row gap-10">
            <aside className="hidden lg:block shrink-0">
              <div className="sticky top-32">
                <FilterSidebar
                  activeFilter={activeFilter} setActiveFilter={setActiveFilter}
                  erOnly={erOnly} setErOnly={setErOnly}
                />
              </div>
            </aside>

            <section className="flex-grow">
              <LocationBar
                mode={mode}
                manualAddress={manualAddress}
                locationLabel={locationLabel}
                onUseGPS={handleUseGPS}
                onManualSearch={handleManualSearch}
                onClear={handleClear}
                gpsLoading={gpsLoading}
                gpsError={gpsError}
              />

              <div className="flex justify-between items-center mb-10 pb-5 border-b border-base-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">
                    Registry:{" "}
                    <span className="text-base-content">
                      {filteredHospitals.length} Hospital{filteredHospitals.length !== 1 ? "s" : ""} Online
                    </span>
                  </p>
                </div>
                <div className="flex bg-base-200 p-1 rounded-md border border-base-300 shadow-inner">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-error text-white shadow-md" : "text-base-content/30 hover:text-error"}`}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-error text-white shadow-md" : "text-base-content/30 hover:text-error"}`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className={`grid gap-8 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-[500px] rounded-md bg-base-200 animate-pulse border border-base-300" />
                  ))}
                </div>
              ) : (
                <motion.div
                  layout
                  className={`grid gap-6 md:gap-8 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}
                >
                  <AnimatePresence mode="popLayout">
                    {filteredHospitals.map((hospital) => (
                      <motion.div
                        key={hospital._id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                      >
                        <HospitalCard hospital={hospital} viewMode={viewMode} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}

              {!loading && filteredHospitals.length === 0 && (
                <div className="py-24 text-center border border-dashed border-base-300 rounded-md bg-base-200/30">
                  <div className="bg-error/10 w-20 h-20 rounded-md flex items-center justify-center mx-auto mb-6 text-error">
                    <X size={40} />
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter mb-2">Zero Matches Found</h3>
                  <p className="text-sm text-base-content/50 mb-8 font-medium">
                    {isNearbyMode
                      ? "No hospitals found within 100 km of your location."
                      : "No medical facilities match your current filters."}
                  </p>
                  <button
                    onClick={() => { setSearchTerm(""); setActiveFilter("All"); setErOnly(false); handleClear(); }}
                    className="px-8 py-4 bg-error text-white text-[11px] font-bold uppercase tracking-[0.2em] rounded-md hover:bg-neutral transition-all shadow-lg shadow-error/20"
                  >
                    Reset Registry Filters
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </Container>
  );
};

export default HospitalsPage;