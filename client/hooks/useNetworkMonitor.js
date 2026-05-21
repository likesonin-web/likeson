/**
 * useNetworkMonitor.js
 * Track connection quality, detect degradation, dispatch logNetworkQuality.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { logNetworkQuality } from '@/store/slices/consultationSlice'; // adjust path
import { NETWORK_QUALITY, NETWORK_LOG_INTERVAL_MS } from '@/utils/constants';
import { clearTimers } from '@/utils/cleanup';

/**
 * @param {object} params
 * @param {string}  params.bookingId
 * @param {boolean} params.isLive
 * @param {string}  params.participantRole  - 'doctor'
 */
export function useNetworkMonitor({ bookingId, isLive, participantRole = 'doctor' }) {
  const dispatch = useDispatch();

  const [quality,        setQuality]        = useState(NETWORK_QUALITY.GOOD);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [isOnline,       setIsOnline]       = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const intervalRef    = useRef(null);
  const qualityRef     = useRef(NETWORK_QUALITY.GOOD);
  const reconnectRef   = useRef(0);
  const logThrottleRef = useRef(0);

  // Stable log fn — throttled, dispatches to backend
  const logQuality = useCallback((q) => {
    const now = Date.now();
    if (now - logThrottleRef.current < NETWORK_LOG_INTERVAL_MS) return;
    logThrottleRef.current = now;

    if (!bookingId) return;
    dispatch(logNetworkQuality({ bookingId, participant: participantRole, quality: q }));
  }, [bookingId, dispatch, participantRole]);

  // Resolve quality from navigator.connection or RTT estimate
  const resolveQuality = useCallback(() => {
    if (!navigator.onLine) return NETWORK_QUALITY.DISCONNECTED;

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return NETWORK_QUALITY.GOOD;

    const rtt        = conn.rtt  ?? 0;
    const downlink   = conn.downlink ?? 10;
    const effectiveType = conn.effectiveType ?? '4g';

    if (effectiveType === 'slow-2g' || rtt > 600 || downlink < 0.3) return NETWORK_QUALITY.POOR;
    if (effectiveType === '2g'      || rtt > 300 || downlink < 1)   return NETWORK_QUALITY.POOR;
    if (effectiveType === '3g'      || rtt > 150)                   return NETWORK_QUALITY.GOOD;
    return NETWORK_QUALITY.EXCELLENT;
  }, []);

  // Poll quality
  useEffect(() => {
    if (!isLive) {
      clearTimers(intervalRef.current);
      return;
    }

    const check = () => {
      const q = resolveQuality();
      if (q !== qualityRef.current) {
        qualityRef.current = q;
        setQuality(q);
        logQuality(q);
      }
    };

    check();
    intervalRef.current = setInterval(check, 5_000);
    return () => clearTimers(intervalRef.current);
  }, [isLive, resolveQuality, logQuality]);

  // Online/offline browser events
  useEffect(() => {
    const onOnline  = () => {
      setIsOnline(true);
      reconnectRef.current += 1;
      setReconnectCount(reconnectRef.current);
      setQuality(NETWORK_QUALITY.GOOD);
      qualityRef.current = NETWORK_QUALITY.GOOD;
    };
    const onOffline = () => {
      setIsOnline(false);
      setQuality(NETWORK_QUALITY.DISCONNECTED);
      qualityRef.current = NETWORK_QUALITY.DISCONNECTED;
      logQuality(NETWORK_QUALITY.DISCONNECTED);
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [logQuality]);

  return {
    quality,
    isOnline,
    reconnectCount,
    isPoor:         quality === NETWORK_QUALITY.POOR,
    isDisconnected: quality === NETWORK_QUALITY.DISCONNECTED || !isOnline,
    isExcellent:    quality === NETWORK_QUALITY.EXCELLENT,
  };
}