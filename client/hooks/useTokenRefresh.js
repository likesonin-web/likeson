'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  refreshAgoraTokens,
  fetchAgoraTokens,
  selectAgora,
} from '@/store/slices/consultationSlice';
import { socketRequestTokenRefresh } from '@/services/consultationSocketService';

const REFRESH_LEAD_MS = 5 * 60 * 1000; // refresh 5min before expiry

/**
 * Auto-refreshes Agora tokens before they expire.
 * Dispatches Redux thunks + emits socket event.
 */
export function useTokenRefresh(consultationId, isJoined) {
  const dispatch = useDispatch();
  const agora = useSelector(selectAgora);
  const timerRef = useRef(null);

  const scheduleRefresh = useCallback(() => {
    clearTimeout(timerRef.current);

    if (!agora?.expiresAt || !isJoined) return;

    const expiresAt = new Date(agora.expiresAt).getTime();
    const now = Date.now();
    const refreshAt = expiresAt - REFRESH_LEAD_MS;
    const delay = refreshAt - now;

    if (delay <= 0) {
      // Already near/past expiry — refresh now
      dispatch(refreshAgoraTokens(consultationId)).then(() => {
        dispatch(fetchAgoraTokens(consultationId));
        socketRequestTokenRefresh(consultationId);
      });
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        await dispatch(refreshAgoraTokens(consultationId));
        await dispatch(fetchAgoraTokens(consultationId));
        socketRequestTokenRefresh(consultationId);
      } catch (err) {
        console.error('[useTokenRefresh] Refresh failed:', err);
      }
    }, delay);
  }, [agora?.expiresAt, isJoined, consultationId, dispatch]);

  useEffect(() => {
    scheduleRefresh();
    return () => clearTimeout(timerRef.current);
  }, [scheduleRefresh]);
}