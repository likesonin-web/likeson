import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";

import Consultation from "../models/Consultation.js";
import Booking from "../models/Booking.js";
import DoctorProfile from "../models/DoctorProfile.js";
import User from "../models/User.js";
import OutPatientRecord from "../models/OutPatientRecord.js";
import EPrescription from "../models/EPrescription.js";

import { protect, authorize } from "../middleware/authMiddleware.js";
import cache from "../middleware/cache.js";
import redisClient from "../config/redis.js";
import upload from "../middleware/upload.js";
import sendEmail from "../utils/sendEmail.js";
import { transactionalTemplate } from "../utils/emailTemplates.js";
import { getBookingSocketService } from "../services/bookingSocketService.js";
import {
  generateAgoraToken,
  createAgoraRoom,
} from "../services/agoraService.js";
import { createNotification } from "./bookingRouterShared.js";
import { getConsultationSocketService } from "../services/consultationSocketService.js";

const router = express.Router();

const analyticsRateLimiter = rateLimit({
  windowMs: 5_000,
  max: 10,
  keyGenerator: (req) => `analytics:${req.user?._id || req.ip}`,
  message: { success: false, message: "Analytics rate limit exceeded." },
});

const tokenRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => `token:${req.user?._id || req.ip}`,
  message: { success: false, message: "Token refresh rate limit exceeded." },
});

const CACHE_TTL = {
  consultation: 30,
  list: 20,
  stats: 60,
};

const invalidateConsultationCache = async (
  consultationId,
  patientId,
  doctorId,
) => {
  try {
    const patterns = [
      `GET:/consultations/${consultationId}*`,
      `GET:/consultations/patient/${patientId}*`,
      `GET:/consultations/doctor*`,
      `GET:/consultations/admin*`,
    ];
    for (const pattern of patterns) {
      let cursor = 0;
      do {
        const reply = await redisClient.scan(cursor, {
          MATCH: `v1:${pattern}`,
          COUNT: 100,
        });
        cursor = reply.cursor;
        if (reply.keys.length) await redisClient.del(reply.keys);
      } while (cursor !== 0);
    }
  } catch (e) {
    console.error("[Cache] invalidation error:", e.message);
  }
};

const getPagination = (pageStr, limitStr, maxLimit = 100) => {
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(limitStr, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

const stripTokens = (doc) => {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o.hostToken;
  delete o.participantToken;
  delete o.agoraAppId;
  delete o.webhookSecret;
  return o;
};

const resolveDoctorProfile = async (userId) =>
  DoctorProfile.findOne({ user: userId }).select("_id").lean();

const doctorOwnsConsultation = async (consultation, userId) => {
  const dp = await resolveDoctorProfile(userId);
  if (!dp) return false;
  return (
    String(consultation.doctor?._id ?? consultation.doctor) === String(dp._id)
  );
};

const patientOwnsConsultation = (consultation, userId) =>
  String(consultation.patient?._id ?? consultation.patient) === String(userId);

const checkConsultationAccess = async (consultation, req) => {
  const { role, _id } = req.user;
  if (["admin", "superadmin"].includes(role)) return true;
  if (role === "doctor") return doctorOwnsConsultation(consultation, _id);
  if (role === "customer") return patientOwnsConsultation(consultation, _id);
  if (role === "hospital") return consultation.hospital != null;
  if (role === "care_assistant") {
    return String(consultation.careAssistant) === String(_id);
  }
  return false;
};

const emailConsultationUpdate = ({ toUser, subject, body, bookingId }) => {
  if (!toUser?.email) return;
  sendEmail({
    email: toUser.email,
    subject: `${subject} | Likeson Healthcare`,
    html: transactionalTemplate({
      header: "CONSULTATION UPDATE",
      title: subject,
      body,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${bookingId}`,
      buttonText: "View Consultation",
    }),
  }).catch((e) => console.error("[emailConsultationUpdate]", e.message));
};

const emitBooking = (bookingId, event, data) => {
  getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, event, data);
  getConsultationSocketService()?.emitToBookingRoom(
    String(bookingId),
    event,
    data,
  );
};

const TERMINAL = new Set(["completed", "cancelled", "failed", "expired"]);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CREATE
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/",
  protect,
  authorize("admin", "superadmin", "doctor"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const {
        bookingId,
        consultationType = "video",
        scheduledStartTime,
        estimatedDurationMinutes = 30,
        language = "English",
        priority = "routine",
        specialty,
        waitingRoomEnabled = true,
        screenShareEnabled = true,
        transcriptionEnabled = false,
        maxParticipants = 5,
      } = req.body;

      if (!bookingId) throw new Error("bookingId required");
      if (!scheduledStartTime) throw new Error("scheduledStartTime required");

      const booking = await Booking.findById(bookingId).session(session).lean();
      if (!booking) throw new Error("Booking not found");

      if (booking.consultationSessionId) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Consultation already exists for this booking",
          consultationId: booking.consultationSessionId,
        });
      }

      if (req.user.role === "doctor") {
        const dp = await resolveDoctorProfile(req.user._id);
        if (!dp || String(booking.doctor) !== String(dp._id))
          throw new Error("Access denied");
      }

      const { channelName } = createAgoraRoom(
        booking.bookingCode,
        booking._id.toString(),
      );

      const hostToken = generateAgoraToken(
        channelName,
        "host",
        booking.doctor.toString(),
      );
      const participantToken = generateAgoraToken(
        channelName,
        "participant",
        booking.customer.toString(),
      );

      const [consultation] = await Consultation.create(
        [
          {
            bookingId: booking._id,
            patient: booking.customer,
            doctor: booking.doctor,
            hospital: booking.hospital || null,
            careAssistant: booking.careAssistant || null,
            consultationType,
            consultationMode: "scheduled",
            language,
            priority,
            specialty: specialty || null,
            scheduledStartTime: new Date(scheduledStartTime),
            estimatedDurationMinutes,
            waitingRoomEnabled,
            screenShareEnabled,
            transcriptionEnabled,
            maxParticipants,
            provider: "Agora",
            agoraAppId: process.env.AGORAIO_APP_ID,
            agoraChannelId: channelName,
            hostToken,
            participantToken,
            status: "created",
            createdBy: req.user._id,
          },
        ],
        { session },
      );

      await Booking.findByIdAndUpdate(
        bookingId,
        { $set: { consultationSessionId: consultation._id } },
        { session },
      );

      await session.commitTransaction();

      const patient = await User.findById(booking.customer)
        .select("email name phone")
        .lean();

      await createNotification({
        recipient: booking.customer,
        title: "Consultation Scheduled",
        body: `Your ${consultationType} consultation has been scheduled.`,
        type: "Booking_Confirmed",
        bookingId: booking._id,
      });

      emailConsultationUpdate({
        toUser: patient,
        subject: `Consultation Scheduled — Booking #${booking.bookingCode}`,
        body: `<b>Type:</b> ${consultationType}<br/>
                    <b>Scheduled:</b> ${new Date(scheduledStartTime).toLocaleString("en-IN")}<br/>
                    <b>Duration:</b> ${estimatedDurationMinutes} minutes`,
        bookingId: booking._id,
      });

      emitBooking(booking._id, "consultation_created", {
        consultationId: consultation._id,
        status: "created",
        timestamp: new Date(),
      });

      return res.status(201).json({
        success: true,
        message: "Consultation created",
        data: { consultation: { ...stripTokens(consultation), channelName } },
      });
    } catch (err) {
      await session.abortTransaction();
      return res
        .status(err.message === "Access denied" ? 403 : 400)
        .json({ success: false, message: err.message });
    } finally {
      session.endSession();
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — READ
// ══════════════════════════════════════════════════════════════════════════════

router.get(
  "/patient/me",
  protect,
  authorize("customer"),
  cache(
    CACHE_TTL.list,
    (req) => `GET:/consultations/patient/${req.user._id}:${req.originalUrl}`,
  ),
  async (req, res) => {
    try {
      const { status, type } = req.query;
      const { page, limit, skip } = getPagination(
        req.query.page,
        req.query.limit,
      );

      const filter = { patient: req.user._id };
      if (status) filter.status = status;
      if (type) filter.consultationType = type;

      const [consultations, total] = await Promise.all([
        Consultation.find(filter)
          .select(
            "-hostToken -participantToken -webhookSecret -doctorInternalNotes -internalAdminNotes -networkAnalytics -sdkErrors -reconnectLogs -eventLogs -analytics",
          )
          .populate({
            path: "doctor",
            populate: { path: "user", select: "name phone" },
          })
          .populate("hospital", "name address")
          .sort({ scheduledStartTime: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Consultation.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: {
          consultations: consultations.map((c) => ({
            ...stripTokens(c),
            roomId: c.agoraChannelId,
          })),
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/doctor/me",
  protect,
  authorize("doctor"),
  cache(
    CACHE_TTL.list,
    (req) => `GET:/consultations/doctor:${req.user._id}:${req.originalUrl}`,
  ),
  async (req, res) => {
    try {
      const dp = await resolveDoctorProfile(req.user._id);
      if (!dp)
        return res
          .status(404)
          .json({ success: false, message: "Doctor profile not found" });

      const { status, date, type } = req.query;
      const { page, limit, skip } = getPagination(
        req.query.page,
        req.query.limit,
      );

      const filter = { doctor: dp._id };
      if (status) filter.status = status;
      if (type) filter.consultationType = type;
      if (date) {
        const d = new Date(date),
          next = new Date(d);
        next.setDate(next.getDate() + 1);
        filter.scheduledStartTime = { $gte: d, $lt: next };
      }

      const [consultations, total] = await Promise.all([
        Consultation.find(filter)
          .select(
            "-hostToken -participantToken -webhookSecret -internalAdminNotes",
          )
          .populate("patient", "name phone email avatar")
          .populate("hospital", "name address")
          .sort({ scheduledStartTime: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Consultation.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: {
          consultations: consultations.map((c) => ({
            ...stripTokens(c),
            roomId: c.agoraChannelId,
          })),
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/admin/all",
  protect,
  authorize("admin", "superadmin"),
  cache(
    CACHE_TTL.list,
    (req) => `GET:/consultations/admin/all:${req.originalUrl}`,
  ),
  async (req, res) => {
    try {
      const { status, doctorId, patientId, hospitalId, date, priority, type } =
        req.query;
      const { page, limit, skip } = getPagination(
        req.query.page,
        req.query.limit,
      );

      const filter = {};
      if (status) filter.status = status;
      if (doctorId) filter.doctor = doctorId;
      if (patientId) filter.patient = patientId;
      if (hospitalId) filter.hospital = hospitalId;
      if (priority) filter.priority = priority;
      if (type) filter.consultationType = type;
      if (date) {
        const d = new Date(date),
          next = new Date(d);
        next.setDate(next.getDate() + 1);
        filter.scheduledStartTime = { $gte: d, $lt: next };
      }

      const [consultations, total] = await Promise.all([
        Consultation.find(filter)
          .select(
            "-hostToken -participantToken -webhookSecret -doctorInternalNotes -internalAdminNotes -networkAnalytics -sdkErrors -reconnectLogs -eventLogs",
          )
          .populate("patient", "name phone email")
          .populate({
            path: "doctor",
            populate: { path: "user", select: "name phone" },
          })
          .populate("hospital", "name")
          .sort({ scheduledStartTime: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Consultation.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: {
          consultations: consultations.map((c) => ({
            ...stripTokens(c),
            roomId: c.agoraChannelId,
          })),
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/admin/stats",
  protect,
  authorize("admin", "superadmin"),
  cache(
    CACHE_TTL.stats,
    (req) => `GET:/consultations/admin/stats:${req.originalUrl}`,
  ),
  async (req, res) => {
    try {
      const { from, to } = req.query;
      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to);
      const matchStage = Object.keys(dateFilter).length
        ? { createdAt: dateFilter }
        : {};

      const [statusStats, typeStats, avgDuration, priorityStats] =
        await Promise.all([
          Consultation.aggregate([
            { $match: matchStage },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ]),
          Consultation.aggregate([
            { $match: matchStage },
            { $group: { _id: "$consultationType", count: { $sum: 1 } } },
          ]),
          Consultation.aggregate([
            {
              $match: {
                ...matchStage,
                status: "completed",
                actualDurationMinutes: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                avgDuration: { $avg: "$actualDurationMinutes" },
                total: { $sum: 1 },
              },
            },
          ]),
          Consultation.aggregate([
            { $match: matchStage },
            { $group: { _id: "$priority", count: { $sum: 1 } } },
          ]),
        ]);

      return res.json({
        success: true,
        data: {
          byStatus: Object.fromEntries(
            statusStats.map((s) => [s._id, s.count]),
          ),
          byType: Object.fromEntries(typeStats.map((s) => [s._id, s.count])),
          byPriority: Object.fromEntries(
            priorityStats.map((s) => [s._id, s.count]),
          ),
          avgDuration: avgDuration[0]
            ? Math.round(avgDuration[0].avgDuration)
            : 0,
          totalCompleted: avgDuration[0]?.total ?? 0,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/by-booking/:bookingId",
  protect,
  cache(
    CACHE_TTL.consultation,
    (req) =>
      `GET:/consultations/by-booking/${req.params.bookingId}:${req.user._id}`,
  ),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select("customer doctor consultationSessionId bookingCode")
        .lean();
      if (!booking)
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });

      const { role, _id } = req.user;
      if (role === "customer" && String(booking.customer) !== String(_id))
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      if (role === "doctor") {
        const dp = await resolveDoctorProfile(_id);
        if (!dp || String(booking.doctor) !== String(dp._id))
          return res
            .status(403)
            .json({ success: false, message: "Access denied" });
      }
      if (!booking.consultationSessionId)
        return res
          .status(404)
          .json({
            success: false,
            message: "No consultation linked to this booking",
          });

      const consultation = await Consultation.findById(
        booking.consultationSessionId,
      )
        .populate("patient", "name phone email")
        .populate({
          path: "doctor",
          populate: { path: "user", select: "name phone" },
        })
        .populate("hospital", "name address")
        .lean();
      if (!consultation)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      return res.json({
        success: true,
        data: {
          consultation: {
            ...stripTokens(consultation),
            roomId: consultation.agoraChannelId,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get("/prescriptions/verify/:rxNumber", async (req, res) => {
  try {
    const rx = await EPrescription.findOne({ rxNumber: req.params.rxNumber })
      .select("rxNumber status issuedAt expiresAt doctor patient diagnosis")
      .lean();
    if (!rx)
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });

    return res.json({
      success: true,
      data: {
        rxNumber: rx.rxNumber,
        status: rx.status,
        issuedAt: rx.issuedAt,
        expiresAt: rx.expiresAt,
        doctorName: rx.doctor?.name,
        doctorRegNo: rx.doctor?.registrationNumber,
        patientName: rx.patient?.name,
        diagnosis: rx.diagnosis || null,
        isValid: rx.status === "issued" && new Date() < new Date(rx.expiresAt),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get(
  "/:id",
  protect,
  cache(
    CACHE_TTL.consultation,
    (req) => `GET:/consultations/${req.params.id}:${req.user._id}`,
  ),
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.id)
        .populate("patient", "name phone email avatar")
        .populate({
          path: "doctor",
          populate: { path: "user", select: "name phone email avatar" },
        })
        .populate("hospital", "name address contact")
        .populate("careAssistant", "fullName phone photoUrl")
        .populate("participants.userId", "name phone email avatar")
        .populate("waitingRoomQueue.userId", "name phone email avatar")
        .lean();
      if (!consultation)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      const allowed = await checkConsultationAccess(consultation, req);
      if (!allowed)
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      return res.json({
        success: true,
        data: {
          consultation: {
            ...stripTokens(consultation),
            roomId: consultation.agoraChannelId,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — TOKEN / JOIN
// ══════════════════════════════════════════════════════════════════════════════

router.get("/:id/join-token", protect, tokenRateLimiter, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .select("agoraChannelId status patient doctor provider bookingId")
      .lean();

    if (!consultation)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    if (!["scheduled", "waiting", "active"].includes(consultation.status))
      return res.status(400).json({
        success: false,
        message: `Cannot join in status: ${consultation.status}`,
      });

    const allowed = await checkConsultationAccess(consultation, req);
    if (!allowed)
      return res.status(403).json({ success: false, message: "Access denied" });

    let channelName = consultation.agoraChannelId;
    if (!channelName) {
      const booking = await Booking.findById(consultation.bookingId)
        .select("bookingCode")
        .lean();
      channelName = createAgoraRoom(
        booking?.bookingCode || "legacy",
        consultation.bookingId.toString(),
      ).channelName;
      await Consultation.findByIdAndUpdate(consultation._id, {
        $set: { agoraChannelId: channelName },
      });
    }

    let isHost = false;
    if (["admin", "superadmin"].includes(req.user.role)) {
      isHost = true;
    } else if (req.user.role === "doctor") {
      const dp = await resolveDoctorProfile(req.user._id);
      if (
        dp &&
        String(consultation.doctor?._id ?? consultation.doctor) ===
          String(dp._id)
      ) {
        isHost = true;
      }
    }

    const rawHex = req.user._id.toString().slice(-8);
    const uid = parseInt(rawHex, 16) % 2_000_000_000;

    const token = generateAgoraToken(
      channelName,
      isHost ? "host" : "participant",
      "",
      7200,
    );

    const screenUid = uid + 100_000;

    return res.json({
      success: true,
      data: {
        appId: process.env.AGORAIO_APP_ID,
        channelName,
        token,
        uid,
        screenUid,
        role: isHost ? "doctor" : "patient",
        status: consultation.status,
        expiresInSeconds: 7200,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — CONSENT
// ══════════════════════════════════════════════════════════════════════════════

router.patch("/:id/consent", protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      consentType = "telemedicine",
      accepted = true,
      consentVersion = "1.0",
    } = req.body;

    const consultation = await Consultation.findById(req.params.id)
      .select("patient bookingId telemedicineConsentAccepted")
      .session(session);
    if (!consultation) throw new Error("Consultation not found");

    if (
      req.user.role === "customer" &&
      !patientOwnsConsultation(consultation, req.user._id)
    )
      throw new Error("Access denied");

    await Consultation.updateOne(
      { _id: req.params.id },
      { $pull: { consents: { consentType } } },
      { session },
    );
    await Consultation.updateOne(
      { _id: req.params.id },
      {
        $push: {
          consents: {
            consentType,
            accepted,
            acceptedAt: accepted ? new Date() : undefined,
            consentVersion,
          },
        },
        $set: {
          ...(consentType === "telemedicine"
            ? { telemedicineConsentAccepted: accepted }
            : {}),
          updatedBy: req.user._id,
        },
      },
      { session },
    );

    await session.commitTransaction();

    emitBooking(consultation.bookingId, "consent_updated", {
      consultationId: consultation._id,
      consentType,
      accepted,
      timestamp: new Date(),
    });

    return res.json({
      success: true,
      message: `Consent '${consentType}' recorded`,
      data: { consentType, accepted },
    });
  } catch (err) {
    await session.abortTransaction();
    return res
      .status(err.message === "Access denied" ? 403 : 400)
      .json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
});

router.get("/:id/consents", protect, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .select("consents telemedicineConsentAccepted patient doctor")
      .lean();
    if (!consultation)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    const allowed = await checkConsultationAccess(consultation, req);
    if (!allowed)
      return res.status(403).json({ success: false, message: "Access denied" });

    return res.json({
      success: true,
      data: {
        consents: consultation.consents ?? [],
        telemedicineConsentAccepted: consultation.telemedicineConsentAccepted,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — WAITING ROOM
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/:id/waiting-room/enter",
  protect,
  authorize("customer"),
  async (req, res) => {
    try {
      const check = await Consultation.findById(req.params.id)
        .select(
          "status patient bookingId waitingRoomQueue patientJoinedAt waitingRoomEnabled",
        )
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (!patientOwnsConsultation(check, req.user._id))
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      if (!check.waitingRoomEnabled)
        return res
          .status(400)
          .json({
            success: false,
            message: "Waiting room not enabled for this consultation",
          });

      if (!["scheduled", "waiting", "created"].includes(check.status))
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot enter waiting room in status: ${check.status}`,
          });

      // FIX: Check if patient already in queue before attempting update
      const alreadyInQueue = check.waitingRoomQueue?.some(
        (e) =>
          String(e.userId) === String(req.user._id) &&
          e.waitingRoomStatus === "waiting",
      );

      const queuePosition =
        (check.waitingRoomQueue?.filter(
          (e) => e.waitingRoomStatus === "waiting",
        ).length ?? 0) + (alreadyInQueue ? 0 : 1);

      if (alreadyInQueue) {
        // Patient already in queue — return current position without error
        const existingEntry = check.waitingRoomQueue.find(
          (e) => String(e.userId) === String(req.user._id),
        );
        return res.json({
          success: true,
          message: "Already in waiting room",
          data: {
            status: check.status,
            queuePosition: existingEntry?.queuePosition ?? 1,
          },
        });
      }

      const updated = await Consultation.findOneAndUpdate(
        {
          _id: req.params.id,
          "waitingRoomQueue.userId": { $ne: req.user._id },
        },
        {
          $push: {
            waitingRoomQueue: {
              userId: req.user._id,
              role: "patient",
              displayName: req.user.name,
              enteredAt: new Date(),
              queuePosition,
              waitingRoomStatus: "waiting",
            },
          },
          $set: {
            status: "waiting",
            consultationStage: "waiting_room",
            patientJoinedAt: check.patientJoinedAt || new Date(),
            updatedBy: req.user._id,
          },
        },
        { new: true },
      );

      // FIX: if updated is null here, it means race condition — patient was inserted by concurrent request
      if (!updated) {
        return res.json({
          success: true,
          message: "Entered waiting room",
          data: { status: "waiting", queuePosition: 1 },
        });
      }

      const savedQueuePosition =
        updated.waitingRoomQueue?.filter(
          (e) => e.waitingRoomStatus === "waiting",
        ).length ?? queuePosition;

      const svc = getConsultationSocketService();
      if (svc) {
        svc.emitToBookingRoom(
          String(updated.bookingId),
          "patient_entered_waiting_room",
          {
            consultationId: String(updated._id),
            patientId: String(req.user._id),
            patientName: req.user.name,
            queuePosition: savedQueuePosition,
            timestamp: new Date(),
          },
        );
      }

      return res.json({
        success: true,
        message: "Entered waiting room",
        data: { status: "waiting", queuePosition: savedQueuePosition },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/waiting-room/approve",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId)
        return res
          .status(400)
          .json({ success: false, message: "userId required" });

      const check = await Consultation.findById(req.params.id)
        .select("doctor")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      const consultation = await Consultation.findOneAndUpdate(
        {
          _id: req.params.id,
          "waitingRoomQueue.userId": userId,
          "waitingRoomQueue.waitingRoomStatus": "waiting",
        },
        {
          $set: {
            "waitingRoomQueue.$.waitingRoomStatus": "approved",
            "waitingRoomQueue.$.approvedAt": new Date(),
            "waitingRoomQueue.$.approvedBy": req.user._id,
            updatedBy: req.user._id,
          },
        },
        { new: true },
      );
      if (!consultation)
        return res
          .status(404)
          .json({
            success: false,
            message: "Patient not in waiting room or already approved",
          });

      emitBooking(consultation.bookingId, "waiting_room_approved", {
        consultationId: String(consultation._id),
        userId: String(userId),
        timestamp: new Date(),
      });

      await createNotification({
        recipient: userId,
        title: "Doctor is Ready",
        body: "Your doctor has admitted you. Please join the consultation now.",
        type: "Booking_Confirmed",
        bookingId: consultation.bookingId,
      });

      return res.json({ success: true, message: "Patient approved" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/waiting-room/reject",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { userId, reason } = req.body;
      if (!userId)
        return res
          .status(400)
          .json({ success: false, message: "userId required" });

      const check = await Consultation.findById(req.params.id)
        .select("doctor")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      const consultation = await Consultation.findOneAndUpdate(
        { _id: req.params.id, "waitingRoomQueue.userId": userId },
        {
          $set: {
            "waitingRoomQueue.$.waitingRoomStatus": "rejected",
            "waitingRoomQueue.$.rejectedAt": new Date(),
            "waitingRoomQueue.$.rejectionReason": reason || null,
            updatedBy: req.user._id,
          },
        },
        { new: true },
      );
      if (!consultation)
        return res
          .status(404)
          .json({ success: false, message: "Patient not in waiting room" });

      emitBooking(consultation.bookingId, "waiting_room_rejected", {
        consultationId: String(consultation._id),
        userId: String(userId),
        reason: reason || null,
        timestamp: new Date(),
      });

      await createNotification({
        recipient: userId,
        title: "Waiting Room",
        body: reason
          ? `Entry rejected: ${reason}`
          : "Entry to consultation was rejected.",
        type: "Booking_Confirmed",
        bookingId: consultation.bookingId,
      });

      return res.json({
        success: true,
        message: "Patient rejected from waiting room",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/:id/waiting-room",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const check = await Consultation.findById(req.params.id)
        .select("doctor waitingRoomQueue bookingId")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      return res.json({
        success: true,
        data: { queue: check.waitingRoomQueue ?? [] },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

router.patch("/:id/accept", protect, authorize("doctor"), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const dp = await resolveDoctorProfile(req.user._id);
    if (!dp) throw new Error("Doctor profile not found");

    // FIX: Find by _id only, then verify doctor ownership — avoids ObjectId type mismatch
    // if booking.doctor was stored as User ID vs DoctorProfile ID
    const consultation = await Consultation.findById(req.params.id).session(
      session,
    );
    if (!consultation) throw new Error("Consultation not found");
    if (String(consultation.doctor) !== String(dp._id))
      throw new Error("Consultation not found or not assigned to you");

    if (!["created", "scheduled"].includes(consultation.status))
      throw new Error(`Cannot accept in status: ${consultation.status}`);

    consultation.status = "waiting";
    consultation.consultationStage = "waiting_room";
    consultation.doctorJoinedAt = new Date();
    consultation.updatedBy = req.user._id;
    await consultation.save({ session });

    await Booking.findByIdAndUpdate(
      consultation.bookingId,
      { $set: { status: "confirmed", updatedBy: req.user._id } },
      { session },
    );
    await session.commitTransaction();

    const patient = await User.findById(consultation.patient)
      .select("email name phone")
      .lean();
    await createNotification({
      recipient: consultation.patient,
      title: "Doctor Accepted",
      body: "Your doctor accepted. Please join the waiting room.",
      type: "Booking_Confirmed",
      bookingId: consultation.bookingId,
    });
    emailConsultationUpdate({
      toUser: patient,
      subject: "Doctor Accepted Your Consultation",
      body: `Scheduled: ${new Date(consultation.scheduledStartTime).toLocaleString("en-IN")}`,
      bookingId: consultation.bookingId,
    });
    emitBooking(consultation.bookingId, "consultation_accepted", {
      consultationId: consultation._id,
      status: "waiting",
      timestamp: new Date(),
    });

    await invalidateConsultationCache(
      consultation._id,
      consultation.patient,
      consultation.doctor,
    );
    return res.json({
      success: true,
      message: "Consultation accepted",
      data: { consultation: stripTokens(consultation) },
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(400).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
});

router.patch(
  "/:id/confirm",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { consentAccepted = false } = req.body;

      const consultation = await Consultation.findById(req.params.id).session(
        session,
      );
      if (!consultation) throw new Error("Consultation not found");

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(consultation, req.user._id))
      )
        throw new Error("Access denied");

      if (TERMINAL.has(consultation.status))
        throw new Error(`Cannot confirm in status: ${consultation.status}`);

      if (
        consentAccepted &&
        !consultation.consents?.find((c) => c.consentType === "telemedicine")
      ) {
        consultation.consents.push({
          consentType: "telemedicine",
          accepted: true,
          acceptedAt: new Date(),
          consentVersion: "1.0",
        });
        consultation.telemedicineConsentAccepted = true;
      }

      consultation.status = "scheduled";
      consultation.consultationStage = "pre_consultation";
      consultation.updatedBy = req.user._id;
      await consultation.save({ session });
      await Booking.findByIdAndUpdate(
        consultation.bookingId,
        { $set: { status: "confirmed", updatedBy: req.user._id } },
        { session },
      );
      await session.commitTransaction();

      await createNotification({
        recipient: consultation.patient,
        title: "Consultation Confirmed",
        body: "Your consultation is confirmed.",
        type: "Booking_Confirmed",
        bookingId: consultation.bookingId,
      });
      emitBooking(consultation.bookingId, "consultation_confirmed", {
        consultationId: consultation._id,
        status: "scheduled",
        timestamp: new Date(),
      });

      await invalidateConsultationCache(
        consultation._id,
        consultation.patient,
        consultation.doctor,
      );
      return res.json({
        success: true,
        message: "Consultation confirmed",
        data: { consultation: stripTokens(consultation) },
      });
    } catch (err) {
      await session.abortTransaction();
      return res
        .status(err.message === "Access denied" ? 403 : 400)
        .json({ success: false, message: err.message });
    } finally {
      session.endSession();
    }
  },
);

router.patch(
  "/:id/start",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const consultation = await Consultation.findById(req.params.id).session(
        session,
      );
      if (!consultation) throw new Error("Consultation not found");

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(consultation, req.user._id))
      )
        throw new Error("Access denied");

      if (consultation.status !== "waiting")
        throw new Error(
          `Consultation must be 'waiting' to start. Current: ${consultation.status}`,
        );

      if (!consultation.telemedicineConsentAccepted)
        throw new Error("Telemedicine consent required before starting");

      consultation.status = "active";
      consultation.consultationStage = "in_progress";
      consultation.actualStartTime = new Date();
      consultation.roomStarted = true;
      consultation.doctorJoinedAt = consultation.doctorJoinedAt || new Date();
      consultation.updatedBy = req.user._id;
      await consultation.save({ session });
      await Booking.findByIdAndUpdate(
        consultation.bookingId,
        { $set: { status: "in_progress", updatedBy: req.user._id } },
        { session },
      );
      await session.commitTransaction();

      await createNotification({
        recipient: consultation.patient,
        title: "Consultation Started",
        body: "Your consultation has started. Please join now.",
        type: "Care_Task_Started",
        bookingId: consultation.bookingId,
      });
      emitBooking(consultation.bookingId, "consultation_started", {
        consultationId: consultation._id,
        roomId: consultation.agoraChannelId,
        provider: "Agora",
        timestamp: new Date(),
      });

      await invalidateConsultationCache(
        consultation._id,
        consultation.patient,
        consultation.doctor,
      );
      return res.json({
        success: true,
        message: "Consultation started",
        data: { consultation: stripTokens(consultation) },
      });
    } catch (err) {
      await session.abortTransaction();
      return res
        .status(err.message === "Access denied" ? 403 : 400)
        .json({ success: false, message: err.message });
    } finally {
      session.endSession();
    }
  },
);

router.patch(
  "/:id/pause",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const check = await Consultation.findById(req.params.id)
        .select("status doctor bookingId")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      if (check.status !== "active")
        return res
          .status(400)
          .json({
            success: false,
            message: `Can only pause active. Current: ${check.status}`,
          });

      const consultation = await Consultation.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "paused", updatedBy: req.user._id } },
        { new: true },
      );

      emitBooking(consultation.bookingId, "consultation_paused", {
        consultationId: consultation._id,
        reason,
        timestamp: new Date(),
      });
      return res.json({
        success: true,
        message: "Consultation paused",
        data: { consultation: stripTokens(consultation) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/resume",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const check = await Consultation.findById(req.params.id)
        .select("status doctor bookingId")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      if (check.status !== "paused")
        return res
          .status(400)
          .json({
            success: false,
            message: `Can only resume paused. Current: ${check.status}`,
          });

      const consultation = await Consultation.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "active", updatedBy: req.user._id } },
        { new: true },
      );

      emitBooking(consultation.bookingId, "consultation_resumed", {
        consultationId: consultation._id,
        timestamp: new Date(),
      });
      return res.json({
        success: true,
        message: "Consultation resumed",
        data: { consultation: stripTokens(consultation) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/end",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { reason, prescriptionUploaded = false } = req.body;

      const consultation = await Consultation.findById(req.params.id).session(
        session,
      );
      if (!consultation) throw new Error("Consultation not found");

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(consultation, req.user._id))
      )
        throw new Error("Access denied");

      if (!["active", "paused"].includes(consultation.status))
        throw new Error(
          `Can only end active or paused. Current: ${consultation.status}`,
        );

      const now = new Date();
      consultation.status = "completed";
      consultation.actualEndTime = now;
      consultation.roomEnded = true;
      consultation.patientLeftAt = now;
      consultation.doctorLeftAt = now;
      consultation.prescriptionUploaded = prescriptionUploaded;
      consultation.endedBy = req.user.role === "doctor" ? "doctor" : "admin";
      consultation.endedByUserId = req.user._id;
      consultation.endedReason = reason || null;
      consultation.updatedBy = req.user._id;

      if (consultation.actualStartTime) {
        consultation.actualDurationMinutes = Math.round(
          (now - consultation.actualStartTime) / 60000,
        );
      }
      await consultation.save({ session });
      await Booking.findByIdAndUpdate(
        consultation.bookingId,
        { $set: { status: "completed", updatedBy: req.user._id } },
        { session },
      );
      await session.commitTransaction();

      const patient = await User.findById(consultation.patient)
        .select("email name phone")
        .lean();
      await createNotification({
        recipient: consultation.patient,
        title: "Consultation Completed",
        body: "Your consultation has ended. Check your email for the prescription.",
        type: "Care_Task_Completed",
        bookingId: consultation.bookingId,
      });
      emailConsultationUpdate({
        toUser: patient,
        subject: "Consultation Completed",
        body: `<b>Duration:</b> ${consultation.actualDurationMinutes} minutes<br/>
                    <b>Prescription:</b> ${prescriptionUploaded ? "Uploaded" : "Pending"}<br/>
                    Please rate your experience.`,
        bookingId: consultation.bookingId,
      });
      emitBooking(consultation.bookingId, "consultation_ended", {
        consultationId: consultation._id,
        status: "completed",
        actualDurationMinutes: consultation.actualDurationMinutes,
        timestamp: now,
      });

      await invalidateConsultationCache(
        consultation._id,
        consultation.patient,
        consultation.doctor,
      );
      return res.json({
        success: true,
        message: "Consultation ended",
        data: { consultation: stripTokens(consultation) },
      });
    } catch (err) {
      await session.abortTransaction();
      return res
        .status(err.message === "Access denied" ? 403 : 400)
        .json({ success: false, message: err.message });
    } finally {
      session.endSession();
    }
  },
);

router.patch("/:id/cancel", protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { reason } = req.body;
    const consultation = await Consultation.findById(req.params.id).session(
      session,
    );
    if (!consultation) throw new Error("Consultation not found");

    const { role, _id } = req.user;
    if (role === "customer") {
      if (!patientOwnsConsultation(consultation, _id))
        throw new Error("Access denied");
      if (consultation.status === "active")
        throw new Error(
          "Cannot cancel active consultation. Ask doctor to end it.",
        );
    }
    if (role === "doctor" && !(await doctorOwnsConsultation(consultation, _id)))
      throw new Error("Access denied");

    if (TERMINAL.has(consultation.status))
      throw new Error(`Cannot cancel in status: ${consultation.status}`);

    const now = new Date();
    consultation.status = "cancelled";
    consultation.cancelledBy =
      role === "customer" ? "patient" : role === "doctor" ? "doctor" : "admin";
    consultation.cancelledByUserId = _id;
    consultation.cancellationReason = reason || null;
    consultation.cancelledAt = now;
    consultation.consultationStage = "closed";
    consultation.updatedBy = _id;
    await consultation.save({ session });

    const booking = await Booking.findById(consultation.bookingId).session(
      session,
    );
    if (booking && ["pending", "confirmed"].includes(booking.status)) {
      booking.status = "cancelled";
      booking.updatedBy = _id;
      await booking.save({ session });
    }
    await session.commitTransaction();

    const patient = await User.findById(consultation.patient)
      .select("email name phone")
      .lean();
    await createNotification({
      recipient: consultation.patient,
      title: "Consultation Cancelled",
      body: reason || "Your consultation has been cancelled.",
      type: "Booking_Confirmed",
      bookingId: consultation.bookingId,
    });
    emailConsultationUpdate({
      toUser: patient,
      subject: "Consultation Cancelled",
      body: reason
        ? `<b>Reason:</b> ${reason}`
        : "Your consultation has been cancelled.",
      bookingId: consultation.bookingId,
    });
    emitBooking(consultation.bookingId, "consultation_cancelled", {
      consultationId: consultation._id,
      reason,
      cancelledBy: consultation.cancelledBy,
      timestamp: now,
    });

    await invalidateConsultationCache(
      consultation._id,
      consultation.patient,
      consultation.doctor,
    );
    return res.json({
      success: true,
      message: "Consultation cancelled",
      data: { consultation: stripTokens(consultation) },
    });
  } catch (err) {
    await session.abortTransaction();
    return res
      .status(err.message === "Access denied" ? 403 : 400)
      .json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — FILE ATTACHMENTS
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/:id/attachments",
  protect,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });

      const {
        attachmentType = "medical_document",
        description,
        accessLevel = "shared",
      } = req.body;

      const VALID_TYPES = [
        "prescription",
        "lab_report",
        "xray",
        "scan",
        "insurance",
        "medical_document",
        "image",
        "video",
      ];
      if (!VALID_TYPES.includes(attachmentType))
        return res
          .status(400)
          .json({
            success: false,
            message: `Invalid attachmentType. One of: ${VALID_TYPES.join(", ")}`,
          });

      const check = await Consultation.findById(req.params.id)
        .select("status patient doctor bookingId")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      const allowed = await checkConsultationAccess(check, req);
      if (!allowed)
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      let uploaderRole = "patient";
      if (req.user.role === "doctor") uploaderRole = "doctor";
      else if (["admin", "superadmin"].includes(req.user.role))
        uploaderRole = "admin";
      else if (req.user.role === "care_assistant")
        uploaderRole = "care_assistant";

      const attachment = {
        uploadedBy: req.user._id,
        uploaderRole,
        attachmentType,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageUrl: req.file.location,
        accessLevel,
        description: description || null,
        encrypted: true,
        uploadedAt: new Date(),
      };

      const consultation = await Consultation.findByIdAndUpdate(
        req.params.id,
        {
          $push: { attachments: attachment },
          $set: { updatedBy: req.user._id },
        },
        { new: true },
      );
      const saved = consultation.attachments.at(-1);

      emitBooking(check.bookingId, "attachment_uploaded", {
        consultationId: check._id,
        attachmentId: saved._id,
        attachmentType,
        uploaderRole,
        fileName: req.file.originalname,
        timestamp: new Date(),
      });

      return res
        .status(201)
        .json({
          success: true,
          message: "Attachment uploaded",
          data: { attachment: saved },
        });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get("/:id/attachments", protect, async (req, res) => {
  try {
    const { type } = req.query;

    const check = await Consultation.findById(req.params.id)
      .select("attachments patient doctor")
      .lean();
    if (!check)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    const allowed = await checkConsultationAccess(check, req);
    if (!allowed)
      return res.status(403).json({ success: false, message: "Access denied" });

    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    const isDoctor = req.user.role === "doctor";

    let attachments = (check.attachments ?? []).filter((a) => !a.isDeleted);

    if (!isAdmin) {
      attachments = attachments.filter((a) => {
        if (a.accessLevel === "shared") return true;
        if (a.accessLevel === "private")
          return String(a.uploadedBy) === String(req.user._id);
        if (a.accessLevel === "doctor_only") return isDoctor;
        if (a.accessLevel === "patient_only")
          return req.user.role === "customer";
        return false;
      });
    }

    if (type)
      attachments = attachments.filter((a) => a.attachmentType === type);

    return res.json({
      success: true,
      data: { attachments, total: attachments.length },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id/attachments/:attachmentId", protect, async (req, res) => {
  try {
    const check = await Consultation.findById(req.params.id)
      .select("attachments patient doctor bookingId")
      .lean();
    if (!check)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    const att = check.attachments?.find(
      (a) => String(a._id) === req.params.attachmentId,
    );
    if (!att)
      return res
        .status(404)
        .json({ success: false, message: "Attachment not found" });

    const isOwner = String(att.uploadedBy) === String(req.user._id);
    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    if (!isOwner && !isAdmin)
      return res.status(403).json({ success: false, message: "Access denied" });

    await Consultation.updateOne(
      { _id: req.params.id, "attachments._id": req.params.attachmentId },
      { $set: { "attachments.$.isDeleted": true, updatedBy: req.user._id } },
    );

    return res.json({ success: true, message: "Attachment deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — PRESCRIPTION
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/:id/prescription/upload",
  protect,
  authorize("doctor"),
  upload.single("prescription"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });

      const check = await Consultation.findById(req.params.id)
        .select("status doctor bookingId patient")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (!(await doctorOwnsConsultation(check, req.user._id)))
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      if (!["active", "paused", "completed"].includes(check.status))
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot upload prescription in status: ${check.status}`,
          });

      const fileUrl = req.file.location;
      await Consultation.updateOne(
        { _id: req.params.id },
        {
          $push: {
            attachments: {
              uploadedBy: req.user._id,
              uploaderRole: "doctor",
              attachmentType: "prescription",
              fileName: req.file.originalname,
              mimeType: req.file.mimetype,
              fileSize: req.file.size,
              storageUrl: fileUrl,
              accessLevel: "shared",
            },
          },
          $set: {
            prescriptionUploaded: true,
            prescriptionUploadedAt: new Date(),
            updatedBy: req.user._id,
          },
        },
      );

      const patient = await User.findById(check.patient)
        .select("email name phone")
        .lean();
      await createNotification({
        recipient: check.patient,
        title: "Prescription Uploaded",
        body: "Your doctor uploaded your prescription.",
        type: "Care_Task_Completed",
        bookingId: check.bookingId,
      });
      emailConsultationUpdate({
        toUser: patient,
        subject: "Prescription Ready",
        body: "Download your prescription from the app.",
        bookingId: check.bookingId,
      });
      emitBooking(check.bookingId, "prescription_uploaded", {
        consultationId: check._id,
        fileUrl,
        timestamp: new Date(),
      });

      return res.json({
        success: true,
        message: "Prescription uploaded",
        data: { fileUrl, fileName: req.file.originalname },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.post(
  "/:id/prescription",
  protect,
  authorize("doctor"),
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.id)
        .populate("patient", "name phone email")
        .lean();
      if (!consultation)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (!(await doctorOwnsConsultation(consultation, req.user._id)))
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      if (!["active", "paused", "completed"].includes(consultation.status))
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot issue prescription in status: ${consultation.status}`,
          });

      const {
        diagnosis,
        diagnosisCode,
        chiefComplaints,
        clinicalFindings,
        medicines = [],
        labTests = [],
        followUpDate,
        followUpInstructions,
        advice,
        referralNote,
        vitals,
      } = req.body;

      const dp = await DoctorProfile.findOne({ user: req.user._id })
        .populate("user", "name phone email")
        .lean();

      const booking = await Booking.findById(consultation.bookingId).lean();
      const op = booking
        ? await OutPatientRecord.findOne({ booking: booking._id }).lean()
        : null;

      const rx = await EPrescription.create({
        booking: consultation.bookingId,
        outPatientRecord: op?._id || null,
        doctor: {
          userId: req.user._id,
          doctorProfileId: dp._id,
          name: dp.user?.name,
          registrationNumber: dp.registrationNumber,
          specialization: dp.specialization,
          phone: dp.user?.phone,
          email: dp.user?.email,
        },
        patient: {
          userId: consultation.patient._id || consultation.patient,
          name: consultation.patient.name || booking?.patientInfo?.name,
          age: booking?.patientInfo?.age,
          gender: booking?.patientInfo?.gender,
          phone: consultation.patient.phone,
          bloodGroup: booking?.patientInfo?.bloodGroup,
          weight: booking?.patientInfo?.weight
            ? String(booking.patientInfo.weight)
            : undefined,
        },
        diagnosis,
        diagnosisCode,
        chiefComplaints,
        clinicalFindings,
        medicines,
        labTests,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        followUpInstructions,
        advice,
        referralNote,
        vitals,
        status: "issued",
        createdBy: req.user._id,
      });

      await Consultation.updateOne(
        { _id: req.params.id },
        {
          $push: { prescriptions: rx._id },
          $set: {
            prescription: rx._id,
            prescriptionUploaded: true,
            prescriptionUploadedAt: new Date(),
            updatedBy: req.user._id,
          },
        },
      );

      const patient = await User.findById(
        consultation.patient._id || consultation.patient,
      )
        .select("email name phone")
        .lean();
      await createNotification({
        recipient: consultation.patient._id || consultation.patient,
        title: "Prescription Issued",
        body: `RX#${rx.rxNumber} issued.`,
        type: "Care_Task_Completed",
        bookingId: consultation.bookingId,
      });
      emailConsultationUpdate({
        toUser: patient,
        subject: `Prescription Issued — RX#${rx.rxNumber}`,
        body: `<b>Diagnosis:</b> ${diagnosis || "As discussed"}<br/>
                    <b>Medicines:</b> ${medicines.length} item(s)<br/>
                    <b>RX Number:</b> ${rx.rxNumber}`,
        bookingId: consultation.bookingId,
      });
      emitBooking(consultation.bookingId, "prescription_issued", {
        consultationId: req.params.id,
        rxNumber: rx.rxNumber,
        rxId: rx._id,
        timestamp: new Date(),
      });

      return res
        .status(201)
        .json({
          success: true,
          message: "Prescription issued",
          data: { prescription: rx },
        });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get("/:id/prescriptions", protect, async (req, res) => {
  try {
    const check = await Consultation.findById(req.params.id)
      .select("prescriptions patient doctor bookingId")
      .lean();
    if (!check)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    const allowed = await checkConsultationAccess(check, req);
    if (!allowed)
      return res.status(403).json({ success: false, message: "Access denied" });

    const prescriptions = await EPrescription.find({
      _id: { $in: check.prescriptions ?? [] },
    }).lean();
    return res.json({
      success: true,
      data: { prescriptions, total: prescriptions.length },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — PARTICIPANTS
// ══════════════════════════════════════════════════════════════════════════════

router.patch(
  "/:id/participants/:userId/mute",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { muted = true } = req.body;
      const check = await Consultation.findById(req.params.id)
        .select("doctor bookingId participants")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      await Consultation.updateOne(
        { _id: req.params.id, "participants.userId": req.params.userId },
        {
          $set: {
            "participants.$.isMutedByHost": muted,
            updatedBy: req.user._id,
          },
        },
      );

      emitBooking(
        check.bookingId,
        muted ? "participant_muted" : "participant_unmuted",
        {
          consultationId: req.params.id,
          targetUserId: req.params.userId,
          by: String(req.user._id),
          timestamp: new Date(),
        },
      );

      return res.json({
        success: true,
        message: muted ? "Participant muted" : "Participant unmuted",
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.delete(
  "/:id/participants/:userId",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const check = await Consultation.findById(req.params.id)
        .select("doctor bookingId")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      await Consultation.updateOne(
        { _id: req.params.id, "participants.userId": req.params.userId },
        {
          $set: {
            "participants.$.connectionStatus": "disconnected",
            "participants.$.leftAt": new Date(),
            updatedBy: req.user._id,
          },
          $push: {
            eventLogs: {
              eventType: "participant_kicked",
              actorType: req.user.role === "doctor" ? "doctor" : "admin",
              actorId: req.user._id,
              severity: "warning",
              source: "server",
              timestamp: new Date(),
              payload: { targetUserId: req.params.userId, reason },
            },
          },
        },
      );

      emitBooking(check.bookingId, "participant_kicked", {
        consultationId: req.params.id,
        targetUserId: req.params.userId,
        reason: reason || null,
        by: String(req.user._id),
        timestamp: new Date(),
      });

      return res.json({ success: true, message: "Participant removed" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/screen-share",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean")
        return res
          .status(400)
          .json({ success: false, message: "enabled boolean is required" });

      const check = await Consultation.findById(req.params.id)
        .select("doctor bookingId")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      await Consultation.updateOne(
        { _id: req.params.id },
        { $set: { screenShareEnabled: enabled, updatedBy: req.user._id } },
      );

      emitBooking(check.bookingId, "screen_share_toggled", {
        consultationId: req.params.id,
        screenShareEnabled: enabled,
        by: String(req.user._id),
        timestamp: new Date(),
      });

      return res.json({
        success: true,
        message: `Screen share ${enabled ? "enabled" : "disabled"}`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get("/:id/participants", protect, async (req, res) => {
  try {
    const check = await Consultation.findById(req.params.id)
      .select("participants patient doctor")
      .lean();
    if (!check)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    const allowed = await checkConsultationAccess(check, req);
    if (!allowed)
      return res.status(403).json({ success: false, message: "Access denied" });

    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    const participants = (check.participants ?? []).map((p) => {
      const out = { ...p };
      if (!isAdmin) delete out.ipAddress;
      return out;
    });

    return res.json({
      success: true,
      data: { participants, total: participants.length },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — NOTES & FEEDBACK
// ══════════════════════════════════════════════════════════════════════════════

router.patch(
  "/:id/doctor-notes",
  protect,
  authorize("doctor"),
  async (req, res) => {
    try {
      const { notes } = req.body;
      if (!notes?.trim())
        return res
          .status(400)
          .json({ success: false, message: "notes required" });

      const check = await Consultation.findById(req.params.id)
        .select("doctor")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });
      if (!(await doctorOwnsConsultation(check, req.user._id)))
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      await Consultation.updateOne(
        { _id: req.params.id },
        {
          $set: { doctorInternalNotes: notes.trim(), updatedBy: req.user._id },
        },
      );
      return res.json({ success: true, message: "Notes saved" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/feedback",
  protect,
  authorize("customer"),
  async (req, res) => {
    try {
      const {
        patientRating,
        audioQualityRating,
        videoQualityRating,
        waitingExperienceRating,
        appExperienceRating,
        review,
        wouldRecommend,
      } = req.body;

      if (!patientRating || patientRating < 1 || patientRating > 5)
        return res
          .status(400)
          .json({ success: false, message: "patientRating 1-5 required" });

      const check = await Consultation.findById(req.params.id)
        .select("status patient doctor isRated")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (!patientOwnsConsultation(check, req.user._id))
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      if (check.status !== "completed")
        return res
          .status(400)
          .json({
            success: false,
            message: "Can only rate completed consultations",
          });

      if (check.isRated)
        return res
          .status(409)
          .json({ success: false, message: "Feedback already submitted" });

      const consultation = await Consultation.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            feedback: {
              patientRating,
              audioQualityRating: audioQualityRating || null,
              videoQualityRating: videoQualityRating || null,
              waitingExperienceRating: waitingExperienceRating || null,
              appExperienceRating: appExperienceRating || null,
              review: review || null,
              wouldRecommend: wouldRecommend ?? null,
              isPublic: true,
              submittedAt: new Date(),
            },
            isRated: true,
            updatedBy: req.user._id,
          },
        },
        { new: true },
      );

      await invalidateConsultationCache(
        consultation._id,
        consultation.patient,
        consultation.doctor,
      );
      return res.json({
        success: true,
        message: "Feedback submitted",
        data: { feedback: consultation.feedback },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — NETWORK ANALYTICS & SDK ERRORS
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  "/:id/analytics",
  protect,
  analyticsRateLimiter,
  async (req, res) => {
    try {
      const {
        bandwidth,
        latency,
        jitter,
        packetLoss,
        networkType,
        cpuUsage,
        memoryUsage,
        batteryLevel,
      } = req.body;

      const check = await Consultation.findById(req.params.id)
        .select("patient doctor hospital")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      const allowed = await checkConsultationAccess(check, req);
      if (!allowed)
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      let role = "patient";
      if (req.user.role === "doctor") role = "doctor";
      else if (req.user.role === "care_assistant") role = "care_assistant";

      await Consultation.updateOne(
        { _id: req.params.id },
        {
          $push: {
            networkAnalytics: {
              $each: [
                {
                  participantId: req.user._id,
                  role,
                  timestamp: new Date(),
                  bandwidth,
                  latency,
                  jitter,
                  packetLoss,
                  networkType: networkType || "unknown",
                  cpuUsage,
                  memoryUsage,
                  batteryLevel,
                },
              ],
              $slice: -200,
            },
          },
        },
      ).catch(() => {});

      return res.json({ success: true, message: "Analytics recorded" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/:id/analytics",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const check = await Consultation.findById(req.params.id)
        .select("networkAnalytics analytics networkStats patient doctor")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      const entries = check.networkAnalytics ?? [];
      const avg = (arr) =>
        arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

      const summary = {
        totalEntries: entries.length,
        avgLatency: Math.round(avg(entries.map((e) => e.latency ?? 0))),
        avgBandwidth: Math.round(avg(entries.map((e) => e.bandwidth ?? 0))),
        avgJitter: Math.round(avg(entries.map((e) => e.jitter ?? 0))),
        avgPacketLoss: +avg(entries.map((e) => e.packetLoss ?? 0)).toFixed(2),
        consultationAnalytics: check.analytics,
        networkStats: check.networkStats,
      };

      return res.json({ success: true, data: summary });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.post("/:id/sdk-error", protect, async (req, res) => {
  try {
    const { code, message: errorMessage, severity = "error" } = req.body;
    await Consultation.updateOne(
      { _id: req.params.id },
      {
        $push: {
          sdkErrors: {
            code,
            message: errorMessage,
            participantId: String(req.user._id),
            timestamp: new Date(),
            severity,
            resolved: false,
          },
        },
      },
    );
    return res.json({ success: true, message: "SDK error logged" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — EVENT LOGS
// ══════════════════════════════════════════════════════════════════════════════

router.get(
  "/:id/events",
  protect,
  authorize("doctor", "admin", "superadmin"),
  async (req, res) => {
    try {
      const check = await Consultation.findById(req.params.id)
        .select("eventLogs patient doctor")
        .lean();
      if (!check)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      if (
        req.user.role === "doctor" &&
        !(await doctorOwnsConsultation(check, req.user._id))
      )
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });

      const { page, limit, skip } = getPagination(
        req.query.page,
        req.query.limit,
        500,
      );
      const { severity, eventType } = req.query;

      let events = check.eventLogs ?? [];
      if (severity) events = events.filter((e) => e.severity === severity);
      if (eventType) events = events.filter((e) => e.eventType === eventType);

      const sliced = events.slice(skip, skip + limit);
      return res.json({
        success: true,
        data: {
          events: sliced,
          total: events.length,
          page,
          pages: Math.ceil(events.length / limit),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.post("/:id/events", protect, async (req, res) => {
  try {
    const { eventType, payload, severity = "info" } = req.body;
    if (!eventType)
      return res
        .status(400)
        .json({ success: false, message: "eventType required" });

    const check = await Consultation.findById(req.params.id)
      .select("patient doctor")
      .lean();
    if (!check)
      return res
        .status(404)
        .json({ success: false, message: "Consultation not found" });

    const allowed = await checkConsultationAccess(check, req);
    if (!allowed)
      return res.status(403).json({ success: false, message: "Access denied" });

    let actorType = "patient";
    if (req.user.role === "doctor") actorType = "doctor";
    else if (["admin", "superadmin"].includes(req.user.role))
      actorType = "admin";
    else if (req.user.role === "care_assistant") actorType = "care_assistant";

    await Consultation.updateOne(
      { _id: req.params.id },
      {
        $push: {
          eventLogs: {
            $each: [
              {
                eventType,
                actorType,
                actorId: req.user._id,
                severity,
                source: "client",
                timestamp: new Date(),
                payload,
              },
            ],
            $slice: -1000,
          },
        },
      },
    );

    return res.json({ success: true, message: "Event logged" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — ADMIN
// ══════════════════════════════════════════════════════════════════════════════

router.patch(
  "/:id/admin/force-end",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { reason = "Admin force ended" } = req.body;

      const consultation = await Consultation.findById(req.params.id).session(
        session,
      );
      if (!consultation) throw new Error("Consultation not found");
      if (TERMINAL.has(consultation.status))
        throw new Error(`Already terminal: ${consultation.status}`);

      const now = new Date();
      consultation.status = "completed";
      consultation.actualEndTime = now;
      consultation.roomEnded = true;
      consultation.endedBy = "admin";
      consultation.endedByUserId = req.user._id;
      consultation.endedReason = reason;
      consultation.autoEndedBySystem = false;
      consultation.consultationStage = "post_consultation";
      consultation.updatedBy = req.user._id;
      if (consultation.actualStartTime) {
        consultation.actualDurationMinutes = Math.round(
          (now - consultation.actualStartTime) / 60000,
        );
      }
      await consultation.save({ session });
      await Booking.findByIdAndUpdate(
        consultation.bookingId,
        { $set: { status: "completed", updatedBy: req.user._id } },
        { session },
      );
      await session.commitTransaction();

      emitBooking(consultation.bookingId, "consultation_ended", {
        consultationId: consultation._id,
        status: "completed",
        reason,
        forcedByAdmin: true,
        timestamp: now,
      });
      await invalidateConsultationCache(
        consultation._id,
        consultation.patient,
        consultation.doctor,
      );
      return res.json({
        success: true,
        message: "Force-ended",
        data: { consultation: stripTokens(consultation) },
      });
    } catch (err) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: err.message });
    } finally {
      session.endSession();
    }
  },
);

router.patch(
  "/:id/admin/notes",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const { notes } = req.body;
      if (!notes?.trim())
        return res
          .status(400)
          .json({ success: false, message: "notes required" });
      await Consultation.updateOne(
        { _id: req.params.id },
        { $set: { internalAdminNotes: notes.trim(), updatedBy: req.user._id } },
      );
      return res.json({ success: true, message: "Admin notes saved" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.get(
  "/:id/admin/full",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.id)
        .select(
          "+doctorInternalNotes +internalAdminNotes +hostToken +participantToken +agoraAppId +webhookSecret",
        )
        .populate("patient", "name phone email")
        .populate({
          path: "doctor",
          populate: { path: "user", select: "name phone email" },
        })
        .populate("hospital", "name address contact")
        .lean();
      if (!consultation)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      return res.json({
        success: true,
        data: {
          consultation: {
            ...consultation,
            roomId: consultation.agoraChannelId,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/admin/priority",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const { priority } = req.body;
      const VALID = ["routine", "urgent", "emergency", "critical"];
      if (!VALID.includes(priority))
        return res
          .status(400)
          .json({
            success: false,
            message: `priority one of: ${VALID.join(", ")}`,
          });

      await Consultation.updateOne(
        { _id: req.params.id },
        { $set: { priority, updatedBy: req.user._id } },
      );
      return res.json({
        success: true,
        message: `Priority set to ${priority}`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.patch(
  "/:id/admin/reassign-doctor",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const { doctorProfileId } = req.body;
      if (!doctorProfileId)
        return res
          .status(400)
          .json({ success: false, message: "doctorProfileId required" });

      const dp = await DoctorProfile.findById(doctorProfileId)
        .select("_id")
        .lean();
      if (!dp)
        return res
          .status(404)
          .json({ success: false, message: "Doctor profile not found" });

      const consultation = await Consultation.findByIdAndUpdate(
        req.params.id,
        { $set: { doctor: doctorProfileId, updatedBy: req.user._id } },
        { new: true },
      );
      if (!consultation)
        return res
          .status(404)
          .json({ success: false, message: "Consultation not found" });

      emitBooking(consultation.bookingId, "doctor_reassigned", {
        consultationId: consultation._id,
        newDoctorId: doctorProfileId,
        timestamp: new Date(),
      });

      await invalidateConsultationCache(
        consultation._id,
        consultation.patient,
        consultation.doctor,
      );
      return res.json({ success: true, message: "Doctor reassigned" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.post(
  "/admin/bulk-action",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const { consultationIds, action, reason } = req.body;
      if (!Array.isArray(consultationIds) || !consultationIds.length)
        return res
          .status(400)
          .json({ success: false, message: "consultationIds[] required" });
      if (!["cancel", "mark_no_show"].includes(action))
        return res
          .status(400)
          .json({
            success: false,
            message: "action must be cancel or mark_no_show",
          });

      const newStatus = "cancelled";

      const result = await Consultation.updateMany(
        { _id: { $in: consultationIds }, status: { $nin: [...TERMINAL] } },
        {
          $set: {
            status: newStatus,
            cancelledBy: "admin",
            cancelledByUserId: req.user._id,
            cancellationReason: reason || `Bulk ${action}`,
            cancelledAt: new Date(),
            consultationStage: "closed",
            updatedBy: req.user._id,
          },
        },
      );

      return res.json({
        success: true,
        message: `Bulk action applied`,
        data: { matched: result.matchedCount, modified: result.modifiedCount },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

export default router;
