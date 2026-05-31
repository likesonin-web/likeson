"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  MapPin,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  Star,
  Navigation,
  Stethoscope,
  Hospital,
  FlaskConical,
  Pill,
  Globe,
  Filter,
  SlidersHorizontal,
  CheckCircle,
  AlertCircle,
  Loader2,
  Wifi,
  Home,
  Video,
  UserCheck,
  ChevronDown,
  Trash2,
  BadgeCheck,
  Building2,
  TestTube,
  Package,
} from "lucide-react";
import Link from "next/link";

// ── Redux imports ────────────────────────────────────────────────────────────
import {
  searchDoctors,
  searchHospitals,
  searchLabs,
  searchMedicines,
  searchGlobal,
  fetchAutocomplete,
  fetchTrending,
  fetchRecentSearches,
  clearRecentSearches,
  deleteRecentEntry,
  fetchNearby,
  fetchSpecializations,
  setActiveQuery,
  setActiveCategory,
  clearAutocomplete,
  resetGlobalSearch,
  removeRecentEntryOptimistic,
  selectDoctorResults,
  selectHospitalResults,
  selectLabResults,
  selectMedicineResults,
  selectGlobalResults,
  selectSuggestions,
  selectAutocompleteLoading,
  selectTrending,
  selectTrendingLoading,
  selectRecentSearches,
  selectRecentLoading,
  selectNearbyHospitals,
  selectNearbyLabs,
  selectNearbyLoading,
  selectSpecializations,
  selectActiveQuery,
  selectActiveCategory,
  selectAnySearchLoading,
} from "@/store/slices/searchSlice";

// ── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "all",      label: "All",       icon: Globe,        color: "var(--primary)" },
  { key: "doctor",   label: "Doctors",   icon: Stethoscope,  color: "var(--info)" },
  { key: "hospital", label: "Hospitals", icon: Building2,    color: "#8b5cf6" },
  { key: "lab",      label: "Labs",      icon: FlaskConical, color: "var(--success)" },
  { key: "medicine", label: "Medicines", icon: Pill,         color: "var(--warning)" },
];

const SORT_OPTIONS = {
  doctor:   ["relevance", "rating", "distance", "name", "newest"],
  hospital: ["relevance", "rating", "distance", "name", "newest"],
  lab:      ["relevance", "rating", "distance", "name"],
  medicine: ["relevance", "name", "price-asc", "price-desc"],
  all:      [],
};

// ── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariant = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

const dropdownVariant = {
  hidden:  { opacity: 0, y: -6, scaleY: 0.95, transformOrigin: "top" },
  visible: { opacity: 1, y: 0,  scaleY: 1,    transition: { duration: 0.2, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, scaleY: 0.95, transition: { duration: 0.15 } },
};

// ── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Geo hook ─────────────────────────────────────────────────────────────────
function useGeo() {
  const [geo, setGeo] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const request = useCallback(() => {
    if (!navigator.geolocation) { setGeoError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      ()  => setGeoError(true),
      { timeout: 8000 }
    );
  }, []);
  return { geo, geoError, request };
}

// ════════════════════════════════════════════════════════════════════════════
// NEW ANIMATED CREATURES
// ════════════════════════════════════════════════════════════════════════════

// ── 1. PulseRadar (The Loading/Searching Scanner) ───────────────────────────
const PulseRadar = () => (
  <div className="relative w-32 h-32 mx-auto mb-4 pointer-events-none select-none">
    <motion.div
      animate={{ scale: [1, 2, 2.5], opacity: [0.6, 0, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      className="absolute inset-0 m-auto w-12 h-12 rounded-full border-2 border-[var(--primary)]"
    />
    <motion.div
      animate={{ scale: [1, 2, 2.5], opacity: [0.6, 0, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
      className="absolute inset-0 m-auto w-12 h-12 rounded-full border-2 border-[var(--primary)]"
    />
    <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-lg">
      {/* Base */}
      <path d="M30 80 L70 80 L60 50 L40 50 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="25" y="80" width="50" height="10" rx="3" fill="var(--base-300)" />
      
      {/* Spinning Dish */}
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50px 50px" }}>
        <circle cx="50" cy="50" r="25" fill="var(--base-100)" stroke="var(--primary)" strokeWidth="3" opacity="0.9" />
        <path d="M50 25 L50 50 L75 50" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="50" r="5" fill="var(--primary)" />
      </motion.g>
    </svg>
  </div>
);

// ── 2. MediHound (The Missing Results Retriever) ─────────────────────────────
const MediHound = () => (
  <div className="relative w-48 h-48 mx-auto pointer-events-none select-none">
    <motion.div animate={{ y: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="w-full h-full">
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl">
        {/* Floating Question Marks */}
        <motion.text x="40" y="60" fontSize="24" fill="var(--base-content)" opacity="0.4" fontFamily="sans-serif" animate={{ y: [0, -15, 0], opacity: [0, 0.4, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>?</motion.text>
        <motion.text x="140" y="40" fontSize="20" fill="var(--base-content)" opacity="0.4" fontFamily="sans-serif" animate={{ y: [0, -20, 0], opacity: [0, 0.4, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 1 }}>?</motion.text>

        {/* Dog Body */}
        <path d="M70 140 C70 100, 130 100, 130 140 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="3" strokeLinejoin="round" />
        
        {/* Head */}
        <motion.g animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "100px 90px" }}>
          <rect x="75" y="70" width="50" height="45" rx="15" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="3" />
          {/* Drooping Ears */}
          <path d="M75 75 C60 80, 50 110, 65 115" fill="var(--primary)" opacity="0.8" />
          <path d="M125 75 C140 80, 150 110, 135 115" fill="var(--primary)" opacity="0.8" />
          
          {/* Confused Eyes */}
          <line x1="85" y1="85" x2="95" y2="90" stroke="var(--base-content)" strokeWidth="3" strokeLinecap="round" />
          <line x1="115" y1="85" x2="105" y2="90" stroke="var(--base-content)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="90" cy="95" r="3" fill="var(--base-content)" />
          <circle cx="110" cy="95" r="3" fill="var(--base-content)" />
          
          {/* Snout */}
          <ellipse cx="100" cy="105" rx="12" ry="8" fill="var(--base-200)" />
          <circle cx="100" cy="102" r="3" fill="var(--base-content)" />
        </motion.g>

        {/* Magnifying Glass on floor */}
        <g transform="translate(130, 140) rotate(20)">
          <circle cx="0" cy="0" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" />
          <circle cx="0" cy="0" r="12" fill="var(--accent)" opacity="0.1" />
          <line x1="10" y1="10" x2="25" y2="25" stroke="var(--base-300)" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    </motion.div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ── Star rating ──────────────────────────────────────────────────────────────
const Stars = memo(({ rating = 0, size = 12 }) => (
  <span className="inline-flex gap-0.5" aria-hidden="true">
    {[1,2,3,4,5].map((s) => (
      <Star key={s} size={size} className={s <= Math.round(rating) ? "text-[var(--warning)] fill-[var(--warning)]" : "text-[var(--base-300)]"} />
    ))}
  </span>
));
Stars.displayName = "Stars";

// ── Badge ────────────────────────────────────────────────────────────────────
const Chip = memo(({ children, color, onClick, active }) => (
  <motion.button
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    style={active ? { background: color, color: "#fff", borderColor: color, boxShadow: `0 4px 12px color-mix(in srgb, ${color} 40%, transparent)` } : {}}
    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-poppins text-xs font-bold border transition-all duration-200
      ${active ? "" : "bg-[var(--base-200)] border-[var(--base-300)] text-[var(--base-content)]/70 hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}
  >
    {children}
  </motion.button>
));
Chip.displayName = "Chip";

// ── Skeleton card ────────────────────────────────────────────────────────────
const SkeletonCard = memo(() => (
  <div className="rounded-[var(--r-box)] p-4 flex gap-4 border border-[var(--base-300)] bg-[var(--base-100)] animate-pulse">
    <div className="w-16 h-16 rounded-[var(--r-field)] bg-[var(--base-200)] flex-shrink-0" />
    <div className="flex-1 space-y-3 py-1">
      <div className="h-3 w-3/4 bg-[var(--base-200)] rounded-full" />
      <div className="h-2 w-1/2 bg-[var(--base-200)] rounded-full" />
      <div className="h-2 w-1/3 bg-[var(--base-200)] rounded-full" />
    </div>
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

// ── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = memo(({ query }) => (
  <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col items-center justify-center py-20 text-center">
    <MediHound />
    <h3 className="font-montserrat font-black text-2xl text-[var(--base-content)] mt-4">
      No results {query ? `for "${query}"` : "found"}
    </h3>
    <p className="font-poppins text-sm font-medium text-[var(--base-content)]/50 mt-2 max-w-sm">
      Our medical hounds couldn't sniff out anything matching your criteria. Try adjusting your filters or keywords.
    </p>
  </motion.div>
));
EmptyState.displayName = "EmptyState";

// ── Pagination ───────────────────────────────────────────────────────────────
const Pagination = memo(({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages } = pagination;
  return (
    <div className="flex items-center justify-center gap-2.5 mt-10">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="w-10 h-10 rounded-[var(--r-selector)] flex items-center justify-center border-2 border-[var(--base-300)] bg-[var(--base-100)] text-[var(--base-content)] disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        const p = pages <= 7 ? i + 1 : i < 3 ? i + 1 : i === 3 ? page : pages - (6 - i);
        return (
          <button key={i} onClick={() => onPageChange(p)}
            className="w-10 h-10 rounded-[var(--r-selector)] font-poppins text-sm font-black transition-all"
            style={p === page ? { background: "var(--primary)", color: "var(--primary-content)", border: "2px solid var(--primary)", boxShadow: "0 4px 12px color-mix(in srgb, var(--primary), transparent 60%)" } : { background: "var(--base-100)", color: "var(--base-content)", border: "2px solid var(--base-300)" }}>
            {p}
          </button>
        );
      })}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= pages} className="w-10 h-10 rounded-[var(--r-selector)] flex items-center justify-center border-2 border-[var(--base-300)] bg-[var(--base-100)] text-[var(--base-content)] disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
        <ChevronRight size={16} />
      </button>
    </div>
  );
});
Pagination.displayName = "Pagination";

// ── Doctor card ──────────────────────────────────────────────────────────────
const DoctorCard = memo(({ doc }) => (
  <motion.div variants={cardVariant} className="rounded-[var(--r-box)] border border-[var(--base-300)] bg-[var(--base-100)] hover:border-[var(--info)]/50 hover:shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--info),transparent_80%)] p-4 flex gap-4 cursor-pointer group transition-all duration-300">
    <div className="relative flex-shrink-0">
      <img src={doc.profilePhotoUrl || doc.avatar || "/placeholder-doctor.png"} alt={doc.name} className="w-16 h-16 rounded-[var(--r-field)] object-cover bg-[var(--base-200)] shadow-sm" />
      {doc.isOnline && <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-[var(--success)] rounded-full border-2 border-[var(--base-100)] shadow-sm" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-montserrat font-black text-sm text-[var(--base-content)] group-hover:text-[var(--info)] transition-colors flex items-center gap-1.5">
            Dr. {doc.name}
            {doc.isVerified && <BadgeCheck size={14} className="text-[var(--info)] flex-shrink-0" />}
          </h3>
          <p className="font-poppins text-xs font-bold text-[var(--base-content)]/60 mt-0.5 uppercase tracking-wider">{doc.specialization}</p>
        </div>
        {doc.distanceKm != null && <span className="font-poppins text-[10px] font-black text-[var(--info)] whitespace-nowrap flex items-center gap-1 px-2 py-1 bg-[var(--info)]/10 rounded-md"><MapPin size={10} /> {doc.distanceKm.toFixed(1)} km</span>}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Stars rating={doc.rating?.averageRating} />
          <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/50">({doc.rating?.totalRatings ?? 0})</span>
        </div>
        <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/50 border-l border-[var(--base-300)] pl-3">{doc.experienceYears} Yrs Exp</span>
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {doc.consultationTypes?.inPerson  && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--info)]/10 text-[var(--info)] uppercase"><Home size={9}/> In-Person</span>}
        {doc.consultationTypes?.video     && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#0ea5e9]/10 text-[#0ea5e9] uppercase"><Video size={9}/> Video</span>}
        {doc.consultationTypes?.homeVisit && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#10b981]/10 text-[#10b981] uppercase"><Navigation size={9}/> Home</span>}
      </div>
    </div>
  </motion.div>
));
DoctorCard.displayName = "DoctorCard";

// ── Hospital card ─────────────────────────────────────────────────────────────
const HospitalCard = memo(({ hosp }) => (
  <motion.div variants={cardVariant} className="rounded-[var(--r-box)] border border-[var(--base-300)] bg-[var(--base-100)] hover:border-[#8b5cf6]/50 hover:shadow-[0_8px_24px_-6px_color-mix(in_srgb,#8b5cf6,transparent_80%)] p-4 flex gap-4 cursor-pointer group transition-all duration-300">
    <div className="flex-shrink-0 w-16 h-16 rounded-[var(--r-field)] bg-[var(--base-200)] flex items-center justify-center overflow-hidden border border-[var(--base-300)]">
      {hosp.logo ? <img src={hosp.logo} alt={hosp.name} className="w-full h-full object-cover" /> : <Building2 size={24} className="text-[var(--base-content)]/30" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-montserrat font-black text-sm text-[var(--base-content)] group-hover:text-[#8b5cf6] transition-colors flex items-center gap-1.5 line-clamp-1">
            {hosp.name}
            {hosp.isVerified && <BadgeCheck size={14} className="text-[#8b5cf6] flex-shrink-0" />}
          </h3>
          <p className="font-poppins text-xs font-bold text-[var(--base-content)]/60 mt-0.5 uppercase tracking-wider">{hosp.hospitalType}</p>
        </div>
        {hosp.distanceKm != null && <span className="font-poppins text-[10px] font-black text-[#8b5cf6] whitespace-nowrap flex items-center gap-1 px-2 py-1 bg-[#8b5cf6]/10 rounded-md"><MapPin size={10} /> {hosp.distanceKm.toFixed(1)} km</span>}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Stars rating={hosp.rating?.averageRating} />
        <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/50">({hosp.rating?.totalRatings ?? 0})</span>
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {hosp.isEmergencyReady && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#ef4444]/10 text-[#ef4444] uppercase"><AlertCircle size={9}/> Emergency</span>}
        {hosp.hasICU           && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#8b5cf6]/10 text-[#8b5cf6] uppercase">ICU</span>}
        {hosp.is24x7           && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#0ea5e9]/10 text-[#0ea5e9] uppercase">24×7</span>}
      </div>
      <p className="font-poppins text-[10px] font-medium text-[var(--base-content)]/40 mt-2 flex items-center gap-1 truncate">
        <MapPin size={10} />{hosp.address?.line1}, {hosp.address?.city}
      </p>
    </div>
  </motion.div>
));
HospitalCard.displayName = "HospitalCard";

// ── Lab card ──────────────────────────────────────────────────────────────────
const LabCard = memo(({ lab }) => (
  <motion.div variants={cardVariant} className="rounded-[var(--r-box)] border border-[var(--base-300)] bg-[var(--base-100)] hover:border-[var(--success)]/50 hover:shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--success),transparent_80%)] p-4 flex gap-4 cursor-pointer group transition-all duration-300">
    <div className="flex-shrink-0 w-16 h-16 rounded-[var(--r-field)] bg-[var(--base-200)] flex items-center justify-center overflow-hidden border border-[var(--base-300)]">
      {lab.logoUrl ? <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" /> : <TestTube size={24} className="text-[var(--base-content)]/30" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-montserrat font-black text-sm text-[var(--base-content)] group-hover:text-[var(--success)] transition-colors flex items-center gap-1.5 line-clamp-1">
            {lab.labName}
            {lab.isVerified && <BadgeCheck size={14} className="text-[var(--success)] flex-shrink-0" />}
          </h3>
          <p className="font-poppins text-xs font-bold text-[var(--base-content)]/60 mt-0.5 uppercase tracking-wider">{lab.labType}</p>
        </div>
        {lab.distanceKm != null && <span className="font-poppins text-[10px] font-black text-[var(--success)] whitespace-nowrap flex items-center gap-1 px-2 py-1 bg-[var(--success)]/10 rounded-md"><MapPin size={10} /> {lab.distanceKm.toFixed(1)} km</span>}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Stars rating={lab.averageRating} />
          <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/50">({lab.totalReviews ?? 0})</span>
        </div>
        {lab.activeTestCount != null && <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/50 border-l border-[var(--base-300)] pl-3">{lab.activeTestCount} Tests</span>}
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {(lab.sampleCollectionMode === "Home Collection" || lab.sampleCollectionMode === "Both") && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--success)]/10 text-[var(--success)] uppercase"><Home size={9}/> Home Col.</span>}
        {lab.isFeatured && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#f59e0b]/10 text-[#f59e0b] uppercase">Featured</span>}
      </div>
    </div>
  </motion.div>
));
LabCard.displayName = "LabCard";

// ── Medicine card ─────────────────────────────────────────────────────────────
const MedicineCard = memo(({ med }) => {
  const primaryImage = med.images?.find?.((i) => i.isPrimary) || med.images?.[0];
  return (
    <motion.div variants={cardVariant} className="rounded-[var(--r-box)] border border-[var(--base-300)] bg-[var(--base-100)] hover:border-[var(--warning)]/50 hover:shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--warning),transparent_80%)] p-4 flex gap-4 cursor-pointer group transition-all duration-300">
      <div className="flex-shrink-0 w-16 h-16 rounded-[var(--r-field)] bg-[var(--base-200)] flex items-center justify-center overflow-hidden border border-[var(--base-300)] p-1">
        {primaryImage?.url ? <img src={primaryImage.url} alt={med.name} className="w-full h-full object-contain mix-blend-multiply" /> : <Package size={24} className="text-[var(--base-content)]/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-2">
            <h3 className="font-montserrat font-black text-sm text-[var(--base-content)] group-hover:text-[var(--warning)] transition-colors line-clamp-1">
              {med.brandName || med.name}
            </h3>
            <p className="font-poppins text-xs font-medium text-[var(--base-content)]/60 mt-0.5 truncate">{med.genericName}</p>
          </div>
          <div className="text-right flex-shrink-0">
            {med.mrp != null && <p className="font-montserrat font-black text-sm text-[var(--warning)]">₹{med.mrp}</p>}
            <span className={`font-poppins text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mt-1 inline-block ${med.isAvailable ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"}`}>
              {med.isAvailable ? "In Stock" : "Out of Stock"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--warning)]/10 text-[var(--warning)] uppercase">{med.category}</span>
          {med.isPrescriptionRequired && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--error)]/10 text-[var(--error)] uppercase">Rx Req</span>}
          {med.schedule && med.schedule !== "None" && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-[#8b5cf6]/10 text-[#8b5cf6] uppercase">Sch {med.schedule}</span>}
        </div>
        <p className="font-poppins text-[10px] font-medium text-[var(--base-content)]/40 mt-2 truncate">{med.packaging}</p>
      </div>
    </motion.div>
  );
});
MedicineCard.displayName = "MedicineCard";

// ── Global result section ─────────────────────────────────────────────────────
const GlobalSection = memo(({ title, icon: Icon, color, children, count }) => {
  if (!count) return null;
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-[var(--r-selector)] flex items-center justify-center border" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, borderColor: `color-mix(in srgb, ${color} 20%, transparent)` }}>
          <Icon size={16} style={{ color }} aria-hidden="true" />
        </div>
        <h2 className="font-montserrat font-black text-lg text-[var(--base-content)] tracking-tight">{title}</h2>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: color, color: "#fff" }}>{count} found</span>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </motion.div>
    </div>
  );
});
GlobalSection.displayName = "GlobalSection";

// ── Filter panel ──────────────────────────────────────────────────────────────
const FilterPanel = memo(({ tab, filters, setFilters, specializations }) => {
  if (tab === "all") return null;
  const sortOpts = SORT_OPTIONS[tab] || [];

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-6 space-y-6 sticky top-4 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--base-200)]">
        <h3 className="font-montserrat font-black text-base text-[var(--base-content)] flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-[var(--primary)]" aria-hidden="true" />Filters
        </h3>
        <button onClick={() => setFilters({})} className="font-poppins text-[10px] font-black text-[var(--error)] uppercase tracking-wider hover:underline">Reset</button>
      </div>

      {sortOpts.length > 0 && (
        <div>
          <label className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-3 block">Sort by</label>
          <div className="flex flex-col gap-2">
            {sortOpts.map((s) => (
              <label key={s} className="flex items-center gap-3 cursor-pointer group">
                <input type="radio" name="sort" value={s} checked={filters.sort === s || (!filters.sort && s === "relevance")} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))} className="radio radio-primary radio-sm border-[var(--base-300)]" />
                <span className="font-poppins text-xs font-bold text-[var(--base-content)]/80 group-hover:text-[var(--primary)] capitalize transition-colors">{s.replace(/-/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === "doctor" && (
        <>
          <div>
            <label className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-3 block">Specialization</label>
            <select value={filters.specialization || ""} onChange={(e) => setFilters((f) => ({ ...f, specialization: e.target.value || undefined }))} className="input-field w-full text-xs font-bold font-poppins py-2.5">
              <option value="">All Specializations</option>
              {specializations.map((s) => (
                <option key={s.specialization} value={s.specialization}>{s.specialization} ({s.doctorCount})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-3 block">Consultation Type</label>
            {["inPerson", "video", "homeVisit"].map((t) => (
              <label key={t} className="flex items-center gap-3 cursor-pointer group mb-2">
                <input type="checkbox" checked={!!filters[t]} onChange={(e) => setFilters((f) => ({ ...f, [t]: e.target.checked ? "true" : undefined }))} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
                <span className="font-poppins text-xs font-bold text-[var(--base-content)]/80 group-hover:text-[var(--primary)] capitalize transition-colors">{t === "homeVisit" ? "Home Visit" : t === "inPerson" ? "In-Person" : "Video"}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-3 cursor-pointer group mt-4 pt-4 border-t border-[var(--base-200)]">
            <input type="checkbox" checked={filters.verified === "true"} onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.checked ? "true" : undefined }))} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
            <span className="font-poppins text-xs font-black text-[var(--base-content)] uppercase tracking-wider group-hover:text-[var(--primary)] transition-colors">Verified Doctors Only</span>
          </label>
        </>
      )}

      {tab === "hospital" && (
        <>
          <div>
            <label className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-3 block">Hospital Type</label>
            {["Multi-Specialty", "Super-Specialty", "Clinic", "Nursing Home", "Trust", "Government"].map((t) => (
              <label key={t} className="flex items-center gap-3 cursor-pointer group mb-2">
                <input type="checkbox" checked={filters.hospitalType === t} onChange={(e) => setFilters((f) => ({ ...f, hospitalType: e.target.checked ? t : undefined }))} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
                <span className="font-poppins text-xs font-bold text-[var(--base-content)]/80 group-hover:text-[var(--primary)] transition-colors">{t}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-3 block">Facilities</label>
            {[
              { key: "isEmergencyReady", label: "Emergency Services" },
              { key: "hasICU",           label: "ICU Available" },
              { key: "hasPharmacy",      label: "In-house Pharmacy" },
              { key: "is24x7",           label: "24×7 Open" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group mb-2">
                <input type="checkbox" checked={!!(filters.facilities || "").includes(key)} onChange={(e) => {
                    const facs = (filters.facilities || "").split(",").filter(Boolean);
                    const next = e.target.checked ? [...new Set([...facs, key])].join(",") : facs.filter((f) => f !== key).join(",");
                    setFilters((f) => ({ ...f, facilities: next || undefined }));
                  }} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
                <span className="font-poppins text-xs font-bold text-[var(--base-content)]/80 group-hover:text-[var(--primary)] transition-colors">{label}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {tab === "lab" && (
        <label className="flex items-center gap-3 cursor-pointer group pt-2">
          <input type="checkbox" checked={filters.homeCollection === "true"} onChange={(e) => setFilters((f) => ({ ...f, homeCollection: e.target.checked ? "true" : undefined }))} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
          <span className="font-poppins text-xs font-black text-[var(--base-content)] uppercase tracking-wider group-hover:text-[var(--primary)] transition-colors">Home Collection</span>
        </label>
      )}

      {tab === "medicine" && (
        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={filters.otcOnly === "true"} onChange={(e) => setFilters((f) => ({ ...f, otcOnly: e.target.checked ? "true" : undefined }))} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
            <span className="font-poppins text-xs font-black text-[var(--base-content)] uppercase tracking-wider group-hover:text-[var(--primary)] transition-colors">OTC only</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={filters.prescriptionRequired === "true"} onChange={(e) => setFilters((f) => ({ ...f, prescriptionRequired: e.target.checked ? "true" : undefined }))} className="checkbox checkbox-primary checkbox-sm border-[var(--base-300)]" />
            <span className="font-poppins text-xs font-black text-[var(--base-content)] uppercase tracking-wider group-hover:text-[var(--primary)] transition-colors">Rx Required</span>
          </label>
        </div>
      )}
    </motion.div>
  );
});
FilterPanel.displayName = "FilterPanel";

// ── Nearby strip ─────────────────────────────────────────────────────────────
const NearbyStrip = memo(({ hospitals, labs, loading }) => {
  const items = [
    ...hospitals.map((h) => ({ ...h, _type: "hospital", label: h.name })),
    ...labs.map((l)     => ({ ...l, _type: "lab",      label: l.labName })),
  ].sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99)).slice(0, 8);

  if (loading) return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x px-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton flex-shrink-0 w-48 h-28 rounded-[var(--r-box)] border border-[var(--base-300)] snap-start" />
      ))}
    </div>
  );

  if (!items.length) return null;

  return (
    <div className="relative group">
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x px-1">
        {items.map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex-shrink-0 w-48 bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-4 cursor-pointer hover:border-[var(--primary)]/40 hover:shadow-[0_8px_20px_-4px_color-mix(in_srgb,var(--primary),transparent_85%)] transition-all snap-start"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-[var(--r-selector)] flex items-center justify-center border ${item._type === "hospital" ? "bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/20" : "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20"}`}>
                {item._type === "hospital" ? <Building2 size={14} aria-hidden="true" /> : <TestTube size={14} aria-hidden="true" />}
              </div>
              <span className="font-poppins text-[9px] font-black uppercase tracking-widest text-[var(--base-content)]/50">{item._type}</span>
            </div>
            <p className="font-montserrat font-black text-sm text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors line-clamp-2">{item.label}</p>
            {item.distanceKm != null && <p className="font-poppins text-[10px] font-bold text-[var(--primary)] mt-1.5 flex items-center gap-1 bg-[var(--primary)]/10 w-fit px-2 py-0.5 rounded"><MapPin size={10} aria-hidden="true" /> {item.distanceKm.toFixed(1)} km away</p>}
          </motion.div>
        ))}
      </div>
      <div className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none bg-gradient-to-l from-[var(--base-100)] to-transparent" aria-hidden="true" />
    </div>
  );
});
NearbyStrip.displayName = "NearbyStrip";

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function SearchPage() {
  const dispatch = useDispatch();

  // ── Redux state ──────────────────────────────────────────────────────────
  const doctors      = useSelector(selectDoctorResults);
  const hospitals    = useSelector(selectHospitalResults);
  const labs         = useSelector(selectLabResults);
  const medicines    = useSelector(selectMedicineResults);
  const global       = useSelector(selectGlobalResults);
  const suggestions  = useSelector(selectSuggestions);
  const acLoading    = useSelector(selectAutocompleteLoading);
  const trending     = useSelector(selectTrending);
  const trendLoading = useSelector(selectTrendingLoading);
  const recent       = useSelector(selectRecentSearches);
  const recentLoading= useSelector(selectRecentLoading);
  const nearbyHosp   = useSelector(selectNearbyHospitals);
  const nearbyLab    = useSelector(selectNearbyLabs);
  const nearbyLoading= useSelector(selectNearbyLoading);
  const specs        = useSelector(selectSpecializations);
  const activeQuery  = useSelector(selectActiveQuery);
  const activeCategory = useSelector(selectActiveCategory);
  const anyLoading   = useSelector(selectAnySearchLoading);

  // ── Local state ──────────────────────────────────────────────────────────
  const [inputValue, setInputValue]   = useState(activeQuery || "");
  const [tab, setTab]                 = useState("all");
  const [filters, setFilters]         = useState({});
  const [pages, setPages]             = useState({ doctor: 1, hospital: 1, lab: 1, medicine: 1 });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef(null);
  const dropRef  = useRef(null);
  const debounced = useDebounce(inputValue, 300);
  const { geo, geoError, request: requestGeo } = useGeo();

  // ── Derived ──────────────────────────────────────────────────────────────
  const geoParams = geo ? { lat: geo.lat, lng: geo.lng } : {};

  // ── On mount: fetch trending, recent, specializations, nearby ────────────
  useEffect(() => {
    dispatch(fetchTrending({ limit: 10 }));
    dispatch(fetchRecentSearches());
    dispatch(fetchSpecializations());
  }, [dispatch]);

  // Fetch nearby when geo available
  useEffect(() => {
    if (geo) {
      dispatch(fetchNearby({ lat: geo.lat, lng: geo.lng, maxKm: 10, types: "hospital,lab", limit: 8 }));
    }
  }, [geo, dispatch]);

  // ── Autocomplete on debounced input ──────────────────────────────────────
  useEffect(() => {
    if (debounced.length >= 2) {
      const cat = tab === "all" ? "all" : tab;
      dispatch(fetchAutocomplete({ q: debounced, category: cat }));
      setShowDropdown(true);
    } else {
      dispatch(clearAutocomplete());
      setShowDropdown(false);
    }
  }, [debounced, tab, dispatch]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Search trigger ────────────────────────────────────────────────────────
  const doSearch = useCallback(
    (q = inputValue, overrideTab = tab, overrideFilters = filters, page = 1) => {
      if (!q.trim()) return;
      setHasSearched(true);
      setShowDropdown(false);
      dispatch(setActiveQuery(q));
      dispatch(setActiveCategory(overrideTab));

      const base = { q, page, limit: 10, ...geoParams };

      if (overrideTab === "all") {
        dispatch(resetGlobalSearch());
        dispatch(searchGlobal({ q, limit: 5, ...geoParams }));
      } else if (overrideTab === "doctor") {
        dispatch(searchDoctors({ ...base, ...overrideFilters }));
      } else if (overrideTab === "hospital") {
        dispatch(searchHospitals({ ...base, ...overrideFilters }));
      } else if (overrideTab === "lab") {
        dispatch(searchLabs({ ...base, ...overrideFilters }));
      } else if (overrideTab === "medicine") {
        dispatch(searchMedicines({ ...base, sort: overrideFilters.sort || "relevance", ...overrideFilters }));
      }
    },
    [inputValue, tab, filters, geoParams, dispatch]
  );

  // Re-search on tab/filter change if already searched
  useEffect(() => {
    if (hasSearched && inputValue.trim()) doSearch(inputValue, tab, filters, pages[tab] || 1);
  }, [tab, filters]); // eslint-disable-line

  // ── Pagination ────────────────────────────────────────────────────────────
  const handlePageChange = (p) => {
    setPages((prev) => ({ ...prev, [tab]: p }));
    doSearch(inputValue, tab, filters, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Suggestion click ──────────────────────────────────────────────────────
  const handleSuggestion = (s) => {
    setInputValue(s.label);
    const cat = ["doctor","hospital","lab","medicine"].includes(s.category) ? s.category : "all";
    setTab(cat);
    doSearch(s.label, cat, {});
  };

  // ── Trending/recent click ─────────────────────────────────────────────────
  const handleQuickSearch = (q, category = "all") => {
    setInputValue(q);
    const t = ["doctor","hospital","lab","medicine"].includes(category) ? category : "all";
    setTab(t);
    doSearch(q, t, {});
  };

  // ── Delete recent ─────────────────────────────────────────────────────────
  const handleDeleteRecent = (q, e) => {
    e.stopPropagation();
    dispatch(removeRecentEntryOptimistic(q));
    dispatch(deleteRecentEntry({ q }));
  };

  // ── Result data by tab ────────────────────────────────────────────────────
  const resultsByTab = { all: null, doctor: doctors, hospital: hospitals, lab: labs, medicine: medicines };
  const current = resultsByTab[tab];
  const currentLoading = tab === "all" ? global.loading : current?.loading;
  const currentData    = tab === "all" ? null : current?.data || [];
  const currentPagination = tab === "all" ? null : current?.pagination;
  const showEmpty = hasSearched && !currentLoading && tab !== "all" && currentData.length === 0;

  // ── Tab icon color ────────────────────────────────────────────────────────
  const activeTabColor = TABS.find((t) => t.key === tab)?.color || "var(--primary)";

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[var(--base-100)] selection:bg-[var(--primary)]/20 selection:text-[var(--primary)]">

      {/* ── Hero search header ─────────────────────────────────────────────── */}
      <div className="relative pt-6 md:pt-10 overflow-hidden" style={{ backgroundImage: "var(--bg-gradient-primary)" }}>
        
        {/* Abstract shapes */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10 bg-white blur-3xl mix-blend-overlay" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-20 bg-white blur-3xl mix-blend-overlay" />
        </div>

        <div className="relative z-40 container-custom py-10 pb-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8">
            <h1 className="font-montserrat font-black text-3xl md:text-4xl lg:text-5xl text-white mb-3 tracking-tight">
              Global Healthcare <span className="text-white/80">Search</span>
            </h1>
            <p className="font-poppins text-white/70 text-sm md:text-base font-medium">Instantly locate doctors, hospitals, diagnostic labs & medicines</p>
          </motion.div>

          {/* Search bar container */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.4 }} ref={dropRef} className="relative w-full flex flex-col md:flex-row gap-3 max-w-4xl mx-auto z-50 px-2 md:px-0">
            
            {/* Go Back */}
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => window.history.back()} className="hidden md:flex w-14 h-[60px] rounded-[var(--r-field)] bg-white/10 hover:bg-white/20 backdrop-blur-md items-center justify-center text-white border border-white/20 transition-colors shadow-lg" aria-label="Go back">
              <ChevronLeft size={24} strokeWidth={2.5} />
            </motion.button>

            {/* Main Input */}
            <div className="flex w-full items-center bg-[var(--base-100)] rounded-[var(--r-box)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.4)] overflow-hidden border-2 border-white/20 focus-within:border-white focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.2)] transition-all h-[60px]">
              <Search size={22} className="ml-5 text-[var(--base-content)]/30 shrink-0" aria-hidden="true" />
              <label htmlFor="global-search" className="sr-only">Search everything</label>
              <input id="global-search" ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} onFocus={() => debounced.length >= 2 && setShowDropdown(true)} placeholder="Search for specialists, facilities, or medications..." className="flex-1 px-4 py-4 bg-transparent outline-none font-poppins text-base font-bold text-[var(--base-content)] placeholder:text-[var(--base-content)]/40 placeholder:font-medium w-full" />
              
              <AnimatePresence>
                {inputValue && (
                  <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => { setInputValue(""); dispatch(clearAutocomplete()); setHasSearched(false); }} className="p-2 mr-1 text-[var(--base-content)]/40 hover:text-[var(--error)] transition-colors" aria-label="Clear search">
                    <X size={18} />
                  </motion.button>
                )}
              </AnimatePresence>

              <div className="w-px h-8 bg-[var(--base-300)] mx-1 hidden sm:block" aria-hidden="true" />

              <button onClick={requestGeo} title={geo ? "Location active" : "Use my location"} className={`p-3 hidden sm:flex transition-colors ${geo ? "text-[var(--success)]" : "text-[var(--base-content)]/40 hover:text-[var(--primary)]"}`} aria-label="Use current location">
                <Navigation size={18} />
              </button>

              <button onClick={() => doSearch()} className="m-2 px-6 sm:px-8 py-0 h-[44px] rounded-[var(--r-field)] font-poppins text-xs font-black uppercase tracking-wider text-white transition-all hover:brightness-110 active:scale-95 shadow-md flex items-center justify-center shrink-0" style={{ background: "var(--primary)" }}>
                Search
              </button>
            </div>

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showDropdown && (suggestions.length > 0 || acLoading) && (
                <motion.div variants={dropdownVariant} initial="hidden" animate="visible" exit="exit" className="absolute top-[70px] left-0 md:left-[68px] right-0 bg-[var(--base-100)] rounded-[var(--r-box)] shadow-[var(--shadow-depth-lg)] border border-[var(--base-300)] overflow-hidden max-h-[320px] overflow-y-auto scrollbar-thin z-[100]">
                  {acLoading && (
                    <div className="flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50 font-poppins bg-[var(--base-200)]/50">
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Analyzing Database...
                    </div>
                  )}
                  {suggestions.map((s, i) => {
                    const tabInfo = TABS.find((t) => t.key === s.category);
                    const Icon = tabInfo?.icon || Search;
                    return (
                      <button key={i} onClick={() => handleSuggestion(s)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[var(--base-200)] transition-colors text-left border-b border-[var(--base-200)] last:border-0 group">
                        <div className="w-9 h-9 rounded-[var(--r-selector)] flex items-center justify-center shrink-0 border transition-colors group-hover:border-[var(--primary)]/30" style={{ background: `${tabInfo?.color || "var(--primary)"}15`, borderColor: `${tabInfo?.color || "var(--primary)"}20` }}>
                          <Icon size={16} style={{ color: tabInfo?.color || "var(--primary)" }} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-poppins text-sm font-black text-[var(--base-content)] truncate">{s.label}</p>
                          {s.sub && <p className="font-poppins text-[10px] font-medium text-[var(--base-content)]/50 truncate mt-0.5 uppercase tracking-wider">{s.sub}</p>}
                        </div>
                        <span className="font-poppins text-[9px] font-bold text-[var(--base-content)]/30 uppercase tracking-widest bg-[var(--base-200)] px-2 py-1 rounded-full group-hover:bg-[var(--base-100)]">{s.category}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Geo status hints */}
          <div className="h-6 mt-3">
            {geoError && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-center text-white/80 font-poppins text-xs font-bold flex items-center justify-center gap-1.5"><AlertCircle size={14} /> Location access denied — searching default zone</motion.p>}
            {geo && !geoError && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-center text-[#10b981] font-poppins text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 drop-shadow-md"><CheckCircle size={14} /> GPS Location Active</motion.p>}
          </div>

          {/* Category Tabs */}
          <div className="flex justify-center gap-2 mt-6 flex-wrap px-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <motion.button key={t.key} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setTab(t.key); setFilters({}); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-poppins text-xs font-black uppercase tracking-wider transition-all duration-300 border-2
                    ${isActive ? "bg-white text-[var(--base-content)] border-white shadow-[0_4px_16px_rgba(0,0,0,0.2)]" : "text-white/80 border-white/20 hover:text-white hover:bg-white/10 hover:border-white/40"}`}
                >
                  <Icon size={14} style={isActive ? { color: t.color } : {}} aria-hidden="true" />
                  {t.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="container-custom z-10 py-10">

        {/* ── Pre-search state (Exploration) ────────────────────────────── */}
        {!hasSearched && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-12">
            
            {/* Nearby */}
            {(nearbyLoading || nearbyHosp.length > 0 || nearbyLab.length > 0) && (
              <motion.section variants={fadeUp}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-montserrat font-black text-xl text-[var(--base-content)] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[var(--r-selector)] bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20"><Navigation size={16} /></div>
                    {geo ? "Facilities Near You" : "Facilities in Default Zone"}
                  </h2>
                  {!geo && (
                    <button onClick={requestGeo} className="font-poppins text-xs font-black text-[var(--primary)] uppercase tracking-wider hover:underline flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)]/5 rounded-full">
                      <Wifi size={12} /> Activate GPS
                    </button>
                  )}
                </div>
                <NearbyStrip hospitals={nearbyHosp} labs={nearbyLab} loading={nearbyLoading} />
              </motion.section>
            )}

            {/* Trending */}
            <motion.section variants={fadeUp}>
              <h2 className="font-montserrat font-black text-xl text-[var(--base-content)] flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-[var(--r-selector)] bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20"><TrendingUp size={16} /></div>
                Trending Searches
              </h2>
              {trendLoading ? (
                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-9 rounded-full" style={{ width: `${80 + i * 20}px` }} />)}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {trending.map((t, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                      <Chip onClick={() => handleQuickSearch(t.query, t.category)}>
                        <TrendingUp size={12} className="text-[var(--accent)]" aria-hidden="true" />
                        {t.query}
                        <span className="bg-[var(--base-300)] text-[var(--base-content)]/60 px-1.5 py-0.5 rounded text-[9px] ml-1">{t.searchCount}</span>
                      </Chip>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Specializations */}
              {specs.length > 0 && (
                <motion.section variants={fadeUp}>
                  <h2 className="font-montserrat font-black text-xl text-[var(--base-content)] flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-[var(--r-selector)] bg-[var(--info)]/10 text-[var(--info)] flex items-center justify-center border border-[var(--info)]/20"><Stethoscope size={16} /></div>
                    Browse Specialists
                  </h2>
                  <div className="flex flex-wrap gap-2.5">
                    {specs.slice(0, 16).map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                        <Chip onClick={() => { setTab("doctor"); setFilters({ specialization: s.specialization }); doSearch("", "doctor", { specialization: s.specialization }); setInputValue(s.specialization); }}>
                          <UserCheck size={12} className="text-[var(--info)]" aria-hidden="true" />
                          {s.specialization}
                          <span className="bg-[var(--base-300)] text-[var(--base-content)]/60 px-1.5 py-0.5 rounded text-[9px] ml-1">{s.doctorCount}</span>
                        </Chip>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Recent */}
              {recent.length > 0 && (
                <motion.section variants={fadeUp}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-montserrat font-black text-xl text-[var(--base-content)] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[var(--r-selector)] bg-[var(--success)]/10 text-[var(--success)] flex items-center justify-center border border-[var(--success)]/20"><Clock size={16} /></div>
                      Recent History
                    </h2>
                    <button onClick={() => dispatch(clearRecentSearches())} disabled={recentLoading} className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--error)] hover:underline flex items-center gap-1.5 px-3 py-1.5 bg-[var(--error)]/5 rounded-full transition-colors">
                      <Trash2 size={12} aria-hidden="true" /> Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {recent.map((r, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-2 bg-[var(--base-100)] border border-[var(--base-300)] rounded-full pl-4 pr-1 py-1 shadow-sm hover:border-[var(--primary)] transition-colors group">
                        <button onClick={() => handleQuickSearch(r.query, r.category)} className="font-poppins text-xs font-bold text-[var(--base-content)]/80 group-hover:text-[var(--primary)] transition-colors flex items-center gap-2">
                          <Clock size={12} className="text-[var(--base-content)]/30" aria-hidden="true" />
                          {r.query}
                          <span className="text-[9px] uppercase tracking-widest bg-[var(--base-200)] px-1.5 py-0.5 rounded text-[var(--base-content)]/40 ml-1">{r.category}</span>
                        </button>
                        <button onClick={(e) => handleDeleteRecent(r.query, e)} aria-label={`Delete ${r.query} from history`} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--error)]/10 transition-colors text-[var(--base-content)]/30 hover:text-[var(--error)]">
                          <X size={12} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </div>

          </motion.div>
        )}

        {/* ── Post-search results ────────────────────────────────────────── */}
        {hasSearched && (
          <div className="flex flex-col lg:flex-row gap-8">

            {/* Filter sidebar (desktop) */}
            <AnimatePresence>
              {(showFilters || true) && tab !== "all" && (
                <aside className="hidden lg:block w-64 shrink-0">
                  <FilterPanel tab={tab} filters={filters} setFilters={setFilters} specializations={specs} />
                </aside>
              )}
            </AnimatePresence>

            {/* Results Area */}
            <div className="flex-1 min-w-0">

              {/* Results header / Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 bg-[var(--base-100)] border border-[var(--base-300)] p-4 rounded-[var(--r-box)] shadow-sm">
                <div>
                  <h2 className="font-montserrat font-black text-xl text-[var(--base-content)] tracking-tight">
                    {tab === "all" ? "Global Search Results" : `${TABS.find((t) => t.key === tab)?.label} Directory`}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {inputValue && <span className="font-poppins text-xs font-bold text-[var(--base-content)]/50 uppercase tracking-widest bg-[var(--base-200)] px-2 py-0.5 rounded">"{inputValue}"</span>}
                    {tab !== "all" && current?.pagination?.total != null && <span className="font-poppins text-xs font-bold text-[var(--primary)] uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--primary)]/10">{current.pagination.total} Matches</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Mobile filter toggle */}
                  {tab !== "all" && (
                    <button onClick={() => setShowFilters((v) => !v)} className="lg:hidden btn-secondary text-xs px-4 py-2 font-poppins uppercase tracking-wider flex items-center gap-2">
                      <Filter size={14} aria-hidden="true" /> Filters
                    </button>
                  )}
                  {/* Loading indicator */}
                  {(currentLoading || anyLoading) && (
                    <div className="flex items-center gap-2 font-poppins text-xs font-black uppercase tracking-widest text-[var(--base-content)]/50 bg-[var(--base-200)] px-4 py-2 rounded-[var(--r-field)]">
                      <Loader2 size={14} className="animate-spin text-[var(--primary)]" aria-hidden="true" /> Scanning...
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile filters inline dropdown */}
              <AnimatePresence>
                {showFilters && tab !== "all" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="lg:hidden mb-6 overflow-hidden">
                    <FilterPanel tab={tab} filters={filters} setFilters={setFilters} specializations={specs} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Loading Animated Creature ──────────────────────────── */}
              {currentLoading && (
                <div className="py-20 flex flex-col items-center">
                  <PulseRadar />
                  <p className="font-poppins text-sm font-bold text-[var(--base-content)]/50 uppercase tracking-widest mt-4">Running Deep Scan</p>
                </div>
              )}

              {/* ── Empty State Animated Creature ──────────────────────── */}
              {showEmpty && <EmptyState query={inputValue} />}

              {/* ── Global (All tab) ───────────────────────────────────── */}
              {tab === "all" && !global.loading && hasSearched && (
                <AnimatePresence mode="wait">
                  <motion.div key="global" variants={fadeUp} initial="hidden" animate="visible" className="space-y-10">
                    
                    {global.doctors.length === 0 && global.hospitals.length === 0 && global.labs.length === 0 && global.medicines.length === 0 && (
                      <EmptyState query={inputValue} />
                    )}

                    <GlobalSection title="Top Specialists" icon={Stethoscope} color="var(--info)" count={global.doctors.length}>
                      {global.doctors.map((d, i) => <DoctorCard key={i} doc={d} />)}
                    </GlobalSection>

                    <GlobalSection title="Verified Hospitals" icon={Building2} color="#8b5cf6" count={global.hospitals.length}>
                      {global.hospitals.map((h, i) => <HospitalCard key={i} hosp={h} />)}
                    </GlobalSection>

                    <GlobalSection title="Diagnostic Centers" icon={FlaskConical} color="var(--success)" count={global.labs.length}>
                      {global.labs.map((l, i) => <LabCard key={i} lab={l} />)}
                    </GlobalSection>

                    <GlobalSection title="Pharmacy & Medicines" icon={Pill} color="var(--warning)" count={global.medicines.length}>
                      {global.medicines.map((m, i) => <MedicineCard key={i} med={m} />)}
                    </GlobalSection>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Entity results ──────────────────────────────────────── */}
              {tab !== "all" && !currentLoading && currentData.length > 0 && (
                <AnimatePresence mode="wait">
                  <motion.div key={`${tab}-${pages[tab]}`} variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tab === "doctor"   && currentData.map((d, i) => <DoctorCard   key={i} doc={d}  />)}
                    {tab === "hospital" && currentData.map((h, i) => <HospitalCard key={i} hosp={h} />)}
                    {tab === "lab"      && currentData.map((l, i) => <LabCard      key={i} lab={l}  />)}
                    {tab === "medicine" && currentData.map((m, i) => <MedicineCard key={i} med={m}  />)}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Pagination ──────────────────────────────────────────── */}
              {tab !== "all" && <Pagination pagination={currentPagination} onPageChange={handlePageChange} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}