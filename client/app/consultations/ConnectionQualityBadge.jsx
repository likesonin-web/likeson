'use client';
/**
 * ConnectionQualityBadge.jsx
 * Visual indicator for network quality.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { NETWORK_QUALITY_CONFIG } from './constants';

export function ConnectionQualityBadge({ quality = 'good', compact = false }) {
  const cfg = NETWORK_QUALITY_CONFIG[quality] ?? NETWORK_QUALITY_CONFIG.good;

  if (compact) {
    return (
      <div className="flex items-center gap-1" title={cfg.label}>
        {quality === 'disconnected' ? (
          <WifiOff size={12} style={{ color: cfg.color }} />
        ) : (
          <div className="flex items-end gap-0.5 h-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-full transition-all"
                style={{
                  height: `${i * 25}%`,
                  backgroundColor: i <= cfg.bars ? cfg.color : '#e5e7eb',
                  minHeight: '3px',
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      key={quality}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: `${cfg.color}15`,
        borderColor:      `${cfg.color}40`,
        color:             cfg.color,
      }}
    >
      {quality === 'disconnected' ? (
        <WifiOff size={10} />
      ) : (
        <div className="flex items-end gap-0.5 h-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${i * 25}%`,
                backgroundColor: i <= cfg.bars ? cfg.color : `${cfg.color}30`,
                minHeight: '3px',
              }}
            />
          ))}
        </div>
      )}
      {cfg.label}
    </motion.div>
  );
}

export default ConnectionQualityBadge;