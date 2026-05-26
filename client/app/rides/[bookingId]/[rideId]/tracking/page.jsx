'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }    from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence }  from 'framer-motion';
import {
  GoogleMap, DirectionsRenderer,
} from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/GoogleMapsProvider';
import {
  Phone, User, Navigation, Clock, Shield,
  ShieldAlert, WifiOff, ChevronDown, ChevronLeft,
  CheckCircle, Loader2, X, Star, Car, RefreshCw,
  AlertTriangle, Zap, Copy, Check, ArrowUpRight,
  Maximize2, Minimize2, Plus, Minus,
} from 'lucide-react';

// Redux
import {
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

import {
  fetchMyBookingById,
  selectSelectedBooking,
} from '@/store/slices/bookingSlice';

import {
  useSocket,
  useBookingRoom,
  useSos,
} from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID  = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const POLL_MS = 5000;

// 3-D car image — rotates with heading
const CAR_IMG_URL = 'https://ik.imagekit.io/zxxzgk3iq/car.png?updatedAt=1779446267383';

const STATUS_CONFIG = {
  searching:       { label: 'Finding Driver',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.30)',  icon: '🔍' },
  driver_assigned: { label: 'Driver Assigned',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.30)',  icon: '👤' },
  driver_accepted: { label: 'Driver On Way',    color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.30)',   icon: '🚗' },
  driver_en_route: { label: 'Driver En Route',  color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.30)',   icon: '🚗' },
  driver_arrived:  { label: 'Driver Arrived!',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.40)',  icon: '📍' },
  otp_verified:    { label: 'Starting Ride',    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)',  icon: '✅' },
  in_progress:     { label: 'Ride In Progress', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.30)',   icon: '🏥' },
  at_stop:         { label: 'Stopped',          color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.30)',  icon: '⏸️' },
  completed:       { label: 'Ride Completed',   color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.30)', icon: '🎉' },
  cancelled:       { label: 'Ride Cancelled',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.30)',   icon: '❌' },
};

const TIMELINE_STEPS = [
  { key: 'searching',       label: 'Booking Confirmed' },
  { key: 'driver_assigned', label: 'Driver Assigned'   },
  { key: 'driver_en_route', label: 'Driver En Route'   },
  { key: 'driver_arrived',  label: 'Driver Arrived'    },
  { key: 'in_progress',     label: 'Ride Started'      },
  { key: 'completed',       label: 'Completed'         },
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

/**
 * 3-D car image marker.
 * Shadow ellipse beneath, pulse ring, car image rotates with heading.
 * The car PNG faces "up" (north = 0°), so we rotate by heading degrees.
 */
const createDriverMarkerHtml = (heading = 0) => `
  <div style="position:absolute;width:0;height:0;pointer-events:none;">
    <div style="position:absolute;width:72px;height:72px;left:-36px;top:-36px;display:flex;align-items:center;justify-content:center;">

      <!-- outer pulse ring -->
      <div style="
        position:absolute;width:68px;height:68px;border-radius:50%;
        background:radial-gradient(circle,rgba(34,197,94,0.18) 0%,rgba(34,197,94,0) 70%);
        animation:driverPulse 2.2s infinite ease-out;
        pointer-events:none;
      "></div>

      <!-- soft shadow ellipse -->
      <div style="
        position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:44px;height:10px;border-radius:50%;
        background:rgba(0,0,0,0.22);filter:blur(4px);
        pointer-events:none;
      "></div>

      <!-- car image — rotates with heading -->
      <img
        id="driverCarImg"
        src="${CAR_IMG_URL}"
        alt="driver"
        style="
          position:relative;
          width:54px;height:54px;
          object-fit:contain;
          transform:rotate(${heading}deg);
          transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
          filter:drop-shadow(0 6px 12px rgba(0,0,0,0.45));
          z-index:2;
          pointer-events:none;
        "
      />
    </div>
  </div>
  <style>
    @keyframes driverPulse {
      0%   { transform:scale(0.85); opacity:0.9; }
      100% { transform:scale(2.2);  opacity:0; }
    }
  </style>
`;

const createPickupMarkerHtml = () => `
  <div style="position:absolute;left:-18px;top:-52px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(59,130,246,0.55);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #3b82f6;margin-top:-1px;"></div>
    <div style="background:#3b82f6;color:#fff;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.22);">You</div>
  </div>
`;

const createDestMarkerHtml = () => `
  <div style="position:absolute;left:-18px;top:-52px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(239,68,68,0.55);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="none" stroke="white" stroke-width="1.5"/></svg>
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #ef4444;margin-top:-1px;"></div>
    <div style="background:#ef4444;color:#fff;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.22);">Hospital</div>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// FAB BUTTON — shared style
// ─────────────────────────────────────────────────────────────────────────────

const FabBtn = memo(function FabBtn({ onClick, active, danger, children, title }) {
  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      onClick={onClick}
      title={title}
      className={[
        'w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border',
        'shadow-[0_4px_20px_rgba(0,0,0,0.38)] transition-colors',
        danger
          ? (active ? 'bg-error border-error text-error-content animate-pulse' : 'bg-error/10 border-error/30 text-error')
          : (active ? 'bg-primary text-primary-content border-primary' : 'bg-base-200/90 text-base-content/60 border-base-300 hover:text-base-content'),
      ].join(' ')}
    >
      {children}
    </motion.button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// OTP DISPLAY MODAL
// ─────────────────────────────────────────────────────────────────────────────

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
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.80, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.80, opacity: 0, y: 50 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-full max-w-sm rounded-3xl p-7 bg-base-200 border border-base-300 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-black text-base-content m-0">Your Ride OTP</h3>
            <p className="text-xs text-base-content/50 mt-1 m-0">Show this to your driver</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-base-300 flex items-center justify-center text-base-content/50 hover:text-base-content transition-colors cursor-pointer border border-base-300">
            <X size={14} />
          </button>
        </div>

        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl mb-5 bg-warning/10 border border-warning/30"
        >
          <AlertTriangle size={13} className="text-warning flex-shrink-0" />
          <p className="text-xs font-semibold text-warning m-0">Driver will ask for this — do NOT share elsewhere</p>
        </motion.div>

        <div className="flex gap-3 justify-center mb-5">
          {digits.map((d, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 400 }}
              className="w-[58px] h-[66px] rounded-2xl flex items-center justify-center font-black text-3xl border-2"
              style={{ background: 'rgba(59,130,246,0.12)', borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              {d}
            </motion.div>
          ))}
        </div>

        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-base-300 text-sm font-semibold text-base-content/60 hover:text-base-content hover:border-primary/40 transition-all cursor-pointer bg-transparent"
        >
          {copied ? <><Check size={14} className="text-success" /> Copied!</> : <><Copy size={14} /> Copy OTP</>}
        </button>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CARD
// ─────────────────────────────────────────────────────────────────────────────

const DriverCard = memo(function DriverCard({ driverSnapshot, vehicleSnapshot }) {
  if (!driverSnapshot?.name && !driverSnapshot?.legalName) return null;
  const name    = driverSnapshot.legalName || driverSnapshot.name || 'Driver';
  const phone   = driverSnapshot.phone;
  const rating  = driverSnapshot.rating;
  const photo   = driverSnapshot.photoUrl;
  const vehicle = vehicleSnapshot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-base-300/60 border border-base-300"
    >
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.08))' }}>
        {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : <User size={20} className="text-success" />}
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
        {vehicle && (
          <div className="flex items-center gap-1 mt-0.5">
            <Car size={11} className="text-base-content/40 flex-shrink-0" />
            <p className="text-[11px] text-base-content/50 m-0 truncate">
              {[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' · ')}
              {vehicle.registrationNumber && ` · ${vehicle.registrationNumber}`}
            </p>
          </div>
        )}
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="w-10 h-10 rounded-xl flex items-center justify-center text-success bg-success/10 border border-success/25 no-underline flex-shrink-0 hover:bg-success/20 transition-colors">
          <Phone size={16} />
        </a>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

const RideTimeline = memo(function RideTimeline({ status }) {
  const activeIdx = getStepIdx(status || 'searching');
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between relative">
        <div className="absolute top-3 h-0.5 bg-base-300" style={{ left: '5%', right: '5%', zIndex: 0 }} />
        <motion.div
          className="absolute top-3 h-0.5 bg-primary"
          style={{ left: '5%', zIndex: 1 }}
          animate={{ width: `${(activeIdx / (TIMELINE_STEPS.length - 1)) * 90}%` }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
        {TIMELINE_STEPS.map((step, i) => {
          const done = i <= activeIdx, active = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <motion.div
                className="w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                animate={{ backgroundColor: done ? 'var(--primary)' : 'var(--base-200)', borderColor: done ? 'var(--primary)' : 'var(--base-300)', scale: active ? 1.25 : 1 }}
                transition={{ duration: 0.3 }}
              >
                {done && <Check size={10} color="white" strokeWidth={3} />}
              </motion.div>
              <p className="text-[9px] text-center leading-tight font-semibold" style={{ color: done ? 'var(--primary)' : 'var(--base-content)', opacity: done ? 1 : 0.4 }}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const BottomSheet = memo(function BottomSheet({
  open, onToggle, rideStatus, rideCode, booking, otp, onShowOtp,
  driverSnapshot, vehicleSnapshot, etaMinutes, distanceKm,
}) {
  const statusCfg  = STATUS_CONFIG[rideStatus] || STATUS_CONFIG.searching;
  const showOtpBtn = rideStatus === 'driver_arrived' || rideStatus === 'otp_verified';

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 80px)' }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl bg-base-200 border border-base-300 border-b-0 shadow-[0_-8px_40px_rgba(0,0,0,0.35)]"
      style={{ maxHeight: '80vh' }}
    >
      <button onClick={onToggle} className="w-full bg-transparent border-none cursor-pointer px-4 pt-3 pb-1 flex flex-col items-center">
        <div className="w-9 h-1 rounded-full bg-base-300 mb-3" />
        <div className="flex items-center justify-between w-full mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
            style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}>
            <span>{statusCfg.icon}</span>{statusCfg.label}
          </span>
          <div className="flex items-center gap-3">
            {etaMinutes != null && <div className="flex items-center gap-1"><Clock size={11} className="text-primary" /><span className="text-xs font-bold text-primary">{fmtEta(etaMinutes)}</span></div>}
            {distanceKm != null && <div className="flex items-center gap-1"><Navigation size={11} className="text-base-content/50" /><span className="text-xs font-semibold text-base-content/60">{fmtKm(distanceKm)}</span></div>}
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={15} className="text-base-content/40" />
            </motion.div>
          </div>
        </div>
      </button>

      <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(80vh - 80px)' }}>
        <AnimatePresence>
          {showOtpBtn && otp && (
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={onShowOtp}
              className="w-full flex items-center justify-between p-4 rounded-2xl mb-3 border-2 cursor-pointer"
              style={{ background: 'rgba(139,92,246,0.10)', borderColor: 'rgba(139,92,246,0.40)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <span className="text-xl">🔑</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black m-0" style={{ color: '#8b5cf6' }}>Show OTP to Driver</p>
                  <p className="text-[11px] m-0 mt-0.5" style={{ color: 'rgba(139,92,246,0.7)' }}>Tap to reveal your ride code</p>
                </div>
              </div>
              <ArrowUpRight size={18} style={{ color: '#8b5cf6' }} />
            </motion.button>
          )}
        </AnimatePresence>

        <DriverCard driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot} />

        {booking && (
          <div className="mt-3 p-3 rounded-2xl bg-base-300/60 border border-base-300">
            <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2">Booking</p>
            {[
              ['Code',       booking.bookingCode],
              ['Ride Code',  rideCode],
              ['Type',       booking.bookingType?.replace(/_/g, ' ')],
              ['Scheduled',  booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null],
              ['Payment',    booking.paymentStatus],
              ['Total Fare', booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount}` : null],
            ].map(([label, val]) => val ? (
              <div key={label} className="flex justify-between py-1.5 border-b border-base-300/60 last:border-b-0">
                <span className="text-[11px] text-base-content/40 font-semibold uppercase tracking-wide">{label}</span>
                <span className="text-xs text-base-content/70 font-semibold font-mono">{val}</span>
              </div>
            ) : null)}
          </div>
        )}

        {(booking?.patientLocation || booking?.destinationLocation) && (
          <div className="mt-3 p-3 rounded-2xl bg-base-300/60 border border-base-300">
            <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-3">Route</p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-base-100 flex-shrink-0" />
                <div className="w-0.5 h-8 bg-base-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100 flex-shrink-0" />
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold text-base-content m-0">{booking.patientLocation?.address || booking.patientLocation?.label || 'Pickup'}</p>
                  <p className="text-[10px] text-base-content/40 mt-0.5 m-0">Pickup</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-base-content m-0">{booking.destinationLocation?.address || booking.destinationLocation?.label || 'Hospital'}</p>
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
// COMPLETED / CANCELLED / LOADING / SEARCHING screens
// ─────────────────────────────────────────────────────────────────────────────

const CompletedScreen = memo(function CompletedScreen({ booking, onBack, onRate }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6 font-poppins">
      <div className="relative mb-8">
        {[72, 52, 36].map((sz, i) => (
          <motion.div key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.15 }}
            transition={{ delay: i * 0.12, type: 'spring', stiffness: 200 }}
            className="absolute rounded-full border-2 border-success"
            style={{ width: sz, height: sz, top: `${(72 - sz) / 2}px`, left: `${(72 - sz) / 2}px` }} />
        ))}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.18, type: 'spring', damping: 14 }}
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center bg-success/15 border-2 border-success/40">
          <CheckCircle size={38} className="text-success" />
        </motion.div>
      </div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2">Ride Completed!</motion.h2>
      <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}
        className="text-sm text-base-content/50 text-center m-0 mb-8">
        Hope you had a comfortable journey.
        {booking?.fareBreakdown?.totalAmount && <> Total fare: <span className="font-bold text-primary">₹{booking.fareBreakdown.totalAmount}</span></>}
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.50 }}
        className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onRate} className="btn btn-primary btn-lg rounded-2xl font-bold" style={{ fontFamily: 'inherit' }}>
          <Star size={16} /> Rate Your Experience
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onBack} className="btn btn-ghost btn-lg rounded-2xl font-semibold text-base-content/60" style={{ fontFamily: 'inherit' }}>
          Back to Bookings
        </motion.button>
      </motion.div>
    </motion.div>
  );
});

const CancelledScreen = memo(function CancelledScreen({ onBack }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6 font-poppins">
      <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center bg-error/10 border-2 border-error/30 mb-6">
        <X size={36} className="text-error" />
      </div>
      <h2 className="text-2xl font-black text-base-content text-center m-0 mb-2">Ride Cancelled</h2>
      <p className="text-sm text-base-content/50 text-center m-0 mb-8">Your ride was cancelled. Please book again or contact support.</p>
      <button onClick={onBack} className="btn btn-primary btn-lg rounded-2xl px-8 font-bold" style={{ fontFamily: 'inherit' }}>Back to Bookings</button>
    </motion.div>
  );
});

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-4 font-poppins">
      <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.8 }}
        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 size={28} className="text-primary animate-spin" />
      </motion.div>
      <p className="text-sm text-base-content/50 font-semibold">Loading your ride...</p>
    </div>
  );
});

const SearchingScreen = memo(function SearchingScreen({ bookingCode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-base-100 px-6">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
        className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary mb-6" />
      <h3 className="text-xl font-black text-base-content m-0 mb-2 text-center">Finding Your Driver</h3>
      <p className="text-sm text-base-content/50 text-center m-0 mb-1">We're matching you with the best available driver.</p>
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
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const bookingId = params?.bookingId || null;
  const rideId    = params?.rideId    || null;

  // ── Redux ────────────────────────────────────────────────────
  const currentRide  = useSelector(selectCurrentRide);
  const socketLive   = useSelector(selectSocketLive);
  const liveData     = useSelector(selectLiveData);
  const booking      = useSelector(selectSelectedBooking);

  // ── Socket ───────────────────────────────────────────────────
  const { on, connected, SOCKET_EVENTS: EV } = useSocket();
  const { locationUpdate, etaUpdate: etaEvt } = useBookingRoom(bookingId);

  const activeRideId = rideId || currentRide?._id || liveData?.rideId;
  const { trigger: triggerSos, sosActive, dismiss: dismissSos } = useSos(bookingId, activeRideId);

  // ── Refs ─────────────────────────────────────────────────────
  const mapRef            = useRef(null);
  const mapContainerRef   = useRef(null);
  const dirServiceRef     = useRef(null);
  const driverMarkerRef   = useRef(null);
  const pickupMarkerRef   = useRef(null);
  const destMarkerRef     = useRef(null);
  const staticMarkersInit = useRef(false);
  const driverPosRef      = useRef(null);
  const driverTargetRef   = useRef(null);
  const animFrameRef      = useRef(null);
  const pollTimerRef      = useRef(null);
  const smoothHeadRef     = useRef(0);
  const otpRef            = useRef(null);
  const lastRouteCalcRef  = useRef(null);

  // ── State ────────────────────────────────────────────────────
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
  const [headingDeg,    setHeadingDeg]    = useState(0);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [mapZoom,       setMapZoom]       = useState(15);

  const { isLoaded } = useGoogleMaps();

  // ── Derived ──────────────────────────────────────────────────
  const rd = currentRide || liveData;

  const driverSnapshot  = useMemo(() => socketLive?.driverSnapshot  || rd?.driverSnapshot,  [socketLive, rd]);
  const vehicleSnapshot = useMemo(() => socketLive?.vehicleSnapshot || rd?.vehicleSnapshot, [socketLive, rd]);

  const pickupCoords = useMemo(() => {
    const c = rd?.pickup?.coordinates || booking?.patientLocation?.coordinates;
    if (!c || c.length < 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [rd, booking]);

  const dropoffCoords = useMemo(() => {
    const c = rd?.dropoff?.coordinates || booking?.destinationLocation?.coordinates;
    if (!c || c.length < 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [rd, booking]);

  const activeStatus = rideStatus || socketLive?.status || rd?.status || 'searching';
  const isSearching  = ['searching', 'requested'].includes(activeStatus);
  const isPostOtp    = ['otp_verified', 'in_progress', 'at_stop'].includes(activeStatus);

  // ── Route helpers — declared BEFORE effects ───────────────────

  const routeOnce = useCallback(async (origin, destination) => {
    if (!dirServiceRef.current || !origin || !destination) return null;
    try {
      const result = await dirServiceRef.current.route({
        origin, destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      return result.status === 'OK' ? result : null;
    } catch { return null; }
  }, []);

  const calcBothRoutes = useCallback(async (driverPosition) => {
    if (!mapLoaded || !pickupCoords || !dropoffCoords) return;
    const origin = driverPosition || driverPosRef.current;
    const ovr = await routeOnce(pickupCoords, dropoffCoords);
    if (ovr) setOverviewRoute(ovr);
    if (origin) {
      const dest = isPostOtp ? dropoffCoords : pickupCoords;
      if (dest) { const dr = await routeOnce(origin, dest); if (dr) setDriverRoute(dr); }
    }
  }, [mapLoaded, pickupCoords, dropoffCoords, isPostOtp, routeOnce]);

  // ── Effects ───────────────────────────────────────────────────

  // Sync initial driver position
  useEffect(() => {
    const loc = socketLive?.liveLocation || liveData?.liveLocation;
    let lat = null, lng = null;
    if (loc?.lat && loc?.lng) { lat = loc.lat; lng = loc.lng; }
    else if (currentRide?.liveLocation?.coordinates?.length === 2) {
      lng = currentRide.liveLocation.coordinates[0];
      lat = currentRide.liveLocation.coordinates[1];
    }
    if (lat && lng && !driverTargetRef.current) {
      const pos = { lat, lng };
      driverTargetRef.current = pos;
      driverPosRef.current    = pos;
      setDriverPos(pos);
      const h = loc?.heading || 0;
      setHeadingDeg(h);
      smoothHeadRef.current = h;
    }
  }, [socketLive?.liveLocation, liveData?.liveLocation, currentRide?.liveLocation]);

  // Initial data fetch
  useEffect(() => {
    const load = async () => {
      setIsInitLoading(true);
      try {
        const tasks = [];
        if (rideId)    { tasks.push(dispatch(fetchRideTracking({ rideId }))); tasks.push(dispatch(fetchRideLive(rideId))); }
        if (bookingId) { tasks.push(dispatch(fetchMyBookingById({ bookingId }))); }
        await Promise.all(tasks);
      } catch (e) { console.error('[CustomerTracking] init fetch:', e); }
      finally { setIsInitLoading(false); }
    };
    load();
  }, [rideId, bookingId]); // eslint-disable-line

  // Sync rideStatus from redux
  useEffect(() => {
    const s = socketLive?.status || rd?.status;
    if (s) setRideStatus(s);
  }, [socketLive?.status, rd?.status]);

  // Sync ETA
  useEffect(() => {
    const eta = etaEvt?.etaMinutes ?? socketLive?.etaMinutes ?? liveData?.currentEtaMinutes;
    if (eta != null) setEtaMinutes(eta);
    const km = etaEvt?.distanceRemainingKm;
    if (km != null) setRemainingKm(km);
  }, [etaEvt, socketLive?.etaMinutes, liveData?.currentEtaMinutes]);

  // Socket: status events
  useEffect(() => {
    const unsubs = [
      on(EV.RIDE_STATUS_CHANGED, (d) => {
        dispatch(socketRideStatusChanged(d));
        setRideStatus(d.status);
        if (d.activeNavigationTarget) dispatch(socketNavigationTargetChanged({ currentTarget: d.activeNavigationTarget, bookingId: d.bookingId, rideId: d.rideId }));
      }),
      on('driver_accepted',            (d) => { dispatch(socketDriverAccepted(d));  setRideStatus('driver_accepted'); }),
      on('driver_en_route',            (d) => { dispatch(socketDriverEnRoute(d));   setRideStatus('driver_en_route'); }),
      on('driver_arrived',             (d) => { dispatch(socketDriverArrived(d));   setRideStatus('driver_arrived'); setSheetOpen(true); }),
      on('otp_verified',               (d) => { dispatch(socketOtpVerified(d));     setRideStatus('otp_verified');   setShowOtpModal(false); }),
      on('ride_started',               (d) => { dispatch(socketRideStarted(d));     setRideStatus('in_progress'); }),
      on('ride_completed',             (d) => { dispatch(socketRideCompleted(d));   setRideStatus('completed'); }),
      on('ride_cancelled',             (d) => { dispatch(socketRideCancelled(d));   setRideStatus('cancelled'); }),
      on('ride_assigned',              (d) => { dispatch(socketRideAssigned(d));    setRideStatus(d.status); }),
      on(EV.NAVIGATION_TARGET_CHANGED, (d) => { dispatch(socketNavigationTargetChanged(d)); }),
      on('otp_required', (d) => {
        if (d.otp) { setOtp(String(d.otp)); otpRef.current = String(d.otp); }
        setRideStatus('driver_arrived');
        setSheetOpen(true);
      }),
    ];
    return () => unsubs.forEach(fn => fn?.());
  }, []); // eslint-disable-line

  // Socket: location update
  useEffect(() => {
    if (!locationUpdate) return;
    dispatch(socketLocationUpdate(locationUpdate));
    const { lat, lng, heading = 0 } = locationUpdate;
    driverTargetRef.current = { lat, lng };
    smoothHeadRef.current   = smoothHeadRef.current * 0.75 + heading * 0.25;
    setHeadingDeg(smoothHeadRef.current);
  }, [locationUpdate, dispatch]);

  // ETA from booking room
  useEffect(() => {
    if (!etaEvt) return;
    dispatch(socketEtaUpdate(etaEvt));
    if (etaEvt.etaMinutes          != null) setEtaMinutes(etaEvt.etaMinutes);
    if (etaEvt.distanceRemainingKm != null) setRemainingKm(etaEvt.distanceRemainingKm);
  }, [etaEvt, dispatch]);

  // Completed / cancelled
  useEffect(() => {
    if (activeStatus === 'completed') { const t = setTimeout(() => setShowCompleted(true), 2200); return () => clearTimeout(t); }
    if (activeStatus === 'cancelled') { const t = setTimeout(() => setShowCancelled(true), 1200); return () => clearTimeout(t); }
  }, [activeStatus]);

  // Polling fallback
  useEffect(() => {
    if (connected) { if (pollTimerRef.current) clearInterval(pollTimerRef.current); return; }
    if (!activeRideId) return;
    pollTimerRef.current = setInterval(() => dispatch(fetchRideLive(activeRideId)), POLL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [connected, activeRideId, dispatch]);

  // Smooth driver animation
  useEffect(() => {
    const animate = () => {
      const target = driverTargetRef.current;
      if (!target) { animFrameRef.current = requestAnimationFrame(animate); return; }
      const cur    = driverPosRef.current || { ...target };
      const newLat = lerp(cur.lat, target.lat, 0.12);
      const newLng = lerp(cur.lng, target.lng, 0.12);
      driverPosRef.current = { lat: newLat, lng: newLng };
      setDriverPos({ lat: newLat, lng: newLng });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // Recalc route on position update (throttled 30 s)
  useEffect(() => {
    if (!mapLoaded || !driverPos) return;
    const now = Date.now();
    if (lastRouteCalcRef.current && now - lastRouteCalcRef.current < 30_000) return;
    lastRouteCalcRef.current = now;
    calcBothRoutes(driverPos);
  }, [driverPos, mapLoaded, calcBothRoutes]);

  // Recalc on map load or phase change
  useEffect(() => {
    if (!mapLoaded || !pickupCoords || !dropoffCoords) return;
    lastRouteCalcRef.current = null;
    calcBothRoutes(driverPosRef.current || pickupCoords);
  }, [mapLoaded, isPostOtp, pickupCoords, dropoffCoords, calcBothRoutes]);

  // Update driver AdvancedMarker — 3D car image + heading rotation
  useEffect(() => {
    if (!mapLoaded || !driverPos) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!driverMarkerRef.current) {
      // Create marker with car image
      const el = document.createElement('div');
      el.style.position = 'relative';
      el.style.width    = '0';
      el.style.height   = '0';
      el.innerHTML      = createDriverMarkerHtml(headingDeg);
      driverMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: driverPos, zIndex: 10,
      });
    } else {
      // Update position
      driverMarkerRef.current.position = driverPos;
      // Update heading — rotate the <img> element directly for silky animation
      const img = driverMarkerRef.current.content?.querySelector('#driverCarImg');
      if (img) img.style.transform = `rotate(${headingDeg}deg)`;
    }

    if (followDriver && mapRef.current) mapRef.current.panTo(driverPos);
  }, [driverPos, mapLoaded, headingDeg, followDriver]);

  // Static markers
  useEffect(() => {
    if (!mapLoaded || staticMarkersInit.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;
    let created = false;
    if (pickupCoords && !pickupMarkerRef.current) {
      const el = document.createElement('div');
      el.style.position = 'relative'; el.style.width = '0'; el.style.height = '0';
      el.innerHTML = createPickupMarkerHtml();
      pickupMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: pickupCoords, zIndex: 5 });
      created = true;
    }
    if (dropoffCoords && !destMarkerRef.current) {
      const el = document.createElement('div');
      el.style.position = 'relative'; el.style.width = '0'; el.style.height = '0';
      el.innerHTML = createDestMarkerHtml();
      destMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: dropoffCoords, zIndex: 5 });
      created = true;
    }
    if (created) staticMarkersInit.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords]);

  // Fit bounds on first map load
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (!pickupCoords && !dropoffCoords) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (pickupCoords)  bounds.extend(pickupCoords);
    if (dropoffCoords) bounds.extend(dropoffCoords);
    if (driverPos)     bounds.extend(driverPos);
    mapRef.current.fitBounds(bounds, { top: 80, bottom: 200, left: 40, right: 40 });
  }, [mapLoaded]); // eslint-disable-line

  // Fullscreen API listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      [driverMarkerRef, pickupMarkerRef, destMarkerRef].forEach(ref => {
        if (ref.current) { ref.current.map = null; ref.current = null; }
      });
      staticMarkersInit.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────

  const onMapLoad = useCallback((map) => {
    mapRef.current        = map;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    setMapLoaded(true);
    setMapZoom(map.getZoom());
    map.addListener('zoom_changed', () => setMapZoom(map.getZoom()));
  }, []);

  const handleBack = useCallback(() => {
    if (window.history?.length > 1) router.back();
    else router.push('/bookings');
  }, [router]);

  const handleRate = useCallback(() => {
    if (bookingId) router.push(`/bookings/${bookingId}/rate`);
    else router.push('/bookings');
  }, [router, bookingId]);

  const handleRecenter = useCallback(() => {
    setFollowDriver(true);
    if (driverPos && mapRef.current) { mapRef.current.panTo(driverPos); mapRef.current.setZoom(16); }
    else if (pickupCoords && mapRef.current) mapRef.current.panTo(pickupCoords);
  }, [driverPos, pickupCoords]);

  const handleZoomIn = useCallback(() => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    mapRef.current.setZoom(Math.min(z + 1, 21));
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom();
    mapRef.current.setZoom(Math.max(z - 1, 3));
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = mapContainerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleSos = useCallback(() => {
    if (sosActive) { dismissSos(); return; }
    triggerSos({ sosType: 'safety' });
  }, [sosActive, triggerSos, dismissSos]);

  // ── Render guards ─────────────────────────────────────────────
  if (isInitLoading || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted) return <CompletedScreen booking={booking} onBack={handleBack} onRate={handleRate} />;
  if (showCancelled) return <CancelledScreen onBack={handleBack} />;

  const statusCfg = STATUS_CONFIG[activeStatus] || STATUS_CONFIG.searching;

  // ── Main render ───────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes driverPulse {
          0%   { transform:scale(0.85); opacity:0.9; }
          100% { transform:scale(2.2);  opacity:0; }
        }
      `}</style>

      <div ref={mapContainerRef} className="fixed inset-0 overflow-hidden font-poppins">

        {/* ── MAP ──────────────────────────────────── */}
        <div className="absolute inset-0">
          {isSearching ? (
            <SearchingScreen bookingCode={booking?.bookingCode} />
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={driverPos || pickupCoords || { lat: 16.506, lng: 80.648 }}
              zoom={15}
              options={{
                mapId:            MAP_ID,
                disableDefaultUI: true,
                clickableIcons:   false,
                gestureHandling:  'greedy',
                mapTypeId:        'roadmap',
              }}
              onLoad={onMapLoad}
              onDragStart={() => setFollowDriver(false)}
            >
              {/* Overview route: pickup → dropoff */}
              {overviewRoute && (
                <DirectionsRenderer
                  directions={overviewRoute}
                  options={{
                    suppressMarkers: true,
                    polylineOptions: {
                      strokeColor:   isPostOtp ? 'rgba(34,197,94,0.30)' : 'rgba(6,182,212,0.28)',
                      strokeWeight:  4,
                      strokeOpacity: 1,
                      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }],
                    },
                  }}
                />
              )}

              {/* Driver route */}
              {driverRoute && (
                <DirectionsRenderer
                  directions={driverRoute}
                  options={{
                    suppressMarkers: true,
                    polylineOptions: isPostOtp
                      ? { strokeColor: '#22c55e', strokeWeight: 6, strokeOpacity: 0.92 }
                      : {
                          strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 1,
                          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 }, offset: '0', repeat: '12px' }],
                        },
                  }}
                />
              )}
            </GoogleMap>
          )}
        </div>

        {/* ── OFFLINE BANNER ────────────────────── */}
        <AnimatePresence>
          {!connected && !isSearching && (
            <motion.div
              initial={{ y: -48 }} animate={{ y: 0 }} exit={{ y: -48 }}
              className="absolute top-0 left-0 right-0 z-[50] flex items-center justify-center gap-2 py-2.5 text-xs font-bold bg-warning/95 text-warning-content"
            >
              <WifiOff size={13} />
              Reconnecting — tracking may be delayed
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ───────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-1">
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-base-200/96 border-b border-base-300"
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleBack}
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center cursor-pointer text-base-content/60 bg-base-300 border border-base-300 hover:text-base-content transition-colors">
              <ChevronLeft size={18} />
            </motion.button>

            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: connected ? 'var(--success)' : 'var(--warning)', boxShadow: connected ? '0 0 6px var(--success)' : 'none' }} />

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border flex-shrink-0"
              style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}>
              {statusCfg.icon} {statusCfg.label}
            </span>

            {etaMinutes != null && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
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
            {activeStatus === 'driver_arrived' && (
              <motion.button
                initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                onClick={() => setShowOtpModal(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer border-b border-purple-500/30"
                style={{ background: 'rgba(139,92,246,0.18)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-2">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-base">📍</motion.div>
                  <span className="text-xs font-bold text-purple-300">Driver has arrived at your location!</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-purple-400">Show OTP</span>
                  <ArrowUpRight size={12} className="text-purple-400" />
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIDE IN PROGRESS BANNER ────────────── */}
        <AnimatePresence>
          {activeStatus === 'in_progress' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute top-[52px] left-3 right-3 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-success/30 text-xs font-bold text-success"
              style={{ background: 'rgba(34,197,94,0.10)', backdropFilter: 'blur(12px)' }}
            >
              <Zap size={12} />
              Ride in progress — heading to hospital
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FABs (right column) ────────────────── */}
        <div className="absolute top-[110px] right-3 z-20 flex flex-col gap-2">

          {/* Recenter */}
          <FabBtn onClick={handleRecenter} active={followDriver} title="Recenter on driver">
            <Navigation size={16} />
          </FabBtn>

          {/* Zoom in */}
          <FabBtn onClick={handleZoomIn} title="Zoom in">
            <Plus size={17} strokeWidth={2.5} />
          </FabBtn>

          {/* Zoom out */}
          <FabBtn onClick={handleZoomOut} title="Zoom out">
            <Minus size={17} strokeWidth={2.5} />
          </FabBtn>

          {/* Fullscreen */}
          <FabBtn onClick={handleFullscreen} active={isFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </FabBtn>

          {/* SOS */}
          <FabBtn onClick={handleSos} danger active={sosActive} title="SOS">
            {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
          </FabBtn>

          {/* Refresh (offline only) */}
          {!connected && (
            <FabBtn onClick={() => { if (activeRideId) dispatch(fetchRideLive(activeRideId)); }} title="Refresh">
              <RefreshCw size={15} />
            </FabBtn>
          )}
        </div>

        {/* ── ZOOM LEVEL INDICATOR ──────────────── */}
        {mapLoaded && !isSearching && (
          <div className="absolute bottom-[88px] left-3 z-20">
            <div className="px-2.5 py-1 rounded-xl bg-base-200/80 border border-base-300 text-[10px] font-bold text-base-content/40 font-mono backdrop-blur-sm">
              z{mapZoom}
            </div>
          </div>
        )}

        {/* ── BOTTOM SHEET ──────────────────────── */}
        <BottomSheet
          open={sheetOpen}
          onToggle={() => setSheetOpen(p => !p)}
          rideStatus={activeStatus}
          rideCode={rd?.rideCode}
          booking={booking}
          otp={otp}
          onShowOtp={() => setShowOtpModal(true)}
          driverSnapshot={driverSnapshot}
          vehicleSnapshot={vehicleSnapshot}
          etaMinutes={etaMinutes}
          distanceKm={remainingKm}
        />

        {/* ── OTP MODAL ─────────────────────────── */}
        <AnimatePresence>
          {showOtpModal && otp && <OtpDisplay otp={otp} onClose={() => setShowOtpModal(false)} />}
        </AnimatePresence>

        {/* ── SOS ACTIVE BANNER ─────────────────── */}
        <AnimatePresence>
          {sosActive && (
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-[88px] left-4 right-4 z-40 flex items-center gap-3 p-4 rounded-2xl bg-error border border-error/70 shadow-[0_8px_32px_rgba(239,68,68,0.55)]"
            >
              <ShieldAlert size={20} className="text-error-content flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-error-content m-0">SOS Alert Sent!</p>
                <p className="text-xs text-error-content/80 m-0">Help is on the way. Stay calm.</p>
              </div>
              <button onClick={dismissSos} className="text-error-content/70 hover:text-error-content transition-colors cursor-pointer bg-transparent border-none">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </>
  );
}