'use client';
import { useState, useEffect, useRef } from 'react';
import { useConsultation } from '@/providers/ConsultationSocketProvider';

/**
 * useNetworkQuality — FIXED
 *
 * BUG: useAgoraRoom ALSO attached 'network-quality' listener and called emitNQ.
 *   This caused double socket emit on every Agora quality event.
 *   useAgoraRoom's listener is now REMOVED — this hook is the single owner.
 *
 * FIX: Throttle socket emit to 3s. Agora fires every ~2s; no need to push
 *   every single event to the socket server.
 */
export function useNetworkQuality(client, consultationId) {
  const [quality, setQuality] = useState({
    uplinkNetworkQuality:   0,
    downlinkNetworkQuality: 0,
  });

  const { emitNetworkQuality } = useConsultation();
  const lastEmitRef = useRef(0);
  const THROTTLE_MS = 3000;

  useEffect(() => {
    if (!client || !consultationId) return;

    const handler = (stats) => {
      const { uplinkNetworkQuality, downlinkNetworkQuality } = stats;
      setQuality({ uplinkNetworkQuality, downlinkNetworkQuality });

      const now = Date.now();
      if (now - lastEmitRef.current >= THROTTLE_MS) {
        lastEmitRef.current = now;
        emitNetworkQuality({
          consultationId,
          uplinkNetworkQuality,
          downlinkNetworkQuality,
        });
      }
    };

    client.on('network-quality', handler);
    return () => client.off('network-quality', handler);
  }, [client, consultationId, emitNetworkQuality]);

  return quality;
}