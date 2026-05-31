'use client';
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Clock, MapPin } from 'lucide-react';
import { formatEta, formatDistance } from '@/utils/navigationUtils';

const HospitalEtaCard = memo(function HospitalEtaCard({ hospitalEta }) {
  if (!hospitalEta?.etaMinutes && !hospitalEta?.hospitalName) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-3 border-l-4 border-error bg-error/5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={14} className="text-error" />
          <span className="text-xs font-bold text-error uppercase tracking-wider">Hospital ETA</span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-base-content truncate flex-1">
            {hospitalEta.hospitalName ?? 'Hospital'}
          </p>
          <span className="font-montserrat font-extrabold text-xl text-error ml-2">
            {formatEta(hospitalEta.etaMinutes)}
          </span>
        </div>

        {hospitalEta.distanceKm != null && (
          <p className="text-xs text-base-content/50 mt-0.5 flex items-center gap-1">
            <MapPin size={10} />
            {formatDistance(hospitalEta.distanceKm)}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

export default HospitalEtaCard;