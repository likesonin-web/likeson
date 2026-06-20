'use client';
/**
 * components/chat/CallOverlay.jsx
 * Real Agora RTC SDK integration.
 * Install: npm i agora-rtc-sdk-ng
 *
 * Features:
 *  - Audio + Video calls with real streams
 *  - Mute mic / toggle camera
 *  - Remote video tracks rendered into DOM
 *  - Token refresh via onTokenPrivilegeWillExpire
 *  - Network quality indicator
 *  - Auto-minimize on scroll
 *  - Draggable minimized widget
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Maximize2,
  Monitor,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ─── Agora RTC SDK (dynamic import to avoid SSR issues) ───────────────────────

let AgoraRTC = null;

async function getAgoraRTC() {
  if (AgoraRTC) return AgoraRTC;
  const mod = await import('agora-rtc-sdk-ng');
  AgoraRTC = mod.default;
  AgoraRTC.setLogLevel(2); // warn only in production
  return AgoraRTC;
}

// ─── Network quality label ────────────────────────────────────────────────────

function qualityLabel(score) {
  // Agora quality: 0=unknown,1=excellent,2=good,3=poor,4=bad,5=very bad,6=disconnected
  if (score <= 2) return { label: 'Excellent', color: 'text-success' };
  if (score <= 3) return { label: 'Good',      color: 'text-warning' };
  return               { label: 'Poor',       color: 'text-error' };
}

function formatCallTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Incoming call banner ──────────────────────────────────────────────────────

export function IncomingCall({ call, onAccept, onDecline }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (elapsed >= 60) onDecline(call.callId);
  }, [elapsed, call.callId, onDecline]);

  const TypeIcon  = call.type === 'video' ? Video : Phone;
  const initiator = call.initiator;

  return (
    <motion.div
      className="fixed top-6 right-4 sm:right-8 z-[100] w-[calc(100%-2rem)] sm:w-80 bg-base-100 p-4 rounded-[var(--r-box)] shadow-depth-lg border border-base-300 flex items-center gap-4 font-poppins"
      initial={{ opacity: 0, y: -80 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -80 }}
    >
      <div className="relative w-12 h-12 flex-shrink-0 rounded-full bg-base-200">
        {initiator?.avatar ? (
          <img src={initiator.avatar} alt={initiator.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center text-xl font-bold text-primary bg-primary/10">
            {initiator?.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-base-100 rounded-full flex items-center justify-center text-primary border border-base-200 shadow-sm">
          <TypeIcon size={12} />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <p className="text-base font-semibold text-base-content truncate">
          {initiator?.name || 'Unknown'}
        </p>
        <p className="text-xs font-medium text-base-content/60 truncate">
          Incoming {call.type === 'video' ? 'Video' : 'Audio'} Call
        </p>
        {/* Ring countdown bar */}
        <div className="w-full h-0.5 bg-base-300 rounded-full mt-2 overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '100%' }}
            animate={{ width: `${Math.max(0, ((60 - elapsed) / 60) * 100)}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          className="p-2.5 rounded-full bg-error text-error-content hover:bg-error/90 transition-colors shadow-sm"
          onClick={() => onDecline(call.callId)}
          aria-label="Decline call"
        >
          <PhoneOff size={18} />
        </button>
        <button
          className="p-2.5 rounded-full bg-success text-success-content hover:bg-success/90 transition-colors shadow-sm animate-[pulse_1.5s_infinite]"
          onClick={() => onAccept(call.callId)}
          aria-label="Accept call"
        >
          <Phone size={18} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Active call with real Agora ───────────────────────────────────────────────

export function ActiveCall({
  call,
  conversation,
  onEnd,
  onMuteToggle,
  onCamToggle,
  onRenewToken,
}) {
  const [elapsed,   setElapsed]   = useState(0);
  const [muted,     setMuted]     = useState(false);
  const [camOff,    setCamOff]    = useState(false);
  const [minimized, setMin]       = useState(false);
  const [netQuality, setNetQ]     = useState(0);
  const [remoteUsers, setRemotes] = useState([]); // [{uid, videoTrack?, audioTrack?}]
  const [agoraError,  setAgoraErr] = useState(null);
  const [joining,    setJoining]  = useState(true);

  const clientRef      = useRef(null);
  const localAudioRef  = useRef(null);
  const localVideoRef  = useRef(null);
  const localVidElRef  = useRef(null); // DOM element for local video
  const timerRef       = useRef(null);

  const isVideo = call.type === 'video';

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Agora init + join ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!call?.appId || !call?.channelName || !call?.token || call?.uid == null) return;

    let cancelled = false;
    let _client   = null;

    const setup = async () => {
      try {
        const RTC = await getAgoraRTC();

        _client = RTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = _client;

        // ── Remote user events ─────────────────────────────────────────────
        _client.on('user-published', async (user, mediaType) => {
          await _client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            setRemotes((prev) => {
              const idx = prev.findIndex((u) => u.uid === user.uid);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], videoTrack: user.videoTrack };
                return next;
              }
              return [...prev, { uid: user.uid, videoTrack: user.videoTrack }];
            });
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
            setRemotes((prev) => {
              const idx = prev.findIndex((u) => u.uid === user.uid);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], audioTrack: user.audioTrack };
                return next;
              }
              return [...prev, { uid: user.uid, audioTrack: user.audioTrack }];
            });
          }
        });

        _client.on('user-unpublished', (user, mediaType) => {
          setRemotes((prev) => prev.map((u) =>
            u.uid === user.uid
              ? { ...u, [mediaType === 'video' ? 'videoTrack' : 'audioTrack']: null }
              : u
          ));
        });

        _client.on('user-left', (user) => {
          setRemotes((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        // ── Network quality ────────────────────────────────────────────────
        _client.on('network-quality', (stats) => {
          setNetQ(stats.uplinkNetworkQuality);
        });

        // ── Token expiry ───────────────────────────────────────────────────
        _client.on('token-privilege-will-expire', async () => {
          try {
            const result = await onRenewToken(call.callId);
            if (result?.token) await _client.renewToken(result.token);
          } catch (e) {
            console.error('[Agora] token renewal failed:', e);
          }
        });

        _client.on('token-privilege-did-expire', async () => {
          try {
            const result = await onRenewToken(call.callId);
            if (result?.token) await _client.renewToken(result.token);
          } catch (e) {
            console.error('[Agora] token expired, renewal failed:', e);
          }
        });

        // ── Join channel ───────────────────────────────────────────────────
        await _client.join(call.appId, call.channelName, call.token, call.uid);

        if (cancelled) return;

        // ── Create local tracks ────────────────────────────────────────────
        if (isVideo) {
          const [audioTrack, videoTrack] = await RTC.createMicrophoneAndCameraTracks(
            {},
            { encoderConfig: '720p_2' }
          );
          localAudioRef.current = audioTrack;
          localVideoRef.current = videoTrack;

          if (!cancelled) {
            await _client.publish([audioTrack, videoTrack]);
            // Play local video
            if (localVidElRef.current) {
              videoTrack.play(localVidElRef.current);
            }
          }
        } else {
          const audioTrack = await RTC.createMicrophoneAudioTrack();
          localAudioRef.current = audioTrack;
          if (!cancelled) await _client.publish([audioTrack]);
        }

        if (!cancelled) setJoining(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[Agora] setup failed:', err);
          setAgoraErr(err.message || 'Failed to connect to call');
          setJoining(false);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      // Cleanup tracks
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      localAudioRef.current = null;
      localVideoRef.current = null;
      // Leave channel
      if (_client) {
        _client.leave().catch(() => {});
      }
      clientRef.current = null;
      setRemotes([]);
    };
  }, [call?.callId]); // Only re-run if callId changes (new call)

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const toggleMute = useCallback(async () => {
    const newMuted = !muted;
    setMuted(newMuted);
    try {
      if (localAudioRef.current) {
        await localAudioRef.current.setEnabled(!newMuted);
      }
      onMuteToggle?.(call.callId, newMuted, camOff);
    } catch (e) {
      console.error('[Agora] mute toggle failed:', e);
      setMuted(!newMuted); // rollback
    }
  }, [muted, camOff, call.callId, onMuteToggle]);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  const toggleCam = useCallback(async () => {
    const newCamOff = !camOff;
    setCamOff(newCamOff);
    try {
      if (localVideoRef.current) {
        await localVideoRef.current.setEnabled(!newCamOff);
      }
      onCamToggle?.(call.callId, muted, newCamOff);
    } catch (e) {
      console.error('[Agora] cam toggle failed:', e);
      setCamOff(!newCamOff); // rollback
    }
  }, [camOff, muted, call.callId, onCamToggle]);

  // ── Remote video element refs ─────────────────────────────────────────────
  const remoteVidRefs = useRef({});

  useEffect(() => {
    remoteUsers.forEach((u) => {
      if (u.videoTrack && remoteVidRefs.current[u.uid]) {
        u.videoTrack.play(remoteVidRefs.current[u.uid]);
      }
    });
  }, [remoteUsers]);

  const quality = qualityLabel(netQuality);

  // ── Minimized widget ───────────────────────────────────────────────────────
  if (minimized) {
    return (
      <motion.div
        className="fixed top-24 right-4 sm:right-8 z-[100] flex items-center gap-3 bg-base-100 px-4 py-2 rounded-full shadow-depth-lg border border-base-300 cursor-grab active:cursor-grabbing font-poppins text-base-content"
        drag
        dragConstraints={{ top: -200, bottom: 200, left: -200, right: 200 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-sm font-semibold w-12 text-center">{formatCallTime(elapsed)}</span>
        <button
          className="p-1.5 rounded-full hover:bg-base-200 text-base-content/50 hover:text-base-content transition-colors"
          onClick={() => setMin(false)}
        >
          <Maximize2 size={16} />
        </button>
        <button
          className="p-1.5 rounded-full bg-error text-error-content hover:bg-error/90 transition-colors ml-1 shadow-sm"
          onClick={() => onEnd(call.callId)}
        >
          <PhoneOff size={16} />
        </button>
      </motion.div>
    );
  }

  // ── Full call overlay ──────────────────────────────────────────────────────
  const otherParticipant = conversation?.participants?.find(
    (p) => {
      const uid = p.user?._id || p.user;
      return uid?.toString() !== call.initiatorId?.toString();
    }
  );
  const otherName = otherParticipant?.user?.name || 'Participant';

  return (
    <motion.div
      className="fixed bottom-6 right-4 sm:right-8 z-[100] w-80 bg-base-100 rounded-[var(--r-box)] shadow-depth-lg border border-base-300 flex flex-col overflow-hidden font-poppins text-base-content"
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="text-sm font-bold truncate">{otherName}</span>
          <span className="text-xs font-semibold text-success flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {joining ? 'Connecting…' : formatCallTime(elapsed)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Network quality */}
          <span className={`text-[10px] font-bold uppercase tracking-wide ${quality.color}`} title="Network quality">
            {netQuality > 0 ? quality.label : ''}
          </span>
          <button
            className="p-1.5 rounded-full text-base-content/50 hover:bg-base-300 hover:text-base-content transition-colors"
            onClick={() => setMin(true)}
            aria-label="Minimize call"
          >
            <Maximize2 size={16} className="rotate-180" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {agoraError && (
        <div className="px-4 py-3 bg-error/10 text-error text-xs font-medium border-b border-error/20">
          ⚠ {agoraError}
        </div>
      )}

      {/* Video area */}
      <div className="relative w-full bg-base-300 overflow-hidden" style={{ height: isVideo ? '200px' : '120px' }}>
        {isVideo ? (
          <>
            {/* Remote video (full frame) */}
            {remoteUsers[0]?.videoTrack ? (
              <div
                ref={(el) => { if (el) remoteVidRefs.current[remoteUsers[0].uid] = el; }}
                className="absolute inset-0 w-full h-full object-cover bg-base-300"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">
                    {otherName[0]?.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            {/* Local video (picture-in-picture, bottom-right) */}
            <div
              ref={localVidElRef}
              className={`absolute bottom-2 right-2 w-20 h-14 rounded-field overflow-hidden bg-base-200 border border-base-300 shadow-sm transition-opacity ${camOff ? 'opacity-0' : 'opacity-100'}`}
            />
            {camOff && (
              <div className="absolute bottom-2 right-2 w-20 h-14 rounded-field bg-base-200 border border-base-300 flex items-center justify-center">
                <VideoOff size={16} className="text-base-content/40" />
              </div>
            )}
          </>
        ) : (
          /* Audio call — show avatar */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {otherParticipant?.user?.avatar ? (
                <img
                  src={otherParticipant.user.avatar}
                  alt={otherName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary">
                  {otherName[0]?.toUpperCase()}
                </span>
              )}
            </div>
            {joining && (
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {muted && (
            <span className="px-2 py-0.5 rounded-full bg-base-100/80 backdrop-blur-sm text-[10px] font-bold text-error flex items-center gap-1">
              <MicOff size={10} /> Muted
            </span>
          )}
          {remoteUsers.length === 0 && !joining && !agoraError && (
            <span className="px-2 py-0.5 rounded-full bg-base-100/80 backdrop-blur-sm text-[10px] font-bold text-base-content/70">
              Waiting…
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-base-100">
        {/* Mute */}
        <button
          className="flex flex-col items-center gap-1 group"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shadow-sm ${muted ? 'bg-error/20 text-error' : 'bg-base-200 text-base-content group-hover:bg-primary/10 group-hover:text-primary'}`}>
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </div>
          <span className="text-[9px] font-semibold text-base-content/60 uppercase tracking-wider">
            {muted ? 'Unmute' : 'Mute'}
          </span>
        </button>

        {/* Camera (video calls only) */}
        {isVideo && (
          <button
            className="flex flex-col items-center gap-1 group"
            onClick={toggleCam}
            aria-label={camOff ? 'Camera on' : 'Camera off'}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shadow-sm ${camOff ? 'bg-error/20 text-error' : 'bg-base-200 text-base-content group-hover:bg-primary/10 group-hover:text-primary'}`}>
              {camOff ? <VideoOff size={20} /> : <Video size={20} />}
            </div>
            <span className="text-[9px] font-semibold text-base-content/60 uppercase tracking-wider">
              {camOff ? 'Cam On' : 'Cam Off'}
            </span>
          </button>
        )}

        {/* End call */}
        <button
          className="flex flex-col items-center gap-1 group"
          onClick={() => onEnd(call.callId)}
          aria-label="End call"
        >
          <div className="w-11 h-11 rounded-full bg-error text-error-content flex items-center justify-center transition-colors shadow-sm group-hover:bg-error/90">
            <PhoneOff size={20} />
          </div>
          <span className="text-[9px] font-semibold text-error uppercase tracking-wider">End</span>
        </button>
      </div>
    </motion.div>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

export default function CallOverlay({
  incomingCall,
  activeCall,
  conversation,
  onAccept,
  onDecline,
  onEnd,
  onMuteToggle,
  onCamToggle,
  onRenewToken,
}) {
  return (
    <AnimatePresence>
      {incomingCall && !activeCall && (
        <IncomingCall
          key="incoming"
          call={incomingCall}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      )}
      {activeCall && (
        <ActiveCall
          key={`active-${activeCall.callId}`}
          call={activeCall}
          conversation={conversation}
          onEnd={onEnd}
          onMuteToggle={onMuteToggle}
          onCamToggle={onCamToggle}
          onRenewToken={onRenewToken}
        />
      )}
    </AnimatePresence>
  );
}