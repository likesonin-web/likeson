"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  FlaskConical, Search, MapPin, Star, Clock, Home, Filter,
  ChevronDown, X, Shield, ArrowRight, Microscope,
  TestTube, CheckCircle, SlidersHorizontal, Sparkles,
  Package, ChevronRight, Grid3X3, List, Loader2,
  Building2, HeartPulse
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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

const StarRow = ({ rating = 0, total = 0 }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={11}
          className={i <= Math.round(rating)
            ? "fill-[var(--warning)] text-[var(--warning)]"
            : "fill-[var(--base-300)] text-[var(--base-300)]"}
        />
      ))}
    </div>
    <span className="text-[11px] font-bold text-[var(--base-content)]">{rating?.toFixed(1)}</span>
    <span className="text-[10px] text-[var(--base-content)]/50">({total})</span>
  </div>
);

const ModeBadge = ({ mode }) => {
  const cfg = {
    "Walk-in":        { cls: "text-[var(--info)] bg-[color-mix(in_srgb,var(--info),transparent_88%)] border-[color-mix(in_srgb,var(--info),transparent_68%)]",       icon: Building2 },
    "Home Collection":{ cls: "text-[var(--success)] bg-[color-mix(in_srgb,var(--success),transparent_88%)] border-[color-mix(in_srgb,var(--success),transparent_68%)]", icon: Home },
    "Both":           { cls: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent),transparent_88%)] border-[color-mix(in_srgb,var(--accent),transparent_68%)]",    icon: CheckCircle },
  }[mode] ?? { cls: "text-[var(--base-content)]/50 bg-[var(--base-200)] border-[var(--base-300)]", icon: Building2 };
  const Icon = cfg.icon;
  return (
    <span className={`badge text-[10px] border ${cfg.cls}`}>
      <Icon size={9} /> {mode}
    </span>
  );
};

const SkeletonCard = () => (
  <div className="card overflow-hidden animate-pulse">
    <div className="h-28 bg-[var(--base-300)]" />
    <div className="p-4 space-y-3">
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 rounded-xl bg-[var(--base-300)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-[var(--base-300)] rounded w-3/4" />
          <div className="h-2.5 bg-[var(--base-300)] rounded w-1/2" />
        </div>
      </div>
      <div className="h-2.5 bg-[var(--base-300)] rounded w-1/3" />
      <div className="h-2.5 bg-[var(--base-300)] rounded w-2/3" />
      <div className="flex gap-1.5">
        <div className="h-5 w-20 bg-[var(--base-300)] rounded-full" />
        <div className="h-5 w-16 bg-[var(--base-300)] rounded-full" />
      </div>
    </div>
  </div>
);

const LabCard = ({ lab, index, isCustomer }) => {
  const href = isCustomer ? `/labs/customer/${lab._id}` : `/labs/${lab._id}`;
  return (

    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
     

      <Link href={href} className="block h-full">
        <div className="card h-full overflow-hidden cursor-pointer transition-all duration-300">
          {/* Cover */}
          <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[var(--primary)]/15 to-[var(--secondary)]/15">
            {lab.coverImageUrl ? (
              <img src={lab.coverImageUrl} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/12 flex items-center justify-center z-10">
                  <FlaskConical size={26} className="text-[var(--primary)]/60" />
                </div>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-[var(--primary)]/8" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[var(--secondary)]/10" />
              </div>
            )}
            {lab.isVerified && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--success)]/90 text-[var(--success-content)] text-[10px] font-bold backdrop-blur-sm">
                <Shield size={9} /> NABL
              </div>
            )}
            {lab.isFeatured && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/90 text-[var(--accent-content)] text-[10px] font-bold backdrop-blur-sm">
                <Sparkles size={9} /> Featured
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col gap-2.5 flex-1">
            {/* Logo + Name */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--base-300)] bg-[var(--base-200)] flex items-center justify-center">
                {lab.logoUrl
                  ? <img src={lab.logoUrl} alt="" className="w-full h-full object-cover" />
                  : <Microscope size={16} className="text-[var(--primary)]" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-[var(--base-content)] truncate leading-tight group-hover:text-[var(--primary)] transition-colors">
                  {lab.labName}
                </h3>
                <p className="text-[11px] text-[var(--base-content)]/45 mt-0.5 truncate">{lab.labType}</p>
              </div>
            </div>

            <StarRow rating={lab.averageRating} total={lab.totalReviews} />

            <div className="flex items-center gap-1.5 text-[11px] text-[var(--base-content)]/55">
              <MapPin size={10} className="text-[var(--error)] flex-shrink-0" />
              <span className="truncate">{lab.registeredAddress?.city}, {lab.registeredAddress?.state}</span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-auto">
              <ModeBadge mode={lab.sampleCollectionMode} />
              {(lab.homeCollectionRadius ?? 0) > 0 && (
                <span className="badge text-[10px] border text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary),transparent_90%)] border-[color-mix(in_srgb,var(--primary),transparent_72%)]">
                  <Home size={9} /> {lab.homeCollectionRadius}km
                </span>
              )}
              {lab.avgTurnaroundHours && (
                <span className="badge text-[10px] border text-[var(--base-content)]/60 bg-[var(--base-200)] border-[var(--base-300)]">
                  <Clock size={9} /> {lab.avgTurnaroundHours}h TAT
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[var(--base-200)] mt-1">
              <span className="text-[10px] text-[var(--base-content)]/35 truncate pr-2">
                {(lab.tags ?? []).slice(0, 2).join(" · ")}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] flex-shrink-0 group-hover:gap-2 transition-all">
                View <ArrowRight size={11} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const FeaturedCard = ({ lab, index, isCustomer }) => {
  const href = isCustomer ? `/labs/customer/${lab._id}` : `/labs/${lab._id}`;
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex-shrink-0 w-68"
    >
      <Link href={href} className="block group">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--base-300)] bg-gradient-to-br from-[var(--primary)]/6 to-[var(--secondary)]/6 p-4 hover:border-[var(--primary)]/50 transition-all duration-300 hover:shadow-[var(--shadow-depth)]">
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-[var(--primary)]/5 -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-[var(--base-300)] bg-[var(--base-200)] flex items-center justify-center flex-shrink-0">
              {lab.logoUrl
                ? <img src={lab.logoUrl} alt="" className="w-full h-full object-cover" />
                : <FlaskConical size={18} className="text-[var(--primary)]" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors truncate">{lab.labName}</p>
              <p className="text-[10px] text-[var(--base-content)]/45 truncate">{lab.labType}</p>
            </div>
          </div>
          <StarRow rating={lab.averageRating} total={lab.totalReviews} />
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--base-content)]/50">
            <MapPin size={9} className="text-[var(--error)]" />
            {lab.registeredAddress?.city}
          </div>
          {lab.isVerified && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[var(--success)]">
              <Shield size={9} /> NABL Accredited
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LabsPage() {
  const dispatch = useDispatch();
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 300], [0, 70]);

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

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 380);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Fetch featured once
  useEffect(() => { dispatch(fetchFeaturedLabs()); }, [dispatch]);

  // Fetch labs on filter change
  useEffect(() => {
    if (isCustomer && debouncedSearch) {
      dispatch(searchLabsAsCustomer({ testName: debouncedSearch, city }));
    } else {
      dispatch(fetchPublicLabs({
        page, limit: 12,
        ...(labType          && { labType }),
        ...(collectionMode   && { sampleCollectionMode: collectionMode }),
        ...(city             && { city }),
        ...(debouncedSearch  && { search: debouncedSearch }),
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
      {/* ════ HERO ════════════════════════════════════════════════ */}
      <div className="relative  mb-10 ">
        {/* Layered background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/8 via-[var(--base-100)] to-[var(--secondary)]/6 pointer-events-none" />

        {/* Floating ring decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[180, 280, 380, 480, 580].map((size, i) => (
            <motion.div key={i}
              className="absolute rounded-full border border-[var(--primary)]/10"
              style={{ width: size, height: size, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
              animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.18, 0.5] }}
              transition={{ duration: 4 + i * 0.8, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
          {/* Molecules */}
          {[...Array(9)].map((_, i) => (
            <motion.div key={`mol${i}`}
              className="absolute w-1 h-1 rounded-full bg-[var(--primary)]/25"
              style={{ top: `${8 + i * 10}%`, left: `${4 + i * 11}%` }}
              animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.35 }}
            />
          ))}
        </div>

        <motion.div style={{ y: heroParallax }} className="relative container-custom pt-20 pb-14">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/22 mb-5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              <span className="text-xs font-bold text-[var(--primary)] tracking-widest uppercase">
                {isCustomer ? `Welcome, ${user.name}` : "Diagnostic Network"}
              </span>
            </motion.div>

            <h1 className="font-poppins font-black text-4xl md:text-5xl lg:text-6xl leading-[1.08] mb-4">
              <span className="text-[var(--base-content)]">Find the </span>
              <span className="text-gradient-primary">Right Lab</span>
              <br />
              <span className="text-[var(--base-content)] text-3xl md:text-4xl">Near You</span>
            </h1>

            <p className="text-sm md:text-base text-[var(--base-content)]/55 max-w-xl mx-auto leading-relaxed">
              {isCustomer
                ? "Search by test name, browse verified labs, and book from your account."
                : "Explore NABL-accredited diagnostic labs. Book tests & get digital reports fast."}
            </p>

            {/* Stat strip */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
              className="flex items-center justify-center gap-10 mt-7"
            >
              {[
                { label: "Labs",         val: "500+" },
                { label: "Tests",        val: "2,000+" },
                { label: "Cities",       val: "80+" },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-black text-[var(--primary)] font-poppins">{val}</div>
                  <div className="text-[10px] text-[var(--base-content)]/45 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* ── Search ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.55 }}
            className="max-w-2xl mx-auto mt-8 relative z-20"
          >
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--base-100)] border-2 border-[var(--primary)]/28 shadow-[0_8px_40px_color-mix(in_srgb,var(--primary),transparent_82%)] focus-within:border-[var(--primary)]/60 transition-all duration-300">
              <div className="flex-1 flex items-center gap-2 px-3">
                <Search size={17} className="text-[var(--primary)] flex-shrink-0" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={isCustomer ? "Search by test name, lab name, city…" : "Search labs, tests, cities…"}
                  className="flex-1 bg-transparent text-sm  outline-none text-[var(--base-content)] placeholder:text-[var(--base-content)]/32 outline-none py-2"
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="text-[var(--base-content)]/35 hover:text-[var(--error)] transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  showFilter || activeFilters > 0
                    ? "bg-[var(--primary)] text-[var(--primary-content)]"
                    : "bg-[var(--base-200)] text-[var(--base-content)]/70 hover:bg-[var(--primary)]/12 hover:text-[var(--primary)]"
                }`}
              >
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">Filters</span>
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
                  className="absolute top-full left-0 right-0 mt-2 p-4 rounded-2xl bg-[var(--base-100)] border border-[var(--base-300)] shadow-[var(--shadow-depth)] z-50"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--base-content)]/45 mb-1.5 block font-bold">Lab Type</label>
                      <select value={labType} onChange={(e) => { setLabType(e.target.value); setPage(1); }}
                        className="input-field w-full text-xs py-2">
                        <option value="">All Types</option>
                        {LAB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--base-content)]/45 mb-1.5 block font-bold">Collection Mode</label>
                      <select value={collectionMode} onChange={(e) => { setCollectionMode(e.target.value); setPage(1); }}
                        className="input-field w-full text-xs py-2">
                        <option value="">Any Mode</option>
                        {COLLECTION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--base-content)]/45 mb-1.5 block font-bold">City</label>
                      <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }}
                        placeholder="e.g. Hyderabad"
                        className="input-field w-full text-xs py-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--base-200)]">
                    <button onClick={clearFilters}
                      className="text-xs text-[var(--error)] font-bold hover:underline flex items-center gap-1">
                      <X size={10} /> Clear all
                    </button>
                    <button onClick={() => setShowFilter(false)}
                      className="btn-primary-cta text-xs px-5 py-2">Apply</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>

      {/* ════ FEATURED STRIP ══════════════════════════════════════ */}
      {featuredLabs.length > 0 && !debouncedSearch && (
        <section className="container-custom py-7 border-b border-[var(--base-200)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--primary)]" />
              <h2 className="font-poppins font-black text-base text-[var(--base-content)]">Featured Labs</h2>
            </div>
            <Link href={isCustomer ? "/labs/customer" : "/labs/featured"}
              className="text-xs font-bold text-[var(--primary)] flex items-center gap-0.5 hover:gap-1.5 transition-all">
              See all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            {featuredLabs.map((lab, i) => (
              <FeaturedCard key={lab._id} lab={lab} index={i} isCustomer={isCustomer} />
            ))}
          </div>
        </section>
      )}

      {/* ════ TOOLBAR ═════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-[var(--base-100)]/92 backdrop-blur-strong border-b border-[var(--base-200)]">
        <div className="container-custom py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {loading ? (
              <Loader2 size={14} className="animate-spin text-[var(--primary)]" />
            ) : (
              <span className="font-bold text-[var(--base-content)]">{pagination?.total ?? displayedLabs.length}</span>
            )}
            <span className="text-[var(--base-content)]/50 text-xs">labs found</span>
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)] text-xs font-bold hover:bg-[var(--error)]/20 transition-colors">
                <X size={9} /> Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-[var(--base-300)] rounded-lg px-3 py-1.5 bg-[var(--base-100)] text-[var(--base-content)] outline-none cursor-pointer">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex items-center border border-[var(--base-300)] rounded-lg overflow-hidden">
              {([{ v: "grid", Icon: Grid3X3 }, { v: "list", Icon: List }]).map(({ v, Icon }) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`p-1.5 transition-colors ${viewMode === v ? "bg-[var(--primary)] text-[var(--primary-content)]" : "text-[var(--base-content)]/45 hover:bg-[var(--base-200)]"}`}>
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════ LABS GRID ═══════════════════════════════════════════ */}
      <section className="container-custom py-7">
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
              className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center mx-auto mb-4">
                <X size={22} className="text-[var(--error)]" />
              </div>
              <p className="font-bold text-[var(--base-content)] text-sm">Something went wrong</p>
              <p className="text-xs text-[var(--base-content)]/45 mt-1">{error}</p>
              <button onClick={() => dispatch(fetchPublicLabs({}))}
                className="btn-secondary mt-4 text-xs px-5 py-2">Retry</button>
            </motion.div>
          ) : displayedLabs.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24">
              <div className="w-20 h-20 rounded-3xl bg-[var(--primary)]/7 flex items-center justify-center mx-auto mb-5">
                <FlaskConical size={30} className="text-[var(--primary)]/40" />
              </div>
              <h3 className="font-poppins font-black text-xl text-[var(--base-content)] mb-2">No labs found</h3>
              <p className="text-sm text-[var(--base-content)]/45">Try different filters or a broader search term.</p>
              <button onClick={clearFilters} className="btn-primary-cta mt-5 text-xs px-6 py-2.5">Clear Filters</button>
            </motion.div>
          ) : (
            <motion.div key="labs"
              className={viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
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
              className="px-4 py-2 rounded-xl border border-[var(--base-300)] text-xs font-bold text-[var(--base-content)] disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
              ← Previous
            </button>
            <div className="flex gap-1">
              {[...Array(Math.min(pagination.totalPages, 7))].map((_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      page === p
                        ? "bg-[var(--primary)] text-[var(--primary-content)]"
                        : "border border-[var(--base-300)] text-[var(--base-content)]/55 hover:border-[var(--primary)]"
                    }`}>{p}</button>
                );
              })}
            </div>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-xl border border-[var(--base-300)] text-xs font-bold text-[var(--base-content)] disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
              Next →
            </button>
          </motion.div>
        )}
      </section>

      {/* ════ WHY LIKESON ═════════════════════════════════════════ */}
      <section className="border-t border-[var(--base-200)] bg-gradient-to-br from-[var(--primary)]/4 to-[var(--secondary)]/4">
        <div className="container-custom py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield,     title: "NABL Certified",  desc: "All labs meet national standards" },
              { icon: Clock,      title: "Fast Reports",    desc: "Digital delivery in hours" },
              { icon: Home,       title: "Home Collection", desc: "Sample pickup at your doorstep" },
              { icon: HeartPulse, title: "Expert Care",     desc: "Supervised by qualified pathologists" },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09 }} viewport={{ once: true }}
                className="flex flex-col items-center text-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                  <Icon size={20} className="text-[var(--primary)]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[var(--base-content)]">{title}</p>
                  <p className="text-xs text-[var(--base-content)]/45 mt-0.5">{desc}</p>
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