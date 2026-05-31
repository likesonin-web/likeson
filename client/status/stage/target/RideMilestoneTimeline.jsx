'use client';
import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Circle, Car, UserCheck, MapPin, Shield,
  Play, Users, Building2, Flag, Clock, AlertTriangle
} from 'lucide-react';

const MILESTONE_ICONS = {
  ride_created:            Flag,
  driver_search_started:   Clock,
  driver_assigned:         Car,
  driver_accepted:         UserCheck,
  driver_en_route:         Car,
  driver_arrived:          MapPin,
  otp_verified:            Shield,
  ride_started:            Play,
  stop_reached:            Circle,
  stop_departed:           Car,
  care_assistant_joined:   Users,
  hospital_arrived:        Building2,
  patient_handed_over:     CheckCircle2,
  consultation_started:    Clock,
  consultation_completed:  CheckCircle2,
  ride_completed:          Flag,
  ride_cancelled:          AlertTriangle,
  sos_triggered:           AlertTriangle,
};

const MILESTONE_LABELS = {
  ride_created:            'Ride Created',
  driver_search_started:   'Finding Driver',
  driver_assigned:         'Driver Assigned',
  driver_accepted:         'Driver Accepted',
  driver_en_route:         'Driver En Route',
  driver_arrived:          'Driver Arrived',
  otp_verified:            'OTP Verified',
  ride_started:            'Ride Started',
  stop_reached:            'Stop Reached',
  stop_departed:           'Departed Stop',
  care_assistant_joined:   'Care Asst Joined',
  hospital_arrived:        'Hospital Arrived',
  patient_handed_over:     'Patient Handed Over',
  consultation_started:    'Consultation Started',
  consultation_completed:  'Consultation Done',
  ride_completed:          'Ride Completed',
  ride_cancelled:          'Ride Cancelled',
  sos_triggered:           'SOS Triggered',
};

const MILESTONE_COLORS = {
  ride_created:   'text-base-content/50',
  driver_assigned:'text-info',
  driver_accepted:'text-info',
  driver_en_route:'text-primary',
  driver_arrived: 'text-accent',
  otp_verified:   'text-success',
  ride_started:   'text-success',
  care_assistant_joined: 'text-secondary',
  hospital_arrived:'text-error',
  ride_completed: 'text-success',
  ride_cancelled: 'text-error',
  sos_triggered:  'text-error',
};

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, x: -12 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

const RideMilestoneTimeline = memo(function RideMilestoneTimeline({ milestones = [], maxVisible = 20 }) {
  if (!milestones?.length) {
    return (
      <div className="card p-4">
        <p className="text-sm text-base-content/40 text-center py-4">No milestones yet</p>
      </div>
    );
  }

  const visible = milestones.slice(-maxVisible).reverse(); // newest first

  return (
    <div className="card p-4">
      <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">Timeline</h4>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative"
      >
        {/* Vertical line */}
        <div className="absolute left-[18px] top-2 bottom-2 w-px bg-base-300" aria-hidden="true" />

        <div className="space-y-3">
          {visible.map((milestone, idx) => {
            const Icon     = MILESTONE_ICONS[milestone.name] ?? Circle;
            const label    = MILESTONE_LABELS[milestone.name] ?? milestone.name;
            const iconCls  = MILESTONE_COLORS[milestone.name] ?? 'text-base-content/40';
            const isLatest = idx === 0;

            return (
              <motion.div key={String(milestone._id ?? `${milestone.name}-${idx}`)} variants={item} className="flex gap-3 items-start">
                {/* Icon dot */}
                <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                  ${isLatest ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-base-200'}`}
                >
                  <Icon
                    size={isLatest ? 16 : 14}
                    className={isLatest ? 'text-primary' : iconCls}
                  />
                  {isLatest && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <p className={`text-sm font-semibold ${isLatest ? 'text-base-content' : 'text-base-content/70'}`}>
                    {label}
                  </p>
                  {milestone.occurredAt && (
                    <p className="text-xs text-base-content/40 mt-0.5">
                      {new Date(milestone.occurredAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </p>
                  )}
                  {milestone.meta?.careAssistantId && (
                    <p className="text-xs text-secondary mt-0.5">Care assistant</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
});

export default RideMilestoneTimeline;