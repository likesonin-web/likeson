'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, AlertCircle, RotateCcw } from 'lucide-react';
import Avatar from './Avatar';
import { useAgoraCall } from '@/hooks/useAgoraCall';
import { formatDuration } from '@/lib/chatHelpers';

/**
 * Full-screen active call modal.
 * `call` shape: { callId, channelName, token, uid, appId, type, conversationId, expiresAt }
 */
export default function CallModal({ call, conversation, currentUser, onEnd, onMuteStateChange, onRenewToken }) {
  const agora = useAgoraCall();
  const [duration, setDuration] = useState(0);
  const [joinError, setJoinError] = useState(null);
  const remoteVideoRefs = useRef({});
  const localVideoRef = useRef(null);
  const joinedRef = useRef(false);

  // Join Agora channel once when call becomes active
  useEffect(() => {
    if (!call || joinedRef.current) return;
    if (!call.appId || !call.channelName || !call.token) return;

    joinedRef.current = true;
    setJoinError(null);
    agora
      .join({
        appId: call.appId,
        channelName: call.channelName,
        token: call.token,
        uid: call.uid,
        type: call.type,
      })
      .catch((err) => {
        setJoinError(err?.message || 'Failed to connect to call');
        joinedRef.current = false;
      });

    return () => {
      joinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.callId]);

  // Duration counter once joined
  useEffect(() => {
    if (!agora.joined) return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [agora.joined]);

  // Token renewal before expiry
  useEffect(() => {
    if (!call?.expiresAt || !call?.callId) return;
    const msUntilRenew = new Date(call.expiresAt).getTime() - Date.now() - 60_000;
    if (msUntilRenew <= 0) return;
    const t = setTimeout(() => onRenewToken?.(call.callId), msUntilRenew);
    return () => clearTimeout(t);
  }, [call?.expiresAt, call?.callId, onRenewToken]);

  // Local video preview
  useEffect(() => {
    if (call?.type === 'video' && agora.joined && localVideoRef.current) {
      agora.playLocalVideo(localVideoRef.current);
    }
  }, [agora.joined, call?.type, agora]);

  // Remote video tracks
  useEffect(() => {
    Object.entries(agora.remoteUsers).forEach(([uid, user]) => {
      const el = remoteVideoRefs.current[uid];
      if (user.hasVideo && user.videoTrack && el) user.videoTrack.play(el);
    });
  }, [agora.remoteUsers]);

  const handleMute = useCallback(() => {
    const next = agora.toggleMute();
    onMuteStateChange?.(call.callId, next, agora.isCamOff);
  }, [agora, call?.callId, onMuteStateChange]);

  const handleCam = useCallback(async () => {
    const next = await agora.toggleCam();
    onMuteStateChange?.(call.callId, agora.isMuted, next);
  }, [agora, call?.callId, onMuteStateChange]);

  const handleEnd = useCallback(async () => {
    await agora.leave();
    onEnd?.(call.callId);
  }, [agora, call?.callId, onEnd]);

  const handleRetry = useCallback(() => {
    joinedRef.current = false;
    setJoinError(null);
    agora.join({
      appId: call.appId,
      channelName: call.channelName,
      token: call.token,
      uid: call.uid,
      type: call.type,
    })
      .then(() => { joinedRef.current = true; })
      .catch((err) => setJoinError(err?.message || 'Retry failed'));
  }, [agora, call]);

  if (!call || typeof document === 'undefined') return null;

  const remoteList = Object.values(agora.remoteUsers);
  const otherParticipant = conversation?.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() !== currentUser?._id?.toString(),
  )?.user;

  const callStatus = agora.connecting
    ? 'Connecting…'
    : agora.joined
      ? formatDuration(duration)
      : joinError
        ? 'Connection failed'
        : 'Calling…';

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-neutral flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 text-neutral-content">
        <div>
          <p className="font-bold truncate max-w-[200px]">
            {conversation?.name || otherParticipant?.name || 'Call'}
          </p>
          <p className="text-xs opacity-70">{callStatus}</p>
        </div>
        {conversation?.type === 'group' && (
          <span className="flex items-center gap-1 text-xs opacity-80">
            <Users className="w-3.5 h-3.5" /> {remoteList.length + 1}
          </span>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 relative px-4 pb-4 overflow-hidden">
        {/* Error state */}
        {joinError && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-neutral-content">
            <AlertCircle className="w-10 h-10 text-error" />
            <p className="text-sm text-center opacity-80">{joinError}</p>
            <button type="button" onClick={handleRetry} className="btn btn-sm btn-outline border-neutral-content/40 text-neutral-content flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {!joinError && call.type === 'video' ? (
          <div className={`h-full grid gap-2 ${remoteList.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {remoteList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 text-neutral-content">
                <Avatar src={otherParticipant?.avatar} name={otherParticipant?.name} size="xl" />
                <p className="text-sm opacity-70">Waiting for others to join…</p>
              </div>
            ) : (
              remoteList.map((user) => (
                <div key={user.uid} className="relative bg-black/40 rounded-box overflow-hidden">
                  <div
                    ref={(el) => { remoteVideoRefs.current[user.uid] = el; }}
                    className="w-full h-full"
                  />
                  {!user.hasVideo && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Avatar name="Guest" size="lg" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : !joinError ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className={`rounded-full p-2 ${agora.joining || agora.connecting ? 'animate-pulse ring-4 ring-primary/30' : ''}`}>
              <Avatar
                src={otherParticipant?.avatar}
                name={otherParticipant?.name || conversation?.name}
                size="xl"
              />
            </div>
            <h3 className="text-neutral-content text-xl font-bold">
              {otherParticipant?.name || conversation?.name}
            </h3>
            <p className="text-neutral-content/60 text-sm">{callStatus}</p>
          </div>
        ) : null}

        {/* Local video PiP */}
        {call.type === 'video' && !joinError && (
          <div
            ref={localVideoRef}
            className="absolute bottom-4 right-4 w-28 h-40 rounded-field overflow-hidden bg-black/50 border border-white/10 shadow-lg"
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-5 py-6 safe-bottom">
        <button
          type="button"
          onClick={handleMute}
          className={`btn btn-circle w-14 h-14 ${agora.isMuted ? 'bg-white text-neutral' : 'bg-white/15 text-neutral-content border-white/20'}`}
          aria-label={agora.isMuted ? 'Unmute' : 'Mute'}
        >
          {agora.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {call.type === 'video' && (
          <button
            type="button"
            onClick={handleCam}
            className={`btn btn-circle w-14 h-14 ${agora.isCamOff ? 'bg-white text-neutral' : 'bg-white/15 text-neutral-content border-white/20'}`}
            aria-label={agora.isCamOff ? 'Camera on' : 'Camera off'}
          >
            {agora.isCamOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        <button
          type="button"
          onClick={handleEnd}
          className="btn btn-circle btn-error w-16 h-16 shadow-lg"
          aria-label="End call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
