"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search, Filter, LayoutGrid, List, Star, ArrowUpRight,
  ShieldCheck, Bed, Stethoscope, Zap, Phone, MapPin, X,
  Info, Activity, Navigation, Loader2, Building2, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import {
  fetchAllHospitals, fetchNearbyHospitals,
  selectHospitals, selectNearbyHospitals,
  selectIsLoadingHospitals, selectIsLoadingNearbyHospitals,
} from "@/store/slices/hospitalSlice";
import Container from "../../components/ui/Container";
import Banner from "../../components/Banner";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const MotionImage = motion(Image);

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — all CSS vars, zero hardcoded colors
// Hospital theme: navy (h 245) per global.css [data-theme="hospital"]
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  accent:        'var(--primary)',
  accentContent: 'var(--primary-content)',
  secondary:     'var(--secondary)',
  base100:       'var(--base-100)',
  base200:       'var(--base-200)',
  base300:       'var(--base-300)',
  baseContent:   'var(--base-content)',
  success:       'var(--success)',
  error:         'var(--error)',
  warning:       'var(--warning)',

  accentBg:     'color-mix(in srgb, var(--primary) 8%,  transparent)',
  accentBgMid:  'color-mix(in srgb, var(--primary) 14%, transparent)',
  accentBorder: 'color-mix(in srgb, var(--primary) 25%, transparent)',
  accentShadow: 'color-mix(in srgb, var(--primary) 28%, transparent)',
  accentGrad:   'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
  errorBg:      'color-mix(in srgb, var(--error)   10%, transparent)',
  successBg:    'color-mix(in srgb, var(--success) 10%, transparent)',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`);
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
    const res  = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_KEY}&components=country:in&types=(regions)`);
    const data = await res.json();
    if (data.status === "OK" && data.predictions?.length) {
      return data.predictions.map((p) => ({
        placeId:       p.place_id,
        description:   p.description,
        mainText:      p.structured_formatting?.main_text      || p.description,
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
      className="group relative rounded-2xl overflow-hidden flex"
      style={{
        flexDirection:  isListMode ? undefined : 'column',
        background:     T.base100,
        border:         `1px solid var(--base-300)`,
        boxShadow:      '0 1px 8px rgba(0,0,0,0.04)',
        transition:     'box-shadow 0.25s, border-color 0.25s',
        minHeight:      isListMode ? 220 : 'auto',
      }}
      whileHover={{
        y: -3,
        boxShadow: `0 16px 40px ${T.accentShadow}`,
        borderColor: T.accent,
      }}
    >
      {/* Top accent bar on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
        style={{ background: T.accentGrad }}
        aria-hidden="true"
      />

      {/* ── IMAGE ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width:  isListMode ? 240 : '100%',
          height: isListMode ? '100%' : 200,
          minHeight: isListMode ? 220 : 200,
        }}
      >
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
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)' }}
          aria-hidden="true"
        />

        {/* Verified badge */}
        {hospital.isVerified && (
          <div
            className="absolute top-3 left-3 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--success)', color: 'var(--success-content)' }}
            aria-label="Verified hospital"
          >
            <ShieldCheck size={16} />
          </div>
        )}

        {/* Rating + distance — float top right */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md text-[11px] font-black"
            style={{
              background: 'color-mix(in srgb, var(--base-100) 90%, transparent)',
              border: '1px solid var(--base-300)',
              color: 'var(--base-content)',
            }}
          >
            <Star size={11} style={{ fill: 'var(--warning)', color: 'var(--warning)' }} aria-hidden="true" />
            {hospital.rating?.averageRating?.toFixed(1) || "0.0"}
          </div>
          {hospital.distance && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black"
              style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}
            >
              <MapPin size={9} aria-hidden="true" /> {hospital.distance}
            </div>
          )}
        </div>

        {/* ER badge — bottom of image */}
        {hospital.isEmergencyReady && (
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest"
            style={{ background: T.errorBg, color: 'var(--error)', border: `1px solid color-mix(in srgb, var(--error) 30%, transparent)` }}
            aria-label="Emergency ready 24/7"
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--error)' }} aria-hidden="true" />
            ER 24/7
          </div>
        )}
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5">
        {/* Location tag */}
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin size={10} style={{ color: T.accent, opacity: 0.7 }} aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
            {hospital.address?.city || "Vijayawada"}
          </span>
          {hospital.hospitalType && (
            <>
              <span className="opacity-20 text-[10px]">·</span>
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: T.accentBg, color: T.accent }}
              >
                {hospital.hospitalType}
              </span>
            </>
          )}
        </div>

        {/* Name */}
        <h3
          className="font-black text-[16px] leading-tight mb-3 tracking-tight group-hover:opacity-80 transition-opacity"
          style={{ color: 'var(--base-content)' }}
        >
          {hospital.name}
        </h3>

        {/* Stats row */}
        <div
          className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden mb-4"
          style={{ border: `1px solid var(--base-300)`, background: T.accentBg }}
        >
          {[
            { Icon: Bed,        value: hospital.bedCount?.total || 0,         label: 'Beds'  },
            { Icon: Stethoscope,value: hospital.specialties?.length || 0,     label: 'Depts' },
            { Icon: Zap,        value: hospital.isEmergencyReady ? '24/7' : '–', label: 'ER', filled: hospital.isEmergencyReady },
          ].map(({ Icon, value, label, filled }, i) => (
            <div
              key={label}
              className="flex flex-col items-center py-3"
              style={{ borderRight: i < 2 ? `1px solid var(--base-300)` : 'none' }}
            >
              <Icon
                size={13}
                style={{
                  color:        filled ? 'var(--error)' : T.accent,
                  fill:         filled ? 'var(--error)' : 'none',
                  marginBottom: 4,
                  opacity:      filled === false ? 0.3 : 1,
                }}
                aria-hidden="true"
              />
              <span className="text-[13px] font-black leading-none" style={{ color: T.accent }}>{value}</span>
              <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-40">{label}</span>
            </div>
          ))}
        </div>

        {/* Accreditations */}
        {hospital.accreditations?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {hospital.accreditations.slice(0, 3).map(acc => (
              <span
                key={acc}
                className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}
              >
                {acc}
              </span>
            ))}
          </div>
        )}

        {/* CTA footer */}
        <div className="flex items-center gap-2 mt-auto">
          <Link
            href={`/hospitals/${hospital.slug}`}
            className="flex-1 h-10 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: T.accentGrad,
              color:      'var(--primary-content)',
              boxShadow:  `0 4px 14px ${T.accentShadow}`,
            }}
            aria-label={`Visit ${hospital.name} portal`}
          >
            View Hospital <ArrowUpRight size={13} aria-hidden="true" />
          </Link>

          {hospital.contact?.phone && (
            <a
              href={`tel:${hospital.contact.phone}`}
              aria-label={`Call ${hospital.name}`}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all hover:opacity-80"
              style={{
                border:     `1px solid var(--base-300)`,
                background: 'var(--base-200)',
                color:      'var(--base-content)',
              }}
            >
              <Phone size={16} aria-hidden="true" />
            </a>
          )}

          <Link
            href={`/hospitals/${hospital.slug}`}
            aria-label={`More info about ${hospital.name}`}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all hover:opacity-80"
            style={{
              border:     `1px solid ${T.accentBorder}`,
              background: T.accentBg,
              color:      T.accent,
            }}
          >
            <Info size={15} aria-hidden="true" />
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
  <div
    className="rounded-2xl overflow-hidden flex"
    style={{
      flexDirection: viewMode === 'list' ? undefined : 'column',
      border: '1px solid var(--base-300)',
      background: 'var(--base-100)',
    }}
  >
    <div
      className="skeleton flex-shrink-0"
      style={{
        width:  viewMode === 'list' ? 240 : '100%',
        height: viewMode === 'list' ? 220 : 200,
      }}
    />
    <div className="p-5 flex flex-col gap-3 flex-1">
      <div className="h-3 w-1/3 rounded-lg skeleton" />
      <div className="h-5 w-3/4 rounded-lg skeleton" />
      <div className="h-14 rounded-xl skeleton" />
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
    <div className="space-y-6 w-56">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-4 flex items-center gap-2">
          <Filter size={12} aria-hidden="true" /> Hospital Type
        </p>
        <div className="flex flex-col gap-1">
          {categories.map((cat) => {
            const active = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => { setActiveFilter(cat); onClose?.(); }}
                className="text-left px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all"
                style={{
                  background:  active ? T.accentGrad  : 'transparent',
                  color:       active ? 'var(--primary-content)' : 'var(--base-content)',
                  opacity:     active ? 1 : 0.6,
                  boxShadow:   active ? `0 4px 12px ${T.accentShadow}` : 'none',
                }}
                aria-pressed={active}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Emergency filter */}
      <div
        className="p-4 rounded-xl"
        style={{ border: `1px solid var(--base-300)`, background: 'var(--base-200)' }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Priority</p>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all flex-shrink-0"
            style={{
              borderColor: erOnly ? T.accent : 'var(--base-300)',
              background:  erOnly ? T.accentBgMid : 'transparent',
            }}
            onClick={() => setErOnly(p => !p)}
            role="checkbox"
            aria-checked={erOnly}
            tabIndex={0}
          >
            {erOnly && (
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: T.accent }}
                aria-hidden="true"
              />
            )}
          </div>
          <span
            className="text-[11px] font-black uppercase tracking-wide transition-colors"
            style={{ color: erOnly ? T.accent : 'var(--base-content)', opacity: erOnly ? 1 : 0.7 }}
          >
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
  const [inputVal,    setInputVal]    = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop,    setShowDrop]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

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
    else if (e.key === "ArrowUp")  { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
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
      <div
        className="flex items-center gap-2 h-10 px-4 rounded-xl border transition-colors"
        style={{
          background:  'var(--base-100)',
          border:      `1px solid var(--base-300)`,
          outline:     'none',
        }}
      >
        <MapPin size={13} style={{ color: T.accent, opacity: 0.6, flexShrink: 0 }} aria-hidden="true" />
        <input
          type="text"
          value={inputVal}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          placeholder="City, area or landmark…"
          aria-label="Search by location"
          autoComplete="off"
          className="flex-1 bg-transparent text-[12px] font-bold outline-none"
          style={{ color: 'var(--base-content)', fontFamily: 'var(--font-family-poppins)' }}
        />
        {loading && <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: T.accent }} aria-hidden="true" />}
        {(inputVal || hasValue) && !loading && (
          <button
            onClick={() => { setInputVal(""); setSuggestions([]); setShowDrop(false); onClear(); }}
            aria-label="Clear location"
            className="flex-shrink-0 transition-opacity hover:opacity-60"
            style={{ color: 'var(--base-content)', opacity: 0.4 }}
          >
            <X size={12} />
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
            className="absolute top-[calc(100%+6px)] left-0 right-0 z-[200] rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--base-100)', border: '1px solid var(--base-300)' }}
          >
            {suggestions.map((s, idx) => (
              <button
                key={s.placeId}
                role="option"
                aria-selected={activeIdx === idx}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b last:border-0"
                style={{
                  background:  activeIdx === idx ? T.accentBg : 'transparent',
                  borderColor: 'var(--base-300)',
                }}
              >
                <MapPin size={13} style={{ color: T.accent, marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[12px] font-black truncate" style={{ color: 'var(--base-content)' }}>{s.mainText}</p>
                  {s.secondaryText && (
                    <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--base-content)', opacity: 0.4 }}>{s.secondaryText}</p>
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
    <div
      className="flex flex-wrap items-center gap-3 py-4 mb-6 border-b"
      style={{ borderColor: 'var(--base-300)' }}
    >
      {/* GPS button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onUseGPS}
        disabled={gpsLoading || mode === "user"}
        aria-label={isActive ? "Location active" : "Use my current location"}
        className="flex items-center gap-2 h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-60"
        style={{
          background:  isActive ? T.accentGrad  : 'var(--base-200)',
          color:       isActive ? 'var(--primary-content)' : 'var(--base-content)',
          border:      isActive ? 'none' : `1px solid var(--base-300)`,
          boxShadow:   isActive ? `0 4px 14px ${T.accentShadow}` : 'none',
        }}
      >
        {gpsLoading
          ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          : <Navigation size={14} aria-hidden="true" />
        }
        {mode === "user" ? "Location Active ✓" : mode === "nearby" ? "Near Me ✓" : "Use My Location"}
      </motion.button>

      {/* Location search */}
      <LocationInput onSelect={onManualSearch} onClear={onClear} hasValue={mode === "manual" || mode === "manual-near"} />

      {/* Status */}
      <span
        className="text-[10px] font-black uppercase tracking-wider opacity-40"
        aria-live="polite"
        style={{ color: 'var(--base-content)' }}
      >
        {mode === "user"         ? `📍 ${locationLabel || "Saved location"} · 100 km`
        : mode === "nearby"      ? "📍 Current location · 100 km"
        : mode === "manual-near" ? `🔍 Near "${manualAddress}" · 100 km`
        : mode === "manual"      ? `🔍 "${manualAddress}"`
        : "All hospitals"}
      </span>

      {gpsError && (
        <span className="text-[10px] font-black" style={{ color: 'var(--error)' }} role="alert">
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
    { label: 'Verified Hospitals', value: '200+',  icon: ShieldCheck },
    { label: 'Cities Covered',     value: '15+',   icon: MapPin      },
    { label: 'Total Beds',         value: '5000+', icon: Bed         },
    { label: 'Avg Rating',         value: '4.7★',  icon: Star        },
  ];
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 border-y mb-8"
      style={{ borderColor: 'var(--base-300)' }}
    >
      {stats.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center py-5 gap-1 text-center"
          style={{ borderRight: i < stats.length - 1 ? `1px solid var(--base-300)` : 'none' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center mb-1"
            style={{ background: T.accentBg }}
            aria-hidden="true"
          >
            <Icon size={14} style={{ color: T.accent }} />
          </div>
          <span className="text-[17px] font-black leading-none" style={{ color: T.accent }}>{value}</span>
          <span className="text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--base-content)' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
});

import { memo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
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
      const matchesSearch   = h.name?.toLowerCase().includes(searchTerm.toLowerCase()) || h.address?.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeFilter === "All" || h.hospitalType === activeFilter;
      const matchesER       = erOnly ? h.isEmergencyReady === true : true;
      return matchesSearch && matchesCategory && matchesER;
    });
  }, [hospitals, searchTerm, activeFilter, erOnly]);

  return (
    <Container className="mt-4">
      <Banner position="Home_Top" />
      <main className="min-h-screen" style={{ background: 'var(--base-100)' }}>

        {/* ── MOBILE SIDEBAR OVERLAY ────────────────────────────────── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-[100] lg:hidden"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              />
              <motion.div
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                className="fixed left-0 top-0 bottom-0 w-[280px] z-[101] p-6 shadow-2xl lg:hidden"
                style={{ background: 'var(--base-100)', borderRight: '1px solid var(--base-300)' }}
              >
                <div className="flex items-center justify-between mb-8">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40"
                    style={{ color: 'var(--base-content)' }}
                  >
                    Filters
                  </span>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label="Close filter sidebar"
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:opacity-70"
                    style={{ background: 'var(--base-200)', color: 'var(--base-content)' }}
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
        <section
          className="relative overflow-hidden py-10 md:py-14"
          style={{ background: `linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, transparent) 0%, var(--base-100) 100%)` }}
        >
          {/* Decorative blob */}
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: 'color-mix(in srgb, var(--secondary) 7%, transparent)', filter: 'blur(48px)' }}
            aria-hidden="true"
          />

          <Container className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-end gap-8 md:gap-12">
              {/* Left: heading */}
              <div className="flex-1 max-w-xl">
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-5 border"
                  style={{ background: T.accentBg, color: T.accent, borderColor: T.accentBorder }}
                  aria-hidden="true"
                >
                  <Building2 size={11} /> Hospital Registry
                </div>

                <h1
                  className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-4"
                  style={{ color: 'var(--base-content)' }}
                >
                  Find a{' '}
                  <span
                    style={{
                      background:           T.accentGrad,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor:  'transparent',
                      backgroundClip:       'text',
                    }}
                  >
                    Hospital
                  </span>
                </h1>

                <p
                  className="text-sm leading-relaxed max-w-md"
                  style={{ color: 'var(--base-content)', opacity: 0.55 }}
                >
                  Verified healthcare facilities, surgical centers, and diagnostic hubs across the network. Find emergency-ready hospitals near you.
                </p>
              </div>

              {/* Right: search */}
              <div className="w-full max-w-md">
                <div
                  className="relative flex items-center rounded-2xl overflow-hidden"
                  style={{ border: `2px solid ${T.accentBorder}`, background: 'var(--base-100)', boxShadow: `0 8px 32px ${T.accentShadow}` }}
                >
                  <Search
                    className="absolute left-4"
                    size={18}
                    style={{ color: T.accent, opacity: 0.6 }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    placeholder="Search hospital name or city…"
                    aria-label="Search hospitals"
                    className="w-full pl-12 pr-4 py-4 bg-transparent text-sm font-bold outline-none"
                    style={{ color: 'var(--base-content)', fontFamily: 'var(--font-family-poppins)' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      aria-label="Clear search"
                      className="absolute right-4 opacity-40 hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--base-content)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
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
              className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest"
              style={{
                background:  T.accentGrad,
                color:       'var(--primary-content)',
                boxShadow:   `0 4px 14px ${T.accentShadow}`,
              }}
              aria-label="Open filter sidebar"
            >
              <Filter size={16} aria-hidden="true" /> Browse Categories
            </motion.button>
          </div>

          <div className="flex gap-8">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block flex-shrink-0 sticky top-28 self-start" aria-label="Hospital filters">
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
              <div
                className="flex items-center justify-between mb-6 pb-4 border-b"
                style={{ borderColor: 'var(--base-300)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: T.accent }}
                    aria-hidden="true"
                  />
                  <p
                    className="text-[11px] font-black uppercase tracking-wider"
                    style={{ color: 'var(--base-content)', opacity: 0.5 }}
                    aria-live="polite"
                  >
                    <span style={{ color: T.accent, opacity: 1 }}>{filteredHospitals.length}</span>
                    {' '}Hospital{filteredHospitals.length !== 1 ? "s" : ""} found
                  </p>
                </div>

                {/* View toggle */}
                <div
                  className="flex p-1 rounded-xl border"
                  style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
                  role="group"
                  aria-label="View mode"
                >
                  {[
                    { mode: "grid", Icon: LayoutGrid, label: "Grid view" },
                    { mode: "list", Icon: List,       label: "List view" },
                  ].map(({ mode: m, Icon, label }) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      aria-label={label}
                      aria-pressed={viewMode === m}
                      className="p-2 rounded-lg transition-all"
                      style={{
                        background: viewMode === m ? T.accentGrad : 'transparent',
                        color:      viewMode === m ? 'var(--primary-content)' : 'var(--base-content)',
                        opacity:    viewMode === m ? 1 : 0.4,
                      }}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid / List */}
              {loading ? (
                <div className={`grid gap-5 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} viewMode={viewMode} />)}
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <motion.div
                    layout
                    className={`grid gap-5 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}
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
                  className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed"
                  style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}
                >
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto"
                    style={{ background: T.accentBg }}
                    aria-hidden="true"
                  >
                    <Building2 size={32} style={{ color: T.accent, opacity: 0.6 }} />
                  </div>
                  <h3 className="font-black text-lg mb-2" style={{ color: 'var(--base-content)' }}>
                    No Hospitals Found
                  </h3>
                  <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--base-content)', opacity: 0.5 }}>
                    {isNearbyMode
                      ? "No hospitals found within 100 km of your location."
                      : "No facilities match your current filters."}
                  </p>
                  <button
                    onClick={() => { setSearchTerm(""); setActiveFilter("All"); setErOnly(false); handleClear(); }}
                    className="px-6 py-2.5 rounded-xl font-black text-sm"
                    style={{ background: T.accentGrad, color: 'var(--primary-content)' }}
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