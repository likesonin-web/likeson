'use client';
import { Users, PanelRight } from 'lucide-react';
import { useSelector }       from 'react-redux';
import { selectRtParticipantCount } from '@/store/slices/consultationSlice';
import { MicButton }          from './MicButton';
import { CameraButton }       from './CameraButton';
import { ScreenShareButton }  from './ScreenShareButton';
import { EndCallButton }      from './EndCallButton';
import { RaiseHandButton }    from './RaiseHandButton';
import { TimerDisplay }       from './TimerDisplay';
import { NetworkQualityIndicator } from './NetworkQualityIndicator';
import { isPatient, isDoctor } from '../../utils/roleHelpers';

export function ControlsBar({
  role,
  consultationId,
  localTracks,
  screenShare,
  onEnd,
  sidebarOpen,
  onSidebarToggle,
}) {
  const participantCount = useSelector(selectRtParticipantCount);

  return (
    <div className="consultation-controls flex items-center justify-between px-4 py-3 gap-2">
      {/* Left: media controls */}
      <div className="flex items-center gap-2">
        <MicButton
          isMicOn={localTracks.isMicOn}
          onToggle={localTracks.toggleMic}
        />
        <CameraButton
          isCamOn={localTracks.isCamOn}
          onToggle={localTracks.toggleCam}
        />
        <ScreenShareButton
          isSharing={screenShare.isSharing}
          isLoading={screenShare.isLoading}
          onToggle={screenShare.toggleScreenShare}
        />
        {isPatient(role) && (
          <RaiseHandButton consultationId={consultationId} />
        )}

        <NetworkQualityIndicator />
      </div>

      {/* Center: timer */}
      <div className="hidden md:flex">
        <TimerDisplay />
      </div>

      {/* Right: sidebar + end */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSidebarToggle}
          className={`btn btn-circle btn-ghost border border-base-300 relative ${sidebarOpen ? 'bg-primary/10 text-primary' : ''}`}
          aria-label="Toggle sidebar"
          aria-pressed={sidebarOpen}
        >
          <PanelRight size={18} />
          {participantCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-content text-xs flex items-center justify-center font-bold">
              {participantCount}
            </span>
          )}
        </button>

        <button
          onClick={onSidebarToggle}
          className="btn btn-circle btn-ghost border border-base-300"
          aria-label="Participants"
        >
          <Users size={18} />
        </button>

        <EndCallButton onClick={onEnd} role={role} />
      </div>
    </div>
  );
}
