'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }         from 'next/navigation';
import { useDispatch }                  from 'react-redux';
import { motion, AnimatePresence }      from 'framer-motion';
import {
  GoogleMap, useJsApiLoader, DirectionsRenderer,
} from '@react-google-maps/api';
import {
  Navigation, MapPin, Phone, User, FileText,
  CheckCircle, WifiOff, Volume2, VolumeX,
  Compass, Maximize2, ChevronDown, Clock, Zap,
  Shield, ShieldAlert, RotateCcw, ArrowLeft, ArrowRight,
  ArrowUp, AlertCircle, Loader2, CheckSquare, Play,
  Square, X, MapPinOff, ChevronLeft,
} from 'lucide-react';

import { useRideTracking }    from '@/hooks/useRideTracking';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import {
  smoothHeading, formatEta, formatDistance,
  formatSpeed, parseDirectionSteps, distanceKm,
  getManeuverIcon, stripHtml, findCurrentStepIndex,
} from '@/utils/navigationUtils';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_LIBRARIES  = ['geometry', 'marker'];
const MAP_ID                 = process.env.NEXT_PUBLIC_MAP_ID             || '33a293614af186975a18525f';
const MAPS_KEY               = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY    || '';
const STEP_ARRIVAL_THRESHOLD = 0.04;   // 40 m  — advance to next step
const ARRIVAL_THRESHOLD_KM   = 0.05;   // 50 m  — announce destination arrival
const ROUTE_RECALC_THRESHOLD = 0.15;   // 150 m — off-route → recalculate

const STATUS_CONFIG = {
  driver_assigned: { label: 'Assigned',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)' },
  driver_accepted: { label: 'Accepted',    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)' },
  driver_en_route: { label: 'En Route',    color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.35)' },
  driver_arrived:  { label: 'Arrived',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)' },
  otp_verified:    { label: 'OTP ✓',       color: '#10b981', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)' },
  in_progress:     { label: 'In Progress', color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.35)' },
  at_stop:         { label: 'At Stop',     color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.35)' },
  completed:       { label: 'Completed',   color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.35)' },
  cancelled:       { label: 'Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER HTML
//
// FIX 1: Wrapper uses position:absolute + translate(-50%,-50%) so the marker's
//         visual CENTER is pinned to the GPS coordinate, not top-left corner.
//
// FIX 2: Only the inner navigation arrow div rotates (transform:rotate).
//         The outer pulse ring stays unrotated so it pulses as a circle.
//
// FIX 3: The heading passed in is already map-relative (GPS heading minus map
//         bearing) so marker always points in the direction of travel ON SCREEN.
// ─────────────────────────────────────────────────────────────────────────────

const createDriverMarkerHtml = (heading = 0) => `
  <div style="
    position: absolute;
    width: 64px;
    height: 64px;
    left: -32px;
    top: -32px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  ">
    <!-- Pulse ring — no rotation, stays circular -->
    <div style="
      position: absolute;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(66,133,244,0.28);
      animation: gPulse 2s infinite ease-out;
      pointer-events: none;
    "></div>

    <!-- Arrow bubble — rotates with heading -->
    <div style="
      position: relative;
      width: 44px;
      height: 44px;
      background: #4285F4;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(66,133,244,0.6);
      transform: rotate(${heading}deg);
      transition: transform 0.3s ease-out;
      z-index: 2;
      flex-shrink: 0;
    ">
      <!-- Navigation arrow pointing UP (north) — rotation above handles direction -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
      </svg>
    </div>
  </div>
  <style>
    @keyframes gPulse {
      0%   { transform: scale(0.8); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  </style>
`;

// Pickup marker — centered same way
const createPickupMarkerHtml = () => `
  <div style="
    position: absolute;
    left: -21px;
    top: -58px;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  ">
    <div style="width:42px;height:42px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(16,185,129,0.55);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #10b981;margin-top:-1px;"></div>
    <div style="background:#10b981;color:#fff;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">Pickup</div>
  </div>
`;

// Dropoff marker — centered same way
const createDropoffMarkerHtml = () => `
  <div style="
    position: absolute;
    left: -21px;
    top: -58px;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  ">
    <div style="width:42px;height:42px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(239,68,68,0.55);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #ef4444;margin-top:-1px;"></div>
    <div style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">Drop-off</div>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODAL
// ─────────────────────────────────────────────────────────────────────────────

const OtpModal = memo(function OtpModal({ onVerify, onClose, loading, error }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs           = [useRef(), useRef(), useRef(), useRef()];

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 3) inputRefs[i + 1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs[i - 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      setDigits(pasted.split(''));
      inputRefs[3].current?.focus();
    }
  };

  const filled = digits.every(d => d !== '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl p-7 bg-base-200 border border-base-300 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-base-content m-0">Verify OTP</h3>
            <p className="text-xs text-base-content/50 mt-1">Enter 4-digit code from customer</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-base-300 border border-base-300 flex items-center justify-center cursor-pointer text-base-content/60 hover:text-base-content transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-3 justify-center my-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              autoFocus={i === 0}
              className="font-poppins"
              style={{
                width: 58, height: 62,
                fontSize: 26, fontWeight: 800, textAlign: 'center',
                borderRadius: 14,
                background: d ? 'rgba(59,130,246,0.15)' : 'var(--base-300)',
                border: `2px solid ${d ? 'var(--primary)' : 'var(--base-300)'}`,
                color: d ? 'var(--primary)' : 'var(--base-content)',
                outline: 'none',
                transition: 'border-color 0.2s, color 0.2s',
                fontFamily: 'inherit',
              }}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 alert alert-error rounded-xl px-3 py-2 mb-4 text-xs font-semibold"
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => filled && onVerify(digits.join(''))}
          disabled={!filled || loading}
          className={`btn btn-lg w-full rounded-2xl font-bold text-base flex items-center justify-center gap-2 ${filled && !loading ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontFamily: 'inherit' }}
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Verifying...</>
            : <><CheckCircle size={16} /> Verify OTP</>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NAV INSTRUCTION CARD
// FIX: keyed by stepIndex so AnimatePresence re-mounts on step change,
//      ensuring the card always shows the CURRENT step instruction.
// ─────────────────────────────────────────────────────────────────────────────

const NavInstructionCard = memo(function NavInstructionCard({ step, stepIndex }) {
  if (!step) return null;
  const type = getManeuverIcon(step.maneuver || step.instruction || '');

  const IconEl =
    type === 'turn-left'  ? <ArrowLeft  size={22} className="text-base-100" />
    : type === 'turn-right' ? <ArrowRight size={22} className="text-base-100" />
    :                          <ArrowUp    size={22} className="text-base-100" />;

  return (
    <motion.div
      // KEY on stepIndex — forces re-mount (and re-animation) when step changes
      key={stepIndex}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex gap-3 px-4 py-2 rounded-md border border-success bg-success shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
    >
      <div className="border border-success/30">
        {IconEl}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-100 truncate m-0">
          {step.instruction}
        </p>
        <p className="text-xs text-base-300 mt-0.5 font-semibold">
          {step.distanceText || formatDistance(step.distanceMeters / 1000)}
        </p>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const BottomSheet = memo(function BottomSheet({ ride, booking, open, onToggle }) {
  const rd        = ride?.tracking?.ride || ride?.ride || ride;
  const bk        = booking || rd?.booking;
  const statusCfg = STATUS_CONFIG[rd?.status] || STATUS_CONFIG.driver_assigned;

  const InfoRow = ({ label, value, mono }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-1.5 border-b border-base-300/60 last:border-b-0">
        <span className="text-[11px] text-base-content/50 font-semibold uppercase tracking-wide">{label}</span>
        <span className={`text-xs text-base-content/70 font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 76px)' }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl bg-base-200 border border-base-300 border-b-0 shadow-[0_-8px_40px_rgba(0,0,0,0.4)]"
      style={{ maxHeight: '82vh', overflow: 'hidden' }}
    >
      <button
        onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer px-4 pt-3 pb-2 flex flex-col items-center"
      >
        <div className="w-9 h-1 rounded-full bg-base-300 mb-2.5" />
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-bold text-base-content">Ride Details</span>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
              style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}
            >
              {statusCfg.label}
            </span>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={15} className="text-base-content/40" />
            </motion.div>
          </div>
        </div>
      </button>

      <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(82vh - 76px)' }}>
        {(bk?.customer || bk?.patientInfo) && (
          <div className="flex items-center gap-3 p-3 rounded-2xl mb-3 bg-base-300/60 border border-base-300">
            <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <User size={17} color="#fff" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-base-content m-0">
                {bk.customer?.name || bk.patientInfo?.name || 'Patient'}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5 m-0">
                {bk.customer?.phone || '—'}
              </p>
            </div>
            {bk.customer?.phone && (
              <a
                href={`tel:${bk.customer.phone}`}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-success bg-success/10 border border-success/30 no-underline transition-colors hover:bg-success/20"
              >
                <Phone size={15} />
              </a>
            )}
          </div>
        )}

        <div className="p-3 rounded-2xl mb-3 bg-base-300/60 border border-base-300">
          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2.5">Route</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-success border-2 border-base-100 flex-shrink-0" />
              <div className="w-0.5 h-7 bg-base-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100 flex-shrink-0" />
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-base-content m-0">
                  {rd?.pickup?.address || rd?.pickup?.label || bk?.patientLocation?.address || 'Pickup'}
                </p>
                <p className="text-[10px] text-base-content/40 mt-0.5 m-0">Pickup</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-base-content m-0">
                  {rd?.dropoff?.address || rd?.dropoff?.label || bk?.destinationLocation?.address || 'Drop-off'}
                </p>
                <p className="text-[10px] text-base-content/40 mt-0.5 m-0">Drop-off</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-base-300/60 border border-base-300">
          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2">Booking</p>
          <InfoRow label="Booking Code" value={bk?.bookingCode} mono />
          <InfoRow label="Ride Code"    value={rd?.rideCode}    mono />
          <InfoRow label="Type"         value={bk?.bookingType?.replace(/_/g, ' ')} />
          <InfoRow label="Payment"      value={bk?.paymentStatus} />
          <InfoRow label="Total Fare"   value={bk?.fareBreakdown?.totalAmount ? `₹${bk.fareBreakdown.totalAmount}` : null} />
          <InfoRow label="Transport"    value={bk?.fareBreakdown?.transportFee ? `₹${bk.fareBreakdown.transportFee}` : null} />
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
        transition={{ delay: 0.2, type: 'spring', damping: 14 }}
        className="w-[88px] h-[88px] rounded-full flex items-center justify-center mb-6 bg-success/10 border-2 border-success/30"
      >
        <CheckCircle size={44} className="text-success" />
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
        className="text-sm text-base-content/50 text-center m-0 mb-7"
      >
        {ride?.rideCode ? `Ride ${ride.rideCode}` : 'Ride'} completed successfully.
      </motion.p>

      {ride?.actualDistanceKm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="px-8 py-4 rounded-3xl text-center mb-7 bg-base-200 border border-base-300"
        >
          <p className="text-[34px] font-black text-primary m-0">{ride.actualDistanceKm} km</p>
          <p className="text-[11px] text-base-content/40 mt-1 m-0 uppercase tracking-widest font-semibold">Total Distance</p>
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBack}
        className="btn btn-primary btn-lg rounded-2xl px-10 font-bold text-base shadow-primary"
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
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-4 font-poppins">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 size={28} className="text-primary animate-spin" />
      </div>
      <p className="text-sm text-base-content/50 font-semibold">Loading navigation...</p>
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

  const {
    ride, tracking, socketLive, rideStatus,
    navigationTarget, etaUpdate, currentPosition,
    isLoadingRide, gpsError, isOffline, connected,
    sendStatusUpdate, verifyOtp, triggerSosAlert, DRIVER_STATUS,
  } = useRideTracking({ rideId, bookingId });

  const {
    voiceEnabled, toggleVoice,
    announceManeuver, announceArrival, announceRerouting, resetManeuverBands,
  } = useVoiceNavigation();

  // ── Map refs ────────────────────────────────────────────────
  const mapRef           = useRef(null);
  const dirServiceRef    = useRef(null);
  const driverMarkerRef  = useRef(null);
  const pickupMarkerRef  = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const markersInitRef   = useRef(false);
  const smoothHeadingRef = useRef(0);   // absolute GPS heading (smoothed)
  const mapBearingRef    = useRef(0);   // current map camera bearing

  // ── State ───────────────────────────────────────────────────
  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [followMode,     setFollowMode]     = useState(true);
  const [directions,     setDirections]     = useState(null);
  const [navSteps,       setNavSteps]       = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showOtpModal,   setShowOtpModal]   = useState(false);
  const [otpLoading,     setOtpLoading]     = useState(false);
  const [otpError,       setOtpError]       = useState(null);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [showCompleted,  setShowCompleted]  = useState(false);
  const [isRerouting,    setIsRerouting]    = useState(false);
  const [sosActive,      setSosActive]      = useState(false);
  const [arrivedSpoken,  setArrivedSpoken]  = useState(false);

  // ── Derived ─────────────────────────────────────────────────
  const navTargetType = useMemo(() => {
    if (!rideStatus) return 'pickup';
    return ['otp_verified', 'in_progress', 'at_stop', 'completed'].includes(rideStatus)
      ? 'dropoff'
      : 'pickup';
  }, [rideStatus]);

  const rd = tracking?.ride || tracking?.tracking?.ride || ride;
  const bk = rd?.booking || null;

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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY,
    libraries:        GOOGLE_MAPS_LIBRARIES,
    mapIds:           [MAP_ID],
  });

  // ── Completed screen trigger ─────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'completed') {
      const t = setTimeout(() => setShowCompleted(true), 1800);
      return () => clearTimeout(t);
    }
  }, [rideStatus]);

  // ── Auto-show OTP modal when arrived ────────────────────────
  useEffect(() => {
    if (rideStatus === 'driver_arrived' && !showOtpModal) setShowOtpModal(true);
  }, [rideStatus]);

  // ── Reset step/maneuver bands when nav target changes ────────
  useEffect(() => {
    setCurrentStepIdx(0);
    resetManeuverBands();
    setArrivedSpoken(false);
  }, [navTargetType, resetManeuverBands]);

  // ── Google Map load ──────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current        = map;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    setMapLoaded(true);
  }, []);

  // ── Track map bearing changes (when user rotates or follow mode rotates map) ──
  // We need current map bearing so we can subtract it from GPS heading
  // to compute the screen-relative heading for the marker arrow.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const listener = mapRef.current.addListener('heading_changed', () => {
      mapBearingRef.current = mapRef.current.getHeading() || 0;
    });
    return () => window.google?.maps?.event?.removeListener(listener);
  }, [mapLoaded]);

  // ── Marker cleanup on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      [driverMarkerRef, pickupMarkerRef, dropoffMarkerRef].forEach(ref => {
        if (ref.current) { ref.current.map = null; ref.current = null; }
      });
      markersInitRef.current = false;
    };
  }, []);

  // ── Driver marker — update position + heading each GPS tick ──
  //
  // FIX: heading passed to createDriverMarkerHtml is GPS-heading MINUS map-bearing.
  // This makes the arrow point in the actual direction of travel on screen,
  // regardless of how the map is rotated in follow mode.
  //
  // AdvancedMarkerElement position pins to the GPS coordinate.
  // The HTML wrapper uses position:absolute + left:-32px top:-32px to center the
  // 64×64 div — so the VISUAL CENTER of the marker sits exactly on the coordinate.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !currentPosition) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const { lat, lng, heading = 0 } = currentPosition;

    // Smooth absolute GPS heading
    smoothHeadingRef.current = smoothHeading(smoothHeadingRef.current, heading, 0.2);

    // Screen-relative heading = GPS heading minus current map rotation
    // This keeps the arrow pointing the right way as the map rotates in follow mode
    const mapBearing       = mapBearingRef.current;
    const screenHeading    = (smoothHeadingRef.current - mapBearing + 360) % 360;

    if (!driverMarkerRef.current) {
      // Create container div — position:relative so the absolute child positions correctly
      const el           = document.createElement('div');
      el.style.position  = 'relative';
      el.style.width     = '0';   // zero-size anchor — visual content is absolutely positioned
      el.style.height    = '0';
      el.innerHTML       = createDriverMarkerHtml(screenHeading);

      driverMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map:      mapRef.current,
        content:  el,
        position: { lat, lng },
        zIndex:   10,
      });
    } else {
      // Update position
      driverMarkerRef.current.position = { lat, lng };
      // Update heading by re-rendering HTML
      if (driverMarkerRef.current.content) {
        driverMarkerRef.current.content.innerHTML = createDriverMarkerHtml(screenHeading);
      }
    }

    if (followMode) {
      mapRef.current.moveCamera({
        center:  { lat, lng },
        heading: smoothHeadingRef.current,   // rotate MAP to match GPS heading
        tilt:    45,
        zoom:    17,
      });
      // mapBearingRef updated by heading_changed listener above
    }
  }, [currentPosition, mapLoaded, followMode]);

  // ── Pickup / Dropoff markers — create once ───────────────────
  useEffect(() => {
    if (!mapLoaded || markersInitRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    let created = false;

    if (pickupCoords && !pickupMarkerRef.current) {
      const el          = document.createElement('div');
      el.style.position = 'relative';
      el.style.width    = '0';
      el.style.height   = '0';
      el.innerHTML      = createPickupMarkerHtml();
      pickupMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: pickupCoords, zIndex: 5,
      });
      created = true;
    }

    if (dropoffCoords && !dropoffMarkerRef.current) {
      const el          = document.createElement('div');
      el.style.position = 'relative';
      el.style.width    = '0';
      el.style.height   = '0';
      el.innerHTML      = createDropoffMarkerHtml();
      dropoffMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: dropoffCoords, zIndex: 5,
      });
      created = true;
    }

    if (created) markersInitRef.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // ── Route calculation ────────────────────────────────────────
  const calculateRoute = useCallback(async (origin, destination) => {
    if (!dirServiceRef.current || !origin || !destination) return;
    try {
      const result = await dirServiceRef.current.route({
        origin,
        destination,
        travelMode:               window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      if (result.status === 'OK') {
        setDirections(result);
        const steps = parseDirectionSteps(result.routes?.[0]?.legs);
        setNavSteps(steps);
        setCurrentStepIdx(0);
      }
    } catch (e) {
      console.error('[Route calc]', e);
    } finally {
      setIsRerouting(false);
    }
  }, []);

  // ── Initial route when map + position ready ──────────────────
  useEffect(() => {
    if (!mapLoaded || !currentPosition || !targetCoords) return;
    calculateRoute(
      { lat: currentPosition.lat, lng: currentPosition.lng },
      targetCoords,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, navTargetType]);

  // ── Socket navigation target → reroute ──────────────────────
  useEffect(() => {
    if (!navigationTarget || !mapLoaded || !currentPosition) return;
    announceRerouting();
    setIsRerouting(true);

    const dest = navigationTarget.coords
      ? { lat: navigationTarget.coords[1], lng: navigationTarget.coords[0] }
      : (navTargetType === 'dropoff' ? dropoffCoords : pickupCoords);

    if (dest) calculateRoute({ lat: currentPosition.lat, lng: currentPosition.lng }, dest);
    else      setIsRerouting(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationTarget]);

  // ── Turn-by-turn advancement + voice ────────────────────────
  const navStepsRef   = useRef([]);
  const stepIdxRef    = useRef(0);
  navStepsRef.current = navSteps;
  stepIdxRef.current  = currentStepIdx;

  useEffect(() => {
    if (!currentPosition || !navStepsRef.current.length) return;
    const { lat, lng } = currentPosition;
    const steps        = navStepsRef.current;
    const idx          = stepIdxRef.current;
    const step         = steps[idx];

    if (!step?.endLat || !step?.endLng) return;

    const distToEnd = distanceKm(lat, lng, step.endLat, step.endLng);

    // FIX: pass stepIndex so each step gets its own band slots
    announceManeuver(step.instruction, distToEnd * 1000, idx);

    // Advance step when within 40m of step end point
    if (distToEnd < STEP_ARRIVAL_THRESHOLD && idx < steps.length - 1) {
      setCurrentStepIdx(prev => prev + 1);
    }

    // Arrival announcement
    if (targetCoords && !arrivedSpoken) {
      const distToTarget = distanceKm(lat, lng, targetCoords.lat, targetCoords.lng);
      if (distToTarget < ARRIVAL_THRESHOLD_KM) {
        announceArrival(navTargetType);
        setArrivedSpoken(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition]);

  // ── OTP verify ──────────────────────────────────────────────
  const handleOtpVerify = useCallback(async (otp) => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const result = await verifyOtp(otp);
      const ok = result?.payload?.status === 'otp_verified' || result?.meta?.requestStatus === 'fulfilled';
      if (ok) setShowOtpModal(false);
      else    setOtpError('Invalid OTP. Ask customer to check again.');
    } catch (e) {
      setOtpError(e.message || 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  }, [verifyOtp]);

  // ── Recenter ─────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    if (currentPosition && mapRef.current) {
      mapRef.current.moveCamera({
        center:  { lat: currentPosition.lat, lng: currentPosition.lng },
        heading: smoothHeadingRef.current,
        tilt:    45,
        zoom:    17,
      });
    }
  }, [currentPosition]);

  // ── Go back ──────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/driver/bookings');
  }, [router]);

  // ── Action button config per status ─────────────────────────
  //
  // FIX: DRIVER_STATUS.ARRIVED → sendStatusUpdate correctly maps to markDriverArrived.
  //      DRIVER_STATUS.RIDE_STARTED → mapped from 'start_ride' in useRideTracking.
  //      DRIVER_STATUS.COMPLETED → mapped from 'complete'.
  //      All confirmed against driverStatusToAction map in useRideTracking.
  // ─────────────────────────────────────────────────────────────────────────────
  const actionButton = useMemo(() => {
    switch (rideStatus) {
      case 'driver_assigned':
        return {
          label: 'Accept Ride', icon: <CheckCircle size={18} />,
          color: '#22c55e', shadow: 'rgba(34,197,94,0.4)',
          // DRIVER_STATUS.ACCEPTED → HTTP accept + socket accepted
          action: () => sendStatusUpdate(DRIVER_STATUS.ACCEPTED),
        };
      case 'driver_accepted':
        return {
          label: 'Navigate To Pickup', icon: <Navigation size={18} />,
          color: 'var(--primary)', shadow: 'rgba(59,130,246,0.4)',
          // DRIVER_STATUS.EN_ROUTE → HTTP start_route + socket en_route
          action: () => sendStatusUpdate(DRIVER_STATUS.EN_ROUTE),
        };
      case 'driver_en_route':
        return {
          label: 'I Have Arrived', icon: <MapPin size={18} />,
          color: '#8b5cf6', shadow: 'rgba(139,92,246,0.4)',
          // DRIVER_STATUS.ARRIVED → HTTP markDriverArrived (/:id/ride/arrived) + socket arrived
          action: () => sendStatusUpdate(DRIVER_STATUS.ARRIVED),
        };
      case 'driver_arrived':
        return {
          label: 'Verify OTP', icon: <CheckSquare size={18} />,
          color: '#f59e0b', shadow: 'rgba(245,158,11,0.4)',
          action: () => setShowOtpModal(true),
        };
      case 'otp_verified':
        return {
          label: 'Start Ride', icon: <Play size={18} />,
          color: '#22c55e', shadow: 'rgba(34,197,94,0.4)',
          // DRIVER_STATUS.RIDE_STARTED → HTTP start_ride + socket ride_started
          action: () => sendStatusUpdate(DRIVER_STATUS.RIDE_STARTED),
        };
      case 'in_progress':
        return {
          label: 'Complete Ride', icon: <Square size={18} />,
          color: 'var(--primary)', shadow: 'rgba(59,130,246,0.4)',
          // DRIVER_STATUS.COMPLETED → HTTP complete + socket completed
          action: () => sendStatusUpdate(DRIVER_STATUS.COMPLETED),
        };
      case 'at_stop':
        return {
          label: 'Resume Ride', icon: <Play size={18} />,
          color: '#06b6d4', shadow: 'rgba(6,182,212,0.4)',
          // DRIVER_STATUS.STOP_DEPARTED → HTTP resume + socket stop_departed
          action: () => sendStatusUpdate(DRIVER_STATUS.STOP_DEPARTED),
        };
      default:
        return null;
    }
  }, [rideStatus, sendStatusUpdate, DRIVER_STATUS]);

  const currentStep = navSteps[currentStepIdx] || null;
  const etaMinutes  = etaUpdate?.etaMinutes ?? socketLive?.etaMinutes ?? rd?.currentEtaMinutes;
  const remainingKm = etaUpdate?.distanceRemainingKm;

  // ── Render guards ────────────────────────────────────────────
  if (isLoadingRide || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted)              return <RideCompletedScreen ride={rd} onBack={handleBack} />;

  // ── Main render ──────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes gPulse  { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
      `}</style>

      <div className="fixed inset-0 overflow-hidden font-poppins">

        {/* ── MAP ─────────────────────────────────────────── */}
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
              tilt:             45,
            }}
            onLoad={onMapLoad}
            onDragStart={() => setFollowMode(false)}
          >
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor:   '#6366f1',
                    strokeWeight:  6,
                    strokeOpacity: 0.9,
                  },
                }}
              />
            )}
          </GoogleMap>
        </div>

        {/* ── OFFLINE BANNER ─────────────────────────────── */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ y: -48 }} animate={{ y: 0 }} exit={{ y: -48 }}
              className="absolute top-0 left-0 right-0 z-[60] bg-error text-error-content flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
            >
              <WifiOff size={14} />
              No internet — navigation paused
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="mt-1 flex flex-col">

            {/* Status + back + ETA row */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-base-200/95 border border-base-300"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleBack}
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center cursor-pointer text-base-content/60 bg-base-300 border border-base-300 hover:text-base-content transition-colors"
              >
                <ChevronLeft size={18} />
              </motion.button>

              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background:  connected ? 'var(--success)' : 'var(--error)',
                  boxShadow:   connected ? '0 0 6px var(--success)' : 'none',
                  animation:   connected ? 'gPulse 2s infinite' : 'none',
                }}
              />

              {rideStatus && (() => {
                const cfg = STATUS_CONFIG[rideStatus] || {};
                return (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full flex-shrink-0 text-[10px] font-bold uppercase tracking-widest border"
                    style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                );
              })()}

              {etaMinutes != null && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Clock size={11} className="text-base-content/40" />
                  <span className="text-xs font-bold text-base-content">{formatEta(etaMinutes)}</span>
                </div>
              )}

              {remainingKm != null && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Navigation size={11} className="text-primary" />
                  <span className="text-xs font-semibold text-base-content">{formatDistance(remainingKm)}</span>
                </div>
              )}

              {currentPosition?.speed > 2 && (
                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                  <Zap size={11} className="text-warning" />
                  <span className="text-[11px] font-semibold text-base-content/60">{formatSpeed(currentPosition.speed)}</span>
                </div>
              )}
            </motion.div>

            {/* Nav instruction card — keyed by step index so it updates on step change */}
            <AnimatePresence mode="wait">
              {currentStep && (
                <NavInstructionCard
                  key={currentStepIdx}
                  step={currentStep}
                  stepIndex={currentStepIdx}
                />
              )}
            </AnimatePresence>

            {/* Rerouting banner */}
            <AnimatePresence>
              {isRerouting && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/30 text-xs font-semibold text-warning"
                >
                  <RotateCcw size={13} className="animate-spin" />
                  Recalculating route...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── GPS ERROR ──────────────────────────────────── */}
        <AnimatePresence>
          {gpsError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-[120px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-error/10 border border-error/30 text-xs text-error font-semibold whitespace-nowrap"
            >
              <MapPinOff size={13} />
              {gpsError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LEFT FABs (recenter + compass) ─────────────── */}
        <div className="absolute top-36 left-3 z-20 flex flex-col gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleRecenter}
            className={`w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border border-base-300 shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors ${followMode ? 'bg-primary text-primary-content' : 'bg-base-200/90 text-base-content/60'}`}
          >
            <Maximize2 size={16} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.moveCamera({ heading: 0, tilt: 0 });
                mapBearingRef.current = 0;
                setFollowMode(false);
              }
            }}
            className="w-11 h-11 rounded-[13px] bg-base-200/90 border border-base-300 flex items-center justify-center cursor-pointer text-base-content/60 shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:text-base-content transition-colors"
          >
            <Compass size={16} />
          </motion.button>
        </div>

        {/* ── RIGHT FABs (voice + SOS) ────────────────────── */}
        <div className="absolute top-36 right-3 z-20 flex flex-col gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleVoice}
            className={`w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors ${voiceEnabled ? 'bg-success/10 border-success/30 text-success' : 'bg-base-200/90 border-base-300 text-base-content/40'}`}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setSosActive(true);
              triggerSosAlert('safety');
              setTimeout(() => setSosActive(false), 5000);
            }}
            className={`w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors ${sosActive ? 'bg-error border-error text-error-content' : 'bg-error/10 border-error/30 text-error'}`}
            style={{ animation: sosActive ? 'gPulse 1s infinite' : 'none' }}
          >
            {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
          </motion.button>
        </div>

        {/* ── PRIMARY ACTION BUTTON ───────────────────────── */}
        <AnimatePresence>
          {actionButton && rideStatus !== 'completed' && rideStatus !== 'cancelled' && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="absolute bottom-[88px] left-4 right-4 z-30"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={actionButton.action}
                className="w-fit px-4 mx-auto py-2 rounded-full border-none text-white cursor-pointer text-[15px] font-extrabold flex items-center justify-center gap-2.5 font-poppins tracking-wide"
                style={{
                  background: actionButton.color,
                  boxShadow:  `0 6px 24px ${actionButton.shadow}`,
                  fontFamily: 'inherit',
                }}
              >
                {actionButton.icon}
                <span className='text-xs'>{actionButton.label}</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOTTOM SHEET ───────────────────────────────── */}
        <BottomSheet
          ride={tracking}
          booking={bk}
          open={sheetOpen}
          onToggle={() => setSheetOpen(p => !p)}
        />

        {/* ── OTP MODAL ──────────────────────────────────── */}
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