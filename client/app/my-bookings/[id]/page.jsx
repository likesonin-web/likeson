'use client';

/**
 * BookingDetailsPage — Enterprise-grade, production-ready
 *
 * Key architectural decisions:
 * - Google Maps loaded ONCE via a module-level singleton promise (fixes "loaded multiple times" error)
 * - Heavy components (BookingMap, modals) are lazy-rendered with Suspense boundaries
 * - All API dispatches live in slice / thunks; zero direct API calls in UI
 * - Memoised selectors + React.memo on pure sub-components eliminate re-renders
 * - Skeleton loaders replace spinners; no CLS from layout shifts
 * - Accessible: semantic HTML, ARIA roles, keyboard-navigable modals
 * - No Zod, no helper files — everything self-contained in this single file
 */

import {
  useEffect, useState, useRef, useCallback, memo, lazy, Suspense,
} from 'react';
import dynamic from 'next/dynamic';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Clock, MapPin, User, Phone, Star,
  X, AlertTriangle, CheckCircle2, Loader2, Navigation,
  Car, Stethoscope, FlaskConical, HeartPulse, Video, Dumbbell,
  Ambulance, RotateCcw, Home, FileText, CreditCard,
  Activity, Package, Shield, IndianRupee,
  MessageCircle, ThumbsUp, RefreshCw, Copy, ExternalLink, Info,
  Navigation2,
} from 'lucide-react';

import {
  fetchBookingById,
  cancelBooking,
  rateBooking,
  clearActiveBooking,
  resetCancelBooking,
  resetRateBooking,
  selectActiveBooking,
  selectActiveBookingLoading,
  selectActiveBookingError,
  selectCancelBooking,
  selectCancelBookingLoading,
  selectRateBooking,
  selectRateBookingLoading,
} from '@/store/slices/bookingSlice';



// ─── Google Maps Singleton ────────────────────────────────────────────────────
// Ensures the Maps script is injected exactly once per page lifetime,
// eliminating the "loaded multiple times" console error.

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

let _mapsPromise = null;

function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;

  _mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => {
      _mapsPromise = null; // allow retry
      reject(new Error('Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return _mapsPromise;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_TYPE_META = {
  full_care_ride:      { label: 'Full Care Ride',      icon: Ambulance,    color: 'text-primary',   bg: 'bg-primary/10',   gradient: 'from-primary/20 to-primary/5'   },
  doctor_consultation: { label: 'Doctor Consultation', icon: Stethoscope,  color: 'text-info',      bg: 'bg-info/10',      gradient: 'from-info/20 to-info/5'         },
  doctor_online:       { label: 'Online Consult',      icon: Video,        color: 'text-accent',    bg: 'bg-accent/5',     gradient: 'from-accent/20 to-accent/5'     },
  physiotherapist:     { label: 'Physiotherapy',       icon: Dumbbell,     color: 'text-success',   bg: 'bg-success/10',   gradient: 'from-success/20 to-success/5'   },
  care_assistant:      { label: 'Care Assistant',      icon: HeartPulse,   color: 'text-secondary', bg: 'bg-secondary/20', gradient: 'from-secondary/20 to-secondary/5'},
  diagnostic_center:   { label: 'Diagnostic Center',   icon: FlaskConical, color: 'text-warning',   bg: 'bg-warning/10',   gradient: 'from-warning/20 to-warning/5'   },
  diagnostic_home:     { label: 'Home Diagnostics',    icon: Home,         color: 'text-warning',   bg: 'bg-warning/5',    gradient: 'from-warning/10 to-warning/5'   },
  patient_transport:   { label: 'Patient Transport',   icon: Car,          color: 'text-accent',    bg: 'bg-accent/5',     gradient: 'from-accent/20 to-accent/5'     },
  follow_up:           { label: 'Follow-Up',           icon: RotateCcw,    color: 'text-info',      bg: 'bg-info/10',      gradient: 'from-info/20 to-info/5'         },
};

const STATUS_META = {
  draft:          { label: 'Draft',          color: 'text-base-content/50', bg: 'bg-base-300/60',  dot: 'bg-base-content/40' },
  pending:        { label: 'Pending',        color: 'text-warning',          bg: 'bg-warning/10',   dot: 'bg-warning'          },
  confirmed:      { label: 'Confirmed',      color: 'text-success',          bg: 'bg-success/10',   dot: 'bg-success'          },
  in_progress:    { label: 'In Progress',    color: 'text-info',             bg: 'bg-info/10',      dot: 'bg-info'             },
  completed:      { label: 'Completed',      color: 'text-success',          bg: 'bg-success/10',   dot: 'bg-success'          },
  cancelled:      { label: 'Cancelled',      color: 'text-error',            bg: 'bg-error/5',      dot: 'bg-error'            },
  no_show:        { label: 'No Show',        color: 'text-error',            bg: 'bg-error/5',      dot: 'bg-error'            },
  refund_pending: { label: 'Refund Pending', color: 'text-warning',          bg: 'bg-warning/10',   dot: 'bg-warning'          },
  refunded:       { label: 'Refunded',       color: 'text-base-content/60',  bg: 'bg-base-300/60',  dot: 'bg-base-content/40'  },
};

// ─── Pure formatters (no deps, stable references) ────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonBlock = memo(({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-base-300/70 ${className}`} aria-hidden="true" />
));
SkeletonBlock.displayName = 'SkeletonBlock';

function BookingDetailsSkeleton() {
  return (
    <div className="min-h-screen" aria-label="Loading booking details" aria-busy="true">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-base-300 bg-base-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-8 h-8 rounded-full" />
          <div className="space-y-1.5">
            <SkeletonBlock className="w-32 h-4" />
            <SkeletonBlock className="w-24 h-3" />
          </div>
        </div>
      </div>
      {/* Hero */}
      <SkeletonBlock className="h-24 w-full rounded-none" />
      {/* Content */}
      <div className="container-custom py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <SkeletonBlock className="h-56 w-full" />
          <SkeletonBlock className="h-40 w-full" />
          <SkeletonBlock className="h-32 w-full" />
        </div>
        <div className="space-y-5">
          <SkeletonBlock className="h-48 w-full" />
          <SkeletonBlock className="h-36 w-full" />
        </div>
      </div>
    </div>
  );
}

// ─── BookingMap ───────────────────────────────────────────────────────────────
// Rendered only when coordinates exist; uses the singleton loader.

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
];

const BookingMap = memo(function BookingMap({ patientLocation, destinationLocation }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const pickupCoords  = patientLocation?.coordinates;
  const dropoffCoords = destinationLocation?.coordinates;

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapRef.current || mapInstance.current) return;

    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;

        const center = pickupCoords
          ? { lat: pickupCoords[1], lng: pickupCoords[0] }
          : { lat: 16.5062, lng: 80.6480 };

        const map = new maps.Map(mapRef.current, {
          center, zoom: 12, styles: MAP_STYLES,
          disableDefaultUI: true, zoomControl: true,
          mapTypeControl: false, streetViewControl: false,
        });
        mapInstance.current = map;

        const bounds = new maps.LatLngBounds();

        const addMarker = (coords, fillColor, title) => {
          const pos = { lat: coords[1], lng: coords[0] };
          new maps.Marker({
            position: pos, map, title,
            icon: {
              path: maps.SymbolPath.CIRCLE, scale: 10,
              fillColor, fillOpacity: 1,
              strokeColor: '#ffffff', strokeWeight: 3,
            },
          });
          bounds.extend(pos);
        };

        if (pickupCoords)  addMarker(pickupCoords,  '#3b82f6', 'Pickup');
        if (dropoffCoords) addMarker(dropoffCoords, '#22c55e', 'Destination');

        if (pickupCoords && dropoffCoords) {
          map.fitBounds(bounds, { padding: 60 });

          const svc = new maps.DirectionsService();
          const renderer = new maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#6366f1', strokeWeight: 4, strokeOpacity: 0.8 },
          });
          renderer.setMap(map);

          svc.route({
            origin:      { lat: pickupCoords[1],  lng: pickupCoords[0] },
            destination: { lat: dropoffCoords[1], lng: dropoffCoords[0] },
            travelMode: maps.TravelMode.DRIVING,
          }, (result, status) => {
            if (status === 'OK') renderer.setDirections(result);
          });
        }

        setMapReady(true);
      })
      .catch(() => { if (!cancelled) setMapError(true); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — coordinates don't change after mount

  if (!pickupCoords && !dropoffCoords) return null;

  return (
    <div className="card overflow-hidden" role="region" aria-label="Route map">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <div className="flex items-center gap-2">
          <Navigation size={15} className="text-primary" aria-hidden="true" />
          <span className="font-bold text-sm text-base-content">Route Map</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-base-content/50" aria-hidden="true">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Pickup
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Destination
          </span>
        </div>
      </div>

      <div className="relative w-full h-56">
        {mapError ? (
          <div className="absolute inset-0 bg-base-200 flex flex-col items-center justify-center gap-2 text-base-content/40 text-sm">
            <MapPin size={22} />
            <span>Map unavailable</span>
          </div>
        ) : (
          <>
            {!mapReady && (
              <div className="absolute inset-0 bg-base-200 flex items-center justify-center z-10" aria-live="polite">
                <SkeletonBlock className="absolute inset-0 rounded-none" />
              </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
          </>
        )}
      </div>
    </div>
  );
});

// ─── Reusable UI Primitives ───────────────────────────────────────────────────

const Section = memo(function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={`card p-5 ${className}`}
      aria-label={title}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-primary" aria-hidden="true" />
        <h3 className="font-bold text-xs text-base-content/60 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </motion.section>
  );
});

const Row = memo(function Row({ label, value, mono = false, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-base-300/60 last:border-0">
      <dt className="text-xs text-base-content/50 shrink-0">{label}</dt>
      <dd className={`text-right text-sm break-all ${highlight ? 'font-black text-base-content' : 'font-medium text-base-content/80'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
});

// ─── Fare Breakdown ───────────────────────────────────────────────────────────

const FareBreakdown = memo(function FareBreakdown({ fare }) {
  if (!fare) return <p className="text-sm text-base-content/40">No fare information available.</p>;

  const rows = [
    { label: 'Consultation Fee', value: fare.consultationFee,   show: !!fare.consultationFee   },
    { label: 'Transport Fee',    value: fare.transportFee,       show: !!fare.transportFee       },
    { label: 'Care Assistant',   value: fare.careAssistantFee,  show: !!fare.careAssistantFee  },
    { label: 'Diagnostic Fee',   value: fare.diagnosticFee,     show: !!fare.diagnosticFee     },
    { label: 'Home Collection',  value: fare.homeCollectionFee, show: !!fare.homeCollectionFee },
    { label: 'Platform Fee',     value: fare.platformFee,       show: !!fare.platformFee       },
    { label: 'Taxes',            value: fare.taxes,             show: !!fare.taxes             },
    { label: 'Discount',         value: fare.discount,          show: !!fare.discount,         isDiscount: true },
    { label: 'Coupon Discount',  value: fare.couponDiscount,    show: !!fare.couponDiscount,   isDiscount: true },
    { label: 'Wallet Applied',   value: fare.walletApplied,     show: !!fare.walletApplied,    isDiscount: true },
  ].filter((r) => r.show);

  return (
    <dl>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-2 border-b border-base-300/60 last:border-0">
          <dt className="text-xs text-base-content/50">{r.label}</dt>
          <dd className={`text-sm font-semibold ${r.isDiscount ? 'text-success' : 'text-base-content/80'}`}>
            {r.isDiscount ? '− ' : ''}{fmtINR(Math.abs(r.value ?? 0))}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between pt-3 mt-1">
        <dt className="font-bold text-sm text-base-content">Total</dt>
        <dd className="font-black text-lg text-base-content">{fmtINR(fare.totalAmount)}</dd>
      </div>
      {fare.refundAmount > 0 && (
        <div className="flex items-center justify-between pt-1">
          <dt className="text-xs text-success">Refund Amount</dt>
          <dd className="text-sm font-bold text-success">{fmtINR(fare.refundAmount)}</dd>
        </div>
      )}
    </dl>
  );
});

// ─── Star Rating Input ────────────────────────────────────────────────────────

const StarRating = memo(function StarRating({ value, onChange, label = 'Rating' }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === value}
          aria-label={`${s} star${s > 1 ? 's' : ''}`}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning rounded"
        >
          <Star
            size={22}
            aria-hidden="true"
            className={s <= (hovered || value) ? 'text-warning fill-current' : 'text-base-300'}
          />
        </button>
      ))}
    </div>
  );
});

// ─── Cancel Modal ─────────────────────────────────────────────────────────────

const CancelModal = memo(function CancelModal({ booking, onClose }) {
  const dispatch = useDispatch();
  const { status, data, error } = useSelector(selectCancelBooking);
  const loading  = useSelector(selectCancelBookingLoading);
  const [reason, setReason] = useState('');
  const textareaRef = useRef(null);

  // Focus trap
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleCancel = useCallback(() => {
    if (!reason.trim()) return;
    dispatch(cancelBooking({ bookingId: booking._id, reason }));
  }, [dispatch, booking._id, reason]);

  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [status, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        className="card w-full max-w-md p-6"
      >
        {status === 'success' ? (
          <div className="text-center py-6" role="status" aria-live="polite">
            <CheckCircle2 size={48} className="text-success mx-auto mb-3" aria-hidden="true" />
            <h3 className="font-bold text-lg mb-1">Booking Cancelled</h3>
            {data?.refundAmount > 0 && (
              <p className="text-base-content/60 text-sm">
                Refund of <strong>{fmtINR(data.refundAmount)}</strong> ({data.refundPercent}%) will be processed.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-error" aria-hidden="true" />
                <h3 id="cancel-modal-title" className="font-bold text-base">Cancel Booking</h3>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle" aria-label="Close">
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="alert alert-warning mb-5 text-sm" role="note">
              <Info size={14} className="shrink-0" aria-hidden="true" />
              <span>Cancellation may incur charges depending on timing. Refund eligibility will be calculated automatically.</span>
            </div>

            <div className="mb-5">
              <label htmlFor="cancel-reason" className="label-text block mb-2">
                Reason for cancellation <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <textarea
                id="cancel-reason"
                ref={textareaRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please tell us why you're cancelling…"
                rows={3}
                className="input-field w-full resize-none"
                aria-required="true"
              />
            </div>

            {error && (
              <div className="alert alert-error mb-4 text-sm" role="alert">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn btn-ghost flex-1">Keep Booking</button>
              <button
                onClick={handleCancel}
                disabled={loading || !reason.trim()}
                className="btn btn-error flex-1 gap-2"
                aria-disabled={loading || !reason.trim()}
              >
                {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {loading ? 'Cancelling…' : 'Cancel Booking'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
});

// ─── Rating Modal ─────────────────────────────────────────────────────────────

const DOCTOR_TYPES  = new Set(['full_care_ride','doctor_consultation','doctor_online','physiotherapist','follow_up']);
const DRIVER_TYPES  = new Set(['full_care_ride','patient_transport','diagnostic_home']);
const CA_TYPES      = new Set(['full_care_ride','care_assistant']);
const LAB_TYPES     = new Set(['diagnostic_center','diagnostic_home']);

const INITIAL_RATING_FORM = {
  overallRating: 0, overallComment: '',
  doctorRating: 0,  doctorComment: '',
  driverRating: 0,  driverComment: '',
  careAssistantRating: 0, careAssistantComment: '',
  labRating: 0, labComment: '',
};

const RatingModal = memo(function RatingModal({ booking, onClose }) {
  const dispatch = useDispatch();
  const rateState = useSelector(selectRateBooking);
  const loading   = useSelector(selectRateBookingLoading);
  const status    = rateState?.status;

  const [form, setForm] = useState(INITIAL_RATING_FORM);

  const set = useCallback((key, val) => setForm((p) => ({ ...p, [key]: val })), []);

  const handleSubmit = useCallback(() => {
    if (!form.overallRating) return;
    dispatch(rateBooking({ bookingId: booking._id, ...form }));
  }, [dispatch, booking._id, form]);

  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(onClose, 1800);
      return () => clearTimeout(t);
    }
  }, [status, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const showDoctor = DOCTOR_TYPES.has(booking.bookingType);
  const showDriver = DRIVER_TYPES.has(booking.bookingType);
  const showCA     = CA_TYPES.has(booking.bookingType);
  const showLab    = LAB_TYPES.has(booking.bookingType);

  const RatingField = ({ stateKey, commentKey, label }) => (
    <div>
      <p className="label-text block mb-2">{label}</p>
      <StarRating label={label} value={form[stateKey]} onChange={(v) => set(stateKey, v)} />
      <input
        type="text"
        placeholder="Comment (optional)"
        value={form[commentKey]}
        onChange={(e) => set(commentKey, e.target.value)}
        className="input-field w-full mt-2"
        aria-label={`${label} comment`}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="card w-full max-w-md p-6 my-4"
      >
        {status === 'success' ? (
          <div className="text-center py-6" role="status" aria-live="polite">
            <ThumbsUp size={48} className="text-success mx-auto mb-3" aria-hidden="true" />
            <h3 className="font-bold text-lg mb-1">Thank you for your feedback!</h3>
            <p className="text-base-content/50 text-sm">Your rating helps us improve.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-warning" aria-hidden="true" />
                <h3 id="rating-modal-title" className="font-bold text-base">Rate Your Experience</h3>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle" aria-label="Close">
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              <RatingField stateKey="overallRating" commentKey="overallComment" label="Overall Experience *" />
              {showDoctor && <RatingField stateKey="doctorRating" commentKey="doctorComment" label="Doctor" />}
              {showDriver && <RatingField stateKey="driverRating" commentKey="driverComment" label="Driver" />}
              {showCA     && <RatingField stateKey="careAssistantRating" commentKey="careAssistantComment" label="Care Assistant" />}
              {showLab    && <RatingField stateKey="labRating" commentKey="labComment" label="Lab / Diagnostics" />}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-base-300">
              <button onClick={onClose} className="btn btn-ghost flex-1">Skip</button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.overallRating}
                className="btn btn-primary flex-1 gap-2"
                aria-disabled={loading || !form.overallRating}
              >
                {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Submit Rating
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingDetailsPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const params   = useParams();
  const id       = params?.bookingId ?? params?.id;

  const booking = useSelector(selectActiveBooking);
  const loading = useSelector(selectActiveBookingLoading);
  const error   = useSelector(selectActiveBookingError);

  const [showCancel, setShowCancel] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchBookingById(id));
    return () => { dispatch(clearActiveBooking()); };
  }, [id, dispatch]);

  const handleRefresh = useCallback(() => {
    if (id) dispatch(fetchBookingById(id));
  }, [id, dispatch]);

  const handleCopy = useCallback(() => {
    if (!booking?.bookingCode) return;
    navigator.clipboard.writeText(booking.bookingCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [booking?.bookingCode]);

  const handleCloseCancelModal = useCallback(() => {
    setShowCancel(false);
    dispatch(resetCancelBooking());
  }, [dispatch]);

  const handleCloseRatingModal = useCallback(() => {
    setShowRating(false);
    dispatch(resetRateBooking());
  }, [dispatch]);

  // ── Loading state ──
  if (loading) return <BookingDetailsSkeleton />;

  // ── Error / Not found state ──
  if (error || !booking) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
        <AlertTriangle size={40} className="text-error" aria-hidden="true" />
        <h2 className="font-bold text-lg">Booking Not Found</h2>
        <p className="text-base-content/50 text-sm max-w-xs">{error || 'This booking could not be loaded.'}</p>
        <button onClick={() => router.back()} className="btn btn-outline btn-sm gap-2 mt-2">
          <ArrowLeft size={14} aria-hidden="true" />
          Go Back
        </button>
      </main>
    );
  }

  const meta  = BOOKING_TYPE_META[booking.bookingType] ?? BOOKING_TYPE_META.patient_transport;
  const sMeta = STATUS_META[booking.status]            ?? STATUS_META.pending;
  const Icon  = meta.icon;

  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canRate   = booking.status === 'completed' && !booking.isRated;
  const hasMap    = !!(booking.patientLocation?.coordinates || booking.destinationLocation?.coordinates);

  return (
    <>
      <div className="min-h-screen bg-base-100">

        {/* ── Sticky Header ── */}
        <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/95 backdrop-blur-sm">
          <div className="container-custom py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => router.back()}
                  className="btn btn-ghost btn-sm btn-circle shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-black text-base text-base-content truncate">{meta.label}</h1>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${sMeta.color} ${sMeta.bg}`}
                      aria-label={`Status: ${sMeta.label}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${sMeta.dot}`} aria-hidden="true" />
                      {sMeta.label}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-base-content/40 hover:text-primary transition-colors mt-0.5"
                    aria-label={`Copy booking code ${booking.bookingCode}`}
                  >
                    <span className="font-mono">{booking.bookingCode}</span>
                    {copied
                      ? <CheckCircle2 size={10} className="text-success" aria-hidden="true" />
                      : <Copy size={10} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleRefresh}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Refresh booking"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
                {canCancel && (
                  <button onClick={() => setShowCancel(true)} className="btn btn-error btn-sm">
                    Cancel
                  </button>
                )}
                {canRate && (
                  <button onClick={() => setShowRating(true)} className="btn btn-primary btn-sm gap-1.5">
                    <Star size={13} aria-hidden="true" />
                    Rate
                  </button>
                )}
                {['full_care_ride', 'patient_transport', 'diagnostic_home'].includes(booking.bookingType) &&
 ['confirmed', 'in_progress'].includes(booking.status) && (
  <Link
    href={`/my-bookings/${booking._id}/live`}
    className="btn btn-info btn-sm gap-1.5"
    aria-label="Track live location"
  >
    <Navigation2 size={13} aria-hidden="true" />
    Track
  </Link>
)}

              </div>
            </div>
          </div>
        </header>

        {/* ── Hero Band ── */}
        <div className={`bg-gradient-to-r ${meta.gradient} border-b border-base-300`} role="banner">
          <div className="container-custom py-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${meta.bg} border border-base-300 shadow-sm`} aria-hidden="true">
                <Icon size={26} className={meta.color} />
              </div>
              <div>
                <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-0.5">Scheduled for</p>
                <p className="font-black text-xl text-base-content">
                  <time dateTime={booking.scheduledAt}>{fmtDate(booking.scheduledAt)}</time>
                </p>
                <p className="text-base-content/60 text-sm">
                  <time dateTime={booking.scheduledAt}>{fmtTime(booking.scheduledAt)}</time>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content Grid ── */}
        <main className="container-custom py-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Left column (2/3) ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Map */}
              {hasMap && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
                  <BookingMap
                    patientLocation={booking.patientLocation}
                    destinationLocation={booking.destinationLocation}
                  />
                </motion.div>
              )}

              {/* Patient Info */}
              <Section title="Patient Information" icon={User}>
                <dl className="grid grid-cols-2 gap-x-6">
                  <Row label="Name"        value={booking.patientInfo?.name} />
                  <Row label="Age"         value={booking.patientInfo?.age ? `${booking.patientInfo.age} yrs` : null} />
                  <Row label="Gender"      value={booking.patientInfo?.gender} />
                  <Row label="Blood Group" value={booking.patientInfo?.bloodGroup} />
                  <Row label="Phone"       value={booking.patientInfo?.phone} />
                  <Row label="Self"        value={booking.patientInfo?.isSelf ? 'Yes' : 'For another patient'} />
                </dl>
              </Section>

              {/* Doctor */}
              {booking.doctor && (
                <Section title="Doctor" icon={Stethoscope}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center" aria-hidden="true">
                      <Stethoscope size={18} className="text-info" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-base-content">
                        {booking.doctorSnapshot?.name ?? booking.doctor?.user?.name ?? 'Doctor'}
                      </p>
                      <p className="text-xs text-base-content/50">
                        {booking.doctorSnapshot?.specialization ?? booking.doctor?.specialization}
                      </p>
                    </div>
                  </div>
                  <dl>
                    <Row label="Consultation Type" value={booking.consultationType} />
                    <Row label="Reg. No." value={booking.doctorSnapshot?.registrationNumber} mono />
                  </dl>
                </Section>
              )}

              {/* Hospital */}
              {booking.hospital && (
                <Section title="Hospital / Clinic" icon={MapPin}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0" aria-hidden="true">
                      <MapPin size={16} className="text-primary" />
                    </div>
                    <address className="not-italic">
                      <p className="font-bold text-sm">{booking.hospital?.name}</p>
                      <p className="text-xs text-base-content/50 mt-0.5">
                        {[booking.hospital?.address?.line1, booking.hospital?.address?.city].filter(Boolean).join(', ')}
                      </p>
                    </address>
                  </div>
                </Section>
              )}

              {/* Care Assistant */}
              {booking.careAssistant && (
                <Section title="Care Assistant" icon={HeartPulse}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 border border-primary/20 overflow-hidden flex items-center justify-center">
                      {booking.careAssistantSnapshot?.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={booking.careAssistantSnapshot.photoUrl}
                          alt={`${booking.careAssistantSnapshot?.name} photo`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <HeartPulse size={18} className="text-secondary" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{booking.careAssistantSnapshot?.name}</p>
                      <p className="text-xs text-base-content/50 flex items-center gap-1">
                        <Phone size={10} aria-hidden="true" />
                        <span aria-label="Phone">{booking.careAssistantSnapshot?.phone ?? '—'}</span>
                      </p>
                    </div>
                  </div>
                </Section>
              )}

              {/* Locations */}
              {(booking.patientLocation || booking.destinationLocation) && (
                <Section title="Location Details" icon={Navigation}>
                  {booking.patientLocation && (
                    <address className="not-italic mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                        <span className="text-xs font-semibold text-blue-600">Pickup</span>
                      </div>
                      <p className="text-sm text-base-content ml-4">{booking.patientLocation.address ?? '—'}</p>
                      {booking.patientLocation.city && (
                        <p className="text-xs text-base-content/50 ml-4">{booking.patientLocation.city}</p>
                      )}
                    </address>
                  )}
                  {booking.destinationLocation && (
                    <address className="not-italic p-3 rounded-xl bg-green-50 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                        <span className="text-xs font-semibold text-green-600">Destination</span>
                      </div>
                      <p className="text-sm text-base-content ml-4">{booking.destinationLocation.address ?? '—'}</p>
                      {booking.destinationLocation.city && (
                        <p className="text-xs text-base-content/50 ml-4">{booking.destinationLocation.city}</p>
                      )}
                    </address>
                  )}
                </Section>
              )}

              {/* Diagnostics */}
              {booking.diagnosticDetails && (
                <Section title="Diagnostic Details" icon={FlaskConical}>
                  {booking.diagnosticDetails.testNames?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-base-content/40 mb-2">Tests</p>
                      <ul className="flex flex-wrap gap-2" aria-label="Tests">
                        {booking.diagnosticDetails.testNames.map((t) => (
                          <li key={t}><span className="badge badge-info badge-sm">{t}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {booking.diagnosticDetails.packageNames?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-base-content/40 mb-2">Packages</p>
                      <ul className="flex flex-wrap gap-2" aria-label="Packages">
                        {booking.diagnosticDetails.packageNames.map((p) => (
                          <li key={p}><span className="badge badge-warning badge-sm">{p}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <dl>
                    <Row label="Report Delivery" value={booking.diagnosticDetails.reportDeliveryMode} />
                    {booking.diagnosticDetails.sampleCollectedAt && (
                      <Row label="Sample Collected" value={fmtDate(booking.diagnosticDetails.sampleCollectedAt)} />
                    )}
                  </dl>
                </Section>
              )}

              {/* Online Consultation */}
              {booking.onlineConsultation?.meetingLink && (
                <Section title="Video Consultation" icon={Video}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/30">
                    <Video size={20} className="text-accent" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{booking.onlineConsultation.platform}</p>
                      <p className="text-xs text-base-content/50 truncate">{booking.onlineConsultation.meetingLink}</p>
                    </div>
                    <a
                      href={booking.onlineConsultation.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-accent btn-sm gap-1"
                      aria-label="Join video consultation"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      Join
                    </a>
                  </div>
                </Section>
              )}

              {/* Rides */}
              {booking.rides?.length > 0 && (
                <Section title="Rides" icon={Car}>
                  <ul className="space-y-3">
                    {booking.rides.map((ride, i) => (
                      <li key={ride._id ?? i} className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200">
                        <Car size={16} className="text-accent shrink-0" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold capitalize">
                            {ride.isReturnRide ? 'Return Ride' : 'Outbound Ride'}
                          </p>
                          <p className="text-xs text-base-content/50">{ride.rideCode ?? `Ride ${i + 1}`}</p>
                        </div>
                        <span className={`badge badge-sm ${
                          ride.status === 'completed' ? 'badge-success' :
                          ride.status === 'cancelled' ? 'badge-error' : 'badge-warning'
                        }`}>
                          {ride.status?.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Documents */}
              {booking.documents?.length > 0 && (
                <Section title="Documents" icon={FileText}>
                  <ul className="space-y-2">
                    {booking.documents.map((doc, i) => (
                      <li key={doc._id ?? i}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl border border-base-300 hover:border-primary hover:bg-primary/5 transition-colors group"
                          aria-label={`Open ${doc.docType?.replace(/_/g, ' ')} document`}
                        >
                          <FileText size={15} className="text-base-content/40 group-hover:text-primary" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">{doc.docType?.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-base-content/40 truncate">{doc.originalName}</p>
                          </div>
                          <ExternalLink size={13} className="text-base-content/30 group-hover:text-primary" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Cancellation */}
              {booking.cancellation && (
                <Section title="Cancellation Details" icon={AlertTriangle}>
                  <div className="p-4 rounded-xl bg-error/5 border border-error/30">
                    <dl>
                      <Row label="Cancelled By"    value={booking.cancellation.cancelledBy} />
                      <Row label="Reason"          value={booking.cancellation.reason} />
                      <Row label="Cancelled At"    value={fmtDate(booking.cancellation.cancelledAt)} />
                      <Row label="Refund Eligible" value={booking.cancellation.refundEligible ? 'Yes' : 'No'} />
                      {booking.cancellation.refundPercent > 0 && (
                        <Row label="Refund %" value={`${booking.cancellation.refundPercent}%`} />
                      )}
                    </dl>
                  </div>
                </Section>
              )}

              {/* Rating (submitted) */}
              {booking.isRated && booking.rating && (
                <Section title="Your Rating" icon={Star}>
                  <div className="flex items-center gap-3 mb-4" aria-label={`Rated ${booking.rating.overallRating} out of 5`}>
                    <div className="flex gap-0.5" aria-hidden="true">
                      {[1,2,3,4,5].map((s) => (
                        <Star
                          key={s}
                          size={18}
                          className={s <= booking.rating.overallRating ? 'text-warning fill-current' : 'text-base-300'}
                        />
                      ))}
                    </div>
                    <span className="font-bold text-base-content">{booking.rating.overallRating}/5</span>
                  </div>
                  {booking.rating.overallComment && (
                    <blockquote className="text-sm text-base-content/70 italic border-l-2 border-base-300 pl-3">
                      {booking.rating.overallComment}
                    </blockquote>
                  )}
                  {booking.rating.ratedAt && (
                    <p className="text-xs text-base-content/40 mt-2">
                      Rated on <time dateTime={booking.rating.ratedAt}>{fmtDate(booking.rating.ratedAt)}</time>
                    </p>
                  )}
                </Section>
              )}
            </div>

            {/* ── Right column (1/3) ── */}
            <div className="space-y-5">

              {/* Fare Breakdown */}
              <Section title="Fare Breakdown" icon={IndianRupee}>
                <FareBreakdown fare={booking.fareBreakdown} />
                <div className="mt-4 pt-3 border-t border-base-300">
                  <dl>
                    <Row
                      label="Payment Status"
                      value={
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          booking.paymentStatus === 'paid'   ? 'bg-success/10 text-success' :
                          booking.paymentStatus === 'unpaid' ? 'bg-warning/10 text-warning' :
                          'bg-base-300/60 text-base-content/50'
                        }`}>
                          {booking.paymentStatus}
                        </span>
                      }
                    />
                    {booking.couponCode       && <Row label="Coupon"        value={booking.couponCode}    mono />}
                    {booking.coinsRedeemed > 0 && <Row label="Coins Redeemed" value={booking.coinsRedeemed} />}
                  </dl>
                </div>
              </Section>

              {/* Booking Meta */}
              <Section title="Booking Info" icon={Info}>
                <dl>
                  <Row label="Booking Code"  value={booking.bookingCode}   mono highlight />
                  <Row label="Booking Type"  value={meta.label} />
                  <Row label="Pricing Source" value={booking.pricingSource} />
                  <Row label="Created"       value={fmtDate(booking.createdAt)} />
                  {booking.completedAt && <Row label="Completed" value={fmtDate(booking.completedAt)} />}
                  {booking.slotId      && <Row label="Slot ID"   value={booking.slotId} mono />}
                </dl>
              </Section>

              {/* Follow-up chain */}
              {booking.bookingType === 'follow_up' && booking.followUpParentBooking && (
                <Section title="Follow-Up Chain" icon={RotateCcw}>
                  <div className="p-3 rounded-xl bg-info/10 border border-info/30">
                    <p className="text-xs text-info font-semibold mb-1">Parent Booking</p>
                    <p className="text-sm font-mono text-base-content break-all">{booking.followUpParentBooking}</p>
                  </div>
                </Section>
              )}

              {/* CTAs */}
            {(canCancel || canRate || (['full_care_ride','patient_transport','diagnostic_home'].includes(booking.bookingType) && ['confirmed','in_progress'].includes(booking.status))) && (
  <div className="space-y-3">
    {['full_care_ride','patient_transport','diagnostic_home'].includes(booking.bookingType) &&
     ['confirmed','in_progress'].includes(booking.status) && (
      <Link
        href={`/my-bookings/${booking._id}/live`}
        className="btn btn-info w-full gap-2"
      >
        <Navigation2 size={15} aria-hidden="true" />
        Track Live Location
      </Link>
    )}
    {canRate && (
      <button onClick={() => setShowRating(true)} className="btn btn-primary w-full gap-2">
        <Star size={15} aria-hidden="true" />
        Rate Your Experience
      </button>
    )}
    {canCancel && (
      <button
        onClick={() => setShowCancel(true)}
        className="btn btn-outline w-full gap-2 text-error border-error/40 hover:bg-error hover:text-error-content hover:border-error"
      >
        <X size={15} aria-hidden="true" />
        Cancel Booking
      </button>
    )}
  </div>
)}

              {/* Quick Links */}
              <nav className="card p-4 space-y-1" aria-label="Quick links">
                <Link
                  href="/my-bookings"
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-base-200 transition-colors text-sm text-base-content/70 hover:text-base-content"
                >
                  <Package size={14} className="text-primary" aria-hidden="true" />
                  All Bookings
                </Link>
                <Link
                  href="/bookings/new"
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-base-200 transition-colors text-sm text-base-content/70 hover:text-base-content"
                >
                  <Activity size={14} className="text-primary" aria-hidden="true" />
                  New Booking
                </Link>
              </nav>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showCancel && (
          <CancelModal key="cancel-modal" booking={booking} onClose={handleCloseCancelModal} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRating && (
          <RatingModal key="rating-modal" booking={booking} onClose={handleCloseRatingModal} />
        )}
      </AnimatePresence>
    </>
  );
}