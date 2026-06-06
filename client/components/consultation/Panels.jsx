'use client';

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  X, Monitor, Volume2, User, UserPlus, Trash2,
  Circle, SendHorizonal, UserCheck, Stethoscope, Mic, MicOff
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectParticipants, selectNetworkQuality,
  addParticipant, removeParticipant, fetchParticipants,
  selectLocalRecordingActive, selectRecordingActive,
  selectMutedParticipants, selectKickedParticipants,
  saveReferral,
  muteParticipant,
  unmuteParticipant,
  kickParticipant,
} from '@/store/slices/consultationSlice';
import {
  socketAddParticipant,
  socketRemoveParticipant,
  socketMuteParticipant,
  socketUnmuteParticipant,
  socketKickParticipant,
} from '@/services/consultationSocketService';
import { useAgora } from '@/context/AgoraProvider';
import { useConsultation } from '@/context/ConsultationProvider';
import { NetworkBars } from './VideoTile';
import toast from 'react-hot-toast';

// Roles that can be added mid-session
const ADDABLE_ROLES = [
  { value: 'interpreter',    label: 'Interpreter'    },
  { value: 'observer',       label: 'Observer'       },
  { value: 'caregiver',      label: 'Caregiver'      },
  { value: 'care_assistant', label: 'Care Assistant' },
];

// ── Name resolution helper ────────────────────────────────────────────────────
/**
 * Resolves display name from any participant shape.
 * Skips generic UID-like strings (User-1004, user-1004, 1004).
 * Falls back to uidNameMap lookup by role, then consultation snapshots.
 */
const resolveName = (participant, uidNameMap = {}, consultation = null) => {
  if (!participant) return 'Participant';

  const isBadName = (n) =>
    !n
    || n === 'Participant'
    || /^[Uu]ser[-_]?\d+$/.test(n)
    || /^\d+$/.test(n)
    || n === 'You'
    || n === 'you';

  // _displayName injected by enrichment in ParticipantsPanel
  if (participant._displayName && !isBadName(participant._displayName))
    return participant._displayName;

  // Direct name field
  if (participant.name && typeof participant.name === 'string' && !isBadName(participant.name))
    return participant.name;

  // userId populated object
  if (participant.userId && typeof participant.userId === 'object') {
    if (participant.userId.name && !isBadName(participant.userId.name))
      return participant.userId.name;
  }

  // Doctor doc nested user object
  if (participant.user && typeof participant.user === 'object') {
    if (participant.user.name && !isBadName(participant.user.name))
      return participant.user.name;
  }

  // Snapshot fallbacks from consultation doc
  if (participant.doctorSnapshot?.name && !isBadName(participant.doctorSnapshot.name))
    return participant.doctorSnapshot.name;
  if (participant.patientSnapshot?.name && !isBadName(participant.patientSnapshot.name))
    return participant.patientSnapshot.name;

  // userName (enriched Agora user)
  if (participant.userName && !isBadName(participant.userName))
    return participant.userName;

  // ── Consultation snapshot lookup by role ──────────────────────────────────
  const role = participant.role;
  if (consultation) {
    if (role === 'doctor' && consultation.doctorSnapshot?.name && !isBadName(consultation.doctorSnapshot.name))
      return consultation.doctorSnapshot.name;
    if (role === 'patient' && consultation.patientSnapshot?.name && !isBadName(consultation.patientSnapshot.name))
      return consultation.patientSnapshot.name;
  }

  // ── uidNameMap lookup by role ─────────────────────────────────────────────
  if (Object.keys(uidNameMap).length > 0) {
    const match = Object.values(uidNameMap).find(
      meta => meta.role === role && meta.name && !isBadName(meta.name)
    );
    if (match) return match.name;
  }

  return 'Participant';
};

/**
 * Resolves avatar URL from any participant shape.
 */
const resolveAvatar = (participant) => {
  if (!participant) return null;
  if (participant.avatar) return participant.avatar;
  if (participant.userId?.avatar) return participant.userId.avatar;
  if (participant.user?.avatar) return participant.user?.avatar;
  return null;
};

/**
 * Resolves the userId string for socket/API calls.
 */
const resolveUserId = (participant) => {
  if (!participant) return null;
  if (typeof participant.userId === 'string') return participant.userId;
  if (participant.userId?._id) return participant.userId._id;
  if (participant.user?._id) return participant.user._id;
  if (participant._id) return participant._id;
  return null;
};

// ── Build unified participant list from API response ──────────────────────────
const buildParticipantList = (participants) => {
  if (!participants) return [];

  const seen = new Set();
  const list = [];

  const push = (item) => {
    const id = resolveUserId(item);
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    list.push(item);
  };

  if (participants.core?.doctor) push({ ...participants.core.doctor, role: 'doctor' });
  if (participants.core?.patient) push({ ...participants.core.patient, role: 'patient' });

  const events = participants.events ?? [];
  events.forEach(ev => push(ev));

  const additional = participants.additional ?? [];
  const extra      = participants.extra ?? [];
  const extraP     = participants.extraParticipants ?? [];
  [...additional, ...extra, ...extraP].forEach(p => push(p));

  return list;
};

// ── Confirm dialog helper ─────────────────────────────────────────────────────
const confirmAction = (msg) => window.confirm(msg);

// ── Participant Row ───────────────────────────────────────────────────────────
const ParticipantRow = memo(({
  participant, netQuality, canRemove, onRemove,
  canControl, onMute, isMuted, isKicked,
  uidNameMap, consultation,
}) => {
  const name   = resolveName(participant, uidNameMap, consultation);
  const avatar = resolveAvatar(participant);
  const role   = participant.role ?? 'participant';
  const uid    = resolveUserId(participant);
  const init   = name[0]?.toUpperCase() ?? '?';

  const roleLabel = role.replace(/_/g, ' ');
  const isCore    = ['doctor', 'patient'].includes(role);

  if (isKicked) return null;

  return (
    <div className="flex items-center justify-between p-3 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-xl transition-colors mb-2 group">
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="w-10 h-10 rounded-xl object-cover shrink-0 mr-3 border border-base-300"
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 mr-3">
          {init}
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <span className="text-sm font-semibold text-base-content truncate">{name}</span>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[0.65rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
            isCore ? 'bg-primary/10 text-primary' : 'bg-base-300 text-base-content/60'
          }`}>
            {roleLabel}
          </span>
          {isMuted && (
            <span className="text-[0.6rem] font-bold text-error bg-error/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
              Muted
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <NetworkBars quality={netQuality ?? 0} />

        {/* Mute / Unmute — doctor only, non-doctor targets */}
        {canControl && role !== 'doctor' && (
          <button
            className={`btn btn-ghost btn-circle btn-xs ${isMuted ? 'text-warning' : 'text-base-content/60'} hover:bg-warning/10`}
            onClick={() => isMuted ? onMute(uid, false) : onMute(uid, true)}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? `Unmute ${name}` : `Mute ${name}`}
          >
            {isMuted ? <MicOff size={13} className="text-warning" /> : <Mic size={13} />}
          </button>
        )}

        {/* Kick — non-core targets */}
        {canRemove && (
          <button
            className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10"
            onClick={() => {
              if (confirmAction(`Remove ${name} from the session?`)) onRemove(uid);
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
const ReferralSection = memo(({ consultationId }) => {
  const dispatch = useDispatch();
  const [referTo,        setReferTo]        = useState('');
  const [referNote,      setReferNote]      = useState('');
  const [addAsObserver,  setAddAsObserver]  = useState(false);
  const [observerUserId, setObserverUserId] = useState('');
  const [saving,         setSaving]         = useState(false);

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
  const mutedIds        = useSelector(selectMutedParticipants);
  const kickedIds       = useSelector(selectKickedParticipants);

  // ── Pull uidNameMap from Agora + consultation for name resolution ──────────
  const { uidNameMap } = useAgora();
  const { userRole, consultationId, consultation } = useConsultation();

  const isDoctor  = userRole === 'doctor';
  const isAdmin   = ['admin', 'superadmin'].includes(userRole);
  const canManage = isDoctor || isAdmin;

  // ── Build + enrich participant list ───────────────────────────────────────
  // Merges Redux API data with live Agora uidNameMap names and consultation snapshots
  const allParticipants = useMemo(() => {
    const list = buildParticipantList(participants);

    return list.map(p => {
      const currentName = resolveName(p); // quick check without extras
      const isBadName =
        !currentName
        || currentName === 'Participant'
        || /^[Uu]ser[-_]?\d+$/.test(currentName)
        || /^\d+$/.test(currentName);

      if (!isBadName) return p; // already has a real name

      const role = p.role;

      // Try consultation snapshots first (most reliable)
      if (role === 'doctor' && consultation?.doctorSnapshot?.name) {
        return { ...p, _displayName: consultation.doctorSnapshot.name };
      }
      if (role === 'patient' && consultation?.patientSnapshot?.name) {
        return { ...p, _displayName: consultation.patientSnapshot.name };
      }

      // Try uidNameMap by role match
      const mapMatch = Object.values(uidNameMap).find(
        meta =>
          meta.role === role
          && meta.name
          && meta.name !== 'You'
          && meta.name !== 'you'
          && !/^[Uu]ser[-_]?\d+$/.test(meta.name)
          && !/^\d+$/.test(meta.name)
      );
      if (mapMatch) return { ...p, _displayName: mapMatch.name };

      return p;
    });
  }, [participants, uidNameMap, consultation]);

  const handleRemove = useCallback(async (targetUserId) => {
    if (!targetUserId) return;
    if (isDoctor) {
      await dispatch(kickParticipant({ id: consultationId, userId: targetUserId, reason: 'Removed by doctor' }));
      socketKickParticipant(consultationId, targetUserId, 'Removed by doctor');
    } else {
      await dispatch(removeParticipant({ id: consultationId, userId: targetUserId }));
      socketRemoveParticipant(consultationId, targetUserId);
    }
    await dispatch(fetchParticipants(consultationId));
  }, [dispatch, consultationId, isDoctor]);

  const handleMute = useCallback(async (targetUserId, shouldMute) => {
    if (!targetUserId) return;
    if (shouldMute) {
      await dispatch(muteParticipant({ id: consultationId, userId: targetUserId }));
      socketMuteParticipant(consultationId, targetUserId);
    } else {
      await dispatch(unmuteParticipant({ id: consultationId, userId: targetUserId }));
      socketUnmuteParticipant(consultationId, targetUserId);
    }
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
        {allParticipants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-50 min-h-32">
            <User size={36} className="text-base-content/30 mb-3" />
            <p className="text-sm font-medium text-base-content">No participants yet</p>
          </div>
        ) : (
          <div>
            {allParticipants.map((p, i) => {
              const uid      = resolveUserId(p);
              const isMuted  = uid ? mutedIds.includes(uid) : false;
              const isKicked = uid ? kickedIds.includes(uid) : false;
              const removable = isAdmin
                ? true
                : (isDoctor && p.role !== 'doctor');
              const canControl = isDoctor && p.role !== 'doctor';

              return (
                <ParticipantRow
                  key={uid ?? i}
                  participant={p}
                  uidNameMap={uidNameMap}
                  consultation={consultation}
                  netQuality={networkQuality[uid]}
                  canRemove={removable && canManage}
                  canControl={canControl}
                  onRemove={handleRemove}
                  onMute={handleMute}
                  isMuted={isMuted}
                  isKicked={isKicked}
                />
              );
            })}
          </div>
        )}

        {canManage && (
          <>
            <AddParticipantForm
              consultationId={consultationId}
              onAdded={() => dispatch(fetchParticipants(consultationId))}
            />
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
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-base-300 bg-base-100/95 backdrop-blur-md shrink-0">
        <h2 className="font-montserrat text-base font-bold text-base-content tracking-tight">
          Settings
        </h2>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" aria-label="Close settings">
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scrollbar-thin">

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

        <div className="p-4 bg-base-200 border border-base-300 rounded-xl text-sm">
          <p className="font-semibold text-base-content mb-1 flex items-center gap-2">
            <Monitor size={14} className="text-primary" /> Video Quality
          </p>
          <p className="text-xs text-base-content/60 leading-relaxed">
            Streams at 720p HD. Automatically adapts to your network conditions.
          </p>
        </div>

        <div className="p-4 bg-base-200 border border-base-300 rounded-xl text-sm">
          <p className="font-semibold text-base-content mb-1 flex items-center gap-2">
            <Circle size={13} className="text-error fill-current" /> Recording
          </p>
          <p className="text-xs text-base-content/60 leading-relaxed">
            Local recording captures <strong>all participants</strong> in a grid layout using
            a canvas compositor. The file is saved to your downloads when you stop recording.
            Server-side recording (admin only) stores the session securely in the cloud.
          </p>
        </div>

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