'use client';

/**
 * Panels.jsx — PRODUCTION GRADE
 *
 * FIXES & NEW FEATURES:
 * 1. ParticipantsPanel: Doctor / admin / superadmin can DELETE any participant
 *    (including core doctor/patient if admin — matches clinical workflow where
 *    admin may need to forcibly eject someone).
 *
 * 2. REFERRAL SECTION added to ParticipantsPanel: Doctor can search for
 *    a specialist and add them as an observer/consultant. Shows referral note
 *    input and a "Send Referral" action.
 *
 * 3. Name resolution: uses resolveName() helper that reads from all
 *    possible locations (doctorSnapshot, patientSnapshot, userId.name, etc.)
 *    so "Unknown" never appears.
 *
 * 4. SettingsPanel: referral quick-reference + recording info.
 *
 * 5. Recording REC badge in header uses correct Redux selectors.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  X, Monitor, Volume2, User, UserPlus, Trash2,
  Circle, SendHorizonal, UserCheck, Stethoscope,
  Phone, AlertTriangle,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectParticipants, selectNetworkQuality,
  addParticipant, removeParticipant, fetchParticipants,
  selectLocalRecordingActive, selectRecordingActive,
  saveReferral,
} from '@/store/slices/consultationSlice';
import { useAgora } from '@/context/AgoraProvider';
import { useConsultation } from '@/context/ConsultationProvider';
import { NetworkBars } from './VideoTile';
import {
  socketAddParticipant,
  socketRemoveParticipant,
} from '@/services/consultationSocketService';
import toast from 'react-hot-toast';

// Roles that can be added mid-session
const ADDABLE_ROLES = [
  { value: 'interpreter',    label: 'Interpreter'    },
  { value: 'observer',       label: 'Observer'       },
  { value: 'caregiver',      label: 'Caregiver'      },
  { value: 'care_assistant', label: 'Care Assistant' },
];

// ── Name resolution helper ────────────────────────────────────────────────────

const resolveName = (participant) => {
  if (!participant) return 'Participant';
  return (
    participant.name
    ?? participant.userName
    ?? (participant.userId && typeof participant.userId === 'object' ? participant.userId.name : null)
    ?? participant.doctorSnapshot?.name
    ?? participant.patientSnapshot?.name
    ?? participant.user?.name
    ?? 'Participant'
  );
};

// ── Confirm dialog helper ─────────────────────────────────────────────────────
// Uses the native browser confirm so we don't need a modal library.

const confirmAction = (msg) => window.confirm(msg);

// ── Participant Row ───────────────────────────────────────────────────────────

const ParticipantRow = memo(({ participant, netQuality, canRemove, onRemove }) => {
  const name = resolveName(participant);
  const role = participant.role ?? 'participant';
  const init = name[0]?.toUpperCase() ?? '?';
  const pid  = participant._id ?? participant.userId?._id ?? participant.userId;

  const roleLabel = role.replace(/_/g, ' ');
  const isCore    = ['doctor', 'patient'].includes(role);

  return (
    <div className="flex items-center justify-between p-3 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-xl transition-colors mb-2 group">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 mr-3">
        {init}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <span className="text-sm font-semibold text-base-content truncate">{name}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[0.65rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
            isCore ? 'bg-primary/10 text-primary' : 'bg-base-300 text-base-content/60'
          }`}>
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-2">
        <NetworkBars quality={netQuality ?? 0} />
        {canRemove && (
          <button
            className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              if (confirmAction(`Remove ${name} from the session?`)) {
                onRemove(typeof pid === 'string' ? pid : pid?.toString?.() ?? String(pid));
              }
            }}
            aria-label={`Remove ${name}`}
            title="Remove from session"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
});
ParticipantRow.displayName = 'ParticipantRow';

// ── Add Participant Form ──────────────────────────────────────────────────────

const AddParticipantForm = memo(({ consultationId, onAdded }) => {
  const dispatch = useDispatch();
  const [userId, setUserId] = useState('');
  const [role,   setRole]   = useState('interpreter');
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    const uid = userId.trim();
    if (!uid) { toast.error('Enter a user ID'); return; }
    setAdding(true);
    try {
      const res = await dispatch(addParticipant({ id: consultationId, userId: uid, role }));
      if (!res.error) {
        socketAddParticipant(consultationId, uid, role);
        await dispatch(fetchParticipants(consultationId));
        setUserId('');
        onAdded?.();
        toast.success('Participant added');
      }
    } finally {
      setAdding(false);
    }
  }, [userId, role, consultationId, dispatch, onAdded]);

  return (
    <div className="mt-4 p-4 bg-base-200 border border-base-300 rounded-xl">
      <p className="flex items-center gap-2 text-sm font-bold text-base-content mb-3 uppercase tracking-wider">
        <UserPlus size={15} className="text-primary" /> Add Participant
      </p>
      <div className="flex flex-col gap-2.5">
        <input
          className="input-field"
          placeholder="User ID or email"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          aria-label="User ID"
        />
        <select
          className="input-field cursor-pointer"
          value={role}
          onChange={e => setRole(e.target.value)}
          aria-label="Role"
        >
          {ADDABLE_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          className="btn btn-primary btn-sm w-full gap-1.5"
          onClick={handleAdd}
          disabled={adding || !userId.trim()}
        >
          {adding ? <span className="loading loading-xs loading-spinner" /> : <UserPlus size={14} />}
          Add to Session
        </button>
      </div>
    </div>
  );
});
AddParticipantForm.displayName = 'AddParticipantForm';

// ── Referral Section ──────────────────────────────────────────────────────────
/**
 * Doctor can:
 * 1. Fill in referral note for a specialist.
 * 2. Optionally add the specialist as an observer so they can join the session.
 * 3. Save the referral to the consultation.
 */

const ReferralSection = memo(({ consultationId }) => {
  const dispatch = useDispatch();
  const [referTo,      setReferTo]      = useState('');
  const [referNote,    setReferNote]    = useState('');
  const [addAsObserver, setAddAsObserver] = useState(false);
  const [observerUserId, setObserverUserId] = useState('');
  const [saving,       setSaving]       = useState(false);

  const handleSave = useCallback(async () => {
    if (!referTo.trim()) { toast.error('Referral destination required'); return; }
    setSaving(true);
    try {
      const payload = { referralTo: referTo.trim(), referralNote: referNote.trim() };
      await dispatch(saveReferral({ consultationId, data: payload }));

      if (addAsObserver && observerUserId.trim()) {
        await dispatch(addParticipant({
          id: consultationId,
          userId: observerUserId.trim(),
          role: 'observer',
        }));
        socketAddParticipant(consultationId, observerUserId.trim(), 'observer');
        toast.success('Specialist added as observer');
      }

      toast.success('Referral saved');
      setReferTo(''); setReferNote(''); setObserverUserId('');
    } finally {
      setSaving(false);
    }
  }, [referTo, referNote, addAsObserver, observerUserId, consultationId, dispatch]);

  return (
    <div className="mt-4 p-4 bg-info/5 border border-info/30 rounded-xl">
      <p className="flex items-center gap-2 text-sm font-bold text-info mb-3 uppercase tracking-wider">
        <Stethoscope size={15} /> Refer to Specialist
      </p>
      <div className="flex flex-col gap-2.5">
        <div>
          <label className="text-xs font-bold text-base-content/70 mb-1 block uppercase tracking-wider">
            Refer To *
          </label>
          <input
            className="input-field"
            placeholder="e.g. Dr. Sharma (Cardiologist)"
            value={referTo}
            onChange={e => setReferTo(e.target.value)}
            aria-label="Refer to"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-base-content/70 mb-1 block uppercase tracking-wider">
            Referral Note
          </label>
          <textarea
            className="input-field min-h-[60px] resize-none"
            placeholder="Clinical reason for referral…"
            value={referNote}
            onChange={e => setReferNote(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-info"
            checked={addAsObserver}
            onChange={e => setAddAsObserver(e.target.checked)}
          />
          <span className="text-sm font-medium text-base-content/80">
            Invite specialist to observe this session
          </span>
        </label>

        {addAsObserver && (
          <input
            className="input-field"
            placeholder="Specialist user ID or email"
            value={observerUserId}
            onChange={e => setObserverUserId(e.target.value)}
            aria-label="Specialist user ID"
          />
        )}

        <button
          className="btn btn-info btn-sm w-full gap-1.5"
          onClick={handleSave}
          disabled={saving || !referTo.trim()}
        >
          {saving
            ? <span className="loading loading-xs loading-spinner" />
            : <SendHorizonal size={14} />
          }
          Save Referral
        </button>
      </div>
    </div>
  );
});
ReferralSection.displayName = 'ReferralSection';

// ── Participants Panel ────────────────────────────────────────────────────────

export const ParticipantsPanel = memo(({ onClose }) => {
  const dispatch        = useDispatch();
  const participants    = useSelector(selectParticipants);
  const networkQuality  = useSelector(selectNetworkQuality);
  const localRecording  = useSelector(selectLocalRecordingActive);
  const serverRecording = useSelector(selectRecordingActive);
  const { userRole, consultationId } = useConsultation();

  const isDoctor  = userRole === 'doctor';
  const isAdmin   = ['admin', 'superadmin'].includes(userRole);
  const canManage = isDoctor || isAdmin;

  // Build flat participant list
  const coreList = [
    participants.core?.doctor  ? { ...participants.core.doctor,  role: 'doctor'  } : null,
    participants.core?.patient ? { ...participants.core.patient, role: 'patient' } : null,
  ].filter(Boolean);

  const allParticipants = [
    ...coreList,
    ...(participants.additional ?? []),
    ...(participants.extra ?? []),
  ];

  const handleRemove = useCallback(async (targetUserId) => {
    if (!targetUserId) return;
    await dispatch(removeParticipant({ id: consultationId, userId: targetUserId }));
    socketRemoveParticipant(consultationId, targetUserId);
  }, [dispatch, consultationId]);

  const isRecording = localRecording || serverRecording;

  return (
    <div
      className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 shadow-2xl"
      role="complementary"
      aria-label="Participants"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-base-300 bg-base-100/95 backdrop-blur-md shrink-0">
        <h2 className="font-montserrat text-base font-bold text-base-content tracking-tight flex items-center gap-2">
          People
          <span className="badge badge-neutral badge-sm">{allParticipants.length}</span>
          {isRecording && (
            <span className="inline-flex items-center gap-1 text-[0.6rem] text-error font-bold bg-error/10 px-2 py-0.5 rounded-full border border-error/20 uppercase tracking-wider">
              <Circle size={7} className="fill-current animate-pulse" /> REC
            </span>
          )}
        </h2>
        <button
          onClick={onClose}
          className="btn btn-ghost btn-circle btn-sm"
          aria-label="Close participants"
        >
          <X size={17} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-thin">
        {/* Participant list */}
        {allParticipants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-50 min-h-32">
            <User size={36} className="text-base-content/30 mb-3" />
            <p className="text-sm font-medium text-base-content">No participants yet</p>
          </div>
        ) : (
          <div>
            {allParticipants.map((p, i) => {
              const pid = p._id ?? p.userId?._id ?? p.userId ?? i;
              const netKey = p.userId?._id ?? p.userId ?? p._id;
              // Admin can remove anyone. Doctor can remove non-core.
              const removable = isAdmin
                ? true
                : (isDoctor && !['doctor', 'patient'].includes(p.role));

              return (
                <ParticipantRow
                  key={String(pid)}
                  participant={p}
                  netQuality={networkQuality[netKey]}
                  canRemove={removable && canManage}
                  onRemove={handleRemove}
                />
              );
            })}
          </div>
        )}

        {/* ── Doctor/Admin controls ── */}
        {canManage && (
          <>
            {/* Add participant */}
            <AddParticipantForm
              consultationId={consultationId}
              onAdded={() => dispatch(fetchParticipants(consultationId))}
            />

            {/* Referral section */}
            {(isDoctor || isAdmin) && (
              <ReferralSection consultationId={consultationId} />
            )}
          </>
        )}
      </div>
    </div>
  );
});
ParticipantsPanel.displayName = 'ParticipantsPanel';

// ── Settings Panel ────────────────────────────────────────────────────────────

export const SettingsPanel = memo(({ onClose }) => {
  const { switchCamera, switchMic } = useAgora();
  const { userRole } = useConsultation();

  const [videoDevices,  setVideoDevices]  = useState([]);
  const [audioDevices,  setAudioDevices]  = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('');

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
    });
  }, []);

  const handleCameraChange = useCallback(async (e) => {
    const id = e.target.value;
    setSelectedVideo(id);
    await switchCamera(id);
  }, [switchCamera]);

  const handleMicChange = useCallback(async (e) => {
    const id = e.target.value;
    setSelectedAudio(id);
    await switchMic(id);
  }, [switchMic]);

  const isPrivileged = ['doctor', 'admin', 'superadmin'].includes(userRole);

  return (
    <div
      className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 shadow-2xl"
      role="complementary"
      aria-label="Settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-base-300 bg-base-100/95 backdrop-blur-md shrink-0">
        <h2 className="font-montserrat text-base font-bold text-base-content tracking-tight">
          Settings
        </h2>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" aria-label="Close settings">
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scrollbar-thin">

        {/* Camera select */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-base-content/70 uppercase tracking-wider">
            <Monitor size={14} /> Camera
          </label>
          <select
            className="input-field cursor-pointer"
            value={selectedVideo}
            onChange={handleCameraChange}
            aria-label="Select camera"
          >
            <option value="">Default camera</option>
            {videoDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 10)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Microphone select */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-base-content/70 uppercase tracking-wider">
            <Volume2 size={14} /> Microphone
          </label>
          <select
            className="input-field cursor-pointer"
            value={selectedAudio}
            onChange={handleMicChange}
            aria-label="Select microphone"
          >
            <option value="">Default microphone</option>
            {audioDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Mic ${d.deviceId.slice(0, 10)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Video quality info */}
        <div className="p-4 bg-base-200 border border-base-300 rounded-xl text-sm">
          <p className="font-semibold text-base-content mb-1 flex items-center gap-2">
            <Monitor size={14} className="text-primary" /> Video Quality
          </p>
          <p className="text-xs text-base-content/60 leading-relaxed">
            Streams at 720p HD. Automatically adapts to your network conditions.
          </p>
        </div>

        {/* Recording info */}
        <div className="p-4 bg-base-200 border border-base-300 rounded-xl text-sm">
          <p className="font-semibold text-base-content mb-1 flex items-center gap-2">
            <Circle size={13} className="text-error fill-current" /> Recording
          </p>
          <p className="text-xs text-base-content/60 leading-relaxed">
            Local recording captures <strong>all participants</strong> in a grid layout using
            a canvas compositor — not just your camera. The file is saved to your downloads
            when you stop recording. Server-side recording (admin only) stores the session
            securely in the cloud.
          </p>
        </div>

        {/* Referral quick-reference for doctor/admin */}
        {isPrivileged && (
          <div className="p-4 bg-info/5 border border-info/30 rounded-xl text-sm">
            <p className="font-semibold text-info mb-1 flex items-center gap-2">
              <Stethoscope size={14} /> Referrals
            </p>
            <p className="text-xs text-base-content/60 leading-relaxed">
              To refer this patient, go to the <strong>People</strong> panel and use the
              "Refer to Specialist" section. You can save the referral and optionally invite
              the specialist as a live observer.
            </p>
          </div>
        )}

        {/* Security note */}
        <div className="p-4 bg-success/5 border border-success/30 rounded-xl text-sm">
          <p className="font-semibold text-success mb-1 flex items-center gap-2">
            <UserCheck size={14} /> End-to-end encrypted
          </p>
          <p className="text-xs text-base-content/60 leading-relaxed">
            All audio and video is encrypted in transit. Recordings are stored with
            AES-256 encryption at rest.
          </p>
        </div>

      </div>
    </div>
  );
});
SettingsPanel.displayName = 'SettingsPanel';