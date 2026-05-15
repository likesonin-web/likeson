'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GoogleMap, useJsApiLoader, DirectionsRenderer,
} from '@react-google-maps/api';
import {
  Navigation, MapPin, Phone, User, FileText,
  CheckCircle, WifiOff, Volume2, VolumeX,
  Compass, Maximize2, ChevronDown, Clock, Zap,
  Shield, ShieldAlert, RotateCcw, ArrowLeft, ArrowRight,
  ArrowUp, AlertCircle, Loader2, CheckSquare, Play,
  Square, X, MapPinOff,
} from 'lucide-react';

import { useRideTracking } from '@/hooks/useRideTracking';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import {
  smoothHeading, formatEta, formatDistance,
  formatSpeed, parseDirectionSteps, distanceKm, getManeuverIcon, stripHtml,
} from '@/utils/navigationUtils';

// ── Constants ─────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_LIBRARIES = ['geometry', 'marker'];
const MAP_ID = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyBkwZzM-ZJCCHUg5hG5vbT9OSIeUPVi_qw';
const STEP_COMPLETE_THRESHOLD_KM = 0.05;

const STATUS_CONFIG = {
  driver_assigned:  { label: 'Assigned',    color: 'text-warning',  bg: 'bg-warning/10',  border: 'border-warning/30' },
  driver_accepted:  { label: 'Accepted',    color: 'text-info',     bg: 'bg-info/10',     border: 'border-info/30' },
  driver_en_route:  { label: 'En Route',    color: 'text-primary',  bg: 'bg-primary/10',  border: 'border-primary/30' },
  driver_arrived:   { label: 'Arrived',     color: 'text-accent',   bg: 'bg-accent/10',   border: 'border-accent/30' },
  otp_verified:     { label: 'OTP ✓',       color: 'text-success',  bg: 'bg-success/10',  border: 'border-success/30' },
  in_progress:      { label: 'In Progress', color: 'text-success',  bg: 'bg-success/10',  border: 'border-success/30' },
  at_stop:          { label: 'At Stop',     color: 'text-warning',  bg: 'bg-warning/10',  border: 'border-warning/30' },
  completed:        { label: 'Completed',   color: 'text-success',  bg: 'bg-success/10',  border: 'border-success/30' },
  cancelled:        { label: 'Cancelled',   color: 'text-error',    bg: 'bg-error/10',    border: 'border-error/30' },
};

// ── Marker HTML creators ──────────────────────────────────────────────────────
function createDriverMarkerHtml(heading) {
  return `
    <div style="position:relative;width:48px;height:48px;transform:rotate(${heading}deg);transition:transform 0.3s ease;">
      <div style="
        width:48px;height:48px;border-radius:50% 50% 50% 0;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);
        transform:rotate(-45deg);
        box-shadow:0 4px 20px rgba(99,102,241,0.5);
        border:3px solid white;
      "></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" fill="white" viewBox="0 0 24 24" style="transform:rotate(45deg)">
          <path d="M12 2L4 20l8-4 8 4L12 2z"/>
        </svg>
      </div>
    </div>
    <div style="
      position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
      width:8px;height:8px;border-radius:50%;
      background:rgba(99,102,241,0.4);
      animation:pulse 1.5s infinite;
    "></div>
  `;
}

function createPickupMarkerHtml() {
  return `
    <div style="position:relative;text-align:center;">
      <div style="
        width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#10b981,#34d399);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 20px rgba(16,185,129,0.5);
        border:3px solid white;
        animation:markerPulse 2s infinite;
      ">
        <span style="color:white;font-weight:900;font-size:18px;">P</span>
      </div>
      <div style="margin-top:2px;background:white;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;color:#10b981;box-shadow:0 2px 8px rgba(0,0,0,0.15);">PICKUP</div>
    </div>
  `;
}

function createDropoffMarkerHtml() {
  return `
    <div style="position:relative;text-align:center;">
      <div style="
        width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#ef4444,#f97316);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 20px rgba(239,68,68,0.5);
        border:3px solid white;
      ">
        <span style="color:white;font-weight:900;font-size:18px;">D</span>
      </div>
      <div style="margin-top:2px;background:white;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;color:#ef4444;box-shadow:0 2px 8px rgba(0,0,0,0.15);">DROP</div>
    </div>
  `;
}

// ── OTP Modal ─────────────────────────────────────────────────────────────────
const OtpModal = memo(function OtpModal({ onVerify, onClose, loading, error }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

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

  const handleSubmit = () => {
    const otp = digits.join('');
    if (otp.length === 4) onVerify(otp);
  };

  const filled = digits.every(d => d !== '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="bg-base-100 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-base-300"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-base-content">Verify OTP</h3>
            <p className="text-xs text-base-content/50 mt-0.5">Enter 4-digit code from customer</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
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
              className={`
                w-14 h-14 text-2xl font-bold text-center rounded-xl border-2 outline-none
                transition-all duration-200
                ${d ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 bg-base-200 text-base-content'}
                focus:border-primary focus:bg-primary/5
              `}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-error text-sm mb-4 bg-error/10 rounded-lg px-3 py-2"
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleSubmit}
          disabled={!filled || loading}
          className="btn btn-primary w-full rounded-xl py-3 font-bold text-base"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Verifying...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />
              Verify OTP
            </div>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
});

// ── Nav Instruction Card ──────────────────────────────────────────────────────
const NavInstructionCard = memo(function NavInstructionCard({ step }) {
  if (!step) return null;
  const maneuver = getManeuverIcon(step.maneuver || step.instruction || '');
  const isLeft = maneuver === 'turn-left';
  const isRight = maneuver === 'turn-right';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-base-100/95 border border-base-300/60 shadow-xl"
    >
      <div className={`
        w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
        ${isLeft ? 'bg-blue-500/20' : isRight ? 'bg-orange-500/20' : 'bg-success/20'}
      `}>
        {isLeft
          ? <ArrowLeft size={24} className="text-blue-400" />
          : isRight
            ? <ArrowRight size={24} className="text-orange-400" />
            : <ArrowUp size={24} className="text-success" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate text-base-content">{step.instruction}</p>
        <p className="text-xs mt-0.5 text-base-content/50">
          {step.distanceText || formatDistance(step.distanceMeters / 1000)}
        </p>
      </div>
    </motion.div>
  );
});

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-base-content/40">{label}</span>
      <span className={`text-xs font-semibold text-base-content ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ── Bottom Sheet ──────────────────────────────────────────────────────────────
const BottomSheet = memo(function BottomSheet({ ride, booking, open, onToggle }) {
  if (!ride && !booking) return null;

  const rd = ride?.tracking?.ride || ride;
  const bk = booking || rd?.booking;
  const statusCfg = STATUS_CONFIG[rd?.status] || STATUS_CONFIG.driver_assigned;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 80px)' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl border-t bg-base-100 border-base-300 shadow-2xl max-h-[80vh] overflow-hidden"
    >
      {/* Handle */}
      <button onClick={onToggle} className="w-full flex flex-col items-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-base-300" />
        <div className="flex items-center justify-between w-full px-4 mt-2">
          <span className="text-sm font-bold text-base-content">Ride Details</span>
          <div className="flex items-center gap-2">
            <span className={`badge badge-sm ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}>
              {statusCfg.label}
            </span>
            <motion.div animate={{ rotate: open ? 180 : 0 }}>
              <ChevronDown size={16} className="text-base-content/50" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Content */}
      <div className="overflow-y-auto max-h-[65vh] px-4 pb-6 space-y-4">
        {/* Customer */}
        {bk?.customer && (
          <div className="rounded-xl p-4 bg-base-200 border border-base-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-base-content">
                  {bk.customer?.name || bk.patientInfo?.name || 'Patient'}
                </p>
                <p className="text-xs text-base-content/50">{bk.customer?.phone || '—'}</p>
              </div>
              {bk.customer?.phone && (
                <a href={`tel:${bk.customer.phone}`} className="btn btn-success btn-sm btn-circle">
                  <Phone size={14} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Patient info */}
        {bk?.patientInfo && (
          <div className="rounded-xl p-4 bg-base-200 border border-base-300">
            <p className="text-xs font-bold uppercase tracking-wider mb-2 text-base-content/50">Patient</p>
            <div className="space-y-1">
              <InfoRow label="Name" value={bk.patientInfo.name} />
              <InfoRow label="Age" value={bk.patientInfo.age ? `${bk.patientInfo.age} yrs` : null} />
              <InfoRow label="Gender" value={bk.patientInfo.gender} />
              <InfoRow label="Blood" value={bk.patientInfo.bloodGroup} />
            </div>
          </div>
        )}

        {/* Route */}
        <div className="rounded-xl p-4 space-y-3 bg-base-200 border border-base-300">
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/50">Route</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-3 h-3 rounded-full bg-success border-2 border-white" />
              <div className="w-0.5 h-8 bg-base-300" />
              <div className="w-3 h-3 rounded-full bg-error border-2 border-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold text-base-content">
                  {rd?.pickup?.address || rd?.pickup?.label || bk?.patientLocation?.address || 'Pickup'}
                </p>
                <p className="text-xs text-base-content/40">Pickup</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-base-content">
                  {rd?.dropoff?.address || rd?.dropoff?.label || bk?.destinationLocation?.address || 'Drop'}
                </p>
                <p className="text-xs text-base-content/40">Drop-off</p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking */}
        <div className="rounded-xl p-4 space-y-2 bg-base-200 border border-base-300">
          <p className="text-xs font-bold uppercase tracking-wider mb-2 text-base-content/50">Booking</p>
          <InfoRow label="Booking Code" value={bk?.bookingCode} mono />
          <InfoRow label="Ride Code" value={rd?.rideCode} mono />
          <InfoRow label="Type" value={bk?.bookingType?.replace(/_/g, ' ')} />
          <InfoRow label="Payment" value={bk?.paymentStatus || bk?.fareBreakdown?.currency} />
          {bk?.fareBreakdown?.totalAmount && <InfoRow label="Fare" value={`₹${bk.fareBreakdown.totalAmount}`} />}
          {bk?.fareBreakdown?.transportFee && <InfoRow label="Transport" value={`₹${bk.fareBreakdown.transportFee}`} />}
        </div>

        {/* Notes */}
        {bk?.internalNotes && (
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
            <div className="flex gap-2">
              <FileText size={14} className="text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{bk.internalNotes}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ── Ride Completed ────────────────────────────────────────────────────────────
const RideCompletedScreen = memo(function RideCompletedScreen({ ride }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-base-100 flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 15 }}
        className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mb-6"
      >
        <CheckCircle size={48} className="text-success" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-2xl font-bold text-base-content mb-2"
      >
        Ride Completed!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-base-content/50 text-sm text-center"
      >
        {ride?.rideCode && `Ride ${ride.rideCode}`} has been completed successfully.
      </motion.p>
      {ride?.actualDistanceKm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 bg-base-200 rounded-2xl px-6 py-4 text-center"
        >
          <p className="text-3xl font-black text-primary">{ride.actualDistanceKm} km</p>
          <p className="text-xs text-base-content/50 mt-1">Total Distance</p>
        </motion.div>
      )}
    </motion.div>
  );
});

// ── Loading Skeleton ──────────────────────────────────────────────────────────
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 bg-base-200 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
        <Loader2 size={28} className="text-primary animate-spin" />
      </div>
      <p className="text-sm font-medium text-base-content/60">Loading navigation...</p>
    </div>
  );
});

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function RideLiveTracking() {
  const params = useParams();
  const rideId = params?.rideId;
  const bookingId = params?.bookingId;

  const {
    ride, tracking, socketLive, rideStatus,
    navigationTarget, etaUpdate, currentPosition,
    isLoadingRide, gpsError, isOffline, connected,
    sendStatusUpdate, verifyOtp, triggerSosAlert, DRIVER_STATUS,
  } = useRideTracking({ rideId, bookingId });

  const {
    voiceEnabled, toggleVoice, announceManeuver,
    announceArrival, announceRerouting,
  } = useVoiceNavigation();

  // Map refs — one source of truth per marker
  const mapRef = useRef(null);
  const dirServiceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const smoothHeadingRef = useRef(0);
  const markersInitializedRef = useRef(false);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [directions, setDirections] = useState(null);
  const [navSteps, setNavSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapTilt] = useState(45);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  const navTargetType = useMemo(() => {
    if (!rideStatus) return 'pickup';
    return ['otp_verified', 'in_progress', 'at_stop', 'completed'].includes(rideStatus)
      ? 'dropoff'
      : 'pickup';
  }, [rideStatus]);

  const rd = tracking?.ride || ride;
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
    libraries: GOOGLE_MAPS_LIBRARIES,
    mapIds: [MAP_ID],
  });

  // ── Completed screen ────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'completed') {
      const t = setTimeout(() => setShowCompleted(true), 1500);
      return () => clearTimeout(t);
    }
    setShowCompleted(false);
  }, [rideStatus]);

  // ── Auto OTP modal ──────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'driver_arrived') setShowOtpModal(true);
  }, [rideStatus]);

  // ── Map init ────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    setMapLoaded(true);
  }, []);

  // ── Cleanup markers on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
        driverMarkerRef.current = null;
      }
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.map = null;
        pickupMarkerRef.current = null;
      }
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.map = null;
        dropoffMarkerRef.current = null;
      }
      markersInitializedRef.current = false;
    };
  }, []);

  // ── Driver marker (update only, no re-create) ───────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !currentPosition) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const { lat, lng, heading = 0 } = currentPosition;
    smoothHeadingRef.current = smoothHeading(smoothHeadingRef.current, heading, 0.2);

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = createDriverMarkerHtml(smoothHeadingRef.current);
      driverMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        content: el,
        position: { lat, lng },
        zIndex: 10,
      });
    } else {
      driverMarkerRef.current.position = { lat, lng };
      if (driverMarkerRef.current.content) {
        driverMarkerRef.current.content.innerHTML = createDriverMarkerHtml(smoothHeadingRef.current);
      }
    }

    if (followMode) {
      mapRef.current.moveCamera({
        center: { lat, lng },
        heading: smoothHeadingRef.current,
        tilt: mapTilt,
        zoom: 17,
      });
    }
  }, [currentPosition, mapLoaded, followMode, mapTilt]);

  // ── Pickup / Dropoff markers — create once only ─────────────
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    if (markersInitializedRef.current) return; // guard: no duplicates

    let created = false;

    if (pickupCoords && !pickupMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = createPickupMarkerHtml();
      pickupMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        content: el,
        position: pickupCoords,
        zIndex: 5,
      });
      created = true;
    }

    if (dropoffCoords && !dropoffMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = createDropoffMarkerHtml();
      dropoffMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        content: el,
        position: dropoffCoords,
        zIndex: 5,
      });
      created = true;
    }

    if (created) markersInitializedRef.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // ── Route calculation ───────────────────────────────────────
  const calculateRoute = useCallback(async (origin, destination) => {
    if (!dirServiceRef.current || !origin || !destination) return;
    try {
      const result = await dirServiceRef.current.route({
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      if (result.status === 'OK') {
        setDirections(result);
        setNavSteps(parseDirectionSteps(result.routes?.[0]?.legs));
        setCurrentStepIndex(0);
      }
    } catch (e) {
      console.error('[Route calc]', e);
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !currentPosition || !targetCoords) return;
    calculateRoute(
      { lat: currentPosition.lat, lng: currentPosition.lng },
      targetCoords,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, navTargetType, targetCoords]);

  // ── Socket navigation target → reroute ─────────────────────
  useEffect(() => {
    if (!navigationTarget || !mapLoaded) return;
    announceRerouting();
    setIsRerouting(true);
    const dest = navigationTarget.coords
      ? { lat: navigationTarget.coords[1], lng: navigationTarget.coords[0] }
      : navTargetType === 'dropoff' ? dropoffCoords : pickupCoords;

    if (dest && currentPosition) {
      calculateRoute(
        { lat: currentPosition.lat, lng: currentPosition.lng },
        dest,
      ).finally(() => setIsRerouting(false));
    } else {
      setIsRerouting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationTarget]);

  // ── Turn-by-turn step advance ───────────────────────────────
  useEffect(() => {
    if (!currentPosition || !navSteps.length) return;
    const step = navSteps[currentStepIndex];
    if (!step) return;

    const distToStepEnd = distanceKm(
      currentPosition.lat, currentPosition.lng,
      step.endLat, step.endLng,
    );

    if (distToStepEnd < 0.3) {
      announceManeuver(step.instruction, Math.round(distToStepEnd * 1000));
    }
    if (distToStepEnd < STEP_COMPLETE_THRESHOLD_KM && currentStepIndex < navSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
    if (targetCoords) {
      const distToTarget = distanceKm(
        currentPosition.lat, currentPosition.lng,
        targetCoords.lat, targetCoords.lng,
      );
      if (distToTarget < 0.05) announceArrival(navTargetType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition]);

  // ── OTP verify ──────────────────────────────────────────────
  const handleOtpVerify = useCallback(async (otp) => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const result = await verifyOtp(otp);
      if (result?.payload?.success || result?.success) {
        setShowOtpModal(false);
      } else {
        setOtpError('Invalid OTP. Ask customer to check again.');
      }
    } catch (e) {
      setOtpError(e.message || 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  }, [verifyOtp]);

  // ── Recenter ────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    if (currentPosition && mapRef.current) {
      mapRef.current.moveCamera({
        center: { lat: currentPosition.lat, lng: currentPosition.lng },
        heading: smoothHeadingRef.current,
        tilt: mapTilt,
        zoom: 17,
      });
    }
  }, [currentPosition, mapTilt]);

  // ── Action button ───────────────────────────────────────────
  const actionButton = useMemo(() => {
    switch (rideStatus) {
      case 'driver_assigned':
        return { label: 'Accept Ride', icon: <CheckCircle size={18} />, action: () => sendStatusUpdate(DRIVER_STATUS.ACCEPTED), color: 'btn-success' };
      case 'driver_accepted':
        return { label: 'Navigate To Pickup', icon: <Navigation size={18} />, action: () => sendStatusUpdate(DRIVER_STATUS.EN_ROUTE), color: 'btn-primary' };
      case 'driver_en_route':
        return { label: 'I Have Arrived', icon: <MapPin size={18} />, action: () => sendStatusUpdate(DRIVER_STATUS.ARRIVED), color: 'btn-accent' };
      case 'driver_arrived':
        return { label: 'Verify OTP', icon: <CheckSquare size={18} />, action: () => setShowOtpModal(true), color: 'btn-warning' };
      case 'otp_verified':
        return { label: 'Start Ride', icon: <Play size={18} />, action: () => sendStatusUpdate(DRIVER_STATUS.RIDE_STARTED), color: 'btn-success' };
      case 'in_progress':
        return { label: 'Complete Ride', icon: <Square size={18} />, action: () => sendStatusUpdate(DRIVER_STATUS.COMPLETED), color: 'btn-primary' };
      case 'at_stop':
        return { label: 'Resume Ride', icon: <Play size={18} />, action: () => sendStatusUpdate('stop_departed'), color: 'btn-accent' };
      default:
        return null;
    }
  }, [rideStatus, sendStatusUpdate, DRIVER_STATUS]);

  const currentStep = navSteps[currentStepIndex] || null;
  const etaMinutes = etaUpdate?.etaMinutes ?? socketLive?.etaMinutes ?? rd?.currentEtaMinutes;
  const remainingKm = etaUpdate?.distanceRemainingKm;

  if (isLoadingRide || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted) return <RideCompletedScreen ride={rd} />;

  return (
    <div className="fixed inset-0 overflow-hidden" data-theme="driver">

      {/* ── MAP ─────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={currentPosition || pickupCoords || { lat: 16.506, lng: 80.648 }}
          zoom={15}
          options={{
            mapId: MAP_ID,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
            mapTypeId: 'roadmap',
            tilt: mapTilt,
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
                  strokeColor: '#6366f1',
                  strokeWeight: 6,
                  strokeOpacity: 0.9,
                },
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* ── OFFLINE BANNER ────────────────────────────────── */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-50 bg-error text-error-content text-center py-2 text-xs font-bold flex items-center justify-center gap-2"
          >
            <WifiOff size={12} />
            No internet connection — navigation paused
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP HEADER ─────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-safe-top">
        <div className="mx-3 mt-3 space-y-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-base-100/95 border border-base-300/60 shadow-xl"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-success animate-pulse' : 'bg-error'}`} />

            {rideStatus && (() => {
              const cfg = STATUS_CONFIG[rideStatus] || {};
              return (
                <span className={`badge badge-sm ${cfg.bg} ${cfg.color} border ${cfg.border} flex-shrink-0`}>
                  {cfg.label}
                </span>
              );
            })()}

            {etaMinutes != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock size={12} className="text-base-content/50" />
                <span className="text-xs font-bold text-base-content">{formatEta(etaMinutes)}</span>
              </div>
            )}

            {remainingKm != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Navigation size={12} className="text-primary" />
                <span className="text-xs font-semibold text-base-content">{formatDistance(remainingKm)}</span>
              </div>
            )}

            {currentPosition?.speed > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Zap size={12} className="text-warning" />
                <span className="text-xs font-semibold text-base-content">{formatSpeed(currentPosition.speed)} km/h</span>
              </div>
            )}

            {currentPosition?.accuracy && (
              <span className="text-xs ml-auto flex-shrink-0 text-base-content/40">
                ±{Math.round(currentPosition.accuracy)}m
              </span>
            )}
          </motion.div>

          <AnimatePresence mode="wait">
            {currentStep && (
              <NavInstructionCard key={currentStepIndex} step={currentStep} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isRerouting && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-warning/20 border border-warning/40 rounded-xl px-3 py-2"
              >
                <RotateCcw size={14} className="text-warning animate-spin" />
                <span className="text-warning text-xs font-semibold">Recalculating route...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── GPS ERROR ──────────────────────────────────────── */}
      <AnimatePresence>
        {gpsError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-32 left-1/2 -translate-x-1/2 z-40 bg-error/20 border border-error/40 rounded-xl px-4 py-2 flex items-center gap-2"
          >
            <MapPinOff size={14} className="text-error" />
            <span className="text-error text-xs font-semibold">{gpsError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT FABs (recenter + compass) ─────────────────── */}
      <div className="absolute top-36 left-3 z-20 flex flex-col gap-2">
        {/* Recenter — LEFT side */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleRecenter}
          className={`
            w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg
            border backdrop-blur-sm
            ${followMode
              ? 'bg-primary text-white border-primary'
              : 'bg-base-100/95 text-base-content border-base-300'}
          `}
        >
          <Maximize2 size={16} />
        </motion.button>

        {/* Compass / north-up */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.moveCamera({ heading: 0, tilt: 0 });
              setFollowMode(false);
            }
          }}
          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg border backdrop-blur-sm bg-base-100/95 text-base-content border-base-300"
        >
          <Compass size={16} />
        </motion.button>
      </div>

      {/* ── RIGHT FABs (voice + SOS) ────────────────────────── */}
      <div className="absolute top-36 right-3 z-20 flex flex-col gap-2">
        {/* Voice toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleVoice}
          className={`
            w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg border backdrop-blur-sm
            ${voiceEnabled
              ? 'bg-success/20 text-success border-success/40'
              : 'bg-base-100/95 text-base-content/40 border-base-300'}
          `}
        >
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </motion.button>

        {/* SOS */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setSosActive(true);
            triggerSosAlert('safety');
            setTimeout(() => setSosActive(false), 5000);
          }}
          className={`
            w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg border
            ${sosActive
              ? 'bg-error text-white border-error animate-pulse'
              : 'bg-error/20 text-error border-error/40'}
          `}
        >
          {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
        </motion.button>
      </div>

      {/* ── ACTION BUTTON ──────────────────────────────────── */}
      <AnimatePresence>
        {actionButton && rideStatus !== 'completed' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-24 left-4 right-4 z-30"
          >
            <button
              onClick={actionButton.action}
              className={`btn ${actionButton.color} w-full rounded-2xl py-4 font-bold text-base shadow-xl flex items-center justify-center gap-2`}
            >
              {actionButton.icon}
              {actionButton.label}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM SHEET ───────────────────────────────────── */}
      <BottomSheet
        ride={tracking}
        booking={bk}
        open={sheetOpen}
        onToggle={() => setSheetOpen(p => !p)}
      />

      {/* ── OTP MODAL ──────────────────────────────────────── */}
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

      {/* ── PULSE CSS ──────────────────────────────────────── */}
      <style jsx>{`
        @keyframes markerPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50%       { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50%       { opacity: 0.4; transform: translateX(-50%) scale(2); }
        }
      `}</style>
    </div>
  );
}