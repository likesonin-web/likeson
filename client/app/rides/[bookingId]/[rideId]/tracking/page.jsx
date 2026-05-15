'use client';

/**
 * RideLiveTracking.jsx — Likeson.in
 * Customer / Patient LIVE ride tracking page.
 *
 * Route params: { rideId, bookingId }
 *
 * Stack: Next.js App Router · React · Tailwind CSS · Framer Motion
 *        · Lucide React · Redux Toolkit · Socket.IO · @react-google-maps/api
 *
 * Socket events listened:
 *   location_update · eta_update · navigation_target_changed
 *   ride_status_changed · booking_status_change · booking_state_snapshot
 *   sos_alert · booking_status_change · driver_arrived · otp_required
 *   ride_completed · ride_cancelled · driver_en_route · driver_accepted
 *
 * APIs used:
 *   GET /ride-requests/:rideId/tracking
 *   GET /ride-requests/:rideId/live
 *
 * Redux:
 *   operationsSlice · rideRequestSlice
 *
 * DOES NOT: invent statuses, fake events, modify backend, create fake APIs.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  GoogleMap,
  useJsApiLoader,
  Polyline,
} from '@react-google-maps/api';
import {
  Phone, MessageCircle, Shield, ShieldAlert, Navigation,
  MapPin, ChevronUp, ChevronDown, Copy, Check, Wifi, WifiOff,
  Loader2, Star, Car, User, Clock, Route, AlertTriangle,
  Volume2, VolumeX, Share2, Crosshair, Moon, Sun, Info,
  CheckCircle2, Circle, ArrowRight, RefreshCw, X, Zap,
  HeartPulse, HelpCircle, ChevronRight
} from 'lucide-react';

import {
  fetchRideTracking,
  fetchRideLive,
  selectTrackingData,
  selectLiveData,
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketNavigationTargetChanged,
  socketDriverArrived,
  socketRideCompleted,
  socketRideCancelled,
  socketDriverEnRoute,
  socketDriverAccepted,
} from '@/store/slices/rideRequestSlice';

import {
  joinBookingRoom,
  leaveBookingRoom,
  setLiveLocation,
  setEtaUpdate,
  setNavigationTarget,
  setSosAlert,
  selectLiveLocation,
  selectNavigationTarget,
  selectSosAlert,
  selectSocketConnected,
} from '@/store/slices/operationsSlice';

import {
  useSocket,
  useBookingRoom,
  useSos,
  SOCKET_EVENTS,
} from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID           = process.env.NEXT_PUBLIC_MAP_ID           || '33a293614af186975a18525f';
const GOOGLE_MAPS_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY  || '';
const GOOGLE_MAPS_LIBS = ['geometry', 'marker'];

const RIDE_STATUS_LABELS = {
  driver_assigned: 'Driver Assigned',
  driver_accepted: 'Driver On The Way',
  driver_en_route: 'Driver En Route',
  driver_arrived:  'Driver Arrived',
  otp_verified:    'Starting Ride',
  in_progress:     'Ride In Progress',
  at_stop:         'At Stop',
  completed:       'Ride Completed',
  cancelled:       'Ride Cancelled',
};

const RIDE_STATUS_COLOR = {
  driver_assigned: 'info',
  driver_accepted: 'info',
  driver_en_route: 'warning',
  driver_arrived:  'accent',
  otp_verified:    'success',
  in_progress:     'success',
  at_stop:         'warning',
  completed:       'success',
  cancelled:       'error',
};

// status progression for milestone timeline
const STATUS_MILESTONES = [
  { key: 'driver_assigned', label: 'Driver Assigned', icon: Car },
  { key: 'driver_en_route', label: 'En Route',        icon: Navigation },
  { key: 'driver_arrived',  label: 'Arrived',         icon: MapPin },
  { key: 'otp_verified',    label: 'OTP Verified',    icon: CheckCircle2 },
  { key: 'in_progress',     label: 'Ride Started',    icon: Route },
  { key: 'completed',       label: 'Completed',       icon: CheckCircle2 },
];

const STATUS_ORDER = [
  'driver_assigned','driver_accepted','driver_en_route',
  'driver_arrived','otp_verified','in_progress','at_stop','completed',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function statusIndex(s) {
  const i = STATUS_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

function fmtEta(min) {
  if (!min && min !== 0) return '--';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDist(km) {
  if (!km && km !== 0) return '--';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function speak(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95; utt.pitch = 1; utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKER HELPERS (Advanced Markers via google.maps.marker namespace)
// ─────────────────────────────────────────────────────────────────────────────

function createDriverMarkerElement(heading = 0) {
  const el = document.createElement('div');
  el.style.cssText = `
    width:52px;height:52px;display:flex;align-items:center;
    justify-content:center;transform:rotate(${heading}deg);
    transition:transform 0.5s ease;
  `;
  el.innerHTML = `
    <div style="
      width:48px;height:48px;border-radius:50%;
      background:linear-gradient(135deg,#3b82f6,#1d4ed8);
      border:3px solid white;
      box-shadow:0 4px 20px rgba(59,130,246,0.6),0 0 0 6px rgba(59,130,246,0.15);
      display:flex;align-items:center;justify-content:center;
      position:relative;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
      <div style="
        position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:8px solid #1d4ed8;
      "></div>
    </div>
  `;
  return el;
}

function createPickupMarkerElement(reached = false) {
  const el = document.createElement('div');
  el.style.cssText = `width:56px;height:64px;position:relative;`;
  el.innerHTML = `
    <div style="
      width:52px;height:52px;border-radius:50%;
      background:${reached ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)'};
      border:3px solid white;
      box-shadow:0 4px 16px ${reached ? 'rgba(16,185,129,0.5)' : 'rgba(99,102,241,0.5)'};
      display:flex;align-items:center;justify-content:center;
      position:relative;
      ${!reached ? 'animation:markerPulse 2s infinite;' : ''}
    ">
      <span style="color:white;font-weight:900;font-size:20px;letter-spacing:-1px;">${reached ? '✓' : 'P'}</span>
    </div>
    <div style="
      position:absolute;bottom:0;left:50%;transform:translateX(-50%);
      width:0;height:0;
      border-left:7px solid transparent;
      border-right:7px solid transparent;
      border-top:10px solid ${reached ? '#059669' : '#4f46e5'};
    "></div>
    <style>
      @keyframes markerPulse {
        0%,100%{box-shadow:0 4px 16px rgba(99,102,241,0.5),0 0 0 0 rgba(99,102,241,0.4);}
        50%{box-shadow:0 4px 16px rgba(99,102,241,0.5),0 0 0 12px rgba(99,102,241,0);}
      }
    </style>
  `;
  return el;
}

function createDropoffMarkerElement() {
  const el = document.createElement('div');
  el.style.cssText = `width:56px;height:64px;position:relative;`;
  el.innerHTML = `
    <div style="
      width:52px;height:52px;border-radius:50%;
      background:linear-gradient(135deg,#f59e0b,#d97706);
      border:3px solid white;
      box-shadow:0 4px 16px rgba(245,158,11,0.5);
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="color:white;font-weight:900;font-size:20px;">D</span>
    </div>
    <div style="
      position:absolute;bottom:0;left:50%;transform:translateX(-50%);
      width:0;height:0;
      border-left:7px solid transparent;
      border-right:7px solid transparent;
      border-top:10px solid #d97706;
    "></div>
  `;
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Connection Banner
function ReconnectBanner({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-warning/90 backdrop-blur-sm py-2 text-sm font-semibold text-warning-content"
        >
          <WifiOff size={14} />
          <span>Reconnecting… live tracking paused</span>
          <Loader2 size={14} className="animate-spin" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// OTP Card
function OtpCard({ otp, rideId, bookingId }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-primary/10 p-5"
    >
      {/* pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-accent/40"
        animate={{ scale: [1, 1.03, 1], opacity: [0.6, 0.2, 0.6] }}
        transition={{ repeat: Infinity, duration: 2 }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <ShieldAlert size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-xs font-bold text-accent uppercase tracking-wider">Share OTP to start ride</p>
            <p className="text-xs text-base-content/50">Show this to your driver</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 my-4">
          {otp.toString().split('').map((digit, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="w-12 h-14 rounded-xl bg-base-100 border-2 border-accent/40 flex items-center justify-center text-2xl font-black text-accent shadow-sm"
            >
              {digit}
            </motion.div>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-accent/15 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy OTP'}
        </button>
      </div>
    </motion.div>
  );
}

// Ride Progress Timeline
function RideProgressTimeline({ currentStatus }) {
  const curIdx = statusIndex(currentStatus);

  return (
    <div className="space-y-3">
      {STATUS_MILESTONES.map((milestone, i) => {
        const mIdx   = statusIndex(milestone.key);
        const done   = mIdx <= curIdx;
        const active = milestone.key === currentStatus ||
          (currentStatus === 'driver_accepted' && milestone.key === 'driver_en_route' && i === 1);
        const Icon   = milestone.icon;

        return (
          <div key={milestone.key} className="flex items-center gap-3">
            <div className="relative flex flex-col items-center">
              <motion.div
                animate={active ? { scale: [1, 1.15, 1] } : {}}
                transition={{ repeat: active ? Infinity : 0, duration: 1.5 }}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${done
                    ? 'bg-success border-success text-success-content'
                    : active
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-base-300 border-base-300 text-base-content/30'
                  }
                `}
              >
                {done ? <Check size={14} /> : <Icon size={13} />}
              </motion.div>
              {i < STATUS_MILESTONES.length - 1 && (
                <div className={`w-0.5 h-5 mt-1 transition-colors duration-500 ${done ? 'bg-success' : 'bg-base-300'}`} />
              )}
            </div>
            <div className="flex-1 pb-5">
              <p className={`text-sm font-semibold ${done || active ? 'text-base-content' : 'text-base-content/40'}`}>
                {milestone.label}
              </p>
              {active && (
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-primary font-medium mt-0.5"
                >
                  In progress…
                </motion.p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Completion Screen
function CompletionScreen({ ride, tracking, onClose }) {
  const dist = tracking?.tracking?.summary?.totalDistanceKm ?? ride?.actualDistanceKm ?? 0;
  const dur  = tracking?.tracking?.summary?.totalDurationMin ?? ride?.actualDurationMin ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-base-100/95 backdrop-blur-md px-6"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="w-32 h-32 rounded-full bg-success/20 border-4 border-success flex items-center justify-center mb-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <CheckCircle2 size={56} className="text-success" />
        </motion.div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-black text-base-content mb-1"
      >
        Ride Completed!
      </motion.h2>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-base-content/60 text-sm mb-8"
      >
        Thank you for choosing Likeson Healthcare
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm grid grid-cols-2 gap-4 mb-8"
      >
        {[
          { label: 'Distance', value: fmtDist(dist), icon: Route },
          { label: 'Duration', value: fmtEta(dur),   icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-base-200 border border-base-300 p-4 text-center">
            <Icon size={20} className="text-primary mx-auto mb-2" />
            <p className="text-xl font-black text-base-content">{value}</p>
            <p className="text-xs text-base-content/50 font-medium">{label}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col gap-3 w-full max-w-sm"
      >
        <button className="btn btn-primary w-full flex items-center justify-center gap-2">
          <Star size={16} />
          Rate Your Experience
        </button>
        <button onClick={onClose} className="btn btn-ghost w-full text-base-content/60">
          View Booking Details
        </button>
      </motion.div>
    </motion.div>
  );
}

// Loading skeleton
function TrackingSkeleton() {
  return (
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-6 z-[100]">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
      >
        <HeartPulse size={28} className="text-primary" />
      </motion.div>
      <div className="text-center">
        <p className="font-bold text-base-content">Loading Live Tracking</p>
        <p className="text-sm text-base-content/50 mt-1">Connecting to your ride…</p>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ y: [-4, 4, -4] }}
            transition={{ delay: i * 0.2, repeat: Infinity, duration: 0.8 }}
          />
        ))}
      </div>
    </div>
  );
}

// Floating action button
function FloatBtn({ icon: Icon, onClick, title, variant = 'default', pulse = false }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={title}
      className={`
        relative w-11 h-11 rounded-full flex items-center justify-center
        backdrop-blur-md border shadow-lg transition-all
        ${variant === 'danger'
          ? 'bg-error/90 border-error/50 text-error-content hover:bg-error'
          : variant === 'active'
            ? 'bg-primary/90 border-primary/50 text-primary-content hover:bg-primary'
            : 'bg-base-100/90 border-base-300/60 text-base-content hover:bg-base-200'
        }
      `}
    >
      {pulse && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-error"
          animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      )}
      <Icon size={18} />
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_SNAPS = { collapsed: 120, half: 380, full: '92vh' };

function BottomSheet({ children, rideStatus }) {
  const [snap, setSnap]     = useState('half');
  const [activeTab, setTab] = useState('driver');

  const heightVal = snap === 'full' ? '92vh' : snap === 'half' ? '380px' : '120px';

  const tabs = [
    { id: 'driver',   label: 'Driver',   icon: User },
    { id: 'progress', label: 'Progress', icon: Route },
    { id: 'booking',  label: 'Booking',  icon: Info },
    { id: 'safety',   label: 'Safety',   icon: Shield },
  ];

  return (
    <motion.div
      animate={{ height: heightVal }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col"
      style={{ maxHeight: '92vh' }}
    >
      {/* glass panel */}
      <div className="flex-1 flex flex-col bg-base-100/95 backdrop-blur-xl rounded-t-3xl border-t border-base-300/60 shadow-2xl overflow-hidden">
        {/* drag handle row */}
        <div className="flex flex-col items-center pt-3 pb-1 px-4 flex-shrink-0">
          <button
            onClick={() => setSnap(s => s === 'full' ? 'half' : s === 'half' ? 'collapsed' : 'half')}
            className="w-10 h-1 rounded-full bg-base-300 mb-3"
          />
          {/* status pill */}
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`w-2 h-2 rounded-full ${
                ['in_progress', 'otp_verified', 'completed'].includes(rideStatus)
                  ? 'bg-success' : rideStatus === 'cancelled' ? 'bg-error' : 'bg-primary'
              }`}
            />
            <span className="text-sm font-bold text-base-content">
              {RIDE_STATUS_LABELS[rideStatus] || 'Tracking…'}
            </span>
            <button onClick={() => setSnap(s => s === 'full' ? 'half' : 'full')} className="text-base-content/40 ml-1">
              {snap === 'full' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {/* tabs */}
        {snap !== 'collapsed' && (
          <div className="flex border-b border-base-300/60 flex-shrink-0 px-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`
                  flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-semibold transition-all
                  ${activeTab === id ? 'text-primary border-b-2 border-primary' : 'text-base-content/50'}
                `}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* content */}
        {snap !== 'collapsed' && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
              >
                {children(activeTab)}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RideLiveTracking() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const rideId    = params?.rideId;
  const bookingId = params?.bookingId;

  // ── Redux state ──────────────────────────────────────────────────────────
  const trackingData    = useSelector(selectTrackingData);
  const liveData        = useSelector(selectLiveData);
  const socketLiveLocRx = useSelector(selectLiveLocation);
  const navTarget       = useSelector(selectNavigationTarget);
  const sosAlertRx      = useSelector(selectSosAlert);
  const isSocketConn    = useSelector(selectSocketConnected);

  // ── Socket ───────────────────────────────────────────────────────────────
  const { on, connected, SOCKET_EVENTS: EV } = useSocket();
  const {
    locationUpdate, etaUpdate, rideStatus: socketRideStatus,
    bookingStatus, navigationTarget: socketNavTarget,
    sosAlert, snapshot,
  } = useBookingRoom(bookingId);

  // ── Local state ──────────────────────────────────────────────────────────
  const [rideStatus, setRideStatus]       = useState(null);
  const [driverPos, setDriverPos]         = useState(null); // { lat, lng, heading }
  const [etaInfo, setEtaInfo]             = useState(null); // { etaMinutes, distanceRemainingKm }
  const [otp, setOtp]                     = useState(null);
  const [isDark, setIsDark]               = useState(false);
  const [voiceOn, setVoiceOn]             = useState(false);
  const [showCompletion, setCompletion]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [mapReady, setMapReady]           = useState(false);
  const [pickupReached, setPickupReached] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const mapRef            = useRef(null);
  const driverMarkerRef   = useRef(null);
  const pickupMarkerRef   = useRef(null);
  const dropoffMarkerRef  = useRef(null);
  const prevPosRef        = useRef(null);
  const interpolateRef    = useRef(null);
  const voiceRef          = useRef(false);
  const lastSpokenStatus  = useRef(null);

  // keep voiceRef in sync
  useEffect(() => { voiceRef.current = voiceOn; }, [voiceOn]);

  // ── Google Maps loader ───────────────────────────────────────────────────
  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries:        GOOGLE_MAPS_LIBS,
    mapIds:           [MAP_ID],
  });

  // ── Derived data ─────────────────────────────────────────────────────────
  const ride     = trackingData?.ride     || liveData;
  const tracking = trackingData?.tracking || null;

  const pickupCoords  = useMemo(() => ride?.pickup   ? { lat: ride.pickup.coordinates[1],  lng: ride.pickup.coordinates[0]  } : null, [ride]);
  const dropoffCoords = useMemo(() => ride?.dropoff  ? { lat: ride.dropoff.coordinates[1], lng: ride.dropoff.coordinates[0] } : null, [ride]);

  const routePath = useMemo(() => {
    const poly = tracking?.expectedRoutePolyline || trackingData?.tracking?.expectedRoutePolyline;
    return poly ? decodePolyline(poly) : [];
  }, [tracking, trackingData]);

  // completed portion = breadcrumbs
  const completedPath = useMemo(() => {
    const crumbs = tracking?.breadcrumbs || [];
    return crumbs.map(c => ({ lat: c.coordinates[1], lng: c.coordinates[0] }));
  }, [tracking]);

  // ── Fetch snapshot on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    setLoading(true);
    dispatch(fetchRideTracking({ rideId, breadcrumbs: 200 }))
      .unwrap()
      .then((data) => {
        const s = data?.ride?.status;
        if (s) setRideStatus(s);
        const ll = data?.ride?.liveLocation;
        if (ll?.coordinates?.length === 2) {
          setDriverPos({ lat: ll.coordinates[1], lng: ll.coordinates[0], heading: ll.heading || 0 });
        }
        if (data?.ride?.currentEtaMinutes) {
          setEtaInfo({ etaMinutes: data.ride.currentEtaMinutes, distanceRemainingKm: null });
        }
        if (s === 'completed') setCompletion(true);
      })
      .catch(() => {
        // fallback to live
        dispatch(fetchRideLive(rideId))
          .unwrap()
          .then((data) => {
            if (data?.status) setRideStatus(data.status);
            if (data?.liveLocation) setDriverPos({ lat: data.liveLocation.lat, lng: data.liveLocation.lng, heading: data.liveLocation.heading || 0 });
          })
          .catch(e => setError(e?.message || 'Could not load ride'));
      })
      .finally(() => setLoading(false));
  }, [rideId, dispatch]);

  // ── Join booking room ────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    dispatch(joinBookingRoom({ bookingId }));
    return () => { dispatch(leaveBookingRoom({ bookingId })); };
  }, [bookingId, dispatch]);

  // ── Listen socket events ─────────────────────────────────────────────────
  useEffect(() => {
    if (!connected) return;

    const unsubs = [
      // location_update
      on(EV.LOCATION_UPDATE, (d) => {
        if (!d) return;
        const newPos = { lat: d.lat, lng: d.lng, heading: d.heading || 0 };
        dispatch(socketLocationUpdate(d));
        dispatch(setLiveLocation(d));
        animateDriverMarker(newPos);
        if (d.etaMinutes) setEtaInfo({ etaMinutes: d.etaMinutes, distanceRemainingKm: d.remainingKm });
      }),

      // eta_update
      on(EV.ETA_UPDATE, (d) => {
        if (!d) return;
        dispatch(socketEtaUpdate(d));
        dispatch(setEtaUpdate(d));
        setEtaInfo({ etaMinutes: d.etaMinutes, distanceRemainingKm: d.distanceRemainingKm });
      }),

      // navigation_target_changed
      on(EV.NAVIGATION_TARGET_CHANGED, (d) => {
        if (!d) return;
        dispatch(socketNavigationTargetChanged(d));
        dispatch(setNavigationTarget(d));
        if (d.currentTarget === 'dropoff') {
          setPickupReached(true);
          if (voiceRef.current) speak('Ride has started. Heading to your destination.');
        }
      }),

      // ride_status_changed
      on(EV.RIDE_STATUS_CHANGED, (d) => {
        if (!d?.status) return;
        dispatch(socketRideStatusChanged(d));
        setRideStatus(d.status);
        announceStatus(d.status);
        if (d.status === 'completed') setTimeout(() => setCompletion(true), 1500);
      }),

      // booking_status_change
      on(EV.BOOKING_STATUS_CHANGE, (d) => {
        if (!d?.status) return;
        if (d.status === 'completed') setTimeout(() => setCompletion(true), 1500);
      }),

      // otp_required / driver_arrived
      on('driver_arrived', (d) => {
        dispatch(socketDriverArrived(d));
        setRideStatus('driver_arrived');
        if (d?.otp) setOtp(String(d.otp));
        if (voiceRef.current) speak('Your driver has arrived at the pickup location.');
      }),

      on('otp_required', (d) => {
        if (d?.otp) setOtp(String(d.otp));
      }),

      // ride_completed
      on('ride_completed', (d) => {
        dispatch(socketRideCompleted(d));
        setRideStatus('completed');
        setTimeout(() => setCompletion(true), 1500);
        if (voiceRef.current) speak('Your ride has been completed. Thank you for using Likeson.');
      }),

      // ride_cancelled
      on('ride_cancelled', (d) => {
        dispatch(socketRideCancelled(d));
        setRideStatus('cancelled');
      }),

      // driver_en_route
      on('driver_en_route', (d) => {
        dispatch(socketDriverEnRoute(d));
        setRideStatus('driver_en_route');
        if (voiceRef.current) speak('Your driver is on the way to your pickup location.');
      }),

      // driver_accepted
      on('driver_accepted', (d) => {
        dispatch(socketDriverAccepted(d));
        setRideStatus('driver_accepted');
      }),

      // sos_alert
      on(EV.SOS_ALERT, (d) => {
        dispatch(setSosAlert(d));
      }),

      // booking_state_snapshot (reconnect)
      on(EV.BOOKING_STATE_SNAPSHOT, (d) => {
        if (d?.ride?.status) setRideStatus(d.ride.status);
        if (d?.liveLocation) {
          const p = { lat: d.liveLocation.lat, lng: d.liveLocation.lng, heading: d.liveLocation.heading || 0 };
          setDriverPos(p);
        }
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [connected, dispatch, on, EV]);

  // ── Voice announcement ───────────────────────────────────────────────────
  function announceStatus(status) {
    if (!voiceRef.current) return;
    if (lastSpokenStatus.current === status) return;
    lastSpokenStatus.current = status;
    const msgs = {
      driver_en_route: 'Driver is on the way. Estimated arrival shown on screen.',
      driver_arrived:  'Driver has arrived at your pickup location.',
      otp_verified:    'OTP verified. Your ride is starting now.',
      in_progress:     'Ride has started. Approaching destination.',
      completed:       'You have reached your destination. Ride completed.',
    };
    if (msgs[status]) speak(msgs[status]);
  }

  // ── Smooth marker animation ──────────────────────────────────────────────
  function animateDriverMarker(newPos) {
    if (!driverMarkerRef.current || !prevPosRef.current) {
      setDriverPos(newPos);
      prevPosRef.current = newPos;
      return;
    }

    const start = { ...prevPosRef.current };
    const end   = newPos;
    const dur   = 800;
    const t0    = performance.now();

    clearInterval(interpolateRef.current);
    interpolateRef.current = setInterval(() => {
      const elapsed = performance.now() - t0;
      const progress = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      const lat = start.lat + (end.lat - start.lat) * eased;
      const lng = start.lng + (end.lng - start.lng) * eased;

      setDriverPos({ lat, lng, heading: newPos.heading });

      if (driverMarkerRef.current?.content) {
        driverMarkerRef.current.content.style.transform = `rotate(${newPos.heading}deg)`;
      }

      if (progress >= 1) {
        clearInterval(interpolateRef.current);
        prevPosRef.current = newPos;
        // smooth pan camera to driver
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
        }
      }
    }, 16);
  }

  // cleanup interpolation
  useEffect(() => () => clearInterval(interpolateRef.current), []);

  // ── Map callbacks ────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // ── Auto-fit bounds ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapsLoaded) return;
    const points = [];
    if (driverPos)    points.push(driverPos);
    if (pickupCoords) points.push(pickupCoords);
    if (dropoffCoords && ['in_progress', 'otp_verified', 'at_stop'].includes(rideStatus)) {
      points.push(dropoffCoords);
    }
    if (points.length < 2) return;

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach(p => bounds.extend(p));
    mapRef.current.fitBounds(bounds, { top: 80, right: 20, bottom: 420, left: 20 });
  }, [driverPos, pickupCoords, dropoffCoords, rideStatus, mapsLoaded]);

  // ── Advanced Marker management ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapsLoaded || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    const { AdvancedMarkerElement } = window.google.maps.marker;

    // Driver marker
    if (driverPos) {
      if (!driverMarkerRef.current) {
        const el = createDriverMarkerElement(driverPos.heading);
        driverMarkerRef.current = new AdvancedMarkerElement({
          map:      mapRef.current,
          position: driverPos,
          content:  el,
          title:    'Driver',
          zIndex:   30,
        });
      } else {
        driverMarkerRef.current.position = driverPos;
        if (driverMarkerRef.current.content) {
          driverMarkerRef.current.content.style.transform = `rotate(${driverPos.heading}deg)`;
        }
      }
    }

    // Pickup marker
    if (pickupCoords && !pickupMarkerRef.current) {
      pickupMarkerRef.current = new AdvancedMarkerElement({
        map:      mapRef.current,
        position: pickupCoords,
        content:  createPickupMarkerElement(pickupReached),
        title:    'Pickup',
        zIndex:   20,
      });
    } else if (pickupMarkerRef.current && pickupReached) {
      pickupMarkerRef.current.content = createPickupMarkerElement(true);
    }

    // Dropoff marker
    if (dropoffCoords && !dropoffMarkerRef.current) {
      dropoffMarkerRef.current = new AdvancedMarkerElement({
        map:      mapRef.current,
        position: dropoffCoords,
        content:  createDropoffMarkerElement(),
        title:    'Destination',
        zIndex:   20,
      });
    }

    return () => {
      // cleanup on unmount
    };
  }, [mapReady, mapsLoaded, driverPos, pickupCoords, dropoffCoords, pickupReached]);

  // cleanup markers on unmount
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current)  { driverMarkerRef.current.map  = null; driverMarkerRef.current  = null; }
      if (pickupMarkerRef.current)  { pickupMarkerRef.current.map  = null; pickupMarkerRef.current  = null; }
      if (dropoffMarkerRef.current) { dropoffMarkerRef.current.map = null; dropoffMarkerRef.current = null; }
    };
  }, []);

  // ── Recenter ─────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!mapRef.current || !driverPos) return;
    mapRef.current.panTo(driverPos);
    mapRef.current.setZoom(15);
  }, [driverPos]);

  // ── SOS ──────────────────────────────────────────────────────────────────
  const { trigger: triggerSos } = useSos(bookingId, rideId);

  const handleSos = useCallback(() => {
    if (!window.confirm('Are you sure you want to trigger an emergency SOS?')) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => triggerSos({ sosType: 'safety', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()    => triggerSos({ sosType: 'safety' }),
    );
  }, [triggerSos]);

  // ── Share trip ────────────────────────────────────────────────────────────
  const handleShare = useCallback(() => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: 'Track my ride — Likeson', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  }, []);

  // ── Map options ───────────────────────────────────────────────────────────
  const mapOptions = useMemo(() => ({
    mapId:                    MAP_ID,
    disableDefaultUI:         true,
    gestureHandling:          'greedy',
    zoomControl:              false,
    mapTypeControl:           false,
    streetViewControl:        false,
    fullscreenControl:        false,
    clickableIcons:           false,
    backgroundColor:          isDark ? '#1a1a2e' : '#f8fafc',
    colorScheme:              isDark ? 'DARK' : 'LIGHT',
  }), [isDark]);

  // ── OTP from live/tracking data ──────────────────────────────────────────
  // OTP comes via socket event (driver_arrived / otp_required) — do NOT read from ride model client-side
  // otp state only set from socket events.

  // ── Booking info from ride ────────────────────────────────────────────────
  const driverSnapshot  = ride?.driverSnapshot  || null;
  const vehicleSnapshot = ride?.vehicleSnapshot || null;
  const booking         = trackingData?.booking || null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <TrackingSkeleton />;

  if (mapsLoadError || error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-base-100 gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
          <AlertTriangle size={28} className="text-error" />
        </div>
        <h2 className="text-lg font-bold text-base-content">Unable to load tracking</h2>
        <p className="text-sm text-base-content/60 text-center">
          {mapsLoadError ? 'Google Maps failed to load. Check your internet connection.' : error}
        </p>
        <button onClick={() => window.location.reload()} className="btn btn-primary gap-2">
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }

  const curStatus = rideStatus || ride?.status || 'driver_assigned';

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDark ? 'dark' : ''}`} data-theme={isDark ? undefined : 'customer'}>

      {/* ── Reconnect Banner ─────────────────────────────────────── */}
      <ReconnectBanner visible={!connected} />

      {/* ── FULLSCREEN MAP ───────────────────────────────────────── */}
      <div className="absolute inset-0">
        {mapsLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={driverPos || pickupCoords || { lat: 16.506, lng: 80.648 }}
            zoom={14}
            options={mapOptions}
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
          >
            {/* remaining route — highlighted */}
            {routePath.length > 0 && (
              <Polyline
                path={routePath}
                options={{
                  strokeColor:   '#3b82f6',
                  strokeWeight:  5,
                  strokeOpacity: 0.85,
                  geodesic:      true,
                }}
              />
            )}

            {/* completed route — faded */}
            {completedPath.length > 1 && (
              <Polyline
                path={completedPath}
                options={{
                  strokeColor:   '#94a3b8',
                  strokeWeight:  4,
                  strokeOpacity: 0.4,
                  strokeDashArray: '8 6',
                  geodesic:      true,
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-base-200 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* ── TOP FLOATING HEADER ──────────────────────────────────── */}
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 20 }}
        className="absolute top-0 left-0 right-0 z-50 pt-safe-top"
      >
        <div className="mx-3 mt-3 rounded-2xl bg-base-100/90 backdrop-blur-xl border border-base-300/50 shadow-xl px-4 py-3">
          <div className="flex items-center gap-3">
            {/* status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    curStatus === 'completed' ? 'bg-success' :
                    curStatus === 'cancelled' ? 'bg-error' :
                    'bg-primary'
                  }`}
                />
                <p className="text-sm font-bold text-base-content truncate">
                  {RIDE_STATUS_LABELS[curStatus] || 'Tracking…'}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-1">
                {/* ETA */}
                {etaInfo?.etaMinutes != null && (
                  <div className="flex items-center gap-1 text-xs text-base-content/60">
                    <Clock size={11} className="text-primary" />
                    <span className="font-semibold text-primary">{fmtEta(etaInfo.etaMinutes)}</span>
                  </div>
                )}
                {/* distance */}
                {etaInfo?.distanceRemainingKm != null && (
                  <div className="flex items-center gap-1 text-xs text-base-content/60">
                    <Route size={11} />
                    <span>{fmtDist(etaInfo.distanceRemainingKm)}</span>
                  </div>
                )}
                {/* ride code */}
                {ride?.rideCode && (
                  <span className="text-xs text-base-content/40 font-mono">#{ride.rideCode}</span>
                )}
              </div>
            </div>

            {/* connection dot */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
              connected
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-error/10 border-error/30 text-error'
            }`}>
              {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span className="hidden sm:inline">{connected ? 'Live' : 'Offline'}</span>
            </div>

            {/* support */}
            <button className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
              <HelpCircle size={15} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── TOP RIGHT ACTIONS ─────────────────────────────────────── */}
      <motion.div
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="absolute top-24 right-3 z-50 flex flex-col gap-2"
      >
        <FloatBtn icon={Crosshair} onClick={handleRecenter} title="Re-center map" />
        <FloatBtn icon={isDark ? Sun : Moon} onClick={() => setIsDark(d => !d)} title="Toggle dark mode" variant={isDark ? 'active' : 'default'} />
        <FloatBtn icon={Share2} onClick={handleShare} title="Share trip" />
        <FloatBtn icon={voiceOn ? Volume2 : VolumeX} onClick={() => setVoiceOn(v => !v)} title="Voice updates" variant={voiceOn ? 'active' : 'default'} />
        <FloatBtn icon={ShieldAlert} onClick={handleSos} title="Emergency SOS" variant="danger" pulse={!!sosAlertRx} />
      </motion.div>

      {/* ── BOTTOM SHEET ─────────────────────────────────────────── */}
      <BottomSheet rideStatus={curStatus}>
        {(tab) => {
          // ── DRIVER TAB ──────────────────────────────────────────
          if (tab === 'driver') return (
            <div className="space-y-4 pb-6">
              {driverSnapshot ? (
                <>
                  {/* driver card */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-base-200/80 border border-base-300/60">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center overflow-hidden">
                        {driverSnapshot.photoUrl
                          ? <img src={driverSnapshot.photoUrl} alt={driverSnapshot.legalName} className="w-full h-full object-cover" />
                          : <User size={28} className="text-primary" />
                        }
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-base-100"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base-content text-base truncate">{driverSnapshot.legalName || 'Your Driver'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star size={12} className="text-warning fill-warning" />
                        <span className="text-sm font-semibold text-warning">{driverSnapshot.rating?.toFixed(1) || '—'}</span>
                        <span className="text-xs text-base-content/40">rating</span>
                      </div>
                    </div>

                    {/* action buttons */}
                    <div className="flex gap-2">
                      {driverSnapshot.phone && (
                        <a
                          href={`tel:${driverSnapshot.phone}`}
                          className="w-10 h-10 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success hover:bg-success/25 transition-colors"
                        >
                          <Phone size={17} />
                        </a>
                      )}
                      <button className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/25 transition-colors">
                        <MessageCircle size={17} />
                      </button>
                    </div>
                  </div>

                  {/* vehicle info */}
                  {vehicleSnapshot && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-base-200/60 border border-base-300/50">
                      <Car size={18} className="text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-base-content">
                          {[vehicleSnapshot.color, vehicleSnapshot.make, vehicleSnapshot.model].filter(Boolean).join(' ')}
                        </p>
                        <p className="text-xs font-bold text-primary tracking-wider mt-0.5">
                          {vehicleSnapshot.registrationNumber}
                        </p>
                      </div>
                      {vehicleSnapshot.vehicleType && (
                        <span className="badge badge-primary badge-sm">{vehicleSnapshot.vehicleType}</span>
                      )}
                    </div>
                  )}

                  {/* OTP card — show only when driver_arrived */}
                  <AnimatePresence>
                    {curStatus === 'driver_arrived' && otp && (
                      <OtpCard otp={otp} rideId={rideId} bookingId={bookingId} />
                    )}
                  </AnimatePresence>

                  {/* waiting message when driver_arrived but no OTP yet */}
                  {curStatus === 'driver_arrived' && !otp && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-accent/10 border border-accent/30"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                      >
                        <ShieldAlert size={20} className="text-accent" />
                      </motion.div>
                      <div>
                        <p className="text-sm font-bold text-accent">Driver has arrived!</p>
                        <p className="text-xs text-base-content/60">OTP will appear here. Check your SMS.</p>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center animate-pulse">
                    <User size={22} className="text-base-content/40" />
                  </div>
                  <p className="text-sm text-base-content/50">Driver info will appear once assigned</p>
                </div>
              )}
            </div>
          );

          // ── PROGRESS TAB ─────────────────────────────────────────
          if (tab === 'progress') return (
            <div className="pb-6 space-y-5">
              {/* ETA banner */}
              {etaInfo?.etaMinutes != null && curStatus !== 'completed' && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/20"
                >
                  <div className="text-center">
                    <p className="text-3xl font-black text-primary leading-none">{Math.round(etaInfo.etaMinutes)}</p>
                    <p className="text-xs text-base-content/50 font-medium mt-0.5">minutes</p>
                  </div>
                  <div className="w-px h-10 bg-base-300" />
                  <div>
                    <p className="text-sm font-bold text-base-content">Estimated Arrival</p>
                    {etaInfo.distanceRemainingKm != null && (
                      <p className="text-xs text-base-content/60 mt-0.5">{fmtDist(etaInfo.distanceRemainingKm)} remaining</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Timeline */}
              <div className="px-1">
                <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-4">Ride Milestones</p>
                <RideProgressTimeline currentStatus={curStatus} />
              </div>

              {/* Stop notice */}
              {curStatus === 'at_stop' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30"
                >
                  <Zap size={16} className="text-warning" />
                  <p className="text-sm font-semibold text-warning">Temporarily stopped at a waypoint</p>
                </motion.div>
              )}
            </div>
          );

          // ── BOOKING TAB ──────────────────────────────────────────
          if (tab === 'booking') return (
            <div className="pb-6 space-y-3">
              {[
                { label: 'Booking ID',   value: bookingId?.slice(-8)?.toUpperCase() },
                { label: 'Ride ID',      value: rideId?.slice(-8)?.toUpperCase() },
                { label: 'Ride Code',    value: ride?.rideCode },
                { label: 'Patient',      value: booking?.patientInfo?.name },
                { label: 'Pickup',       value: ride?.pickup?.address || ride?.pickup?.label },
                { label: 'Destination',  value: ride?.dropoff?.address || ride?.dropoff?.label },
                { label: 'Vehicle',      value: ride?.vehicleClass?.replace('_', ' ') },
                { label: 'Est. Distance', value: ride?.estimatedDistanceKm ? fmtDist(ride.estimatedDistanceKm) : null },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex items-start gap-3 py-2.5 border-b border-base-300/40 last:border-0">
                  <span className="text-xs font-bold text-base-content/40 uppercase tracking-wider w-28 flex-shrink-0 mt-0.5">{label}</span>
                  <span className="text-sm text-base-content font-medium leading-snug flex-1">{value}</span>
                </div>
              ))}
            </div>
          );

          // ── SAFETY TAB ───────────────────────────────────────────
          if (tab === 'safety') return (
            <div className="pb-6 space-y-4">
              {/* SOS */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleSos}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-error/10 border-2 border-error/40 hover:bg-error/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={22} className="text-error" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-error">Emergency SOS</p>
                  <p className="text-xs text-base-content/60 mt-0.5">Alert emergency contacts & Likeson support</p>
                </div>
              </motion.button>

              {/* Share trip */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleShare}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Share2 size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-base-content">Share Trip</p>
                  <p className="text-xs text-base-content/60 mt-0.5">Let family track your ride in real-time</p>
                </div>
              </motion.button>

              {/* Voice toggle */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setVoiceOn(v => !v)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                  voiceOn
                    ? 'bg-success/15 border-success/40 hover:bg-success/25'
                    : 'bg-base-200 border-base-300/60 hover:bg-base-300/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${voiceOn ? 'bg-success/20' : 'bg-base-300'}`}>
                  {voiceOn ? <Volume2 size={20} className="text-success" /> : <VolumeX size={20} className="text-base-content/40" />}
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-base-content">Voice Updates</p>
                  <p className="text-xs text-base-content/60 mt-0.5">Audio alerts for ride status changes</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${voiceOn ? 'bg-success' : 'bg-base-300'}`}>
                  <motion.div
                    animate={{ x: voiceOn ? 20 : 0 }}
                    className="w-5 h-5 rounded-full bg-white shadow-sm"
                  />
                </div>
              </motion.button>

              {/* Live tracking status */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-base-200/80 border border-base-300/50">
                <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
                <div>
                  <p className="text-sm font-bold text-base-content">Live Tracking</p>
                  <p className="text-xs text-base-content/50">{connected ? 'Connected — real-time updates active' : 'Reconnecting…'}</p>
                </div>
              </div>

              {/* Support */}
              <a
                href="tel:1800-123-4567"
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-base-200 border border-base-300/50 hover:bg-base-300/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center flex-shrink-0">
                  <Phone size={20} className="text-info" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-base-content">Contact Support</p>
                  <p className="text-xs text-base-content/60 mt-0.5">1800-123-4567 (24×7 helpline)</p>
                </div>
                <ChevronRight size={16} className="text-base-content/40 ml-auto" />
              </a>
            </div>
          );

          return null;
        }}
      </BottomSheet>

      {/* ── COMPLETION SCREEN ─────────────────────────────────────── */}
      <AnimatePresence>
        {showCompletion && curStatus === 'completed' && (
          <CompletionScreen
            ride={ride}
            tracking={trackingData}
            onClose={() => setCompletion(false)}
          />
        )}
      </AnimatePresence>

      {/* ── CANCELLED BANNER ─────────────────────────────────────── */}
      <AnimatePresence>
        {curStatus === 'cancelled' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-32 left-4 right-4 z-[150] p-4 rounded-2xl bg-error/95 border border-error/50 backdrop-blur-sm text-error-content"
          >
            <div className="flex items-center gap-3">
              <X size={20} />
              <div>
                <p className="font-bold">Ride Cancelled</p>
                <p className="text-sm opacity-80 mt-0.5">This ride has been cancelled. Please contact support.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}