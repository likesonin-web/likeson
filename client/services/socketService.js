/**
 * socketService.js — Likeson.in Booking Socket Client
 *
 * FIXES vs previous version:
 *   1. verifyOtpAsync: filter by bookingId (not rideId — server doesn't send rideId in otp_result)
 *   2. Reconnect handler re-joins all active rooms (was lost on disconnect/reconnect)
 *   3. startCareGpsTracking: status is a getter param so it updates per-ping
 *   4. triggerSos: sosType uppercased to match server enum validation
 *   5. Added MILESTONE_RECORDED, DRIVER_REPLACED, RIDE_STARTED, RIDE_RESUMED,
 *      BOOKING_ASSIGNED, DRIVER_ACCEPTED, DRIVER_EN_ROUTE to SOCKET_EVENTS
 *   6. Added updateCareStatus — lets CA update status mid-ride without restarting GPS watch
 *   7. stopAllTracking() helper for cleanup
 */

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EVENTS (server → client)
// ─────────────────────────────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  // ── Connection ──────────────────────────────────────────────────────────────
  JOINED_ROOM:                'joined_room',
  LEFT_ROOM:                  'left_room',
  PARTICIPANT_JOINED:         'participant_joined',
  PARTICIPANT_LEFT:           'participant_left',
  DRIVER_ONLINE:              'driver_online',
  DRIVER_OFFLINE:             'driver_offline',

  // ── Driver location ─────────────────────────────────────────────────────────
  DRIVER_LOCATION:            'driver_location',
  LOCATION_UPDATE:            'location_update',

  // ── Driver status ─────────────────────────────────────────────────────────────
  DRIVER_ACCEPTED:            'driver_accepted',
  DRIVER_EN_ROUTE:            'driver_en_route',
  DRIVER_ARRIVED:             'driver_arrived',
  DRIVER_REPLACED:            'driver_replaced',
  RIDE_STARTED:               'ride_started',
  RIDE_RESUMED:               'ride_resumed',

  // ── Care assistant location / status ────────────────────────────────────────
  CARE_ASSISTANT_LOCATION_UPDATE: 'care_assistant_location_update',
  CARE_ASSISTANT_STATUS_CHANGE:   'care_assistant_status_change',
  CARE_ASSISTANT_JOINED_RIDE:     'care_assistant_joined_ride',
  CARE_ASSISTANT_ATTACHED:        'care_assistant_attached_to_ride',
  CARE_ASSISTANT_AT_JP:           'care_assistant_at_jp',
  CA_JOIN_WAYPOINT_COMPLETED:     'ca_join_waypoint_completed',
  CARE_REACHED_JP:                'care_reached_jp',

  // ── Join point (rideOperationsRouter) ───────────────────────────────────────
  JOIN_POINT_CALCULATED:      'join_point_calculated',
  JOIN_POINT_STATUS_CHANGED:  'join_point_status_changed',
  JOIN_POINT_MISSED:          'join_point_missed',
  JOIN_POINT_RECALCULATED:    'join_point_recalculated',
  CA_MISSED_JOINPOINT:        'ca_missed_joinpoint',

  // ── Ride stops (rideOperationsRouter) ───────────────────────────────────────
  STOP_OTP_VERIFIED:          'stop_otp_verified',
  STOP_STATUS_CHANGED:        'stop_status_changed',
  STOP_ARRIVED:               'stop_arrived',
  STOP_DEPARTED:              'stop_departed',

  // ── Participants (rideOperationsRouter) ─────────────────────────────────────
  PARTICIPANT_ASSIGNED:       'participant_assigned',
  PARTICIPANT_STATUS_CHANGE:  'participant_status_change',
  PARTICIPANT_REMOVED:        'participant_removed',

  // ── Destination change ───────────────────────────────────────────────────────
  DESTINATION_CHANGED:        'destination_changed',

  // ── ETA ─────────────────────────────────────────────────────────────────────
  ETA_UPDATE:                 'eta_update',
  HOSPITAL_ETA_UPDATE:        'hospital_eta_update',

  // ── Ride / booking status ────────────────────────────────────────────────────
  RIDE_STATUS_CHANGED:        'ride_status_changed',
  RIDE_STAGE_CHANGED:         'ride_stage_changed',
  BOOKING_STATUS_CHANGE:      'booking_status_change',
  BOOKING_ASSIGNED:           'booking_assigned',
  NAVIGATION_TARGET_CHANGED:  'navigation_target_changed',
  STATUS_UPDATE_ACK:          'status_update_ack',

  // ── OTP ─────────────────────────────────────────────────────────────────────
  OTP_RESULT:                 'otp_result',
  OTP_WRONG_ATTEMPT:          'otp_wrong_attempt',
  OTP_RESEND_REQUESTED:       'otp_resend_requested',
  OTP_FOR_ADMIN:              'otp_for_admin',
  OTP_FAILED_ATTEMPT:         'otp_failed_attempt',
  OTP_REQUIRED:               'otp_required',

  // ── SOS ─────────────────────────────────────────────────────────────────────
  SOS_ALERT:                  'sos_alert',
  SOS_ACK:                    'sos_ack',
  SOS_TRIGGERED:              'sos_triggered',
  SOS_RESOLVED:               'sos_resolved',

  // ── Milestones ────────────────────────────────────────────────────────────────
  MILESTONE_RECORDED:         'milestone_recorded',

  // ── Route ───────────────────────────────────────────────────────────────────
  ROUTE_DEVIATION_ALERT:      'route_deviation_alert',

  // ── Snapshots / state ────────────────────────────────────────────────────────
  BOOKING_STATE_SNAPSHOT:     'booking_state_snapshot',
  RIDE_STOPS_SNAPSHOT:        'ride_stops_snapshot',
  PARTICIPANTS_SNAPSHOT:      'participants_snapshot',

  // ── Return ride ─────────────────────────────────────────────────────────────
  RETURN_RIDE_ACTIVATED:      'return_ride_activated',

  // ── Ride events ─────────────────────────────────────────────────────────────
  RIDE_COMPLETED:             'ride_completed',
  RIDE_CANCELLED:             'ride_cancelled',
  RIDE_REQUESTED:             'ride_requested',
  RIDE_ASSIGNED:              'ride_assigned',

  // ── Care ride ───────────────────────────────────────────────────────────────
  CARE_ARRIVED:               'care_arrived',
  CARE_COMPLETED:             'care_completed',

  // ── Consultation ────────────────────────────────────────────────────────────
  CONSULTATION_CONFIRMED:     'consultation_confirmed',
  CONSULTATION_ACCEPTED:      'consultation_accepted',
  CONSULTATION_STARTED:       'consultation_started',
  CONSULTATION_ENDED:         'consultation_ended',
  CHAT_MESSAGE:               'chat_message',

  // ── Health ──────────────────────────────────────────────────────────────────
  PONG_HEALTH:                'pong_health',

  // ── Error ───────────────────────────────────────────────────────────────────
  ERROR:                      'error',
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT EVENTS (client → server)
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_EVENTS = {
  JOIN_BOOKING_ROOM:        'join_booking_room',
  JOIN_TP_ROOM:             'join_tp_room',
  LEAVE_BOOKING_ROOM:       'leave_booking_room',
  LEAVE_TP_ROOM:            'leave_tp_room',

  DRIVER_LOCATION:          'driver_location',
  CARE_LOCATION:            'care_location',
  CARE_ASSISTANT_LOCATION:  'care_assistant_location',

  DRIVER_STATUS_UPDATE:     'driver_status_update',
  VERIFY_OTP:               'verify_otp',
  OTP_RESEND_REQUEST:       'otp_resend_request',

  SOS_TRIGGER:              'sos_trigger',
  ROUTE_DEVIATION:          'route_deviation',

  CA_MISSED_JOINPOINT:      'ca_missed_joinpoint',

  REQUEST_BOOKING_STATE:    'request_booking_state',
  REQUEST_RIDE_STOPS:       'request_ride_stops',
  REQUEST_PARTICIPANTS:     'request_participants',

  PING_HEALTH:              'ping_health',
};

// FIX: uppercase to match server SOS_TYPES enum exactly
export const SOS_TYPES = {
  MEDICAL:           'MEDICAL',
  SAFETY:            'SAFETY',
  VEHICLE_BREAKDOWN: 'VEHICLE_BREAKDOWN',
  ACCIDENT:          'ACCIDENT',
  PATIENT_CONDITION: 'PATIENT_CONDITION',
  OTHER:             'OTHER',
};

export const DRIVER_STATUS = {
  ACCEPTED:      'accepted',
  START_ROUTE:   'start_route',
  ARRIVED:       'arrived',
  VERIFY_OTP:    'verify_otp',
  START_RIDE:    'start_ride',
  AT_STOP:       'at_stop',
  RESUME:        'resume',
  COMPLETE:      'complete',
  CANCEL:        'cancel',
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SocketService {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this._socket          = null;
    this._currentToken    = null;
    this._pendingEmits    = [];
    this._gpsWatchId      = null;
    this._careGpsWatchId  = null;
    this._activeBookingId = null;
    // FIX: track joined rooms for reconnect re-join
    this._joinedRooms     = new Set();
    // FIX: CA status ref — mutable so GPS watch always sends current status
    this._careStatus      = null;
  }

  // ── Init / Destroy ─────────────────────────────────────────────────────────

  init(token) {
    if (this._socket?.connected) {
      if (this._currentToken === token) {
        console.warn('[Socket] Already connected with this token');
        return this._socket;
      }
      console.warn('[Socket] Token changed, reconnecting...');
      this.destroy();
    }

    this._currentToken = token;
    this._socket = io(SOCKET_URL, {
      auth:                 (cb) => cb({ token: this._currentToken || '' }),
      transports:           ['websocket', 'polling'],
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1_000,
      reconnectionDelayMax: 10_000,
      timeout:              20_000,
    });

    this._socket.on('connect', () => {
      console.log('[Socket] Connected:', this._socket.id);
      // Flush pending emits
      for (const { event, payload } of this._pendingEmits) {
        this._socket.emit(event, payload);
      }
      this._pendingEmits = [];
    });

    // FIX: re-join all rooms on reconnect (connect fires on initial + reconnect both)
    // socket.io 'connect' fires on every successful connection including reconnects
    // so room re-join is handled in the connect handler above via _joinedRooms
    this._socket.on('connect', () => {
      for (const room of this._joinedRooms) {
        if (room.startsWith('booking:')) {
          const bookingId = room.replace('booking:', '');
          this._socket.emit(CLIENT_EVENTS.JOIN_BOOKING_ROOM, { bookingId });
        } else if (room.startsWith('tp:')) {
          const tpId = room.replace('tp:', '');
          this._socket.emit(CLIENT_EVENTS.JOIN_TP_ROOM, { tpId });
        }
      }
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

  destroy() {
    this.stopAllTracking();
    this._activeBookingId = null;
    this._pendingEmits    = [];
    this._currentToken    = null;
    this._joinedRooms.clear();
    this._careStatus      = null;
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    console.log('[Socket] Destroyed');
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get connected() { return this._socket?.connected ?? false; }
  get id()        { return this._socket?.id         ?? null; }

  // ── Event helpers ──────────────────────────────────────────────────────────

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  on(event, handler) {
    this._socket?.on(event, handler);
    return () => this._socket?.off(event, handler);
  }

  once(event, handler) { this._socket?.once(event, handler); }
  off(event, handler)  { this._socket?.off(event, handler);  }

  emit(event, payload = {}) {
    if (this._socket?.connected) {
      this._socket.emit(event, payload);
    } else {
      this._pendingEmits.push({ event, payload });
    }
  }

  // ── Room management ────────────────────────────────────────────────────────

  joinBookingRoom(bookingId) {
    if (!bookingId) return;
    this._activeBookingId = bookingId;
    this._joinedRooms.add(`booking:${bookingId}`);
    this.emit(CLIENT_EVENTS.JOIN_BOOKING_ROOM, { bookingId });
  }

  leaveBookingRoom(bookingId) {
    const id = bookingId ?? this._activeBookingId;
    this._joinedRooms.delete(`booking:${id}`);
    this.emit(CLIENT_EVENTS.LEAVE_BOOKING_ROOM, { bookingId: id });
    if (this._activeBookingId === id) this._activeBookingId = null;
  }

  joinTpRoom(tpId) {
    if (!tpId) return;
    this._joinedRooms.add(`tp:${tpId}`);
    this.emit(CLIENT_EVENTS.JOIN_TP_ROOM, { tpId });
  }

  leaveTpRoom(tpId) {
    this._joinedRooms.delete(`tp:${tpId}`);
    this.emit(CLIENT_EVENTS.LEAVE_TP_ROOM, { tpId });
  }

  // ── State requests ─────────────────────────────────────────────────────────

  requestBookingState(bookingId) {
    this.emit(CLIENT_EVENTS.REQUEST_BOOKING_STATE, { bookingId });
  }

  requestRideStops({ rideId } = {}) {
    this.emit(CLIENT_EVENTS.REQUEST_RIDE_STOPS, { rideId });
  }

  requestParticipants({ rideId } = {}) {
    this.emit(CLIENT_EVENTS.REQUEST_PARTICIPANTS, { rideId });
  }

  // ── DRIVER GPS tracking ────────────────────────────────────────────────────

  startGpsTracking({ bookingId } = {}) {
    if (!navigator?.geolocation) {
      console.warn('[Socket] Geolocation not supported');
      return;
    }
    this.stopGpsTracking();
    this._gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh =
          pos.coords.speed != null && pos.coords.speed >= 0
            ? +(pos.coords.speed * 3.6).toFixed(1)
            : undefined;
        this.emit(CLIENT_EVENTS.DRIVER_LOCATION, {
          bookingId: bookingId ?? this._activeBookingId ?? undefined,
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading  ?? undefined,
          speed:     speedKmh,
          accuracy:  pos.coords.accuracy ?? undefined,
        });
      },
      (err) => console.error('[GPS Driver]', err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  stopGpsTracking() {
    if (this._gpsWatchId !== null) {
      navigator?.geolocation?.clearWatch(this._gpsWatchId);
      this._gpsWatchId = null;
    }
  }

  // ── CARE ASSISTANT GPS tracking ────────────────────────────────────────────

  /**
   * startCareGpsTracking — begin CA GPS watch.
   *
   * FIX: status is read from this._careStatus on each ping (not captured at start).
   * Call updateCareStatus('at_join_point') mid-ride — next GPS ping sends updated status.
   *
   * @param {{ bookingId?: string, initialStatus?: string }} options
   */
  startCareGpsTracking({ bookingId, initialStatus } = {}) {
    if (!navigator?.geolocation) {
      console.warn('[Socket] Geolocation not supported');
      return;
    }
    if (initialStatus) this._careStatus = initialStatus;
    this.stopCareGpsTracking();
    this._careGpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh =
          pos.coords.speed != null && pos.coords.speed >= 0
            ? +(pos.coords.speed * 3.6).toFixed(1)
            : undefined;
        this.emit(CLIENT_EVENTS.CARE_LOCATION, {
          bookingId: bookingId ?? this._activeBookingId ?? undefined,
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading  ?? undefined,
          speed:     speedKmh,
          accuracy:  pos.coords.accuracy ?? undefined,
          // FIX: read live from _careStatus ref, not closure-captured value
          status:    this._careStatus ?? undefined,
        });
      },
      (err) => console.error('[GPS Care]', err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  stopCareGpsTracking() {
    if (this._careGpsWatchId !== null) {
      navigator?.geolocation?.clearWatch(this._careGpsWatchId);
      this._careGpsWatchId = null;
    }
  }

  /**
   * updateCareStatus — update CA status mid-ride without restarting GPS watch.
   * Next GPS ping will include new status automatically.
   *
   * @param {string} status — e.g. 'en_route_to_pickup', 'at_join_point', 'in_ride', 'departed'
   */
  updateCareStatus(status) {
    this._careStatus = status;
  }

  /**
   * emitCareLocation — single CA location ping (not continuous watch).
   */
  emitCareLocation({ bookingId, lat, lng, heading, speed, status } = {}) {
    this.emit(CLIENT_EVENTS.CARE_LOCATION, {
      bookingId: bookingId ?? this._activeBookingId ?? undefined,
      lat,
      lng,
      heading:  heading ?? undefined,
      speed:    speed   ?? undefined,
      status:   status ?? this._careStatus ?? undefined,
    });
  }

  /**
   * emitLocation — generic location emit.
   * isCare=true → care_location. isCare=false → driver_location.
   */
  emitLocation({ bookingId, lat, lng, heading, speed, isCare = false, status } = {}) {
    const event = isCare ? CLIENT_EVENTS.CARE_LOCATION : CLIENT_EVENTS.DRIVER_LOCATION;
    this.emit(event, {
      bookingId: bookingId ?? this._activeBookingId ?? undefined,
      lat,
      lng,
      heading:  heading ?? undefined,
      speed:    speed   ?? undefined,
      ...(isCare ? { status: status ?? this._careStatus ?? undefined } : {}),
    });
  }

  // ── Stop all GPS tracking ──────────────────────────────────────────────────

  stopAllTracking() {
    this.stopGpsTracking();
    this.stopCareGpsTracking();
  }

  // ── Driver status ──────────────────────────────────────────────────────────

  updateDriverStatus({ bookingId, rideId, status, lat, lng, meta } = {}) {
    this.emit(CLIENT_EVENTS.DRIVER_STATUS_UPDATE, { bookingId, rideId, status, lat, lng, meta });
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  verifyOtp({ bookingId, rideId, otp }) {
    this.emit(CLIENT_EVENTS.VERIFY_OTP, { bookingId, rideId, otp });
  }

  requestOtpResend(bookingId) {
    this.emit(CLIENT_EVENTS.OTP_RESEND_REQUEST, { bookingId });
  }

  // ── SOS ────────────────────────────────────────────────────────────────────

  /**
   * FIX: sosType uppercased — server validates against SOS_TYPES enum (uppercase).
   * Lowercase 'other' was failing validation silently.
   */
  triggerSos({ bookingId, rideId, lat, lng, sosType = SOS_TYPES.OTHER, description } = {}) {
    this.emit(CLIENT_EVENTS.SOS_TRIGGER, {
      bookingId,
      rideId,
      lat,
      lng,
      sosType:     String(sosType).toUpperCase(), // force uppercase regardless of caller
      description: description ?? undefined,
    });
  }

  // ── Route deviation ────────────────────────────────────────────────────────

  reportRouteDeviation({ bookingId, rideId, lat, lng, deviationKm, driverReason } = {}) {
    this.emit(CLIENT_EVENTS.ROUTE_DEVIATION, { bookingId, rideId, lat, lng, deviationKm, driverReason });
  }

  // ── CA join point ──────────────────────────────────────────────────────────

  emitCaMissedJoinpoint({ bookingId, rideId, reason } = {}) {
    this.emit(CLIENT_EVENTS.CA_MISSED_JOINPOINT, {
      bookingId,
      rideId,
      reason: reason ?? '',
    });
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  pingHealth() { this.emit(CLIENT_EVENTS.PING_HEALTH); }

  // ── Promise wrappers ───────────────────────────────────────────────────────

  /**
   * verifyOtpAsync
   * FIX: server otp_result does NOT include rideId — filter by bookingId instead.
   * Was: `if (data.rideId && data.rideId !== rideId) return;` → always skipped.
   */
  verifyOtpAsync({ bookingId, rideId, otp }, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.OTP_RESULT, handler);
        reject(new Error('OTP verify timeout'));
      }, timeoutMs);
      const handler = (data) => {
        // FIX: filter by bookingId if present, otherwise accept first result
        if (data.bookingId && data.bookingId !== bookingId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.OTP_RESULT, handler);
        if (data.success) resolve(data);
        else reject(new Error(data.message || 'OTP failed'));
      };
      this._socket.on(SOCKET_EVENTS.OTP_RESULT, handler);
      this.verifyOtp({ bookingId, rideId, otp });
    });
  }

  requestBookingStateAsync(bookingId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
        reject(new Error('State snapshot timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.bookingId && data.bookingId !== bookingId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
        resolve(data);
      };
      this._socket.on(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
      this.requestBookingState(bookingId);
    });
  }

  requestRideStopsAsync(rideId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, handler);
        reject(new Error('Ride stops snapshot timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.rideId && data.rideId !== rideId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, handler);
        resolve(data);
      };
      this._socket.on(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, handler);
      this.requestRideStops({ rideId });
    });
  }

  requestParticipantsAsync(rideId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, handler);
        reject(new Error('Participants snapshot timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.rideId && data.rideId !== rideId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, handler);
        resolve(data);
      };
      this._socket.on(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, handler);
      this.requestParticipants({ rideId });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

export const socketService = new SocketService();
export default socketService;