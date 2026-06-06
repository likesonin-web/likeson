// services/consultationSocketService.js
// Socket.IO client for /consultation namespace.

import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5050";

let socket = null;
let _store = null;

import {
  socketStatusUpdate,
  socketParticipantJoined,
  socketParticipantLeft,
  socketParticipantDisconnected,
  socketPatientWaiting,
  socketPatientLeftWaiting,
  socketChatMessage,
  socketChatTyping,
  socketVitalsUpdate,
  socketQosUpdate,
  socketPrescriptionPreview,
  socketPrescriptionReady,
  socketAdminMessage,
  socketTokenRefreshed,
  socketRecordingStarted,
  socketRecordingStopped,
  socketParticipantAdded,
  socketParticipantRemoved,
  socketMuted,
  socketKicked,
  socketTimerUpdate
} from "../store/slices/consultationSlice";

export const initConsultationSocket = (store) => {
  _store = store;
};

export const connectConsultationSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(`${SOCKET_URL}/consultation`, {
    auth:            { token },
    transports:      ["websocket"],
    reconnection:    true,
    reconnectionAttempts: 10,
    reconnectionDelay:    1500,
    timeout:         10000,
  });

  socket.on("connect", () => console.log("[ConsultationSocket] connected:", socket.id));
  socket.on("connect_error", (err) => console.error("[ConsultationSocket] error:", err.message));
  socket.on("disconnect", (reason) => console.warn("[ConsultationSocket] disconnected:", reason));

  socket.on("consultation:status", (data) => _store?.dispatch(socketStatusUpdate(data)));
  socket.on("consultation:participant-joined", (data) => _store?.dispatch(socketParticipantJoined(data)));
  socket.on("consultation:participant-left", (data) => _store?.dispatch(socketParticipantLeft(data)));
  socket.on("consultation:participant-disconnected", (data) => _store?.dispatch(socketParticipantDisconnected(data)));
  socket.on("consultation:patient-waiting", (data) => _store?.dispatch(socketPatientWaiting(data)));
  socket.on("consultation:patient-left-waiting", (data) => _store?.dispatch(socketPatientLeftWaiting(data)));

  // ── Chat — socket pushes message; slice dedupes by _id ──────────────────
  socket.on("consultation:chat:message", (data) => _store?.dispatch(socketChatMessage(data)));
  socket.on("consultation:chat:typing", (data) => _store?.dispatch(socketChatTyping(data)));

  socket.on("consultation:vitals:update", (data) => _store?.dispatch(socketVitalsUpdate(data)));
  socket.on("consultation:qos:update", (data) => _store?.dispatch(socketQosUpdate(data)));
  socket.on("consultation:prescription:preview", (data) => _store?.dispatch(socketPrescriptionPreview(data)));
  socket.on("consultation:prescription:ready", (data) => _store?.dispatch(socketPrescriptionReady(data)));
  socket.on("consultation:admin:message", (data) => _store?.dispatch(socketAdminMessage(data)));
  socket.on("consultation:token:refresh:ok", (data) => _store?.dispatch(socketTokenRefreshed(data)));

  // ── Recording events ─────────────────────────────────────────────────────
  socket.on("consultation:recording:started", (data) => _store?.dispatch(socketRecordingStarted(data)));
  socket.on("consultation:recording:stopped", (data) => _store?.dispatch(socketRecordingStopped(data)));

  // ── Participant management ────────────────────────────────────────────────
  socket.on("consultation:participant:added", (data) => _store?.dispatch(socketParticipantAdded(data)));
  socket.on("consultation:participant:removed", (data) => _store?.dispatch(socketParticipantRemoved(data)));
   // Doctor mute/unmute — isMuted true or false
  socket.on("consultation:muted", (data) => _store?.dispatch(socketMuted(data)));

  // Doctor kick
  socket.on("consultation:kicked", (data) => _store?.dispatch(socketKicked(data)));

  // Timer countdown update (from cron via emitTimerUpdate)
  socket.on("consultation:timer:update", (data) => _store?.dispatch(socketTimerUpdate(data)));
  socket.on("consultation:timer:snapshot", (data) => _store?.dispatch(socketTimerUpdate(data)));

  return socket;
};

export const disconnectConsultationSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

// ── Emit helpers ──────────────────────────────────────────────────────────────

export const socketJoin = (consultationId, deviceInfo = {}) =>
  socket?.emit("consultation:join", { consultationId, deviceInfo });

export const socketLeave = (consultationId, metrics = {}) =>
  socket?.emit("consultation:leave", { consultationId, metrics });

export const socketStart = (consultationId) =>
  socket?.emit("consultation:start", { consultationId });

export const socketEnd = (consultationId) =>
  socket?.emit("consultation:end", { consultationId });

export const socketPause = (consultationId) =>
  socket?.emit("consultation:pause", { consultationId });

export const socketResume = (consultationId) =>
  socket?.emit("consultation:resume", { consultationId });

export const socketCancel = (consultationId, reason) =>
  socket?.emit("consultation:cancel", { consultationId, reason });

export const socketEnterWaiting = (consultationId) =>
  socket?.emit("consultation:waiting-enter", { consultationId });

export const socketLeaveWaiting = (consultationId) =>
  socket?.emit("consultation:waiting-leave", { consultationId });

/**
 * Send chat via socket only.
 * REST call (sendChatMessage thunk) also runs for persistence.
 * Slice dedupes by _id — no double-display.
 * Key: do NOT dispatch socketChatMessage manually after REST — let socket event do it.
 */
export const socketSendChat = (consultationId, content, messageType = "text", attachmentUrl = null, attachmentName = null) =>
  socket?.emit("consultation:chat:send", { consultationId, content, messageType, attachmentUrl, attachmentName });

export const socketTyping = (consultationId, isTyping) =>
  socket?.emit("consultation:chat:typing", { consultationId, isTyping });

export const socketSendVitals = (consultationId, vitals) =>
  socket?.emit("consultation:vitals", { consultationId, vitals });

export const socketSendQos = (consultationId, quality, stats = {}) =>
  socket?.emit("consultation:qos", { consultationId, quality, stats });

export const socketRequestTokenRefresh = (consultationId) =>
  socket?.emit("consultation:token:refresh", { consultationId });

export const socketTechnicalFail = (consultationId) =>
  socket?.emit("consultation:technical-fail", { consultationId });

export const socketPrescriptionPreviewEmit = (consultationId, preview) =>
  socket?.emit("consultation:prescription:preview", { consultationId, preview });

export const socketPrescriptionIssued = (consultationId, rxNumber) =>
  socket?.emit("consultation:prescription:issued", { consultationId, rxNumber });

export const socketAdminBroadcast = (consultationId, message, type = "info") =>
  socket?.emit("consultation:admin:broadcast", { consultationId, message, type });

export const socketPing = (consultationId) =>
  socket?.emit("consultation:ping", { consultationId });

// ── Recording ─────────────────────────────────────────────────────────────────

export const socketStartRecording = (consultationId) =>
  socket?.emit("consultation:recording:start", { consultationId });

export const socketStopRecording = (consultationId) =>
  socket?.emit("consultation:recording:stop", { consultationId });

// ── Participant management ────────────────────────────────────────────────────

export const socketAddParticipant = (consultationId, userId, role) =>
  socket?.emit("consultation:participant:add", { consultationId, userId, role });

export const socketRemoveParticipant = (consultationId, userId) =>
  socket?.emit("consultation:participant:remove", { consultationId, userId });

export const socketMuteParticipant = (consultationId, targetUserId) =>
  socket?.emit("consultation:mute", { consultationId, targetUserId });

export const socketUnmuteParticipant = (consultationId, targetUserId) =>
  socket?.emit("consultation:unmute", { consultationId, targetUserId });

export const socketKickParticipant = (consultationId, targetUserId, reason) =>
  socket?.emit("consultation:kick", { consultationId, targetUserId, reason });

export const socketGetTimer = (consultationId) =>
  socket?.emit("consultation:timer:get", { consultationId });

export const getSocket = () => socket;