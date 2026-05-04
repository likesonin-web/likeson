"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  { key: "doctor",   label: "Doctors",   icon: Stethoscope,  color: "#0ea5e9" },
  { key: "hospital", label: "Hospitals", icon: Building2,    color: "#8b5cf6" },
  { key: "lab",      label: "Labs",      icon: FlaskConical, color: "#10b981" },
  { key: "medicine", label: "Medicines", icon: Pill,         color: "#f59e0b" },
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
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ── Star rating ──────────────────────────────────────────────────────────────
function Stars({ rating = 0, size = 12 }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? "text-warning fill-warning" : "text-base-300"}
        />
      ))}
    </span>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
function Chip({ children, color, onClick, active }) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={active ? { background: color, color: "#fff", borderColor: color } : {}}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200
        ${active ? "" : "bg-base-200 border-base-300 text-base-content hover:border-primary hover:text-primary"}`}
    >
      {children}
    </motion.button>
  );
}

// ── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card p-4 flex gap-4 animate-pulse">
      <div className="skeleton w-16 h-16 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ query }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible"
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
        <Search size={32} className="text-base-content/30" />
      </div>
      <p className="font-montserrat font-bold text-lg text-base-content/60">
        No results {query ? `for "${query}"` : ""}
      </p>
      <p className="text-sm text-base-content/40 mt-1">Try different keywords or filters</p>
    </motion.div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages } = pagination;
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="btn btn-ghost btn-sm btn-circle disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        const p = pages <= 7 ? i + 1 : i < 3 ? i + 1 : i === 3 ? page : pages - (6 - i);
        return (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={`btn btn-sm btn-circle font-semibold ${p === page ? "btn-primary" : "btn-ghost"}`}
          >
            {p}
          </button>
        );
      })}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className="btn btn-ghost btn-sm btn-circle disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Doctor card ──────────────────────────────────────────────────────────────
function DoctorCard({ doc }) {
  return (
    <motion.div variants={cardVariant} className="card p-4 flex gap-4 cursor-pointer group">
      <div className="relative flex-shrink-0">
        <img
          src={doc.profilePhotoUrl || doc.avatar || "/placeholder-doctor.png"}
          alt={doc.name}
          className="w-16 h-16 rounded-xl object-cover bg-base-200"
        />
        {doc.isOnline && (
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-success rounded-full border-2 border-base-100" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-bold text-sm text-base-content group-hover:text-primary transition-colors flex items-center gap-1.5">
              Dr. {doc.name}
              {doc.isVerified && <BadgeCheck size={14} className="text-primary flex-shrink-0" />}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">{doc.specialization}</p>
          </div>
          {doc.distanceKm != null && (
            <span className="text-xs text-primary font-semibold whitespace-nowrap flex items-center gap-1">
              <MapPin size={11} /> {doc.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Stars rating={doc.rating?.averageRating} />
            <span className="text-xs text-base-content/50">({doc.rating?.totalRatings ?? 0})</span>
          </div>
          <span className="text-xs text-base-content/50">{doc.experienceYears} yrs exp</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {doc.consultationTypes?.inPerson  && <Chip color="var(--primary)" active><Home size={10}/>In-Person</Chip>}
          {doc.consultationTypes?.video     && <Chip color="#0ea5e9"        active><Video size={10}/>Video</Chip>}
          {doc.consultationTypes?.homeVisit && <Chip color="#10b981"        active><Navigation size={10}/>Home</Chip>}
        </div>
        {doc.hospital?.name && (
          <p className="text-xs text-base-content/40 mt-1.5 flex items-center gap-1">
            <Building2 size={11} />{doc.hospital.name}
            {doc.hospital.city && `, ${doc.hospital.city}`}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Hospital card ─────────────────────────────────────────────────────────────
function HospitalCard({ hosp }) {
  return (
    <motion.div variants={cardVariant} className="card p-4 flex gap-4 cursor-pointer group">
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-base-200 flex items-center justify-center overflow-hidden">
        {hosp.logo
          ? <img src={hosp.logo} alt={hosp.name} className="w-full h-full object-cover" />
          : <Building2 size={28} className="text-base-content/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-bold text-sm text-base-content group-hover:text-primary transition-colors flex items-center gap-1.5">
              {hosp.name}
              {hosp.isVerified && <BadgeCheck size={14} className="text-primary flex-shrink-0" />}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">{hosp.hospitalType}</p>
          </div>
          {hosp.distanceKm != null && (
            <span className="text-xs text-primary font-semibold whitespace-nowrap flex items-center gap-1">
              <MapPin size={11} /> {hosp.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Stars rating={hosp.rating?.averageRating} />
          <span className="text-xs text-base-content/50">({hosp.rating?.totalRatings ?? 0})</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {hosp.isEmergencyReady && <Chip color="#ef4444" active><AlertCircle size={10}/>Emergency</Chip>}
          {hosp.hasICU           && <Chip color="#8b5cf6" active>ICU</Chip>}
          {hosp.is24x7           && <Chip color="#0ea5e9" active>24×7</Chip>}
          {hosp.hasPharmacy      && <Chip color="#10b981" active><Pill size={10}/>Pharmacy</Chip>}
        </div>
        <p className="text-xs text-base-content/40 mt-1.5 flex items-center gap-1">
          <MapPin size={11} />{hosp.address?.line1}, {hosp.address?.city}
        </p>
      </div>
    </motion.div>
  );
}

// ── Lab card ──────────────────────────────────────────────────────────────────
function LabCard({ lab }) {
  return (
    <motion.div variants={cardVariant} className="card p-4 flex gap-4 cursor-pointer group">
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-base-200 flex items-center justify-center overflow-hidden">
        {lab.logoUrl
          ? <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" />
          : <TestTube size={28} className="text-base-content/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-bold text-sm text-base-content group-hover:text-primary transition-colors flex items-center gap-1.5">
              {lab.labName}
              {lab.isVerified && <BadgeCheck size={14} className="text-primary flex-shrink-0" />}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">{lab.labType}</p>
          </div>
          {lab.distanceKm != null && (
            <span className="text-xs text-primary font-semibold whitespace-nowrap flex items-center gap-1">
              <MapPin size={11} /> {lab.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Stars rating={lab.averageRating} />
          <span className="text-xs text-base-content/50">({lab.totalReviews ?? 0})</span>
          {lab.activeTestCount != null && (
            <span className="text-xs text-base-content/50">{lab.activeTestCount} tests</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {lab.sampleCollectionMode === "Home Collection" || lab.sampleCollectionMode === "Both"
            ? <Chip color="#10b981" active><Home size={10}/>Home Collection</Chip>
            : null}
          {lab.isFeatured && <Chip color="#f59e0b" active>Featured</Chip>}
        </div>
        <p className="text-xs text-base-content/40 mt-1.5 flex items-center gap-1">
          <MapPin size={11} />{lab.registeredAddress?.city}
        </p>
      </div>
    </motion.div>
  );
}

// ── Medicine card ─────────────────────────────────────────────────────────────
function MedicineCard({ med }) {
  const primaryImage = med.images?.find?.((i) => i.isPrimary) || med.images?.[0];
  return (
    <motion.div variants={cardVariant} className="card p-4 flex gap-4 cursor-pointer group">
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-base-200 flex items-center justify-center overflow-hidden">
        {primaryImage?.url
          ? <img src={primaryImage.url} alt={med.name} className="w-full h-full object-cover" />
          : <Package size={28} className="text-base-content/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-montserrat font-bold text-sm text-base-content group-hover:text-primary transition-colors">
              {med.brandName || med.name}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5">{med.genericName}</p>
          </div>
          <div className="text-right flex-shrink-0">
            {med.mrp != null && (
              <p className="text-sm font-bold text-primary">₹{med.mrp}</p>
            )}
            <span className={`text-xs font-semibold ${med.isAvailable ? "text-success" : "text-error"}`}>
              {med.isAvailable ? "In Stock" : "Out of Stock"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Chip color="var(--primary)">{med.category}</Chip>
          {med.isPrescriptionRequired && <Chip color="#ef4444">Rx Required</Chip>}
          {med.schedule && med.schedule !== "None" && <Chip color="#8b5cf6">Sch {med.schedule}</Chip>}
        </div>
        <p className="text-xs text-base-content/40 mt-1">{med.packaging}</p>
      </div>
    </motion.div>
  );
}

// ── Global result section ─────────────────────────────────────────────────────
function GlobalSection({ title, icon: Icon, color, children, count }) {
  if (!count) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <h2 className="font-montserrat font-extrabold text-sm text-base-content">{title}</h2>
        <span className="badge badge-primary badge-xs">{count}</span>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
        {children}
      </motion.div>
    </div>
  );
}

// ── Filter panel ──────────────────────────────────────────────────────────────
function FilterPanel({ tab, filters, setFilters, specializations }) {
  if (tab === "all") return null;

  const sortOpts = SORT_OPTIONS[tab] || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-base-100 border border-base-300 rounded-2xl p-5 space-y-5 sticky top-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-montserrat font-bold text-sm text-base-content flex items-center gap-2">
          <SlidersHorizontal size={14} />Filters
        </h3>
        <button
          onClick={() => setFilters({})}
          className="text-xs text-primary hover:underline"
        >Reset</button>
      </div>

      {/* Sort */}
      {sortOpts.length > 0 && (
        <div>
          <label className="label-text block mb-2">Sort by</label>
          <div className="flex flex-col gap-1.5">
            {sortOpts.map((s) => (
              <label key={s} className="label gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sort"
                  value={s}
                  checked={filters.sort === s || (!filters.sort && s === "relevance")}
                  onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="label-text capitalize">{s.replace(/-/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Doctor-specific */}
      {tab === "doctor" && (
        <>
          <div>
            <label className="label-text block mb-2">Specialization</label>
            <select
              value={filters.specialization || ""}
              onChange={(e) => setFilters((f) => ({ ...f, specialization: e.target.value || undefined }))}
              className="input-field w-full text-sm py-2"
            >
              <option value="">All</option>
              {specializations.map((s) => (
                <option key={s.specialization} value={s.specialization}>
                  {s.specialization} ({s.doctorCount})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text block mb-2">Consultation type</label>
            {["inPerson", "video", "homeVisit"].map((t) => (
              <label key={t} className="label gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!filters[t]}
                  onChange={(e) => setFilters((f) => ({ ...f, [t]: e.target.checked ? "true" : undefined }))}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="label-text capitalize">{t === "homeVisit" ? "Home Visit" : t === "inPerson" ? "In-Person" : "Video"}</span>
              </label>
            ))}
          </div>
          <label className="label gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.verified === "true"}
              onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.checked ? "true" : undefined }))}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="label-text">Verified only</span>
          </label>
        </>
      )}

      {/* Hospital-specific */}
      {tab === "hospital" && (
        <>
          <div>
            <label className="label-text block mb-2">Type</label>
            {["Multi-Specialty", "Super-Specialty", "Clinic", "Nursing Home", "Trust", "Government"].map((t) => (
              <label key={t} className="label gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hospitalType === t}
                  onChange={(e) => setFilters((f) => ({ ...f, hospitalType: e.target.checked ? t : undefined }))}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="label-text">{t}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="label-text block mb-2">Facilities</label>
            {[
              { key: "isEmergencyReady", label: "Emergency" },
              { key: "hasICU",           label: "ICU" },
              { key: "hasPharmacy",      label: "Pharmacy" },
              { key: "is24x7",           label: "24×7" },
            ].map(({ key, label }) => (
              <label key={key} className="label gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!(filters.facilities || "").includes(key)}
                  onChange={(e) => {
                    const facs = (filters.facilities || "").split(",").filter(Boolean);
                    const next = e.target.checked
                      ? [...new Set([...facs, key])].join(",")
                      : facs.filter((f) => f !== key).join(",");
                    setFilters((f) => ({ ...f, facilities: next || undefined }));
                  }}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <span className="label-text">{label}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {/* Lab-specific */}
      {tab === "lab" && (
        <label className="label gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.homeCollection === "true"}
            onChange={(e) => setFilters((f) => ({ ...f, homeCollection: e.target.checked ? "true" : undefined }))}
            className="checkbox checkbox-primary checkbox-sm"
          />
          <span className="label-text">Home Collection</span>
        </label>
      )}

      {/* Medicine-specific */}
      {tab === "medicine" && (
        <>
          <label className="label gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.otcOnly === "true"}
              onChange={(e) => setFilters((f) => ({ ...f, otcOnly: e.target.checked ? "true" : undefined }))}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="label-text">OTC only</span>
          </label>
          <label className="label gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.prescriptionRequired === "true"}
              onChange={(e) => setFilters((f) => ({ ...f, prescriptionRequired: e.target.checked ? "true" : undefined }))}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="label-text">Rx Required</span>
          </label>
        </>
      )}
    </motion.div>
  );
}

// ── Nearby strip ─────────────────────────────────────────────────────────────
function NearbyStrip({ hospitals, labs, loading }) {
  const items = [
    ...hospitals.map((h) => ({ ...h, _type: "hospital", label: h.name })),
    ...labs.map((l)     => ({ ...l, _type: "lab",      label: l.labName })),
  ].sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99)).slice(0, 8);

  if (loading) return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton flex-shrink-0 w-40 h-24 rounded-xl" />
      ))}
    </div>
  );

  if (!items.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex-shrink-0 w-44 card p-3 cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item._type === "hospital" ? "bg-primary/10" : "bg-success/10"}`}>
              {item._type === "hospital"
                ? <Building2 size={14} className="text-primary" />
                : <TestTube  size={14} className="text-success" />}
            </div>
            <span className="text-xs text-base-content/50 capitalize">{item._type}</span>
          </div>
          <p className="text-xs font-bold text-base-content group-hover:text-primary transition-colors line-clamp-2">{item.label}</p>
          {item.distanceKm != null && (
            <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1">
              <MapPin size={10} />{item.distanceKm.toFixed(1)} km
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

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
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
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
    if (hasSearched && inputValue.trim()) {
      doSearch(inputValue, tab, filters, pages[tab] || 1);
    }
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
    const cat = s.category === "doctor" || s.category === "hospital" || s.category === "lab" || s.category === "medicine"
      ? s.category : "all";
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
  const resultsByTab = {
    all:      null,
    doctor:   doctors,
    hospital: hospitals,
    lab:      labs,
    medicine: medicines,
  };
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
    <div className="min-h-screen bg-base-100">

      {/* ── Hero search header ─────────────────────────────────────────────── */}
      <div
        className="relative  "
        style={{
          background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: "var(--accent)" }} />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10"
            style={{ background: "var(--primary-content)" }} />
        </div>

        <div className="relative z-50 px-2 w-full py-12 pb-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="font-montserrat font-black text-3xl md:text-4xl text-white mb-2">
              Find Healthcare Near You
            </h1>
            <p className="text-white/70 text-sm">Search doctors, hospitals, labs & medicines</p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            ref={dropRef}
            className="relative   w-full flex gap-2 max-w-2xl z-50 mx-auto"
          >
            {/* Icon-Only Go Back Button */}
<motion.button
  whileHover={{ scale: 1.1, x: -2 }}
  whileTap={{ scale: 0.9 }}
  onClick={() => window.history.back()}
  className=" bg-base-100 w-15 h-15 rounded-md   flex items-center justify-center text-base-content/40 hover:text-base-content transition-colors "
  aria-label="Go back"
>
  <ChevronLeft size={20} strokeWidth={2.5} />
</motion.button>
            <div className="flex w-full items-center bg-base-100 rounded-md shadow-2xl overflow-hidden border-2 border-white/20">
              <Search size={18} className="ml-4 text-base-content/40 flex-shrink-0" />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                onFocus={() => debounced.length >= 2 && setShowDropdown(true)}
                placeholder="Search doctors, hospitals, medicines..."
                className="flex-1 px-3 py-4 bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/40"
              />
              <AnimatePresence>
                {inputValue && (
                  <motion.button
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={() => { setInputValue(""); dispatch(clearAutocomplete()); setHasSearched(false); }}
                    className="p-2 text-base-content/40 hover:text-base-content transition-colors"
                  >
                    <X size={16} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Geo button */}
              <button
                onClick={requestGeo}
                title={geo ? "Location active" : "Use my location"}
                className={`p-3 transition-colors ${geo ? "text-success" : "text-base-content/40 hover:text-primary"}`}
              >
                <Navigation size={16} />
              </button>

              <button
                onClick={() => doSearch()}
                className="m-2 px-5 py-2.5 rounded-md text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
                style={{ background: "var(--primary)" }}
              >
                Search
              </button>
            </div>

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showDropdown && (suggestions.length > 0 || acLoading) && (
                <motion.div
                  variants={dropdownVariant}
                  initial="hidden" animate="visible" exit="exit"
                  className="absolute z-50  top-full mt-2 left-0 right-0 bg-base-100 rounded-md shadow-2xl border border-base-300 z-50 overflow-hidden max-h-72 overflow-y-auto scrollbar-thin"
                >
                  {acLoading && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-base-content/50">
                      <Loader2 size={14} className="animate-spin" />Searching...
                    </div>
                  )}
                  {suggestions.map((s, i) => {
                    const tabInfo = TABS.find((t) => t.key === s.category);
                    const Icon = tabInfo?.icon || Search;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(s)}
                        className="w-full flex    items-center gap-3 px-4 py-2.5 hover:bg-base-200 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: `${tabInfo?.color || "var(--primary)"}15` }}>
                          <Icon size={13} style={{ color: tabInfo?.color || "var(--primary)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-base-content truncate">{s.label}</p>
                          {s.sub && <p className="text-xs text-base-content/50 truncate">{s.sub}</p>}
                        </div>
                        <span className="text-xs text-base-content/30 capitalize">{s.category}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Geo status */}
          {geoError && (
            <p className="text-center text-white/60 text-xs mt-3 flex items-center justify-center gap-1">
              <AlertCircle size={12} />Location access denied — using default (Vijayawada)
            </p>
          )}
          {geo && !geoError && (
            <p className="text-center text-white/60 text-xs mt-3 flex items-center justify-center gap-1">
              <CheckCircle size={12} />Using your location
            </p>
          )}

          {/* Tabs */}
          <div className="flex justify-center gap-1 mt-8 flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <motion.button
                  key={t.key}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { setTab(t.key); setFilters({}); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                    ${isActive
                      ? "bg-white text-base-content shadow-lg"
                      : "text-white/80 hover:text-white hover:bg-white/15"
                    }`}
                >
                  <Icon size={14} style={isActive ? { color: t.color } : {}} />
                  {t.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="container-custom z-10 py-8">

        {/* ── Pre-search state ──────────────────────────────────────────── */}
        {!hasSearched && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-10">

            {/* Nearby */}
            {(nearbyLoading || nearbyHosp.length > 0 || nearbyLab.length > 0) && (
              <motion.section variants={fadeUp}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-montserrat font-extrabold text-base text-base-content flex items-center gap-2">
                    <Navigation size={16} className="text-primary" />
                    {geo ? "Nearby" : "Nearby in Vijayawada"}
                  </h2>
                  {!geo && (
                    <button onClick={requestGeo} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Wifi size={12} />Use my location
                    </button>
                  )}
                </div>
                <NearbyStrip hospitals={nearbyHosp} labs={nearbyLab} loading={nearbyLoading} />
              </motion.section>
            )}

            {/* Trending */}
            <motion.section variants={fadeUp}>
              <h2 className="font-montserrat font-extrabold text-base text-base-content flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-primary" />Trending searches
              </h2>
              {trendLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="skeleton h-8 rounded-full" style={{ width: `${60 + i * 15}px` }} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trending.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Chip onClick={() => handleQuickSearch(t.query, t.category)}>
                        <TrendingUp size={10} />
                        {t.query}
                        <span className="text-base-content/40 text-xs">{t.searchCount}</span>
                      </Chip>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>

            {/* Recent */}
            {recent.length > 0 && (
              <motion.section variants={fadeUp}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-montserrat font-extrabold text-base text-base-content flex items-center gap-2">
                    <Clock size={16} className="text-primary" />Recent searches
                  </h2>
                  <button
                    onClick={() => dispatch(clearRecentSearches())}
                    className="text-xs text-error hover:underline flex items-center gap-1"
                    disabled={recentLoading}
                  >
                    <Trash2 size={12} />Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-1 bg-base-200 border border-base-300 rounded-full pl-3 pr-1 py-1"
                    >
                      <button
                        onClick={() => handleQuickSearch(r.query, r.category)}
                        className="text-xs font-semibold text-base-content/80 hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <Clock size={10} className="text-base-content/40" />
                        {r.query}
                        <span className="text-base-content/40 capitalize">·{r.category}</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteRecent(r.query, e)}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-base-300 transition-colors text-base-content/40 hover:text-error"
                      >
                        <X size={10} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Specializations */}
            {specs.length > 0 && (
              <motion.section variants={fadeUp}>
                <h2 className="font-montserrat font-extrabold text-base text-base-content flex items-center gap-2 mb-4">
                  <Stethoscope size={16} className="text-primary" />Browse by specialization
                </h2>
                <div className="flex flex-wrap gap-2">
                  {specs.slice(0, 16).map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Chip onClick={() => {
                        setTab("doctor");
                        setFilters({ specialization: s.specialization });
                        doSearch("", "doctor", { specialization: s.specialization });
                        setInputValue(s.specialization);
                      }}>
                        <UserCheck size={10} />
                        {s.specialization}
                        <span className="text-base-content/40">{s.doctorCount}</span>
                      </Chip>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </motion.div>
        )}

        {/* ── Post-search results ────────────────────────────────────────── */}
        {hasSearched && (
          <div className="flex gap-6">

            {/* Filter sidebar (desktop) */}
            <AnimatePresence>
              {(showFilters || true) && tab !== "all" && (
                <aside className="hidden lg:block w-56 flex-shrink-0">
                  <FilterPanel
                    tab={tab}
                    filters={filters}
                    setFilters={(fn) => {
                      setFilters(fn);
                    }}
                    specializations={specs}
                  />
                </aside>
              )}
            </AnimatePresence>

            {/* Results */}
            <div className="flex-1 min-w-0">

              {/* Results header */}
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <h2 className="font-montserrat font-extrabold text-base text-base-content">
                    {tab === "all" ? "All results" : `${TABS.find((t) => t.key === tab)?.label}`}
                    {inputValue && (
                      <span className="text-base-content/40 font-normal"> for "{inputValue}"</span>
                    )}
                  </h2>
                  {tab !== "all" && current?.pagination?.total != null && (
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {current.pagination.total} results
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Mobile filter toggle */}
                  {tab !== "all" && (
                    <button
                      onClick={() => setShowFilters((v) => !v)}
                      className="lg:hidden btn btn-ghost btn-sm gap-1.5"
                    >
                      <Filter size={14} />Filters
                    </button>
                  )}

                  {/* Loading indicator */}
                  {(currentLoading || anyLoading) && (
                    <div className="flex items-center gap-1.5 text-xs text-base-content/50">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      Searching...
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile filters */}
              <AnimatePresence>
                {showFilters && tab !== "all" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="lg:hidden mb-5 overflow-hidden"
                  >
                    <FilterPanel
                      tab={tab}
                      filters={filters}
                      setFilters={setFilters}
                      specializations={specs}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Loading skeletons ──────────────────────────────────── */}
              {currentLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              )}

              {/* ── Empty ──────────────────────────────────────────────── */}
              {showEmpty && <EmptyState query={inputValue} />}

              {/* ── Global (All tab) ───────────────────────────────────── */}
              {tab === "all" && !global.loading && hasSearched && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="global"
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                  >
                    {global.doctors.length === 0 &&
                     global.hospitals.length === 0 &&
                     global.labs.length === 0 &&
                     global.medicines.length === 0 && (
                      <EmptyState query={inputValue} />
                    )}

                    <GlobalSection title="Doctors" icon={Stethoscope} color="#0ea5e9" count={global.doctors.length}>
                      {global.doctors.map((d, i) => <DoctorCard key={i} doc={d} />)}
                    </GlobalSection>

                    <GlobalSection title="Hospitals" icon={Building2} color="#8b5cf6" count={global.hospitals.length}>
                      {global.hospitals.map((h, i) => <HospitalCard key={i} hosp={h} />)}
                    </GlobalSection>

                    <GlobalSection title="Labs" icon={FlaskConical} color="#10b981" count={global.labs.length}>
                      {global.labs.map((l, i) => <LabCard key={i} lab={l} />)}
                    </GlobalSection>

                    <GlobalSection title="Medicines" icon={Pill} color="#f59e0b" count={global.medicines.length}>
                      {global.medicines.map((m, i) => <MedicineCard key={i} med={m} />)}
                    </GlobalSection>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Entity results ──────────────────────────────────────── */}
              {tab !== "all" && !currentLoading && currentData.length > 0 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${tab}-${pages[tab]}`}
                    variants={stagger}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {tab === "doctor"   && currentData.map((d, i) => <DoctorCard   key={i} doc={d}  />)}
                    {tab === "hospital" && currentData.map((h, i) => <HospitalCard key={i} hosp={h} />)}
                    {tab === "lab"      && currentData.map((l, i) => <LabCard      key={i} lab={l}  />)}
                    {tab === "medicine" && currentData.map((m, i) => <MedicineCard key={i} med={m}  />)}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Pagination ──────────────────────────────────────────── */}
              {tab !== "all" && (
                <Pagination
                  pagination={currentPagination}
                  onPageChange={handlePageChange}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}