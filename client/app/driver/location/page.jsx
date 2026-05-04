'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Navigation2,
  MapPin,
  Wifi,
  WifiOff,
  Activity,
  Gauge,
  Compass,
  RefreshCw,
  Power,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Signal,
  Crosshair,
  Eye,
  EyeOff,
  ChevronDown,
  Zap,
  LocateFixed,
  Radio,
  Layers,
  Trash2,
} from 'lucide-react';
import {
  updateDriverLocation,
  updateDriverStatus,
  fetchDriverMe,
} from '@/store/slices/transportPartnerSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps Loader
// ─────────────────────────────────────────────────────────────────────────────
const MAPS_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ||
  'AIzaSyBkwZzM-ZJCCHUg5hG5vbT9OSIeUPVi_qw';

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google.maps);
    const existing = document.getElementById('gmap-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmap-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const SYNC_INTERVAL_MS = 8000;

const DRIVER_STATUS_OPTIONS = ['Available', 'On-Break', 'Offline'];

const STATUS_META = {
  Available:  { label: 'Available',  dot: '#22c55e', badge: 'text-success  bg-success/10  border-success/40'  },
  'On-Trip':  { label: 'On Trip',    dot: '#f59e0b', badge: 'text-warning  bg-warning/10  border-warning/40'  },
  'On-Break': { label: 'On Break',   dot: '#3b82f6', badge: 'text-info     bg-info/10     border-info/30'     },
  Offline:    { label: 'Offline',    dot: '#ef4444', badge: 'text-error    bg-error/10    border-error/30'    },
  Suspended:  { label: 'Suspended',  dot: '#6b7280', badge: 'text-neutral  bg-base-300    border-base-300'    },
};

const DARK_MAP_STYLES = [
  { elementType: 'geometry',              stylers: [{ color: '#16161d' }] },
  { elementType: 'labels.text.stroke',    stylers: [{ color: '#16161d' }] },
  { elementType: 'labels.text.fill',      stylers: [{ color: '#6b7280' }] },
  { featureType: 'road',        elementType: 'geometry',        stylers: [{ color: '#2a2a3c' }] },
  { featureType: 'road',        elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway',elementType: 'geometry',        stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'water',       elementType: 'geometry',        stylers: [{ color: '#0a1628' }] },
  { featureType: 'poi',         stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',     stylers: [{ visibility: 'off' }] },
];

function getHeadingLabel(deg) {
  if (deg == null) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PulseRing({ color }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ background: color }}
      />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, highlight = false }) {
  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -1 }}
      className="flex flex-col gap-1.5 rounded-2xl px-3 py-3 border transition-all shrink-0"
      style={{
        minWidth: '92px',
        background: highlight
          ? 'linear-gradient(135deg, color-mix(in srgb,var(--accent),transparent 84%), color-mix(in srgb,var(--accent),transparent 92%))'
          : 'var(--base-200)',
        borderColor: highlight
          ? 'color-mix(in srgb,var(--accent),transparent 58%)'
          : 'var(--base-300)',
      }}
    >
      <div
        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.13em] leading-none"
        style={{ color: highlight ? 'var(--accent)' : 'color-mix(in oklch,var(--base-content) 45%, transparent)' }}
      >
        <Icon size={10} />
        {label}
      </div>
      <div
        className="font-black leading-none text-base-content"
        style={{ fontFamily: 'var(--font-display, monospace)', fontSize: '0.95rem' }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[9px] font-medium leading-none" style={{ color: 'color-mix(in oklch,var(--base-content) 38%, transparent)' }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function MapIconBtn({ onClick, title, children, dangerHover = false }) {
  return (
    <motion.button
      whileTap={{ scale: 0.87 }}
      onClick={onClick}
      title={title}
      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all"
      style={{
        background: 'color-mix(in srgb,var(--base-100),transparent 6%)',
        borderColor: 'var(--base-300)',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = dangerHover ? 'var(--error)' : 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--base-300)';
      }}
    >
      {children}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function DriverLocation() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { driverMe, loading } = useSelector((s) => s.transportPartner);

  // ── Map DOM + instance refs ───────────────────────────────────────────────
  const mapDivRef       = useRef(null);
  const mapRef          = useRef(null);
  const markerRef       = useRef(null);
  const accuracyCircRef = useRef(null);
  const polylineRef     = useRef(null);
  const pathCoordsRef   = useRef([]);

  // ── GPS / sync refs ───────────────────────────────────────────────────────
  const watchIdRef    = useRef(null);   // navigator.geolocation watchPosition id
  const syncTimerRef  = useRef(null);   // setInterval id

  /**
   * CRITICAL FIX: store live GPS values in refs so the periodic setInterval
   * callback always reads the latest values regardless of closure age.
   * Previously: syncLocation closed over stale state → always sent null/0.
   */
  const liveCoordsRef  = useRef(null);  // { lat, lng }
  const liveHeadRef    = useRef(0);
  const liveSpeedRef   = useRef(0);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [coords,      setCoords]      = useState(null);
  const [heading,     setHeading]     = useState(0);
  const [speedKmh,    setSpeedKmh]    = useState(0);
  const [accuracy,    setAccuracy]    = useState(null);
  const [tracking,    setTracking]    = useState(false);
  const [mapReady,    setMapReady]    = useState(false);
  const [gpsError,    setGpsError]    = useState(null);
  const [lastSynced,  setLastSynced]  = useState(null);
  const [syncState,   setSyncState]   = useState('idle'); // idle|syncing|ok|err
  const [showPath,    setShowPath]    = useState(true);
  const [panelOpen,   setPanelOpen]   = useState(true);
  const [mapStyle,    setMapStyle]    = useState('default');
  const [statusBusy,  setStatusBusy]  = useState(false);
  const [pathCount,   setPathCount]   = useState(0);

  const driverStatus = driverMe?.status || 'Offline';
  const statusMeta   = STATUS_META[driverStatus] || STATUS_META.Offline;
  const driverName   = driverMe?.legalName || driverMe?.user?.name || 'Driver';
  const driverCode   = driverMe?.driverCode || '---';

  // ── Fetch own profile on mount ────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDriverMe());
  }, [dispatch]);

  // ── Build custom map marker icon ──────────────────────────────────────────
  const buildMarkerIcon = useCallback((maps, dotColor = '#f59e0b') => ({
    url:
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="24" fill="${dotColor}" fill-opacity="0.18"
                  stroke="${dotColor}" stroke-width="2.5"/>
          <circle cx="26" cy="26" r="16" fill="${dotColor}"/>
          <text x="26" y="31" font-size="14" text-anchor="middle" fill="white">🚗</text>
        </svg>`),
    scaledSize: new maps.Size(52, 52),
    anchor:     new maps.Point(26, 26),
  }), []);

  // ── Init Google Map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return;

    loadGoogleMaps()
      .then((maps) => {
        const savedLoc = driverMe?.location?.coordinates; // [lng, lat]
        const center = savedLoc
          ? { lat: savedLoc[1], lng: savedLoc[0] }
          : { lat: 16.5062, lng: 80.6480 };

        const instance = new maps.Map(mapDivRef.current, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = instance;

        // Marker
        const marker = new maps.Marker({
          position: center,
          map: instance,
          icon: buildMarkerIcon(maps, STATUS_META[driverMe?.status || 'Offline']?.dot || '#f59e0b'),
          title: driverName,
          optimized: false,
          animation: maps.Animation.DROP,
        });
        markerRef.current = marker;

        // Accuracy circle
        const circle = new maps.Circle({
          map: instance,
          center,
          radius: 30,
          strokeColor: '#f59e0b',
          strokeOpacity: 0.45,
          strokeWeight: 1.5,
          fillColor: '#f59e0b',
          fillOpacity: 0.07,
        });
        accuracyCircRef.current = circle;

        // Route polyline with direction arrows
        const poly = new maps.Polyline({
          map: instance,
          path: [],
          geodesic: true,
          strokeColor: '#f59e0b',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          icons: [{
            icon: {
              path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3,
              fillColor: '#f59e0b',
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#fff',
            },
            offset: '100%',
            repeat: '100px',
          }],
        });
        polylineRef.current = poly;

        setMapReady(true);
      })
      .catch(() => setGpsError('Failed to load Google Maps'));

    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply map style on change ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    mapRef.current.setOptions({
      styles:    mapStyle === 'dark' ? DARK_MAP_STYLES : [],
      mapTypeId: mapStyle === 'satellite' ? 'satellite' : 'roadmap',
    });
  }, [mapStyle, mapReady]);

  // ── Sync path visibility ──────────────────────────────────────────────────
  useEffect(() => {
    polylineRef.current?.setOptions({ visible: showPath });
  }, [showPath]);

  // ── Update marker color when status changes ───────────────────────────────
  useEffect(() => {
    if (!markerRef.current || !window.google) return;
    const dot = STATUS_META[driverStatus]?.dot || '#f59e0b';
    markerRef.current.setIcon(buildMarkerIcon(window.google.maps, dot));
  }, [driverStatus, buildMarkerIcon]);

  // ─────────────────────────────────────────────────────────────────────────
  // Move marker on map + append path point
  // ─────────────────────────────────────────────────────────────────────────
  const moveMarker = useCallback((lat, lng, acc) => {
    if (!mapRef.current || !window.google) return;
    const pos = { lat, lng };

    markerRef.current?.setPosition(pos);
    accuracyCircRef.current?.setCenter(pos);
    if (acc != null) accuracyCircRef.current?.setRadius(Math.max(acc, 5));

    pathCoordsRef.current.push(pos);
    polylineRef.current?.setPath(pathCoordsRef.current);
    setPathCount(pathCoordsRef.current.length);

    mapRef.current.panTo(pos);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Push current location to server — reads from refs (always fresh)
  // ─────────────────────────────────────────────────────────────────────────
  const pushToServer = useCallback(async () => {
    const c = liveCoordsRef.current;
    if (!c) return;

    setSyncState('syncing');
    try {
      await dispatch(
        updateDriverLocation({
          lat:      c.lat,
          lng:      c.lng,
          heading:  liveHeadRef.current,
          speedKmh: liveSpeedRef.current,
        })
      ).unwrap();
      setLastSynced(new Date());
      setSyncState('ok');
    } catch {
      setSyncState('err');
    }
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // GPS watch handler — updates refs AND React state
  // ─────────────────────────────────────────────────────────────────────────
  const handleGpsSuccess = useCallback((pos) => {
    const { latitude, longitude, heading: h, speed, accuracy: acc } = pos.coords;

    // 1. Write to refs so interval callback always has fresh data
    liveCoordsRef.current  = { lat: latitude, lng: longitude };
    liveHeadRef.current    = h     ? Math.round(h)       : 0;
    liveSpeedRef.current   = speed ? Math.round(speed * 3.6) : 0;

    // 2. Update UI state for display
    setCoords({ lat: latitude, lng: longitude });
    setHeading(liveHeadRef.current);
    setSpeedKmh(liveSpeedRef.current);
    setAccuracy(acc ? Math.round(acc) : null);
    setGpsError(null);

    // 3. Move map
    moveMarker(latitude, longitude, acc);
  }, [moveMarker]);

  const handleGpsError = useCallback((err) => {
    setGpsError(err?.message || 'GPS error');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Start / Stop live tracking
  // ─────────────────────────────────────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported on this device');
      return;
    }
    setTracking(true);
    setSyncState('idle');

    // Watch GPS continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleGpsSuccess,
      handleGpsError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );

    // Periodically sync to server — reads liveCoordsRef (no stale closure)
    syncTimerRef.current = setInterval(() => {
      pushToServer();
    }, SYNC_INTERVAL_MS);
  }, [handleGpsSuccess, handleGpsError, pushToServer]);

  const stopTracking = useCallback(() => {
    setTracking(false);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  const handleToggleTracking = () => {
    if (tracking) stopTracking();
    else startTracking();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // One-shot: get current location and push to server immediately
  // ─────────────────────────────────────────────────────────────────────────
  const handleGetAndUpdate = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported');
      return;
    }
    setSyncState('syncing');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, heading: h, speed, accuracy: acc } = pos.coords;

        // Update refs
        liveCoordsRef.current = { lat: latitude, lng: longitude };
        liveHeadRef.current   = h     ? Math.round(h)           : 0;
        liveSpeedRef.current  = speed ? Math.round(speed * 3.6) : 0;

        // Update UI
        setCoords({ lat: latitude, lng: longitude });
        setHeading(liveHeadRef.current);
        setSpeedKmh(liveSpeedRef.current);
        setAccuracy(acc ? Math.round(acc) : null);
        setGpsError(null);

        // Move map
        moveMarker(latitude, longitude, acc);

        // Push immediately
        await pushToServer();
      },
      (err) => {
        setGpsError(err.message || 'Failed to get location');
        setSyncState('err');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Driver status change
  // ─────────────────────────────────────────────────────────────────────────
  const handleStatusChange = async (status) => {
    if (statusBusy || status === driverStatus) return;
    setStatusBusy(true);
    try {
      await dispatch(updateDriverStatus({ status })).unwrap();
    } finally {
      setStatusBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Map controls
  // ─────────────────────────────────────────────────────────────────────────
  const handleRecenter = () => {
    if (!coords || !mapRef.current) return;
    mapRef.current.panTo({ lat: coords.lat, lng: coords.lng });
    mapRef.current.setZoom(16);
  };

  const handleClearPath = () => {
    pathCoordsRef.current = [];
    polylineRef.current?.setPath([]);
    setPathCount(0);
  };

  const cycleMapStyle = () => {
    setMapStyle((m) =>
      m === 'default' ? 'dark' : m === 'dark' ? 'satellite' : 'default'
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Formatters
  // ─────────────────────────────────────────────────────────────────────────
  const fmtCoord = (n) => (n != null ? n.toFixed(6) : '---');
  const fmtTime  = (d) =>
    d
      ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Never';

  const SYNC_BADGE_CLASSES = {
    idle:    'bg-base-200 border-base-300 text-base-content/40',
    ok:      'bg-success/10 border-success/40 text-success',
    err:     'bg-error/10 border-error/30 text-error',
    syncing: 'bg-primary/10 border-primary/20 text-primary',
  };

  const SYNC_LABEL = { idle: 'Idle', ok: 'Synced', err: 'Failed', syncing: 'Syncing…' };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      data-theme="driver"
      className="flex flex-col w-full min-h-svh overflow-hidden"
      style={{ background: 'var(--base-100)', color: 'var(--base-content)' }}
    >

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-40 flex items-center justify-between px-3 sm:px-6 h-14 sm:h-16 border-b shrink-0 gap-2"
        style={{
          background: 'color-mix(in srgb, var(--base-100) 92%, transparent)',
          backdropFilter: 'blur(18px)',
          borderColor: 'var(--base-300)',
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Back button */}
          <motion.button
            whileTap={{ scale: 0.87 }}
            onClick={() => router.back()}
            title="Go back"
            className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all"
            style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
          >
            <ArrowLeft size={16} style={{ color: 'var(--base-content)' }} />
          </motion.button>

          {/* Icon + title */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <Navigation2 size={15} style={{ color: 'var(--accent-content)' }} />
            </div>
            <div className="min-w-0">
              <p
                className="text-sm sm:text-base font-black leading-none truncate"
                style={{ fontFamily: 'var(--font-display, sans-serif)' }}
              >
                Live Location
              </p>
              <p
                className="text-[10px] mt-0.5 truncate hidden sm:block"
                style={{ color: 'color-mix(in oklch,var(--base-content) 42%, transparent)' }}
              >
                {driverName} · {driverCode}
              </p>
            </div>
          </div>
        </div>

        {/* Right — badges */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Sync */}
          <div
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all ${SYNC_BADGE_CLASSES[syncState]}`}
          >
            {syncState === 'syncing' ? (
              <RefreshCw size={10} className="animate-spin" />
            ) : syncState === 'ok' ? (
              <Wifi size={10} />
            ) : syncState === 'err' ? (
              <WifiOff size={10} />
            ) : (
              <Signal size={10} />
            )}
            <span className="hidden sm:inline">{SYNC_LABEL[syncState]}</span>
          </div>

          {/* Status */}
          <div
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold border ${statusMeta.badge}`}
          >
            <PulseRing color={statusMeta.dot} />
            <span className="hidden sm:inline">{statusMeta.label}</span>
          </div>
        </div>
      </motion.header>

      {/* ══════════════════════════════════════
          MAP AREA
      ══════════════════════════════════════ */}
      <div
        className="relative shrink-0"
        style={{ height: 'clamp(280px, 50svh, 520px)' }}
      >
        {/* Google Maps canvas */}
        <div ref={mapDivRef} className="absolute inset-0 w-full h-full" />

        {/* Loading overlay */}
        {!mapReady && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
            style={{ background: 'var(--base-200)' }}
          >
            <div
              className="w-12 h-12 rounded-full border-4 animate-spin"
              style={{
                borderColor: 'color-mix(in srgb,var(--accent),transparent 70%)',
                borderTopColor: 'var(--accent)',
              }}
            />
            <p
              className="text-xs font-semibold"
              style={{ color: 'color-mix(in oklch,var(--base-content) 50%, transparent)' }}
            >
              Loading map…
            </p>
          </div>
        )}

        {/* Map style tabs — top left */}
        <div className="absolute top-2.5 left-2.5 z-20 flex gap-1.5">
          {[
            { key: 'default',   label: 'Map'  },
            { key: 'satellite', label: 'Sat'  },
            { key: 'dark',      label: 'Dark' },
          ].map(({ key, label }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.88 }}
              onClick={() => setMapStyle(key)}
              className="px-2 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider border transition-all"
              style={{
                background: mapStyle === key ? 'var(--accent)' : 'color-mix(in srgb,var(--base-100),transparent 8%)',
                color:      mapStyle === key ? 'var(--accent-content)' : 'color-mix(in oklch,var(--base-content) 55%, transparent)',
                borderColor: mapStyle === key ? 'var(--accent)' : 'var(--base-300)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {label}
            </motion.button>
          ))}
        </div>

        {/* Right icon controls */}
        <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-2">
          <MapIconBtn onClick={handleRecenter} title="Re-center map">
            <LocateFixed size={15} style={{ color: 'var(--primary)' }} />
          </MapIconBtn>
          <MapIconBtn onClick={() => setShowPath((v) => !v)} title={showPath ? 'Hide path' : 'Show path'}>
            {showPath
              ? <Eye size={15} style={{ color: 'var(--info)' }} />
              : <EyeOff size={15} style={{ color: 'color-mix(in oklch,var(--base-content) 30%, transparent)' }} />}
          </MapIconBtn>
          <MapIconBtn onClick={handleClearPath} title="Clear route" dangerHover>
            <Trash2 size={14} style={{ color: 'color-mix(in oklch,var(--base-content) 38%, transparent)' }} />
          </MapIconBtn>
          <MapIconBtn onClick={cycleMapStyle} title="Cycle map style">
            <Layers size={14} style={{ color: 'color-mix(in oklch,var(--base-content) 38%, transparent)' }} />
          </MapIconBtn>
        </div>

        {/* LIVE badge — top center */}
        <AnimatePresence>
          {tracking && (
            <motion.div
              key="live"
              initial={{ opacity: 0, scale: 0.8, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -8 }}
              className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border"
              style={{
                background: 'color-mix(in srgb,var(--error),transparent 10%)',
                borderColor: 'color-mix(in srgb,var(--error),transparent 38%)',
                color: 'var(--error)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: 'var(--error)' }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--error)' }} />
              </span>
              LIVE TRACKING
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom action buttons — stacked */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {/* One-shot update */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleGetAndUpdate}
            disabled={syncState === 'syncing'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs border shadow-depth transition-all disabled:opacity-50 whitespace-nowrap"
            style={{
              background: 'color-mix(in srgb,var(--base-100),transparent 6%)',
              borderColor: 'var(--base-300)',
              color: 'var(--base-content)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
            }}
          >
            {syncState === 'syncing'
              ? <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--primary)' }} />
              : <LocateFixed size={12} style={{ color: 'var(--primary)' }} />
            }
            Get & Update Location
          </motion.button>

          {/* Live tracking toggle */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleToggleTracking}
            className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-black text-sm border shadow-depth transition-all whitespace-nowrap"
            style={{
              background:   tracking ? 'var(--error)' : 'var(--accent)',
              borderColor:  tracking ? 'var(--error)' : 'var(--accent)',
              color:        tracking ? 'var(--error-content)' : 'var(--accent-content)',
              boxShadow:    tracking
                ? '0 8px 28px rgba(239,68,68,0.45)'
                : '0 8px 28px rgba(245,158,11,0.45)',
            }}
          >
            {tracking ? <Power size={15} /> : <Radio size={15} />}
            {tracking ? 'Stop Tracking' : 'Start Live Tracking'}
          </motion.button>
        </div>

        {/* GPS error toast */}
        <AnimatePresence>
          {gpsError && (
            <motion.div
              key="gpserr"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold max-w-[280px] text-center"
              style={{
                background: 'color-mix(in srgb,var(--error),transparent 8%)',
                color: 'var(--error-content)',
                boxShadow: '0 4px 20px rgba(239,68,68,0.35)',
              }}
            >
              <AlertTriangle size={12} />
              {gpsError}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════
          BOTTOM PANEL (scrollable)
      ══════════════════════════════════════ */}
      <div
        className="relative z-30 flex flex-col flex-1 border-t overflow-hidden"
        style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)' }}
      >
        {/* Panel toggle */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="flex items-center justify-between w-full px-4 sm:px-5 py-3 hover:bg-base-200/50 transition-colors shrink-0"
        >
          <div className="flex items-center gap-2">
            <Activity size={12} style={{ color: 'var(--accent)' }} />
            <span
              className="text-[10px] font-black uppercase tracking-[0.16em]"
              style={{ color: 'color-mix(in oklch,var(--base-content) 45%, transparent)' }}
            >
              Live Stats
            </span>
            {tracking && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase"
                style={{ background: 'var(--error)', color: 'var(--error-content)' }}
              >
                Live
              </span>
            )}
          </div>
          <motion.div animate={{ rotate: panelOpen ? 0 : 180 }} transition={{ duration: 0.22 }}>
            <ChevronDown size={14} style={{ color: 'color-mix(in oklch,var(--base-content) 35%, transparent)' }} />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {panelOpen && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {/* Stat cards — horizontal scroll on mobile, grid on desktop */}
              <div className="px-4 sm:px-5 pb-3 overflow-x-auto">
                <div className="flex gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-6 min-w-max sm:min-w-0">
                  <StatCard icon={MapPin}    label="Lat"      value={fmtCoord(coords?.lat)}             sub="degrees N"                        highlight />
                  <StatCard icon={MapPin}    label="Lng"      value={fmtCoord(coords?.lng)}             sub="degrees E"                        highlight />
                  <StatCard icon={Gauge}     label="Speed"    value={`${speedKmh} km/h`}                sub={speedKmh > 0 ? 'moving' : 'still'} />
                  <StatCard icon={Compass}   label="Heading"  value={heading ? `${heading}°` : '---'}  sub={heading ? getHeadingLabel(heading) : 'unknown'} />
                  <StatCard icon={Crosshair} label="Accuracy" value={accuracy ? `±${accuracy}m` : '---'} sub={!accuracy ? '—' : accuracy < 20 ? 'excellent' : accuracy < 60 ? 'good' : 'poor'} />
                  <StatCard icon={TrendingUp} label="Points"  value={pathCount}                         sub="in route" />
                </div>
              </div>

              {/* Last sync + manual push */}
              <div
                className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 border-t"
                style={{ borderColor: 'var(--base-300)' }}
              >
                <div
                  className="flex items-center gap-1.5 text-[10px] sm:text-[11px] truncate"
                  style={{ color: 'color-mix(in oklch,var(--base-content) 42%, transparent)' }}
                >
                  <Clock size={10} />
                  Last: {fmtTime(lastSynced)}
                </div>
                <motion.button
                  whileTap={{ scale: 0.91 }}
                  onClick={pushToServer}
                  disabled={!liveCoordsRef.current || syncState === 'syncing'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all disabled:opacity-40 whitespace-nowrap shrink-0"
                  style={{
                    background: 'color-mix(in srgb,var(--primary),transparent 88%)',
                    borderColor: 'color-mix(in srgb,var(--primary),transparent 68%)',
                    color: 'var(--primary)',
                  }}
                >
                  <RefreshCw size={10} className={syncState === 'syncing' ? 'animate-spin' : ''} />
                  Push Now
                </motion.button>
              </div>

              {/* Status selector */}
              <div
                className="px-4 sm:px-5 py-3 border-t"
                style={{ borderColor: 'var(--base-300)' }}
              >
                <p
                  className="text-[9px] font-black uppercase tracking-[0.18em] mb-2"
                  style={{ color: 'color-mix(in oklch,var(--base-content) 36%, transparent)' }}
                >
                  Set Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {DRIVER_STATUS_OPTIONS.map((s) => {
                    const meta   = STATUS_META[s];
                    const active = driverStatus === s;
                    return (
                      <motion.button
                        key={s}
                        whileTap={{ scale: 0.91 }}
                        onClick={() => handleStatusChange(s)}
                        disabled={statusBusy || active}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          active ? meta.badge : ''
                        }`}
                        style={
                          !active
                            ? {
                                background: 'var(--base-200)',
                                borderColor: 'var(--base-300)',
                                color: 'color-mix(in oklch,var(--base-content) 52%, transparent)',
                              }
                            : {}
                        }
                      >
                        {statusBusy && active ? (
                          <RefreshCw size={10} className="animate-spin" />
                        ) : (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
                        )}
                        {meta.label}
                        {active && <CheckCircle2 size={10} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer hint */}
              <div
                className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2 border-t"
                style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
              >
                <div
                  className="flex items-center gap-1.5 text-[9px] sm:text-[10px]"
                  style={{ color: 'color-mix(in oklch,var(--base-content) 38%, transparent)' }}
                >
                  <Zap size={9} style={{ color: 'var(--accent)' }} />
                  Auto-sync every {SYNC_INTERVAL_MS / 1000}s when live tracking is on
                </div>
                <div
                  className="text-[9px] sm:text-[10px] font-bold shrink-0"
                  style={{ color: tracking ? 'var(--error)' : 'color-mix(in oklch,var(--base-content) 30%, transparent)' }}
                >
                  {tracking ? '● Tracking' : '○ Stopped'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}