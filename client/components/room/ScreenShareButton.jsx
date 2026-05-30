'use client';
import { Monitor, MonitorOff, Loader2 } from 'lucide-react';

export function ScreenShareButton({ isSharing, isLoading, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || isLoading}
      className={`btn btn-circle ${
        isSharing
          ? 'bg-success/10 text-success border border-success/40'
          : 'btn-ghost border border-base-300'
      }`}
      aria-label={isSharing ? 'Stop screen share' : 'Start screen share'}
      aria-pressed={isSharing}
    >
      {isLoading
        ? <Loader2 size={18} className="animate-spin" />
        : isSharing
          ? <MonitorOff size={18} />
          : <Monitor size={18} />
      }
    </button>
  );
}
