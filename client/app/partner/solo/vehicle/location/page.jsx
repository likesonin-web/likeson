"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Navigation, Search, Loader2, CheckCircle2,
  AlertTriangle, Map, Crosshair, Building2, Hash,
  RefreshCw, Clock, Info, ChevronLeft
} from "lucide-react";
import {
  updateVehicleLocation,
  selectVehicle, selectLoading, selectError
} from "@/store/slices/soloDriverSlice";
import Container from "@/components/ui/Container";

// ── constants ─────────────────────────────────────────────────────────────────
const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

// ── FieldNote ─────────────────────────────────────────────────────────────────
function FieldNote({ children }) {
  return (
    <p className="flex items-start gap-1 text-xs text-base-content/40 mt-1 leading-relaxed">
      <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" />
      {children}
    </p>
  );
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function Dot({ color = "bg-success", size = 2 }) {
  return (
    <span className="relative inline-flex" style={{ width: size * 4, height: size * 4 }}>
      <span
        className={`absolute inline-flex rounded-full animate-ping opacity-70 ${color}`}
        style={{ width: size * 4, height: size * 4 }}
      />
      <span
        className={`relative inline-flex rounded-full ${color}`}
        style={{ width: size * 4, height: size * 4 }}
      />
    </span>
  );
}

// ── Google Map ────────────────────────────────────────────────────────────────
function LiveMap({ lat, lng, onMapClick }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const markerRef   = useRef(null);
  const [loaded, setLoaded] = useState(false);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const center = { lat: lat || 16.506, lng: lng || 80.648 };

    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      mapTypeId: "roadmap",
      styles: [
        { featureType: "all",         elementType: "geometry",          stylers: [{ color: "#f1f5f9" }] },
        { featureType: "all",         elementType: "labels.text.fill",  stylers: [{ color: "#475569" }] },
        { featureType: "all",         elementType: "labels.text.stroke",stylers: [{ color: "#f8fafc" }] },
        { featureType: "road",        elementType: "geometry",          stylers: [{ color: "#e2e8f0" }] },
        { featureType: "road.highway",elementType: "geometry",          stylers: [{ color: "#cbd5e1" }] },
        { featureType: "water",       elementType: "geometry",          stylers: [{ color: "#bae6fd" }] },
        { featureType: "poi",         elementType: "all",               stylers: [{ visibility: "off" }] },
        { featureType: "landscape",   elementType: "geometry",          stylers: [{ color: "#f8fafc" }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
      gestureHandling: "cooperative",
    });

    markerRef.current = new window.google.maps.Marker({
      position: center,
      map: mapInstance.current,
      draggable: true,
      icon: {
        path:        window.google.maps.SymbolPath.CIRCLE,
        scale:       10,
        fillColor:   "#2563eb",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
      title: "Your Location",
    });

    markerRef.current.addListener("dragend", () => {
      const pos = markerRef.current.getPosition();
      onMapClick(pos.lat(), pos.lng());
    });

    mapInstance.current.addListener("click", (e) => {
      const pos = e.latLng;
      markerRef.current.setPosition(pos);
      onMapClick(pos.lat(), pos.lng());
    });

    setLoaded(true);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (window.google) { initMap(); return; }
    const id = "gmaps-sdk";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id    = id;
      s.src   = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places,geocoding`;
      s.async = true;
      s.defer = true;
      s.onload = initMap;
      document.head.appendChild(s);
    } else {
      const t = setInterval(() => { if (window.google) { clearInterval(t); initMap(); } }, 200);
    }
  }, [initMap]);

  // Sync marker when coords change from outside
  useEffect(() => {
    if (loaded && markerRef.current && lat && lng) {
      const pos = { lat, lng };
      markerRef.current.setPosition(pos);
      mapInstance.current?.panTo(pos);
    }
  }, [lat, lng, loaded]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 bg-base-200 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-base-content/50 font-medium">Loading map…</span>
          </div>
        </div>
      )}
      {loaded && (
        <div className="absolute top-3 left-3 bg-base-100/90 backdrop-blur-sm rounded-xl px-3 py-1.5
                        border border-base-300 text-xs font-semibold text-base-content/60 shadow-sm">
          Click on map or drag blue pin to set location
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UpdateLocation() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const vehicle  = useSelector(selectVehicle);
  const updating = useSelector(selectLoading("updateLocation"));
  const error    = useSelector(selectError("updateLocation"));

  const [mode,        setMode]        = useState("gps"); // "gps" | "manual"
  const [coords,      setCoords]      = useState({ lat: null, lng: null });
  const [address,     setAddress]     = useState("");
  const [manualInput, setManualInput] = useState({ area: "", city: "", pincode: "" });
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [gpsError,    setGpsError]    = useState("");
  const [saved,       setSaved]       = useState(false);
  const [geocoding,   setGeocoding]   = useState(false);

  // Populate from existing vehicle location
  useEffect(() => {
    if (vehicle?.lastKnownLocation?.coordinates) {
      const [lng, lat] = vehicle.lastKnownLocation.coordinates;
      setCoords({ lat, lng });
    }
  }, [vehicle]);

  // Reverse geocode helper
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!window.google) return;
    setGeocoding(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      setGeocoding(false);
      if (status === "OK" && results[0]) {
        setAddress(results[0].formatted_address);
      }
    });
  }, []);

  // GPS button
  const handleGetGps = () => {
    setGpsError("");
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
        setGpsLoading(false);
      },
      () => {
        setGpsError("Could not get GPS location. Please allow location access or use manual entry.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Manual geocode
  const handleManualGeocode = async () => {
    const query = [manualInput.area, manualInput.city, manualInput.pincode, "India"]
      .filter(Boolean).join(", ");
    if (!query.trim() || !window.google) return;

    setGeocoding(true);
    setGpsError("");
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      setGeocoding(false);
      if (status === "OK" && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        setCoords({ lat: lat(), lng: lng() });
        setAddress(results[0].formatted_address);
      } else {
        setGpsError("Location not found. Please try a different area or city name.");
      }
    });
  };

  const handleMapClick = (lat, lng) => {
    setCoords({ lat, lng });
    reverseGeocode(lat, lng);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!coords.lat || !coords.lng) return;
    setSaved(false);
    const result = await dispatch(updateVehicleLocation({ lat: coords.lat, lng: coords.lng }));
    if (!result.error) setSaved(true);
  };

  const hasCoords = coords.lat !== null && coords.lng !== null;

  const lastUpdated = vehicle?.lastLocationUpdatedAt
    ? new Date(vehicle.lastLocationUpdatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">
      {/* Background decoration */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(2,132,199,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(2,132,199,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="fixed bottom-1/3 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Container>
        <div className="relative py-6 lg:py-8 space-y-6">

          {/* ── Back button ─────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-base-content/50
                         hover:text-base-content/80 hover:bg-base-200 transition-all font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </motion.div>

          {/* ── Header card ──────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp}
            className="rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden"
          >
            <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-base-content font-[family-name:var(--font-family-montserrat)]">
                    Update Vehicle Location
                  </h2>
                  {lastUpdated ? (
                    <p className="text-xs text-base-content/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Last updated: {lastUpdated}
                    </p>
                  ) : (
                    <p className="text-xs text-base-content/40">No location recorded yet</p>
                  )}
                </div>
              </div>

              {hasCoords && (
                <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                  <Dot />
                  {coords.lat?.toFixed(5)}, {coords.lng?.toFixed(5)}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Mode toggle ──────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp}
            className="flex rounded-2xl overflow-hidden border border-base-300 bg-base-200/50 p-1 gap-1"
          >
            {[
              { key: "gps",    label: "Use My GPS",     icon: Crosshair  },
              { key: "manual", label: "Enter Manually", icon: Building2  },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${mode === m.key
                    ? "bg-base-100 text-primary shadow-sm border border-base-300"
                    : "text-base-content/50 hover:text-base-content/70"}`}
              >
                <m.icon className="w-4 h-4" />
                {m.label}
              </button>
            ))}
          </motion.div>

          {/* ── Main layout ──────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-5 gap-5"
          >
            {/* Controls panel */}
            <motion.div variants={fadeUp} className="lg:col-span-2 space-y-4">
              <AnimatePresence mode="wait">
                {/* GPS panel */}
                {mode === "gps" ? (
                  <motion.div
                    key="gps-panel"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                    className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-base-content flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-primary" />
                      GPS Auto-Detect
                    </h3>

                    <div>
                      <button
                        onClick={handleGetGps}
                        disabled={gpsLoading}
                        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-primary text-primary-content
                                   text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
                      >
                        {gpsLoading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Crosshair className="w-4 h-4" />}
                        {gpsLoading ? "Getting location…" : "Get My Current Location"}
                      </button>
                      <FieldNote>Tap to detect your current GPS coordinates. Requires location permission to be granted in the browser.</FieldNote>
                    </div>

                    {gpsError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{gpsError}
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-base-200/70 border border-base-300 space-y-1">
                      <p className="text-xs font-semibold text-base-content/60">Or click on the map to set manually</p>
                      <FieldNote>Drag the blue pin to the exact pickup point. Click anywhere on the map to move the pin there.</FieldNote>
                    </div>
                  </motion.div>
                ) : (
                  /* Manual panel */
                  <motion.div
                    key="manual-panel"
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-base-content flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      Enter Location Manually
                    </h3>

                    {/* Area */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-base-content">Area / Landmark</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
                        <input
                          value={manualInput.area}
                          onChange={e => setManualInput(p => ({ ...p, area: e.target.value }))}
                          placeholder="e.g. Benz Circle, MG Road"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                                     text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                                     focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <FieldNote>Enter a well-known landmark, area name, or street to locate your position accurately.</FieldNote>
                    </div>

                    {/* City */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-base-content">City</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
                        <input
                          value={manualInput.city}
                          onChange={e => setManualInput(p => ({ ...p, city: e.target.value }))}
                          placeholder="e.g. Vijayawada"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                                     text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                                     focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <FieldNote>Enter the city name. Combined with the area above, this helps geocoding find an accurate pin on the map.</FieldNote>
                    </div>

                    {/* Pincode */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-base-content">PIN Code</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
                        <input
                          value={manualInput.pincode}
                          onChange={e => setManualInput(p => ({ ...p, pincode: e.target.value }))}
                          placeholder="e.g. 520001"
                          maxLength={6}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-base-200 border border-base-300 focus:border-primary/60
                                     text-base-content text-sm placeholder:text-base-content/30 outline-none focus:ring-2
                                     focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <FieldNote>6-digit Indian PIN code. Optional but improves geocoding accuracy significantly.</FieldNote>
                    </div>

                    <div>
                      <button
                        onClick={handleManualGeocode}
                        disabled={geocoding || (!manualInput.area && !manualInput.city && !manualInput.pincode)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 border border-primary/25
                                   text-primary text-sm font-bold hover:bg-primary/20 disabled:opacity-40 transition-all"
                      >
                        {geocoding
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Search className="w-3.5 h-3.5" />}
                        {geocoding ? "Finding location…" : "Find on Map"}
                      </button>
                      <FieldNote>Click to geocode the address above and place the pin on the map. You can drag the pin afterwards for fine-tuning.</FieldNote>
                    </div>

                    {gpsError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{gpsError}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Detected address */}
              {address && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-success/25 bg-success/5 p-4 space-y-1"
                >
                  <p className="text-xs font-bold text-success flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />Detected Address
                  </p>
                  <p className="text-sm text-base-content/70 leading-relaxed">{address}</p>
                </motion.div>
              )}

              {/* Coordinates display */}
              {hasCoords && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-2xl border border-base-300 bg-base-200/50 p-4"
                >
                  <p className="text-xs font-bold text-base-content/60 mb-2">Selected Coordinates</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-base-100 border border-base-300 text-center">
                      <p className="text-xs text-base-content/40 mb-0.5">Latitude</p>
                      <p className="text-sm font-bold text-primary font-mono">{coords.lat?.toFixed(6)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-base-100 border border-base-300 text-center">
                      <p className="text-xs text-base-content/40 mb-0.5">Longitude</p>
                      <p className="text-sm font-bold text-primary font-mono">{coords.lng?.toFixed(6)}</p>
                    </div>
                  </div>
                  <FieldNote>These coordinates will be saved as your vehicle's current location visible to nearby customers.</FieldNote>
                </motion.div>
              )}

              {/* Save button */}
              <AnimatePresence>
                {hasCoords && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  >
                    {error && (
                      <div className="mb-2 flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />{error}
                      </div>
                    )}
                    {saved && (
                      <div className="mb-2 flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />Location updated successfully!
                      </div>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={updating}
                      className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-primary text-primary-content
                                 text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {updating
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <MapPin className="w-4 h-4" />}
                      {updating ? "Updating location…" : "Save Location"}
                    </button>
                    <FieldNote>Saving updates your location on the dispatch system. Customers searching for nearby drivers will see your updated position.</FieldNote>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Map */}
            <motion.div
              variants={fadeUp}
              className="lg:col-span-3 rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden"
              style={{ height: 460 }}
            >
              <div className="h-full">
                <LiveMap
                  lat={coords.lat || 16.506}
                  lng={coords.lng || 80.648}
                  onMapClick={handleMapClick}
                />
              </div>
            </motion.div>
          </motion.div>

          {/* ── Info banner ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.4 } }}
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info/10 border border-info/20"
          >
            <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
            <p className="text-xs text-info leading-relaxed">
              Your vehicle location is visible to customers seeking rides in nearby areas. Update it regularly to improve your ride assignments. Location accuracy affects dispatch priority — a more precise location means faster ride matches.
            </p>
          </motion.div>

        </div>
      </Container>
    </div>
  );
}