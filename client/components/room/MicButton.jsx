'use client';
import { Mic, MicOff, Lock } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectRtIsMuted } from '@/store/slices/consultationSlice';

export function MicButton({ isMicOn, onToggle }) {
  const mutedByHost = useSelector(selectRtIsMuted);

  if (mutedByHost) {
    return (
      <button
        disabled
        className="btn btn-circle bg-error/10 text-error border border-error/30 cursor-not-allowed"
        aria-label="Muted by host"
        title="You were muted by the host"
      >
        <Lock size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`btn btn-circle ${isMicOn ? 'btn-ghost border border-base-300' : 'bg-error/10 text-error border border-error/30'}`}
      aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
      aria-pressed={!isMicOn}
    >
      {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
    </button>
  );
}
