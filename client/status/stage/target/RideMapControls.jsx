'use client';
import { Locate, Maximize2, Navigation2, Eye } from 'lucide-react';

export default function RideMapControls({
  cameraMode,       // 'follow' | 'overview' | 'fitBounds'
  onFollowDriver,
  onOverview,
  onFitBounds,
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-base-100/90 backdrop-blur-sm border border-base-300 rounded-xl p-1.5 shadow-depth">
      <button
        onClick={onFollowDriver}
        title="Follow Driver"
        aria-label="Follow driver"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
          cameraMode === 'follow'
            ? 'bg-primary text-primary-content shadow-primary'
            : 'hover:bg-base-200 text-base-content/70 hover:text-primary'
        }`}
      >
        <Navigation2 size={16} />
      </button>

      <button
        onClick={onOverview}
        title="Overview"
        aria-label="Map overview"
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
          cameraMode === 'overview'
            ? 'bg-primary text-primary-content'
            : 'hover:bg-base-200 text-base-content/70 hover:text-primary'
        }`}
      >
        <Eye size={16} />
      </button>

      <div className="h-px bg-base-300 mx-1" />

      <button
        onClick={onFitBounds}
        title="Fit all markers"
        aria-label="Fit all markers"
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-base-200 text-base-content/70 hover:text-primary transition-all"
      >
        <Maximize2 size={15} />
      </button>
    </div>
  );
}