'use client';
/**
 * CustomerMeetingControls.jsx
 * Floating mobile-first control bar.
 * Large tap targets, accessible, animated.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff,
  Video, VideoOff,
  Volume2, VolumeX,
  Hand,
  MessageCircle,
  FileText,
  Maximize2, Minimize2,
  SwitchCamera,
  PhoneOff,
  MoreHorizontal,
  Settings,
  Loader2,
} from 'lucide-react';

/**
 * Single control button
 */
function ControlBtn({
  icon: Icon,
  iconOff: IconOff,
  label,
  isOn = true,
  isActive = false,
  badge,
  onClick,
  isRed = false,
  size = 'md',
  disabled = false,
}) {
  const ActiveIcon = isOn ? Icon : (IconOff ?? Icon);
  const sizeClass = size === 'lg'
    ? 'w-14 h-14'
    : size === 'sm'
    ? 'w-9 h-9'
    : 'w-11 h-11';

  const baseClass = `
    relative flex flex-col items-center justify-center gap-1
    transition-all duration-200 active:scale-90
    ${disabled ? 'opacity-40 pointer-events-none' : ''}
  `;

  const btnClass = `
    ${sizeClass} rounded-2xl flex items-center justify-center
    transition-all duration-200 relative
    ${isRed
      ? 'bg-error text-error-content shadow-lg'
      : isOn && !isActive
      ? 'bg-base-200 text-base-content/70 border border-base-300'
      : isActive
      ? 'bg-primary/15 text-primary border border-primary/30'
      : 'bg-error/10 text-error border border-error/30'
    }
  `;

  return (
    <button
      onClick={onClick}
      className={baseClass}
      aria-label={label}
      aria-pressed={!isOn}
      disabled={disabled}
    >
      <div className={btnClass}>
        <ActiveIcon size={size === 'lg' ? 22 : size === 'sm' ? 14 : 18} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full
                           bg-error text-error-content text-[10px] font-bold
                           flex items-center justify-center leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] text-base-content/50 font-medium leading-tight">
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   isMicOn: boolean,
 *   isCamOn: boolean,
 *   isSpeakerOn: boolean,
 *   isHandRaised: boolean,
 *   isFullscreen: boolean,
 *   chatUnread: number,
 *   hasPrescription: boolean,
 *   onToggleMic: Function,
 *   onToggleCam: Function,
 *   onToggleSpeaker: Function,
 *   onToggleHand: Function,
 *   onToggleFullscreen: Function,
 *   onOpenChat: Function,
 *   onOpenPrescription: Function,
 *   onSwitchCamera: Function,
 *   onLeave: Function,
 *   isActionLoading: boolean,
 * }} props
 */
export default function CustomerMeetingControls({
  isMicOn, isCamOn, isSpeakerOn, isHandRaised, isFullscreen,
  chatUnread = 0,
  hasPrescription = false,
  onToggleMic, onToggleCam, onToggleSpeaker, onToggleHand,
  onToggleFullscreen, onOpenChat, onOpenPrescription, onSwitchCamera,
  onLeave,
  isActionLoading = false,
}) {
  const [showMore,      setShowMore]      = useState(false);
  const [showLeaveConf, setShowLeaveConf] = useState(false);

  const handleLeaveRequest = useCallback(() => {
    setShowLeaveConf(true);
  }, []);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveConf(false);
    onLeave();
  }, [onLeave]);

  return (
    <>
      {/* ── MAIN CONTROL BAR ─────────────────────────────────────────── */}
      <div className="safe-bottom px-4 pb-4 pt-2 bg-base-100/80 backdrop-blur-md
                      border-t border-base-300/40">

        {/* Primary controls */}
        <div className="flex items-end justify-around max-w-sm mx-auto">
          <ControlBtn
            icon={Mic}      iconOff={MicOff}
            label={isMicOn ? 'Mute' : 'Unmute'}
            isOn={isMicOn}
            onClick={onToggleMic}
          />
          <ControlBtn
            icon={Video}    iconOff={VideoOff}
            label={isCamOn ? 'Stop' : 'Start'}
            isOn={isCamOn}
            onClick={onToggleCam}
          />

          {/* END CALL — prominent center */}
          <ControlBtn
            icon={PhoneOff}
            label="End"
            isRed
            size="lg"
            onClick={handleLeaveRequest}
            disabled={isActionLoading}
          />

          <ControlBtn
            icon={MessageCircle}
            label="Chat"
            isOn
            badge={chatUnread}
            onClick={onOpenChat}
          />
          <ControlBtn
            icon={MoreHorizontal}
            label="More"
            isOn={!showMore}
            isActive={showMore}
            onClick={() => setShowMore((v) => !v)}
          />
        </div>

        {/* Extended controls */}
        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-around max-w-sm mx-auto
                              pt-3 border-t border-base-300/30 mt-2">
                <ControlBtn
                  icon={Volume2}  iconOff={VolumeX}
                  label={isSpeakerOn ? 'Speaker' : 'Muted'}
                  isOn={isSpeakerOn}
                  size="sm"
                  onClick={onToggleSpeaker}
                />
                <ControlBtn
                  icon={Hand}
                  label={isHandRaised ? 'Lower' : 'Raise'}
                  isActive={isHandRaised}
                  isOn={!isHandRaised}
                  size="sm"
                  onClick={onToggleHand}
                />
                <ControlBtn
                  icon={SwitchCamera}
                  label="Switch"
                  isOn
                  size="sm"
                  onClick={onSwitchCamera}
                />
                {hasPrescription && (
                  <ControlBtn
                    icon={FileText}
                    label="Rx"
                    isOn
                    size="sm"
                    onClick={onOpenPrescription}
                  />
                )}
                <ControlBtn
                  icon={isFullscreen ? Minimize2 : Maximize2}
                  label={isFullscreen ? 'Exit FS' : 'Fullscr.'}
                  isOn
                  size="sm"
                  onClick={onToggleFullscreen}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── LEAVE CONFIRMATION MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showLeaveConf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                       bg-base-100/60 backdrop-blur-sm px-4 pb-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="glass-card w-full max-w-sm p-6 flex flex-col gap-4"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-error/10 border border-error/30
                                flex items-center justify-center mx-auto mb-3">
                  <PhoneOff size={20} className="text-error" />
                </div>
                <h3 className="font-bold text-base-content text-lg mb-1">End Consultation?</h3>
                <p className="text-sm text-base-content/60">
                  Are you sure you want to end this consultation? Your doctor will be notified.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConf(false)}
                  className="btn btn-ghost flex-1"
                >
                  Stay
                </button>
                <button
                  onClick={handleLeaveConfirm}
                  className="btn btn-error flex-1 flex items-center gap-2"
                  disabled={isActionLoading}
                >
                  {isActionLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <PhoneOff size={14} />
                  )}
                  End Call
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}