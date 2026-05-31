'use client';
import { memo } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, FileText, Heart, AlertCircle } from 'lucide-react';

// Only rendered for full_care_ride
const PatientInfoCard = memo(function PatientInfoCard({ booking, currentStatus }) {
  if (!booking) return null;

  const patient = booking.patientInfo ?? {};
  const pickup  = booking.patientLocation?.address ?? booking.patientLocation?.label ?? '—';

  // Map ride status → patient status label
  const patientStatus =
    ['in_progress', 'otp_verified', 'at_stop'].includes(currentStatus) ? 'In Transit' :
    currentStatus === 'driver_arrived' ? 'Driver At Door' :
    currentStatus === 'completed'      ? 'Arrived' :
    'Waiting';

  const patientStatusCls =
    patientStatus === 'In Transit' ? 'bg-success/10 text-success border-success/30' :
    patientStatus === 'Arrived'    ? 'bg-success/10 text-success border-success/30' :
    'bg-info/10 text-info border-info/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
          <Heart size={14} className="text-success" />
        </div>
        <h4 className="font-semibold text-sm text-base-content">Patient</h4>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium ${patientStatusCls}`}>
          {patientStatus}
        </span>
      </div>

      {/* Info grid */}
      <div className="space-y-2">
        {/* Name + age + gender */}
        <div className="flex items-start gap-2">
          <User size={13} className="text-base-content/40 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-base-content">
              {patient.name ?? 'Unknown'}
            </p>
            <p className="text-xs text-base-content/50">
              {[patient.age && `${patient.age}y`, patient.gender, patient.bloodGroup]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Pickup address */}
        {pickup && (
          <div className="flex items-start gap-2">
            <MapPin size={13} className="text-base-content/40 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-base-content/60 line-clamp-2">{pickup}</p>
          </div>
        )}

        {/* Medical notes badge */}
        {(patient.weight || booking.patientInfo?.bloodGroup) && (
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {patient.bloodGroup && (
              <span className="px-2 py-0.5 rounded-full bg-error/10 border border-error/30 text-xs font-bold text-error">
                {patient.bloodGroup}
              </span>
            )}
            {patient.weight && (
              <span className="px-2 py-0.5 rounded-full bg-base-200 border border-base-300 text-xs text-base-content/60">
                {patient.weight} kg
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default PatientInfoCard;