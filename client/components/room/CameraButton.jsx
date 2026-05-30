'use client';
import { Video, VideoOff } from 'lucide-react';

export function CameraButton({ isCamOn, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`btn btn-circle ${isCamOn ? 'btn-ghost border border-base-300' : 'bg-error/10 text-error border border-error/30'}`}
      aria-label={isCamOn ? 'Turn off camera' : 'Turn on camera'}
      aria-pressed={!isCamOn}
    >
      {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
    </button>
  );
}
