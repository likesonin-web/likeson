'use client';
/**
 * WaitingRoomScreen.jsx
 * Calming waiting room. Shows when doctor hasn't started yet.
 * Preparation checklist + mic/camera preview + socket-ready indicator.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Wifi, Clock,
  CheckCircle2, Circle, LogOut, RefreshCw, Shield,
} from 'lucide-react';
import { useSocket } from '@/context/SocketProvider';

const CHECKLIST = [
  { id: 'wifi',    label: 'Internet connection', icon: Wifi },
  { id: 'cam',     label: 'Camera is working',   icon: Video },
  { id: 'mic',     label: 'Microphone ready',     icon: Mic },
  { id: 'quiet',   label: 'Quiet environment',    icon: Shield },
];

// ─────────────────────────────────────────────────────────────────────────────

function AnimatedPulseRings() {
  return (
    <div className="relative flex items-center justify-center">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/20"
          style={{ width: `${i * 48 + 48}px`, height: `${i * 48 + 48}px` }}
          animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}
      <div className="relative z-10 w-16 h-16 rounded-full bg-primary/10 border-2
                      border-primary/30 flex items-center justify-center">
        <span className="text-primary font-bold text-xl">Dr</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CameraPreview() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camActive, setCamActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [camOn,     setCamOn]     = useState(true);
  const [micOn,     setMicOn]     = useState(true);
  const [audioLevel,setAudioLevel]= useState(0);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
      streamRef.current = stream;
      if (videoRef.current && camOn) {
        videoRef.current.srcObject = stream;
        setCamActive(true);
      }
      if (micOn) {
        // Audio level meter
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        setMicActive(true);

        const tick = () => {
          const buf = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
          setAudioLevel(Math.min(100, avg * 2));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch (_) {
      setCamActive(false);
      setMicActive(false);
    }
  }, [camOn, micOn]);

  useEffect(() => {
    startStream();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, [camOn, micOn]); // eslint-disable-line

  return (
    <div className="glass-card overflow-hidden flex flex-col">
      {/* Video preview */}
      <div className="relative bg-base-300 aspect-video">
        {camActive && camOn ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <VideoOff size={24} className="text-base-content/30" />
            <p className="text-xs text-base-content/40">Camera off</p>
          </div>
        )}
        {/* Mic level bar */}
        {micOn && micActive && (
          <div className="absolute bottom-2 left-2 right-2 h-1 bg-base-100/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-success rounded-full"
              animate={{ width: `${audioLevel}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-3">
        <button
          onClick={() => setCamOn((v) => !v)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${camOn ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}
          aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {camOn ? <Video size={16} /> : <VideoOff size={16} />}
        </button>
        <button
          onClick={() => setMicOn((v) => !v)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${micOn ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <span className="text-xs text-base-content/50">
          {camOn ? 'Camera on' : 'Camera off'} · {micOn ? 'Mic on' : 'Muted'}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WaitingRoomScreen({ booking, onBack }) {
  const { connected } = useSocket();
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [checklist, setChecklist] = useState(() =>
    CHECKLIST.map((c) => ({ ...c, done: false }))
  );

  // Wait timer
  useEffect(() => {
    const t = setInterval(() => setWaitSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-complete checklist items
  useEffect(() => {
    setChecklist((prev) =>
      prev.map((item) => ({
        ...item,
        done:
          item.id === 'wifi' ? navigator.onLine :
          item.id === 'quiet' ? true :
          item.done,
      }))
    );
  }, []);

  const waitMins = Math.floor(waitSeconds / 60);
  const waitSecs = waitSeconds % 60;
  const waitStr  = `${String(waitMins).padStart(2, '0')}:${String(waitSecs).padStart(2, '0')}`;

  const docName = booking?.doctorSnapshot?.name
    ? `Dr. ${booking.doctorSnapshot.name}`
    : 'Your Doctor';

  const scheduledAt = booking?.scheduledAt
    ? new Date(booking.scheduledAt).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    : null;

  return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center justify-start
                    overflow-y-auto px-4 py-8"
         data-theme="customer">

      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <AnimatedPulseRings />
          <h2 className="text-xl font-bold text-base-content mt-4 mb-1">
            {docName} will admit you shortly
          </h2>
          <p className="text-sm text-base-content/60">
            Your consultation is scheduled.
            {scheduledAt && ` Appointment at ${scheduledAt}.`}
          </p>
        </motion.div>

        {/* Wait timer + socket status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <div>
              <p className="text-xs text-base-content/50 font-medium">Waiting for</p>
              <p className="text-lg font-mono font-bold text-base-content">{waitStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-warning'}`} />
            <span className="text-xs text-base-content/50">
              {connected ? 'Connected to server' : 'Reconnecting…'}
            </span>
          </div>
        </motion.div>

        {/* Camera preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            Preview your setup
          </p>
          <CameraPreview />
        </motion.div>

        {/* Checklist */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            Preparation checklist
          </p>
          <div className="flex flex-col gap-2">
            {checklist.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all
                    ${item.done
                      ? 'bg-success/5 border border-success/20'
                      : 'bg-base-200/50 border border-base-300/50'
                    }`}
                >
                  <Icon size={14} className={item.done ? 'text-success' : 'text-base-content/40'} />
                  <span className={`text-sm flex-1 ${item.done ? 'text-base-content' : 'text-base-content/60'}`}>
                    {item.label}
                  </span>
                  {item.done
                    ? <CheckCircle2 size={14} className="text-success" />
                    : <Circle size={14} className="text-base-content/20" />
                  }
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-base-content/40 px-4"
        >
          Please keep this window open. The consultation will start automatically
          when the doctor is ready. Do not close or refresh.
        </motion.div>

        {/* Back button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <button
            onClick={onBack}
            className="btn btn-ghost w-full text-base-content/50 text-sm
                       flex items-center gap-2"
          >
            <LogOut size={14} />
            Exit waiting room
          </button>
        </motion.div>

      </div>

      <div className="h-8" />
    </div>
  );
}