"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Droplets,
  MapPin,
  Phone,
  Star,
  Search,
  SlidersHorizontal,
  Zap,
  Truck,
  Award,
  X,
  ArrowRight,
  Heart,
  Navigation,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchBloodBanks,
  fetchNearbyBanks,
} from "@/store/slices/bloodbankSlice";
import { selectUser } from "@/store/slices/userSlice";

// ── Constants ────────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPONENTS = ["Whole Blood", "PRBC", "FFP", "Platelets", "Cryoprecipitate", "Plasma"];
const BANK_TYPES = [
  { value: "standalone", label: "Standalone" },
  { value: "hospital_embedded", label: "Hospital Embedded" },
  { value: "mobile_unit", label: "Mobile Unit" },
];
const STATUS_COLORS = {
  active: "badge-success",
  pending: "badge-warning",
  suspended: "badge-error",
  default: "badge-secondary",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function BloodGroupPill({ group, active, onClick, size = "sm" }) {
  const isNeg = group.includes("-");
  const baseSize = size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseSize} inline-flex items-center justify-center font-black rounded-full border-2 transition-all ${
          active
            ? "border-red-500 bg-red-500 text-white scale-110"
            : "border-base-300 text-base-content/60 hover:border-red-300"
        }`}
        style={{ fontFamily: "var(--font-family-montserrat)" }}
      >
        {group}
      </button>
    );
  }
  return (
    <span
      className={`${baseSize} inline-flex items-center justify-center font-black rounded-full border-2 ${
        isNeg ? "border-rose-200 bg-rose-50 text-rose-700" : "border-red-200 bg-red-50 text-red-700"
      }`}
      style={{ fontFamily: "var(--font-family-montserrat)" }}
    >
      {group}
    </span>
  );
}

function BankCard({ bank, index }) {
  const statusClass = STATUS_COLORS[bank.status] || STATUS_COLORS.default;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, duration: 0.4, ease: "easeOut" }}
      className="group"
    >
      <Link href={`/blood-bank/${bank._id}`}>
        <div
          className="relative bg-white border border-base-300 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-red-300 hover:-translate-y-1"
          style={{ boxShadow: "0 2px 12px rgba(220,38,38,0.04)" }}
        >
          {/* Red accent bar */}
          <div
            className="h-1 w-full"
            style={{ background: "linear-gradient(90deg,#dc2626,#f87171,#dc2626)" }}
          />
          {/* Featured badge */}
          {bank.isFeatured && (
            <div className="absolute top-4 right-4 z-10">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#92400e" }}
              >
                <Award size={9} /> Featured
              </span>
            </div>
          )}

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-red-100 overflow-hidden"
                style={{ background: "linear-gradient(135deg,#fee2e2,#fecaca)" }}
              >
                {bank.logoUrl ? (
                  <img src={bank.logoUrl} alt={bank.name} className="w-full h-full object-cover" />
                ) : (
                  <Droplets size={22} className="text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`badge badge-xs ${statusClass} capitalize`}>{bank.status}</span>
                  {bank.isEmergency24x7 && (
                    <span className="badge badge-xs badge-error gap-1"><Zap size={8} /> 24/7</span>
                  )}
                </div>
                <h3
                  className="font-extrabold text-sm text-base-content leading-snug line-clamp-2"
                  style={{ fontFamily: "var(--font-family-montserrat)" }}
                >
                  {bank.name}
                </h3>
                <p className="text-xs text-base-content/40 mt-0.5 font-mono">{bank.bankCode}</p>
              </div>
            </div>

            {/* Rating */}
            {bank.rating?.totalRatings > 0 && (
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={10}
                      className={
                        s <= Math.round(bank.rating.averageRating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-base-300 fill-base-300"
                      }
                    />
                  ))}
                </div>
                <span className="text-xs text-base-content/50">
                  {bank.rating.averageRating?.toFixed(1)} ({bank.rating.totalRatings})
                </span>
              </div>
            )}

            {/* Address / Phone */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-base-content/60 line-clamp-2 leading-relaxed">
                  {bank.address?.line1}, {bank.address?.city}, {bank.address?.state}
                </span>
              </div>
              {bank.contact?.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs text-base-content/60">{bank.contact.phone}</span>
                </div>
              )}
            </div>

            {/* Blood groups */}
            {bank.bloodGroupsAvailable?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-base-content/35 uppercase tracking-wider mb-2">
                  Available Groups
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {bank.bloodGroupsAvailable.slice(0, 6).map((g) => (
                    <BloodGroupPill key={g} group={g} />
                  ))}
                  {bank.bloodGroupsAvailable.length > 6 && (
                    <span className="w-9 h-9 rounded-full bg-base-200 flex items-center justify-center text-xs text-base-content/40 font-bold">
                      +{bank.bloodGroupsAvailable.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Services */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {bank.offersDelivery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                  <Truck size={9} /> Delivery
                </span>
              )}
              {bank.offersCrossMatch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-100">
                  <CheckCircle2 size={9} /> Cross-Match
                </span>
              )}
              {bank.acceptsDonations && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-100">
                  <Heart size={9} /> Donations
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-base-200">
              <span className="text-xs text-base-content/35 capitalize">
                {bank.bankType?.replace(/_/g, " ")}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 group-hover:gap-2 transition-all">
                View Details <ArrowRight size={11} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function FilterSidebar({ filters, onChange, onClose }) {
  const [local, setLocal] = useState(filters);
  const update = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

  const apply = () => { onChange(local); onClose?.(); };
  const reset = () => {
    const c = { city: "", bloodGroup: "", component: "", bankType: "", emergency: false, featured: false };
    setLocal(c); onChange(c); onClose?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="bg-white border border-base-300 rounded-2xl p-5 space-y-5 sticky top-24"
      style={{ boxShadow: "0 4px 24px rgba(220,38,38,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-sm text-base-content" style={{ fontFamily: "var(--font-family-montserrat)" }}>
          Filters
        </h3>
        <button onClick={reset} className="text-xs text-red-500 font-semibold hover:text-red-700">
          Reset all
        </button>
      </div>

      <div>
        <label className="label-text mb-1.5 block text-xs">City</label>
        <input
          type="text"
          placeholder="e.g. Vijayawada"
          value={local.city}
          onChange={(e) => update("city", e.target.value)}
          className="input-field text-sm"
        />
      </div>

      <div>
        <label className="label-text mb-2 block text-xs">Blood Group</label>
        <div className="grid grid-cols-4 gap-1.5">
          {BLOOD_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => update("bloodGroup", local.bloodGroup === g ? "" : g)}
              className={`py-1.5 rounded-lg text-xs font-black border-2 transition-all ${
                local.bloodGroup === g
                  ? "border-red-500 bg-red-50 text-red-600"
                  : "border-base-300 text-base-content/50 hover:border-red-200"
              }`}
              style={{ fontFamily: "var(--font-family-montserrat)" }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label-text mb-1.5 block text-xs">Component</label>
        <select value={local.component} onChange={(e) => update("component", e.target.value)} className="input-field text-sm">
          <option value="">All Components</option>
          {COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="label-text mb-1.5 block text-xs">Bank Type</label>
        <select value={local.bankType} onChange={(e) => update("bankType", e.target.value)} className="input-field text-sm">
          <option value="">All Types</option>
          {BANK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {[
          { key: "emergency", label: "24/7 Emergency", icon: Zap },
          { key: "featured", label: "Featured Only", icon: Award },
        ].map(({ key, label, icon: Icon }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2 text-xs text-base-content/70">
              <Icon size={12} className="text-red-400" /> {label}
            </span>
            <button
              role="switch"
              aria-checked={local[key]}
              onClick={() => update(key, !local[key])}
              className={`relative inline-flex w-9 h-5 rounded-full border-2 transition-all ${
                local[key] ? "bg-red-500 border-red-500" : "bg-base-200 border-base-300"
              }`}
            >
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${local[key] ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </label>
        ))}
      </div>

      <button
        onClick={apply}
        className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110"
        style={{ background: "linear-gradient(135deg,#dc2626,#f87171)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}
      >
        Apply Filters
      </button>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-base-300 rounded-2xl overflow-hidden">
      <div className="h-1 bg-base-300 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-xl skeleton" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-14 skeleton rounded" />
            <div className="h-4 w-3/4 skeleton rounded" />
          </div>
        </div>
        <div className="h-3 w-full skeleton rounded" />
        <div className="h-3 w-2/3 skeleton rounded" />
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="w-9 h-9 rounded-full skeleton" />)}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function BloodBankPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { banks, total, pages, loading } = useSelector((s) => s.bloodBank);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [filters, setFilters] = useState({
    city: "", bloodGroup: "", component: "", bankType: "", emergency: false, featured: false,
  });

  const loadBanks = useCallback(() => {
    dispatch(fetchBloodBanks({
      page, limit: 12,
      ...(filters.city && { city: filters.city }),
      ...(filters.bloodGroup && { bloodGroup: filters.bloodGroup }),
      ...(filters.component && { component: filters.component }),
      ...(filters.bankType && { bankType: filters.bankType }),
      ...(filters.emergency && { emergency: "true" }),
      ...(filters.featured && { featured: "true" }),
    }));
  }, [dispatch, page, filters]);

  useEffect(() => { if (!nearbyMode) loadBanks(); }, [loadBanks, nearbyMode]);

  const handleNearby = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearbyMode(true);
        dispatch(fetchNearbyBanks({
          lat: pos.coords.latitude, lng: pos.coords.longitude, radius: 25,
          ...(filters.bloodGroup && { bloodGroup: filters.bloodGroup }),
          ...(filters.component && { component: filters.component }),
        }));
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); alert("Location access denied."); }
    );
  };

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 55%,#b91c1c 100%)" }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="absolute top-10 right-0 w-48 h-48 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute bottom-0 left-1/2 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
          {/* big decorative text */}
          <span
            className="absolute -bottom-6 right-8 text-9xl font-black select-none opacity-5 text-white"
            style={{ fontFamily: "var(--font-family-montserrat)" }}
          >
            AB+
          </span>
        </div>

        <div className="container-custom max-w-6xl py-12 md:py-18 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold uppercase tracking-widest mb-5">
              <Droplets size={12} className="text-red-200" />
              Likeson Blood Bank Network
            </div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] mb-4"
              style={{ fontFamily: "var(--font-family-montserrat)" }}
            >
              Find Blood.
              <br />
              <span className="text-red-200">Save Lives.</span>
            </h1>
            <p className="text-white/65 text-sm md:text-base max-w-lg mx-auto mb-8">
              Locate verified blood banks instantly. Search by blood group, component, or your location.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto mb-6">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-300 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setFilters((f) => ({ ...f, city: search })); setPage(1); setNearbyMode(false); }
                  }}
                  placeholder="Search by city, name…"
                  className="w-full pl-11 pr-32 py-3.5 rounded-2xl text-sm bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/25 focus:bg-white/15 transition-all"
                />
                <button
                  onClick={handleNearby}
                  disabled={geoLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-red-600 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  {geoLoading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                  Nearby
                </button>
              </div>
            </div>

            {/* Quick blood group pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {BLOOD_GROUPS.map((g) => (
                <BloodGroupPill
                  key={g}
                  group={g}
                  active={filters.bloodGroup === g}
                  onClick={() => {
                    setFilters((f) => ({ ...f, bloodGroup: f.bloodGroup === g ? "" : g }));
                    setPage(1); setNearbyMode(false);
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="border-b border-base-300 bg-base-200">
        <div className="container-custom max-w-6xl py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-base-content/60">
                  <strong className="text-base-content">{total}</strong>{" "}
                  {nearbyMode ? "nearby" : "active"} blood banks
                </span>
              </div>
              {nearbyMode && (
                <button
                  onClick={() => { setNearbyMode(false); setPage(1); }}
                  className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:text-red-700"
                >
                  <X size={11} /> Clear location
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showFilters || activeFilters > 0
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-white border-base-300 text-base-content/60 hover:border-red-200"
              }`}
            >
              <SlidersHorizontal size={13} />
              Filters
              {activeFilters > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="container-custom max-w-6xl py-8">
        <div className={`flex gap-6 ${showFilters ? "flex-col lg:flex-row" : ""}`}>
          {/* Filter sidebar */}
          <AnimatePresence>
            {showFilters && (
              <div className="w-full lg:w-64 flex-shrink-0">
                <FilterSidebar
                  filters={filters}
                  onChange={(f) => { setFilters(f); setPage(1); setNearbyMode(false); }}
                  onClose={() => setShowFilters(false)}
                />
              </div>
            )}
          </AnimatePresence>

          {/* Cards grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : banks.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "linear-gradient(135deg,#fee2e2,#fecaca)" }}
                >
                  <Droplets size={30} className="text-red-400" />
                </div>
                <h3 className="text-xl font-extrabold text-base-content mb-2" style={{ fontFamily: "var(--font-family-montserrat)" }}>
                  No blood banks found
                </h3>
                <p className="text-base-content/50 text-sm mb-6">Try adjusting filters or searching a different area.</p>
                <button
                  onClick={() => {
                    setFilters({ city: "", bloodGroup: "", component: "", bankType: "", emergency: false, featured: false });
                    setSearch(""); setPage(1); setNearbyMode(false);
                  }}
                  className="btn btn-sm border-red-300 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                >
                  Clear filters
                </button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {banks.map((bank, i) => <BankCard key={bank._id} bank={bank} index={i} />)}
                </div>

                {/* Pagination */}
                {!nearbyMode && pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-9 h-9 rounded-xl flex items-center justify-center border border-base-300 text-base-content/50 hover:border-red-300 disabled:opacity-40 transition-all"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                          page === p ? "text-white" : "text-base-content/60 hover:bg-base-200"
                        }`}
                        style={page === p ? { background: "linear-gradient(135deg,#dc2626,#f87171)" } : {}}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page === pages}
                      className="w-9 h-9 rounded-xl flex items-center justify-center border border-base-300 text-base-content/50 hover:border-red-300 disabled:opacity-40 transition-all"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}