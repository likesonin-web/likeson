'use client';
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, MapPin, Zap, ArrowLeft, Activity } from 'lucide-react';
import TrackingConnectionBadge from './TrackingConnectionBadge';

// Map ride statuses → human labels
const STATUS_LABELS = {
  searching:         'Finding Driver',
  driver_assigned:   'Driver Assigned',
  driver_accepted:   'Driver Accepted',
  driver_en_route:   'Driver En Route',
  driver_arrived:    'Driver Arrived',
  otp_verified:      'OTP Verified',
  in_progress:       'Ride In Progress',
  at_stop:           'At Stop',
  completed:         'Ride Completed',
  cancelled:         'Ride Cancelled',
  no_driver_found:   'No Driver Found',
};

// Map rideStage → human labels
const STAGE_LABELS = {
  searching_driver:       'Finding Driver',
  driver_to_care_assistant: 'Driver To Care Assistant',
  driver_to_patient:      'Driver To Patient',
  patient_onboard:        'Patient Onboard',
  care_assistant_joined:  'Care Assistant Joined',
  enroute_hospital:       'En Route To Hospital',
  hospital_reached:       'Hospital Reached',
  return_trip:            'Return Trip',
  completed:              'Completed',
  cancelled:              'Cancelled',
};

// Map activeNavigationTarget → human labels
const TARGET_LABELS = {
  pickup_care_assistant: 'Pickup Care Assistant',
  pickup_patient:        'Pickup Patient',
  dropoff_hospital:      'Drop At Hospital',
  dropoff_destination:   'Drop At Destination',
  return_pickup:         'Return Pickup',
};

const STATUS_COLORS = {
  searching:       'bg-warning/10 text-warning border-warning/30',
  driver_assigned: 'bg-info/10 text-info border-info/30',
  driver_accepted: 'bg-info/10 text-info border-info/30',
  driver_en_route: 'bg-primary/10 text-primary border-primary/30',
  driver_arrived:  'bg-accent/10 text-accent border-accent/30',
  otp_verified:    'bg-success/10 text-success border-success/30',
  in_progress:     'bg-success/10 text-success border-success/30',
  at_stop:         'bg-warning/10 text-warning border-warning/30',
  completed:       'bg-success/10 text-success border-success/30',
  cancelled:       'bg-error/10 text-error border-error/30',
};

export default function RideHeader({
  rideCode,
  bookingCode,
  status,
  rideStage,
  activeNavigationTarget,
  connStatus = 'connecting',
  rideType = 'full_care_ride', // 'full_care_ride' | 'care_assistant'
  onBack,
}) {
  const statusLabel = STATUS_LABELS[status] ?? status ?? 'Loading…';
  const stageLabel  = STAGE_LABELS[rideStage] ?? rideStage ?? null;
  const targetLabel = TARGET_LABELS[activeNavigationTarget] ?? activeNavigationTarget ?? null;
  const statusCls   = STATUS_COLORS[status] ?? 'bg-base-300 text-base-content border-base-300';

  const isCareAssistantOnly = rideType === 'care_assistant';

  return (
    <header className="w-full bg-base-100 border-b border-base-300 px-4 py-3 flex items-center gap-3 z-40 relative">
      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          className="btn btn-ghost btn-sm btn-circle flex-shrink-0 -ml-1"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Activity size={18} className="text-primary" />
      </div>

      {/* Codes + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {rideCode && (
            <span className="font-montserrat font-extrabold text-sm text-base-content tracking-tight">
              {rideCode}
            </span>
          )}
          {bookingCode && (
            <span className="text-xs text-base-content/50 font-poppins">#{bookingCode}</span>
          )}
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <AnimatePresence mode="wait">
            <motion.span
              key={status}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.25 }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${statusCls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {statusLabel}
            </motion.span>
          </AnimatePresence>

          {/* Stage pill */}
          {stageLabel && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-base-200 border border-base-300 text-xs text-base-content/60 font-poppins">
              <Zap size={10} className="text-primary" />
              {stageLabel}
            </span>
          )}

          {/* Target pill */}
          {targetLabel && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-xs text-primary font-poppins">
              <Navigation size={10} />
              {targetLabel}
            </span>
          )}
        </div>
      </div>

      {/* Right: badge + ride type */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isCareAssistantOnly && (
          <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/30 text-secondary font-semibold">
            CA Ride
          </span>
        )}
        <TrackingConnectionBadge status={connStatus} />
      </div>
    </header>
  );
}