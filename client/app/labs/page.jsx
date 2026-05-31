"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  FlaskConical, Search, MapPin, Star, Home, Filter,
  ChevronDown, X, Shield, ArrowRight, Microscope,
  TestTube, CheckCircle, SlidersHorizontal, Sparkles,
  ChevronRight, Grid3X3, List, Loader2,
  Building2, HeartPulse, Zap, TrendingUp, Award, Beaker,Activity
} from "lucide-react";
import Link from "next/link";

// Note: Ensure your Redux slice is correctly mapped
import {
  fetchPublicLabs,
  fetchFeaturedLabs,
  searchLabsAsCustomer,
  selectPublicLabs,
  selectFeaturedLabs,
  selectPublicPagination,
  selectLabLoading,
  selectLabError,
  selectCustomerSearchResults,
} from "@/store/slices/labSlice";
import Banner from "../../components/Banner";
import Container from "../../components/ui/Container";

// ─── Constants ─────────────────────────────────────────────────────────────

const LAB_TYPES = [
  "Diagnostic Lab", "Pathology Lab", "Radiology Center",
  "Microbiology Lab", "Biochemistry Lab", "Genetic Testing Lab",
  "Molecular Lab", "Immunology Lab", "Multi-Specialty Lab",
];

const SORT_OPTIONS = [
  { value: "averageRating", label: "Top Rated" },
  { value: "totalReviews",  label: "Most Reviewed" },
  { value: "createdAt",     label: "Newest" },
];

const COLLECTION_MODES = ["Walk-in", "Home Collection", "Both"];

// ─── Animated Creature: LabScout (The Analytical Drone) ────────────────────

const LabScout = ({ isSearching = false }) => {
  return (
    <div className="relative w-64 h-64 mx-auto z-10 pointer-events-none select-none" aria-hidden="true">
      {/* Ambient Diagnostic Glow */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 m-auto w-40 h-40 rounded-full bg-primary/20 blur-[30px]"
      />

      <motion.div
        animate={isSearching ? { y: [-4, 4, -4], x: [-10, 10, -10] } : { y: [-10, 10, -10] }}
        transition={isSearching ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="w-full h-full relative"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
          
          {/* Scanning Beam (Active when searching) */}
          <motion.path
            d="M100 130 L40 220 L160 220 Z"
            fill="url(#scan-beam)"
            animate={isSearching ? { opacity: [0, 0.6, 0], scaleX: [0.8, 1.3, 0.8] } : { opacity: [0, 0.3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: 'top center' }}
          />

          {/* Orbiting Molecular Ring */}
          <motion.g
            animate={{ rotateZ: 360, rotateX: [0, 20, 0, -20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: '100px 100px' }}
          >
            <ellipse cx="100" cy="100" rx="80" ry="25" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 8" opacity="0.4" />
            <circle cx="20" cy="100" r="4" fill="var(--accent)" />
            <circle cx="180" cy="100" r="6" fill="var(--secondary)" />
            <circle cx="100" cy="125" r="3" fill="var(--primary)" />
          </motion.g>

          {/* Main Chassis */}
          <path d="M60 100 C60 60, 140 60, 140 100 C140 130, 120 150, 100 150 C80 150, 60 130, 60 100 Z" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="3" />
          
          {/* Top Sensor Dome */}
          <path d="M75 60 C75 40, 125 40, 125 60 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="3" />
          <motion.circle 
            cx="100" cy="45" r="4" fill="var(--error)"
            animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Visor / Lens Area */}
          <rect x="70" y="80" width="60" height="35" rx="17.5" fill="var(--neutral)" />

          {/* The Glowing Eye / Scanner */}
          <motion.g
            animate={isSearching ? { x: [-12, 12, -12] } : { x: [-2, 2, -2] }}
            transition={isSearching ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Blinking Logic inside scanning */}
            <motion.g animate={!isSearching ? { scaleY: [1, 1, 0.1, 1, 1] } : {}} transition={{ duration: 5, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }} style={{ transformOrigin: 'center' }}>
              <circle cx="100" cy="97.5" r="10" fill="var(--primary)" />
              <circle cx="100" cy="97.5" r="4" fill="white" />
            </motion.g>
          </motion.g>

          {/* Side Thrusters */}
          <path d="M50 90 L60 85 L60 115 L50 110 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="2" />
          <path d="M150 90 L140 85 L140 115 L150 110 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="2" />

          {/* Floating Data Particles */}
          <motion.path d="M140 50 h5 v5 h-5 z" fill="var(--accent)" animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
          <motion.path d="M50 130 h4 v4 h-4 z" fill="var(--primary)" animate={{ y: [0, -15, 0], opacity: [0, 1, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 }} />

          <defs>
            <linearGradient id="scan-beam" x1="100" y1="130" x2="100" y2="220" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const StarRow = memo(({ rating = 0, total = 0 }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={11}
          className={i <= Math.round(rating)
            ? "fill-[var(--warning)] text-[var(--warning)]"
            : "fill-[var(--base-300)] text-[var(--base-300)]"}
          aria-hidden="true"
        />
      ))}
    </div>
    <span className="text-xs font-black text-[var(--base-content)] font-poppins">{rating?.toFixed(1)}</span>
    <span className="text-[10px] font-medium text-[var(--base-content)]/50 font-poppins">({total})</span>
  </div>
));
StarRow.displayName = "StarRow";

const ModeBadge = memo(({ mode }) => {
  const cfg = {
    "Walk-in":         { cls: "text-[var(--info)] bg-[color-mix(in_srgb,var(--info),transparent_88%)]",       icon: Building2 },
    "Home Collection": { cls: "text-[var(--success)] bg-[color-mix(in_srgb,var(--success),transparent_88%)]", icon: Home },
    "Both":            { cls: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent),transparent_88%)]",   icon: CheckCircle },
  }[mode] ?? { cls: "text-[var(--base-content)]/60 bg-[var(--base-200)]", icon: Building2 };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-selector)] text-[10px] font-bold font-poppins uppercase tracking-wider ${cfg.cls}`}>
      <Icon size={10} aria-hidden="true" /> {mode}
    </span>
  );
});
ModeBadge.displayName = "ModeBadge";

const SkeletonCard = memo(() => (
  <div className="rounded-[var(--r-box)] overflow-hidden border border-[var(--base-300)] animate-pulse bg-[var(--base-100)] shadow-sm">
    <div className="h-28 bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10" />
    <div className="p-5 space-y-4">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--base-300)] shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 bg-[var(--base-300)] rounded-full w-3/4" />
          <div className="h-2 bg-[var(--base-300)] rounded-full w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-[var(--base-300)] rounded-full w-2/3" />
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-[var(--base-300)] rounded-md" />
        <div className="h-5 w-16 bg-[var(--base-300)] rounded-md" />
      </div>
    </div>
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

// ─── LabCard ────────────────────────────────────────────────────────────────

const LabCard = memo(({ lab, index, isCustomer }) => {
  const href = isCustomer ? `/labs/customer/${lab._id}` : `/labs/${lab._id}`;
  const isTopRated = (lab.averageRating ?? 0) >= 4.5;
  const isNabl = lab.isVerified;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full flex"
    >
      <Link href={href} className="w-full block outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-[var(--r-box)]">
        <div className="relative h-full flex flex-col rounded-[var(--r-box)] overflow-hidden border border-[var(--base-300)] bg-[var(--base-100)] transition-all duration-300 hover:border-[var(--primary)]/50 hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--primary),transparent_85%)] hover:-translate-y-1">

          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--primary)] via-[var(--secondary)] to-[var(--accent)]" />

          {/* Cover with overlay */}
          <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[var(--primary)]/10 via-[var(--secondary)]/5 to-[var(--base-200)] shrink-0">
            {lab.coverImageUrl ? (
              <img src={lab.coverImageUrl} alt="" className="w-full h-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-110" loading="lazy" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[var(--primary)]/5" />
                <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-[var(--secondary)]/10" />
                <FlaskConical size={28} className="text-[var(--primary)]/30 relative z-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />

            {/* Badges row */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
              {lab.isFeatured && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-selector)] bg-[var(--accent)]/95 text-[var(--accent-content)] text-[9px] font-black backdrop-blur-md shadow-sm uppercase tracking-wider">
                  <Sparkles size={10} aria-hidden="true" /> Featured
                </span>
              )}
              {!lab.isFeatured && <span />}
              {isNabl && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-selector)] bg-[var(--success)]/95 text-[var(--success-content)] text-[9px] font-black backdrop-blur-md shadow-sm uppercase tracking-wider">
                  <Shield size={10} aria-hidden="true" /> NABL
                </span>
              )}
            </div>

            {/* Top rated ribbon */}
            {isTopRated && !isNabl && (
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-selector)] bg-[var(--warning)]/95 text-[var(--warning-content)] text-[9px] font-black backdrop-blur-md shadow-sm uppercase tracking-wider">
                <Award size={10} aria-hidden="true" /> Top Rated
              </div>
            )}
          </div>

          <div className="p-5 flex flex-col flex-1 gap-3">
            {/* Logo + Name */}
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 -mt-8 shadow-sm">
                <div className="w-14 h-14 rounded-xl overflow-hidden border-[3px] border-[var(--base-100)] bg-[var(--base-200)] flex items-center justify-center relative z-10">
                  {lab.logoUrl
                    ? <img src={lab.logoUrl} alt={`${lab.labName} logo`} className="w-full h-full object-cover" loading="lazy" />
                    : <Microscope size={22} className="text-[var(--primary)]" aria-hidden="true" />
                  }
                </div>
                {isNabl && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--success)] flex items-center justify-center border-2 border-[var(--base-100)] z-20">
                    <Shield size={9} className="text-[var(--success-content)]" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="font-montserrat font-black text-sm text-[var(--base-content)] truncate leading-tight group-hover:text-[var(--primary)] transition-colors duration-200">
                  {lab.labName}
                </h3>
                <p className="font-poppins text-[10px] font-medium text-[var(--base-content)]/50 mt-1 truncate uppercase tracking-widest">{lab.labType}</p>
              </div>
            </div>

            {/* Rating */}
            <StarRow rating={lab.averageRating} total={lab.totalReviews} />

            {/* Location */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} className="text-[var(--error)] flex-shrink-0" aria-hidden="true" />
              <span className="font-poppins text-xs font-medium text-[var(--base-content)]/60 truncate">{lab.registeredAddress?.city}, {lab.registeredAddress?.state}</span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-1">
              <ModeBadge mode={lab.sampleCollectionMode} />
              {(lab.homeCollectionRadius ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-selector)] text-[10px] font-bold font-poppins uppercase tracking-wider text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary),transparent_90%)]">
                  <Home size={10} aria-hidden="true" /> {lab.homeCollectionRadius}km
                </span>
              )}
              {lab.avgTurnaroundHours && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-selector)] text-[10px] font-bold font-poppins uppercase tracking-wider text-[var(--base-content)]/60 bg-[var(--base-200)]">
                  <Zap size={10} aria-hidden="true" /> {lab.avgTurnaroundHours}h
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--base-200)] mt-auto">
              <span className="font-poppins text-[10px] font-medium text-[var(--base-content)]/40 truncate pr-2 uppercase tracking-widest">
                {(lab.tags ?? []).slice(0, 2).join(" · ")}
              </span>
              <span className="flex items-center gap-1 text-xs font-black font-poppins uppercase tracking-wider text-[var(--primary)] flex-shrink-0 group-hover:gap-2 transition-all duration-200">
                View <ArrowRight size={14} aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
LabCard.displayName = "LabCard";

// ─── FeaturedCard ───────────────────────────────────────────────────────────

const FeaturedCard = memo(({ lab, index, isCustomer }) => {
  const href = isCustomer ? `/labs/customer/${lab._id}` : `/labs/${lab._id}`;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex-shrink-0 w-[300px]"
    >
      <Link href={href} className="block group outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-[var(--r-box)]">
        <div className="relative overflow-hidden rounded-[var(--r-box)] border border-[var(--primary)]/20  p-5 transition-all duration-300 bg-primary/70   hover:-translate-y-1">
          {/* Overlay to soften the gradient slightly */}
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none" />
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 pointer-events-none blur-2xl" />

          {/* Top: logo + name */}
          <div className="flex items-center gap-3.5 mb-4 relative z-10">
            <div className="w-14 h-14 rounded-[var(--r-field)] overflow-hidden border-2 border-white/30 bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-sm">
              {lab.logoUrl
                ? <img src={lab.logoUrl} alt="" className="w-full h-full object-cover" />
                : <Beaker size={24} className="text-white" aria-hidden="true" />
              }
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="font-montserrat font-black text-white text-[15px] truncate leading-snug">{lab.labName}</p>
              <p className="font-poppins text-[10px] font-medium text-white/70 uppercase tracking-widest mt-0.5 truncate">{lab.labType}</p>
            </div>
            {lab.isVerified && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                <Shield size={14} className="text-white" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="relative z-10 flex items-center gap-1.5 text-white mb-3">
             <div className="flex gap-0.5">
               {[1, 2, 3, 4, 5].map((i) => (
                 <Star key={i} size={11} className={i <= Math.round(lab.averageRating) ? "fill-warning text-warning" : "fill-white/20 text-white/20"} aria-hidden="true" />
               ))}
             </div>
             <span className="text-xs font-black font-poppins">{lab.averageRating?.toFixed(1)}</span>
          </div>

          <div className="relative z-10 flex items-center gap-1.5 text-xs text-white/80 font-medium font-poppins">
            <MapPin size={12} className="text-white shrink-0" aria-hidden="true" />
            <span className="truncate">{lab.registeredAddress?.city}</span>
          </div>

          {/* Bottom tags */}
          <div className="relative z-10 flex items-center justify-between mt-4 pt-4 border-t border-white/20">
            <ModeBadge mode={lab.sampleCollectionMode} />
            <span className="text-[10px] font-black font-poppins uppercase tracking-wider text-white flex items-center gap-1 group-hover:gap-2 transition-all">
              View <ArrowRight size={12} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
FeaturedCard.displayName = "FeaturedCard";

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LabsPage() {
  const dispatch = useDispatch();
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 300], [0, 50]);

  const publicLabs      = useSelector(selectPublicLabs);
  const featuredLabs    = useSelector(selectFeaturedLabs);
  const pagination      = useSelector(selectPublicPagination);
  const loading         = useSelector(selectLabLoading);
  const error           = useSelector(selectLabError);
  const customerResults = useSelector(selectCustomerSearchResults);
  const user            = useSelector((s) => s.user?.user) ?? null;
  const isCustomer      = user?.role === "customer";

  const [search,          setSearch]          = useState("");
  const [labType,         setLabType]         = useState("");
  const [sortBy,          setSortBy]          = useState("averageRating");
  const [collectionMode,  setCollectionMode]  = useState("");
  const [city,            setCity]            = useState("");
  const [page,            setPage]            = useState(1);
  const [viewMode,        setViewMode]        = useState("grid");
  const [showFilter,      setShowFilter]      = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 380);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => { dispatch(fetchFeaturedLabs()); }, [dispatch]);

  useEffect(() => {
    if (isCustomer && debouncedSearch) {
      dispatch(searchLabsAsCustomer({ testName: debouncedSearch, city }));
    } else {
      dispatch(fetchPublicLabs({
        page, limit: 12,
        ...(labType        && { labType }),
        ...(collectionMode && { sampleCollectionMode: collectionMode }),
        ...(city           && { city }),
        ...(debouncedSearch && { search: debouncedSearch }),
        sortBy,
        sortOrder: "desc",
      }));
    }
  }, [dispatch, page, labType, collectionMode, city, debouncedSearch, sortBy, isCustomer]);

  const displayedLabs = isCustomer && debouncedSearch ? customerResults : publicLabs;
  const activeFilters = [labType, collectionMode, city].filter(Boolean).length;

  const clearFilters = () => {
    setLabType(""); setCollectionMode(""); setCity(""); setSearch(""); setPage(1);
  };

  return (
    <div data-theme="lab" className="min-h-screen bg-[var(--base-100)] selection:bg-[var(--primary)]/20 selection:text-[var(--primary)]">
      <Container className="mt-4 pb-20">
        <Banner position="Lab_Page" />

        {/* ═══ HERO ══════════════════════════════════════════════════════ */}
        <div className="relative mb-12 rounded-[var(--r-box)] mt-4 overflow-hidden border border-[var(--primary)]/15 bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)_8%,var(--base-100))] via-[var(--base-100)] to-[color-mix(in_srgb,var(--secondary)_8%,var(--base-100))]">
          
          {/* Background pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 2L56 17v26L30 58 4 43V17z' fill='none' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }} 
            aria-hidden="true"
          />

          <motion.div style={{ y: heroParallax }} className="relative z-10 px-6 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center max-w-6xl mx-auto">
              
              {/* Left Content */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="text-center lg:text-left"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 mb-6"
                >
                  <Activity size={12} className="text-[var(--primary)] animate-pulse" aria-hidden="true" />
                  <span className="font-poppins text-[10px] font-black text-[var(--primary)] tracking-widest uppercase">
                    {isCustomer ? `Welcome back, ${user?.name?.split(" ")[0]}` : "Diagnostic Network"}
                  </span>
                </motion.div>

                <h1 className="font-montserrat font-black leading-[1.1] mb-5">
                  <span className="block text-4xl sm:text-5xl lg:text-[4rem] text-[var(--base-content)] mb-1">
                    Find the Right
                  </span>
                  <span className="block text-4xl sm:text-5xl lg:text-[4rem] text-gradient-primary">
                    Lab Near You
                  </span>
                </h1>

                <p className="font-poppins text-sm sm:text-base text-[var(--base-content)]/60 max-w-md mx-auto lg:mx-0 leading-relaxed mb-8 font-medium">
                  {isCustomer
                    ? "Search by test name, browse NABL-certified labs, and book home sample collections instantly."
                    : "Access NABL-accredited labs with digital reports, home collections, and highly trusted diagnostic results."}
                </p>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="inline-flex flex-wrap justify-center lg:justify-start items-center gap-4 sm:gap-6 mb-8 lg:mb-0"
                >
                  {[
                    { val: "500+",   label: "Labs",    icon: FlaskConical },
                    { val: "2000+",  label: "Tests",   icon: TestTube },
                    { val: "80+",    label: "Cities",  icon: MapPin },
                  ].map(({ val, label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[var(--r-field)] bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shadow-sm">
                        <Icon size={18} aria-hidden="true" />
                      </div>
                      <div className="text-left">
                        <div className="font-montserrat text-lg font-black text-[var(--base-content)] leading-none mb-1">{val}</div>
                        <div className="font-poppins text-[10px] text-[var(--base-content)]/50 uppercase tracking-widest font-bold">{label}</div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right Content: LabScout Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block"
              >
                <LabScout />
              </motion.div>

            </div>

            {/* ── Search bar ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="max-w-3xl mx-auto lg:mx-0 mt-8 relative z-20"
            >
              <div className="flex flex-col sm:flex-row items-center gap-3 p-2 rounded-[var(--r-box)] border border-[var(--primary)]/30 bg-[var(--base-100)]/90 backdrop-blur-xl shadow-[0_12px_40px_color-mix(in_srgb,var(--primary),transparent_85%)] focus-within:border-[var(--primary)] transition-all duration-300">
                <div className="flex-1 flex items-center gap-3 px-4 w-full">
                  <Search size={20} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
                  <label htmlFor="lab-search" className="sr-only">Search labs and tests</label>
                  <input
                    id="lab-search"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder={isCustomer ? "Search by test name, lab, or city…" : "Search accredited labs, tests, cities…"}
                    className="flex-1 bg-transparent text-sm font-bold font-poppins outline-none text-[var(--base-content)] placeholder:text-[var(--base-content)]/40 py-3 w-full"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="text-[var(--base-content)]/40 hover:text-[var(--error)] transition-colors p-1" aria-label="Clear search">
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  aria-expanded={showFilter}
                  className={`w-full sm:w-auto relative flex items-center justify-center gap-2 px-6 py-3 rounded-[var(--r-field)] font-poppins text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                    showFilter || activeFilters > 0
                      ? "btn-primary"
                      : "bg-[var(--base-200)] text-[var(--base-content)]/70 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                  }`}
                >
                  <SlidersHorizontal size={14} aria-hidden="true" />
                  <span>Filters</span>
                  {activeFilters > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-content)] text-[10px] shadow-sm flex items-center justify-center" aria-label={`${activeFilters} active filters`}>
                      {activeFilters}
                    </span>
                  )}
                </button>
              </div>

              {/* Filter panel */}
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 mt-3 p-6 rounded-[var(--r-box)] bg-[var(--base-100)] border border-[var(--base-300)] shadow-[var(--shadow-depth-lg)] z-50"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {[
                        { label: "Lab Type", el: (
                          <select value={labType} onChange={(e) => { setLabType(e.target.value); setPage(1); }} className="input-field w-full text-sm font-poppins font-medium">
                            <option value="">All Types</option>
                            {LAB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        )},
                        { label: "Collection Mode", el: (
                          <select value={collectionMode} onChange={(e) => { setCollectionMode(e.target.value); setPage(1); }} className="input-field w-full text-sm font-poppins font-medium">
                            <option value="">Any Mode</option>
                            {COLLECTION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        )},
                        { label: "City Location", el: (
                          <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder="e.g. Hyderabad" className="input-field w-full text-sm font-poppins font-medium" />
                        )},
                      ].map(({ label, el }) => (
                        <div key={label}>
                          <label className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-2 block">{label}</label>
                          {el}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--base-200)]">
                      <button onClick={clearFilters} className="text-[11px] font-poppins text-[var(--error)] font-black uppercase tracking-wider hover:underline flex items-center gap-1.5 px-2">
                        <X size={12} aria-hidden="true" /> Clear filters
                      </button>
                      <button onClick={() => setShowFilter(false)} className="btn-primary-cta text-xs px-8">Apply Filters</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </div>

        {/* ═══ TRUST STRIP ══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-x-8 gap-y-4 mb-10 flex-wrap px-4"
        >
          {[
            { icon: Shield,     label: "NABL Certified",   color: "var(--success)" },
            { icon: Zap,        label: "Reports in Hours", color: "var(--warning)" },
            { icon: Home,       label: "Home Collection",  color: "var(--primary)" },
            { icon: HeartPulse, label: "Expert Pathology", color: "var(--error)"   },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                <Icon size={14} style={{ color }} aria-hidden="true" />
              </div>
              <span className="font-poppins text-[11px] font-black text-[var(--base-content)]/70 uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ═══ FEATURED STRIP ═══════════════════════════════════════════ */}
        {featuredLabs.length > 0 && !debouncedSearch && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 rounded-full" style={{ backgroundImage: "var(--bg-gradient-primary)" }} aria-hidden="true" />
                <div>
                  <h2 className="font-montserrat font-black text-xl text-[var(--base-content)] tracking-tight">Featured Labs</h2>
                  <p className="font-poppins text-xs font-medium text-[var(--base-content)]/50 mt-0.5">Verified & top-rated partners near you</p>
                </div>
              </div>
              <Link href={isCustomer ? "/labs/customer" : "/labs/featured"}
                className="font-poppins flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[var(--primary)] hover:gap-2.5 transition-all duration-200">
                See all <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="relative group">
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none snap-x snap-mandatory">
                {featuredLabs.map((lab, i) => (
                  <div key={lab._id} className="snap-start pt-1">
                    <FeaturedCard lab={lab} index={i} isCustomer={isCustomer} />
                  </div>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-4 w-24 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(90deg, transparent, var(--base-100))" }} aria-hidden="true" />
            </div>
          </section>
        )}

        {/* ═══ TOOLBAR ══════════════════════════════════════════════════ */}
        <div className="sticky top-[70px] md:top-[80px] z-40 -mx-4 px-4 py-3.5 mb-8 transition-colors duration-300 backdrop-blur-xl bg-[var(--base-100)]/80 border-y border-[var(--base-300)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

            {/* Left: count + clear */}
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="flex items-center gap-2.5 px-2">
                  <Loader2 size={16} className="animate-spin text-[var(--primary)]" aria-hidden="true" />
                  <span className="font-poppins text-xs font-medium text-[var(--base-content)]/60">Fetching labs…</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1.5 px-2">
                  <span className="font-montserrat text-xl font-black text-[var(--base-content)] leading-none">
                    {pagination?.total ?? displayedLabs.length}
                  </span>
                  <span className="font-poppins text-xs font-bold uppercase tracking-widest text-[var(--base-content)]/50">labs found</span>
                </div>
              )}
              {activeFilters > 0 && (
                <button onClick={clearFilters}
                  className="font-poppins flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors hover:brightness-110 ml-2"
                  style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}>
                  <X size={10} aria-hidden="true" /> Clear Filters
                </button>
              )}
            </div>

            {/* Right: sort + view toggle */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <label htmlFor="sort-labs" className="sr-only">Sort labs</label>
                <select
                  id="sort-labs"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none w-full pl-4 pr-9 py-2.5 rounded-[var(--r-field)] font-poppins text-xs font-black uppercase tracking-wider border-2 border-[var(--base-300)] bg-[var(--base-100)] text-[var(--base-content)] outline-none cursor-pointer focus-visible:border-[var(--primary)]"
                >
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/50 pointer-events-none" aria-hidden="true" />
              </div>

              <div className="flex items-center rounded-[var(--r-field)] border-2 border-[var(--base-300)] overflow-hidden p-0.5 bg-[var(--base-200)] shrink-0" role="group" aria-label="View layout">
                {([{ v: "grid", Icon: Grid3X3, label: "Grid View" }, { v: "list", Icon: List, label: "List View" }]).map(({ v, Icon, label }) => (
                  <button key={v} onClick={() => setViewMode(v)} aria-label={label} aria-pressed={viewMode === v}
                    className="p-2 rounded-[var(--r-selector)] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={viewMode === v
                      ? { background: "var(--primary)", color: "var(--primary-content)", boxShadow: "0 2px 8px color-mix(in srgb, var(--primary), transparent 50%)" }
                      : { background: "transparent", color: "var(--base-content)", opacity: 0.5 }
                    }>
                    <Icon size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ LABS GRID ════════════════════════════════════════════════ */}
        <section>
          <AnimatePresence mode="wait">
            {loading && displayedLabs.length === 0 ? (
              <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                  : "flex flex-col gap-4"}>
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </motion.div>

            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center text-center py-24 px-4 border-2 border-dashed border-[var(--base-300)] rounded-[var(--r-box)] bg-[var(--base-200)]/30">
                <div className="w-16 h-16 rounded-[var(--r-field)] flex items-center justify-center mb-5 shadow-sm"
                  style={{ background: "color-mix(in srgb, var(--error) 12%, transparent)" }}>
                  <X size={28} className="text-[var(--error)]" aria-hidden="true" />
                </div>
                <h3 className="font-montserrat font-black text-xl text-[var(--base-content)] mb-2">Connection Interrupted</h3>
                <p className="font-poppins text-sm text-[var(--base-content)]/60 max-w-md">{error}</p>
                <button onClick={() => dispatch(fetchPublicLabs({}))} className="btn-secondary mt-6 font-poppins uppercase tracking-wider">Retry Request</button>
              </motion.div>

            ) : displayedLabs.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-20 px-4 border-2 border-dashed border-[var(--base-300)] rounded-[var(--r-box)] bg-[var(--base-200)]/30">
                
                {/* Searching LabScout */}
                <LabScout isSearching={true} />

                <h3 className="font-montserrat font-black text-2xl text-[var(--base-content)] mt-4 mb-2 tracking-tight">No labs detected</h3>
                <p className="font-poppins text-sm font-medium text-[var(--base-content)]/50 max-w-md leading-relaxed">
                  Our scanners couldn't find any results matching your current filters or location. Try adjusting your parameters.
                </p>
                <button onClick={clearFilters} className="btn-primary-cta mt-6 px-8">Reset Scanners</button>
              </motion.div>

            ) : (
              <motion.div key="labs"
                className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                  : "flex flex-col gap-4"}>
                {displayedLabs.map((lab, i) => (
                  <LabCard key={lab._id} lab={lab} index={i} isCustomer={isCustomer} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && !debouncedSearch && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-wrap items-center justify-center gap-2.5 mt-14" aria-label="Pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-5 py-2.5 rounded-[var(--r-field)] border-2 text-xs font-black font-poppins uppercase tracking-wider text-[var(--base-content)] disabled:opacity-30 disabled:hover:border-[var(--base-300)] disabled:hover:text-[var(--base-content)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all border-[var(--base-300)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                &larr; Prev
              </button>
              <div className="flex gap-1.5">
                {[...Array(Math.min(pagination.totalPages, 7))].map((_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setPage(p)} aria-current={page === p ? "page" : undefined}
                      className="w-10 h-10 rounded-[var(--r-selector)] text-sm font-black font-poppins transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      style={page === p
                        ? { background: "var(--primary)", color: "var(--primary-content)", boxShadow: "0 4px 12px color-mix(in srgb, var(--primary), transparent 60%)" }
                        : { border: "2px solid var(--base-300)", color: "color-mix(in srgb, var(--base-content) 60%, transparent)", background: "var(--base-100)" }
                      }>{p}</button>
                  );
                })}
              </div>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-5 py-2.5 rounded-[var(--r-field)] border-2 text-xs font-black font-poppins uppercase tracking-wider text-[var(--base-content)] disabled:opacity-30 disabled:hover:border-[var(--base-300)] disabled:hover:text-[var(--base-content)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all border-[var(--base-300)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                Next &rarr;
              </button>
            </motion.div>
          )}
        </section>

        {/* ═══ WHY SECTION ═════════════════════════════════════════════ */}
        <section className="rounded-[var(--r-box)] overflow-hidden mt-16 border border-[var(--primary)]/15 shadow-sm"
          style={{ backgroundImage: "var(--bg-gradient-primary)" }}>
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none" aria-hidden="true" />
          <div className="relative z-10 px-6 py-10 lg:py-12">
            <div className="text-center mb-10">
              <h2 className="font-montserrat font-black text-2xl lg:text-3xl text-white tracking-tight">Why Book via Likeson?</h2>
              <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mt-4" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {[
                { icon: Shield,     title: "NABL Certified",  desc: "All partnered labs meet rigorous national accreditation standards." },
                { icon: Zap,        title: "Fast Reports",    desc: "Seamless digital delivery directly to your dashboard within hours." },
                { icon: Home,       title: "Home Collection", desc: "Safe, sterile sample pickup straight from your doorstep." },
                { icon: HeartPulse, title: "Expert Care",     desc: "Tests supervised and verified by qualified senior pathologists." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true, margin: "-50px" }}
                  className="flex flex-col items-center text-center gap-4 bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="w-14 h-14 rounded-[var(--r-field)] flex items-center justify-center bg-white/20 text-white shadow-inner">
                    <Icon size={26} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-montserrat font-black text-base text-white mb-2">{title}</p>
                    <p className="font-poppins text-xs font-medium text-white/70 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

      </Container>
    </div>
  );
}