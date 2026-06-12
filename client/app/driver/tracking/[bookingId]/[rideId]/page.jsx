'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }      from 'next/navigation';
import { useDispatch, useSelector }  from 'react-redux';
import {
  motion, AnimatePresence,
  useMotionValue, useTransform,
} from 'framer-motion';
import { GoogleMap } from '@react-google-maps/api';
import {
  Navigation, MapPin, Phone, User,
  CheckCircle, WifiOff, Volume2, VolumeX,
  Compass, Maximize2, ChevronDown, Clock, Zap,
  Shield, ShieldAlert, RotateCcw, ArrowLeft, ArrowRight,
  ArrowUp, AlertCircle, Loader2, CheckSquare, Play,
  Square, X, MapPinOff, ChevronLeft, Minus, Plus,
  UserCheck, Heart, Activity,
} from 'lucide-react';

import { useGoogleMaps }      from '@/context/GoogleMapsProvider';
import { useRideTracking }    from '@/hooks/useRideTracking';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import { useDriverMarker }    from '@/hooks/useDriverMarker';
import { useMapCamera }       from '@/hooks/useMapCamera';
import { useRouteRenderer }   from '@/hooks/useRouteRenderer';
import {
  createKalmanFilter,
  parseDirectionSteps,
  distanceToStepEndMeters,
  findCurrentStepByPolyline,
  snapToPolyline,
  offRouteScore,
  bearingDeg,
  formatEta,
  formatDistance,
  formatSpeed,
  getManeuverIcon,
  distanceKm,
} from '@/utils/navigationUtils';

import {
  driverCompleteWaypoint,
  selectCaJoinPoint,
  setJpWaypointCompleted,
} from '@/store/slices/operationsSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID                  = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const STEP_ADVANCE_METERS     = 35;
const ARRIVAL_THRESHOLD_KM    = 0.05;
const OFF_ROUTE_THRESHOLD     = 0.7;
const REROUTE_COOLDOWN_MS     = 12000;
const OFF_ROUTE_CONFIRM_COUNT = 3;

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  SEARCHING:       { label: 'Searching',   color: 'color-mix(in srgb, var(--base-content) 60%, transparent)', bg: 'color-mix(in srgb, var(--base-content), transparent 90%)',   border: 'color-mix(in srgb, var(--base-content), transparent 75%)' },
  driver_assigned: { label: 'Assigned',    color: 'var(--warning)',   bg: 'color-mix(in srgb, var(--warning), transparent 85%)',   border: 'color-mix(in srgb, var(--warning), transparent 65%)' },
  driver_accepted: { label: 'Accepted',    color: 'var(--primary)',   bg: 'color-mix(in srgb, var(--primary), transparent 85%)',   border: 'color-mix(in srgb, var(--primary), transparent 65%)' },
  driver_en_route: { label: 'En Route',    color: 'var(--info)',      bg: 'color-mix(in srgb, var(--info), transparent 85%)',      border: 'color-mix(in srgb, var(--info), transparent 65%)' },
  driver_arrived:  { label: 'Arrived',     color: 'var(--accent)',    bg: 'color-mix(in srgb, var(--accent), transparent 85%)',    border: 'color-mix(in srgb, var(--accent), transparent 65%)' },
  otp_verified:    { label: 'OTP ✓',       color: 'var(--success)',   bg: 'color-mix(in srgb, var(--success), transparent 85%)',   border: 'color-mix(in srgb, var(--success), transparent 65%)' },
  in_progress:     { label: 'In Progress', color: 'var(--success)',   bg: 'color-mix(in srgb, var(--success), transparent 85%)',   border: 'color-mix(in srgb, var(--success), transparent 65%)' },
  at_stop:         { label: 'At Stop',     color: 'var(--secondary)', bg: 'color-mix(in srgb, var(--secondary), transparent 85%)', border: 'color-mix(in srgb, var(--secondary), transparent 65%)' },
  completed:       { label: 'Completed',   color: 'color-mix(in srgb, var(--base-content) 70%, transparent)', bg: 'color-mix(in srgb, var(--base-content), transparent 85%)', border: 'color-mix(in srgb, var(--base-content), transparent 65%)' },
  cancelled:       { label: 'Cancelled',   color: 'var(--error)',     bg: 'color-mix(in srgb, var(--error), transparent 85%)',     border: 'color-mix(in srgb, var(--error), transparent 65%)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject pulse keyframe into document once.
 * AdvancedMarkerElement content is in normal DOM so document styles apply.
 */
function injectMarkerStyles() {
  if (document.getElementById('__ride-marker-styles')) return;
  const style = document.createElement('style');
  style.id = '__ride-marker-styles';
  style.textContent = `
    @keyframes markerPulse {
      0%   { transform: scale(0.9);  opacity: 0.8; }
      70%  { transform: scale(1.8);  opacity: 0;   }
      100% { transform: scale(1.8);  opacity: 0;   }
    }
    @keyframes drvPulse {
      0%   { transform: scale(0.85); opacity: 0.75; }
      70%  { transform: scale(2.1);  opacity: 0;    }
      100% { transform: scale(2.1);  opacity: 0;    }
    }
    @keyframes sosPulse {
      0%, 100% { box-shadow: 0 0 0 0   rgba(239,68,68,0.7); }
      50%       { box-shadow: 0 0 0 10px rgba(239,68,68,0);   }
    }
  `;
  document.head.appendChild(style);
}

/**
 * createCustomMarker
 * type: 'pickup' | 'dropoff' | 'care_join' | 'care_join_done' | 'care_live'
 */
function createCustomMarker(map, lat, lng, type) {
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return null;

  injectMarkerStyles();

  const configs = {
    pickup: {
      bg: '#22c55e', border: '#16a34a', size: 14,
      pulse: true, label: 'P', zIndex: 10,
    },
    dropoff: {
      bg: '#ef4444', border: '#dc2626', size: 14,
      pulse: false, label: 'D', zIndex: 10,
    },
    care_join: {
      bg: '#f59e0b', border: '#d97706', size: 12,
      pulse: true, label: 'J', zIndex: 9,
    },
    care_join_done: {
      bg: '#22c55e', border: '#16a34a', size: 12,
      pulse: false, label: '✓', zIndex: 9,
    },
    care_live: {
      bg: '#8b5cf6', border: '#7c3aed', size: 13,
      pulse: true, label: 'CA', zIndex: 11,
    },
  };

  const cfg = configs[type] || configs.pickup;

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;';

  const dot = document.createElement('div');
  dot.style.cssText = `
    width:${cfg.size * 2 + 4}px;height:${cfg.size * 2 + 4}px;
    border-radius:50%;background:${cfg.bg};border:2.5px solid ${cfg.border};
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    font-size:${cfg.size <= 12 ? '8px' : '9px'};font-weight:800;
    color:#fff;font-family:system-ui,sans-serif;position:relative;
  `;
  dot.textContent = cfg.label;

  if (cfg.pulse) {
    const ring = document.createElement('div');
    ring.style.cssText = `
      position:absolute;inset:-4px;border-radius:50%;
      border:2px solid ${cfg.bg};opacity:0.5;
      animation:markerPulse 2s ease-out infinite;
    `;
    dot.appendChild(ring);
  }

  const tail = document.createElement('div');
  tail.style.cssText = `width:3px;height:8px;background:${cfg.border};border-radius:0 0 3px 3px;`;

  container.appendChild(dot);
  container.appendChild(tail);

  return new window.google.maps.marker.AdvancedMarkerElement({
    map,
    position: { lat, lng },
    content:  container,
    zIndex:   cfg.zIndex,
  });
}

/**
 * FIX: safe way to read AdvancedMarkerElement position lat/lng.
 * Position is google.maps.LatLng — has .lat() method, not .lat property.
 */
function getMarkerLatLng(marker) {
  if (!marker?.position) return null;
  const pos = marker.position;
  // AdvancedMarkerElement stores as LatLngLiteral {lat, lng} or LatLng instance
  if (typeof pos.lat === 'function') {
    return { lat: pos.lat(), lng: pos.lng() };
  }
  if (typeof pos.lat === 'number') {
    return { lat: pos.lat, lng: pos.lng };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODAL
// ─────────────────────────────────────────────────────────────────────────────

const OtpModal = memo(function OtpModal({ onVerify, onClose, loading, error }) {
  const OTP_LEN   = 6;
  const [digits, setDigits] = useState(Array(OTP_LEN).fill(''));
  const inputRefs = useRef(Array.from({ length: OTP_LEN }, () => React.createRef()));

  const handleChange = useCallback((i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits]; next[i] = val; setDigits(next);
    if (val && i < OTP_LEN - 1) inputRefs.current[i + 1].current?.focus();
  }, [digits]);

  const handleKeyDown = useCallback((i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = ''; setDigits(next);
      inputRefs.current[i - 1].current?.focus();
    } else if (e.key === 'ArrowLeft'  && i > 0)          inputRefs.current[i - 1].current?.focus();
    else if  (e.key === 'ArrowRight' && i < OTP_LEN - 1) inputRefs.current[i + 1].current?.focus();
  }, [digits]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (!pasted.length) return;
    const next = Array(OTP_LEN).fill('');
    pasted.split('').forEach((d, i) => { if (i < OTP_LEN) next[i] = d; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LEN - 1)].current?.focus();
  }, []);

  const filled  = digits.every(d => d !== '');
  const otpCode = digits.join('');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-base-300/80 flex items-center justify-center px-4"
      role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 36 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.88, opacity: 0, y: 36  }}
        transition={{ type: 'spring', damping: 24, stiffness: 340 }}
        className="w-full max-w-sm rounded-3xl p-7 bg-base-200 border border-base-300 shadow-[0_28px_72px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-base-content m-0">Verify Ride OTP</h3>
            <p className="text-xs text-base-content/50 mt-1 m-0">Enter 6-digit code from customer</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-xl bg-base-300 flex items-center justify-center cursor-pointer text-base-content/60">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 justify-center my-6" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input key={i} ref={inputRefs.current[i]}
              type="text" inputMode="numeric" pattern="\d*" maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              aria-label={`OTP digit ${i + 1}`}
              style={{
                width: 44, height: 52, fontSize: 22, fontWeight: 800, textAlign: 'center',
                borderRadius: 12,
                background: d ? 'rgba(59,130,246,0.15)' : 'var(--base-300)',
                border: `2px solid ${d ? 'var(--primary)' : 'var(--base-300)'}`,
                color:   d ? 'var(--primary)' : 'var(--base-content)',
                outline: 'none', fontFamily: 'inherit', caretColor: 'var(--primary)',
              }}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 alert alert-error rounded-xl px-3 py-2 mb-4 text-xs font-semibold"
              role="alert">
              <AlertCircle size={14} />{error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => filled && !loading && onVerify(otpCode)}
          disabled={!filled || loading}
          className={`btn btn-lg w-full rounded-2xl font-bold text-base flex items-center justify-center gap-2 ${filled && !loading ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontFamily: 'inherit' }}
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
            : <><CheckCircle size={16} /> Verify OTP</>
          }
        </motion.button>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NAV INSTRUCTION CARD
// ─────────────────────────────────────────────────────────────────────────────

const MANEUVER_ICONS = {
  'turn-left':  (sz) => <ArrowLeft  size={sz} />,
  'turn-right': (sz) => <ArrowRight size={sz} />,
  'keep-left':  (sz) => <ArrowLeft  size={sz} style={{ opacity: 0.75 }} />,
  'keep-right': (sz) => <ArrowRight size={sz} style={{ opacity: 0.75 }} />,
  'u-turn':     (sz) => <RotateCcw  size={sz} />,
  'roundabout': (sz) => <RotateCcw  size={sz} />,
  'straight':   (sz) => <ArrowUp    size={sz} />,
  'merge':      (sz) => <ArrowUp    size={sz} />,
  'ramp':       (sz) => <ArrowUp    size={sz} />,
};

const NavInstructionCard = memo(function NavInstructionCard({ step, stepIndex, distanceMeters }) {
  if (!step) return null;
  const type    = getManeuverIcon(step.maneuver || step.instruction || '');
  const IconFn  = MANEUVER_ICONS[type] || MANEUVER_ICONS.straight;
  const dist    = (distanceMeters && distanceMeters > 0) ? distanceMeters : (step.distanceMeters ?? 0);
  const distColor = dist < 50 ? 'bg-error' : dist < 200 ? 'bg-warning' : 'bg-success';

  return (
    <motion.div
      key={stepIndex}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,   scale: 1    }}
      exit={{   opacity: 0, y: -10, scale: 0.97  }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 items-center px-3 py-2.5 rounded-md bg-base-100 border border-base-300/60"
    >
      <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${distColor}`}>
        <span className="text-white">{IconFn(20)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-content truncate m-0 leading-tight">{step.instruction}</p>
        <p className="text-xs font-bold mt-0.5 m-0 text-base-content/60">
          {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
        </p>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CA STATUS BAR — full_care_ride only
// ─────────────────────────────────────────────────────────────────────────────

const CaStatusBar = memo(function CaStatusBar({ caStatus, caName, jpCompleted }) {
  if (!caStatus || caStatus === 'not_joined') return null;

  const cfgMap = {
    en_route_to_pickup: { label: `${caName} en route to join point`, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.30)',  dot: '#3b82f6' },
    at_pickup:          { label: `${caName} waiting at join point`,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.30)',  dot: '#f59e0b' },
    in_ride:            { label: `${caName} joined the ride`,        color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.30)',   dot: '#22c55e' },
    departed:           { label: `${caName} departed`,               color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.30)', dot: '#8b5cf6' },
  };

  const cfg = cfgMap[caStatus] || cfgMap.en_route_to_pickup;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0  }}
      className="mx-2 mt-1 px-3 py-2 rounded-xl flex items-center gap-2.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: cfg.dot }} />
      <p className="text-xs font-bold m-0 flex-1" style={{ color: cfg.color }}>{cfg.label}</p>
      {caStatus === 'at_pickup' && (
        <Heart size={12} style={{ color: cfg.color }} className="flex-shrink-0" />
      )}
      {caStatus === 'in_ride' && (
        <Activity size={12} style={{ color: cfg.color }} className="flex-shrink-0 animate-pulse" />
      )}
      {jpCompleted && (
        <CheckCircle size={12} style={{ color: '#22c55e' }} className="flex-shrink-0" />
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAP LEGEND — full_care_ride only
// ─────────────────────────────────────────────────────────────────────────────

const MapLegend = memo(function MapLegend({ bookingType, caName, jpCompleted }) {
  if (bookingType !== 'full_care_ride') return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0   }}
      className="absolute z-20 flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl"
      style={{
        bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))',
        left: 12,
        background:    'rgba(10,15,28,0.85)',
        border:        '1px solid rgba(255,255,255,0.1)',
        backdropFilter:'blur(12px)',
        minWidth: 130,
      }}
    >
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 m-0 mb-1">Map Legend</p>
      {[
        { color: '#22c55e', label: 'Pickup' },
        { color: '#ef4444', label: 'Drop-off' },
        {
          color: jpCompleted ? '#22c55e' : '#f59e0b',
          label: jpCompleted ? 'CA Join Point ✓' : 'CA Join Point',
        },
        { color: '#8b5cf6', label: caName || 'Care Assistant' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
            boxShadow: `0 0 4px ${color}80`,
          }} />
          <span className="text-[10px] font-semibold text-white/70">{label}</span>
        </div>
      ))}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const BottomSheet = memo(function BottomSheet({ ride, booking, open, onToggle, rideStatus }) {
  const rd        = ride?.tracking?.ride || ride?.ride || ride;
  const bk        = booking || rd?.booking;
  const statusCfg = STATUS_CFG[rideStatus] || STATUS_CFG.driver_assigned || {};

  const InfoRow = ({ label, value, mono }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between items-center py-1.5 border-b border-base-300/50 last:border-b-0">
        <span className="text-[11px] text-base-content/45 font-semibold uppercase tracking-wider">{label}</span>
        <span className={`text-xs text-base-content/75 font-semibold ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 80px)' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-[28px] bg-base-200 border border-base-300 border-b-0"
      style={{
        maxHeight: '82vh', overflow: 'hidden',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.45)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <button onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer px-4 pt-3.5 pb-2.5 flex flex-col items-center"
        aria-label={open ? 'Collapse' : 'Expand'}>
        <div className="w-10 h-1.5 rounded-full bg-base-300 mb-3" />
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-bold text-base-content">Ride Details</span>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
              style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <ChevronDown size={15} className="text-base-content/35" />
            </motion.div>
          </div>
        </div>
      </button>

      <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(82vh - 82px)' }}>
        {(bk?.customer || bk?.patientInfo) && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-3 bg-base-300/50 border border-base-300">
            <div
              className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--secondary))' }}>
              <User size={17} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-base-content m-0 truncate">
                {bk.customer?.name || bk.patientInfo?.name || 'Passenger'}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5 m-0">{bk.customer?.phone || '—'}</p>
            </div>
            {bk.customer?.phone && (
              <a href={`tel:${bk.customer.phone}`}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-success bg-success/10 border border-success/30 no-underline"
                aria-label="Call customer">
                <Phone size={15} />
              </a>
            )}
          </div>
        )}

        <div className="p-3.5 rounded-2xl mb-3 bg-base-300/50 border border-base-300">
          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-3">Route</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-success border-2 border-base-100" />
              <div className="w-0.5 flex-1 bg-base-300 min-h-[24px]" />
              <div className="w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100" />
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div>
                <p className="text-xs font-semibold text-base-content m-0 truncate">
                  {rd?.pickup?.address || rd?.pickup?.label || bk?.patientLocation?.address || 'Pickup'}
                </p>
                <p className="text-[10px] text-base-content/38 mt-0.5 m-0">Pickup</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-base-content m-0 truncate">
                  {rd?.dropoff?.address || rd?.dropoff?.label || bk?.destinationLocation?.address || 'Drop-off'}
                </p>
                <p className="text-[10px] text-base-content/38 mt-0.5 m-0">Drop-off</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-base-300/50 border border-base-300">
          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2.5">Booking</p>
          <InfoRow label="Booking Code" value={bk?.bookingCode} mono />
          <InfoRow label="Ride Code"    value={rd?.rideCode}    mono />
          <InfoRow label="Type"         value={bk?.bookingType?.replace(/_/g, ' ')} />
          <InfoRow label="Payment"      value={bk?.paymentStatus} />
          <InfoRow label="Total Fare"   value={bk?.fareBreakdown?.totalAmount ? `₹${bk.fareBreakdown.totalAmount}` : null} />
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const RideCompletedScreen = memo(function RideCompletedScreen({ ride, onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 14, stiffness: 220 }}
        className="w-[92px] h-[92px] rounded-full flex items-center justify-center mb-6 bg-success/10 border-2 border-success/30">
        <CheckCircle size={46} className="text-success" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2">
        Ride Completed!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="text-sm text-base-content/50 text-center m-0 mb-8">
        {ride?.rideCode ? `Ride ${ride.rideCode}` : 'Ride'} completed successfully.
      </motion.p>
      {ride?.actualDistanceKm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="px-10 py-5 rounded-3xl text-center mb-8 bg-base-200 border border-base-300">
          <p className="text-[36px] font-black text-primary m-0">{ride.actualDistanceKm} km</p>
          <p className="text-[11px] text-base-content/40 mt-1 m-0 uppercase tracking-widest font-semibold">Total Distance</p>
        </motion.div>
      )}
      <motion.button
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
        whileTap={{ scale: 0.97 }} onClick={onBack}
        className="btn btn-primary btn-lg rounded-2xl px-10 font-bold" style={{ fontFamily: 'inherit' }}>
        Back to Bookings
      </motion.button>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 size={28} className="text-primary animate-spin" />
      </div>
      <p className="text-sm text-base-content/50 font-semibold">Loading navigation…</p>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SWIPE ACTION BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const SwipeActionButton = memo(function SwipeActionButton({ buttonConfig }) {
  const { label, icon, color, shadow, action } = buttonConfig;
  const [isTriggered, setIsTriggered] = useState(false);
  const containerRef = useRef(null);
  const [constraints, setConstraints] = useState(0);
  const x = useMotionValue(0);

  useEffect(() => {
    if (containerRef.current) {
      setConstraints(containerRef.current.offsetWidth - 40 - 8);
    }
  }, []);

  const handleDragEnd = (event, info) => {
    if (isTriggered) return;
    if (info.offset.x >= constraints * 0.75) {
      setIsTriggered(true);
      action();
    }
  };

  const textOpacity = useTransform(x, [0, constraints * 0.5], [1, 0]);
  const fillWidth   = useTransform(x, [0, constraints], [48, constraints + 48]);

  return (
    <div ref={containerRef}
      className="relative flex items-center h-[48px] rounded-full w-full max-w-[300px] overflow-hidden bg-base-300/80 border border-base-content/10"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }}>
      <motion.div
        className="absolute left-0 top-0 bottom-0 rounded-full opacity-20 pointer-events-none"
        style={{ width: fillWidth, background: color }} />
      <motion.div
        className="absolute w-full text-center pointer-events-none font-bold text-xs tracking-wide text-base-content/80 flex items-center justify-center gap-2"
        style={{ opacity: textOpacity }}>
        Slide to {label}
        <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="flex opacity-60">
          <ArrowRight size={14} />
        </motion.div>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: constraints }}
        dragElastic={0.05}
        dragSnapToOrigin={!isTriggered}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.95 }}
        className="absolute left-1 flex items-center justify-center w-10 h-10 rounded-full cursor-grab active:cursor-grabbing z-10"
        style={{ x, background: color, boxShadow: `0 4px 16px ${shadow}`, color: '#fff' }}>
        {isTriggered
          ? <Loader2 size={16} className="animate-spin" />
          : React.cloneElement(icon, { size: 16 })}
      </motion.div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RideLiveTracking() {
  const params    = useParams();
  const router    = useRouter();
  const dispatch  = useDispatch();
  const rideId    = params?.rideId;
  const bookingId = params?.bookingId;

  // ── External hooks ────────────────────────────────────────────────────────
  const { isLoaded } = useGoogleMaps();

  const {
    ride, tracking, socketLive, rideStatus,
    navigationTarget, etaUpdate, currentPosition,
    isLoadingRide, gpsError, isOffline, connected,
    sendStatusUpdate, verifyOtp, triggerSosAlert, DRIVER_STATUS,
    // CA-specific
    bookingType:    hookBookingType,
    caLiveLocation, caStatus, caJoinPoint, caName,
  } = useRideTracking({ rideId, bookingId });

  const {
    voiceEnabled, toggleVoice,
    speak, announceManeuver, announceArrival,
    announceRerouting, resetManeuverBands,
  } = useVoiceNavigation();

  // ── Redux: JP completed state ─────────────────────────────────────────────
  const reduxJoinPoint = useSelector(selectCaJoinPoint);

  // ── Map refs ──────────────────────────────────────────────────────────────
  const mapRef        = useRef(null);
  const mapLoadedRef  = useRef(false);
  const dirServiceRef = useRef(null);

  // Markers
  const pickupMarkerRef      = useRef(null);
  const dropoffMarkerRef     = useRef(null);
  const caJoinMarkerRef      = useRef(null);
  const caLiveMarkerRef      = useRef(null);
  const staticMarkersRef     = useRef(false);
  // FIX: split creation guard from update logic
  const caJoinMarkerCreated  = useRef(false);
  const caJoinMarkerDone     = useRef(false); // tracks if marker already swapped to done

  // Kalman
  const kalmanRef = useRef(createKalmanFilter());

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const { updateMarker, destroyMarker }          = useDriverMarker(mapRef, mapLoadedRef);
  const { updateCamera, recenter, resetToNorth,
          zoomIn, zoomOut, initCameraListeners,
          mapBearingRef, followModeRef }          = useMapCamera(mapRef);
  const {
    setRoute, updateProgress, clearRoute,
    routePointsRef,
    // FIX: CA route methods now used
    setCaRoute, clearCaRoute,
  }                                               = useRouteRenderer(mapRef);

  // ── Nav state ─────────────────────────────────────────────────────────────
  const [navSteps,       setNavSteps]       = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stepDistMeters, setStepDistMeters] = useState(0);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mapLoaded,     setMapLoaded]     = useState(false);
  const [showOtpModal,  setShowOtpModal]  = useState(false);
  const [otpLoading,    setOtpLoading]    = useState(false);
  const [otpError,      setOtpError]      = useState(null);
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRerouting,   setIsRerouting]   = useState(false);
  const [sosActive,     setSosActive]     = useState(false);
  const [arrivedSpoken, setArrivedSpoken] = useState(false);
  const [followMode,    setFollowMode]    = useState(true);

  // ── full_care_ride state ──────────────────────────────────────────────────
  const [jpCompleted,       setJpCompleted]       = useState(false);
  const [completeWpLoading, setCompleteWpLoading] = useState(false);

  // FIX: localCaStatus initialised from hook value directly.
  // Hook's returned `caStatus` is the local state inside useRideTracking.
  const [localCaStatus, setLocalCaStatus] = useState(() => caStatus || 'not_joined');

  // Off-route tracking
  const offRouteCountRef   = useRef(0);
  const lastRerouteTimeRef = useRef(0);

  // Step refs
  const navStepsRef   = useRef([]);
  const stepIdxRef    = useRef(0);
  const arrivedRef    = useRef(false);
  navStepsRef.current = navSteps;
  stepIdxRef.current  = currentStepIdx;
  arrivedRef.current  = arrivedSpoken;

  // ── Derived ───────────────────────────────────────────────────────────────
  const rd = tracking?.ride || tracking?.tracking?.ride || ride;
  const bk = rd?.booking || null;

  const bookingType = useMemo(() => {
    return hookBookingType
      || bk?.bookingType
      || rd?.bookingType
      || tracking?.bookingType
      || socketLive?.bookingType
      || null;
  }, [hookBookingType, bk, rd, tracking, socketLive]);

  const isFullCareRide = bookingType === 'full_care_ride';

  // ── Sync caStatus from hook ───────────────────────────────────────────────
  // FIX: sync whenever hook's caStatus changes (was missing initial sync)
  useEffect(() => {
    if (caStatus && caStatus !== localCaStatus) {
      setLocalCaStatus(caStatus);
    }
  }, [caStatus]); // eslint-disable-line

  // Sync from socketLive snapshot
  useEffect(() => {
    const status = socketLive?.careAssistantTracking?.caStatus;
    if (status && status !== localCaStatus) setLocalCaStatus(status);
  }, [socketLive?.careAssistantTracking?.caStatus]); // eslint-disable-line

  // ── Sync JP completed from Redux ──────────────────────────────────────────
  useEffect(() => {
    if (reduxJoinPoint?.isCompleted && !jpCompleted) {
      setJpCompleted(true);
      swapJoinMarkerToDone();
    }
  }, [reduxJoinPoint?.isCompleted]); // eslint-disable-line

  // ── CA join point coords ──────────────────────────────────────────────────
  const caJoinCoords = useMemo(() => {
    if (!isFullCareRide) return null;
    if (caJoinPoint?.coordinates?.length >= 2) {
      return { lat: caJoinPoint.coordinates[1], lng: caJoinPoint.coordinates[0] };
    }
    if (reduxJoinPoint?.coordinates?.length >= 2) {
      return { lat: reduxJoinPoint.coordinates[1], lng: reduxJoinPoint.coordinates[0] };
    }
    const joinWp = (rd?.waypoints || []).find(w => w.type === 'care_assistant_join');
    if (joinWp?.location?.coordinates?.length >= 2) {
      return { lat: joinWp.location.coordinates[1], lng: joinWp.location.coordinates[0] };
    }
    return null;
  }, [isFullCareRide, caJoinPoint, reduxJoinPoint, rd?.waypoints]);

  // ── CA live coords ────────────────────────────────────────────────────────
  const caLiveCoords = useMemo(() => {
    if (!isFullCareRide) return null;
    if (caLiveLocation?.lat && caLiveLocation?.lng) return { lat: caLiveLocation.lat, lng: caLiveLocation.lng };
    const sl = socketLive?.careAssistantLiveLocation;
    if (sl?.lat && sl?.lng) return { lat: sl.lat, lng: sl.lng };
    const snapLoc = tracking?.careAssistant?.liveLocation;
    if (snapLoc?.lat && snapLoc?.lng) return { lat: snapLoc.lat, lng: snapLoc.lng };
    return null;
  }, [isFullCareRide, caLiveLocation, socketLive?.careAssistantLiveLocation, tracking?.careAssistant?.liveLocation]);

  const caDisplayName = caName || tracking?.careAssistant?.name || rd?.careAssistantSnapshot?.name || 'Care Assistant';

  // ── Nav target ────────────────────────────────────────────────────────────
  const pickupCoords = useMemo(() => {
    const c = rd?.pickup?.coordinates;
    return c?.length >= 2 ? { lat: c[1], lng: c[0] } : null;
  }, [rd]);

  const dropoffCoords = useMemo(() => {
    const c = rd?.dropoff?.coordinates;
    return c?.length >= 2 ? { lat: c[1], lng: c[0] } : null;
  }, [rd]);

  const navTargetType = useMemo(() => {
    const nat = socketLive?.activeNavigationTarget;
    if (nat === 'dropoff_hospital' || nat === 'dropoff_destination') return 'dropoff';
    if (nat === 'pickup_care_assistant' || nat === 'pickup_patient')  return 'pickup';
    if (!rideStatus) return 'pickup';
    return ['otp_verified', 'in_progress', 'at_stop', 'completed'].includes(rideStatus)
      ? 'dropoff' : 'pickup';
  }, [rideStatus, socketLive?.activeNavigationTarget]);

  const targetCoords = navTargetType === 'dropoff' ? dropoffCoords : pickupCoords;
  const routeType    = navTargetType === 'dropoff' ? 'toDropoff'   : 'toPickup';

  // ── Map load ──────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current       = map;
    mapLoadedRef.current = true;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    const cleanup = initCameraListeners(map);
    setMapLoaded(true);
    return cleanup;
  }, [initCameraListeners]);

  // ── Follow mode sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setFollowMode(followModeRef.current), 500);
    return () => clearInterval(t);
  }, [followModeRef]);

  // ── Ride lifecycle effects ────────────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'completed') {
      const t = setTimeout(() => setShowCompleted(true), 1800);
      return () => clearTimeout(t);
    }
  }, [rideStatus]);

  useEffect(() => {
    if (rideStatus === 'driver_arrived' && !showOtpModal) setShowOtpModal(true);
  }, [rideStatus]); // eslint-disable-line

  useEffect(() => {
    setCurrentStepIdx(0);
    setArrivedSpoken(false);
    resetManeuverBands();
  }, [navTargetType, resetManeuverBands]);

  // ─────────────────────────────────────────────────────────────────────────
  // STATIC MARKERS — pickup + dropoff
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || staticMarkersRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;
    let created = false;
    if (pickupCoords && !pickupMarkerRef.current) {
      pickupMarkerRef.current = createCustomMarker(mapRef.current, pickupCoords.lat, pickupCoords.lng, 'pickup');
      created = true;
    }
    if (dropoffCoords && !dropoffMarkerRef.current) {
      dropoffMarkerRef.current = createCustomMarker(mapRef.current, dropoffCoords.lat, dropoffCoords.lng, 'dropoff');
      created = true;
    }
    if (created) staticMarkersRef.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // ─────────────────────────────────────────────────────────────────────────
  // CA JOIN POINT MARKER
  // FIX: guard split into caJoinMarkerCreated (initial) + caJoinMarkerDone (swap).
  // Creation happens once when coords appear.
  // Swap to done happens once when jpCompleted flips.
  // ─────────────────────────────────────────────────────────────────────────

  // FIX: helper extracted — avoids duplicate code and stale ref reads
  const swapJoinMarkerToDone = useCallback(() => {
    if (caJoinMarkerDone.current) return;
    caJoinMarkerDone.current = true;
    const map = mapRef.current;
    if (!map) return;

    // Destroy old marker cleanly
    if (caJoinMarkerRef.current) {
      caJoinMarkerRef.current.map = null;
      caJoinMarkerRef.current = null;
    }

    // FIX: read stored coords from the ref, not from AdvancedMarkerElement.position
    if (caJoinCoordsRef.current) {
      caJoinMarkerRef.current = createCustomMarker(
        map,
        caJoinCoordsRef.current.lat,
        caJoinCoordsRef.current.lng,
        'care_join_done',
      );
    }
  }, []);

  // Keep latest caJoinCoords in a ref so swapJoinMarkerToDone can read it
  const caJoinCoordsRef = useRef(null);
  useEffect(() => { caJoinCoordsRef.current = caJoinCoords; }, [caJoinCoords]);

  // Create JP marker when coords become available
  useEffect(() => {
    if (!mapLoaded || !isFullCareRide || caJoinMarkerCreated.current) return;
    if (!caJoinCoords) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // Remove stale marker if any
    if (caJoinMarkerRef.current) {
      caJoinMarkerRef.current.map = null;
      caJoinMarkerRef.current = null;
    }

    const markerType = jpCompleted ? 'care_join_done' : 'care_join';
    caJoinMarkerRef.current = createCustomMarker(
      mapRef.current,
      caJoinCoords.lat,
      caJoinCoords.lng,
      markerType,
    );
    caJoinMarkerCreated.current = true;
    if (jpCompleted) caJoinMarkerDone.current = true;
  }, [mapLoaded, isFullCareRide, caJoinCoords]); // eslint-disable-line

  // Reset guards when JP coords change (admin re-assigns CA with new JP)
  useEffect(() => {
    caJoinMarkerCreated.current = false;
    caJoinMarkerDone.current    = false;
  }, [caJoinCoords]);

  // Swap marker when jpCompleted becomes true (after initial creation)
  useEffect(() => {
    if (!jpCompleted || !mapLoaded) return;
    swapJoinMarkerToDone();
  }, [jpCompleted, mapLoaded, swapJoinMarkerToDone]);

  // ─────────────────────────────────────────────────────────────────────────
  // CA LIVE MARKER — update position on every GPS ping
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCareRide || !caLiveCoords) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!caLiveMarkerRef.current) {
      caLiveMarkerRef.current = createCustomMarker(
        mapRef.current,
        caLiveCoords.lat,
        caLiveCoords.lng,
        'care_live',
      );
    } else {
      // FIX: AdvancedMarkerElement accepts LatLngLiteral directly for position update
      caLiveMarkerRef.current.position = { lat: caLiveCoords.lat, lng: caLiveCoords.lng };
    }
  }, [mapLoaded, isFullCareRide, caLiveCoords]);

  // ─────────────────────────────────────────────────────────────────────────
  // CA ROUTE — draw CA's route to join point when available
  // FIX: was never called in original code
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCareRide || !caLiveCoords || !caJoinCoords) return;
    // Only draw CA route when CA hasn't yet reached join point
    if (jpCompleted || localCaStatus === 'in_ride') {
      clearCaRoute();
      return;
    }
    if (!dirServiceRef.current) return;

    dirServiceRef.current.route(
      {
        origin:      { lat: caLiveCoords.lat, lng: caLiveCoords.lng },
        destination: { lat: caJoinCoords.lat, lng: caJoinCoords.lng },
        travelMode:  window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status === 'OK') {
          setCaRoute(result);
        }
      },
    );
  }, [
    mapLoaded, isFullCareRide,
    caLiveCoords?.lat, caLiveCoords?.lng,
    caJoinCoords?.lat, caJoinCoords?.lng,
    jpCompleted, localCaStatus,
    setCaRoute, clearCaRoute,
  ]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      destroyMarker();
      [pickupMarkerRef, dropoffMarkerRef, caJoinMarkerRef, caLiveMarkerRef].forEach(ref => {
        if (ref.current) { ref.current.map = null; ref.current = null; }
      });
      clearRoute();
    };
  }, [destroyMarker, clearRoute]);

  // ── Route calculation ─────────────────────────────────────────────────────
  const calculateRoute = useCallback(async (origin, destination, type) => {
    if (!dirServiceRef.current || !origin || !destination) return;
    setIsRerouting(true);
    try {
      const result = await dirServiceRef.current.route({
        origin,
        destination,
        travelMode:               window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      if (result.status === 'OK') {
        const steps = parseDirectionSteps(result.routes?.[0]?.legs);
        setNavSteps(steps);
        setCurrentStepIdx(0);
        resetManeuverBands();
        setRoute(result, type || routeType);
      }
    } catch (e) {
      console.error('[Route]', e);
    } finally {
      setIsRerouting(false);
    }
  }, [setRoute, routeType, resetManeuverBands]);

  // FIX: trigger route on mapLoaded OR navTargetType change.
  // Original used mapLoaded in dep array which doesn't retrigger on navTargetType change.
  useEffect(() => {
    if (!mapLoaded || !currentPosition || !targetCoords) return;
    calculateRoute(
      { lat: currentPosition.lat, lng: currentPosition.lng },
      targetCoords,
      routeType,
    );
    setCurrentStepIdx(0);
    setArrivedSpoken(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, navTargetType, routeType]);

  // Navigation target pushed from server
  useEffect(() => {
    if (!navigationTarget || !mapLoaded || !currentPosition) return;
    const dest = navigationTarget.coords
      ? { lat: navigationTarget.coords[1], lng: navigationTarget.coords[0] }
      : targetCoords;
    if (dest) {
      announceRerouting();
      calculateRoute({ lat: currentPosition.lat, lng: currentPosition.lng }, dest, routeType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationTarget]);

  // Tab visibility
  const tabHiddenRef = useRef(false);
  useEffect(() => {
    const onVis = () => { tabHiddenRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Main GPS loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPosition || !mapLoaded || tabHiddenRef.current) return;

    const { lat: rawLat, lng: rawLng, heading = 0, speed = 0, accuracy = 10 } = currentPosition;
    const filtered = kalmanRef.current.update(rawLat, rawLng, accuracy, Date.now());
    const { lat, lng } = filtered;

    updateMarker(lat, lng, heading, mapBearingRef.current, speed);
    updateCamera(lat, lng, heading, speed);

    if (routePointsRef.current?.length) updateProgress(lat, lng);

    const steps = navStepsRef.current;
    if (steps.length) {
      let idx = stepIdxRef.current;
      const newIdx = findCurrentStepByPolyline(steps, lat, lng, Math.max(0, idx - 1));
      if (newIdx !== idx) { setCurrentStepIdx(newIdx); idx = newIdx; }
      const step = steps[idx];
      if (step) {
        const distM = distanceToStepEndMeters(step, lat, lng);
        setStepDistMeters(distM);
        announceManeuver(step.instruction, distM, idx, speed);
        if (distM < STEP_ADVANCE_METERS && idx < steps.length - 1) setCurrentStepIdx(idx + 1);
      }

      if (routePointsRef.current?.length && speed > 5) {
        const snap     = snapToPolyline(lat, lng, routePointsRef.current);
        const pts      = routePointsRef.current;
        const si       = snap.segmentIndex;
        const segBearing = si < pts.length - 1
          ? bearingDeg(pts[si].lat, pts[si].lng, pts[si + 1].lat, pts[si + 1].lng)
          : heading;
        const score = offRouteScore(snap.distanceOffRouteKm, heading, segBearing, speed);
        if (score > OFF_ROUTE_THRESHOLD) {
          offRouteCountRef.current++;
          if (
            offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT
            && Date.now() - lastRerouteTimeRef.current > REROUTE_COOLDOWN_MS
            && targetCoords
          ) {
            offRouteCountRef.current   = 0;
            lastRerouteTimeRef.current = Date.now();
            announceRerouting();
            calculateRoute({ lat, lng }, targetCoords, routeType);
          }
        } else {
          offRouteCountRef.current = 0;
        }
      }
    }

    if (targetCoords && !arrivedRef.current) {
      if (distanceKm(lat, lng, targetCoords.lat, targetCoords.lng) < ARRIVAL_THRESHOLD_KM) {
        announceArrival(navTargetType);
        setArrivedSpoken(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, mapLoaded]);

  // ── OTP handler ───────────────────────────────────────────────────────────
  const handleOtpVerify = useCallback(async (otp) => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const result = await verifyOtp(otp);
      const ok = result?.payload?.status === 'otp_verified'
               || result?.meta?.requestStatus === 'fulfilled';
      if (ok) {
        setShowOtpModal(false);
        speak('OTP verified. Starting ride.', { force: true });
      } else {
        setOtpError('Invalid OTP. Please ask the customer to check again.');
      }
    } catch (e) {
      setOtpError(e.message || 'OTP verification failed. Try again.');
    } finally {
      setOtpLoading(false);
    }
  }, [verifyOtp, speak]);

  // ── Driver marks CA as picked up ─────────────────────────────────────────
  const handleCompleteWaypoint = useCallback(async () => {
    if (completeWpLoading || !rideId) return;
    setCompleteWpLoading(true);
    try {
      await dispatch(driverCompleteWaypoint({ rideId, waypointType: 'care_assistant_join' })).unwrap();
      setJpCompleted(true);
      // Marker swap handled by useEffect watching jpCompleted
      dispatch(setJpWaypointCompleted({ timestamp: new Date().toISOString() }));
      speak('Care assistant picked up. Continuing to destination.', { force: true });
    } catch (err) {
      console.error('[Driver] complete waypoint failed:', err);
    } finally {
      setCompleteWpLoading(false);
    }
  }, [completeWpLoading, rideId, dispatch, speak]);

  // ── Recenter ──────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (currentPosition) {
      recenter(currentPosition.lat, currentPosition.lng, currentPosition.heading);
      setFollowMode(true);
    }
  }, [currentPosition, recenter]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/driver/bookings');
  }, [router]);

  // ── Action buttons ────────────────────────────────────────────────────────
  const actionButton = useMemo(() => {
    switch (rideStatus) {
      case 'driver_assigned':
        return { label: 'Accept Ride',        icon: <CheckCircle size={17} />, color: '#22c55e',        shadow: 'rgba(34,197,94,0.45)',   action: () => sendStatusUpdate(DRIVER_STATUS.ACCEPTED) };
      case 'driver_accepted':
        return { label: 'Navigate to Pickup', icon: <Navigation  size={17} />, color: 'var(--primary)', shadow: 'rgba(59,130,246,0.45)',  action: () => sendStatusUpdate(DRIVER_STATUS.EN_ROUTE) };
      case 'driver_en_route':
        return { label: 'I Have Arrived',     icon: <MapPin      size={17} />, color: '#8b5cf6',        shadow: 'rgba(139,92,246,0.45)', action: () => sendStatusUpdate(DRIVER_STATUS.ARRIVED) };
      case 'driver_arrived':
        return { label: 'Verify OTP',         icon: <CheckSquare size={17} />, color: '#f59e0b',        shadow: 'rgba(245,158,11,0.45)', action: () => setShowOtpModal(true) };
      case 'otp_verified':
        return { label: 'Start Ride',         icon: <Play        size={17} />, color: '#22c55e',        shadow: 'rgba(34,197,94,0.45)',  action: () => sendStatusUpdate(DRIVER_STATUS.RIDE_STARTED) };
      case 'in_progress':
        return { label: 'Complete Ride',      icon: <Square      size={17} />, color: 'var(--primary)', shadow: 'rgba(59,130,246,0.45)', action: () => sendStatusUpdate(DRIVER_STATUS.COMPLETED) };
      case 'at_stop':
        return { label: 'Resume Ride',        icon: <Play        size={17} />, color: '#06b6d4',        shadow: 'rgba(6,182,212,0.45)',  action: () => sendStatusUpdate(DRIVER_STATUS.STOP_DEPARTED) };
      default: return null;
    }
  }, [rideStatus, sendStatusUpdate, DRIVER_STATUS]);

  // FIX: broader condition — show CA pickup button for any status where CA could be at_pickup
  // Also handle 'en_route_to_pickup' properly (hook returns it; socket events may set it)
  const showCaPickupButton = isFullCareRide
    && ['in_progress', 'otp_verified', 'driver_en_route', 'driver_arrived'].includes(rideStatus)
    && !jpCompleted
    && (
      localCaStatus === 'at_pickup'
      || localCaStatus === 'en_route_to_pickup'
      || localCaStatus === 'en_route'
    );

  // ── Derived display ───────────────────────────────────────────────────────
  const currentStep = navSteps[currentStepIdx] || null;
  const etaMinutes  = etaUpdate?.etaMinutes ?? socketLive?.etaMinutes ?? rd?.currentEtaMinutes;
  const remainingKm = etaUpdate?.distanceRemainingKm;
  const speedKmh    = currentPosition?.speed ?? 0;
  const statusCfg   = STATUS_CFG[rideStatus] || {};

  // ── Guards ────────────────────────────────────────────────────────────────
  if (isLoadingRide || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted)              return <RideCompletedScreen ride={rd} onBack={handleBack} />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden font-poppins">

      {/* ── MAP ──────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={currentPosition || pickupCoords || { lat: 16.506, lng: 80.648 }}
          zoom={15}
          options={{
            mapId: MAP_ID, disableDefaultUI: true,
            clickableIcons: false, gestureHandling: 'greedy',
            mapTypeId: 'roadmap', tilt: 0,
          }}
          onLoad={onMapLoad}
        />
      </div>

      {/* ── OFFLINE ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ y: -44 }} animate={{ y: 0 }} exit={{ y: -44 }}
            className="absolute top-0 left-0 right-0 z-[60] bg-error text-error-content flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
            style={{ paddingTop: 'max(env(safe-area-inset-top,0px),10px)' }}
            role="alert">
            <WifiOff size={13} /> No internet — navigation paused
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center bg-base-100 gap-2 px-3 py-2">
          <motion.button
            whileTap={{ scale: 0.88 }} onClick={handleBack}
            className="w-8 h-8 rounded-xl bg-base-200 flex-shrink-0 flex items-center justify-center cursor-pointer text-base-content/70"
            aria-label="Go back">
            <ChevronLeft size={17} />
          </motion.button>

          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-success/90 animate-pulse' : 'bg-error/80 animate-pulse'}`} />

          {rideStatus && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full flex-shrink-0 text-[10px] font-bold uppercase tracking-widest border"
              style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          )}

          {bookingType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full flex-shrink-0 text-[9px] font-bold uppercase tracking-widest border border-base-300 bg-base-200 text-base-content/50">
              {bookingType.replace(/_/g, ' ')}
            </span>
          )}

          {etaMinutes != null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-xs font-bold text-base-content">{formatEta(etaMinutes)}</span>
            </div>
          )}

          {remainingKm != null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Navigation size={11} style={{ color: '#60a5fa' }} />
              <span className="text-xs font-semibold text-base-content/70">{formatDistance(remainingKm)}</span>
            </div>
          )}

          {speedKmh > 3 && (
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              <Zap size={11} style={{ color: '#facc15' }} />
              <span className="text-[11px] font-bold tabular-nums text-base-content/80">
                {formatSpeed(speedKmh)}<span className="text-[9px] ml-0.5 opacity-60">km/h</span>
              </span>
            </div>
          )}
        </motion.div>

        {/* Nav instruction */}
        <div className="px-2 pt-1.5">
          <AnimatePresence mode="wait">
            {currentStep && (
              <NavInstructionCard
                key={currentStepIdx}
                step={currentStep}
                stepIndex={currentStepIdx}
                distanceMeters={stepDistMeters}
              />
            )}
          </AnimatePresence>
        </div>

        {/* CA status bar — full_care_ride only */}
        <AnimatePresence>
          {isFullCareRide && (
            <CaStatusBar
              caStatus={localCaStatus}
              caName={caDisplayName}
              jpCompleted={jpCompleted}
            />
          )}
        </AnimatePresence>

        {/* Rerouting banner */}
        <AnimatePresence>
          {isRerouting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 mx-2 mt-1 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', color: '#f59e0b' }}
              role="status">
              <RotateCcw size={12} className="animate-spin" /> Recalculating route…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── GPS ERROR ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gpsError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute top-[130px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
            role="alert">
            <MapPinOff size={12} /> {gpsError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT FABs ─────────────────────────────────────────────────────── */}
      <div className="absolute z-20 flex flex-col gap-2.5" style={{ top: 160, left: 12 }}>
        {[
          { icon: <Maximize2 size={16} />, action: handleRecenter, label: 'Re-center',
            active: followMode, activeColor: 'var(--primary)' },
          { icon: <Compass   size={16} />, action: () => { resetToNorth(); setFollowMode(false); }, label: 'North' },
          { icon: <Plus      size={16} />, action: zoomIn,  label: 'Zoom in'  },
          { icon: <Minus     size={16} />, action: zoomOut, label: 'Zoom out' },
        ].map(({ icon, action, label, active, activeColor }) => (
          <motion.button
            key={label} whileTap={{ scale: 0.88 }} onClick={action} aria-label={label}
            style={{
              width: 44, height: 44, borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: active ? (activeColor || 'var(--primary)') : 'rgba(20,26,40,0.88)',
              border:     `1.5px solid ${active ? (activeColor || 'var(--primary)') : 'rgba(255,255,255,0.12)'}`,
              boxShadow:  '0 4px 16px rgba(0,0,0,0.45)',
              color:      active ? '#fff' : 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(10px)',
            }}>
            {icon}
          </motion.button>
        ))}
      </div>

      {/* ── RIGHT FABs ────────────────────────────────────────────────────── */}
      <div className="absolute z-20 flex flex-col gap-2.5" style={{ top: 160, right: 12 }}>
        <motion.button
          whileTap={{ scale: 0.88 }} onClick={toggleVoice}
          aria-label={voiceEnabled ? 'Mute voice' : 'Enable voice'}
          style={{
            width: 44, height: 44, borderRadius: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            background: voiceEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(20,26,40,0.88)',
            border:     `1.5px solid ${voiceEnabled ? 'rgba(16,185,129,0.40)' : 'rgba(255,255,255,0.12)'}`,
            boxShadow:  '0 4px 16px rgba(0,0,0,0.45)',
            color:      voiceEnabled ? '#10b981' : 'rgba(255,255,255,0.35)',
            backdropFilter: 'blur(10px)',
          }}>
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            setSosActive(true);
            triggerSosAlert('safety');
            setTimeout(() => setSosActive(false), 8000);
          }}
          aria-label="SOS"
          style={{
            width: 44, height: 44, borderRadius: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            background: sosActive ? '#ef4444' : 'rgba(239,68,68,0.12)',
            border:     `1.5px solid ${sosActive ? '#ef4444' : 'rgba(239,68,68,0.35)'}`,
            boxShadow:  '0 4px 16px rgba(0,0,0,0.45)',
            color:      sosActive ? '#fff' : '#ef4444',
            backdropFilter: 'blur(10px)',
            animation:  sosActive ? 'sosPulse 1s ease-in-out infinite' : 'none',
          }}>
          {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
        </motion.button>
      </div>

      {/* ── MAP LEGEND (full_care_ride) ───────────────────────────────────── */}
      <MapLegend bookingType={bookingType} caName={caDisplayName} jpCompleted={jpCompleted} />

      {/* ── CA LIVE CHIP ──────────────────────────────────────────────────── */}
      {isFullCareRide && caLiveCoords && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="absolute z-20"
          style={{ bottom: `calc(104px + env(safe-area-inset-bottom, 0px))`, right: 12 }}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold"
            style={{
              background:    'rgba(139,92,246,0.15)',
              border:        '1px solid rgba(139,92,246,0.4)',
              color:         '#8b5cf6',
              backdropFilter:'blur(10px)',
            }}>
            <div className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-pulse" />
            {caDisplayName} live
          </div>
        </motion.div>
      )}

      {/* ── JP INFO CHIP — shown when CA not yet joined ───────────────────── */}
      {isFullCareRide && caJoinCoords && !jpCompleted && localCaStatus !== 'in_ride' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="absolute z-20"
          style={{
            bottom: `calc(${caLiveCoords ? 142 : 104}px + env(safe-area-inset-bottom, 0px))`,
            right: 12,
          }}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold"
            style={{
              background:    'rgba(245,158,11,0.15)',
              border:        '1px solid rgba(245,158,11,0.4)',
              color:         '#f59e0b',
              backdropFilter:'blur(10px)',
            }}>
            <MapPin size={11} />
            Join Point
          </div>
        </motion.div>
      )}

      {/* ── CA PICKED UP BUTTON (full_care_ride) ──────────────────────────── */}
      <AnimatePresence>
        {showCaPickupButton && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{   y: 80, opacity: 0  }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="absolute z-30 flex justify-center w-full px-4"
            style={{ bottom: `calc(148px + env(safe-area-inset-bottom, 0px))` }}
          >
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleCompleteWaypoint}
              disabled={completeWpLoading}
              className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm"
              style={{
                background:    'rgba(139,92,246,0.92)',
                border:        '1.5px solid rgba(139,92,246,0.5)',
                color:         '#fff',
                boxShadow:     '0 6px 24px rgba(139,92,246,0.45)',
                backdropFilter:'blur(10px)',
                cursor:        completeWpLoading ? 'not-allowed' : 'pointer',
                opacity:       completeWpLoading ? 0.7 : 1,
              }}
              aria-label="Confirm care assistant picked up"
            >
              {completeWpLoading
                ? <Loader2 size={16} className="animate-spin" />
                : <UserCheck size={16} />
              }
              {caDisplayName} Picked Up
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRIMARY SWIPE ACTION BUTTON ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {actionButton && !['completed', 'cancelled'].includes(rideStatus) && (
          <motion.div
            key={rideStatus}
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="absolute z-30 flex justify-center w-full px-4"
            style={{ bottom: `calc(88px + env(safe-area-inset-bottom, 0px))` }}
          >
            <SwipeActionButton buttonConfig={actionButton} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM SHEET ──────────────────────────────────────────────────── */}
      <BottomSheet
        ride={tracking}
        booking={bk}
        open={sheetOpen}
        onToggle={() => setSheetOpen(p => !p)}
        rideStatus={rideStatus}
      />

      {/* ── OTP MODAL ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showOtpModal && (
          <OtpModal
            onVerify={handleOtpVerify}
            onClose={() => setShowOtpModal(false)}
            loading={otpLoading}
            error={otpError}
          />
        )}
      </AnimatePresence>

    </div>
  );
}