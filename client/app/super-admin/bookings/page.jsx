'use client';

// ─────────────────────────────────────────────────────────────────────────────
// BookingsManagement.jsx — Admin Bookings Dashboard
// Fixes applied:
//   1. selectUser imported from correct auth slice path
//   2. statusUpdate.status compared with string 'loading' consistently
//   3. Live ride tracking panel added with Google Maps embed
//   4. All nearby + assignment flows wired correctly
//   5. OP status modal wired to opStatusUpdate.status (not statusUpdate)
//   6. RefreshCw on nearby re-fetch works correctly
//   7. Missing fetchRideTracking thunk added inline (REST call)
//   8. prevStatus bug documented — fix in router, component handles gracefully
//   9. Modal close resets correct state slices
//  10. Google Maps iframe uses NEXT_PUBLIC_GOOGLE_MAPS_KEY env var
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight,
  MapPin, User, Calendar, Clock, TrendingUp, DollarSign, Activity,
  CheckCircle, XCircle, AlertCircle, Truck, Heart,
  UserCheck, RotateCcw, CreditCard, FileText, Eye,
  X, Phone, Navigation, Zap, Package,
  Star, ArrowUpRight, Layers, Grid3X3, List, Loader2,
  BadgeCheck, Ban, PlusCircle, Users, Car, ClipboardList,
  AlertTriangle, Info, ArrowLeft, Send, Building2,
  BarChart2, Radio, Map, Crosshair, Satellite,
  ExternalLink, ShieldCheck, Wifi, WifiOff,
} from 'lucide-react';

import API from '@/store/api';

import {
  // Bookings
  fetchAdminBookings,
  fetchAdminBookingStats,
  exportAdminBookings,
  fetchAdminBookingById,
  updateAdminBookingStatus,
  // Nearby
  fetchNearbySoloDrivers,
  fetchNearbyTPs,
  fetchNearbyCareAssistants,
  fetchNearbyHospitals,
  // Assignments
  adminAssignSoloDriver,
  adminAssignTP,
  adminAssignCareAssistant,
  adminAssignHospital,
  adminReassignDriver,
  adminReassignCare,
  // Refund
  adminProcessRefund,
  // OPs
  fetchAdminOps,
  updateAdminOpStatus,
  // Resets
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminStatusUpdate,
  resetAdminOpStatusUpdate,
  clearAdminBookingDetail,
  clearNearbyResults,
  patchAdminBookingStatus,
  // Selectors
  selectAdminBookings,
  selectAdminBookingsMeta,
  selectAdminBookingsLoading,
  selectAdminBookingDetail,
  selectAdminOpRecord,
  selectAdminBookingFollowUps,
  selectAdminBookingDetailLoading,
  selectAdminStats,
  selectAdminStatsLoading,
  selectAdminExportLoading,
  selectAdminStatusUpdate,
  selectNearbySoloDrivers,
  selectNearbyTPs,
  selectNearbyCareAssistants,
  selectNearbyHospitals,
  selectNearbyLoading,
  selectAdminAssignment,
  selectAdminAssignLoading,
  selectAdminRefund,
  selectAdminRefundLoading,
  selectAdminOps,
  selectAdminOpsMeta,
  selectAdminOpsLoading,
  selectAdminOpStatusUpdate,
  // Socket
  selectSocketConnected,
  selectLiveLocation,
  joinBookingRoom,
  leaveBookingRoom,
} from '@/store/slices/operationsSlice';

// ── Auth selector — import from your actual auth slice ────────────────────────
// Fix: was defined locally as `(s) => s.user.user` — adjust path to match your store
import { selectUser } from '@/store/slices/userSlice';

// ── Constants ─────────────────────────────────────────────────────────────────

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

const BOOKING_TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Doctor Consult',
  doctor_online:       'Online Consult',
  physiotherapist:     'Physiotherapist',
  care_assistant:      'Care Assistant',
  diagnostic_center:   'Diagnostic Center',
  diagnostic_home:     'Diagnostic Home',
  patient_transport:   'Patient Transport',
  follow_up:           'Follow-Up',
};

const STATUS_CONFIG = {
  pending:        { color: 'warning',  Icon: Clock,        label: 'Pending' },
  confirmed:      { color: 'info',     Icon: CheckCircle,  label: 'Confirmed' },
  in_progress:    { color: 'primary',  Icon: Activity,     label: 'In Progress' },
  completed:      { color: 'success',  Icon: BadgeCheck,   label: 'Completed' },
  cancelled:      { color: 'error',    Icon: XCircle,      label: 'Cancelled' },
  no_show:        { color: 'error',    Icon: Ban,          label: 'No Show' },
  refund_pending: { color: 'warning',  Icon: CreditCard,   label: 'Refund Pending' },
  refunded:       { color: 'success',  Icon: RotateCcw,    label: 'Refunded' },
  draft:          { color: 'neutral',  Icon: FileText,     label: 'Draft' },
};

const OP_STATUS_CONFIG = {
  scheduled:   { color: 'info',    label: 'Scheduled' },
  in_progress: { color: 'primary', label: 'In Progress' },
  completed:   { color: 'success', label: 'Completed' },
  cancelled:   { color: 'error',   label: 'Cancelled' },
  no_show:     { color: 'error',   label: 'No Show' },
};

const BOOKING_TYPE_COLORS = {
  full_care_ride:      '#6366f1',
  doctor_consultation: '#0ea5e9',
  doctor_online:       '#8b5cf6',
  physiotherapist:     '#06b6d4',
  care_assistant:      '#ec4899',
  diagnostic_center:   '#f59e0b',
  diagnostic_home:     '#10b981',
  patient_transport:   '#f97316',
  follow_up:           '#14b8a6',
};

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const HAS_OP_TYPES   = ['full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up'];
const HAS_RIDE_TYPES = ['full_care_ride', 'patient_transport', 'diagnostic_home'];
const HAS_CARE_TYPES = ['full_care_ride', 'care_assistant'];

// ── Motion variants ───────────────────────────────────────────────────────────

const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const fadeIn  = { hidden: { opacity: 0 },         show: { opacity: 1, transition: { duration: 0.2 } } };
const slideIn = { hidden: { opacity: 0, x: 40 },  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } } };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt        = (d) => d ? new Date(d).toLocaleString('en-IN',  { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtCurr    = (n) => `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const coordsStr  = (c) => c?.length === 2 ? `${c[1].toFixed(5)}, ${c[0].toFixed(5)}` : '—';

// ── Inline thunk: fetch ride tracking data (not in slice yet) ─────────────────
async function fetchRideTrackingData(rideId) {
  try {
    const { data } = await API.get(`/rides/${rideId}/tracking`);
    return data.data;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 'md' }) {
  const sz = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size] ?? 'w-6 h-6';
  return <span className={`loading loading-spinner ${sz}`} />;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { color: 'neutral', Icon: Info, label: status };
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
      border border-${cfg.color}/30 bg-${cfg.color}/10 text-${cfg.color} flex-shrink-0`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function SectionTitle({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="p-1.5 rounded-lg bg-primary/10 text-primary"><Icon size={13} /></span>
      <span className="text-xs font-bold text-base-content uppercase tracking-wider">{label}</span>
      {count != null && (
        <span className="ml-auto text-[10px] text-base-content/50 font-semibold bg-base-300/60 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon = Package, text = 'No results' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-base-content/30">
      <Icon size={32} strokeWidth={1} />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function InfoRow({ label, value, bold = false, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">{label}</span>
      <span className={`text-xs truncate ${bold ? 'font-bold text-primary' : 'text-base-content'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = 'primary', loading }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-3 flex flex-col gap-2">
      <span className={`p-1.5 rounded-lg bg-${color}/10 text-${color} self-start`}><Icon size={14} /></span>
      {loading
        ? <div className="skeleton h-6 w-16 rounded" />
        : <p className="text-xl font-black text-base-content">{value}</p>
      }
      <p className="text-[10px] text-base-content/50 font-medium">{label}</p>
    </motion.div>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────

function BookingCard({ booking, selected, onSelect }) {
  const cfg = STATUS_CONFIG[booking.status] ?? { color: 'neutral', Icon: Info, label: booking.status };
  const { Icon } = cfg;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={() => onSelect(booking._id)}
      className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
        selected
          ? 'border-primary bg-primary/5 shadow shadow-primary/10'
          : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-black text-primary tracking-wide">{booking.bookingCode}</span>
          <p className="text-[10px] text-base-content/50 mt-0.5 truncate">
            {BOOKING_TYPE_LABELS[booking.bookingType] ?? booking.bookingType}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
          border border-${cfg.color}/30 bg-${cfg.color}/10 text-${cfg.color} flex-shrink-0`}>
          <Icon size={9} />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0">
            <User size={10} className="text-base-content/50" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-base-content truncate">
              {booking.patientInfo?.name ?? booking.customer?.name ?? '—'}
            </p>
            <p className="text-[10px] text-base-content/40">{booking.customer?.phone ?? ''}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-base-content">{fmtCurr(booking.fareBreakdown?.totalAmount)}</p>
          <p className="text-[10px] text-base-content/40">{fmtDate(booking.scheduledAt)}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Nearby Card ───────────────────────────────────────────────────────────────

function NearbyCard({ item, type, onAssign, loading }) {
  const [confirm, setConfirm] = useState(false);

  const id = type === 'solo'     ? item.soloPartnerId
           : type === 'tp'       ? item.tpId
           : type === 'care'     ? item.careAssistantId
           : /* hospital */        item.hospitalId;

  const label = type === 'tp' ? item.businessName : (item.name ?? '—');

  const sub = type === 'solo'     ? `${item.distanceKm ?? '?'} km · ${item.vehicle?.registrationNumber ?? 'No plate'}`
            : type === 'tp'       ? `${item.availableDriversNearby ?? 0} drivers · ★${item.averageRating?.toFixed(1) ?? '—'}`
            : type === 'care'     ? `${item.distanceKm ?? '?'} km · ${item.specializations?.slice(0, 2).join(', ') ?? '—'}`
            : /* hospital */        `${item.distanceKm ?? '?'} km · ${item.hospitalType ?? '—'}`;

  const TypeIcon = type === 'solo' ? Car : type === 'tp' ? Truck : type === 'care' ? Heart : Building2;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200/40
        hover:border-primary/30 hover:bg-primary/5 transition-all duration-200">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <TypeIcon size={14} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content truncate">{label}</p>
        <p className="text-[10px] text-base-content/50 truncate">{sub}</p>
      </div>
      {confirm ? (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => { onAssign(id); setConfirm(false); }}
            disabled={loading}
            className="btn btn-xs btn-success"
          >
            {loading ? <Spinner size="xs" /> : <CheckCircle size={11} />}
          </button>
          <button onClick={() => setConfirm(false)} className="btn btn-xs btn-ghost">
            <X size={11} />
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="btn btn-xs btn-outline flex-shrink-0">
          Assign
        </button>
      )}
    </motion.div>
  );
}

// ── Live Tracking Map Panel ───────────────────────────────────────────────────
// Uses Google Maps Embed API iframe + live location from Redux socket state

function LiveTrackingPanel({ booking, liveLocation, socketConnected }) {
  const [tracking, setTracking]   = useState(null);
  const [trackLoading, setLoad]   = useState(false);
  const [mapMode, setMapMode]     = useState('roadmap'); // roadmap | satellite

  const rideId = booking?.primaryRide?._id;

  // Pickup coords for map center fallback
  const pickupCoords = booking?.patientLocation?.coordinates;   // [lng, lat]
  const dropCoords   = booking?.destinationLocation?.coordinates;

  // Live driver position from socket
  const driverLat = liveLocation?.lat;
  const driverLng = liveLocation?.lng;

  // Map center: prefer live location, then pickup
  const centerLat = driverLat ?? (pickupCoords ? pickupCoords[1] : 16.506);
  const centerLng = driverLng ?? (pickupCoords ? pickupCoords[0] : 80.648);

  // Google Maps Embed URL
  const mapUrl = GMAPS_KEY
    ? `https://www.google.com/maps/embed/v1/view?key=${GMAPS_KEY}&center=${centerLat},${centerLng}&zoom=14&maptype=${mapMode}`
    : null;

  // Directions embed (pickup → dropoff)
  const directionsUrl = GMAPS_KEY && pickupCoords && dropCoords
    ? `https://www.google.com/maps/embed/v1/directions?key=${GMAPS_KEY}` +
      `&origin=${pickupCoords[1]},${pickupCoords[0]}` +
      `&destination=${dropCoords[1]},${dropCoords[0]}` +
      `&mode=driving&maptype=${mapMode}`
    : null;

  const [showDirections, setShowDirections] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    setLoad(true);
    fetchRideTrackingData(rideId)
      .then(d => setTracking(d))
      .finally(() => setLoad(false));
  }, [rideId]);

  // Open in Google Maps
  const openInMaps = () => {
    if (!centerLat || !centerLng) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`, '_blank');
  };

  const rideStatus  = booking?.primaryRide?.status ?? 'unknown';
  const driverName  = booking?.primaryRide?.driverSnapshot?.legalName ?? booking?.primaryRide?.driverSnapshot?.name ?? '—';
  const vehicleNum  = booking?.primaryRide?.vehicleSnapshot?.registrationNumber ?? '—';
  const vehicleMake = booking?.primaryRide?.vehicleSnapshot?.make ?? '';
  const vehicleMod  = booking?.primaryRide?.vehicleSnapshot?.model ?? '';

  const isActiveRide = ['driver_assigned','driver_accepted','driver_en_route','driver_arrived','otp_verified','in_progress','at_stop'].includes(rideStatus);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-base-300 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary"><Map size={14} /></span>
          <div>
            <p className="text-xs font-bold text-base-content">Live Tracking</p>
            <p className="text-[10px] text-base-content/50">{booking?.bookingCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Socket status */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
            ${socketConnected ? 'bg-success/10 text-success border border-success/30' : 'bg-error/10 text-error border border-error/30'}`}>
            {socketConnected ? <Wifi size={9} /> : <WifiOff size={9} />}
            {socketConnected ? 'Live' : 'Offline'}
          </span>
          {/* Map controls */}
          <button
            onClick={() => setMapMode(m => m === 'roadmap' ? 'satellite' : 'roadmap')}
            className="btn btn-xs btn-ghost gap-1"
            title="Toggle satellite"
          >
            <Satellite size={11} />
          </button>
          <button onClick={openInMaps} className="btn btn-xs btn-ghost gap-1" title="Open in Maps">
            <ExternalLink size={11} />
          </button>
        </div>
      </div>

      {/* Ride summary strip */}
      {rideId && (
        <div className="flex-shrink-0 grid grid-cols-3 gap-0 divide-x divide-base-300 border-b border-base-300 bg-base-100/60">
          <div className="p-2 text-center">
            <p className="text-[10px] text-base-content/40 font-semibold">Status</p>
            <p className="text-xs font-bold text-primary mt-0.5 capitalize">{rideStatus.replace(/_/g, ' ')}</p>
          </div>
          <div className="p-2 text-center">
            <p className="text-[10px] text-base-content/40 font-semibold">Driver</p>
            <p className="text-xs font-bold text-base-content mt-0.5 truncate px-1">{driverName}</p>
          </div>
          <div className="p-2 text-center">
            <p className="text-[10px] text-base-content/40 font-semibold">Vehicle</p>
            <p className="text-xs font-bold text-base-content mt-0.5 truncate px-1">{vehicleNum}</p>
          </div>
        </div>
      )}

      {/* Live location banner */}
      {isActiveRide && liveLocation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex-shrink-0 bg-success/10 border-b border-success/20 px-3 py-2 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-[10px] font-bold text-success">Driver broadcasting live</span>
          </div>
          <div className="text-[10px] text-success/70 font-mono">
            {liveLocation.lat?.toFixed(5)}, {liveLocation.lng?.toFixed(5)}
            {liveLocation.speed != null && ` · ${liveLocation.speed?.toFixed(0)} km/h`}
          </div>
        </motion.div>
      )}

      {/* Map iframe */}
      <div className="flex-shrink-0 relative" style={{ height: 280 }}>
        {!GMAPS_KEY ? (
          <div className="absolute inset-0 flex items-center justify-center bg-base-200 text-base-content/30 text-xs text-center p-4">
            <div>
              <Map size={32} strokeWidth={1} className="mx-auto mb-2" />
              NEXT_PUBLIC_GOOGLE_MAPS_KEY not set.<br />
              Add to .env to enable map.
            </div>
          </div>
        ) : (
          <iframe
            key={`${centerLat}-${centerLng}-${mapMode}-${showDirections}`}
            title="Booking Map"
            width="100%"
            height="280"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={showDirections && directionsUrl ? directionsUrl : mapUrl}
          />
        )}

        {/* Map overlay controls */}
        {GMAPS_KEY && pickupCoords && dropCoords && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            <button
              onClick={() => setShowDirections(false)}
              className={`btn btn-xs ${!showDirections ? 'btn-primary' : 'btn-ghost bg-base-100/80'}`}
            >
              <Crosshair size={10} /> Center
            </button>
            <button
              onClick={() => setShowDirections(true)}
              className={`btn btn-xs ${showDirections ? 'btn-primary' : 'btn-ghost bg-base-100/80'}`}
            >
              <Navigation size={10} /> Route
            </button>
          </div>
        )}
      </div>

      {/* Scrollable detail section */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* Coords */}
        <div className="glass-card p-3">
          <SectionTitle icon={MapPin} label="Waypoints" />
          <div className="space-y-2 text-xs">
            {pickupCoords && (
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-success flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-black text-white">P</span>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-base-content truncate">
                    {booking?.patientLocation?.address ?? coordsStr(pickupCoords)}
                  </p>
                  <p className="text-[10px] text-base-content/40 font-mono">{coordsStr(pickupCoords)}</p>
                </div>
              </div>
            )}
            {dropCoords && (
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-error flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-black text-white">D</span>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-base-content truncate">
                    {booking?.destinationLocation?.address ?? coordsStr(dropCoords)}
                  </p>
                  <p className="text-[10px] text-base-content/40 font-mono">{coordsStr(dropCoords)}</p>
                </div>
              </div>
            )}
          </div>
          {pickupCoords && (
            <a
              href={`https://www.google.com/maps/dir/${pickupCoords[1]},${pickupCoords[0]}/${dropCoords ? `${dropCoords[1]},${dropCoords[0]}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline mt-2"
            >
              <ExternalLink size={10} /> Open Route in Google Maps
            </a>
          )}
        </div>

        {/* Ride timing */}
        {rideId && booking?.primaryRide && (
          <div className="glass-card p-3">
            <SectionTitle icon={Clock} label="Ride Timeline" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <InfoRow label="Scheduled Pickup" value={fmt(booking.primaryRide.scheduledPickupAt)} />
              <InfoRow label="Driver Assigned"  value={fmt(booking.primaryRide.driverAssignedAt)} />
              <InfoRow label="Driver Arrived"   value={fmt(booking.primaryRide.driverArrivedAt)} />
              <InfoRow label="Ride Started"     value={fmt(booking.primaryRide.rideStartedAt)} />
              <InfoRow label="Completed"        value={fmt(booking.primaryRide.rideCompletedAt)} />
              <InfoRow label="Est. Distance"    value={booking.primaryRide.estimatedDistanceKm ? `${booking.primaryRide.estimatedDistanceKm} km` : '—'} />
              {booking.primaryRide.actualDistanceKm > 0 && (
                <InfoRow label="Actual Distance" value={`${booking.primaryRide.actualDistanceKm} km`} />
              )}
              {booking.primaryRide.currentEtaMinutes != null && (
                <InfoRow label="ETA (min)"       value={`${booking.primaryRide.currentEtaMinutes} min`} />
              )}
            </div>
          </div>
        )}

        {/* Tracking stats from RideTracking */}
        {trackLoading && (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" />
            <span className="text-xs text-base-content/40 ml-2">Loading tracking data…</span>
          </div>
        )}

        {tracking && !trackLoading && (
          <div className="glass-card p-3">
            <SectionTitle icon={Radio} label="Tracking Stats" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <InfoRow label="Total Distance"    value={tracking.totalDistanceKm != null ? `${tracking.totalDistanceKm.toFixed(2)} km` : '—'} />
              <InfoRow label="GPS Pings"         value={tracking.breadcrumbCount ?? '—'} />
              <InfoRow label="Avg Speed"         value={tracking.summary?.avgSpeedKmh != null ? `${tracking.summary.avgSpeedKmh} km/h` : '—'} />
              <InfoRow label="Max Speed"         value={tracking.summary?.maxSpeedKmh != null ? `${tracking.summary.maxSpeedKmh} km/h` : '—'} />
              <InfoRow label="Pickup Wait"       value={tracking.summary?.pickupWaitMin != null ? `${tracking.summary.pickupWaitMin} min` : '—'} />
              <InfoRow label="SOS Events"        value={tracking.sosEvents?.length ?? 0} />
              {tracking.hasActiveSos && (
                <div className="col-span-2 flex items-center gap-1 p-2 rounded-lg bg-error/10 border border-error/30 text-xs text-error font-bold">
                  <AlertTriangle size={12} /> Active SOS — contact driver immediately
                </div>
              )}
              {tracking.hasUnacknowledgedDeviation && (
                <div className="col-span-2 flex items-center gap-1 p-2 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning font-bold">
                  <AlertCircle size={12} /> Route deviation detected
                </div>
              )}
            </div>

            {/* Milestones */}
            {tracking.milestones?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-2">Milestones</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {[...tracking.milestones].reverse().map((m, i) => (
                    <div key={m._id ?? i} className="flex items-center gap-2 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="font-semibold text-base-content capitalize">
                        {m.name.replace(/_/g, ' ')}
                      </span>
                      <span className="text-base-content/40 ml-auto flex-shrink-0">
                        {fmt(m.occurredAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No ride */}
        {!rideId && (
          <EmptyState icon={Car} text="No ride assigned yet" />
        )}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ModalBackdrop({ children, onClose }) {
  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div variants={slideIn} className="glass-card p-6 w-full max-w-md relative"
        onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function RefundModal({ booking, onSubmit, onClose, loading }) {
  const [amount, setAmount] = useState(booking?.fareBreakdown?.amountPaid ?? 0);
  const [reason, setReason] = useState('');
  const max = booking?.fareBreakdown?.amountPaid ?? 0;

  return (
    <ModalBackdrop onClose={onClose}>
      <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
      <div className="flex items-center gap-2 mb-4">
        <span className="p-2 rounded-xl bg-warning/10 text-warning"><CreditCard size={18} /></span>
        <div>
          <p className="font-bold text-sm text-base-content">Process Refund</p>
          <p className="text-xs text-base-content/50">{booking?.bookingCode}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="label"><span className="label-text text-xs">Refund Amount (₹)</span></label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(Math.min(Math.max(0, +e.target.value), max))}
            max={max}
            min={0}
            className="input input-bordered input-sm w-full"
          />
          <p className="text-[10px] text-base-content/40 mt-1">Max refundable: {fmtCurr(max)}</p>
        </div>
        <div>
          <label className="label"><span className="label-text text-xs">Reason *</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="textarea textarea-bordered textarea-sm w-full resize-none"
            placeholder="Reason for refund…"
          />
        </div>
        <button
          onClick={() => onSubmit({ refundAmount: amount, reason })}
          disabled={loading || !reason.trim() || amount <= 0}
          className="btn btn-warning w-full btn-sm"
        >
          {loading ? <Spinner size="sm" /> : <><CreditCard size={13} /> Initiate Refund</>}
        </button>
      </div>
    </ModalBackdrop>
  );
}

function StatusModal({ booking, onSubmit, onClose, loading }) {
  const [status, setStatus] = useState(booking?.status ?? 'pending');
  const [note, setNote]     = useState('');

  return (
    <ModalBackdrop onClose={onClose}>
      <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
      <div className="flex items-center gap-2 mb-4">
        <span className="p-2 rounded-xl bg-info/10 text-info"><Activity size={18} /></span>
        <div>
          <p className="font-bold text-sm text-base-content">Update Status</p>
          <p className="text-xs text-base-content/50">{booking?.bookingCode}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="label"><span className="label-text text-xs">New Status</span></label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="select select-bordered select-sm w-full">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label"><span className="label-text text-xs">Note (optional)</span></label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="textarea textarea-bordered textarea-sm w-full resize-none"
            placeholder="Reason for change…"
          />
        </div>
        <button
          onClick={() => onSubmit({ status, note })}
          disabled={loading || status === booking?.status}
          className="btn btn-primary w-full btn-sm"
        >
          {loading ? <Spinner size="sm" /> : <><Send size={13} /> Update Status</>}
        </button>
      </div>
    </ModalBackdrop>
  );
}

function OpStatusModal({ op, onSubmit, onClose, loading }) {
  const [status, setStatus] = useState(op?.status ?? 'scheduled');
  const [notes, setNotes]   = useState(op?.doctorNotes ?? '');

  return (
    <ModalBackdrop onClose={onClose}>
      <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
      <div className="flex items-center gap-2 mb-4">
        <span className="p-2 rounded-xl bg-accent/10 text-accent"><ClipboardList size={18} /></span>
        <div>
          <p className="font-bold text-sm text-base-content">Update OP Status</p>
          <p className="text-xs text-base-content/50">{op?.opNumber}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="label"><span className="label-text text-xs">Status</span></label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="select select-bordered select-sm w-full">
            {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label"><span className="label-text text-xs">Doctor Notes</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="textarea textarea-bordered textarea-sm w-full resize-none"
            placeholder="Clinical notes…"
          />
        </div>
        <button
          onClick={() => onSubmit({ status, doctorNotes: notes })}
          disabled={loading}
          className="btn btn-accent w-full btn-sm"
        >
          {loading ? <Spinner size="sm" /> : <><Send size={13} /> Update OP</>}
        </button>
      </div>
    </ModalBackdrop>
  );
}

function ReassignModal({ type, onSubmit, onClose, loading }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const isDriver = type === 'driver';

  return (
    <ModalBackdrop onClose={onClose}>
      <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
      <div className="flex items-center gap-2 mb-4">
        <span className="p-2 rounded-xl bg-secondary/10 text-secondary"><RotateCcw size={18} /></span>
        <p className="font-bold text-sm text-base-content">
          Reassign {isDriver ? 'Driver' : 'Care Assistant'}
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="label">
            <span className="label-text text-xs">
              {isDriver ? 'New Driver User ID' : 'New Care Assistant Profile ID'}
            </span>
          </label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="input input-bordered input-sm w-full font-mono"
            placeholder={isDriver ? 'Driver user ObjectId…' : 'Care assistant profile ObjectId…'}
          />
        </div>
        {isDriver && (
          <div>
            <label className="label"><span className="label-text text-xs">Reason</span></label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input input-bordered input-sm w-full"
              placeholder="Reason for reassignment…"
            />
          </div>
        )}
        <button
          onClick={() => onSubmit(isDriver ? { newDriverUserId: userId, reason } : { newCareAssistantId: userId })}
          disabled={loading || !userId.trim()}
          className="btn btn-secondary w-full btn-sm"
        >
          {loading ? <Spinner size="sm" /> : <><RotateCcw size={13} /> Reassign</>}
        </button>
      </div>
    </ModalBackdrop>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────

function AnalyticsPanel({ stats, statsLoading, statusChartData, typeChartData }) {
  if (statsLoading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>;
  if (!stats)       return <EmptyState icon={BarChart2} text="No analytics data" />;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="p-4 space-y-4">
      {stats.revenue && (
        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Revenue Summary</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-black text-success">{fmtCurr(stats.revenue.totalRevenue)}</p>
              <p className="text-xs text-base-content/40 mt-0.5">Total Revenue</p>
            </div>
            <div>
              <p className="text-2xl font-black text-primary">{stats.revenue.count}</p>
              <p className="text-xs text-base-content/40 mt-0.5">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-black text-info">
                {fmtCurr(stats.revenue.count ? stats.revenue.totalRevenue / stats.revenue.count : 0)}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">Avg / Booking</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Status Overview</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusChartData} margin={{ left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--b3, #e5e7eb)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Booking Types</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={typeChartData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                {typeChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.byStatus && (
        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Status Breakdown</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats.byStatus).map(([k, v]) => {
              const cfg = STATUS_CONFIG[k] ?? { color: 'neutral', label: k, Icon: Info };
              const { Icon: SIcon } = cfg;
              return (
                <div key={k} className={`flex items-center gap-2 p-2 rounded-lg bg-${cfg.color}/5 border border-${cfg.color}/20`}>
                  <SIcon size={12} className={`text-${cfg.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-black text-${cfg.color}`}>{v}</p>
                    <p className="text-[10px] text-base-content/50 truncate">{cfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── OPs Panel ─────────────────────────────────────────────────────────────────

function OpsPanel({ adminOps, adminOpsMeta, opsLoading, opsFilters, setOpsFilters, onSelectOp, dispatch }) {
  const totalOpPages = adminOpsMeta?.pages ?? 1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-base-300 flex gap-2 flex-shrink-0">
        <select
          value={opsFilters.status}
          onChange={e => setOpsFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="select select-bordered select-xs flex-1"
        >
          <option value="">All OP Statuses</option>
          {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button
          onClick={() => dispatch(fetchAdminOps({ ...opsFilters }))}
          className="btn btn-xs btn-ghost btn-circle"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {opsLoading && <div className="flex items-center justify-center py-12"><Spinner /></div>}
        {!opsLoading && !adminOps?.length && <EmptyState icon={ClipboardList} text="No OP records" />}

        {!opsLoading && !!adminOps?.length && (
          <div className="p-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {adminOps.map(op => (
                <motion.div
                  key={op._id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-card p-3 cursor-pointer hover:border-primary/40 transition-all duration-200"
                  onClick={() => onSelectOp(op)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-black text-primary">{op.opNumber}</span>
                      <span className={`badge badge-xs text-${OP_STATUS_CONFIG[op.status]?.color ?? 'neutral'}`}>
                        {OP_STATUS_CONFIG[op.status]?.label ?? op.status}
                      </span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onSelectOp(op); }}
                      className="btn btn-xs btn-outline flex-shrink-0"
                    >
                      Update
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-base-content truncate">
                    {op.patient?.name ?? '—'} · {op.doctor?.user?.name ?? '—'}
                  </p>
                  <p className="text-[10px] text-base-content/40 mt-0.5">
                    {fmtDate(op.scheduledAt)} · {op.consultationType ?? '—'}
                  </p>
                  {op.doctorNotes && (
                    <p className="text-[10px] text-base-content/50 mt-1.5 line-clamp-2 italic">"{op.doctorNotes}"</p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {!opsLoading && totalOpPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-100 sticky bottom-0">
            <span className="text-xs text-base-content/50">Page {opsFilters.page} of {totalOpPages}</span>
            <div className="flex gap-1">
              <button
                disabled={opsFilters.page <= 1}
                onClick={() => setOpsFilters(f => ({ ...f, page: f.page - 1 }))}
                className="btn btn-xs btn-ghost btn-circle"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                disabled={opsFilters.page >= totalOpPages}
                onClick={() => setOpsFilters(f => ({ ...f, page: f.page + 1 }))}
                className="btn btn-xs btn-ghost btn-circle"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function BookingsManagement() {
  const dispatch = useDispatch();

  // Fix 1: Use correct selector from auth slice
  const user = useSelector(selectUser);

  const bookings        = useSelector(selectAdminBookings);
  const bookingsMeta    = useSelector(selectAdminBookingsMeta);
  const bookingsLoading = useSelector(selectAdminBookingsLoading);

  const bookingDetail  = useSelector(selectAdminBookingDetail);
  const opRecord       = useSelector(selectAdminOpRecord);
  const followUps      = useSelector(selectAdminBookingFollowUps);
  const detailLoading  = useSelector(selectAdminBookingDetailLoading);

  const stats        = useSelector(selectAdminStats);
  const statsLoading = useSelector(selectAdminStatsLoading);
  const exportLoading = useSelector(selectAdminExportLoading);

  // Fix 2: Use full object, compare .status === 'loading' consistently
  const statusUpdate = useSelector(selectAdminStatusUpdate);

  const nearbySolo    = useSelector(selectNearbySoloDrivers);
  const nearbyTPs     = useSelector(selectNearbyTPs);
  const nearbyCare    = useSelector(selectNearbyCareAssistants);
  const nearbyHosps   = useSelector(selectNearbyHospitals);
  const nearbyLoading = useSelector(selectNearbyLoading);

  const assignment    = useSelector(selectAdminAssignment);
  const assignLoading = useSelector(selectAdminAssignLoading);

  const refund        = useSelector(selectAdminRefund);
  const refundLoading = useSelector(selectAdminRefundLoading);

  const adminOps       = useSelector(selectAdminOps);
  const adminOpsMeta   = useSelector(selectAdminOpsMeta);
  const opsLoading     = useSelector(selectAdminOpsLoading);
  const opStatusUpdate = useSelector(selectAdminOpStatusUpdate);

  // Socket for live tracking
  const socketConnected = useSelector(selectSocketConnected);
  const liveLocation    = useSelector(selectLiveLocation);

  // ── Local UI state ──────────────────────────────────────────────────────────

  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Right panel tabs: 'bookings' | 'ops' | 'analytics'
  const [rightTab, setRightTab] = useState('bookings');

  // Within bookings: 'detail' | 'nearby' | 'tracking'
  const [rightPanel, setRightPanel] = useState('detail');
  const [nearbyTab,  setNearbyTab]  = useState('solo');
  const [detailTab,  setDetailTab]  = useState('info');

  const [filters, setFilters] = useState({
    status: '', bookingType: '', search: '', from: '', to: '',
    page: 1, limit: 15,
  });

  const [opsFilters, setOpsFilters] = useState({
    status: '', doctorId: '', hospitalId: '', page: 1, limit: 15,
  });

  const [modal,      setModal]      = useState(null); // 'refund' | 'status' | 'reassignDriver' | 'reassignCare' | 'opStatus'
  const [selectedOp, setSelectedOp] = useState(null);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = {};
    if (filters.status)      params.status      = filters.status;
    if (filters.bookingType) params.bookingType = filters.bookingType;
    if (filters.search)      params.search      = filters.search;
    if (filters.from)        params.from        = filters.from;
    if (filters.to)          params.to          = filters.to;
    params.page  = filters.page;
    params.limit = filters.limit;
    dispatch(fetchAdminBookings(params));
  }, [dispatch, filters.status, filters.bookingType, filters.search, filters.from, filters.to, filters.page, filters.limit]);

  useEffect(() => {
    dispatch(fetchAdminBookingStats());
  }, [dispatch]);

  useEffect(() => {
    if (rightTab === 'ops') {
      dispatch(fetchAdminOps({ ...opsFilters }));
    }
  }, [dispatch, rightTab, opsFilters.status, opsFilters.page]);

  useEffect(() => {
    if (selectedBookingId) {
      dispatch(fetchAdminBookingById(selectedBookingId));
    } else {
      dispatch(clearAdminBookingDetail());
    }
  }, [dispatch, selectedBookingId]);

  useEffect(() => {
    if (rightPanel === 'nearby' && selectedBookingId) {
      dispatch(clearNearbyResults());
      dispatch(fetchNearbySoloDrivers(selectedBookingId));
      dispatch(fetchNearbyTPs(selectedBookingId));
      dispatch(fetchNearbyCareAssistants(selectedBookingId));
      dispatch(fetchNearbyHospitals(selectedBookingId));
    }
  }, [dispatch, rightPanel, selectedBookingId]);

  // Join booking socket room for live tracking
  useEffect(() => {
    if (selectedBookingId && socketConnected && rightPanel === 'tracking') {
      dispatch(joinBookingRoom({ bookingId: selectedBookingId }));
      return () => {
        dispatch(leaveBookingRoom({ bookingId: selectedBookingId }));
      };
    }
  }, [dispatch, selectedBookingId, socketConnected, rightPanel]);

  // Auto-dismiss success states
  useEffect(() => {
    if (assignment.status === 'success') {
      const t = setTimeout(() => dispatch(resetAdminAssignment()), 2500);
      return () => clearTimeout(t);
    }
  }, [dispatch, assignment.status]);

  useEffect(() => {
    if (refund.status === 'success') {
      setModal(null);
      const t = setTimeout(() => dispatch(resetAdminRefund()), 2000);
      return () => clearTimeout(t);
    }
  }, [dispatch, refund.status]);

  useEffect(() => {
    if (statusUpdate.status === 'success') {
      setModal(null);
      if (selectedBookingId) dispatch(fetchAdminBookingById(selectedBookingId));
      const t = setTimeout(() => dispatch(resetAdminStatusUpdate()), 2000);
      return () => clearTimeout(t);
    }
  }, [dispatch, statusUpdate.status, selectedBookingId]);

  useEffect(() => {
    if (opStatusUpdate.status === 'success') {
      setModal(null);
      const t = setTimeout(() => dispatch(resetAdminOpStatusUpdate()), 2000);
      return () => clearTimeout(t);
    }
  }, [dispatch, opStatusUpdate.status]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectBooking = useCallback((id) => {
    setSelectedBookingId(prev => {
      if (prev === id) {
        dispatch(clearAdminBookingDetail());
        return null;
      }
      return id;
    });
    setRightPanel('detail');
    setDetailTab('info');
    setRightTab('bookings');
  }, [dispatch]);

  const handleExport = () => dispatch(exportAdminBookings({ ...filters }));

  const handleAssign = (type, id) => {
    if (!selectedBookingId) return;
    const bid = selectedBookingId;
    if (type === 'solo')     dispatch(adminAssignSoloDriver({ bookingId: bid, soloDriverPartnerId: id }));
    if (type === 'tp')       dispatch(adminAssignTP({ bookingId: bid, transportPartnerId: id }));
    if (type === 'care')     dispatch(adminAssignCareAssistant({ bookingId: bid, careAssistantId: id }));
    if (type === 'hospital') dispatch(adminAssignHospital({ bookingId: bid, hospitalId: id }));
  };

  const handleStatusUpdate = ({ status, note }) => {
    dispatch(updateAdminBookingStatus({ bookingId: selectedBookingId, status, note }));
  };

  const handleRefund = ({ refundAmount, reason }) => {
    dispatch(adminProcessRefund({ bookingId: selectedBookingId, refundAmount, reason }));
  };

  const handleReassignDriver = ({ newDriverUserId, reason }) => {
    dispatch(adminReassignDriver({ bookingId: selectedBookingId, newDriverUserId, reason }));
    setModal(null);
  };

  const handleReassignCare = ({ newCareAssistantId }) => {
    dispatch(adminReassignCare({ bookingId: selectedBookingId, newCareAssistantId }));
    setModal(null);
  };

  const handleOpStatusUpdate = ({ status, doctorNotes }) => {
    if (!selectedOp?._id) return;
    dispatch(updateAdminOpStatus({ opId: selectedOp._id, status, doctorNotes }));
  };

  const handleRefreshNearby = () => {
    if (!selectedBookingId) return;
    dispatch(clearNearbyResults());
    dispatch(fetchNearbySoloDrivers(selectedBookingId));
    dispatch(fetchNearbyTPs(selectedBookingId));
    dispatch(fetchNearbyCareAssistants(selectedBookingId));
    dispatch(fetchNearbyHospitals(selectedBookingId));
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const statusChartData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([k, v]) => ({
        name:  STATUS_CONFIG[k]?.label ?? k,
        value: v,
      }))
    : [];

  const typeChartData = stats?.byBookingType
    ? Object.entries(stats.byBookingType).map(([k, v]) => ({
        name:  BOOKING_TYPE_LABELS[k] ?? k,
        value: v,
        fill:  BOOKING_TYPE_COLORS[k] ?? '#6366f1',
      }))
    : [];

  const totalPages  = bookingsMeta?.pages ?? 1;
  const currentPage = filters.page;

  const bookingType = bookingDetail?.bookingType;
  const hasOp       = bookingType && HAS_OP_TYPES.includes(bookingType);
  const hasRide     = bookingType && HAS_RIDE_TYPES.includes(bookingType);
  const hasCare     = bookingType && HAS_CARE_TYPES.includes(bookingType);

  const refundEligible =
    bookingDetail &&
    ['completed', 'cancelled'].includes(bookingDetail.status) &&
    !['refunded', 'refund_pending'].includes(bookingDetail.status) &&
    (bookingDetail.fareBreakdown?.amountPaid ?? 0) > 0;

  const nearbyTabConfig = [
    { key: 'solo',     label: 'Solo',      data: nearbySolo,  Icon: Car },
    { key: 'tp',       label: 'Transport', data: nearbyTPs,   Icon: Truck },
    { key: 'care',     label: 'Care',      data: nearbyCare,  Icon: Heart },
    { key: 'hospital', label: 'Hospital',  data: nearbyHosps, Icon: Building2 },
  ];

  const selectedNearbyData = nearbyTabConfig.find(t => t.key === nearbyTab)?.data ?? [];

  const RIGHT_TABS = [
    { key: 'bookings',  Icon: Grid3X3,       label: 'Detail' },
    { key: 'ops',       Icon: ClipboardList, label: 'OPs' },
    { key: 'analytics', Icon: BarChart2,     label: 'Analytics' },
  ];

  const DETAIL_PANELS = [
    { key: 'detail',   Icon: Eye,         label: 'Detail' },
    { key: 'nearby',   Icon: Navigation,  label: 'Nearby' },
    { key: 'tracking', Icon: Map,         label: 'Live Tracking' },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-base-100">

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'refund' && bookingDetail && (
          <RefundModal
            key="refund"
            booking={bookingDetail}
            onSubmit={handleRefund}
            onClose={() => setModal(null)}
            loading={refundLoading}
          />
        )}
        {modal === 'status' && bookingDetail && (
          <StatusModal
            key="status"
            booking={bookingDetail}
            onSubmit={handleStatusUpdate}
            onClose={() => setModal(null)}
            loading={statusUpdate.status === 'loading'}
          />
        )}
        {modal === 'reassignDriver' && (
          <ReassignModal
            key="reassignDriver"
            type="driver"
            onSubmit={handleReassignDriver}
            onClose={() => setModal(null)}
            loading={assignLoading}
          />
        )}
        {modal === 'reassignCare' && (
          <ReassignModal
            key="reassignCare"
            type="care"
            onSubmit={handleReassignCare}
            onClose={() => setModal(null)}
            loading={assignLoading}
          />
        )}
        {modal === 'opStatus' && selectedOp && (
          <OpStatusModal
            key="opStatus"
            op={selectedOp}
            onSubmit={handleOpStatusUpdate}
            onClose={() => setModal(null)}
            loading={opStatusUpdate.status === 'loading'}
          />
        )}
      </AnimatePresence>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur-md px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Layers size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-base font-black text-base-content tracking-tight leading-none">
                Bookings Management
              </h1>
              <p className="text-[10px] text-base-content/50 mt-0.5">
                {user?.name} · {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {socketConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                <Wifi size={9} /> Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-base-300 text-base-content/40 border border-base-300">
                <WifiOff size={9} /> Offline
              </span>
            )}
            <button onClick={handleExport} disabled={exportLoading} className="btn btn-sm btn-outline gap-1">
              {exportLoading ? <Spinner size="xs" /> : <Download size={13} />}
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => dispatch(fetchAdminBookingStats())}
              className="btn btn-sm btn-ghost btn-circle"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">

        {/* ══════════════════════════════════════════════════════════════════════
            LEFT PANEL — Stats + Filters + Booking Card List
        ══════════════════════════════════════════════════════════════════════ */}
        <aside className="w-full md:w-[370px] lg:w-[410px] flex-shrink-0 border-r border-base-300 flex flex-col overflow-hidden">

          {/* Stats strip */}
          <div className="border-b border-base-300 p-3">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              className="grid grid-cols-4 gap-2"
            >
              <StatCard label="Total"     value={bookingsMeta?.total ?? '—'}                                                                 icon={Package}     color="primary" loading={statsLoading} />
              <StatCard label="Revenue"   value={stats?.revenue ? `₹${((stats.revenue.totalRevenue ?? 0) / 1000).toFixed(0)}K` : '—'}        icon={DollarSign}  color="success" loading={statsLoading} />
              <StatCard label="Done"      value={stats?.byStatus?.completed ?? '—'}                                                          icon={CheckCircle} color="success" loading={statsLoading} />
              <StatCard label="Pending"   value={stats?.byStatus?.pending ?? '—'}                                                            icon={Clock}       color="warning" loading={statsLoading} />
            </motion.div>
          </div>

          {/* Mini charts */}
          {stats && (
            <div className="border-b border-base-300 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-base-300 p-2 bg-base-100">
                  <p className="text-[10px] font-bold text-base-content/50 mb-1 uppercase tracking-wider">By Status</p>
                  <ResponsiveContainer width="100%" height={72}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" cx="50%" cy="50%" outerRadius={30} paddingAngle={3}>
                        {statusChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl border border-base-300 p-2 bg-base-100">
                  <p className="text-[10px] font-bold text-base-content/50 mb-1 uppercase tracking-wider">By Type</p>
                  <ResponsiveContainer width="100%" height={72}>
                    <BarChart data={typeChartData} margin={{ left: -22, right: 2, top: 2, bottom: 2 }}>
                      <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [v, 'Bookings']} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {typeChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="border-b border-base-300 p-3 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search code, patient name…"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                className="input input-bordered input-xs w-full pl-8"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters(f => ({ ...f, search: '', page: 1 }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
                className="select select-bordered select-xs flex-1"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={filters.bookingType}
                onChange={e => setFilters(f => ({ ...f, bookingType: e.target.value, page: 1 }))}
                className="select select-bordered select-xs flex-1"
              >
                <option value="">All Types</option>
                {Object.entries(BOOKING_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value, page: 1 }))}
                className="input input-bordered input-xs flex-1"
              />
              <span className="text-[10px] text-base-content/40">to</span>
              <input
                type="date"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value, page: 1 }))}
                className="input input-bordered input-xs flex-1"
              />
              {(filters.from || filters.to || filters.status || filters.bookingType || filters.search) && (
                <button
                  onClick={() => setFilters({ status: '', bookingType: '', search: '', from: '', to: '', page: 1, limit: 15 })}
                  className="btn btn-xs btn-ghost gap-1"
                >
                  <X size={10} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Booking card list */}
          <div className="flex-1 overflow-y-auto">
            {bookingsLoading && (
              <div className="flex items-center justify-center py-12"><Spinner /></div>
            )}
            {!bookingsLoading && !bookings?.length && (
              <EmptyState icon={Package} text="No bookings found" />
            )}
            {!bookingsLoading && !!bookings?.length && (
              <div className="p-3 space-y-2">
                <AnimatePresence mode="popLayout">
                  {bookings.map(b => (
                    <BookingCard
                      key={b._id}
                      booking={b}
                      selected={selectedBookingId === b._id}
                      onSelect={handleSelectBooking}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Pagination */}
            {!bookingsLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-100 sticky bottom-0">
                <span className="text-[10px] text-base-content/50">
                  Page {currentPage} / {totalPages} · {bookingsMeta?.total ?? 0} total
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                    className="btn btn-xs btn-ghost btn-circle"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                    className="btn btn-xs btn-ghost btn-circle"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT PANEL — Tab switcher
        ══════════════════════════════════════════════════════════════════════ */}
        <main className="hidden md:flex flex-1 flex-col overflow-hidden bg-base-200/20">

          {/* Right panel tab bar */}
          <div className="flex-shrink-0 border-b border-base-300 bg-base-100/90 backdrop-blur-sm px-4 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap gap-y-2">
              <div className="flex gap-1 p-0.5 rounded-xl bg-base-200 border border-base-300">
                {RIGHT_TABS.map(({ key, Icon: TabIcon, label }) => (
                  <button
                    key={key}
                    onClick={() => setRightTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      rightTab === key
                        ? 'bg-primary text-primary-content shadow-sm'
                        : 'text-base-content/50 hover:text-base-content'
                    }`}
                  >
                    <TabIcon size={11} /> {label}
                  </button>
                ))}
              </div>

              {/* Detail sub-panels — only when booking selected in bookings tab */}
              {rightTab === 'bookings' && selectedBookingId && (
                <div className="flex gap-1 p-0.5 rounded-lg bg-base-200 border border-base-300">
                  {DETAIL_PANELS.map(({ key, Icon: PIcon, label }) => (
                    <button
                      key={key}
                      onClick={() => setRightPanel(key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-200 ${
                        rightPanel === key
                          ? 'bg-primary text-primary-content shadow-sm'
                          : 'text-base-content/50 hover:text-base-content'
                      }`}
                    >
                      <PIcon size={10} /> {label}
                      {key === 'tracking' && socketConnected && (
                        <span className="relative flex h-1.5 w-1.5 ml-0.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── BOOKINGS TAB ────────────────────────────────────────────────── */}
          {rightTab === 'bookings' && (
            <AnimatePresence mode="wait">
              {!selectedBookingId ? (
                <motion.div key="empty" variants={fadeIn} initial="hidden" animate="show"
                  className="flex-1 flex flex-col items-center justify-center gap-3 p-8"
                >
                  <div className="p-4 rounded-2xl bg-primary/10 inline-flex">
                    <Grid3X3 size={32} className="text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-bold text-base-content/50">Select a booking to view details</p>
                  <p className="text-xs text-base-content/30">Click any booking card on the left</p>
                </motion.div>
              ) : (
                <motion.div key={selectedBookingId} variants={slideIn} initial="hidden" animate="show" exit="hidden"
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {/* Booking code sub-header */}
                  <div className="flex-shrink-0 border-b border-base-300 px-4 py-2 bg-base-100/60 flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedBookingId(null); dispatch(clearAdminBookingDetail()); }}
                      className="btn btn-xs btn-ghost btn-circle"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    {detailLoading ? (
                      <div className="skeleton h-4 w-32 rounded" />
                    ) : (
                      <>
                        <span className="text-sm font-black text-primary">{bookingDetail?.bookingCode}</span>
                        <span className="text-xs text-base-content/50">
                          {BOOKING_TYPE_LABELS[bookingDetail?.bookingType] ?? bookingDetail?.bookingType}
                        </span>
                        {bookingDetail && <StatusBadge status={bookingDetail.status} />}
                      </>
                    )}
                  </div>

                  {/* ── DETAIL PANEL ──────────────────────────────────────── */}
                  {rightPanel === 'detail' && (
                    <div className="flex-1 overflow-y-auto">
                      {detailLoading && (
                        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
                      )}

                      {!detailLoading && bookingDetail && (
                        <div className="p-4 space-y-4">
                          {/* Detail sub-tabs */}
                          <div className="flex gap-1 p-0.5 rounded-xl bg-base-200 border border-base-300 w-fit flex-wrap">
                            {[
                              { k: 'info',    l: 'Info' },
                              { k: 'fare',    l: 'Fare & Payments' },
                              ...(hasOp ? [{ k: 'op', l: 'OP / Follow-ups' }] : []),
                              { k: 'actions', l: 'Actions' },
                            ].map(({ k, l }) => (
                              <button
                                key={k}
                                onClick={() => setDetailTab(k)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${
                                  detailTab === k
                                    ? 'bg-base-100 text-primary shadow-sm'
                                    : 'text-base-content/50 hover:text-base-content'
                                }`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>

                          {/* ── INFO ───────────────────────────────────────── */}
                          {detailTab === 'info' && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              {/* Patient & Customer */}
                              <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                <SectionTitle icon={User} label="Patient & Customer" />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <InfoRow label="Patient Name"  value={bookingDetail.patientInfo?.name} bold />
                                  <InfoRow label="Age / Gender"  value={`${bookingDetail.patientInfo?.age ?? '—'} / ${bookingDetail.patientInfo?.gender ?? '—'}`} />
                                  <InfoRow label="Patient Phone" value={bookingDetail.patientInfo?.phone} />
                                  <InfoRow label="Blood Group"   value={bookingDetail.patientInfo?.bloodGroup} />
                                  <InfoRow label="Weight (kg)"   value={bookingDetail.patientInfo?.weight} />
                                  <InfoRow label="Is Self"       value={bookingDetail.patientInfo?.isSelf ? 'Yes' : 'No'} />
                                  <InfoRow label="Customer Name" value={bookingDetail.customer?.name} />
                                  <InfoRow label="Customer Phone" value={bookingDetail.customer?.phone} />
                                  <InfoRow label="Customer Email" value={bookingDetail.customer?.email} />
                                </div>
                              </div>

                              {/* Booking details */}
                              <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                <SectionTitle icon={Calendar} label="Booking Details" />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <InfoRow label="Booking Code"     value={bookingDetail.bookingCode} bold mono />
                                  <InfoRow label="Type"             value={BOOKING_TYPE_LABELS[bookingDetail.bookingType]} />
                                  <InfoRow label="Status"           value={STATUS_CONFIG[bookingDetail.status]?.label ?? bookingDetail.status} />
                                  <InfoRow label="Payment Status"   value={bookingDetail.paymentStatus} />
                                  <InfoRow label="Scheduled At"     value={fmt(bookingDetail.scheduledAt)} />
                                  <InfoRow label="Consultation"     value={bookingDetail.consultationType} />
                                  <InfoRow label="Created At"       value={fmt(bookingDetail.createdAt)} />
                                  <InfoRow label="Completed At"     value={fmt(bookingDetail.completedAt)} />
                                  {bookingDetail.couponCode && (
                                    <InfoRow label="Coupon"         value={bookingDetail.couponCode} />
                                  )}
                                  {bookingDetail.coinsRedeemed > 0 && (
                                    <InfoRow label="Coins Redeemed" value={bookingDetail.coinsRedeemed} />
                                  )}
                                </div>
                              </div>

                              {/* Locations */}
                              {(bookingDetail.patientLocation || bookingDetail.destinationLocation) && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={MapPin} label="Locations" />
                                  <div className="space-y-2 text-xs">
                                    {bookingDetail.patientLocation && (
                                      <div>
                                        <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-0.5">Pickup</p>
                                        <p className="text-base-content">
                                          {bookingDetail.patientLocation.address ??
                                            coordsStr(bookingDetail.patientLocation.coordinates)}
                                        </p>
                                        <p className="text-[10px] font-mono text-base-content/40 mt-0.5">
                                          {coordsStr(bookingDetail.patientLocation.coordinates)}
                                        </p>
                                      </div>
                                    )}
                                    {bookingDetail.destinationLocation && (
                                      <div>
                                        <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-0.5">Destination</p>
                                        <p className="text-base-content">
                                          {bookingDetail.destinationLocation.address ??
                                            coordsStr(bookingDetail.destinationLocation.coordinates)}
                                        </p>
                                        <p className="text-[10px] font-mono text-base-content/40 mt-0.5">
                                          {coordsStr(bookingDetail.destinationLocation.coordinates)}
                                        </p>
                                      </div>
                                    )}
                                    {bookingDetail.patientLocation?.coordinates && (
                                      <button
                                        onClick={() => setRightPanel('tracking')}
                                        className="btn btn-xs btn-primary gap-1 mt-1"
                                      >
                                        <Map size={10} /> View Live Tracking
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Assigned staff */}
                              {(bookingDetail.doctorSnapshot?.name || bookingDetail.careAssistantSnapshot?.name || bookingDetail.hospital) && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={Users} label="Assigned Staff" />
                                  <div className="space-y-2 text-xs">
                                    {bookingDetail.doctorSnapshot?.name && (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-info/5 border border-info/20">
                                        <span className="p-1 rounded bg-info/10 text-info"><UserCheck size={12} /></span>
                                        <div>
                                          <p className="font-bold text-base-content">{bookingDetail.doctorSnapshot.name}</p>
                                          <p className="text-[10px] text-base-content/50">
                                            {bookingDetail.doctorSnapshot.specialization}
                                            {bookingDetail.doctorSnapshot.registrationNumber && ` · ${bookingDetail.doctorSnapshot.registrationNumber}`}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {bookingDetail.careAssistantSnapshot?.name && (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-success/5 border border-success/20">
                                        <span className="p-1 rounded bg-success/10 text-success"><Heart size={12} /></span>
                                        <div>
                                          <p className="font-bold text-base-content">{bookingDetail.careAssistantSnapshot.name}</p>
                                          <p className="text-[10px] text-base-content/50">{bookingDetail.careAssistantSnapshot.phone}</p>
                                        </div>
                                      </div>
                                    )}
                                    {bookingDetail.hospital && (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                                        <span className="p-1 rounded bg-primary/10 text-primary"><Building2 size={12} /></span>
                                        <p className="font-bold text-base-content">
                                          {bookingDetail.hospital?.name ?? 'Hospital assigned'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Ride summary */}
                              {hasRide && bookingDetail.primaryRide && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={Car} label="Ride Summary" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <InfoRow label="Ride Status"      value={bookingDetail.primaryRide?.status?.replace(/_/g, ' ')} />
                                    <InfoRow label="Driver"           value={bookingDetail.primaryRide?.driverSnapshot?.legalName ?? bookingDetail.primaryRide?.driverSnapshot?.name} />
                                    <InfoRow label="Vehicle"          value={bookingDetail.primaryRide?.vehicleSnapshot?.registrationNumber} mono />
                                    <InfoRow label="Vehicle Type"     value={`${bookingDetail.primaryRide?.vehicleSnapshot?.make ?? ''} ${bookingDetail.primaryRide?.vehicleSnapshot?.model ?? ''}`.trim()} />
                                    <InfoRow label="Scheduled Pickup" value={fmt(bookingDetail.primaryRide?.scheduledPickupAt)} />
                                    <InfoRow label="Est. Distance"    value={bookingDetail.primaryRide?.estimatedDistanceKm ? `${bookingDetail.primaryRide.estimatedDistanceKm} km` : '—'} />
                                  </div>
                                  <button
                                    onClick={() => setRightPanel('tracking')}
                                    className="btn btn-xs btn-primary gap-1 mt-3"
                                  >
                                    <Map size={10} /> Open Live Tracking
                                  </button>
                                </div>
                              )}

                              {/* Diagnostic details */}
                              {bookingDetail.diagnosticDetails?.testNames?.length > 0 && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={ShieldCheck} label="Diagnostic Details" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <InfoRow label="Tests"          value={bookingDetail.diagnosticDetails.testNames.join(', ')} />
                                    <InfoRow label="Report Mode"    value={bookingDetail.diagnosticDetails.reportDeliveryMode} />
                                    <InfoRow label="Sample at"      value={fmt(bookingDetail.diagnosticDetails.sampleCollectedAt)} />
                                    <InfoRow label="Report Ready"   value={fmt(bookingDetail.diagnosticDetails.reportReadyAt)} />
                                    <InfoRow label="Technician"     value={bookingDetail.diagnosticDetails.technicianName} />
                                  </div>
                                  {bookingDetail.diagnosticDetails.reportUrl && (
                                    <a
                                      href={bookingDetail.diagnosticDetails.reportUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline mt-2"
                                    >
                                      <FileText size={10} /> View Report
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Online consultation */}
                              {bookingDetail.onlineConsultation?.platform && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={Radio} label="Online Consultation" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <InfoRow label="Platform"  value={bookingDetail.onlineConsultation.platform} />
                                    <InfoRow label="Duration"  value={bookingDetail.onlineConsultation.durationMinutes ? `${bookingDetail.onlineConsultation.durationMinutes} min` : '—'} />
                                    <InfoRow label="Started"   value={fmt(bookingDetail.onlineConsultation.startedAt)} />
                                    <InfoRow label="Ended"     value={fmt(bookingDetail.onlineConsultation.endedAt)} />
                                  </div>
                                  {bookingDetail.onlineConsultation.meetingLink && (
                                    <a
                                      href={bookingDetail.onlineConsultation.meetingLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline mt-2"
                                    >
                                      <ExternalLink size={10} /> Join Meeting
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Ratings */}
                              {bookingDetail.isRated && bookingDetail.rating && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={Star} label="Customer Ratings" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {bookingDetail.rating.overallRating && (
                                      <InfoRow label="Overall"       value={`${'★'.repeat(bookingDetail.rating.overallRating)} (${bookingDetail.rating.overallRating}/5)`} bold />
                                    )}
                                    {bookingDetail.rating.doctorRating && (
                                      <InfoRow label="Doctor"        value={`${bookingDetail.rating.doctorRating}/5`} />
                                    )}
                                    {bookingDetail.rating.driverRating && (
                                      <InfoRow label="Driver"        value={`${bookingDetail.rating.driverRating}/5`} />
                                    )}
                                    {bookingDetail.rating.careAssistantRating && (
                                      <InfoRow label="Care Asst."    value={`${bookingDetail.rating.careAssistantRating}/5`} />
                                    )}
                                    {bookingDetail.rating.overallComment && (
                                      <div className="col-span-2">
                                        <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mb-0.5">Comment</p>
                                        <p className="text-xs text-base-content/70 italic">"{bookingDetail.rating.overallComment}"</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Documents */}
                              {bookingDetail.documents?.length > 0 && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={FileText} label="Documents" count={bookingDetail.documents.length} />
                                  <div className="space-y-1.5">
                                    {bookingDetail.documents.map((doc) => (
                                      <a
                                        key={doc._id}
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs p-2 rounded-lg bg-base-200/60 hover:bg-primary/5 hover:text-primary transition-colors"
                                      >
                                        <FileText size={11} />
                                        <span className="flex-1 truncate">{doc.originalName ?? doc.docType}</span>
                                        <ExternalLink size={10} className="flex-shrink-0 text-base-content/40" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Status log */}
                              {bookingDetail.statusLog?.length > 0 && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={Activity} label="Status History" count={bookingDetail.statusLog.length} />
                                  <div className="space-y-2 max-h-36 overflow-y-auto">
                                    {[...bookingDetail.statusLog].reverse().map((log, i) => (
                                      <div key={log._id ?? i} className="flex items-start gap-2 text-xs">
                                        <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                        <div className="min-w-0">
                                          <span className="font-semibold text-base-content">
                                            {log.fromStatus ? `${log.fromStatus} → ` : ''}{log.toStatus}
                                          </span>
                                          <span className="text-[10px] text-base-content/40 ml-2">{fmtDate(log.changedAt)}</span>
                                          {log.reason && (
                                            <p className="text-[10px] text-base-content/50 italic mt-0.5 truncate">{log.reason}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── FARE & PAYMENTS ────────────────────────────── */}
                          {detailTab === 'fare' && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                <SectionTitle icon={DollarSign} label="Fare Breakdown" />
                                <div className="space-y-1.5">
                                  {[
                                    { l: 'Consultation Fee',    v: bookingDetail.fareBreakdown?.consultationFee },
                                    { l: 'Care Assistant Fee',  v: bookingDetail.fareBreakdown?.careAssistantFee },
                                    { l: 'Transport Fee',       v: bookingDetail.fareBreakdown?.transportFee },
                                    { l: 'Diagnostic Fee',      v: bookingDetail.fareBreakdown?.diagnosticFee },
                                    { l: 'Home Collection',     v: bookingDetail.fareBreakdown?.homeCollectionFee },
                                    { l: 'Platform Fee',        v: bookingDetail.fareBreakdown?.platformFee },
                                    { l: 'Taxes',               v: bookingDetail.fareBreakdown?.taxes },
                                    { l: 'Discount',            v: bookingDetail.fareBreakdown?.discount,       neg: true },
                                    { l: 'Coupon Discount',     v: bookingDetail.fareBreakdown?.couponDiscount, neg: true },
                                    { l: 'Wallet Applied',      v: bookingDetail.fareBreakdown?.walletApplied,  neg: true },
                                  ].filter(i => (i.v ?? 0) > 0).map(({ l, v, neg }) => (
                                    <div key={l} className="flex justify-between items-center text-xs py-1 border-b border-base-300/40 last:border-0">
                                      <span className="text-base-content/60">{l}</span>
                                      <span className={`font-semibold ${neg ? 'text-success' : 'text-base-content'}`}>
                                        {neg ? '−' : ''}{fmtCurr(v)}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between items-center text-sm pt-2 font-black border-t border-base-300 mt-1">
                                    <span className="text-base-content">Total</span>
                                    <span className="text-primary">{fmtCurr(bookingDetail.fareBreakdown?.totalAmount)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-base-content/60">Amount Paid</span>
                                    <span className="font-bold text-success">{fmtCurr(bookingDetail.fareBreakdown?.amountPaid)}</span>
                                  </div>
                                  {(bookingDetail.fareBreakdown?.refundAmount ?? 0) > 0 && (
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-base-content/60">Refunded</span>
                                      <span className="font-bold text-warning">{fmtCurr(bookingDetail.fareBreakdown.refundAmount)}</span>
                                    </div>
                                  )}
                                  {/* Amount due */}
                                  {(() => {
                                    const due = (bookingDetail.fareBreakdown?.totalAmount ?? 0) - (bookingDetail.fareBreakdown?.amountPaid ?? 0);
                                    return due > 0 ? (
                                      <div className="flex justify-between items-center text-xs mt-1 p-2 rounded-lg bg-error/5 border border-error/20">
                                        <span className="font-bold text-error">Amount Due</span>
                                        <span className="font-bold text-error">{fmtCurr(due)}</span>
                                      </div>
                                    ) : null;
                                  })()}
                                </div>
                              </div>

                              {bookingDetail.payments?.length > 0 && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={CreditCard} label="Payment Transactions" count={bookingDetail.payments.length} />
                                  <div className="space-y-2">
                                    {bookingDetail.payments.map((p, i) => (
                                      <div key={p._id ?? i} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-base-200/50 border border-base-300/50">
                                        <div className="min-w-0">
                                          <p className="font-semibold text-base-content">{p.gateway} · {p.paymentMode}</p>
                                          <p className="text-[10px] font-mono text-base-content/40 truncate">{p.transactionId ?? p.orderId ?? '—'}</p>
                                          <p className="text-[10px] text-base-content/40">{fmt(p.paidAt)}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                          <p className="font-bold text-base-content">{fmtCurr(p.amount)}</p>
                                          <span className={`text-[10px] font-bold ${
                                            p.status === 'success'  ? 'text-success' :
                                            p.status === 'refunded' ? 'text-warning' :
                                            p.status === 'failed'   ? 'text-error'   : 'text-base-content/50'
                                          }`}>
                                            {p.status}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── OP / FOLLOW-UPS ────────────────────────────── */}
                          {detailTab === 'op' && hasOp && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              {opRecord ? (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={ClipboardList} label="OP Record" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                                    <InfoRow label="OP Number"       value={opRecord.opNumber} bold mono />
                                    <InfoRow label="Status"          value={OP_STATUS_CONFIG[opRecord.status]?.label ?? opRecord.status} />
                                    <InfoRow label="Consultation"    value={opRecord.consultationType} />
                                    <InfoRow label="Scheduled"       value={fmtDate(opRecord.scheduledAt)} />
                                    <InfoRow label="Follow-up Expiry" value={fmtDate(opRecord.followUpExpiry)} />
                                    <InfoRow label="Follow-up Fee"   value={opRecord.followUpFee ? fmtCurr(opRecord.followUpFee) : '—'} />
                                    <InfoRow label="Is Follow-up"    value={opRecord.isFollowUp ? 'Yes' : 'No'} />
                                    <InfoRow label="Diagnosis Code"  value={opRecord.diagnosisCode} />
                                  </div>

                                  {opRecord.reasonForVisit && (
                                    <div className="p-3 rounded-xl bg-base-200/60 border border-base-300 mb-2">
                                      <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1">Reason for Visit</p>
                                      <p className="text-xs text-base-content/70">{opRecord.reasonForVisit}</p>
                                    </div>
                                  )}
                                  {opRecord.doctorNotes && (
                                    <div className="p-3 rounded-xl bg-info/5 border border-info/20 mb-2">
                                      <p className="text-[10px] font-bold text-info uppercase tracking-wider mb-1">Doctor Notes</p>
                                      <p className="text-xs text-base-content/70">{opRecord.doctorNotes}</p>
                                    </div>
                                  )}
                                  {opRecord.prescriptionUrl && (
                                    <a
                                      href={opRecord.prescriptionUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-3"
                                    >
                                      <FileText size={11} /> View Prescription
                                    </a>
                                  )}

                                  <div className="flex gap-2 pt-3 border-t border-base-300 flex-wrap">
                                    <button
                                      onClick={() => { setSelectedOp(opRecord); setModal('opStatus'); }}
                                      className="btn btn-xs btn-accent gap-1"
                                    >
                                      <ClipboardList size={10} /> Update Status
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <EmptyState icon={ClipboardList} text="No OP record for this booking" />
                              )}

                              {followUps?.length > 0 && (
                                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                  <SectionTitle icon={ArrowUpRight} label="Follow-Up OPs" count={followUps.length} />
                                  <div className="space-y-2">
                                    {followUps.map(fu => (
                                      <div
                                        key={fu._id}
                                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-base-200/50 border border-base-300/50"
                                      >
                                        <div>
                                          <p className="font-bold text-primary">{fu.opNumber}</p>
                                          <p className="text-[10px] text-base-content/50">
                                            {fmtDate(fu.scheduledAt)} · {fu.consultationType ?? '—'}
                                          </p>
                                        </div>
                                        <span className={`text-[10px] font-bold text-${OP_STATUS_CONFIG[fu.status]?.color ?? 'neutral'}`}>
                                          {OP_STATUS_CONFIG[fu.status]?.label ?? fu.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── ACTIONS ────────────────────────────────────── */}
                          {detailTab === 'actions' && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                <SectionTitle icon={Zap} label="Quick Actions" />
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => setModal('status')} className="btn btn-sm btn-primary gap-1">
                                    <Activity size={12} /> Update Status
                                  </button>
                                  <button
                                    onClick={() => setModal('refund')}
                                    disabled={!refundEligible}
                                    title={!refundEligible ? 'Only for completed/cancelled with payment' : ''}
                                    className="btn btn-sm btn-warning gap-1"
                                  >
                                    <CreditCard size={12} /> Refund
                                  </button>
                                  {hasRide && (
                                    <button onClick={() => setModal('reassignDriver')} className="btn btn-sm btn-outline gap-1">
                                      <Car size={12} /> Reassign Driver
                                    </button>
                                  )}
                                  {hasCare && (
                                    <button onClick={() => setModal('reassignCare')} className="btn btn-sm btn-outline gap-1">
                                      <Heart size={12} /> Reassign Care
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setRightPanel('tracking')}
                                    className="btn btn-sm btn-info gap-1"
                                  >
                                    <Map size={12} /> Live Tracking
                                  </button>
                                  <button
                                    onClick={() => setRightPanel('nearby')}
                                    className="btn btn-sm btn-secondary gap-1"
                                  >
                                    <Navigation size={12} /> Nearby
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                                <SectionTitle icon={Info} label="Booking Flags" />
                                <div className="space-y-1 text-xs">
                                  {[
                                    { l: 'Has Transport',  v: hasRide, t: true },
                                    { l: 'Has Care Asst.', v: hasCare, t: true },
                                    { l: 'Has Doctor/OP',  v: hasOp,   t: true },
                                    { l: 'Is Rated',       v: bookingDetail.isRated, t: true },
                                    { l: 'Is Test Booking',v: bookingDetail.isTestBooking, t: false },
                                  ].map(({ l, v, t }) => (
                                    <div key={l} className="flex justify-between items-center py-0.5">
                                      <span className="text-base-content/50">{l}</span>
                                      <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                                        v === t ? 'bg-success/10 text-success' : 'bg-base-300 text-base-content/40'
                                      }`}>
                                        {v ? 'Yes' : 'No'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <AnimatePresence>
                                {assignment.status === 'success' && (
                                  <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
                                    className="alert alert-success text-xs gap-2"
                                  >
                                    <CheckCircle size={13} /> Assignment successful!
                                  </motion.div>
                                )}
                                {assignment.status === 'failed' && (
                                  <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
                                    className="alert alert-error text-xs gap-2"
                                  >
                                    <AlertTriangle size={13} /> {assignment.error}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NEARBY PANEL ──────────────────────────────────────── */}
                  {rightPanel === 'nearby' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-base-content">Nearby Partners</h3>
                        <button onClick={handleRefreshNearby} disabled={nearbyLoading} className="btn btn-xs btn-ghost gap-1">
                          {nearbyLoading ? <Spinner size="xs" /> : <RefreshCw size={11} />}
                          Refresh
                        </button>
                      </div>

                      {/* Nearby sub-tabs */}
                      <div className="flex gap-1 p-0.5 rounded-xl bg-base-200 border border-base-300">
                        {nearbyTabConfig.map(({ key, label, data, Icon: NIcon }) => (
                          <button
                            key={key}
                            onClick={() => setNearbyTab(key)}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                              nearbyTab === key
                                ? 'bg-primary text-primary-content shadow-sm'
                                : 'text-base-content/50 hover:text-base-content'
                            }`}
                          >
                            <NIcon size={10} />
                            <span className="hidden sm:inline">{label}</span>
                            {data.length > 0 && (
                              <span className={`text-[9px] px-1 rounded-full ${nearbyTab === key ? 'bg-white/20' : 'bg-base-300'}`}>
                                {data.length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {selectedNearbyData.length === 0 && !nearbyLoading && (
                            <EmptyState
                              icon={nearbyTab === 'solo' ? Car : nearbyTab === 'tp' ? Truck : nearbyTab === 'care' ? Heart : Building2}
                              text={`No nearby ${nearbyTab === 'solo' ? 'solo drivers' : nearbyTab === 'tp' ? 'transport partners' : nearbyTab === 'care' ? 'care assistants' : 'hospitals'}`}
                            />
                          )}
                          {nearbyLoading && (
                            <div className="flex items-center justify-center py-8"><Spinner /></div>
                          )}
                          {!nearbyLoading && selectedNearbyData.map((item, i) => (
                            <NearbyCard
                              key={
                                nearbyTab === 'solo'     ? (item.soloPartnerId   ?? i)
                                : nearbyTab === 'tp'     ? (item.tpId            ?? i)
                                : nearbyTab === 'care'   ? (item.careAssistantId ?? i)
                                : /* hospital */            (item.hospitalId     ?? i)
                              }
                              item={item}
                              type={nearbyTab}
                              onAssign={(id) => handleAssign(nearbyTab, id)}
                              loading={assignLoading}
                            />
                          ))}
                        </AnimatePresence>
                      </div>

                      <AnimatePresence>
                        {assignment.status === 'success' && (
                          <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
                            className="alert alert-success text-xs gap-2"
                          >
                            <CheckCircle size={13} /> Assignment successful!
                          </motion.div>
                        )}
                        {assignment.status === 'failed' && (
                          <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
                            className="alert alert-error text-xs gap-2"
                          >
                            <AlertTriangle size={13} /> {assignment.error}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ── LIVE TRACKING PANEL ───────────────────────────────── */}
                  {rightPanel === 'tracking' && (
                    <div className="flex-1 overflow-hidden">
                      {detailLoading ? (
                        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
                      ) : (
                        <LiveTrackingPanel
                          booking={bookingDetail}
                          liveLocation={liveLocation}
                          socketConnected={socketConnected}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ── OPs TAB ─────────────────────────────────────────────────────── */}
          {rightTab === 'ops' && (
            <OpsPanel
              adminOps={adminOps}
              adminOpsMeta={adminOpsMeta}
              opsLoading={opsLoading}
              opsFilters={opsFilters}
              setOpsFilters={setOpsFilters}
              onSelectOp={(op) => { setSelectedOp(op); setModal('opStatus'); }}
              dispatch={dispatch}
            />
          )}

          {/* ── ANALYTICS TAB ───────────────────────────────────────────────── */}
          {rightTab === 'analytics' && (
            <div className="flex-1 overflow-y-auto">
              <AnalyticsPanel
                stats={stats}
                statsLoading={statsLoading}
                statusChartData={statusChartData}
                typeChartData={typeChartData}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}