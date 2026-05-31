'use client';
import { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Clock, Users, Navigation, Building2,
  Play, CheckCircle2, AlertTriangle, Zap,
} from 'lucide-react';

const EVENT_CONFIG = {
  location_update:              { label: 'Driver location updated',    icon: MapPin,        cls: 'text-primary'   },
  eta_update:                   { label: 'ETA updated',                icon: Clock,         cls: 'text-info'      },
  care_assistant_joined:        { label: 'Care assistant joined',      icon: Users,         cls: 'text-secondary' },
  care_assistant_joined_ride:   { label: 'Care assistant joined ride', icon: Users,         cls: 'text-secondary' },
  navigation_target_changed:    { label: 'Navigation target changed',  icon: Navigation,    cls: 'text-accent'    },
  hospital_eta_update:          { label: 'Hospital ETA updated',       icon: Building2,     cls: 'text-error'     },
  'hospital:eta:update':        { label: 'Hospital ETA updated',       icon: Building2,     cls: 'text-error'     },
  ride_started:                 { label: 'Ride started',               icon: Play,          cls: 'text-success'   },
  ride_completed:               { label: 'Ride completed',             icon: CheckCircle2,  cls: 'text-success'   },
  sos_alert:                    { label: 'SOS triggered',              icon: AlertTriangle, cls: 'text-error'     },
  driver_en_route:              { label: 'Driver en route',            icon: MapPin,        cls: 'text-primary'   },
  driver_arrived:               { label: 'Driver arrived',             icon: MapPin,        cls: 'text-accent'    },
  otp_verified:                 { label: 'OTP verified',               icon: Zap,           cls: 'text-success'   },
  ride_status_changed:          { label: 'Status changed',             icon: Zap,           cls: 'text-primary'   },
};

const DEFAULT_EVENT = { label: 'Event', icon: Zap, cls: 'text-base-content/40' };

function fmt(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const RideActivityFeed = memo(function RideActivityFeed({ events = [], maxItems = 50 }) {
  const bottomRef = useRef(null);

  // Auto-scroll to newest (top since newest-first)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events.length]);

  const visible = events.slice(0, maxItems);

  return (
    <div className="card p-4 flex flex-col">
      <h4 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3 flex-shrink-0">
        Live Activity
      </h4>

      {!visible.length ? (
        <p className="text-sm text-base-content/30 text-center py-4">Awaiting events…</p>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-64 scrollbar-thin pr-1">
          <div ref={bottomRef} />
          <AnimatePresence initial={false}>
            {visible.map((ev, idx) => {
              const cfg  = EVENT_CONFIG[ev.type] ?? DEFAULT_EVENT;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={ev.id ?? `${ev.type}-${idx}`}
                  initial={{ opacity: 0, x: -8, height: 0 }}
                  animate={{ opacity: 1, x: 0,  height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5"
                >
                  <div className={`w-6 h-6 rounded-full bg-base-200 flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.cls}`}>
                    <Icon size={11} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-base-content leading-tight">
                      {ev.label ?? cfg.label}
                    </p>
                    {ev.detail && (
                      <p className="text-xs text-base-content/40 truncate">{ev.detail}</p>
                    )}
                  </div>
                  <span className="text-xs text-base-content/30 flex-shrink-0 tabular-nums">{fmt(ev.ts)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

export default RideActivityFeed;