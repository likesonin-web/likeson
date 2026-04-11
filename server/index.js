import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import passport from "passport";
import session from "express-session";
import { createServer } from "http";

// Configuration & Database
dotenv.config();
import connectDB from "./config/DB.js";
import "./config/passport.js";
import redisClient from "./config/redis.js";   // ← Redis client (connects on import)

// Socket Service
import { initSocket } from "./services/socketService.js";

// Import Routes
import userRouter               from "./routes/userRoutes.js";
import notificationRouter       from "./routes/notificationRoutes.js";
import hospitalRoutes           from "./routes/hospitalRoutes.js";
import uploadRoutes             from "./routes/uploadRoutes.js";
import adRouter                 from "./routes/advertisementRoutes.js";
import bannerRouter             from "./routes/bannerRoutes.js";
import subscriptionRouter       from "./routes/subscriptionPlanRoutes.js";
import usersubscriptionRouter   from "./routes/userSubscriptionPlan.js";
import transportPartnerRouter   from "./routes/Transportpartnerroutes.js";
import meetingRoutes            from "./routes/meetingRoutes.js";
import userManagerRoutes        from "./routes/super-admin/userManagementRoutes.js";
import medicinesRoutes          from "./routes/medicineRoutes.js";
import faqsRoutes               from "./routes/faqROutes.js";
import couponsRoutes            from "./routes/couponRoutes.js";
import chatRoutes               from "./routes/chatRoutes.js";
import orderPharmacyRoutes      from "./routes/orderRoutes.js";
import pharmacyRoutes           from "./routes/pharmacyRoutes.js";
import walletRoutes             from "./routes/walletRoutes.js";
import superadminRoutes         from "./routes/super-admin/superadminRoutes.js";
import legalRoutes              from "./routes/Legalroutes.js";
import marqueeRoutes            from "./routes/marqueeRoutes.js";
import heroRoutes               from "./routes/heroPageRouter.js";
import pharmacyStoreRoutes      from "./routes/pharmacy/Pharmacystoreroutes.js";
import customerUserRouter       from "./routes/customer/Customeruserroutes.js";
import AdminUserRoutes          from "./routes/super-admin/adminUserRoutes.js";
import referralRouter           from "./routes/referralRoutes.js";
import pricingRouter            from './routes/Platformpricingroutes.js'
import soloDriverRouter           from './routes/solordriverRoutes.js'
import careAssistantRouter           from'./routes/careassistantRoutes.js'
// ─────────────────────────────────────────────
// APP & HTTP SERVER
// ─────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 5050;

// ─────────────────────────────────────────────
// 1. CORE MIDDLEWARES
// ─────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

// ─────────────────────────────────────────────
// 2. SECURITY
// ─────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(
  cors({
    origin:      process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods:     ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);

// ─────────────────────────────────────────────
// 3. SESSION & PASSPORT
// ─────────────────────────────────────────────
app.use(
  session({
    secret:            process.env.SESSION_SECRET || "likeson_production_secret",
    resave:            false,
    saveUninitialized: false,
    cookie: {
      secure:   process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge:   24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ─────────────────────────────────────────────
// 4. LOGGING & RATE LIMITING
// ─────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

app.use(
  "/api/",
  rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             200,
    message:         "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders:   false,
  })
);

// ─────────────────────────────────────────────
// 5. ROUTES
// ─────────────────────────────────────────────
app.use("/api/users",              userRouter);
app.use("/api/notifications",      notificationRouter);
app.use("/api/hospitals",          hospitalRoutes);
app.use("/api/upload",             uploadRoutes);
app.use("/api/ads",                adRouter);
app.use("/api/banners",            bannerRouter);
app.use("/api/plans",              subscriptionRouter);
app.use("/api/subscriptions",      usersubscriptionRouter);
app.use("/api/meetings",           meetingRoutes);
app.use("/api/user-management",    userManagerRoutes);
app.use("/api/medicines",          medicinesRoutes);
app.use("/api/faqs",               faqsRoutes);
app.use("/api/coupons",            couponsRoutes);
app.use("/api/chat",               chatRoutes);
app.use("/api/user/pharmacy",      orderPharmacyRoutes);
app.use("/api/pharmacy",           pharmacyRoutes);
app.use("/api/wallet",             walletRoutes);
app.use("/api/superadmin",         superadminRoutes);
app.use("/api/legal",              legalRoutes);
app.use("/api/marquee",            marqueeRoutes);
app.use("/api/hero",               heroRoutes);
app.use("/api/pharmacy-store",     pharmacyStoreRoutes);
app.use("/api/customer",           customerUserRouter);
app.use("/api/admin/users",        AdminUserRoutes);
app.use("/api/transport", transportPartnerRouter);
app.use("/api/referral",           referralRouter);
app.use("/api/pricing",           pricingRouter);
app.use("/api/solo-driver",           soloDriverRouter);
app.use("/api/care-assistant",           careAssistantRouter);
 

import labRoutes from './routes/labRoutes.js';
app.use('/api/labs', labRoutes);

// Health check — also exposes Redis status
app.get("/", async (_req, res) => {
  const redisStatus = redisClient.isReady ? "connected" : "disconnected";
  res.status(200).json({
    status:  "success",
    service: "Likeson Production API",
    message: "System Online 🚀",
    redis:   redisStatus,
  });
});

// ─────────────────────────────────────────────
// 6. GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Global Error Handler:", err.stack);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─────────────────────────────────────────────
// 7. DATABASE → SOCKET.IO → START SERVER
//
// initSocket(httpServer) attaches Socket.IO to
// the same HTTP server as Express so both share
// a single port. The returned `io` instance is:
//
//   • exported as a named export so any REST route
//     can do:  import { io } from '../app.js'
//     and emit real-time events from HTTP handlers
//     (e.g. order status change, push notification).
//
//   • stored on the Express app via app.set('io', io)
//     so route handlers can also do:
//     const io = req.app.get('io');
// ─────────────────────────────────────────────

export let io;

connectDB()
  .then(() => {
    // ── Boot Socket.IO ──────────────────────────────────────────────────────
    io = initSocket(httpServer);
    app.set("io", io);

    // ── Start listening ─────────────────────────────────────────────────────
    httpServer.listen(PORT, () => {
      console.log(`🚀 Likeson Backend running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`🔌 Socket.IO active on ws://localhost:${PORT}`);
      console.log(`🌐 REST API available at http://localhost:${PORT}/api`);
      console.log(`🔴 Redis connected: ${redisClient.isReady}`);
    });
  })
  .catch((error) => {
    console.error("CRITICAL: Database connection failed.", error.message);
    process.exit(1);
  });