"use client";

import React, { useRef, useEffect, useCallback, memo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Bed,
  Stethoscope,
  Plus,
  MapPin,
  Navigation,
  Search,
  X,
  Loader2,
} from "lucide-react";
import {
  fetchAllHospitals,
  fetchNearbyHospitals,
  selectHospitals,
  selectNearbyHospitals,
  selectIsLoadingHospitals,
  selectIsLoadingNearbyHospitals,
} from "@/store/slices/hospitalSlice";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

// ─── Geocode helper ───────────────────────────────────────────────────────────
async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_MAPS_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
  } catch {
    // silent fallback
  }
  return null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const HospitalCardSkeleton = memo(() => (
  <div
    className="min-w-[300px] md:min-w-[380px] h-[500px] rounded-[var(--r-box)] bg-base-200 animate-pulse border border-base-300 snap-start shrink-0"
    aria-label="Loading hospital data"
  />
));
HospitalCardSkeleton.displayName = "HospitalCardSkeleton";

// ─── Hospital Card ────────────────────────────────────────────────────────────
const HospitalCard = memo(({ hospital, index }) => {
  const isPriority = index < 3;
  const imageSrc   = hospital?.logo || hospital?.images?.[0] || "/api/placeholder/800/1200";

  return (
    <div className="group relative min-w-[300px] md:min-w-[380px] h-[500px] rounded-[var(--r-box)] overflow-hidden bg-base-100 border border-base-300 transition-all duration-500 hover:border-primary shadow-sm hover:shadow-[var(--shadow-xl)] snap-start shrink-0 flex flex-col">
      <div className="absolute inset-0 z-0 overflow-hidden bg-base-200">
        <Image
          src={imageSrc}
          alt={`Image of ${hospital.name}`}
          fill
          sizes="(max-width: 768px) 300px, 380px"
          priority={isPriority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_top,var(--base-100)_0%,color-mix(in_oklch,var(--base-100)_40%,transparent)_40%,transparent_100%)] pointer-events-none"
          aria-hidden="true"
        />
      </div>

      <div className="absolute top-6 inset-x-6 flex justify-between items-start z-20 pointer-events-none">
        <div className="flex flex-col gap-2">
          {hospital.isVerified && (
            <div
              className="w-8 h-8 rounded-[var(--r-field)] bg-success text-success-content flex items-center justify-center shadow-lg"
              title="Verified Facility"
            >
              <ShieldCheck size={18} aria-hidden="true" />
            </div>
          )}
          <div className="px-3 py-1 rounded-[var(--r-selector)] bg-primary text-primary-content text-[9px] font-bold tracking-widest uppercase shadow-sm">
            {hospital.hospitalType || "Multi-Specialty"}
          </div>
        </div>
        <div className="bg-base-100/90 backdrop-blur-md border border-base-300 px-3 py-1.5 rounded-[var(--r-selector)] flex items-center gap-2 shadow-sm">
          <Star size={12} className="text-accent fill-accent" aria-hidden="true" />
          <span className="text-xs font-bold text-base-content leading-none font-poppins">
            {hospital.rating?.averageRating?.toFixed(1) || "0.0"}
          </span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-6 bg-base-100 border-t border-base-300 transform translate-y-[72px] group-hover:translate-y-0 transition-transform duration-500 ease-in-out">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-selector)] bg-success/10 text-success text-[9px] font-bold uppercase border border-success/20">
            <span className="h-1 w-1 rounded-full bg-success animate-pulse" aria-hidden="true" />
            Available Now
          </div>
          {/* distance injected by $geoNear aggregation */}
          {hospital.distance && (
            <span className="text-base-content/40 text-[9px] font-bold tracking-widest uppercase font-poppins">
              • {hospital.distance}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-base-content leading-tight mb-4 group-hover:text-primary transition-colors line-clamp-1 font-montserrat">
          {hospital.name}
        </h3>

        <div className="grid grid-cols-3 gap-0 border border-base-300 mb-6 bg-[linear-gradient(to_bottom_right,color-mix(in_oklch,var(--base-200)_50%,transparent),var(--base-100))] rounded-[var(--r-field)] overflow-hidden">
          <div className="flex flex-col items-center justify-center p-3 border-r border-base-300">
            <Bed size={16} className="text-primary mb-1" aria-hidden="true" />
            <span className="text-base-content font-bold text-sm font-poppins">
              {hospital.bedCount?.total || 0}
            </span>
            <span className="text-base-content/40 text-[7px] uppercase font-bold tracking-tighter">Beds</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 border-r border-base-300">
            <Stethoscope size={16} className="text-secondary mb-1" aria-hidden="true" />
            <span className="text-base-content font-bold text-sm font-poppins">
              {hospital.specialties?.length || 0}
            </span>
            <span className="text-base-content/40 text-[7px] uppercase font-bold tracking-tighter">Depts</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3">
            <Zap size={16} className="text-error mb-1" aria-hidden="true" />
            <span className="text-base-content font-bold text-sm font-poppins">24/7</span>
            <span className="text-base-content/40 text-[7px] uppercase font-bold tracking-tighter">ER</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Link
            href={`/hospitals/${hospital.slug}`}
            className="flex-grow h-12 rounded-[var(--r-field)] bg-neutral text-neutral-content font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary outline-none"
            aria-label={`Book appointment at ${hospital.name}`}
          >
            Book Appointment <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <Link
          href={`/hospitals/${hospital?.slug}`}
          className="flex w-full h-11 items-center justify-center rounded-[var(--r-field)] bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider hover:bg-primary hover:text-primary-content transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary outline-none"
          aria-label={`Get more details about ${hospital.name}`}
        >
          Get Details
        </Link>
      </div>
    </div>
  );
});
HospitalCard.displayName = "HospitalCard";

// ─── Location Bar ─────────────────────────────────────────────────────────────
const LocationBar = memo(({ mode, manualAddress, locationLabel, onUseGPS, onManualSearch, onClear, gpsLoading, gpsError }) => {
  const [inputVal, setInputVal] = useState(manualAddress || "");

  return (
    <div className="flex flex-wrap items-center gap-3 mb-8 px-4">
      <button
        onClick={onUseGPS}
        disabled={gpsLoading || mode === "user"}
        className={`flex items-center gap-2 h-10 px-4 rounded-[var(--r-field)] border text-xs font-bold uppercase tracking-wider transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed
          ${mode === "nearby" || mode === "user"
            ? "bg-primary text-primary-content border-primary"
            : "bg-base-100 text-base-content border-base-300 hover:border-primary hover:text-primary"
          }`}
      >
        {gpsLoading
          ? <Loader2 size={14} className="animate-spin" />
          : <Navigation size={14} />
        }
        {mode === "user" ? "Location Active ✓" : mode === "nearby" ? "Near Me ✓" : "Use My Location"}
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm h-10 px-4 rounded-[var(--r-field)] border border-base-300 bg-base-100 focus-within:border-primary transition-colors">
        <MapPin size={14} className="text-base-content/40 shrink-0" />
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && inputVal.trim().length > 2 && onManualSearch(inputVal.trim())}
          placeholder="Enter city or area…"
          className="flex-1 bg-transparent text-xs text-base-content placeholder:text-base-content/30 outline-none font-poppins"
        />
        {inputVal && (
          <button onClick={() => { setInputVal(""); onClear(); }} className="text-base-content/30 hover:text-base-content transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      <button
        onClick={() => inputVal.trim().length > 2 && onManualSearch(inputVal.trim())}
        className="flex items-center gap-2 h-10 px-4 rounded-[var(--r-field)] border border-base-300 bg-base-100 text-xs font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Search size={14} /> Search
      </button>

      <span className="text-[10px] text-base-content/40 font-poppins">
        {mode === "user"    ? `📍 Near ${locationLabel || "your saved location"} • 100 km radius`
        : mode === "nearby" ? "📍 Near your current location • 100 km radius"
        : mode === "manual" || mode === "manual-near" ? `🔍 Near "${manualAddress}" • 100 km radius`
        : "Showing all hospitals"}
      </span>

      {gpsError && <span className="text-[10px] text-error font-poppins">{gpsError}</span>}
    </div>
  );
});
LocationBar.displayName = "LocationBar";

// ─── Main Component ───────────────────────────────────────────────────────────
const HomeHospitals = () => {
  const scrollRef = useRef(null);
  const dispatch  = useDispatch();

  const user            = useSelector((s) => s.user?.user) ?? null;
  const allHospitals    = useSelector(selectHospitals);
  const nearbyHospitals = useSelector(selectNearbyHospitals);
  const loadingAll      = useSelector(selectIsLoadingHospitals);
  const loadingNearby   = useSelector(selectIsLoadingNearbyHospitals);

  const [mode, setMode]                   = useState("all");
  const [manualAddress, setManualAddress] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [gpsLoading, setGpsLoading]       = useState(false);
  const [gpsError, setGpsError]           = useState("");

  const isNearbyMode = mode === "user" || mode === "nearby" || mode === "manual-near";
  const hospitals    = isNearbyMode ? nearbyHospitals : allHospitals;
  const loading      = isNearbyMode ? loadingNearby   : loadingAll;

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.location?.coordinates) {
      const [lng, lat] = user.location.coordinates;
      if (lng !== 0 || lat !== 0) {
        // Use 100km — no distance param means backend defaults to 100
        dispatch(fetchNearbyHospitals({ lat, lng, limit: 12 }));
        setMode("user");
        setLocationLabel(user.lastKnownAddress || "your saved location");
        return;
      }
    }
    // Guest — show all hospitals
    if (!allHospitals?.length) {
      dispatch(fetchAllHospitals({ limit: 12 }));
    }
    setMode("all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const handleUseGPS = useCallback(() => {
    if (mode === "user") return; // already using stored coords
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported. Enter your area manually.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // No distance param → backend uses 100km default
        dispatch(fetchNearbyHospitals({ lat: coords.latitude, lng: coords.longitude, limit: 12 }));
        setMode("nearby");
        setManualAddress("");
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? "Permission denied. Enter your area manually."
            : "Could not get location. Enter manually."
        );
        setGpsLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [dispatch, mode]);

  // ── Manual search ─────────────────────────────────────────────────────────
  const handleManualSearch = useCallback(async (address) => {
    setGpsError("");
    const coords = await geocodeAddress(address);
    if (coords) {
      // No distance param → backend uses 100km default
      dispatch(fetchNearbyHospitals({ lat: coords.lat, lng: coords.lng, limit: 12 }));
      setMode("manual-near");
    } else {
      dispatch(fetchAllHospitals({ city: address, limit: 12 }));
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
        dispatch(fetchNearbyHospitals({ lat, lng, limit: 12 }));
        setMode("user");
        return;
      }
    }
    if (!allHospitals?.length) dispatch(fetchAllHospitals({ limit: 12 }));
    setMode("all");
  }, [dispatch, user, allHospitals]);

  const scroll = useCallback((dir) => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  }, []);

  return (
    <section className="py-20 bg-base-100 relative overflow-hidden" aria-label="Top Hospitals and Medical Centers">
      <div
        className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--base-content)_100%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--base-content)_100%,transparent)_1px,transparent_1px)] bg-[length:40px_40px]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 px-4 gap-8">
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-base-content tracking-tighter leading-[1.05] mb-6 font-montserrat">
              Verified <span className="text-gradient-primary">Hospitals</span> &{" "}
              <br className="hidden md:block" />
              Medical Centers
            </h2>
            <div className="h-1.5 w-24 bg-[var(--bg-gradient-primary)] mb-8 rounded-full" aria-hidden="true" />
            <p className="text-base-content/70 text-base md:text-lg font-medium max-w-xl leading-relaxed font-poppins">
              Find and connect with{" "}
              <strong className="text-base-content font-bold">top-rated medical facilities</strong>.
              Access <span className="text-primary font-bold">real-time bed availability</span>,{" "}
              <strong className="text-base-content font-bold">specialized departments</strong>, and{" "}
              <span className="text-error font-bold">emergency contact details</span> in one click.
            </p>
          </div>

          <div className="flex flex-col items-end gap-6">
            <div className="flex border border-base-300 rounded-[var(--r-field)] overflow-hidden bg-base-100 shadow-sm">
              <button
                onClick={() => scroll("left")}
                aria-label="Scroll left"
                className="w-14 h-14 text-base-content hover:bg-primary hover:text-primary-content transition-colors flex items-center justify-center border-r border-base-300 outline-none"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => scroll("right")}
                aria-label="Scroll right"
                className="w-14 h-14 text-base-content hover:bg-primary hover:text-primary-content transition-colors flex items-center justify-center outline-none"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        </header>

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

        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-12 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          role="region"
          aria-label="List of hospitals"
        >
          {loading ? (
            [...Array(4)].map((_, i) => <HospitalCardSkeleton key={i} />)
          ) : hospitals?.length > 0 ? (
            <>
              {hospitals.map((hospital, index) => (
                <HospitalCard key={hospital._id} hospital={hospital} index={index} />
              ))}
              <Link
                href="/hospitals"
                className="min-w-[280px] h-[500px] rounded-[var(--r-box)] border-2 border-dashed border-base-300 bg-base-100/50 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary transition-all duration-300 group snap-start shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="View all healthcare facilities"
              >
                <div className="w-16 h-16 rounded-[var(--r-field)] border border-base-300 flex items-center justify-center text-base-content/40 group-hover:bg-primary group-hover:text-primary-content group-hover:border-primary transition-all duration-300 shadow-sm">
                  <Plus size={32} />
                </div>
                <span className="mt-5 text-[11px] font-bold text-base-content/50 uppercase tracking-widest group-hover:text-primary transition-colors">
                  View All Facilities
                </span>
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-w-full py-20 text-base-content/40 gap-4">
              <MapPin size={48} className="opacity-20" />
              <p className="text-sm font-poppins">
                {isNearbyMode
                  ? "No hospitals found within 100 km. Try searching a different area."
                  : "No hospitals available right now."}
              </p>
              {isNearbyMode && (
                <button onClick={handleClear} className="text-xs font-bold text-primary uppercase tracking-wider hover:underline">
                  Show all hospitals instead
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomeHospitals;