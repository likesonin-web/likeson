'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectMyTokens,
  selectAgora,
  socketQosUpdate,
  refreshAgoraTokens,
  fetchAgoraTokens,
  setLocalRecordingActive,
  selectMutedParticipants,
} from '@/store/slices/consultationSlice';
import { getScreenShareTokenAPI } from '@/services/agoraService';
import toast from 'react-hot-toast';

const AgoraContext = createContext(null);

export const useAgora = () => {
  const ctx = useContext(AgoraContext);
  if (!ctx) throw new Error('useAgora must be used inside AgoraProvider');
  return ctx;
};

const SCREEN_SHARE_UID_THRESHOLD = 1_000_000;

export default function AgoraProvider({
  children,
  consultationId,
  userId,
  role,
  userName = '',
}) {
  const dispatch    = useDispatch();
  const myTokens    = useSelector(selectMyTokens);
  const mutedIds    = useSelector(selectMutedParticipants);

  const clientRef       = useRef(null);
  const screenClientRef = useRef(null);
  const uidNameMap      = useRef({});

  // doctor-mute lock: true = doctor force-muted → toggleMic blocked
  const doctorMutedRef = useRef(false);

  // Keep latest track refs accessible in cleanup without stale closures
  const localAudioTrackRef  = useRef(null);
  const localVideoTrackRef  = useRef(null);
  const screenVideoTrackRef = useRef(null);
  const screenAudioTrackRef = useRef(null);

  const [localAudioTrack,  setLocalAudioTrack]  = useState(null);
  const [localVideoTrack,  setLocalVideoTrack]  = useState(null);
  const [screenVideoTrack, setScreenVideoTrack] = useState(null);
  const [screenAudioTrack, setScreenAudioTrack] = useState(null);

  const [remoteUsers,    setRemoteUsers]    = useState([]);
  const [isJoined,       setIsJoined]       = useState(false);
  const [isMicOn,        setIsMicOn]        = useState(true);
  const [isCamOn,        setIsCamOn]        = useState(true);
  const [isSharingScreen,setIsSharingScreen]= useState(false);
  const [networkQuality, setNetworkQuality] = useState(0);
  const [isConnecting,   setIsConnecting]   = useState(false);
  const [connectionState,setConnectionState]= useState('DISCONNECTED');
  const [error,          setError]          = useState(null);
  const [localScreenUid, setLocalScreenUid] = useState(null);
  const [isDoctorMuted,  setIsDoctorMuted]  = useState(false);

  // ── Sync track refs whenever state changes ──────────────────────────────
  useEffect(() => { localAudioTrackRef.current  = localAudioTrack;  }, [localAudioTrack]);
  useEffect(() => { localVideoTrackRef.current  = localVideoTrack;  }, [localVideoTrack]);
  useEffect(() => { screenVideoTrackRef.current = screenVideoTrack; }, [screenVideoTrack]);
  useEffect(() => { screenAudioTrackRef.current = screenAudioTrack; }, [screenAudioTrack]);

  // ── Core cleanup — stops ALL tracks and leaves channels ────────────────
  // Uses refs so it's always fresh — safe to call from beforeunload / unmount
  const hardStop = useCallback(async () => {
    // Stop recording if active
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(animFrameRef.current);

    // Leave screen share client
    const sc = screenClientRef.current;
    if (sc) {
      try {
        screenVideoTrackRef.current?.stop();
        screenVideoTrackRef.current?.close();
        screenAudioTrackRef.current?.stop();
        screenAudioTrackRef.current?.close();
        await sc.leave();
      } catch {}
      screenClientRef.current = null;
    }

    // Stop local tracks
    localAudioTrackRef.current?.stop();
    localAudioTrackRef.current?.close();
    localVideoTrackRef.current?.stop();
    localVideoTrackRef.current?.close();

    // Disconnect audio mix
    audioSourcesRef.current.forEach(src => { try { src.disconnect(); } catch {} });
    audioSourcesRef.current.clear();

    if (audioCtxRef.current) {
      try { await audioCtxRef.current.close(); } catch {}
      audioCtxRef.current  = null;
      audioDestRef.current = null;
    }

    // Leave main channel
    const c = clientRef.current;
    if (c) {
      try { await c.leave(); } catch {}
    }

    // Reset state
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setScreenVideoTrack(null);
    setScreenAudioTrack(null);
    setRemoteUsers([]);
    setLocalScreenUid(null);
    setIsJoined(false);
    setIsSharingScreen(false);
    doctorMutedRef.current = false;
    setIsDoctorMuted(false);
  }, []); // no deps — uses refs only

  // ── Doctor mute enforcement ────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !localAudioTrack) return;
    const muted = mutedIds.includes(userId);

    doctorMutedRef.current = muted;
    setIsDoctorMuted(muted);

    if (muted) {
      localAudioTrack.setEnabled(false).catch(() => {});
      setIsMicOn(false);
    } else {
      localAudioTrack.setEnabled(true).catch(() => {});
      setIsMicOn(true);
    }
  }, [mutedIds, userId, localAudioTrack]);

  const canvasRef        = useRef(null);
  const animFrameRef     = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunks   = useRef([]);
  const audioCtxRef      = useRef(null);
  const audioDestRef     = useRef(null);
  const audioSourcesRef  = useRef(new Map());

  const enrichUser = useCallback((agoraUser) => {
    const meta = uidNameMap.current[agoraUser.uid] ?? {};
    const isScreenShare =
      meta.isScreenShare ?? (Number(agoraUser.uid) >= SCREEN_SHARE_UID_THRESHOLD);

    let resolvedName = meta.name;
    if (!resolvedName && isScreenShare) {
      const cameraUid  = Number(agoraUser.uid) - SCREEN_SHARE_UID_THRESHOLD;
      const cameraMeta = uidNameMap.current[cameraUid];
      resolvedName = cameraMeta?.name ?? 'Participant';
    }

    return {
      uid:         agoraUser.uid,
      videoTrack:  agoraUser.videoTrack  ?? null,
      audioTrack:  agoraUser.audioTrack  ?? null,
      userName:    resolvedName ?? `User-${agoraUser.uid}`,
      userRole:    meta.role ?? 'participant',
      isScreenShare,
      _raw: agoraUser,
    };
  }, []);

  const upsertRemoteUser = useCallback((agoraUser) => {
    setRemoteUsers(prev => {
      const enriched = enrichUser(agoraUser);
      const idx = prev.findIndex(u => u.uid === agoraUser.uid);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = enriched;
        return next;
      }
      return [...prev, enriched];
    });
  }, [enrichUser]);

  // ── Agora client setup ─────────────────────────────────────────────────
  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play();
        addAudioSourceToMix(user.uid, user.audioTrack);
      }
      upsertRemoteUser(client.remoteUsers.find(u => u.uid === user.uid) || user);
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') removeAudioSourceFromMix(user.uid);
      upsertRemoteUser(client.remoteUsers.find(u => u.uid === user.uid) || user);
    });

    client.on('user-left', (user) => {
      removeAudioSourceFromMix(user.uid);
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    client.on('connection-state-change', (cur) => {
      setConnectionState(cur);
      if (cur === 'DISCONNECTED') setIsJoined(false);
    });

    client.on('network-quality', (stats) => {
      const q = stats.uplinkNetworkQuality;
      setNetworkQuality(q);
      if (consultationId && userId) {
        dispatch(socketQosUpdate({ userId, quality: q }));
      }
    });

    client.on('token-privilege-will-expire', async () => {
      try {
        await dispatch(refreshAgoraTokens(consultationId));
        const res = await dispatch(fetchAgoraTokens(consultationId));
        if (res.payload?.tokens?.rtcToken) {
          await client.renewToken(res.payload.tokens.rtcToken);
        }
      } catch (err) {
        console.error('[Agora] Token refresh failed:', err);
      }
    });

    client.on('token-privilege-did-expire', async () => {
      toast.error('Session token expired. Reconnecting…');
      try {
        await dispatch(refreshAgoraTokens(consultationId));
        const res = await dispatch(fetchAgoraTokens(consultationId));
        if (res.payload?.tokens?.rtcToken) {
          await client.renewToken(res.payload.tokens.rtcToken);
        }
      } catch {
        setError('Token expired. Please refresh the page.');
      }
    });

    return () => { client.removeAllListeners(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, userId, dispatch]);

  // ── CRITICAL: hard-stop on provider unmount ────────────────────────────
  // Fires when user navigates away, closes ConsultationRoom, etc.
  useEffect(() => {
    return () => {
      // Synchronous immediate track kill (fastest — no await needed here)
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      screenVideoTrackRef.current?.stop();
      screenVideoTrackRef.current?.close();
      screenAudioTrackRef.current?.stop();
      screenAudioTrackRef.current?.close();

      // Async leave (fire and forget — page may be gone anyway)
      screenClientRef.current?.leave().catch(() => {});
      clientRef.current?.leave().catch(() => {});

      // Audio context
      try { audioCtxRef.current?.close(); } catch {}
      audioSourcesRef.current.forEach(src => { try { src.disconnect(); } catch {} });
      audioSourcesRef.current.clear();

      // Recording
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []); // empty deps — intentional, uses refs

  // ── beforeunload: kill tracks synchronously on tab close / refresh ──────
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Synchronous only — no await in beforeunload
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      screenVideoTrackRef.current?.stop();
      screenVideoTrackRef.current?.close();
      screenAudioTrackRef.current?.stop();
      screenAudioTrackRef.current?.close();

      try { audioCtxRef.current?.close(); } catch {}
      audioSourcesRef.current.forEach(src => { try { src.disconnect(); } catch {} });

      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      cancelAnimationFrame(animFrameRef.current);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // empty deps — uses refs

  // ── visibilitychange: stop tracks when tab hidden (mobile browser) ──────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      // Only kill if already left (session ended), not just tab-switching mid-call
      // Check connectionState ref instead of state to avoid stale closure
      const state = clientRef.current?.connectionState;
      if (state === 'DISCONNECTED' || state === 'DISCONNECTING') {
        localAudioTrackRef.current?.stop();
        localAudioTrackRef.current?.close();
        localVideoTrackRef.current?.stop();
        localVideoTrackRef.current?.close();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Token renewal ──────────────────────────────────────────────────────
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !myTokens?.rtcToken || !isJoined) return;
    client.renewToken(myTokens.rtcToken).catch(console.error);
  }, [myTokens?.rtcToken, isJoined]);

  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx  = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      audioCtxRef.current  = ctx;
      audioDestRef.current = dest;
    }
    return { ctx: audioCtxRef.current, dest: audioDestRef.current };
  }, []);

  const addAudioSourceToMix = useCallback((uid, audioTrack) => {
    if (!audioTrack || audioSourcesRef.current.has(uid)) return;
    try {
      const { ctx, dest } = ensureAudioCtx();
      const ms  = new MediaStream([audioTrack.getMediaStreamTrack()]);
      const src = ctx.createMediaStreamSource(ms);
      src.connect(dest);
      audioSourcesRef.current.set(uid, src);
    } catch (e) {
      console.warn('[AudioMix] Failed to add source for uid', uid, e);
    }
  }, [ensureAudioCtx]);

  const removeAudioSourceFromMix = useCallback((uid) => {
    const src = audioSourcesRef.current.get(uid);
    if (src) {
      try { src.disconnect(); } catch {}
      audioSourcesRef.current.delete(uid);
    }
  }, []);

  // ── joinChannel ────────────────────────────────────────────────────────
  const joinChannel = useCallback(async (tokens, userMeta = {}) => {
    const client = clientRef.current;
    if (!client || isJoined || isConnecting) return;

    const { appId, channelName, uid, rtcToken } = tokens;
    if (!appId || !channelName || !rtcToken) {
      setError('Missing Agora credentials');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const numericUid = await client.join(appId, channelName, rtcToken, uid ?? null);

      uidNameMap.current[numericUid] = {
        name:        userMeta.name || userName || 'You',
        role:        userMeta.role || role || 'participant',
        isScreenShare: false,
      };

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        {
          encoderConfig:    isMobile ? '360p_7' : '720p_2',
          optimizationMode: 'motion',
          facingMode:       'user',
        },
      );

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      const { ctx, dest } = ensureAudioCtx();
      const localMs  = new MediaStream([audioTrack.getMediaStreamTrack()]);
      const localSrc = ctx.createMediaStreamSource(localMs);
      localSrc.connect(dest);
      audioSourcesRef.current.set(numericUid, localSrc);

      await client.publish([audioTrack, videoTrack]);
      setIsJoined(true);
    } catch (err) {
      console.error('[Agora] Join failed:', err);
      setError(err.message || 'Failed to join channel');
      toast.error('Failed to join video call');
    } finally {
      setIsConnecting(false);
    }
  }, [isJoined, isConnecting, userName, role, ensureAudioCtx]);

  // ── leaveChannel (explicit user action) ───────────────────────────────
  const leaveChannel = useCallback(async () => {
    await hardStop();
  }, [hardStop]);

  // ── toggleMic ─────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    if (!localAudioTrack) return;
    if (doctorMutedRef.current) {
      toast.error('You have been muted by the doctor.', { icon: '🔇' });
      return;
    }
    await localAudioTrack.setEnabled(!isMicOn);
    setIsMicOn(p => !p);
  }, [localAudioTrack, isMicOn]);

  const toggleCamera = useCallback(async () => {
    if (!localVideoTrack) return;
    await localVideoTrack.setEnabled(!isCamOn);
    setIsCamOn(p => !p);
  }, [localVideoTrack, isCamOn]);

  // ── Screen share ───────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    const mainClient = clientRef.current;
    if (!mainClient || isSharingScreen) return;

    try {
      const tracks = await AgoraRTC.createScreenVideoTrack(
        { encoderConfig: '1080p_1', optimizationMode: 'detail' },
        'auto',
      );

      const sVideo = Array.isArray(tracks) ? tracks[0] : tracks;
      const sAudio = Array.isArray(tracks) ? tracks[1] : null;

      setScreenVideoTrack(sVideo);
      if (sAudio) setScreenAudioTrack(sAudio);

      const screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      screenClientRef.current = screenClient;

      const { appId, channelName, uid } = myTokens ?? {};
      const screenUid =
        ((Number(uid || 0) + SCREEN_SHARE_UID_THRESHOLD) >>> 0) ||
        (SCREEN_SHARE_UID_THRESHOLD + 1);

      const tokenResponse  = await getScreenShareTokenAPI(consultationId, screenUid);
      const screenRtcToken =
        tokenResponse.data?.token || tokenResponse.data?.rtcToken;

      if (!screenRtcToken) throw new Error('Failed to retrieve screen share token.');

      await screenClient.join(appId, channelName, screenRtcToken, screenUid);

      uidNameMap.current[screenUid] = {
        name: userName || 'You',
        role,
        isScreenShare: true,
      };
      setLocalScreenUid(screenUid);

      const tracksToPublish = sAudio ? [sVideo, sAudio] : [sVideo];
      await screenClient.publish(tracksToPublish);

      sVideo.on('track-ended', () => stopScreenShare());
      setIsSharingScreen(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        toast.error('Screen share failed: ' + (err.message || err.name));
      }
      console.error('[ScreenShare] Failed:', err);
    }
  }, [isSharingScreen, myTokens, userName, role, consultationId]);

  const stopScreenShare = useCallback(async () => {
    const sc = screenClientRef.current;
    if (!sc) return;
    try {
      screenVideoTrackRef.current?.stop();
      screenVideoTrackRef.current?.close();
      screenAudioTrackRef.current?.stop();
      screenAudioTrackRef.current?.close();
      await sc.leave();
      screenClientRef.current = null;
    } catch (err) {
      console.error('[ScreenShare] Stop failed:', err);
    }
    setScreenVideoTrack(null);
    setScreenAudioTrack(null);
    setLocalScreenUid(null);
    setIsSharingScreen(false);
  }, []);

  const switchCamera = useCallback(async (deviceId) => {
    if (!localVideoTrack) return;
    await localVideoTrack.setDevice(deviceId);
  }, [localVideoTrack]);

  const switchMic = useCallback(async (deviceId) => {
    if (!localAudioTrack) return;
    await localAudioTrack.setDevice(deviceId);
  }, [localAudioTrack]);

  // ── Local recording ────────────────────────────────────────────────────
  const startLocalRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') return;

    try {
      recordedChunks.current = [];

      const canvas = document.createElement('canvas');
      canvas.width  = 1280;
      canvas.height = 720;
      canvasRef.current = canvas;
      const ctx2d = canvas.getContext('2d');

      const getVideoEls = () =>
        Array.from(document.querySelectorAll('[data-agora-video] video'));

      const drawFrame = () => {
        const videos = getVideoEls();
        if (videos.length === 0) {
          ctx2d.fillStyle = '#111';
          ctx2d.fillRect(0, 0, canvas.width, canvas.height);
        } else if (videos.length === 1) {
          ctx2d.drawImage(videos[0], 0, 0, canvas.width, canvas.height);
        } else {
          const cols  = Math.ceil(Math.sqrt(videos.length));
          const rows  = Math.ceil(videos.length / cols);
          const tileW = canvas.width  / cols;
          const tileH = canvas.height / rows;
          videos.forEach((v, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            try { ctx2d.drawImage(v, col * tileW, row * tileH, tileW, tileH); } catch {}
          });
        }
        animFrameRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const canvasStream = canvas.captureStream(30);
      const { dest }     = ensureAudioCtx();
      const mixed = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      const recorder = new MediaRecorder(mixed, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        cancelAnimationFrame(animFrameRef.current);
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `consultation-${consultationId}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Recording saved to downloads');
        dispatch(setLocalRecordingActive(false));
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      dispatch(setLocalRecordingActive(true));
      toast.success('Recording all participants…');
    } catch (err) {
      console.error('[Recording] Failed:', err);
      toast.error('Recording failed: ' + err.message);
    }
  }, [consultationId, dispatch, ensureAudioCtx]);

  const stopLocalRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;
    mr.stop();
  }, []);

  const value = useMemo(() => ({
    client: clientRef.current,
    localAudioTrack,
    localVideoTrack,
    screenVideoTrack,
    screenAudioTrack,
    remoteUsers,
    isJoined,
    isMicOn,
    isCamOn,
    isSharingScreen,
    networkQuality,
    isConnecting,
    connectionState,
    error,
    localScreenUid,
    isDoctorMuted,
    joinChannel,
    leaveChannel,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    switchCamera,
    switchMic,
    startLocalRecording,
    stopLocalRecording,
    uidNameMap: uidNameMap.current,
  }), [
    localAudioTrack, localVideoTrack, screenVideoTrack, screenAudioTrack,
    remoteUsers, isJoined, isMicOn, isCamOn,
    isSharingScreen, networkQuality, isConnecting,
    connectionState, error, localScreenUid, isDoctorMuted,
    joinChannel, leaveChannel, toggleMic, toggleCamera,
    startScreenShare, stopScreenShare, switchCamera, switchMic,
    startLocalRecording, stopLocalRecording,
  ]);

  return (
    <AgoraContext.Provider value={value}>
      {children}
    </AgoraContext.Provider>
  );
}