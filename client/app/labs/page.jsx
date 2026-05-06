"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  FlaskConical, Search, MapPin, Star, Clock, Home, Filter,
  ChevronDown, X, Shield, ArrowRight, Microscope,
  TestTube, CheckCircle, SlidersHorizontal, Sparkles,
  Package, ChevronRight, Grid3X3, List, Loader2,
  Building2, HeartPulse, Zap, TrendingUp, Award, Beaker
} from "lucide-react";
import Link from "next/link";

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

// ─── Sub-components ─────────────────────────────────────────────────────────

const StarRow = ({ rating = 0, total = 0 }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={10}
          className={i <= Math.round(rating)
            ? "fill-[var(--warning)] text-[var(--warning)]"
            : "fill-[var(--base-300)] text-[var(--base-300)]"}
        />
      ))}
    </div>
    <span className="text-[11px] font-black text-[var(--base-content)]">{rating?.toFixed(1)}</span>
    <span className="text-[10px] text-[var(--base-content)]/40">({total})</span>
  </div>
);

const ModeBadge = ({ mode }) => {
  const cfg = {
    "Walk-in":         { cls: "text-[var(--info)] bg-[color-mix(in_srgb,var(--info),transparent_88%)]",       icon: Building2 },
    "Home Collection": { cls: "text-[var(--success)] bg-[color-mix(in_srgb,var(--success),transparent_88%)]", icon: Home },
    "Both":            { cls: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent),transparent_88%)]",   icon: CheckCircle },
  }[mode] ?? { cls: "text-[var(--base-content)]/50 bg-[var(--base-200)]", icon: Building2 };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.cls}`}>
      <Icon size={9} /> {mode}
    </span>
  );
};

const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden border border-[var(--base-300)] animate-pulse">
    <div className="h-24 bg-gradient-to-br from-[var(--primary)]/10 to-[var(--secondary)]/10" />
    <div className="p-4 space-y-3">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--base-300)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-[var(--base-300)] rounded w-3/4" />
          <div className="h-2 bg-[var(--base-300)] rounded w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-[var(--base-300)] rounded w-2/3" />
      <div className="flex gap-1.5">
        <div className="h-5 w-20 bg-[var(--base-300)] rounded-md" />
        <div className="h-5 w-16 bg-[var(--base-300)] rounded-md" />
      </div>
    </div>
  </div>
);

// ─── LabCard — premium redesign ──────────────────────────────────────────────

const LabCard = ({ lab, index, isCustomer }) => {
  const href = isCustomer ? `/labs/customer/${lab._id}` : `/labs/${lab._id}`;
  const isTopRated = (lab.averageRating ?? 0) >= 4.5;
  const isNabl = lab.isVerified;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <Link href={href} className="block h-full">
        <div className="relative h-full rounded-2xl overflow-hidden border border-[var(--base-300)] bg-[var(--base-100)] transition-all duration-300 hover:border-[var(--primary)]/50 hover:shadow-[0_8px_32px_color-mix(in_srgb,var(--primary),transparent_80%)] hover:-translate-y-1">

          {/* Top accent bar — purple gradient */}
          <div className="h-1 w-full bg-gradient-to-r from-[var(--primary)] via-[var(--secondary)] to-[var(--accent)]" />

          {/* Cover with overlay */}
          <div className="relative h-24 overflow-hidden bg-gradient-to-br from-[var(--primary)]/12 via-[var(--secondary)]/8 to-[var(--base-200)]">
            {lab.coverImageUrl ? (
              <img src={lab.coverImageUrl} alt="" className="w-full h-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[var(--primary)]/8" />
                <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-[var(--secondary)]/10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-[var(--primary)]/15" />
                <FlaskConical size={22} className="text-[var(--primary)]/40 relative z-10" />
              </div>
            )}

            {/* Badges row */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
              {lab.isFeatured && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/90 text-[var(--accent-content)] text-[9px] font-black backdrop-blur-sm">
                  <Sparkles size={8} /> Featured
                </span>
              )}
              {!lab.isFeatured && <span />}
              {isNabl && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--success)]/90 text-[var(--success-content)] text-[9px] font-black backdrop-blur-sm">
                  <Shield size={8} /> NABL
                </span>
              )}
            </div>

            {/* Top rated ribbon */}
            {isTopRated && !isNabl && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--warning)]/90 text-[var(--warning-content)] text-[9px] font-black backdrop-blur-sm">
                <Award size={8} /> Top Rated
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col gap-2.5">
            {/* Logo + Name */}
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-[var(--base-300)] bg-[var(--base-200)] flex items-center justify-center shadow-sm">
                  {lab.logoUrl
                    ? <img src={lab.logoUrl} alt="" className="w-full h-full object-cover" />
                    : <Microscope size={18} className="text-[var(--primary)]" />
                  }
                </div>
                {isNabl && (
                  <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-[var(--success)] flex items-center justify-center border-2 border-[var(--base-100)]">
                    <Shield size={7} className="text-[var(--success-content)]" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="font-black text-[13px] text-[var(--base-content)] truncate leading-snug group-hover:text-[var(--primary)] transition-colors duration-200">
                  {lab.labName}
                </h3>
                <p className="text-[10px] text-[var(--base-content)]/40 mt-0.5 truncate font-medium">{lab.labType}</p>
              </div>
            </div>

            {/* Rating */}
            <StarRow rating={lab.averageRating} total={lab.totalReviews} />

            {/* Location */}
            <div className="flex items-center gap-1.5">
              <MapPin size={10} className="text-[var(--error)] flex-shrink-0" />
              <span className="text-[11px] text-[var(--base-content)]/50 truncate">{lab.registeredAddress?.city}, {lab.registeredAddress?.state}</span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5">
              <ModeBadge mode={lab.sampleCollectionMode} />
              {(lab.homeCollectionRadius ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary),transparent_90%)]">
                  <Home size={9} /> {lab.homeCollectionRadius}km
                </span>
              )}
              {lab.avgTurnaroundHours && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-[var(--base-content)]/55 bg-[var(--base-200)]">
                  <Zap size={9} /> {lab.avgTurnaroundHours}h
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[var(--base-200)] mt-auto">
              <span className="text-[10px] text-[var(--base-content)]/30 truncate pr-2">
                {(lab.tags ?? []).slice(0, 2).join(" · ")}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-black text-[var(--primary)] flex-shrink-0 group-hover:gap-2 transition-all duration-200">
                View <ArrowRight size={11} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// ─── FeaturedCard — bold horizontal card ────────────────────────────────────

const FeaturedCard = ({ lab, index, isCustomer }) => {
  const href = isCustomer ? `/labs/customer/${lab._id}` : `/labs/${lab._id}`;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex-shrink-0 w-72"
    >
      <Link href={href} className="block group">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--primary)]/20 bg-gradient-to-br from-[var(--primary)]/8 via-[var(--base-100)] to-[var(--secondary)]/6 p-4 transition-all duration-300 hover:border-[var(--primary)]/50 hover:shadow-[0_8px_28px_color-mix(in_srgb,var(--primary),transparent_75%)] hover:-translate-y-0.5">

          {/* Decorative blob */}
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-[var(--primary)]/6 pointer-events-none" />

          {/* Top: logo + name */}
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[var(--primary)]/20 bg-[var(--base-200)] flex items-center justify-center flex-shrink-0">
              {lab.logoUrl
                ? <img src={lab.logoUrl} alt="" className="w-full h-full object-cover" />
                : <FlaskConical size={20} className="text-[var(--primary)]" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-[13px] text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors truncate leading-snug">{lab.labName}</p>
              <p className="text-[10px] text-[var(--base-content)]/40 truncate">{lab.labType}</p>
            </div>
            {lab.isVerified && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--success)]/15 flex items-center justify-center">
                <Shield size={13} className="text-[var(--success)]" />
              </div>
            )}
          </div>

          <StarRow rating={lab.averageRating} total={lab.totalReviews} />

          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--base-content)]/45">
            <MapPin size={10} className="text-[var(--error)]" />
            {lab.registeredAddress?.city}
          </div>

          {/* Bottom tags */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--base-200)]">
            <ModeBadge mode={lab.sampleCollectionMode} />
            <span className="text-[10px] font-black text-[var(--primary)] flex items-center gap-1 group-hover:gap-1.5 transition-all">
              View <ArrowRight size={10} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

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
    <div data-theme="lab" className="min-h-screen bg-[var(--base-100)]">
      <Container className="mt-4">
        <Banner position="Lab_Page" />

        {/* ═══ HERO ══════════════════════════════════════════════════════ */}
        <div className="relative mb-10 rounded-3xl mt-2 overflow-hidden border border-[var(--primary)]/15"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--base-100)) 0%, var(--base-100) 40%, color-mix(in srgb, var(--secondary) 8%, var(--base-100)) 100%)" }}>

          {/* Background pattern — subtle hex grid */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 2L56 17v26L30 58 4 43V17z' fill='none' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }} />

          {/* Gradient blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 20%, transparent) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--secondary) 25%, transparent) 0%, transparent 70%)" }} />

          {/* Floating molecules */}
          {[...Array(8)].map((_, i) => (
            <motion.div key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                top:    `${12 + i * 11}%`,
                left:   `${6 + i * 12}%`,
                background: "var(--primary)",
                opacity: 0.15,
              }}
              animate={{ y: [-8, 8, -8], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
          {/* Connecting lines decoration */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]" aria-hidden="true">
            <defs>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="var(--primary)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          <motion.div style={{ y: heroParallax }} className="relative container-custom  pb-12 px-6">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl mx-auto text-center"
            >
              {/* Badge */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
                style={{
                  background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
                }}
              >
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--primary)" }}
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-[11px] font-black text-[var(--primary)] tracking-widest uppercase">
                  {isCustomer ? `Welcome back, ${user?.name?.split(" ")[0]}` : "Diagnostic Network"}
                </span>
              </motion.div>

              {/* Headline */}
              <h1 className="font-poppins font-black leading-[1.06] mb-4">
                <span className="block text-4xl md:text-5xl lg:text-6xl text-[var(--base-content)]">
                  Find the Right
                </span>
                <span className="block text-4xl md:text-5xl lg:text-6xl text-gradient-primary">
                  Lab Near You
                </span>
              </h1>

              <p className="text-[13px] md:text-[15px] text-[var(--base-content)]/50 max-w-md mx-auto leading-relaxed mb-8">
                {isCustomer
                  ? "Search by test name, browse NABL-certified labs, book instantly."
                  : "NABL-accredited labs. Digital reports. Home collection. Trusted results."}
              </p>

              {/* Stats — inline pill style */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="inline-flex items-center gap-0 rounded-2xl border overflow-hidden mb-8"
                style={{ borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
              >
                {[
                  { val: "500+",   label: "Labs",    icon: FlaskConical },
                  { val: "2000+",  label: "Tests",   icon: TestTube },
                  { val: "80+",    label: "Cities",  icon: MapPin },
                ].map(({ val, label, icon: Icon }, i) => (
                  <div key={label}
                    className={`flex items-center gap-2 px-5 py-3 ${i < 2 ? "border-r border-[var(--primary)]/15" : ""}`}
                    style={{ background: "color-mix(in srgb, var(--primary) 5%, var(--base-100))" }}
                  >
                    <Icon size={13} className="text-[var(--primary)] opacity-70" />
                    <div className="text-left">
                      <div className="text-base font-black text-[var(--primary)] font-poppins leading-none">{val}</div>
                      <div className="text-[9px] text-[var(--base-content)]/40 uppercase tracking-wider font-bold">{label}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── Search bar ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="max-w-xl mx-auto relative z-20 mb-4"
            >
              <div className="flex items-center gap-2 p-1.5 rounded-2xl border-2 bg-[var(--base-100)] shadow-[0_8px_40px_color-mix(in_srgb,var(--primary),transparent_80%)] transition-all duration-300 focus-within:shadow-[0_12px_48px_color-mix(in_srgb,var(--primary),transparent_68%)]"
                style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)" }}>
                <div className="flex-1 flex items-center gap-3 px-3">
                  <Search size={16} className="text-[var(--primary)] flex-shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder={isCustomer ? "Test name, lab, city…" : "Search labs, tests, cities…"}
                    className="flex-1 bg-transparent text-[13px] outline-none text-[var(--base-content)] placeholder:text-[var(--base-content)]/30 py-2.5"
                  />
                  {search && (
                    <button onClick={() => setSearch("")}
                      className="text-[var(--base-content)]/30 hover:text-[var(--error)] transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-200 ${
                    showFilter || activeFilters > 0
                      ? "bg-[var(--primary)] text-[var(--primary-content)]"
                      : "bg-[var(--base-200)] text-[var(--base-content)]/60 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  <span className="hidden sm:inline">Filter</span>
                  {activeFilters > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--accent-content)] text-[9px] font-black flex items-center justify-center">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </div>

              {/* Filter panel */}
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full z-[1000] left-0 right-0 mt-2 p-4 rounded-2xl bg-[var(--base-100)] border border-[var(--base-300)] shadow-[var(--shadow-depth)] z-50"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Lab Type", el: (
                          <select value={labType} onChange={(e) => { setLabType(e.target.value); setPage(1); }} className="input-field w-full text-xs py-2">
                            <option value="">All Types</option>
                            {LAB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        )},
                        { label: "Collection", el: (
                          <select value={collectionMode} onChange={(e) => { setCollectionMode(e.target.value); setPage(1); }} className="input-field w-full text-xs py-2">
                            <option value="">Any Mode</option>
                            {COLLECTION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        )},
                        { label: "City", el: (
                          <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder="e.g. Hyderabad" className="input-field w-full text-xs py-2" />
                        )},
                      ].map(({ label, el }) => (
                        <div key={label}>
                          <label className="text-[10px] uppercase tracking-wider text-[var(--base-content)]/40 mb-1.5 block font-black">{label}</label>
                          {el}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--base-200)]">
                      <button onClick={clearFilters} className="text-[11px] text-[var(--error)] font-black hover:underline flex items-center gap-1">
                        <X size={10} /> Clear all
                      </button>
                      <button onClick={() => setShowFilter(false)} className="btn-primary-cta text-xs px-5 py-2">Apply</button>
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
          className="flex items-center justify-center gap-6 mb-8 flex-wrap"
        >
          {[
            { icon: Shield,     label: "NABL Certified",   color: "var(--success)" },
            { icon: Zap,        label: "Reports in Hours", color: "var(--warning)" },
            { icon: Home,       label: "Home Collection",  color: "var(--primary)" },
            { icon: HeartPulse, label: "Expert Pathology", color: "var(--error)"   },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                <Icon size={13} style={{ color }} />
              </div>
              <span className="text-[11px] font-black text-[var(--base-content)]/60 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ═══ FEATURED STRIP ═══════════════════════════════════════════ */}
        {featuredLabs.length > 0 && !debouncedSearch && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Purple accent bar */}
                <div className="w-1 h-6 rounded-full" style={{ background: "linear-gradient(180deg, var(--accent), var(--primary))" }} />
                <div>
                  <h2 className="font-poppins font-black text-[15px] text-[var(--base-content)]">Featured Labs</h2>
                  <p className="text-[10px] text-[var(--base-content)]/40 font-medium">Verified & top-rated near you</p>
                </div>
              </div>
              <Link href={isCustomer ? "/labs/customer" : "/labs/featured"}
                className="flex items-center gap-1 text-[11px] font-black text-[var(--primary)] hover:gap-2 transition-all duration-200">
                See all <ChevronRight size={12} />
              </Link>
            </div>

            {/* Horizontal scroll with fade edges */}
            <div className="relative">
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x snap-mandatory">
                {featuredLabs.map((lab, i) => (
                  <div key={lab._id} className="snap-start">
                    <FeaturedCard lab={lab} index={i} isCustomer={isCustomer} />
                  </div>
                ))}
              </div>
              {/* Fade right edge */}
              <div className="absolute right-0 top-0 bottom-2 w-16 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, var(--base-100))" }} />
            </div>
          </section>
        )}

        {/* ═══ TOOLBAR ══════════════════════════════════════════════════ */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-3 mb-6"
          style={{ background: "color-mix(in srgb, var(--base-100) 92%, transparent)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--base-300)" }}>
          <div className="flex items-center justify-between gap-3">

            {/* Left: count + clear */}
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-[var(--primary)]" />
                  <span className="text-[11px] text-[var(--base-content)]/40">Loading…</span>
                </div>
              ) : (
                <>
                  <span className="text-[13px] font-black text-[var(--base-content)]">
                    {pagination?.total ?? displayedLabs.length}
                  </span>
                  <span className="text-[11px] text-[var(--base-content)]/40">labs</span>
                </>
              )}
              {activeFilters > 0 && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black transition-colors"
                  style={{ background: "color-mix(in srgb, var(--error) 10%, transparent)", color: "var(--error)" }}>
                  <X size={9} /> Clear
                </button>
              )}
            </div>

            {/* Right: sort + view toggle */}
            <div className="flex items-center gap-2">
              {/* Sort — minimal pill style */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-[11px] font-black border border-[var(--base-300)] bg-[var(--base-100)] text-[var(--base-content)] outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40 pointer-events-none" />
              </div>

              {/* View toggle — pill */}
              <div className="flex items-center rounded-xl border border-[var(--base-300)] overflow-hidden p-0.5 gap-0.5" style={{ background: "var(--base-200)" }}>
                {([{ v: "grid", Icon: Grid3X3 }, { v: "list", Icon: List }]).map(({ v, Icon }) => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className="p-1.5 rounded-lg transition-all duration-200"
                    style={viewMode === v
                      ? { background: "var(--primary)", color: "var(--primary-content)" }
                      : { background: "transparent", color: "var(--base-content)", opacity: 0.4 }
                    }>
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ LABS GRID ════════════════════════════════════════════════ */}
        <section className="pb-10">
          <AnimatePresence mode="wait">
            {loading && displayedLabs.length === 0 ? (
              <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "flex flex-col gap-3"}>
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </motion.div>

            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-20">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "color-mix(in srgb, var(--error) 10%, transparent)" }}>
                  <X size={22} className="text-[var(--error)]" />
                </div>
                <p className="font-black text-[var(--base-content)] text-sm">Something went wrong</p>
                <p className="text-xs text-[var(--base-content)]/45 mt-1">{error}</p>
                <button onClick={() => dispatch(fetchPublicLabs({}))}
                  className="btn-secondary mt-4 text-xs px-5 py-2">Retry</button>
              </motion.div>

            ) : displayedLabs.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center py-24">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                  <FlaskConical size={30} className="text-[var(--primary)]/40" />
                </div>
                <h3 className="font-poppins font-black text-xl text-[var(--base-content)] mb-2">No labs found</h3>
                <p className="text-sm text-[var(--base-content)]/45">Try different filters or a broader search.</p>
                <button onClick={clearFilters} className="btn-primary-cta mt-5 text-xs px-6 py-2.5">Clear Filters</button>
              </motion.div>

            ) : (
              <motion.div key="labs"
                className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "flex flex-col gap-3"}>
                {displayedLabs.map((lab, i) => (
                  <LabCard key={lab._id} lab={lab} index={i} isCustomer={isCustomer} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && !debouncedSearch && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 mt-10">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl border text-xs font-black text-[var(--base-content)] disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all border-[var(--base-300)]">
                ← Prev
              </button>
              <div className="flex gap-1">
                {[...Array(Math.min(pagination.totalPages, 7))].map((_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-xs font-black transition-all"
                      style={page === p
                        ? { background: "var(--primary)", color: "var(--primary-content)" }
                        : { border: "1px solid var(--base-300)", color: "color-mix(in srgb, var(--base-content) 55%, transparent)" }
                      }>{p}</button>
                  );
                })}
              </div>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl border text-xs font-black text-[var(--base-content)] disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all border-[var(--base-300)]">
                Next →
              </button>
            </motion.div>
          )}
        </section>

        {/* ═══ WHY SECTION — bottom strip ══════════════════════════════ */}
        <section className="rounded-3xl overflow-hidden mb-8 border border-[var(--primary)]/15"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--base-100)) 0%, var(--base-100) 50%, color-mix(in srgb, var(--secondary) 5%, var(--base-100)) 100%)" }}>
          <div className="px-6 py-8">
            <div className="text-center mb-6">
              <h2 className="font-poppins font-black text-lg text-[var(--base-content)]">Why Book via Likeson?</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Shield,     title: "NABL Certified",  desc: "All labs meet national accreditation standards", color: "var(--success)" },
                { icon: Zap,        title: "Fast Reports",    desc: "Digital delivery within hours, not days",        color: "var(--warning)" },
                { icon: Home,       title: "Home Collection", desc: "Sample pickup straight at your doorstep",        color: "var(--primary)" },
                { icon: HeartPulse, title: "Expert Care",     desc: "Supervised by qualified pathologists",           color: "var(--error)"   },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div key={title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  viewport={{ once: true }}
                  className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
                    <Icon size={22} style={{ color }} />
                  </div>
                  <div>
                    <p className="font-black text-[13px] text-[var(--base-content)]">{title}</p>
                    <p className="text-[11px] text-[var(--base-content)]/45 mt-0.5 leading-snug">{desc}</p>
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