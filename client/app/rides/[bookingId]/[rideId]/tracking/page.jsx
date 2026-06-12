 
'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }    from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence }  from 'framer-motion';
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps }            from '@/context/GoogleMapsProvider';
import {
  Phone, Navigation, Clock, Shield,
  ShieldAlert, WifiOff, ChevronDown, ChevronLeft,
  CheckCircle, Loader2, X, Star, Car, RefreshCw,
  AlertTriangle, Zap, Copy, Check, ArrowUpRight,
  Maximize2, Minimize2, Plus, Minus, Heart,
  MapPin, Activity,
} from 'lucide-react';

import {
  fetchRideLive, fetchRideTracking,
  selectCurrentRide, selectSocketLive, selectLiveData,
  socketLocationUpdate, socketEtaUpdate, socketRideStatusChanged,
  socketDriverAccepted, socketDriverEnRoute, socketDriverArrived,
  socketOtpVerified, socketRideStarted, socketRideCompleted,
  socketRideCancelled, socketNavigationTargetChanged, socketRideAssigned,
} from '@/store/slices/rideRequestSlice';

import { fetchMyBookingById, selectSelectedBooking } from '@/store/slices/bookingSlice';
import { useSocket, useBookingRoom, useSos } from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID  = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const POLL_MS = 5000;

const STATUS_CONFIG = {
  searching:       { label: 'Finding Driver',   color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  border: 'rgba(245,158,11,0.35)',  icon: '🔍', pulse: true  },
  driver_assigned: { label: 'Driver Assigned',  color: '#3b82f6', bg: 'rgba(59,130,246,0.13)',  border: 'rgba(59,130,246,0.35)',  icon: '👤', pulse: false },
  driver_accepted: { label: 'Driver On Way',    color: '#06b6d4', bg: 'rgba(6,182,212,0.13)',   border: 'rgba(6,182,212,0.35)',   icon: '🚗', pulse: true  },
  driver_en_route: { label: 'Driver En Route',  color: '#06b6d4', bg: 'rgba(6,182,212,0.13)',   border: 'rgba(6,182,212,0.35)',   icon: '🚗', pulse: true  },
  driver_arrived:  { label: 'Driver Arrived!',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.45)',  icon: '📍', pulse: true  },
  otp_verified:    { label: 'Starting Ride',    color: '#10b981', bg: 'rgba(16,185,129,0.13)',  border: 'rgba(16,185,129,0.35)',  icon: '✅', pulse: false },
  in_progress:     { label: 'Ride In Progress', color: '#22c55e', bg: 'rgba(34,197,94,0.13)',   border: 'rgba(34,197,94,0.35)',   icon: '🏥', pulse: false },
  at_stop:         { label: 'Stopped',          color: '#f97316', bg: 'rgba(249,115,22,0.13)',  border: 'rgba(249,115,22,0.35)',  icon: '⏸️', pulse: false },
  completed:       { label: 'Ride Completed',   color: '#64748b', bg: 'rgba(100,116,139,0.13)', border: 'rgba(100,116,139,0.35)', icon: '🎉', pulse: false },
  cancelled:       { label: 'Ride Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.13)',   border: 'rgba(239,68,68,0.35)',   icon: '❌', pulse: false },
};

const CA_STATUS_CONFIG = {
  not_joined:         { label: 'Care Assigned',     color: '#94a3b8', bg: 'rgba(148,163,184,0.13)', border: 'rgba(148,163,184,0.35)', dot: '#94a3b8' },
  en_route_to_pickup: { label: 'Care En Route',     color: '#3b82f6', bg: 'rgba(59,130,246,0.13)',  border: 'rgba(59,130,246,0.35)',  dot: '#3b82f6' },
  at_pickup:          { label: 'Care At Join Point', color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  border: 'rgba(245,158,11,0.35)',  dot: '#f59e0b' },
  in_ride:            { label: 'Care In Ride',       color: '#22c55e', bg: 'rgba(34,197,94,0.13)',   border: 'rgba(34,197,94,0.35)',   dot: '#22c55e' },
  departed:           { label: 'Care Completed',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.13)',  border: 'rgba(139,92,246,0.35)',  dot: '#8b5cf6' },
};

const TIMELINE_STEPS = [
  { key: 'searching',       label: 'Confirmed' },
  { key: 'driver_assigned', label: 'Assigned'  },
  { key: 'driver_en_route', label: 'En Route'  },
  { key: 'driver_arrived',  label: 'Arrived'   },
  { key: 'in_progress',     label: 'Started'   },
  { key: 'completed',       label: 'Done'      },
];

const STEP_ORDER = TIMELINE_STEPS.map(s => s.key);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const lerp   = (a, b, t) => a + (b - a) * t;
const fmtEta = (min) => { if (min == null) return null; if (min < 1) return '< 1 min'; return `${Math.round(min)} min`; };
const fmtKm  = (km)  => { if (km  == null) return null; if (km < 1) return `${Math.round(km * 1000)} m`; return `${km.toFixed(1)} km`; };

const getStepIdx = (status) => {
  if (['driver_accepted', 'driver_en_route'].includes(status)) return STEP_ORDER.indexOf('driver_en_route');
  if (status === 'otp_verified') return STEP_ORDER.indexOf('driver_arrived');
  const idx = STEP_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER HTML BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

// Driver: animated car with heading ring + blue glow + speed indicator
const createDriverMarkerHtml = (heading = 0, speedKmh = 0) => {
  const isMoving = speedKmh > 5;
  return `
  <div style="position:absolute;width:0;height:0;pointer-events:none;">
    <div style="position:absolute;width:72px;height:72px;left:-36px;top:-36px;display:flex;align-items:center;justify-content:center;">

      <!-- outer pulse ring (only when moving) -->
      ${isMoving ? `<div style="
        position:absolute;width:68px;height:68px;border-radius:50%;
        background:radial-gradient(circle,rgba(59,130,246,0.22) 0%,transparent 70%);
        animation:driverRingPulse 1.8s infinite ease-out;pointer-events:none;
      "></div>` : ''}

      <!-- accuracy circle -->
      <div style="
        position:absolute;width:48px;height:48px;border-radius:50%;
        border:2px solid rgba(59,130,246,0.35);
        background:rgba(59,130,246,0.06);
        pointer-events:none;
      "></div>

      <!-- heading arrow -->
      <div style="
        position:absolute;width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-bottom:14px solid rgba(59,130,246,0.85);
        top:6px;left:50%;transform:translateX(-50%) rotate(${heading}deg);
        transform-origin:bottom center;
        transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        pointer-events:none;
        filter:drop-shadow(0 2px 4px rgba(59,130,246,0.6));
      "></div>

      <!-- shadow -->
      <div style="
        position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);
        width:44px;height:11px;border-radius:50%;
        background:rgba(0,0,0,0.28);filter:blur(6px);pointer-events:none;
      "></div>

      <!-- car emoji -->
      <div id="driverEmojiWrap" style="
        position:relative;font-size:34px;line-height:1;
        filter:drop-shadow(0 6px 12px rgba(0,0,0,0.55)) drop-shadow(0 2px 5px rgba(59,130,246,0.70));
        z-index:2;pointer-events:none;user-select:none;
      ">🚗</div>

      <!-- speed badge -->
      ${isMoving ? `<div style="
        position:absolute;bottom:-4px;right:-4px;
        background:#3b82f6;color:#fff;
        font-size:7px;font-weight:800;font-family:system-ui,sans-serif;
        padding:1px 4px;border-radius:6px;letter-spacing:0.04em;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        pointer-events:none;z-index:3;
      ">${Math.round(speedKmh)}<span style="font-size:5px;margin-left:1px;">km/h</span></div>` : ''}
    </div>
  </div>`;
};

// Care assistant: heart with status-aware color + join-state indicator
const createCaMarkerHtml = (caStatus = 'not_joined', caName = '') => {
  const isInRide = caStatus === 'in_ride';
  const isAtJP   = caStatus === 'at_pickup';
  const colors   = {
    not_joined:         { ring: 'rgba(148,163,184,0.30)', glow: 'rgba(148,163,184,0.25)', shadow: 'rgba(148,163,184,0.50)' },
    en_route_to_pickup: { ring: 'rgba(59,130,246,0.35)',  glow: 'rgba(59,130,246,0.25)',  shadow: 'rgba(59,130,246,0.60)'  },
    at_pickup:          { ring: 'rgba(245,158,11,0.45)',  glow: 'rgba(245,158,11,0.30)',  shadow: 'rgba(245,158,11,0.70)'  },
    in_ride:            { ring: 'rgba(34,197,94,0.45)',   glow: 'rgba(34,197,94,0.25)',   shadow: 'rgba(34,197,94,0.65)'   },
    departed:           { ring: 'rgba(139,92,246,0.35)',  glow: 'rgba(139,92,246,0.20)',  shadow: 'rgba(139,92,246,0.55)'  },
  };
  const c = colors[caStatus] || colors.not_joined;

  return `
  <div style="position:absolute;width:0;height:0;pointer-events:none;">
    <div style="position:absolute;width:72px;height:72px;left:-36px;top:-36px;display:flex;align-items:center;justify-content:center;flex-direction:column;">

      <!-- glow ring -->
      <div style="
        position:absolute;width:62px;height:62px;border-radius:50%;
        background:radial-gradient(circle,${c.glow} 0%,transparent 70%);
        animation:caRingPulse 2s infinite ease-out;pointer-events:none;
      "></div>

      <!-- status ring -->
      <div style="
        position:absolute;width:48px;height:48px;border-radius:50%;
        border:2.5px solid ${c.ring};
        pointer-events:none;
        ${isAtJP ? 'animation:jpRingPulse 1.2s infinite ease-in-out;' : ''}
      "></div>

      <!-- shadow -->
      <div style="
        position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);
        width:40px;height:10px;border-radius:50%;
        background:rgba(0,0,0,0.26);filter:blur(5px);pointer-events:none;
      "></div>

      <!-- heart emoji — bounce when in_ride -->
      <div style="
        position:relative;font-size:${isInRide ? '32px' : '30px'};line-height:1;
        filter:drop-shadow(0 6px 10px rgba(0,0,0,0.45)) drop-shadow(0 2px 6px ${c.shadow});
        z-index:2;pointer-events:none;user-select:none;
        ${isInRide ? 'animation:caHeartBounce 1.4s infinite ease-in-out;' : ''}
      ">${isInRide ? '❤️‍🔥' : isAtJP ? '⏳' : '❤️'}</div>

      <!-- name label -->
      ${caName ? `<div style="
        position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.70);color:#fff;
        font-size:8px;font-weight:800;letter-spacing:0.05em;
        padding:1px 6px;border-radius:8px;white-space:nowrap;
        font-family:system-ui,sans-serif;pointer-events:none;
        box-shadow:0 2px 6px rgba(0,0,0,0.40);
      ">${caName.split(' ')[0]}</div>` : ''}
    </div>
  </div>`;
};

// Pickup — blue pin
const createPickupMarkerHtml = () => `
  <div style="position:absolute;left:-20px;top:-60px;display:flex;flex-direction:column;align-items:center;pointer-events:none;user-select:none;">
    <div style="font-size:38px;line-height:1;filter:drop-shadow(0 6px 10px rgba(59,130,246,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.40));">📍</div>
    <div style="background:rgba(59,130,246,0.95);color:#fff;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.30);font-family:system-ui,sans-serif;">Pickup</div>
  </div>`;

// Hospital/Dropoff — red pin
const createDestMarkerHtml = () => `
  <div style="position:absolute;left:-20px;top:-60px;display:flex;flex-direction:column;align-items:center;pointer-events:none;user-select:none;">
    <div style="font-size:38px;line-height:1;filter:drop-shadow(0 6px 10px rgba(239,68,68,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.40));">🏥</div>
    <div style="background:rgba(239,68,68,0.95);color:#fff;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.30);font-family:system-ui,sans-serif;">Hospital</div>
  </div>`;

// CA Join Point — gold flag, completed = green checkmark
const createJpMarkerHtml = (completed = false) => `
  <div style="position:absolute;left:-22px;top:-64px;display:flex;flex-direction:column;align-items:center;pointer-events:none;user-select:none;">
    <div style="
      width:44px;height:44px;border-radius:50%;
      background:${completed ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#f59e0b,#d97706)'};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 6px 18px ${completed ? 'rgba(34,197,94,0.55)' : 'rgba(245,158,11,0.55)'};
      border:2.5px solid #fff;
      ${completed ? '' : 'animation:jpBobble 2s infinite ease-in-out;'}
    ">
      <span style="font-size:20px;line-height:1;">${completed ? '✅' : '📌'}</span>
    </div>
    <!-- pin tail -->
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid ${completed ? '#16a34a' : '#d97706'};margin-top:-1px;"></div>
    <div style="
      background:${completed ? 'rgba(34,197,94,0.95)' : 'rgba(245,158,11,0.95)'};color:#fff;
      padding:2px 8px;border-radius:20px;font-size:8px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;
      white-space:nowrap;margin-top:3px;box-shadow:0 2px 8px rgba(0,0,0,0.30);font-family:system-ui,sans-serif;
    ">${completed ? 'CA Joined ✓' : 'Join Point'}</div>
  </div>`;

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const FabBtn = memo(function FabBtn({ onClick, active, danger, children, title }) {
  return (
    <motion.button whileTap={{ scale: 0.86 }} onClick={onClick} title={title}
      className={[
        'w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border shadow-[0_4px_20px_rgba(0,0,0,0.38)] transition-colors',
        danger
          ? (active ? 'bg-error border-error text-error-content' : 'bg-error/10 border-error/30 text-error')
          : (active ? 'bg-primary text-primary-content border-primary' : 'bg-base-200/90 text-base-content/60 border-base-300 hover:text-base-content'),
      ].join(' ')}>
      {children}
    </motion.button>
  );
});

const OtpDisplay = memo(function OtpDisplay({ otp, onClose }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(String(otp)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [otp]);
  if (!otp) return null;
  const digits = String(otp).split('');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.80, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.80, opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-full max-w-sm rounded-3xl p-7 bg-base-200 border border-base-300 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-black text-base-content m-0">Your Ride OTP</h3>
            <p className="text-xs text-base-content/50 mt-1 m-0">Show this to your driver to start the ride</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-base-300 flex items-center justify-center text-base-content/50 cursor-pointer border border-base-300">
            <X size={14} />
          </button>
        </div>
        <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-5 bg-warning/10 border border-warning/30">
          <AlertTriangle size={13} className="text-warning flex-shrink-0" />
          <p className="text-xs font-semibold text-warning m-0">Never share this with anyone except your driver</p>
        </motion.div>
        <div className="flex gap-2.5 justify-center mb-6">
          {digits.map((d, i) => (
            <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 400 }}
              className="w-[54px] h-[64px] rounded-2xl flex items-center justify-center font-black text-3xl border-2"
              style={{ background: 'rgba(59,130,246,0.12)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
              {d}
            </motion.div>
          ))}
        </div>
        <button onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-base-300 text-sm font-semibold text-base-content/60 hover:text-base-content transition-all cursor-pointer bg-transparent">
          {copied ? <><Check size={14} className="text-success" /> Copied!</> : <><Copy size={14} /> Copy OTP</>}
        </button>
      </motion.div>
    </motion.div>
  );
});

const DriverCard = memo(function DriverCard({ driverSnapshot, vehicleSnapshot }) {
  if (!driverSnapshot?.name && !driverSnapshot?.legalName) return null;
  const name   = driverSnapshot.legalName || driverSnapshot.name;
  const phone  = driverSnapshot.phone;
  const rating = driverSnapshot.rating;
  const photo  = driverSnapshot.photoUrl;
  const v      = vehicleSnapshot;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3.5 rounded-2xl border"
      style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.22)' }}>
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(59,130,246,0.12)' }}>
        {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : <span className="text-2xl">🚗</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-base-content m-0 truncate">{name}</p>
          {rating && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star size={10} className="text-warning fill-warning" />
              <span className="text-[10px] font-bold text-base-content/60">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        {v && (
          <p className="text-[11px] text-base-content/50 m-0 mt-0.5 truncate flex items-center gap-1">
            <Car size={10} className="flex-shrink-0 opacity-60" />
            {[v.make, v.model, v.color].filter(Boolean).join(' · ')}
            {v.registrationNumber && ` · ${v.registrationNumber}`}
          </p>
        )}
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="w-10 h-10 rounded-xl flex items-center justify-center no-underline flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.30)', color: '#3b82f6' }}>
          <Phone size={15} />
        </a>
      )}
    </motion.div>
  );
});

const CareAssistantCard = memo(function CareAssistantCard({ caSnapshot, caStatus, jpCompleted }) {
  if (!caSnapshot) return null;
  const name  = caSnapshot.name || caSnapshot.fullName || 'Care Assistant';
  const phone = caSnapshot.phone;
  const photo = caSnapshot.photoUrl;
  const caCfg = CA_STATUS_CONFIG[caStatus] || CA_STATUS_CONFIG.not_joined;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3.5 rounded-2xl border"
      style={{ background: 'rgba(236,72,153,0.06)', borderColor: 'rgba(236,72,153,0.22)' }}>
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(236,72,153,0.12)' }}>
        {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : <span className="text-2xl">❤️</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-base-content m-0 truncate">{name}</p>
          {jpCompleted && <span className="text-[9px] bg-success/15 text-success border border-success/30 px-1.5 py-0.5 rounded-full font-bold">In Ride ✓</span>}
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border mt-1"
          style={{ background: caCfg.bg, borderColor: caCfg.border, color: caCfg.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: caCfg.dot }} />
          {caCfg.label}
        </span>
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="w-10 h-10 rounded-xl flex items-center justify-center no-underline flex-shrink-0"
          style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.30)', color: '#ec4899' }}>
          <Phone size={15} />
        </a>
      )}
    </motion.div>
  );
});

const RideTimeline = memo(function RideTimeline({ status }) {
  const activeIdx = getStepIdx(status || 'searching');
  return (
    <div className="px-3 py-3">
      <div className="flex items-start justify-between relative">
        <div className="absolute top-3 h-0.5 bg-base-300" style={{ left: '5%', right: '5%', zIndex: 0 }} />
        <motion.div className="absolute top-3 h-0.5 bg-primary" style={{ left: '5%', zIndex: 1 }}
          animate={{ width: `${(activeIdx / (TIMELINE_STEPS.length - 1)) * 90}%` }}
          transition={{ duration: 0.6, ease: 'easeInOut' }} />
        {TIMELINE_STEPS.map((step, i) => {
          const done = i <= activeIdx, active = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <motion.div
                className="w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                animate={{ backgroundColor: done ? 'var(--primary)' : 'var(--base-200)', borderColor: done ? 'var(--primary)' : 'var(--base-300)', scale: active ? 1.3 : 1 }}
                transition={{ duration: 0.3 }}>
                {done && <Check size={10} color="white" strokeWidth={3} />}
              </motion.div>
              <p className="text-[9px] text-center leading-tight font-semibold"
                style={{ color: done ? 'var(--primary)' : 'var(--base-content)', opacity: done ? 1 : 0.4 }}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Live map legend for full_care_ride
const MapLegend = memo(function MapLegend({ bookingType, caStatus, jpCompleted, caName }) {
  if (bookingType !== 'full_care_ride') return null;
  const items = [
    { color: '#3b82f6', label: 'Driver' },
    { color: '#22c55e', label: 'Pickup' },
    { color: '#ef4444', label: 'Hospital' },
    { color: jpCompleted ? '#22c55e' : '#f59e0b', label: jpCompleted ? 'CA Joined ✓' : 'Join Point' },
    { color: '#ec4899', label: caName || 'Care Asst.' },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      className="absolute z-20 flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl"
      style={{
        bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', left: 12,
        background: 'rgba(8,12,22,0.88)', border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(14px)', minWidth: 120,
      }}>
      <p className="text-[8px] font-bold uppercase tracking-widest text-white/35 m-0 mb-0.5">Map</p>
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}90` }} />
          <span className="text-[10px] font-semibold text-white/65">{label}</span>
        </div>
      ))}
    </motion.div>
  );
});

const BottomSheet = memo(function BottomSheet({
  open, onToggle, rideStatus, rideCode, booking,
  otp, onShowOtp, driverSnapshot, vehicleSnapshot,
  caSnapshot, caStatus, bookingType, etaMinutes,
  distanceKm, jpCompleted,
}) {
  const statusCfg = STATUS_CONFIG[rideStatus] || STATUS_CONFIG.searching;
  const showOtpBtn = ['driver_arrived', 'otp_verified'].includes(rideStatus);
  const isCareOnly = bookingType === 'care_assistant';
  const isFullCare = bookingType === 'full_care_ride';
  const caCfg      = CA_STATUS_CONFIG[caStatus] || CA_STATUS_CONFIG.not_joined;

  return (
    <motion.div initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 80px)' }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl bg-base-200 border border-base-300 border-b-0 shadow-[0_-8px_40px_rgba(0,0,0,0.38)]"
      style={{ maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

      <button onClick={onToggle} className="w-full bg-transparent border-none cursor-pointer px-4 pt-3.5 pb-2 flex flex-col items-center">
        <div className="w-9 h-1 rounded-full bg-base-300 mb-3" />
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 flex-wrap gap-y-1">
            {/* Ride status badge */}
            {!isCareOnly && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}>
                {statusCfg.icon} {statusCfg.label}
              </span>
            )}
            {/* CA badge */}
            {(isFullCare || isCareOnly) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                style={{ background: caCfg.bg, borderColor: caCfg.border, color: caCfg.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: caCfg.dot }} />
                {caCfg.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {etaMinutes != null && <div className="flex items-center gap-1"><Clock size={11} className="text-primary" /><span className="text-xs font-black text-primary">{fmtEta(etaMinutes)}</span></div>}
            {distanceKm != null && <div className="flex items-center gap-1"><Navigation size={11} className="text-base-content/50" /><span className="text-xs font-semibold text-base-content/60">{fmtKm(distanceKm)}</span></div>}
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} className="text-base-content/40" />
            </motion.div>
          </div>
        </div>
      </button>

      <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(80vh - 82px)' }}>

        {/* OTP button */}
        <AnimatePresence>
          {showOtpBtn && otp && (
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={onShowOtp}
              className="w-full flex items-center justify-between p-4 rounded-2xl mb-3 border-2 cursor-pointer"
              style={{ background: 'rgba(139,92,246,0.10)', borderColor: 'rgba(139,92,246,0.40)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <span className="text-xl">🔑</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black m-0" style={{ color: '#8b5cf6' }}>Show OTP to Driver</p>
                  <p className="text-[11px] m-0 mt-0.5" style={{ color: 'rgba(139,92,246,0.70)' }}>Tap to reveal your ride code</p>
                </div>
              </div>
              <ArrowUpRight size={18} style={{ color: '#8b5cf6' }} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Driver card */}
        {!isCareOnly && <DriverCard driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot} />}

        {/* CA card */}
        {(isFullCare || isCareOnly) && caSnapshot && (
          <div className={!isCareOnly ? 'mt-3' : ''}>
            <CareAssistantCard caSnapshot={caSnapshot} caStatus={caStatus} jpCompleted={jpCompleted} />
          </div>
        )}

        {/* Timeline */}
        {!isCareOnly && <div className="mt-3"><RideTimeline status={rideStatus} /></div>}

        {/* Booking info */}
        {booking && (
          <div className="mt-3 p-3.5 rounded-2xl bg-base-300/60 border border-base-300">
            <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2">Booking Details</p>
            {[
              ['Code',       booking.bookingCode],
              ['Ride Code',  rideCode],
              ['Type',       booking.bookingType?.replace(/_/g, ' ')],
              ['Scheduled',  booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null],
              ['Payment',    booking.paymentStatus],
              ['Total Fare', booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount}` : null],
            ].map(([lbl, val]) => val ? (
              <div key={lbl} className="flex justify-between py-1.5 border-b border-base-300/50 last:border-b-0">
                <span className="text-[11px] text-base-content/40 font-semibold uppercase tracking-wide">{lbl}</span>
                <span className="text-xs text-base-content/70 font-semibold font-mono">{val}</span>
              </div>
            ) : null)}
          </div>
        )}

        {/* Route */}
        {(booking?.patientLocation || booking?.destinationLocation) && (
          <div className="mt-3 p-3.5 rounded-2xl bg-base-300/60 border border-base-300">
            <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-3">Route</p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-base-100 flex-shrink-0" />
                <div className="w-0.5 h-8 bg-base-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100 flex-shrink-0" />
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold text-base-content m-0 truncate">{booking.patientLocation?.address || 'Pickup'}</p>
                  <p className="text-[10px] text-base-content/40 mt-0.5 m-0">Pickup</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-base-content m-0 truncate">{booking.destinationLocation?.address || 'Hospital'}</p>
                  <p className="text-[10px] text-base-content/40 mt-0.5 m-0">Destination</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS
// ─────────────────────────────────────────────────────────────────────────────

const CompletedScreen = memo(function CompletedScreen({ booking, onBack, onRate }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6">
      <div className="text-6xl mb-6">🎉</div>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', damping: 14 }}
        className="w-[72px] h-[72px] rounded-full flex items-center justify-center bg-success/15 border-2 border-success/40 mb-6">
        <CheckCircle size={38} className="text-success" />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2">Ride Completed!</motion.h2>
      <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="text-sm text-base-content/50 text-center m-0 mb-8">
        Hope you had a comfortable journey.
        {booking?.fareBreakdown?.totalAmount && <> Total: <span className="font-bold text-primary">₹{booking.fareBreakdown.totalAmount}</span></>}
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={onRate} className="btn btn-primary btn-lg rounded-2xl font-bold" style={{ fontFamily: 'inherit' }}>
          <Star size={16} /> Rate Experience
        </button>
        <button onClick={onBack} className="btn btn-ghost btn-lg rounded-2xl font-semibold text-base-content/60" style={{ fontFamily: 'inherit' }}>
          Back to Bookings
        </button>
      </motion.div>
    </motion.div>
  );
});

const CancelledScreen = memo(function CancelledScreen({ onBack }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6">
      <div className="text-6xl mb-6">😔</div>
      <h2 className="text-2xl font-black text-base-content text-center m-0 mb-2">Ride Cancelled</h2>
      <p className="text-sm text-base-content/50 text-center m-0 mb-8">Your ride was cancelled. Please book again.</p>
      <button onClick={onBack} className="btn btn-primary btn-lg rounded-2xl px-8 font-bold" style={{ fontFamily: 'inherit' }}>Back to Bookings</button>
    </motion.div>
  );
});

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-4">
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8 }} className="text-5xl">🚗</motion.div>
      <p className="text-sm text-base-content/50 font-semibold">Loading your ride...</p>
    </div>
  );
});

const SearchingScreen = memo(function SearchingScreen({ bookingCode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-base-100 px-6">
      <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-6">🔍</motion.div>
      <h3 className="text-xl font-black text-base-content m-0 mb-2 text-center">Finding Your Driver</h3>
      <p className="text-sm text-base-content/50 text-center m-0">Matching you with the best available driver nearby.</p>
      {bookingCode && <p className="text-xs text-base-content/30 font-mono m-0 mt-2">#{bookingCode}</p>}
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}
        className="text-xs text-primary font-semibold mt-6 m-0">You'll be notified when a driver accepts</motion.p>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerRideLiveTracking() {
  const params    = useParams();
  const router    = useRouter();
  const dispatch  = useDispatch();
  const bookingId = params?.bookingId || null;
  const rideId    = params?.rideId    || null;

  const currentRide = useSelector(selectCurrentRide);
  const socketLive  = useSelector(selectSocketLive);
  const liveData    = useSelector(selectLiveData);
  const booking     = useSelector(selectSelectedBooking);

  const { on, connected, SOCKET_EVENTS: EV } = useSocket();
  const { locationUpdate, etaUpdate: etaEvt } = useBookingRoom(bookingId);
  const activeRideId = rideId || currentRide?._id || liveData?.rideId;
  const { trigger: triggerSos, sosActive, dismiss: dismissSos } = useSos(bookingId, activeRideId);
  const { isLoaded } = useGoogleMaps();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapRef           = useRef(null);
  const mapContainerRef  = useRef(null);
  const dirServiceRef    = useRef(null);

  // Driver marker
  const driverMarkerRef  = useRef(null);
  const driverPosRef     = useRef(null);
  const driverTargetRef  = useRef(null);
  const driverSpeedRef   = useRef(0);
  const smoothHeadRef    = useRef(0);

  // CA marker
  const caMarkerRef      = useRef(null);
  const caPosRef         = useRef(null);
  const caTargetRef      = useRef(null);

  // JP marker
  const jpMarkerRef      = useRef(null);
  const jpMarkerCreated  = useRef(false);

  // Static markers
  const pickupMarkerRef  = useRef(null);
  const destMarkerRef    = useRef(null);
  const staticsDone      = useRef(false);

  // Animation / polling
  const animFrameRef     = useRef(null);
  const pollTimerRef     = useRef(null);
  const otpRef           = useRef(null);
  const lastRouteRef     = useRef(null);
  const mountedRef       = useRef(true);

  // ── State ─────────────────────────────────────────────────────────────────
  const [mapLoaded,     setMapLoaded]     = useState(false);
  const [driverRoute,   setDriverRoute]   = useState(null);
  const [overviewRoute, setOverviewRoute] = useState(null);
  const [rideStatus,    setRideStatus]    = useState(null);
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [showOtpModal,  setShowOtpModal]  = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [otp,           setOtp]           = useState(null);
  const [etaMinutes,    setEtaMinutes]    = useState(null);
  const [remainingKm,   setRemainingKm]   = useState(null);
  const [isInitLoading, setIsInitLoading] = useState(true);
  const [followDriver,  setFollowDriver]  = useState(true);
  const [driverPos,     setDriverPos]     = useState(null);
  const [caPos,         setCaPos]         = useState(null);
  const [headingDeg,    setHeadingDeg]    = useState(0);
  const [speedKmh,      setSpeedKmh]      = useState(0);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [mapZoom,       setMapZoom]       = useState(15);

  // Full care ride state
  const [bookingType,   setBookingType]   = useState(null);
  const [caStatus,      setCaStatus]      = useState('not_joined');
  const [caSnapshot,    setCaSnapshot]    = useState(null);
  const [jpCoords,      setJpCoords]      = useState(null);
  const [jpCompleted,   setJpCompleted]   = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const rd         = currentRide || liveData;
  const isCareOnly = bookingType === 'care_assistant';
  const isFullCare = bookingType === 'full_care_ride';
  const showDriver = !isCareOnly;
  const showCa     = isCareOnly || isFullCare;

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

  const activeStatus = rideStatus || socketLive?.status || rd?.status || 'searching';
  const isSearching  = ['searching', 'requested'].includes(activeStatus);
  const isPostOtp    = ['otp_verified', 'in_progress', 'at_stop'].includes(activeStatus);

  const caName = caSnapshot?.name || caSnapshot?.fullName || 'Care Asst.';

  // ── Route helpers ─────────────────────────────────────────────────────────
  const routeOnce = useCallback(async (origin, destination) => {
    if (!dirServiceRef.current || !origin || !destination) return null;
    try {
      const result = await dirServiceRef.current.route({
        origin, destination, travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      return result.status === 'OK' ? result : null;
    } catch { return null; }
  }, []);

  const calcRoutes = useCallback(async (driverPosition) => {
    if (!mapLoaded || !pickupCoords || !dropoffCoords || isCareOnly) return;
    const origin = driverPosition || driverPosRef.current;
    const [ovr, dr] = await Promise.all([
      routeOnce(pickupCoords, dropoffCoords),
      origin ? routeOnce(origin, isPostOtp ? dropoffCoords : pickupCoords) : null,
    ]);
    if (ovr && mountedRef.current) setOverviewRoute(ovr);
    if (dr  && mountedRef.current) setDriverRoute(dr);
  }, [mapLoaded, pickupCoords, dropoffCoords, isPostOtp, routeOnce, isCareOnly]);

  // ── Sync bookingType ──────────────────────────────────────────────────────
  useEffect(() => {
    const bt = booking?.bookingType || currentRide?.bookingType || liveData?.bookingType;
    if (bt && bt !== bookingType) setBookingType(bt);
  }, [booking, currentRide, liveData, bookingType]);

  // ── Sync CA snapshot ──────────────────────────────────────────────────────
  useEffect(() => {
    const snap = currentRide?.careAssistantSnapshot || rd?.careAssistant || null;
    if (snap && !caSnapshot) setCaSnapshot(snap);
  }, [currentRide, rd, caSnapshot]);

  // ── Sync JP coords from ride waypoints ───────────────────────────────────
  useEffect(() => {
    if (!isFullCare) return;
    const waypoints = rd?.waypoints || currentRide?.waypoints || [];
    const joinWp = waypoints.find(w => w.type === 'care_assistant_join');
    if (joinWp?.location?.coordinates?.length >= 2) {
      const c = joinWp.location.coordinates;
      setJpCoords({ lat: c[1], lng: c[0] });
      if (joinWp.isCompleted) setJpCompleted(true);
    }
  }, [isFullCare, rd?.waypoints, currentRide?.waypoints]);

  // ── Seed driver position ──────────────────────────────────────────────────
  useEffect(() => {
    const loc = socketLive?.liveLocation || liveData?.liveLocation;
    let lat = null, lng = null, hdg = 0, spd = 0;
    if (loc?.lat && loc?.lng) { lat = loc.lat; lng = loc.lng; hdg = loc.heading || 0; spd = loc.speedKmh || 0; }
    else if (currentRide?.liveLocation?.coordinates?.length === 2) {
      lng = currentRide.liveLocation.coordinates[0];
      lat = currentRide.liveLocation.coordinates[1];
    }
    if (lat && lng && !driverTargetRef.current) {
      const pos = { lat, lng };
      driverTargetRef.current = pos;
      driverPosRef.current    = pos;
      driverSpeedRef.current  = spd;
      setDriverPos(pos);
      setHeadingDeg(hdg);
      setSpeedKmh(spd);
      smoothHeadRef.current = hdg;
    }
  }, [socketLive?.liveLocation, liveData?.liveLocation, currentRide?.liveLocation]);

  // ── Seed CA position ──────────────────────────────────────────────────────
  useEffect(() => {
    const caLoc = currentRide?.careAssistant?.liveLocation || liveData?.careAssistant?.liveLocation;
    if (caLoc?.lat && caLoc?.lng && !caTargetRef.current) {
      const pos = { lat: caLoc.lat, lng: caLoc.lng };
      caTargetRef.current = pos;
      caPosRef.current    = pos;
      setCaPos(pos);
    }
  }, [currentRide, liveData]);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const load = async () => {
      setIsInitLoading(true);
      try {
        const tasks = [];
        if (rideId)    { tasks.push(dispatch(fetchRideTracking({ rideId }))); tasks.push(dispatch(fetchRideLive(rideId))); }
        if (bookingId) { tasks.push(dispatch(fetchMyBookingById({ bookingId }))); }
        await Promise.all(tasks);
      } catch (e) { console.error('[CustomerTracking] init:', e); }
      finally { if (mountedRef.current) setIsInitLoading(false); }
    };
    load();
    return () => { mountedRef.current = false; };
  }, [rideId, bookingId]); // eslint-disable-line

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!EV) return;
    const unsubs = [
      on(EV.RIDE_STATUS_CHANGED, (d) => {
        dispatch(socketRideStatusChanged(d));
        if (mountedRef.current) setRideStatus(d.status);
        if (d.bookingType) setBookingType(d.bookingType);
        if (d.activeNavigationTarget) dispatch(socketNavigationTargetChanged({ currentTarget: d.activeNavigationTarget }));
      }),
      on('driver_accepted',  (d) => { dispatch(socketDriverAccepted(d));  if (mountedRef.current) setRideStatus('driver_accepted'); }),
      on('driver_en_route',  (d) => { dispatch(socketDriverEnRoute(d));   if (mountedRef.current) setRideStatus('driver_en_route'); }),
      on('driver_arrived',   (d) => { dispatch(socketDriverArrived(d));   if (mountedRef.current) { setRideStatus('driver_arrived'); setSheetOpen(true); } }),
      on('otp_verified',     (d) => { dispatch(socketOtpVerified(d));     if (mountedRef.current) { setRideStatus('otp_verified'); setShowOtpModal(false); } }),
      on('ride_started',     (d) => { dispatch(socketRideStarted(d));     if (mountedRef.current) setRideStatus('in_progress'); }),
      on('ride_completed',   (d) => { dispatch(socketRideCompleted(d));   if (mountedRef.current) setRideStatus('completed'); }),
      on('ride_cancelled',   (d) => { dispatch(socketRideCancelled(d));   if (mountedRef.current) setRideStatus('cancelled'); }),
      on('ride_assigned',    (d) => { dispatch(socketRideAssigned(d));    if (mountedRef.current) setRideStatus(d.status); }),
      on(EV.NAVIGATION_TARGET_CHANGED, (d) => { dispatch(socketNavigationTargetChanged(d)); }),

      on('otp_required', (d) => {
        if (!mountedRef.current) return;
        if (d.otp) { setOtp(String(d.otp)); otpRef.current = String(d.otp); }
        setRideStatus('driver_arrived');
        setSheetOpen(true);
      }),

      // ── CA location ────────────────────────────────────────────────────
      on('care_assistant_location_update', (d) => {
        if (!mountedRef.current) return;
        caTargetRef.current = { lat: d.lat, lng: d.lng };
        if (d.status) setCaStatus(d.status);
      }),

      // ── CA status change ───────────────────────────────────────────────
      on('care_assistant_status_change', (d) => {
        if (!mountedRef.current) return;
        const s = d.careAssistantStatus || d.status;
        if (s) setCaStatus(s);
        if (d.careAssistantName) setCaSnapshot(prev => ({ ...(prev || {}), name: d.careAssistantName }));
      }),

      // ── CA at join point ───────────────────────────────────────────────
      on('care_assistant_at_jp', (d) => {
        if (!mountedRef.current) return;
        setCaStatus('at_pickup');
        if (d.location) caTargetRef.current = d.location;
      }),

      // ── CA joined ride ─────────────────────────────────────────────────
      on('care_assistant_joined_ride', (d) => {
        if (!mountedRef.current) return;
        setCaStatus('in_ride');
        // JP stays visible — marked completed
        if (d.jpCompleted) setJpCompleted(true);
        if (d.careAssistantName) setCaSnapshot(prev => ({ ...(prev || {}), name: d.careAssistantName }));
        if (d.currentLocation) caTargetRef.current = d.currentLocation;
      }),

      // ── CA attached to ride (admin assigned) ───────────────────────────
      on('care_assistant_attached_to_ride', (d) => {
        if (!mountedRef.current) return;
        if (d.careAssistantName) setCaSnapshot(prev => ({ ...(prev || {}), name: d.careAssistantName }));
        setCaStatus('en_route_to_pickup');
        // Set JP coords from event
        if (d.caJoinPoint?.coordinates?.length >= 2) {
          const c = d.caJoinPoint.coordinates;
          setJpCoords({ lat: c[1], lng: c[0] });
        }
      }),

      // ── JP waypoint completed (driver picked up CA) ────────────────────
      on('ca_join_waypoint_completed', (d) => {
        if (!mountedRef.current) return;
        setJpCompleted(true);
        // Update JP marker to completed state
        if (jpMarkerRef.current && jpCoords) {
          jpMarkerRef.current.map = null;
          jpMarkerRef.current = null;
          jpMarkerCreated.current = false;
        }
      }),

      // ── Booking state snapshot ─────────────────────────────────────────
      on('booking_state_snapshot', (d) => {
        if (!mountedRef.current) return;
        if (d.bookingId && d.bookingId !== bookingId) return;
        if (d.bookingType) setBookingType(d.bookingType);
        if (d.tracking?.careAssistantStatus) setCaStatus(d.tracking.careAssistantStatus);
        if (d.tracking?.careAssistantLiveLocation) {
          const loc = d.tracking.careAssistantLiveLocation;
          if (loc?.coordinates?.length === 2) caTargetRef.current = { lat: loc.coordinates[1], lng: loc.coordinates[0] };
          else if (loc?.lat && loc?.lng)       caTargetRef.current = { lat: loc.lat, lng: loc.lng };
        }
        // JP from snapshot fullCareRide block
        const jp = d.fullCareRide?.caJoinPoint;
        if (jp?.coordinates?.length >= 2) {
          setJpCoords({ lat: jp.coordinates[1], lng: jp.coordinates[0] });
          if (jp.isCompleted) setJpCompleted(true);
        }
      }),
    ];
    return () => unsubs.forEach(fn => fn?.());
  }, [on, EV, bookingId, jpCoords, dispatch]); // eslint-disable-line

  // ── Socket: driver location ───────────────────────────────────────────────
  useEffect(() => {
    if (!locationUpdate) return;
    dispatch(socketLocationUpdate(locationUpdate));
    const { lat, lng, heading = 0, speed = 0 } = locationUpdate;
    driverTargetRef.current = { lat, lng };
    driverSpeedRef.current  = speed;
    // Smooth heading with 0/360 wrap
    let diff = heading - smoothHeadRef.current;
    if (diff >  180) diff -= 360;
    if (diff < -180) diff += 360;
    smoothHeadRef.current = (smoothHeadRef.current + diff * 0.20 + 360) % 360;
    if (mountedRef.current) { setHeadingDeg(smoothHeadRef.current); setSpeedKmh(speed); }
  }, [locationUpdate, dispatch]);

  // ── Socket: ETA ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!etaEvt) return;
    dispatch(socketEtaUpdate(etaEvt));
    if (etaEvt.etaMinutes          != null && mountedRef.current) setEtaMinutes(etaEvt.etaMinutes);
    if (etaEvt.distanceRemainingKm != null && mountedRef.current) setRemainingKm(etaEvt.distanceRemainingKm);
  }, [etaEvt, dispatch]);

  // ── Sync rideStatus from redux ────────────────────────────────────────────
  useEffect(() => {
    const s = socketLive?.status || rd?.status;
    if (s && mountedRef.current) setRideStatus(s);
  }, [socketLive?.status, rd?.status]);

  // ── ETA from redux ────────────────────────────────────────────────────────
  useEffect(() => {
    const eta = socketLive?.etaMinutes ?? liveData?.currentEtaMinutes;
    if (eta != null && mountedRef.current) setEtaMinutes(eta);
  }, [socketLive?.etaMinutes, liveData?.currentEtaMinutes]);

  // ── Completed / cancelled ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeStatus === 'completed') { const t = setTimeout(() => { if (mountedRef.current) setShowCompleted(true); }, 2200); return () => clearTimeout(t); }
    if (activeStatus === 'cancelled') { const t = setTimeout(() => { if (mountedRef.current) setShowCancelled(true); }, 1200); return () => clearTimeout(t); }
  }, [activeStatus]);

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (connected) { clearInterval(pollTimerRef.current); return; }
    if (!activeRideId) return;
    pollTimerRef.current = setInterval(() => dispatch(fetchRideLive(activeRideId)), POLL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [connected, activeRideId, dispatch]);

  // ── Animation loop — driver + CA smooth movement ──────────────────────────
  useEffect(() => {
    const animate = () => {
      if (driverTargetRef.current) {
        const cur    = driverPosRef.current || { ...driverTargetRef.current };
        const newLat = lerp(cur.lat, driverTargetRef.current.lat, 0.12);
        const newLng = lerp(cur.lng, driverTargetRef.current.lng, 0.12);
        driverPosRef.current = { lat: newLat, lng: newLng };
        if (mountedRef.current) setDriverPos({ lat: newLat, lng: newLng });
      }
      if (caTargetRef.current) {
        const cur    = caPosRef.current || { ...caTargetRef.current };
        const newLat = lerp(cur.lat, caTargetRef.current.lat, 0.10);
        const newLng = lerp(cur.lng, caTargetRef.current.lng, 0.10);
        caPosRef.current = { lat: newLat, lng: newLng };
        if (mountedRef.current) setCaPos({ lat: newLat, lng: newLng });
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // ── Route recalc (throttled 30s) ──────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !driverPos || isCareOnly) return;
    const now = Date.now();
    if (lastRouteRef.current && now - lastRouteRef.current < 30_000) return;
    lastRouteRef.current = now;
    calcRoutes(driverPos);
  }, [driverPos, mapLoaded, calcRoutes, isCareOnly]);

  useEffect(() => {
    if (!mapLoaded || !pickupCoords || !dropoffCoords || isCareOnly) return;
    lastRouteRef.current = null;
    calcRoutes(driverPosRef.current || pickupCoords);
  }, [mapLoaded, isPostOtp, pickupCoords, dropoffCoords, calcRoutes, isCareOnly]);

  // ── DRIVER MARKER ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !driverPos || !showDriver) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = createDriverMarkerHtml(headingDeg, speedKmh);
      driverMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: driverPos, zIndex: 10,
      });
    } else {
      driverMarkerRef.current.position = driverPos;
      // Update rotation arrow
      const arrow = driverMarkerRef.current.content?.querySelector('div[style*="border-bottom"]');
      if (arrow) arrow.style.transform = `translateX(-50%) rotate(${headingDeg}deg)`;
      // Update speed badge text if present
      const badge = driverMarkerRef.current.content?.querySelectorAll('div')?.[5];
      if (badge && speedKmh > 5) badge.querySelector('span:first-child') && (badge.firstChild.textContent = Math.round(speedKmh));
    }

    if (followDriver && mapRef.current && !isCareOnly) mapRef.current.panTo(driverPos);
  }, [driverPos, mapLoaded, headingDeg, speedKmh, followDriver, showDriver, isCareOnly]);

  // Destroy driver marker
  useEffect(() => {
    if (!showDriver && driverMarkerRef.current) { driverMarkerRef.current.map = null; driverMarkerRef.current = null; }
  }, [showDriver]);

  // ── CA MARKER ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !caPos || !showCa) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!caMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = createCaMarkerHtml(caStatus, caName);
      caMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: caPos, zIndex: 12,
      });
    } else {
      caMarkerRef.current.position = caPos;
      // Rebuild HTML when CA status changes for visual update
      const el = caMarkerRef.current.content;
      if (el) el.innerHTML = createCaMarkerHtml(caStatus, caName);
    }

    if (isCareOnly && followDriver && mapRef.current) mapRef.current.panTo(caPos);
  }, [caPos, mapLoaded, showCa, caStatus, caName, isCareOnly, followDriver]);

  // Destroy CA marker
  useEffect(() => {
    if (!showCa && caMarkerRef.current) { caMarkerRef.current.map = null; caMarkerRef.current = null; }
  }, [showCa]);

  // ── JP MARKER ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCare || !jpCoords) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const shouldCreate = !jpMarkerRef.current;
    const statusChanged = jpMarkerRef.current && jpCompleted !== jpMarkerRef.current._jpCompleted;

    if (shouldCreate || statusChanged) {
      if (jpMarkerRef.current) { jpMarkerRef.current.map = null; jpMarkerRef.current = null; }
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = createJpMarkerHtml(jpCompleted);
      jpMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: jpCoords, zIndex: 8,
      });
      jpMarkerRef.current._jpCompleted = jpCompleted;
    } else if (jpMarkerRef.current) {
      jpMarkerRef.current.position = jpCoords;
    }
  }, [mapLoaded, isFullCare, jpCoords, jpCompleted]);

  // ── STATIC MARKERS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || staticsDone.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;
    let created = false;
    if (pickupCoords && !pickupMarkerRef.current) {
      const el = document.createElement('div'); el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = createPickupMarkerHtml();
      pickupMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: pickupCoords, zIndex: 5 });
      created = true;
    }
    if (dropoffCoords && !destMarkerRef.current) {
      const el = document.createElement('div'); el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = createDestMarkerHtml();
      destMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: dropoffCoords, zIndex: 5 });
      created = true;
    }
    if (created) staticsDone.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // ── Fit bounds on map load ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (!pickupCoords && !dropoffCoords) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (pickupCoords)  bounds.extend(pickupCoords);
    if (dropoffCoords) bounds.extend(dropoffCoords);
    if (driverPos)     bounds.extend(driverPos);
    if (caPos)         bounds.extend(caPos);
    if (jpCoords)      bounds.extend(jpCoords);
    mapRef.current.fitBounds(bounds, { top: 90, bottom: 210, left: 40, right: 40 });
  }, [mapLoaded]); // eslint-disable-line

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      [driverMarkerRef, caMarkerRef, jpMarkerRef, pickupMarkerRef, destMarkerRef].forEach(ref => {
        if (ref.current) { ref.current.map = null; ref.current = null; }
      });
      staticsDone.current = false;
      jpMarkerCreated.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current        = map;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    setMapLoaded(true);
    setMapZoom(map.getZoom());
    map.addListener('zoom_changed', () => { if (mountedRef.current) setMapZoom(map.getZoom()); });
  }, []);

  const handleBack = useCallback(() => {
    if (window.history?.length > 1) router.back(); else router.push('/bookings');
  }, [router]);

  const handleRate = useCallback(() => {
    router.push(bookingId ? `/bookings/${bookingId}/rate` : '/bookings');
  }, [router, bookingId]);

  const handleRecenter = useCallback(() => {
    setFollowDriver(true);
    const target = isCareOnly ? caPos : driverPos;
    if (target && mapRef.current) { mapRef.current.panTo(target); mapRef.current.setZoom(16); }
    else if (pickupCoords && mapRef.current) mapRef.current.panTo(pickupCoords);
  }, [driverPos, caPos, pickupCoords, isCareOnly]);

  const handleZoomIn  = useCallback(() => { mapRef.current?.setZoom(Math.min(mapRef.current.getZoom() + 1, 21)); }, []);
  const handleZoomOut = useCallback(() => { mapRef.current?.setZoom(Math.max(mapRef.current.getZoom() - 1, 3));  }, []);

  const handleFullscreen = useCallback(() => {
    const el = mapContainerRef.current || document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  const handleSos = useCallback(() => {
    if (sosActive) { dismissSos(); return; }
    triggerSos({ sosType: 'safety' });
  }, [sosActive, triggerSos, dismissSos]);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (isInitLoading || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted) return <CompletedScreen booking={booking} onBack={handleBack} onRate={handleRate} />;
  if (showCancelled) return <CancelledScreen onBack={handleBack} />;

  const statusCfg = STATUS_CONFIG[activeStatus] || STATUS_CONFIG.searching;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes driverRingPulse { 0%{transform:scale(0.85);opacity:0.9} 100%{transform:scale(2.5);opacity:0} }
        @keyframes caRingPulse     { 0%{transform:scale(0.85);opacity:0.9} 100%{transform:scale(2.2);opacity:0} }
        @keyframes caHeartBounce   { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.18) translateY(-5px)} }
        @keyframes jpBobble        { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes jpRingPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.6)} 50%{box-shadow:0 0 0 10px rgba(245,158,11,0)} }
      `}</style>

      <div ref={mapContainerRef} className="fixed inset-0 overflow-hidden">

        {/* ── MAP ──────────────────────────────────────────────── */}
        <div className="absolute inset-0">
          {isSearching ? (
            <SearchingScreen bookingCode={booking?.bookingCode} />
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={(isCareOnly ? caPos : driverPos) || pickupCoords || { lat: 16.506, lng: 80.648 }}
              zoom={15}
              options={{
                mapId: MAP_ID, disableDefaultUI: true,
                clickableIcons: false, gestureHandling: 'greedy', mapTypeId: 'roadmap',
              }}
              onLoad={onMapLoad}
              onDragStart={() => setFollowDriver(false)}
            >
              {/* Overview route (grey dotted) */}
              {overviewRoute && !isCareOnly && (
                <DirectionsRenderer directions={overviewRoute} options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor:   isPostOtp ? 'rgba(34,197,94,0.28)' : 'rgba(6,182,212,0.25)',
                    strokeWeight:  4, strokeOpacity: 1,
                    icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }],
                  },
                }} />
              )}
              {/* Live driver route */}
              {driverRoute && !isCareOnly && (
                <DirectionsRenderer directions={driverRoute} options={{
                  suppressMarkers: true,
                  polylineOptions: isPostOtp
                    ? { strokeColor: '#22c55e', strokeWeight: 6, strokeOpacity: 0.92 }
                    : { strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 1 },
                }} />
              )}
            </GoogleMap>
          )}
        </div>

        {/* ── OFFLINE BANNER ───────────────────────────────────── */}
        <AnimatePresence>
          {!connected && !isSearching && (
            <motion.div initial={{ y: -48 }} animate={{ y: 0 }} exit={{ y: -48 }}
              className="absolute top-0 left-0 right-0 z-[50] flex items-center justify-center gap-2 py-2.5 text-xs font-bold bg-warning/95 text-warning-content">
              <WifiOff size={13} /> Reconnecting — tracking may be delayed
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ──────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-base-200/96 border-b border-base-300"
            style={{ backdropFilter: 'blur(14px)' }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleBack}
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center cursor-pointer text-base-content/60 bg-base-300 border border-base-300">
              <ChevronLeft size={18} />
            </motion.button>

            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: connected ? 'var(--success)' : 'var(--warning)', boxShadow: connected ? '0 0 6px rgba(34,197,94,0.6)' : '0 0 6px rgba(245,158,11,0.6)' }} />

            {/* Ride status */}
            {!isCareOnly && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border flex-shrink-0"
                style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}>
                {statusCfg.pulse && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusCfg.color }} />}
                {statusCfg.icon} {statusCfg.label}
              </span>
            )}

            {/* CA status badge */}
            {showCa && caStatus && caStatus !== 'not_joined' && (() => {
              const caCfg = CA_STATUS_CONFIG[caStatus] || CA_STATUS_CONFIG.not_joined;
              return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border flex-shrink-0"
                  style={{ background: caCfg.bg, borderColor: caCfg.border, color: caCfg.color }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: caCfg.dot }} />
                  {caCfg.label}
                </span>
              );
            })()}

            {etaMinutes != null && (
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <Clock size={11} className="text-primary" />
                <span className="text-xs font-black text-primary">{fmtEta(etaMinutes)}</span>
              </div>
            )}
            {remainingKm != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Navigation size={11} className="text-base-content/40" />
                <span className="text-xs font-semibold text-base-content/50">{fmtKm(remainingKm)}</span>
              </div>
            )}
          </motion.div>

          {/* Driver arrived banner */}
          <AnimatePresence>
            {activeStatus === 'driver_arrived' && !isCareOnly && (
              <motion.button initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                onClick={() => setShowOtpModal(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer border-b border-purple-500/30"
                style={{ background: 'rgba(139,92,246,0.18)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-2">
                  <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-base">📍</motion.div>
                  <span className="text-xs font-bold text-purple-300">Your driver has arrived — tap to show OTP</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-purple-400">Show OTP</span>
                  <ArrowUpRight size={12} className="text-purple-400" />
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* CA at join point banner */}
          <AnimatePresence>
            {isFullCare && caStatus === 'at_pickup' && !jpCompleted && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{ background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.30)' }}>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>❤️</motion.span>
                <span className="text-xs font-bold text-warning">Care assistant is waiting at the join point</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CA in ride banner */}
          <AnimatePresence>
            {isFullCare && caStatus === 'in_ride' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.30)' }}>
                <Activity size={12} className="text-success animate-pulse flex-shrink-0" />
                <span className="text-xs font-bold text-success">Care assistant is in the vehicle with you</span>
                {jpCompleted && <span className="ml-auto text-[10px] bg-success/20 text-success border border-success/30 px-1.5 py-0.5 rounded-full font-bold">JP ✓</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── IN PROGRESS BANNER ───────────────────────────────── */}
        <AnimatePresence>
          {activeStatus === 'in_progress' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute left-3 right-3 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold text-success"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)', background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)', backdropFilter: 'blur(12px)' }}>
              <Zap size={12} />
              {isFullCare
                ? (caStatus === 'in_ride' ? 'In progress — care assistant on board 🎉' : 'Ride in progress — heading to destination')
                : 'Ride in progress — heading to hospital'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MAP LEGEND (full_care_ride) ───────────────────────── */}
        <MapLegend bookingType={bookingType} caStatus={caStatus} jpCompleted={jpCompleted} caName={caName} />

        {/* ── FABs ─────────────────────────────────────────────── */}
        <div className="absolute right-3 z-20 flex flex-col gap-2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 108px)' }}>
          <FabBtn onClick={handleRecenter} active={followDriver} title={isCareOnly ? 'Center on care assistant' : 'Center on driver'}>
            <Navigation size={16} />
          </FabBtn>
          <FabBtn onClick={handleZoomIn}   title="Zoom in"><Plus  size={17} strokeWidth={2.5} /></FabBtn>
          <FabBtn onClick={handleZoomOut}  title="Zoom out"><Minus size={17} strokeWidth={2.5} /></FabBtn>
          <FabBtn onClick={handleFullscreen} active={isFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </FabBtn>
          <FabBtn onClick={handleSos} danger active={sosActive} title="SOS">
            {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
          </FabBtn>
          {!connected && (
            <FabBtn onClick={() => { if (activeRideId) dispatch(fetchRideLive(activeRideId)); }} title="Refresh">
              <RefreshCw size={15} />
            </FabBtn>
          )}
        </div>

        {/* Zoom indicator */}
        {mapLoaded && !isSearching && (
          <div className="absolute bottom-[92px] left-3 z-20">
            <div className="px-2.5 py-1 rounded-xl bg-base-200/80 border border-base-300 text-[10px] font-bold text-base-content/40 font-mono">
              z{mapZoom}
            </div>
          </div>
        )}

        {/* ── BOTTOM SHEET ─────────────────────────────────────── */}
        <BottomSheet
          open={sheetOpen} onToggle={() => setSheetOpen(p => !p)}
          rideStatus={activeStatus} rideCode={rd?.rideCode}
          booking={booking} otp={otp} onShowOtp={() => setShowOtpModal(true)}
          driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot}
          caSnapshot={caSnapshot} caStatus={caStatus}
          bookingType={bookingType} etaMinutes={etaMinutes}
          distanceKm={remainingKm} jpCompleted={jpCompleted}
        />

        {/* ── OTP MODAL ────────────────────────────────────────── */}
        <AnimatePresence>
          {showOtpModal && otp && <OtpDisplay otp={otp} onClose={() => setShowOtpModal(false)} />}
        </AnimatePresence>

        {/* ── SOS BANNER ───────────────────────────────────────── */}
        <AnimatePresence>
          {sosActive && (
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-[92px] left-4 right-4 z-40 flex items-center gap-3 p-4 rounded-2xl bg-error border border-error/70 shadow-[0_8px_32px_rgba(239,68,68,0.55)]">
              <ShieldAlert size={20} className="text-error-content flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-error-content m-0">SOS Alert Sent!</p>
                <p className="text-xs text-error-content/80 m-0">Help is on the way. Stay calm.</p>
              </div>
              <button onClick={dismissSos} className="text-error-content/70 cursor-pointer bg-transparent border-none"><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </>
  );
}
 