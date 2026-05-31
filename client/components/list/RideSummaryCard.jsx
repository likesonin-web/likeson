'use client';
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Route, Clock, MapPin, Car, Navigation, Building2, Calendar } from 'lucide-react';
import { formatEta, formatDistance } from '@/utils/navigationUtils';

const Row = ({ icon: Icon, label, value, accent = false }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-base-300 last:border-0">
    <div className="flex items-center gap-2 text-xs text-base-content/50">
      <Icon size={12} className={accent ? 'text-primary' : ''} />
      {label}
    </div>
    <span className={`text-xs font-semibold ${accent ? 'text-primary' : 'text-base-content'}`}>{value}</span>
  </div>
);

const RideSummaryCard = memo(function RideSummaryCard({ ride, tracking, booking }) {
  if (!ride) return null;

  const totalDist   = tracking?.totalDistanceKm ?? ride?.estimatedDistanceKm ?? null;
  const travelledKm = tracking?.summary?.totalDistanceKm ?? null;
  const remainingKm = tracking?.currentEtaMinutes != null
    ? null // Would need actual remaining km from etaUpdates
    : null;
  const schedTime   = ride.scheduledPickupAt ? new Date(ride.scheduledPickupAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const startTime   = ride.rideStartedAt     ? new Date(ride.rideStartedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const arrivalTime = ride.rideCompletedAt   ? new Date(ride.rideCompletedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const vehicleType = ride.vehicleSnapshot?.vehicleType ?? ride.vehicleClass ?? '—';
  const rideType    = booking?.bookingType ?? '—';
  const navTarget   = ride.activeNavigationTarget ?? '—';
  const hospital    = tracking?.hospital ?? booking?.nearestHospitalSnapshot?.hospitalName ?? null;

  const TARGET_LABELS = {
    pickup_care_assistant: 'Pickup Care Assistant',
    pickup_patient:        'Pickup Patient',
    dropoff_hospital:      'Drop at Hospital',
    dropoff_destination:   'Drop at Destination',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Route size={14} className="text-primary" />
        </div>
        <h4 className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Ride Summary</h4>
      </div>

      <div>
        {totalDist != null && (
          <Row icon={Route} label="Total Distance" value={formatDistance(totalDist)} accent />
        )}
        {travelledKm != null && (
          <Row icon={Navigation} label="Travelled" value={formatDistance(travelledKm)} />
        )}
        <Row icon={Calendar} label="Scheduled"    value={schedTime} />
        {ride.rideStartedAt && <Row icon={Clock}  label="Started"       value={startTime} />}
        {ride.rideCompletedAt && <Row icon={Clock} label="Arrived"       value={arrivalTime} />}
        <Row icon={Car}       label="Vehicle"      value={vehicleType} />
        <Row icon={Navigation} label="Target"      value={TARGET_LABELS[navTarget] ?? navTarget} />
        {hospital && <Row icon={Building2} label="Hospital" value={hospital} />}
      </div>
    </motion.div>
  );
});

export default RideSummaryCard;