'use client';
/**
 * NetworkQualityBadge.jsx
 * Displays live connection quality indicator.
 */

import React, { memo } from 'react';
import { Wifi, WifiOff, Zap, AlertTriangle } from 'lucide-react';
import { NETWORK_QUALITY } from '@/utils/constants';

const CONFIG = {
  [NETWORK_QUALITY.EXCELLENT]:    { label: 'Excellent', icon: Zap,           cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  [NETWORK_QUALITY.GOOD]:         { label: 'Good',      icon: Wifi,          cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',         dot: 'bg-blue-400'    },
  [NETWORK_QUALITY.POOR]:         { label: 'Poor',      icon: AlertTriangle, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',      dot: 'bg-amber-400 animate-pulse' },
  [NETWORK_QUALITY.DISCONNECTED]: { label: 'Offline',   icon: WifiOff,       cls: 'bg-red-500/15 text-red-400 border-red-500/30',            dot: 'bg-red-400 animate-pulse'   },
};

/**
 * @param {object} props
 * @param {string}  props.quality        - one of NETWORK_QUALITY values
 * @param {number}  props.reconnectCount
 * @param {boolean} props.compact        - small mode for toolbar
 */
export const NetworkQualityBadge = memo(function NetworkQualityBadge({
  quality = NETWORK_QUALITY.GOOD,
  reconnectCount = 0,
  compact = false,
}) {
  const cfg  = CONFIG[quality] ?? CONFIG[NETWORK_QUALITY.GOOD];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${cfg.cls}`}
        title={`Network: ${cfg.label}${reconnectCount > 0 ? ` · ${reconnectCount} reconnects` : ''}`}
        aria-label={`Network quality: ${cfg.label}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        <Icon size={10} />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${cfg.cls}`}
      aria-label={`Network quality: ${cfg.label}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      <Icon size={12} />
      <span>{cfg.label}</span>
      {reconnectCount > 0 && (
        <span className="opacity-60">· {reconnectCount}↺</span>
      )}
    </div>
  );
});

export default NetworkQualityBadge;