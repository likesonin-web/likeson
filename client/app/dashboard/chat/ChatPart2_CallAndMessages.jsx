'use client';

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, PhoneOff, Play, Pin, Reply, Edit3, Trash2,
  Forward, AlertCircle, Eye, Smile,
  Mic, MicOff, VideoOff, Loader2, Volume2, VolumeX,
} from 'lucide-react';

import {
  getSocket,
  selectCallPeerMedia,
  selectCallMediaConstraints,
  selectCallPeerDisconnected,
  setActiveCall,
  clearActiveCall,
  clearIncomingCall,
  initiateCall,
} from '@/store/slices/chatSlice';

// ─── Socket thunks ────────────────────────────────────────────────────────────
export const socketInitiateCall = (payload) => (dispatch) => {
  const socket = getSocket();
  if (!socket?.connected) return dispatch(initiateCall(payload));
  return new Promise((resolve, reject) => {
    socket.emit('call:initiate', payload, (ack) => {
      if (ack?.success) resolve(ack);
      else reject(ack?.message || 'Call initiation failed');
    });
  });
};
export const socketCallOffer  = (payload) => () => { getSocket()?.emit('call:offer',  payload); };
export const socketCallAnswer = (payload) => () => { getSocket()?.emit('call:answer', payload); };
export const socketCallIce    = (payload) => () => { getSocket()?.emit('call:ice',    payload); };

import {
  AudioPlayer, VideoPlayer, ImageMessage, StickerMessage, FileAttachment,
  ReadReceipt, PresenceDot, QUICK_REACTIONS,
  formatTime, formatSeconds, getRoleLabel, getUserAvatar,
} from './ChatPart1_Components';

// ─── WEBRTC CALL SCREEN ───────────────────────────────────────────────────────
// FIX #5: Race condition — offer arriving before PC is built now handled via
//         offerBufferRef. When offer arrives while PC null, it is buffered and
//         applied immediately after buildPC() completes.
// FIX #6: Audio autoplay block — on NotAllowedError, shows "Tap to enable audio"
//         button that triggers play on user gesture instead of silently dropping.
// FIX #7: buildPC removed from useCallback deps of cleanup to break stale closure.
export const CallScreen = memo(({
  call,
  isIncoming,
  onEnd,
  onAnswer,
  onDecline,
  peerSdpOffer,
  peerSdpAnswer,
  iceCandidates = [],
}) => {
  const dispatch = useDispatch();

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);

  const isMountedRef   = useRef(true);
  const iceQueueRef    = useRef([]);
  const offerSentRef   = useRef(false);
  const answerSentRef  = useRef(false);
  const durationTimer  = useRef(null);

  // FIX #5: Buffer for SDP offer that arrives before PC is ready
  const offerBufferRef = useRef(null);

  const peerMedia        = useSelector(selectCallPeerMedia);
  const mediaConstraints = useSelector(selectCallMediaConstraints);
  const peerDisconnected = useSelector(selectCallPeerDisconnected);

  const [callPhase, setCallPhase] = useState(isIncoming ? 'incoming' : 'calling');
  const callPhaseRef = useRef(callPhase);
  const [muted,    setMuted]    = useState(false);
  const [camOff,   setCamOff]   = useState(false);
  const [duration, setDuration] = useState(0);

  // FIX #6: Audio autoplay blocked state — show manual unblock button
  const [audioBlocked,    setAudioBlocked]    = useState(false);
  const [remoteAudioStream, setRemoteAudioStream] = useState(null);

  const isVideo    = call?.callType === 'video';
  const callerInfo = call?.caller || call?.callee;

  useEffect(() => { callPhaseRef.current = callPhase; }, [callPhase]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  // FIX #7: cleanup does NOT depend on buildPC to avoid stale closure via
  //         pc.onconnectionstatechange capturing an old buildPC instance.
  const stopAllTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => { t.stop(); t.enabled = false; });
    localStreamRef.current = null;
    if (localVideoRef.current)  { localVideoRef.current.srcObject  = null; }
    if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = null; }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    isMountedRef.current = false;
    clearInterval(durationTimer.current);
    stopAllTracks();
    if (pcRef.current) {
      pcRef.current.onicecandidate             = null;
      pcRef.current.ontrack                    = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange    = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceQueueRef.current   = [];
    offerSentRef.current  = false;
    answerSentRef.current = false;
    offerBufferRef.current = null;
  }, [stopAllTracks]);

  // ── Attach streams to DOM elements ────────────────────────────────────────
  const attachLocalStream = useCallback((stream) => {
    if (localVideoRef.current && isVideo) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted     = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, [isVideo]);

  // FIX #6: attachRemoteStream now handles autoplay block gracefully.
  const attachRemoteStream = useCallback((stream) => {
    // Store stream for manual unblock button
    setRemoteAudioStream(stream);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.volume    = 1.0;
      remoteAudioRef.current.play()
        .then(() => {
          setAudioBlocked(false);
        })
        .catch((err) => {
          if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
            console.warn('[CallScreen] remoteAudio autoplay blocked — awaiting user gesture');
            setAudioBlocked(true);
          } else {
            console.warn('[CallScreen] remoteAudio play error:', err.message);
          }
        });
    }

    if (isVideo && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted     = true;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [isVideo]);

  // FIX #6: Manual user-gesture triggered play to unblock audio
  const handleUnblockAudio = useCallback(() => {
    if (!remoteAudioRef.current || !remoteAudioStream) return;
    remoteAudioRef.current.srcObject = remoteAudioStream;
    remoteAudioRef.current.play()
      .then(() => setAudioBlocked(false))
      .catch((err) => console.error('[CallScreen] manual play failed:', err.message));
  }, [remoteAudioStream]);

  const startTimer = useCallback(() => {
    clearInterval(durationTimer.current);
    durationTimer.current = setInterval(() => {
      if (isMountedRef.current) setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const drainIceQueue = useCallback(async (pc) => {
    const queued = [...iceQueueRef.current];
    iceQueueRef.current = [];
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
    }
  }, []);

  // ── Build PeerConnection ──────────────────────────────────────────────────
  // FIX #7: onEnd ref used inside onconnectionstatechange to avoid stale closure.
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const buildPC = useCallback(() => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302'  },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478'  },
      ],
    });

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      getSocket()?.emit('call:ice', {
        conversationId: call?.conversationId,
        targetUserId:   call?.caller?._id || call?.targetUserId || null,
        candidate:      candidate.toJSON(),
      });
    };

    pc.ontrack = ({ track, streams }) => {
      const stream = streams?.[0] ?? new MediaStream([track]);
      attachRemoteStream(stream);
    };

    pc.oniceconnectionstatechange = () => {
      if (!isMountedRef.current) return;
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        setCallPhase('active');
        startTimer();
      } else if (s === 'failed') {
        console.error('[CallScreen] ICE failed');
      }
    };

    // FIX #7: Use ref for onEnd to avoid stale closure from buildPC deps
    pc.onconnectionstatechange = () => {
      if (!isMountedRef.current) return;
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        // cleanup is stable (no buildPC dep), safe to call
        isMountedRef.current = false;
        clearInterval(durationTimer.current);
        stopAllTracks();
        pcRef.current = null;
        onEndRef.current?.();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [call, attachRemoteStream, startTimer, stopAllTracks]);

  // ── Get local media ───────────────────────────────────────────────────────
  const getMedia = useCallback(async () => {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  false,
      },
      video: isVideo
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    };

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error('[CallScreen] getUserMedia failed:', err.name, '-', err.message);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (e2) {
        console.error('[CallScreen] Fallback getUserMedia failed:', e2.message);
        return null;
      }
    }

    localStreamRef.current = stream;
    attachLocalStream(stream);
    return stream;
  }, [isVideo, attachLocalStream]);

  // ── Caller: mount → get media ─────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    if (!isIncoming) {
      getMedia().then((stream) => {
        if (!stream || !isMountedRef.current) return;
        const pc = buildPC();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        // FIX #5: If offer was buffered before PC was ready, apply it now
        if (offerBufferRef.current) {
          const buffered = offerBufferRef.current;
          offerBufferRef.current = null;
          // Caller should not apply an offer (caller creates offer, not answer)
          // Buffer only needed on callee side — see callee effect below
        }
      });
    }
    return () => { cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Caller: call:ringing → create and send SDP offer ─────────────────────
  useEffect(() => {
    if (isIncoming) return;
    const socket = getSocket();
    if (!socket) return;

    const onRinging = async (payload) => {
      if (!isMountedRef.current || offerSentRef.current) return;
      if (callPhaseRef.current !== 'calling' && callPhaseRef.current !== 'ringing') return;

      offerSentRef.current = true;
      setCallPhase('ringing');

      const pc = pcRef.current;
      if (!pc) return;

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: isVideo,
        });
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', {
          conversationId:   call?.conversationId,
          targetUserId:     payload.from || call?.targetUserId || null,
          sdp:              pc.localDescription,
          mediaConstraints: { audio: true, video: isVideo },
        });
      } catch (err) {
        console.error('[CallScreen] createOffer failed:', err.message);
        offerSentRef.current = false;
      }
    };

    socket.on('call:ringing', onRinging);
    return () => { socket.off('call:ringing', onRinging); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIncoming]);

  // ── Caller: apply SDP answer from callee ──────────────────────────────────
  useEffect(() => {
    if (isIncoming || !peerSdpAnswer) return;
    const pc = pcRef.current;
    if (!pc || pc.signalingState !== 'have-local-offer') return;
    pc.setRemoteDescription(new RTCSessionDescription(peerSdpAnswer))
      .then(() => drainIceQueue(pc))
      .catch((e) => console.error('[CallScreen] setRemoteDescription(answer):', e.message));
  }, [peerSdpAnswer, isIncoming, drainIceQueue]);

  // ── Callee: apply SDP offer from caller ───────────────────────────────────
  // FIX #5: If PC not built yet when offer arrives, buffer the offer.
  //         The offer is applied in handleAnswer after buildPC() completes.
  useEffect(() => {
    if (!isIncoming || !peerSdpOffer) return;

    // Buffer the offer regardless — handleAnswer reads it
    offerBufferRef.current = peerSdpOffer;

    const pc = pcRef.current;
    if (!pc || answerSentRef.current || pc.remoteDescription) return;
    if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') return;

    // PC already exists — apply immediately (not waiting for handleAnswer)
    answerSentRef.current = true;
    (async () => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(peerSdpOffer));
        await drainIceQueue(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit('call:answer', {
          conversationId: call?.conversationId,
          targetUserId:   call?.caller?._id,
          sdp:            pc.localDescription,
        });
        dispatch(setActiveCall({
          conversationId:   call?.conversationId,
          callType:         call?.callType,
          messageId:        call?.messageId,
          status:           'answered',
          targetUserId:     call?.caller?._id,
          mediaConstraints: call?.mediaConstraints,
          caller:           call?.caller,
        }));
        offerBufferRef.current = null; // consumed
      } catch (err) {
        console.error('[CallScreen] createAnswer (effect) failed:', err.message);
        answerSentRef.current = false;
      }
    })();
  }, [peerSdpOffer, isIncoming, call, dispatch, drainIceQueue]);

  // ── Both sides: apply incoming ICE candidates ─────────────────────────────
  useEffect(() => {
    if (!iceCandidates.length) return;
    const latest = iceCandidates[iceCandidates.length - 1];
    if (!latest) return;
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed') return;
    if (pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(latest)).catch(() => {});
    } else {
      iceQueueRef.current.push(latest);
    }
  }, [iceCandidates]);

  // ── Callee: user taps Answer ──────────────────────────────────────────────
  // FIX #5: After buildPC, check offerBufferRef for a buffered offer and apply immediately.
  const handleAnswer = useCallback(async () => {
    if (!isMountedRef.current) return;
    setCallPhase('connecting');
    onAnswer?.();

    const stream = await getMedia();
    if (!stream || !isMountedRef.current) return;

    const pc = buildPC();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const socket = getSocket();
    socket?.emit('call:ringing', {
      conversationId: call?.conversationId,
      targetUserId:   call?.caller?._id,
    });

    // FIX #5: Use buffered offer if it arrived before PC was built
    const sdpOffer = offerBufferRef.current || peerSdpOffer;
    if (sdpOffer && !answerSentRef.current) {
      answerSentRef.current = true;
      offerBufferRef.current = null;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));
        await drainIceQueue(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('call:answer', {
          conversationId: call?.conversationId,
          targetUserId:   call?.caller?._id,
          sdp:            pc.localDescription,
        });
        dispatch(setActiveCall({
          conversationId:   call?.conversationId,
          callType:         call?.callType,
          messageId:        call?.messageId,
          status:           'answered',
          targetUserId:     call?.caller?._id,
          mediaConstraints: call?.mediaConstraints,
          caller:           call?.caller,
        }));
      } catch (err) {
        console.error('[CallScreen] handleAnswer createAnswer:', err.message);
        answerSentRef.current = false;
      }
    }
  }, [call, onAnswer, getMedia, buildPC, peerSdpOffer, drainIceQueue, dispatch]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleEnd     = useCallback(() => { cleanup(); onEnd?.();     }, [cleanup, onEnd]);
  const handleDecline = useCallback(() => { cleanup(); onDecline?.(); }, [cleanup, onDecline]);

  const handleMuteToggle = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
    getSocket()?.emit('call:media_toggle', {
      conversationId: call?.conversationId,
      kind: 'audio', enabled: track.enabled,
    });
  }, [call]);

  const handleCameraToggle = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOff(!track.enabled);
    getSocket()?.emit('call:media_toggle', {
      conversationId: call?.conversationId,
      kind: 'video', enabled: track.enabled,
    });
  }, [call]);

  const showLocalVideo  = isVideo && callPhase !== 'incoming';
  const showRemoteVideo = isVideo && callPhase === 'active';
  const remoteCamOff    = isVideo && callPhase === 'active' && peerMedia?.video === false;

  const statusText = ({
    incoming:   `Incoming ${call?.callType || 'audio'} call…`,
    calling:    'Calling…',
    ringing:    'Ringing…',
    connecting: 'Connecting…',
    active:     formatSeconds(duration),
  })[callPhase] ?? formatSeconds(duration);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9990] flex flex-col"
      style={{ background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' }}
      role="dialog" aria-modal="true"
      aria-label={`${call?.callType || 'audio'} call`}
    >
      {/* Dedicated audio element — ONLY place remote audio plays */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />

      {/* FIX #6: Audio unblock button — visible when autoplay is blocked */}
      {audioBlocked && (
        <div className="absolute top-4 left-0 right-0 flex justify-center z-30">
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleUnblockAudio}
            className="flex items-center gap-2 text-white text-sm px-4 py-2 rounded-full shadow-xl"
            style={{ background: 'rgba(239,68,68,0.85)' }}
            aria-label="Tap to enable audio"
          >
            <VolumeX size={16} />
            Tap to enable audio
          </motion.button>
        </div>
      )}

      {isVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: showRemoteVideo && !remoteCamOff ? 1 : 0, transition: 'opacity 0.5s' }}
        />
      )}

      {remoteCamOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <motion.div
            initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            className="w-28 h-28 rounded-full overflow-hidden mb-4 shadow-2xl border-4"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            {callerInfo?.avatar
              ? <img src={callerInfo.avatar} alt={callerInfo.name || 'Caller'} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: 'var(--primary)' }}>👤</div>
            }
          </motion.div>
          <p className="text-white text-lg font-semibold">{callerInfo?.name || 'Unknown'}</p>
          <p className="text-gray-400 text-sm mt-1">Camera off</p>
        </div>
      )}

      {peerDisconnected && (
        <div className="absolute top-16 left-0 right-0 flex justify-center z-30">
          <span
            className="text-white text-sm px-4 py-2 rounded-full"
            style={{ background: 'rgba(239,68,68,0.7)' }}
          >
            ⚠️ {peerDisconnected.userName || 'Peer'} disconnected — reconnecting…
          </span>
        </div>
      )}

      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-white z-10 transition-opacity duration-500
          ${isVideo && callPhase === 'active' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <motion.div
          initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="w-28 h-28 rounded-full overflow-hidden mb-6 shadow-2xl border-4"
          style={{ borderColor: 'rgba(255,255,255,0.2)' }}
        >
          {callerInfo?.avatar
            ? <img src={callerInfo.avatar} alt={callerInfo.name || 'Caller'} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: 'var(--primary)' }}>👤</div>
          }
        </motion.div>
        <h2 className="text-2xl font-bold mb-1">{callerInfo?.name || 'Unknown'}</h2>
        {callerInfo?.role && (
          <p className="text-gray-400 text-xs mb-1">{getRoleLabel(callerInfo.role)}</p>
        )}
        <p className="text-gray-300 text-base">{statusText}</p>

        {['calling', 'ringing', 'connecting'].includes(callPhase) && (
          <div className="flex gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-white rounded-full"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}

        {!isVideo && callPhase === 'active' && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="text-white text-3xl font-mono font-bold tracking-widest">
              {formatSeconds(duration)}
            </p>
            {peerMedia && !peerMedia.audio && (
              <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.3)' }}>
                🔇 Other person is muted
              </span>
            )}
            {/* FIX #6: Show audio state indicator in audio-only mode too */}
            {audioBlocked && (
              <motion.button
                onClick={handleUnblockAudio}
                className="flex items-center gap-2 text-white text-xs px-3 py-1.5 rounded-full mt-1"
                style={{ background: 'rgba(239,68,68,0.5)' }}
              >
                <VolumeX size={13} /> Tap to hear audio
              </motion.button>
            )}
          </div>
        )}

        {isVideo && callPhase === 'active' && peerMedia && (
          <div className="flex gap-3 mt-3">
            {!peerMedia.audio && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.3)' }}>
                🔇 Muted
              </span>
            )}
            {!peerMedia.video && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.3)' }}>
                📷 Cam off
              </span>
            )}
          </div>
        )}
      </div>

      {isVideo && callPhase === 'active' && (
        <div className="absolute top-4 left-0 right-0 flex justify-center z-20">
          <span
            className="text-white text-sm px-3 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            {formatSeconds(duration)}
          </span>
        </div>
      )}

      {showLocalVideo && (
        <div
          className="absolute bottom-28 right-4 w-28 h-20 rounded-xl overflow-hidden border-2 shadow-xl z-20 flex items-center justify-center"
          style={{ borderColor: 'rgba(255,255,255,0.3)', background: '#111827' }}
        >
          {camOff ? (
            <img
              src={callerInfo?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=local'}
              alt="You (camera off)"
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}
        </div>
      )}

      {!isVideo && (
        <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      )}

      <div
        className="absolute bottom-0 left-0 right-0 pb-10 pt-6 z-20 flex items-center justify-center gap-8"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
      >
        {callPhase === 'incoming' ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }} onClick={handleDecline}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ background: 'var(--error)' }} aria-label="Decline call"
              >
                <PhoneOff size={22} className="text-white" />
              </motion.button>
              <span className="text-white text-xs">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }} onClick={handleAnswer}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ background: 'var(--success)' }} aria-label="Answer call"
              >
                <Phone size={22} className="text-white" />
              </motion.button>
              <span className="text-white text-xs">Answer</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }} onClick={handleMuteToggle}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors"
                style={{ background: muted ? 'var(--error)' : 'rgba(255,255,255,0.2)' }}
                aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={muted}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </motion.button>
              <span className="text-white text-xs">{muted ? 'Unmute' : 'Mute'}</span>
            </div>

            {isVideo && (
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }} onClick={handleCameraToggle}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors"
                  style={{ background: camOff ? 'var(--error)' : 'rgba(255,255,255,0.2)' }}
                  aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}
                  aria-pressed={camOff}
                >
                  {camOff ? <Video size={18} /> : <VideoOff size={18} />}
                </motion.button>
                <span className="text-white text-xs">{camOff ? 'Cam On' : 'Cam Off'}</span>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }} onClick={handleEnd}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ background: 'var(--error)' }} aria-label="End call"
              >
                <PhoneOff size={22} className="text-white" />
              </motion.button>
              <span className="text-white text-xs">End</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
});
CallScreen.displayName = 'CallScreen';

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
export const MessageBubble = memo(({
  message, isMine, onReact, onReply, onDelete, onEdit, onPin, onForward, onMarkRead,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojis,  setShowEmojis]  = useState(false);
  const isDeleted = message.isDeleted;

  const reactionSummary = useMemo(() => {
    const map = {};
    (message.reactions || []).forEach((r) => { map[r.emoji] = (map[r.emoji] || 0) + 1; });
    return Object.entries(map);
  }, [message.reactions]);

  const renderContent = useCallback(() => {
    if (isDeleted) {
      return (
        <span className="italic text-sm flex items-center gap-1.5 opacity-60">
          <AlertCircle size={13} /> This message was deleted
        </span>
      );
    }
    switch (message.type) {
      case 'image':
        return (
          <>
            {(message.attachments || []).map((a, i) => (
              <ImageMessage key={i} url={a.url} caption={i === 0 ? message.content : ''} />
            ))}
          </>
        );
      case 'video':
        return (
          <>
            {(message.attachments || []).map((a, i) => (
              <VideoPlayer key={i} url={a.url} thumbnailUrl={a.thumbnailUrl} />
            ))}
            {message.content && <p className="text-sm mt-1 break-words">{message.content}</p>}
          </>
        );
      case 'audio':
        return (
          <>
            {(message.attachments || []).map((a, i) => <AudioPlayer key={i} url={a.url} />)}
          </>
        );
      case 'file':
        return (
          <>
            {(message.attachments || []).map((a, i) => <FileAttachment key={i} attachment={a} />)}
            {message.content && <p className="text-sm mt-1 break-words">{message.content}</p>}
          </>
        );
      case 'sticker':
        return <StickerMessage message={message} />;
      case 'location':
        return (
          <a
            href={`https://maps.google.com/?q=${message.location?.latitude},${message.location?.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline underline-offset-2"
          >
            📍 {message.location?.address || `${message.location?.latitude}, ${message.location?.longitude}`}
          </a>
        );
      case 'contact':
        return (
          <div className="flex items-center gap-2 text-sm">
            👤 <span className="font-medium">{message.contact?.name || 'Contact'}</span>
            {message.contact?.phone && <span className="opacity-70">{message.contact.phone}</span>}
          </div>
        );
      case 'call':
        return (
          <span className="text-sm flex items-center gap-1.5">
            {message.call?.callType === 'video' ? '🎥' : '📞'}
            <span>{message.content}</span>
            {message.call?.status === 'missed'   && <span className="text-red-300 text-xs">(Missed)</span>}
            {message.call?.status === 'declined' && <span className="text-red-300 text-xs">(Declined)</span>}
            {message.call?.duration > 0 && (
              <span className="text-xs opacity-70">· {formatSeconds(message.call.duration)}</span>
            )}
          </span>
        );
      case 'system':
        return null;
      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        );
    }
  }, [message, isDeleted]);

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3 px-4" aria-live="polite">
        <span
          className="text-[11px] px-3 py-1 rounded-full"
          style={{ background: 'var(--base-200)', color: 'var(--base-content)', opacity: 0.7 }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  const bubbleStyle = isMine
    ? {
        background:   'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 80%, var(--secondary)))',
        color:        'var(--primary-content)',
        borderRadius: '18px 18px 4px 18px',
      }
    : {
        background:   'var(--base-100)',
        color:        'var(--base-content)',
        borderRadius: '18px 18px 18px 4px',
        border:       '1px solid var(--base-300)',
        boxShadow:    '0 1px 3px rgba(0,0,0,0.06)',
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 group items-end gap-1.5`}
      aria-label={isMine ? 'Your message' : `Message from ${message.sender?.name}`}
    >
      {!isMine && (
        <img
          src={getUserAvatar(message.sender)}
          alt={message.sender?.name || ''}
          className="w-7 h-7 rounded-full object-cover shrink-0 self-end mb-0.5"
        />
      )}

      <div className={`max-w-[72%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {message.replyTo && (
          <div
            className="text-xs px-2.5 py-1.5 mb-1 rounded-xl max-w-full border-l-2"
            style={{
              borderLeftColor: 'var(--primary)',
              background: isMine ? 'rgba(255,255,255,0.2)' : 'var(--base-200)',
              color: isMine ? 'rgba(255,255,255,0.8)' : 'var(--base-content)',
              opacity: 0.9,
            }}
          >
            <span className="font-semibold block text-[10px] mb-0.5" style={{ color: 'var(--primary)' }}>
              Reply
            </span>
            <span className="truncate block">
              {message.replyTo.content || `[${message.replyTo.type}]`}
            </span>
          </div>
        )}
        {message.forwardedFrom?.messageId && (
          <div className="text-[10px] opacity-50 mb-0.5">↪ Forwarded</div>
        )}

        <div
          className="relative px-3.5 py-2.5"
          style={bubbleStyle}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => { setShowActions(false); setShowEmojis(false); }}
        >
          {!isMine && message.sender?.name && (
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--primary)' }}>
                {message.sender.name}
              </p>
              {message.sender?.role && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                    color: 'var(--primary)',
                  }}
                >
                  {getRoleLabel(message.sender.role)}
                </span>
              )}
            </div>
          )}

          {renderContent()}

          {reactionSummary.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1.5">
              {reactionSummary.map(([emoji, count]) => (
                <motion.button
                  key={emoji}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onReact(message._id, emoji)}
                  className="text-xs rounded-full px-1.5 py-0.5"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                  aria-label={`React ${emoji} (${count})`}
                >
                  {emoji} {count}
                </motion.button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {message.isPinned && <Pin size={9} className="opacity-60" />}
            <span className="text-[10px] opacity-55 leading-none">{formatTime(message.createdAt)}</span>
            {message.isEdited && <span className="text-[10px] opacity-45">edited</span>}
            {isMine && !isDeleted && (
              <span className="opacity-80 leading-none">
                <ReadReceipt message={message} isMine={true} />
              </span>
            )}
          </div>

          <AnimatePresence>
            {showActions && !isDeleted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.1 }}
                className={`absolute top-1/2 -translate-y-1/2 z-20 flex items-center rounded-full px-1.5 py-1 gap-0.5 shadow-xl
                  ${isMine ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'}`}
                style={{ background: 'var(--base-100)', border: '1px solid var(--base-300)' }}
                role="toolbar"
                aria-label="Message actions"
              >
                {showEmojis
                  ? QUICK_REACTIONS.map((e) => (
                      <motion.button
                        key={e}
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-base px-0.5"
                        onClick={() => { onReact(message._id, e); setShowEmojis(false); }}
                        aria-label={`React ${e}`}
                      >
                        {e}
                      </motion.button>
                    ))
                  : (
                    <button
                      className="p-1 rounded-full"
                      style={{ color: 'var(--base-content)', opacity: 0.6 }}
                      onClick={() => setShowEmojis(true)}
                      aria-label="Add reaction"
                    >
                      <Smile size={14} />
                    </button>
                  )
                }
                <button
                  className="p-1 rounded-full"
                  style={{ color: 'var(--base-content)', opacity: 0.6 }}
                  onClick={() => onReply(message)}
                  aria-label="Reply"
                >
                  <Reply size={14} />
                </button>
                <button
                  className="p-1 rounded-full"
                  style={{ color: 'var(--base-content)', opacity: 0.6 }}
                  onClick={() => onForward?.(message)}
                  aria-label="Forward"
                >
                  <Forward size={14} />
                </button>
                {!isMine && (
                  <button
                    className="p-1 rounded-full"
                    style={{ color: 'var(--base-content)', opacity: 0.6 }}
                    onClick={() => onMarkRead?.(message._id)}
                    aria-label="Mark as read"
                  >
                    <Eye size={14} />
                  </button>
                )}
                {isMine && message.type === 'text' && (
                  <button
                    className="p-1 rounded-full"
                    style={{ color: 'var(--base-content)', opacity: 0.6 }}
                    onClick={() => onEdit(message)}
                    aria-label="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
                <button
                  className="p-1 rounded-full"
                  style={{ color: 'var(--base-content)', opacity: 0.6 }}
                  onClick={() => onPin(message._id, !message.isPinned)}
                  aria-label={message.isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={14} />
                </button>
                {isMine && (
                  <button
                    className="p-1 rounded-full"
                    style={{ color: 'var(--error)', opacity: 0.7 }}
                    onClick={() => onDelete(message._id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ─── CONVERSATION ITEM ────────────────────────────────────────────────────────
export const ConversationItem = memo(({ conv, isActive, onClick, currentUserId }) => {
  const other = useMemo(() => {
    if (conv.type !== 'direct') return null;
    return conv.participants?.find(
      (p) => (p.user?._id || p.user)?.toString() !== currentUserId?.toString() && p.isActive
    );
  }, [conv, currentUserId]);

  const otherUserId = other?.user?._id || other?.user;
  const unreadCount = useSelector((state) => state.chat.unreadCounts?.[conv._id] || 0);

  const preview = useMemo(() => {
    const lm = conv.lastMessage;
    if (!lm?.type && !lm?.content) return 'No messages yet';
    switch (lm.type) {
      case 'image':    return '📷 Photo';
      case 'video':    return '🎥 Video';
      case 'audio':    return '🎤 Voice message';
      case 'sticker':  return '🎭 Sticker';
      case 'file':     return '📄 File';
      case 'call':     return lm.content || '📞 Call';
      case 'location': return '📍 Location';
      default:         return lm.content || '';
    }
  }, [conv.lastMessage]);

  const displayName   = conv.type === 'direct'
    ? (other?.user?.name || 'Unknown')
    : (conv.name || 'Group');
  const displayAvatar = conv.type === 'direct'
    ? getUserAvatar(other?.user)
    : (conv.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv._id}&backgroundColor=b6e3f4`);
  const otherRole = other?.user?.role;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors relative"
      style={{
        background:   isActive ? 'color-mix(in oklch, var(--primary) 8%, var(--base-100))' : 'transparent',
        borderRight:  isActive ? '3px solid var(--primary)' : '3px solid transparent',
      }}
      role="button"
      aria-label={`Conversation with ${displayName}`}
      aria-selected={isActive}
    >
      <div className="relative shrink-0">
        <img src={displayAvatar} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
        {conv.type === 'direct' && otherUserId && (
          <PresenceDot userId={otherUserId?.toString()} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4
              className="font-semibold text-sm truncate"
              style={{ color: isActive ? 'var(--primary)' : 'var(--base-content)' }}
            >
              {displayName}
            </h4>
            {conv.type === 'direct' && otherRole && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                style={{
                  background: isActive
                    ? 'color-mix(in oklch, var(--primary) 20%, transparent)'
                    : 'var(--base-200)',
                  color:   isActive ? 'var(--primary)' : 'var(--base-content)',
                  opacity: 0.8,
                }}
              >
                {getRoleLabel(otherRole)}
              </span>
            )}
          </div>
          <span
            className="text-[10px] shrink-0 ml-2"
            style={{ color: 'var(--base-content)', opacity: 0.45 }}
          >
            {formatTime(conv.lastMessage?.sentAt || conv.updatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs truncate flex-1" style={{ color: 'var(--base-content)', opacity: 0.55 }}>
            {preview}
          </p>
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="ml-2 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0"
                style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});
ConversationItem.displayName = 'ConversationItem';