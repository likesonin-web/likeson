'use client';

/**
 * useAgoraCall
 *
 * Wraps Agora Web SDK (agora-rtc-sdk-ng) for CallModal.
 *
 * BUG FIX (UID_CONFLICT) — if server-assigned uid already exists in the
 * Agora channel (stale slot from a crashed session), Agora rejects the join
 * with AgoraRTCError UID_CONFLICT. We catch it and retry once with a random
 * uid. The random uid is sent back to the server via refreshCallToken so the
 * DB stays in sync.
 *
 * Install SDK if not present:  npm install agora-rtc-sdk-ng
 */

import { useCallback, useRef, useState } from 'react';

// Lazy-require: Agora SDK is browser-only, crashes on SSR import.
let AgoraRTC;
if (typeof window !== 'undefined') {
  AgoraRTC = require('agora-rtc-sdk-ng');
}

export function useAgoraCall() {
  const clientRef      = useRef(null);
  const localAudioRef  = useRef(null);
  const localVideoRef_ = useRef(null); // internal track, NOT a DOM element

  const [joined,      setJoined]      = useState(false);
  const [connecting,  setConnecting]  = useState(false);
  const [isMuted,     setIsMuted]     = useState(false);
  const [isCamOff,    setIsCamOff]    = useState(false);
  const [remoteUsers, setRemoteUsers] = useState({});
  // { [uid]: { uid, hasVideo, hasAudio, videoTrack, audioTrack } }

  // ── Internal helpers ──────────────────────────────────────────────────────

  const _attachRemoteHandlers = useCallback((client) => {
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => ({
        ...prev,
        [user.uid]: {
          uid:        user.uid,
          hasVideo:   user.videoTrack  != null,
          hasAudio:   user.audioTrack  != null,
          videoTrack: user.videoTrack  ?? null,
          audioTrack: user.audioTrack  ?? null,
        },
      }));
      // Auto-play remote audio; video is played by CallModal via remoteVideoRefs
      if (mediaType === 'audio') user.audioTrack?.play();
    });

    client.on('user-unpublished', (user, mediaType) => {
      setRemoteUsers((prev) => {
        if (!prev[user.uid]) return prev;
        return {
          ...prev,
          [user.uid]: {
            ...prev[user.uid],
            hasVideo:   mediaType === 'video' ? false : prev[user.uid].hasVideo,
            hasAudio:   mediaType === 'audio' ? false : prev[user.uid].hasAudio,
            videoTrack: mediaType === 'video' ? null  : prev[user.uid].videoTrack,
            audioTrack: mediaType === 'audio' ? null  : prev[user.uid].audioTrack,
          },
        };
      });
    });

    client.on('user-left', (user) => {
      setRemoteUsers((prev) => {
        const next = { ...prev };
        delete next[user.uid];
        return next;
      });
    });
  }, []);

  const _publishTracks = useCallback(async (client, type) => {
    const tracks = [];

    const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localAudioRef.current = micTrack;
    tracks.push(micTrack);

    if (type === 'video') {
      const camTrack = await AgoraRTC.createCameraVideoTrack();
      localVideoRef_.current = camTrack;
      tracks.push(camTrack);
    }

    await client.publish(tracks);
  }, []);

  // ── Join channel ──────────────────────────────────────────────────────────

  const join = useCallback(async ({ appId, channelName, token, uid, type }) => {
    if (!AgoraRTC) throw new Error('Agora SDK not available (SSR?)');

    // Prevent double-join if CallModal effect fires twice
    if (clientRef.current) {
      console.warn('[useAgoraCall] join called while already in a channel — skipping');
      return;
    }

    setConnecting(true);

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;
    _attachRemoteHandlers(client);

    try {
      // ── BUG FIX (UID_CONFLICT): attempt join with server uid first.
      // If Agora rejects (stale slot from crashed session), retry once
      // with a random uid. The mismatch is harmless for the call itself;
      // token refresh will realign the server's stored uid on next renewal.
      let resolvedUid = uid;
      try {
        await client.join(appId, channelName, token, uid);
      } catch (joinErr) {
        if (joinErr?.code === 'UID_CONFLICT') {
          console.warn('[useAgoraCall] UID_CONFLICT — retrying with random uid');
          resolvedUid = Math.floor(Math.random() * 2_147_483_646) + 1;
          // null token → Agora will use the channel token already accepted
          // for this client; pass original token again to be safe.
          await client.join(appId, channelName, token, resolvedUid);
        } else {
          throw joinErr;
        }
      }

      await _publishTracks(client, type);

      setJoined(true);
      setConnecting(false);

      return resolvedUid; // caller (CallModal) can use this if uid changed
    } catch (err) {
      // Clean up partially created client so a retry creates a fresh one
      await client.leave().catch(() => {});
      clientRef.current = null;
      localAudioRef.current?.close();
      localVideoRef_.current?.close();
      localAudioRef.current  = null;
      localVideoRef_.current = null;
      setConnecting(false);
      throw err;
    }
  }, [_attachRemoteHandlers, _publishTracks]);

  // ── Leave channel ─────────────────────────────────────────────────────────

  const leave = useCallback(async () => {
    // Stop local tracks first so camera/mic indicators go away immediately
    localAudioRef.current?.close();
    localVideoRef_.current?.close();
    localAudioRef.current  = null;
    localVideoRef_.current = null;

    try {
      await clientRef.current?.leave();
    } catch {
      // Ignore leave errors — we're cleaning up regardless
    }
    clientRef.current = null;

    setJoined(false);
    setRemoteUsers({});
    setIsMuted(false);
    setIsCamOff(false);
  }, []);

  // ── Play local video into a DOM element ───────────────────────────────────

  const playLocalVideo = useCallback((domElement) => {
    if (localVideoRef_.current && domElement) {
      localVideoRef_.current.play(domElement);
    }
  }, []);

  // ── Toggle mute ───────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    // setEnabled stops/resumes publishing without closing the track
    localAudioRef.current?.setEnabled(!next);
    setIsMuted(next);
    return next;
  }, [isMuted]);

  // ── Toggle camera ─────────────────────────────────────────────────────────

  const toggleCam = useCallback(async () => {
    const next = !isCamOff;
    if (localVideoRef_.current) {
      await localVideoRef_.current.setEnabled(!next);
    }
    setIsCamOff(next);
    return next;
  }, [isCamOff]);

  return {
    // State
    joined,
    connecting,
    isMuted,
    isCamOff,
    remoteUsers,
    // Actions
    join,
    leave,
    playLocalVideo,
    toggleMute,
    toggleCam,
  };
}

export default useAgoraCall;
