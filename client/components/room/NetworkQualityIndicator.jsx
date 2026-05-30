'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectRtNetworkQuality } from '@/store/slices/consultationSlice';
import { getActiveBars, getNetworkQualityClass, getNetworkQualityLabel } from '../../utils/agoraHelpers';

const BAR_HEIGHTS = ['h-1', 'h-1.5', 'h-2.5', 'h-4'];

export function NetworkQualityIndicator({ userId }) {
  const allQuality = useSelector(selectRtNetworkQuality);
  const [showTooltip, setShowTooltip] = useState(false);

  const quality = userId ? allQuality[userId] : Object.values(allQuality)[0];
  const level   = quality?.uplinkNetworkQuality || 0;
  const active  = getActiveBars(level);
  const cls     = getNetworkQualityClass(level);
  const label   = getNetworkQualityLabel(level);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`Network quality: ${label}`}
    >
      <div className="network-bars">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={`network-bar ${h} ${i < active ? `active-${cls}` : ''}`}
          />
        ))}
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-neutral text-neutral-content text-xs whitespace-nowrap z-50">
          {label}
          {quality?.latency != null && ` · ${quality.latency}ms`}
        </div>
      )}
    </div>
  );
}
