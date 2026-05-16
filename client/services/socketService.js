/**
 * socketService.js — Likeson.in Booking Socket Client
 * Matches bookingSocketService.js (PRODUCTION v4)
 *
 * Usage:
 *   import { socketService } from '@/services/socketService';
 *   socketService.init(token);
 *   socketService.joinBookingRoom(bookingId);
 *   socketService.on('location_update', handler);
 */

import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

/**
 * All events emitted BY server → listen with .on()
 */
export const SOCKET_EVENTS = {
  // Connection
  JOINED_ROOM:               'joined_room',
  LEFT_ROOM:                 'left_room',
  PARTICIPANT_JOINED:        'participant_joined',
  PARTICIPANT_LEFT:          'participant_left',
  DRIVER_ONLINE:             'driver_online',
  DRIVER_OFFLINE:            'driver_offline',

  // Location
  LOCATION_UPDATE:           'location_update',
  DRIVER_LOCATION:           'driver_location',    // admin:ops only
  CARE_ASSISTANT_LOCATION:   'care_assistant_location',

  // ETA
  ETA_UPDATE:                'eta_update',

  // Ride status
  RIDE_STATUS_CHANGED:       'ride_status_changed',
  BOOKING_STATUS_CHANGE:     'booking_status_change',
  NAVIGATION_TARGET_CHANGED: 'navigation_target_changed',
  STATUS_UPDATE_ACK:         'status_update_ack',

  // OTP
  OTP_RESULT:                'otp_result',
  OTP_WRONG_ATTEMPT:         'otp_wrong_attempt',
  OTP_RESEND_REQUESTED:      'otp_resend_requested',
  OTP_FOR_ADMIN:             'otp_for_admin',        // admin:ops only
  OTP_FAILED_ATTEMPT:        'otp_failed_attempt',   // admin:ops only

  // SOS
  SOS_ALERT:                 'sos_alert',
  SOS_ACK:                   'sos_ack',

  // Route
  ROUTE_DEVIATION_ALERT:     'route_deviation_alert',

  // Snapshot (reconnect)
  BOOKING_STATE_SNAPSHOT:    'booking_state_snapshot',

  // Health
  PONG_HEALTH:               'pong_health',

  // Error
  ERROR:                     'error',
};

/**
 * All events emitted BY client → send with .emit()
 */
export const CLIENT_EVENTS = {
  JOIN_BOOKING_ROOM:    'join_booking_room',
  JOIN_TP_ROOM:         'join_tp_room',
  LEAVE_BOOKING_ROOM:   'leave_booking_room',
  LEAVE_TP_ROOM:        'leave_tp_room',

  DRIVER_LOCATION:      'driver_location',
  CARE_LOCATION:        'care_location',

  DRIVER_STATUS_UPDATE: 'driver_status_update',
  VERIFY_OTP:           'verify_otp',
  OTP_RESEND_REQUEST:   'otp_resend_request',

  SOS_TRIGGER:          'sos_trigger',
  ROUTE_DEVIATION:      'route_deviation',

  REQUEST_BOOKING_STATE:'request_booking_state',
  PING_HEALTH:          'ping_health',
};

/**
 * Driver app status keys → server DRIVER_STATUS_MAP
 */
export const DRIVER_STATUS = {
  ACCEPTED:      'accepted',
  EN_ROUTE:      'en_route',
  ARRIVED:       'arrived',
  OTP_VERIFIED:  'otp_verified',
  RIDE_STARTED:  'ride_started',
  AT_STOP:       'at_stop',
  STOP_DEPARTED: 'stop_departed',
  COMPLETED:     'completed',
  CANCELLED:     'cancelled',
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SocketService {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this._socket = null;

    /** Queued events before connect */
    this._pendingEmits = [];

    /** GPS watch ID for cleanup */
    this._gpsWatchId = null;

    /** Active booking room */
    this._activeBookingId = null;
  }

  // ── Init / Destroy ─────────────────────────────────────────────────────────

  /**
   * init — connect socket with JWT token.
   * Call once: after user logs in.
   *
   * @param {string} token - JWT access token
   */
  init(token) {
    if (this._socket?.connected) {
      console.warn('[Socket] Already connected');
      return this._socket;
    }

    this._socket = io(SOCKET_URL, {
      auth:            { token },
      transports:      ['websocket', 'polling'],
      reconnection:    true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1_000,
      reconnectionDelayMax: 10_000,
      timeout:         20_000,
    });

    this._socket.on('connect', () => {
      console.log('[Socket] Connected:', this._socket.id);
      // Flush pending emits
      for (const { event, payload } of this._pendingEmits) {
        this._socket.emit(event, payload);
      }
      this._pendingEmits = [];
    });

    this._socket.on('connect_error', (err) => {
      console.error('[Socket] Connect error:', err.message);
    });

    this._socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });

    this._socket.on('error', (err) => {
      console.error('[Socket] Server error:', err?.message ?? err);
    });

    return this._socket;
  }

  /**
   * destroy — disconnect + cleanup GPS.
   * Call on logout.
   */
  destroy() {
    this.stopGpsTracking();
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    this._pendingEmits    = [];
    this._activeBookingId = null;
    console.log('[Socket] Destroyed');
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get connected() {
    return this._socket?.connected ?? false;
  }

  get id() {
    return this._socket?.id ?? null;
  }

  // ── Event helpers ──────────────────────────────────────────────────────────

  /**
   * on — subscribe to server event.
   * Returns unsubscribe fn.
   *
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    this._socket?.on(event, handler);
    return () => this._socket?.off(event, handler);
  }

  /**
   * once — subscribe to server event once.
   */
  once(event, handler) {
    this._socket?.once(event, handler);
  }

  off(event, handler) {
    this._socket?.off(event, handler);
  }

  /**
   * emit — send event.
   * Queues if not connected yet.
   *
   * @param {string} event
   * @param {object} payload
   */
  emit(event, payload = {}) {
    if (this._socket?.connected) {
      this._socket.emit(event, payload);
    } else {
      this._pendingEmits.push({ event, payload });
    }
  }

  // ── Room management ────────────────────────────────────────────────────────

  /**
   * joinBookingRoom — join booking:{bookingId} room.
   * Server verifies auth before allowing join.
   */
  joinBookingRoom(bookingId) {
    if (!bookingId) return;
    this._activeBookingId = bookingId;
    this.emit(CLIENT_EVENTS.JOIN_BOOKING_ROOM, { bookingId });
  }

  leaveBookingRoom(bookingId) {
    this.emit(CLIENT_EVENTS.LEAVE_BOOKING_ROOM, { bookingId: bookingId ?? this._activeBookingId });
    if (this._activeBookingId === bookingId) this._activeBookingId = null;
  }

  joinTpRoom(tpId) {
    this.emit(CLIENT_EVENTS.JOIN_TP_ROOM, { tpId });
  }

  leaveTpRoom(tpId) {
    this.emit(CLIENT_EVENTS.LEAVE_TP_ROOM, { tpId });
  }

  // ── Booking state ──────────────────────────────────────────────────────────

  /**
   * requestBookingState — full snapshot on reconnect.
   * Listen for BOOKING_STATE_SNAPSHOT.
   */
  requestBookingState(bookingId) {
    this.emit(CLIENT_EVENTS.REQUEST_BOOKING_STATE, { bookingId });
  }

  // ── GPS tracking ───────────────────────────────────────────────────────────

  /**
   * startGpsTracking — continuously emit driver_location using browser Geolocation.
   * Only call for driver/solodriverpartner role.
   *
   * @param {{ bookingId?: string, intervalMs?: number }} opts
   */
  startGpsTracking({ bookingId, intervalMs = 3_000 } = {}) {
    if (!navigator?.geolocation) {
      console.warn('[Socket] Geolocation not supported');
      return;
    }

    this.stopGpsTracking(); // clear existing

    this._gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.emit(CLIENT_EVENTS.DRIVER_LOCATION, {
          bookingId: bookingId ?? this._activeBookingId ?? undefined,
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading   ?? undefined,
          speed:     pos.coords.speed     !== null ? pos.coords.speed * 3.6 : undefined, // m/s → km/h
          accuracy:  pos.coords.accuracy  ?? undefined,
        });
      },
      (err) => console.error('[GPS]', err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  stopGpsTracking() {
    if (this._gpsWatchId !== null) {
      navigator?.geolocation?.clearWatch(this._gpsWatchId);
      this._gpsWatchId = null;
    }
  }

  /**
   * emitLocation — manual single GPS emit (care assistant or custom).
   */
  emitLocation({ bookingId, lat, lng, isCare = false }) {
    const event = isCare ? CLIENT_EVENTS.CARE_LOCATION : CLIENT_EVENTS.DRIVER_LOCATION;
    this.emit(event, { bookingId, lat, lng });
  }

  // ── Driver status ──────────────────────────────────────────────────────────

  /**
   * updateDriverStatus — transition ride status.
   *
   * @param {{ bookingId: string, rideId: string, status: string, lat?: number, lng?: number, meta?: object }} opts
   */
  updateDriverStatus({ bookingId, rideId, status, lat, lng, meta } = {}) {
    this.emit(CLIENT_EVENTS.DRIVER_STATUS_UPDATE, { bookingId, rideId, status, lat, lng, meta });
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  /**
   * verifyOtp — sole OTP path (HTTP /ride/start removed).
   * Listen for OTP_RESULT.
   */
  verifyOtp({ bookingId, rideId, otp }) {
    this.emit(CLIENT_EVENTS.VERIFY_OTP, { bookingId, rideId, otp });
  }

  /**
   * requestOtpResend — customer asks driver to re-show OTP screen.
   */
  requestOtpResend(bookingId) {
    this.emit(CLIENT_EVENTS.OTP_RESEND_REQUEST, { bookingId });
  }

  // ── SOS ────────────────────────────────────────────────────────────────────

  /**
   * triggerSos — emergency SOS.
   * Listen for SOS_ACK.
   */
  triggerSos({ bookingId, rideId, lat, lng, sosType = 'other', description } = {}) {
    this.emit(CLIENT_EVENTS.SOS_TRIGGER, { bookingId, rideId, lat, lng, sosType, description });
  }

  // ── Route deviation ────────────────────────────────────────────────────────

  reportRouteDeviation({ bookingId, rideId, lat, lng, deviationKm, driverReason } = {}) {
    this.emit(CLIENT_EVENTS.ROUTE_DEVIATION, { bookingId, rideId, lat, lng, deviationKm, driverReason });
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  pingHealth() {
    this.emit(CLIENT_EVENTS.PING_HEALTH);
  }

  // ── Promise wrappers ───────────────────────────────────────────────────────

  /**
   * verifyOtpAsync — promise-based OTP verify.
   * Resolves/rejects with otp_result payload.
   *
   * @param {{ bookingId: string, rideId: string, otp: string }} opts
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  verifyOtpAsync({ bookingId, rideId, otp }, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('OTP verify timeout')), timeoutMs);

      this.once(SOCKET_EVENTS.OTP_RESULT, (data) => {
        clearTimeout(timer);
        if (data.success) resolve(data);
        else reject(new Error(data.message || 'OTP failed'));
      });

      this.verifyOtp({ bookingId, rideId, otp });
    });
  }

  /**
   * requestBookingStateAsync — promise-based state snapshot.
   *
   * @param {string} bookingId
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  requestBookingStateAsync(bookingId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('State snapshot timeout')), timeoutMs);

      this.once(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, (data) => {
        clearTimeout(timer);
        resolve(data);
      });

      this.requestBookingState(bookingId);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const socketService = new SocketService();
export default socketService;