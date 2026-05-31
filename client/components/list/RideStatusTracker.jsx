'use client';
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Check, Car, Users, MapPin, Building2, Flag, Shield, User } from 'lucide-react';

// Stages per ride type — from backend ride statuses / rideStage enum
const FULL_CARE_STAGES = [
  { key: 'driver_assigned',        label: 'Driver',         icon: Car        },
  { key: 'pickup_care_assistant',  label: 'Pickup CA',      icon: Users      },
  { key: 'pickup_patient',         label: 'Pickup Patient', icon: User       },
  { key: 'otp_verified',           label: 'OTP',            icon: Shield     },
  { key: 'in_progress',            label: 'To Hospital',    icon: Building2  },
  { key: 'completed',              label: 'Done',           icon: Flag       },
];

const CA_ONLY_STAGES = [
  { key: 'driver_assigned',  label: 'Driver Assigned', icon: Car       },
  { key: 'driver_en_route',  label: 'Arriving',        icon: Car       },
  { key: 'otp_verified',     label: 'OTP Verified',    icon: Shield    },
  { key: 'in_progress',      label: 'Ride Started',    icon: MapPin    },
  { key: 'completed',        label: 'Done',            icon: Flag      },
];

// Map ride status → stage index (full care)
function getFullCareIndex(status, activeNavigationTarget) {
  if (['completed'].includes(status)) return 5;
  if (['in_progress', 'at_stop', 'enroute_hospital', 'hospital_reached'].includes(status)) return 4;
  if (['otp_verified'].includes(status)) return 3;
  if (activeNavigationTarget === 'pickup_patient') return 2;
  if (activeNavigationTarget === 'pickup_care_assistant') return 1;
  if (['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived'].includes(status)) return 0;
  return 0;
}

function getCaOnlyIndex(status) {
  if (status === 'completed')   return 4;
  if (['in_progress', 'at_stop'].includes(status)) return 3;
  if (status === 'otp_verified') return 2;
  if (['driver_en_route', 'driver_arrived'].includes(status)) return 1;
  return 0;
}

const RideStatusTracker = memo(function RideStatusTracker({
  status,
  rideStage,
  activeNavigationTarget,
  rideType = 'full_care_ride',
}) {
  const isFullCare = rideType === 'full_care_ride';
  const stages     = isFullCare ? FULL_CARE_STAGES : CA_ONLY_STAGES;
  const activeIdx  = isFullCare
    ? getFullCareIndex(status, activeNavigationTarget)
    : getCaOnlyIndex(status);

  return (
    <div className="card p-4">
      <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">Progress</h4>

      <div className="relative flex items-center justify-between">
        {/* Track line */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-base-300 rounded-full" aria-hidden="true">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(activeIdx / (stages.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {stages.map((stage, idx) => {
          const done    = idx < activeIdx;
          const current = idx === activeIdx;
          const Icon    = stage.icon;

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center gap-1">
              <motion.div
                initial={false}
                animate={current ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.4, repeat: current ? Infinity : 0, repeatDelay: 2 }}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all
                  ${done    ? 'bg-primary border-primary text-primary-content' :
                    current ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/25 ring-offset-1 ring-offset-base-100' :
                              'bg-base-100 border-base-300 text-base-content/30'
                  }`}
                aria-current={current ? 'step' : undefined}
              >
                {done ? <Check size={14} /> : <Icon size={13} />}
              </motion.div>
              <span className={`text-xs font-medium text-center leading-tight max-w-[52px] ${
                done || current ? 'text-base-content' : 'text-base-content/40'
              }`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default RideStatusTracker;