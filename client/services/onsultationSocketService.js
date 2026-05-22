/**
 * consultationSocketService.js  — CLIENT
 *
 * Mirrors backend /consultation namespace (consultationSocketService.js).
 * Dedicated namespace: /consultation  — fully isolated from ride/booking socket.
 *
 * Usage:
 *   import consultationSocketService from '@/services/consultationSocketService';
 *   const svc = consultationSocketService.init(token);
 *   svc.joinConsultation(consultationId);
 */

import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS  (mirror backend)
// ─────────────────────────────────────────────────────────────────────────────

export const CONSULTATION_EVENTS = {
  // ── Server → Client ────────────────────────────────────────────────────────
  JOINED:                    'consultation:joined',
  PARTICIPANT_JOINED:        'consultation:participant_joined',
  PARTICIPANT_LEFT:          'consultation:participant_left',
  PARTICIPANT_MUTED:         'consultation:participant_muted',
  PARTICIPANT_REMOVED:       'consultation:participant_removed',
  PARTICIPANT_MIC_CHANGED:   'consultation:participant_mic_changed',
  PARTICIPANT_CAMERA_CHANGED:'consultation:participant_camera_changed',

  DOCTOR_JOINED:             'consultation:doctor_joined',
  PATIENT_JOINED:            'consultation:patient_joined',

  WAITING_ROOM_ENTERED:      'consultation:waiting_room_entered',
  WAITING_ROOM_UPDATED:      'consultation:waiting_room_updated',
  WAITING_ROOM_APPROVED:     'consultation:waiting_room_approved',
  WAITING_ROOM_REJECTED:     'consultation:waiting_room_rejected',

  CONSULTATION_STARTED:      'consultation:consultation_started',
  CONSULTATION_ENDED:        'consultation:consultation_ended',
  PAUSED:                    'consultation:paused',
  RESUMED:                   'consultation:resumed',
  CANCELLED:                 'consultation:cancelled',

  CHAT_MESSAGE:              'consultation:chat_message',
  HAND_RAISED:               'consultation:hand_raised',
  REACTION:                  'consultation:reaction',
  CALL_QUALITY_UPDATED:      'consultation:call_quality_updated',
  SCREEN_SHARE_STARTED:      'consultation:screen_share_started',
  SCREEN_SHARE_STOPPED:      'consultation:screen_share_stopped',
  RECORDING_STARTED:         'consultation:recording_started',
  RECORDING_STOPPED:         'consultation:recording_stopped',

  RECONNECTING:              'consultation:reconnecting',
  TOKEN_EXPIRING:            'consultation:token_expiring',
  STATE_SNAPSHOT:            'consultation:state_snapshot',
  AUTO_DISCONNECT:           'consultation:auto_disconnect',
  REMOVED:                   'consultation:removed',
  END_REQUESTED:             'consultation:end_requested',
  PRESCRIPTION_ISSUED:       'consultation:prescription_issued',
  FILE_UPLOADED:             'consultation:file_uploaded',

  PONG_HEALTH:               'pong_health',
  ERROR:                     'error',

  // ── Client → Server ────────────────────────────────────────────────────────
  // (used internally by emit methods below — exported for consumers who need raw access)
  C_JOIN:                    'consultation:join',
  C_LEAVE:                   'consultation:leave',
  C_WAITING_ROOM_ENTER:      'consultation:waiting_room_enter',
  C_CHAT_SEND:               'consultation:chat_send',
  C_TOGGLE_MIC:              'consultation:toggle_mic',
  C_TOGGLE_CAMERA:           'consultation:toggle_camera',
  C_RAISE_HAND:              'consultation:raise_hand',
  C_NETWORK_UPDATE:          'consultation:network_update',
  C_REACTION:                'consultation:reaction',
  C_END_REQUEST:             'consultation:end_request',
  C_START:                   'consultation:start',
  C_ADMIT_PATIENT:           'consultation:admit_patient',
  C_REJECT_PATIENT:          'consultation:reject_patient',
  C_MUTE_PARTICIPANT:        'consultation:mute_participant',
  C_REMOVE_PARTICIPANT:      'consultation:remove_participant',
  C_START_RECORDING:         'consultation:start_recording',
  C_STOP_RECORDING:          'consultation:stop_recording',
  C_SCREEN_SHARE_START:      'consultation:screen_share_start',
  C_SCREEN_SHARE_STOP:       'consultation:screen_share_stop',
  C_END_CONSULTATION:        'consultation:end_consultation',
  C_RECONNECTING:            'consultation:reconnecting',
  C_TOKEN_REFRESH_REQUEST:   'consultation:token_refresh_request',
  C_REQUEST_STATE:           'consultation:request_state',
  C_PING:                    'ping_health',
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ConsultationSocketService {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this._socket = null;

    /** Map<event, Set<handler>> — for clean teardown */
    this._listeners = new Map();
  }

  // ── Init / Destroy ─────────────────────────────────────────────────────────

  /**
   * Connect to /consultation namespace.
   * Safe to call multiple times — returns existing socket if already connected.
   * @param {string} token  JWT auth token
   * @returns {import('socket.io-client').Socket}
   */
  init(token) {
    if (this._socket?.connected) return this._socket;
    if (this._socket) this.destroy();

    const url = process.env.NEXT_PUBLIC_SOCKET_URL ||
                process.env.REACT_APP_SOCKET_URL   ||
                'http://localhost:5000';

    this._socket = io(`${url}/consultation`, {
      auth:             { token },
      transports:       ['websocket', 'polling'],
      reconnection:     true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout:          20_000,
      autoConnect:      true,
    });

    return this._socket;
  }

  /** Disconnect and clean up. */
  destroy() {
    if (!this._socket) return;
    this._listeners.forEach((handlers, event) =>
      handlers.forEach((fn) => this._socket.off(event, fn))
    );
    this._listeners.clear();
    this._socket.disconnect();
    this._socket = null;
  }

  get socket() { return this._socket; }
  get connected() { return this._socket?.connected ?? false; }

  // ── Event helpers ──────────────────────────────────────────────────────────

  /**
   * Subscribe to an event. Returns unsubscribe fn.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void}
   */
  on(event, handler) {
    if (!this._socket) return () => {};
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    this._socket.on(event, handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._socket?.off(event, handler);
    this._listeners.get(event)?.delete(handler);
  }

  once(event, handler) {
    this._socket?.once(event, handler);
  }

  emit(event, payload) {
    this._socket?.emit(event, payload);
  }

  // ── Patient / Common Actions ───────────────────────────────────────────────

  /** Join consultation room. */
  joinConsultation(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_JOIN, { consultationId });
  }

  /** Leave consultation room. */
  leaveConsultation(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_LEAVE, { consultationId });
  }

  /** Enter waiting room explicitly (re-enter). */
  enterWaitingRoom(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_WAITING_ROOM_ENTER, { consultationId });
  }

  /**
   * Send chat message.
   * @param {string} consultationId
   * @param {string} message
   * @param {'text'|'image'|'file'|'voice'} [messageType='text']
   * @param {Array} [attachments=[]]
   */
  sendChat(consultationId, message, messageType = 'text', attachments = []) {
    this.emit(CONSULTATION_EVENTS.C_CHAT_SEND, {
      consultationId, message, messageType, attachments,
    });
  }

  /** Toggle microphone. */
  toggleMic(consultationId, enabled) {
    this.emit(CONSULTATION_EVENTS.C_TOGGLE_MIC, { consultationId, enabled });
  }

  /** Toggle camera. */
  toggleCamera(consultationId, enabled) {
    this.emit(CONSULTATION_EVENTS.C_TOGGLE_CAMERA, { consultationId, enabled });
  }

  /** Raise / lower hand. */
  raiseHand(consultationId, raised) {
    this.emit(CONSULTATION_EVENTS.C_RAISE_HAND, { consultationId, raised });
  }

  /**
   * Report network quality to server (throttled server-side to 5s).
   * @param {string} consultationId
   * @param {'excellent'|'good'|'fair'|'poor'|'disconnected'} quality
   * @param {object} [metrics]
   */
  reportNetworkQuality(consultationId, quality, metrics = {}) {
    this.emit(CONSULTATION_EVENTS.C_NETWORK_UPDATE, {
      consultationId, quality, ...metrics,
    });
  }

  /** Send emoji reaction. */
  sendReaction(consultationId, emoji) {
    this.emit(CONSULTATION_EVENTS.C_REACTION, { consultationId, emoji });
  }

  /** Patient requests doctor to end session. */
  requestEnd(consultationId, reason = '') {
    this.emit(CONSULTATION_EVENTS.C_END_REQUEST, { consultationId, reason });
  }

  /** Signal reconnecting (for analytics). */
  signalReconnecting(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_RECONNECTING, { consultationId });
  }

  /** Request fresh token via REST (server signals client). */
  requestTokenRefresh(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_TOKEN_REFRESH_REQUEST, { consultationId });
  }

  /** Request full state snapshot (for reconnect recovery). */
  requestState(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_REQUEST_STATE, { consultationId });
  }

  /** Start screen share. */
  startScreenShare(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_SCREEN_SHARE_START, { consultationId });
  }

  /** Stop screen share. */
  stopScreenShare(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_SCREEN_SHARE_STOP, { consultationId });
  }

  // ── Doctor / Host Actions ──────────────────────────────────────────────────

  /** Doctor marks consultation active. */
  startConsultation(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_START, { consultationId });
  }

  /** Admit patient from waiting room. */
  admitPatient(consultationId, patientUserId) {
    this.emit(CONSULTATION_EVENTS.C_ADMIT_PATIENT, { consultationId, patientUserId });
  }

  /** Reject patient from waiting room. */
  rejectPatient(consultationId, patientUserId, reason = '') {
    this.emit(CONSULTATION_EVENTS.C_REJECT_PATIENT, { consultationId, patientUserId, reason });
  }

  /** Mute a participant (host only). */
  muteParticipant(consultationId, targetUserId) {
    this.emit(CONSULTATION_EVENTS.C_MUTE_PARTICIPANT, { consultationId, targetUserId });
  }

  /** Remove a participant (host only). */
  removeParticipant(consultationId, targetUserId, reason = '') {
    this.emit(CONSULTATION_EVENTS.C_REMOVE_PARTICIPANT, { consultationId, targetUserId, reason });
  }

  /** Start recording (host only). */
  startRecording(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_START_RECORDING, { consultationId });
  }

  /** Stop recording (host only). */
  stopRecording(consultationId) {
    this.emit(CONSULTATION_EVENTS.C_STOP_RECORDING, { consultationId });
  }

  /**
   * End consultation (host only).
   * @param {string} consultationId
   * @param {string} [reason]
   * @param {string} [summary]
   */
  endConsultation(consultationId, reason = '', summary = '') {
    this.emit(CONSULTATION_EVENTS.C_END_CONSULTATION, { consultationId, reason, summary });
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /** Heartbeat ping. */
  ping() {
    this.emit(CONSULTATION_EVENTS.C_PING);
  }

  /**
   * Promise-based one-shot listener.
   * @param {string} event
   * @param {number} [timeoutMs=10000]
   * @returns {Promise<any>}
   */
  waitFor(event, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
      this.once(event, (data) => { clearTimeout(timer); resolve(data); });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const consultationSocketService = new ConsultationSocketService();
export default consultationSocketService;