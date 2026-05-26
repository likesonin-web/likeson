/**
 * consultationPermissionService.js
 *
 * Client-side RBAC. Mirrors backend authorization.
 * Never rely solely on this — backend enforces too.
 *
 * consultationAnalyticsService.js
 * Local analytics event collector. Batches + sends to backend.
 *
 * consultationRecoveryService.js
 * Session recovery logic on hard refresh / tab restore.
 */

'use client';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// consultationPermissionService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Permission matrix — mirrors backend HOST_ROLES + role-based checks.
 * Returns permission set for given role + server-granted permissions.
 */

const PERMISSION_MATRIX = {
  doctor: {
    canJoin:              true,
    canMute:              true,
    canKick:              true,
    canRecord:            true,
    canShareScreen:       true,
    canChat:              true,
    canPrescribe:         true,
    canStartConsultation: true,
    canEndConsultation:   true,
    canPauseConsultation: true,
    canAdmitPatient:      true,
    canRejectPatient:     true,
    canViewAnalytics:     true,
    canViewAuditTrail:    true,
    canViewNotes:         true,
    canRaiseHand:         false,
    canRequestEnd:        false,
  },
  admin: {
    canJoin:              true,
    canMute:              true,
    canKick:              true,
    canRecord:            true,
    canShareScreen:       true,
    canChat:              true,
    canPrescribe:         false,
    canStartConsultation: true,
    canEndConsultation:   true,
    canPauseConsultation: true,
    canAdmitPatient:      true,
    canRejectPatient:     true,
    canViewAnalytics:     true,
    canViewAuditTrail:    true,
    canViewNotes:         true,
    canForceEnd:          true,
    canEmergencyOverride: true,
  },
  superadmin: {
    canJoin:              true,
    canMute:              true,
    canKick:              true,
    canRecord:            true,
    canShareScreen:       true,
    canChat:              true,
    canPrescribe:         false,
    canStartConsultation: true,
    canEndConsultation:   true,
    canPauseConsultation: true,
    canAdmitPatient:      true,
    canRejectPatient:     true,
    canViewAnalytics:     true,
    canViewAuditTrail:    true,
    canViewNotes:         true,
    canForceEnd:          true,
    canEmergencyOverride: true,
    canForceReconnect:    true,
    canDisableRecording:  true,
    canForensicLogs:      true,
  },
  patient: {
    canJoin:              true,
    canMute:              false,
    canKick:              false,
    canRecord:            false,
    canShareScreen:       false, // only if doctor allows
    canChat:              true,
    canPrescribe:         false,
    canStartConsultation: false,
    canEndConsultation:   false,
    canPauseConsultation: false,
    canAdmitPatient:      false,
    canRejectPatient:     false,
    canViewAnalytics:     false,
    canViewAuditTrail:    false,
    canRaiseHand:         true,
    canRequestEnd:        true,
    canUploadFiles:       true,
  },
  care_assistant: {
    canJoin:              true,
    canMute:              false,
    canKick:              false,
    canRecord:            false,
    canShareScreen:       false,
    canChat:              true,
    canPrescribe:         false,
    canStartConsultation: false,
    canEndConsultation:   false,
    canPauseConsultation: false,
    canAdmitPatient:      false,
    canViewAnalytics:     false,
    canRaiseHand:         true,
    canUploadFiles:       true,
    canSupportPatient:    true,
  },
  nurse: {
    canJoin:              true,
    canMute:              false,
    canKick:              false,
    canRecord:            false,
    canShareScreen:       false,
    canChat:              true,
    canPrescribe:         false,
    canStartConsultation: false,
    canEndConsultation:   false,
    canViewAnalytics:     false,
    canRaiseHand:         true,
    canUploadFiles:       true,
    canInputVitals:       true,
  },
  hospital: {
    canJoin:              true,
    canMute:              false,
    canKick:              false,
    canRecord:            false,
    canShareScreen:       false,
    canChat:              true,
    canPrescribe:         false,
    canStartConsultation: false,
    canEndConsultation:   false,
    canViewAnalytics:     true,
    canViewAuditTrail:    true,
    canObserve:           true,
    canMonitorQuality:    true,
  },
};

export const consultationPermissionService = {
  /**
   * Get full permission set for role.
   * Server-granted permissions override (can only grant more, not restrict).
   */
  getPermissions(role, serverGranted = {}) {
    const base = PERMISSION_MATRIX[role] || PERMISSION_MATRIX.patient;
    return { ...base, ...serverGranted };
  },

  /**
   * Check single permission.
   */
  can(role, permission, serverGranted = {}) {
    const perms = this.getPermissions(role, serverGranted);
    return perms[permission] === true;
  },

  /**
   * Check if role is host.
   */
  isHost(role) {
    return ['doctor', 'admin', 'superadmin'].includes(role);
  },

  /**
   * Check if role can moderate.
   */
  canModerate(role) {
    return ['doctor', 'admin', 'superadmin'].includes(role);
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// consultationAnalyticsService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Collects local analytics events and batches to backend.
 * Tracks: join time, first video, first audio, reconnects, speaking duration.
 */

class ConsultationAnalyticsService {
  constructor() {
    this._events    = [];
    this._sessionId = null;
    this._startTime = null;
    this._flushTimer = null;
    this._speaking  = new Map(); // participantId → startTime
  }

  start(consultationId) {
    this._sessionId = consultationId;
    this._startTime = Date.now();
    this._scheduleFlush();
    this.track('session_start', { consultationId });
  }

  track(eventName, payload = {}) {
    this._events.push({
      event:     eventName,
      timestamp: Date.now(),
      elapsed:   this._startTime ? Date.now() - this._startTime : 0,
      ...payload,
    });

    // Flush immediately for critical events
    if (['session_end', 'error'].includes(eventName)) {
      this._flush();
    }
  }

  // Speaking duration tracking
  speakingStart(participantId) {
    this._speaking.set(participantId, Date.now());
  }

  speakingEnd(participantId) {
    const start = this._speaking.get(participantId);
    if (!start) return;
    const duration = Date.now() - start;
    this._speaking.delete(participantId);
    this.track('speaking_duration', { participantId, duration });
  }

  _scheduleFlush() {
    this._flushTimer = setInterval(() => this._flush(), 30_000); // every 30s
  }

  async _flush() {
    if (!this._events.length || !this._sessionId) return;

    const batch = [...this._events];
    this._events = [];

    try {
      await fetch(`/api/consultations/${this._sessionId}/analytics/client`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ events: batch }),
        keepalive: true, // survives page close
      });
    } catch {
      // Put events back on failure
      this._events = [...batch, ...this._events];
    }
  }

  stop() {
    this.track('session_end', {
      totalDuration: this._startTime ? Date.now() - this._startTime : 0,
    });
    this._flush();
    clearInterval(this._flushTimer);
    this._events    = [];
    this._startTime = null;
    this._sessionId = null;
  }
}

export const consultationAnalyticsService = new ConsultationAnalyticsService();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// consultationRecoveryService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Persists minimal session state to sessionStorage.
 * On hard refresh: restores consultationId, role, joinDetails.
 * Allows rejoining without consent re-prompt.
 */

const RECOVERY_KEY = 'likeson_consultation_session';

export const consultationRecoveryService = {
  save(data) {
    try {
      const payload = {
        consultationId: data.consultationId,
        role:           data.role,
        participantRole:data.participantRole,
        savedAt:        Date.now(),
        // Never save JWT token or sensitive tokens
        meetingId:      data.meetingId,
      };
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(payload));
    } catch {
      // sessionStorage may be full or unavailable
    }
  },

  load(consultationId) {
    try {
      const raw = sessionStorage.getItem(RECOVERY_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);

      // Validate: same consultation + not stale (< 2h)
      if (data.consultationId !== consultationId) return null;
      if (Date.now() - data.savedAt > 2 * 60 * 60 * 1000) {
        this.clear();
        return null;
      }

      return data;
    } catch {
      return null;
    }
  },

  clear() {
    try {
      sessionStorage.removeItem(RECOVERY_KEY);
    } catch {}
  },

  /**
   * Check if user was in this consultation (for reconnect flow).
   */
  wasInConsultation(consultationId) {
    const data = this.load(consultationId);
    return data !== null;
  },
};

export default {
  consultationPermissionService,
  consultationAnalyticsService,
  consultationRecoveryService,
};