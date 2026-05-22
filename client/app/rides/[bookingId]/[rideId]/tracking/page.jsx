'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }    from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence }  from 'framer-motion';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import {
  Phone, User, MapPin, Navigation, Clock, Shield,
  ShieldAlert, WifiOff, ChevronDown, ChevronLeft,
  CheckCircle, Loader2, X, Star, Car, RefreshCw,
  AlertTriangle, Copy, Check, ArrowUpRight, Zap,
} from 'lucide-react';

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  fetchRide,
  fetchRideLive,
  fetchRideTracking,
  selectCurrentRide,
  selectSocketLive,
  selectLiveData,
  selectTrackingData,
  selectRideLoading,
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketDriverAccepted,
  socketDriverEnRoute,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketRideCompleted,
  socketRideCancelled,
  socketNavigationTargetChanged,
  socketRideAssigned,
} from '@/store/slices/rideRequestSlice';
import { useGoogleMaps } from '@/context/GoogleMapsProvider';
import {
  fetchMyBookingById,
  selectSelectedBooking,
} from '@/store/slices/bookingSlice';

// ── Socket context ────────────────────────────────────────────────────────────
import {
  useSocket,
  useBookingRoom,
  useSos,
  SOCKET_EVENTS,
} from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAP_ID   = process.env.NEXT_PUBLIC_MAP_ID          || '33a293614af186975a18525f';
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
const POLL_MS  = 6000;
const ROUTE_RECALC_DISTANCE_THRESHOLD_M = 80;

// ─────────────────────────────────────────────────────────────────────────────
// STATUS ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────
const STATUS = {
  SEARCHING:     'searching',
  ASSIGNED:      'driver_assigned',
  ARRIVING:      'driver_en_route',
  ARRIVED:       'driver_arrived',
  TRIP_STARTED:  'in_progress',
  AT_STOP:       'at_stop',
  COMPLETED:     'completed',
  CANCELLED:     'cancelled',
};

const normalizeStatus = (raw) => {
  const map = {
    requested:       STATUS.SEARCHING,
    searching:       STATUS.SEARCHING,
    driver_assigned: STATUS.ASSIGNED,
    driver_accepted: STATUS.ARRIVING,
    driver_en_route: STATUS.ARRIVING,
    driver_arrived:  STATUS.ARRIVED,
    otp_verified:    STATUS.ARRIVED,
    in_progress:     STATUS.TRIP_STARTED,
    at_stop:         STATUS.AT_STOP,
    completed:       STATUS.COMPLETED,
    cancelled:       STATUS.CANCELLED,
  };
  return map[raw] || STATUS.SEARCHING;
};

const STATUS_META = {
  [STATUS.SEARCHING]:    { label: 'Finding Driver',   color: '#f59e0b', icon: '🔍', phase: 'pre' },
  [STATUS.ASSIGNED]:     { label: 'Driver Assigned',  color: '#3b82f6', icon: '👤', phase: 'pre' },
  [STATUS.ARRIVING]:     { label: 'Driver En Route',  color: '#06b6d4', icon: '🚗', phase: 'arriving' },
  [STATUS.ARRIVED]:      { label: 'Driver Arrived',   color: '#8b5cf6', icon: '📍', phase: 'arrived' },
  [STATUS.TRIP_STARTED]: { label: 'In Progress',      color: '#22c55e', icon: '🏥', phase: 'trip' },
  [STATUS.AT_STOP]:      { label: 'At Stop',          color: '#f97316', icon: '⏸',  phase: 'trip' },
  [STATUS.COMPLETED]:    { label: 'Completed',        color: '#64748b', icon: '✓',  phase: 'done' },
  [STATUS.CANCELLED]:    { label: 'Cancelled',        color: '#ef4444', icon: '✕',  phase: 'done' },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE COLORS
// ─────────────────────────────────────────────────────────────────────────────
const ROUTE_COLOR = {
  DRIVER_TO_PICKUP: '#22c55e',
  PICKUP_TO_DEST:   '#2563eb',
  TRIP_ACTIVE:      '#2563eb',
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const TIMELINE = [
  { status: STATUS.SEARCHING,    label: 'Confirmed' },
  { status: STATUS.ASSIGNED,     label: 'Assigned'  },
  { status: STATUS.ARRIVING,     label: 'En Route'  },
  { status: STATUS.ARRIVED,      label: 'Arrived'   },
  { status: STATUS.TRIP_STARTED, label: 'Started'   },
  { status: STATUS.COMPLETED,    label: 'Done'      },
];

const getTimelineIdx = (status) => {
  const idx = TIMELINE.findIndex(t => t.status === status);
  return idx >= 0 ? idx : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;

const haversineMeters = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
};

const fmtEta = (min) => {
  if (min == null) return null;
  if (min < 1) return '< 1 min';
  return `${Math.round(min)} min`;
};

const fmtDist = (km) => {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

const decodePolyline = (encoded) => {
  if (!encoded) return [];
  if (window?.google?.maps?.geometry?.encoding) {
    return window.google.maps.geometry.encoding
      .decodePath(encoded)
      .map(p => ({ lat: p.lat(), lng: p.lng() }));
  }
  const pts = [];
  let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER BUILDERS
// ─────────────────────────────────────────────────────────────────────────────
const buildDriverMarkerElement = () => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';

  const container = document.createElement('div');
  container.style.cssText = `
    position:absolute;width:48px;height:48px;
    left:-24px;top:-24px;
    display:flex;align-items:center;justify-content:center;
  `;

  const pulse = document.createElement('div');
  pulse.style.cssText = `
    position:absolute;width:48px;height:48px;border-radius:50%;
    background:rgba(34,197,94,0.18);
    animation:mkrPulse 2.4s ease-out infinite;pointer-events:none;
  `;

  const shadow = document.createElement('div');
  shadow.style.cssText = `
    position:absolute;width:36px;height:10px;bottom:-2px;left:6px;
    border-radius:50%;background:rgba(0,0,0,0.22);
    filter:blur(4px);pointer-events:none;
  `;

  const img = document.createElement('img');
  img.src = 'https://ik.imagekit.io/zxxzgk3iq/car.png';
  img.alt = '';
  img.setAttribute('data-role', 'car-img');
  img.style.cssText = `
    width:40px;height:40px;object-fit:contain;
    position:relative;z-index:2;
    transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);
    transform-origin:center center;
    filter:drop-shadow(0 3px 6px rgba(0,0,0,0.30));pointer-events:none;
  `;

  container.appendChild(pulse);
  container.appendChild(shadow);
  container.appendChild(img);
  wrapper.appendChild(container);

  if (!document.getElementById('mkrPulseKf')) {
    const style = document.createElement('style');
    style.id = 'mkrPulseKf';
    style.textContent = `
      @keyframes mkrPulse {
        0%   { transform:scale(0.85);opacity:0.7; }
        70%  { transform:scale(1.9); opacity:0; }
        100% { transform:scale(0.85);opacity:0; }
      }
    `;
    document.head.appendChild(style);
  }

  return wrapper;
};

const updateDriverMarkerRotation = (markerEl, heading) => {
  if (!markerEl) return;
  const img = markerEl.querySelector('[data-role="car-img"]');
  if (img) img.style.transform = `rotate(${heading}deg)`;
};

const buildPickupMarkerEl = () => {
  const w = document.createElement('div');
  w.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
  w.innerHTML = `
    <div style="position:absolute;left:-14px;top:-46px;display:flex;flex-direction:column;align-items:center;gap:0;">
      <div style="width:28px;height:28px;background:#22c55e;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 3px 12px rgba(34,197,94,0.45),0 1px 3px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
        <div style="width:8px;height:8px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
      </div>
      <div style="background:#fff;color:#166534;font-size:9px;font-weight:800;letter-spacing:0.08em;padding:2px 6px;border-radius:20px;margin-top:3px;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;font-family:ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;">Pickup</div>
    </div>
  `;
  return w;
};

const buildDestMarkerEl = () => {
  const w = document.createElement('div');
  w.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
  w.innerHTML = `
    <div style="position:absolute;left:-14px;top:-46px;display:flex;flex-direction:column;align-items:center;gap:0;">
      <div style="width:28px;height:28px;background:#2563eb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 3px 12px rgba(37,99,235,0.45),0 1px 3px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
        <div style="width:8px;height:8px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
      </div>
      <div style="background:#fff;color:#1e3a8a;font-size:9px;font-weight:800;letter-spacing:0.08em;padding:2px 6px;border-radius:20px;margin-top:3px;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;font-family:ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;">Hospital</div>
    </div>
  `;
  return w;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAP STYLE
// ─────────────────────────────────────────────────────────────────────────────
const MAP_STYLES = [
  { featureType: 'poi',            elementType: 'all',      stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park',       elementType: 'geometry', stylers: [{ color: '#e8f5e9' }, { visibility: 'simplified' }] },
  { featureType: 'transit',        elementType: 'all',      stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels',   stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road',           elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway',   elementType: 'geometry', stylers: [{ color: '#f0f0f0' }, { weight: 1.5 }] },
  { featureType: 'road.arterial',  elementType: 'labels.text.fill', stylers: [{ color: '#888' }] },
  { featureType: 'landscape',      elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
  { featureType: 'water',          elementType: 'geometry', stylers: [{ color: '#c9e3f5' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODAL
// ─────────────────────────────────────────────────────────────────────────────
const OtpModal = memo(function OtpModal({ otp, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!otp) return null;

  const digits = String(otp).padStart(4, '0').split('');

  const handleCopy = () => {
    navigator.clipboard.writeText(String(otp)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 340 }}
        className="w-full max-w-[340px] rounded-2xl overflow-hidden"
        style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: '#8b5cf6', padding: '14px 18px' }} className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm m-0">Your Ride OTP</p>
            <p className="text-purple-200 text-[11px] m-0 mt-0.5">Show this to your driver to start trip</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center border-none cursor-pointer">
            <X size={13} color="white" />
          </button>
        </div>

        <div className="px-6 pt-6 pb-4">
          <div className="flex gap-2.5 justify-center mb-4">
            {digits.map((d, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 500 }}
                className="w-14 h-16 rounded-xl flex items-center justify-center font-black text-3xl"
                style={{
                  background: 'rgba(139,92,246,0.10)',
                  border: '2px solid #8b5cf6',
                  color: '#7c3aed',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {d}
              </motion.div>
            ))}
          </div>

          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 2.2 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <p className="text-[11px] font-semibold m-0" style={{ color: '#b45309' }}>
              Only share with your driver — never anyone else
            </p>
          </motion.div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
              borderColor: copied ? 'rgba(34,197,94,0.3)' : 'var(--base-300)',
              color: copied ? '#16a34a' : 'var(--base-content)',
            }}
          >
            {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy OTP</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CARD
// ─────────────────────────────────────────────────────────────────────────────
const DriverCard = memo(function DriverCard({ driverSnapshot, vehicleSnapshot }) {
  if (!driverSnapshot?.name && !driverSnapshot?.legalName) return null;
  const name   = driverSnapshot.legalName || driverSnapshot.name || 'Driver';
  const phone  = driverSnapshot.phone;
  const rating = driverSnapshot.rating;
  const photo  = driverSnapshot.photoUrl;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.25)' }}
      >
        {photo
          ? <img src={photo} alt={name} className="w-full h-full object-cover" />
          : <User size={16} style={{ color: '#22c55e' }} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold truncate" style={{ color: 'var(--base-content)' }}>{name}</span>
          {rating != null && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star size={9} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
              <span className="text-[10px] font-bold" style={{ color: 'var(--base-content)', opacity: 0.6 }}>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        {vehicleSnapshot && (
          <p className="text-[11px] truncate m-0 mt-0.5" style={{ color: 'var(--base-content)', opacity: 0.45 }}>
            {[vehicleSnapshot.make, vehicleSnapshot.model, vehicleSnapshot.color].filter(Boolean).join(' · ')}
            {vehicleSnapshot.registrationNumber && ` · ${vehicleSnapshot.registrationNumber}`}
          </p>
        )}
      </div>

      {phone && (
        <a
          href={`tel:${phone}`}
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center no-underline transition-colors"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.30)', color: '#22c55e' }}
        >
          <Phone size={14} />
        </a>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE STRIP
// ─────────────────────────────────────────────────────────────────────────────
const TimelineStrip = memo(function TimelineStrip({ status }) {
  const activeIdx = getTimelineIdx(status);

  return (
    <div className="flex items-start relative" style={{ gap: 0 }}>
      <div
        className="absolute"
        style={{ top: 11, left: '6%', right: '6%', height: 2, background: 'var(--base-300)', borderRadius: 2, zIndex: 0 }}
      />
      <motion.div
        className="absolute"
        style={{ top: 11, left: '6%', height: 2, borderRadius: 2, zIndex: 1 }}
        animate={{ width: `${(activeIdx / (TIMELINE.length - 1)) * 88}%`, background: '#22c55e' }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
      {TIMELINE.map((step, i) => {
        const done   = i <= activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step.status} className="flex flex-col items-center flex-1 relative z-10" style={{ gap: 4 }}>
            <motion.div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              animate={{
                background: done ? '#22c55e' : 'var(--base-200)',
                borderColor: done ? '#22c55e' : 'var(--base-300)',
                scale: active ? 1.2 : 1,
                boxShadow: active ? '0 0 0 3px rgba(34,197,94,0.20)' : 'none',
              }}
              style={{ border: '2px solid' }}
              transition={{ duration: 0.25 }}
            >
              {done && <Check size={9} color="white" strokeWidth={3} />}
            </motion.div>
            <p
              className="text-[8.5px] text-center font-semibold leading-tight m-0"
              style={{ color: done ? '#22c55e' : 'var(--base-content)', opacity: done ? 0.9 : 0.35, letterSpacing: '0.02em' }}
            >
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────
const BottomSheet = memo(function BottomSheet({
  open, onToggle,
  status, rideCode, booking, otp,
  onShowOtp, driverSnapshot, vehicleSnapshot,
  etaMinutes, distanceKm,
}) {
  const meta    = STATUS_META[status] || STATUS_META[STATUS.SEARCHING];
  const showOtp = status === STATUS.ARRIVED;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 72px)' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl"
      style={{
        maxHeight: '50vh',
        background: 'var(--base-200)',
        borderTop: '1px solid var(--base-300)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <button
        onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer px-4 pt-2.5 pb-2 flex flex-col items-center"
      >
        <div className="w-8 h-1 rounded-full mb-3 flex-shrink-0" style={{ background: 'var(--base-300)' }} />
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{meta.icon}</span>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
          </div>
          <div className="flex items-center gap-3">
            {etaMinutes != null && (
              <div className="flex items-center gap-1">
                <Clock size={11} style={{ color: '#2563eb' }} />
                <span className="text-xs font-black" style={{ color: '#2563eb' }}>{fmtEta(etaMinutes)}</span>
              </div>
            )}
            {distanceKm != null && (
              <span className="text-[11px] font-semibold" style={{ color: 'var(--base-content)', opacity: 0.4 }}>{fmtDist(distanceKm)}</span>
            )}
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} style={{ color: 'var(--base-content)', opacity: 0.4 }} />
            </motion.div>
          </div>
        </div>
      </button>

      <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(50vh - 72px)' }}>
        <AnimatePresence>
          {showOtp && otp && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={onShowOtp}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl mb-3 cursor-pointer border-none"
              style={{ background: 'rgba(139,92,246,0.10)', border: '1.5px solid rgba(139,92,246,0.30)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🔑</span>
                <div className="text-left">
                  <p className="text-sm font-bold m-0" style={{ color: '#7c3aed' }}>Show OTP to Driver</p>
                  <p className="text-[11px] m-0" style={{ color: 'rgba(124,58,237,0.65)' }}>Tap to reveal your ride code</p>
                </div>
              </div>
              <ArrowUpRight size={16} style={{ color: '#7c3aed' }} />
            </motion.button>
          )}
        </AnimatePresence>

        <div className="mb-3">
          <DriverCard driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot} />
        </div>

        <div className="mb-3">
          <TimelineStrip status={status} />
        </div>

        {booking && (
          <div
            className="rounded-xl px-3 py-2.5 mb-2"
            style={{ background: 'var(--base-300)', border: '1px solid var(--base-300)' }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest m-0 mb-2" style={{ opacity: 0.35 }}>Booking Details</p>
            {[
              ['Code',    booking.bookingCode],
              ['Type',    booking.bookingType?.replace(/_/g, ' ')],
              ['Payment', booking.paymentStatus],
              ['Fare',    booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount}` : null],
            ].map(([label, val]) => val ? (
              <div key={label} className="flex justify-between py-1 border-b last:border-b-0" style={{ borderColor: 'var(--base-300)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ opacity: 0.4 }}>{label}</span>
                <span className="text-[11px] font-semibold font-mono" style={{ opacity: 0.7 }}>{val}</span>
              </div>
            ) : null)}
          </div>
        )}

        {(booking?.patientLocation || booking?.destinationLocation) && (
          <div className="flex gap-3 px-1 py-2">
            <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
              <div className="w-px flex-1" style={{ background: 'var(--base-300)', minHeight: 20 }} />
              <div className="w-2 h-2 rounded-full" style={{ background: '#2563eb' }} />
            </div>
            <div className="flex flex-col gap-2.5 flex-1 min-w-0">
              <div>
                <p className="text-xs font-semibold m-0 truncate" style={{ color: 'var(--base-content)' }}>
                  {booking.patientLocation?.address || booking.patientLocation?.label || 'Pickup'}
                </p>
                <p className="text-[10px] m-0" style={{ opacity: 0.35 }}>Pickup</p>
              </div>
              <div>
                <p className="text-xs font-semibold m-0 truncate" style={{ color: 'var(--base-content)' }}>
                  {booking.destinationLocation?.address || booking.destinationLocation?.label || 'Destination'}
                </p>
                <p className="text-[10px] m-0" style={{ opacity: 0.35 }}>Destination</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const CompletedScreen = memo(function CompletedScreen({ booking, onBack, onRate }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--base-100)' }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 16 }}
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
        style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.30)' }}
      >
        <CheckCircle size={40} style={{ color: '#22c55e' }} />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-black text-center m-0 mb-2"
        style={{ color: 'var(--base-content)' }}
      >
        Ride Completed
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-center m-0 mb-8"
        style={{ opacity: 0.5 }}
      >
        Hope you had a safe journey.
        {booking?.fareBreakdown?.totalAmount && (
          <> · <span className="font-bold" style={{ color: '#2563eb' }}>₹{booking.fareBreakdown.totalAmount}</span></>
        )}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 w-full max-w-[280px]"
      >
        <button
          onClick={onRate}
          className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-none cursor-pointer"
          style={{ background: '#22c55e', color: '#fff' }}
        >
          <Star size={15} />
          Rate Experience
        </button>
        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-xl font-semibold text-sm border-none cursor-pointer"
          style={{ background: 'var(--base-300)', color: 'var(--base-content)', opacity: 0.7 }}
        >
          Back to Bookings
        </button>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CANCELLED SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const CancelledScreen = memo(function CancelledScreen({ onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--base-100)' }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
        style={{ background: 'rgba(239,68,68,0.10)', border: '2px solid rgba(239,68,68,0.25)' }}
      >
        <X size={36} style={{ color: '#ef4444' }} />
      </div>
      <h2 className="text-2xl font-black text-center m-0 mb-2" style={{ color: 'var(--base-content)' }}>
        Ride Cancelled
      </h2>
      <p className="text-sm text-center m-0 mb-8" style={{ opacity: 0.45 }}>
        Your ride was cancelled. Book again or contact support.
      </p>
      <button
        onClick={onBack}
        className="px-8 py-3.5 rounded-xl font-bold text-sm border-none cursor-pointer"
        style={{ background: '#2563eb', color: '#fff' }}
      >
        Back to Bookings
      </button>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCHING OVERLAY  (BUG 6 FIX: now overlay, not screen replacement)
// ─────────────────────────────────────────────────────────────────────────────
const SearchingOverlay = memo(function SearchingOverlay({ bookingCode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6"
      style={{ background: 'var(--base-100)' }}
    >
      <div className="relative w-24 h-24 mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="absolute inset-0 rounded-full"
          style={{ border: '3px solid transparent', borderTopColor: '#22c55e', borderRightColor: 'rgba(34,197,94,0.3)' }}
        />
        <div
          className="absolute inset-2 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.08)' }}
        >
          <Car size={28} style={{ color: '#22c55e' }} />
        </div>
      </div>
      <h3 className="text-xl font-black text-center m-0 mb-2" style={{ color: 'var(--base-content)' }}>
        Finding Your Driver
      </h3>
      <p className="text-sm text-center m-0 mb-1" style={{ opacity: 0.45 }}>
        Matching you with the best available driver nearby.
      </p>
      {bookingCode && (
        <p className="text-xs font-mono m-0 mt-3" style={{ opacity: 0.25 }}>#{bookingCode}</p>
      )}
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
        className="flex items-center gap-1.5 mt-8"
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
        <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
          You'll be notified instantly
        </span>
      </motion.div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const LoadingScreen = memo(function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--base-100)' }}
    >
      <Loader2 size={28} className="animate-spin" style={{ color: '#22c55e' }} />
      <p className="text-sm font-semibold m-0" style={{ opacity: 0.4 }}>Loading your ride...</p>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerRideLiveTracking() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const bookingId = params?.bookingId || null;
  const rideId    = params?.rideId    || null;

  // ── Redux ──────────────────────────────────────────────────────────────────
  const currentRide = useSelector(selectCurrentRide);
  const socketLive  = useSelector(selectSocketLive);
  const liveData    = useSelector(selectLiveData);
  const booking     = useSelector(selectSelectedBooking);

  // ── Socket ─────────────────────────────────────────────────────────────────
  // BUG 5 FIX: destructure `on` so it can be added to deps
  const { on, connected } = useSocket();
  const { locationUpdate, etaUpdate: etaEvt } = useBookingRoom(bookingId);
  const activeRideId = rideId || currentRide?._id || liveData?.rideId;
  const { trigger: triggerSos, sosActive, dismiss: dismissSos } = useSos(bookingId, activeRideId);

  // ── Google Maps ────────────────────────────────────────────────────────────
  const { isLoaded } = useGoogleMaps();

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mapRef            = useRef(null);
  const dirServiceRef     = useRef(null);
  const driverMarkerRef   = useRef(null);
  const driverMarkerElRef = useRef(null);
  const pickupMarkerRef   = useRef(null);
  const destMarkerRef     = useRef(null);
  const staticInitRef     = useRef(false);
  const driverPolyRef     = useRef(null);
  const overviewPolyRef   = useRef(null);

  // Animation
  const driverPosRef    = useRef(null);
  const driverTargetRef = useRef(null);
  const animFrameRef    = useRef(null);
  const isHiddenRef     = useRef(false);

  // Route recalc gating
  const lastRouteCalcPosRef = useRef(null);
  const routeCalcInFlight   = useRef(false);

  // Heading smoothing
  const headingRef    = useRef(0);
  const targetHeadRef = useRef(0);

  // OTP
  const otpRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [rawStatus,      setRawStatus]      = useState(null);
  const [otp,            setOtp]            = useState(null);
  const [etaMinutes,     setEtaMinutes]     = useState(null);
  const [remainingKm,    setRemainingKm]    = useState(null);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [showOtpModal,   setShowOtpModal]   = useState(false);
  const [showCompleted,  setShowCompleted]  = useState(false);
  const [showCancelled,  setShowCancelled]  = useState(false);
  const [followDriver,   setFollowDriver]   = useState(true);
  const [driverPos,      setDriverPos]      = useState(null);
  const [isInitLoading,  setIsInitLoading]  = useState(true);

  // ── Derived ────────────────────────────────────────────────────────────────
  const rd              = currentRide || liveData;
  const driverSnapshot  = useMemo(() => socketLive?.driverSnapshot  || rd?.driverSnapshot,  [socketLive, rd]);
  const vehicleSnapshot = useMemo(() => socketLive?.vehicleSnapshot || rd?.vehicleSnapshot, [socketLive, rd]);

  const pickupCoords = useMemo(() => {
    const c = rd?.pickup?.coordinates || booking?.patientLocation?.coordinates;
    return c?.length >= 2 ? { lat: c[1], lng: c[0] } : null;
  }, [rd, booking]);

  const dropoffCoords = useMemo(() => {
    const c = rd?.dropoff?.coordinates || booking?.destinationLocation?.coordinates;
    return c?.length >= 2 ? { lat: c[1], lng: c[0] } : null;
  }, [rd, booking]);

  const status = useMemo(() => {
    const raw = rawStatus || socketLive?.status || rd?.status || 'searching';
    return normalizeStatus(raw);
  }, [rawStatus, socketLive?.status, rd?.status]);

  // BUG 6 FIX: isSearching no longer gates map render — used only for overlay
  const isSearching = status === STATUS.SEARCHING || status === STATUS.ASSIGNED;
  const isPostOtp   = [STATUS.TRIP_STARTED, STATUS.AT_STOP].includes(status);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsInitLoading(true);
      try {
        await Promise.all([
          rideId    && dispatch(fetchRideTracking({ rideId })),
          rideId    && dispatch(fetchRideLive(rideId)),
          bookingId && dispatch(fetchMyBookingById({ bookingId })),
        ].filter(Boolean));
      } catch (e) {
        console.error('[Tracking] init:', e);
      } finally {
        setIsInitLoading(false);
      }
    };
    load();
  }, [rideId, bookingId]); // eslint-disable-line

  // ── BUG 2 FIX: Seed driverTargetRef from REST liveData on mount ────────────
  useEffect(() => {
    if (!liveData) return;
    // Try various field paths backends might use
    const loc =
      liveData.currentLocation ||
      liveData.driverLocation  ||
      liveData.location;
    if (loc?.coordinates?.length >= 2) {
      const seeded = { lat: loc.coordinates[1], lng: loc.coordinates[0] };
      driverTargetRef.current = seeded;
      driverPosRef.current    = seeded; // also seed interpolated pos
    } else if (loc?.lat != null && loc?.lng != null) {
      const seeded = { lat: loc.lat, lng: loc.lng };
      driverTargetRef.current = seeded;
      driverPosRef.current    = seeded;
    }
    // Seed heading if available
    if (liveData.heading != null) {
      headingRef.current    = liveData.heading;
      targetHeadRef.current = liveData.heading;
    }
  }, [liveData]);

  // ── Sync status from Redux ─────────────────────────────────────────────────
  useEffect(() => {
    const s = socketLive?.status || rd?.status;
    if (s) setRawStatus(s);
  }, [socketLive?.status, rd?.status]);

  // ── Sync ETA ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const eta = etaEvt?.etaMinutes ?? socketLive?.etaMinutes ?? liveData?.currentEtaMinutes;
    if (eta != null) setEtaMinutes(eta);
    const km = etaEvt?.distanceRemainingKm;
    if (km != null) setRemainingKm(km);
  }, [etaEvt, socketLive?.etaMinutes, liveData?.currentEtaMinutes]);

  // ── BUG 5 FIX: Socket events — `on` in deps so handlers stay fresh ─────────
  useEffect(() => {
    if (!on) return;
    const unsubs = [
      on('ride_status_changed',       (d) => { dispatch(socketRideStatusChanged(d));      setRawStatus(d.status); }),
      on('driver_accepted',           (d) => { dispatch(socketDriverAccepted(d));         setRawStatus('driver_accepted'); }),
      on('driver_en_route',           (d) => { dispatch(socketDriverEnRoute(d));          setRawStatus('driver_en_route'); }),
      on('driver_arrived',            (d) => { dispatch(socketDriverArrived(d));          setRawStatus('driver_arrived'); setSheetOpen(true); }),
      on('otp_verified',              (d) => { dispatch(socketOtpVerified(d));            setRawStatus('otp_verified'); setShowOtpModal(false); }),
      on('ride_started',              (d) => { dispatch(socketRideStarted(d));            setRawStatus('in_progress'); }),
      on('ride_completed',            (d) => { dispatch(socketRideCompleted(d));          setRawStatus('completed'); }),
      on('ride_cancelled',            (d) => { dispatch(socketRideCancelled(d));          setRawStatus('cancelled'); }),
      on('ride_assigned',             (d) => { dispatch(socketRideAssigned(d));           setRawStatus(d.status); }),
      on('navigation_target_changed', (d) => { dispatch(socketNavigationTargetChanged(d)); }),
      on('otp_required',              (d) => {
        if (d?.otp) { setOtp(String(d.otp)); otpRef.current = String(d.otp); }
        setRawStatus('driver_arrived');
        setSheetOpen(true);
      }),
    ].filter(Boolean);
    return () => unsubs.forEach(fn => typeof fn === 'function' && fn());
  }, [on, dispatch]); // BUG 5 FIX: `on` in deps

  // ── Socket location_update ─────────────────────────────────────────────────
  useEffect(() => {
    if (!locationUpdate) return;
    dispatch(socketLocationUpdate(locationUpdate));
    const { lat, lng, heading = 0 } = locationUpdate;
    if (typeof lat === 'number' && typeof lng === 'number') {
      driverTargetRef.current = { lat, lng };
      targetHeadRef.current   = heading;
    }
  }, [locationUpdate, dispatch]);

  // ── Socket ETA ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!etaEvt) return;
    dispatch(socketEtaUpdate(etaEvt));
    if (etaEvt.etaMinutes != null) setEtaMinutes(etaEvt.etaMinutes);
    if (etaEvt.distanceRemainingKm != null) setRemainingKm(etaEvt.distanceRemainingKm);
  }, [etaEvt, dispatch]);

  // ── Completed / cancelled triggers ────────────────────────────────────────
  useEffect(() => {
    if (status === STATUS.COMPLETED) {
      const t = setTimeout(() => setShowCompleted(true), 2000);
      return () => clearTimeout(t);
    }
    if (status === STATUS.CANCELLED) {
      const t = setTimeout(() => setShowCancelled(true), 1000);
      return () => clearTimeout(t);
    }
  }, [status]);

  // ── Polling fallback ───────────────────────────────────────────────────────
  useEffect(() => {
    if (connected || !activeRideId) return;
    const id = setInterval(() => dispatch(fetchRideLive(activeRideId)), POLL_MS);
    return () => clearInterval(id);
  }, [connected, activeRideId, dispatch]);

  // ── Page Visibility API ────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => { isHiddenRef.current = document.hidden; };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── RAF animation loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);
      if (isHiddenRef.current) return;

      const target = driverTargetRef.current;
      if (!target) return;

      const current = driverPosRef.current || { ...target };
      const newLat  = lerp(current.lat, target.lat, 0.10);
      const newLng  = lerp(current.lng, target.lng, 0.10);
      driverPosRef.current = { lat: newLat, lng: newLng };

      let diff = targetHeadRef.current - headingRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      headingRef.current += diff * 0.10;

      if (driverMarkerRef.current) {
        driverMarkerRef.current.position = { lat: newLat, lng: newLng };
      }
      if (driverMarkerElRef.current) {
        updateDriverMarkerRotation(driverMarkerElRef.current, headingRef.current);
      }

      if (followDriver && mapRef.current) {
        mapRef.current.panTo({ lat: newLat, lng: newLng });
      }

      setDriverPos({ lat: newLat, lng: newLng });
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [followDriver]);

  // ── BUG 3 FIX: Create driver marker — wait for target pos to exist ─────────
  useEffect(() => {
    if (!mapLoaded || driverMarkerRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // BUG 3 FIX: use seeded driverPosRef first, then pickupCoords as last resort
    const initialPos = driverPosRef.current || pickupCoords || { lat: 16.506, lng: 80.648 };

    const el = buildDriverMarkerElement();
    driverMarkerElRef.current = el;
    driverMarkerRef.current   = new window.google.maps.marker.AdvancedMarkerElement({
      map:      mapRef.current,
      content:  el,
      position: initialPos,
      zIndex:   20,
    });
  }, [mapLoaded, pickupCoords]);

  // ── Create static markers once ────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || staticInitRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;
    let created = false;

    if (pickupCoords && !pickupMarkerRef.current) {
      pickupMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: buildPickupMarkerEl(), position: pickupCoords, zIndex: 10,
      });
      created = true;
    }
    if (dropoffCoords && !destMarkerRef.current) {
      destMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: buildDestMarkerEl(), position: dropoffCoords, zIndex: 10,
      });
      created = true;
    }
    if (created) staticInitRef.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // ── ROUTE SYSTEM ───────────────────────────────────────────────────────────
  const createOrUpdatePolyline = useCallback((polyRef, path, options) => {
    if (!window.google?.maps?.Polyline) return;
    if (polyRef.current) {
      polyRef.current.setPath(path);
      polyRef.current.setOptions(options);
    } else {
      polyRef.current = new window.google.maps.Polyline({
        map: mapRef.current, path, ...options,
      });
    }
  }, []);

  const clearPolyline = useCallback((polyRef) => {
    if (polyRef.current) {
      polyRef.current.setMap(null);
      polyRef.current = null;
    }
  }, []);

  const fetchRoute = useCallback(async (origin, destination) => {
    if (!dirServiceRef.current || !origin || !destination) return null;
    try {
      const result = await dirServiceRef.current.route({
        origin,
        destination,
        travelMode:               window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      if (result.status !== 'OK') return null;
      const encoded = result.routes[0]?.overview_polyline;
      return encoded ? decodePolyline(encoded) : [];
    } catch {
      return null;
    }
  }, []);

  const calcRoutes = useCallback(async (driverPosition) => {
    if (routeCalcInFlight.current) return;
    routeCalcInFlight.current = true;
    try {
      const origin = driverPosition || driverPosRef.current;

      // Overview route (pickup→dest) — draw once
      if (pickupCoords && dropoffCoords && !overviewPolyRef.current) {
        const path = await fetchRoute(pickupCoords, dropoffCoords);
        if (path?.length) {
          createOrUpdatePolyline(overviewPolyRef, path, {
            strokeColor:   '#94a3b8',
            strokeWeight:  3,
            strokeOpacity: 0,
            icons: [{
              icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#94a3b8', fillOpacity: 0.5, strokeWeight: 0, scale: 2 },
              offset: '0',
              repeat: '12px',
            }],
          });
        }
      }

      // Driver route — only if origin known
      if (origin) {
        // BUG 4 FIX: dest based on phase; origin must be driver pos, not pickup
        const dest = isPostOtp ? dropoffCoords : pickupCoords;
        const path = await fetchRoute(origin, dest);
        if (path?.length) {
          if (isPostOtp) {
            createOrUpdatePolyline(driverPolyRef, path, {
              strokeColor:   ROUTE_COLOR.TRIP_ACTIVE,
              strokeWeight:  6,
              strokeOpacity: 0.90,
              icons: [{
                icon: { path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW, strokeColor: '#fff', strokeWeight: 2, scale: 3, strokeOpacity: 0.9 },
                offset: '100%', repeat: '60px',
              }],
            });
          } else {
            createOrUpdatePolyline(driverPolyRef, path, {
              strokeColor:   ROUTE_COLOR.DRIVER_TO_PICKUP,
              strokeWeight:  5,
              strokeOpacity: 0.92,
              icons: [{
                icon: { path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW, strokeColor: '#fff', strokeWeight: 2, scale: 3, strokeOpacity: 0.9 },
                offset: '100%', repeat: '50px',
              }],
            });
          }
          lastRouteCalcPosRef.current = driverPosRef.current || origin;
        }
      }
    } finally {
      routeCalcInFlight.current = false;
    }
  }, [pickupCoords, dropoffCoords, isPostOtp, fetchRoute, createOrUpdatePolyline]);

  // Recalc on significant driver movement
  useEffect(() => {
    if (!mapLoaded || !driverPos) return;
    const dist = haversineMeters(lastRouteCalcPosRef.current, driverPos);
    if (dist < ROUTE_RECALC_DISTANCE_THRESHOLD_M && lastRouteCalcPosRef.current) return;
    calcRoutes(driverPos);
  }, [driverPos, mapLoaded]); // eslint-disable-line

  // BUG 4 FIX: Recalc on phase change — pass null origin so calcRoutes uses driverPosRef
  useEffect(() => {
    if (!mapLoaded) return;
    clearPolyline(driverPolyRef);
    lastRouteCalcPosRef.current = null;
    // BUG 4 FIX: pass null — calcRoutes will use driverPosRef.current internally
    calcRoutes(null);
  }, [mapLoaded, isPostOtp]); // eslint-disable-line

  // ── Fit bounds on load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const bounds    = new window.google.maps.LatLngBounds();
    let hasPoints   = false;
    const seedPos   = driverPosRef.current; // use seeded pos if available
    [pickupCoords, dropoffCoords, seedPos].forEach(p => {
      if (p) { bounds.extend(p); hasPoints = true; }
    });
    if (hasPoints) {
      mapRef.current.fitBounds(bounds, { top: 80, bottom: 180, left: 30, right: 30 });
    }
  }, [mapLoaded]); // eslint-disable-line

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      [driverMarkerRef, pickupMarkerRef, destMarkerRef].forEach(r => {
        if (r.current) { r.current.map = null; r.current = null; }
      });
      [driverPolyRef, overviewPolyRef].forEach(r => {
        if (r.current) { r.current.setMap(null); r.current = null; }
      });
      staticInitRef.current = false;
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current        = map;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    setMapLoaded(true);
  }, []);

  const handleBack = useCallback(() => {
    if (window.history?.length > 1) router.back();
    else router.push('/bookings');
  }, [router]);

  const handleRate = useCallback(() => {
    router.push(bookingId ? `/bookings/${bookingId}/rate` : '/bookings');
  }, [router, bookingId]);

  const handleRecenter = useCallback(() => {
    setFollowDriver(true);
    const pos = driverPosRef.current || pickupCoords;
    if (pos && mapRef.current) {
      mapRef.current.panTo(pos);
      mapRef.current.setZoom(16);
    }
  }, [pickupCoords]);

  const handleSos = useCallback(() => {
    if (sosActive) dismissSos();
    else triggerSos({ sosType: 'safety' });
  }, [sosActive, triggerSos, dismissSos]);

  // ── Render guards ──────────────────────────────────────────────────────────
  if (isInitLoading || !isLoaded) return <LoadingScreen />;
  if (showCompleted) return <CompletedScreen booking={booking} onBack={handleBack} onRate={handleRate} />;
  if (showCancelled) return <CancelledScreen onBack={handleBack} />;

  const meta = STATUS_META[status] || STATUS_META[STATUS.SEARCHING];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-family-poppins, ui-sans-serif, system-ui, sans-serif)' }}>

      {/* ── MAP — BUG 6 FIX: always mounted so markers/route init early ── */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={driverPosRef.current || pickupCoords || { lat: 16.506, lng: 80.648 }}
          zoom={15}
          options={{
            mapId:            MAP_ID,
            disableDefaultUI: true,
            clickableIcons:   false,
            gestureHandling:  'greedy',
            mapTypeId:        'roadmap',
            styles:           MAP_STYLES,
          }}
          onLoad={onMapLoad}
          onDragStart={() => setFollowDriver(false)}
        />
      </div>

      {/* BUG 6 FIX: SearchingOverlay on top of map (z-20), not replacing it */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            key="searching-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20"
          >
            <SearchingOverlay bookingCode={booking?.bookingCode} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OFFLINE BANNER ──────────────────────────────────── */}
      <AnimatePresence>
        {!connected && !isSearching && (
          <motion.div
            initial={{ y: -40 }} animate={{ y: 0 }} exit={{ y: -40 }}
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-semibold"
            style={{ background: '#f59e0b', color: '#1c1917' }}
          >
            <WifiOff size={12} />
            Reconnecting — tracking may be delayed
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30">
        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={{
            background:     'color-mix(in srgb, var(--base-200) 94%, transparent)',
            backdropFilter: 'blur(14px)',
            borderBottom:   '1px solid var(--base-300)',
          }}
        >
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer border-none"
            style={{ background: 'var(--base-300)', color: 'var(--base-content)', opacity: 0.7 }}
          >
            <ChevronLeft size={17} />
          </button>

          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: connected ? '#22c55e' : '#f59e0b',
              boxShadow:  connected ? '0 0 5px #22c55e' : 'none',
            }}
          />

          <span
            className="text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
            style={{ color: meta.color }}
          >
            {meta.icon} {meta.label}
          </span>

          <div className="flex-1" />

          {etaMinutes != null && (
            <div className="flex items-center gap-1">
              <Clock size={10} style={{ color: '#2563eb' }} />
              <span className="text-xs font-black" style={{ color: '#2563eb' }}>{fmtEta(etaMinutes)}</span>
            </div>
          )}
          {remainingKm != null && (
            <span className="text-[11px] font-semibold" style={{ opacity: 0.38 }}>{fmtDist(remainingKm)}</span>
          )}
        </div>

        {/* Driver arrived banner */}
        <AnimatePresence>
          {status === STATUS.ARRIVED && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOtpModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer border-none"
              style={{
                background:     'rgba(139,92,246,0.16)',
                backdropFilter: 'blur(10px)',
                borderBottom:   '1px solid rgba(139,92,246,0.25)',
              }}
            >
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ scale: [1, 1.18, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                >📍</motion.span>
                <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>
                  Driver has arrived — show OTP to start
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: '#7c3aed' }}>Show OTP</span>
                <ArrowUpRight size={11} style={{ color: '#7c3aed' }} />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Trip in progress banner */}
        <AnimatePresence>
          {status === STATUS.TRIP_STARTED && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2"
              style={{
                background:     'rgba(37,99,235,0.10)',
                backdropFilter: 'blur(10px)',
                borderBottom:   '1px solid rgba(37,99,235,0.20)',
              }}
            >
              <Zap size={11} style={{ color: '#2563eb' }} />
              <span className="text-[11px] font-bold" style={{ color: '#2563eb' }}>
                Ride in progress · Heading to hospital
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── FABs (right side) — z-30 so above searching overlay ── */}
      <div
        className="absolute right-3 z-30 flex flex-col gap-2"
        style={{ top: 100 }}
      >
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleRecenter}
          className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer border-none"
          style={{
            background:     followDriver ? '#22c55e' : 'color-mix(in srgb, var(--base-200) 92%, transparent)',
            color:          followDriver ? '#fff' : 'var(--base-content)',
            boxShadow:      '0 2px 12px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(10px)',
            border:         followDriver ? 'none' : '1px solid var(--base-300)',
          }}
        >
          <Navigation size={15} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleSos}
          className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer border-none"
          style={{
            background:     sosActive ? '#ef4444' : 'rgba(239,68,68,0.10)',
            color:          sosActive ? '#fff' : '#ef4444',
            boxShadow:      '0 2px 12px rgba(0,0,0,0.12)',
            backdropFilter: 'blur(10px)',
            border:         sosActive ? 'none' : '1px solid rgba(239,68,68,0.25)',
          }}
          animate={sosActive ? { scale: [1, 1.06, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          {sosActive ? <ShieldAlert size={15} /> : <Shield size={15} />}
        </motion.button>

        {!connected && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => activeRideId && dispatch(fetchRideLive(activeRideId))}
            className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer border-none"
            style={{
              background:     'color-mix(in srgb, var(--base-200) 90%, transparent)',
              color:          'var(--base-content)',
              backdropFilter: 'blur(10px)',
              border:         '1px solid var(--base-300)',
              boxShadow:      '0 2px 12px rgba(0,0,0,0.12)',
              opacity:        0.7,
            }}
          >
            <RefreshCw size={14} />
          </motion.button>
        )}
      </div>

      {/* ── SOS BANNER ──────────────────────────────────────── */}
      <AnimatePresence>
        {sosActive && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed left-4 right-4 z-40 flex items-center gap-3 p-3.5 rounded-xl"
            style={{ bottom: 96, background: '#ef4444', boxShadow: '0 4px 24px rgba(239,68,68,0.40)' }}
          >
            <ShieldAlert size={18} color="white" className="flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-white m-0">SOS Alert Sent</p>
              <p className="text-xs text-red-100 m-0">Help is on the way. Stay calm.</p>
            </div>
            <button onClick={dismissSos} className="border-none bg-transparent cursor-pointer p-1">
              <X size={14} color="rgba(255,255,255,0.8)" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM SHEET ────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onToggle={() => setSheetOpen(p => !p)}
        status={status}
        rideCode={rd?.rideCode}
        booking={booking}
        otp={otp}
        onShowOtp={() => setShowOtpModal(true)}
        driverSnapshot={driverSnapshot}
        vehicleSnapshot={vehicleSnapshot}
        etaMinutes={etaMinutes}
        distanceKm={remainingKm}
      />

      {/* ── OTP MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {showOtpModal && otp && (
          <OtpModal otp={otp} onClose={() => setShowOtpModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}