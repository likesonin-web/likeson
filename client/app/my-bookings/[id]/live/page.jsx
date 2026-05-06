'use client';

/**
 * BookingLiveLocation — Real-time driver tracking page
 *
 * Only renders for transport-type bookings:
 *   full_care_ride | patient_transport | diagnostic_home
 *
 * Data sources:
 *   - bookingSlice.selectActiveBooking       → booking details (pickup/drop coords, rideCode, etc.)
 *   - bookingSlice.selectLiveLocation        → socket-pushed driver location { lat, lng, heading, speed, role, updatedAt }
 *   - bookingSlice.selectBookingSnapshot     → reconnect state recovery
 *   - bookingSlice.selectSocketConnected     → socket health
 *   - bookingSlice.joinBookingRoom           → subscribes to room
 *   - bookingSlice.leaveBookingRoom          → cleanup
 *   - bookingSlice.requestBookingSnapshot    → ask server for latest state after mount
 *   - bookingSlice.fetchBookingById          → initial data load
 *
 * Map: Google Maps singleton (same pattern as BookingDetailsPage)
 * Shows full route polyline from origin → current driver location → destination
 */

import {
  useEffect, useRef, useState, useCallback, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter }     from 'next/navigation';
import { motion, AnimatePresence }  from 'framer-motion';
import Link                         from 'next/link';
import {
  ArrowLeft, Navigation, Car, Ambulance, Home,
  MapPin, Phone, Clock, Wifi, WifiOff, Activity,
  RefreshCw, ChevronRight, User, AlertTriangle,
  Gauge, Compass, Signal,
} from 'lucide-react';

import {
  fetchBookingById,
  joinBookingRoom,
  leaveBookingRoom,
  requestBookingSnapshot,
  clearActiveBooking,
  selectActiveBooking,
  selectActiveBookingLoading,
  selectLiveLocation,
  selectBookingSnapshot,
  selectSocketConnected,
  selectSocketStatus,
} from '@/store/slices/bookingSlice';

// ─── Google Maps Singleton ────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyBkwZzM-ZJCCHUg5hG5vbT9OSIeUPVi_qw';

let _mapsPromise = null;

function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload  = () => resolve(window.google.maps);
    script.onerror = () => { _mapsPromise = null; reject(new Error('Maps load failed')); };
    document.head.appendChild(script);
  });
  return _mapsPromise;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSPORT_TYPES = new Set(['full_care_ride', 'patient_transport', 'diagnostic_home']);

const TYPE_META = {
  full_care_ride:    { label: 'Full Care Ride',    Icon: Ambulance, color: '#6366f1' },
  patient_transport: { label: 'Patient Transport', Icon: Car,       color: '#0ea5e9' },
  diagnostic_home:   { label: 'Home Diagnostics',  Icon: Home,      color: '#f59e0b' },
};

const STATUS_COLORS = {
  pending:     '#f59e0b',
  confirmed:   '#22c55e',
  in_progress: '#6366f1',
  completed:   '#22c55e',
  cancelled:   '#ef4444',
};

const MAP_STYLES = [
  { elementType: 'geometry',              stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',      stylers: [{ color: '#8892b0' }] },
  { elementType: 'labels.text.stroke',    stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon',           stylers: [{ visibility: 'off' }] },
  { featureType: 'road',        elementType: 'geometry',      stylers: [{ color: '#16213e' }] },
  { featureType: 'road',        elementType: 'geometry.stroke', stylers: [{ color: '#0f3460' }] },
  { featureType: 'road.highway', elementType: 'geometry',     stylers: [{ color: '#0f3460' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a4e' }] },
  { featureType: 'water',       elementType: 'geometry',      stylers: [{ color: '#0d1117' }] },
  { featureType: 'poi',         stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',     stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape',   elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e3a5f' }] },
];

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

const fmtSpeed = (ms) =>
  ms != null ? `${Math.round(ms * 3.6)} km/h` : '—';

const fmtHeading = (deg) => {
  if (deg == null) return '—';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
};

const fmtSince = (iso) => {
  if (!iso) return null;
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 10)  return 'Just now';
  if (secs < 60)  return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Pulse = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} aria-hidden="true" />
);

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col" aria-busy="true">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
        <Pulse className="w-8 h-8 rounded-full" />
        <div className="space-y-1.5"><Pulse className="w-36 h-4" /><Pulse className="w-24 h-3" /></div>
      </div>
      <Pulse className="flex-1 rounded-none" />
      <div className="p-4 space-y-3 border-t border-white/10">
        <Pulse className="h-20" /><Pulse className="h-14" />
      </div>
    </div>
  );
}

// ─── Driver Car SVG Marker ────────────────────────────────────────────────────

function buildCarSVG(heading = 0, color = '#6366f1') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <g transform="rotate(${heading}, 24, 24)">
      <circle cx="24" cy="24" r="20" fill="${color}" opacity="0.25"/>
      <circle cx="24" cy="24" r="14" fill="${color}" opacity="0.5"/>
      <path d="M24 8 L30 20 L24 17 L18 20 Z" fill="${color}"/>
      <circle cx="24" cy="24" r="6" fill="white"/>
      <circle cx="24" cy="24" r="3" fill="${color}"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ─── Live Map Component ───────────────────────────────────────────────────────

const LiveMap = memo(function LiveMap({
  pickupCoords,
  dropCoords,
  driverCoords,
  driverHeading,
  bookingTypeColor,
}) {
  const mapRef         = useRef(null);
  const mapInstance    = useRef(null);
  const driverMarker   = useRef(null);
  const routeRenderer  = useRef(null);
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState(false);
  const prevDriver          = useRef(null);

  // ── Init map once ──
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    let cancelled = false;

    loadGoogleMaps().then((maps) => {
      if (cancelled || !mapRef.current) return;

      const center = driverCoords
        ?? pickupCoords
        ?? { lat: 16.5062, lng: 80.6480 };

      const map = new maps.Map(mapRef.current, {
        center, zoom: 14, styles: MAP_STYLES,
        disableDefaultUI: true, zoomControl: true,
        gestureHandling: 'greedy',
      });
      mapInstance.current = map;

      // Pickup marker
      if (pickupCoords) {
        new maps.Marker({
          position: pickupCoords, map,
          title: 'Pickup',
          icon: {
            path: maps.SymbolPath.CIRCLE, scale: 10,
            fillColor: '#3b82f6', fillOpacity: 1,
            strokeColor: '#fff', strokeWeight: 3,
          },
        });
      }

      // Drop marker
      if (dropCoords) {
        new maps.Marker({
          position: dropCoords, map,
          title: 'Destination',
          icon: {
            path: maps.SymbolPath.CIRCLE, scale: 10,
            fillColor: '#22c55e', fillOpacity: 1,
            strokeColor: '#fff', strokeWeight: 3,
          },
        });
      }

      // Driver marker (animated car)
      if (driverCoords) {
        driverMarker.current = new maps.Marker({
          position: driverCoords, map,
          title: 'Driver',
          icon: {
            url:    buildCarSVG(driverHeading ?? 0, bookingTypeColor),
            anchor: new maps.Point(24, 24),
            scaledSize: new maps.Size(48, 48),
          },
          zIndex: 999,
        });
        prevDriver.current = driverCoords;
      }

      // Route: driver → destination (live portion)
      if (driverCoords && dropCoords) {
        routeRenderer.current = new maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor:  bookingTypeColor,
            strokeWeight: 4,
            strokeOpacity: 0.85,
          },
        });
        routeRenderer.current.setMap(map);
        fetchRoute(maps, driverCoords, dropCoords);
      } else if (pickupCoords && dropCoords) {
        // Fallback: show full pickup→drop route if driver not yet available
        routeRenderer.current = new maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: { strokeColor: bookingTypeColor, strokeWeight: 4, strokeOpacity: 0.6, strokeDasharray: [8, 4] },
        });
        routeRenderer.current.setMap(map);
        fetchRoute(maps, pickupCoords, dropCoords);
      }

      setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helper: fetch route ──
  const fetchRoute = useCallback((maps, origin, destination) => {
    const svc = new maps.DirectionsService();
    svc.route({
      origin, destination,
      travelMode: maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && routeRenderer.current) {
        routeRenderer.current.setDirections(result);
      }
    });
  }, []);

  // ── Animate driver marker on location update ──
  useEffect(() => {
    if (!driverMarker.current || !driverCoords || !mapInstance.current) return;
    const maps = window.google?.maps;
    if (!maps) return;

    // Smooth animate position
    const from = prevDriver.current;
    const to   = driverCoords;
    if (!from) {
      driverMarker.current.setPosition(to);
      prevDriver.current = to;
      return;
    }

    let frame = 0;
    const FRAMES = 30;
    const timer = setInterval(() => {
      frame++;
      const t = frame / FRAMES;
      driverMarker.current?.setPosition({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      });
      if (frame >= FRAMES) {
        clearInterval(timer);
        prevDriver.current = to;
      }
    }, 16);

    // Update icon heading
    driverMarker.current.setIcon({
      url:    buildCarSVG(driverHeading ?? 0, bookingTypeColor),
      anchor: new maps.Point(24, 24),
      scaledSize: new maps.Size(48, 48),
    });

    // Re-route from new driver position
    if (dropCoords && routeRenderer.current) {
      fetchRoute(maps, to, dropCoords);
    }

    // Pan map to driver
    mapInstance.current.panTo(to);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverCoords?.lat, driverCoords?.lng]);

  if (error) {
    return (
      <div className="w-full h-full bg-[#0d1117] flex flex-col items-center justify-center gap-2 text-white/40">
        <MapPin size={28} />
        <span className="text-sm">Map unavailable</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!ready && (
        <div className="absolute inset-0 bg-[#0d1117] z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500/50 border-t-indigo-400 animate-spin" />
            <span className="text-white/40 text-xs font-mono">Loading map…</span>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
});

// ─── Live Badge ───────────────────────────────────────────────────────────────

const LiveBadge = memo(function LiveBadge({ connected }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${
      connected
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      {connected ? 'LIVE' : 'OFFLINE'}
    </div>
  );
});

// ─── Stats Strip ──────────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({ icon: Icon, label, value, color = 'text-white' }) {
  return (
    <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-white/40 shrink-0" aria-hidden="true" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 truncate">{label}</span>
      </div>
      <span className={`text-sm font-black font-mono truncate ${color}`}>{value}</span>
    </div>
  );
});

// ─── Connection Toast ─────────────────────────────────────────────────────────

const ConnToast = memo(function ConnToast({ show, connected }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-2xl ${
            connected
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {connected
            ? <><Wifi size={12} /> Reconnected — tracking live</>
            : <><WifiOff size={12} /> Connection lost — retrying…</>}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingLiveLocation() {
  const dispatch   = useDispatch();
  const router     = useRouter();
  const params     = useParams();
  const bookingId  = params?.bookingId ?? params?.id;

  const booking    = useSelector(selectActiveBooking);
  const loading    = useSelector(selectActiveBookingLoading);
  const liveData   = useSelector(selectLiveLocation(bookingId));
  const snapshot   = useSelector(selectBookingSnapshot);
  const connected  = useSelector(selectSocketConnected);
  const sockStatus = useSelector(selectSocketStatus);

  const [connToast, setConnToast] = useState(false);
  const prevConnected             = useRef(null);
  const [sinceLabel, setSince]    = useState('');

  // ── Fetch booking + join room ──
  useEffect(() => {
    if (!bookingId) return;
    dispatch(fetchBookingById(bookingId));
    dispatch(joinBookingRoom(bookingId));
    dispatch(requestBookingSnapshot(bookingId));

    return () => {
      dispatch(leaveBookingRoom(bookingId));
      dispatch(clearActiveBooking());
    };
  }, [bookingId, dispatch]);

  // ── Connection change toast ──
  useEffect(() => {
    if (prevConnected.current === null) {
      prevConnected.current = connected;
      return;
    }
    if (prevConnected.current !== connected) {
      prevConnected.current = connected;
      setConnToast(true);
      const t = setTimeout(() => setConnToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [connected]);

  // ── Re-request snapshot on reconnect ──
  useEffect(() => {
    if (connected && bookingId) {
      dispatch(requestBookingSnapshot(bookingId));
    }
  }, [connected, bookingId, dispatch]);

  // ── "Updated X ago" ticker ──
  useEffect(() => {
    if (!liveData?.updatedAt) return;
    const tick = () => setSince(fmtSince(liveData.updatedAt) ?? '');
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [liveData?.updatedAt]);

  const handleRefresh = useCallback(() => {
    if (bookingId) {
      dispatch(fetchBookingById(bookingId));
      dispatch(requestBookingSnapshot(bookingId));
    }
  }, [bookingId, dispatch]);

  // ── Loading ──
  if (loading) return <Skeleton />;

  // ── Not found / wrong type ──
  if (!booking) {
    return (
      <main className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4 text-center p-6">
        <AlertTriangle size={36} className="text-red-400" />
        <p className="text-white/60 text-sm">Booking not found</p>
        <button onClick={() => router.back()} className="text-indigo-400 text-sm flex items-center gap-1 hover:text-indigo-300">
          <ArrowLeft size={14} /> Go back
        </button>
      </main>
    );
  }

  if (!TRANSPORT_TYPES.has(booking.bookingType)) {
    return (
      <main className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4 text-center p-6">
        <Navigation size={36} className="text-white/20" />
        <h2 className="text-white font-bold">Live tracking not available</h2>
        <p className="text-white/40 text-sm max-w-xs">
          Live tracking is only available for transport-based bookings (Full Care Ride, Patient Transport, Home Diagnostics).
        </p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Back to booking
        </button>
      </main>
    );
  }

  // ── Coords ──
  const pickupRaw  = booking.patientLocation?.coordinates;
  const dropRaw    = booking.destinationLocation?.coordinates;
  const pickupLL   = pickupRaw  ? { lat: pickupRaw[1],  lng: pickupRaw[0]  } : null;
  const dropLL     = dropRaw    ? { lat: dropRaw[1],    lng: dropRaw[0]    } : null;

  // Live driver from socket; fallback to snapshot
  const driverLL = liveData
    ? { lat: liveData.lat, lng: liveData.lng }
    : snapshot?.ride?.liveLocation
      ? { lat: snapshot.ride.liveLocation.lat, lng: snapshot.ride.liveLocation.lng }
      : null;

  const heading    = liveData?.heading ?? snapshot?.ride?.liveLocation?.heading ?? 0;
  const speed      = liveData?.speed   ?? null;
  const updatedAt  = liveData?.updatedAt;

  const meta       = TYPE_META[booking.bookingType] ?? TYPE_META.patient_transport;
  const statusColor = STATUS_COLORS[booking.status] ?? '#6366f1';
  const { Icon: TypeIcon } = meta;

  const driverName  = booking.rides?.[0]?.driverSnapshot?.name  ?? 'Driver';
  const driverPhone = booking.rides?.[0]?.driverSnapshot?.phone ?? null;
  const rideStatus  = booking.rides?.[0]?.status                ?? booking.status;
  const rideCode    = booking.rides?.[0]?.rideCode              ?? booking.bookingCode;

  const isActive = ['confirmed', 'in_progress', 'pending'].includes(booking.status);

  return (
    <div
      className="min-h-screen bg-[#0d1117] flex flex-col font-mono overflow-hidden"
      style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}
    >
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`}</style>

      {/* ── Connection Toast ── */}
      <ConnToast show={connToast} connected={connected} />

      {/* ── Header ── */}
      <header className="relative z-20 border-b border-white/10 bg-[#0d1117]/95 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <TypeIcon size={13} style={{ color: meta.color }} aria-hidden="true" />
                <h1 className="text-white font-bold text-sm truncate">{meta.label}</h1>
                <LiveBadge connected={connected} />
              </div>
              <p className="text-white/30 text-[10px] truncate mt-0.5">{rideCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={13} />
            </button>
            <Link
              href={`/my-bookings/${bookingId}`}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
            >
              Details <ChevronRight size={10} />
            </Link>
          </div>
        </div>

        {/* Ride status strip */}
        <div
          className="h-0.5 w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
            opacity: isActive ? 1 : 0.3,
          }}
          aria-hidden="true"
        />
      </header>

      {/* ── Map (fills remaining space) ── */}
      <div className="flex-1 relative min-h-0">
        <LiveMap
          pickupCoords={pickupLL}
          dropCoords={dropLL}
          driverCoords={driverLL}
          driverHeading={heading}
          bookingTypeColor={meta.color}
        />

        {/* Map legend overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {pickupLL && (
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" aria-hidden="true" />
              <span className="text-[9px] text-white/60 font-bold uppercase tracking-widest">Pickup</span>
            </div>
          )}
          {driverLL && (
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10">
              <span
                className="w-2 h-2 rounded-full animate-pulse shrink-0"
                style={{ backgroundColor: meta.color }}
                aria-hidden="true"
              />
              <span className="text-[9px] text-white/60 font-bold uppercase tracking-widest">Driver</span>
            </div>
          )}
          {dropLL && (
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              <span className="text-[9px] text-white/60 font-bold uppercase tracking-widest">Drop</span>
            </div>
          )}
        </div>

        {/* No driver yet overlay */}
        {!driverLL && isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-4 left-4 right-4 z-10"
          >
            <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                <TypeIcon size={16} style={{ color: meta.color }} />
              </div>
              <div>
                <p className="text-white/80 text-xs font-bold">Waiting for driver to start</p>
                <p className="text-white/40 text-[10px] mt-0.5">Location will appear once ride begins</p>
              </div>
              <div className="ml-auto flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: meta.color, opacity: 0.4, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Bottom Panel ── */}
      <div
        className="relative z-20 border-t border-white/10 bg-[#0d1117]"
        style={{ boxShadow: `0 -20px 60px ${meta.color}15` }}
      >
        {/* Stats strip */}
        {driverLL && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-4 pb-3 flex gap-2"
          >
            <StatCard icon={Gauge}   label="Speed"   value={fmtSpeed(speed)}       color="text-white" />
            <StatCard icon={Compass} label="Heading" value={fmtHeading(heading)}   color="text-white" />
            <StatCard icon={Signal}  label="Updated" value={sinceLabel || '—'}     color="text-emerald-400" />
          </motion.div>
        )}

        {/* Driver card */}
        <div className="px-4 pb-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${meta.color}15`, border: `1.5px solid ${meta.color}40` }}
              aria-hidden="true"
            >
              <User size={20} style={{ color: meta.color }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{driverName}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                  }}
                >
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                  {rideStatus?.replace(/_/g, ' ')}
                </span>
                {updatedAt && (
                  <span className="text-white/30 text-[9px]">
                    <Clock size={8} className="inline mr-0.5" />
                    {fmtTime(updatedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Call button */}
            {driverPhone && (
              <a
                href={`tel:${driverPhone}`}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
                style={{ background: `${meta.color}20`, border: `1.5px solid ${meta.color}50` }}
                aria-label={`Call driver ${driverName}`}
              >
                <Phone size={16} style={{ color: meta.color }} />
              </a>
            )}
          </div>

          {/* Location addresses */}
          {(booking.patientLocation?.address || booking.destinationLocation?.address) && (
            <div className="mt-3 space-y-2">
              {booking.patientLocation?.address && (
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Pickup</p>
                    <p className="text-white/60 text-xs truncate">{booking.patientLocation.address}</p>
                  </div>
                </div>
              )}
              {booking.destinationLocation?.address && (
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Destination</p>
                    <p className="text-white/60 text-xs truncate">{booking.destinationLocation.address}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom safe area */}
        <div className="h-safe-area-inset-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}