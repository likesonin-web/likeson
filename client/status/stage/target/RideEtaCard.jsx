'use client';
import { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Navigation, MapPin, TrendingDown, Activity } from 'lucide-react';
import { formatEta, formatDistance } from '@/utils/navigationUtils';

const EtaCard = memo(function EtaCard({ etaMinutes, distanceRemainingKm, currentTarget, hospitalEta }) {
  const prevEtaRef = useRef(etaMinutes);

  const etaChanged   = prevEtaRef.current !== etaMinutes && etaMinutes != null;
  const etaDecreased = etaChanged && etaMinutes < prevEtaRef.current;

  useEffect(() => { prevEtaRef.current = etaMinutes; }, [etaMinutes]);

  const targetLabels = {
    pickup_care_assistant: 'Care Assistant',
    pickup_patient:        'Patient',
    dropoff_hospital:      'Hospital',
    dropoff_destination:   'Destination',
    return_pickup:         'Return',
    pickup:                'Pickup',
    dropoff:               'Dropoff',
  };

  const targetLabel = targetLabels[currentTarget] ?? currentTarget ?? 'Destination';

  if (etaMinutes == null && !distanceRemainingKm) {
    return (
      <div className="card p-4 flex items-center gap-2">
        <Clock size={16} className="text-base-content/30" />
        <span className="text-sm text-base-content/40">Calculating ETA…</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock size={14} className="text-primary" />
          </div>
          <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">ETA</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-base-content/40">
          <Navigation size={10} className="text-primary" />
          {targetLabel}
        </div>
      </div>

      {/* Main ETA */}
      <AnimatePresence mode="wait">
        <motion.div
          key={etaMinutes}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.2 }}
          className="flex items-end gap-3 mb-3"
        >
          <span className="font-montserrat font-extrabold text-3xl text-base-content leading-none">
            {etaMinutes != null ? formatEta(etaMinutes) : '—'}
          </span>
          {etaChanged && (
            <span className={`text-xs font-semibold ${etaDecreased ? 'text-success' : 'text-warning'}`}>
              <TrendingDown size={12} className="inline" />
            </span>
          )}
          {distanceRemainingKm != null && (
            <span className="text-sm text-base-content/50 mb-0.5">
              · {formatDistance(distanceRemainingKm)}
            </span>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Hospital ETA sub-row */}
      {hospitalEta?.etaMinutes != null && (
        <div className="pt-2 border-t border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-base-content/50">
            <Activity size={11} className="text-error" />
            <span>Hospital ETA</span>
          </div>
          <span className="text-xs font-bold text-error">{formatEta(hospitalEta.etaMinutes)}</span>
        </div>
      )}
    </motion.div>
  );
});

export default EtaCard;