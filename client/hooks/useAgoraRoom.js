'use client';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  rtConnectionLost,
  rtConnectionRecovered,
  reportSdkError,
} from '@/store/slices/consultationSlice';
import { useConsultation } from '@/providers/ConsultationSocketProvider';
import { detectDeviceType, detectBrowser } from '../utils/agoraHelpers';
import {
  setAgoraClient,
  clearAgoraClient,
  setAgoraJoined,
} from '../utils/agoraClientStore';

const APP_ID = process.env.NEXT_PUBLIC_AGORAIO_APP_ID;

export function useAgoraRoom({ channelName, token, uid, consultationId }) {
  const dispatch = useDispatch();
  const {
    emitParticipantJoin,
    emitParticipantLeave,
    emitSdkError,
  } = useConsultation();

  // Refs — never trigger re-renders, always current
  const joiningRef  = useRef(false); // join in-flight guard
  const joinedRef   = useRef(false); // already-joined guard
  const mountedRef  = useRef(true);
  
  // FIX: Create the clientRef that useConsultationRoom is looking for
  const clientRef   = useRef(null); 

  // Only 2 pieces of state exposed — ConsultationRoom gates UI on these
  const [joined,    setJoined]    = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Stringify deps — prevents re-run when Redux recreates object with same values
  const depKey = channelName && token && uid
    ? `${channelName}|${uid}|${consultationId}`
    : null;

  useEffect(() => {
    mountedRef.current = true;

    // 1. Hard error: missing env var
    if (!APP_ID) {
      const msg = 'NEXT_PUBLIC_AGORAIO_APP_ID is not set. Check your .env.local file.';
      console.error('[AgoraRoom]', msg);
      setJoinError(msg);
      return;
    }

    // 2. Not ready yet
    if (!depKey) return;

    // 3. In-flight or already joined — do NOT re-join
    if (joiningRef.current || joinedRef.current) return;

    joiningRef.current = true;

    const init = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        AgoraRTC.setLogLevel(3); // warn only

        const rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });

        // FIX: Attach the created client to our ref
        clientRef.current = rtcClient;

        // Write to module store BEFORE join so useScreenShare can read it
        setAgoraClient(rtcClient);

        // Connection state
        rtcClient.on('connection-state-change', (curState) => {
          if (!mountedRef.current) return;
          if (curState === 'DISCONNECTED' || curState === 'DISCONNECTING') {
            dispatch(rtConnectionLost({ reason: curState }));
          }
          if (curState === 'CONNECTED') {
            dispatch(rtConnectionRecovered());
          }
        });

        // SDK exceptions (NOT network-quality — that's useNetworkQuality's job)
        rtcClient.on('exception', (event) => {
          if (!mountedRef.current) return;
          console.warn('[AgoraRoom] exception:', event);
          dispatch(reportSdkError({
            id:      consultationId,
            code:    event.code,
            message: event.msg,
          }));
          emitSdkError({ consultationId, code: event.code, message: event.msg });
        });

        // Guard: unmounted between createClient and join
        if (!mountedRef.current) {
          clearAgoraClient();
          clientRef.current = null; // Clean up ref
          joiningRef.current = false;
          return;
        }

        console.log('[AgoraRoom] joining channel', { channelName, uid });
        await rtcClient.join(APP_ID, channelName, token, uid);

        // Guard: unmounted while awaiting join
        if (!mountedRef.current) {
          try { await rtcClient.leave(); } catch { /* ignore */ }
          clearAgoraClient();
          clientRef.current = null; // Clean up ref
          joinedRef.current  = false;
          joiningRef.current = false;
          return;
        }

        joinedRef.current  = true;
        joiningRef.current = false;
        setAgoraJoined(true);
        setJoined(true);
        setJoinError(null);

        emitParticipantJoin({
          consultationId,
          agoraUid:   uid,
          deviceType: detectDeviceType(),
          browser:    detectBrowser(),
        });

        console.log('[AgoraRoom] joined ✓', { uid, channelName });

      } catch (err) {
        joiningRef.current = false;
        if (!mountedRef.current) return;

        // UID_CONFLICT = already in channel (StrictMode double, hot-reload)
        // Treat as success — don't surface error to user
        if (
          err.code === 'UID_CONFLICT' ||
          err.message?.includes('UID_CONFLICT') ||
          err.message?.includes('join number')
        ) {
          console.warn('[AgoraRoom] UID_CONFLICT — already joined, recovering');
          joinedRef.current = true;
          setAgoraJoined(true);
          setJoined(true);
          setJoinError(null);
          return;
        }

        console.error('[AgoraRoom] join failed:', err.message, err.code);
        clearAgoraClient();
        clientRef.current = null; // Clean up ref
        setJoinError(err.message);
        dispatch(reportSdkError({
          id:      consultationId,
          code:    'JOIN_FAILED',
          message: err.message,
        }));
        emitSdkError({ consultationId, code: 'JOIN_FAILED', message: err.message });
      }
    };

    init();

    return () => {
      mountedRef.current = false;

      const doLeave = async () => {
        const client = getAgoraClientForLeave();
        if (!client) return;
        emitParticipantLeave({ consultationId, reason: 'unmount' });
        try {
          if (joinedRef.current) await client.leave();
        } catch (e) {
          console.warn('[AgoraRoom] leave error:', e.message);
        } finally {
          clearAgoraClient();
          clientRef.current = null; // Clean up ref
          joinedRef.current  = false;
          joiningRef.current = false;
          setAgoraJoined(false);
        }
      };

      doLeave();
      // Reset state so ConsultationRoom re-gates if component remounts
      setJoined(false);
    };

  // depKey is null when not ready → effect does nothing
  // depKey changes only when channelName/uid/consultationId actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  // FIX: Return client and clientRef so useConsultationRoom can use them
  return { 
    joined, 
    joinError, 
    clientRef, 
    client: clientRef.current 
  };
}

// Internal helper — reads from module store at call time
function getAgoraClientForLeave() {
  const { getAgoraClient } = require('../utils/agoraClientStore');
  return getAgoraClient();
}