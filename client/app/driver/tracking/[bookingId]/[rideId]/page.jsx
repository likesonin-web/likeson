'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }   from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap }               from '@react-google-maps/api';
import {
  Navigation, MapPin, Phone, User,
  CheckCircle, WifiOff, Volume2, VolumeX,
  Compass, Maximize2, ChevronDown, Clock, Zap,
  Shield, ShieldAlert, RotateCcw, ArrowLeft, ArrowRight,
  ArrowUp, AlertCircle, Loader2, CheckSquare, Play,
  Square, X, MapPinOff, ChevronLeft, Minus, Plus,
} from 'lucide-react';

import { useGoogleMaps }      from '@/context/GoogleMapsProvider';
import { useRideTracking }    from '@/hooks/useRideTracking';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import { useDriverMarker, createStaticMarker } from '@/hooks/useDriverMarker';
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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID                  = process.env.NEXT_PUBLIC_MAP_ID          || '33a293614af186975a18525f';
const MAPS_KEY                = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

// Navigation thresholds
const STEP_ADVANCE_METERS     = 35;    // advance step when < 35m from step end
const ARRIVAL_THRESHOLD_KM    = 0.05;  // 50m — announce arrival
const OFF_ROUTE_THRESHOLD     = 0.7;   // confidence score → trigger reroute
const REROUTE_COOLDOWN_MS     = 12000; // min 12s between reroutes
const OFF_ROUTE_CONFIRM_COUNT = 3;     // consecutive off-route readings before reroute

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  // ── CURRENT STATUSES ──
  SEARCHING: { 
    label: 'Searching',    
    color: 'color-mix(in srgb, var(--base-content) 60%, transparent)', 
    bg: 'color-mix(in srgb, var(--base-content), transparent 90%)', 
    border: 'color-mix(in srgb, var(--base-content), transparent 75%)' 
  },
  ASSIGNED: { 
    label: 'Assigned',     
    color: 'var(--warning)', 
    bg: 'color-mix(in srgb, var(--warning), transparent 85%)',  
    border: 'color-mix(in srgb, var(--warning), transparent 65%)' 
  },
  ARRIVING: { 
    label: 'Arriving',     
    color: 'var(--info)', 
    bg: 'color-mix(in srgb, var(--info), transparent 85%)',   
    border: 'color-mix(in srgb, var(--info), transparent 65%)' 
  },
  ARRIVED: { 
    label: 'Arrived',      
    color: 'var(--accent)', 
    bg: 'color-mix(in srgb, var(--accent), transparent 85%)',  
    border: 'color-mix(in srgb, var(--accent), transparent 65%)' 
  },
  TRIP_STARTED: { 
    label: 'In Trip',      
    color: 'var(--success)', 
    bg: 'color-mix(in srgb, var(--success), transparent 85%)',   
    border: 'color-mix(in srgb, var(--success), transparent 65%)' 
  },
  TRIP_COMPLETED: { 
    label: 'Completed',    
    color: 'color-mix(in srgb, var(--base-content) 70%, transparent)', 
    bg: 'color-mix(in srgb, var(--base-content), transparent 85%)', 
    border: 'color-mix(in srgb, var(--base-content), transparent 65%)' 
  },
  CANCELLED: { 
    label: 'Cancelled',    
    color: 'var(--error)', 
    bg: 'color-mix(in srgb, var(--error), transparent 85%)',   
    border: 'color-mix(in srgb, var(--error), transparent 65%)' 
  },

  // ── LEGACY SOCKET STATUSES ──
  driver_assigned: { 
    label: 'Assigned',    
    color: 'var(--warning)', 
    bg: 'color-mix(in srgb, var(--warning), transparent 85%)',  
    border: 'color-mix(in srgb, var(--warning), transparent 65%)' 
  },
  driver_accepted: { 
    label: 'Accepted',    
    color: 'var(--primary)', 
    bg: 'color-mix(in srgb, var(--primary), transparent 85%)',  
    border: 'color-mix(in srgb, var(--primary), transparent 65%)' 
  },
  driver_en_route: { 
    label: 'En Route',    
    color: 'var(--info)', 
    bg: 'color-mix(in srgb, var(--info), transparent 85%)',   
    border: 'color-mix(in srgb, var(--info), transparent 65%)' 
  },
  driver_arrived: { 
    label: 'Arrived',     
    color: 'var(--accent)', 
    bg: 'color-mix(in srgb, var(--accent), transparent 85%)',  
    border: 'color-mix(in srgb, var(--accent), transparent 65%)' 
  },
  otp_verified: { 
    label: 'OTP ✓',       
    color: 'var(--success)', 
    bg: 'color-mix(in srgb, var(--success), transparent 85%)',  
    border: 'color-mix(in srgb, var(--success), transparent 65%)' 
  },
  in_progress: { 
    label: 'In Progress', 
    color: 'var(--success)', 
    bg: 'color-mix(in srgb, var(--success), transparent 85%)',   
    border: 'color-mix(in srgb, var(--success), transparent 65%)' 
  },
  at_stop: { 
    label: 'At Stop',     
    color: 'var(--secondary)',
    bg: 'color-mix(in srgb, var(--secondary), transparent 85%)',  
    border: 'color-mix(in srgb, var(--secondary), transparent 65%)' 
  },
  completed: { 
    label: 'Completed',   
    color: 'color-mix(in srgb, var(--base-content) 70%, transparent)', 
    bg: 'color-mix(in srgb, var(--base-content), transparent 85%)', 
    border: 'color-mix(in srgb, var(--base-content), transparent 65%)' 
  },
  cancelled: { 
    label: 'Cancelled',   
    color: 'var(--error)', 
    bg: 'color-mix(in srgb, var(--error), transparent 85%)',   
    border: 'color-mix(in srgb, var(--error), transparent 65%)' 
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODAL — 6 digit, full a11y
// ─────────────────────────────────────────────────────────────────────────────

const OtpModal = memo(function OtpModal({ onVerify, onClose, loading, error }) {
  const OTP_LEN  = 6;
  const [digits, setDigits] = useState(Array(OTP_LEN).fill(''));
  // Dynamic refs for each input
  const inputRefs = useRef(Array.from({ length: OTP_LEN }, () => React.createRef()));

  const handleChange = useCallback((i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < OTP_LEN - 1) inputRefs.current[i + 1].current?.focus();
  }, [digits]);

  const handleKeyDown = useCallback((i, e) => {
    if (e.key === 'Backspace') {
      if (!digits[i] && i > 0) {
        const next = [...digits];
        next[i - 1] = '';
        setDigits(next);
        inputRefs.current[i - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && i < OTP_LEN - 1) {
      inputRefs.current[i + 1].current?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (pasted.length > 0) {
      const next = [...Array(OTP_LEN).fill('')];
      pasted.split('').forEach((d, i) => { if (i < OTP_LEN) next[i] = d; });
      setDigits(next);
      const focusIdx = Math.min(pasted.length, OTP_LEN - 1);
      inputRefs.current[focusIdx].current?.focus();
    }
  }, []);

  const filled  = digits.every(d => d !== '');
  const otpCode = digits.join('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-base-300 flex items-center justify-center px-4"
   
      role="dialog"
      aria-modal="true"
      aria-label="OTP Verification"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 36 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 36 }}
        transition={{ type: 'spring', damping: 24, stiffness: 340 }}
        className="w-full max-w-sm rounded-3xl p-7 bg-base-200 border border-base-300 shadow-[0_28px_72px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-base-content m-0">Verify Ride OTP</h3>
            <p className="text-xs text-base-content/50 mt-1 m-0">Enter 6-digit code from customer</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close OTP modal"
            className="w-8 h-8 rounded-xl bg-base-300 border border-base-300 flex items-center justify-center cursor-pointer text-base-content/60 hover:text-base-content transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 6 OTP boxes */}
        <div className="flex gap-2 justify-center my-6" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs.current[i]}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              aria-label={`OTP digit ${i + 1}`}
              style={{
                width: 44, height: 52,
                fontSize: 22, fontWeight: 800, textAlign: 'center',
                borderRadius: 12,
                background: d ? 'rgba(59,130,246,0.15)' : 'var(--base-300)',
                border: `2px solid ${d ? 'var(--primary)' : 'var(--base-300)'}`,
                color: d ? 'var(--primary)' : 'var(--base-content)',
                outline: 'none',
                transition: 'border-color 0.18s, background 0.18s',
                fontFamily: 'inherit',
                caretColor: 'var(--primary)',
              }}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 alert alert-error rounded-xl px-3 py-2 mb-4 text-xs font-semibold"
              role="alert"
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => filled && !loading && onVerify(otpCode)}
          disabled={!filled || loading}
          aria-disabled={!filled || loading}
          className={`btn btn-lg w-full rounded-2xl font-bold text-base flex items-center justify-center gap-2 ${filled && !loading ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontFamily: 'inherit' }}
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
            : <><CheckCircle size={16} /> Verify OTP</>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NAV INSTRUCTION CARD
// ─────────────────────────────────────────────────────────────────────────────

const MANEUVER_ICONS = {
  'turn-left':   (sz) => <ArrowLeft  size={sz} />,
  'turn-right':  (sz) => <ArrowRight size={sz} />,
  'keep-left':   (sz) => <ArrowLeft  size={sz} style={{ opacity: 0.75 }} />,
  'keep-right':  (sz) => <ArrowRight size={sz} style={{ opacity: 0.75 }} />,
  'u-turn':      (sz) => <RotateCcw  size={sz} />,
  'roundabout':  (sz) => <RotateCcw  size={sz} />,
  'straight':    (sz) => <ArrowUp    size={sz} />,
  'merge':       (sz) => <ArrowUp    size={sz} />,
  'ramp':        (sz) => <ArrowUp    size={sz} />,
};

const NavInstructionCard = memo(function NavInstructionCard({ step, stepIndex, distanceMeters }) {
  if (!step) return null;
  const type   = getManeuverIcon(step.maneuver || step.instruction || '');
  const IconFn = MANEUVER_ICONS[type] || MANEUVER_ICONS.straight;

  // Distance color feedback
  const dist     = distanceMeters ?? step.distanceMeters ?? 0;
  const distColor = dist < 50 ? 'bg-error' : dist < 200 ? 'bg-warning' : 'bg-success';

  return (
    <motion.div
      key={stepIndex}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 items-center px-3 py-2.5 rounded-md    bg-base-100 border border-base-300/60"
      style={{
    
        
      }}
    >
      {/* Direction icon bubble */}
      <div
        className={` w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${distColor}`}
        
      >
        <span className="text-white">{IconFn(20)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-content truncate m-0 leading-tight">
          {step.instruction}
        </p>
        <p className="text-xs font-bold mt-0.5 m-0 text-base-content/60"  >
          {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
        </p>
      </div>

      {/* Next step preview */}
      {/* Could add next step arrow here */}
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
        maxHeight: '82vh',
        overflow: 'hidden',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.45)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Handle + header */}
      <button
        onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer px-4 pt-3.5 pb-2.5 flex flex-col items-center"
        aria-label={open ? 'Collapse ride details' : 'Expand ride details'}
      >
        <div className="w-10 h-1.5 rounded-full bg-base-300 mb-3" />
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-bold text-base-content">Ride Details</span>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
              style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}
            >
              {statusCfg.label}
            </span>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <ChevronDown size={15} className="text-base-content/35" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Scrollable content */}
      <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(82vh - 82px)' }}>

        {/* Customer card */}
        {(bk?.customer || bk?.patientInfo) && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-3 bg-base-300/50 border border-base-300">
            <div
              className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--secondary))' }}
            >
              <User size={17} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-base-content m-0 truncate">
                {bk.customer?.name || bk.patientInfo?.name || 'Passenger'}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5 m-0">
                {bk.customer?.phone || '—'}
              </p>
            </div>
            {bk.customer?.phone && (
              <a
                href={`tel:${bk.customer.phone}`}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-success bg-success/10 border border-success/30 no-underline"
                aria-label={`Call ${bk.customer?.name}`}
              >
                <Phone size={15} />
              </a>
            )}
          </div>
        )}

        {/* Route */}
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

        {/* Booking info */}
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6 font-poppins"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 14, stiffness: 220 }}
        className="w-[92px] h-[92px] rounded-full flex items-center justify-center mb-6 bg-success/10 border-2 border-success/30"
      >
        <CheckCircle size={46} className="text-success" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2"
      >
        Ride Completed!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="text-sm text-base-content/50 text-center m-0 mb-8"
      >
        {ride?.rideCode ? `Ride ${ride.rideCode}` : 'Ride'} completed successfully.
      </motion.p>
      {ride?.actualDistanceKm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="px-10 py-5 rounded-3xl text-center mb-8 bg-base-200 border border-base-300"
        >
          <p className="text-[36px] font-black text-primary m-0">{ride.actualDistanceKm} km</p>
          <p className="text-[11px] text-base-content/40 mt-1 m-0 uppercase tracking-widest font-semibold">Total Distance</p>
        </motion.div>
      )}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBack}
        className="btn btn-primary btn-lg rounded-2xl px-10 font-bold shadow-primary"
        style={{ fontFamily: 'inherit' }}
      >
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RideLiveTracking() {
  const params    = useParams();
  const router    = useRouter();
  const rideId    = params?.rideId;
  const bookingId = params?.bookingId;

  // ── External hooks ────────────────────────────────────────────────────────
  const { isLoaded } = useGoogleMaps();

  const {
    ride, tracking, socketLive, rideStatus,
    navigationTarget, etaUpdate, currentPosition,
    isLoadingRide, gpsError, isOffline, connected,
    sendStatusUpdate, verifyOtp, triggerSosAlert, DRIVER_STATUS,
  } = useRideTracking({ rideId, bookingId });

  const {
    voiceEnabled, toggleVoice,
    speak, announceManeuver, announceArrival,
    announceRerouting, resetManeuverBands,
  } = useVoiceNavigation();

  // ── Map refs ──────────────────────────────────────────────────────────────
  const mapRef         = useRef(null);
  const mapLoadedRef   = useRef(false);
  const dirServiceRef  = useRef(null);

  // Pickup / dropoff AdvancedMarkers — created once
  const pickupMarkerRef  = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const staticMarkersRef = useRef(false);  // guard

  // ── Kalman filter ─────────────────────────────────────────────────────────
  const kalmanRef = useRef(createKalmanFilter());

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const { updateMarker, destroyMarker }         = useDriverMarker(mapRef, mapLoadedRef);
  const { updateCamera, recenter, resetToNorth,
          zoomIn, zoomOut, initCameraListeners,
          mapBearingRef, followModeRef }         = useMapCamera(mapRef);
  const { setRoute, updateProgress, clearRoute,
          routePointsRef }                      = useRouteRenderer(mapRef);

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

  // Off-route tracking
  const offRouteCountRef      = useRef(0);
  const lastRerouteTimeRef    = useRef(0);

  // Step refs (avoid stale closures in GPS effect)
  const navStepsRef    = useRef([]);
  const stepIdxRef     = useRef(0);
  const arrivedRef     = useRef(false);
  navStepsRef.current  = navSteps;
  stepIdxRef.current   = currentStepIdx;
  arrivedRef.current   = arrivedSpoken;

  // ── Derived ───────────────────────────────────────────────────────────────
  const rd = tracking?.ride || tracking?.tracking?.ride || ride;
  const bk = rd?.booking || null;

  const navTargetType = useMemo(() => {
    if (!rideStatus) return 'pickup';
    return ['otp_verified', 'in_progress', 'at_stop', 'completed'].includes(rideStatus)
      ? 'dropoff'
      : 'pickup';
  }, [rideStatus]);

  const pickupCoords = useMemo(() => {
    const c = rd?.pickup?.coordinates;
    if (!c || c.length < 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [rd]);

  const dropoffCoords = useMemo(() => {
    const c = rd?.dropoff?.coordinates;
    if (!c || c.length < 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [rd]);

  const targetCoords = navTargetType === 'dropoff' ? dropoffCoords : pickupCoords;
  const routeType    = navTargetType === 'dropoff' ? 'toDropoff' : 'toPickup';

  // ── Map load handler ──────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current        = map;
    mapLoadedRef.current  = true;
    dirServiceRef.current = new window.google.maps.DirectionsService();

    const cleanup = initCameraListeners(map);
    setMapLoaded(true);

    // Sync followMode state with camera hook
    const origDragStart = followModeRef;
    return cleanup;
  }, [initCameraListeners, followModeRef]);

  // ── Sync followMode state from camera hook ────────────────────────────────
  // Camera hook internally manages followMode; we mirror it for FAB UI
  useEffect(() => {
    const interval = setInterval(() => {
      setFollowMode(followModeRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, [followModeRef]);

  // ── Trigger completed screen ──────────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'completed') {
      const t = setTimeout(() => setShowCompleted(true), 1800);
      return () => clearTimeout(t);
    }
  }, [rideStatus]);

  // ── Auto-show OTP modal on arrived ────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'driver_arrived' && !showOtpModal) {
      setShowOtpModal(true);
    }
  }, [rideStatus]); // eslint-disable-line

  // ── Reset nav state on target change ─────────────────────────────────────
  useEffect(() => {
    setCurrentStepIdx(0);
    setArrivedSpoken(false);
    resetManeuverBands();
  }, [navTargetType, resetManeuverBands]);

  // ── Create static markers once ───────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || staticMarkersRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    let created = false;
    if (pickupCoords && !pickupMarkerRef.current) {
      pickupMarkerRef.current  = createStaticMarker(mapRef.current, pickupCoords.lat, pickupCoords.lng, 'pickup');
      created = true;
    }
    if (dropoffCoords && !dropoffMarkerRef.current) {
      dropoffMarkerRef.current = createStaticMarker(mapRef.current, dropoffCoords.lat, dropoffCoords.lng, 'dropoff');
      created = true;
    }
    if (created) staticMarkersRef.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // ── Cleanup markers on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      destroyMarker();
      [pickupMarkerRef, dropoffMarkerRef].forEach(ref => {
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
        // Parse steps
        const steps = parseDirectionSteps(result.routes?.[0]?.legs);
        setNavSteps(steps);
        setCurrentStepIdx(0);
        resetManeuverBands();

        // Render route polyline
        setRoute(result, type || routeType);
      }
    } catch (e) {
      console.error('[Route]', e);
    } finally {
      setIsRerouting(false);
    }
  }, [setRoute, routeType, resetManeuverBands]);

  // ── Initial route ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !currentPosition || !targetCoords) return;
    calculateRoute(
      { lat: currentPosition.lat, lng: currentPosition.lng },
      targetCoords,
      routeType,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, navTargetType]);

  // ── Socket navigation target → reroute ────────────────────────────────────
  useEffect(() => {
    if (!navigationTarget || !mapLoaded || !currentPosition) return;

    const dest = navigationTarget.coords
      ? { lat: navigationTarget.coords[1], lng: navigationTarget.coords[0] }
      : targetCoords;

    if (dest) {
      announceRerouting();
      calculateRoute(
        { lat: currentPosition.lat, lng: currentPosition.lng },
        dest,
        routeType,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationTarget]);

  // ── Pause updates when tab hidden ─────────────────────────────────────────
  const tabHiddenRef = useRef(false);
  useEffect(() => {
    const onVis = () => { tabHiddenRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Main GPS update loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPosition || !mapLoaded || tabHiddenRef.current) return;

    const rawLat  = currentPosition.lat;
    const rawLng  = currentPosition.lng;
    const heading = currentPosition.heading || 0;
    const speed   = currentPosition.speed   || 0;           // km/h
    const acc     = currentPosition.accuracy || 10;

    // ── Kalman filter ──
    const filtered = kalmanRef.current.update(rawLat, rawLng, acc, Date.now());
    const { lat, lng } = filtered;

    // ── Update driver marker ──
    updateMarker(lat, lng, heading, mapBearingRef.current, speed);

    // ── Update camera ──
    updateCamera(lat, lng, heading, speed);

    // ── Route progress animation ──
    if (routePointsRef.current?.length) {
      updateProgress(lat, lng);
    }

    // ── Step advancement ──
    const steps = navStepsRef.current;
    if (steps.length) {
      let idx = stepIdxRef.current;

      // Find correct step using polyline proximity
      const newIdx = findCurrentStepByPolyline(steps, lat, lng, Math.max(0, idx - 1));
      if (newIdx !== idx) {
        setCurrentStepIdx(newIdx);
        idx = newIdx;
      }

      const step = steps[idx];
      if (step) {
        // Projected distance to step end
        const distM = distanceToStepEndMeters(step, lat, lng);
        setStepDistMeters(distM);

        // Voice announcement
        announceManeuver(step.instruction, distM, idx, speed);

        // Advance to next step
        if (distM < STEP_ADVANCE_METERS && idx < steps.length - 1) {
          const nextIdx = idx + 1;
          setCurrentStepIdx(nextIdx);
        }
      }

      // ── Off-route detection ──
      if (routePointsRef.current?.length && speed > 5) {
        const snap  = snapToPolyline(lat, lng, routePointsRef.current);
        const segBearing = (() => {
          const pts = routePointsRef.current;
          const si  = snap.segmentIndex;
          if (si < pts.length - 1) {
            return bearingDeg(pts[si].lat, pts[si].lng, pts[si + 1].lat, pts[si + 1].lng);
          }
          return heading;
        })();

        const score = offRouteScore(snap.distanceOffRouteKm, heading, segBearing, speed);

        if (score > OFF_ROUTE_THRESHOLD) {
          offRouteCountRef.current++;
          if (
            offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT &&
            Date.now() - lastRerouteTimeRef.current > REROUTE_COOLDOWN_MS &&
            targetCoords
          ) {
            offRouteCountRef.current  = 0;
            lastRerouteTimeRef.current = Date.now();
            announceRerouting();
            calculateRoute({ lat, lng }, targetCoords, routeType);
          }
        } else {
          offRouteCountRef.current = 0;
        }
      }
    }

    // ── Arrival detection ──
    if (targetCoords && !arrivedRef.current) {
      const distToTarget = distanceKm(lat, lng, targetCoords.lat, targetCoords.lng);
      if (distToTarget < ARRIVAL_THRESHOLD_KM) {
        announceArrival(navTargetType);
        setArrivedSpoken(true);
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, mapLoaded]);

  // ── OTP handler ────────────────────────────────────────────────────────────
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

  // ── Recenter button ───────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (currentPosition) {
      recenter(currentPosition.lat, currentPosition.lng, currentPosition.heading);
      setFollowMode(true);
    }
  }, [currentPosition, recenter]);

  // ── Back ──────────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/driver/bookings');
  }, [router]);

  // ── Action button ─────────────────────────────────────────────────────────
  const actionButton = useMemo(() => {
    switch (rideStatus) {
      case 'driver_assigned':
        return {
          label: 'Accept Ride',
          icon:  <CheckCircle size={17} />,
          color: '#22c55e',
          shadow: 'rgba(34,197,94,0.45)',
          action: () => sendStatusUpdate(DRIVER_STATUS.ACCEPTED),
        };
      case 'driver_accepted':
        return {
          label: 'Navigate to Pickup',
          icon:  <Navigation size={17} />,
          color: 'var(--primary)',
          shadow: 'rgba(59,130,246,0.45)',
          action: () => sendStatusUpdate(DRIVER_STATUS.EN_ROUTE),
        };
      case 'driver_en_route':
        return {
          label: 'I Have Arrived',
          icon:  <MapPin size={17} />,
          color: '#8b5cf6',
          shadow: 'rgba(139,92,246,0.45)',
          action: () => sendStatusUpdate(DRIVER_STATUS.ARRIVED),
        };
      case 'driver_arrived':
        return {
          label: 'Verify OTP',
          icon:  <CheckSquare size={17} />,
          color: '#f59e0b',
          shadow: 'rgba(245,158,11,0.45)',
          action: () => setShowOtpModal(true),
        };
      case 'otp_verified':
        return {
          label: 'Start Ride',
          icon:  <Play size={17} />,
          color: '#22c55e',
          shadow: 'rgba(34,197,94,0.45)',
          action: () => sendStatusUpdate(DRIVER_STATUS.RIDE_STARTED),
        };
      case 'in_progress':
        return {
          label: 'Complete Ride',
          icon:  <Square size={17} />,
          color: 'var(--primary)',
          shadow: 'rgba(59,130,246,0.45)',
          action: () => sendStatusUpdate(DRIVER_STATUS.COMPLETED),
        };
      case 'at_stop':
        return {
          label: 'Resume Ride',
          icon:  <Play size={17} />,
          color: '#06b6d4',
          shadow: 'rgba(6,182,212,0.45)',
          action: () => sendStatusUpdate(DRIVER_STATUS.STOP_DEPARTED),
        };
      default:
        return null;
    }
  }, [rideStatus, sendStatusUpdate, DRIVER_STATUS]);

  // ── Derived display ───────────────────────────────────────────────────────
  const currentStep = navSteps[currentStepIdx] || null;
  const etaMinutes  = etaUpdate?.etaMinutes ?? socketLive?.etaMinutes ?? rd?.currentEtaMinutes;
  const remainingKm = etaUpdate?.distanceRemainingKm;
  const speedKmh    = currentPosition?.speed ?? 0;
  const statusCfg   = STATUS_CFG[rideStatus] || {};

  // ── Render guards ─────────────────────────────────────────────────────────
  if (isLoadingRide || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted)              return <RideCompletedScreen ride={rd} onBack={handleBack} />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Global keyframes — injected once */}
      <style>{`
        @keyframes drvPulse {
          0%   { transform: scale(0.85); opacity: 0.75; }
          70%  { transform: scale(2.1);  opacity: 0;    }
          100% { transform: scale(2.1);  opacity: 0;    }
        }
        @keyframes sosPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          50%       { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
        }
      `}</style>

      <div className="fixed inset-0 overflow-hidden font-poppins">

        {/* ── MAP ─────────────────────────────────────────────────────── */}
        <div className="absolute inset-0">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={currentPosition || pickupCoords || { lat: 16.506, lng: 80.648 }}
            zoom={15}
            options={{
              mapId:            MAP_ID,
              disableDefaultUI: true,
              clickableIcons:   false,
              gestureHandling:  'greedy',
              mapTypeId:        'roadmap',
              tilt:             0,
              rotateControl:    false,
              scaleControl:     false,
            }}
            onLoad={onMapLoad}
          />
        </div>

        {/* ── OFFLINE BANNER ──────────────────────────────────────────── */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ y: -44 }} animate={{ y: 0 }} exit={{ y: -44 }}
              className="absolute top-0 left-0 right-0 z-[60] bg-error text-error-content flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
              style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
              role="alert"
            >
              <WifiOff size={13} />
              No internet — navigation paused
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ─────────────────────────────────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Status row */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center bg-base-100 gap-2 px-3 py-2"
            
          >
            {/* Back */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleBack}
              className="w-8 h-8 rounded-xl bg-base-200 text-accent-content flex-shrink-0 flex items-center justify-center cursor-pointer"
              
              aria-label="Go back"
            >
              <ChevronLeft size={17} />
            </motion.button>

            {/* Live dot */}
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${socketLive ? 'bg-success/90 animate-pulse' : 'bg-error/80 animate-pulse'}`}
               
            />

            {/* Status badge */}
            {rideStatus && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full flex-shrink-0 text-[10px] font-bold uppercase tracking-widest border"
                style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}
              >
                {statusCfg.label}
              </span>
            )}

            {/* ETA */}
            {etaMinutes != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock size={11} style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-xs font-bold text-base-content"  >
                  {formatEta(etaMinutes)}
                </span>
              </div>
            )}

            {/* Distance */}
            {remainingKm != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Navigation size={11} style={{ color: '#60a5fa' }} />
                <span className="text-xs font-semibold text-base-content/70" >
                  {formatDistance(remainingKm)}
                </span>
              </div>
            )}

            {/* Speed — right aligned */}
            {speedKmh > 3 && (
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <Zap size={11} style={{ color: '#facc15' }} />
                <span className="text-[11px] font-bold tabular-nums text-base-content/80"  >
                  {formatSpeed(speedKmh)}<span className="text-[9px] ml-0.5 opacity-60">km/h</span>
                </span>
              </div>
            )}
          </motion.div>

          {/* Nav card */}
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

          {/* Rerouting banner */}
          <AnimatePresence>
            {isRerouting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 mx-2 mt-1 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.30)',
                  color: '#f59e0b',
                }}
                role="status"
              >
                <RotateCcw size={12} className="animate-spin" />
                Recalculating route…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── GPS ERROR ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {gpsError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-[130px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}
              role="alert"
            >
              <MapPinOff size={12} />
              {gpsError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LEFT FABs ────────────────────────────────────────────────── */}
        <div className="absolute z-20 flex flex-col gap-2.5" style={{ top: 160, left: 12 }}>
          {/* Recenter / Follow */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleRecenter}
            aria-label="Re-center map"
            style={{
              width: 44, height: 44,
              borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: followMode ? 'var(--primary)' : 'rgba(20,26,40,0.88)',
              border: `1.5px solid ${followMode ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
              color: followMode ? '#fff' : 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Maximize2 size={16} />
          </motion.button>

          {/* North-up */}
         <motion.button
  whileTap={{ scale: 0.88 }}
  onClick={() => { 
    resetToNorth(); 
    setFollowMode(false); 
  }}
  aria-label="Reset map to north"
  className="flex items-center justify-center w-11 h-11 rounded-[13px] bg-base-200/90 border-[1.5px] border-base-content/10 shadow-lg text-base-content/60 backdrop-blur-soft cursor-pointer hover:text-base-content hover:border-base-content/30 transition-all duration-200"
>
  <Compass size={16} />
</motion.button>

          <motion.button
  whileTap={{ scale: 0.88 }}
  onClick={zoomIn}
  aria-label="Zoom in"
  className="flex items-center justify-center w-11 h-11 rounded-[13px] bg-base-200/90 border-[1.5px] border-base-content/10 shadow-lg text-base-content/60 backdrop-blur-soft cursor-pointer hover:text-base-content hover:border-base-content/30 transition-all duration-200"
>
  <Plus size={16} />
</motion.button>

{/* Zoom out */}
<motion.button
  whileTap={{ scale: 0.88 }}
  onClick={zoomOut}
  aria-label="Zoom out"
  className="flex items-center justify-center w-11 h-11 rounded-[13px] bg-base-200/90 border-[1.5px] border-base-content/10 shadow-lg text-base-content/60 backdrop-blur-soft cursor-pointer hover:text-base-content hover:border-base-content/30 transition-all duration-200"
>
  <Minus size={16} />
</motion.button>
        </div>

        {/* ── RIGHT FABs ───────────────────────────────────────────────── */}
        <div className="absolute z-20 flex flex-col gap-2.5" style={{ top: 160, right: 12 }}>
          {/* Voice toggle */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Mute voice navigation' : 'Enable voice navigation'}
            style={{
              width: 44, height: 44,
              borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: voiceEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(20,26,40,0.88)',
              border: `1.5px solid ${voiceEnabled ? 'rgba(16,185,129,0.40)' : 'rgba(255,255,255,0.12)'}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
              color: voiceEnabled ? '#10b981' : 'rgba(255,255,255,0.35)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </motion.button>

          {/* SOS */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setSosActive(true);
              triggerSosAlert('safety');
              setTimeout(() => setSosActive(false), 8000);
            }}
            aria-label="SOS emergency alert"
            style={{
              width: 44, height: 44,
              borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: sosActive ? '#ef4444' : 'rgba(239,68,68,0.12)',
              border: `1.5px solid ${sosActive ? '#ef4444' : 'rgba(239,68,68,0.35)'}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
              color: sosActive ? '#fff' : '#ef4444',
              backdropFilter: 'blur(10px)',
              animation: sosActive ? 'sosPulse 1s ease-in-out infinite' : 'none',
            }}
          >
            {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
          </motion.button>
        </div>

        {/* ── PRIMARY ACTION BUTTON ────────────────────────────────────── */}
        <AnimatePresence>
          {actionButton && !['completed', 'cancelled'].includes(rideStatus) && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="absolute z-30 flex justify-center"
              style={{
                bottom: `calc(88px + env(safe-area-inset-bottom, 0px))`,
                left: 16, right: 16,
              }}
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={actionButton.action}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 28px',
                  borderRadius: 999,
                  border: 'none',
                  background: actionButton.color,
                  boxShadow: `0 8px 28px ${actionButton.shadow}, 0 2px 8px rgba(0,0,0,0.3)`,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.02em',
                  minWidth: 200,
                  justifyContent: 'center',
                }}
              >
                {actionButton.icon}
                {actionButton.label}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOTTOM SHEET ─────────────────────────────────────────────── */}
        <BottomSheet
          ride={tracking}
          booking={bk}
          open={sheetOpen}
          onToggle={() => setSheetOpen(p => !p)}
          rideStatus={rideStatus}
        />

        {/* ── OTP MODAL ────────────────────────────────────────────────── */}
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
    </>
  );
}