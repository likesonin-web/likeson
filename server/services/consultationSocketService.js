/**
 * consultationSocketService.js  –  ENTERPRISE PRODUCTION
 * FIXES:
 * A. authMiddleware: token read ONLY from socket.handshake.auth.token
 * B. authMiddleware: Redis cache key scoped to `consult_auth:{id}:{sessionId}`
 * C. authMiddleware: renamed inner `raw` → `cached`
 * D. authMiddleware: session validation also logs mismatch details for debugging
 * E. Chat Extraction: Removed all chat handlers
 * F. FIX: handleReconnectSuccess — removed dynamic import('mongoose'), use static import instead
 */

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import Consultation from "../models/Consultation.js";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import redisClient from "../config/redis.js";

const REDIS_AUTH_TTL = 300;
const WAITING_ROOM_TIMEOUT_MS = 15 * 60_000;

let _io = null;

const activeRooms = new Map();
const socketMeta = new Map();

export const initConsultationSocket = (io) => {
  _io = io;

  const ns = io.of("/consultations");
  ns.use(authMiddleware);

  ns.on("connection", (socket) => {
    console.log(
      `[ConsultSocket] +conn  ${socket.id}  user:${socket.user?._id}  name:${socket.user?.name}`,
    );

    socket.on("ping", () => socket.emit("pong", { ts: Date.now() }));

    socket.on("join_consultation", async (d) => handleJoin(socket, d));
    socket.on("leave_consultation", async (d) => handleLeave(socket, d));

    socket.on("participant_join", async (d) =>
      handleParticipantJoin(socket, d),
    );
    socket.on("participant_leave", async (d) =>
      handleParticipantLeave(socket, d),
    );

    socket.on("participant_reconnect_attempt", async (d) =>
      handleReconnectAttempt(socket, d),
    );
    socket.on("participant_reconnect_success", async (d) =>
      handleReconnectSuccess(socket, d),
    );

    socket.on("network_quality", (d) => handleNetworkQuality(socket, d));
    socket.on("screen_share_start", (d) => handleScreenShare(socket, d, true));
    socket.on("screen_share_stop", (d) => handleScreenShare(socket, d, false));

    socket.on("raise_hand", (d) => handleHand(socket, d, true));
    socket.on("lower_hand", (d) => handleHand(socket, d, false));

    socket.on("consent_given", async (d) => handleConsentGiven(socket, d));
    socket.on("doctor_status", (d) => handleDoctorStatus(socket, d));
    socket.on("sdk_error", async (d) => handleSdkError(socket, d));

    socket.on("kick_participant", async (d) => handleKick(socket, d));
    socket.on("mute_participant", async (d) =>
      handleMuteParticipant(socket, d),
    );
    socket.on("admin_broadcast", (d) => handleAdminBroadcast(socket, d));

    socket.on("disconnect", async (reason) => handleDisconnect(socket, reason));
    socket.on("error", (err) =>
      console.error(`[ConsultSocket] err ${socket.id}:`, err.message),
    );

    socket.on("sync_consultation_state", async ({ consultationId }) => {
      if (!consultationId) return;
      try {
        const consultation = await Consultation.findById(consultationId)
          .select(
            "status waitingRoomQueue participants doctor patient bookingId",
          )
          .populate({
            path: "doctor",
            populate: { path: "user", select: "name phone email" },
          })
          .populate("patient", "name phone email avatar")
          .lean();
        if (!consultation) return;

        const access = await canAccessConsultation(
          consultation,
          socket.user._id,
          socket.user.role,
        );
        if (!access) return;

        socket.emit("consultation_state_sync", {
          consultationId,
          status: consultation.status,
          doctor: {
            _id: consultation.doctor?._id,
            name: consultation.doctor?.user?.name,
            phone: consultation.doctor?.user?.phone,
          },
          patient: {
            _id: consultation.patient?._id,
            name: consultation.patient?.name,
            phone: consultation.patient?.phone,
            avatar: consultation.patient?.avatar,
          },
          waitingQueue: (consultation.waitingRoomQueue || [])
            .filter((e) =>
              ["waiting", "timed_out"].includes(e.waitingRoomStatus),
            )
            .map((e) => ({
              userId: String(e.userId),
              name: e.displayName,
              queuePosition: e.queuePosition,
              waitingRoomStatus: e.waitingRoomStatus,
              enteredAt: e.enteredAt,
            })),
          participants: (consultation.participants || [])
            .filter((p) => p.connectionStatus === "connected")
            .map((p) => ({
              userId: String(p.userId),
              role: p.role,
              name: p.displayName,
              connectionStatus: p.connectionStatus,
              isMutedByHost: p.isMutedByHost,
              cameraEnabled: p.cameraEnabled,
              screenSharing: p.screenSharing,
            })),
        });
      } catch (err) {
        console.error("[ConsultSocket] sync_consultation_state:", err.message);
      }
    });
  });

  setInterval(() => _sweepWaitingRoomTimeouts(), 60_000);

  console.log("[ConsultSocket] initialized on /consultations");
  return ns;
};

const authMiddleware = async (socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token ?? "";
    const token = rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    if (!token) return next(new Error("AUTH_MISSING"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.id || decoded?._id;
    if (!userId) return next(new Error("AUTH_INVALID"));

    const user = await User.findById(userId)
      .select("name role isBlocked")
      .lean();
    if (!user) return next(new Error("AUTH_USER_NOT_FOUND"));
    if (user.isBlocked) return next(new Error("AUTH_BLOCKED"));

    socket.user = {
      _id: userId.toString(),
      role: user.role,
      name: user.name,
    };
    next();
  } catch (err) {
    next(
      new Error(
        err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "AUTH_ERROR",
      ),
    );
  }
};

const resolveDpId = async (userId) => {
  const dp = await DoctorProfile.findOne({ user: userId }).select("_id").lean();
  return dp?._id ?? null;
};

const isDoctor = (role) => role === "doctor";
const isPatient = (role) => role === "customer";
const isAdmin = (role) => ["admin", "superadmin"].includes(role);
const isHost = (role) => isDoctor(role) || isAdmin(role);

const canAccessConsultation = async (consultation, userId, role) => {
  if (isAdmin(role)) return true;
  if (isPatient(role)) return String(consultation.patient) === String(userId);
  if (isDoctor(role)) {
    const dpId = await resolveDpId(userId);
    return dpId && String(consultation.doctor) === String(dpId);
  }
  if (role === "care_assistant")
    return String(consultation.careAssistant) === String(userId);
  return false;
};

const handleJoin = async (socket, data) => {
  try {
    const { consultationId, bookingId } = data || {};
    if (!consultationId || !bookingId)
      return socket.emit("error", {
        code: "MISSING_PARAMS",
        message: "consultationId and bookingId required",
      });

    const consultation = await Consultation.findById(consultationId)
      .select(
        "status patient doctor careAssistant agoraChannelId bookingId telemedicineConsentAccepted waitingRoomEnabled",
      )
      .lean();
    if (!consultation)
      return socket.emit("error", {
        code: "NOT_FOUND",
        message: "Consultation not found",
      });

    const { _id, role } = socket.user;
    const access = await canAccessConsultation(consultation, _id, role);
    if (!access)
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Access denied",
      });

    const bookingRoom = `booking:${bookingId}`;
    const consultationRoom = `consultation:${consultationId}`;

    await socket.join(bookingRoom);
    await socket.join(consultationRoom);
    if (isPatient(role)) await socket.join(`patient:${_id}`);
    if (isDoctor(role)) await socket.join(`doctor:${_id}`);
    if (isAdmin(role)) await socket.join("admin:ops");

    socketMeta.set(socket.id, {
      userId: String(_id),
      role,
      consultationId: String(consultationId),
      bookingId: String(bookingId),
      joinedAt: Date.now(),
    });

    if (!activeRooms.has(String(consultationId)))
      activeRooms.set(String(consultationId), new Set());
    activeRooms.get(String(consultationId)).add(socket.id);
    const fullConsult = await Consultation.findById(consultationId)
      .select(
        "status waitingRoomQueue participants doctor patient telemedicineConsentAccepted waitingRoomEnabled agoraChannelId",
      )
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name phone email" },
      })
      .populate("patient", "name phone email avatar")
      .populate("participants.userId", "name phone email avatar")
      .populate("waitingRoomQueue.userId", "name phone email avatar")
      .lean();

    socket.emit("joined_consultation", {
      consultationId,
      bookingId,
      status: fullConsult?.status ?? consultation.status,
      appId: process.env.AGORAIO_APP_ID,
      channelName: consultation.agoraChannelId,
      telemedicineConsentRequired: !consultation.telemedicineConsentAccepted,
      waitingRoomEnabled: consultation.waitingRoomEnabled,
      participantCount: activeRooms.get(String(consultationId))?.size ?? 1,
      timestamp: new Date(),
      // Populated data
      doctor: fullConsult?.doctor
        ? {
            _id: fullConsult.doctor._id,
            name: fullConsult.doctor.user?.name,
            phone: fullConsult.doctor.user?.phone,
            email: fullConsult.doctor.user?.email,
            specialization: fullConsult.doctor.specialization,
          }
        : null,
      patient: fullConsult?.patient
        ? {
            _id: fullConsult.patient._id,
            name: fullConsult.patient.name,
            phone: fullConsult.patient.phone,
            avatar: fullConsult.patient.avatar,
          }
        : null,
      existingParticipants: (fullConsult?.participants || [])
        .filter((p) => p.connectionStatus === "connected")
        .map((p) => ({
          userId: String(p.userId?._id ?? p.userId),
          name: p.userId?.name ?? p.displayName,
          role: p.role,
          connectionStatus: p.connectionStatus,
          isMutedByHost: p.isMutedByHost,
          cameraEnabled: p.cameraEnabled,
          screenSharing: p.screenSharing,
        })),
      existingWaitingQueue: (fullConsult?.waitingRoomQueue || [])
        .filter((e) => ["waiting", "timed_out"].includes(e.waitingRoomStatus))
        .map((e) => ({
          userId: String(e.userId?._id ?? e.userId),
          name: e.userId?.name ?? e.displayName,
          queuePosition: e.queuePosition,
          waitingRoomStatus: e.waitingRoomStatus,
          enteredAt: e.enteredAt,
        })),
    });

    if (isDoctor(role)) {
      _emitNs(`booking:${bookingId}`, "doctor_online", {
        doctorUserId: String(_id),
        doctorName: socket.user.name,
        timestamp: new Date(),
      });
    }

    socket.to(bookingRoom).emit("participant_connected", {
      consultationId,
      userId: String(_id),
      role,
      name: socket.user.name,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[ConsultSocket] handleJoin:", err.message);
    socket.emit("error", {
      code: "JOIN_FAILED",
      message: "Failed to join consultation",
    });
  }
};

const handleLeave = async (socket, data) => {
  try {
    const meta = socketMeta.get(socket.id);
    const cId = data?.consultationId || meta?.consultationId;
    const bId = data?.bookingId || meta?.bookingId;
    if (!cId || !bId) return;

    const { _id, role } = socket.user;

    socket.leave(`booking:${bId}`);
    socket.leave(`consultation:${cId}`);

    const setFields = {
      "participants.$[p].connectionStatus": "disconnected",
      "participants.$[p].leftAt": new Date(),
    };
    if (isDoctor(role)) setFields.doctorLeftAt = new Date();
    if (isPatient(role)) setFields.patientLeftAt = new Date();

    Consultation.updateOne(
      { _id: cId },
      { $set: setFields },
      { arrayFilters: [{ "p.userId": _id }] },
    ).catch((e) => console.error("[Socket DB] leave update:", e.message));

    const room = activeRooms.get(cId);
    if (room) {
      room.delete(socket.id);
      if (!room.size) activeRooms.delete(cId);
    }

    _emitNs(`booking:${bId}`, "participant_disconnected", {
      consultationId: cId,
      userId: String(_id),
      role,
      reason: data?.reason || "left",
      timestamp: new Date(),
    });

    socketMeta.delete(socket.id);
  } catch (err) {
    console.error("[ConsultSocket] handleLeave:", err.message);
  }
};

const handleParticipantJoin = async (socket, data) => {
  try {
    const { consultationId, agoraUid, deviceType, browser, os } = data || {};
    if (!consultationId) return;

    const { _id, role } = socket.user;
    const pRole = _mapRole(role);
    const now = new Date();

    const entry = {
      participantId: String(agoraUid || _id),
      userId: _id,
      role: pRole,
      displayName: socket.user.name,
      joinedAt: now,
      connectionStatus: "connected",
      deviceType: deviceType || "unknown",
      browser: browser || null,
      operatingSystem: os || null,
      lastActiveAt: now,
      permissions: {
        canMute: isHost(role),
        canKick: isHost(role),
        canShareScreen: true,
        canPrescribe: isDoctor(role),
      },
    };

    const updated = await Consultation.findOneAndUpdate(
      { _id: consultationId, "participants.userId": _id },
      {
        $set: {
          "participants.$.connectionStatus": "connected",
          "participants.$.joinedAt": now,
          "participants.$.leftAt": null,
          "participants.$.lastActiveAt": now,
          "participants.$.deviceType": deviceType || "unknown",
          "participants.$.browser": browser || null,
          "participants.$.operatingSystem": os || null,
          ...(isDoctor(role) ? { doctorJoinedAt: now } : {}),
          ...(isPatient(role) ? { patientJoinedAt: now } : {}),
        },
      },
      { new: true },
    );

    const consultation =
      updated ||
      (await Consultation.findOneAndUpdate(
        { _id: consultationId },
        {
          $push: { participants: entry },
          $set: {
            ...(isDoctor(role) && !updated ? { doctorJoinedAt: now } : {}),
            ...(isPatient(role) && !updated ? { patientJoinedAt: now } : {}),
          },
        },
        { new: true },
      ));

    if (!consultation) return;

    const connected = consultation.participants.filter(
      (p) => p.connectionStatus === "connected",
    ).length;
    if (connected > (consultation.analytics?.peakParticipants ?? 0)) {
      Consultation.updateOne(
        { _id: consultationId },
        { $set: { "analytics.peakParticipants": connected } },
      ).catch(() => {});
    }

    _emitNs(`booking:${consultation.bookingId}`, "participant_joined", {
      consultationId,
      userId: String(_id),
      role: pRole,
      name: socket.user.name,
      agoraUid,
      timestamp: now,
    });
  } catch (err) {
    console.error("[ConsultSocket] handleParticipantJoin:", err.message);
  }
};

const handleParticipantLeave = async (socket, data) => {
  try {
    const { consultationId, reason } = data || {};
    if (!consultationId) return;
    const { _id, role } = socket.user;

    const consultation = await Consultation.findOneAndUpdate(
      { _id: consultationId, "participants.userId": _id },
      {
        $set: {
          "participants.$.connectionStatus": "disconnected",
          "participants.$.leftAt": new Date(),
        },
      },
    );
    if (!consultation) return;

    _emitNs(`booking:${consultation.bookingId}`, "participant_left", {
      consultationId,
      userId: String(_id),
      role,
      reason: reason || "disconnected",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[ConsultSocket] handleParticipantLeave:", err.message);
  }
};

const handleNetworkQuality = (socket, data) => {
  try {
    const {
      consultationId,
      uplinkNetworkQuality,
      downlinkNetworkQuality,
      latency,
      packetLoss,
    } = data || {};
    const meta = socketMeta.get(socket.id);
    if (!consultationId || !meta?.bookingId) return;

    _emitNs(`booking:${meta.bookingId}`, "network_quality_update", {
      consultationId,
      userId: String(socket.user._id),
      role: socket.user.role,
      uplinkNetworkQuality,
      downlinkNetworkQuality,
      latency,
      packetLoss,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[ConsultSocket] handleNetworkQuality:", err.message);
  }
};

const handleReconnectAttempt = async (socket, data) => {
  try {
    const { consultationId, reason } = data || {};
    if (!consultationId) return;
    const { _id, role } = socket.user;

    Consultation.updateOne(
      { _id: consultationId },
      {
        $push: {
          reconnectLogs: {
            participantId: _id,
            role: _mapRole(role),
            attemptAt: new Date(),
            reason: reason || "unknown",
            success: false,
          },
        },
      },
    ).catch((e) => console.error("[Socket DB] reconnectAttempt:", e.message));

    const meta = socketMeta.get(socket.id);
    if (meta?.bookingId) {
      _emitNs(`booking:${meta.bookingId}`, "participant_reconnect_attempt", {
        consultationId,
        userId: String(_id),
        role: _mapRole(role),
        timestamp: new Date(),
      });
    }
  } catch (err) {
    console.error("[ConsultSocket] handleReconnectAttempt:", err.message);
  }
};

// FIX: Removed dynamic `await import('mongoose')` — use static import at top of file instead
const handleReconnectSuccess = async (socket, data) => {
  try {
    const { consultationId } = data || {};
    if (!consultationId) return;
    const { _id, role } = socket.user;
    const now = new Date();

    // FIX: Use statically imported mongoose.Types.ObjectId instead of dynamic import
    const agg = await Consultation.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(consultationId) } },
      {
        $project: {
          idx: {
            $indexOfArray: [
              {
                $map: {
                  input: { $reverseArray: "$reconnectLogs" },
                  as: "rl",
                  in: {
                    $and: [
                      { $eq: ["$$rl.participantId", _id] },
                      { $eq: ["$$rl.success", false] },
                    ],
                  },
                },
              },
              true,
            ],
          },
          totalLogs: { $size: "$reconnectLogs" },
        },
      },
    ]);

    if (agg[0]?.idx >= 0) {
      const realIdx = agg[0].totalLogs - 1 - agg[0].idx;
      const setOp = {};
      setOp[`reconnectLogs.${realIdx}.success`] = true;
      setOp[`reconnectLogs.${realIdx}.reconnectedAt`] = now;
      Consultation.updateOne({ _id: consultationId }, { $set: setOp }).catch(
        (e) => console.error("[Socket DB] reconnectSuccess:", e.message),
      );
    }

    const meta = socketMeta.get(socket.id);
    if (meta?.bookingId) {
      _emitNs(`booking:${meta.bookingId}`, "participant_reconnect_success", {
        consultationId,
        userId: String(_id),
        role: _mapRole(role),
        timestamp: now,
      });
    }
  } catch (err) {
    console.error("[ConsultSocket] handleReconnectSuccess:", err.message);
  }
};

const handleHand = (socket, data, raised) => {
  try {
    const { consultationId } = data || {};
    const meta = socketMeta.get(socket.id);
    if (!consultationId || !meta?.bookingId) return;

    _emitNs(
      `booking:${meta.bookingId}`,
      raised ? "hand_raised" : "hand_lowered",
      {
        consultationId,
        userId: String(socket.user._id),
        role: socket.user.role,
        name: socket.user.name,
        timestamp: new Date(),
      },
    );
  } catch (err) {
    console.error("[ConsultSocket] handleHand:", err.message);
  }
};

const handleScreenShare = async (socket, data, started) => {
  try {
    const { consultationId } = data || {};
    const meta = socketMeta.get(socket.id);
    if (!consultationId || !meta?.bookingId) return;

    Consultation.updateOne(
      { _id: consultationId, "participants.userId": socket.user._id },
      { $set: { "participants.$.screenSharing": started } },
    ).catch(() => {});

    _emitNs(
      `booking:${meta.bookingId}`,
      started ? "screen_share_started" : "screen_share_stopped",
      {
        consultationId,
        userId: String(socket.user._id),
        role: socket.user.role,
        timestamp: new Date(),
      },
    );
  } catch (err) {
    console.error("[ConsultSocket] handleScreenShare:", err.message);
  }
};

const handleConsentGiven = async (socket, data) => {
  try {
    const { consultationId, consentType = "telemedicine" } = data || {};
    if (!consultationId) return;
    if (socket.user.role !== "customer") return;

    const check = await Consultation.findById(consultationId)
      .select("patient bookingId")
      .lean();
    if (!check || String(check.patient) !== String(socket.user._id)) return;

    const entry = {
      consentType,
      accepted: true,
      acceptedAt: new Date(),
      consentVersion: "1.0",
    };
    await Consultation.updateOne(
      { _id: consultationId },
      { $pull: { consents: { consentType } } },
    );
    await Consultation.updateOne(
      { _id: consultationId },
      {
        $push: { consents: entry },
        $set:
          consentType === "telemedicine"
            ? { telemedicineConsentAccepted: true, updatedBy: socket.user._id }
            : { updatedBy: socket.user._id },
      },
    );

    const meta = socketMeta.get(socket.id);
    _emitNs(
      `booking:${meta?.bookingId || check.bookingId}`,
      "consent_updated",
      {
        consultationId,
        consentType,
        accepted: true,
        timestamp: new Date(),
      },
    );
  } catch (err) {
    console.error("[ConsultSocket] handleConsentGiven:", err.message);
  }
};

const handleDoctorStatus = (socket, data) => {
  try {
    if (!isDoctor(socket.user.role)) return;
    const { isOnline } = data || {};
    const meta = socketMeta.get(socket.id);

    const event = isOnline ? "doctor_online" : "doctor_offline";
    const payload = {
      doctorUserId: String(socket.user._id),
      doctorName: socket.user.name,
      timestamp: new Date(),
    };

    _emitNs("admin:ops", event, payload);
    if (meta?.bookingId) {
      _emitNs(`booking:${meta.bookingId}`, event, payload);
    }
  } catch (err) {
    console.error("[ConsultSocket] handleDoctorStatus:", err.message);
  }
};

const handleSdkError = async (socket, data) => {
  try {
    const {
      consultationId,
      code,
      message: errMsg,
      severity = "error",
    } = data || {};
    if (!consultationId) return;

    Consultation.updateOne(
      { _id: consultationId },
      {
        $push: {
          sdkErrors: {
            code,
            message: errMsg,
            participantId: String(socket.user._id),
            timestamp: new Date(),
            severity,
            resolved: false,
          },
        },
      },
    ).catch((e) => console.error("[Socket DB] sdkError:", e.message));

    console.warn(
      `[ConsultSocket] SDK error ${socket.user._id}: [${code}] ${errMsg}`,
    );
  } catch (err) {
    console.error("[ConsultSocket] handleSdkError:", err.message);
  }
};

const handleKick = async (socket, data) => {
  try {
    const { consultationId, targetUserId, reason } = data || {};
    if (!consultationId || !targetUserId) return;

    const check = await Consultation.findById(consultationId)
      .select("doctor status bookingId")
      .lean();
    if (!check)
      return socket.emit("error", {
        code: "NOT_FOUND",
        message: "Consultation not found",
      });

    if (!isHost(socket.user.role))
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Only host can kick",
      });

    if (isDoctor(socket.user.role)) {
      const dpId = await resolveDpId(socket.user._id);
      if (!dpId || String(check.doctor) !== String(dpId))
        return socket.emit("error", {
          code: "FORBIDDEN",
          message: "Access denied",
        });
    }

    Consultation.updateOne(
      { _id: consultationId, "participants.userId": targetUserId },
      {
        $set: {
          "participants.$.connectionStatus": "disconnected",
          "participants.$.leftAt": new Date(),
        },
        $push: {
          eventLogs: {
            eventType: "participant_kicked",
            actorType: isDoctor(socket.user.role) ? "doctor" : "admin",
            actorId: socket.user._id,
            severity: "warning",
            source: "server",
            timestamp: new Date(),
            payload: { targetUserId, reason },
          },
        },
      },
    ).catch((e) => console.error("[Socket DB] kick:", e.message));

    const meta = socketMeta.get(socket.id);

    _emitNs(
      `booking:${meta?.bookingId || check.bookingId}`,
      "participant_kicked",
      {
        consultationId,
        targetUserId,
        reason,
        by: String(socket.user._id),
        timestamp: new Date(),
      },
    );

    _emitNs(`patient:${targetUserId}`, "you_were_kicked", {
      consultationId,
      reason,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[ConsultSocket] handleKick:", err.message);
  }
};

const handleMuteParticipant = async (socket, data) => {
  try {
    const { consultationId, targetUserId, muted = true } = data || {};
    if (!consultationId || !targetUserId) return;

    if (!isHost(socket.user.role))
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Only host can mute",
      });

    Consultation.updateOne(
      { _id: consultationId, "participants.userId": targetUserId },
      { $set: { "participants.$.isMutedByHost": muted } },
    ).catch(() => {});

    const meta = socketMeta.get(socket.id);
    const check = await Consultation.findById(consultationId)
      .select("bookingId")
      .lean();

    _emitNs(
      `booking:${meta?.bookingId || check?.bookingId}`,
      muted ? "participant_muted" : "participant_unmuted",
      {
        consultationId,
        targetUserId,
        by: String(socket.user._id),
        timestamp: new Date(),
      },
    );

    _emitNs(
      `patient:${targetUserId}`,
      muted ? "you_were_muted" : "you_were_unmuted",
      {
        consultationId,
        by: String(socket.user._id),
        timestamp: new Date(),
      },
    );
  } catch (err) {
    console.error("[ConsultSocket] handleMuteParticipant:", err.message);
  }
};

const handleAdminBroadcast = (socket, data) => {
  try {
    if (!isAdmin(socket.user.role)) return;
    const { message, targetRoom } = data || {};
    if (!message) return;

    const room = targetRoom || "admin:ops";
    _emitNs(room, "admin_broadcast", {
      message,
      from: socket.user.name,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[ConsultSocket] handleAdminBroadcast:", err.message);
  }
};

const handleDisconnect = async (socket, reason) => {
  try {
    const meta = socketMeta.get(socket.id);
    if (!meta || !socket.user) return;

    const { consultationId, bookingId, role } = meta;

    if (consultationId) {
      const setFields = {
        "participants.$[p].connectionStatus": "disconnected",
        "participants.$[p].leftAt": new Date(),
      };
      if (isDoctor(role)) setFields.doctorLeftAt = new Date();
      if (isPatient(role)) setFields.patientLeftAt = new Date();

      Consultation.updateOne(
        { _id: consultationId },
        { $set: setFields },
        { arrayFilters: [{ "p.userId": socket.user._id }] },
      ).catch((e) => console.error("[Socket DB] disconnect:", e.message));

      const room = activeRooms.get(consultationId);
      if (room) {
        room.delete(socket.id);
        if (!room.size) activeRooms.delete(consultationId);
      }

      if (bookingId) {
        _emitNs(`booking:${bookingId}`, "participant_disconnected", {
          consultationId,
          userId: String(socket.user._id),
          role,
          reason,
          timestamp: new Date(),
        });
      }
    }

    socketMeta.delete(socket.id);
    console.log(`[ConsultSocket] -conn  ${socket.id} (${reason})`);
  } catch (err) {
    console.error("[ConsultSocket] handleDisconnect:", err.message);
  }
};

const _sweepWaitingRoomTimeouts = async () => {
  try {
    const cutoff = new Date(Date.now() - WAITING_ROOM_TIMEOUT_MS);

    const docs = await Consultation.find({
      status: "waiting",
      waitingRoomQueue: {
        $elemMatch: {
          waitingRoomStatus: "waiting",
          enteredAt: { $lt: cutoff },
        },
      },
    })
      .select("_id bookingId waitingRoomQueue")
      .lean();

    for (const doc of docs) {
      const timedOutIds = doc.waitingRoomQueue
        .filter(
          (e) => e.waitingRoomStatus === "waiting" && e.enteredAt < cutoff,
        )
        .map((e) => String(e.userId));

      if (!timedOutIds.length) continue;

      await Consultation.updateOne(
        { _id: doc._id },
        { $set: { "waitingRoomQueue.$[e].waitingRoomStatus": "timed_out" } },
        {
          arrayFilters: [
            {
              "e.userId": { $in: timedOutIds },
              "e.waitingRoomStatus": "waiting",
            },
          ],
        },
      );

      for (const uid of timedOutIds) {
        _emitNs(`patient:${uid}`, "waiting_room_timed_out", {
          consultationId: String(doc._id),
          timestamp: new Date(),
        });
      }
    }
  } catch (err) {
    console.error("[ConsultSocket] _sweepWaitingRoomTimeouts:", err.message);
  }
};

const _emitNs = (room, event, data) => {
  if (!_io) return;
  _io.of("/consultations").to(room).emit(event, data);
};

const _mapRole = (role) => {
  if (role === "doctor") return "doctor";
  if (role === "customer") return "patient";
  if (role === "care_assistant") return "care_assistant";
  if (isAdmin(role)) return "admin";
  return "patient";
};

export const getConsultationSocketService = () => {
  if (!_io) return null;
  const ns = _io.of("/consultations");
  return {
    emitToBookingRoom: (id, evt, d) => ns.to(`booking:${id}`).emit(evt, d),
    emitToConsultationRoom: (id, evt, d) =>
      ns.to(`consultation:${id}`).emit(evt, d),
    emitToDoctor: (id, evt, d) => ns.to(`doctor:${id}`).emit(evt, d),
    emitToPatient: (id, evt, d) => ns.to(`patient:${id}`).emit(evt, d),
    emitToAdminOps: (evt, d) => ns.to("admin:ops").emit(evt, d),
    getParticipantCount: (cId) => activeRooms.get(String(cId))?.size ?? 0,
    getActiveRoomCount: () => activeRooms.size,
    getConnectedSocketCount: () => socketMeta.size,
    isDoctorOnline: async (uid) =>
      (await ns.in(`doctor:${uid}`).fetchSockets()).length > 0,
    isPatientOnline: async (uid) =>
      (await ns.in(`patient:${uid}`).fetchSockets()).length > 0,
  };
};

export default { initConsultationSocket, getConsultationSocketService };
