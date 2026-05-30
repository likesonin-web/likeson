'use client';
import { useSelector } from 'react-redux';
import { selectRtOnlineDoctors } from '@/store/slices/consultationSlice';
import { Stethoscope } from 'lucide-react';

export function DoctorStatusBadge() {
  const onlineDoctors = useSelector(selectRtOnlineDoctors);
  const isOnline      = Object.keys(onlineDoctors).length > 0;
  const doctorName    = isOnline ? Object.values(onlineDoctors)[0]?.name : null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
      isOnline
        ? 'border-success/40 bg-success/10 text-success'
        : 'border-base-300 bg-base-200 text-base-content/50'
    }`}>
      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-base-300'} ${isOnline ? 'animate-pulse' : ''}`} />
      <Stethoscope size={14} />
      <span className="text-sm font-semibold">
        {isOnline
          ? `Dr. ${doctorName || 'is online'}`
          : 'Doctor not yet online'}
      </span>
    </div>
  );
}
