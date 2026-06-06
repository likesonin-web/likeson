'use client';

import React, { useEffect, useState, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Video, User, CheckCircle2, AlertCircle, Mic, MicOff, VideoOff } from 'lucide-react';
import { useConsultation } from '@/context/ConsultationProvider';
import { useAgora } from '@/context/AgoraProvider';
import {
  enterWaitingRoom,
  leaveWaitingRoom,
  selectWaitingRoom,
} from '@/store/slices/consultationSlice';
import { useDispatch, useSelector } from 'react-redux';
import {
  socketEnterWaiting,
  socketLeaveWaiting,
} from '@/services/consultationSocketService';

// ── Checklist item ────────────────────────────────────────────────────────────

const CheckItem = memo(({ label, status }) => {
  const icon =
    status === 'ok' ? (
      <CheckCircle2 size={15} className="text-success shrink-0" />
    ) : status === 'checking' ? (
      <span className="loading loading-xs loading-spinner text-primary shrink-0" />
    ) : (
      <AlertCircle size={15} className="text-warning shrink-0" />
    );

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-base-300 last:border-0">
      {icon}
      <span className="text-sm font-medium text-base-content/80">{label}</span>
    </div>
  );
});
CheckItem.displayName = 'CheckItem';

// ── Waiting Room ──────────────────────────────────────────────────────────────

const WaitingRoom = memo(({ onReady }) => {
  const dispatch = useDispatch();
  const { consultationId, consultation, userRole, handleJoin } = useConsultation();
  useAgora();
  const waitingRoom = useSelector(selectWaitingRoom);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const [checks, setChecks] = useState({
    camera:      'checking',
    microphone:  'checking',
    network:     'checking',
  });
  const [elapsedSec,   setElapsedSec]   = useState(0);
  const [hasEntered,   setHasEntered]   = useState(false);
  const [joining,      setJoining]      = useState(false);

  // Device state
  const [videoDevices,  setVideoDevices]  = useState([]);
  const [audioDevices,  setAudioDevices]  = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('');
  const [isMicPreviewOn, setIsMicPreviewOn] = useState(true);
  const [isCamPreviewOn, setIsCamPreviewOn] = useState(true);

  // ── Preview stream helper ──────────────────────────────────────────────
  const startPreview = async (videoId = '', audioId = '', camOn = true, micOn = true) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    try {
      const videoConstraint = !camOn
        ? false
        : videoId
        ? { deviceId: { exact: videoId } }
        : true;

      const audioConstraint = !micOn
        ? false
        : audioId
        ? { deviceId: { exact: audioId } }
        : true;

      if (!videoConstraint && !audioConstraint) return null;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint,
      });

      streamRef.current = stream;

      if (videoRef.current && camOn) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      return stream;
    } catch {
      return null;
    }
  };

  // ── Initial checks + enumerate devices ───────────────────────────────
  useEffect(() => {
    const runChecks = async () => {
      // Camera presence check
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        setChecks(p => ({ ...p, camera: hasCamera ? 'ok' : 'warn' }));
      } catch {
        setChecks(p => ({ ...p, camera: 'warn' }));
      }

      // Mic + camera preview (triggers permission prompt → real device labels)
      try {
        const stream = await startPreview('', '', true, true);
        if (stream) {
          setChecks(p => ({ ...p, microphone: 'ok', camera: 'ok' }));
          // Re-enumerate after permission granted to get real labels
          const devices = await navigator.mediaDevices.enumerateDevices();
          const vids = devices.filter(d => d.kind === 'videoinput');
          const aids = devices.filter(d => d.kind === 'audioinput');
          setVideoDevices(vids);
          setAudioDevices(aids);
          if (vids.length) setSelectedVideo(vids[0].deviceId);
          if (aids.length) setSelectedAudio(aids[0].deviceId);
        } else {
          setChecks(p => ({ ...p, microphone: 'warn', camera: 'warn' }));
        }
      } catch {
        setChecks(p => ({ ...p, microphone: 'warn' }));
      }

      // Network ping
      try {
        const start = performance.now();
        await fetch('/api/ping', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
        const ms = performance.now() - start;
        setChecks(p => ({ ...p, network: ms < 500 ? 'ok' : 'warn' }));
      } catch {
        setChecks(p => ({ ...p, network: 'warn' }));
      }
    };

    runChecks();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Device swap handlers ──────────────────────────────────────────────
  const handleVideoDeviceChange = async (e) => {
    const id = e.target.value;
    setSelectedVideo(id);
    await startPreview(id, selectedAudio, isCamPreviewOn, isMicPreviewOn);
  };

  const handleAudioDeviceChange = async (e) => {
    const id = e.target.value;
    setSelectedAudio(id);
    await startPreview(selectedVideo, id, isCamPreviewOn, isMicPreviewOn);
  };

  const toggleCamPreview = async () => {
    const next = !isCamPreviewOn;
    setIsCamPreviewOn(next);
    if (!next && videoRef.current) videoRef.current.srcObject = null;
    await startPreview(selectedVideo, selectedAudio, next, isMicPreviewOn);
  };

  const toggleMicPreview = async () => {
    const next = !isMicPreviewOn;
    setIsMicPreviewOn(next);
    await startPreview(selectedVideo, selectedAudio, isCamPreviewOn, next);
  };

  // ── Waiting room socket (patient only) ────────────────────────────────
  useEffect(() => {
    if (userRole !== 'patient' || hasEntered) return;
    dispatch(enterWaitingRoom(consultationId));
    socketEnterWaiting(consultationId);
    setHasEntered(true);
    return () => {
      dispatch(leaveWaitingRoom(consultationId));
      socketLeaveWaiting(consultationId);
    };
  }, [consultationId, userRole, hasEntered, dispatch]);

  // ── Elapsed timer ─────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setElapsedSec(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const allChecksOk = Object.values(checks).every(v => v === 'ok');

  // ── Join handler ──────────────────────────────────────────────────────
  const handleJoinNow = async () => {
    setJoining(true);
    try {
      // Stop preview tracks — Agora will open its own
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;

      await handleJoin({ platform: 'web', browser: navigator.userAgent });
      onReady?.();
    } catch {
      setJoining(false);
    }
  };

  const scheduledDate = consultation?.scheduledAt
    ? new Date(consultation.scheduledAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  const hasDevices = videoDevices.length > 0 || audioDevices.length > 0;

  return (
    <div className="flex items-start justify-center w-full h-full min-h-screen bg-base-200 p-4 font-poppins overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card max-w-md w-full bg-base-100 p-6 sm:p-8 my-4"
      >
        {/* ── Header ── */}
        <div className="flex flex-col items-center text-center mb-5">
          <div
            className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 relative"
            aria-hidden="true"
          >
            <Video size={26} className="text-primary z-10" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping opacity-75" />
          </div>
          <h1 className="text-xl font-black font-montserrat text-base-content tracking-tight mb-1">
            {userRole === 'doctor' ? 'Ready to Start Session?' : 'Waiting Room'}
          </h1>
          <p className="text-sm font-medium text-base-content/60">
            {userRole === 'doctor'
              ? 'Check your devices, then start the session.'
              : 'Please wait. The doctor will admit you shortly.'}
          </p>
        </div>

        {/* ── Camera preview ── */}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-3 border border-base-300">
          {isCamPreviewOn ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-base-300/30">
              <VideoOff size={32} className="text-base-content/30 mb-2" />
              <p className="text-xs text-base-content/50 font-medium">Camera is off</p>
            </div>
          )}

          {/* Cam / Mic quick toggles overlay */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <button
              className={`btn btn-circle btn-xs shadow-lg border ${
                isCamPreviewOn
                  ? 'bg-base-100/80 text-base-content border-base-300'
                  : 'bg-error/90 text-white border-error'
              }`}
              onClick={toggleCamPreview}
              title={isCamPreviewOn ? 'Turn camera off' : 'Turn camera on'}
              aria-label={isCamPreviewOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {isCamPreviewOn ? <Video size={12} /> : <VideoOff size={12} />}
            </button>
            <button
              className={`btn btn-circle btn-xs shadow-lg border ${
                isMicPreviewOn
                  ? 'bg-base-100/80 text-base-content border-base-300'
                  : 'bg-error/90 text-white border-error'
              }`}
              onClick={toggleMicPreview}
              title={isMicPreviewOn ? 'Mute microphone' : 'Unmute microphone'}
              aria-label={isMicPreviewOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isMicPreviewOn ? <Mic size={12} /> : <MicOff size={12} />}
            </button>
          </div>
        </div>

        {/* ── Device selectors ── */}
        {hasDevices && (
          <div className="flex flex-col gap-2.5 mb-5">
            {videoDevices.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-base-content/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Video size={11} /> Camera
                </label>
                <select
                  className="input-field cursor-pointer text-sm"
                  value={selectedVideo}
                  onChange={handleVideoDeviceChange}
                  aria-label="Select camera"
                >
                  {videoDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 10)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {audioDevices.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-base-content/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic size={11} /> Microphone
                </label>
                <select
                  className="input-field cursor-pointer text-sm"
                  value={selectedAudio}
                  onChange={handleAudioDeviceChange}
                  aria-label="Select microphone"
                >
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.slice(0, 10)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Session info ── */}
        <div className="grid grid-cols-2 gap-3 bg-base-200/50 p-3 rounded-xl border border-base-300 mb-5">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock size={11} /> Scheduled
            </span>
            <span className="text-sm font-semibold text-base-content">{scheduledDate}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Video size={11} /> Type
            </span>
            <span className="text-sm font-semibold text-base-content capitalize">
              {consultation?.consultationType ?? 'Video'}
            </span>
          </div>

          {userRole === 'patient' && (
            <>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User size={11} /> Doctor
                </span>
                <span className="text-sm font-semibold text-base-content">
                  {consultation?.doctorSnapshot?.name ?? '—'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock size={11} /> Wait time
                </span>
                <span className="text-sm font-semibold font-mono text-base-content">
                  {formatTime(elapsedSec)}
                </span>
              </div>
            </>
          )}

          {userRole === 'doctor' && (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User size={11} /> Patient
              </span>
              <span className="text-sm font-semibold text-base-content">
                {consultation?.patientSnapshot?.name ?? '—'}
              </span>
            </div>
          )}
        </div>

        {/* ── Device checks ── */}
        <div className="mb-5">
          <p className="text-xs font-bold text-base-content/80 uppercase tracking-wider mb-2">
            Device Check
          </p>
          <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-1">
            <CheckItem label="Camera"              status={checks.camera}     />
            <CheckItem label="Microphone"          status={checks.microphone} />
            <CheckItem label="Internet Connection" status={checks.network}    />
          </div>
        </div>

        {/* ── Patient in waiting room indicator (doctor only) ── */}
        {userRole === 'doctor' && waitingRoom.patientEnteredAt && (
          <div className="flex items-center justify-center gap-2 bg-success/10 text-success p-3 rounded-xl mb-5 text-sm font-bold border border-success/20">
            <CheckCircle2 size={16} />
            <span>Patient is in the waiting room</span>
          </div>
        )}

        {/* ── CTA ── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: allChecksOk ? 1.02 : 1 }}
          className="btn w-full gap-2 shadow-md text-sm font-bold py-3 uppercase tracking-wider"
          style={{
            backgroundColor: allChecksOk ? 'var(--primary)' : 'var(--base-300)',
            color: allChecksOk ? 'var(--primary-content)' : 'var(--base-content)',
            opacity: allChecksOk && !joining ? 1 : 0.6,
          }}
          onClick={handleJoinNow}
          disabled={!allChecksOk || joining}
          aria-label={userRole === 'doctor' ? 'Start session' : 'Join session'}
        >
          {joining ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <Video size={18} />
          )}
          {joining
            ? 'Connecting…'
            : userRole === 'doctor'
            ? 'Start Session'
            : 'Join Now'}
        </motion.button>

        {!allChecksOk && (
          <p className="text-xs text-center text-warning font-semibold mt-3 flex items-center justify-center gap-1.5">
            <AlertCircle size={13} /> Please resolve device issues before joining.
          </p>
        )}
      </motion.div>
    </div>
  );
});
WaitingRoom.displayName = 'WaitingRoom';

export default WaitingRoom;