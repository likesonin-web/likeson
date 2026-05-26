/**
 * socketService.js — Likeson.in Booking Socket Client
 * Matches bookingSocketService.js (PRODUCTION v5)
 */

import { io } from "socket.io-client";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

export const SOCKET_EVENTS = {
  // Connection
  JOINED_ROOM: "joined_room",
  LEFT_ROOM: "left_room",
  PARTICIPANT_JOINED: "participant_joined",
  PARTICIPANT_LEFT: "participant_left",
  DRIVER_ONLINE: "driver_online",
  DRIVER_OFFLINE: "driver_offline",

  // Location
  LOCATION_UPDATE: "location_update",
  DRIVER_LOCATION: "driver_location", // admin:ops only
  CARE_ASSISTANT_LOCATION: "care_assistant_location",
  HOSPITAL_ETA_UPDATE: "hospital_eta_update",
  CARE_ASSISTANT_JOINED_RIDE: "care_assistant_joined_ride",
  CARE_ASSISTANT_ATTACHED: "care_assistant_attached_to_ride",

  // ETA
  ETA_UPDATE: "eta_update",

  // Ride status
  RIDE_STATUS_CHANGED: "ride_status_changed",
  BOOKING_STATUS_CHANGE: "booking_status_change",
  NAVIGATION_TARGET_CHANGED: "navigation_target_changed",
  STATUS_UPDATE_ACK: "status_update_ack",

  // OTP
  OTP_RESULT: "otp_result",
  OTP_WRONG_ATTEMPT: "otp_wrong_attempt",
  OTP_RESEND_REQUESTED: "otp_resend_requested",
  OTP_FOR_ADMIN: "otp_for_admin", // admin:ops only
  OTP_FAILED_ATTEMPT: "otp_failed_attempt", // admin:ops only

  // SOS
  SOS_ALERT: "sos_alert",
  SOS_ACK: "sos_ack",

  // Route
  ROUTE_DEVIATION_ALERT: "route_deviation_alert",

  // Snapshot (reconnect)
  BOOKING_STATE_SNAPSHOT: "booking_state_snapshot",

  // Health
  PONG_HEALTH: "pong_health",

  // Error
  ERROR: "error",
  HOSPITAL_ETA_UPDATE: "hospital_eta_update", // was 'hospital:eta:update' — RENAMED
  CARE_ASSISTANT_TRACKING: "care-assistant:ride:tracking",
  RIDE_STAGE_CHANGED: "ride_stage_changed",
};

export const CLIENT_EVENTS = {
  JOIN_BOOKING_ROOM: "join_booking_room",
  JOIN_TP_ROOM: "join_tp_room",
  LEAVE_BOOKING_ROOM: "leave_booking_room",
  LEAVE_TP_ROOM: "leave_tp_room",

  DRIVER_LOCATION: "driver_location",
  CARE_LOCATION: "care_location",

  DRIVER_STATUS_UPDATE: "driver_status_update",
  VERIFY_OTP: "verify_otp",
  OTP_RESEND_REQUEST: "otp_resend_request",

  SOS_TRIGGER: "sos_trigger",
  ROUTE_DEVIATION: "route_deviation",

  REQUEST_BOOKING_STATE: "request_booking_state",
  PING_HEALTH: "ping_health",
  CARE_ASSISTANT_LOCATION: "care_assistant_location",
};

export const DRIVER_STATUS = {
  ACCEPTED: "accepted",
  EN_ROUTE: "en_route",
  ARRIVED: "arrived",
  OTP_VERIFIED: "otp_verified",
  RIDE_STARTED: "ride_started",
  AT_STOP: "at_stop",
  STOP_DEPARTED: "stop_departed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SocketService {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this._socket = null;
    /** Current token to handle reconnects properly */
    this._currentToken = null;

    this._pendingEmits = [];
    this._gpsWatchId = null;
    this._activeBookingId = null;
  }

  // ── Init / Destroy ─────────────────────────────────────────────────────────

  init(token) {
    if (this._socket?.connected) {
      if (this._currentToken === token) {
        console.warn("[Socket] Already connected with this token");
        return this._socket;
      } else {
        console.warn("[Socket] Token changed, reconnecting...");
        this.destroy(); // Safely disconnect before assigning a new token socket
      }
    }

    this._currentToken = token;
    this._socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 20_000,
    });

    this._socket.on("connect", () => {
      console.log("[Socket] Connected:", this._socket.id);
      for (const { event, payload } of this._pendingEmits) {
        this._socket.emit(event, payload);
      }
      this._pendingEmits = [];
    });

    this._socket.on("connect_error", (err) => {
      console.error("[Socket] Connect error:", err.message);
    });

    this._socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
    });

    this._socket.on("error", (err) => {
      console.error("[Socket] Server error:", err?.message ?? err);
    });

    return this._socket;
  }

  destroy() {
    this.stopGpsTracking();

    this._activeBookingId = null;
    this._pendingEmits = [];
    this._currentToken = null;

    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }

    console.log("[Socket] Destroyed");
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get connected() {
    return this._socket?.connected ?? false;
  }

  get id() {
    return this._socket?.id ?? null;
  }

  // ── Event helpers ──────────────────────────────────────────────────────────

  on(event, handler) {
    this._socket?.on(event, handler);
    return () => this._socket?.off(event, handler);
  }

  once(event, handler) {
    this._socket?.once(event, handler);
  }

  off(event, handler) {
    this._socket?.off(event, handler);
  }

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
    this.emit(CLIENT_EVENTS.JOIN_BOOKING_ROOM, { bookingId });
  }

  leaveBookingRoom(bookingId) {
    this.emit(CLIENT_EVENTS.LEAVE_BOOKING_ROOM, {
      bookingId: bookingId ?? this._activeBookingId,
    });
    if (this._activeBookingId === bookingId) this._activeBookingId = null;
  }

  joinTpRoom(tpId) {
    this.emit(CLIENT_EVENTS.JOIN_TP_ROOM, { tpId });
  }

  leaveTpRoom(tpId) {
    this.emit(CLIENT_EVENTS.LEAVE_TP_ROOM, { tpId });
  }

  // ── Booking state ──────────────────────────────────────────────────────────

  requestBookingState(bookingId) {
    this.emit(CLIENT_EVENTS.REQUEST_BOOKING_STATE, { bookingId });
  }

  // ── GPS tracking ───────────────────────────────────────────────────────────

  startGpsTracking({ bookingId } = {}) {
    if (!navigator?.geolocation) {
      console.warn("[Socket] Geolocation not supported");
      return;
    }

    this.stopGpsTracking();

    this._gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const rawSpeed = pos.coords.speed;
        const speedKmh =
          rawSpeed != null && rawSpeed >= 0
            ? +(rawSpeed * 3.6).toFixed(1)
            : undefined;

        this.emit(CLIENT_EVENTS.DRIVER_LOCATION, {
          bookingId: bookingId ?? this._activeBookingId ?? undefined,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: speedKmh,
          accuracy: pos.coords.accuracy ?? undefined,
        });
      },
      (err) => console.error("[GPS]", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }

  stopGpsTracking() {
    if (this._gpsWatchId !== null) {
      navigator?.geolocation?.clearWatch(this._gpsWatchId);
      this._gpsWatchId = null;
    }
  }

  emitLocation({ bookingId, lat, lng, isCare = false }) {
    const event = isCare
      ? CLIENT_EVENTS.CARE_LOCATION
      : CLIENT_EVENTS.DRIVER_LOCATION;
    this.emit(event, { bookingId, lat, lng });
  }

  // ── Driver status ──────────────────────────────────────────────────────────

  updateDriverStatus({ bookingId, rideId, status, lat, lng, meta } = {}) {
    this.emit(CLIENT_EVENTS.DRIVER_STATUS_UPDATE, {
      bookingId,
      rideId,
      status,
      lat,
      lng,
      meta,
    });
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  verifyOtp({ bookingId, rideId, otp }) {
    this.emit(CLIENT_EVENTS.VERIFY_OTP, { bookingId, rideId, otp });
  }

  requestOtpResend(bookingId) {
    this.emit(CLIENT_EVENTS.OTP_RESEND_REQUEST, { bookingId });
  }

  // ── SOS ────────────────────────────────────────────────────────────────────

  triggerSos({
    bookingId,
    rideId,
    lat,
    lng,
    sosType = "other",
    description,
  } = {}) {
    this.emit(CLIENT_EVENTS.SOS_TRIGGER, {
      bookingId,
      rideId,
      lat,
      lng,
      sosType,
      description,
    });
  }

  // ── Route deviation ────────────────────────────────────────────────────────

  reportRouteDeviation({
    bookingId,
    rideId,
    lat,
    lng,
    deviationKm,
    driverReason,
  } = {}) {
    this.emit(CLIENT_EVENTS.ROUTE_DEVIATION, {
      bookingId,
      rideId,
      lat,
      lng,
      deviationKm,
      driverReason,
    });
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  pingHealth() {
    this.emit(CLIENT_EVENTS.PING_HEALTH);
  }

  // ── Promise wrappers ───────────────────────────────────────────────────────

  verifyOtpAsync({ bookingId, rideId, otp }, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error("Socket not initialized"));

      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.OTP_RESULT, handler);
        reject(new Error("OTP verify timeout"));
      }, timeoutMs);

      const handler = (data) => {
        if (data.rideId && data.rideId !== rideId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.OTP_RESULT, handler);
        if (data.success) resolve(data);
        else reject(new Error(data.message || "OTP failed"));
      };

      this._socket.on(SOCKET_EVENTS.OTP_RESULT, handler);
      this.verifyOtp({ bookingId, rideId, otp });
    });
  }

  requestBookingStateAsync(bookingId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error("Socket not initialized"));

      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
        reject(new Error("State snapshot timeout"));
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
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const socketService = new SocketService();
export default socketService;
