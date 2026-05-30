/**
 * consultationService.js
 *
 * Client-side Socket.IO service for /consultations namespace.
 * Mirrors ALL events from consultationSocketService.js (server).
 */

import { io } from "socket.io-client";
import {
  rtJoined,
  rtStatusUpdate,
  rtParticipantConnected,
  rtParticipantDisconnected,
  rtParticipantJoined,
  rtParticipantLeft,
  rtParticipantMuted,
  rtParticipantUnmuted,
  rtParticipantKicked,
  rtYouWereKicked,
  rtYouWereMuted,
  rtYouWereUnmuted,
  rtPatientEnteredWaiting,
  rtWaitingRoomApproved,
  rtWaitingRoomRejected,
  rtWaitingRoomTimedOut,
  rtHandRaised,
  rtHandLowered,
  rtScreenShareStarted,
  rtScreenShareStopped,
  rtConsentUpdated,
  rtPrescriptionEvent,
  rtAttachmentUploaded,
  rtNetworkQuality,
  rtReconnectAttempt,
  rtReconnectSuccess,
  rtDoctorOnline,
  rtDoctorOffline,
  rtDoctorReassigned,
  rtAdminBroadcast,
  rtConnectionLost, // ← was missing
  rtConnectionRecovered, // ← was missing
  rtStateSynced, // ← was missing
  resetRt,
} from "@/store/slices/consultationSlice";

// ─── Config ───────────────────────────────────────────────────────────────────

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
const NAMESPACE = "/consultations";

// ─── Module state ─────────────────────────────────────────────────────────────

/** @type {import('socket.io-client').Socket | null} */
let socket = null;

/** @type {import('@reduxjs/toolkit').EnhancedStore | null} */
let _store = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dispatch = (action) => {
  if (_store) _store.dispatch(action);
};

const getToken = () => {
  const state = _store?.getState();
  return state?.user?.token || "";
};

// ─── Connect ──────────────────────────────────────────────────────────────────

const connect = (store) => {
  if (socket?.connected) return;

  _store = store;

  socket = io(`${SOCKET_URL}${NAMESPACE}`, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: (cb) => cb({ token: getToken() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  _registerCoreListeners();
};

// ─── Disconnect ───────────────────────────────────────────────────────────────

const disconnect = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  dispatch(resetRt());
};

// ─── Room join / leave ────────────────────────────────────────────────────────

const joinConsultation = ({ consultationId, bookingId }) => {
  if (!socket?.connected) {
    console.warn(
      "[ConsultationService] Socket not connected. Cannot join consultation.",
    );
    return;
  }
  socket.emit("join_consultation", { consultationId, bookingId });
};

const leaveConsultation = ({ consultationId, bookingId, reason }) => {
  if (!socket?.connected) return;
  socket.emit("leave_consultation", { consultationId, bookingId, reason });
};

// ─── Agora SDK bridge ─────────────────────────────────────────────────────────

const emitParticipantJoin = ({
  consultationId,
  agoraUid,
  deviceType,
  browser,
  os,
}) => {
  if (!socket?.connected) {
    console.warn(
      "[ConsultationService] Socket not connected. Cannot emit participant_join.",
    );
    return;
  }
  socket.emit("participant_join", {
    consultationId,
    agoraUid,
    deviceType,
    browser,
    os,
  });
};

const emitParticipantLeave = ({ consultationId, reason }) => {
  if (!socket?.connected) return;
  socket.emit("participant_leave", { consultationId, reason });
};

const emitNetworkQuality = ({
  consultationId,
  uplinkNetworkQuality,
  downlinkNetworkQuality,
  latency,
  packetLoss,
}) => {
  if (!socket?.connected) return;
  socket.emit("network_quality", {
    consultationId,
    uplinkNetworkQuality,
    downlinkNetworkQuality,
    latency,
    packetLoss,
  });
};

// ─── Screen share ─────────────────────────────────────────────────────────────

const emitScreenShareStart = ({ consultationId }) => {
  if (!socket?.connected) return;
  socket.emit("screen_share_start", { consultationId });
};

const emitScreenShareStop = ({ consultationId }) => {
  if (!socket?.connected) return;
  socket.emit("screen_share_stop", { consultationId });
};

// ─── Reconnect ────────────────────────────────────────────────────────────────

const emitReconnectAttempt = ({ consultationId, reason }) => {
  if (!socket?.connected) return;
  socket.emit("participant_reconnect_attempt", { consultationId, reason });
};

const emitReconnectSuccess = ({ consultationId }) => {
  if (!socket?.connected) return;
  socket.emit("participant_reconnect_success", { consultationId });
};

// ─── Interaction ──────────────────────────────────────────────────────────────

const emitRaiseHand = ({ consultationId }) => {
  if (!socket?.connected) return;
  socket.emit("raise_hand", { consultationId });
};

const emitLowerHand = ({ consultationId }) => {
  if (!socket?.connected) return;
  socket.emit("lower_hand", { consultationId });
};

// ─── Telemedicine ─────────────────────────────────────────────────────────────

const emitConsentGiven = ({ consultationId, consentType = "telemedicine" }) => {
  if (!socket?.connected) return;
  socket.emit("consent_given", { consultationId, consentType });
};

const emitDoctorStatus = (isOnline) => {
  if (!socket?.connected) return;
  socket.emit("doctor_status", { isOnline });
};

const emitSdkError = ({
  consultationId,
  code,
  message,
  severity = "error",
}) => {
  if (!socket?.connected) return;
  socket.emit("sdk_error", { consultationId, code, message, severity });
};

// ─── Host actions ─────────────────────────────────────────────────────────────

const emitKickParticipant = ({ consultationId, targetUserId, reason }) => {
  if (!socket?.connected) return;
  socket.emit("kick_participant", { consultationId, targetUserId, reason });
};

const emitMuteParticipant = ({
  consultationId,
  targetUserId,
  muted = true,
}) => {
  if (!socket?.connected) return;
  socket.emit("mute_participant", { consultationId, targetUserId, muted });
};

// ─── Admin ────────────────────────────────────────────────────────────────────

const emitAdminBroadcast = ({ message, targetRoom }) => {
  if (!socket?.connected) return;
  socket.emit("admin_broadcast", { message, targetRoom });
};

// ─── Heartbeat ────────────────────────────────────────────────────────────────

const ping = () => {
  if (!socket?.connected) return;
  socket.emit("ping");
};

// ─── Connection status helpers ────────────────────────────────────────────────

const isConnected = () => !!socket?.connected;
const getSocket = () => socket;

// ─── Core listener registration ───────────────────────────────────────────────

const _registerCoreListeners = () => {
  if (!socket) return;

  // ── Connection ────────────────────────────────────────────────────────────

  let _reconnectTimer = null;

  socket.on("connect", () => {
    console.log("[ConsultationService] Connected:", socket.id);
    dispatch(rtConnectionRecovered());

    // Debounce rejoin — prevent double-emit on rapid reconnect
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(() => {
      const state = _store?.getState()?.consultation?.rt;
      if (state?.consultationId && state?.bookingId) {
        socket.emit("join_consultation", {
          consultationId: state.consultationId,
          bookingId: state.bookingId,
        });
        // Request full state sync after rejoin
        setTimeout(() => {
          socket.emit("sync_consultation_state", {
            consultationId: state.consultationId,
          });
        }, 500); // wait for join_consultation to complete
      }
    }, 300);
  });

  socket.on("consultation_state_sync", (payload) => {
    dispatch(rtStateSynced(payload));
  });

  socket.on("disconnect", (reason) => {
    console.warn("[ConsultationService] Disconnected:", reason);
    // Do NOT resetRt() here — it wipes the waiting queue
    dispatch(rtConnectionLost({ reason }));
  });

  socket.on("connect_error", (err) => {
    console.error("[ConsultationService] Connect error:", err.message);
    const fatal = [
      "SESSION_REVOKED",
      "AUTH_BLOCKED",
      "TOKEN_EXPIRED",
      "AUTH_USER_NOT_FOUND",
    ];
    if (fatal.includes(err.message)) {
      console.warn("[ConsultationService] Fatal auth error — disconnect");
      socket.disconnect();
    }
  });

  socket.on("pong", ({ ts }) => {
    // optional: latency = Date.now() - ts
  });

  socket.on("error", ({ message }) => {
    console.error("[ConsultationService] Server error:", message);
  });

  // ── Joined ────────────────────────────────────────────────────────────────

  socket.on("joined_consultation", (payload) => {
    dispatch(rtJoined(payload));
  });

  // ── Participant socket connect/disconnect ─────────────────────────────────

  socket.on("participant_connected", (payload) => {
    dispatch(rtParticipantConnected(payload));
  });

  socket.on("participant_disconnected", (payload) => {
    dispatch(rtParticipantDisconnected(payload));
  });

  // ── Agora participant join/leave ──────────────────────────────────────────

  socket.on("participant_joined", (payload) => {
    dispatch(rtParticipantJoined(payload));
  });

  socket.on("participant_left", (payload) => {
    dispatch(rtParticipantLeft(payload));
  });

  // ── Mute / unmute ─────────────────────────────────────────────────────────

  socket.on("participant_muted", (payload) => {
    dispatch(rtParticipantMuted(payload));
  });

  socket.on("participant_unmuted", (payload) => {
    dispatch(rtParticipantUnmuted(payload));
  });

  // ── Kick ──────────────────────────────────────────────────────────────────

  socket.on("participant_kicked", (payload) => {
    dispatch(rtParticipantKicked(payload));
  });

  // ── Personal events ───────────────────────────────────────────────────────

  socket.on("you_were_kicked", (payload) => {
    dispatch(rtYouWereKicked(payload));
  });

  socket.on("you_were_muted", (payload) => {
    dispatch(rtYouWereMuted(payload));
  });

  socket.on("you_were_unmuted", (payload) => {
    dispatch(rtYouWereUnmuted(payload));
  });

  socket.on("waiting_room_timed_out", (payload) => {
    dispatch(rtWaitingRoomTimedOut(payload));
  });

  // ── Consultation lifecycle ────────────────────────────────────────────────

  const lifecycleEvents = [
    "consultation_created",
    "consultation_accepted",
    "consultation_confirmed",
    "consultation_started",
    "consultation_paused",
    "consultation_resumed",
    "consultation_ended",
    "consultation_cancelled",
  ];

  lifecycleEvents.forEach((event) => {
    socket.on(event, (payload) => {
      dispatch(rtStatusUpdate(payload));
    });
  });

  // ── Waiting room ──────────────────────────────────────────────────────────

  socket.on("patient_entered_waiting_room", (payload) => {
    dispatch(rtPatientEnteredWaiting(payload));
  });

  socket.on("waiting_room_approved", (payload) => {
    dispatch(rtWaitingRoomApproved(payload));
  });

  socket.on("waiting_room_rejected", (payload) => {
    dispatch(rtWaitingRoomRejected(payload));
  });

  // ── Hand raise ────────────────────────────────────────────────────────────

  socket.on("hand_raised", (payload) => {
    dispatch(rtHandRaised(payload));
  });

  socket.on("hand_lowered", (payload) => {
    dispatch(rtHandLowered(payload));
  });

  // ── Screen share ──────────────────────────────────────────────────────────

  socket.on("screen_share_started", (payload) => {
    dispatch(rtScreenShareStarted(payload));
  });

  socket.on("screen_share_stopped", (payload) => {
    dispatch(rtScreenShareStopped(payload));
  });

  // ── Consent ───────────────────────────────────────────────────────────────

  socket.on("consent_updated", (payload) => {
    dispatch(rtConsentUpdated(payload));
  });

  // ── Prescription ──────────────────────────────────────────────────────────

  socket.on("prescription_uploaded", (payload) => {
    dispatch(rtPrescriptionEvent(payload));
  });

  socket.on("prescription_issued", (payload) => {
    dispatch(rtPrescriptionEvent(payload));
  });

  // ── Attachment ────────────────────────────────────────────────────────────

  socket.on("attachment_uploaded", (payload) => {
    dispatch(rtAttachmentUploaded(payload));
  });

  // ── Network quality ───────────────────────────────────────────────────────

  socket.on("network_quality_update", (payload) => {
    dispatch(rtNetworkQuality(payload));
  });

  // ── Reconnect ─────────────────────────────────────────────────────────────

  socket.on("participant_reconnect_attempt", (payload) => {
    dispatch(rtReconnectAttempt(payload));
  });

  socket.on("participant_reconnect_success", (payload) => {
    dispatch(rtReconnectSuccess(payload));
  });

  // ── Doctor presence ───────────────────────────────────────────────────────

  socket.on("doctor_online", (payload) => {
    dispatch(rtDoctorOnline(payload));
  });

  socket.on("doctor_offline", (payload) => {
    dispatch(rtDoctorOffline(payload));
  });

  // ── Doctor reassigned ─────────────────────────────────────────────────────

  socket.on("doctor_reassigned", (payload) => {
    dispatch(rtDoctorReassigned(payload));
  });

  // ── Admin broadcast ───────────────────────────────────────────────────────

  socket.on("admin_broadcast", (payload) => {
    dispatch(rtAdminBroadcast(payload));
  });
};

// ─── Exported service ─────────────────────────────────────────────────────────

const consultationService = {
  connect,
  disconnect,
  isConnected,
  getSocket,

  joinConsultation,
  leaveConsultation,

  emitParticipantJoin,
  emitParticipantLeave,
  emitNetworkQuality,
  emitReconnectAttempt,
  emitReconnectSuccess,
  emitSdkError,

  emitScreenShareStart,
  emitScreenShareStop,

  emitRaiseHand,
  emitLowerHand,

  emitConsentGiven,
  emitDoctorStatus,

  emitKickParticipant,
  emitMuteParticipant,

  emitAdminBroadcast,

  ping,
};

export default consultationService;
