'use client';

/**
 * CareAssistantRideLiveTracking.jsx — Likeson.in
 *
 * Dual-mode live tracking for Care Assistants:
 *
 * MODE A — full_care_ride
 *   Phase 1: CA navigates from current location → driver waypoint (join-ride point)
 *   Phase 2: After joining, mirrors driver live tracking (patient pickup → hospital)
 *
 * MODE B — care_assistant (only)
 *   CA navigates from current location → patient pickup location
 *   Shows own GPS trail + patient location pin. No driver involved.
 *
 * Socket events consumed:
 *   location_update, eta_update, ride_status_changed, navigation_target_changed,
 *   care_assistant_joined_ride, care_assistant_attached_to_ride,
 *   ride_stage_changed, hospital_eta_update, care-assistant:ride:tracking
 *
 * Redux:
 *   operationsSlice — careJoinRide, markCareArrived, markCareStart, markCareComplete,
 *                     updateCareLocation, fetchCareTrackingSnapshot, fetchCareAssignedBookings
 *   rideRequestSlice — fetchRideTracking, fetchRideLive, socketLocationUpdate, etc.
 *
 * API routes used:
 *   GET  /bookings/:id/care/tracking-snapshot
 *   POST /bookings/:id/care/join-ride
 *   PATCH /bookings/:id/care/arrived
 *   PATCH /bookings/:id/care/start
 *   PATCH /bookings/:id/care/complete
 *   PATCH /bookings/care/location
 */

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter }    from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence }  from 'framer-motion';
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import { useGoogleMaps }           from '@/context/GoogleMapsProvider';

// Icons
import {
  Navigation, MapPin, Phone, User, Clock, Zap, Shield, ShieldAlert,
  WifiOff, ChevronDown, ChevronLeft, CheckCircle, Loader2, X,
  Star, Car, RefreshCw, AlertTriangle, Copy, Check, ArrowUpRight,
  Maximize2, Minimize2, Plus, Minus, Heart, Activity, Route,
  UserCheck, Truck, Hospital, Package, Play, Square,
} from 'lucide-react';

// Redux — Operations
import {
  careJoinRide,
  markCareArrived,
  markCareStart,
  markCareComplete,
  updateCareLocation,
  fetchCareTrackingSnapshot,
  fetchCareAssignedBookings,
  selectCareTrackingSnapshot,
  selectCareAssistantLocation,
  selectCareAssistantStatus,
  selectCareAssistantJoined,
  selectCareRideStatus,
  selectActiveNavigationTarget,
  selectRideStageOps,
  setCareAssistantLocation,
  setCareAssistantJoined,
  setCareRideWorkflow,
} from '@/store/slices/operationsSlice';

// Redux — Ride
import {
  fetchRideTracking,
  fetchRideLive,
  selectCurrentRide,
  selectSocketLive,
  selectLiveData,
  selectTrackingData,
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketRideCompleted,
  socketRideCancelled,
  socketNavigationTargetChanged,
  socketHospitalEtaUpdate,
  socketCareAssistantTracking,
} from '@/store/slices/rideRequestSlice';

// Redux — Clinical (Replaced bookingSlice imports)
import {
  fetchCABookingById,
  selectSelectedCABooking,
} from '@/store/slices/clinicalSlice';

import { useSocket, useBookingRoom } from '@/context/SocketProvider';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID   = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const POLL_MS  = 5000;
const GPS_INTERVAL_MS = 3000; // push CA location every 3s

// Care assistant journey phases
const PHASE = {
  LOADING:       'loading',
  NAVIGATING_TO: 'navigating_to_waypoint',  // MODE A: going to join point / MODE B: going to patient
  ARRIVED_AT:    'arrived_at_waypoint',      // Pressed "I've Arrived"
  JOINED:        'joined_ride',              // MODE A: joined driver ride
  IN_TASK:       'in_task',                  // task started
  COMPLETED:     'completed',
};

// Booking types that involve a driver ride
const FULL_CARE_TYPES = ['full_care_ride'];

// Status display per phase
const PHASE_CONFIG = {
  [PHASE.LOADING]:       { label: 'Loading',         color: '#64748b', icon: '⏳' },
  [PHASE.NAVIGATING_TO]: { label: 'En Route',        color: '#3b82f6', icon: '🚶' },
  [PHASE.ARRIVED_AT]:    { label: 'Arrived',         color: '#8b5cf6', icon: '📍' },
  [PHASE.JOINED]:        { label: 'Joined Ride',     color: '#06b6d4', icon: '🚗' },
  [PHASE.IN_TASK]:       { label: 'Task In Progress',color: '#22c55e', icon: '💚' },
  [PHASE.COMPLETED]:     { label: 'Completed',       color: '#64748b', icon: '✅' },
};

// Driver ride status display
const DRIVER_STATUS_CONFIG = {
  searching:       { label: 'Searching Driver', color: '#f59e0b', icon: '🔍' },
  driver_assigned: { label: 'Driver Assigned',  color: '#3b82f6', icon: '👤' },
  driver_accepted: { label: 'Driver Coming',    color: '#06b6d4', icon: '🚗' },
  driver_en_route: { label: 'Driver En Route',  color: '#06b6d4', icon: '🚗' },
  driver_arrived:  { label: 'Driver Arrived',   color: '#8b5cf6', icon: '📍' },
  otp_verified:    { label: 'Ride Starting',    color: '#10b981', icon: '✅' },
  in_progress:     { label: 'Ride In Progress', color: '#22c55e', icon: '🏥' },
  at_stop:         { label: 'At Stop',          color: '#f97316', icon: '⏸️' },
  completed:       { label: 'Ride Completed',   color: '#64748b', icon: '🎉' },
  cancelled:       { label: 'Cancelled',        color: '#ef4444', icon: '❌' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const lerp    = (a, b, t) => a + (b - a) * t;
const fmtEta  = (min) => {
  if (min == null) return null;
  if (min < 1) return '< 1 min';
  return `${Math.round(min)} min`;
};
const fmtKm   = (km) => {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};
const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

const createCaMarkerHtml = (heading = 0) => `
  <div style="position:absolute;width:0;height:0;pointer-events:none;">
    <div style="position:absolute;width:68px;height:68px;left:-34px;top:-34px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:64px;height:64px;border-radius:50%;
        background:radial-gradient(circle,rgba(236,72,153,0.20) 0%,rgba(236,72,153,0) 70%);
        animation:caPulse 2s infinite ease-out;pointer-events:none;"></div>
      <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
        width:40px;height:8px;border-radius:50%;
        background:rgba(0,0,0,0.25);filter:blur(3px);pointer-events:none;"></div>
      <div style="position:relative;width:48px;height:48px;border-radius:50%;
        background:linear-gradient(135deg,#ec4899,#8b5cf6);
        border:3px solid #fff;display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 20px rgba(236,72,153,0.55);z-index:2;
        transform:rotate(${heading}deg);
        transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
        pointer-events:none;">
        <span style="font-size:22px;transform:rotate(-${heading}deg);">👩‍⚕️</span>
      </div>
    </div>
  </div>
  <style>
    @keyframes caPulse {
      0%   { transform:scale(0.80); opacity:0.85; }
      100% { transform:scale(2.0);  opacity:0; }
    }
  </style>
`;

const createDriverMarkerHtml = () => `
  <div style="position:absolute;width:0;height:0;pointer-events:none;">
    <div style="position:absolute;width:60px;height:60px;left:-30px;top:-30px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:56px;height:56px;border-radius:50%;
        background:radial-gradient(circle,rgba(34,197,94,0.18) 0%,rgba(34,197,94,0) 70%);
        animation:drvPulse 2.2s infinite ease-out;pointer-events:none;"></div>
      <div style="position:relative;width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#22c55e,#16a34a);
        border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 16px rgba(34,197,94,0.55);z-index:2;pointer-events:none;">
        <span style="font-size:20px;">🚗</span>
      </div>
    </div>
  </div>
  <style>
    @keyframes drvPulse {
      0%   { transform:scale(0.80); opacity:0.9; }
      100% { transform:scale(2.0);  opacity:0; }
    }
  </style>
`;

const createPinHtml = (emoji, color, label) => `
  <div style="position:absolute;left:-18px;top:-52px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
    <div style="width:36px;height:36px;background:${color};border-radius:50%;
      border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 14px rgba(0,0,0,0.30);font-size:18px;">${emoji}</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${color};margin-top:-1px;"></div>
    <div style="background:${color};color:#fff;padding:2px 7px;border-radius:20px;
      font-size:9px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;
      white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.22);">${label}</div>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Pill badge */
const StatusPill = memo(function StatusPill({ icon, label, color, bg, border, pulse }) {
  return (
    <motion.span
      animate={pulse ? { opacity: [0.7, 1, 0.7] } : {}}
      transition={pulse ? { repeat: Infinity, duration: 1.8 } : {}}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border flex-shrink-0"
      style={{ background: bg, borderColor: border, color }}
    >
      <span>{icon}</span>{label}
    </motion.span>
  );
});

/** FAB button */
const FabBtn = memo(function FabBtn({ onClick, active, danger, title, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      title={title}
      className={[
        'w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border',
        'shadow-[0_4px_20px_rgba(0,0,0,0.38)] transition-colors',
        danger
          ? (active
            ? 'bg-error border-error text-error-content animate-pulse'
            : 'bg-error/10 border-error/30 text-error')
          : (active
            ? 'bg-primary text-primary-content border-primary'
            : 'bg-base-200/90 text-base-content/60 border-base-300 hover:text-base-content'),
      ].join(' ')}
    >
      {children}
    </motion.button>
  );
});

/** ── ACTION BUTTON (primary CTA) ── */
const ActionButton = memo(function ActionButton({ label, icon, color, onClick, loading, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className="flex items-center justify-center gap-2 w-full max-w-xs mx-auto py-3.5 rounded-2xl text-sm font-bold border-2 cursor-pointer transition-all"
      style={{
        background: disabled ? 'rgba(100,116,139,0.15)' : `${color}22`,
        borderColor: disabled ? 'rgba(100,116,139,0.3)' : `${color}66`,
        color: disabled ? '#64748b' : color,
        boxShadow: disabled ? 'none' : `0 4px 20px ${color}44`,
      }}
    >
      {loading
        ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
        : <>{icon}{label}</>
      }
    </motion.button>
  );
});

/** ── PHASE PROGRESS BAR ── */
const PhaseProgress = memo(function PhaseProgress({ bookingType, phase }) {
  const isFullCare = FULL_CARE_TYPES.includes(bookingType);

  const steps = isFullCare
    ? [
        { key: PHASE.NAVIGATING_TO, label: 'En Route to Join' },
        { key: PHASE.ARRIVED_AT,    label: 'At Pickup Point'  },
        { key: PHASE.JOINED,        label: 'Joined Ride'      },
        { key: PHASE.IN_TASK,       label: 'In Task'          },
        { key: PHASE.COMPLETED,     label: 'Done'             },
      ]
    : [
        { key: PHASE.NAVIGATING_TO, label: 'En Route'       },
        { key: PHASE.ARRIVED_AT,    label: 'Arrived'        },
        { key: PHASE.IN_TASK,       label: 'Task Started'   },
        { key: PHASE.COMPLETED,     label: 'Completed'      },
      ];

  const activeIdx = steps.findIndex(s => s.key === phase);

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start justify-between relative">
        <div className="absolute top-3 h-0.5 bg-base-300" style={{ left: '5%', right: '5%', zIndex: 0 }} />
        <motion.div
          className="absolute top-3 h-0.5"
          style={{
            left: '5%', zIndex: 1,
            background: 'linear-gradient(90deg,#ec4899,#8b5cf6)',
          }}
          animate={{ width: `${(Math.max(0, activeIdx) / (steps.length - 1)) * 90}%` }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
        {steps.map((step, i) => {
          const done = i <= activeIdx, active = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 relative z-10 flex-1">
              <motion.div
                className="w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                animate={{
                  backgroundColor: done ? '#ec4899' : 'var(--base-200)',
                  borderColor:     done ? '#ec4899' : 'var(--base-300)',
                  scale:           active ? 1.25 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {done && <Check size={10} color="white" strokeWidth={3} />}
              </motion.div>
              <p className="text-[8px] text-center leading-tight font-semibold"
                style={{ color: done ? '#ec4899' : 'var(--base-content)', opacity: done ? 1 : 0.4 }}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/** ── ETA CARD ── */
const EtaCard = memo(function EtaCard({ etaMin, distKm, target }) {
  if (etaMin == null && distKm == null) return null;
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-base-300/50 rounded-2xl border border-base-300 mx-4 mb-2">
      {etaMin != null && (
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-pink-400" />
          <span className="text-sm font-black text-pink-400">{fmtEta(etaMin)}</span>
          <span className="text-[10px] text-base-content/40 font-semibold uppercase tracking-wide">ETA</span>
        </div>
      )}
      {distKm != null && (
        <div className="flex items-center gap-1.5">
          <Navigation size={13} className="text-base-content/50" />
          <span className="text-sm font-semibold text-base-content/60">{fmtKm(distKm)}</span>
          <span className="text-[10px] text-base-content/40 font-semibold uppercase tracking-wide">Away</span>
        </div>
      )}
      {target && (
        <div className="ml-auto flex items-center gap-1">
          <Route size={11} className="text-purple-400" />
          <span className="text-[10px] text-purple-400 font-bold capitalize">→ {target.replace(/_/g, ' ')}</span>
        </div>
      )}
    </div>
  );
});

/** ── DRIVER TRACKING PANEL (shown when joined in full_care_ride) ── */
const DriverTrackingPanel = memo(function DriverTrackingPanel({
  rideStatus, driverSnapshot, vehicleSnapshot, etaMin, distKm,
}) {
  const cfg = DRIVER_STATUS_CONFIG[rideStatus] || DRIVER_STATUS_CONFIG.searching;
  if (!rideStatus) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3 p-3.5 rounded-2xl border bg-base-300/60 border-base-300"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
          style={{
            background: `${cfg.color}18`,
            borderColor: `${cfg.color}44`,
            color: cfg.color,
          }}>
          {cfg.icon} {cfg.label}
        </span>
        <span className="text-[10px] text-base-content/40 ml-auto font-semibold uppercase tracking-wide">Driver Ride</span>
      </div>

      {(driverSnapshot?.legalName || driverSnapshot?.name) && (
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/10 border border-success/25 flex-shrink-0">
            <User size={16} className="text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-base-content m-0 truncate">
              {driverSnapshot.legalName || driverSnapshot.name}
            </p>
            {vehicleSnapshot?.registrationNumber && (
              <p className="text-[10px] text-base-content/40 m-0 mt-0.5 font-mono">
                {vehicleSnapshot.registrationNumber}
                {vehicleSnapshot.make && ` · ${vehicleSnapshot.make} ${vehicleSnapshot.model || ''}`}
              </p>
            )}
          </div>
          {driverSnapshot?.phone && (
            <a href={`tel:${driverSnapshot.phone}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-success bg-success/10 border border-success/25 no-underline flex-shrink-0">
              <Phone size={15} />
            </a>
          )}
        </div>
      )}

      {(etaMin != null || distKm != null) && (
        <div className="flex gap-3 pt-2 border-t border-base-300">
          {etaMin != null && (
            <div className="flex items-center gap-1">
              <Clock size={10} className="text-primary" />
              <span className="text-xs font-bold text-primary">{fmtEta(etaMin)}</span>
            </div>
          )}
          {distKm != null && (
            <div className="flex items-center gap-1">
              <Navigation size={10} className="text-base-content/40" />
              <span className="text-xs text-base-content/50 font-semibold">{fmtKm(distKm)}</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
});

/** ── BOOKING INFO PANEL ── */
const BookingInfoPanel = memo(function BookingInfoPanel({ booking, bookingId }) {
  if (!booking && !bookingId) return null;
  const bk = booking;
  return (
    <div className="mx-4 mb-3 p-3.5 rounded-2xl bg-base-300/50 border border-base-300">
      <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2.5">Booking Details</p>
      {[
        ['Code',     bk?.bookingCode],
        ['Type',     bk?.bookingType?.replace(/_/g, ' ')],
        ['Patient',  bk?.patientInfo?.name],
        ['Scheduled', bk?.scheduledAt
          ? new Date(bk.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
          : null],
        ['Status',   bk?.status?.replace(/_/g, ' ')],
      ].map(([label, val]) => val ? (
        <div key={label} className="flex justify-between py-1.5 border-b border-base-300/60 last:border-b-0">
          <span className="text-[11px] text-base-content/40 font-semibold uppercase tracking-wide">{label}</span>
          <span className="text-xs text-base-content/70 font-semibold capitalize">{val}</span>
        </div>
      ) : null)}
    </div>
  );
});

/** ── BOTTOM SHEET ── */
const BottomSheet = memo(function BottomSheet({
  open, onToggle,
  phase, bookingType, booking,
  rideStatus, driverSnapshot, vehicleSnapshot,
  etaMin, distKm,
  patientPhone,
  onAction, actionLabel, actionIcon, actionColor, actionLoading, actionDisabled,
}) {
  const phaseCfg = PHASE_CONFIG[phase] || PHASE_CONFIG[PHASE.LOADING];

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 88px)' }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl bg-base-200 border border-base-300 border-b-0 shadow-[0_-8px_40px_rgba(0,0,0,0.35)]"
      style={{ maxHeight: '82vh' }}
    >
      {/* Handle row */}
      <button onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer px-4 pt-3 pb-2 flex flex-col items-center">
        <div className="w-9 h-1 rounded-full bg-base-300 mb-3" />
        <div className="flex items-center justify-between w-full mb-1">
          <StatusPill
            icon={phaseCfg.icon}
            label={phaseCfg.label}
            color={phaseCfg.color}
            bg={`${phaseCfg.color}18`}
            border={`${phaseCfg.color}44`}
            pulse={phase === PHASE.NAVIGATING_TO}
          />
          <div className="flex items-center gap-2">
            {etaMin != null && (
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-pink-400" />
                <span className="text-xs font-black text-pink-400">{fmtEta(etaMin)}</span>
              </div>
            )}
            {distKm != null && (
              <div className="flex items-center gap-1">
                <Navigation size={11} className="text-base-content/40" />
                <span className="text-xs font-semibold text-base-content/50">{fmtKm(distKm)}</span>
              </div>
            )}
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={15} className="text-base-content/40" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Scrollable content */}
      <div className="overflow-y-auto pb-8" style={{ maxHeight: 'calc(82vh - 88px)' }}>

        {/* Phase progress */}
        <PhaseProgress bookingType={bookingType} phase={phase} />

        {/* ETA card */}
        <EtaCard etaMin={etaMin} distKm={distKm} />

        {/* Primary action */}
        {actionLabel && onAction && (
          <div className="px-4 mb-3">
            <ActionButton
              label={actionLabel}
              icon={actionIcon}
              color={actionColor}
              onClick={onAction}
              loading={actionLoading}
              disabled={actionDisabled}
            />
          </div>
        )}

        {/* Patient contact */}
        {patientPhone && (
          <div className="mx-4 mb-3 flex items-center gap-3 p-3 rounded-2xl bg-base-300/60 border border-base-300">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-pink-500/10 border border-pink-500/25">
              <Heart size={14} className="text-pink-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-base-content m-0">Patient Contact</p>
              <p className="text-[11px] text-base-content/50 m-0 mt-0.5">{patientPhone}</p>
            </div>
            <a href={`tel:${patientPhone}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-pink-400 bg-pink-500/10 border border-pink-500/25 no-underline">
              <Phone size={14} />
            </a>
          </div>
        )}

        {/* Driver tracking (full_care only, after joined) */}
        {FULL_CARE_TYPES.includes(bookingType) &&
          [PHASE.JOINED, PHASE.IN_TASK].includes(phase) && (
            <DriverTrackingPanel
              rideStatus={rideStatus}
              driverSnapshot={driverSnapshot}
              vehicleSnapshot={vehicleSnapshot}
              etaMin={etaMin}
              distKm={distKm}
            />
          )}

        {/* Booking info */}
        <BookingInfoPanel booking={booking} />
      </div>
    </motion.div>
  );
});

/** ── COMPLETED SCREEN ── */
const CompletedScreen = memo(function CompletedScreen({ bookingType, onBack }) {
  const isFullCare = FULL_CARE_TYPES.includes(bookingType);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6 font-poppins">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', damping: 14 }}
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'linear-gradient(135deg,#ec489918,#8b5cf618)', border: '2px solid #ec489944' }}
      >
        <span className="text-5xl">💚</span>
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2">
        {isFullCare ? 'Care Completed!' : 'Task Completed!'}
      </motion.h2>
      <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}
        className="text-sm text-base-content/50 text-center m-0 mb-8">
        {isFullCare
          ? 'Patient has been safely escorted. Well done!'
          : 'Care assistance task completed successfully.'}
      </motion.p>
      <motion.button
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.50 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBack}
        className="btn btn-lg rounded-2xl px-10 font-bold"
        style={{ background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', border: 'none' }}>
        Back to Dashboard
      </motion.button>
    </motion.div>
  );
});

/** ── LOADING SCREEN ── */
const LoadingScreen = memo(function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#ec489918,#8b5cf618)' }}>
        <Loader2 size={28} className="text-pink-400 animate-spin" />
      </motion.div>
      <p className="text-sm font-semibold text-base-content/50">Loading your task…</p>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CareAssistantRideLiveTracking() {
  const params    = useParams();
  const router    = useRouter();
  const dispatch  = useDispatch();

  const bookingId = params?.bookingId || null;
  const rideId    = params?.rideId    || null;

  // ── Redux ──────────────────────────────────────────────────────────────────
  const currentRide     = useSelector(selectCurrentRide);
  const socketLive      = useSelector(selectSocketLive);
  const liveData        = useSelector(selectLiveData);
  const trackingData    = useSelector(selectTrackingData);
  const booking         = useSelector(selectSelectedCABooking);
  const careSnapshot    = useSelector(selectCareTrackingSnapshot);
  const careLocRedux    = useSelector(selectCareAssistantLocation);
  const careStatusRedux = useSelector(selectCareAssistantStatus);
  const careJoined      = useSelector(selectCareAssistantJoined);
  const careRideStatus  = useSelector(selectCareRideStatus);
  const navTargetRedux  = useSelector(selectActiveNavigationTarget);
  const rideStageRedux  = useSelector(selectRideStageOps);

  // ── Socket ─────────────────────────────────────────────────────────────────
  const { on, connected, SOCKET_EVENTS: EV } = useSocket();
  const { locationUpdate, etaUpdate: etaEvt } = useBookingRoom(bookingId);

  // ── Booking type ────────────────────────────────────────────────────────────
  const bookingType = booking?.bookingType || null;
  const isFullCare  = FULL_CARE_TYPES.includes(bookingType);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mapRef             = useRef(null);
  const dirServiceRef      = useRef(null);
  const caMarkerRef        = useRef(null);       // CA self marker
  const driverMarkerRef    = useRef(null);       // driver marker (full_care after join)
  const pickupMarkerRef    = useRef(null);       // patient pickup pin
  const dropoffMarkerRef   = useRef(null);       // hospital/destination pin
  const waypointMarkerRef  = useRef(null);       // join-ride waypoint (full_care)
  const staticMarkersInit  = useRef(false);
  const caPosRef           = useRef(null);
  const caTargetRef        = useRef(null);
  const driverPosRef       = useRef(null);
  const driverTargetRef    = useRef(null);
  const animFrameRef       = useRef(null);
  const gpsWatchRef        = useRef(null);
  const gpsIntervalRef     = useRef(null);
  const pollTimerRef       = useRef(null);
  const smoothHeadRef      = useRef(0);
  const driverSmoothHdRef  = useRef(0);
  const lastRouteCalcRef   = useRef(null);
  const routeCalcInFlight  = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [mapLoaded,        setMapLoaded]       = useState(false);
  const [caRoute,          setCaRoute]         = useState(null);   // CA → target route
  const [driverRoute,      setDriverRoute]     = useState(null);   // driver → dest route (joined)
  const [overviewRoute,    setOverviewRoute]   = useState(null);   // pickup → dropoff
  const [phase,            setPhase]           = useState(PHASE.LOADING);
  const [sheetOpen,        setSheetOpen]       = useState(true);
  const [showCompleted,    setShowCompleted]   = useState(false);
  const [sosActive,        setSosActive]       = useState(false);
  const [caPos,            setCaPos]           = useState(null);
  const [caHeading,        setCaHeading]       = useState(0);
  const [driverPos,        setDriverPos]       = useState(null);
  const [etaMinutes,       setEtaMinutes]      = useState(null);
  const [remainingKm,      setRemainingKm]     = useState(null);
  const [driverRideStatus, setDriverRideStatus] = useState(null);
  const [actionLoading,    setActionLoading]   = useState(false);
  const [isInitLoading,    setIsInitLoading]   = useState(true);
  const [followMode,       setFollowMode]      = useState(true);
  const [isFullscreen,     setIsFullscreen]    = useState(false);
  const [mapZoom,          setMapZoom]         = useState(15);
  const [gpsError,         setGpsError]        = useState(null);
  const [gpsGranted,       setGpsGranted]      = useState(false);

  const { isLoaded } = useGoogleMaps();

  // ── Derived ────────────────────────────────────────────────────────────────
  const rd = currentRide || liveData;

  /** Waypoint coords for MODE A (care_assistant_join type in ride.waypoints) */
  const waypointCoords = useMemo(() => {
    const waypoints = rd?.waypoints || [];
    const caWp = waypoints.find(w => w.type === 'care_assistant_join');
    if (caWp?.location?.coordinates?.length === 2) {
      return { lat: caWp.location.coordinates[1], lng: caWp.location.coordinates[0] };
    }
    // Fallback: use pickup
    const c = rd?.pickup?.coordinates;
    if (c?.length === 2) return { lat: c[1], lng: c[0] };
    return null;
  }, [rd]);

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

  // What the CA is currently navigating toward
  const caTarget = useMemo(() => {
    if (!isFullCare) {
      // MODE B: always navigate to patient pickup
      return pickupCoords;
    }
    // MODE A: before joined → go to waypoint; after joined → irrelevant (driver handles nav)
    if ([PHASE.NAVIGATING_TO, PHASE.ARRIVED_AT].includes(phase)) {
      return waypointCoords || pickupCoords;
    }
    return null;
  }, [isFullCare, phase, waypointCoords, pickupCoords]);

  const driverSnapshot  = socketLive?.driverSnapshot  || rd?.driverSnapshot;
  const vehicleSnapshot = socketLive?.vehicleSnapshot || rd?.vehicleSnapshot;

  const patientPhone = booking?.patientInfo?.phone
    || booking?.customer?.phone
    || null;

  // ── Action button config ────────────────────────────────────────────────────
  const { actionLabel, actionIcon, actionColor, onAction } = useMemo(() => {
    switch (phase) {
      case PHASE.NAVIGATING_TO:
        return {
          actionLabel: isFullCare ? "I've Reached the Join Point" : "I've Arrived at Patient",
          actionIcon:  <MapPin size={15} />,
          actionColor: '#8b5cf6',
          onAction: async () => {
            setActionLoading(true);
            try {
              await dispatch(markCareArrived({ bookingId })).unwrap();
              setPhase(PHASE.ARRIVED_AT);
            } catch (e) {
              console.error('[CA] markCareArrived:', e);
            } finally {
              setActionLoading(false);
            }
          },
        };

      case PHASE.ARRIVED_AT:
        return isFullCare
          ? {
              actionLabel: 'Join the Ride',
              actionIcon:  <UserCheck size={15} />,
              actionColor: '#06b6d4',
              onAction: async () => {
                setActionLoading(true);
                try {
                  const pos = caPosRef.current;
                  await dispatch(careJoinRide({
                    bookingId,
                    currentLat: pos?.lat,
                    currentLng: pos?.lng,
                  })).unwrap();
                  setPhase(PHASE.JOINED);
                } catch (e) {
                  console.error('[CA] careJoinRide:', e);
                } finally {
                  setActionLoading(false);
                }
              },
            }
          : {
              actionLabel: 'Start Task',
              actionIcon:  <Play size={15} />,
              actionColor: '#22c55e',
              onAction: async () => {
                setActionLoading(true);
                try {
                  await dispatch(markCareStart({ bookingId })).unwrap();
                  setPhase(PHASE.IN_TASK);
                } catch (e) {
                  console.error('[CA] markCareStart:', e);
                } finally {
                  setActionLoading(false);
                }
              },
            };

      case PHASE.JOINED:
        return {
          actionLabel: 'Start Task',
          actionIcon:  <Activity size={15} />,
          actionColor: '#22c55e',
          onAction: async () => {
            setActionLoading(true);
            try {
              await dispatch(markCareStart({ bookingId })).unwrap();
              setPhase(PHASE.IN_TASK);
            } catch (e) {
              console.error('[CA] markCareStart:', e);
            } finally {
              setActionLoading(false);
            }
          },
        };

      case PHASE.IN_TASK:
        return {
          actionLabel: 'Complete Task',
          actionIcon:  <CheckCircle size={15} />,
          actionColor: '#64748b',
          onAction: async () => {
            setActionLoading(true);
            try {
              await dispatch(markCareComplete({ bookingId })).unwrap();
              setPhase(PHASE.COMPLETED);
            } catch (e) {
              console.error('[CA] markCareComplete:', e);
            } finally {
              setActionLoading(false);
            }
          },
        };

      default:
        return { actionLabel: null, actionIcon: null, actionColor: null, onAction: null };
    }
  }, [phase, isFullCare, bookingId, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  // Initial data fetch
  useEffect(() => {
    const load = async () => {
      setIsInitLoading(true);
      try {
        const tasks = [];
        if (bookingId) {
          tasks.push(dispatch(fetchCABookingById(bookingId)));
          tasks.push(dispatch(fetchCareTrackingSnapshot({ bookingId })));
        }
        if (rideId) {
          tasks.push(dispatch(fetchRideTracking({ rideId })));
          tasks.push(dispatch(fetchRideLive(rideId)));
        }
        await Promise.all(tasks);
      } finally {
        setIsInitLoading(false);
      }
    };
    load();
  }, [bookingId, rideId]); // eslint-disable-line

  // Set initial phase after booking loads
  useEffect(() => {
    if (!booking) return;
    if (booking.status === 'completed') { setPhase(PHASE.COMPLETED); setShowCompleted(true); return; }
    setPhase(PHASE.NAVIGATING_TO);
  }, [booking?.status]); // eslint-disable-line

  // Sync driver ride status from socket
  useEffect(() => {
    const s = socketLive?.status || rd?.status;
    if (s) setDriverRideStatus(s);
  }, [socketLive?.status, rd?.status]);

  // If socket says ride completed
  useEffect(() => {
    if (driverRideStatus === 'completed' && isFullCare && phase === PHASE.IN_TASK) {
      const t = setTimeout(() => {
        setPhase(PHASE.COMPLETED);
        setShowCompleted(true);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [driverRideStatus, isFullCare, phase]);

  // Phase → completed screen
  useEffect(() => {
    if (phase === PHASE.COMPLETED) {
      const t = setTimeout(() => setShowCompleted(true), 1500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Sync ETA from socket/poll
  useEffect(() => {
    const eta = etaEvt?.etaMinutes ?? socketLive?.etaMinutes ?? liveData?.currentEtaMinutes;
    if (eta != null) setEtaMinutes(eta);
    const km = etaEvt?.distanceRemainingKm;
    if (km != null) setRemainingKm(km);
  }, [etaEvt, socketLive?.etaMinutes, liveData?.currentEtaMinutes]);

  // Sync care-assistant-joined from redux/socket
  useEffect(() => {
    if (careJoined && phase === PHASE.ARRIVED_AT) {
      setPhase(PHASE.JOINED);
    }
  }, [careJoined, phase]);

  // ── GPS: watch CA's own position ──────────────────────────────────────────
  useEffect(() => {
    if (!navigator?.geolocation) {
      setGpsError('GPS not supported on this device');
      return;
    }

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsGranted(true);
        setGpsError(null);
        const { latitude: lat, longitude: lng, heading = 0, accuracy } = pos.coords;
        caTargetRef.current  = { lat, lng };
        smoothHeadRef.current = smoothHeadRef.current * 0.72 + (heading || 0) * 0.28;
        setCaHeading(smoothHeadRef.current);

        // Compute ETA to target if not yet joined (MODE B or MODE A phase 1)
        if (caTarget && phase === PHASE.NAVIGATING_TO) {
          const dist = haversineKm(
            [lng, lat],
            [caTarget.lng, caTarget.lat],
          );
          setRemainingKm(+dist.toFixed(2));
          // crude ETA at ~4 km/h walk speed
          setEtaMinutes(Math.round((dist / 4) * 60));
        }
      },
      (err) => {
        console.error('[CA GPS]', err);
        setGpsError('GPS unavailable — location cannot be shared');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    return () => {
      if (gpsWatchRef.current != null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [caTarget, phase]); // eslint-disable-line

  // ── Push CA location to server every GPS_INTERVAL_MS ──────────────────────
  useEffect(() => {
    if (!bookingId) return;

    gpsIntervalRef.current = setInterval(() => {
      const pos = caTargetRef.current;
      if (!pos) return;
      dispatch(updateCareLocation({
        lat:       pos.lat,
        lng:       pos.lng,
        bookingId,
        status:    phase === PHASE.IN_TASK ? 'in_ride' : 'en_route_to_pickup',
      }));
    }, GPS_INTERVAL_MS);

    return () => {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, [bookingId, phase, dispatch]);

  // ── Smooth animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      // CA
      const caTarget_ = caTargetRef.current;
      if (caTarget_) {
        const cur = caPosRef.current || { ...caTarget_ };
        const newLat = lerp(cur.lat, caTarget_.lat, 0.12);
        const newLng = lerp(cur.lng, caTarget_.lng, 0.12);
        caPosRef.current = { lat: newLat, lng: newLng };
        setCaPos({ lat: newLat, lng: newLng });
      }
      // Driver (if joined)
      const drTarget = driverTargetRef.current;
      if (drTarget) {
        const cur = driverPosRef.current || { ...drTarget };
        const newLat = lerp(cur.lat, drTarget.lat, 0.10);
        const newLng = lerp(cur.lng, drTarget.lng, 0.10);
        driverPosRef.current = { lat: newLat, lng: newLng };
        setDriverPos({ lat: newLat, lng: newLng });
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // ── Socket: location_update (driver location, used after CA joined ride) ──
  useEffect(() => {
    if (!locationUpdate) return;
    dispatch(socketLocationUpdate(locationUpdate));
    const { lat, lng, heading = 0 } = locationUpdate;
    driverTargetRef.current = { lat, lng };
    driverSmoothHdRef.current = driverSmoothHdRef.current * 0.75 + heading * 0.25;
  }, [locationUpdate, dispatch]);

  // ── Socket: ETA ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!etaEvt) return;
    dispatch(socketEtaUpdate(etaEvt));
    if (etaEvt.etaMinutes          != null) setEtaMinutes(etaEvt.etaMinutes);
    if (etaEvt.distanceRemainingKm != null) setRemainingKm(etaEvt.distanceRemainingKm);
  }, [etaEvt, dispatch]);

  // ── Socket: ride status events ────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      on(EV.RIDE_STATUS_CHANGED, (d) => {
        dispatch(socketRideStatusChanged(d));
        setDriverRideStatus(d.status);
        if (d.rideStage) {
          dispatch(setCareRideWorkflow({
            rideStage: d.rideStage,
            activeNavigationTarget: d.activeNavigationTarget,
          }));
        }
      }),
      on('driver_arrived',  (d) => { dispatch(socketDriverArrived(d));  setDriverRideStatus('driver_arrived'); }),
      on('otp_verified',    (d) => { dispatch(socketOtpVerified(d));    setDriverRideStatus('otp_verified'); }),
      on('ride_started',    (d) => { dispatch(socketRideStarted(d));    setDriverRideStatus('in_progress'); }),
      on('ride_completed',  (d) => { dispatch(socketRideCompleted(d)); setDriverRideStatus('completed'); }),
      on('ride_cancelled',  (d) => { dispatch(socketRideCancelled(d)); setDriverRideStatus('cancelled'); }),
      on(EV.NAVIGATION_TARGET_CHANGED, (d) => { dispatch(socketNavigationTargetChanged(d)); }),
      on('hospital_eta_update', (d) => { dispatch(socketHospitalEtaUpdate(d)); }),
      on('care-assistant:ride:tracking', (d) => { dispatch(socketCareAssistantTracking(d)); }),
      on('care_assistant_joined_ride', (d) => {
        dispatch(setCareAssistantJoined(d));
        setPhase(PHASE.JOINED);
      }),
      on('care_assistant_attached_to_ride', (d) => {
        dispatch(setCareAssistantJoined(d));
        setPhase(PHASE.JOINED);
      }),
    ];
    return () => unsubs.forEach(fn => fn?.());
  }, []); // eslint-disable-line

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (connected) { if (pollTimerRef.current) clearInterval(pollTimerRef.current); return; }
    if (!rideId) return;
    pollTimerRef.current = setInterval(() => dispatch(fetchRideLive(rideId)), POLL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [connected, rideId, dispatch]);

  // ── Route calculation ─────────────────────────────────────────────────────
  const calcRoute = useCallback(async (origin, destination, setter) => {
    if (!dirServiceRef.current || !origin || !destination) return;
    if (routeCalcInFlight.current) return;
    routeCalcInFlight.current = true;
    try {
      const result = await dirServiceRef.current.route({
        origin, destination,
        travelMode:               window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      if (result.status === 'OK') setter(result);
    } catch (e) {
      console.error('[CA Route]', e);
    } finally {
      routeCalcInFlight.current = false;
    }
  }, []);

  // Recalc CA route when position or target changes
  useEffect(() => {
    if (!mapLoaded || !caPos || !caTarget) return;
    const now = Date.now();
    if (lastRouteCalcRef.current && now - lastRouteCalcRef.current < 30_000) return;
    lastRouteCalcRef.current = now;
    calcRoute(caPos, caTarget, setCaRoute);
  }, [caPos, caTarget, mapLoaded, calcRoute]);

  // Initial route + overview after map loads
  useEffect(() => {
    if (!mapLoaded) return;
    if (caPos && caTarget) calcRoute(caPos, caTarget, setCaRoute);
    if (pickupCoords && dropoffCoords) calcRoute(pickupCoords, dropoffCoords, setOverviewRoute);
  }, [mapLoaded]); // eslint-disable-line

  // Driver route after joining (MODE A)
  useEffect(() => {
    if (!mapLoaded || !isFullCare) return;
    if (![PHASE.JOINED, PHASE.IN_TASK].includes(phase)) return;
    if (!driverPos || !dropoffCoords) return;
    calcRoute(driverPos, dropoffCoords, setDriverRoute);
  }, [phase, driverPos, mapLoaded, isFullCare, dropoffCoords, calcRoute]);

  // ── AdvancedMarker: CA self ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !caPos) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!caMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML     = createCaMarkerHtml(caHeading);
      caMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map:      mapRef.current,
        content:  el,
        position: caPos,
        zIndex:   10,
        title:    'You (Care Assistant)',
      });
    } else {
      caMarkerRef.current.position = caPos;
      // Rotate the inner emoji-wrapper div
      const inner = caMarkerRef.current.content?.querySelector('div > div:last-child');
      if (inner) inner.style.transform = `rotate(${caHeading}deg)`;
    }

    if (followMode && mapRef.current) mapRef.current.panTo(caPos);
  }, [caPos, mapLoaded, caHeading, followMode]);

  // ── AdvancedMarker: Driver (after joining full_care) ──────────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCare) return;
    if (![PHASE.JOINED, PHASE.IN_TASK].includes(phase)) return;
    if (!driverPos) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML     = createDriverMarkerHtml();
      driverMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map:      mapRef.current,
        content:  el,
        position: driverPos,
        zIndex:   9,
        title:    'Driver',
      });
    } else {
      driverMarkerRef.current.position = driverPos;
    }
  }, [driverPos, mapLoaded, isFullCare, phase]);

  // ── Static markers (pickup, dropoff, waypoint) ────────────────────────────
  useEffect(() => {
    if (!mapLoaded || staticMarkersInit.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    let created = false;

    // Patient pickup
    if (pickupCoords && !pickupMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;width:0;height:0;';
      el.innerHTML     = createPinHtml('🏠', '#3b82f6', 'Patient');
      pickupMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: pickupCoords, zIndex: 5,
      });
      created = true;
    }

    // Hospital / destination
    if (dropoffCoords && !dropoffMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;width:0;height:0;';
      el.innerHTML     = createPinHtml('🏥', '#ef4444', 'Hospital');
      dropoffMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: dropoffCoords, zIndex: 5,
      });
      created = true;
    }

    // Waypoint (MODE A only)
    if (isFullCare && waypointCoords && !waypointMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;width:0;height:0;';
      el.innerHTML     = createPinHtml('🤝', '#8b5cf6', 'Join Here');
      waypointMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current, content: el, position: waypointCoords, zIndex: 6,
      });
      created = true;
    }

    if (created) staticMarkersInit.current = true;
  }, [mapLoaded, pickupCoords, dropoffCoords, isFullCare, waypointCoords]);

  // ── Fit bounds on first load ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    let count = 0;
    [caPos, pickupCoords, dropoffCoords, isFullCare ? waypointCoords : null]
      .filter(Boolean)
      .forEach(c => { bounds.extend(c); count++; });
    if (count > 0) mapRef.current.fitBounds(bounds, { top: 80, bottom: 200, left: 40, right: 40 });
  }, [mapLoaded]); // eslint-disable-line

  // ── Fullscreen listener ───────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      [caMarkerRef, driverMarkerRef, pickupMarkerRef, dropoffMarkerRef, waypointMarkerRef]
        .forEach(ref => { if (ref.current) { ref.current.map = null; ref.current = null; } });
      staticMarkersInit.current = false;
      if (animFrameRef.current)  cancelAnimationFrame(animFrameRef.current);
      if (pollTimerRef.current)  clearInterval(pollTimerRef.current);
      if (gpsWatchRef.current != null) navigator.geolocation?.clearWatch(gpsWatchRef.current);
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const onMapLoad = useCallback((map) => {
    mapRef.current        = map;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    setMapLoaded(true);
    setMapZoom(map.getZoom());
    map.addListener('zoom_changed', () => setMapZoom(map.getZoom()));
  }, []);

  const handleBack = useCallback(() => {
    if (window.history?.length > 1) router.back();
    else router.push('/care-assistant/bookings');
  }, [router]);

  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    const pos = caPos || caPosRef.current;
    if (pos && mapRef.current) { mapRef.current.panTo(pos); mapRef.current.setZoom(16); }
  }, [caPos]);

  const handleZoomIn  = useCallback(() => { if (mapRef.current) mapRef.current.setZoom(Math.min(mapRef.current.getZoom() + 1, 21)); }, []);
  const handleZoomOut = useCallback(() => { if (mapRef.current) mapRef.current.setZoom(Math.max(mapRef.current.getZoom() - 1, 3)); }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  const handleSos = useCallback(() => {
    setSosActive(p => !p);
    // Would dispatch triggerSos in real implementation
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────────────────────

  if (isInitLoading || !isLoaded) return <LoadingScreen />;
  if (showCompleted) return <CompletedScreen bookingType={bookingType} onBack={handleBack} />;

  const phaseCfg      = PHASE_CONFIG[phase]             || PHASE_CONFIG[PHASE.LOADING];
  const drStatusCfg   = DRIVER_STATUS_CONFIG[driverRideStatus] || null;
  const mapCenter     = caPos || pickupCoords || { lat: 16.506, lng: 80.648 };

  // Determine which routes to show
  const showCaRoute     = !!caRoute && [PHASE.NAVIGATING_TO, PHASE.ARRIVED_AT].includes(phase);
  const showDriverRoute = !!driverRoute && isFullCare && [PHASE.JOINED, PHASE.IN_TASK].includes(phase);
  const showOverview    = !!overviewRoute && [PHASE.JOINED, PHASE.IN_TASK].includes(phase);

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes caPulse { 0% { transform:scale(0.80); opacity:0.85; } 100% { transform:scale(2.0); opacity:0; } }
        @keyframes drvPulse { 0% { transform:scale(0.80); opacity:0.9; } 100% { transform:scale(2.0); opacity:0; } }
      `}</style>

      <div className="fixed inset-0 overflow-hidden font-poppins">

        {/* ── MAP ────────────────────────────────────────────────────────── */}
        <div className="absolute inset-0">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={15}
            options={{
              mapId:            MAP_ID,
              disableDefaultUI: true,
              clickableIcons:   false,
              gestureHandling:  'greedy',
              mapTypeId:        'roadmap',
            }}
            onLoad={onMapLoad}
            onDragStart={() => setFollowMode(false)}
          >
            {/* CA route: self → join point or patient pickup */}
            {showCaRoute && (
              <DirectionsRenderer
                directions={caRoute}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor:   '#ec4899',
                    strokeWeight:  5,
                    strokeOpacity: 0.9,
                    icons: [{
                      icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
                      offset: '0', repeat: '12px',
                    }],
                  },
                }}
              />
            )}

            {/* Overview route: pickup → hospital */}
            {showOverview && (
              <DirectionsRenderer
                directions={overviewRoute}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor:   'rgba(34,197,94,0.32)',
                    strokeWeight:  4,
                    strokeOpacity: 1,
                    icons: [{
                      icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                      offset: '0', repeat: '14px',
                    }],
                  },
                }}
              />
            )}

            {/* Driver route: driver → hospital (after CA joins) */}
            {showDriverRoute && (
              <DirectionsRenderer
                directions={driverRoute}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor:   '#22c55e',
                    strokeWeight:  6,
                    strokeOpacity: 0.88,
                  },
                }}
              />
            )}
          </GoogleMap>
        </div>

        {/* ── OFFLINE BANNER ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {!connected && (
            <motion.div
              initial={{ y: -48 }} animate={{ y: 0 }} exit={{ y: -48 }}
              className="absolute top-0 left-0 right-0 z-[50] flex items-center justify-center gap-2 py-2.5 text-xs font-bold bg-warning/95 text-warning-content"
            >
              <WifiOff size={13} />
              Reconnecting — location sharing may be delayed
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── GPS ERROR ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {gpsError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute top-[52px] left-3 right-3 z-40 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold"
              style={{ background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.30)', color: '#ef4444' }}
            >
              <AlertTriangle size={13} />
              {gpsError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ────────────────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-base-200/96 border-b border-base-300"
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center cursor-pointer text-base-content/60 bg-base-300 border border-base-300"
            >
              <ChevronLeft size={18} />
            </motion.button>

            {/* Connected dot */}
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: connected ? '#22c55e' : '#f59e0b',
                boxShadow:  connected ? '0 0 6px #22c55e' : 'none',
              }} />

            {/* Phase status */}
            <StatusPill
              icon={phaseCfg.icon}
              label={phaseCfg.label}
              color={phaseCfg.color}
              bg={`${phaseCfg.color}18`}
              border={`${phaseCfg.color}44`}
              pulse={phase === PHASE.NAVIGATING_TO}
            />

            {/* Driver status (full_care after joined) */}
            {isFullCare && drStatusCfg && [PHASE.JOINED, PHASE.IN_TASK].includes(phase) && (
              <StatusPill
                icon={drStatusCfg.icon}
                label={drStatusCfg.label}
                color={drStatusCfg.color}
                bg={`${drStatusCfg.color}18`}
                border={`${drStatusCfg.color}44`}
              />
            )}

            {/* ETA */}
            {etaMinutes != null && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <Clock size={11} className="text-pink-400" />
                <span className="text-xs font-black text-pink-400">{fmtEta(etaMinutes)}</span>
              </div>
            )}
            {remainingKm != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Navigation size={11} className="text-base-content/40" />
                <span className="text-xs font-semibold text-base-content/50">{fmtKm(remainingKm)}</span>
              </div>
            )}
          </motion.div>

          {/* Mode label strip */}
          <AnimatePresence>
            {phase === PHASE.NAVIGATING_TO && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 border-b border-base-300"
                style={{ background: 'rgba(139,92,246,0.08)', backdropFilter: 'blur(8px)' }}
              >
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
                  <Navigation size={12} style={{ color: '#8b5cf6' }} />
                </motion.div>
                <span className="text-xs font-bold" style={{ color: '#8b5cf6' }}>
                  {isFullCare
                    ? 'Navigate to meet the driver at the join point'
                    : 'Navigate to patient pickup location'}
                </span>
              </motion.div>
            )}
            {isFullCare && phase === PHASE.JOINED && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 border-b border-base-300"
                style={{ background: 'rgba(6,182,212,0.08)', backdropFilter: 'blur(8px)' }}
              >
                <Truck size={12} style={{ color: '#06b6d4' }} />
                <span className="text-xs font-bold" style={{ color: '#06b6d4' }}>
                  Joined ride — tracking driver live
                </span>
              </motion.div>
            )}
            {phase === PHASE.IN_TASK && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 border-b border-base-300"
                style={{ background: 'rgba(34,197,94,0.08)', backdropFilter: 'blur(8px)' }}
              >
                <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Activity size={12} style={{ color: '#22c55e' }} />
                </motion.div>
                <span className="text-xs font-bold" style={{ color: '#22c55e' }}>
                  Task in progress — care being provided
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FABs ───────────────────────────────────────────────────────── */}
        <div className="absolute top-[120px] right-3 z-20 flex flex-col gap-2">
          <FabBtn onClick={handleRecenter} active={followMode} title="Re-center on me">
            <Navigation size={16} />
          </FabBtn>
          <FabBtn onClick={handleZoomIn}   title="Zoom in">
            <Plus  size={17} strokeWidth={2.5} />
          </FabBtn>
          <FabBtn onClick={handleZoomOut}  title="Zoom out">
            <Minus size={17} strokeWidth={2.5} />
          </FabBtn>
          <FabBtn onClick={handleFullscreen} active={isFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </FabBtn>
          <FabBtn onClick={handleSos} danger active={sosActive} title="SOS">
            {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
          </FabBtn>
          {!connected && (
            <FabBtn onClick={() => rideId && dispatch(fetchRideLive(rideId))} title="Refresh">
              <RefreshCw size={15} />
            </FabBtn>
          )}
        </div>

        {/* ── MAP LEGEND ─────────────────────────────────────────────────── */}
        {mapLoaded && (
          <div className="absolute bottom-[96px] left-3 z-20 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-base-200/85 border border-base-300 text-[10px] font-bold text-pink-400 backdrop-blur-sm">
              <span>👩‍⚕️</span> You
            </div>
            {isFullCare && [PHASE.JOINED, PHASE.IN_TASK].includes(phase) && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-base-200/85 border border-base-300 text-[10px] font-bold text-success backdrop-blur-sm">
                <span>🚗</span> Driver
              </div>
            )}
            <div className="px-2.5 py-1 rounded-xl bg-base-200/80 border border-base-300 text-[10px] font-bold text-base-content/40 font-mono backdrop-blur-sm">
              z{mapZoom}
            </div>
          </div>
        )}

        {/* ── SOS ACTIVE BANNER ──────────────────────────────────────────── */}
        <AnimatePresence>
          {sosActive && (
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-[92px] left-4 right-4 z-40 flex items-center gap-3 p-4 rounded-2xl bg-error border border-error/70 shadow-[0_8px_32px_rgba(239,68,68,0.55)]"
            >
              <ShieldAlert size={20} className="text-error-content flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-error-content m-0">SOS Alert Sent!</p>
                <p className="text-xs text-error-content/80 m-0">Admin and emergency contacts notified.</p>
              </div>
              <button onClick={() => setSosActive(false)} className="text-error-content/70 hover:text-error-content cursor-pointer bg-transparent border-none">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOTTOM SHEET ───────────────────────────────────────────────── */}
        <BottomSheet
          open={sheetOpen}
          onToggle={() => setSheetOpen(p => !p)}
          phase={phase}
          bookingType={bookingType || 'care_assistant'}
          booking={booking}
          rideStatus={driverRideStatus}
          driverSnapshot={driverSnapshot}
          vehicleSnapshot={vehicleSnapshot}
          etaMin={etaMinutes}
          distKm={remainingKm}
          patientPhone={patientPhone}
          onAction={onAction}
          actionLabel={actionLabel}
          actionIcon={actionIcon}
          actionColor={actionColor}
          actionLoading={actionLoading}
          actionDisabled={false}
        />

      </div>
    </>
  );
}