'use client';

/**
 * ControlBar.jsx — TAILWIND REFACTOR (FIXED)
 *
 * NEW: Recording button (local MediaRecorder start/stop + auto-download).
 * Admin/doctor can also trigger server-side recording via existing startRecording thunk.
 * * DESIGN: Labels are hidden on mobile to save space, visible on tablet/desktop.
 * All styling exclusively uses Tailwind CSS and global.css standard tokens.
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, MessageSquare, FileText, Users, Settings,
  Circle, Square, Wifi,
} from 'lucide-react';
import { useAgora } from '@/context/AgoraProvider';
import { useConsultation } from '@/context/ConsultationProvider';
import { useDispatch, useSelector } from 'react-redux';
import {
  startRecording,
  stopRecording,
  selectLocalRecordingActive,
  selectRecordingActive,
} from '@/store/slices/consultationSlice';
import { socketStartRecording, socketStopRecording } from '@/services/consultationSocketService';
import { NetworkBars } from './VideoTile';

// ── Single control button ─────────────────────────────────────────────────────

const CtrlBtn = memo(({
  icon: Icon,
  activeIcon: ActiveIcon,
  label,
  isActive = false,
  onClick,
  variant = 'default',
  disabled = false,
  badge,
  title: titleProp,
}) => {
  const DisplayIcon = (isActive && ActiveIcon) ? ActiveIcon : Icon;

  // Determine styles based on variant and active state
  let variantClasses = 'bg-transparent text-base-content/70 hover:text-base-content hover:bg-base-200/60 border border-transparent';
  
  if (variant === 'danger') {
    variantClasses = 'bg-error text-error-content hover:brightness-110 shadow-sm border-transparent';
  } else if (variant === 'warning') {
    variantClasses = 'bg-warning text-warning-content hover:brightness-110 shadow-sm border-transparent';
  } else if (variant === 'accent' && isActive) {
    variantClasses = 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25';
  } else if (isActive) {
    // Default active state
    variantClasses = 'bg-base-200 text-base-content border border-base-300 shadow-sm';
  }

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 p-2.5 sm:px-3 sm:py-2 rounded-[var(--r-field)] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses}`}
      aria-label={label}
      aria-pressed={isActive}
      title={titleProp ?? label}
    >
      <DisplayIcon size={20} aria-hidden="true" className="shrink-0" />
      
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 badge badge-error badge-xs shadow-sm px-1 font-bold z-10" aria-label={`${badge} unread`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      
      {/* Hide text on mobile, show on sm and up */}
      <span className="text-[0.65rem] sm:text-sm font-semibold tracking-wide hidden sm:block whitespace-nowrap font-poppins">
        {label}
      </span>
    </motion.button>
  );
});
CtrlBtn.displayName = 'CtrlBtn';

// ── Main Control Bar ──────────────────────────────────────────────────────────

const ControlBar = memo(({
  onToggleChat,
  onToggleClinical,
  onToggleParticipants,
  onToggleSettings,
  unreadMessages = 0,
  isChatOpen = false,
  isClinicalOpen = false,
  isParticipantsOpen = false,
  isDoctor = false,
}) => {
  const dispatch = useDispatch();

  const {
    isMicOn, isCamOn, isSharingScreen,
    networkQuality, isJoined, isConnecting,
    toggleMic, toggleCamera,
    startScreenShare, stopScreenShare,
    leaveChannel,
    startLocalRecording, stopLocalRecording,
  } = useAgora();

  const { handleLeave, handleEnd, status, userRole } = useConsultation();

  const localRecording  = useSelector(selectLocalRecordingActive);
  const serverRecording = useSelector(selectRecordingActive);

  // Determine if this role can manage server recording
  const canServerRecord = isDoctor || userRole === 'admin' || userRole === 'superadmin';

  const handleEndCall = async () => {
    if (localRecording) stopLocalRecording();
    await leaveChannel();
    await handleLeave();
    if (isDoctor) await handleEnd();
  };

  const handleScreenShare = () => {
    if (isSharingScreen) stopScreenShare();
    else startScreenShare();
  };

  // ── LOCAL recording toggle ────────────────────────────────────────────────
  const handleLocalRecordingToggle = () => {
    if (localRecording) {
      stopLocalRecording();  // triggers auto-download via onstop
    } else {
      startLocalRecording();
    }
  };

  // ── SERVER recording toggle (doctor/admin only) ───────────────────────────
  const handleServerRecordingToggle = async () => {
    if (serverRecording) {
      await dispatch(stopRecording());
      socketStopRecording();
    } else {
      await dispatch(startRecording());
      socketStartRecording();
    }
  };

  const isRecordingAny = localRecording || serverRecording;

  return (
    <div className="w-full bg-base-100/90 backdrop-blur-strong border-t border-base-300 px-2 py-2 sm:px-4 sm:py-3 z-50 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.1)]" role="toolbar" aria-label="Call controls">
      <div className="flex flex-row items-center justify-between max-w-screen-2xl mx-auto w-full gap-2 overflow-x-auto scrollbar-none">

        {/* Left: network + status (Hidden entirely on very small screens to save space for icons) */}
        <div className="hidden md:flex items-center gap-3 shrink-0 bg-base-200/50 px-3 py-1.5 rounded-[var(--r-field)] border border-base-300">
          <div className="flex items-center gap-2">
            <NetworkBars quality={networkQuality} />
            <span className="font-poppins text-xs font-semibold text-base-content/70">
              {isConnecting ? 'Connecting…' : isJoined ? 'Live' : 'Not joined'}
            </span>
          </div>
          {isJoined && (
            <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)] animate-pulse" aria-hidden="true" />
          )}
        </div>

        {/* Center: main controls */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 flex-1 shrink-0">
          <CtrlBtn
            icon={Mic}
            activeIcon={MicOff}
            label={isMicOn ? 'Mute' : 'Unmute'}
            isActive={!isMicOn}
            onClick={toggleMic}
            disabled={!isJoined}
          />
          <CtrlBtn
            icon={Video}
            activeIcon={VideoOff}
            label={isCamOn ? 'Stop Video' : 'Start Video'}
            isActive={!isCamOn}
            onClick={toggleCamera}
            disabled={!isJoined}
          />
          <CtrlBtn
            icon={Monitor}
            activeIcon={MonitorOff}
            label={isSharingScreen ? 'Stop Share' : 'Share Screen'}
            isActive={isSharingScreen}
            onClick={handleScreenShare}
            disabled={!isJoined}
            variant={isSharingScreen ? 'accent' : 'default'}
          />

          {/* ── RECORDING BUTTON ── */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={handleLocalRecordingToggle}
            disabled={!isJoined}
            className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 p-2.5 sm:px-3 sm:py-2 rounded-[var(--r-field)] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed
              ${localRecording 
                ? 'bg-error/15 text-error border border-error/30 hover:bg-error/25' 
                : 'bg-transparent text-base-content/70 hover:text-base-content hover:bg-base-200/60 border border-transparent'
              }`}
            aria-label={localRecording ? 'Stop recording' : 'Start recording'}
            title={localRecording ? 'Stop recording (auto-saves to downloads)' : 'Record session locally'}
          >
            {localRecording ? (
              <>
                <Square size={20} fill="currentColor" aria-hidden="true" className="shrink-0" />
                <span className="text-[0.65rem] sm:text-sm font-semibold tracking-wide hidden sm:block whitespace-nowrap">Stop Rec</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error animate-pulse sm:hidden" aria-hidden="true" />
              </>
            ) : (
              <>
                <Circle size={20} fill={isRecordingAny ? 'currentColor' : 'none'} aria-hidden="true" className="shrink-0" />
                <span className="text-[0.65rem] sm:text-sm font-semibold tracking-wide hidden sm:block whitespace-nowrap">Record</span>
              </>
            )}
          </motion.button>

          {/* End call (Danger variant explicitly applied) */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={handleEndCall}
            className="relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 p-2.5 sm:px-4 sm:py-2 mx-1 sm:mx-2 rounded-[var(--r-field)] transition-all duration-200 outline-none bg-error text-error-content hover:brightness-110 shadow-sm shadow-error/20"
            aria-label="End call"
            title={isDoctor ? 'End session' : 'Leave call'}
          >
            <PhoneOff size={20} aria-hidden="true" className="shrink-0" />
            <span className="text-[0.65rem] sm:text-sm font-semibold tracking-wide hidden sm:block whitespace-nowrap">
              {isDoctor ? 'End Call' : 'Leave'}
            </span>
          </motion.button>
        </div>

        {/* Right: panel toggles */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
          <CtrlBtn
            icon={MessageSquare}
            label="Chat"
            isActive={isChatOpen}
            onClick={onToggleChat}
            badge={unreadMessages}
          />
          {(isDoctor || ['admin', 'superadmin'].includes(userRole)) && (
            <CtrlBtn
              icon={FileText}
              label="Clinical"
              isActive={isClinicalOpen}
              onClick={onToggleClinical}
              variant={isClinicalOpen ? 'accent' : 'default'}
            />
          )}
          <CtrlBtn
            icon={Users}
            label="People"
            isActive={isParticipantsOpen}
            onClick={onToggleParticipants}
          />
          <CtrlBtn
            icon={Settings}
            label="Settings"
            onClick={onToggleSettings}
          />
        </div>
        
      </div>
    </div>
  );
});
ControlBar.displayName = 'ControlBar';

export default ControlBar;