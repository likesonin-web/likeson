'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  X, Monitor, Volume2, Settings, User, UserPlus, Trash2,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectParticipants, selectNetworkQuality,
  addParticipant, removeParticipant, fetchParticipants,
} from '@/store/slices/consultationSlice';
import { useAgora } from '@/context/AgoraProvider';
import { useConsultation } from '@/context/ConsultationProvider';
import { NetworkBars } from './VideoTile';
import { socketAddParticipant, socketRemoveParticipant } from '@/services/consultationSocketService';

// Roles doctor can add
const ADDABLE_ROLES = ['interpreter', 'observer', 'caregiver'];

// ── Participant Row ────────────────────────────────────────────────────────────

const ParticipantRow = memo(({ participant, networkQuality, canRemove, onRemove }) => {
  // FIX: resolve name from multiple possible fields
  const name = participant.name
    ?? participant.userName
    ?? participant.userId?.name
    ?? (typeof participant.userId === 'string' ? null : null)
    ?? 'Participant';

  const role = participant.role ?? 'participant';
  const initial = name[0].toUpperCase();
  const q = networkQuality ?? 0;

  return (
    <div className="flex items-center justify-between p-3 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-[var(--r-field)] transition-colors mb-2 group">
      <div className="avatar placeholder shrink-0 mr-3" aria-hidden="true">
        <div className="w-10 h-10 rounded-[var(--r-field)]">
          <span>{initial}</span>
        </div>
      </div>
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <span className="font-poppins text-sm font-semibold text-base-content truncate">
          {name}
        </span>
        <span className="text-xs text-base-content/60 capitalize mt-0.5">
          {role}
        </span>
      </div>
      
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <NetworkBars quality={q} />
        {canRemove && (
          <button
            className="btn btn-ghost btn-circle btn-xs text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(participant.userId?._id ?? participant.userId)}
            aria-label={`Remove ${name}`}
            title="Remove participant"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
});
ParticipantRow.displayName = 'ParticipantRow';

// ── Add Participant Form ───────────────────────────────────────────────────────

const AddParticipantForm = memo(({ consultationId, onAdded }) => {
  const dispatch = useDispatch();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('interpreter');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const uid = userId.trim();
    if (!uid) return;
    setAdding(true);
    try {
      await dispatch(addParticipant({ id: consultationId, userId: uid, role }));
      // Also emit socket so others see immediately
      socketAddParticipant(consultationId, uid, role);
      await dispatch(fetchParticipants(consultationId));
      setUserId('');
      onAdded?.();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mt-6 p-5 bg-base-200 border border-base-300 rounded-[var(--r-box)] shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold font-montserrat text-base-content mb-4">
        <UserPlus size={16} className="text-primary" /> Add Participant
      </p>
      
      <div className="flex flex-col gap-3">
        <input
          className="input-field"
          placeholder="User ID or email"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          aria-label="User ID"
        />
        <select
          className="input-field cursor-pointer"
          value={role}
          onChange={e => setRole(e.target.value)}
          aria-label="Role"
        >
          {ADDABLE_ROLES.map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <button
          className="btn btn-primary w-full mt-1"
          onClick={handleAdd}
          disabled={adding || !userId.trim()}
        >
          {adding ? <span className="loading loading-xs loading-spinner" /> : 'Add Participant'}
        </button>
      </div>
    </div>
  );
});
AddParticipantForm.displayName = 'AddParticipantForm';

// ── Participants Panel ────────────────────────────────────────────────────────

export const ParticipantsPanel = memo(({ onClose }) => {
  const dispatch = useDispatch();
  const participants = useSelector(selectParticipants);
  const networkQuality = useSelector(selectNetworkQuality);
  const { userId, userRole, consultationId } = useConsultation();

  const isDoctor = userRole === 'doctor';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const canManage = isDoctor || isAdmin;

  // Build flat list with name resolution
  const coreList = [
    participants.core?.doctor ? { ...participants.core.doctor, role: 'doctor' } : null,
    participants.core?.patient ? { ...participants.core.patient, role: 'patient' } : null,
  ].filter(Boolean);

  const additionalList = participants.additional ?? [];
  const allParticipants = [...coreList, ...additionalList, ...(participants.extra ?? [])];

  const handleRemove = useCallback(async (targetUserId) => {
    if (!targetUserId) return;
    await dispatch(removeParticipant({ id: consultationId, userId: targetUserId }));
    socketRemoveParticipant(consultationId, targetUserId);
  }, [dispatch, consultationId]);

  return (
    <div className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 shadow-depth-lg" role="complementary" aria-label="Participants">
      
      <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-100/90 backdrop-blur-soft z-10 shrink-0">
        <h2 className="font-montserrat text-lg font-bold text-base-content tracking-tight">
          People ({allParticipants.length})
        </h2>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content hover:bg-base-200" aria-label="Close participants">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-thin bg-base-100">
        {allParticipants.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-60 min-h-[12rem]">
            <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mb-3">
              <User size={24} className="text-base-content/40" />
            </div>
            <p className="text-sm font-poppins font-medium text-base-content">No participants yet</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {allParticipants.map((p, i) => {
              const pid = p._id ?? p.userId?._id ?? p.userId ?? i;
              // Can remove additional participants (not core doctor/patient)
              const removable = canManage && !['doctor', 'patient'].includes(p.role);
              return (
                <ParticipantRow
                  key={pid}
                  participant={p}
                  networkQuality={networkQuality[p.userId?._id ?? p.userId ?? p._id]}
                  canRemove={removable}
                  onRemove={handleRemove}
                />
              );
            })}
          </div>
        )}

        {/* Add participant — doctor/admin only */}
        {canManage && (
          <AddParticipantForm
            consultationId={consultationId}
            onAdded={() => dispatch(fetchParticipants(consultationId))}
          />
        )}
      </div>
    </div>
  );
});
ParticipantsPanel.displayName = 'ParticipantsPanel';

// ── Settings Panel ────────────────────────────────────────────────────────────

export const SettingsPanel = memo(({ onClose }) => {
  const { switchCamera, switchMic } = useAgora();

  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
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

  return (
    <div className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 shadow-depth-lg" role="complementary" aria-label="Settings">
      
      <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-100/90 backdrop-blur-soft z-10 shrink-0">
        <h2 className="font-montserrat text-lg font-bold text-base-content tracking-tight flex items-center gap-2">
          <Settings size={20} aria-hidden="true" className="text-primary" /> Settings
        </h2>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content hover:bg-base-200" aria-label="Close settings">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin bg-base-100">
        
        <div className="flex flex-col gap-2">
          <label className="label-text flex items-center gap-2 font-semibold">
            <Monitor size={16} aria-hidden="true" className="text-base-content/70" /> Camera
          </label>
          <select 
            className="input-field cursor-pointer w-full" 
            value={selectedVideo} 
            onChange={handleCameraChange} 
            aria-label="Select camera"
          >
            {videoDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Camera ' + d.deviceId.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="label-text flex items-center gap-2 font-semibold">
            <Volume2 size={16} aria-hidden="true" className="text-base-content/70" /> Microphone
          </label>
          <select 
            className="input-field cursor-pointer w-full" 
            value={selectedAudio} 
            onChange={handleMicChange} 
            aria-label="Select microphone"
          >
            {audioDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Microphone ' + d.deviceId.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 bg-base-200 border border-base-300 rounded-[var(--r-box)] mt-2">
          <p className="text-sm font-semibold text-base-content mb-1">Video Quality</p>
          <p className="text-xs text-base-content/60 leading-relaxed">
            Streaming defaults to 720p and will auto-adjust based on your network conditions to maintain stability.
          </p>
        </div>

      </div>
    </div>
  );
});
SettingsPanel.displayName = 'SettingsPanel';