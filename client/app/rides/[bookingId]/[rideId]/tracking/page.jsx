'use client';

/**
 * RideLiveTracking.jsx — Likeson.in
 * PRODUCTION v2 — Google Maps Advanced Markers + 3D SVG vehicles
 *
 * ENV:
 *   NEXT_PUBLIC_GOOGLE_MAPS_KEY       = AIzaSy...
 *   NEXT_PUBLIC_MAP_ID                = 53b37ff1ce3093072bb1c62b
 *   NEXT_PUBLIC_SOCKET_URL            = http://localhost:5050
 *
 * Stack: Next.js · Redux · @react-google-maps/api · Framer Motion · Lucide · Tailwind
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import {
  GoogleMap,
  Polyline,
  OverlayView,
} from '@react-google-maps/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Share2, Shield, ShieldAlert, Navigation2, MapPin,
  Clock, Star, ChevronUp, ChevronDown, X, Wifi, WifiOff,
  Car, User, CheckCircle2, AlertCircle, RotateCcw, Locate,
  Info, Calendar, CreditCard, Bike, Truck, Bus,
} from 'lucide-react';

import {
  fetchRideTracking, fetchRideLive,
  socketLocationUpdate, socketEtaUpdate, socketRideStatusChanged,
  socketNavigationTargetChanged, socketDriverEnRoute, socketDriverArrived,
  socketOtpVerified, socketRideStarted, socketRideCompleted, socketRideCancelled,
  selectCurrentRide, selectSocketLive, selectTrackingData, selectLiveData,
  selectNavigationTarget, selectEta, selectRideStatus, selectLiveLocation,
} from '@/store/slices/rideRequestSlice';

import {
  fetchMyBookingById,
  selectSelectedBooking,
} from '@/store/slices/bookingSlice';

import { useBookingRoom, useSocket } from '@/context/SocketProvider';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_STYLES_DARK = [
  { elementType: 'geometry',            stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry',        stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road.highway', elementType: 'geometry',        stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'water', elementType: 'geometry',        stylers: [{ color: '#0c1a2e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
];

const MAP_STYLES_LIGHT = [
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road',         elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'water',     elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
];

const STATUS_STEP = {
  driver_assigned: 1, driver_accepted: 2, driver_en_route: 3,
  driver_arrived: 4,  otp_verified: 5,    in_progress: 6,
  at_stop: 6, completed: 7, cancelled: -1,
};

const TIMELINE_STEPS = [
  { label: 'Confirmed',      icon: CheckCircle2 },
  { label: 'Assigned',       icon: User },
  { label: 'Accepted',       icon: CheckCircle2 },
  { label: 'En Route',       icon: Navigation2 },
  { label: 'Arrived',        icon: MapPin },
  { label: 'OTP Verified',   icon: CheckCircle2 },
  { label: 'In Progress',    icon: Car },
  { label: 'Completed',      icon: CheckCircle2 },
];

// ─── Vehicle Type Resolver ────────────────────────────────────────────────────

function getVehicleCategory(type = '') {
  const t = (type || '').toLowerCase();
  if (t.includes('bike') || t.includes('scooter') || t.includes('motorcycle') || t.includes('two'))
    return 'bike';
  if (t.includes('auto') || t.includes('rickshaw') || t.includes('tuk'))
    return 'auto';
  if (t.includes('ambulance'))
    return 'ambulance';
  if (t.includes('bus') || t.includes('minibus') || t.includes('tempo traveller'))
    return 'bus';
  if (t.includes('van') || t.includes('minivan') || t.includes('mortuary'))
    return 'van';
  if (t.includes('truck') || t.includes('suv') || t.includes('muv') || t.includes('crossover'))
    return 'suv';
  if (t.includes('wheelchair'))
    return 'wheelchair';
  return 'car'; // sedan, hatchback, cab, default
}

// ─── 3D SVG Vehicle Icons ─────────────────────────────────────────────────────

function Vehicle3DSVG({ category, size = 52, color = '#6366f1', shadow = true }) {
  const s = size;

  const svgs = {
    bike: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* shadow */}
        {shadow && <ellipse cx="26" cy="48" rx="14" ry="3" fill="rgba(0,0,0,0.18)" />}
        {/* rear wheel */}
        <circle cx="12" cy="38" r="9" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="12" cy="38" r="5" fill="#0f172a" stroke={color} strokeWidth="1.5"/>
        {/* front wheel */}
        <circle cx="40" cy="38" r="9" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="40" cy="38" r="5" fill="#0f172a" stroke={color} strokeWidth="1.5"/>
        {/* frame */}
        <path d="M12 38 L22 20 L32 28 L40 38" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M22 20 L32 20 L40 28" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        {/* handlebar */}
        <path d="M36 20 L44 20" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
        {/* seat */}
        <rect x="18" y="17" width="10" height="4" rx="2" fill={color} opacity="0.9"/>
        {/* rider */}
        <circle cx="24" cy="13" r="5" fill={color} opacity="0.85"/>
        <path d="M20 18 Q24 22 28 18" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* glow */}
        <circle cx="26" cy="26" r="22" fill={color} opacity="0.04"/>
      </svg>
    ),

    auto: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="16" ry="3" fill="rgba(0,0,0,0.18)" />}
        {/* body */}
        <path d="M6 34 L6 24 L14 14 L38 14 L46 24 L46 34 Z" fill={color} opacity="0.9"/>
        {/* roof open */}
        <path d="M14 14 L20 8 L36 8 L38 14" fill={color} opacity="0.6"/>
        <path d="M20 8 L36 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        {/* windshield */}
        <path d="M16 22 L22 15 L36 15 L40 22 Z" fill="rgba(147,197,253,0.4)" stroke="rgba(147,197,253,0.6)" strokeWidth="1"/>
        {/* side panel depth */}
        <path d="M6 24 L10 24 L10 34 L6 34 Z" fill="rgba(0,0,0,0.2)"/>
        {/* wheels */}
        <circle cx="14" cy="36" r="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
        <circle cx="14" cy="36" r="3.5" fill="#0f172a" stroke={color} strokeWidth="1.2"/>
        <circle cx="38" cy="36" r="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
        <circle cx="38" cy="36" r="3.5" fill="#0f172a" stroke={color} strokeWidth="1.2"/>
        {/* headlight */}
        <ellipse cx="44" cy="26" rx="2" ry="3" fill="#fef08a" opacity="0.9"/>
        {/* stripe */}
        <rect x="6" y="28" width="40" height="3" fill="rgba(255,255,255,0.12)" rx="1"/>
      </svg>
    ),

    car: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="18" ry="3.5" fill="rgba(0,0,0,0.2)" />}
        {/* car body base */}
        <path d="M4 30 L4 22 L10 12 L42 12 L48 22 L48 30 L48 36 L4 36 Z" fill={color}/>
        {/* body highlight top */}
        <path d="M4 22 L10 12 L42 12 L48 22 Z" fill="rgba(255,255,255,0.15)"/>
        {/* cabin */}
        <path d="M12 22 L16 13 L36 13 L40 22 Z" fill="rgba(147,197,253,0.35)" stroke="rgba(147,197,253,0.5)" strokeWidth="0.8"/>
        {/* side depth */}
        <path d="M4 22 L8 22 L8 36 L4 36 Z" fill="rgba(0,0,0,0.25)"/>
        <path d="M44 22 L48 22 L48 36 L44 36 Z" fill="rgba(0,0,0,0.15)"/>
        {/* door lines */}
        <line x1="26" y1="22" x2="26" y2="35" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
        {/* undercarriage */}
        <rect x="4" y="34" width="44" height="4" rx="2" fill="rgba(0,0,0,0.3)"/>
        {/* front wheel */}
        <circle cx="38" cy="37" r="8" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="38" cy="37" r="4.5" fill="#0f172a"/>
        <circle cx="38" cy="37" r="2.5" fill={color} opacity="0.7"/>
        {/* rear wheel */}
        <circle cx="14" cy="37" r="8" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="14" cy="37" r="4.5" fill="#0f172a"/>
        <circle cx="14" cy="37" r="2.5" fill={color} opacity="0.7"/>
        {/* headlights */}
        <ellipse cx="46" cy="24" rx="2" ry="2.5" fill="#fef08a" opacity="0.95"/>
        <ellipse cx="46" cy="29" rx="1.5" ry="2" fill="#fef08a" opacity="0.6"/>
        {/* tail lights */}
        <ellipse cx="5" cy="25" rx="1.5" ry="2.5" fill="#f87171" opacity="0.9"/>
        {/* chrome trim */}
        <path d="M4 30 L48 30" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      </svg>
    ),

    suv: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="18" ry="3.5" fill="rgba(0,0,0,0.22)" />}
        {/* boxy body */}
        <path d="M3 32 L3 20 L8 10 L44 10 L49 20 L49 32 L49 38 L3 38 Z" fill={color}/>
        <path d="M3 20 L8 10 L44 10 L49 20 Z" fill="rgba(255,255,255,0.18)"/>
        {/* tall cabin */}
        <path d="M10 20 L13 11 L39 11 L42 20 Z" fill="rgba(147,197,253,0.35)" stroke="rgba(147,197,253,0.5)" strokeWidth="0.8"/>
        {/* side panels */}
        <path d="M3 20 L7 20 L7 38 L3 38 Z" fill="rgba(0,0,0,0.25)"/>
        <path d="M45 20 L49 20 L49 38 L45 38 Z" fill="rgba(0,0,0,0.18)"/>
        {/* roof rails */}
        <rect x="11" y="10" width="30" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>
        {/* undercarriage */}
        <rect x="3" y="36" width="46" height="4" rx="2" fill="rgba(0,0,0,0.3)"/>
        {/* big wheels */}
        <circle cx="38" cy="39" r="9" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="38" cy="39" r="5" fill="#0f172a"/>
        <circle cx="38" cy="39" r="2.5" fill={color} opacity="0.7"/>
        <circle cx="14" cy="39" r="9" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="14" cy="39" r="5" fill="#0f172a"/>
        <circle cx="14" cy="39" r="2.5" fill={color} opacity="0.7"/>
        {/* headlights */}
        <rect x="46" y="21" width="3" height="5" rx="1" fill="#fef08a" opacity="0.95"/>
        <rect x="3" y="22" width="3" height="4" rx="1" fill="#f87171" opacity="0.9"/>
      </svg>
    ),

    ambulance: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="18" ry="3.5" fill="rgba(0,0,0,0.22)" />}
        {/* white body */}
        <path d="M3 32 L3 20 L8 10 L44 10 L49 20 L49 32 L49 38 L3 38 Z" fill="white"/>
        <path d="M3 20 L8 10 L44 10 L49 20 Z" fill="rgba(230,230,230,0.9)"/>
        {/* red stripe */}
        <rect x="3" y="24" width="46" height="6" fill="#ef4444"/>
        {/* cross */}
        <rect x="22" y="12" width="8" height="18" rx="2" fill="#ef4444"/>
        <rect x="16" y="18" width="20" height="6" rx="2" fill="#ef4444"/>
        {/* blue lights */}
        <rect x="10" y="8" width="8" height="4" rx="2" fill="#3b82f6" opacity="0.9"/>
        <rect x="34" y="8" width="8" height="4" rx="2" fill="#3b82f6" opacity="0.9"/>
        {/* windows */}
        <path d="M10 20 L13 12 L39 12 L42 20 Z" fill="rgba(147,197,253,0.4)"/>
        {/* side panels depth */}
        <path d="M3 20 L7 20 L7 38 L3 38 Z" fill="rgba(0,0,0,0.1)"/>
        {/* undercarriage */}
        <rect x="3" y="36" width="46" height="4" rx="2" fill="rgba(0,0,0,0.2)"/>
        {/* wheels */}
        <circle cx="38" cy="39" r="9" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="38" cy="39" r="5" fill="#0f172a"/><circle cx="38" cy="39" r="2.5" fill="#ef4444" opacity="0.7"/>
        <circle cx="14" cy="39" r="9" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="14" cy="39" r="5" fill="#0f172a"/><circle cx="14" cy="39" r="2.5" fill="#ef4444" opacity="0.7"/>
        {/* headlights */}
        <rect x="46" y="22" width="3" height="4" rx="1" fill="#fef08a" opacity="0.9"/>
      </svg>
    ),

    bus: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="20" ry="3" fill="rgba(0,0,0,0.2)" />}
        {/* long body */}
        <rect x="2" y="10" width="48" height="30" rx="4" fill={color}/>
        {/* windows row */}
        <rect x="6"  y="14" width="8" height="8" rx="2" fill="rgba(147,197,253,0.5)"/>
        <rect x="17" y="14" width="8" height="8" rx="2" fill="rgba(147,197,253,0.5)"/>
        <rect x="28" y="14" width="8" height="8" rx="2" fill="rgba(147,197,253,0.5)"/>
        <rect x="39" y="14" width="8" height="8" rx="2" fill="rgba(147,197,253,0.5)"/>
        {/* lower windows */}
        <rect x="6"  y="25" width="8" height="6" rx="1" fill="rgba(147,197,253,0.35)"/>
        <rect x="17" y="25" width="8" height="6" rx="1" fill="rgba(147,197,253,0.35)"/>
        <rect x="28" y="25" width="8" height="6" rx="1" fill="rgba(147,197,253,0.35)"/>
        {/* side depth */}
        <path d="M2 10 L2 40 L6 40 L6 10 Z" fill="rgba(0,0,0,0.2)"/>
        {/* undercarriage */}
        <rect x="2" y="38" width="48" height="4" rx="2" fill="rgba(0,0,0,0.3)"/>
        {/* wheels */}
        <circle cx="12" cy="42" r="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
        <circle cx="12" cy="42" r="3.5" fill="#0f172a"/>
        <circle cx="40" cy="42" r="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
        <circle cx="40" cy="42" r="3.5" fill="#0f172a"/>
        {/* headlight */}
        <rect x="47" y="15" width="3" height="8" rx="1" fill="#fef08a" opacity="0.9"/>
        {/* destination board */}
        <rect x="6" y="8" width="30" height="4" rx="1" fill="rgba(255,255,255,0.2)"/>
      </svg>
    ),

    van: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="18" ry="3.5" fill="rgba(0,0,0,0.2)" />}
        {/* boxy van */}
        <rect x="3" y="12" width="46" height="28" rx="3" fill={color}/>
        <path d="M3 12 L3 22 L12 22 L18 12 Z" fill="rgba(147,197,253,0.45)"/>
        {/* side door */}
        <rect x="22" y="14" width="16" height="20" rx="2" fill="rgba(0,0,0,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
        {/* side panel depth */}
        <path d="M3 12 L6 12 L6 40 L3 40 Z" fill="rgba(0,0,0,0.22)"/>
        {/* undercarriage */}
        <rect x="3" y="37" width="46" height="4" rx="2" fill="rgba(0,0,0,0.3)"/>
        {/* wheels */}
        <circle cx="38" cy="40" r="8.5" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="38" cy="40" r="4.5" fill="#0f172a"/>
        <circle cx="38" cy="40" r="2" fill={color} opacity="0.6"/>
        <circle cx="14" cy="40" r="8.5" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="14" cy="40" r="4.5" fill="#0f172a"/>
        <circle cx="14" cy="40" r="2" fill={color} opacity="0.6"/>
        {/* headlights */}
        <rect x="47" y="18" width="3" height="6" rx="1" fill="#fef08a" opacity="0.9"/>
        <rect x="2"  y="18" width="3" height="6" rx="1" fill="#f87171" opacity="0.9"/>
      </svg>
    ),

    wheelchair: (
      <svg width={s} height={s} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        {shadow && <ellipse cx="26" cy="49" rx="18" ry="3.5" fill="rgba(0,0,0,0.2)" />}
        {/* van body */}
        <rect x="3" y="12" width="46" height="28" rx="3" fill={color}/>
        <path d="M3 12 L3 22 L12 22 L18 12 Z" fill="rgba(147,197,253,0.45)"/>
        {/* wheelchair ramp symbol */}
        <path d="M20 30 L32 20 L44 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
        <circle cx="38" cy="25" r="3" fill="white" opacity="0.8"/>
        {/* side panel */}
        <path d="M3 12 L6 12 L6 40 L3 40 Z" fill="rgba(0,0,0,0.22)"/>
        {/* undercarriage */}
        <rect x="3" y="37" width="46" height="4" rx="2" fill="rgba(0,0,0,0.3)"/>
        {/* wheels */}
        <circle cx="38" cy="40" r="8.5" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="38" cy="40" r="4.5" fill="#0f172a"/>
        <circle cx="14" cy="40" r="8.5" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
        <circle cx="14" cy="40" r="4.5" fill="#0f172a"/>
        {/* headlights */}
        <rect x="47" y="18" width="3" height="6" rx="1" fill="#fef08a" opacity="0.9"/>
      </svg>
    ),
  };

  return svgs[category] || svgs.car;
}

// ─── Lerp helpers ─────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff >  180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

// ─── Decode polyline ──────────────────────────────────────────────────────────

function decodePolyline(encoded) {
  if (!encoded) return [];
  const path = []; let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}

function statusLabel(status) {
  const map = {
    searching: 'Finding your driver…', driver_assigned: 'Driver assigned',
    driver_accepted: 'Driver accepted',  driver_en_route: 'Driver on the way',
    driver_arrived: 'Driver has arrived', otp_verified: 'Ride starting',
    in_progress: 'Ride in progress', at_stop: 'Stopped at waypoint',
    completed: 'Ride completed',  cancelled: 'Ride cancelled',
  };
  return map[status] || status || '—';
}

function Shimmer({ className = '' }) {
  return <div className={`skeleton animate-pulse bg-base-300 rounded-xl ${className}`} />;
}

// ─── 3D Vehicle Overlay ───────────────────────────────────────────────────────

function VehicleMarker3D({ position, heading = 0, vehicleType = '', isPulsing = false }) {
  const category = getVehicleCategory(vehicleType);

  // Color based on vehicle category
  const colorMap = {
    bike:       '#f59e0b',
    auto:       '#10b981',
    car:        '#6366f1',
    suv:        '#8b5cf6',
    ambulance:  '#ef4444',
    bus:        '#0ea5e9',
    van:        '#64748b',
    wheelchair: '#06b6d4',
  };
  const color = colorMap[category] || '#6366f1';

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={() => ({ x: -26, y: -42 })}
    >
      <div className="relative flex flex-col items-center select-none" style={{ pointerEvents: 'none' }}>
        {/* Pulse rings when stopped/arrived */}
        {isPulsing && (
          <>
            <span
              className="absolute rounded-full animate-ping"
              style={{
                width: 64, height: 64, top: -6, left: -6,
                background: color, opacity: 0.15,
              }}
            />
            <span
              className="absolute rounded-full animate-ping"
              style={{
                width: 52, height: 52, top: 0, left: 0,
                background: color, opacity: 0.2,
                animationDelay: '0.4s',
              }}
            />
          </>
        )}

        {/* Shadow disk */}
        <div
          className="absolute rounded-full"
          style={{
            width: 36, height: 10, bottom: -3, left: 8,
            background: 'rgba(0,0,0,0.28)',
            filter: 'blur(4px)',
          }}
        />

        {/* Vehicle SVG — rotates with heading */}
        <div
          style={{
            transform: `rotate(${heading}deg)`,
            transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            filter: `drop-shadow(0 4px 12px ${color}66) drop-shadow(0 2px 4px rgba(0,0,0,0.4))`,
          }}
        >
          <Vehicle3DSVG category={category} size={52} color={color} shadow={false} />
        </div>

        {/* Direction arrow tip */}
        <div
          className="absolute"
          style={{
            width: 0, height: 0, bottom: -10, left: '50%', transform: 'translateX(-50%)',
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `8px solid ${color}`,
            filter: `drop-shadow(0 2px 3px ${color}66)`,
          }}
        />
      </div>
    </OverlayView>
  );
}

// ─── Pickup / Dropoff Markers ─────────────────────────────────────────────────

function PickupMarker({ position }) {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={() => ({ x: -16, y: -40 })}
    >
      <div className="flex flex-col items-center" style={{ pointerEvents: 'none' }}>
        <div
          className="flex items-center justify-center rounded-full border-2 border-white"
          style={{ width: 32, height: 32, background: 'var(--success)', boxShadow: '0 4px 16px rgba(0,200,100,0.4)' }}
        >
          <MapPin size={14} color="white" strokeWidth={2.5} />
        </div>
        <div style={{ width: 2, height: 12, background: 'var(--success)', opacity: 0.8 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
      </div>
    </OverlayView>
  );
}

function DropoffMarker({ position }) {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={() => ({ x: -16, y: -40 })}
    >
      <div className="flex flex-col items-center" style={{ pointerEvents: 'none' }}>
        <div
          className="flex items-center justify-center rounded-full border-2 border-white"
          style={{ width: 32, height: 32, background: 'var(--error)', boxShadow: '0 4px 16px rgba(239,68,68,0.4)' }}
        >
          <MapPin size={14} color="white" strokeWidth={2.5} />
        </div>
        <div style={{ width: 2, height: 12, background: 'var(--error)', opacity: 0.8 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--error)' }} />
      </div>
    </OverlayView>
  );
}

// ─── SOS Modal ────────────────────────────────────────────────────────────────

function SosModal({ onClose, onTrigger }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="bg-base-100 rounded-2xl p-6 w-full max-w-sm border border-error/30"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
            <ShieldAlert size={24} className="text-error" />
          </div>
          <div>
            <h3 className="font-montserrat font-bold text-base-content text-lg">Emergency SOS</h3>
            <p className="text-xs text-base-content/50">Admin notified immediately</p>
          </div>
        </div>
        <p className="text-sm text-base-content/70 mb-6">
          Triggers SOS — sends live location to emergency team. Genuine emergencies only.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={onTrigger} className="btn btn-error flex-1 font-bold">
            <ShieldAlert size={16} /> Trigger SOS
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Booking Details Sheet ────────────────────────────────────────────────────

function BookingDetailsSheet({ booking, ride, onClose }) {
  if (!booking && !ride) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="w-full max-w-lg bg-base-100 rounded-t-3xl p-6 pb-10 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-base-300 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-montserrat font-black text-xl text-base-content">Booking Details</h3>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm"><X size={18} /></button>
        </div>

        {(booking?.bookingCode || ride?.rideCode) && (
          <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-primary/5 rounded-xl border border-primary/20">
            <CreditCard size={16} className="text-primary" />
            <span className="text-xs text-base-content/60 font-medium">Code</span>
            <span className="ml-auto font-mono font-bold text-primary text-sm">
              {booking?.bookingCode || ride?.rideCode}
            </span>
          </div>
        )}

        {booking?.bookingType && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <Info size={15} className="text-secondary" />
            </div>
            <div>
              <p className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Type</p>
              <p className="text-sm font-semibold text-base-content capitalize">{booking.bookingType.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}

        {(booking?.scheduledAt || ride?.scheduledPickupAt) && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Calendar size={15} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Scheduled</p>
              <p className="text-sm font-semibold text-base-content">
                {new Date(booking?.scheduledAt || ride?.scheduledPickupAt).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}

        {(booking?.patientLocation?.address || ride?.pickup?.address) && (
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin size={15} className="text-success" />
            </div>
            <div>
              <p className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Pickup</p>
              <p className="text-sm font-semibold text-base-content leading-snug">
                {booking?.patientLocation?.address || ride?.pickup?.address || 'Pickup location'}
              </p>
            </div>
          </div>
        )}

        {(booking?.destinationLocation?.address || ride?.dropoff?.address) && (
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin size={15} className="text-error" />
            </div>
            <div>
              <p className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Dropoff</p>
              <p className="text-sm font-semibold text-base-content leading-snug">
                {booking?.destinationLocation?.address || ride?.dropoff?.address || 'Destination'}
              </p>
            </div>
          </div>
        )}

        {booking?.fareBreakdown?.totalAmount > 0 && (
          <div className="mt-5 p-4 bg-base-200 rounded-xl">
            <p className="text-xs text-base-content/50 font-medium uppercase tracking-wide mb-3">Fare</p>
            <div className="space-y-2">
              {booking.fareBreakdown.transportFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/70">Transport</span>
                  <span className="font-semibold">₹{booking.fareBreakdown.transportFee}</span>
                </div>
              )}
              {booking.fareBreakdown.consultationFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/70">Consultation</span>
                  <span className="font-semibold">₹{booking.fareBreakdown.consultationFee}</span>
                </div>
              )}
              {booking.fareBreakdown.platformFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/70">Platform</span>
                  <span className="font-semibold">₹{booking.fareBreakdown.platformFee}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t border-base-300">
                <span className="font-bold text-base-content">Total</span>
                <span className="font-black text-primary">₹{booking.fareBreakdown.totalAmount}</span>
              </div>
            </div>
          </div>
        )}

        {ride?.estimatedDistanceKm > 0 && (
          <div className="flex gap-4 mt-4">
            <div className="flex-1 p-3 bg-base-200 rounded-xl text-center">
              <p className="text-xs text-base-content/50 mb-0.5">Distance</p>
              <p className="font-bold text-base-content">{ride.estimatedDistanceKm?.toFixed(1)} km</p>
            </div>
            {ride?.estimatedDurationMin > 0 && (
              <div className="flex-1 p-3 bg-base-200 rounded-xl text-center">
                <p className="text-xs text-base-content/50 mb-0.5">Est. Time</p>
                <p className="font-bold text-base-content">{ride.estimatedDurationMin} min</p>
              </div>
            )}
          </div>
        )}

        {booking?.doctorSnapshot?.name && (
          <div className="flex items-center gap-3 mt-5 p-3 bg-primary/5 rounded-xl border border-primary/10">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-base-content/50">Doctor</p>
              <p className="text-sm font-semibold text-base-content">{booking.doctorSnapshot.name}</p>
              {booking.doctorSnapshot.specialization && (
                <p className="text-xs text-base-content/50">{booking.doctorSnapshot.specialization}</p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function DriverTimeline({ status }) {
  const activeStep = STATUS_STEP[status] ?? 0;
  return (
    <div className="px-4 py-4 overflow-x-auto">
      <div className="flex items-start min-w-max gap-0">
        {TIMELINE_STEPS.map((step, idx) => {
          const done   = idx < activeStep;
          const active = idx === activeStep;
          const Icon   = step.icon;
          return (
            <div key={idx} className="flex items-start">
              <div className="flex flex-col items-center">
                <motion.div
                  animate={active ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0',
                    done   ? 'bg-success border-success' : '',
                    active ? 'bg-primary border-primary shadow-lg shadow-primary/40' : '',
                    !done && !active ? 'bg-base-200 border-base-300' : '',
                  ].join(' ')}
                >
                  <Icon
                    size={13}
                    strokeWidth={2.5}
                    className={done ? 'text-white' : active ? 'text-primary-content' : 'text-base-content/30'}
                  />
                </motion.div>
                <p className={[
                  'text-[9px] font-semibold mt-1 text-center w-14 leading-tight',
                  active ? 'text-primary' : done ? 'text-success' : 'text-base-content/30',
                ].join(' ')}>
                  {step.label}
                </p>
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={[
                  'h-0.5 w-6 mt-3.5 mx-0.5 flex-shrink-0 rounded-full transition-colors duration-500',
                  idx < activeStep ? 'bg-success' : 'bg-base-300',
                ].join(' ')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ETA Card ─────────────────────────────────────────────────────────────────

function EtaCard({ eta, status, navTarget, onRecenter, isFollowing }) {
  const minutes = eta?.minutes;
  const target  = navTarget?.currentTarget || eta?.target;
  return (
    <div className="flex items-center gap-3">
      <motion.div
        key={minutes}
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/30 flex-shrink-0"
      >
        <Clock size={14} className="text-primary-content/80" />
        <span className="font-montserrat font-black text-primary-content text-lg leading-none">
          {minutes != null ? minutes : '—'}
        </span>
        <span className="text-primary-content/70 text-xs font-medium">min</span>
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base-content text-sm leading-tight truncate">{statusLabel(status)}</p>
        {target && (
          <p className="text-xs text-base-content/50 mt-0.5">
            {target === 'pickup' ? '→ Pickup' : '→ Dropoff'}
          </p>
        )}
      </div>
      <button
        onClick={onRecenter}
        className={[
          'w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 flex-shrink-0',
          isFollowing
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-base-200 border-base-300 text-base-content/50',
        ].join(' ')}
        title={isFollowing ? 'Following driver' : 'Re-center'}
      >
        <Locate size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Driver Info Row ──────────────────────────────────────────────────────────

function DriverInfoRow({ ride, onCall, onShare }) {
  const driver  = ride?.driverSnapshot;
  const vehicle = ride?.vehicleSnapshot;
  if (!driver && !vehicle) return null;
  const category = getVehicleCategory(vehicle?.vehicleType || '');
  const iconMap = { bike: Bike, bus: Bus, van: Truck, suv: Truck, ambulance: Truck };
  const VIcon = iconMap[category] || Car;

  return (
    <div className="flex items-center gap-3 pt-3 border-t border-base-300">
      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
        {driver?.photoUrl ? (
          <img src={driver.photoUrl} alt={driver.legalName} className="w-full h-full rounded-full object-cover" />
        ) : (
          <User size={20} className="text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base-content text-sm truncate">{driver?.legalName || 'Your Driver'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {driver?.rating && (
            <div className="flex items-center gap-0.5">
              <Star size={10} className="text-warning fill-warning" />
              <span className="text-xs font-semibold text-base-content/70">{driver.rating}</span>
            </div>
          )}
          {vehicle?.vehicleType && (
            <div className="flex items-center gap-1">
              <VIcon size={11} className="text-base-content/40" />
              <span className="text-xs text-base-content/50 capitalize">{vehicle.vehicleType}</span>
            </div>
          )}
          {vehicle?.registrationNumber && (
            <span className="text-xs font-mono bg-base-200 px-1.5 py-0.5 rounded text-base-content/70">
              {vehicle.registrationNumber}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {driver?.phone && (
          <a href={`tel:${driver.phone}`} onClick={onCall}
            className="w-9 h-9 rounded-xl bg-success/10 border border-success/30 flex items-center justify-center text-success hover:bg-success/20 transition-colors">
            <Phone size={16} strokeWidth={2.5} />
          </a>
        )}
        <button onClick={onShare}
          className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
          <Share2 size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ─── Connection Badge ─────────────────────────────────────────────────────────

function ConnectionBadge({ connected }) {
  return (
    <div className={[
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md',
      connected
        ? 'bg-success/10 border-success/30 text-success'
        : 'bg-error/10 border-error/30 text-error',
    ].join(' ')}>
      {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
      {connected ? 'Live' : 'Offline'}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RideLiveTracking() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const rideId    = params?.rideId;
  const bookingId = params?.bookingId;

  // ── Redux ──────────────────────────────────────────────────────────────────
  const ride         = useSelector(selectCurrentRide);
  const socketLive   = useSelector(selectSocketLive);
  const trackingData = useSelector(selectTrackingData);
  const liveData     = useSelector(selectLiveData);
  const navTarget    = useSelector(selectNavigationTarget);
  const eta          = useSelector(selectEta);
  const status       = useSelector(selectRideStatus);
  const liveLocation = useSelector(selectLiveLocation);
  const booking      = useSelector(selectSelectedBooking);

  // ── Socket ─────────────────────────────────────────────────────────────────
  const { connected } = useSocket();
  const bookingRoom   = useBookingRoom(bookingId);

  // ── Map ────────────────────────────────────────────────────────────────────
  const mapRef       = useRef(null);
  const animFrameRef = useRef(null);

  // ── Interpolation ──────────────────────────────────────────────────────────
  const currentPosRef  = useRef(null);
  const targetPosRef   = useRef(null);
  const currentHeadRef = useRef(0);
  const targetHeadRef  = useRef(0);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [isFollowing,    setIsFollowing]    = useState(true);
  const [sheetExpanded,  setSheetExpanded]  = useState(false);
  const [showSos,        setShowSos]        = useState(false);
  const [showBookingDet, setShowBookingDet] = useState(false);
  const [isDark,         setIsDark]         = useState(false);
  const [interpolated,   setInterpolated]   = useState(null);
  const [routePath,      setRoutePath]      = useState([]);

  // ── Google Maps ready — no second loader, poll window.google ────────────
  // App root already calls useJsApiLoader. Calling again with different options
  // throws "Loader must not be called again". Use window.google presence instead.
  const [mapsLoaded, setMapsLoaded] = useState(
    typeof window !== 'undefined' && !!window?.google?.maps
  );
  useEffect(() => {
    if (mapsLoaded) return;
    const interval = setInterval(() => {
      if (window?.google?.maps) { setMapsLoaded(true); clearInterval(interval); }
    }, 80);
    return () => clearInterval(interval);
  }, [mapsLoaded]);

  // ── Dark mode detect ──────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches || document.documentElement.classList.contains('dark'));
    const h = e => setIsDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    dispatch(fetchRideTracking({ rideId }));
    dispatch(fetchRideLive(rideId));
  }, [rideId, dispatch]);

  useEffect(() => {
    if (!bookingId) return;
    dispatch(fetchMyBookingById({ bookingId }));
  }, [bookingId, dispatch]);

  // ── Socket → Redux ────────────────────────────────────────────────────────
  useEffect(() => {
    const { locationUpdate, etaUpdate, rideStatus, navigationTarget, snapshot } = bookingRoom;
    if (locationUpdate) dispatch(socketLocationUpdate(locationUpdate));
    if (etaUpdate)      dispatch(socketEtaUpdate(etaUpdate));
    if (rideStatus) {
      dispatch(socketRideStatusChanged(rideStatus));
      const s = rideStatus.status;
      if (s === 'driver_en_route') dispatch(socketDriverEnRoute(rideStatus));
      if (s === 'driver_arrived')  dispatch(socketDriverArrived(rideStatus));
      if (s === 'otp_verified')    dispatch(socketOtpVerified(rideStatus));
      if (s === 'in_progress')     dispatch(socketRideStarted(rideStatus));
      if (s === 'completed')       dispatch(socketRideCompleted(rideStatus));
      if (s === 'cancelled')       dispatch(socketRideCancelled(rideStatus));
    }
    if (navigationTarget) dispatch(socketNavigationTargetChanged(navigationTarget));
    if (snapshot?.tracking?.expectedRoutePolyline) {
      setRoutePath(decodePolyline(snapshot.tracking.expectedRoutePolyline));
    }
  }, [
    bookingRoom.locationUpdate, bookingRoom.etaUpdate, bookingRoom.rideStatus,
    bookingRoom.navigationTarget, bookingRoom.snapshot, dispatch,
  ]);

  // ── Decode route polyline ─────────────────────────────────────────────────
  useEffect(() => {
    const poly = navTarget?.polyline || trackingData?.tracking?.expectedRoutePolyline;
    if (poly) setRoutePath(decodePolyline(poly));
  }, [navTarget?.polyline, trackingData?.tracking?.expectedRoutePolyline]);

  // ── Seed interpolation from socket ───────────────────────────────────────
  useEffect(() => {
    if (!liveLocation?.lat || !liveLocation?.lng) return;
    targetPosRef.current  = { lat: liveLocation.lat, lng: liveLocation.lng };
    targetHeadRef.current = liveLocation.heading ?? 0;
    if (!currentPosRef.current) {
      currentPosRef.current  = { ...targetPosRef.current };
      currentHeadRef.current = liveLocation.heading ?? 0;
    }
  }, [liveLocation]);

  // ── 60fps interpolation RAF ───────────────────────────────────────────────
  useEffect(() => {
    const SPEED = 0.06;
    function animate() {
      if (currentPosRef.current && targetPosRef.current) {
        const cPos = currentPosRef.current;
        const tPos = targetPosRef.current;
        const newLat = lerp(cPos.lat, tPos.lat, SPEED);
        const newLng = lerp(cPos.lng, tPos.lng, SPEED);
        const newHed = lerpAngle(currentHeadRef.current, targetHeadRef.current, 0.08);
        currentPosRef.current  = { lat: newLat, lng: newLng };
        currentHeadRef.current = newHed;
        setInterpolated({ lat: newLat, lng: newLng, heading: newHed });
        if (isFollowing && mapRef.current) {
          mapRef.current.panTo({ lat: newLat, lng: newLng });
        }
      }
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isFollowing]);

  // ── Fit bounds on route load ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapsLoaded || routePath.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    routePath.forEach(p => bounds.extend(p));
    if (interpolated) bounds.extend(interpolated);
    mapRef.current.fitBounds(bounds, { top: 80, right: 40, bottom: 300, left: 40 });
  }, [routePath, mapsLoaded]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const onMapLoad = useCallback(map => {
    mapRef.current = map;
    setMapLoaded(true);
  }, []);

  const onMapDragStart = useCallback(() => setIsFollowing(false), []);

  const handleRecenter = useCallback(() => {
    setIsFollowing(true);
    if (mapRef.current && interpolated) {
      mapRef.current.panTo(interpolated);
      mapRef.current.setZoom(17);
    }
  }, [interpolated]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: 'Track my ride', text: 'Live ride tracking', url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }, []);

  const handleSosTrigger = useCallback(() => setShowSos(false), []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeRide  = ride || liveData;
  const driverPos   = interpolated;
  const rideStatus  = status || activeRide?.status;
  const isCompleted = rideStatus === 'completed';
  const isCancelled = rideStatus === 'cancelled';
  const isStopped   = !rideStatus || ['searching', 'driver_arrived', 'at_stop'].includes(rideStatus);

  const pickupCoords = useMemo(() => {
    const loc = activeRide?.pickup || booking?.patientLocation;
    if (!loc?.coordinates) return null;
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }, [activeRide, booking]);

  const dropoffCoords = useMemo(() => {
    const loc = activeRide?.dropoff || booking?.destinationLocation;
    if (!loc?.coordinates) return null;
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }, [activeRide, booking]);

  const initialCenter = useMemo(() => pickupCoords || { lat: 16.506, lng: 80.648 }, [pickupCoords]);
  const mapStyles     = isDark ? MAP_STYLES_DARK : MAP_STYLES_LIGHT;
  const isLoading     = !mapsLoaded || (!activeRide && !booking);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme="customer" className="relative w-full h-screen overflow-hidden bg-base-100">

      {/* ── LOADING OVERLAY ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
            className="absolute inset-0 z-50 bg-base-100 flex flex-col items-center justify-center gap-5"
          >
            <div className="relative w-16 h-16">
              <span className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <span className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <Navigation2 size={22} className="absolute inset-0 m-auto text-primary" />
            </div>
            <div className="text-center">
              <p className="font-montserrat font-black text-base-content text-lg">Loading your ride</p>
              <p className="text-xs text-base-content/50 mt-1">Setting up live tracking…</p>
            </div>
            <div className="w-64 space-y-2.5">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-4/5" />
              <Shimmer className="h-4 w-2/3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAP ───────────────────────────────────────────────────────────── */}
      {mapsLoaded && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: mapLoaded ? 1 : 0 }} transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={initialCenter}
            zoom={15}
            onLoad={onMapLoad}
            onDragStart={onMapDragStart}
            options={{
              disableDefaultUI:   true,
              gestureHandling:    'greedy',
              styles:             mapStyles,
              mapTypeControl:     false,
              streetViewControl:  false,
              fullscreenControl:  false,
              clickableIcons:     false,
              mapId:              process.env.NEXT_PUBLIC_MAP_ID || undefined,
            }}
          >
            {/* Route glow layer */}
            {routePath.length > 1 && (
              <Polyline
                path={routePath}
                options={{
                  strokeColor:   isDark ? '#a5b4fc' : '#818cf8',
                  strokeWeight:  12,
                  strokeOpacity: 0.12,
                  zIndex:        0,
                }}
              />
            )}
            {/* Route main */}
            {routePath.length > 1 && (
              <Polyline
                path={routePath}
                options={{
                  strokeColor:   isDark ? '#818cf8' : '#6366f1',
                  strokeWeight:  5,
                  strokeOpacity: 0.9,
                  zIndex:        1,
                  strokeLinecap: 'round',
                }}
              />
            )}

            {/* Pickup / Dropoff markers */}
            {pickupCoords  && <PickupMarker  position={pickupCoords} />}
            {dropoffCoords && <DropoffMarker position={dropoffCoords} />}

            {/* 3D Vehicle marker */}
            {driverPos && (
              <VehicleMarker3D
                position={driverPos}
                heading={driverPos.heading}
                vehicleType={activeRide?.vehicleSnapshot?.vehicleType || ''}
                isPulsing={isStopped}
              />
            )}
          </GoogleMap>
        </motion.div>
      )}

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 safe-top">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-base-100/80 backdrop-blur-md border border-base-300/60 flex items-center justify-center shadow-md"
          >
            <ChevronDown size={20} className="text-base-content rotate-90" />
          </motion.button>

          <ConnectionBadge connected={connected} />

          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowBookingDet(true)}
              className="w-10 h-10 rounded-xl bg-base-100/80 backdrop-blur-md border border-base-300/60 flex items-center justify-center shadow-md"
            >
              <Info size={18} className="text-base-content" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowSos(true)}
              className="w-10 h-10 rounded-xl bg-error/10 backdrop-blur-md border border-error/30 flex items-center justify-center shadow-md"
            >
              <Shield size={18} className="text-error" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── STATUS BANNER ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(rideStatus === 'driver_arrived' || isCompleted || isCancelled) && (
          <motion.div
            key="status-banner"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="absolute top-16 left-4 right-4 z-20"
          >
            <div className={[
              'flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg',
              isCompleted ? 'bg-success/10 border-success/30' : '',
              isCancelled ? 'bg-error/10 border-error/30' : '',
              rideStatus === 'driver_arrived' ? 'bg-primary/10 border-primary/30' : '',
            ].join(' ')}>
              {rideStatus === 'driver_arrived' && <Navigation2 size={18} className="text-primary flex-shrink-0" />}
              {isCompleted && <CheckCircle2 size={18} className="text-success flex-shrink-0" />}
              {isCancelled && <AlertCircle size={18} className="text-error flex-shrink-0" />}
              <p className={[
                'text-sm font-bold',
                isCompleted ? 'text-success' : '',
                isCancelled ? 'text-error'   : '',
                rideStatus === 'driver_arrived' ? 'text-primary' : '',
              ].join(' ')}>
                {statusLabel(rideStatus)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM SHEET ──────────────────────────────────────────────────── */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -30) setSheetExpanded(true);
          if (info.offset.y > 30)  setSheetExpanded(false);
        }}
        className="absolute bottom-0 left-0 right-0 z-20"
      >
        <div className={`bg-base-100/95 backdrop-blur-xl rounded-t-3xl border-t border-base-300/60 shadow-2xl transition-all duration-300 ${sheetExpanded ? 'pb-10' : 'pb-6'}`}>
          {/* drag handle */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
            onClick={() => setSheetExpanded(v => !v)}
          >
            <div className="w-10 h-1 bg-base-300 rounded-full" />
          </div>

          <div className="px-4 space-y-4">
            <EtaCard
              eta={eta}
              status={rideStatus}
              navTarget={socketLive?.navigationTarget || navTarget}
              onRecenter={handleRecenter}
              isFollowing={isFollowing}
            />

            <DriverInfoRow ride={activeRide} onCall={() => {}} onShare={handleShare} />

            <AnimatePresence>
              {sheetExpanded && (
                <motion.div
                  key="timeline"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 border-t border-base-300">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest px-1 mb-2">Ride Progress</p>
                    <DriverTimeline status={rideStatus} />
                  </div>

                  {(booking || activeRide) && (
                    <div className="mt-3 border-t border-base-300 pt-3">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">Trip Info</p>
                        <button onClick={() => setShowBookingDet(true)} className="text-xs text-primary font-semibold">View all →</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {activeRide?.estimatedDistanceKm > 0 && (
                          <div className="px-3 py-2.5 bg-base-200 rounded-xl">
                            <p className="text-[10px] text-base-content/50 uppercase tracking-wide">Distance</p>
                            <p className="font-bold text-base-content text-sm mt-0.5">{activeRide.estimatedDistanceKm?.toFixed(1)} km</p>
                          </div>
                        )}
                        {booking?.fareBreakdown?.totalAmount > 0 && (
                          <div className="px-3 py-2.5 bg-base-200 rounded-xl">
                            <p className="text-[10px] text-base-content/50 uppercase tracking-wide">Fare</p>
                            <p className="font-bold text-primary text-sm mt-0.5">₹{booking.fareBreakdown.totalAmount}</p>
                          </div>
                        )}
                        {booking?.bookingType && (
                          <div className="px-3 py-2.5 bg-base-200 rounded-xl col-span-2">
                            <p className="text-[10px] text-base-content/50 uppercase tracking-wide">Type</p>
                            <p className="font-semibold text-base-content text-sm mt-0.5 capitalize">
                              {booking.bookingType.replace(/_/g, ' ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setSheetExpanded(v => !v)}
              className="w-full flex items-center justify-center gap-1 py-1 text-base-content/30"
            >
              {sheetExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── RE-FOLLOW PILL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isFollowing && (
          <motion.div
            key="paused"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-64 left-1/2 -translate-x-1/2 z-20"
          >
            <button
              onClick={handleRecenter}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral/90 backdrop-blur-md text-neutral-content rounded-2xl shadow-xl text-sm font-semibold border border-white/10"
            >
              <RotateCcw size={14} />
              Tap to re-follow driver
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSos && <SosModal key="sos" onClose={() => setShowSos(false)} onTrigger={handleSosTrigger} />}
      </AnimatePresence>

      <AnimatePresence>
        {showBookingDet && (
          <BookingDetailsSheet key="booking-sheet" booking={booking} ride={activeRide} onClose={() => setShowBookingDet(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}