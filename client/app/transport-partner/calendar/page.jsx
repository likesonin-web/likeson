'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  RefreshCw,
  X,
  ChevronDown,
  MapPin,
  Zap,
  Shield,
  Activity,
  TrendingUp,
  Eye,
  Car,
  Navigation,
  BarChart3,
  Phone,
  Package,
  Star,
  Circle,
  Gauge,
  ArrowRight,
  Info,
  Building2,
} from 'lucide-react';

import {
  fetchTransportHours,
  fetchTransportFleetStatus,
  fetchTransportRidesSchedule,
  fetchTransportRidesByDate,
  selectTransportHours,
  selectTransportFleetStatus,
  selectTransportRidesSchedule,
  selectTransportRidesByDate,
  selectAvailabilityLoading,
  selectAvailabilityError,
} from '@/store/slices/availabilitySlice';

const selectUser = (s) => s.user.user;

// ── Constants ──────────────────────────────────────────────────────────────────

const DAY_KEYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const RIDE_STATUS_CFG = {
  requested:       { color: 'var(--info)',      label: 'Requested',    dot: '#60b4f0' },
  searching:       { color: 'var(--warning)',   label: 'Searching',    dot: '#f5a623' },
  driver_assigned: { color: 'var(--primary)',   label: 'Assigned',     dot: '#4a90e2' },
  driver_accepted: { color: 'var(--primary)',   label: 'Accepted',     dot: '#4a90e2' },
  driver_en_route: { color: 'var(--accent)',    label: 'En Route',     dot: '#f0c040' },
  driver_arrived:  { color: 'var(--accent)',    label: 'Arrived',      dot: '#f0c040' },
  in_progress:     { color: 'var(--success)',   label: 'In Progress',  dot: '#47c97e' },
  completed:       { color: 'var(--success)',   label: 'Completed',    dot: '#47c97e' },
  cancelled:       { color: 'var(--error)',     label: 'Cancelled',    dot: '#e05c5c' },
  no_driver_found: { color: 'var(--error)',     label: 'No Driver',    dot: '#e05c5c' },
};

const VEHICLE_TYPE_ICONS = {
  Bike: '🏍️', Scooter: '🛵', Auto: '🛺', 'E-Rickshaw': '⚡',
  Hatchback: '🚗', Sedan: '🚙', SUV: '🚐', MUV: '🚌',
  Van: '🚐', Minivan: '🚐', 'Tempo-Traveller': '🚐', Minibus: '🚌',
  'Wheelchair-Van': '♿', 'Mortuary-Van': '🚐', Bus: '🚌',
  Truck: '🚛', Pickup: '🛻',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWeekDates(base) {
  const d = new Date(base);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd;
  });
}

function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function fmtDate(d) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${fmtTime(iso)}`;
}

function timeToMinutes(t = '') {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

function availBarStyle(start = '06:00', end = '22:00') {
  const s    = timeToMinutes(start);
  const e    = timeToMinutes(end);
  const left = (s / 1440) * 100;
  const w    = ((e - s) / 1440) * 100;
  return { left: `${left}%`, width: `${Math.max(w, 3)}%` };
}

// ── Mock data factory ──────────────────────────────────────────────────────────

function buildMockHours() {
  return {
    businessName: 'Likeson Transport Agency',
    isAvailable:  true,
    availabilityHours: { start: '06:00', end: '22:00' },
    serviceZones: [
      { city: 'Vijayawada', state: 'AP', radiusKm: 20, isActive: true },
      { city: 'Guntur',     state: 'AP', radiusKm: 15, isActive: true },
    ],
  };
}

function buildMockFleet() {
  return {
    businessName: 'Likeson Transport Agency',
    fleetInfo: { totalVehicles: 12, activeVehicles: 9, totalDrivers: 14, activeDrivers: 10 },
    vehicleSummary: { total: 12, verified: 10, active: 9 },
    vehicles: [
      { _id: 'v1', registrationNumber: 'AP16AB1234', vehicleType: 'Sedan',   make: 'Maruti', model: 'Dzire',   color: 'White',  isActive: true,  verificationStatus: 'verified', hasAC: true },
      { _id: 'v2', registrationNumber: 'AP16CD5678', vehicleType: 'SUV',     make: 'Toyota', model: 'Innova',  color: 'Silver', isActive: true,  verificationStatus: 'verified', hasAC: true, hasStretcherSupport: true },
      { _id: 'v3', registrationNumber: 'AP16EF9012', vehicleType: 'Van',     make: 'Maruti', model: 'Eeco',    color: 'Blue',   isActive: true,  verificationStatus: 'verified', hasAC: false },
      { _id: 'v4', registrationNumber: 'AP16GH3456', vehicleType: 'Wheelchair-Van', make: 'Force', model: 'Traveller', color: 'White', isActive: true, verificationStatus: 'verified', isWheelchairAccessible: true, hasAC: true },
      { _id: 'v5', registrationNumber: 'AP16IJ7890', vehicleType: 'Hatchback', make: 'Hyundai', model: 'i20',  color: 'Red',    isActive: false, verificationStatus: 'pending',  hasAC: true },
      { _id: 'v6', registrationNumber: 'AP16KL2345', vehicleType: 'Sedan',   make: 'Honda',  model: 'Amaze',  color: 'Black',  isActive: true,  verificationStatus: 'verified', hasAC: true },
    ],
  };
}

function buildMockRides() {
  const statuses = ['driver_assigned','in_progress','driver_en_route','completed','driver_accepted','searching'];
  const patients = ['Raju Verma','Lakshmi Bai','Anand Kumar','Sravani Devi','Pradeep Nair','Meena Rao'];
  const types    = ['patient','care_assistant','diagnostic_tech','patient','patient','care_assistant'];
  const now      = Date.now();
  return Array.from({ length: 10 }, (_, i) => ({
    _id:              `ride-${i}`,
    rideCode:         `RD-${Math.random().toString(36).slice(-6).toUpperCase()}`,
    rideType:         types[i % types.length],
    status:           statuses[i % statuses.length],
    scheduledPickupAt: new Date(now + (i - 3) * 3600000 * 6).toISOString(),
    booking: { bookingCode: `BK-${Math.random().toString(36).slice(-6).toUpperCase()}`, patientInfo: { name: patients[i % patients.length] } },
    driver: { driverCode: `LKS-DRV-${String(i+1).padStart(4,'0')}`, legalName: ['Suresh K','Ravi P','Mani T','Kiran B','Arjun S'][i % 5], phone: '9876543210' },
    vehicleSnapshot: { registrationNumber: `AP16XX${1000+i}`, vehicleType: ['Sedan','SUV','Van','Wheelchair-Van'][i%4], make: 'Maruti', model: 'Dzire' },
    estimatedDistanceKm: 5 + i * 2.3,
    fare: { totalFare: 150 + i * 45, platformFee: 15 + i * 4 },
  }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'var(--primary)', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 6,
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -10, right: -10,
        width: 60, height: 60, borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, position: 'relative' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 45%, transparent)' }}>{sub}</div>}
    </motion.div>
  );
}

function AvailBadge({ isAvailable }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      background: isAvailable
        ? 'color-mix(in srgb, var(--success) 15%, transparent)'
        : 'color-mix(in srgb, var(--error) 12%, transparent)',
      color: isAvailable ? 'var(--success)' : 'var(--error)',
      border: `1px solid ${isAvailable ? 'var(--success)' : 'var(--error)'}40`,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: isAvailable ? 'var(--success)' : 'var(--error)',
        display: 'inline-block',
      }} />
      {isAvailable ? 'Available' : 'Unavailable'}
    </span>
  );
}

function RideStatusPill({ status }) {
  const cfg = RIDE_STATUS_CFG[status] || { color: 'var(--neutral)', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`,
      color: cfg.color,
      border: `1px solid ${cfg.color}35`,
      textTransform: 'capitalize',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

function HourAxis() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {[0,3,6,9,12,15,18,21,24].map(h => (
        <div key={h} style={{
          position: 'absolute',
          left: `${(h/24)*100}%`,
          top: 0, bottom: 0,
          borderLeft: '1px dashed color-mix(in srgb, var(--base-content) 10%, transparent)',
        }}>
          {h < 24 && (
            <span style={{
              position: 'absolute', bottom: -14,
              fontSize: 8,
              color: 'color-mix(in srgb, var(--base-content) 35%, transparent)',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}>
              {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Fleet vehicle card ─────────────────────────────────────────────────────────

function VehicleCard({ vehicle, idx }) {
  const active   = vehicle.verificationStatus === 'verified' && vehicle.isActive;
  const verified = vehicle.verificationStatus === 'verified';
  const emoji    = VEHICLE_TYPE_ICONS[vehicle.vehicleType] ?? '🚗';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.05 }}
      whileHover={{ y: -2 }}
      style={{
        background: 'var(--base-100)',
        border: `1.5px solid ${active ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'var(--base-300)'}`,
        borderRadius: 14,
        padding: '14px 16px',
        opacity: active ? 1 : 0.65,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Status stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: active ? 'var(--success)' : verified ? 'var(--warning)' : 'var(--error)',
        borderRadius: '14px 0 0 14px',
      }} />

      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>{emoji}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--base-content)' }}>
                {vehicle.make} {vehicle.model}
              </div>
              <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)', fontWeight: 600 }}>
                {vehicle.registrationNumber}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
            background: active
              ? 'color-mix(in srgb, var(--success) 15%, transparent)'
              : verified
                ? 'color-mix(in srgb, var(--warning) 15%, transparent)'
                : 'color-mix(in srgb, var(--error) 12%, transparent)',
            color: active ? 'var(--success)' : verified ? 'var(--warning)' : 'var(--error)',
          }}>
            {active ? 'Active' : verified ? 'Inactive' : 'Pending'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Car size={9} style={{ color: 'var(--primary)' }} />
            {vehicle.vehicleType}
          </span>
          {vehicle.color && (
            <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 45%, transparent)' }}>
              • {vehicle.color}
            </span>
          )}
          {vehicle.hasAC && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'color-mix(in srgb, var(--info) 15%, transparent)', color: 'var(--info)', fontWeight: 700 }}>AC</span>}
          {vehicle.isWheelchairAccessible && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontWeight: 700 }}>♿</span>}
          {vehicle.hasStretcherSupport && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'color-mix(in srgb, var(--secondary) 15%, transparent)', color: 'var(--secondary)', fontWeight: 700 }}>Stretcher</span>}
          {vehicle.hasOxygenSupport && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)', fontWeight: 700 }}>O₂</span>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Ride row ───────────────────────────────────────────────────────────────────

function RideRow({ ride, idx, onClick }) {
  const at = ride.scheduledPickupAt ? new Date(ride.scheduledPickupAt) : null;
  const isPast = at && at < new Date();
  const isActive = ['driver_assigned','driver_accepted','driver_en_route','driver_arrived','in_progress'].includes(ride.status);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      whileHover={{ x: 2 }}
      onClick={() => onClick(ride)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 130px 140px 120px 90px 32px',
        gap: 12, alignItems: 'center',
        padding: '12px 16px',
        background: isActive
          ? 'color-mix(in srgb, var(--primary) 5%, var(--base-100))'
          : 'var(--base-100)',
        borderBottom: '1px solid var(--base-300)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {/* Ride info */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--base-content)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}
            />
          )}
          {ride.rideCode}
        </div>
        <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Package size={9} style={{ color: 'var(--accent)' }} />
          {ride.rideType?.replace(/_/g, ' ')}
          {ride.booking?.patientInfo?.name && (
            <> · <User size={9} /> {ride.booking.patientInfo.name}</>
          )}
        </div>
      </div>

      {/* Driver */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--base-content)' }}>
          {ride.driver?.legalName ?? '—'}
        </div>
        <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 45%, transparent)' }}>
          {ride.driver?.driverCode ?? ''}
        </div>
      </div>

      {/* Vehicle */}
      <div style={{ fontSize: 11, color: 'var(--base-content)' }}>
        <div style={{ fontWeight: 600 }}>{ride.vehicleSnapshot?.registrationNumber ?? '—'}</div>
        <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 45%, transparent)' }}>
          {VEHICLE_TYPE_ICONS[ride.vehicleSnapshot?.vehicleType] ?? ''} {ride.vehicleSnapshot?.vehicleType}
        </div>
      </div>

      {/* Time */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: isPast && !isActive ? 'color-mix(in srgb, var(--base-content) 40%, transparent)' : 'var(--base-content)' }}>
          {at ? at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 40%, transparent)' }}>
          {at ? fmtDate(at) : ''}
        </div>
      </div>

      {/* Status */}
      <RideStatusPill status={ride.status} />

      {/* Arrow */}
      <ArrowRight size={14} style={{ color: 'color-mix(in srgb, var(--base-content) 30%, transparent)' }} />
    </motion.div>
  );
}

// ── Ride detail modal ──────────────────────────────────────────────────────────

function RideModal({ ride, onClose }) {
  if (!ride) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 20, padding: 0,
            width: '100%', maxWidth: 460,
            boxShadow: 'var(--shadow-depth)',
            overflow: 'hidden',
          }}
        >
          {/* Modal header */}
          <div style={{
            padding: '18px 20px',
            background: 'color-mix(in srgb, var(--primary) 10%, var(--base-200))',
            borderBottom: '1px solid var(--base-300)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'color-mix(in srgb, var(--primary) 20%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Truck size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--base-content)' }}>{ride.rideCode}</div>
                <RideStatusPill status={ride.status} />
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--base-content)' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Sections */}
            {[
              {
                title: 'Patient', icon: User, items: [
                  { label: 'Name',    value: ride.booking?.patientInfo?.name ?? '—' },
                  { label: 'Booking', value: ride.booking?.bookingCode ?? '—' },
                  { label: 'Type',    value: ride.rideType?.replace(/_/g,' ') ?? '—' },
                ]
              },
              {
                title: 'Driver', icon: Navigation, items: [
                  { label: 'Name',   value: ride.driver?.legalName ?? '—' },
                  { label: 'Code',   value: ride.driver?.driverCode ?? '—' },
                  { label: 'Phone',  value: ride.driver?.phone ?? '—' },
                ]
              },
              {
                title: 'Vehicle', icon: Car, items: [
                  { label: 'Reg No', value: ride.vehicleSnapshot?.registrationNumber ?? '—' },
                  { label: 'Type',   value: `${VEHICLE_TYPE_ICONS[ride.vehicleSnapshot?.vehicleType] ?? ''} ${ride.vehicleSnapshot?.vehicleType ?? '—'}` },
                  { label: 'Make',   value: `${ride.vehicleSnapshot?.make ?? ''} ${ride.vehicleSnapshot?.model ?? ''}`.trim() || '—' },
                ]
              },
              {
                title: 'Trip', icon: Activity, items: [
                  { label: 'Pickup',     value: fmtDateTime(ride.scheduledPickupAt) },
                  { label: 'Distance',   value: ride.estimatedDistanceKm ? `${ride.estimatedDistanceKm.toFixed(1)} km` : '—' },
                  { label: 'Total Fare', value: ride.fare?.totalFare ? `₹${ride.fare.totalFare}` : '—' },
                  { label: 'Platform Fee', value: ride.fare?.platformFee ? `₹${ride.fare.platformFee}` : '—' },
                ]
              },
            ].map(({ title, icon: Icon, items }) => (
              <div key={title}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon size={11} />
                  {title}
                </div>
                <div style={{
                  background: 'var(--base-200)', borderRadius: 10, overflow: 'hidden',
                  border: '1px solid var(--base-300)',
                }}>
                  {items.map(({ label, value }, i) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: i < items.length - 1 ? '1px solid var(--base-300)' : 'none',
                    }}>
                      <span style={{ fontSize: 12, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--base-content)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%' }}>
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Week day cell ──────────────────────────────────────────────────────────────

function DayCell({ date, ridesSchedule, isAvailable, hours }) {
  const today = isToday(date);
  const dayRides = ridesSchedule.filter(r => {
    if (!r.scheduledPickupAt) return false;
    const d = new Date(r.scheduledPickupAt);
    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  });
  const activeCount = dayRides.filter(r => ['driver_assigned','driver_accepted','driver_en_route','in_progress'].includes(r.status)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: today
          ? 'color-mix(in srgb, var(--primary) 7%, var(--base-100))'
          : 'var(--base-100)',
        border: `1.5px solid ${today ? 'var(--primary)' : 'var(--base-300)'}`,
        borderRadius: 12, overflow: 'hidden',
        minHeight: 140,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '9px 11px 7px',
        background: today
          ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
          : 'var(--base-200)',
        borderBottom: '1px solid var(--base-300)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: today ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content) 50%, transparent)' }}>
            {DAY_LABELS[DAY_KEYS.indexOf(DAY_KEYS.find((_, i) => {
              const mon = new Date(date);
              mon.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
              return date.getDay() === (i + 1) % 7 || (i === 6 && date.getDay() === 0);
            }) ?? 0)]}
            {DAY_LABELS[((date.getDay() + 6) % 7)]}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: today ? 'var(--primary)' : 'var(--base-content)', lineHeight: 1.1 }}>
            {date.getDate()}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          {!isAvailable && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)', fontWeight: 700 }}>
              Unavail.
            </span>
          )}
          {dayRides.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>
              {dayRides.length} ride{dayRides.length !== 1 ? 's' : ''}
            </span>
          )}
          {activeCount > 0 && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              {activeCount} live
            </motion.span>
          )}
        </div>
      </div>

      {/* Availability bar */}
      {isAvailable && hours?.start && (
        <div style={{ padding: '8px 10px 2px', position: 'relative', height: 36 }}>
          <HourAxis />
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            style={{
              position: 'absolute', top: 6, height: 14,
              borderRadius: 5, transformOrigin: 'left',
              background: 'color-mix(in srgb, var(--primary) 22%, transparent)',
              border: '1.5px solid color-mix(in srgb, var(--primary) 55%, transparent)',
              ...availBarStyle(hours.start, hours.end),
              display: 'flex', alignItems: 'center', paddingLeft: 4,
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 8, color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {hours.start}–{hours.end}
            </span>
          </motion.div>
        </div>
      )}

      {/* Ride status dots */}
      {dayRides.length > 0 && (
        <div style={{ padding: '6px 10px 8px', flex: 1 }}>
          {dayRides.slice(0, 4).map((r, i) => {
            const cfg = RIDE_STATUS_CFG[r.status] || {};
            return (
              <div key={r._id} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                marginBottom: 3, overflow: 'hidden',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot ?? 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'var(--base-content)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {r.rideCode}
                </span>
              </div>
            );
          })}
          {dayRides.length > 4 && (
            <span style={{ fontSize: 9, color: 'color-mix(in srgb, var(--base-content) 45%, transparent)' }}>
              +{dayRides.length - 4} more
            </span>
          )}
        </div>
      )}

      {dayRides.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'color-mix(in srgb, var(--base-content) 20%, transparent)', fontSize: 11, fontStyle: 'italic' }}>
          No rides
        </div>
      )}
    </motion.div>
  );
}

// ── Service zone card ──────────────────────────────────────────────────────────

function ZoneCard({ zone, idx }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.06 }}
      style={{
        background: zone.isActive
          ? 'color-mix(in srgb, var(--primary) 8%, var(--base-100))'
          : 'var(--base-200)',
        border: `1px solid ${zone.isActive ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'var(--base-300)'}`,
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: zone.isActive ? 1 : 0.6,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: zone.isActive
          ? 'color-mix(in srgb, var(--primary) 18%, transparent)'
          : 'var(--base-300)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <MapPin size={15} style={{ color: zone.isActive ? 'var(--primary)' : 'var(--neutral-content)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--base-content)' }}>
          {zone.city}
        </div>
        <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)', display: 'flex', gap: 8, marginTop: 1 }}>
          <span>{zone.state}</span>
          {zone.radiusKm && <span>· {zone.radiusKm} km radius</span>}
          {zone.pinCodes?.length > 0 && <span>· {zone.pinCodes.length} pin codes</span>}
        </div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
        background: zone.isActive ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--error) 12%, transparent)',
        color: zone.isActive ? 'var(--success)' : 'var(--error)',
      }}>
        {zone.isActive ? 'Active' : 'Inactive'}
      </span>
    </motion.div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'color-mix(in srgb, var(--primary) 16%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--base-content)' }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)' }}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--base-200)', padding: 4, borderRadius: 12, marginBottom: 20 }}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer', transition: '0.2s',
            background: active === id ? 'var(--base-100)' : 'transparent',
            color: active === id ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content) 55%, transparent)',
            boxShadow: active === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────────

export default function TransportPartnerAvailabilityCalendar() {
  const dispatch = useDispatch();

  const hours         = useSelector(selectTransportHours);
  const fleetStatus   = useSelector(selectTransportFleetStatus);
  const ridesSchedule = useSelector(selectTransportRidesSchedule);
  const loading       = useSelector(selectAvailabilityLoading);
  const error         = useSelector(selectAvailabilityError);

  const [baseDate,     setBaseDate]     = useState(new Date());
  const [activeTab,    setActiveTab]    = useState('calendar');
  const [selectedRide, setSelectedRide] = useState(null);
  const [rideFilter,   setRideFilter]   = useState('all');
  const [refreshing,   setRefreshing]   = useState(false);

  // Use mock data when redux is empty (remove in production)
  const hoursData   = hours       || buildMockHours();
  const fleetData   = fleetStatus || buildMockFleet();
  const ridesData   = ridesSchedule.length ? ridesSchedule : buildMockRides();

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

  useEffect(() => {
    dispatch(fetchTransportHours());
    dispatch(fetchTransportFleetStatus());
    dispatch(fetchTransportRidesSchedule({ days: 14 }));
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchTransportHours()),
      dispatch(fetchTransportFleetStatus()),
      dispatch(fetchTransportRidesSchedule({ days: 14 })),
    ]);
    setTimeout(() => setRefreshing(false), 700);
  }, [dispatch]);

  const navWeek = (dir) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dir * 7);
    setBaseDate(d);
  };

  const filteredRides = useMemo(() => {
    if (rideFilter === 'all') return ridesData;
    if (rideFilter === 'active') return ridesData.filter(r => ['driver_assigned','driver_accepted','driver_en_route','driver_arrived','in_progress'].includes(r.status));
    return ridesData.filter(r => r.status === rideFilter);
  }, [ridesData, rideFilter]);

  const weekLabel = useMemo(() => {
    const s = weekDates[0], e = weekDates[6];
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()} – ${e.getDate()} ${s.toLocaleString('en-IN', { month: 'long' })} ${s.getFullYear()}`;
    return `${fmtDate(s)} – ${fmtDate(e)}`;
  }, [weekDates]);

  const activeRides = ridesData.filter(r => ['driver_assigned','driver_accepted','driver_en_route','driver_arrived','in_progress'].includes(r.status));

  const TABS = [
    { id: 'calendar', label: 'Calendar',   icon: Calendar  },
    { id: 'rides',    label: 'Rides',      icon: Truck     },
    { id: 'fleet',    label: 'Fleet',      icon: Car       },
    { id: 'zones',    label: 'Zones',      icon: MapPin    },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme="transportpartner"
      style={{
        minHeight: '100vh',
        background: 'var(--base-200)',
        fontFamily: 'var(--font-family-poppins)',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 20 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Truck size={22} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h1 style={{
                    fontFamily: 'var(--font-family-montserrat)',
                    fontSize: 22, fontWeight: 900,
                    color: 'var(--base-content)', margin: 0, lineHeight: 1.2,
                  }}>
                    {hoursData.businessName ?? 'Transport Availability'}
                  </h1>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <AvailBadge isAvailable={hoursData.isAvailable} />
                    {hoursData.availabilityHours?.start && (
                      <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} style={{ color: 'var(--primary)' }} />
                        {hoursData.availabilityHours.start} – {hoursData.availabilityHours.end}
                      </span>
                    )}
                    {activeRides.length > 0 && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                        {activeRides.length} live ride{activeRides.length !== 1 ? 's' : ''}
                      </motion.span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleRefresh}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--base-100)', border: '1px solid var(--base-300)',
                borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                color: 'var(--base-content)', fontSize: 12, fontWeight: 600,
              }}
            >
              <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 0.7 }}>
                <RefreshCw size={13} />
              </motion.div>
              Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="alert alert-error"
            style={{ marginBottom: 14, borderRadius: 12 }}
          >
            <AlertCircle size={15} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </motion.div>
        )}

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10, marginBottom: 20,
        }}>
          <StatCard icon={Car}       label="Total Vehicles"  value={fleetData.vehicleSummary?.total    ?? 0} sub={`${fleetData.vehicleSummary?.verified ?? 0} verified`}   color="var(--primary)"   delay={0}    />
          <StatCard icon={Zap}       label="Active Vehicles" value={fleetData.vehicleSummary?.active   ?? 0} sub="fleet ready"                                              color="var(--success)"   delay={0.04} />
          <StatCard icon={Users}     label="Total Drivers"   value={fleetData.fleetInfo?.totalDrivers  ?? 0} sub={`${fleetData.fleetInfo?.activeDrivers ?? 0} active`}      color="var(--secondary)" delay={0.08} />
          <StatCard icon={Truck}     label="Rides This Week" value={ridesData.length}                        sub={`${activeRides.length} live now`}                        color="var(--accent)"    delay={0.12} />
          <StatCard icon={MapPin}    label="Service Zones"   value={hoursData.serviceZones?.length ?? 0}     sub="active zones"                                            color="var(--info)"      delay={0.16} />
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────────── */}
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ── Loading ────────────────────────────────────────────────────────── */}
        {loading && !refreshing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
                className="skeleton"
                style={{ height: 140, borderRadius: 12 }}
              />
            ))}
          </div>
        )}

        {/* ══════════════════════ CALENDAR TAB ════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'calendar' && !loading && (
            <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Week nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[-1, 1].map(dir => (
                    <motion.button
                      key={dir}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => navWeek(dir)}
                      style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: 'var(--base-100)', border: '1px solid var(--base-300)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--base-content)',
                      }}
                    >
                      {dir === -1 ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
                    </motion.button>
                  ))}
                  <button
                    onClick={() => setBaseDate(new Date())}
                    style={{
                      padding: '5px 12px', borderRadius: 9, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                      color: 'var(--primary)',
                    }}
                  >
                    Today
                  </button>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--base-content)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} style={{ color: 'var(--primary)' }} />
                  {weekLabel}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(RIDE_STATUS_CFG).slice(0, 4).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.dot, display: 'inline-block' }} />
                      {v.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Day labels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
                {weekDates.map((date, i) => (
                  <div key={i} style={{
                    textAlign: 'center', fontSize: 10, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: isToday(date) ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content) 45%, transparent)',
                  }}>
                    {DAY_LABELS[i]}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {weekDates.map((date, i) => (
                  <DayCell
                    key={i}
                    date={date}
                    ridesSchedule={ridesData}
                    isAvailable={hoursData.isAvailable}
                    hours={hoursData.availabilityHours}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════ RIDES TAB ══════════════════════════════════ */}
          {activeTab === 'rides' && !loading && (
            <motion.div key="rides" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionHeader
                icon={Truck}
                title="Rides Schedule"
                sub={`${filteredRides.length} rides · ${activeRides.length} live`}
                action={
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['all','active','completed','cancelled'].map(f => (
                      <button
                        key={f}
                        onClick={() => setRideFilter(f)}
                        style={{
                          padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', transition: '0.15s',
                          background: rideFilter === f ? 'var(--primary)' : 'var(--base-100)',
                          color: rideFilter === f ? 'var(--primary-content)' : 'var(--base-content)',
                          border: `1px solid ${rideFilter === f ? 'var(--primary)' : 'var(--base-300)'}`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                }
              />

              <div style={{
                background: 'var(--base-100)',
                border: '1px solid var(--base-300)',
                borderRadius: 14, overflow: 'hidden',
              }}>
                {/* Table head */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 140px 120px 90px 32px',
                  gap: 12, padding: '10px 16px',
                  background: 'var(--base-200)',
                  borderBottom: '1px solid var(--base-300)',
                }}>
                  {['Ride', 'Driver', 'Vehicle', 'Pickup Time', 'Status', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'color-mix(in srgb, var(--base-content) 50%, transparent)' }}>
                      {h}
                    </div>
                  ))}
                </div>

                {filteredRides.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'color-mix(in srgb, var(--base-content) 35%, transparent)', fontSize: 13, fontStyle: 'italic' }}>
                    No rides match the current filter
                  </div>
                ) : (
                  filteredRides.map((ride, i) => (
                    <RideRow key={ride._id} ride={ride} idx={i} onClick={setSelectedRide} />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════ FLEET TAB ═════════════════════════════════ */}
          {activeTab === 'fleet' && !loading && (
            <motion.div key="fleet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionHeader
                icon={Car}
                title="Fleet Status"
                sub={`${fleetData.vehicleSummary?.active ?? 0} of ${fleetData.vehicleSummary?.total ?? 0} vehicles active`}
              />

              {/* Fleet summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Total Vehicles',  value: fleetData.vehicleSummary?.total    ?? 0, color: 'var(--primary)'   },
                  { label: 'Verified',        value: fleetData.vehicleSummary?.verified ?? 0, color: 'var(--info)'      },
                  { label: 'Active',          value: fleetData.vehicleSummary?.active   ?? 0, color: 'var(--success)'   },
                  { label: 'Total Drivers',   value: fleetData.fleetInfo?.totalDrivers  ?? 0, color: 'var(--secondary)' },
                  { label: 'Active Drivers',  value: fleetData.fleetInfo?.activeDrivers ?? 0, color: 'var(--accent)'    },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'var(--base-100)',
                    border: '1px solid var(--base-300)',
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                    <span style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Vehicle grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {(fleetData.vehicles ?? []).map((v, i) => (
                  <VehicleCard key={v._id} vehicle={v} idx={i} />
                ))}
              </div>

              {!(fleetData.vehicles?.length) && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'color-mix(in srgb, var(--base-content) 35%, transparent)', fontStyle: 'italic' }}>
                  No vehicle data available
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════ ZONES TAB ═════════════════════════════════ */}
          {activeTab === 'zones' && !loading && (
            <motion.div key="zones" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SectionHeader
                icon={MapPin}
                title="Service Zones"
                sub={`${hoursData.serviceZones?.filter(z => z.isActive).length ?? 0} active · ${hoursData.serviceZones?.length ?? 0} total`}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {(hoursData.serviceZones ?? []).map((zone, i) => (
                  <ZoneCard key={zone._id ?? i} zone={zone} idx={i} />
                ))}
              </div>
              {!hoursData.serviceZones?.length && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'color-mix(in srgb, var(--base-content) 35%, transparent)', fontStyle: 'italic' }}>
                  No service zones configured
                </div>
              )}

              {/* Availability window */}
              <div style={{ marginTop: 24 }}>
                <SectionHeader icon={Clock} title="Availability Window" />
                <div style={{
                  background: 'var(--base-100)',
                  border: '1px solid var(--base-300)',
                  borderRadius: 14, padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                    <AvailBadge isAvailable={hoursData.isAvailable} />
                    {hoursData.availabilityHours?.start && (
                      <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--base-content)' }}>
                        {hoursData.availabilityHours.start} – {hoursData.availabilityHours.end}
                      </span>
                    )}
                  </div>
                  {/* 24h visual bar */}
                  <div style={{ position: 'relative', height: 28, marginTop: 8, marginBottom: 20 }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'var(--base-200)',
                      borderRadius: 8, border: '1px solid var(--base-300)',
                    }} />
                    <HourAxis />
                    {hoursData.isAvailable && hoursData.availabilityHours?.start && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.2 }}
                        style={{
                          position: 'absolute',
                          top: 4, bottom: 4,
                          borderRadius: 6,
                          background: 'color-mix(in srgb, var(--primary) 28%, transparent)',
                          border: '1.5px solid color-mix(in srgb, var(--primary) 60%, transparent)',
                          transformOrigin: 'left',
                          ...availBarStyle(hoursData.availabilityHours.start, hoursData.availabilityHours.end),
                          display: 'flex', alignItems: 'center', paddingLeft: 8,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                          {hoursData.availabilityHours.start} – {hoursData.availabilityHours.end}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── Ride modal ─────────────────────────────────────────────────────── */}
      <RideModal ride={selectedRide} onClose={() => setSelectedRide(null)} />
    </div>
  );
}