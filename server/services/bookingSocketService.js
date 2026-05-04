/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOKING SOCKET SERVICE — Likeson.in
 * services/bookingSocketService.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ROOMS:
 *   booking:{bookingId}     → customer + driver + care assistant + TP (if agency)
 *   tp:{transportPartnerId} → TP dashboard (receives booking assignments from admin)
 *   admin:ops               → admin live ops feed
 *
 * AUTH:
 *   Socket handshake must carry JWT in socket.handshake.auth.token
 *   Server verifies token before ANY room join is permitted.
 *
 * RATE LIMITING:
 *   Driver location push: max 1 update per 2 seconds per socket (stored in Map).
 *   Violations are silently dropped — no disconnect.
 *
 * INIT:
 *   Call initBookingSocket(io) once in server.js after httpServer + io setup.
 *   Call getBookingSocketService() anywhere in router/controller to emit events.
 *
 * USAGE IN ROUTER:
 *   import { getBookingSocketService } from '../services/bookingSocketService.js';
 *   const socketService = getBookingSocketService();
 *   socketService?.emitToRoom(`booking:${bookingId}`, 'ride_started', { ... });
 *
 * server.js usage:
 *   import { Server } from 'socket.io';
 *   import { initBookingSocket } from './services/bookingSocketService.js';
 *   const io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_URL } });
 *   initBookingSocket(io);
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Server }           from 'socket.io';   // FIX: named import as requested
import jwt                  from 'jsonwebtoken';
import mongoose             from 'mongoose';

// ── Models ────────────────────────────────────────────────────────────────────
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import Booking              from '../models/Booking.js';
import Ride                 from '../models/Ride.js';
import RideTracking         from '../models/RideTracking.js';
import TransportPartner     from '../models/TransportPartner.js';
import User                 from '../models/User.js';

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

/** @type {BookingSocketService|null} */
let _instance = null;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LOCATION_THROTTLE_MS = 2000; // 2 s between location pushes per socket
const MAX_PATH_POINTS      = 500;  // cap breadcrumb trail per RideTracking doc

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify JWT from socket handshake.
 * @param {string} token
 * @returns {object|null} decoded payload or null
 */
const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOM AUTHORIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a decoded user + room name → check if allowed to join.
 * Verifies user is actually linked to the booking/TP (not just guessing IDs).
 *
 * @param {{ _id: string, role: string }} user
 * @param {string} room  — "booking:abc123" | "tp:xyz" | "admin:ops"
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
const canJoinRoom = async (user, room) => {
  const { _id: userId, role } = user;

  // ── admin:ops ─────────────────────────────────────────────────────────────
  if (room === 'admin:ops') {
    if (['admin', 'superadmin'].includes(role)) return { allowed: true };
    return { allowed: false, reason: 'Admin only room' };
  }

  // ── tp:{tpId} ─────────────────────────────────────────────────────────────
  if (room.startsWith('tp:')) {
    if (!['transportpartner', 'admin', 'superadmin'].includes(role))
      return { allowed: false, reason: 'TP or admin only' };

    if (['admin', 'superadmin'].includes(role)) return { allowed: true };

    const tpId = room.replace('tp:', '');
    if (!mongoose.Types.ObjectId.isValid(tpId))
      return { allowed: false, reason: 'Invalid TP ID' };

    const tp = await TransportPartner.findOne({ _id: tpId, user: userId })
      .select('_id')
      .lean();
    if (!tp) return { allowed: false, reason: 'You do not manage this TP' };
    return { allowed: true };
  }

  // ── booking:{bookingId} ───────────────────────────────────────────────────
  if (room.startsWith('booking:')) {
    const bookingId = room.replace('booking:', '');
    if (!mongoose.Types.ObjectId.isValid(bookingId))
      return { allowed: false, reason: 'Invalid booking ID' };

    if (['admin', 'superadmin'].includes(role)) return { allowed: true };

    const booking = await Booking.findById(bookingId)
      .select('customer transport.driver careAssistant.careAssistant assignedTP')
      .lean();

    if (!booking) return { allowed: false, reason: 'Booking not found' };

    // Customer
    if (booking.customer?.toString() === userId) return { allowed: true };

    // Driver (agency or solo) — check via Driver profile OR Ride assignment
    if (['driver', 'solodriverpartner'].includes(role)) {
      // Check if Driver profile linked
      const driver = await Driver.findOne({ user: userId }).select('_id').lean();
      if (driver && booking.transport?.driver?.toString() === driver._id.toString())
        return { allowed: true };

      // Also allow if a Ride doc links this driver to this booking
      const ride = await Ride.findOne({ booking: bookingId, driver: userId })
        .select('_id')
        .lean();
      if (ride) return { allowed: true };
    }

    // Care assistant
    if (role === 'care assistant') {
      const caProfile = await CareAssistantProfile.findOne({ user: userId })
        .select('_id')
        .lean();
      if (
        caProfile &&
        booking.careAssistant?.careAssistant?.toString() === caProfile._id.toString()
      )
        return { allowed: true };
    }

    // Transport partner — can monitor bookings in their fleet
    if (role === 'transportpartner') {
      const tp = await TransportPartner.findOne({ user: userId }).select('_id').lean();
      // FIX: check booking.assignedTP (root field, not booking.transport.assignedTP)
      if (tp && booking.assignedTP?.toString() === tp._id.toString())
        return { allowed: true };
    }

    return { allowed: false, reason: 'Not linked to this booking' };
  }

  return { allowed: false, reason: 'Unknown room format' };
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING SOCKET SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class BookingSocketService {
  /**
   * @param {import('socket.io').Server} io
   */
  constructor(io) {
    this.io = io;

    /**
     * Map<socketId, {
     *   userId:      string,
     *   role:        string,
     *   name:        string,
     *   joinedRooms: Set<string>,
     *   connectedAt: Date
     * }>
     */
    this.connectedClients = new Map();

    /**
     * Map<socketId, lastLocationTimestamp> — for rate limiting location pushes
     */
    this.locationThrottle = new Map();
  }

  // ── Public: emit to room ──────────────────────────────────────────────────

  /**
   * Emit event to all sockets in a room.
   * @param {string} room
   * @param {string} event
   * @param {object} payload
   */
  emitToRoom(room, event, payload) {
    this.io.to(room).emit(event, {
      ...payload,
      _serverTime: new Date().toISOString(),
    });
  }

  /**
   * Emit to a specific socket by socketId.
   * @param {string} socketId
   * @param {string} event
   * @param {object} payload
   */
  emitToSocket(socketId, event, payload) {
    this.io.to(socketId).emit(event, {
      ...payload,
      _serverTime: new Date().toISOString(),
    });
  }

  /**
   * Broadcast to admin:ops room.
   * @param {string} event
   * @param {object} payload
   */
  emitToAdminOps(event, payload) {
    this.emitToRoom('admin:ops', event, payload);
  }

  // ── Setup: attach all listeners to incoming socket ────────────────────────

  /**
   * Called once per new connection after auth middleware passes.
   * @param {import('socket.io').Socket} socket
   * @param {{ _id: string, role: string, name: string }} user
   */
  setupSocket(socket, user) {
    const { _id: userId, role, name } = user;

    // Store metadata
    this.connectedClients.set(socket.id, {
      userId,
      role,
      name,
      joinedRooms: new Set(),
      connectedAt: new Date(),
    });

    console.log(`[Socket] Connected: ${name} (${role}) | ${socket.id}`);

    // Admins auto-join admin:ops
    if (['admin', 'superadmin'].includes(role)) {
      socket.join('admin:ops');
      this.connectedClients.get(socket.id)?.joinedRooms.add('admin:ops');
      console.log(`[Socket] ${name} auto-joined admin:ops`);
    }

    // ── join_booking_room ────────────────────────────────────────────────────
    /**
     * Client emits: { bookingId }
     * Server joins socket to "booking:{bookingId}" if authorized.
     * Ack: joined_room | error
     */
    socket.on('join_booking_room', async ({ bookingId } = {}) => {
      try {
        if (!bookingId) {
          socket.emit('error', { message: 'bookingId required' });
          return;
        }

        const room = `booking:${bookingId}`;
        const { allowed, reason } = await canJoinRoom({ _id: userId, role }, room);

        if (!allowed) {
          socket.emit('error', { message: reason || 'Cannot join room' });
          return;
        }

        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);

        console.log(`[Socket] ${name} (${role}) joined ${room}`);

        socket.emit('joined_room', {
          room,
          bookingId,
          _serverTime: new Date().toISOString(),
        });

        // Notify others in room
        socket.to(room).emit('participant_joined', {
          role,
          name,
          bookingId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[join_booking_room]', err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── join_tp_room ─────────────────────────────────────────────────────────
    /**
     * Client emits: { tpId }
     * Server joins socket to "tp:{tpId}" if authorized.
     */
    socket.on('join_tp_room', async ({ tpId } = {}) => {
      try {
        if (!tpId) {
          socket.emit('error', { message: 'tpId required' });
          return;
        }

        const room = `tp:${tpId}`;
        const { allowed, reason } = await canJoinRoom({ _id: userId, role }, room);

        if (!allowed) {
          socket.emit('error', { message: reason || 'Cannot join TP room' });
          return;
        }

        socket.join(room);
        this.connectedClients.get(socket.id)?.joinedRooms.add(room);

        socket.emit('joined_room', {
          room,
          tpId,
          _serverTime: new Date().toISOString(),
        });

        console.log(`[Socket] ${name} (${role}) joined ${room}`);
      } catch (err) {
        console.error('[join_tp_room]', err.message);
        socket.emit('error', { message: 'Failed to join TP room' });
      }
    });

    // ── driver_location ──────────────────────────────────────────────────────
    /**
     * Payload: { bookingId?, lat, lng, heading?, speed? }
     *
     * Rate-limited: 1 push per LOCATION_THROTTLE_MS per socket (silently dropped).
     *
     * Writes:
     *   Driver.location                  (agency driver)
     *   SoloDriverPartner.vehicle.lastKnownLocation  (solo)
     *   Ride.liveLocation
     *   RideTracking.currentLocation + .path (capped at MAX_PATH_POINTS)
     *
     * Emits:
     *   location_update → booking:{bookingId}
     */
    socket.on('driver_location', async ({ bookingId, lat, lng, heading, speed } = {}) => {
      try {
        // ── Rate limit ────────────────────────────────────────────────────
        const now  = Date.now();
        const last = this.locationThrottle.get(socket.id) || 0;
        if (now - last < LOCATION_THROTTLE_MS) return; // silent drop
        this.locationThrottle.set(socket.id, now);

        // ── Validate coords ───────────────────────────────────────────────
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)  return;

        const coords = [lng, lat];

        // ── Update driver live location ───────────────────────────────────
        if (['driver', 'solodriverpartner'].includes(role)) {
          if (role === 'driver') {
            await Driver.findOneAndUpdate(
              { user: userId },
              {
                'location.coordinates': coords,
                'location.heading':     heading ?? 0,
                'location.speedKmh':    speed   ?? 0,
                'location.updatedAt':   new Date(),
              }
            );
          } else {
            // Solo driver partner
            await SoloDriverPartner.findOneAndUpdate(
              { user: userId },
              {
                'vehicle.lastKnownLocation.coordinates': coords,
                'vehicle.lastLocationUpdatedAt':         new Date(),
              }
            );
          }
        }

        // ── Update Ride + RideTracking ─────────────────────────────────────
        if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
          const ride = await Ride.findOne({
            booking: bookingId,
            driver:  userId,
            status:  { $in: ['En-Route', 'Arrived', 'Started'] },
          }).select('_id liveLocation').lean();

          if (ride) {
            // Update live location on Ride
            await Ride.findByIdAndUpdate(ride._id, {
              liveLocation: { type: 'Point', coordinates: coords },
            });

            // Append to tracking path — capped at MAX_PATH_POINTS
            await RideTracking.findOneAndUpdate(
              { ride: ride._id },
              {
                currentLocation: { type: 'Point', coordinates: coords },
                $push: {
                  path: {
                    $each: [{
                      lat,
                      lng,
                      speed:     speed   ?? 0,
                      heading:   heading ?? 0,
                      timestamp: new Date(),
                    }],
                    $slice: -MAX_PATH_POINTS,
                  },
                },
                'metrics.lastUpdateAt': new Date(),
              },
              { upsert: true }
            );

            // Emit to booking room
            this.io.to(`booking:${bookingId}`).emit('location_update', {
              lat,
              lng,
              heading:    heading ?? 0,
              speed:      speed   ?? 0,
              role:       role === 'solodriverpartner' ? 'solo_driver' : 'driver',
              updatedAt:  new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        // Location errors are silent — never crash socket
        console.error('[driver_location]', err.message);
      }
    });

    // ── care_location ────────────────────────────────────────────────────────
    /**
     * Payload: { bookingId?, lat, lng }
     *
     * Rate-limited same as driver.
     * Writes: CareAssistantProfile.location
     * Emits:  location_update → booking:{bookingId} (role: 'care_assistant')
     */
    socket.on('care_location', async ({ bookingId, lat, lng } = {}) => {
      try {
        const now  = Date.now();
        const last = this.locationThrottle.get(socket.id) || 0;
        if (now - last < LOCATION_THROTTLE_MS) return;
        this.locationThrottle.set(socket.id, now);

        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)  return;

        // Update CareAssistantProfile location
        await CareAssistantProfile.findOneAndUpdate(
          { user: userId },
          {
            'location.coordinates': [lng, lat],
            'location.updatedAt':   new Date(),
          }
        );

        if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
          this.io.to(`booking:${bookingId}`).emit('location_update', {
            lat,
            lng,
            role:      'care_assistant',
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[care_location]', err.message);
      }
    });

    // ── leave_booking_room ───────────────────────────────────────────────────
    /**
     * Client emits: { bookingId }
     * Server removes socket from that room.
     */
    socket.on('leave_booking_room', ({ bookingId } = {}) => {
      if (!bookingId) return;
      const room = `booking:${bookingId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      console.log(`[Socket] ${name} left ${room}`);
      socket.emit('left_room', { room, _serverTime: new Date().toISOString() });
    });

    // ── leave_tp_room ────────────────────────────────────────────────────────
    socket.on('leave_tp_room', ({ tpId } = {}) => {
      if (!tpId) return;
      const room = `tp:${tpId}`;
      socket.leave(room);
      this.connectedClients.get(socket.id)?.joinedRooms.delete(room);
      console.log(`[Socket] ${name} left ${room}`);
      socket.emit('left_room', { room, _serverTime: new Date().toISOString() });
    });

    // ── ping / pong keep-alive ───────────────────────────────────────────────
    socket.on('ping_health', () => {
      socket.emit('pong_health', {
        serverTime:     new Date().toISOString(),
        connectedSince: this.connectedClients.get(socket.id)?.connectedAt,
      });
    });

    // ── request_booking_state ────────────────────────────────────────────────
    /**
     * Client can request a snapshot of the booking state at any time.
     * Useful after reconnect — avoids client needing to call REST endpoint.
     * Payload: { bookingId }
     */
    socket.on('request_booking_state', async ({ bookingId } = {}) => {
      try {
        if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
          socket.emit('error', { message: 'Invalid bookingId' });
          return;
        }

        // Check room access
        const room = `booking:${bookingId}`;
        const { allowed, reason } = await canJoinRoom({ _id: userId, role }, room);
        if (!allowed) {
          socket.emit('error', { message: reason || 'Access denied' });
          return;
        }

        const booking = await Booking.findById(bookingId)
          .select('status scheduledAt serviceType patientName billing.netAmount transport.driver careAssistant.careAssistant')
          .lean();

        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        const activeRide = await Ride.findOne({
          booking: bookingId,
          status:  { $in: ['Assigned', 'Accepted', 'En-Route', 'Arrived', 'Started'] },
        }).select('status liveLocation driver').lean();

        let tracking = null;
        if (activeRide) {
          tracking = await RideTracking.findOne({ ride: activeRide._id })
            .select('currentLocation metrics')
            .lean();
        }

        socket.emit('booking_state_snapshot', {
          bookingId,
          bookingStatus: booking.status,
          ride: activeRide
            ? {
                status:       activeRide.status,
                liveLocation: activeRide.liveLocation,
              }
            : null,
          tracking: tracking
            ? {
                currentLocation:   tracking.currentLocation,
                remainingDistance: tracking.metrics?.remainingDistanceMeter,
                remainingDuration: tracking.metrics?.remainingDurationSecond,
                lastUpdatedAt:     tracking.metrics?.lastUpdateAt,
              }
            : null,
          _serverTime: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[request_booking_state]', err.message);
        socket.emit('error', { message: 'Failed to fetch booking state' });
      }
    });

    // ── otp_resend_request ───────────────────────────────────────────────────
    /**
     * Customer requests OTP resend via socket (alternative to REST).
     * Server notifies the booking room so driver app can re-display OTP screen.
     * Payload: { bookingId }
     */
    socket.on('otp_resend_request', async ({ bookingId } = {}) => {
      try {
        if (!bookingId || role !== 'customer') return;

        const room = `booking:${bookingId}`;
        const { allowed } = await canJoinRoom({ _id: userId, role }, room);
        if (!allowed) return;

        // Notify driver side to re-show OTP entry
        socket.to(room).emit('otp_resend_requested', {
          bookingId,
          requestedBy: 'customer',
          timestamp:   new Date().toISOString(),
        });
      } catch (err) {
        console.error('[otp_resend_request]', err.message);
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const meta = this.connectedClients.get(socket.id);
      console.log(
        `[Socket] Disconnected: ${meta?.name || socket.id} (${meta?.role || 'unknown'}) | reason: ${reason}`
      );

      this.connectedClients.delete(socket.id);
      this.locationThrottle.delete(socket.id);

      // Notify admin:ops when driver goes offline
      if (meta && ['driver', 'solodriverpartner'].includes(meta.role)) {
        this.io.to('admin:ops').emit('driver_offline', {
          userId:    meta.userId,
          role:      meta.role,
          name:      meta.name,
          timestamp: new Date().toISOString(),
        });
      }

      // Notify booking rooms this socket was in (for UI to update presence)
      if (meta?.joinedRooms) {
        for (const room of meta.joinedRooms) {
          if (room.startsWith('booking:')) {
            this.io.to(room).emit('participant_left', {
              role:      meta.role,
              name:      meta.name,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });

    // ── error handler ────────────────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`[Socket error] ${socket.id}:`, err.message);
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  /**
   * Returns live connection stats for admin dashboard.
   * @returns {{ totalConnected: number, byRole: object, rooms: object }}
   */
  getStats() {
    const byRole = {};
    const rooms  = {};

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

  /**
   * Get all socket IDs for a given userId.
   * Useful when you want to target a specific user across multiple tabs.
   * @param {string} userId
   * @returns {string[]} socketIds
   */
  getSocketIdsByUser(userId) {
    const ids = [];
    for (const [socketId, meta] of this.connectedClients) {
      if (meta.userId === userId) ids.push(socketId);
    }
    return ids;
  }

  /**
   * Check if a specific user is currently connected.
   * @param {string} userId
   * @returns {boolean}
   */
  isUserOnline(userId) {
    for (const [, meta] of this.connectedClients) {
      if (meta.userId === userId) return true;
    }
    return false;
  }

  /**
   * Emit event to a specific user (all their sockets/tabs).
   * @param {string} userId
   * @param {string} event
   * @param {object} payload
   */
  emitToUser(userId, event, payload) {
    const socketIds = this.getSocketIdsByUser(userId);
    for (const id of socketIds) {
      this.emitToSocket(id, event, payload);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — called once from server.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the BookingSocketService.
 * Must be called once after `const io = new Server(httpServer, { ... })`.
 *
 * @param {import('socket.io').Server} io
 * @returns {BookingSocketService}
 *
 * @example
 * // server.js
 * import http                  from 'http';
 * import app                   from './app.js';
 * import { Server }            from 'socket.io';
 * import { initBookingSocket } from './services/bookingSocketService.js';
 *
 * const httpServer = http.createServer(app);
 *
 * const io = new Server(httpServer, {
 *   cors: {
 *     origin:  process.env.FRONTEND_URL,
 *     methods: ['GET', 'POST'],
 *   },
 *   pingTimeout:  60000,
 *   pingInterval: 25000,
 * });
 *
 * initBookingSocket(io);
 *
 * httpServer.listen(process.env.PORT || 5000);
 */
export const initBookingSocket = (io) => {
  if (_instance) {
    console.warn('[BookingSocket] Already initialized — skipping');
    return _instance;
  }

  const service = new BookingSocketService(io);
  _instance     = service;

  // ── Global auth middleware ─────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('AUTH_MISSING: No token provided'));
      }

      const decoded = verifySocketToken(token);
      if (!decoded?._id) {
        return next(new Error('AUTH_INVALID: Token invalid or expired'));
      }

      // Verify user exists + not blocked
      const user = await User.findById(decoded._id)
        .select('name role isBlocked')
        .lean();

      if (!user)         return next(new Error('AUTH_USER_NOT_FOUND'));
      if (user.isBlocked) return next(new Error('AUTH_BLOCKED: Account suspended'));

      // Attach decoded user to socket
      socket.user = {
        _id:  decoded._id.toString(),
        role: user.role,
        name: user.name,
      };

      next();
    } catch (err) {
      next(new Error(`AUTH_ERROR: ${err.message}`));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    service.setupSocket(socket, socket.user);
  });

  // ── Handle uncaught errors at io level ────────────────────────────────────
  io.on('error', (err) => {
    console.error('[Socket.io server error]', err.message);
  });

  console.log('[BookingSocket] Initialized ✅');
  return service;
};

// ─────────────────────────────────────────────────────────────────────────────
// GETTER — used in routers / controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the singleton BookingSocketService instance.
 * Returns null if initBookingSocket() not yet called.
 *
 * @returns {BookingSocketService|null}
 */
export const getBookingSocketService = () => _instance;

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORT Server so callers can import from here if needed
// (Keeps server.js import surface small)
// ─────────────────────────────────────────────────────────────────────────────
export { Server };