'use client';

/**
 * SessionHeader.jsx — TAILWIND REFACTOR
 *
 * All inline and custom CSS classes stripped.
 * Fully utilizes Tailwind CSS and global.css standard tokens.
 * Responsive design: Timer stays absolutely centered, while secondary text
 * hides on small mobile screens to prevent overlapping.
 */

import React, { memo } from 'react';
import { Stethoscope, Clock, Shield, Wifi } from 'lucide-react';
import { useConsultation } from '@/context/ConsultationProvider';
import { useAgora } from '@/context/AgoraProvider';
import { useConsultationTimer } from '@/hooks/useConsultationTimer';
import { NetworkBars } from './VideoTile';

const SessionHeader = memo(() => {
  const { consultation, status, userRole } = useConsultation();
  const { networkQuality, isJoined } = useAgora();

  const isLive = status === 'in_progress';
  const { formatted } = useConsultationTimer(
    consultation?.sessionStartedAt,
    isLive && isJoined
  );

  const remoteInfo = userRole === 'doctor'
    ? { name: consultation?.patientSnapshot?.name, label: 'Patient' }
    : { name: consultation?.doctorSnapshot?.name, label: `Dr. ${consultation?.doctorSnapshot?.specialization ?? ''}` };

  return (
    <div className="relative w-full h-12 sm:h-14 bg-base-100/95 backdrop-blur-md border-b border-base-300 flex items-center justify-between px-3 sm:px-6 z-40 shrink-0 shadow-sm font-poppins" role="banner">
      
      {/* Left: branding */}
      <div className="flex items-center gap-3 shrink-0 z-10">
        <div className="hidden sm:flex items-center gap-1.5 text-primary font-montserrat font-bold text-sm tracking-wide">
          <Stethoscope size={16} aria-hidden="true" />
          <span>Consultation</span>
        </div>
        <span className="badge badge-outline text-[0.65rem] sm:text-xs font-mono font-semibold text-base-content/70 border-base-300">
          {consultation?.consultationCode ?? '—'}
        </span>
      </div>

      {/* Center: session timer (Absolutely centered) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-0" aria-live="polite" aria-atomic="true">
        {isLive && isJoined ? (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-error/10 border border-error/20 text-error px-2.5 sm:px-3 py-1 rounded-[var(--r-field)] text-xs sm:text-sm font-bold font-mono tracking-wider shadow-sm">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse shadow-[0_0_6px_var(--error)]" aria-hidden="true" />
            <Clock size={14} aria-hidden="true" className="shrink-0" />
            <span>{formatted}</span>
          </div>
        ) : (
          <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-base-content/60 bg-base-200 border border-base-300 px-3 py-1 rounded-[var(--r-field)]">
            {status?.replace(/_/g, ' ') ?? 'Connecting'}
          </span>
        )}
      </div>

      {/* Right: remote user info + network */}
      <div className="flex items-center gap-3 sm:gap-5 shrink-0 z-10">
        {remoteInfo.name && (
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-[0.6rem] font-bold text-base-content/50 uppercase tracking-widest leading-tight">
              {remoteInfo.label}
            </span>
            <span className="text-sm font-semibold text-base-content leading-tight truncate max-w-[150px] lg:max-w-[200px]">
              {remoteInfo.name}
            </span>
          </div>
        )}
        
        {isJoined && (
          <div className="hidden sm:flex items-center bg-base-200/50 p-1 rounded-sm" aria-label="Network quality">
            <NetworkBars quality={networkQuality} />
          </div>
        )}
        
        <div className="flex items-center gap-1.5 text-[0.65rem] sm:text-xs font-bold text-success bg-success/10 border border-success/20 px-2 py-1 rounded-sm uppercase tracking-wider shadow-sm" title="Encrypted session">
          <Shield size={14} aria-hidden="true" className="shrink-0" />
          <span className="hidden sm:inline">Secure</span>
        </div>
      </div>
      
    </div>
  );
});
SessionHeader.displayName = 'SessionHeader';

export default SessionHeader;