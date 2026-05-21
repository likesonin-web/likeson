'use client';
/**
 * MeetingControls.jsx
 * Floating bottom control bar for doctor telemedicine room.
 * All handlers memoized — no rerender storm.
 */

import React, { memo, useCallback, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Maximize2, Minimize2, MessageSquare, Users,
  Settings, HandMetal, Circle, Square,
  PhoneOff, Pause, Play, AlertOctagon,
} from 'lucide-react';

/**
 * @param {object} props
 * @param {boolean}   props.isMicOn
 * @param {boolean}   props.isCamOn
 * @param {boolean}   props.isScreenSharing
 * @param {boolean}   props.isFullscreen
 * @param {boolean}   props.isRecording
 * @param {boolean}   props.isPaused
 * @param {boolean}   props.recordingEnabled    - from booking config
 * @param {boolean}   props.showChat
 * @param {boolean}   props.showParticipants
 * @param {Function}  props.onToggleMic
 * @param {Function}  props.onToggleCam
 * @param {Function}  props.onToggleScreenShare
 * @param {Function}  props.onToggleFullscreen
 * @param {Function}  props.onToggleChat
 * @param {Function}  props.onToggleParticipants
 * @param {Function}  props.onOpenSettings
 * @param {Function}  props.onRaiseHand
 * @param {Function}  props.onToggleRecording
 * @param {Function}  props.onEndConsultation
 * @param {Function}  props.onEmergencyDisconnect
 * @param {string}    props.meetingState
 */
export const MeetingControls = memo(function MeetingControls({
  isMicOn, isCamOn, isScreenSharing, isFullscreen, isRecording, isPaused,
  recordingEnabled = false, showChat, showParticipants,
  onToggleMic, onToggleCam, onToggleScreenShare, onToggleFullscreen,
  onToggleChat, onToggleParticipants, onOpenSettings,
  onRaiseHand, onToggleRecording, onEndConsultation, onEmergencyDisconnect,
  meetingState,
}) {
  const [endConfirmOpen,  setEndConfirmOpen]  = useState(false);
  const [emerConfirmOpen, setEmerConfirmOpen] = useState(false);

  const isLive = meetingState === 'live';

  const handleEndClick = useCallback(() => setEndConfirmOpen(true), []);
  const handleEndConfirm = useCallback(() => {
    setEndConfirmOpen(false);
    onEndConsultation?.();
  }, [onEndConsultation]);

  const handleEmerClick = useCallback(() => setEmerConfirmOpen(true), []);
  const handleEmerConfirm = useCallback(() => {
    setEmerConfirmOpen(false);
    onEmergencyDisconnect?.();
  }, [onEmergencyDisconnect]);

  const ControlBtn = useCallback(({ icon: Icon, label, onClick, active, danger, disabled, pulse }) => (
    <button
      onClick={onClick}
      disabled={disabled || !isLive}
      aria-label={label}
      title={label}
      className={`
        relative flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? 'bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30'
          : active
            ? 'bg-primary/20 text-primary border border-primary/30'
            : 'bg-white/5 hover:bg-white/10 text-base-content/70 hover:text-base-content border border-white/10'
        }
        ${pulse ? 'animate-pulse' : ''}
      `}
    >
      <Icon size={18} />
      <span className="text-[10px] font-medium hidden sm:block">{label}</span>
    </button>
  ), [isLive]);

  return (
    <>
      {/* Control Bar */}
      <div
        className="
          fixed bottom-0 left-0 right-0 z-40
          flex items-center justify-center gap-2 px-4 py-3
          bg-base-200/90 backdrop-blur-xl border-t border-white/10
          safe-bottom
        "
        role="toolbar"
        aria-label="Meeting controls"
      >
        {/* Media controls */}
        <ControlBtn
          icon={isMicOn ? Mic : MicOff}
          label={isMicOn ? 'Mute' : 'Unmute'}
          onClick={onToggleMic}
          active={isMicOn}
        />
        <ControlBtn
          icon={isCamOn ? Video : VideoOff}
          label={isCamOn ? 'Stop Camera' : 'Start Camera'}
          onClick={onToggleCam}
          active={isCamOn}
        />
        <ControlBtn
          icon={isScreenSharing ? MonitorOff : Monitor}
          label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          onClick={onToggleScreenShare}
          active={isScreenSharing}
        />

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Panel toggles */}
        <ControlBtn
          icon={MessageSquare}
          label="Chat"
          onClick={onToggleChat}
          active={showChat}
        />
        <ControlBtn
          icon={Users}
          label="Participants"
          onClick={onToggleParticipants}
          active={showParticipants}
        />
        <ControlBtn
          icon={isFullscreen ? Minimize2 : Maximize2}
          label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        />

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Doctor-specific */}
        <ControlBtn
          icon={HandMetal}
          label="Raise Hand"
          onClick={onRaiseHand}
        />
        <ControlBtn
          icon={Settings}
          label="Settings"
          onClick={onOpenSettings}
          disabled={false}
        />
        {recordingEnabled && (
          <ControlBtn
            icon={isRecording ? Square : Circle}
            label={isRecording ? 'Stop Rec' : 'Record'}
            onClick={onToggleRecording}
            active={isRecording}
            pulse={isRecording}
          />
        )}

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Danger actions */}
        <button
          onClick={handleEmerClick}
          disabled={!isLive}
          aria-label="Emergency disconnect"
          title="Emergency Disconnect"
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 transition-all disabled:opacity-40"
        >
          <AlertOctagon size={18} />
          <span className="text-[10px] font-medium hidden sm:block">Emergency</span>
        </button>
        <button
          onClick={handleEndClick}
          disabled={!isLive}
          aria-label="End consultation"
          className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all disabled:opacity-40"
        >
          <PhoneOff size={18} />
          <span className="text-[10px] font-medium hidden sm:block">End</span>
        </button>
      </div>

      {/* End Consultation Confirm Modal */}
      {endConfirmOpen && (
        <ConfirmModal
          title="End Consultation?"
          message="This will end the session for all participants and update booking status to Completed."
          confirmLabel="Yes, End Session"
          danger
          onConfirm={handleEndConfirm}
          onCancel={() => setEndConfirmOpen(false)}
        />
      )}

      {/* Emergency Disconnect Confirm Modal */}
      {emerConfirmOpen && (
        <ConfirmModal
          title="Emergency Disconnect?"
          message="You will be immediately disconnected. The consultation status will remain in-progress until manually ended."
          confirmLabel="Disconnect Now"
          danger
          onConfirm={handleEmerConfirm}
          onCancel={() => setEmerConfirmOpen(false)}
        />
      )}
    </>
  );
});

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="glass-card p-6 max-w-md w-full mx-4 shadow-depth-lg">
        <h3 id="confirm-title" className="text-lg font-bold text-base-content mb-2">{title}</h3>
        <p className="text-sm text-base-content/70 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
          <button
            onClick={onConfirm}
            className={`btn btn-sm ${danger ? 'btn-error' : 'btn-primary'}`}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingControls;