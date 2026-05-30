'use client';
import { Timer } from 'lucide-react';
import { useCallTimer } from '../../hooks/useCallTimer';
import { useSelector } from 'react-redux';
import { selectConsultation, selectRtStatus } from '@/store/slices/consultationSlice';

export function TimerDisplay() {
  const consultation = useSelector(selectConsultation);
  const rtStatus     = useSelector(selectRtStatus);

const isRunning = rtStatus === 'active';
const startTime = consultation?.actualStartTime;
const id        = consultation?._id;

const { formatted } = useCallTimer(startTime, isRunning, id);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-base-200/80 backdrop-blur-sm">
      <Timer size={14} className="text-primary" aria-hidden />
      <span className="font-montserrat font-bold text-sm tabular-nums text-base-content">
        {formatted}
      </span>
    </div>
  );
}
