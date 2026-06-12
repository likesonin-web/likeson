import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import SoloDriverPartner from "../models/SoloDriverPartner.js";
import CareAssistantProfile from "../models/CareAssistantProfile.js";
import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";
import RideTracking from "../models/RideTracking.js";
import TransportPartner from "../models/TransportPartner.js";
import User from "../models/User.js";

// ADD NEW IMPORT at top of bookingSocketService.js:
import {
  handleDriverLocationUpdate,
  handleCaLocationUpdate,
  handleOtpVerify,
  handleRideStageTransition,
  handleSos,
  handleRouteDeviation,
  cleanupSocketThrottle,
} from "./ride/RideOrchestratorService.js";

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

/** @type {BookingSocketService|null} */
let _instance = null;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LOCATION_THROTTLE_MS = 2_000;
const ETA_RECALC_THROTTLE_MS = 30_000;

const ACTIVE_RIDE_STATUSES = [
  "driver_assigned",
  "driver_accepted",
  "driver_en_route",
  "driver_arrived",
  "otp_verified",
  "in_progress",
  "at_stop",
];

const DROPOFF_TARGET_STATUSES = ["otp_verified", "in_progress", "at_stop"];

const DRIVER_STATUS_MAP = {
  accepted: "driver_accepted",
  en_route: "driver_en_route",
  arrived: "driver_arrived",
  otp_verified: "otp_verified",
  ride_started: "in_progress",
  at_stop: "at_stop",
  stop_departed: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

const STATUS_MILESTONE_MAP = {
  driver_accepted: "driver_accepted",
  driver_en_route: "driver_en_route",
  driver_arrived: "driver_arrived",
  otp_verified: "otp_verified",
  in_progress: "ride_started",
  at_stop: "stop_reached",
  completed: "ride_completed",
  cancelled: "ride_cancelled",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const resolveDriverId = async (userId, role) => {
  if (!["driver", "solodriverpartner"].includes(role)) return null;
  const driver = await Driver.findOne({ user: userId }).select("_id").lean();
  return driver ? driver._id.toString() : null;
};

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const resolveMapTarget = (rideStatus) =>
  DROPOFF_TARGET_STATUSES.includes(rideStatus) ? "dropoff" : "pickup";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM AUTHORIZATION — ride/transport rooms only
// ─────────────────────────────────────────────────────────────────────────────

const canJoinRoom = async (user, room) => {
  const { _id: userId, role, driverObjectId } = user;

  // ── Admin rooms ─────────────────────────────────────────────────────────────
  if (room === "admin:ops" || room === "admin:global") {
    return ["admin", "superadmin"].includes(role)
      ? { allowed: true }
      : { allowed: false, reason: "Admin only" };
  }

  // ── Driver personal room ────────────────────────────────────────────────────
  if (room.startsWith("driver:")) {
    if (["admin", "superadmin"].includes(role)) return { allowed: true };
    const roomDriverId = room.replace("driver:", "");
    if (!isValidId(roomDriverId))
      return { allowed: false, reason: "Invalid driver ID" };
    if (!["driver", "solodriverpartner"].includes(role))
      return { allowed: false, reason: "Driver only" };
    const myDriverId = driverObjectId || (await resolveDriverId(userId, role));
    if (!myDriverId || myDriverId !== roomDriverId)
      return { allowed: false, reason: "Not your driver room" };
    return { allowed: true };
  }

  // ── User personal room ──────────────────────────────────────────────────────
  if (room.startsWith("user:")) {
    if (["admin", "superadmin"].includes(role)) return { allowed: true };
    const roomUserId = room.replace("user:", "");
    if (!isValidId(roomUserId))
      return { allowed: false, reason: "Invalid user ID" };
    if (userId !== roomUserId)
      return { allowed: false, reason: "Not your user room" };
    return { allowed: true };
  }

  // ── Transport partner room ──────────────────────────────────────────────────
  if (room.startsWith("tp:")) {
    if (["admin", "superadmin"].includes(role)) return { allowed: true };
    if (role !== "transportpartner")
      return { allowed: false, reason: "TP or admin only" };
    const tpId = room.replace("tp:", "");
    if (!isValidId(tpId)) return { allowed: false, reason: "Invalid TP ID" };
    const tp = await TransportPartner.findOne({ _id: tpId, user: userId })
      .select("_id")
      .lean();
    if (!tp) return { allowed: false, reason: "Not your TP" };
    return { allowed: true };
  }

  // ── Booking room ────────────────────────────────────────────────────────────
  if (room.startsWith("booking:")) {
    const bookingId = room.replace("booking:", "");
    if (!isValidId(bookingId))
      return { allowed: false, reason: "Invalid booking ID" };

    // Admin always allowed
    if (["admin", "superadmin"].includes(role)) return { allowed: true };

    const booking = await Booking.findById(bookingId)
      .select("customer doctor transportPartner careAssistant bookingType")
      .lean();
    if (!booking) return { allowed: false, reason: "Booking not found" };

    // ── Customer: owns this booking ───────────────────────────────────────────
    if (booking.customer?.toString() === userId) return { allowed: true };

    // ── Driver: has an active ride on this booking ────────────────────────────
    if (["driver", "solodriverpartner"].includes(role)) {
      const dId = driverObjectId || (await resolveDriverId(userId, role));
      if (dId) {
        const ride = await Ride.findOne({
          booking: bookingId,
          driver: dId,
        })
          .select("_id")
          .lean();
        if (ride) return { allowed: true };
      }
    }

    // ── Care assistant ────────────────────────────────────────────────────────
    // FIX: CA can join booking room for BOTH care_assistant and full_care_ride
    // Previously: only checked if CA had a ride with driver field = CA
    // Now: check if booking.careAssistant === CA profile _id
    if (role === "care_assistant") {
      const ca = await CareAssistantProfile.findOne({ user: userId })
        .select("_id")
        .lean();
      if (ca) {
        // Direct assignment check — works for ALL booking types including care_assistant
        if (booking.careAssistant?.toString() === ca._id.toString()) {
          return {
            allowed: true,
            liveTracking: true,
            hospitalTracking: booking.bookingType === "full_care_ride",
          };
        }

        // Fallback: check via RideTracking.careAssistant (in case booking.careAssistant not yet set)
        const activeRide = await Ride.findOne({
          booking: bookingId,
          status: { $in: ACTIVE_RIDE_STATUSES },
        })
          .select(
            "status rideStage activeNavigationTarget liveLocation driverSnapshot vehicleSnapshot trackingId pickup dropoff estimatedDistanceKm estimatedDurationMin waypoints",
          )
          .lean();

        if (activeRide?.trackingId) {
          const tracking = await RideTracking.findById(activeRide.trackingId)
            .select("careAssistant")
            .lean();
          if (tracking?.careAssistant?.toString() === ca._id.toString()) {
            return { allowed: true, liveTracking: true };
          }
        }
      }
    }

    // ── Transport partner ─────────────────────────────────────────────────────
    if (role === "transportpartner") {
      const tp = await TransportPartner.findOne({ user: userId })
        .select("_id")
        .lean();
      if (tp && booking.transportPartner?.toString() === tp._id.toString())
        return { allowed: true };
    }

    return { allowed: false, reason: "Not linked to this booking" };
  }

  return { allowed: false, reason: "Unknown room format" };
};

export { canJoinRoom };

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING SOCKET SERVICE CLASS — ride/transport only
// ─────────────────────────────────────────────────────────────────────────────

class BookingSocketService {
  /**
   * @param {import('socket.io').Server} io
   */
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map();
    this.locationThrottle = new Map();
    this.etaThrottle = new Map();
  }

  // ── Public emit helpers ────────────────────────────────────────────────────

  emitToRoom(room, event, payload) {
    this.io
      .to(room)
      .emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToSocket(socketId, event, payload) {
    this.io
      .to(socketId)
      .emit(event, { ...payload, _serverTime: new Date().toISOString() });
  }

  emitToAdminOps(event, payload) {
    this.emitToRoom("admin:ops", event, payload);
  }

  emitToAdmins(event, payload) {
    this.emitToRoom("admin:ops", event, payload);
    this.emitToRoom("admin:global", event, payload);
  }

  emitToUser(userId, event, payload) {
    for (const id of this.getSocketIdsByUser(String(userId))) {
      this.emitToSocket(id, event, payload);
    }
  }

  emitJoinRoom(userId, room) {
    const socketIds = this.getSocketIdsByUser(String(userId));
    if (!socketIds.length) return;
    for (const id of socketIds) {
      this.io.in(id).socketsJoin(room);
      const meta = this.connectedClients.get(id);
      if (meta) meta.joinedRooms.add(room);
    }
  }

  emitOtpToAdmin({
    bookingId,
    bookingCode,
    rideId,
    otp,
    customerName,
    customerPhone,
  }) {
    this.emitToAdminOps("otp_for_admin", {
      bookingId,
      bookingCode,
      rideId,
      otp,
      customerName,
      customerPhone,
      note: "Driver arrived. OTP sent to customer via SMS/email/push.",
      timestamp: new Date().toISOString(),
    });
  }

  // ── Socket setup ───────────────────────────────────────────────────────────

  setupSocket(socket, user) {
    const { _id: userId, role, name, driverObjectId } = user;

    this.connectedClients.set(socket.id, {
      userId,
      driverObjectId,
      role,
      name,
      joinedRooms: new Set(),
      connectedAt: new Date(),
    });

    // Auto-join admin rooms
    if (["admin", "superadmin"].includes(role)) {
      socket.join("admin:ops");
      socket.join("admin:global");
      this.connectedClients.get(socket.id)?.joinedRooms.add("admin:ops");
      this.connectedClients.get(socket.id)?.joinedRooms.add("admin:global");
    }

    // Driver personal room
    if (driverObjectId) {
      const driverRoom = `driver:${driverObjectId}`;
      socket.join(driverRoom);
      this.connectedClients.get(socket.id)?.joinedRooms.add(driverRoom);
      this.io.to("admin:ops").emit("driver_online", {
        userId,
        driverObjectId,
        role,
        name,
        timestamp: new Date().toISOString(),
      });
    }

    // Customer personal room
    if (role === "customer") {
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      this.connectedClients.get(socket.id)?.joinedRooms.add(userRoom);
    }

    // ── join_booking_room ───────────────────────────────────────────────────
    socket.on("join_booking_room", async ({ bookingId } = {}) => {
      try {
        if (!bookingId) {
          socket.emit("error", { message: "bookingId required" });
          return;
        }
        const room = `booking:${bookingId}`;
        const { allowed, reason } = await canJoinRoom(
          { _id: userId, role, driverObjectId },
          room,
        );
        if (!allowed) {
          socket.emit("error", { message: reason || "Cannot join room" });
          return;
        }
        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);
        socket.emit("joined_room", {
          room,
          bookingId,
          _serverTime: new Date().toISOString(),
        });
        socket.to(room).emit("participant_joined", {
          role,
          name,
          bookingId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // ── join_tp_room ────────────────────────────────────────────────────────
    socket.on("join_tp_room", async ({ tpId } = {}) => {
      try {
        if (!tpId) {
          socket.emit("error", { message: "tpId required" });
          return;
        }
        const room = `tp:${tpId}`;
        const { allowed, reason } = await canJoinRoom(
          { _id: userId, role, driverObjectId },
          room,
        );
        if (!allowed) {
          socket.emit("error", { message: reason || "Cannot join TP room" });
          return;
        }
        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);
        socket.emit("joined_room", {
          room,
          tpId,
          _serverTime: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to join TP room" });
      }
    });

    // ── driver_location → orchestrator ─────────────────────────────────────
    socket.on("driver_location", async (payload = {}) => {
      if (!["driver", "solodriverpartner"].includes(role)) return;
      await handleDriverLocationUpdate({
        socketId: socket.id,
        userId,
        driverObjectId,
        role,
        name,
        payload,
      }).catch((e) => console.error("[Socket] driver_location:", e.message));
    });

    // ── care_location / care_assistant_location → orchestrator ──────────────
    socket.on("care_location", async (payload = {}) => {
      if (role !== "care_assistant") return;
      await handleCaLocationUpdate({
        socketId: socket.id,
        userId,
        payload,
      }).catch((e) => console.error("[Socket] care_location:", e.message));
    });

    socket.on("care_assistant_location", async (payload = {}) => {
      if (role !== "care_assistant") return;
      await handleCaLocationUpdate({
        socketId: socket.id,
        userId,
        payload,
      }).catch((e) =>
        console.error("[Socket] care_assistant_location:", e.message),
      );
    });

    // ── driver_status_update → orchestrator ────────────────────────────────
    socket.on("driver_status_update", async (payload = {}) => {
      if (!["driver", "solodriverpartner"].includes(role)) return;
      if (!payload.bookingId || !payload.rideId || !payload.status) {
        socket.emit("error", { message: "bookingId, rideId, status required" });
        return;
      }
      if (!driverObjectId) {
        socket.emit("error", { message: "Driver profile not found" });
        return;
      }
      const result = await handleRideStageTransition({
        userId,
        driverObjectId,
        name,
        payload,
      }).catch((e) => ({ success: false, message: e.message }));

      if (!result?.success) {
        socket.emit("error", {
          message: result?.message || "Status update failed",
        });
      } else {
        socket.emit("status_update_ack", {
          rideId: payload.rideId,
          status: payload.status,
          _serverTime: new Date().toISOString(),
        });
      }
    });

    // ── verify_otp → orchestrator ───────────────────────────────────────────
    socket.on("verify_otp", async (payload = {}) => {
      if (!["driver", "solodriverpartner"].includes(role)) return;
      const result = await handleOtpVerify({
        socketId: socket.id,
        userId,
        driverObjectId,
        name,
        payload,
      }).catch((e) => ({ success: false, message: e.message }));

      socket.emit("otp_result", {
        success: result?.success ?? false,
        message: result?.message ?? null,
        _serverTime: new Date().toISOString(),
      });
    });

    // ── sos_trigger → orchestrator ──────────────────────────────────────────
    socket.on("sos_trigger", async (payload = {}) => {
      const { allowed } = await canJoinRoom(
        { _id: userId, role, driverObjectId },
        `booking:${payload.bookingId}`,
      ).catch(() => ({ allowed: false }));
      if (!allowed) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      const result = await handleSos({ userId, role, payload }).catch((e) => ({
        success: false,
        message: e.message,
      }));

      socket.emit("sos_ack", {
        received: result?.success ?? false,
        timestamp: new Date().toISOString(),
      });
    });

    // ── route_deviation → orchestrator ─────────────────────────────────────
    socket.on("route_deviation", async (payload = {}) => {
      await handleRouteDeviation({ userId, payload }).catch((e) =>
        console.error("[Socket] route_deviation:", e.message),
      );
    });

    // ── request_booking_state ───────────────────────────────────────────────
    socket.on("request_booking_state", async ({ bookingId } = {}) => {
      try {
        if (!bookingId || !isValidId(bookingId)) {
          socket.emit("error", { message: "Invalid bookingId" });
          return;
        }
        const { allowed, reason } = await canJoinRoom(
          { _id: userId, role, driverObjectId },
          `booking:${bookingId}`,
        );
        if (!allowed) {
          socket.emit("error", { message: reason });
          return;
        }

        const [booking, activeRide] = await Promise.all([
          Booking.findById(bookingId)
            .select("status scheduledAt bookingType patientInfo fareBreakdown")
            .lean(),
          Ride.findOne({
            booking: bookingId,
            status: { $in: ACTIVE_RIDE_STATUSES },
          })
            .select(
              "status rideStage activeNavigationTarget liveLocation driverSnapshot vehicleSnapshot trackingId pickup dropoff estimatedDistanceKm estimatedDurationMin waypoints",
            )
            .lean(),
        ]);

        if (!booking) {
          socket.emit("error", { message: "Booking not found" });
          return;
        }

        let tracking = null;
        if (activeRide?.trackingId) {
          tracking = await RideTracking.findById(activeRide.trackingId)
            .select(
              "currentEtaMinutes totalDistanceKm hasActiveSos milestones expectedRoutePolyline " +
                "activeTarget careAssistantStatus careAssistantLiveLocation careAssistantJoinedAt " +
                "liveRouteContext",
            )
            .lean();
        }

        // Pull CA join waypoint for full_care_ride
        const caJoinWaypoint = activeRide
          ? ((activeRide.waypoints || []).find(
              (w) => w.type === "care_assistant_join",
            ) ?? null)
          : null;

        const careAssistantStatus =
          tracking?.careAssistantStatus ?? "not_joined";
        const caHasJoined = careAssistantStatus === "in_ride";

        socket.emit("booking_state_snapshot", {
          bookingId,
          bookingStatus: booking.status,
          bookingType: booking.bookingType,
          isFullCareRide: booking.bookingType === "full_care_ride",

          ride: activeRide
            ? {
                status: activeRide.status,
                rideStage: activeRide.rideStage,
                activeNavigationTarget: activeRide.activeNavigationTarget,
                currentTarget: activeRide.activeNavigationTarget,
                liveLocation: activeRide.liveLocation,
                driverSnapshot: activeRide.driverSnapshot,
                vehicleSnapshot: activeRide.vehicleSnapshot,
                currentEtaMinutes: activeRide.currentEtaMinutes,
                pickup: activeRide.pickup,
                dropoff: activeRide.dropoff,
                waypoints: activeRide.waypoints,
                estimatedDistKm: activeRide.estimatedDistanceKm,
                estimatedMinutes: activeRide.estimatedDurationMin,
              }
            : null,

          tracking: tracking
            ? {
                currentEtaMinutes: tracking.currentEtaMinutes,
                totalDistanceKm: tracking.totalDistanceKm,
                hasActiveSos: tracking.hasActiveSos,
                lastMilestone: tracking.milestones?.slice(-1)[0] ?? null,
                expectedRoutePolyline: tracking.expectedRoutePolyline,
                careAssistantStatus,
                careAssistantLiveLocation: tracking.careAssistantLiveLocation,
              }
            : null,

          // Full care ride specific — role-aware view hints
          fullCareRide:
            booking.bookingType === "full_care_ride"
              ? {
                  caJoinPoint: caJoinWaypoint
                    ? {
                        coordinates: caJoinWaypoint.location?.coordinates,
                        address: caJoinWaypoint.location?.address,
                        label: caJoinWaypoint.location?.label,
                        zone: caJoinWaypoint.meta?.zone,
                        isCompleted: caJoinWaypoint.isCompleted,
                        completedAt: caJoinWaypoint.completedAt,
                      }
                    : null,
                  careAssistantStatus,
                  caHasJoined,
                  // Role-based view mode for CA
                  caViewMode:
                    role === "care_assistant"
                      ? caHasJoined
                        ? "driver_tracking_only"
                        : "navigate_to_jp"
                      : null,
                }
              : null,

          _serverTime: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to fetch booking state" });
      }
    });

    // ── otp_resend_request ──────────────────────────────────────────────────
    socket.on("otp_resend_request", async ({ bookingId } = {}) => {
      if (!bookingId || role !== "customer") return;
      socket.to(`booking:${bookingId}`).emit("otp_resend_requested", {
        bookingId,
        requestedBy: "customer",
        timestamp: new Date().toISOString(),
      });
    });

    // ── leave rooms ─────────────────────────────────────────────────────────
    socket.on("leave_booking_room", ({ bookingId } = {}) => {
      if (!bookingId) return;
      const room = `booking:${bookingId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      socket.emit("left_room", { room, _serverTime: new Date().toISOString() });
    });

    socket.on("leave_tp_room", ({ tpId } = {}) => {
      if (!tpId) return;
      const room = `tp:${tpId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      socket.emit("left_room", { room, _serverTime: new Date().toISOString() });
    });

    // ── ping ────────────────────────────────────────────────────────────────
    socket.on("ping_health", () => {
      socket.emit("pong_health", {
        serverTime: new Date().toISOString(),
        connectedSince: this.connectedClients.get(socket.id)?.connectedAt,
      });
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const meta = this.connectedClients.get(socket.id);
      cleanupSocketThrottle(socket.id);
      this.connectedClients.delete(socket.id);

      if (meta && ["driver", "solodriverpartner"].includes(meta.role)) {
        this.io.to("admin:ops").emit("driver_offline", {
          userId: meta.userId,
          driverObjectId: meta.driverObjectId,
          role: meta.role,
          name: meta.name,
          timestamp: new Date().toISOString(),
        });
      }

      if (meta?.joinedRooms) {
        for (const room of meta.joinedRooms) {
          if (room.startsWith("booking:")) {
            this.io.to(room).emit("participant_left", {
              role: meta.role,
              name: meta.name,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });

    socket.on("error", (err) => {
      console.error(`[Socket error] ${socket.id}:`, err?.message ?? err);
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats() {
    const byRole = {};
    const rooms = {};
    for (const [, meta] of this.connectedClients) {
      byRole[meta.role] = (byRole[meta.role] || 0) + 1;
      for (const room of meta.joinedRooms) {
        rooms[room] = (rooms[room] || 0) + 1;
      }
    }
    return {
      totalConnected: this.connectedClients.size,
      byRole,
      activeRooms: Object.keys(rooms).length,
      rooms,
    };
  }

  getSocketIdsByUser(userId) {
    const ids = [];
    for (const [sid, meta] of this.connectedClients) {
      if (meta.userId === String(userId)) ids.push(sid);
    }
    return ids;
  }

  isUserOnline(userId) {
    for (const [, meta] of this.connectedClients) {
      if (meta.userId === String(userId)) return true;
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

export const initBookingSocket = (io) => {
  if (_instance) {
    console.warn("[BookingSocket] Already initialized — skipping");
    return _instance;
  }

  const service = new BookingSocketService(io);
  _instance = service;

  // Global auth middleware (default namespace)
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) return next(new Error("AUTH_MISSING"));

      const decoded = verifySocketToken(token);
      const userId = decoded?.id || decoded?._id;
      if (!userId) return next(new Error("AUTH_INVALID"));

      const user = await User.findById(userId)
        .select("name role isBlocked")
        .lean();
      if (!user) return next(new Error("AUTH_USER_NOT_FOUND"));
      if (user.isBlocked) return next(new Error("AUTH_BLOCKED"));

      let driverObjectId = null;
      if (["driver", "solodriverpartner"].includes(user.role)) {
        const driver = await Driver.findOne({ user: userId })
          .select("_id")
          .lean();
        driverObjectId = driver?._id?.toString() ?? null;
      }

      socket.user = {
        _id: userId.toString(),
        role: user.role,
        name: user.name,
        driverObjectId,
      };

      next();
    } catch (err) {
      console.error("[Socket Auth]", err.message);
      next(new Error(`AUTH_ERROR: ${err.message}`));
    }
  });

  io.on("connection", (socket) => {
    service.setupSocket(socket, socket.user);
  });

  io.on("error", (err) => {
    console.error("[Socket.io server error]", err.message);
  });

  console.log("[BookingSocket] Initialized ✅ (ride/transport only)");
  return service;
};

export const getBookingSocketService = () => _instance;
