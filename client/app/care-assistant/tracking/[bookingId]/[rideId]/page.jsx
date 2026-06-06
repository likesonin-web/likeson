'use client';

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap } from '@react-google-maps/api';
import {
  Navigation, MapPin, Phone, User, Clock, Zap,
  WifiOff, Volume2, VolumeX, Compass, ChevronLeft,
  ChevronDown, Maximize2, Shield, ShieldAlert,
  Loader2, CheckCircle, AlertCircle, Car, Heart,
  X, ArrowUp, ArrowLeft, ArrowRight, RotateCcw,
  Minus, Plus, Route, PersonStanding, Flag,
  Activity, Radio,
} from 'lucide-react';

import { useGoogleMaps } from '@/context/GoogleMapsProvider';
import { useSocket } from '@/context/SocketProvider';
import { useDriverMarker, createStaticMarker } from '@/hooks/useDriverMarker';
import { useMapCamera } from '@/hooks/useMapCamera';
import { useRouteRenderer } from '@/hooks/useRouteRenderer';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
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
  fetchCareTrackingSnapshot,
  selectCareTrackingSnapshot,
  selectCaJoinPoint,
  clearCareRideState,
  setCareAssistantStatus,
  setCareAssistantJoined,
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

const CA_STATUS_CFG = {
  not_joined:           { label: 'Not Joined',      color: 'var(--base-content)', bg: 'var(--base-300)', border: 'var(--base-300)',         dot: '#94a3b8' },
  en_route_to_pickup:   { label: 'En Route',         color: 'var(--info)',         bg: 'rgba(99,179,237,0.12)', border: 'rgba(99,179,237,0.35)',  dot: '#3b82f6' },
  at_pickup:            { label: 'At Pickup',        color: 'var(--warning)',      bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', dot: '#f59e0b' },
  in_ride:              { label: 'In Ride',          color: 'var(--success)',      bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  dot: '#22c55e' },
  departed:             { label: 'Departed',         color: 'var(--secondary)',    bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)', dot: '#8b5cf6' },
};

const RIDE_STATUS_CFG = {
  driver_assigned:  { label: 'Driver Assigned',  color: 'var(--warning)',   bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)' },
  driver_accepted:  { label: 'Accepted',         color: 'var(--primary)',   bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)' },
  driver_en_route:  { label: 'Driver En Route',  color: 'var(--info)',      bg: 'rgba(99,179,237,0.12)',  border: 'rgba(99,179,237,0.35)' },
  driver_arrived:   { label: 'Driver Arrived',   color: 'var(--accent)',    bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.35)' },
  otp_verified:     { label: 'OTP Verified',     color: 'var(--success)',   bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)'  },
  in_progress:      { label: 'In Progress',      color: 'var(--success)',   bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)'  },
  at_stop:          { label: 'At Stop',          color: 'var(--secondary)', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)' },
  completed:        { label: 'Completed',        color: 'var(--base-content)', bg: 'var(--base-300)',     border: 'var(--base-300)'       },
  cancelled:        { label: 'Cancelled',        color: 'var(--error)',     bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'  },
};

const MANEUVER_ICONS = {
  'turn-left':  (sz) => <ArrowLeft  size={sz} />,
  'turn-right': (sz) => <ArrowRight size={sz} />,
  'keep-left':  (sz) => <ArrowLeft  size={sz} style={{ opacity: 0.75 }} />,
  'keep-right': (sz) => <ArrowRight size={sz} style={{ opacity: 0.75 }} />,
  'u-turn':     (sz) => <RotateCcw  size={sz} />,
  'roundabout': (sz) => <RotateCcw  size={sz} />,
  'straight':   (sz) => <ArrowUp    size={sz} />,
  'merge':      (sz) => <ArrowUp    size={sz} />,
};

// ─────────────────────────────────────────────────────────────────────────────
// POLYLINE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function drawDriverPolyline(map, encodedPolyline) {
  if (!map || !encodedPolyline || !window.google?.maps?.geometry?.encoding) return null;
  try {
    const path = window.google.maps.geometry.encoding.decodePath(encodedPolyline);
    return new window.google.maps.Polyline({
      path,
      map,
      strokeColor:   '#3b82f6',
      strokeOpacity: 0.75,
      strokeWeight:  5,
      zIndex:        5,
    });
  } catch (e) {
    console.error('[drawDriverPolyline]', e);
    return null;
  }
}

function drawCaToJoinPolyline(map, pathPoints) {
  if (!map || !pathPoints?.length) return null;
  try {
    return new window.google.maps.Polyline({
      path:          pathPoints,
      map,
      strokeColor:   '#ec4899',
      strokeOpacity: 0,
      strokeWeight:  0,
      icons: [{
        icon:   { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 4, scale: 4, strokeColor: '#ec4899' },
        offset: '0',
        repeat: '20px',
      }],
      zIndex: 6,
    });
  } catch (e) {
    console.error('[drawCaToJoinPolyline]', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 bg-base-100 flex flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary"
      />
      <p className="text-sm text-base-content/50 font-semibold">Loading tracking…</p>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NAV INSTRUCTION CARD
// ─────────────────────────────────────────────────────────────────────────────

const NavInstructionCard = memo(function NavInstructionCard({ step, stepIndex, distanceMeters }) {
  if (!step) return null;
  const type   = getManeuverIcon(step.maneuver || step.instruction || '');
  const IconFn = MANEUVER_ICONS[type] || MANEUVER_ICONS.straight;
  const dist   = (distanceMeters && distanceMeters > 0) ? distanceMeters : (step.distanceMeters ?? 0);
  const distColor = dist < 50 ? 'bg-error' : dist < 200 ? 'bg-warning' : 'bg-success';

  return (
    <motion.div
      key={stepIndex}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3 items-center px-3 py-2.5 rounded-xl bg-base-100 border border-base-300/60"
    >
      <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${distColor}`}>
        <span className="text-white">{IconFn(20)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-content truncate m-0 leading-tight">{step.instruction}</p>
        <p className="text-xs font-bold mt-0.5 m-0 text-base-content/55">
          {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
        </p>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// JOIN POINT BANNER
// ─────────────────────────────────────────────────────────────────────────────

const JoinPointBanner = memo(function JoinPointBanner({ joinPoint, caStatus, distToJoinKm }) {
  if (!joinPoint) return null;
  const zone = joinPoint.zone?.replace(/_/g, ' ') || 'join point';
  const dist = distToJoinKm != null ? distToJoinKm : joinPoint.distCaToJoinKm;
  const isCompleted = joinPoint.isCompleted || caStatus === 'in_ride';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="mx-2 mt-1 px-3 py-2.5 rounded-xl flex items-center gap-2.5"
      style={{
        background: isCompleted ? 'rgba(34,197,94,0.10)' : 'rgba(59,130,246,0.10)',
        border: `1px solid ${isCompleted ? 'rgba(34,197,94,0.30)' : 'rgba(59,130,246,0.30)'}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
        style={{ background: isCompleted ? 'rgba(34,197,94,0.20)' : 'rgba(59,130,246,0.20)' }}
      >
        {isCompleted
          ? <CheckCircle size={16} style={{ color: '#22c55e' }} />
          : <Route size={16} style={{ color: '#3b82f6' }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content m-0 capitalize">
          {isCompleted ? 'Joined the ride ✓' : `Heading to ${zone}`}
        </p>
        {!isCompleted && dist != null && (
          <p className="text-[10px] text-base-content/50 m-0 mt-0.5 font-semibold">
            {dist < 1 ? `${Math.round(dist * 1000)}m to join point` : `${dist.toFixed(1)}km to join point`} — wait for driver
          </p>
        )}
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER LIVE CARD
// ─────────────────────────────────────────────────────────────────────────────

const DriverLiveCard = memo(function DriverLiveCard({ driverLocation, driverSnapshot, vehicleSnapshot, etaMinutes }) {
  if (!driverLocation && !driverSnapshot) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-2 px-3 py-2.5 rounded-xl flex items-center gap-3"
      style={{
        background: 'rgba(59,130,246,0.07)',
        border: '1px solid rgba(59,130,246,0.20)',
      }}
    >
      <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center bg-primary/15">
        <Car size={16} style={{ color: 'var(--primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content m-0 truncate">
          {driverSnapshot?.legalName || 'Driver'} · {vehicleSnapshot?.registrationNumber || '—'}
        </p>
        <p className="text-[10px] text-base-content/50 m-0 mt-0.5 font-semibold">
          {etaMinutes != null ? `ETA to join point: ${etaMinutes} min` : 'Driver tracking live'}
        </p>
      </div>
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const BottomSheet = memo(function BottomSheet({
  open, onToggle, bookingType, caStatus, rideStatus,
  patientInfo, customerPhone, pickup, dropoff,
  bookingCode, joinPoint, etaMinutes, distanceKm: distKm,
  driverSnapshot, vehicleSnapshot,
}) {
  const statusCfg   = CA_STATUS_CFG[caStatus]   || CA_STATUS_CFG.not_joined;
  const rideCfg     = RIDE_STATUS_CFG[rideStatus] || {};
  const isCareOnly  = bookingType === 'care_assistant';
  const isFullCare  = bookingType === 'full_care_ride';

  const Row = ({ label, value, mono, accent }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between items-center py-1.5 border-b border-base-300/40 last:border-0">
        <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-semibold ${mono ? 'font-mono tracking-wider' : ''}`}
          style={accent ? { color: 'var(--primary)' } : { color: 'var(--base-content)', opacity: 0.75 }}>
          {value}
        </span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 80px)' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl bg-base-200 border border-base-300 border-b-0"
      style={{
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.40)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Handle */}
      <button
        onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer px-4 pt-3.5 pb-2.5 flex flex-col items-center"
        aria-label={open ? 'Collapse' : 'Expand'}
      >
        <div className="w-10 h-1.5 rounded-full bg-base-300 mb-3" />
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-bold text-base-content">
            {isCareOnly ? 'Care Assignment' : 'Full Care Ride'}
          </span>
          <div className="flex items-center gap-2">
            {caStatus && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                {statusCfg.label}
              </span>
            )}
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} className="text-base-content/30" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Content */}
      <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(80vh - 84px)' }}>

        {(patientInfo || customerPhone) && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-3 bg-base-300/50 border border-base-300">
            <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--secondary))' }}>
              <User size={17} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-base-content m-0 truncate">
                {patientInfo?.name || 'Patient'}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5 m-0">
                {customerPhone || patientInfo?.phone || '—'}
              </p>
            </div>
            {customerPhone && (
              <a href={`tel:${customerPhone}`}
                className="w-10 h-10 rounded-xl flex items-center justify-center no-underline"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.30)', color: '#22c55e' }}
                aria-label="Call patient">
                <Phone size={15} />
              </a>
            )}
          </div>
        )}

        {/* Route card */}
        <div className="p-3.5 rounded-2xl mb-3 bg-base-300/50 border border-base-300">
          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-3">Route</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-success border-2 border-base-100" />
              <div className="w-0.5 flex-1 bg-base-300 min-h-[20px]" />
              {isFullCare && joinPoint && (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-base-100" />
                  <div className="w-0.5 flex-1 bg-base-300 min-h-[20px]" />
                </>
              )}
              <div className="w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100" />
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div>
                <p className="text-xs font-semibold text-base-content m-0 truncate">Your location</p>
                <p className="text-[10px] text-base-content/38 mt-0.5 m-0">Start</p>
              </div>
              {isFullCare && joinPoint && (
                <div>
                  <p className="text-xs font-bold m-0 truncate" style={{ color: 'var(--primary)' }}>
                    Join Point · {joinPoint.zone?.replace(/_/g, ' ') || 'Route Waypoint'}
                  </p>
                  <p className="text-[10px] text-base-content/38 mt-0.5 m-0">Wait for driver here</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-base-content m-0 truncate">
                  {pickup?.address || pickup?.label || 'Pickup location'}
                </p>
                <p className="text-[10px] text-base-content/38 mt-0.5 m-0">
                  {isCareOnly ? 'Patient' : 'Destination'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver info for full_care_ride */}
        {isFullCare && driverSnapshot && (
          <div className="p-3.5 rounded-2xl mb-3 bg-base-300/50 border border-base-300">
            <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2">Driver</p>
            <Row label="Name"    value={driverSnapshot.legalName} />
            <Row label="Phone"   value={driverSnapshot.phone} />
            <Row label="Vehicle" value={vehicleSnapshot?.make ? `${vehicleSnapshot.make} ${vehicleSnapshot.model || ''}`.trim() : null} />
            <Row label="Reg No." value={vehicleSnapshot?.registrationNumber} mono />
            {rideStatus && (
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Ride Status</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  style={{ background: rideCfg.bg, borderColor: rideCfg.border, color: rideCfg.color }}
                >
                  {rideCfg.label}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Booking info */}
        <div className="p-3.5 rounded-2xl bg-base-300/50 border border-base-300">
          <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2">Booking</p>
          <Row label="Code" value={bookingCode} mono />
          <Row label="Type" value={bookingType?.replace(/_/g, ' ')} />
          {distKm != null && <Row label="Distance" value={`${distKm.toFixed(1)} km`} />}
          {etaMinutes != null && <Row label="ETA" value={`${etaMinutes} min`} accent />}
          {joinPoint?.distCaToJoinKm != null && (
            <Row label="To Join Point" value={`${joinPoint.distCaToJoinKm.toFixed(1)} km`} />
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const CompletedScreen = memo(function CompletedScreen({ bookingType, onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] bg-base-100 flex flex-col items-center justify-center px-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', damping: 14, stiffness: 220 }}
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.30)' }}
      >
        <Heart size={44} style={{ color: '#22c55e' }} />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2"
      >
        {bookingType === 'care_assistant' ? 'Task Completed!' : 'Ride Completed!'}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-sm text-base-content/50 text-center m-0 mb-8"
      >
        Great work! Your care assignment is done.
      </motion.p>
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBack}
        className="btn btn-primary btn-lg rounded-2xl px-10 font-bold"
        style={{ fontFamily: 'inherit' }}
      >
        Back to Bookings
      </motion.button>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CA MARKER
// ─────────────────────────────────────────────────────────────────────────────

function createCaMarker(map, lat, lng) {
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return null;

  const anchor = document.createElement('div');
  anchor.style.cssText = 'position:absolute;width:0;height:0;overflow:visible;pointer-events:none;';

  const style = document.createElement('style');
  style.textContent = `
    @keyframes caPulse {
      0%   { transform:scale(0.85);opacity:0.75; }
      70%  { transform:scale(2.0); opacity:0; }
      100% { transform:scale(2.0); opacity:0; }
    }
  `;

  const pulse = document.createElement('div');
  pulse.style.cssText = `
    position:absolute;width:56px;height:56px;
    left:-28px;top:-28px;border-radius:50%;
    background:rgba(236,72,153,0.22);
    animation:caPulse 2.2s ease-out infinite;
    pointer-events:none;
  `;

  const bubble = document.createElement('div');
  bubble.style.cssText = `
    position:absolute;
    width:44px;height:44px;
    left:-22px;top:-22px;
    background:linear-gradient(135deg,#ec4899,#f43f5e);
    border-radius:50%;
    border:2.5px solid rgba(255,255,255,0.9);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 18px rgba(236,72,153,0.65),0 1px 4px rgba(0,0,0,0.3);
    will-change:transform;
    pointer-events:none;
    z-index:2;
  `;
  bubble.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
    </svg>
  `;

  anchor.appendChild(style);
  anchor.appendChild(pulse);
  anchor.appendChild(bubble);

  return new window.google.maps.marker.AdvancedMarkerElement({
    map,
    content:  anchor,
    position: { lat, lng },
    zIndex:   25,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JOIN POINT MARKER
// ─────────────────────────────────────────────────────────────────────────────

function createJoinPointMarker(map, lat, lng) {
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return null;

  const anchor = document.createElement('div');
  anchor.style.cssText = 'position:absolute;width:0;height:0;overflow:visible;pointer-events:none;';
  anchor.innerHTML = `
    <div style="
      position:absolute;
      display:flex;flex-direction:column;align-items:center;
      left:-20px;top:-62px;
      pointer-events:none;
    ">
      <div style="
        width:40px;height:40px;
        background:linear-gradient(135deg,#3b82f6,#6366f1);
        border-radius:50%;border:3px solid #fff;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 18px rgba(59,130,246,0.55);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #3b82f6;margin-top:-1px;"></div>
      <div style="
        background:#3b82f6;color:#fff;
        padding:2px 8px;border-radius:20px;
        font-size:9px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;
        white-space:nowrap;margin-top:2px;
        box-shadow:0 3px 10px rgba(0,0,0,0.25);
        font-family:system-ui,sans-serif;
      ">Join Point</div>
    </div>
  `;

  return new window.google.maps.marker.AdvancedMarkerElement({
    map,
    content:  anchor,
    position: { lat, lng },
    zIndex:   15,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CareAssistantLiveTracking() {
  const params    = useParams();
  const router    = useRouter();
  const dispatch  = useDispatch();
  const bookingId = params?.bookingId;
  const rideId    = params?.rideId;

  // ── External hooks ────────────────────────────────────────────────────────
  const { isLoaded } = useGoogleMaps();
  const {
    on, connected, SOCKET_EVENTS: EV,
    joinBookingRoom, leaveBookingRoom,
    startCareGpsTracking, stopCareGpsTracking,
    emitCareLocation, requestBookingState,
  } = useSocket();

  // ── Redux selectors ───────────────────────────────────────────────────────
  const reduxSnapshot  = useSelector(selectCareTrackingSnapshot);
  const reduxJoinPoint = useSelector(selectCaJoinPoint);

  // ── Map refs ──────────────────────────────────────────────────────────────
  const mapRef          = useRef(null);
  const mapLoadedRef    = useRef(false);
  const dirServiceRef   = useRef(null);

  // Markers
  const caMarkerRef        = useRef(null);
  const driverMarkerRef    = useRef(null);
  const pickupMarkerRef    = useRef(null);
  const joinPointMarkerRef = useRef(null);
  const staticMadeRef      = useRef(false);

  // ── Polyline refs for manual overlays ────────────────────────────────────
  const driverPolylineRef   = useRef(null);
  const caToJoinPolylineRef = useRef(null);

  // Kalman
  const kalmanRef = useRef(createKalmanFilter());

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const { updateMarker: updateDriverMarker, destroyMarker: destroyDriverMarker } = useDriverMarker(mapRef, mapLoadedRef);
  const {
    updateCamera, recenter, resetToNorth,
    zoomIn, zoomOut, initCameraListeners,
    mapBearingRef, followModeRef,
  } = useMapCamera(mapRef);
  const {
    setRoute, updateProgress, clearRoute, routePointsRef,
  } = useRouteRenderer(mapRef);
  const {
    voiceEnabled, toggleVoice,
    speak, announceManeuver, announceArrival,
    announceRerouting, resetManeuverBands,
  } = useVoiceNavigation();

  // ── App state ─────────────────────────────────────────────────────────────
  const [snapshot,       setSnapshot]       = useState(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isOffline,      setIsOffline]      = useState(false);
  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [followMode,     setFollowMode]     = useState(true);
  const [isRerouting,    setIsRerouting]    = useState(false);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [showCompleted,  setShowCompleted]  = useState(false);
  const [sosActive,      setSosActive]      = useState(false);
  const [gpsError,       setGpsError]       = useState(null);
  const [arrivedSpoken,  setArrivedSpoken]  = useState(false);
  const [snapshotError,  setSnapshotError]  = useState(null);

  // Live state from socket
  const [caPosition,    setCaPosition]    = useState(null);
  const [caStatus,      setCaStatus]      = useState('not_joined');
  const [driverPos,     setDriverPos]     = useState(null);
  const [rideStatus,    setRideStatus]    = useState(null);
  const [rideStage,     setRideStage]     = useState(null);
  const [etaUpdate,     setEtaUpdate]     = useState(null);
  const [joinPointData, setJoinPointData] = useState(null);
  const [bookingType,   setBookingType]   = useState(null);

  // Nav
  const [navSteps,       setNavSteps]       = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stepDistMeters, setStepDistMeters] = useState(0);

  // Off-route
  const offRouteCountRef   = useRef(0);
  const lastRerouteRef     = useRef(0);
  const navStepsRef        = useRef([]);
  const stepIdxRef         = useRef(0);
  const arrivedRef         = useRef(false);
  navStepsRef.current      = navSteps;
  stepIdxRef.current       = currentStepIdx;
  arrivedRef.current       = arrivedSpoken;

  // GPS watch
  const gpsWatchRef   = useRef(null);
  const lastPosRef    = useRef(null);
  const lastSetAt     = useRef(0);
  const mountedRef    = useRef(true);

  // Track if initial route calculated
  const routeCalculatedRef = useRef(false);

  // Track if driver polyline has been drawn
  const driverPolylineDrawnRef = useRef(false);

  // ── Derived from snapshot ─────────────────────────────────────────────────
  const snap       = snapshot || reduxSnapshot;
  const ride       = snap?.ride;
  const bkType     = bookingType || snap?.bookingType;
  const isCareOnly = bkType === 'care_assistant';
  const isFullCare = bkType === 'full_care_ride';

  // Merge Redux joinPoint into local state
  useEffect(() => {
    if (reduxJoinPoint && !joinPointData) {
      setJoinPointData(reduxJoinPoint);
    }
  }, [reduxJoinPoint, joinPointData]);

  // ── Navigation target ─────────────────────────────────────────────────────
  const navTarget = useMemo(() => {
    if (isCareOnly) {
      const patientLoc = snap?.route?.patientLocation;
      if (patientLoc?.coordinates) {
        const c = patientLoc.coordinates;
        return { lat: c[1], lng: c[0] };
      }
      const c = ride?.dropoff?.coordinates || ride?.pickup?.coordinates;
      return c ? { lat: c[1], lng: c[0] } : null;
    }
    if (isFullCare && joinPointData?.coordinates) {
      const c = joinPointData.coordinates;
      if (Array.isArray(c) && c.length >= 2) return { lat: c[1], lng: c[0] };
      if (c?.lat) return c;
    }
    return null;
  }, [isCareOnly, isFullCare, ride, joinPointData, snap]);

  // ── Pickup coords for static marker ──────────────────────────────────────
  const pickupCoords = useMemo(() => {
    if (isCareOnly) {
      const patientLoc = snap?.route?.patientLocation;
      if (patientLoc?.coordinates) {
        const c = patientLoc.coordinates;
        return { lat: c[1], lng: c[0] };
      }
      const c = ride?.dropoff?.coordinates || ride?.pickup?.coordinates;
      return c ? { lat: c[1], lng: c[0] } : null;
    }
    const c = snap?.route?.pickup?.coordinates || ride?.pickup?.coordinates;
    return c ? { lat: c[1], lng: c[0] } : null;
  }, [isCareOnly, isFullCare, ride, snap]);

  // ── Driver live location from snapshot (full_care_ride) ───────────────────
  const snapshotDriverLoc = useMemo(() => {
    if (!isFullCare) return null;
    const loc = snap?.driver?.liveLocation;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng, heading: loc.heading ?? 0, speed: loc.speedKmh ?? 0 };
  }, [isFullCare, snap]);

  // ── Expected route polyline from snapshot (full_care_ride driver route) ───
  const expectedPolyline = useMemo(() => {
    return snap?.route?.expectedPolyline ?? null;
  }, [snap]);

  // ── Fetch snapshot via Redux thunk ────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    setIsLoading(true);
    setSnapshotError(null);

    dispatch(fetchCareTrackingSnapshot({ bookingId }))
      .unwrap()
      .then((data) => {
        if (!mountedRef.current) return;
        setSnapshot(data);
        setBookingType(data?.bookingType);
        if (data?.careAssistant?.status) setCaStatus(data.careAssistant.status);
        if (data?.route?.caJoinWaypoint)  setJoinPointData(data.route.caJoinWaypoint);
        if (data?.rideStatus)  setRideStatus(data.rideStatus);
        if (data?.rideStage)   setRideStage(data.rideStage);
        if (data?.driver?.liveLocation) {
          const loc = data.driver.liveLocation;
          setDriverPos({ lat: loc.lat, lng: loc.lng, heading: loc.heading ?? 0, speed: loc.speedKmh ?? 0 });
        }
        routeCalculatedRef.current = false;
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        console.error('[CaTracking] snapshot failed:', err);
        setSnapshotError(err?.message || 'Failed to load tracking data');
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [bookingId, dispatch]);

  // ── Socket room + state snapshot ─────────────────────────────────────────
  useEffect(() => {
    if (!connected || !bookingId) return;
    joinBookingRoom(bookingId);
    requestBookingState(bookingId);
    return () => leaveBookingRoom(bookingId);
  }, [connected, bookingId]); // eslint-disable-line

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!EV) return;
    const unsubs = [
      on(EV.LOCATION_UPDATE, (d) => {
        if (!mountedRef.current) return;
        setDriverPos({ lat: d.lat, lng: d.lng, heading: d.heading, speed: d.speed });
        setEtaUpdate(d);
      }),

      on(EV.ETA_UPDATE, (d) => {
        if (!mountedRef.current) return;
        setEtaUpdate(d);
      }),

      on(EV.RIDE_STATUS_CHANGED, (d) => {
        if (!mountedRef.current) return;
        setRideStatus(d.status);
        if (d.rideStage) setRideStage(d.rideStage);
        if (['completed', 'cancelled'].includes(d.status)) {
          setTimeout(() => { if (mountedRef.current) setShowCompleted(true); }, 1500);
        }
      }),

      on(EV.NAVIGATION_TARGET_CHANGED, (d) => {
        if (!mountedRef.current) return;
        if (d.caJoinPoint) {
          setJoinPointData(d.caJoinPoint);
          routeCalculatedRef.current = false;
        }
      }),

      on(EV.CARE_ASSISTANT_STATUS_CHANGE, (d) => {
        if (!mountedRef.current) return;
        if (d.careAssistantStatus) {
          setCaStatus(d.careAssistantStatus);
          dispatch(setCareAssistantStatus(d));
        }
      }),

      on(EV.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        if (!mountedRef.current) return;
        setCaStatus('in_ride');
        dispatch(setCareAssistantJoined(d));
        if (d.caJoinPoint) setJoinPointData(prev => ({ ...prev, isCompleted: true }));
        speak('You have joined the ride.', { force: true });
      }),

      on(EV.CARE_ASSISTANT_ATTACHED, (d) => {
        if (!mountedRef.current) return;
        if (d.caJoinPoint) {
          setJoinPointData(d.caJoinPoint);
          routeCalculatedRef.current = false;
          speak('Join point updated. Navigate to the new join point.', { force: true });
        }
      }),

      on(EV.BOOKING_STATE_SNAPSHOT, (d) => {
        if (!mountedRef.current) return;
        if (d.bookingId !== bookingId) return;
        setSnapshot(prev => ({ ...prev, ...d }));
        if (d.bookingType) setBookingType(d.bookingType);
        if (d.tracking?.careAssistantStatus) setCaStatus(d.tracking.careAssistantStatus);
        if (d.ride?.status) setRideStatus(d.ride.status);
        if (d.ride?.rideStage) setRideStage(d.ride.rideStage);
        if (d.ride?.liveLocation) {
          const loc = d.ride.liveLocation;
          if (loc?.coordinates?.length === 2) {
            setDriverPos({ lat: loc.coordinates[1], lng: loc.coordinates[0], heading: loc.heading ?? 0, speed: loc.speedKmh ?? 0 });
          }
        }
        setIsLoading(false);
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [on, EV, bookingId, speak, dispatch]); // eslint-disable-line

  // ── CA GPS tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('GPS not supported');
      return;
    }

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, accuracy } = pos.coords;
        const rawSpeed = pos.coords.speed;
        const speedKmh = rawSpeed != null && rawSpeed >= 0 ? +(rawSpeed * 3.6).toFixed(1) : 0;

        let computedHeading = heading;
        if ((computedHeading == null) && lastPosRef.current) {
          const prev = lastPosRef.current;
          computedHeading = ((Math.atan2(lng - prev.lng, lat - prev.lat) * 180) / Math.PI + 360) % 360;
        }

        const position = { lat, lng, heading: +(computedHeading ?? 0).toFixed(1), speed: speedKmh, accuracy: accuracy ?? null };
        lastPosRef.current = position;

        const now = Date.now();
        if (now - lastSetAt.current > 1000) {
          lastSetAt.current = now;
          if (mountedRef.current) setCaPosition({ ...position });
        }

        emitCareLocation({ bookingId, lat, lng, heading: position.heading, speed: speedKmh, status: caStatus });

        if (mountedRef.current && gpsError) setGpsError(null);
      },
      (err) => {
        if (!mountedRef.current) return;
        if (err.code === err.PERMISSION_DENIED) setGpsError('GPS permission denied');
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsError('GPS signal unavailable');
        else setGpsError('GPS timeout. Retrying…');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [bookingId]); // eslint-disable-line

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (gpsWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
      }
      destroyDriverMarker();
      [caMarkerRef, joinPointMarkerRef, pickupMarkerRef].forEach(ref => {
        if (ref.current) { ref.current.map = null; ref.current = null; }
      });
      if (driverPolylineRef.current) { driverPolylineRef.current.setMap(null); driverPolylineRef.current = null; }
      if (caToJoinPolylineRef.current) { caToJoinPolylineRef.current.setMap(null); caToJoinPolylineRef.current = null; }
      clearRoute();
      dispatch(clearCareRideState());
    };
  }, [destroyDriverMarker, clearRoute, dispatch]);

  // ── Offline detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const onOff = () => setIsOffline(true);
    const onOn  = () => setIsOffline(false);
    window.addEventListener('offline', onOff);
    window.addEventListener('online',  onOn);
    return () => { window.removeEventListener('offline', onOff); window.removeEventListener('online', onOn); };
  }, []);

  // ── Follow mode sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setFollowMode(followModeRef.current), 500);
    return () => clearInterval(t);
  }, [followModeRef]);

  // ── Map load ──────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current       = map;
    mapLoadedRef.current = true;
    dirServiceRef.current = new window.google.maps.DirectionsService();
    initCameraListeners(map);
    setMapLoaded(true);
  }, [initCameraListeners]);

  // ── Static markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !pickupCoords || pickupMarkerRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;
    pickupMarkerRef.current = createStaticMarker(mapRef.current, pickupCoords.lat, pickupCoords.lng, 'pickup');
  }, [mapLoaded, pickupCoords]);

  // ── Update join point marker when joinPointData changes ──────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCare || !joinPointData?.coordinates) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const c   = joinPointData.coordinates;
    const lat = Array.isArray(c) ? c[1] : c.lat;
    const lng = Array.isArray(c) ? c[0] : c.lng;
    if (!lat || !lng) return;

    if (joinPointMarkerRef.current) {
      joinPointMarkerRef.current.position = { lat, lng };
    } else if (mapRef.current) {
      joinPointMarkerRef.current = createJoinPointMarker(mapRef.current, lat, lng);
      if (!pickupMarkerRef.current && pickupCoords) {
        pickupMarkerRef.current = createStaticMarker(mapRef.current, pickupCoords.lat, pickupCoords.lng, 'pickup');
      }
    }
  }, [mapLoaded, isFullCare, joinPointData, pickupCoords]);

  // ── Draw driver route polyline (full_care_ride) ───────────────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCare || !expectedPolyline) return;
    if (!window.google?.maps?.geometry?.encoding) return;

    if (driverPolylineRef.current) {
      driverPolylineRef.current.setMap(null);
      driverPolylineRef.current = null;
    }

    driverPolylineRef.current = drawDriverPolyline(mapRef.current, expectedPolyline);
    driverPolylineDrawnRef.current = true;
  }, [mapLoaded, isFullCare, expectedPolyline]);

  // ── Update CA marker (self) ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !caPosition) return;

    if (!caMarkerRef.current && window.google?.maps?.marker?.AdvancedMarkerElement) {
      caMarkerRef.current = createCaMarker(mapRef.current, caPosition.lat, caPosition.lng);
    } else if (caMarkerRef.current) {
      caMarkerRef.current.position = { lat: caPosition.lat, lng: caPosition.lng };
    }
  }, [mapLoaded, caPosition]);

  // ── Update driver marker (full_care_ride) ─────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !isFullCare) return;
    const pos = driverPos || snapshotDriverLoc;
    if (!pos) return;
    updateDriverMarker(pos.lat, pos.lng, pos.heading ?? 0, mapBearingRef.current, pos.speed ?? 0);
  }, [mapLoaded, isFullCare, driverPos, snapshotDriverLoc, updateDriverMarker, mapBearingRef]);

  // ── Route calculation (CA walking route) ──────────────────────────────────
  // FIX: decode step polylines via geometry.encoding instead of relying on
  // step.path (SDK LatLng objects — not always present in directions response).
  const calculateRoute = useCallback(async (origin, destination) => {
    if (!dirServiceRef.current || !origin || !destination) return;
    if (!mapLoaded) return;
    setIsRerouting(true);
    try {
      const result = await dirServiceRef.current.route({
        origin,
        destination,
        travelMode:               window.google.maps.TravelMode.WALKING,
        provideRouteAlternatives: false,
      });
      if (result.status === 'OK') {
        const steps = parseDirectionSteps(result.routes?.[0]?.legs);
        setNavSteps(steps);
        setCurrentStepIdx(0);
        resetManeuverBands();

        if (isCareOnly) {
          // care_assistant: render as primary route via hook (traversed/remaining lines)
          setRoute(result, 'toPickup');
        } else {
          // full_care_ride: draw CA→joinPoint as dashed pink polyline separately
          // Remove old line first
          if (caToJoinPolylineRef.current) {
            caToJoinPolylineRef.current.setMap(null);
            caToJoinPolylineRef.current = null;
          }

          // Extract path — decode from encoded polyline string (works in all envs)
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg?.steps) {
            const pathPoints = [];
            leg.steps.forEach(step => {
              if (step.polyline?.points && window.google?.maps?.geometry?.encoding) {
                // Decode encoded polyline — most reliable approach
                const decoded = window.google.maps.geometry.encoding.decodePath(step.polyline.points);
                decoded.forEach(pt => pathPoints.push({ lat: pt.lat(), lng: pt.lng() }));
              } else if (step.path?.length) {
                // SDK LatLng array (sometimes present)
                step.path.forEach(pt => pathPoints.push({ lat: pt.lat(), lng: pt.lng() }));
              } else {
                // Fallback: start + end of each step
                if (step.start_location) {
                  const slat = typeof step.start_location.lat === 'function' ? step.start_location.lat() : step.start_location.lat;
                  const slng = typeof step.start_location.lng === 'function' ? step.start_location.lng() : step.start_location.lng;
                  pathPoints.push({ lat: slat, lng: slng });
                }
                if (step.end_location) {
                  const elat = typeof step.end_location.lat === 'function' ? step.end_location.lat() : step.end_location.lat;
                  const elng = typeof step.end_location.lng === 'function' ? step.end_location.lng() : step.end_location.lng;
                  pathPoints.push({ lat: elat, lng: elng });
                }
              }
            });

            if (pathPoints.length > 1) {
              caToJoinPolylineRef.current = drawCaToJoinPolyline(mapRef.current, pathPoints);
            }
          }

          // Also populate routePointsRef for off-route detection
          // Use 'toPickup' — valid routeType (avoids silent no-op from unknown 'caToJoin')
          setRoute(result, 'toPickup');
        }

        routeCalculatedRef.current = true;
      }
    } catch (e) {
      console.error('[CaRoute]', e);
    } finally {
      if (mountedRef.current) setIsRerouting(false);
    }
  }, [mapLoaded, setRoute, resetManeuverBands, isCareOnly]);

  // ── Calculate initial route when map + position + target ready ───────────
  useEffect(() => {
    if (!mapLoaded || !caPosition || !navTarget) return;
    if (routeCalculatedRef.current) return;
    calculateRoute({ lat: caPosition.lat, lng: caPosition.lng }, navTarget);
  }, [mapLoaded, caPosition, navTarget, joinPointData, calculateRoute]);

  // Reset routeCalculatedRef when navTarget changes
  const prevNavTargetRef = useRef(null);
  useEffect(() => {
    if (!navTarget) return;
    const prev = prevNavTargetRef.current;
    if (!prev || Math.abs(prev.lat - navTarget.lat) > 0.0001 || Math.abs(prev.lng - navTarget.lng) > 0.0001) {
      routeCalculatedRef.current = false;
    }
    prevNavTargetRef.current = navTarget;
  }, [navTarget]);

  // Also reset when joinPointData coordinates change (full_care_ride async arrival)
  const prevJoinPointRef = useRef(null);
  useEffect(() => {
    if (!isFullCare || !joinPointData?.coordinates) return;
    const c = joinPointData.coordinates;
    const lat = Array.isArray(c) ? c[1] : c.lat;
    const lng = Array.isArray(c) ? c[0] : c.lng;
    if (!lat || !lng) return;
    const prev = prevJoinPointRef.current;
    if (!prev || Math.abs(prev.lat - lat) > 0.0001 || Math.abs(prev.lng - lng) > 0.0001) {
      routeCalculatedRef.current = false;
    }
    prevJoinPointRef.current = { lat, lng };
  }, [isFullCare, joinPointData]);

  // ── Main GPS → marker + camera + nav ─────────────────────────────────────
  useEffect(() => {
    if (!caPosition || !mapLoaded) return;

    const filtered = kalmanRef.current.update(caPosition.lat, caPosition.lng, caPosition.accuracy || 10, Date.now());
    const { lat, lng } = filtered;

    updateCamera(lat, lng, caPosition.heading, caPosition.speed);

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
        announceManeuver(step.instruction, distM, idx, caPosition.speed);
        if (distM < STEP_ADVANCE_METERS && idx < steps.length - 1) {
          setCurrentStepIdx(idx + 1);
        }
      }

      // Off-route detection
      if (routePointsRef.current?.length && caPosition.speed > 2) {
        const snap      = snapToPolyline(lat, lng, routePointsRef.current);
        const si        = snap.segmentIndex;
        const pts       = routePointsRef.current;
        const segBearing = si < pts.length - 1
          ? bearingDeg(pts[si].lat, pts[si].lng, pts[si + 1].lat, pts[si + 1].lng)
          : caPosition.heading;

        const score = offRouteScore(snap.distanceOffRouteKm, caPosition.heading, segBearing, caPosition.speed);
        if (score > OFF_ROUTE_THRESHOLD) {
          offRouteCountRef.current++;
          if (offRouteCountRef.current >= OFF_ROUTE_CONFIRM_COUNT
            && Date.now() - lastRerouteRef.current > REROUTE_COOLDOWN_MS
            && navTarget) {
            offRouteCountRef.current = 0;
            lastRerouteRef.current   = Date.now();
            routeCalculatedRef.current = false;
            announceRerouting();
            calculateRoute({ lat, lng }, navTarget);
          }
        } else {
          offRouteCountRef.current = 0;
        }
      }
    }

    // Arrival at target
    if (navTarget && !arrivedRef.current) {
      const d = distanceKm(lat, lng, navTarget.lat, navTarget.lng);
      if (d < ARRIVAL_THRESHOLD_KM) {
        if (isCareOnly) {
          announceArrival('pickup');
          speak('You have arrived at the patient location.', { force: true });
        } else {
          speak('You have reached the join point. Wait for the driver here.', { force: true });
        }
        setArrivedSpoken(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caPosition, mapLoaded]);

  // ── Recenter ──────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (caPosition) {
      recenter(caPosition.lat, caPosition.lng, caPosition.heading);
      setFollowMode(true);
    }
  }, [caPosition, recenter]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/care/bookings');
  }, [router]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentStep  = navSteps[currentStepIdx] || null;
  const etaMinutes   = etaUpdate?.etaMinutes;
  const remainingKm  = etaUpdate?.distanceRemainingKm;
  const speedKmh     = caPosition?.speed ?? 0;
  const statusCfg    = CA_STATUS_CFG[caStatus] || CA_STATUS_CFG.not_joined;

  const distToJoin = useMemo(() => {
    if (!caPosition || !joinPointData?.coordinates) return null;
    const c   = joinPointData.coordinates;
    const lat = Array.isArray(c) ? c[1] : c.lat;
    const lng = Array.isArray(c) ? c[0] : c.lng;
    if (!lat || !lng) return null;
    return distanceKm(caPosition.lat, caPosition.lng, lat, lng);
  }, [caPosition, joinPointData]);

  const distToPickup = useMemo(() => {
    if (!caPosition || !pickupCoords) return null;
    return distanceKm(caPosition.lat, caPosition.lng, pickupCoords.lat, pickupCoords.lng);
  }, [caPosition, pickupCoords]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (isLoading || !isLoaded) return <LoadingSkeleton />;
  if (showCompleted)          return <CompletedScreen bookingType={bkType} onBack={handleBack} />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes caPulse {
          0%   { transform:scale(0.85);opacity:0.75; }
          70%  { transform:scale(2.0); opacity:0; }
          100% { transform:scale(2.0); opacity:0; }
        }
        @keyframes sosPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.7); }
          50%      { box-shadow:0 0 0 10px rgba(239,68,68,0); }
        }
        @keyframes jpPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.6); }
          50%      { box-shadow:0 0 0 12px rgba(59,130,246,0); }
        }
      `}</style>

      <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-family-poppins, sans-serif)' }}>

        {/* ── MAP ─────────────────────────────────────────────────── */}
        <div className="absolute inset-0">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={caPosition || pickupCoords || { lat: 16.506, lng: 80.648 }}
            zoom={15}
            options={{
              mapId:            MAP_ID,
              disableDefaultUI: true,
              clickableIcons:   false,
              gestureHandling:  'greedy',
              mapTypeId:        'roadmap',
              tilt:             0,
            }}
            onLoad={onMapLoad}
          />
        </div>

        {/* ── OFFLINE BANNER ──────────────────────────────────────── */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ y: -44 }} animate={{ y: 0 }} exit={{ y: -44 }}
              className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
              style={{ background: 'var(--error)', color: 'var(--error-content)', paddingTop: 'max(env(safe-area-inset-top,0px),10px)' }}
              role="alert"
            >
              <WifiOff size={13} /> No internet — tracking paused
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SNAPSHOT ERROR BANNER ────────────────────────────────── */}
        <AnimatePresence>
          {snapshotError && (
            <motion.div
              initial={{ y: -44 }} animate={{ y: 0 }} exit={{ y: -44 }}
              className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.92)', color: '#fff', paddingTop: 'max(env(safe-area-inset-top,0px),10px)' }}
              role="alert"
            >
              <AlertCircle size={13} /> {snapshotError} — showing cached data
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ─────────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

          {/* Status row */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-base-100"
          >
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleBack}
              className="w-8 h-8 rounded-xl bg-base-200 flex-shrink-0 flex items-center justify-center cursor-pointer text-base-content/70"
              aria-label="Go back"
            >
              <ChevronLeft size={17} />
            </motion.button>

            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-success animate-pulse' : 'bg-error animate-pulse'}`} />

            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-base-300 text-base-content/60 flex-shrink-0">
              {isCareOnly ? '♥ Care' : '⚡ Full Care Ride'}
            </span>

            {caStatus && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full flex-shrink-0 text-[10px] font-bold uppercase tracking-widest border"
                style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                {statusCfg.label}
              </span>
            )}

            {etaMinutes != null && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock size={11} className="text-base-content/40" />
                <span className="text-xs font-bold text-base-content">{formatEta(etaMinutes)}</span>
              </div>
            )}

            {speedKmh > 2 && (
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <Zap size={11} style={{ color: '#facc15' }} />
                <span className="text-[11px] font-bold tabular-nums text-base-content/80">
                  {formatSpeed(speedKmh)}<span className="text-[9px] ml-0.5 opacity-55">km/h</span>
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

          {/* Join point banner (full_care_ride) */}
          <AnimatePresence>
            {isFullCare && (
              <JoinPointBanner
                joinPoint={joinPointData}
                caStatus={caStatus}
                distToJoinKm={distToJoin}
              />
            )}
          </AnimatePresence>

          {/* Driver live card (full_care_ride) */}
          <AnimatePresence>
            {isFullCare && (driverPos || snapshotDriverLoc || snap?.driver) && (
              <DriverLiveCard
                driverLocation={driverPos || snapshotDriverLoc}
                driverSnapshot={snap?.driver?.snapshot || snap?.driver}
                vehicleSnapshot={snap?.driver?.vehicleSnapshot}
                etaMinutes={etaMinutes}
              />
            )}
          </AnimatePresence>

          {/* Rerouting banner */}
          <AnimatePresence>
            {isRerouting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 mx-2 mt-1 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', color: '#f59e0b' }}
                role="status"
              >
                <RotateCcw size={12} className="animate-spin" /> Recalculating route…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── GPS ERROR ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {gpsError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
              style={{
                top: 140, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}
              role="alert"
            >
              <AlertCircle size={12} /> {gpsError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── WAITING FOR DRIVER badge (full_care_ride at_pickup) ── */}
        <AnimatePresence>
          {isFullCare && caStatus === 'at_pickup' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute z-25 left-1/2 flex flex-col items-center gap-1.5"
              style={{ transform: 'translateX(-50%)', bottom: 160 }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.40)',
                  color: 'var(--primary)',
                  animation: 'jpPulse 2s ease-in-out infinite',
                }}
              >
                <Radio size={14} className="animate-pulse" />
                Waiting for driver at join point
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LEFT FABs ─────────────────────────────────────────────── */}
        <div className="absolute z-20 flex flex-col gap-2.5" style={{ top: 180, left: 12 }}>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleRecenter}
            aria-label="Re-center map"
            style={{
              width: 44, height: 44, borderRadius: 13,
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

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => { resetToNorth(); setFollowMode(false); }}
            aria-label="Reset to north"
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: 44, height: 44, borderRadius: 13,
              background: 'rgba(20,26,40,0.88)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
              color: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Compass size={16} />
          </motion.button>

          <motion.button whileTap={{ scale: 0.88 }} onClick={zoomIn} aria-label="Zoom in"
            style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(20,26,40,0.88)', border: '1.5px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)' }}>
            <Plus size={16} />
          </motion.button>

          <motion.button whileTap={{ scale: 0.88 }} onClick={zoomOut} aria-label="Zoom out"
            style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(20,26,40,0.88)', border: '1.5px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)' }}>
            <Minus size={16} />
          </motion.button>
        </div>

        {/* ── RIGHT FABs ────────────────────────────────────────────── */}
        <div className="absolute z-20 flex flex-col gap-2.5" style={{ top: 180, right: 12 }}>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Mute voice' : 'Enable voice'}
            style={{
              width: 44, height: 44, borderRadius: 13,
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

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setSosActive(true);
              emitCareLocation({ bookingId, lat: caPosition?.lat, lng: caPosition?.lng, status: 'sos' });
              setTimeout(() => setSosActive(false), 8000);
            }}
            aria-label="SOS emergency"
            style={{
              width: 44, height: 44, borderRadius: 13,
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

          {navTarget && caPosition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                width: 44, height: 44, borderRadius: 13,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(20,26,40,0.88)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Flag size={12} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                {(() => {
                  const d = isFullCare && distToJoin != null
                    ? distToJoin
                    : distToPickup != null
                      ? distToPickup
                      : distanceKm(caPosition.lat, caPosition.lng, navTarget.lat, navTarget.lng);
                  return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}k`;
                })()}
              </span>
            </motion.div>
          )}
        </div>

        {/* ── STATUS CONTEXT PILL ───────────────────────────────────── */}
        <AnimatePresence>
          {isCareOnly && caStatus === 'en_route_to_pickup' && caPosition && pickupCoords && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute z-25 left-1/2"
              style={{ transform: 'translateX(-50%)', bottom: 155 }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap"
                style={{
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.35)',
                  color: '#10b981',
                }}
              >
                <PersonStanding size={13} />
                Navigating to patient
                {distToPickup != null && (
                  <span className="opacity-70 ml-1">
                    · {distToPickup < 1
                      ? `${Math.round(distToPickup * 1000)}m`
                      : `${distToPickup.toFixed(1)}km`} away
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isFullCare && caStatus === 'en_route_to_pickup' && caPosition && joinPointData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute z-25 left-1/2"
              style={{ transform: 'translateX(-50%)', bottom: 155 }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  color: '#3b82f6',
                }}
              >
                <Route size={13} />
                Navigating to join point
                {distToJoin != null && (
                  <span className="opacity-70 ml-1">
                    · {distToJoin < 1
                      ? `${Math.round(distToJoin * 1000)}m`
                      : `${distToJoin.toFixed(1)}km`} away
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOTTOM SHEET ─────────────────────────────────────────── */}
        <BottomSheet
          open={sheetOpen}
          onToggle={() => setSheetOpen(p => !p)}
          bookingType={bkType}
          caStatus={caStatus}
          rideStatus={rideStatus}
          patientInfo={snap?.ride?.booking?.patientInfo || snap?.careAssistant}
          customerPhone={snap?.ride?.booking?.customer?.phone}
          pickup={snap?.ride?.dropoff || snap?.route?.patientLocation}
          dropoff={snap?.route?.dropoff}
          bookingCode={snap?.bookingId}
          joinPoint={joinPointData}
          etaMinutes={etaMinutes}
          distanceKm={remainingKm}
          driverSnapshot={snap?.driver?.snapshot || snap?.driver}
          vehicleSnapshot={snap?.driver?.vehicleSnapshot}
        />

      </div>
    </>
  );
}