'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminConsultation } from './useAdminConsultation';
import VideoTile from './components/VideoTile';
import ParticipantRow from './components/ParticipantRow';
import EventLogItem from './components/EventLogItem';
import ChatTab from './components/ChatTab';
import AnalyticsTab from './components/AnalyticsTab';
import PrescriptionTab from './components/PrescriptionTab';
import AdminNotesTab from './components/AdminNotesTab';
import ForceEndModal from './components/ForceEndModal';
import ConfirmActionModal from './components/ConfirmActionModal';

// ─── Status badge colors ───────────────────────────────────────────────────────
const statusBadgeClass = (status) => {
  switch (status) {
    case 'active':       return 'badge badge-success';
    case 'waiting':      return 'badge badge-info';
    case 'paused':       return 'badge badge-warning';
    case 'completed':    return 'badge badge-primary';
    case 'cancelled':    return 'badge badge-error';
    case 'failed':       return 'badge badge-error';
    case 'scheduled':    return 'badge badge-secondary';
    case 'created':      return 'badge badge-secondary';
    default:             return 'badge';
  }
};

const priorityBadgeClass = (priority) => {
  switch (priority) {
    case 'emergency': return 'badge badge-error';
    case 'critical':  return 'badge badge-error';
    case 'urgent':    return 'badge badge-warning';
    default:          return 'badge badge-info';
  }
};

const maskToken = (token) => {
  if (!token) return '••••••••••••';
  return `••••••••${String(token).slice(-4)}`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const TERMINAL_STATUSES = ['completed', 'cancelled', 'failed'];

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminConsultationPage() {
  const { id: consultationId } = useParams();
  const router = useRouter();

  const {
    consultation,
    joinToken,
    chatMessages,
    prescriptions,
    loading,
    rt,
    stats,
    hasJoined,
    remoteUsers,
    doctorVideoTrack,
    patientVideoTrack,
    isMuted,
    toggleMute,
    joinAsObserver,
    handleForceEnd,
    handleSaveAdminNotes,
    handleCancelConsultation,
    handleConfirmConsultation,
    handleApproveWaitingRoom,
    handleSendMessage,
    networkAnalytics,
    sdkErrors,
    reconnectLogs,
  } = useAdminConsultation(consultationId, null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,          setActiveTab]          = useState('chat');
  const [showForceEndModal,  setShowForceEndModal]  = useState(false);
  const [showCancelModal,    setShowCancelModal]    = useState(false);
  const [showConfirmModal,   setShowConfirmModal]   = useState(false);
  const [waitingCollapsed,   setWaitingCollapsed]   = useState(false);
  const [adminNotesText,     setAdminNotesText]     = useState('');

  // sync admin notes from consultation
  useEffect(() => {
    if (consultation?.internalAdminNotes) {
      setAdminNotesText(consultation.internalAdminNotes);
    }
  }, [consultation?.internalAdminNotes]);

  // ── 404 state ─────────────────────────────────────────────────────────────
  if (!loading.fetch && !consultation && consultationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="alert alert-error max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Consultation not found or access denied.</span>
        </div>
        <button className="btn btn-primary" onClick={() => router.push('/admin/dashboard')}>
          Back to Admin Dashboard
        </button>
      </div>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading.fetch && !consultation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-lg" />
      </div>
    );
  }

  const isTerminal    = TERMINAL_STATUSES.includes(consultation?.status);
  const doctorName    = consultation?.doctor?.user?.name || consultation?.doctor?.name || 'Doctor';
  const patientName   = consultation?.patient?.name || 'Patient';
  const doctorUID     = rt.participants.find((p) => p.role === 'doctor')?.userId;
  const patientUID    = rt.participants.find((p) => p.role === 'patient')?.userId;

  const doctorNQ      = doctorUID  ? rt.networkQualities[doctorUID]  : null;
  const patientNQ     = patientUID ? rt.networkQualities[patientUID] : null;

  const eventLogs     = (consultation?.eventLogs ?? []).slice().reverse().slice(0, 10);
  const waitingQueue  = consultation?.waitingRoomQueue?.filter((e) => e.waitingRoomStatus === 'waiting') ?? [];

  // ── Status action buttons visibility ──────────────────────────────────────
  const canCancel  = !['completed', 'cancelled', 'failed'].includes(consultation?.status);
  const canConfirm = !['completed', 'cancelled', 'failed', 'active'].includes(consultation?.status);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen overflow-hidden bg-base-200">

      {/* ─── LEFT PANEL ─────────────────────────────────────────────────── */}
      <aside className="w-[260px] shrink-0 flex flex-col bg-base-100 border-r border-base-300 overflow-y-auto">

        {/* Header */}
        <div className="px-4 py-3 border-b border-base-300 bg-base-200">
          <div className="flex items-center justify-between gap-2">
            <span className="font-montserrat font-black text-sm text-base-content">
              {consultation?.consultationId || 'Loading…'}
            </span>
            <span className={statusBadgeClass(consultation?.status)}>
              {consultation?.status || '…'}
            </span>
          </div>
          <p className="text-xs text-base-content/50 mt-0.5">
            #{consultation?.bookingCode || '—'}
          </p>
        </div>

        {/* Consultation Details */}
        <div className="flex-1 px-4 py-3 space-y-4 text-xs">

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5">
            <span className={priorityBadgeClass(consultation?.priority)}>
              {consultation?.priority || 'routine'}
            </span>
            <span className="badge badge-secondary">
              {consultation?.consultationStage?.replace(/_/g, ' ') || '—'}
            </span>
            <span className="badge badge-accent">
              {consultation?.consultationType || '—'}
            </span>
            <span className="badge">
              {consultation?.consultationMode || '—'}
            </span>
          </div>

          {/* Timing */}
          <section>
            <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">Timing</p>
            <dl className="space-y-0.5">
              <InfoRow label="Scheduled"  value={fmtDate(consultation?.scheduledStartTime)} />
              <InfoRow label="Started"    value={fmtDate(consultation?.actualStartTime)} />
              <InfoRow label="Ended"      value={fmtDate(consultation?.actualEndTime)} />
              <InfoRow label="Est. min"   value={consultation?.estimatedDurationMinutes ?? '—'} />
              <InfoRow label="Actual min" value={consultation?.actualDurationMinutes ?? '—'} />
            </dl>
          </section>

          {/* Indicators */}
          <section>
            <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">Indicators</p>
            <div className="space-y-1">
              <IndicatorRow label="Consent"      active={consultation?.telemedicineConsentAccepted} />
              <IndicatorRow label="Prescription" active={consultation?.prescriptionUploaded} />
              <IndicatorRow label="Rated"        active={consultation?.isRated} />
            </div>
          </section>

          {/* Patient */}
          <section>
            <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">Patient</p>
            <dl className="space-y-0.5">
              <InfoRow label="Name"  value={consultation?.patient?.name} />
              <InfoRow label="Phone" value={consultation?.patient?.phone} />
              <InfoRow label="Email" value={consultation?.patient?.email} />
            </dl>
          </section>

          {/* Doctor */}
          <section>
            <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">Doctor</p>
            <dl className="space-y-0.5">
              <InfoRow label="Name"    value={consultation?.doctor?.user?.name} />
              <InfoRow label="Phone"   value={consultation?.doctor?.user?.phone} />
              <InfoRow label="Reg. #"  value={consultation?.doctor?.registrationNumber} />
              <InfoRow label="Specialty" value={consultation?.doctor?.specialization || consultation?.specialty} />
              <InfoRow label="Online"  value={rt.doctorOnline ? '✓ Online' : '✗ Offline'} />
            </dl>
          </section>

          {/* Hospital */}
          {consultation?.hospital && (
            <section>
              <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">Hospital</p>
              <dl className="space-y-0.5">
                <InfoRow label="Name"    value={consultation.hospital.name} />
                <InfoRow label="Address" value={consultation.hospital.address} />
              </dl>
            </section>
          )}

          {/* Room / Tokens */}
          <section>
            <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">Room</p>
            <dl className="space-y-0.5">
              <InfoRow label="Channel"   value={consultation?.agoraChannelId} />
              <InfoRow label="Host tkn"  value={maskToken(consultation?.hostToken)} mono />
              <InfoRow label="Part. tkn" value={maskToken(consultation?.participantToken)} mono />
            </dl>
          </section>

          {/* Doctor Internal Notes (read-only) */}
          {consultation?.doctorInternalNotes && (
            <section>
              <p className="label-text mb-1 uppercase text-[10px] tracking-widest text-base-content/40">
                Doctor Notes (Internal)
              </p>
              <div className="stat-card !p-2 text-[11px] text-base-content/70 whitespace-pre-wrap">
                {consultation.doctorInternalNotes}
              </div>
            </section>
          )}
        </div>

        {/* ── Admin Controls ─────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-base-300 space-y-2 bg-base-100">

          {/* Force End */}
          <button
            className="btn btn-error w-full btn-sm"
            disabled={isTerminal}
            title={isTerminal ? `Already ${consultation?.status}` : 'Force end this consultation'}
            onClick={() => setShowForceEndModal(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Force End
          </button>

          {/* Status buttons */}
          <div className="flex gap-1.5">
            {canConfirm && (
              <button
                className="btn btn-success btn-xs flex-1"
                onClick={() => setShowConfirmModal(true)}
              >
                Confirm
              </button>
            )}
            {canCancel && (
              <button
                className="btn btn-warning btn-xs flex-1"
                onClick={() => setShowCancelModal(true)}
              >
                Cancel
              </button>
            )}
          </div>

          {/* Admin Notes quick-save */}
          <div>
            <label className="label-text text-[10px] uppercase tracking-widest text-base-content/40">
              Admin Notes
            </label>
            <textarea
              className="input-field mt-1 text-xs resize-none"
              rows={3}
              value={adminNotesText}
              onChange={(e) => setAdminNotesText(e.target.value)}
              onBlur={() => adminNotesText.trim() && handleSaveAdminNotes(adminNotesText)}
              placeholder="Internal admin notes…"
            />
          </div>
        </div>
      </aside>

      {/* ─── CENTER PANEL ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Video Monitor */}
        <section className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-montserrat font-black text-sm text-base-content">
              Live Monitor
            </h2>
            <div className="flex items-center gap-2">
              <span className="badge badge-info badge-sm">Admin observing — camera/mic off</span>
              {hasJoined ? (
                <button className="btn btn-ghost btn-xs" onClick={toggleMute}>
                  {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-xs"
                  onClick={joinAsObserver}
                  disabled={!joinToken}
                >
                  Join as Observer
                </button>
              )}
            </div>
          </div>

          {/* Video tiles */}
          <div className="grid grid-cols-2 gap-3">
            <VideoTile
              label={`Dr. ${doctorName}`}
              track={doctorVideoTrack}
              participant={rt.participants.find((p) => p.role === 'doctor')}
              networkQuality={doctorNQ}
            />
            <VideoTile
              label="Patient"
              track={patientVideoTrack}
              participant={rt.participants.find((p) => p.role === 'patient')}
              networkQuality={patientNQ}
            />
          </div>
        </section>

        {/* Participant List */}
        <section className="px-4 pb-3">
          <h3 className="font-montserrat font-bold text-xs uppercase tracking-widest text-base-content/50 mb-2">
            Participants
          </h3>
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Device</th>
                  <th>Joined</th>
                  <th>Duration</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {consultation?.participants?.length ? (
                  consultation.participants.map((p) => (
                    <ParticipantRow
                      key={p._id || p.userId}
                      participant={p}
                      networkQuality={rt.networkQualities[String(p.userId)]}
                      handRaised={rt.handsRaised.includes(String(p.userId))}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/40 py-4">
                      No participants yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Waiting Room */}
        <section className="px-4 pb-3">
          <button
            className="flex items-center gap-1.5 font-montserrat font-bold text-xs uppercase tracking-widest text-base-content/50 mb-2 w-full"
            onClick={() => setWaitingCollapsed((v) => !v)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3.5 h-3.5 transition-transform ${waitingCollapsed ? '-rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Waiting Room
            {waitingQueue.length > 0 && (
              <span className="badge badge-warning badge-xs ml-1">{waitingQueue.length}</span>
            )}
          </button>

          {!waitingCollapsed && (
            <div className="card overflow-hidden">
              {waitingQueue.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Entered</th><th>Position</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {waitingQueue.map((entry) => (
                      <tr key={entry._id || entry.userId}>
                        <td>{entry.displayName || '—'}</td>
                        <td>{fmtDate(entry.enteredAt)}</td>
                        <td>#{entry.queuePosition}</td>
                        <td>
                          <button
                            className="btn btn-success btn-xs"
                            onClick={() => handleApproveWaitingRoom(entry.userId)}
                          >
                            Admit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-base-content/40 p-3 text-center">Waiting room empty</p>
              )}
            </div>
          )}
        </section>

        {/* Event Log */}
        <section className="px-4 pb-4">
          <h3 className="font-montserrat font-bold text-xs uppercase tracking-widest text-base-content/50 mb-2">
            Event Log
          </h3>
          <div className="card overflow-hidden max-h-48 overflow-y-auto">
            {eventLogs.length > 0 ? (
              <table className="table text-xs">
                <thead>
                  <tr><th>Event</th><th>Actor</th><th>Time</th><th>Severity</th></tr>
                </thead>
                <tbody>
                  {eventLogs.map((ev) => (
                    <EventLogItem key={ev._id} event={ev} />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-base-content/40 p-3 text-center">No events yet</p>
            )}
          </div>
        </section>
      </main>

      {/* ─── RIGHT PANEL ────────────────────────────────────────────────── */}
      <aside className="w-[320px] shrink-0 flex flex-col bg-base-100 border-l border-base-300">

        {/* Tabs */}
        <div className="flex border-b border-base-300 bg-base-200">
          {[
            { key: 'chat',         label: 'Chat' },
            { key: 'analytics',    label: 'Analytics', badge: sdkErrors.length || null },
            { key: 'prescription', label: 'Rx' },
            { key: 'notes',        label: 'Notes' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-2 py-2.5 text-xs font-semibold transition-colors relative ${
                activeTab === tab.key
                  ? 'text-primary border-b-2 border-primary bg-base-100'
                  : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="absolute top-1 right-1 badge badge-error badge-xs">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'chat' && (
            <ChatTab
              messages={chatMessages}
              rt={rt}
              onSend={handleSendMessage}
              loading={loading.chat}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              networkAnalytics={networkAnalytics}
              sdkErrors={sdkErrors}
              reconnectLogs={reconnectLogs}
              consultationAnalytics={consultation?.analytics}
              rt={rt}
            />
          )}
          {activeTab === 'prescription' && (
            <PrescriptionTab prescriptions={prescriptions} />
          )}
          {activeTab === 'notes' && (
            <AdminNotesTab
              notes={adminNotesText}
              onChange={setAdminNotesText}
              onSave={handleSaveAdminNotes}
              loading={loading.notes}
            />
          )}
        </div>
      </aside>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      {showForceEndModal && (
        <ForceEndModal
          onConfirm={(reason) => {
            handleForceEnd(reason);
            setShowForceEndModal(false);
          }}
          onClose={() => setShowForceEndModal(false)}
        />
      )}

      {showCancelModal && (
        <ConfirmActionModal
          title="Cancel Consultation"
          description="Provide a reason for cancellation."
          requireReason
          confirmLabel="Cancel Consultation"
          confirmClass="btn btn-error"
          onConfirm={(reason) => {
            handleCancelConsultation(reason);
            setShowCancelModal(false);
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showConfirmModal && (
        <ConfirmActionModal
          title="Confirm Consultation"
          description="Mark this consultation as confirmed/scheduled?"
          confirmLabel="Confirm"
          confirmClass="btn btn-success"
          onConfirm={() => {
            handleConfirmConsultation();
            setShowConfirmModal(false);
          }}
          onClose={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
}

// ─── Tiny helper components ───────────────────────────────────────────────────
function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-base-content/40 shrink-0">{label}</dt>
      <dd className={`text-right truncate ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

function IndicatorRow({ label, active }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-base-content/60">{label}</span>
      <span className={active ? 'badge badge-success badge-xs' : 'badge badge-xs'}>
        {active ? 'Yes' : 'No'}
      </span>
    </div>
  );
}